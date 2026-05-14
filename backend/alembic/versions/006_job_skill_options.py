"""add user job skill options

Revision ID: 006
Revises: 005
Create Date: 2026-04-28
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "job_skill_options",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("company_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("job_type", sa.String(length=80), nullable=False),
        sa.Column("option_type", sa.String(length=20), nullable=False),
        sa.Column("value", sa.String(length=120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "job_type", "option_type", "value", name="uq_job_skill_option_user_type_value"),
    )
    op.create_index(op.f("ix_job_skill_options_id"), "job_skill_options", ["id"])
    op.create_index(op.f("ix_job_skill_options_company_id"), "job_skill_options", ["company_id"])
    op.create_index(op.f("ix_job_skill_options_user_id"), "job_skill_options", ["user_id"])
    op.create_index(op.f("ix_job_skill_options_job_type"), "job_skill_options", ["job_type"])
    op.create_index(op.f("ix_job_skill_options_option_type"), "job_skill_options", ["option_type"])
    op.create_index(op.f("ix_job_skill_options_created_at"), "job_skill_options", ["created_at"])


def downgrade() -> None:
    op.drop_index(op.f("ix_job_skill_options_created_at"), table_name="job_skill_options")
    op.drop_index(op.f("ix_job_skill_options_option_type"), table_name="job_skill_options")
    op.drop_index(op.f("ix_job_skill_options_job_type"), table_name="job_skill_options")
    op.drop_index(op.f("ix_job_skill_options_user_id"), table_name="job_skill_options")
    op.drop_index(op.f("ix_job_skill_options_company_id"), table_name="job_skill_options")
    op.drop_index(op.f("ix_job_skill_options_id"), table_name="job_skill_options")
    op.drop_table("job_skill_options")
