'use client';

import { useEffect } from 'react';
import { Avatar, Button, Dropdown, Input, Spin, message } from 'antd';
import { LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/auth';
import Link from 'next/link';
import { HrAiGuide } from '@/components/hr-ai-guide';

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
    { key: '/dashboard', href: '/dashboard', icon: 'dashboard', label: '控制面板', section: '总览' },
    { key: '/dashboard/workbench', href: '/dashboard/workbench', icon: 'view_kanban', label: '招聘工作台', section: '总览' },
    {
      key: '/dashboard/resume-center',
      href: '/dashboard/resumes/upload',
      icon: 'cloud_upload',
      label: '简历与渠道',
      section: '获客',
      children: [
        { key: '/dashboard/resumes/upload', href: '/dashboard/resumes/upload', icon: 'cloud_upload', label: '简历上传' },
        { key: '/dashboard/resumes', href: '/dashboard/resumes', icon: 'folder_shared', label: '简历库' },
        { key: '/dashboard/channels', href: '/dashboard/channels/import', icon: 'hub', label: '渠道导入' },
      ],
    },
    { key: '/dashboard/jobs', href: '/dashboard/jobs', icon: 'pageview', label: '搜索筛选', section: '获客' },
    {
      key: '/dashboard/analysis',
      href: '/dashboard/analysis',
      icon: 'groups',
      label: '候选人筛选',
      section: '筛选',
      children: [
        { key: '/dashboard/analysis', href: '/dashboard/analysis', icon: 'groups', label: '候选人结果' },
      ],
    },
    { key: '/dashboard/shortlist', href: '/dashboard/shortlist', icon: 'connect_without_contact', label: '优先沟通', section: '筛选' },
    {
      key: '/dashboard/pipeline',
      href: '/dashboard/pipeline',
      icon: 'conversion_path',
      label: '招聘跟进',
      section: '闭环',
      children: [
        { key: '/dashboard/pipeline', href: '/dashboard/pipeline', icon: 'conversion_path', label: '招聘漏斗' },
        { key: '/dashboard/communications', href: '/dashboard/communications', icon: 'forum', label: '沟通记录' },
        { key: '/dashboard/interviews', href: '/dashboard/interviews', icon: 'event_available', label: '待面试' },
        { key: '/dashboard/interview-feedback', href: '/dashboard/interview-feedback', icon: 'rate_review', label: '面试评价' },
        { key: '/dashboard/reminders', href: '/dashboard/reminders', icon: 'notification_important', label: '自动提醒' },
        { key: '/dashboard/calendar', href: '/dashboard/calendar', icon: 'calendar_month', label: '日历排期' },
        { key: '/dashboard/email-templates', href: '/dashboard/email-templates', icon: 'mail', label: '邮件模板' },
        { key: '/dashboard/audit', href: '/dashboard/audit', icon: 'admin_panel_settings', label: '权限审计' },
      ],
    },
    { key: '/dashboard/talent-pool', href: '/dashboard/talent-pool', icon: 'database', label: '人才库', section: '沉淀' },
    { key: '/dashboard/jd-optimizer', href: '/dashboard/jd-optimizer', icon: 'auto_fix_high', label: 'JD 优化', section: '沉淀' },
    { key: '/dashboard/settings', href: '/dashboard/settings', icon: 'settings', label: '基础信息', section: '系统' },
  ];
  const flatMenuItems = menuItems.flatMap((item) => [item, ...(item.children || [])]);
  const sortedFlatMenuItems = [...flatMenuItems].sort((a, b) => b.key.length - a.key.length);

  const activeKey = pathname?.startsWith('/dashboard/reports')
    ? '/dashboard/talent-pool'
    : sortedFlatMenuItems.find((item) => {
      if (item.key === '/dashboard') return pathname === '/dashboard';
      return pathname?.startsWith(item.key);
    })?.key || '/dashboard';
  const activeParentKey = menuItems.find((item) => {
    if (activeKey === item.key) return true;
    return item.children?.some((child) => child.key === activeKey);
  })?.key || activeKey;

  const isUpload = pathname?.startsWith('/dashboard/resumes');
  const activeMenuItem = pathname?.startsWith('/dashboard/reports')
    ? { key: '/dashboard/reports', href: '/dashboard/talent-pool', icon: 'article', label: '候选人报告' }
    : flatMenuItems.find((item) => item.key === activeKey) || menuItems[0];

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

  const sideBrand = (
    <Link href="/dashboard" className="mb-8 mt-2 flex h-12 shrink-0 items-center gap-3 px-2">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1e40af] text-white shadow-sm">
        <MaterialIcon name="analytics" fill />
      </span>
      <span className="min-w-0">
        <span className="block text-lg font-black leading-none text-blue-900">HR Talent</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">招聘套件</span>
      </span>
    </Link>
  );

  const sideNav = (
    <div className="flex h-full min-h-0 flex-col">
      {sideBrand}
      <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        {Array.from(new Set(menuItems.map((item) => item.section))).map((section) => (
          <div key={section} className="space-y-1">
            <div className="px-3 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{section}</div>
            {menuItems
              .filter((item) => item.section === section)
              .map((item) => {
                const isActive = activeParentKey === item.key;
                const isExpanded = isActive && item.children?.length;
                return (
                  <div key={item.key}>
                    <Link
                      href={item.href}
                      className={[
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                        isActive
                          ? 'bg-blue-50 text-[#00288e]'
                          : 'text-slate-600 hover:translate-x-1 hover:bg-slate-100 hover:text-[#00288e]',
                      ].join(' ')}
                    >
                      <MaterialIcon name={item.icon} className="text-[24px]" fill={isActive} />
                      <span className="flex-1">{item.label}</span>
                      {item.children?.length ? (
                        <MaterialIcon
                          name={isExpanded ? 'expand_less' : 'expand_more'}
                          className="text-[18px] text-slate-400"
                        />
                      ) : null}
                    </Link>
                    {isExpanded ? (
                      <div className="mt-1 space-y-1 rounded-xl bg-white/70 p-2 shadow-inner shadow-slate-200/60">
                        {item.children?.map((child) => {
                          const isChildActive = activeKey === child.key;
                          return (
                            <Link
                              key={child.key}
                              href={child.href}
                              className={[
                                'flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold transition-all',
                                isChildActive
                                  ? 'bg-[#00288e] text-white shadow-sm'
                                  : 'text-slate-500 hover:bg-blue-50 hover:text-[#00288e]',
                              ].join(' ')}
                            >
                              <MaterialIcon name={child.icon} className="text-[17px]" fill={isChildActive} />
                              <span className="truncate">{child.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
          </div>
        ))}
      </nav>
      <div className="mt-4 shrink-0 space-y-1 border-t border-slate-200 pt-4">
        <Button
          type="text"
          icon={<MaterialIcon name="contact_support" />}
          className="flex h-11 w-full items-center justify-start rounded-lg px-3 text-slate-600 hover:bg-slate-100"
          onClick={() => message.info('技术支持已收到您的请求，我们会尽快协助。')}
        >
          技术支持
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
    </div>
  );

  const headerActions = (
    <div className="flex items-center gap-4">
      <div className="relative hidden lg:block">
        <Input
          className="h-10 w-64 rounded-lg bg-slate-100"
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
        <Button type="text" shape="circle" icon={<MaterialIcon name="settings" fill />} onClick={() => router.push('/dashboard/settings')} />
      </div>
      <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
        <Avatar className="cursor-pointer bg-slate-800" icon={<UserOutlined />} />
      </Dropdown>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fbf8ff] font-['Inter'] text-[#1a1b22]">
      <aside className="fixed left-0 top-0 z-50 hidden h-screen w-64 flex-col overflow-hidden border-r border-slate-200 bg-slate-50 p-4 lg:flex">
        {sideNav}
      </aside>
      <div className="min-h-screen lg:ml-64">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 shadow-sm">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/dashboard" className="text-xl font-bold tracking-tight text-blue-800">
              TalentScreen
            </Link>
            <span className="hidden h-6 w-px bg-slate-200 md:block" />
            <div className="hidden items-center gap-2 md:flex">
              <MaterialIcon name={activeMenuItem.icon} className="text-[22px] text-[#00288e]" fill />
              <h2 className="text-lg font-bold text-[#1a1b22]">{activeMenuItem.label}</h2>
            </div>
          </div>
          {headerActions}
        </header>
        <main className={isUpload ? 'mx-auto max-w-6xl p-6 lg:p-10' : 'mx-auto max-w-[1440px] p-6 lg:p-10'}>
          {children}
        </main>
        <HrAiGuide />
      </div>
    </div>
  );
}
