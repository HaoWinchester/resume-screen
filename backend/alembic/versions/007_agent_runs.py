"""add agent runtime tables

Revision ID: 007
Revises: 006
Create Date: 2026-05-13
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE agentrunstatus AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
        """
    )
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE agentrunstepstatus AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
        """
    )
    agent_run_status = postgresql.ENUM(
        "PENDING",
        "RUNNING",
        "COMPLETED",
        "FAILED",
        name="agentrunstatus",
        create_type=False,
    )
    agent_step_status = postgresql.ENUM(
        "RUNNING",
        "COMPLETED",
        "FAILED",
        name="agentrunstepstatus",
        create_type=False,
    )

    op.create_table(
        "agent_runs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("task_type", sa.String(length=80), nullable=False),
        sa.Column("target_type", sa.String(length=80), nullable=False),
        sa.Column("target_id", sa.Uuid(), nullable=False),
        sa.Column("task_prompt", sa.Text(), nullable=True),
        sa.Column("status", agent_run_status, nullable=False),
        sa.Column("current_agent", sa.String(length=120), nullable=True),
        sa.Column("result", sa.JSON(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_agent_runs_id"), "agent_runs", ["id"], unique=False)
    op.create_index(op.f("ix_agent_runs_company_id"), "agent_runs", ["company_id"], unique=False)
    op.create_index(op.f("ix_agent_runs_task_type"), "agent_runs", ["task_type"], unique=False)
    op.create_index(op.f("ix_agent_runs_target_type"), "agent_runs", ["target_type"], unique=False)
    op.create_index(op.f("ix_agent_runs_target_id"), "agent_runs", ["target_id"], unique=False)
    op.create_index(op.f("ix_agent_runs_status"), "agent_runs", ["status"], unique=False)
    op.create_index(op.f("ix_agent_runs_created_at"), "agent_runs", ["created_at"], unique=False)

    op.create_table(
        "agent_run_steps",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("run_id", sa.Uuid(), nullable=False),
        sa.Column("step_index", sa.Integer(), nullable=False),
        sa.Column("agent_name", sa.String(length=120), nullable=False),
        sa.Column("status", agent_step_status, nullable=False),
        sa.Column("input_packet", sa.JSON(), nullable=True),
        sa.Column("output", sa.JSON(), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["run_id"], ["agent_runs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_agent_run_steps_id"), "agent_run_steps", ["id"], unique=False)
    op.create_index(op.f("ix_agent_run_steps_run_id"), "agent_run_steps", ["run_id"], unique=False)
    op.create_index(op.f("ix_agent_run_steps_agent_name"), "agent_run_steps", ["agent_name"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_agent_run_steps_agent_name"), table_name="agent_run_steps")
    op.drop_index(op.f("ix_agent_run_steps_run_id"), table_name="agent_run_steps")
    op.drop_index(op.f("ix_agent_run_steps_id"), table_name="agent_run_steps")
    op.drop_table("agent_run_steps")

    op.drop_index(op.f("ix_agent_runs_created_at"), table_name="agent_runs")
    op.drop_index(op.f("ix_agent_runs_status"), table_name="agent_runs")
    op.drop_index(op.f("ix_agent_runs_target_id"), table_name="agent_runs")
    op.drop_index(op.f("ix_agent_runs_target_type"), table_name="agent_runs")
    op.drop_index(op.f("ix_agent_runs_task_type"), table_name="agent_runs")
    op.drop_index(op.f("ix_agent_runs_company_id"), table_name="agent_runs")
    op.drop_index(op.f("ix_agent_runs_id"), table_name="agent_runs")
    op.drop_table("agent_runs")

    op.execute("DROP TYPE IF EXISTS agentrunstepstatus")
    op.execute("DROP TYPE IF EXISTS agentrunstatus")
