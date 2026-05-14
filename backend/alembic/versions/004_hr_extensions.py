"""add hr extension tables

Revision ID: 004
Revises: 003
Create Date: 2026-04-27
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "candidate_interview_feedbacks",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("company_id", sa.UUID(), nullable=False),
        sa.Column("analysis_id", sa.UUID(), nullable=False),
        sa.Column("interviewer_user_id", sa.UUID(), nullable=True),
        sa.Column("interview_round", sa.String(length=80), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("recommendation", sa.String(length=40), nullable=False),
        sa.Column("strengths", postgresql.JSON(), nullable=True),
        sa.Column("concerns", postgresql.JSON(), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("next_step", sa.String(length=255), nullable=True),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["analysis_id"], ["analysis_results.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["interviewer_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_candidate_interview_feedbacks_id"), "candidate_interview_feedbacks", ["id"])
    op.create_index(op.f("ix_candidate_interview_feedbacks_company_id"), "candidate_interview_feedbacks", ["company_id"])
    op.create_index(op.f("ix_candidate_interview_feedbacks_analysis_id"), "candidate_interview_feedbacks", ["analysis_id"])
    op.create_index(op.f("ix_candidate_interview_feedbacks_recommendation"), "candidate_interview_feedbacks", ["recommendation"])
    op.create_index(op.f("ix_candidate_interview_feedbacks_created_at"), "candidate_interview_feedbacks", ["created_at"])

    op.create_table(
        "candidate_communications",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("company_id", sa.UUID(), nullable=False),
        sa.Column("analysis_id", sa.UUID(), nullable=False),
        sa.Column("channel", sa.String(length=40), nullable=False),
        sa.Column("direction", sa.String(length=20), nullable=False),
        sa.Column("subject", sa.String(length=255), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("contact_person", sa.String(length=100), nullable=True),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["analysis_id"], ["analysis_results.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_candidate_communications_id"), "candidate_communications", ["id"])
    op.create_index(op.f("ix_candidate_communications_company_id"), "candidate_communications", ["company_id"])
    op.create_index(op.f("ix_candidate_communications_analysis_id"), "candidate_communications", ["analysis_id"])
    op.create_index(op.f("ix_candidate_communications_channel"), "candidate_communications", ["channel"])
    op.create_index(op.f("ix_candidate_communications_occurred_at"), "candidate_communications", ["occurred_at"])

    op.create_table(
        "candidate_tags",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("company_id", sa.UUID(), nullable=False),
        sa.Column("analysis_id", sa.UUID(), nullable=False),
        sa.Column("tag", sa.String(length=60), nullable=False),
        sa.Column("color", sa.String(length=30), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["analysis_id"], ["analysis_results.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("company_id", "analysis_id", "tag", name="uq_candidate_tag_company_analysis_tag"),
    )
    op.create_index(op.f("ix_candidate_tags_id"), "candidate_tags", ["id"])
    op.create_index(op.f("ix_candidate_tags_company_id"), "candidate_tags", ["company_id"])
    op.create_index(op.f("ix_candidate_tags_analysis_id"), "candidate_tags", ["analysis_id"])
    op.create_index(op.f("ix_candidate_tags_tag"), "candidate_tags", ["tag"])
    op.create_index(op.f("ix_candidate_tags_created_at"), "candidate_tags", ["created_at"])

    op.create_table(
        "email_templates",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("company_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("template_type", sa.String(length=50), nullable=False),
        sa.Column("subject", sa.String(length=255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("variables", postgresql.JSON(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("updated_by", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("company_id", "name", name="uq_email_template_company_name"),
    )
    op.create_index(op.f("ix_email_templates_id"), "email_templates", ["id"])
    op.create_index(op.f("ix_email_templates_company_id"), "email_templates", ["company_id"])
    op.create_index(op.f("ix_email_templates_template_type"), "email_templates", ["template_type"])
    op.create_index(op.f("ix_email_templates_is_active"), "email_templates", ["is_active"])

    op.create_table(
        "recruitment_reminders",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("company_id", sa.UUID(), nullable=False),
        sa.Column("analysis_id", sa.UUID(), nullable=True),
        sa.Column("job_requirement_id", sa.UUID(), nullable=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("reminder_type", sa.String(length=50), nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("completed_by", sa.UUID(), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["analysis_id"], ["analysis_results.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["completed_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["job_requirement_id"], ["job_requirements.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_recruitment_reminders_id"), "recruitment_reminders", ["id"])
    op.create_index(op.f("ix_recruitment_reminders_company_id"), "recruitment_reminders", ["company_id"])
    op.create_index(op.f("ix_recruitment_reminders_analysis_id"), "recruitment_reminders", ["analysis_id"])
    op.create_index(op.f("ix_recruitment_reminders_job_requirement_id"), "recruitment_reminders", ["job_requirement_id"])
    op.create_index(op.f("ix_recruitment_reminders_reminder_type"), "recruitment_reminders", ["reminder_type"])
    op.create_index(op.f("ix_recruitment_reminders_due_at"), "recruitment_reminders", ["due_at"])
    op.create_index(op.f("ix_recruitment_reminders_status"), "recruitment_reminders", ["status"])

    op.create_table(
        "calendar_events",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("company_id", sa.UUID(), nullable=False),
        sa.Column("analysis_id", sa.UUID(), nullable=True),
        sa.Column("reminder_id", sa.UUID(), nullable=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("location", sa.String(length=255), nullable=True),
        sa.Column("provider", sa.String(length=50), nullable=True),
        sa.Column("external_event_id", sa.String(length=255), nullable=True),
        sa.Column("attendees", postgresql.JSON(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["analysis_id"], ["analysis_results.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["reminder_id"], ["recruitment_reminders.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_calendar_events_id"), "calendar_events", ["id"])
    op.create_index(op.f("ix_calendar_events_company_id"), "calendar_events", ["company_id"])
    op.create_index(op.f("ix_calendar_events_analysis_id"), "calendar_events", ["analysis_id"])
    op.create_index(op.f("ix_calendar_events_reminder_id"), "calendar_events", ["reminder_id"])
    op.create_index(op.f("ix_calendar_events_start_at"), "calendar_events", ["start_at"])

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("company_id", sa.UUID(), nullable=False),
        sa.Column("actor_user_id", sa.UUID(), nullable=True),
        sa.Column("action", sa.String(length=80), nullable=False),
        sa.Column("entity_type", sa.String(length=80), nullable=False),
        sa.Column("entity_id", sa.String(length=80), nullable=True),
        sa.Column("summary", sa.String(length=255), nullable=False),
        sa.Column("audit_metadata", postgresql.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_audit_logs_id"), "audit_logs", ["id"])
    op.create_index(op.f("ix_audit_logs_company_id"), "audit_logs", ["company_id"])
    op.create_index(op.f("ix_audit_logs_actor_user_id"), "audit_logs", ["actor_user_id"])
    op.create_index(op.f("ix_audit_logs_action"), "audit_logs", ["action"])
    op.create_index(op.f("ix_audit_logs_entity_type"), "audit_logs", ["entity_type"])
    op.create_index(op.f("ix_audit_logs_entity_id"), "audit_logs", ["entity_id"])
    op.create_index(op.f("ix_audit_logs_created_at"), "audit_logs", ["created_at"])


def downgrade() -> None:
    op.drop_index(op.f("ix_audit_logs_created_at"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_entity_id"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_entity_type"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_action"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_actor_user_id"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_company_id"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_id"), table_name="audit_logs")
    op.drop_table("audit_logs")

    op.drop_index(op.f("ix_calendar_events_start_at"), table_name="calendar_events")
    op.drop_index(op.f("ix_calendar_events_reminder_id"), table_name="calendar_events")
    op.drop_index(op.f("ix_calendar_events_analysis_id"), table_name="calendar_events")
    op.drop_index(op.f("ix_calendar_events_company_id"), table_name="calendar_events")
    op.drop_index(op.f("ix_calendar_events_id"), table_name="calendar_events")
    op.drop_table("calendar_events")

    op.drop_index(op.f("ix_recruitment_reminders_status"), table_name="recruitment_reminders")
    op.drop_index(op.f("ix_recruitment_reminders_due_at"), table_name="recruitment_reminders")
    op.drop_index(op.f("ix_recruitment_reminders_reminder_type"), table_name="recruitment_reminders")
    op.drop_index(op.f("ix_recruitment_reminders_job_requirement_id"), table_name="recruitment_reminders")
    op.drop_index(op.f("ix_recruitment_reminders_analysis_id"), table_name="recruitment_reminders")
    op.drop_index(op.f("ix_recruitment_reminders_company_id"), table_name="recruitment_reminders")
    op.drop_index(op.f("ix_recruitment_reminders_id"), table_name="recruitment_reminders")
    op.drop_table("recruitment_reminders")

    op.drop_index(op.f("ix_email_templates_is_active"), table_name="email_templates")
    op.drop_index(op.f("ix_email_templates_template_type"), table_name="email_templates")
    op.drop_index(op.f("ix_email_templates_company_id"), table_name="email_templates")
    op.drop_index(op.f("ix_email_templates_id"), table_name="email_templates")
    op.drop_table("email_templates")

    op.drop_index(op.f("ix_candidate_tags_created_at"), table_name="candidate_tags")
    op.drop_index(op.f("ix_candidate_tags_tag"), table_name="candidate_tags")
    op.drop_index(op.f("ix_candidate_tags_analysis_id"), table_name="candidate_tags")
    op.drop_index(op.f("ix_candidate_tags_company_id"), table_name="candidate_tags")
    op.drop_index(op.f("ix_candidate_tags_id"), table_name="candidate_tags")
    op.drop_table("candidate_tags")

    op.drop_index(op.f("ix_candidate_communications_occurred_at"), table_name="candidate_communications")
    op.drop_index(op.f("ix_candidate_communications_channel"), table_name="candidate_communications")
    op.drop_index(op.f("ix_candidate_communications_analysis_id"), table_name="candidate_communications")
    op.drop_index(op.f("ix_candidate_communications_company_id"), table_name="candidate_communications")
    op.drop_index(op.f("ix_candidate_communications_id"), table_name="candidate_communications")
    op.drop_table("candidate_communications")

    op.drop_index(op.f("ix_candidate_interview_feedbacks_created_at"), table_name="candidate_interview_feedbacks")
    op.drop_index(op.f("ix_candidate_interview_feedbacks_recommendation"), table_name="candidate_interview_feedbacks")
    op.drop_index(op.f("ix_candidate_interview_feedbacks_analysis_id"), table_name="candidate_interview_feedbacks")
    op.drop_index(op.f("ix_candidate_interview_feedbacks_company_id"), table_name="candidate_interview_feedbacks")
    op.drop_index(op.f("ix_candidate_interview_feedbacks_id"), table_name="candidate_interview_feedbacks")
    op.drop_table("candidate_interview_feedbacks")
