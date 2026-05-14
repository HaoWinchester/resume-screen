from datetime import datetime
import uuid

from pydantic import BaseModel


class RecruitmentMetric(BaseModel):
    label: str
    value: int | float | str
    delta: str | None = None
    tone: str = "blue"


class RecruitmentFunnelStage(BaseModel):
    key: str
    label: str
    count: int
    conversion: float | None = None


class RecruitmentPipelineColumn(BaseModel):
    key: str
    title: str
    description: str
    count: int
    candidateNames: list[str]


class CompanyTalentInsight(BaseModel):
    label: str
    value: str
    description: str
    icon: str


class JobProfileSuggestion(BaseModel):
    title: str
    currentSignal: str
    suggestion: str
    impact: str


class RecruitmentRiskInsight(BaseModel):
    title: str
    description: str
    severity: str


class WorkbenchEntry(BaseModel):
    title: str
    description: str
    icon: str
    href: str
    tag: str


class RecruitmentOverview(BaseModel):
    updated_at: datetime
    metrics: list[RecruitmentMetric]
    funnel: list[RecruitmentFunnelStage]
    pipeline: list[RecruitmentPipelineColumn]
    companyTalent: list[CompanyTalentInsight]
    jobProfileSuggestions: list[JobProfileSuggestion]
    riskInsights: list[RecruitmentRiskInsight]
    entries: list[WorkbenchEntry]


class TalentPoolCandidate(BaseModel):
    id: str
    analysisId: uuid.UUID
    resumeId: uuid.UUID
    candidateName: str
    jobId: uuid.UUID
    jobTitle: str
    score: float
    recommendation: str
    recommendationLabel: str
    skills: list[str]
    riskFlags: list[str]
    summary: str
    analyzedAt: datetime | None = None


class TalentPoolResponse(BaseModel):
    items: list[TalentPoolCandidate]
    total: int
    generatedAt: datetime


class JobInsightResponse(BaseModel):
    jobId: uuid.UUID
    jobTitle: str
    totalResumes: int
    analyzed: int
    avgScore: float
    recommendedCount: int
    bottlenecks: list[str]
    suggestions: list[str]


class CandidateReport(BaseModel):
    id: uuid.UUID
    candidateName: str
    candidateEmail: str | None = None
    jobTitle: str
    score: float
    recommendation: str
    recommendationLabel: str
    recommendationReasons: list[str]
    riskPoints: list[str]
    interviewQuestions: list[str]
    outreachScripts: list[str]
    skills: list[str]
    generatedAt: datetime | None = None
