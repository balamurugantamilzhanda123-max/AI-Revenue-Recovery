from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings


security = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class CurrentUser:
    id: str
    email: str
    role: str


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> CurrentUser:
    if not settings.auth_enabled:
        return CurrentUser(
            id="demo-user",
            email="demo@reviveai.local",
            role="ADMIN",
        )

    if credentials is None or credentials.credentials != settings.api_auth_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid API token",
        )

    return CurrentUser(
        id="api-user",
        email="operator@reviveai.local",
        role="ADMIN",
    )


def require_recovery_operator(
    current_user: CurrentUser = Depends(get_current_user),
) -> CurrentUser:
    if current_user.role not in {"ADMIN", "ANALYST"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Recovery action is not authorized for this user",
        )
    return current_user


def require_admin(
    current_user: CurrentUser = Depends(get_current_user),
) -> CurrentUser:
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required",
        )
    return current_user
