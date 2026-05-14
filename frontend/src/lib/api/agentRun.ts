import apiClient from '../api';
import type { AgentRunCreatePayload, AgentRunItem, AgentRunListResponse } from '@/types/agentRun';

export async function createAgentRun(payload: AgentRunCreatePayload): Promise<AgentRunItem> {
  const response = await apiClient.post<AgentRunItem>('/agent-runs', payload);
  return response.data;
}

export async function fetchAgentRun(runId: string): Promise<AgentRunItem> {
  const response = await apiClient.get<AgentRunItem>(`/agent-runs/${runId}`);
  return response.data;
}

export async function fetchAgentRuns(params: {
  target_type?: string;
  target_id?: string;
  limit?: number;
}): Promise<AgentRunListResponse> {
  const response = await apiClient.get<AgentRunListResponse>('/agent-runs', { params });
  return response.data;
}
