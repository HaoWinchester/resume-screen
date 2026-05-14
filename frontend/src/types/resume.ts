// 简历解析状态
export type ParseStatus = 'pending' | 'parsing' | 'success' | 'failed';

// 文件类型
export type FileType = 'pdf' | 'doc' | 'docx' | 'jpg' | 'png';

// 教育经历
export interface Education {
  school: string | null;
  degree: string | null;
  major: string | null;
  start_date: string | null;
  end_date: string | null;
  description?: string | null;
}

// 工作经历
export interface WorkExperience {
  company: string | null;
  position: string | null;
  department?: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  responsibilities?: string[];
  achievements?: string[];
  technologies?: string[];
}

// 项目经历
export interface Project {
  name: string | null;
  role: string | null;
  start_date?: string | null;
  end_date?: string | null;
  description: string | null;
  responsibilities?: string[];
  achievements?: string[];
  technologies?: string[];
}

export interface Certificate {
  name: string | null;
  issuer: string | null;
  date: string | null;
}

export interface LanguageAbility {
  name: string | null;
  level: string | null;
}

// 解析后的简历数据
export interface ParsedData {
  name: string | null;
  gender: string | null;
  age: number | string | null;
  email: string | null;
  phone: string | null;
  current_title?: string | null;
  target_position?: string | null;
  location?: string | null;
  expected_salary?: string | null;
  availability?: string | null;
  years_of_experience?: number | string | null;
  summary?: string | null;
  education: Education[];
  work_experience: WorkExperience[];
  skills: string[];
  projects: Project[];
  certificates?: Certificate[];
  languages?: LanguageAbility[];
  awards?: string[];
  self_evaluation?: string | null;
  raw_text: string | null;
  text_extractor?: string | null;
  structured_by?: string | null;
  ai_parse_error?: string | null;
}

// 简历列表项
export interface ResumeListItem {
  id: string;
  job_requirement_id: string;
  job_title: string;
  file_name: string;
  parse_status: ParseStatus;
  candidate_name: string | null;
  candidate_email: string | null;
  candidate_phone: string | null;
  created_at: string;
  updated_at: string;
}

// 简历详情
export interface Resume {
  id: string;
  job_requirement_id: string;
  job_title: string;
  file_name: string;
  file_type: FileType;
  file_size: number;
  parse_status: ParseStatus;
  parse_error: string | null;
  parsed_data: ParsedData | null;
  candidate_name: string | null;
  candidate_email: string | null;
  candidate_phone: string | null;
  file_url: string;
  uploaded_by?: string;
  created_at: string;
  updated_at: string;
}

// 上传结果项
export interface UploadResultItem {
  id: string;
  file_name: string;
  parse_status: ParseStatus;
}

// 上传失败项
export interface UploadFailedItem {
  file_name: string;
  error: string;
}

// 上传响应
export interface ResumeUploadResponse {
  job_requirement_id: string;
  uploaded: UploadResultItem[];
  failed: UploadFailedItem[];
  total_uploaded: number;
  total_failed: number;
}

// 简历列表响应
export interface ResumeListResponse {
  items: ResumeListItem[];
  total: number;
  page: number;
  per_page: number;
}

// 任务状态
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

// 任务进度
export interface TaskProgress {
  total: number;
  completed: number;
  failed: number;
}

// 任务状态响应
export interface TaskStatusResponse {
  task_id: string;
  type: string;
  status: TaskStatus;
  progress: TaskProgress;
  created_at: string;
}
