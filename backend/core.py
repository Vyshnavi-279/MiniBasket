import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv
from fastapi import Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING, IndexModel, ReturnDocument
from starlette.concurrency import run_in_threadpool

load_dotenv(Path(__file__).parent / ".env")

try:  # launched as `backend.server`
    from backend.clerk_auth import require_user
except ModuleNotFoundError:  # launched from inside backend/
    from clerk_auth import require_user

logger = logging.getLogger("minibasket")

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

DEFAULT_DELIVERY_FEE = 40

# Role list is code. Highest first; keep `admin`.
ROLES = ["admin", "delivery", "customer"]
DEFAULT_ROLE = "customer"
RETIRED_ROLES: dict[str, str] = {}
RANK = {r: len(ROLES) - i for i, r in enumerate(ROLES)}

ENV = "live" if os.environ.get("CLERK_PUBLISHABLE_KEY", "").startswith("pk_live_") else "preview"
IN_ENV = {"env": {"$in": [ENV, None]}}

INDEXES: dict[str, list[IndexModel]] = {
    "users": [
        IndexModel([("user_id", ASCENDING)], name="user_id", unique=True),
        IndexModel([("role", ASCENDING), ("env", ASCENDING)], name="role_env"),
    ],
    "products": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("category", ASCENDING), ("is_active", ASCENDING)], name="category_active"),
        IndexModel([("sold", DESCENDING), ("rank", ASCENDING)], name="popular"),
    ],
    "orders": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)], name="user_created"),
        IndexModel([("delivery_partner.user_id", ASCENDING)], name="rider"),
        IndexModel([("status", ASCENDING), ("created_at", DESCENDING)], name="status_created"),
        IndexModel([("order_number", ASCENDING)], name="order_number", unique=True),
        IndexModel([("status", ASCENDING), ("reserved_until", ASCENDING)], name="reservations"),
    ],
    "delivery_applications": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("user_id", ASCENDING)], name="user_id", unique=True),
        IndexModel([("status", ASCENDING)], name="status"),
    ],
    "chat_messages": [
        IndexModel([("user_id", ASCENDING), ("created_at", ASCENDING)], name="user_created"),
    ],
}


async def ensure_indexes() -> None:
    for collection, models in INDEXES.items():
        for model in models:
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:
                logger.error("ensure_indexes(%s.%s): %s", collection, model.document["name"], exc)


async def get_delivery_fee() -> int:
    doc = await db.settings.find_one({"key": "store"}, {"_id": 0, "delivery_fee": 1})
    return int(doc["delivery_fee"]) if doc and "delivery_fee" in doc else DEFAULT_DELIVERY_FEE


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return uuid.uuid4().hex


def effective_role(role) -> str:
    role = RETIRED_ROLES.get(role, role)
    return role if role in ROLES else DEFAULT_ROLE


async def move_retired_roles() -> None:
    for old, new in RETIRED_ROLES.items():
        await db.users.update_many({"role": old}, {"$set": {"role": new}})


def _clerk_profile(user_id: str) -> dict:
    """One Clerk lookup on first sign-in: primary email, name, and whether it is a verified admin email."""
    admins = {e.strip().lower() for e in os.environ.get("ADMIN_EMAIL", "").split(",") if e.strip()}
    r = requests.get(f"https://api.clerk.com/v1/users/{user_id}", timeout=10,
                     headers={"Authorization": f"Bearer {os.environ['CLERK_SECRET_KEY']}", "User-Agent": "emergent-app"})
    r.raise_for_status()
    data = r.json()
    emails = data.get("email_addresses") or []
    primary = next((e["email_address"] for e in emails if e.get("id") == data.get("primary_email_address_id")),
                   emails[0]["email_address"] if emails else "")
    is_admin = any(e["email_address"].lower() in admins and (e.get("verification") or {}).get("status") == "verified"
                   for e in emails)
    name = " ".join(filter(None, [data.get("first_name"), data.get("last_name")]))
    return {"email": primary, "name": name, "is_admin": is_admin}


async def current_member(user: dict = Depends(require_user)) -> dict:
    uid = user["user_id"]
    member = await db.users.find_one({"user_id": uid}, {"_id": 0})
    if member is None or not member.get("role"):
        profile = await run_in_threadpool(_clerk_profile, uid)
        role = "admin" if profile["is_admin"] else DEFAULT_ROLE
        await db.users.update_one({"user_id": uid, "role": {"$in": [None, ""]}}, {"$set": {"role": role}})
        member = await db.users.find_one_and_update(
            {"user_id": uid},
            {"$setOnInsert": {"user_id": uid, "role": role, "email": profile["email"], "name": profile["name"],
                              "phone": "", "created_at": now_iso()}},
            upsert=True, projection={"_id": 0}, return_document=ReturnDocument.AFTER)
    if member.get("env") != ENV:
        await db.users.update_one({"user_id": uid}, {"$set": {"env": ENV}})
    return {**member, "env": ENV, "role": effective_role(member["role"])}


def require_role(*roles: str):
    async def check(member: dict = Depends(current_member)) -> dict:
        if member["role"] not in roles:
            raise HTTPException(status_code=403, detail="Not allowed")
        return member
    return check
