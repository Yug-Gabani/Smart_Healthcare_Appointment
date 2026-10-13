# Implements: FR-01, FR-02
# Safety:    none
# Owner:     backend (zhsraD)

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_patient_and_login_flow(client: AsyncClient):
    # 1. Register a patient
    reg_payload = {
        "email": "testpatient@example.com",
        "password": "validPassword123",
        "name": "Jane Doe",
    }
    reg_res = await client.post("/api/v1/auth/register", json=reg_payload)
    assert reg_res.status_code == 201, reg_res.text
    reg_data = reg_res.json()
    assert reg_data["email"] == "testpatient@example.com"
    assert reg_data["role"] == "PATIENT"

    # 2. Duplicate registration fails
    dup_res = await client.post("/api/v1/auth/register", json=reg_payload)
    assert dup_res.status_code == 400

    # 3. Invalid password login fails
    invalid_login_res = await client.post(
        "/api/v1/auth/jwt/login",
        data={"username": "testpatient@example.com", "password": "wrongpassword"},
    )
    assert invalid_login_res.status_code == 400

    # 4. Valid login succeeds
    login_res = await client.post(
        "/api/v1/auth/jwt/login",
        data={"username": "testpatient@example.com", "password": "validPassword123"},
    )
    assert login_res.status_code in [200, 204]
    token = login_res.json().get("access_token") if login_res.status_code == 200 else None

    # 5. JSON login succeeds
    json_login = await client.post(
        "/api/v1/auth/login",
        json={"email": "testpatient@example.com", "password": "validPassword123"},
    )
    assert json_login.status_code == 200
    access_token = json_login.json()["access_token"]
    assert access_token is not None

    # 6. /users/me returns authenticated patient
    me_res = await client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["email"] == "testpatient@example.com"
    assert me_data["role"] == "PATIENT"
