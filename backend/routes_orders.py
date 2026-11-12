import hashlib
import hmac
import os
import time
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

import razorpay
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from core import ENV, current_member, db, get_delivery_fee, logger, new_id, now_iso, require_role

router = APIRouter(prefix="/api")

PHONE = r"^[6-9]\d{9}$"
RESERVE_MINUTES = 15
UNPAID = ["pending_payment", "payment_expired", "payment_abandoned"]


class CartLine(BaseModel):
    product_id: str = Field(min_length=1, max_length=80)
    qty: int = Field(ge=1, le=20)


class Address(BaseModel):
    full_name: str = Field(min_length=2, max_length=60)
    phone: str = Field(pattern=PHONE)
    line1: str = Field(min_length=5, max_length=120)
    line2: str = Field(default="", max_length=120)
    city: str = Field(min_length=2, max_length=40)
    pincode: str = Field(pattern=r"^\d{6}$")


class CheckoutIn(BaseModel):
    items: list[CartLine] = Field(min_length=1, max_length=50)
    address: Address
    expected_total: Optional[int] = Field(None, ge=0)


class VerifyIn(BaseModel):
    razorpay_order_id: str = Field(min_length=1, max_length=100)
    razorpay_payment_id: str = Field(min_length=1, max_length=100)
    razorpay_signature: str = Field(min_length=1, max_length=200)


def _keys() -> tuple[str, str]:
    return os.environ.get("RAZORPAY_KEY_ID", ""), os.environ.get("RAZORPAY_KEY_SECRET", "")


def _razorpay_keys() -> tuple[str, str]:
    key_id, secret = _keys()
    if not key_id or not secret:
        raise HTTPException(status_code=503, detail="Online payments are not configured yet. Please try again later.")
    return key_id, secret


# ---------- Stock reservation ----------

async def _reserve(items: list[dict]) -> Optional[dict]:
    """Atomically hold stock for every item; returns the first item that could not be held (after rolling back)."""
    held = []
    for it in items:
        res = await db.products.update_one({"id": it["product_id"], "is_active": True, "stock": {"$gte": it["qty"]}},
                                           {"$inc": {"stock": -it["qty"]}})
        if res.modified_count == 0:
            await _release(held)
            return it
        held.append(it)
    return None


async def _release(items: list[dict]) -> None:
    for it in items:
        await db.products.update_one({"id": it["product_id"]}, {"$inc": {"stock": it["qty"]}})


async def _drop_reservation(order_id: str, new_status: str) -> bool:
    """Claim an unpaid order's held stock exactly once and give it back."""
    order = await db.orders.find_one_and_update(
        {"id": order_id, "status": "pending_payment", "stock_reserved": True, "payment.status": {"$ne": "paid"}},
        {"$set": {"status": new_status, "stock_reserved": False, "updated_at": now_iso()}},
        projection={"_id": 0, "items": 1})
    if order:
        await _release(order["items"])
    return bool(order)


async def mark_paid(order: dict, payment_id: str, _attempt: int = 0) -> None:
    """Secure stock first (if the hold was released), then publish the order as placed in one compare-and-set write."""
    cur = await db.orders.find_one({"id": order["id"]}, {"_id": 0})
    if cur is None or cur["payment"]["status"] == "paid":
        return
    held = bool(cur.get("stock_reserved"))
    ts = now_iso()
    paid = {"payment.status": "paid", "payment.razorpay_payment_id": payment_id, "payment.paid_at": ts, "updated_at": ts}
    unchanged = {"id": cur["id"], "payment.status": {"$ne": "paid"}, "stock_reserved": True if held else {"$ne": True}}
    if not held:
        failed = await _reserve(cur["items"])
        if failed:
            await db.orders.update_one(unchanged, {
                "$set": {**paid, "status": "cancelled", "refund_due": True,
                         "cancel_reason": f"{failed['name']} went out of stock before the payment completed. A full refund is due."},
                "$push": {"timeline": {"status": "cancelled", "at": ts, "by": "system"}}})
            return
    res = await db.orders.update_one(unchanged, {
        "$set": {**paid, "status": "placed", "stock_reserved": True},
        "$push": {"timeline": {"status": "placed", "at": ts, "by": "customer"}}})
    if res.modified_count == 0:
        if not held:
            await _release(cur["items"])
        if _attempt < 2:
            await mark_paid(order, payment_id, _attempt + 1)
        return
    for it in cur["items"]:
        await db.products.update_one({"id": it["product_id"]}, {"$inc": {"sold": it["qty"]}})


async def reconcile(order: dict) -> bool:
    """Ask Razorpay whether an unpaid order was actually captured (e.g. the browser closed before verify)."""
    key_id, secret = _keys()
    if not key_id or not secret or order["payment"]["status"] == "paid":
        return False
    try:
        data = await run_in_threadpool(razorpay.Client(auth=(key_id, secret)).order.payments, order["payment"]["razorpay_order_id"])
    except Exception:
        logger.warning("Razorpay reconcile failed for %s", order["id"])
        return False
    captured = next((p for p in data.get("items", []) if p.get("status") == "captured"), None)
    if captured:
        await mark_paid(order, captured["id"])
    return bool(captured)


_last_sweep = 0.0


async def release_expired_reservations(reconcile_first: bool = True, limit: int = 20) -> None:
    expired = await db.orders.find({"status": "pending_payment", "stock_reserved": True, "reserved_until": {"$lt": now_iso()}},
                                   {"_id": 0}).limit(limit).to_list(limit)
    for order in expired:
        # A hold released here is re-reserved (or refund-flagged) if Razorpay later reports the payment captured.
        if not (reconcile_first and await reconcile(order)):
            await _drop_reservation(order["id"], "payment_expired")


async def sweep_for_storefront() -> None:
    """Cheap, throttled expiry for public catalogue reads: DB-only, at most once every 30 seconds per worker."""
    global _last_sweep
    if time.monotonic() - _last_sweep < 30:
        return
    _last_sweep = time.monotonic()
    await release_expired_reservations(reconcile_first=False, limit=200)


# ---------- Checkout ----------

async def _price_cart(lines: list[CartLine]) -> list[dict]:
    qty_by_id: dict[str, int] = {}
    for line in lines:
        qty_by_id[line.product_id] = qty_by_id.get(line.product_id, 0) + line.qty
    products = await db.products.find({"id": {"$in": list(qty_by_id)}, "is_active": True}, {"_id": 0}).to_list(100)
    found = {p["id"]: p for p in products}
    items = []
    for pid, qty in qty_by_id.items():
        p = found.get(pid)
        if not p:
            raise HTTPException(status_code=400, detail="Some items in your cart are no longer available. Please review your cart.")
        if qty > 20:
            raise HTTPException(status_code=400, detail=f"You can order up to 20 of {p['name']}.")
        items.append({"product_id": pid, "name": p["name"], "unit": p["unit"], "image": p["image"],
                      "price": p["price"], "qty": qty, "line_total": p["price"] * qty})
    return items


@router.post("/orders/checkout")
async def checkout(body: CheckoutIn, member: dict = Depends(current_member)):
    key_id, secret = _razorpay_keys()
    await release_expired_reservations()
    items = await _price_cart(body.items)
    subtotal = sum(i["line_total"] for i in items)
    delivery_fee = await get_delivery_fee()
    total = subtotal + delivery_fee
    if body.expected_total is not None and body.expected_total != total:
        raise HTTPException(status_code=409, detail="Your bill was updated because a price or the delivery charge changed. "
                                                    "Please review the new total and pay again.")
    failed = await _reserve(items)
    if failed:
        p = await db.products.find_one({"id": failed["product_id"]}, {"_id": 0, "stock": 1})
        raise HTTPException(status_code=400, detail=f"Only {(p or {}).get('stock', 0)} left of {failed['name']}. Please reduce the quantity.")
    order_id, number = new_id(), "MB" + new_id()[:10].upper()
    try:
        rz_order = await run_in_threadpool(razorpay.Client(auth=(key_id, secret)).order.create, {
            "amount": total * 100, "currency": "INR", "receipt": number, "payment_capture": 1,
            "notes": {"order_number": number},
        })
    except Exception:
        logger.exception("Razorpay order create failed")
        await _release(items)
        raise HTTPException(status_code=502, detail="Could not start the payment. Please try again.")
    ts = now_iso()
    try:
        await db.orders.insert_one({
        "id": order_id, "order_number": number, "user_id": member["user_id"], "env": ENV,
        "customer": {"name": body.address.full_name, "email": member.get("email") or ""},
        "items": items, "subtotal": subtotal, "delivery_fee": delivery_fee, "total": total,
        "address": body.address.model_dump(), "status": "pending_payment", "stock_reserved": True,
        "reserved_until": (datetime.now(timezone.utc) + timedelta(minutes=RESERVE_MINUTES)).isoformat(),
        "payment": {"method": "razorpay", "status": "pending", "razorpay_order_id": rz_order["id"]},
        "delivery_partner": None, "timeline": [], "created_at": ts, "updated_at": ts,
        })
    except Exception:
        logger.exception("Order insert failed")
        await _release(items)
        raise HTTPException(status_code=500, detail="Could not create your order. Please try again.")
    await db.users.update_one({"user_id": member["user_id"]}, {"$set": {"default_address": body.address.model_dump()}})
    return {"order_id": order_id, "order_number": number, "razorpay_order_id": rz_order["id"],
            "amount": rz_order["amount"], "currency": "INR", "key_id": key_id, "timeout_seconds": RESERVE_MINUTES * 60}


async def _owned(order_id: str, member: dict) -> dict:
    order = await db.orders.find_one({"id": order_id, "user_id": member["user_id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


async def _confirm_captured(order: dict, payment_id: str) -> None:
    """Only treat an order as paid once Razorpay reports the funds captured for this exact order and amount."""
    client = razorpay.Client(auth=_razorpay_keys())
    try:
        pay = await run_in_threadpool(client.payment.fetch, payment_id)
        if pay.get("status") == "authorized":
            pay = await run_in_threadpool(client.payment.capture, payment_id, pay["amount"], {"currency": "INR"})
    except Exception:
        logger.warning("Razorpay payment check failed for %s", order["id"])
        raise HTTPException(status_code=502, detail="We couldn't confirm your payment yet. Please check My orders in a minute.")
    if pay.get("order_id") != order["payment"]["razorpay_order_id"] or pay.get("amount") != order["total"] * 100:
        raise HTTPException(status_code=400, detail="This payment does not match this order.")
    if pay.get("status") != "captured":
        raise HTTPException(status_code=409, detail="Your payment is still being confirmed. Please check My orders in a minute.")


@router.post("/orders/{order_id}/verify")
async def verify_payment(order_id: str, body: VerifyIn, member: dict = Depends(current_member)):
    _, secret = _razorpay_keys()
    order = await _owned(order_id, member)
    if order["payment"]["status"] != "paid":
        if body.razorpay_order_id != order["payment"]["razorpay_order_id"]:
            raise HTTPException(status_code=400, detail="This payment does not belong to this order.")
        expected = hmac.new(secret.encode(), f"{body.razorpay_order_id}|{body.razorpay_payment_id}".encode(),
                            hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, body.razorpay_signature):
            raise HTTPException(status_code=400, detail="Payment verification failed. If money was deducted, Razorpay will refund it.")
        await _confirm_captured(order, body.razorpay_payment_id)
        await mark_paid(order, body.razorpay_payment_id)
    fresh = await db.orders.find_one({"id": order_id}, {"_id": 0, "status": 1})
    return {"ok": True, "status": fresh["status"]}


@router.post("/orders/{order_id}/abandon")
async def abandon_payment(order_id: str, member: dict = Depends(current_member)):
    order = await _owned(order_id, member)
    if order["status"] == "pending_payment" and not await reconcile(order):
        await _drop_reservation(order_id, "payment_abandoned")
    fresh = await db.orders.find_one({"id": order_id}, {"_id": 0, "status": 1, "payment": 1})
    return {"ok": True, "status": fresh["status"], "paid": fresh["payment"]["status"] == "paid"}


@router.get("/orders")
async def my_orders(member: dict = Depends(current_member)):
    since = (datetime.now(timezone.utc) - timedelta(hours=48)).isoformat()
    unpaid = await db.orders.find({"user_id": member["user_id"], "status": {"$in": UNPAID}, "payment.status": {"$ne": "paid"},
                                   "created_at": {"$gte": since}}, {"_id": 0}).sort("created_at", -1).limit(3).to_list(3)
    for order in unpaid:
        await reconcile(order)
    return await db.orders.find({"user_id": member["user_id"], "payment.status": "paid"}, {"_id": 0}) \
        .sort("created_at", -1).limit(100).to_list(100)


@router.get("/orders/{order_id}")
async def my_order(order_id: str, member: dict = Depends(current_member)):
    order = await _owned(order_id, member)
    if order["status"] in UNPAID and await reconcile(order):
        order = await _owned(order_id, member)
    return order


# ---------- Delivery partners ----------

class ApplyIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=60)
    phone: str = Field(pattern=PHONE)
    vehicle_type: Literal["bike", "scooter", "bicycle", "electric"]
    vehicle_number: str = Field(min_length=4, max_length=15, pattern=r"^[A-Za-z0-9 -]+$")
    area: str = Field(min_length=2, max_length=80)


class RiderStatusIn(BaseModel):
    status: Literal["out_for_delivery", "delivered"]


RIDER_NEXT = {"assigned": "out_for_delivery", "out_for_delivery": "delivered"}


@router.post("/delivery/apply")
async def apply_as_rider(body: ApplyIn, member: dict = Depends(current_member)):
    if member["role"] != "customer":
        raise HTTPException(status_code=409, detail="Your account already has staff access.")
    existing = await db.delivery_applications.find_one({"user_id": member["user_id"]}, {"_id": 0})
    if existing and existing["status"] in ("pending", "approved"):
        raise HTTPException(status_code=409, detail="You already have an application under review.")
    ts = now_iso()
    doc = {**body.model_dump(), "vehicle_number": body.vehicle_number.upper(), "status": "pending", "note": "",
           "email": member.get("email") or "", "env": ENV, "submitted_at": ts, "reviewed_at": None}
    await db.delivery_applications.update_one(
        {"user_id": member["user_id"]},
        {"$set": doc, "$setOnInsert": {"id": new_id(), "user_id": member["user_id"]}}, upsert=True)
    return await db.delivery_applications.find_one({"user_id": member["user_id"]}, {"_id": 0})


@router.get("/delivery/orders")
async def rider_orders(rider: dict = Depends(require_role("delivery"))):
    return await db.orders.find({"delivery_partner.user_id": rider["user_id"], "payment.status": "paid"}, {"_id": 0}) \
        .sort("updated_at", -1).limit(200).to_list(200)


@router.post("/delivery/orders/{order_id}/status")
async def rider_update_status(order_id: str, body: RiderStatusIn, rider: dict = Depends(require_role("delivery"))):
    order = await db.orders.find_one({"id": order_id, "delivery_partner.user_id": rider["user_id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if RIDER_NEXT.get(order["status"]) != body.status:
        raise HTTPException(status_code=409, detail="This step is not available for the order right now.")
    ts = now_iso()
    res = await db.orders.update_one(
        {"id": order_id, "status": order["status"], "delivery_partner.user_id": rider["user_id"]},
        {"$set": {"status": body.status, "updated_at": ts},
         "$push": {"timeline": {"status": body.status, "at": ts, "by": "delivery"}}})
    if res.modified_count == 0:
        raise HTTPException(status_code=409, detail="This order was just updated by someone else. Please refresh.")
    return await db.orders.find_one({"id": order_id}, {"_id": 0})
