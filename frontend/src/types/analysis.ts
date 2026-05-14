import type { ParsedData } from './resume';
import type { Criteria } from './job';

// 推荐等级
export type RecommendationLevel = 'strongly_recommended' | 'recommended' | 'pending';

// 维度类型
export type DimensionType =
  | 'skill_match'
  | 'experience_match'
  | 'education'
  | 'project_relevance'
  | 'overall_quality';

// 权重级别
export type WeightLevel = 'high' | 'medium' | 'low';

// 维度评分
export interface DimensionScore {
  dimension: DimensionType;
  score: number;
  weight: WeightLevel;
  analysis_text?: string;
  match_details?: {
    matched_skills?: string[];
    missing_skills?: string[];
    bonus_skills_matched?: string[];
    [key: string]: any;
  };
}

// 分析列表项
export interface AnalysisListItem {
  id: string;
  resume_id: string;
  candidate_name: string | null;
  candidate_email?: string | null;
  overall_score: number;
  recommendation: RecommendationLevel;
  recommendation_reason: string | null;
  dimension_scores: DimensionScore[];
  analyzed_at: string | null;
}

// 分析统计
export interface AnalysisStatistics {
  total_resumes: number;
  analyzed: number;
  pending: number;
  failed: number;
  strongly_recommended: number;
  recommended: number;
  average_score: number;
}

export interface ResumeProgressDay {
  date: string;
  label: string;
  uploaded: number;
  parsed: number;
  failed: number;
  processing: number;
}

export interface ResumeProgressResponse {
  days: ResumeProgressDay[];
  total_uploaded: number;
  total_parsed: number;
  total_failed: number;
  total_processing: number;
}

export interface RecentActivityItem {
  id: string;
  type: string;
  title: string;
  description: string;
  occurred_at: string;
  icon: string;
  tone: 'blue' | 'green' | 'amber';
}

export interface RecentActivityResponse {
  items: RecentActivityItem[];
}

// 分析列表响应
export interface AnalysisListResponse {
  items: AnalysisListItem[];
  total: number;
  page: number;
  per_page: number;
  statistics: AnalysisStatistics;
}

// 分析详情
export interface AnalysisDetail {
  id: string;
  resume_id: string;
  job_requirement_id: string;
  overall_score: number;
  recommendation: RecommendationLevel;
  recommendation_reason: string | null;
  strengths: string[];
  weaknesses: string[];
  dimension_scores: DimensionScore[];
  resume: {
    id: string;
    file_name: string;
    candidate_name?: string | null;
    candidate_email?: string | null;
    candidate_phone?: string | null;
    parsed_data: ParsedData;
  };
  job_requirement: {
    id: string;
    title: string;
    criteria: Criteria;
  };
  analyzed_at: string | null;
}

// 对比候选人信息
export interface ComparisonCandidate {
  analysis_id: string;
  candidate_name: string | null;
  overall_score: number;
  dimension_scores: DimensionScore[];
  key_info: {
    experience_years: number;
    education: string;
    top_skills: string[];
  };
}

// 对比响应
export interface ComparisonResponse {
  candidates: ComparisonCandidate[];
}
