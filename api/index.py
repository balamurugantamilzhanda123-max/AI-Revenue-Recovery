import os
import sys
from pathlib import Path

# Add directories to sys.path
_current_dir = str(Path(__file__).resolve().parent)
_root_dir = str(Path(__file__).resolve().parent.parent)
_backend_dir = str(Path(__file__).resolve().parent.parent / "backend")

for p in [_current_dir, _backend_dir, _root_dir]:
    if p not in sys.path:
        sys.path.insert(0, p)

os.environ["VERCEL"] = "1"

try:
    from app.main import app
except Exception as e:
    import traceback
    traceback.print_exc()
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse

    app = FastAPI()

    @app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"])
    async def fallback_handler(path: str):
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": 500,
                    "message": f"Serverless backend startup error: {e}",
                    "path": f"/{path}",
                }
            },
        )
