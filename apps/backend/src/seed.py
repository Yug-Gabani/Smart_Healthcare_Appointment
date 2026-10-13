# Implements: FR-01, FR-02
# Safety:    none
# Owner:     backend (zhsraD)

import asyncio
import uuid
from typing import TypedDict

from passlib.context import CryptContext
from sqlalchemy import select

from src.db.session import async_session_maker
from src.models.user import Role, User


class DemoUser(TypedDict):
    email: str
    password: str
    name: str
    role: Role


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

DEMO_USERS: list[DemoUser] = [
    {
        "email": "admin@clinic.test",
        "password": "admin1234",
        "name": "Clinic Administrator",
        "role": Role.SYSTEM_ADMIN,
    },
    {
        "email": "dr.smith@clinic.test",
        "password": "doctor1234",
        "name": "Dr. Smith",
        "role": Role.DOCTOR,
    },
    {
        "email": "dr.jones@clinic.test",
        "password": "doctor1234",
        "name": "Dr. Jones",
        "role": Role.DOCTOR,
    },
    {
        "email": "patient1@pulse.test",
        "password": "patient1234",
        "name": "Patient One",
        "role": Role.PATIENT,
    },
    {
        "email": "patient2@pulse.test",
        "password": "patient1234",
        "name": "Patient Two",
        "role": Role.PATIENT,
    },
    {
        "email": "pharma@clinic.test",
        "password": "pharma1234",
        "name": "Lead Pharmacist",
        "role": Role.PHARMACIST,
    },
]


async def seed() -> None:
    print("Seeding demo healthcare users...")

    async with async_session_maker() as session:
        for demo_user in DEMO_USERS:
            result = await session.execute(
                # pyrefly: ignore [bad-argument-type]
                select(User).where(User.email == demo_user["email"])
            )
            existing = result.scalar_one_or_none()
            hashed_password = pwd_context.hash(demo_user["password"])

            if existing is not None:
                existing.name = demo_user["name"]
                existing.role = demo_user["role"]
                existing.hashed_password = hashed_password
                existing.is_active = True
                existing.is_verified = True
            else:
                session.add(
                    User(
                        id=uuid.uuid4(),
                        email=demo_user["email"],
                        hashed_password=hashed_password,
                        name=demo_user["name"],
                        role=demo_user["role"],
                        is_active=True,
                        is_verified=True,
                    )
                )

        await session.commit()

    print("=" * 60)
    print("Seed completed successfully! Demo Accounts:")
    print("-" * 60)
    print(f"{'Role':<20} {'Email':<30} {'Password':<15}")
    print("-" * 60)

    for demo_user in DEMO_USERS:
        print(
            f"{demo_user['role'].value:<20} "
            f"{demo_user['email']:<30} "
            f"{demo_user['password']:<15}"
        )

    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(seed())
