'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Dropdown, Spin, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useRouter } from 'next/navigation';
import { exportAnalysis, fetchAnalysisList, fetchRecentActivity, fetchResumeProgress } from '@/lib/api/analysis';
import { fetchJobRequirements } from '@/lib/api/job';
import type { AnalysisStatistics, RecentActivityItem, ResumeProgressResponse } from '@/types/analysis';
import type { JobRequirementListItem, JobStatus } from '@/types/job';

function MaterialIcon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

function statusTag(status: JobStatus) {
  const config = {
    draft: { label: '草稿', className: 'bg-slate-100 text-slate-600' },
    active: { label: '招聘中', className: 'bg-emerald-100 text-emerald-700' },
    closed: { label: '已关闭', className: 'bg-blue-100 text-blue-700' },
  };

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${config[status].className}`}>{config[status].label}</span>;
}

export default function DashboardPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobRequirementListItem[]>([]);
  const [statistics, setStatistics] = useState<AnalysisStatistics | null>(null);
  const [resumeProgress, setResumeProgress] = useState<ResumeProgressResponse | null>(null);
  const [recentActivities, setRecentActivities] = useState<RecentActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    void loadDashboard();
  }, []);

  const activeJobs = useMemo(() => jobs.filter((job) => job.status === 'active'), [jobs]);
  const selectedJob = activeJobs[0] || jobs[0];
  const totalResumes = jobs.reduce((sum, job) => sum + job.resume_count, 0);
  const totalAnalyzed = jobs.reduce((sum, job) => sum + job.analyzed_count, 0);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const response = await fetchJobRequirements({ per_page: 100 });
      const [progress, activities] = await Promise.all([fetchResumeProgress(7), fetchRecentActivity(4)]);
      setJobs(response.items);
      setResumeProgress(progress);
      setRecentActivities(activities.items);

      const firstActiveJob = response.items.find((job) => job.status === 'active') || response.items[0];
      if (firstActiveJob) {
        const analysis = await fetchAnalysisList({
          job_requirement_id: firstActiveJob.id,
          page: 1,
          per_page: 10,
          sort_by: 'overall_score',
          sort_order: 'desc',
        });
        setStatistics(analysis.statistics);
      }
    } catch {
      message.error('加载控制面板数据失败');
    } finally {
      setLoading(false);
    }
  };

  const progressDays = resumeProgress?.days || [];
  const maxUploaded = Math.max(...progressDays.map((day) => day.uploaded), 1);
  const hasProgress = progressDays.some((day) => day.uploaded > 0);

  const handleExport = async () => {
    if (!selectedJob) {
      message.warning('请先创建一个岗位');
      return;
    }

    setExporting(true);
    try {
      const blob = await exportAnalysis({ job_requirement_id: selectedJob.id, format: 'xlsx' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `TalentScreen_${selectedJob.title}_report.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      message.success('报告已导出');
    } catch {
      message.error('导出报告失败');
    } finally {
      setExporting(false);
    }
  };

  const columns: ColumnsType<JobRequirementListItem> = [
    {
      title: '职位名称',
      dataIndex: 'title',
      key: 'title',
      render: (title, record) => (
        <button type="button" className="border-0 bg-transparent p-0 text-left" onClick={() => router.push(`/dashboard/jobs?job=${record.id}`)}>
          <span className="block font-semibold text-[#1a1b22]">{title}</span>
          <span className="text-xs text-slate-500">工程部 · 远程</span>
        </button>
      ),
    },
    {
      title: '申请人数',
      dataIndex: 'resume_count',
      key: 'resume_count',
      width: 140,
      render: (count) => <span className="font-semibold">{count}</span>,
    },
    {
      title: '最佳匹配',
      key: 'best_match',
      width: 180,
      render: (_, record) => (
        <div className="flex items-center gap-1">
          <span className="h-7 w-7 rounded-full border-2 border-white bg-slate-800" />
          <span className="-ml-2 h-7 w-7 rounded-full border-2 border-white bg-emerald-500" />
          <span className="-ml-2 rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500">
            +{Math.max(record.analyzed_count, 1)}
          </span>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (status: JobStatus) => statusTag(status),
    },
    {
      title: '操作',
      key: 'actions',
      width: 90,
      render: (_, record) => (
        <Dropdown
          menu={{
            items: [
              { key: 'filter', label: '设置筛选', onClick: () => router.push(`/dashboard/jobs?job=${record.id}`) },
              { key: 'upload', label: '上传简历', onClick: () => router.push('/dashboard/resumes/upload') },
              { key: 'result', label: '查看候选人', onClick: () => router.push('/dashboard/analysis') },
            ],
          }}
          trigger={['click']}
        >
          <Button type="text" icon={<MaterialIcon name="more_vert" className="text-xl" />} />
        </Dropdown>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <h1 className="text-[32px] font-bold leading-tight tracking-tight text-[#1a1b22]">招聘控制面板</h1>
          <p className="mt-2 text-base text-slate-600">欢迎回来。这是您今天的招聘进度概览。</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button icon={<MaterialIcon name="download" className="text-xl" />} loading={exporting} onClick={handleExport} className="h-12 rounded-lg bg-[#e3e1eb] px-5 font-semibold">
            导出报告
          </Button>
          <Button type="primary" icon={<MaterialIcon name="add" className="text-xl" />} onClick={() => router.push('/dashboard/jobs/new')} className="h-12 rounded-lg bg-[#00288e] px-5 font-semibold">
            发布新职位
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">简历总数</p>
              <p className="mt-2 text-4xl font-black text-blue-900">{totalResumes.toLocaleString()}</p>
              <p className="mt-4 flex items-center gap-1 text-sm font-semibold text-emerald-700">
                <MaterialIcon name="trending_up" className="text-base" />
                较上批新增 {Math.max(totalResumes - totalAnalyzed, 0)} 份
              </p>
            </div>
            <span className="rounded-xl bg-blue-50 p-4 text-blue-700"><MaterialIcon name="description" className="text-3xl" /></span>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">已筛选候选人</p>
              <p className="mt-2 text-4xl font-black text-blue-900">{(statistics?.analyzed || totalAnalyzed).toLocaleString()}</p>
              <p className="mt-4 flex items-center gap-1 text-sm font-semibold text-emerald-700">
                <MaterialIcon name="check_circle" className="text-base" />
                {statistics?.average_score?.toFixed(1) || '0.0'} 平均分
              </p>
            </div>
            <span className="rounded-xl bg-emerald-300 p-4 text-emerald-900"><MaterialIcon name="filter_list" className="text-3xl" /></span>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">开放职位</p>
              <p className="mt-2 text-4xl font-black text-blue-900">{activeJobs.length}</p>
              <p className="mt-4 flex items-center gap-1 text-sm font-semibold text-slate-600">
                <MaterialIcon name="schedule" className="text-base" />
                平均 {Math.max(Math.round(totalResumes / Math.max(activeJobs.length, 1)), 0)} 份/岗
              </p>
            </div>
            <span className="rounded-xl bg-orange-100 p-4 text-orange-900"><MaterialIcon name="work" className="text-3xl" /></span>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-black text-blue-900">简历解析进度</h2>
              <span className="flex items-center gap-2 text-sm text-slate-500"><span className="h-3 w-3 rounded-full bg-[#00288e]" />真实上传数</span>
            </div>
            <div className="grid min-h-72 grid-cols-7 items-end gap-3 border-b border-slate-100 px-4 pb-8">
              {(progressDays.length ? progressDays : Array.from({ length: 7 }, (_, index) => ({ date: `${index}`, label: `第${index + 1}天`, uploaded: 0, parsed: 0, failed: 0, processing: 0 }))).map((day) => {
                const height = day.uploaded > 0 ? Math.max(14, Math.round((day.uploaded / maxUploaded) * 88)) : 6;
                return (
                  <div key={day.date} className="group flex h-56 flex-col justify-end gap-3">
                    <div className="relative flex flex-col justify-end rounded-t-xl bg-slate-100" style={{ height: `${height}%` }}>
                      <div className="rounded-t-xl bg-gradient-to-t from-[#00288e] to-[#6cf8bb]" style={{ height: `${day.uploaded ? Math.max(8, (day.parsed / day.uploaded) * 100) : 0}%` }} />
                      {day.failed > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />}
                      <span className="absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-bold text-white group-hover:block">
                        上传 {day.uploaded} · 成功 {day.parsed}
                      </span>
                    </div>
                    <span className="text-center text-xs font-semibold text-slate-400">{day.label}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
              <span>
                最近 7 天上传 {resumeProgress?.total_uploaded || 0} 份，解析成功 {resumeProgress?.total_parsed || 0} 份
                {(resumeProgress?.total_processing || 0) > 0 ? `，处理中 ${resumeProgress?.total_processing} 份` : ''}
                {(resumeProgress?.total_failed || 0) > 0 ? `，失败 ${resumeProgress?.total_failed} 份` : ''}
              </span>
              {!hasProgress && <span className="font-semibold text-slate-400">暂无解析记录</span>}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <button
              className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-10 text-center shadow-sm transition hover:border-[#00288e] hover:bg-blue-50/30"
              onClick={() => router.push('/dashboard/resumes/upload')}
            >
              <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-blue-50 text-[#00288e]"><MaterialIcon name="cloud_upload" className="text-5xl" /></span>
              <span className="mt-5 block text-2xl font-black text-[#00288e]">上传简历</span>
              <span className="mt-2 block text-slate-600">拖拽 PDF 或 DOCX 文件开始批量处理。</span>
            </button>
            <button
              className="rounded-xl border border-slate-200 bg-white p-8 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              onClick={() => router.push('/dashboard/jobs')}
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-emerald-300 text-emerald-900"><MaterialIcon name="tune" className="text-4xl" /></span>
              <span className="mt-8 flex items-center justify-between text-2xl font-black text-[#00288e]">
                设置筛选条件
                <MaterialIcon name="arrow_forward" className="text-2xl text-slate-300" />
              </span>
              <span className="mt-2 block text-slate-700">定义技能、经验和教育程度的匹配标准。</span>
              <span className="mt-5 inline-flex gap-2">
                <Tag>PYTHON</Tag>
                <Tag>5年以上经验</Tag>
                <Tag>硕士</Tag>
              </span>
            </button>
          </div>
        </div>

        <aside className="flex h-full flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-6">
            <h2 className="text-lg font-semibold text-blue-900">最近活动</h2>
          </div>
          <div className="flex-grow space-y-6 p-6">
            {recentActivities.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                暂无真实活动记录
              </div>
            ) : (
              recentActivities.map((activity, index) => (
                <Activity
                  key={activity.id}
                  icon={<MaterialIcon name={activity.icon} className="text-sm" />}
                  tone={activity.tone}
                  title={activity.title}
                  text={activity.description}
                  time={formatRelativeTime(activity.occurred_at)}
                  isLast={index === recentActivities.length - 1}
                />
              ))
            )}
          </div>
          <button className="w-full rounded-b-xl border-t border-slate-100 bg-slate-50 p-4 text-center text-xs font-semibold text-[#00288e] hover:underline" onClick={() => router.push('/dashboard/analysis')}>
            查看完整活动日志
          </button>
        </aside>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between p-6">
          <h2 className="text-2xl font-black text-blue-900">活跃职位管道</h2>
          <Button type="link" onClick={() => router.push('/dashboard/jobs')}>查看所有管道</Button>
        </div>
        <Table columns={columns} dataSource={jobs.slice(0, 5)} rowKey="id" pagination={false} scroll={{ x: 760 }} />
      </section>
    </div>
  );
}

function formatRelativeTime(value: string) {
  const occurredAt = new Date(value).getTime();
  if (Number.isNaN(occurredAt)) return '';

  const diffSeconds = Math.max(0, Math.floor((Date.now() - occurredAt) / 1000));
  if (diffSeconds < 60) return '刚刚';

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} 小时前`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} 天前`;

  return new Date(value).toLocaleDateString('zh-CN');
}

function Activity({
  icon,
  tone,
  title,
  text,
  time,
  isLast = false,
}: {
  icon: React.ReactNode;
  tone: 'blue' | 'green' | 'amber';
  title: string;
  text: string;
  time: string;
  isLast?: boolean;
}) {
  const tones = {
    blue: 'bg-blue-50 text-[#00288e]',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
  };

  return (
    <div className="relative flex gap-4">
      {!isLast && <span className="absolute left-4 top-8 h-full w-px bg-slate-200" />}
      <span className={`z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tones[tone]}`}>{icon}</span>
      <div className="flex-grow">
        <p className="text-sm font-semibold text-[#1a1b22]">{title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{text}</p>
        <span className="mt-2 block text-[10px] font-medium text-slate-400">{time}</span>
      </div>
    </div>
  );
}
