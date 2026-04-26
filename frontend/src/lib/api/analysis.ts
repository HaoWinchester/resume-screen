import apiClient from '../api';
import type {
  AnalysisDetail,
  AnalysisListResponse,
  ComparisonResponse,
  RecentActivityResponse,
  ResumeProgressResponse,
} from '@/types/analysis';

/**
 * 获取分析列表
 */
export async function fetchAnalysisList(params: {
  job_requirement_id: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  recommendation?: string;
  page?: number;
  per_page?: number;
}): Promise<AnalysisListResponse> {
  const response = await apiClient.get<AnalysisListResponse>('/analysis', { params });
  return response.data;
}

/**
 * 获取最近简历解析进度
 */
export async function fetchResumeProgress(days = 7): Promise<ResumeProgressResponse> {
  const response = await apiClient.get<ResumeProgressResponse>('/analysis/progress', {
    params: { days },
  });
  return response.data;
}

/**
 * 获取最近真实活动
 */
export async function fetchRecentActivity(limit = 4): Promise<RecentActivityResponse> {
  const response = await apiClient.get<RecentActivityResponse>('/analysis/activity', {
    params: { limit },
  });
  return response.data;
}

/**
 * 获取分析详情
 */
export async function fetchAnalysisDetail(id: string): Promise<AnalysisDetail> {
  const response = await apiClient.get<AnalysisDetail>(`/analysis/${id}`);
  return response.data;
}

/**
 * 重试分析
 */
export async function retryAnalysis(id: string): Promise<void> {
  await apiClient.post(`/analysis/${id}/retry`);
}

/**
 * 获取候选人对比
 */
export async function fetchCandidateComparison(analysisIds: string[]): Promise<ComparisonResponse> {
  const response = await apiClient.get<ComparisonResponse>('/analysis/compare', {
    params: { analysis_ids: analysisIds.join(',') },
  });
  return response.data;
}

/**
 * 导出分析结果
 */
export async function exportAnalysis(params: {
  job_requirement_id: string;
  format: 'xlsx' | 'csv';
  recommendation?: string;
}): Promise<Blob> {
  const response = await apiClient.get('/analysis/export', {
    params,
    responseType: 'blob',
  });
  return response.data;
}
