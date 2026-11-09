import hashlib
import hmac
import os
from typing import Literal

import razorpay
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from core import DELIVERY_FEE, ENV, current_member, db, logger, new_id, now_iso, require_role

router = APIRouter(prefix="/api")

PHONE = r"^[6-9]\d{9}$"


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


class VerifyIn(BaseModel):
    razorpay_order_id: str = Field(min_length=1, max_length=100)
    razorpay_payment_id: str = Field(min_length=1, max_length=100)
    razorpay_signature: str = Field(min_length=1, max_length=200)


def _razorpay_keys() -> tuple[str, str]:
    key_id, secret = os.environ.get("RAZORPAY_KEY_ID", ""), os.environ.get("RAZORPAY_KEY_SECRET", "")
    if not key_id or not secret:
        raise HTTPException(status_code=503, detail="Online payments are not configured yet. Please try again later.")
    return key_id, secret


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
        if p["stock"] < qty:
            raise HTTPException(status_code=400, detail=f"Only {p['stock']} left of {p['name']}. Please reduce the quantity.")
        items.append({"product_id": pid, "name": p["name"], "unit": p["unit"], "image": p["image"],
                      "price": p["price"], "qty": qty, "line_total": p["price"] * qty})
    return items


@router.post("/orders/checkout")
async def checkout(body: CheckoutIn, member: dict = Depends(current_member)):
    key_id, secret = _razorpay_keys()
    items = await _price_cart(body.items)
    subtotal = sum(i["line_total"] for i in items)
    total = subtotal + DELIVERY_FEE
    order_id, number = new_id(), "MB" + new_id()[:8].upper()
    rz = razorpay.Client(auth=(key_id, secret))
    try:
        rz_order = await run_in_threadpool(rz.order.create, {
            "amount": total * 100, "currency": "INR", "receipt": number, "payment_capture": 1,
            "notes": {"order_number": number},
        })
    except Exception:
        logger.exception("Razorpay order create failed")
        raise HTTPException(status_code=502, detail="Could not start the payment. Please try again.")
    ts = now_iso()
    await db.orders.insert_one({
        "id": order_id, "order_number": number, "user_id": member["user_id"], "env": ENV,
        "customer": {"name": body.address.full_name, "email": member.get("email") or ""},
        "items": items, "subtotal": subtotal, "delivery_fee": DELIVERY_FEE, "total": total,
        "address": body.address.model_dump(), "status": "pending_payment",
        "payment": {"method": "razorpay", "status": "pending", "razorpay_order_id": rz_order["id"]},
        "delivery_partner": None, "timeline": [], "created_at": ts, "updated_at": ts,
    })
    await db.users.update_one({"user_id": member["user_id"]}, {"$set": {"default_address": body.address.model_dump()}})
    return {"order_id": order_id, "order_number": number, "razorpay_order_id": rz_order["id"],
            "amount": rz_order["amount"], "currency": "INR", "key_id": key_id}


@router.post("/orders/{order_id}/verify")
async def verify_payment(order_id: str, body: VerifyIn, member: dict = Depends(current_member)):
    _, secret = _razorpay_keys()
    order = await db.orders.find_one({"id": order_id, "user_id": member["user_id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order["payment"]["status"] == "paid":
        return {"ok": True, "status": order["status"]}
    if body.razorpay_order_id != order["payment"]["razorpay_order_id"]:
        raise HTTPException(status_code=400, detail="This payment does not belong to this order.")
    expected = hmac.new(secret.encode(), f"{body.razorpay_order_id}|{body.razorpay_payment_id}".encode(),
                        hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, body.razorpay_signature):
        await db.orders.update_one({"id": order_id}, {"$set": {"payment.status": "failed", "updated_at": now_iso()}})
        raise HTTPException(status_code=400, detail="Payment verification failed. If money was deducted it will be refunded by Razorpay.")
    ts = now_iso()
    res = await db.orders.update_one(
        {"id": order_id, "payment.status": {"$ne": "paid"}},
        {"$set": {"status": "placed", "payment.status": "paid", "payment.razorpay_payment_id": body.razorpay_payment_id,
                  "payment.paid_at": ts, "updated_at": ts},
         "$push": {"timeline": {"status": "placed", "at": ts, "by": "customer"}}})
    if res.modified_count:
        for item in order["items"]:
            await db.products.update_one({"id": item["product_id"]}, {"$inc": {"stock": -item["qty"], "sold": item["qty"]}})
        await db.products.update_many({"stock": {"$lt": 0}}, {"$set": {"stock": 0}})
    return {"ok": True, "status": "placed"}


@router.get("/orders")
async def my_orders(member: dict = Depends(current_member)):
    return await db.orders.find({"user_id": member["user_id"], "payment.status": "paid"}, {"_id": 0}) \
        .sort("created_at", -1).limit(100).to_list(100)


@router.get("/orders/{order_id}")
async def my_order(order_id: str, member: dict = Depends(current_member)):
    order = await db.orders.find_one({"id": order_id, "user_id": member["user_id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
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
    await db.orders.update_one({"id": order_id}, {"$set": {"status": body.status, "updated_at": ts},
                                                  "$push": {"timeline": {"status": body.status, "at": ts, "by": "delivery"}}})
    return await db.orders.find_one({"id": order_id}, {"_id": 0})
