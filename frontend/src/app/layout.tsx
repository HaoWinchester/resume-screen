import './globals.css';

import { AntdStyleRegistry } from '@/components/antd-style-registry';
import { AppProviders } from '@/components/app-providers';

export const metadata = {
  title: 'HR 简历智能筛查系统',
  description: 'AI驱动的简历筛查与候选人推荐平台',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <AntdStyleRegistry>
          <AppProviders>{children}</AppProviders>
        </AntdStyleRegistry>
      </body>
    </html>
  );
}
