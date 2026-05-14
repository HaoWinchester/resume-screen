"""add company contact info

Revision ID: 003
Revises: 002
Create Date: 2026-04-27
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("companies", sa.Column("contact_name", sa.String(length=100), nullable=True))
    op.add_column("companies", sa.Column("contact_phone", sa.String(length=50), nullable=True))
    op.add_column("companies", sa.Column("contact_email", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("companies", "contact_email")
    op.drop_column("companies", "contact_phone")
    op.drop_column("companies", "contact_name")
