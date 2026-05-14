import apiClient from '../api';
import type {
  ChannelCandidateImportRequest,
  ChannelCandidateImportResponse,
} from '@/types/channels';

export async function importChannelCandidates(
  data: ChannelCandidateImportRequest
): Promise<ChannelCandidateImportResponse> {
  const response = await apiClient.post<ChannelCandidateImportResponse>(
    '/channels/candidates/import',
    data
  );
  return response.data;
}

export async function importChannelCandidatesFile(params: {
  jobRequirementId: string;
  sourcePlatform: string;
  consentConfirmed: boolean;
  file: File;
}): Promise<ChannelCandidateImportResponse> {
  const formData = new FormData();
  formData.append('job_requirement_id', params.jobRequirementId);
  formData.append('source_platform', params.sourcePlatform);
  formData.append('consent_confirmed', String(params.consentConfirmed));
  formData.append('file', params.file);

  const response = await apiClient.post<ChannelCandidateImportResponse>(
    '/channels/candidates/import-file',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data;
}
