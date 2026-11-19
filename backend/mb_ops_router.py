import hashlib
import os
import secrets
from datetime import datetime, time, timedelta, timezone
from typing import List, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Header, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field

router = APIRouter(prefix="/api/minibasket", tags=["MiniBasket Ops"])
IST = ZoneInfo("Asia/Kolkata")


def get_db():
    mongo_url = os.getenv("MONGO_URL") or os.getenv("MONGODB_URL") or "mongodb://127.0.0.1:27017"
    db_name = os.getenv("DB_NAME") or os.getenv("MONGO_DB") or "minibasket"
    client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=5000)
    return client, client[db_name]


def hash_password(raw_password: str) -> str:
    salt = secrets.token_hex(8)
    digest = hashlib.pbkdf2_hmac("sha256", raw_password.encode("utf-8"), salt.encode("utf-8"), 100_000).hex()
    return f"{salt}${digest}"


def compute_delivery_schedule(placed_at: Optional[datetime] = None):
    now_ist = (placed_at or datetime.now(timezone.utc)).astimezone(IST)
    delivery_day = (now_ist + timedelta(days=1)).date()
    cutoff_ist = datetime.combine(delivery_day, time(10, 0), tzinfo=IST)
    return {
        "order_date_ist": now_ist.date().isoformat(),
        "delivery_date_ist": delivery_day.isoformat(),
        "delivery_slot": "Next Day Evening (05:00 PM - 09:00 PM IST)",
        "cancellation_cutoff_ist": cutoff_ist.isoformat(),
    }


def calculate_refund(paid_amount: float, cutoff_iso: str, cancelled_at: Optional[datetime] = None):
    cancel_dt = (cancelled_at or datetime.now(timezone.utc)).astimezone(IST)
    cutoff_dt = datetime.fromisoformat(cutoff_iso).astimezone(IST)
    before_10am = cancel_dt < cutoff_dt
    if before_10am:
        penalty = 0.0
        refund = round(paid_amount, 2)
        reason = "Cancelled before 10:00 AM on delivery day: 100% full refund."
    else:
        penalty = round(min(20.0, paid_amount), 2)
        refund = round(max(0.0, paid_amount - penalty), 2)
        reason = "Cancelled at or after 10:00 AM on delivery day: ₹20 deduction applied."
    return {
        "cancelled_at_ist": cancel_dt.isoformat(),
        "before_10am_cutoff": before_10am,
        "penalty_amount": penalty,
        "refund_amount": refund,
        "refund_reason": reason,
    }


class UserRegisterInput(BaseModel):
    name: str
    email: EmailStr
    phone: str
    password: str = Field(min_length=6)
    address: str
    role: str = "customer"


class ProductUpsertInput(BaseModel):
    id: Optional[str] = None
    name: str
    category: str
    store_price: float = Field(gt=0)
    delivery_charge: float = Field(default=35.0, ge=30.0, le=40.0)
    unit: str = "1 unit"
    stock: int = Field(default=20, ge=0)
    in_stock: bool = True
    local_store_name: str = "Nearby Kirana / Supermarket"


class OrderItemInput(BaseModel):
    product_id: str
    quantity: int = Field(gt=0)


class PrepaidOrderInput(BaseModel):
    customer_name: str
    customer_email: EmailStr
    customer_phone: str
    delivery_address: str
    items: List[OrderItemInput]
    payment_reference: str = "PREPAID-DEMO-TXN"


class AgentOrderStatusInput(BaseModel):
    status: str


@router.get("/legal")
async def get_legal_policies():
    return {
        "platform": "MiniBasket",
        "effective_date": "2026-11-19",
        "terms_and_conditions": (
            "MiniBasket connects prepaid customer orders with a delivery agent who sources requested items from local stores "
            "and delivers them the next day evening. Item prices reflect store pricing plus an explicit delivery fee "
            "(₹30 to ₹40 per item as shown at checkout). Orders placed today are scheduled for next-day evening delivery."
        ),
        "privacy_policy": (
            "We collect customer name, email, phone number, delivery address, and order details strictly to process prepaid "
            "orders, coordinate delivery, and handle refunds. User passwords are never stored in plain text or shared with delivery agents."
        ),
        "refund_and_cancellation_policy": {
            "delivery_schedule": "Orders placed today are delivered next day evening.",
            "cancellation_cutoff": "10:00 AM IST on the scheduled delivery day.",
            "before_10am": "Full 100% refund of the paid amount if cancelled before 10:00 AM on delivery day.",
            "after_10am": "₹20 cancellation/fulfillment fee is deducted from the paid amount; remaining balance is refunded.",
        },
        "missing_or_out_of_stock_policy": (
            "If an item is out of stock or unavailable at local stores at fulfillment time, the delivery agent marks the item "
            "out-of-stock/missing, notifies the customer, and initiates a prompt refund for the undelivered item amount (including its per-item delivery charge if unfulfilled)."
        ),
        "grievance_and_compliance": (
            "Keep valid FSSAI/trade registrations where applicable for food/grocery operations and publish a support email/phone "
            "for payment, refund, or missing-item disputes."
        ),
    }


@router.post("/users/register")
async def register_user(payload: UserRegisterInput):
    client, db = get_db()
    try:
        users = db["users"]
        existing = await users.find_one({"email": payload.email.lower()})
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
        doc = {
            "id": f"usr-{secrets.token_hex(4)}",
            "name": payload.name,
            "email": payload.email.lower(),
            "phone": payload.phone,
            "address": payload.address,
            "role": "delivery_agent" if payload.role == "delivery_agent" else "customer",
            "password_hash": hash_password(payload.password),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await users.insert_one(doc)
        return {
            "id": doc["id"],
            "name": doc["name"],
            "email": doc["email"],
            "phone": doc["phone"],
            "address": doc["address"],
            "role": doc["role"],
        }
    finally:
        client.close()


@router.get("/products")
async def list_products():
    client, db = get_db()
    try:
        items = []
        async for p in db["products"].find({}, {"_id": 0}):
            store_price = float(p.get("store_price", p.get("price", 0)))
            delivery_charge = float(p.get("delivery_charge", 35.0))
            p["store_price"] = store_price
            p["delivery_charge"] = delivery_charge
            p["total_unit_price"] = round(store_price + delivery_charge, 2)
            p["in_stock"] = bool(p.get("in_stock", True)) and int(p.get("stock", 0)) > 0
            items.append(p)
        return {"count": len(items), "products": items}
    finally:
        client.close()


@router.post("/agent/products")
async def upsert_product_by_agent(payload: ProductUpsertInput):
    client, db = get_db()
    try:
        prod_id = payload.id or f"prod-{secrets.token_hex(3)}"
        total_unit_price = round(payload.store_price + payload.delivery_charge, 2)
        doc = {
            "id": prod_id,
            "name": payload.name,
            "category": payload.category,
            "store_price": round(payload.store_price, 2),
            "delivery_charge": round(payload.delivery_charge, 2),
            "price": total_unit_price,
            "total_unit_price": total_unit_price,
            "unit": payload.unit,
            "stock": payload.stock,
            "in_stock": payload.in_stock and payload.stock > 0,
            "local_store_name": payload.local_store_name,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        await db["products"].update_one({"id": prod_id}, {"$set": doc}, upsert=True)
        return {"message": "Product updated by delivery agent", "product": doc}
    finally:
        client.close()


@router.post("/orders")
async def create_prepaid_order(payload: PrepaidOrderInput):
    client, db = get_db()
    try:
        line_items = []
        subtotal_store = 0.0
        subtotal_delivery = 0.0
        missing_items = []

        for req_item in payload.items:
            prod = await db["products"].find_one({"id": req_item.product_id}, {"_id": 0})
            if not prod:
                missing_items.append({"product_id": req_item.product_id, "reason": "Product not found"})
                continue
            stock = int(prod.get("stock", 0))
            if not prod.get("in_stock", True) or stock < req_item.quantity:
                missing_items.append({
                    "product_id": req_item.product_id,
                    "name": prod.get("name"),
                    "requested": req_item.quantity,
                    "available": stock,
                    "reason": "Out of stock / insufficient stock",
                })
                continue

            store_price = float(prod.get("store_price", prod.get("price", 0)))
            delivery_charge = float(prod.get("delivery_charge", 35.0))
            unit_total = round(store_price + delivery_charge, 2)
            line_total = round(unit_total * req_item.quantity, 2)

            subtotal_store += store_price * req_item.quantity
            subtotal_delivery += delivery_charge * req_item.quantity

            line_items.append({
                "product_id": prod["id"],
                "name": prod.get("name"),
                "quantity": req_item.quantity,
                "store_price": store_price,
                "delivery_charge_per_unit": delivery_charge,
                "unit_total": unit_total,
                "line_total": line_total,
                "fulfillment_status": "PENDING_STORE_PICKUP",
            })
            await db["products"].update_one(
                {"id": prod["id"]},
                {"$inc": {"stock": -req_item.quantity}},
            )

        if not line_items:
            raise HTTPException(status_code=400, detail={"message": "No available items in order", "missing_items": missing_items})

        paid_amount = round(subtotal_store + subtotal_delivery, 2)
        schedule = compute_delivery_schedule()
        order_id = f"ord-{secrets.token_hex(4)}"

        order_doc = {
            "id": order_id,
            "order_number": f"MB-{datetime.now(IST).strftime('%Y%m%d')}-{secrets.token_hex(3).upper()}",
            "payment_status": "PAID_ONLINE",
            "payment_reference": payload.payment_reference,
            "paid_amount": paid_amount,
            "store_amount": round(subtotal_store, 2),
            "delivery_charges_total": round(subtotal_delivery, 2),
            "customer": {
                "name": payload.customer_name,
                "email": payload.customer_email.lower(),
                "phone": payload.customer_phone,
                "delivery_address": payload.delivery_address,
            },
            "items": line_items,
            "missing_or_out_of_stock_items": missing_items,
            "status": "CONFIRMED_NEXT_DAY_EVENING",
            "schedule": schedule,
            "refund_info": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db["orders"].insert_one(order_doc)
        order_doc.pop("_id", None)
        return {"message": "Prepaid order placed for next-day evening delivery", "order": order_doc}
    finally:
        client.close()


@router.post("/orders/{order_id}/cancel")
async def cancel_order(order_id: str, x_simulated_cancel_ist: Optional[str] = Header(default=None)):
    client, db = get_db()
    try:
        order = await db["orders"].find_one({"id": order_id}, {"_id": 0})
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        if order.get("status") == "CANCELLED":
            raise HTTPException(status_code=400, detail="Order is already cancelled")

        cancel_time = datetime.fromisoformat(x_simulated_cancel_ist) if x_simulated_cancel_ist else datetime.now(timezone.utc)
        cutoff_iso = order["schedule"]["cancellation_cutoff_ist"]
        paid_amount = float(order["paid_amount"])
        refund_calc = calculate_refund(paid_amount, cutoff_iso, cancel_time)

        for it in order.get("items", []):
            await db["products"].update_one({"id": it["product_id"]}, {"$inc": {"stock": int(it["quantity"])}})

        refund_record = {
            "refund_status": "INITIATED",
            "paid_amount": paid_amount,
            **refund_calc,
        }
        await db["orders"].update_one(
            {"id": order_id},
            {"$set": {"status": "CANCELLED", "refund_info": refund_record}},
        )
        updated = await db["orders"].find_one({"id": order_id}, {"_id": 0})
        return {"message": refund_calc["refund_reason"], "order": updated}
    finally:
        client.close()


@router.get("/agent/orders")
async def list_agent_orders():
    client, db = get_db()
    try:
        orders = []
        async for o in db["orders"].find({}, {"_id": 0}).sort("created_at", -1):
            orders.append(o)
        return {"count": len(orders), "orders": orders}
    finally:
        client.close()


@router.patch("/agent/orders/{order_id}/status")
async def update_agent_order_status(order_id: str, payload: AgentOrderStatusInput):
    client, db = get_db()
    try:
        res = await db["orders"].update_one(
            {"id": order_id},
            {"$set": {"status": payload.status, "updated_at": datetime.now(timezone.utc).isoformat()}},
        )
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Order not found")
        updated = await db["orders"].find_one({"id": order_id}, {"_id": 0})
        return {"message": "Order status updated", "order": updated}
    finally:
        client.close()
