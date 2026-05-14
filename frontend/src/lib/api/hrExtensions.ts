import apiClient from '../api';
import type {
  CreateHrCommunicationPayload,
  CreateHrInterviewFeedbackPayload,
  HrAuditLog,
  HrCalendarEvent,
  HrCommunicationRecord,
  HrEmailTemplate,
  HrInterviewFeedback,
  HrJdOptimizationRequest,
  HrJdOptimizationResponse,
  HrListResponse,
  HrPipelineResponse,
  HrReminder,
  SaveHrEmailTemplatePayload,
} from '@/types/hrExtensions';

export async function fetchHrPipeline(): Promise<HrPipelineResponse> {
  const response = await apiClient.get<HrPipelineResponse>('/hr/pipeline');
  return response.data;
}

export async function fetchHrCommunications(params?: {
  analysis_id?: string;
  channel?: string;
}): Promise<HrListResponse<HrCommunicationRecord>> {
  const response = await apiClient.get<HrListResponse<HrCommunicationRecord>>('/hr/communications', { params });
  return response.data;
}

export async function createHrCommunication(payload: CreateHrCommunicationPayload): Promise<HrCommunicationRecord> {
  const response = await apiClient.post<HrCommunicationRecord>('/hr/communications', payload);
  return response.data;
}

export async function fetchHrInterviewFeedback(params?: {
  analysis_id?: string;
}): Promise<HrListResponse<HrInterviewFeedback>> {
  const response = await apiClient.get<HrListResponse<HrInterviewFeedback>>('/hr/interview-feedback', { params });
  return response.data;
}

export async function createHrInterviewFeedback(payload: CreateHrInterviewFeedbackPayload): Promise<HrInterviewFeedback> {
  const response = await apiClient.post<HrInterviewFeedback>('/hr/interview-feedback', payload);
  return response.data;
}

export async function fetchHrEmailTemplates(params?: {
  scenario?: string;
}): Promise<HrListResponse<HrEmailTemplate>> {
  const response = await apiClient.get<HrListResponse<HrEmailTemplate>>('/hr/email-templates', { params });
  return response.data;
}

export async function createHrEmailTemplate(payload: SaveHrEmailTemplatePayload): Promise<HrEmailTemplate> {
  const response = await apiClient.post<HrEmailTemplate>('/hr/email-templates', payload);
  return response.data;
}

export async function updateHrEmailTemplate(id: string, payload: SaveHrEmailTemplatePayload): Promise<HrEmailTemplate> {
  const response = await apiClient.put<HrEmailTemplate>(`/hr/email-templates/${id}`, payload);
  return response.data;
}

export async function fetchHrReminders(params?: {
  status?: string;
}): Promise<HrListResponse<HrReminder>> {
  const response = await apiClient.get<HrListResponse<HrReminder>>('/hr/reminders', { params });
  return response.data;
}

export async function completeHrReminder(id: string): Promise<HrReminder> {
  const response = await apiClient.patch<HrReminder>(`/hr/reminders/${id}`, { status: 'done' });
  return response.data;
}

export async function dispatchDueHrReminders(): Promise<{ sent: number; failed: number; total: number }> {
  const response = await apiClient.post<{ sent: number; failed: number; total: number }>('/hr/reminders/dispatch-due');
  return response.data;
}

export async function fetchHrCalendar(params?: {
  start?: string;
  end?: string;
}): Promise<HrListResponse<HrCalendarEvent>> {
  const response = await apiClient.get<HrListResponse<HrCalendarEvent>>('/hr/calendar', { params });
  return response.data;
}

export async function optimizeHrJd(payload: HrJdOptimizationRequest): Promise<HrJdOptimizationResponse> {
  const response = await apiClient.post<HrJdOptimizationResponse>('/hr/jd-optimizer', payload);
  return response.data;
}

export async function fetchHrAuditLogs(params?: {
  action?: string;
  resource_type?: string;
}): Promise<HrListResponse<HrAuditLog>> {
  const response = await apiClient.get<HrListResponse<HrAuditLog>>('/hr/audit', { params });
  return response.data;
}
