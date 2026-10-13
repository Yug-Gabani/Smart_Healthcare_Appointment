# Implements: FR-35
# Safety:    S8
# Owner:     backend

import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from passlib.context import CryptContext

from src.models.user import Role, User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


@pytest.mark.asyncio
async def test_role_based_access_control_admin_ping(
    client: AsyncClient, db_session: AsyncSession
):
    # 1. Register and login a normal patient
    reg_res = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "normal_patient@example.com",
            "password": "patientPassword123",
            "name": "Normal Patient",
        },
    )
    assert reg_res.status_code == 201

    login_res = await client.post(
        "/api/v1/auth/login",
        json={
            "email": "normal_patient@example.com",
            "password": "patientPassword123",
        },
    )
    assert login_res.status_code == 200
    patient_token = login_res.json()["access_token"]

    # 2. Patient hitting /api/v1/admin/ping receives 403 Forbidden
    patient_ping = await client.get(
        "/api/v1/admin/ping",
        headers={"Authorization": f"Bearer {patient_token}"},
    )
    assert patient_ping.status_code == 403

    # Also test /api/admin/ping alias
    patient_ping_alias = await client.get(
        "/api/admin/ping",
        headers={"Authorization": f"Bearer {patient_token}"},
    )
    assert patient_ping_alias.status_code == 403

    # 3. Create an admin user directly in DB
    admin_id = uuid.uuid4()
    admin_user = User(
        id=admin_id,
        email="clinic_admin@example.com",
        hashed_password=pwd_context.hash("adminPassword123"),
        name="Clinic Admin",
        role=Role.CLINIC_ADMIN,
        is_active=True,
        is_verified=True,
    )
    db_session.add(admin_user)
    await db_session.commit()

    # 4. Login as admin
    admin_login = await client.post(
        "/api/v1/auth/login",
        json={
            "email": "clinic_admin@example.com",
            "password": "adminPassword123",
        },
    )
    assert admin_login.status_code == 200
    admin_token = admin_login.json()["access_token"]

    # 5. Admin hitting /api/v1/admin/ping succeeds with 200
    admin_ping = await client.get(
        "/api/v1/admin/ping",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert admin_ping.status_code == 200
    ping_data = admin_ping.json()
    assert ping_data["ok"] is True
    assert ping_data["actor"] == str(admin_id)
