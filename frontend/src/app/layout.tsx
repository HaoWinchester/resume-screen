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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AntdStyleRegistry>
          <AppProviders>{children}</AppProviders>
        </AntdStyleRegistry>
      </body>
    </html>
  );
}
