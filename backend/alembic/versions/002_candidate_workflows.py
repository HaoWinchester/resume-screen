"""add candidate workflow tables

Revision ID: 002
Revises: 001
Create Date: 2026-04-27
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    workflow_status = sa.Enum(
        "NEW",
        "PRIORITY",
        "CONTACTED",
        "INTERVIEW_SCHEDULED",
        "REJECTED",
        "HIRED",
        name="candidateworkflowstatus",
    )
    workflow_action = sa.Enum(
        "MARK_PRIORITY",
        "MARK_CONTACTED",
        "SCHEDULE_INTERVIEW",
        "ADD_NOTE",
        name="candidateworkflowaction",
    )

    op.create_table(
        "candidate_workflows",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("analysis_id", sa.UUID(), nullable=False),
        sa.Column("company_id", sa.UUID(), nullable=False),
        sa.Column("status", workflow_status, nullable=False),
        sa.Column("is_priority", sa.Boolean(), nullable=False),
        sa.Column("contact_count", sa.Integer(), nullable=False),
        sa.Column("last_contacted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("interview_scheduled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("interview_mode", sa.String(length=50), nullable=True),
        sa.Column("interview_location", sa.String(length=255), nullable=True),
        sa.Column("next_step", sa.String(length=255), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("updated_by", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["analysis_id"], ["analysis_results.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("analysis_id"),
    )
    op.create_index(op.f("ix_candidate_workflows_id"), "candidate_workflows", ["id"])
    op.create_index(op.f("ix_candidate_workflows_analysis_id"), "candidate_workflows", ["analysis_id"])
    op.create_index(op.f("ix_candidate_workflows_company_id"), "candidate_workflows", ["company_id"])
    op.create_index(op.f("ix_candidate_workflows_status"), "candidate_workflows", ["status"])

    op.create_table(
        "candidate_workflow_events",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("workflow_id", sa.UUID(), nullable=False),
        sa.Column("action", workflow_action, nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("event_metadata", postgresql.JSON(), nullable=True),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["workflow_id"], ["candidate_workflows.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_candidate_workflow_events_id"), "candidate_workflow_events", ["id"])
    op.create_index(op.f("ix_candidate_workflow_events_workflow_id"), "candidate_workflow_events", ["workflow_id"])
    op.create_index(op.f("ix_candidate_workflow_events_action"), "candidate_workflow_events", ["action"])
    op.create_index(op.f("ix_candidate_workflow_events_created_at"), "candidate_workflow_events", ["created_at"])


def downgrade() -> None:
    op.drop_index(op.f("ix_candidate_workflow_events_created_at"), table_name="candidate_workflow_events")
    op.drop_index(op.f("ix_candidate_workflow_events_action"), table_name="candidate_workflow_events")
    op.drop_index(op.f("ix_candidate_workflow_events_workflow_id"), table_name="candidate_workflow_events")
    op.drop_index(op.f("ix_candidate_workflow_events_id"), table_name="candidate_workflow_events")
    op.drop_table("candidate_workflow_events")

    op.drop_index(op.f("ix_candidate_workflows_status"), table_name="candidate_workflows")
    op.drop_index(op.f("ix_candidate_workflows_company_id"), table_name="candidate_workflows")
    op.drop_index(op.f("ix_candidate_workflows_analysis_id"), table_name="candidate_workflows")
    op.drop_index(op.f("ix_candidate_workflows_id"), table_name="candidate_workflows")
    op.drop_table("candidate_workflows")

    op.execute("DROP TYPE IF EXISTS candidateworkflowaction")
    op.execute("DROP TYPE IF EXISTS candidateworkflowstatus")
