// 权重级别
export type WeightLevel = 'high' | 'medium' | 'low';

// 岗位状态
export type JobStatus = 'draft' | 'active' | 'closed';

// 学历要求
export type EducationLevel = 'high_school' | 'vocational' | 'associate' | 'bachelor' | 'master' | 'doctor' | '';

// 权重配置
export interface WeightConfig {
  skill_match: WeightLevel;
  experience_match: WeightLevel;
  education: WeightLevel;
  project_relevance: WeightLevel;
  overall_quality: WeightLevel;
}

// 岗位筛选条件
export interface Criteria {
  required_skills: string[];
  bonus_skills: string[];
  min_experience_years: number;
  education: EducationLevel | null;
  industry_preference: string[];
  languages: string[];
  weights: WeightConfig;
  other_requirements: string;
}

// 岗位需求
export interface JobRequirement {
  id: string;
  title: string;
  description: string | null;
  status: JobStatus;
  created_by: string;
  template_id: string | null;
  criteria: Criteria;
  resume_count: number;
  analyzed_count: number;
  created_at: string;
  updated_at: string;
}

// 岗位列表项
export interface JobRequirementListItem {
  id: string;
  title: string;
  status: JobStatus;
  created_at: string;
  resume_count: number;
  analyzed_count: number;
}

// 创建岗位请求
export interface CreateJobRequirementRequest {
  title: string;
  description?: string;
  template_id?: string | null;
  criteria: Criteria;
}

// 更新岗位请求
export interface UpdateJobRequirementRequest {
  title?: string;
  description?: string;
  criteria?: Partial<Criteria>;
}

// 岗位列表响应
export interface JobRequirementListResponse {
  items: JobRequirementListItem[];
  total: number;
  page: number;
  per_page: number;
}

// 岗位模板
export interface JobTemplate {
  id: string;
  name: string;
  content: Criteria;
  created_at: string;
  updated_at: string;
}

// 创建模板请求
export interface CreateJobTemplateRequest {
  name: string;
  content: Criteria;
}

// 更新模板请求
export interface UpdateJobTemplateRequest {
  name?: string;
  content?: Partial<Criteria>;
}

// 模板列表响应
export interface JobTemplateListResponse {
  items: JobTemplate[];
}
