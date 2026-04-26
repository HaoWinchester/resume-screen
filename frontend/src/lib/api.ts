import axios, { AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
const AUTH_STORAGE_KEY = 'auth-storage';

const clearStoredAuth = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('user');
  localStorage.removeItem(AUTH_STORAGE_KEY);
};

const isAuthRequest = (url?: string) => {
  if (!url) return false;
  return url.includes('/auth/login') || url.includes('/auth/register') || url.includes('/auth/reset-password');
};

// API 响应错误类型
export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Array<{
      field: string;
      message: string;
    }>;
  };
}

// 创建 axios 实例
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// 请求拦截器 - 添加 JWT Token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // 从 localStorage 获取 token
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('access_token');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器 - 处理 401 错误
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error: AxiosError<ApiError>) => {
    // 处理 401 未授权错误
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        if (!isAuthRequest(error.config?.url)) {
          clearStoredAuth();

          if (window.location.pathname !== '/login') {
            window.location.replace('/login');
          }
        }
      }
    }

    // 返回统一的错误格式
    return Promise.reject(error);
  }
);

// 辅助函数：提取错误消息
export const getErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error) && error.response?.data) {
    const apiError = error.response.data as ApiError;
    if (apiError.error?.details && apiError.error.details.length > 0) {
      return apiError.error.details.map(d => d.message).join(', ');
    }
    return apiError.error?.message || '请求失败';
  }
  if (error instanceof Error) {
    return error.message;
  }
  return '发生未知错误';
};

export default apiClient;
