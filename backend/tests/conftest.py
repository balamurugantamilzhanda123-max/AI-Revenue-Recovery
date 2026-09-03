import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ["DATABASE_URL"] = "sqlite:///./test_reviveai.db"
os.environ["AUTH_ENABLED"] = "false"
os.environ["AUTO_CREATE_TABLES"] = "true"
os.environ["AI_MOCK_MODE"] = "true"

import pytest
from fastapi.testclient import TestClient

from app.database import Base, engine
from app.main import app



@pytest.fixture(autouse=True)
def reset_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    return TestClient(app)
