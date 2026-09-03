from urllib.request import Request, urlopen
from urllib.error import HTTPError

from supabase import create_client

from app.config import settings


TEST_EMAIL = "phase2test@example.com"
TEST_PASSWORD = "Phase2Test123!"

API_URL = "http://127.0.0.1:8001/api/transactions"


# Create admin client
admin = create_client(
    settings.supabase_url,
    settings.supabase_service_role_key,
)


# Create the test user if it does not already exist
try:
    admin.auth.admin.create_user(
        {
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "email_confirm": True,
        }
    )
    print("Test user created.")
except Exception:
    print("Test user already exists. Continuing...")


# Login
login = admin.auth.sign_in_with_password(
    {
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD,
    }
)

if not login.session:
    raise RuntimeError("Login failed: no session returned.")

token = login.session.access_token

print("Login successful.")
print("Testing protected transaction API...")


# Call protected API with Bearer token
request = Request(
    API_URL + "?limit=2&offset=0",
    headers={
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
    },
    method="GET",
)

try:
    with urlopen(request, timeout=10) as response:
        body = response.read().decode("utf-8")

        print()
        print("STATUS:", response.status)
        print("RESPONSE:")
        print(body)

except HTTPError as error:
    body = error.read().decode("utf-8")

    print()
    print("STATUS:", error.code)
    print("RESPONSE:")
    print(body)