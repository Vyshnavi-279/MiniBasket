import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from core import current_member, db
from seed_data import CATEGORIES

router = APIRouter(prefix="/api")

SORTS = {
    "popular": [("sold", -1), ("rank", 1)],
    "price_asc": [("price", 1)],
    "price_desc": [("price", -1)],
    "discount": [("discount_pct", -1), ("rank", 1)],
    "name": [("name", 1)],
}
PUBLIC_FIELDS = {"_id": 0, "created_at": 0, "updated_at": 0, "sold": 0, "rank": 0}


@router.get("/")
async def root():
    return {"message": "MiniBasket API"}


@router.get("/categories")
async def categories():
    rows = await db.products.aggregate([
        {"$match": {"is_active": True}}, {"$group": {"_id": "$category", "n": {"$sum": 1}}},
    ]).to_list(50)
    counts = {r["_id"]: r["n"] for r in rows}
    return [{**c, "count": counts.get(c["slug"], 0)} for c in CATEGORIES]


@router.get("/products")
async def list_products(
    category: Optional[str] = Query(None, max_length=40),
    q: Optional[str] = Query(None, max_length=60),
    sort: str = Query("popular", max_length=20),
    ids: Optional[str] = Query(None, max_length=3000),
    limit: int = Query(100, ge=1, le=200),
):
    filt: dict = {"is_active": True}
    if category:
        filt["category"] = category
    if q and q.strip():
        rx = {"$regex": re.escape(q.strip()), "$options": "i"}
        filt["$or"] = [{"name": rx}, {"tags": rx}, {"category_name": rx}]
    if ids is not None:
        filt["id"] = {"$in": [i for i in ids.split(",") if i][:60]}
    return await db.products.find(filt, PUBLIC_FIELDS).sort(SORTS.get(sort, SORTS["popular"])).limit(limit).to_list(limit)


@router.get("/products/{product_id}")
async def get_product(product_id: str):
    product = await db.products.find_one({"id": product_id, "is_active": True}, PUBLIC_FIELDS)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


class MeUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=60)
    phone: Optional[str] = Field(None, pattern=r"^[6-9]\d{9}$")


def _me_payload(member: dict, application: Optional[dict]) -> dict:
    keys = ("user_id", "email", "name", "phone", "role", "default_address")
    return {**{k: member.get(k) for k in keys}, "application": application}


@router.get("/me")
async def me(member: dict = Depends(current_member)):
    application = await db.delivery_applications.find_one({"user_id": member["user_id"]}, {"_id": 0})
    return _me_payload(member, application)


@router.patch("/me")
async def update_me(body: MeUpdate, member: dict = Depends(current_member)):
    changes = {k: v.strip() for k, v in body.model_dump(exclude_none=True).items()}
    if changes:
        await db.users.update_one({"user_id": member["user_id"]}, {"$set": changes})
    application = await db.delivery_applications.find_one({"user_id": member["user_id"]}, {"_id": 0})
    return _me_payload({**member, **changes}, application)
