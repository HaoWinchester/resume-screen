'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Empty, Input, Select, Spin, Tag, message } from 'antd';
import { getErrorMessage } from '@/lib/api';
import { fetchJobRequirements } from '@/lib/api/job';
import { optimizeHrJd } from '@/lib/api/hrExtensions';
import type { HrJdOptimizationResponse } from '@/types/hrExtensions';
import type { JobRequirementListItem } from '@/types/job';

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

export default function JdOptimizerPage() {
  const [jobs, setJobs] = useState<JobRequirementListItem[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [targetTone, setTargetTone] = useState('professional');
  const [focus, setFocus] = useState('');
  const [result, setResult] = useState<HrJdOptimizationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [error, setError] = useState('');

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetchJobRequirements({ per_page: 100 });
      setJobs(response.items);
      setSelectedJobId((prev) => prev || response.items[0]?.id || '');
    } catch (err) {
      setError(getErrorMessage(err) || '岗位列表加载失败，无法选择待优化 JD。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const handleOptimize = async () => {
    if (!selectedJobId) {
      message.warning('请先选择一个岗位');
      return;
    }

    setOptimizing(true);
    setResult(null);
    try {
      setResult(await optimizeHrJd({
        job_requirement_id: selectedJobId,
        target_tone: targetTone,
        focus: focus.trim() || undefined,
      }));
    } catch (err) {
      message.error(getErrorMessage(err) || 'JD 优化失败，请确认 /api/v1/hr/jd-optimizer 已就绪。');
    } finally {
      setOptimizing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  if (error) return <Alert type="error" showIcon message={error} />;

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] bg-[#071a44] p-8 text-white shadow-sm">
        <Tag className="mb-5 border-0 bg-white/10 px-3 py-1 font-bold text-blue-50">JD 智能优化</Tag>
        <h1 className="text-[34px] font-black tracking-tight">把岗位描述变成更高转化的招聘资产</h1>
        <p className="mt-3 max-w-2xl leading-7 text-blue-100">
          前端只提交真实岗位 ID 和优化偏好，优化建议、缺失信号和包容性语言检查均由后端生成。
        </p>
      </section>

      {jobs.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-12 shadow-sm">
          <Empty description="暂无可优化的岗位，请先创建岗位。" />
        </section>
      ) : (
        <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black">优化输入</h2>
            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">选择岗位</span>
                <Select
                  className="w-full"
                  value={selectedJobId}
                  onChange={setSelectedJobId}
                  options={jobs.map((job) => ({ label: job.title, value: job.id }))}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">目标语气</span>
                <Select
                  className="w-full"
                  value={targetTone}
                  onChange={setTargetTone}
                  options={[
                    { label: '专业清晰', value: 'professional' },
                    { label: '成长机会导向', value: 'growth' },
                    { label: '技术深度导向', value: 'technical' },
                    { label: '包容友好', value: 'inclusive' },
                  ]}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">本次优化重点</span>
                <Input.TextArea
                  rows={5}
                  value={focus}
                  onChange={(event) => setFocus(event.target.value)}
                  placeholder="例如：提升高级前端候选人吸引力，减少过度苛刻条件，强调远程协作。"
                />
              </label>
              <Button type="primary" className="h-11 w-full bg-[#00288e] font-bold" loading={optimizing} icon={<MaterialIcon name="auto_fix_high" />} onClick={handleOptimize}>
                生成优化建议
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black">优化结果</h2>
            {!result ? (
              <div className="mt-10">
                <Empty description="选择岗位后生成 JD 优化建议" />
              </div>
            ) : (
              <div className="mt-5 space-y-6">
                <div className="rounded-xl bg-blue-50 p-5">
                  <p className="text-sm font-bold text-[#00288e]">优化标题</p>
                  <h3 className="mt-2 text-2xl font-black text-slate-950">{result.optimized_title || result.original_title || '后端未返回标题'}</h3>
                </div>

                {result.optimized_description ? (
                  <div>
                    <p className="mb-2 text-sm font-bold text-slate-700">优化后描述</p>
                    <div className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700">
                      {result.optimized_description}
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="font-black text-slate-900">优化建议</p>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                      {result.suggestions.length ? result.suggestions.map((item) => <li key={item}>{item}</li>) : <li>暂无建议</li>}
                    </ul>
                  </div>
                  <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                    <p className="font-black text-amber-800">缺失信号</p>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-amber-900">
                      {result.missing_signals.length ? result.missing_signals.map((item) => <li key={item}>{item}</li>) : <li>暂无缺失信号</li>}
                    </ul>
                  </div>
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                    <p className="font-black text-emerald-800">包容性语言</p>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-emerald-900">
                      {result.inclusive_language_notes.length ? result.inclusive_language_notes.map((item) => <li key={item}>{item}</li>) : <li>暂无语言风险</li>}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
