'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Empty, Select, Spin, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useRouter } from 'next/navigation';
import { fetchCandidateWorkflows, markCandidateContacted, workflowStatusLabel } from '@/lib/api/candidateWorkflow';
import { fetchJobRequirements } from '@/lib/api/job';
import type { CandidateWorkflowItem } from '@/types/candidateWorkflow';
import type { JobRequirementListItem } from '@/types/job';

const ALL_JOBS_VALUE = 'all';

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

function candidateLabel(record: CandidateWorkflowItem) {
  return record.candidate_name || `候选人-${record.analysis_id.slice(0, 8)}`;
}

function formatDate(value?: string | null) {
  if (!value) return '暂无更新';
  return new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function getAnalysisHref(analysisId: string) {
  return `/dashboard/reports/${analysisId}`;
}

export default function ShortlistPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobRequirementListItem[]>([]);
  const [selectedJobId, setSelectedJobId] = useState(ALL_JOBS_VALUE);
  const [items, setItems] = useState<CandidateWorkflowItem[]>([]);
  const [loading, setLoading] = useState(true);

  const selectedJob = jobs.find((job) => job.id === selectedJobId);
  const contactedCount = items.filter((item) => item.status === 'contacted').length;
  const interviewCount = items.filter((item) => item.status === 'interview_scheduled').length;
  const averageScore = useMemo(() => {
    if (items.length === 0) return 0;
    const scoredItems = items.filter((item) => typeof item.score === 'number');
    if (scoredItems.length === 0) return 0;
    return Math.round(scoredItems.reduce((sum, item) => sum + Number(item.score), 0) / scoredItems.length);
  }, [items]);

  const loadJobs = useCallback(async () => {
    try {
      const response = await fetchJobRequirements({ status: 'active', per_page: 100 });
      setJobs(response.items);
    } catch {
      message.error('加载岗位失败');
    }
  }, []);

  const loadShortlist = useCallback(async () => {
    setLoading(true);
    try {
      const workflowResponse = await fetchCandidateWorkflows({
        job_requirement_id: selectedJobId === ALL_JOBS_VALUE ? undefined : selectedJobId,
      });
      setItems(
        workflowResponse.items
          .filter((item) => item.is_priority)
          .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      );
    } catch {
      message.error('加载优先沟通名单失败');
    } finally {
      setLoading(false);
    }
  }, [selectedJobId]);

  const handleMarkContacted = async (record: CandidateWorkflowItem) => {
    try {
      const workflow = await markCandidateContacted(record.analysis_id, 'HR 已完成一次候选人沟通');
      setItems((prev) => prev.map((item) => (item.analysis_id === workflow.analysis_id ? workflow : item)));
      message.success(`${candidateLabel(record)} 已标记为已沟通`);
    } catch {
      message.error('标记沟通失败');
    }
  };

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    void loadShortlist();
  }, [loadShortlist]);

  const goAnalysisList = () => {
    const query = selectedJobId === ALL_JOBS_VALUE ? '' : `?job=${selectedJobId}`;
    router.push(`/dashboard/analysis${query}`);
  };

  const columns: ColumnsType<CandidateWorkflowItem> = [
    {
      title: '候选人',
      key: 'candidate',
      render: (_, record) => (
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-sm font-black text-[#00288e]">
            {candidateLabel(record).slice(0, 1)}
          </span>
          <div>
            <div className="font-black text-[#1a1b22]">{candidateLabel(record)}</div>
            <div className="text-xs text-slate-500">{record.job_title || '未关联岗位'}</div>
          </div>
        </div>
      ),
    },
    {
      title: '跟进状态',
      key: 'workflow',
      width: 140,
      render: (_, record) => {
        const status = workflowStatusLabel(record.status);
        return (
          <div>
            <Tag className="border-0 bg-slate-100 px-3 py-1 font-bold text-slate-700">{status}</Tag>
            {record.contact_count ? <div className="mt-1 text-xs text-slate-500">沟通 {record.contact_count} 次</div> : null}
          </div>
        );
      },
    },
    {
      title: '匹配分',
      dataIndex: 'score',
      key: 'overall_score',
      width: 110,
      render: (score?: number | null) => score == null ? <span className="text-slate-400">待分析</span> : <span className="text-xl font-black text-[#00288e]">{Math.round(score)}%</span>,
    },
    {
      title: '下一步',
      dataIndex: 'next_step',
      key: 'next_step',
      width: 220,
      render: (value?: string | null) => <span className="text-slate-600">{value || '优先联系候选人'}</span>,
    },
    {
      title: '最近更新',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 150,
      render: formatDate,
    },
    {
      title: '备注',
      dataIndex: 'note',
      key: 'note',
      ellipsis: true,
      render: (note?: string | null) => <span className="text-slate-600">{note || '暂无备注'}</span>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_, record) => (
        <div className="flex gap-2">
          <Button type="primary" className="rounded-lg bg-[#00288e] font-bold" onClick={() => router.push(getAnalysisHref(record.analysis_id))}>
            查看详情
          </Button>
          <Button className="rounded-lg font-bold" onClick={() => handleMarkContacted(record)}>
            标记已沟通
          </Button>
        </div>
      ),
    },
  ];

  if (jobs.length === 0 && loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] bg-[#071a44] text-white shadow-sm">
        <div className="grid gap-8 p-8 lg:grid-cols-[1.4fr_0.8fr] lg:p-10">
          <div>
            <Tag className="mb-5 border-0 bg-white/10 px-3 py-1 font-bold text-blue-50">优先沟通名单</Tag>
            <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-tight">
              HR 筛选后的下一步，就看这里
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-blue-100">
              系统会把强推荐和可沟通候选人自动汇总到这里，按匹配分排序。HR 不需要在全部简历里翻，只处理最值得联系的人。
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-6">
            <MaterialIcon name="groups" className="text-4xl text-blue-100" fill />
            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              <Metric value={items.length} label="优先名单" />
              <Metric value={contactedCount} label="已沟通" />
              <Metric value={averageScore ? `${averageScore}%` : '-'} label="均分" />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-black text-[#1a1b22]">{selectedJob?.title || '全部岗位'}</h2>
            <p className="mt-1 text-sm text-slate-600">
              优先沟通 {items.length} 人，已沟通 {contactedCount} 人，已约面试 {interviewCount} 人。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Select
              value={selectedJobId}
              onChange={setSelectedJobId}
              className="h-12 min-w-64"
              options={[
                { label: '全部岗位', value: ALL_JOBS_VALUE },
                ...jobs.map((job) => ({ label: job.title, value: job.id })),
              ]}
            />
            <Button className="h-12 rounded-lg px-5 font-bold" onClick={goAnalysisList}>
              查看全部候选人
            </Button>
          </div>
        </div>

        <Table
          columns={columns}
          dataSource={items}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1040 }}
          locale={{
            emptyText: (
              <Empty description="当前范围还没有进入优先沟通名单的候选人">
                <Button type="primary" className="bg-[#00288e]" onClick={goAnalysisList}>
                  查看全部筛选结果
                </Button>
              </Empty>
            ),
          }}
        />
      </section>
    </div>
  );
}

function Metric({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-xl bg-white/10 p-3">
      <div className="text-2xl font-black">{value}</div>
      <div className="mt-1 text-xs text-blue-100">{label}</div>
    </div>
  );
}
