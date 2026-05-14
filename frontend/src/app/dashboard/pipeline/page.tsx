'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Empty, Progress, Spin, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useRouter } from 'next/navigation';
import { getErrorMessage } from '@/lib/api';
import { fetchHrPipeline } from '@/lib/api/hrExtensions';
import type { HrPipelineCandidate, HrPipelineResponse } from '@/types/hrExtensions';

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

function formatDate(value?: string | null) {
  if (!value) return '暂无更新';
  return new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function candidateName(record: HrPipelineCandidate) {
  return record.candidate_name || `候选人-${record.analysis_id.slice(0, 8)}`;
}

function stageTone(index: number) {
  const tones = [
    { bg: 'bg-slate-950', text: 'text-white', line: 'bg-slate-950', soft: 'bg-slate-100 text-slate-700', icon: 'inventory_2' },
    { bg: 'bg-blue-700', text: 'text-white', line: 'bg-blue-700', soft: 'bg-blue-50 text-blue-800', icon: 'workspace_premium' },
    { bg: 'bg-cyan-600', text: 'text-white', line: 'bg-cyan-600', soft: 'bg-cyan-50 text-cyan-800', icon: 'connect_without_contact' },
    { bg: 'bg-amber-500', text: 'text-slate-950', line: 'bg-amber-500', soft: 'bg-amber-50 text-amber-800', icon: 'forum' },
    { bg: 'bg-emerald-600', text: 'text-white', line: 'bg-emerald-600', soft: 'bg-emerald-50 text-emerald-800', icon: 'event_available' },
    { bg: 'bg-rose-600', text: 'text-white', line: 'bg-rose-600', soft: 'bg-rose-50 text-rose-800', icon: 'verified' },
  ];
  return tones[index % tones.length];
}

export default function PipelinePage() {
  const router = useRouter();
  const [data, setData] = useState<HrPipelineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPipeline = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await fetchHrPipeline());
    } catch (err) {
      setError(getErrorMessage(err) || '招聘漏斗加载失败，请确认 /api/v1/hr/pipeline 已就绪。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPipeline();
  }, [loadPipeline]);

  const columns: ColumnsType<HrPipelineCandidate> = [
    {
      title: '候选人',
      key: 'candidate',
      width: 220,
      render: (_, record) => (
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-black text-[#00288e]">
            {candidateName(record).slice(0, 1)}
          </span>
          <div>
            <p className="font-bold text-slate-900">{candidateName(record)}</p>
            <p className="text-xs text-slate-500">{record.job_title || '未关联岗位'}</p>
          </div>
        </div>
      ),
    },
    {
      title: '阶段',
      dataIndex: 'stage',
      key: 'stage',
      width: 140,
      render: (stage: string) => <Tag className="border-0 bg-blue-50 px-3 py-1 font-bold text-[#00288e]">{stage}</Tag>,
    },
    {
      title: '匹配分',
      dataIndex: 'score',
      key: 'score',
      width: 120,
      render: (score?: number | null) => score == null ? '待分析' : <span className="font-black text-[#00288e]">{Math.round(score)}%</span>,
    },
    {
      title: '负责人',
      dataIndex: 'owner_name',
      key: 'owner_name',
      width: 140,
      render: (value?: string | null) => value || '未分配',
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 170,
      render: formatDate,
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_, record) => (
        <Button size="small" onClick={() => router.push(`/dashboard/reports/${record.analysis_id}`)}>
          查看报告
        </Button>
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

  if (error) return <Alert type="error" showIcon message={error} />;

  if (!data) {
    return <Empty description="暂无招聘漏斗数据" />;
  }

  const summaryTotal = Number(data.summary?.[0]?.value);
  const totalCandidates = Number.isFinite(summaryTotal) ? Math.max(summaryTotal, data.candidates.length) : data.candidates.length;
  const lastUpdatedAt = data.generated_at ? formatDate(data.generated_at) : '刚刚';

  return (
    <div className="space-y-7">
      <section className="overflow-hidden rounded-[32px] bg-[#071a44] text-white shadow-sm">
        <div className="relative grid gap-8 p-8 lg:grid-cols-[1.4fr_0.8fr] lg:p-10">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-blue-400/20 blur-3xl" />
          <div className="relative">
            <Tag className="mb-5 border-0 bg-white/10 px-3 py-1 font-bold text-blue-50">招聘漏斗</Tag>
            <h1 className="max-w-3xl text-[34px] font-black leading-tight tracking-tight lg:text-[42px]">
              看清每个候选人卡在哪一步
            </h1>
            <p className="mt-4 max-w-2xl leading-7 text-blue-100">
              从入库、推荐、优先沟通、已沟通到面试排期，把招聘推进动作放在同一个流程里看。
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button className="border-white/30 bg-white/10 text-white" icon={<MaterialIcon name="refresh" />} onClick={() => void loadPipeline()}>
                刷新数据
              </Button>
              <Button className="bg-white text-[#071a44]" onClick={() => router.push('/dashboard/analysis')}>
                查看候选人结果
              </Button>
              <Button className="border-white/30 bg-white/10 text-white" onClick={() => router.push('/dashboard/shortlist')}>
                优先沟通名单
              </Button>
            </div>
          </div>
          <div className="relative rounded-3xl border border-white/10 bg-white/10 p-6">
            <p className="text-sm font-bold text-blue-100">当前流程候选人</p>
            <p className="mt-4 text-6xl font-black">{totalCandidates}</p>
            <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-blue-100">漏斗阶段</p>
                <p className="mt-2 text-2xl font-black">{data.stages.length}</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-blue-100">最后更新</p>
                <p className="mt-2 text-base font-black">{lastUpdatedAt}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {(data.summary ?? []).map((item) => (
          <div key={item.label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-slate-500">{item.label}</p>
            <p className="mt-3 text-4xl font-black text-slate-950">{item.value}</p>
            {item.delta ? <p className="mt-2 text-xs font-semibold text-emerald-600">{item.delta}</p> : null}
          </div>
        ))}
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm lg:p-6">
        <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-950">招聘阶段流转</h2>
            <p className="mt-1 text-sm text-slate-500">横向看转化，向下看每个阶段有哪些候选人需要推进。</p>
          </div>
          <Button onClick={() => router.push('/dashboard/interviews')}>查看待面试</Button>
        </div>

        {data.stages.length === 0 ? (
          <Empty description="暂无漏斗阶段数据" />
        ) : (
          <div className="-mx-1 overflow-x-auto px-1 pb-2">
            <div className="flex min-w-max items-start gap-3">
            {data.stages.map((stage, index) => {
              const tone = stageTone(index);
              const stageCandidates = data.candidates.filter((candidate) => candidate.stage === stage.label).slice(0, 3);
              return (
                <div key={stage.key} className="relative w-[232px] shrink-0 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  {index < data.stages.length - 1 ? (
                    <div className="absolute -right-3 top-12 z-10 hidden h-6 w-6 rotate-45 border-r border-t border-slate-200 bg-slate-50 xl:block" />
                  ) : null}
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tone.bg} ${tone.text}`}>
                    <MaterialIcon name={tone.icon} fill />
                  </div>
                  <div className="mt-4 flex items-start justify-between gap-2">
                    <div>
                      <p className="font-black text-slate-950">{stage.label}</p>
                      <p className="mt-1 text-xs text-slate-500">{stage.average_days == null ? '停留时长待积累' : `平均 ${stage.average_days} 天`}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-sm font-black ${tone.soft}`}>{stage.count}</span>
                  </div>
                  <Progress className="mt-3" percent={stage.conversion_rate ?? 0} showInfo={false} strokeColor="#00288e" />
                  <p className="mt-1 text-xs font-bold text-slate-500">占总量 {stage.conversion_rate ?? 0}%</p>

                  <div className="mt-4 space-y-2">
                    {stageCandidates.length ? (
                      stageCandidates.map((candidate) => (
                        <button
                          key={candidate.analysis_id}
                          type="button"
                          className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#00288e]/40 hover:shadow-md"
                          onClick={() => router.push(`/dashboard/reports/${candidate.analysis_id}`)}
                        >
                          <p className="truncate text-sm font-black text-slate-900">{candidateName(candidate)}</p>
                          <p className="mt-1 truncate text-xs text-slate-500">{candidate.job_title || '未关联岗位'}</p>
                          <p className="mt-2 text-xs font-black text-[#00288e]">{candidate.score == null ? '待分析' : `${Math.round(candidate.score)} 分`}</p>
                        </button>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-3 text-center text-xs font-semibold text-slate-400">
                        暂无候选人
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 px-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-black">候选人明细</h2>
            <p className="mt-1 text-sm text-slate-500">共 {data.candidates.length} 条流转记录，可进入报告继续安排沟通或面试。</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => router.push('/dashboard/communications')}>沟通记录</Button>
            <Button onClick={() => router.push('/dashboard/interview-feedback')}>面试评价</Button>
          </div>
        </div>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data.candidates}
          pagination={{ pageSize: 8 }}
          locale={{ emptyText: <Empty description="暂无候选人流转记录" /> }}
          scroll={{ x: 950 }}
        />
      </section>
    </div>
  );
}
