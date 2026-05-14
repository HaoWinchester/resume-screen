"""add resume updated_at

Revision ID: 005
Revises: 004
Create Date: 2026-04-27
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("resumes", sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True))
    op.execute("UPDATE resumes SET updated_at = created_at WHERE updated_at IS NULL")
    op.alter_column("resumes", "updated_at", nullable=False)
    op.create_index(op.f("ix_resumes_updated_at"), "resumes", ["updated_at"])


def downgrade() -> None:
    op.drop_index(op.f("ix_resumes_updated_at"), table_name="resumes")
    op.drop_column("resumes", "updated_at")
