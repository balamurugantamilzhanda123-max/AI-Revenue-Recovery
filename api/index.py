import os
import sys
from pathlib import Path

# Add backend directory to sys.path for module resolution
_root = Path(__file__).resolve().parent.parent
_backend_path = str(_root / "backend")
if _backend_path not in sys.path:
    sys.path.insert(0, _backend_path)

# Set Vercel environment flag
os.environ["VERCEL"] = "1"

from app.main import app  # noqa: E402
