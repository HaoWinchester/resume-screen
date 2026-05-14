'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, Empty, Progress, Spin, Tag } from 'antd';
import { useRouter } from 'next/navigation';
import { fetchRecruitmentOverview } from '@/lib/api/recruitment';
import type { RecruitmentOverview } from '@/types/recruitment';

function MaterialIcon({ name, className = '', fill = false }: { name: string; className?: string; fill?: boolean }) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={{ fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24` }}
    >
      {name}
    </span>
  );
}

export default function RecruitmentWorkbenchPage() {
  const router = useRouter();
  const [overview, setOverview] = useState<RecruitmentOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        setOverview(await fetchRecruitmentOverview());
      } catch {
        setError('招聘工作台数据加载失败，请确认后端服务已启动。');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return <Alert type="error" showIcon message={error} />;
  }

  if (!overview) {
    return <Empty description="暂无招聘工作台数据" />;
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] bg-[#071a44] text-white shadow-sm">
        <div className="grid gap-8 p-8 lg:grid-cols-[1.5fr_0.8fr] lg:p-10">
          <div>
            <Tag className="mb-5 border-0 bg-white/10 px-3 py-1 font-bold text-blue-50">招聘决策工作台</Tag>
            <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-tight">
              从简历筛选，升级到招聘流程决策
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-blue-100">
              这里汇总沟通流转、面试辅助、人才库、招聘漏斗、岗位画像、风险识别和候选人报告，让 HR 每天知道下一步该做什么。
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-6">
            <MaterialIcon name="monitoring" className="text-4xl text-blue-100" fill />
            <p className="mt-4 text-sm text-blue-100">最后更新</p>
            <p className="mt-1 text-xl font-black">{overview.updated_at ? new Date(overview.updated_at).toLocaleString() : '刚刚'}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-5">
        {overview.metrics.map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-slate-500">{metric.label}</p>
            <p className="mt-3 text-3xl font-black text-[#1a1b22]">{metric.value}</p>
            {metric.delta && <p className="mt-2 text-xs text-emerald-600">{metric.delta}</p>}
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-black">招聘漏斗</h2>
            <Button type="link" onClick={() => router.push('/dashboard/analysis')}>查看明细</Button>
          </div>
          <div className="space-y-5">
            {overview.funnel.map((stage) => (
              <div key={stage.key}>
                <div className="mb-2 flex justify-between text-sm">
                  <span className="font-bold text-slate-700">{stage.label}</span>
                  <span className="font-black text-[#00288e]">{stage.count} 人</span>
                </div>
                <Progress percent={stage.conversion ?? 0} strokeColor="#00288e" />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black">招聘流程看板</h2>
          <div className="mt-5 space-y-4">
            {overview.pipeline.map((column) => (
              <div key={column.key} className="rounded-xl bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-black">{column.title}</p>
                    <p className="text-xs text-slate-500">{column.description}</p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-black text-[#00288e]">{column.count}</span>
                </div>
                {column.candidateNames.length > 0 && (
                  <p className="mt-3 text-sm text-slate-600">{column.candidateNames.join('、')}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        {overview.entries.map((entry) => (
          <button
            key={entry.title}
            type="button"
            className="group rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-md"
            onClick={() => router.push(entry.href)}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-[#00288e]">
              <MaterialIcon name={entry.icon} className="text-3xl" fill />
            </span>
            <Tag className="mt-5 border-0 bg-slate-100 font-bold text-slate-600">{entry.tag}</Tag>
            <h3 className="mt-3 text-xl font-black text-[#1a1b22]">{entry.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{entry.description}</p>
          </button>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black">岗位画像优化</h2>
          <div className="mt-4 space-y-4">
            {overview.jobProfileSuggestions.map((item) => (
              <div key={item.title} className="rounded-xl bg-blue-50 p-4">
                <p className="font-black text-[#00288e]">{item.title}</p>
                <p className="mt-1 text-sm text-slate-600">{item.currentSignal}</p>
                <p className="mt-2 text-sm font-semibold text-slate-800">{item.suggestion}</p>
                <p className="mt-1 text-xs text-blue-700">{item.impact}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black">风险识别与面试辅助</h2>
          <div className="mt-4 space-y-4">
            {overview.riskInsights.map((risk) => (
              <div key={risk.title} className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                <p className="font-black text-amber-800">{risk.title}</p>
                <p className="mt-2 text-sm leading-6 text-amber-900">{risk.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
