import apiClient from '../api';
import type {
  Company,
  MemberListResponse,
  InviteMemberRequest,
  UpdateCompanyRequest,
  UpdateRoleRequest,
  TeamMember,
} from '@/types/team';

/**
 * 获取公司信息
 */
export async function fetchCompanyInfo(): Promise<Company> {
  const response = await apiClient.get<Company>('/companies/me');
  return response.data;
}

export async function updateCompanyInfo(data: UpdateCompanyRequest): Promise<Company> {
  const response = await apiClient.patch<Company>('/companies/me', data);
  return response.data;
}

/**
 * 获取公司成员列表
 */
export async function fetchMembers(): Promise<MemberListResponse> {
  const response = await apiClient.get<MemberListResponse>('/companies/me/members');
  return response.data;
}

/**
 * 邀请成员
 */
export async function inviteMember(data: InviteMemberRequest): Promise<TeamMember> {
  const response = await apiClient.post<TeamMember>('/companies/me/invite', data);
  return response.data;
}

/**
 * 更新成员角色
 */
export async function updateMemberRole(
  userId: string,
  data: UpdateRoleRequest
): Promise<TeamMember> {
  const response = await apiClient.patch<TeamMember>(
    `/companies/me/members/${userId}`,
    data
  );
  return response.data;
}
