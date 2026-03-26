# backend/server.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from db import engine
from queries import WAIT_STATS_QUERY, ACTIVE_REQUESTS_QUERY

app = FastAPI(title="SQL Wait Stats API", version="1.0.0")

# Allow the Vite frontend container (internal Docker network name)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Windows host browser
        "http://frontend:5173",    # Internal Docker network
    ],
    allow_methods=["GET"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health():
    return {"ok": True, "ts": datetime.now(timezone.utc).isoformat()}

@app.get("/api/wait-stats")
def wait_stats():
    try:
        # engine.connect() checks out a pooled connection.
        # text() wraps the raw SQL string for safe execution.
        # result.mappings().all() returns list[dict] keyed by column name.
        with engine.connect() as conn:
            result = conn.execute(text(WAIT_STATS_QUERY))
            data   = [dict(row) for row in result.mappings()]
        return {"ok": True, "data": data,
                "ts": datetime.now(timezone.utc).isoformat()}
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/active-requests")
def active_requests():
    try:
        with engine.connect() as conn:
            result = conn.execute(text(ACTIVE_REQUESTS_QUERY))
            data   = [dict(row) for row in result.mappings()]
        return {"ok": True, "data": data,
                "ts": datetime.now(timezone.utc).isoformat()}
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=str(e))
