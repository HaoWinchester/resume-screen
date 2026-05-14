import apiClient from '../api';
import type { CandidateWorkflowItem, CandidateWorkflowListResponse, CandidateWorkflowStatus } from '@/types/candidateWorkflow';

export async function fetchCandidateWorkflows(params: {
  analysis_ids?: string[];
  job_requirement_id?: string;
  status?: CandidateWorkflowStatus;
}): Promise<CandidateWorkflowListResponse> {
  const response = await apiClient.get<CandidateWorkflowListResponse>('/candidate-workflows', {
    params: {
      analysis_ids: params.analysis_ids?.join(','),
      job_requirement_id: params.job_requirement_id,
      status: params.status,
    },
  });
  return response.data;
}

export async function fetchCandidateWorkflow(analysisId: string): Promise<CandidateWorkflowItem> {
  const response = await apiClient.get<CandidateWorkflowItem>(`/candidate-workflows/${analysisId}`);
  return response.data;
}

export async function markCandidatePriority(analysisId: string, note?: string): Promise<CandidateWorkflowItem> {
  const response = await apiClient.post<CandidateWorkflowItem>(`/candidate-workflows/${analysisId}/priority`, { note });
  return response.data;
}

export async function markCandidateContacted(analysisId: string, note?: string): Promise<CandidateWorkflowItem> {
  const response = await apiClient.post<CandidateWorkflowItem>(`/candidate-workflows/${analysisId}/contact`, { note });
  return response.data;
}

export async function scheduleCandidateInterview(params: {
  analysisId: string;
  scheduled_at: string;
  mode?: string;
  location?: string;
  note?: string;
  candidate_email?: string;
}): Promise<CandidateWorkflowItem> {
  const response = await apiClient.post<CandidateWorkflowItem>(`/candidate-workflows/${params.analysisId}/interview`, {
    scheduled_at: params.scheduled_at,
    mode: params.mode,
    location: params.location,
    note: params.note,
    candidate_email: params.candidate_email,
  });
  return response.data;
}

export async function addCandidateWorkflowNote(analysisId: string, note: string): Promise<CandidateWorkflowItem> {
  const response = await apiClient.post<CandidateWorkflowItem>(`/candidate-workflows/${analysisId}/notes`, { note });
  return response.data;
}

export function workflowStatusLabel(status?: string) {
  if (status === 'priority') return '优先沟通';
  if (status === 'contacted') return '已沟通';
  if (status === 'interview_scheduled') return '已约面试';
  if (status === 'rejected') return '已淘汰';
  if (status === 'hired') return '已录用';
  return '未跟进';
}
