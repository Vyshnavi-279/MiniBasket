import asyncio
import logging
import os
import sys
from contextlib import suppress
from pathlib import Path

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

sys.path.insert(0, str(Path(__file__).parent))

try:  # launched as `backend.server` (the default)
    from backend.clerk_auth import clerk_router
except ModuleNotFoundError:  # launched from inside backend/ as `server`
    from clerk_auth import clerk_router

from core import client, ensure_indexes, move_retired_roles  # noqa: E402
from routes_admin import router as admin_router  # noqa: E402
from routes_ai import router as ai_router  # noqa: E402
from routes_orders import router as orders_router  # noqa: E402
from routes_store import router as store_router  # noqa: E402
from seed_data import seed_catalog  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")

app = FastAPI(title="MiniBasket API")

app.include_router(store_router)
app.include_router(orders_router)
app.include_router(admin_router)
app.include_router(ai_router)
app.include_router(clerk_router)  # /api/clerk/config and /api/__clerk/*

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    app.state.index_task = asyncio.create_task(ensure_indexes())
    await move_retired_roles()
    await seed_catalog()


@app.on_event("shutdown")
async def shutdown_db_client():
    app.state.index_task.cancel()
    with suppress(asyncio.CancelledError):
        await app.state.index_task
    client.close()
