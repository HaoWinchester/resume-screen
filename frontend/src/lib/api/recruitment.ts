import apiClient from '../api';
import type {
  CandidateReport,
  RecruitmentOverview,
  TalentPoolResponse,
} from '@/types/recruitment';

export async function fetchRecruitmentOverview(): Promise<RecruitmentOverview> {
  const response = await apiClient.get<RecruitmentOverview>('/recruitment/overview');
  return response.data;
}

export async function fetchTalentPool(): Promise<TalentPoolResponse> {
  const response = await apiClient.get<TalentPoolResponse>('/recruitment/talent-pool');
  return response.data;
}

export async function fetchCandidateReport(id: string): Promise<CandidateReport> {
  const response = await apiClient.get<CandidateReport>(`/recruitment/reports/${id}`);
  return response.data;
}
