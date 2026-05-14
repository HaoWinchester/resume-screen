export interface HrListResponse<T> {
  items: T[];
  total?: number;
  generated_at?: string | null;
}

export interface HrPipelineSummary {
  label: string;
  value: number | string;
  delta?: string | null;
}

export interface HrPipelineStage {
  key: string;
  label: string;
  count: number;
  conversion_rate?: number | null;
  average_days?: number | null;
}

export interface HrPipelineCandidate {
  id: string;
  analysis_id: string;
  candidate_name?: string | null;
  job_title?: string | null;
  stage: string;
  score?: number | null;
  owner_name?: string | null;
  updated_at?: string | null;
}

export interface HrPipelineResponse {
  summary: HrPipelineSummary[];
  stages: HrPipelineStage[];
  candidates: HrPipelineCandidate[];
  generated_at?: string | null;
}

export type HrCommunicationChannel = 'email' | 'phone' | 'wechat' | 'meeting' | 'note' | string;
export type HrCommunicationDirection = 'inbound' | 'outbound' | 'internal' | string;

export interface HrCommunicationRecord {
  id: string;
  analysis_id?: string | null;
  candidate_name?: string | null;
  job_title?: string | null;
  channel: HrCommunicationChannel;
  direction: HrCommunicationDirection;
  subject?: string | null;
  content?: string | null;
  owner_name?: string | null;
  contacted_at?: string | null;
  next_follow_up_at?: string | null;
  created_at?: string | null;
}

export interface CreateHrCommunicationPayload {
  analysis_id: string;
  channel: HrCommunicationChannel;
  direction: HrCommunicationDirection;
  subject?: string;
  content: string;
  next_follow_up_at?: string;
}

export type HrInterviewDecision = 'strong_yes' | 'yes' | 'hold' | 'no' | string;

export interface HrInterviewFeedback {
  id: string;
  analysis_id?: string | null;
  candidate_name?: string | null;
  job_title?: string | null;
  interviewer_name?: string | null;
  round_name?: string | null;
  score?: number | null;
  decision: HrInterviewDecision;
  strengths: string[];
  risks: string[];
  notes?: string | null;
  submitted_at?: string | null;
}

export interface CreateHrInterviewFeedbackPayload {
  analysis_id: string;
  interviewer_name: string;
  round_name?: string;
  score?: number;
  decision: HrInterviewDecision;
  strengths?: string[];
  risks?: string[];
  notes?: string;
}

export interface HrEmailTemplate {
  id: string;
  name: string;
  scenario: string;
  subject: string;
  body: string;
  variables: string[];
  is_active: boolean;
  updated_at?: string | null;
}

export interface SaveHrEmailTemplatePayload {
  name: string;
  scenario: string;
  subject: string;
  body: string;
  variables?: string[];
  is_active?: boolean;
}

export type HrReminderStatus = 'pending' | 'done' | 'overdue' | string;

export interface HrReminder {
  id: string;
  title: string;
  description?: string | null;
  candidate_name?: string | null;
  job_title?: string | null;
  reminder_type?: string | null;
  due_at?: string | null;
  status: HrReminderStatus;
  owner_name?: string | null;
}

export interface HrCalendarEvent {
  id: string;
  title: string;
  candidate_name?: string | null;
  job_title?: string | null;
  starts_at: string;
  ends_at?: string | null;
  location?: string | null;
  meeting_link?: string | null;
  attendees: string[];
  status?: string | null;
}

export interface HrJdOptimizationRequest {
  job_requirement_id: string;
  target_tone?: string;
  focus?: string;
}

export interface HrJdOptimizationResponse {
  job_requirement_id: string;
  original_title?: string | null;
  optimized_title?: string | null;
  optimized_description?: string | null;
  suggestions: string[];
  missing_signals: string[];
  inclusive_language_notes: string[];
  generated_at?: string | null;
}

export interface HrAuditLog {
  id: string;
  actor_name?: string | null;
  action: string;
  resource_type?: string | null;
  resource_id?: string | null;
  summary?: string | null;
  ip_address?: string | null;
  created_at?: string | null;
}
