export type AgentRunStatus = 'pending' | 'running' | 'completed' | 'failed';
export type AgentRunStepStatus = 'running' | 'completed' | 'failed';

export interface AgentRunStepItem {
  id: string;
  step_index: number;
  agent_name: string;
  status: AgentRunStepStatus;
  input_packet?: Record<string, unknown> | null;
  output?: Record<string, unknown> | null;
  summary?: string | null;
  error?: string | null;
  started_at: string;
  completed_at?: string | null;
}

export interface AgentRunResult {
  summary?: string | null;
  recommended_next_step?: string | null;
  safe_to_auto_apply?: boolean;
  human_review_points?: string[];
  agent_outputs?: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
}

export interface AgentRunItem {
  id: string;
  task_type: string;
  target_type: string;
  target_id: string;
  task_prompt?: string | null;
  status: AgentRunStatus;
  current_agent?: string | null;
  result?: AgentRunResult | null;
  error?: string | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  steps: AgentRunStepItem[];
}

export interface AgentRunListResponse {
  items: AgentRunItem[];
}

export interface AgentRunCreatePayload {
  task_type?: string;
  target_type: 'analysis';
  target_id: string;
  task_prompt?: string;
  context?: Record<string, unknown>;
  run_async?: boolean;
}
