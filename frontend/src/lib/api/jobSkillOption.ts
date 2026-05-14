import apiClient from '../api';
import type { JobSkillCategory, JobSkillOptionType } from '@/lib/jobSkillCatalog';

export interface JobSkillOptionItem {
  id: string;
  job_type: JobSkillCategory;
  option_type: JobSkillOptionType;
  value: string;
  created_at: string;
}

export async function fetchJobSkillOptions(params: {
  job_type: JobSkillCategory;
  option_type?: JobSkillOptionType;
}): Promise<JobSkillOptionItem[]> {
  const response = await apiClient.get<{ items: JobSkillOptionItem[] }>('/job-skill-options', { params });
  return response.data.items;
}

export async function createJobSkillOption(params: {
  job_type: JobSkillCategory;
  option_type: JobSkillOptionType;
  value: string;
}): Promise<JobSkillOptionItem> {
  const response = await apiClient.post<JobSkillOptionItem>('/job-skill-options', params);
  return response.data;
}
