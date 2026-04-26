'use client';

import { useEffect } from 'react';
import { Avatar, Button, Dropdown, Input, Spin, message } from 'antd';
import { LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/auth';
import Link from 'next/link';

function MaterialIcon({
  name,
  className = '',
  fill = false,
}: {
  name: string;
  className?: string;
  fill?: boolean;
}) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={{ fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24` }}
    >
      {name}
    </span>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, isAuthenticated, hasHydrated } = useAuthStore();

  useEffect(() => {
    if (hasHydrated && !isAuthenticated) {
      router.replace('/login');
    }
  }, [hasHydrated, isAuthenticated, router]);

  const menuItems = [
    { key: '/dashboard', href: '/dashboard', icon: 'dashboard', label: '控制面板' },
    { key: '/dashboard/resumes/upload', href: '/dashboard/resumes/upload', icon: 'cloud_upload', label: '简历上传' },
    { key: '/dashboard/jobs', href: '/dashboard/jobs', icon: 'pageview', label: '搜索筛选' },
    { key: '/dashboard/analysis', href: '/dashboard/analysis', icon: 'groups', label: '候选人结果' },
  ];

  const activeKey =
    menuItems.find((item) => {
      if (item.key === '/dashboard') return pathname === '/dashboard';
      return pathname?.startsWith(item.key);
    })?.key || '/dashboard';

  const isUpload = pathname?.startsWith('/dashboard/resumes');
  const isTopShell = pathname?.startsWith('/dashboard/jobs') || pathname?.startsWith('/dashboard/analysis');

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const userMenuItems = [
    { key: 'profile', icon: <UserOutlined />, label: user?.name || '个人信息' },
    { type: 'divider' as const },
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: handleLogout },
  ];

  if (!hasHydrated || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fbf8ff]">
        <Spin size="large" />
      </div>
    );
  }

  const sideBrand = isTopShell ? (
    <div className="mb-6 px-2 py-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#00288e] text-white">
          <MaterialIcon name={pathname?.startsWith('/dashboard/jobs') ? 'rocket_launch' : 'analytics'} fill />
        </div>
        <div>
          <div className="text-lg font-black leading-tight text-blue-900">
            {pathname?.startsWith('/dashboard/jobs') ? 'HR 极速招聘' : 'HR 智能人才'}
          </div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
            {pathname?.startsWith('/dashboard/jobs') ? '招聘管理套件' : '招聘管理系统'}
          </div>
        </div>
      </div>
    </div>
  ) : (
    <Link href="/dashboard" className="mb-8 mt-2 flex items-center gap-3 px-2">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1e40af] text-white shadow-sm">
        <MaterialIcon name="analytics" fill />
      </span>
      <span>
        <span className="block text-lg font-black leading-none text-blue-900">HR Talent</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">招聘套件</span>
      </span>
    </Link>
  );

  const sideNav = (
    <>
      {sideBrand}
      <nav className="flex-1 space-y-1">
        {menuItems.map((item) => {
          const isActive = activeKey === item.key;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={[
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                isActive
                  ? 'bg-blue-50 text-[#00288e]'
                  : 'text-slate-600 hover:translate-x-1 hover:bg-slate-100 hover:text-[#00288e]',
              ].join(' ')}
            >
              <MaterialIcon name={item.icon} className="text-[24px]" fill={isActive} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="space-y-1 border-t border-slate-200 pt-4">
        <Button
          type="text"
          icon={<MaterialIcon name="contact_support" />}
          className="flex h-11 w-full items-center justify-start rounded-lg px-3 text-slate-600 hover:bg-slate-100"
          onClick={() => message.info('技术支持已收到您的请求，我们会尽快协助。')}
        >
          {isUpload ? '帮助中心' : isTopShell ? '帮助支持' : '技术支持'}
        </Button>
        <Button
          type="text"
          danger
          icon={<MaterialIcon name="logout" />}
          className="flex h-11 w-full items-center justify-start rounded-lg px-3"
          onClick={handleLogout}
        >
          退出登录
        </Button>
      </div>
    </>
  );

  const headerActions = (
    <div className="flex items-center gap-4">
      <div className="relative hidden lg:block">
        <Input
          className={isTopShell ? 'h-10 w-64 rounded-lg bg-[#f4f2fc]' : isUpload ? 'h-10 w-64 rounded-lg' : 'h-11 w-80 rounded-full border-0 bg-slate-100'}
          prefix={<MaterialIcon name="search" className="text-slate-400" />}
          placeholder={isUpload ? '搜索文件...' : '搜索候选人...'}
          onPressEnter={(event) => {
            const keyword = event.currentTarget.value.trim();
            if (keyword) router.push(`/dashboard/analysis?keyword=${encodeURIComponent(keyword)}`);
          }}
        />
      </div>
      <div className="flex gap-2 text-slate-600">
        <Button type="text" shape="circle" icon={<MaterialIcon name="notifications" />} />
        <Button type="text" shape="circle" icon={<MaterialIcon name="help" />} />
        <Button type="text" shape="circle" icon={<MaterialIcon name="settings" fill />} />
      </div>
      <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
        <Avatar className="cursor-pointer bg-slate-800" icon={<UserOutlined />} />
      </Dropdown>
    </div>
  );

  if (isTopShell) {
    return (
      <div className="min-h-screen bg-[#fbf8ff] font-['Inter'] text-[#1a1b22]">
        <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-6 shadow-sm">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="text-xl font-bold tracking-tight text-blue-800">
              TalentScreen
            </Link>
            <div className="hidden items-center gap-6 md:flex">
              {menuItems.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  className={activeKey === item.key ? 'border-b-2 border-blue-800 py-5 font-semibold text-blue-800' : 'text-slate-600 transition-colors hover:text-blue-700'}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          {headerActions}
        </header>
        <div className="flex min-h-[calc(100vh-64px)]">
          <aside className="sticky top-16 hidden h-[calc(100vh-64px)] w-64 flex-col border-r border-slate-200 bg-slate-50 p-4 lg:flex">
            {sideNav}
          </aside>
          <main className="mx-auto w-full max-w-[1440px] flex-1 p-6 lg:p-10">{children}</main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fbf8ff] font-['Inter'] text-[#1a1b22]">
      <aside className="fixed left-0 top-0 z-50 hidden h-screen w-64 flex-col border-r border-slate-200 bg-slate-50 p-4 lg:flex">
        {sideNav}
      </aside>
      <div className="min-h-screen lg:ml-64">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 shadow-sm">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/dashboard" className="text-xl font-bold tracking-tight text-blue-800">
              TalentScreen
            </Link>
            {isUpload ? (
              <>
                <span className="hidden h-6 w-px bg-slate-200 md:block" />
                <h2 className="text-lg font-bold text-[#1a1b22]">简历上传</h2>
              </>
            ) : (
              <div className="hidden items-center gap-6 pl-6 md:flex">
                <Link href="/dashboard" className="border-b-2 border-blue-800 py-5 font-semibold text-blue-800">
                  概览
                </Link>
                <button
                  type="button"
                  className="border-0 bg-transparent py-5 text-slate-600 hover:text-blue-800"
                  onClick={() => message.info('招聘漏斗会基于已上传简历与分析状态自动汇总。')}
                >
                  招聘漏斗
                </button>
                <Link href="/dashboard/analysis" className="py-5 text-slate-600 hover:text-blue-800">
                  数据分析
                </Link>
              </div>
            )}
          </div>
          {headerActions}
        </header>
        <main className={isUpload ? 'mx-auto max-w-6xl p-6 lg:p-10' : 'mx-auto max-w-[1440px] p-6 lg:p-10'}>
          {children}
        </main>
      </div>
    </div>
  );
}
