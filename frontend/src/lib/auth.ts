import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import apiClient, { getErrorMessage } from './api';

// 用户角色
export type UserRole = 'admin' | 'operator';

// 用户信息
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  company_id: string;
}

// 认证状态
export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  hasHydrated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, companyName: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
}

// 登录/注册响应
interface AuthResponse {
  user: User;
  access_token: string;
  token_type: string;
}

const clearStoredAuth = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('user');
  localStorage.removeItem('auth-storage');
};

// 创建 Auth Store
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      hasHydrated: false,
      isLoading: false,
      error: null,

      // 登录
      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiClient.post<AuthResponse>('/auth/login', {
            email,
            password,
          });

          const { user, access_token } = response.data;

          // 保存到 localStorage
          localStorage.setItem('access_token', access_token);

          set({
            user,
            token: access_token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          clearStoredAuth();
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: getErrorMessage(error),
          });
          throw error;
        }
      },

      // 注册
      register: async (email: string, password: string, name: string, companyName: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiClient.post<AuthResponse>('/auth/register', {
            email,
            password,
            name,
            company_name: companyName,
          });

          const { user, access_token } = response.data;

          // 保存到 localStorage
          localStorage.setItem('access_token', access_token);

          set({
            user,
            token: access_token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          clearStoredAuth();
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: getErrorMessage(error),
          });
          throw error;
        }
      },

      // 登出
      logout: () => {
        clearStoredAuth();
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          error: null,
        });
      },

      // 清除错误
      clearError: () => {
        set({ error: null });
      },

      // 设置用户（用于从 localStorage 恢复）
      setUser: (user: User | null) => {
        set({ user, isAuthenticated: !!user });
      },

      // 设置 Token
      setToken: (token: string | null) => {
        set({ token, isAuthenticated: !!token && !!get().user });
      },

      setHasHydrated: (hasHydrated: boolean) => {
        set({ hasHydrated });
      },
    }),
    {
      name: 'auth-storage',
      onRehydrateStorage: () => (state) => {
        if (typeof window !== 'undefined') {
          if (state?.token && state?.user) {
            localStorage.setItem('access_token', state.token);
          } else {
            clearStoredAuth();
            state?.setUser(null);
            state?.setToken(null);
          }
        }
        state?.setHasHydrated(true);
      },
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export default useAuthStore;
