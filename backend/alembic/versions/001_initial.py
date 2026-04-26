"""initial migration

Revision ID: 001
Revises:
Create Date: 2026-04-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create companies table
    op.create_table(
        'companies',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('industry', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_companies_id'), 'companies', ['id'])
    op.create_index(op.f('ix_companies_name'), 'companies', ['name'], unique=True)

    # Create users table
    op.create_table(
        'users',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('role', sa.Enum('ADMIN', 'OPERATOR', name='userrole'), nullable=False),
        sa.Column('company_id', sa.UUID(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_id'), 'users', ['id'])
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_index(op.f('ix_users_company_id'), 'users', ['company_id'])

    # Create job_templates table
    op.create_table(
        'job_templates',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('company_id', sa.UUID(), nullable=False),
        sa.Column('content', postgresql.JSON(), nullable=False),
        sa.Column('created_by', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_job_templates_id'), 'job_templates', ['id'])

    # Create job_requirements table
    op.create_table(
        'job_requirements',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('company_id', sa.UUID(), nullable=False),
        sa.Column('created_by', sa.UUID(), nullable=True),
        sa.Column('template_id', sa.UUID(), nullable=True),
        sa.Column('status', sa.Enum('DRAFT', 'ACTIVE', 'CLOSED', name='jobrequirementstatus'), nullable=False),
        sa.Column('criteria', postgresql.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['template_id'], ['job_templates.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_job_requirements_id'), 'job_requirements', ['id'])
    op.create_index(op.f('ix_job_requirements_status'), 'job_requirements', ['status'])
    op.create_index(op.f('ix_job_requirements_company_id'), 'job_requirements', ['company_id'])

    # Create resumes table
    op.create_table(
        'resumes',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('job_requirement_id', sa.UUID(), nullable=False),
        sa.Column('file_name', sa.String(length=500), nullable=False),
        sa.Column('file_path', sa.String(length=1000), nullable=False),
        sa.Column('file_type', sa.Enum('PDF', 'DOC', 'DOCX', 'JPG', 'PNG', name='resumefiletype'), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=False),
        sa.Column('parse_status', sa.Enum('PENDING', 'PARSING', 'SUCCESS', 'FAILED', name='parsestatus'), nullable=False),
        sa.Column('parse_error', sa.Text(), nullable=True),
        sa.Column('parsed_data', postgresql.JSON(), nullable=True),
        sa.Column('candidate_name', sa.String(length=100), nullable=True),
        sa.Column('candidate_email', sa.String(length=255), nullable=True),
        sa.Column('candidate_phone', sa.String(length=50), nullable=True),
        sa.Column('uploaded_by', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['job_requirement_id'], ['job_requirements.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['uploaded_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_resumes_id'), 'resumes', ['id'])
    op.create_index(op.f('ix_resumes_parse_status'), 'resumes', ['parse_status'])
    op.create_index(op.f('ix_resumes_job_requirement_id'), 'resumes', ['job_requirement_id'])
    op.create_index(op.f('ix_resumes_candidate_name'), 'resumes', ['candidate_name'])
    op.create_index(op.f('ix_resumes_candidate_email'), 'resumes', ['candidate_email'])

    # Create analysis_results table
    op.create_table(
        'analysis_results',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('resume_id', sa.UUID(), nullable=False),
        sa.Column('job_requirement_id', sa.UUID(), nullable=False),
        sa.Column('overall_score', sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column('recommendation', sa.Enum('STRONGLY_RECOMMENDED', 'RECOMMENDED', 'PENDING', name='recommendationlevel'), nullable=False),
        sa.Column('recommendation_reason', sa.Text(), nullable=True),
        sa.Column('strengths', postgresql.JSON(), nullable=True),
        sa.Column('weaknesses', postgresql.JSON(), nullable=True),
        sa.Column('analysis_status', sa.Enum('PENDING', 'ANALYZING', 'COMPLETED', 'FAILED', name='analysisstatus'), nullable=False),
        sa.Column('analyzed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['resume_id'], ['resumes.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['job_requirement_id'], ['job_requirements.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('resume_id')
    )
    op.create_index(op.f('ix_analysis_results_id'), 'analysis_results', ['id'])
    op.create_index(op.f('ix_analysis_results_overall_score'), 'analysis_results', ['overall_score'])
    op.create_index(op.f('ix_analysis_results_job_requirement_id'), 'analysis_results', ['job_requirement_id'])

    # Create dimension_scores table
    op.create_table(
        'dimension_scores',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('analysis_id', sa.UUID(), nullable=False),
        sa.Column('dimension', sa.Enum('SKILL_MATCH', 'EXPERIENCE_MATCH', 'EDUCATION', 'PROJECT_RELEVANCE', 'OVERALL_QUALITY', name='dimension'), nullable=False),
        sa.Column('score', sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column('weight', sa.String(length=10), nullable=False),
        sa.Column('analysis_text', sa.Text(), nullable=False),
        sa.Column('match_details', postgresql.JSON(), nullable=True),
        sa.ForeignKeyConstraint(['analysis_id'], ['analysis_results.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_dimension_scores_id'), 'dimension_scores', ['id'])
    op.create_index(op.f('ix_dimension_scores_analysis_id'), 'dimension_scores', ['analysis_id'])


def downgrade() -> None:
    op.drop_index(op.f('ix_dimension_scores_analysis_id'), table_name='dimension_scores')
    op.drop_index(op.f('ix_dimension_scores_id'), table_name='dimension_scores')
    op.drop_table('dimension_scores')

    op.drop_index(op.f('ix_analysis_results_job_requirement_id'), table_name='analysis_results')
    op.drop_index(op.f('ix_analysis_results_overall_score'), table_name='analysis_results')
    op.drop_index(op.f('ix_analysis_results_id'), table_name='analysis_results')
    op.drop_table('analysis_results')

    op.drop_index(op.f('ix_resumes_candidate_email'), table_name='resumes')
    op.drop_index(op.f('ix_resumes_candidate_name'), table_name='resumes')
    op.drop_index(op.f('ix_resumes_job_requirement_id'), table_name='resumes')
    op.drop_index(op.f('ix_resumes_parse_status'), table_name='resumes')
    op.drop_index(op.f('ix_resumes_id'), table_name='resumes')
    op.drop_table('resumes')

    op.drop_index(op.f('ix_job_requirements_company_id'), table_name='job_requirements')
    op.drop_index(op.f('ix_job_requirements_status'), table_name='job_requirements')
    op.drop_index(op.f('ix_job_requirements_id'), table_name='job_requirements')
    op.drop_table('job_requirements')

    op.drop_index(op.f('ix_job_templates_id'), table_name='job_templates')
    op.drop_table('job_templates')

    op.drop_index(op.f('ix_users_company_id'), table_name='users')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_index(op.f('ix_users_id'), table_name='users')
    op.drop_table('users')

    op.drop_index(op.f('ix_companies_name'), table_name='companies')
    op.drop_index(op.f('ix_companies_id'), table_name='companies')
    op.drop_table('companies')
