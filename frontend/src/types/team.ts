// 用户角色
export type UserRole = 'admin' | 'operator';

// 公司信息
export interface Company {
  id: string;
  name: string;
  industry: string | null;
  created_at: string;
}

// 团队成员
export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

// 成员列表响应
export interface MemberListResponse {
  members: TeamMember[];
  total: number;
}

// 邀请成员请求
export interface InviteMemberRequest {
  email: string;
  name: string;
  role: UserRole;
}

// 更新角色请求
export interface UpdateRoleRequest {
  role: UserRole;
}
