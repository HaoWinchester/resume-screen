'use client';

import { useEffect } from 'react';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { useRouter, usePathname } from 'next/navigation';

import { useAuthStore } from '@/lib/auth';

export function AppProviders({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, hasHydrated, logout } = useAuthStore();

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    const publicRoutes = ['/login', '/register'];
    const isPublicRoute = publicRoutes.some((route) => pathname?.startsWith(route));
    const hasToken = typeof window !== 'undefined' && Boolean(window.localStorage.getItem('access_token'));

    if (!isPublicRoute && (!isAuthenticated || !hasToken)) {
      logout();
      router.replace('/login');
    }
  }, [hasHydrated, isAuthenticated, logout, pathname, router]);

  return <ConfigProvider locale={zhCN}>{children}</ConfigProvider>;
}
