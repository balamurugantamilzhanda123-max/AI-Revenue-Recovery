import hashlib
import json
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import IdempotencyKey


def request_hash(payload: dict[str, Any] | None) -> str:
    body = json.dumps(payload or {}, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(body.encode("utf-8")).hexdigest()


def begin_idempotent_request(
    db: Session,
    *,
    key: str | None,
    method: str,
    path: str,
    payload: dict[str, Any] | None,
    transaction_id: str | None = None,
) -> tuple[IdempotencyKey, bool]:
    if not key:
        raise HTTPException(status_code=400, detail="Idempotency key is required for this action")

    hashed = request_hash(payload)
    existing = db.query(IdempotencyKey).filter(IdempotencyKey.key == key).first()
    if existing:
        if existing.request_hash != hashed or existing.method != method or existing.path != path:
            raise HTTPException(
                status_code=409,
                detail="Idempotency key was already used with a different request",
            )
        if existing.status == "COMPLETED":
            return existing, True
        raise HTTPException(status_code=409, detail="Request with this idempotency key is already in progress")

    row = IdempotencyKey(
        key=key,
        method=method,
        path=path,
        request_hash=hashed,
        transaction_id=transaction_id,
        status="IN_PROGRESS",
    )
    db.add(row)
    db.flush()
    return row, False


def finish_idempotent_request(
    db: Session,
    row: IdempotencyKey,
    *,
    response_payload: dict[str, Any],
    status: str = "COMPLETED",
) -> None:
    row.response_payload = response_payload
    row.status = status
    db.flush()
