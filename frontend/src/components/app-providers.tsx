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

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#2563eb',
          colorInfo: '#2563eb',
          colorBgLayout: '#f5f7fb',
          colorText: '#111827',
          colorTextSecondary: '#64748b',
          colorBorder: '#dbe3ef',
          borderRadius: 8,
          fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", sans-serif',
          controlHeight: 36,
        },
        components: {
          Button: {
            borderRadius: 8,
            fontWeight: 700,
            controlHeight: 36,
          },
          Card: {
            borderRadiusLG: 10,
            paddingLG: 20,
          },
          Table: {
            headerBg: '#f8fafc',
            headerColor: '#334155',
            rowHoverBg: '#f8fbff',
          },
          Tag: {
            borderRadiusSM: 6,
          },
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}
