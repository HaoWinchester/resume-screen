export type ChannelPlatform = 'boss_zhipin' | 'liepin' | 'lagou' | 'email' | 'other';

export type ChannelContentFormat = 'text' | 'html';

export interface ChannelCandidateImportItem {
  content: string;
  content_format: ChannelContentFormat;
  candidate_name?: string;
  source_url?: string;
  external_candidate_id?: string;
}

export interface ChannelCandidateImportRequest {
  job_requirement_id: string;
  source_platform: ChannelPlatform;
  consent_confirmed: boolean;
  candidates: ChannelCandidateImportItem[];
}

export interface ChannelImportResult {
  id: string;
  resume_id: string;
  candidate_name: string | null;
  source_platform: ChannelPlatform;
  parse_status: string;
  analysis_status: string;
}

export interface ChannelImportFailed {
  candidate_name: string | null;
  source_url: string | null;
  error: string;
}

export interface ChannelCandidateImportResponse {
  job_requirement_id: string;
  imported: ChannelImportResult[];
  failed: ChannelImportFailed[];
  total_imported: number;
  total_failed: number;
  imported_at: string;
}
