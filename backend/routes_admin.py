import re
from contextlib import suppress
from datetime import datetime, timedelta
from typing import Literal, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, StrictInt, model_validator

from core import IN_ENV, RANK, ROLES, db, effective_role, get_delivery_fee, new_id, now_iso, require_role
from routes_orders import release_expired_reservations
from seed_data import CATEGORY_NAMES, CATEGORY_SLUGS, discount_pct

router = APIRouter(prefix="/api")
ADMIN = require_role("admin")
PAID = {"payment.status": "paid"}
STORE_TZ = "Asia/Kolkata"


def _utc_iso(local: datetime) -> str:
    return local.astimezone(ZoneInfo("UTC")).isoformat()


async def compute_stats() -> dict:
    now = datetime.now(ZoneInfo(STORE_TZ))
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    live = {**PAID, "status": {"$ne": "cancelled"}}
    agg = await db.orders.aggregate([{"$match": live}, {"$group": {"_id": None, "revenue": {"$sum": "$total"}, "n": {"$sum": 1}}}]).to_list(1)
    revenue, orders = (agg[0]["revenue"], agg[0]["n"]) if agg else (0, 0)
    status_rows = await db.orders.aggregate([{"$match": PAID}, {"$group": {"_id": "$status", "n": {"$sum": 1}}}]).to_list(20)
    sc = {r["_id"]: r["n"] for r in status_rows}
    local_day = {"$dateToString": {"format": "%Y-%m-%d", "date": {"$dateFromString": {"dateString": "$created_at"}},
                                   "timezone": STORE_TZ}}
    day_rows = await db.orders.aggregate([
        {"$match": {**live, "created_at": {"$gte": _utc_iso(today_start - timedelta(days=6))}}},
        {"$group": {"_id": local_day, "revenue": {"$sum": "$total"}, "orders": {"$sum": 1}}},
    ]).to_list(10)
    by_day = {r["_id"]: r for r in day_rows}
    days = [(now - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(6, -1, -1)]
    low_filter = {"is_active": True, "stock": {"$lt": 10}}
    low_stock = await db.products.find(low_filter, {"_id": 0, "id": 1, "name": 1, "stock": 1, "unit": 1}).sort("stock", 1).to_list(8)
    top = await db.orders.aggregate([
        {"$match": live}, {"$unwind": "$items"},
        {"$group": {"_id": "$items.name", "qty": {"$sum": "$items.qty"}, "revenue": {"$sum": "$items.line_total"}}},
        {"$sort": {"qty": -1}}, {"$limit": 5},
    ]).to_list(5)
    return {
        "revenue": revenue, "orders": orders, "avg_order_value": round(revenue / orders) if orders else 0,
        "delivery_fee_per_order": await get_delivery_fee(),
        "orders_today": await db.orders.count_documents({**PAID, "created_at": {"$gte": _utc_iso(today_start)}}),
        "pending_dispatch": sc.get("placed", 0) + sc.get("packed", 0),
        "in_transit": sc.get("assigned", 0) + sc.get("out_for_delivery", 0),
        "delivered": sc.get("delivered", 0), "cancelled": sc.get("cancelled", 0),
        "customers": await db.users.count_documents({"role": "customer", **IN_ENV}),
        "active_riders": await db.users.count_documents({"role": "delivery", **IN_ENV}),
        "pending_applications": await db.delivery_applications.count_documents({"status": "pending", **IN_ENV}),
        "low_stock_count": await db.products.count_documents(low_filter), "low_stock": low_stock,
        "revenue_7d": [{"date": d, "revenue": by_day.get(d, {}).get("revenue", 0), "orders": by_day.get(d, {}).get("orders", 0)} for d in days],
        "top_products": [{"name": t["_id"], "qty": t["qty"], "revenue": t["revenue"]} for t in top],
    }


class SettingsIn(BaseModel):
    delivery_fee: StrictInt = Field(ge=0, le=1000)


@router.put("/admin/settings")
async def update_settings(body: SettingsIn, admin: dict = Depends(ADMIN)):
    await db.settings.update_one({"key": "store"}, {"$set": {"delivery_fee": body.delivery_fee, "updated_at": now_iso(),
                                                          "updated_by": admin["user_id"]}}, upsert=True)
    return {"delivery_fee": body.delivery_fee}


@router.get("/admin/stats")
async def admin_stats(admin: dict = Depends(ADMIN)):
    await release_expired_reservations()
    return await compute_stats()


# ---------- Orders ----------

class AssignIn(BaseModel):
    delivery_user_id: str = Field(min_length=1, max_length=100)


class AdminStatusIn(BaseModel):
    status: Literal["packed", "out_for_delivery", "delivered", "cancelled"]


UNPAID = ["pending_payment", "payment_expired", "payment_abandoned"]
ADMIN_ALLOWED_FROM = {
    "packed": {"placed"},
    "out_for_delivery": {"assigned"},
    "delivered": {"out_for_delivery"},
    "cancelled": {"placed", "packed", "assigned", "out_for_delivery"},
}


@router.get("/admin/orders")
async def admin_orders(status: Optional[str] = Query(None, max_length=30), q: Optional[str] = Query(None, max_length=30),
                       admin: dict = Depends(ADMIN)):
    await release_expired_reservations()
    filt: dict = {"status": {"$in": UNPAID}} if status == "pending_payment" else dict(PAID)
    if status and status not in ("all", "pending_payment"):
        filt["status"] = status
    if q and q.strip():
        filt["order_number"] = {"$regex": re.escape(q.strip()), "$options": "i"}
    return await db.orders.find(filt, {"_id": 0}).sort("created_at", -1).limit(300).to_list(300)


async def _paid_order(order_id: str) -> dict:
    order = await db.orders.find_one({"id": order_id, **PAID}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.post("/admin/orders/{order_id}/assign")
async def assign_rider(order_id: str, body: AssignIn, admin: dict = Depends(ADMIN)):
    order = await _paid_order(order_id)
    if order["status"] not in ("packed", "assigned"):
        raise HTTPException(status_code=409, detail="Mark the order as packed before assigning a rider.")
    rider = await db.users.find_one({"user_id": body.delivery_user_id, "role": "delivery", **IN_ENV}, {"_id": 0})
    if not rider:
        raise HTTPException(status_code=404, detail="Delivery partner not found")
    profile = rider.get("rider_profile") or {}
    partner = {"user_id": rider["user_id"], "name": profile.get("full_name") or rider.get("name") or rider.get("email", ""),
               "phone": profile.get("phone") or rider.get("phone", ""), "vehicle": profile.get("vehicle_number", "")}
    ts = now_iso()
    res = await db.orders.update_one({"id": order_id, "status": order["status"]},
                                     {"$set": {"delivery_partner": partner, "status": "assigned", "updated_at": ts},
                                      "$push": {"timeline": {"status": "assigned", "at": ts, "by": "admin"}}})
    if res.modified_count == 0:
        raise HTTPException(status_code=409, detail="This order was just updated. Please refresh.")
    return await db.orders.find_one({"id": order_id}, {"_id": 0})


@router.post("/admin/orders/{order_id}/status")
async def admin_set_status(order_id: str, body: AdminStatusIn, admin: dict = Depends(ADMIN)):
    order = await _paid_order(order_id)
    if order["status"] not in ADMIN_ALLOWED_FROM[body.status]:
        raise HTTPException(status_code=409, detail="This status change is not allowed for the order right now.")
    ts = now_iso()
    changes = {"status": body.status, "updated_at": ts}
    if body.status == "cancelled":
        changes.update({"stock_reserved": False, "refund_due": True})
    res = await db.orders.update_one({"id": order_id, "status": order["status"]},
                                     {"$set": changes, "$push": {"timeline": {"status": body.status, "at": ts, "by": "admin"}}})
    if res.modified_count == 0:
        raise HTTPException(status_code=409, detail="This order was just updated. Please refresh.")
    if body.status == "cancelled":
        for item in order["items"]:
            await db.products.update_one({"id": item["product_id"]}, {"$inc": {"stock": item["qty"], "sold": -item["qty"]}})
    return await db.orders.find_one({"id": order_id}, {"_id": 0})


# ---------- Products ----------

class ProductIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    category: str
    unit: str = Field(min_length=1, max_length=20)
    price: int = Field(ge=1, le=100000)
    mrp: int = Field(ge=1, le=100000)
    stock: int = Field(ge=0, le=100000)
    image: str = Field(min_length=1, max_length=600, pattern=r"^(https?://|/)\S+$")
    description: str = Field(default="", max_length=600)
    is_active: bool = True

    @model_validator(mode="after")
    def check(self):
        if self.category not in CATEGORY_SLUGS:
            raise ValueError("Unknown category")
        if self.mrp < self.price:
            raise ValueError("MRP must be greater than or equal to the selling price")
        return self


class ProductUpdate(ProductIn):
    expected_stock: int = Field(ge=0, le=100000)


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:40] or "item"


@router.get("/admin/products")
async def admin_products(admin: dict = Depends(ADMIN)):
    await release_expired_reservations()
    return await db.products.find({"deleted": {"$ne": True}}, {"_id": 0}).sort([("category", 1), ("rank", 1)]).to_list(1000)


@router.post("/admin/products")
async def create_product(body: ProductIn, admin: dict = Depends(ADMIN)):
    ts = now_iso()
    doc = {**body.model_dump(), "id": f"{_slug(body.name)}-{new_id()[:4]}", "category_name": CATEGORY_NAMES[body.category],
           "discount_pct": discount_pct(body.price, body.mrp), "tags": "", "sold": 0, "rank": 1000,
           "created_at": ts, "updated_at": ts}
    await db.products.insert_one(doc)
    return await db.products.find_one({"id": doc["id"]}, {"_id": 0})


@router.put("/admin/products/{product_id}")
async def update_product(product_id: str, body: ProductUpdate, admin: dict = Depends(ADMIN)):
    changes = {**body.model_dump(exclude={"stock", "expected_stock"}), "category_name": CATEGORY_NAMES[body.category],
               "discount_pct": discount_pct(body.price, body.mrp), "updated_at": now_iso()}
    update = {"$set": changes}
    if body.stock != body.expected_stock:  # apply the admin's change as a delta so concurrent sales are not overwritten
        update["$inc"] = {"stock": body.stock - body.expected_stock}
    res = await db.products.update_one({"id": product_id, "deleted": {"$ne": True}}, update)
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    await db.products.update_one({"id": product_id, "stock": {"$lt": 0}}, {"$set": {"stock": 0}})
    return await db.products.find_one({"id": product_id}, {"_id": 0})


@router.delete("/admin/products/{product_id}")
async def delete_product(product_id: str, admin: dict = Depends(ADMIN)):
    res = await db.products.update_one({"id": product_id, "deleted": {"$ne": True}},
                                       {"$set": {"deleted": True, "is_active": False, "updated_at": now_iso()}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"ok": True}


# ---------- Delivery partner applications ----------

class RejectIn(BaseModel):
    note: str = Field(default="", max_length=300)


@router.get("/admin/applications")
async def list_applications(admin: dict = Depends(ADMIN)):
    apps = await db.delivery_applications.find(IN_ENV, {"_id": 0}).sort("submitted_at", -1).to_list(500)
    order = {"pending": 0, "approved": 1, "rejected": 2}
    return sorted(apps, key=lambda a: order.get(a["status"], 3))


async def _claim_application(app_id: str, changes: dict) -> dict:
    """Atomically move a pending application to its reviewed state so two reviews cannot both win."""
    app = await db.delivery_applications.find_one_and_update(
        {"id": app_id, "status": "pending", **IN_ENV}, {"$set": {**changes, "reviewed_at": now_iso()}}, projection={"_id": 0})
    if not app:
        exists = await db.delivery_applications.count_documents({"id": app_id, **IN_ENV})
        raise HTTPException(status_code=409 if exists else 404,
                            detail="This application has already been reviewed." if exists else "Application not found")
    return app


@router.post("/admin/applications/{app_id}/approve")
async def approve_application(app_id: str, admin: dict = Depends(ADMIN)):
    pending = await db.delivery_applications.find_one({"id": app_id, **IN_ENV}, {"_id": 0, "user_id": 1})
    user = await db.users.find_one({"user_id": (pending or {}).get("user_id"), **IN_ENV}, {"_id": 0})
    if pending and not user:
        raise HTTPException(status_code=404, detail="Applicant account not found")
    if user and effective_role(user.get("role")) == "admin":
        raise HTTPException(status_code=409, detail="Admins cannot be made delivery partners.")
    app = await _claim_application(app_id, {"status": "approved"})
    profile = {k: app[k] for k in ("full_name", "phone", "vehicle_type", "vehicle_number", "area")}
    try:
        await db.users.update_one({"user_id": app["user_id"], "role": {"$ne": "admin"}},
                                  {"$set": {"role": "delivery", "rider_profile": profile}})
    except Exception:
        with suppress(Exception):
            await db.users.update_one({"user_id": app["user_id"], "role": "delivery"}, {"$set": {"role": "customer"}})
        await db.delivery_applications.update_one({"id": app_id}, {"$set": {"status": "pending", "reviewed_at": None}})
        raise HTTPException(status_code=500, detail="Could not update the applicant's role. Please try again.")
    return {"ok": True}


@router.post("/admin/applications/{app_id}/reject")
async def reject_application(app_id: str, body: RejectIn, admin: dict = Depends(ADMIN)):
    await _claim_application(app_id, {"status": "rejected", "note": body.note.strip()})
    return {"ok": True}


@router.get("/admin/riders")
async def list_riders(admin: dict = Depends(ADMIN)):
    riders = await db.users.find({"role": "delivery", **IN_ENV}, {"_id": 0}).to_list(500)
    rows = await db.orders.aggregate([
        {"$match": {"status": {"$in": ["assigned", "out_for_delivery", "delivered"]}, "delivery_partner": {"$ne": None}}},
        {"$group": {"_id": {"u": "$delivery_partner.user_id", "s": "$status"}, "n": {"$sum": 1}}},
    ]).to_list(2000)
    active, done = {}, {}
    for r in rows:
        target = done if r["_id"]["s"] == "delivered" else active
        target[r["_id"]["u"]] = target.get(r["_id"]["u"], 0) + r["n"]
    return [{"user_id": r["user_id"], "email": r.get("email", ""), "profile": r.get("rider_profile") or {},
             "name": (r.get("rider_profile") or {}).get("full_name") or r.get("name") or r.get("email", ""),
             "active_orders": active.get(r["user_id"], 0), "delivered_orders": done.get(r["user_id"], 0)} for r in riders]


# ---------- Users & roles ----------

class RoleIn(BaseModel):
    role: str


@router.get("/users")
async def list_users(admin: dict = Depends(ADMIN)):
    people = await db.users.find(IN_ENV, {"_id": 0, "default_address": 0}).sort("created_at", -1).to_list(1000)
    return {"roles": [r for r in ROLES if RANK[r] <= RANK[admin["role"]]],
            "users": [{**p, "role": effective_role(p.get("role"))} for p in people]}


@router.patch("/users/{user_id}/role")
async def set_role(user_id: str, body: RoleIn, admin: dict = Depends(ADMIN)):
    if body.role not in ROLES or RANK[body.role] > RANK[admin["role"]]:
        raise HTTPException(status_code=403, detail="Not allowed")
    target = await db.users.find_one({"user_id": user_id, **IN_ENV}, {"_id": 0})
    if target is None:
        raise HTTPException(status_code=404, detail="Not found")
    demoting = effective_role(target.get("role")) == "admin" and body.role != "admin"
    if demoting and await db.users.count_documents({"role": "admin", **IN_ENV}) <= 1:
        raise HTTPException(status_code=409, detail="Keep at least one admin")
    await db.users.update_one({"user_id": user_id}, {"$set": {"role": body.role}})
    if demoting and await db.users.count_documents({"role": "admin", **IN_ENV}) == 0:  # lost a concurrent demotion race
        await db.users.update_one({"user_id": user_id}, {"$set": {"role": "admin"}})
        raise HTTPException(status_code=409, detail="Keep at least one admin")
    return {"user_id": user_id, "role": body.role}

