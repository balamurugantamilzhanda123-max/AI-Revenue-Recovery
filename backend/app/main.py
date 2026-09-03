from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.agent import router as agent_router
from app.api.audit import router as audit_router
from app.api.dashboard import router as dashboard_router
from app.api.demo import router as demo_router
from app.api.escalations import router as escalations_router
from app.api.health import router as health_router
from app.api.payments import router as payments_router
from app.api.recovery import router as recovery_router
from app.api.revenue_risk import router as revenue_risk_router
from app.api.transactions import router as transactions_router
from app.config import settings
from app.database import init_db


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description="Autonomous AI agent for payment failure detection, diagnosis, and revenue recovery.",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list or ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    if settings.auto_create_tables:
        init_db()

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": exc.status_code,
                    "message": exc.detail,
                    "path": request.url.path,
                }
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": 422,
                    "message": "Validation failed",
                    "details": exc.errors(),
                    "path": request.url.path,
                }
            },
        )

    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        print("Unhandled error:", repr(exc))
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": 500,
                    "message": "Internal server error",
                    "path": request.url.path,
                }
            },
        )

    app.include_router(health_router, prefix="/api")
    app.include_router(transactions_router, prefix="/api")
    app.include_router(revenue_risk_router, prefix="/api")
    app.include_router(agent_router, prefix="/api")
    app.include_router(recovery_router, prefix="/api")
    app.include_router(payments_router, prefix="/api")
    app.include_router(audit_router, prefix="/api")
    app.include_router(dashboard_router, prefix="/api")
    app.include_router(escalations_router, prefix="/api")
    app.include_router(demo_router, prefix="/api")

    @app.get("/")
    def root() -> dict:
        return {
            "message": "ReviveAI backend is running",
            "docs": "/docs",
            "health": "/api/health",
        }

    return app


app = create_app()
