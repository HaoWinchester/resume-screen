import type { RecommendationLevel } from './analysis';

export interface RecruitmentMetric {
  label: string;
  value: number | string;
  delta?: string;
  tone?: 'blue' | 'green' | 'amber' | 'red' | 'slate';
}

export interface RecruitmentFunnelStage {
  key: string;
  label: string;
  count: number;
  conversion?: number;
}

export interface RecruitmentPipelineColumn {
  key: string;
  title: string;
  description: string;
  count: number;
  candidateNames: string[];
}

export interface CompanyTalentInsight {
  label: string;
  value: string;
  description: string;
  icon: string;
}

export interface JobProfileSuggestion {
  title: string;
  currentSignal: string;
  suggestion: string;
  impact: string;
}

export interface RecruitmentRiskInsight {
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface WorkbenchEntry {
  title: string;
  description: string;
  icon: string;
  href: string;
  tag: string;
}

export interface RecruitmentOverview {
  updated_at?: string | null;
  metrics: RecruitmentMetric[];
  funnel: RecruitmentFunnelStage[];
  pipeline: RecruitmentPipelineColumn[];
  companyTalent: CompanyTalentInsight[];
  jobProfileSuggestions: JobProfileSuggestion[];
  riskInsights: RecruitmentRiskInsight[];
  entries: WorkbenchEntry[];
}

export interface TalentPoolCandidate {
  id: string;
  analysisId: string;
  resumeId: string;
  candidateName: string;
  jobId: string;
  jobTitle: string;
  score: number;
  recommendation: RecommendationLevel;
  recommendationLabel: string;
  skills: string[];
  riskFlags: string[];
  summary: string;
  analyzedAt?: string | null;
}

export interface TalentPoolResponse {
  items: TalentPoolCandidate[];
  total: number;
  generatedAt?: string | null;
}

export interface CandidateReportSection {
  title: string;
  items: string[];
}

export interface CandidateReport {
  id: string;
  candidateName: string;
  candidateEmail?: string | null;
  jobTitle: string;
  score: number;
  recommendation: RecommendationLevel;
  recommendationLabel: string;
  recommendationReasons: string[];
  riskPoints: string[];
  interviewQuestions: string[];
  outreachScripts: string[];
  skills: string[];
  generatedAt?: string | null;
}
