'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, Empty, Spin, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useRouter } from 'next/navigation';
import { fetchTalentPool } from '@/lib/api/recruitment';
import { fetchCandidateWorkflows, markCandidatePriority, workflowStatusLabel } from '@/lib/api/candidateWorkflow';
import type { CandidateWorkflowItem } from '@/types/candidateWorkflow';
import type { TalentPoolCandidate } from '@/types/recruitment';

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

export default function TalentPoolPage() {
  const router = useRouter();
  const [items, setItems] = useState<TalentPoolCandidate[]>([]);
  const [workflowMap, setWorkflowMap] = useState<Record<string, CandidateWorkflowItem>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetchTalentPool();
        setItems(response.items);
        const workflows = response.items.length
          ? await fetchCandidateWorkflows({ analysis_ids: response.items.map((item) => item.analysisId) })
          : { items: [] };
        setWorkflowMap(Object.fromEntries(workflows.items.map((item) => [item.analysis_id, item])));
      } catch {
        setError('人才库加载失败，请稍后重试。');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const handleMarkPriority = async (record: TalentPoolCandidate) => {
    try {
      const workflow = await markCandidatePriority(record.analysisId, 'HR 从人才库加入优先沟通');
      setWorkflowMap((prev) => ({ ...prev, [workflow.analysis_id]: workflow }));
      message.success(`${record.candidateName} 已加入优先沟通`);
    } catch {
      message.error('加入优先沟通失败');
    }
  };

  const columns: ColumnsType<TalentPoolCandidate> = [
    {
      title: '候选人',
      key: 'candidate',
      render: (_, record) => (
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-sm font-black text-[#00288e]">
            {record.candidateName.slice(0, 1)}
          </span>
          <div>
            <p className="font-black">{record.candidateName}</p>
            <p className="text-xs text-slate-500">{record.jobTitle}</p>
          </div>
        </div>
      ),
    },
    {
      title: '匹配分',
      dataIndex: 'score',
      key: 'score',
      width: 110,
      sorter: (a, b) => a.score - b.score,
      render: (score: number) => <span className="text-xl font-black text-[#00288e]">{Math.round(score)}%</span>,
    },
    {
      title: '推荐等级',
      dataIndex: 'recommendationLabel',
      key: 'recommendationLabel',
      width: 120,
      render: (label: string) => <Tag className="border-0 bg-emerald-100 px-3 py-1 font-bold text-emerald-700">{label}</Tag>,
    },
    {
      title: '跟进状态',
      key: 'workflow',
      width: 130,
      render: (_, record) => {
        const workflow = workflowMap[record.analysisId];
        return <Tag className="border-0 bg-slate-100 px-3 py-1 font-bold text-slate-700">{workflowStatusLabel(workflow?.status)}</Tag>;
      },
    },
    {
      title: '技能沉淀',
      dataIndex: 'skills',
      key: 'skills',
      render: (skills: string[]) => (
        <div className="flex flex-wrap gap-2">
          {(skills.length ? skills : ['待确认']).slice(0, 5).map((skill) => (
            <Tag key={skill} className="border-0 bg-slate-100 px-2 py-1 font-bold text-slate-700">{skill}</Tag>
          ))}
        </div>
      ),
    },
    {
      title: '风险点',
      dataIndex: 'riskFlags',
      key: 'riskFlags',
      render: (risks: string[]) => (
        <span className={risks.length ? 'text-amber-700' : 'text-slate-400'}>
          {risks.length ? risks.slice(0, 2).join('、') : '暂无明显风险'}
        </span>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_, record) => (
        <div className="flex gap-2">
          <Button type="primary" className="rounded-lg bg-[#00288e] font-bold" onClick={() => router.push(`/dashboard/reports/${record.analysisId}`)}>
            候选人报告
          </Button>
          <Button className="rounded-lg font-bold" onClick={() => handleMarkPriority(record)}>
            {workflowMap[record.analysisId]?.is_priority ? '已优先' : '优先沟通'}
          </Button>
        </div>
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

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] bg-[#071a44] p-8 text-white shadow-sm lg:p-10">
        <Tag className="mb-5 border-0 bg-white/10 px-3 py-1 font-bold text-blue-50">企业人才库</Tag>
        <h1 className="text-4xl font-black tracking-tight">历史候选人不再浪费</h1>
        <p className="mt-4 max-w-2xl leading-8 text-blue-100">
          所有完成分析的人都会沉淀在这里，后续新岗位可以继续复用、重新匹配和生成候选人报告。
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black">候选人池</h2>
            <p className="mt-1 text-sm text-slate-600">当前共 {items.length} 位已分析候选人</p>
          </div>
          <Button icon={<MaterialIcon name="refresh" />} onClick={() => window.location.reload()}>刷新</Button>
        </div>
        <Table
          columns={columns}
          dataSource={items}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          scroll={{ x: 980 }}
          locale={{ emptyText: <Empty description="暂无人才库候选人，请先上传或导入简历。" /> }}
        />
      </section>
    </div>
  );
}
