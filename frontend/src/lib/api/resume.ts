import apiClient from '../api';
import type {
  Resume,
  ResumeListItem,
  ResumeListResponse,
  ResumeUploadResponse,
  TaskStatusResponse,
} from '@/types/resume';

// ==================== 简历 API ====================

/**
 * 上传简历文件
 */
export async function uploadResumes(
  jobRequirementId: string,
  files: File[],
  onProgress?: (progress: number) => void
): Promise<ResumeUploadResponse> {
  const formData = new FormData();
  formData.append('job_requirement_id', jobRequirementId);
  files.forEach((file) => {
    formData.append('files', file);
  });

  const response = await apiClient.post<ResumeUploadResponse>('/resumes/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (progressEvent.total && onProgress) {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percentCompleted);
      }
    },
  });

  return response.data;
}

/**
 * 获取简历列表
 */
export async function fetchResumes(params: {
  job_requirement_id?: string;
  parse_status?: string;
  page?: number;
  per_page?: number;
}): Promise<ResumeListResponse> {
  const response = await apiClient.get<ResumeListResponse>('/resumes', { params });
  return response.data;
}

/**
 * 获取简历详情
 */
export async function fetchResumeDetail(id: string): Promise<Resume> {
  const response = await apiClient.get<Resume>(`/resumes/${id}`);
  return response.data;
}

/**
 * 删除简历
 */
export async function deleteResume(id: string): Promise<void> {
  await apiClient.delete(`/resumes/${id}`);
}

/**
 * 重新解析简历
 */
export async function retryResumeParse(id: string): Promise<void> {
  await apiClient.post(`/resumes/${id}/retry`);
}

/**
 * 批量重新解析等待中/解析中的简历
 */
export async function retryPendingResumes(params?: { job_requirement_id?: string }): Promise<{
  retried: number;
  scope: string;
  message: string;
}> {
  const response = await apiClient.post('/resumes/retry-pending', undefined, { params });
  return response.data;
}

/**
 * 下载简历文件
 */
export async function downloadResumeFile(id: string): Promise<Blob> {
  const response = await apiClient.get(`/resumes/${id}/file`, {
    responseType: 'blob',
  });
  return response.data;
}

/**
 * 获取任务状态
 */
export async function fetchTaskStatus(taskId: string): Promise<TaskStatusResponse> {
  const response = await apiClient.get<TaskStatusResponse>(`/tasks/${taskId}`);
  return response.data;
}
