import apiClient from '../api';
import type {
  JobRequirement,
  JobRequirementListItem,
  JobRequirementListResponse,
  CreateJobRequirementRequest,
  UpdateJobRequirementRequest,
  JobTemplate,
  JobTemplateListResponse,
  CreateJobTemplateRequest,
  UpdateJobTemplateRequest,
} from '@/types/job';

async function postWithKeepalive<T>(path: string): Promise<T> {
  const baseURL = apiClient.defaults.baseURL || '';
  const token =
    typeof window !== 'undefined' ? window.localStorage.getItem('access_token') : null;

  const response = await fetch(`${baseURL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    keepalive: true,
  });

  if (response.status === 401 && typeof window !== 'undefined') {
    window.localStorage.removeItem('access_token');
    window.localStorage.removeItem('user');
    window.location.href = '/login';
    throw new Error('未授权');
  }

  if (!response.ok) {
    let payload: any = null;
    try {
      payload = await response.json();
    } catch {
      // Ignore parse errors and fall back to a generic message.
    }

    throw new Error(payload?.error?.message || '请求失败');
  }

  return response.json();
}

// ==================== 岗位需求 API ====================

/**
 * 获取岗位需求列表
 */
export async function fetchJobRequirements(params?: {
  status?: string;
  page?: number;
  per_page?: number;
}): Promise<JobRequirementListResponse> {
  const { status, ...restParams } = params || {};
  const response = await apiClient.get<JobRequirementListResponse>('/job-requirements', {
    params: {
      ...restParams,
      status_filter: status,
    },
  });
  return response.data;
}

/**
 * 获取单个岗位需求详情
 */
export async function fetchJobRequirement(id: string): Promise<JobRequirement> {
  const response = await apiClient.get<JobRequirement>(`/job-requirements/${id}`);
  return response.data;
}

/**
 * 创建岗位需求
 */
export async function createJobRequirement(
  data: CreateJobRequirementRequest
): Promise<JobRequirement> {
  const response = await apiClient.post<JobRequirement>('/job-requirements', data);
  return response.data;
}

/**
 * 更新岗位需求
 */
export async function updateJobRequirement(
  id: string,
  data: UpdateJobRequirementRequest
): Promise<JobRequirement> {
  const response = await apiClient.patch<JobRequirement>(`/job-requirements/${id}`, data);
  return response.data;
}

/**
 * 删除岗位需求（仅 draft 状态）
 */
export async function deleteJobRequirement(id: string): Promise<void> {
  await apiClient.delete(`/job-requirements/${id}`);
}

/**
 * 激活岗位需求
 */
export async function activateJobRequirement(id: string): Promise<JobRequirement> {
  return postWithKeepalive<JobRequirement>(`/job-requirements/${id}/activate`);
}

/**
 * 关闭岗位需求
 */
export async function closeJobRequirement(id: string): Promise<JobRequirement> {
  return postWithKeepalive<JobRequirement>(`/job-requirements/${id}/close`);
}

/**
 * 复制岗位需求
 */
export async function copyJobRequirement(id: string): Promise<JobRequirement> {
  return postWithKeepalive<JobRequirement>(`/job-requirements/${id}/copy`);
}

// ==================== 岗位模板 API ====================

/**
 * 获取岗位模板列表
 */
export async function fetchJobTemplates(): Promise<JobTemplateListResponse> {
  const response = await apiClient.get('/job-templates');
  const data = response.data;
  // Backend may return array directly or { items: [...] }
  if (Array.isArray(data)) {
    return { items: data };
  }
  return { items: data.items || [] };
}

/**
 * 获取单个模板详情
 */
export async function fetchJobTemplate(id: string): Promise<JobTemplate> {
  const response = await apiClient.get<JobTemplate>(`/job-templates/${id}`);
  return response.data;
}

/**
 * 创建岗位模板
 */
export async function createJobTemplate(
  data: CreateJobTemplateRequest
): Promise<JobTemplate> {
  const response = await apiClient.post<JobTemplate>('/job-templates', data);
  return response.data;
}

/**
 * 更新岗位模板
 */
export async function updateJobTemplate(
  id: string,
  data: UpdateJobTemplateRequest
): Promise<JobTemplate> {
  const response = await apiClient.patch<JobTemplate>(`/job-templates/${id}`, data);
  return response.data;
}

/**
 * 删除岗位模板
 */
export async function deleteJobTemplate(id: string): Promise<void> {
  await apiClient.delete(`/job-templates/${id}`);
}

/**
 * 从岗位需求保存为模板
 */
export async function saveAsTemplate(
  jobRequirementId: string,
  templateName: string
): Promise<JobTemplate> {
  const response = await apiClient.post<JobTemplate>(`/job-requirements/${jobRequirementId}/save-as-template`, {
    name: templateName,
  });
  return response.data;
}
