export type CandidateWorkflowStatus =
  | 'new'
  | 'priority'
  | 'contacted'
  | 'interview_scheduled'
  | 'rejected'
  | 'hired';

export type CandidateWorkflowAction =
  | 'mark_priority'
  | 'mark_contacted'
  | 'schedule_interview'
  | 'add_note';

export interface CandidateWorkflowEventItem {
  id: string;
  action: CandidateWorkflowAction;
  note?: string | null;
  event_metadata?: Record<string, unknown> | null;
  scheduled_at?: string | null;
  created_at: string;
}

export interface CandidateWorkflowItem {
  id: string;
  analysis_id: string;
  status: CandidateWorkflowStatus;
  candidate_name?: string | null;
  candidate_email?: string | null;
  job_title?: string | null;
  score?: number | null;
  email_sent?: boolean | null;
  email_delivery_message?: string | null;
  is_priority: boolean;
  contact_count: number;
  last_contacted_at?: string | null;
  interview_scheduled_at?: string | null;
  interview_mode?: string | null;
  interview_location?: string | null;
  next_step?: string | null;
  note?: string | null;
  updated_at: string;
  events: CandidateWorkflowEventItem[];
}

export interface CandidateWorkflowListResponse {
  items: CandidateWorkflowItem[];
}
