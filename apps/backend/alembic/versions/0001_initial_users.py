# Implements: FR-01, FR-02
# Safety:    none
# Owner:     backend (zhsraD)

"""initial_users

Revision ID: 0001
Revises:
Create Date: 2026-10-13 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enum type
    user_role_enum = postgresql.ENUM(
        "PATIENT",
        "CAREGIVER",
        "DOCTOR",
        "NURSE",
        "PHARMACIST",
        "PHARMACY_STAFF",
        "RECEPTION",
        "CLINIC_ADMIN",
        "SYSTEM_ADMIN",
        name="user_role_enum",
        create_type=False,
    )
    user_role_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("role", user_role_enum, nullable=False, server_default="PATIENT"),
        sa.Column(
            "is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")
        ),
        sa.Column(
            "is_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")
        ),
        sa.Column(
            "is_superuser",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_role"), "users", ["role"], unique=False)
    op.create_index(
        "ix_users_role_is_active", "users", ["role", "is_active"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_users_role_is_active", table_name="users")
    op.drop_index(op.f("ix_users_role"), table_name="users")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
    user_role_enum = postgresql.ENUM(name="user_role_enum")
    user_role_enum.drop(op.get_bind(), checkfirst=True)
