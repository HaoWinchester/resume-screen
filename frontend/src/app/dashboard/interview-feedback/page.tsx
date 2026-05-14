'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Empty, Input, InputNumber, Modal, Select, Spin, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { getErrorMessage } from '@/lib/api';
import { createHrInterviewFeedback, fetchHrInterviewFeedback } from '@/lib/api/hrExtensions';
import type { HrInterviewFeedback } from '@/types/hrExtensions';

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

function splitLines(value: string) {
  return value.split('\n').map((line) => line.trim()).filter(Boolean);
}

function formatDate(value?: string | null) {
  if (!value) return '未提交';
  return new Date(value).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function decisionLabel(value: string) {
  if (value === 'strong_yes') return '强烈推荐';
  if (value === 'yes') return '推荐';
  if (value === 'hold') return '待定';
  if (value === 'no') return '不推荐';
  return value;
}

export default function InterviewFeedbackPage() {
  const [items, setItems] = useState<HrInterviewFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [analysisId, setAnalysisId] = useState('');
  const [interviewer, setInterviewer] = useState('');
  const [roundName, setRoundName] = useState('');
  const [score, setScore] = useState<number | null>(80);
  const [decision, setDecision] = useState('yes');
  const [strengths, setStrengths] = useState('');
  const [risks, setRisks] = useState('');
  const [notes, setNotes] = useState('');

  const loadFeedback = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetchHrInterviewFeedback();
      setItems(response.items);
    } catch (err) {
      setError(getErrorMessage(err) || '面试评价加载失败，请确认 /api/v1/hr/interview-feedback 已就绪。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFeedback();
  }, [loadFeedback]);

  const resetForm = () => {
    setAnalysisId('');
    setInterviewer('');
    setRoundName('');
    setScore(80);
    setDecision('yes');
    setStrengths('');
    setRisks('');
    setNotes('');
  };

  const handleCreate = async () => {
    if (!analysisId.trim()) {
      message.warning('请填写候选人分析 ID');
      return;
    }
    if (!interviewer.trim()) {
      message.warning('请填写面试官');
      return;
    }

    setSaving(true);
    try {
      await createHrInterviewFeedback({
        analysis_id: analysisId.trim(),
        interviewer_name: interviewer.trim(),
        round_name: roundName.trim() || undefined,
        score: score ?? undefined,
        decision,
        strengths: splitLines(strengths),
        risks: splitLines(risks),
        notes: notes.trim() || undefined,
      });
      message.success('面试评价已保存');
      setModalOpen(false);
      resetForm();
      await loadFeedback();
    } catch (err) {
      message.error(getErrorMessage(err) || '保存面试评价失败');
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnsType<HrInterviewFeedback> = [
    {
      title: '候选人',
      key: 'candidate',
      width: 220,
      render: (_, record) => (
        <div>
          <p className="font-bold text-slate-900">{record.candidate_name || (record.analysis_id ? `候选人-${record.analysis_id.slice(0, 8)}` : '未关联候选人')}</p>
          <p className="text-xs text-slate-500">{record.job_title || '未关联岗位'}</p>
        </div>
      ),
    },
    {
      title: '轮次',
      dataIndex: 'round_name',
      key: 'round_name',
      width: 120,
      render: (value?: string | null) => value || '未标记',
    },
    {
      title: '面试官',
      dataIndex: 'interviewer_name',
      key: 'interviewer_name',
      width: 130,
      render: (value?: string | null) => value || '未记录',
    },
    {
      title: '评分',
      dataIndex: 'score',
      key: 'score',
      width: 100,
      render: (value?: number | null) => value == null ? '未评分' : <span className="font-black text-[#00288e]">{value}</span>,
    },
    {
      title: '结论',
      dataIndex: 'decision',
      key: 'decision',
      width: 120,
      render: (value: string) => <Tag className="border-0 bg-blue-50 px-3 py-1 font-bold text-[#00288e]">{decisionLabel(value)}</Tag>,
    },
    {
      title: '亮点 / 风险',
      key: 'insights',
      render: (_, record) => (
        <div className="max-w-[460px] space-y-2">
          <p className="line-clamp-2 text-sm leading-6 text-emerald-700">{record.strengths.length ? record.strengths.join('、') : '暂无亮点记录'}</p>
          <p className="line-clamp-2 text-sm leading-6 text-amber-700">{record.risks.length ? record.risks.join('、') : '暂无风险记录'}</p>
        </div>
      ),
    },
    {
      title: '提交时间',
      dataIndex: 'submitted_at',
      key: 'submitted_at',
      width: 170,
      render: formatDate,
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
      <section className="rounded-[28px] bg-[#071a44] p-8 text-white shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Tag className="mb-5 border-0 bg-white/10 px-3 py-1 font-bold text-blue-50">面试闭环</Tag>
            <h1 className="text-[34px] font-black tracking-tight">面试评价与录入入口</h1>
            <p className="mt-3 max-w-2xl leading-7 text-blue-100">
              收集每轮面试反馈，把主观评价沉淀为可追踪的录用决策信号。
            </p>
          </div>
          <div className="flex gap-3">
            <Button className="border-white/30 bg-white/10 text-white" icon={<MaterialIcon name="refresh" />} onClick={() => void loadFeedback()}>
              刷新
            </Button>
            <Button type="primary" className="bg-white text-[#071a44]" onClick={() => setModalOpen(true)}>
              录入评价
            </Button>
          </div>
        </div>
      </section>

      {error ? <Alert type="error" showIcon message={error} /> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={items}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: <Empty description="暂无面试评价记录" /> }}
          scroll={{ x: 1280 }}
        />
      </section>

      <Modal
        title="录入面试评价"
        open={modalOpen}
        onOk={handleCreate}
        onCancel={() => setModalOpen(false)}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
        width={720}
      >
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">候选人分析 ID</span>
              <Input value={analysisId} onChange={(event) => setAnalysisId(event.target.value)} placeholder="analysis_id" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">面试官</span>
              <Input value={interviewer} onChange={(event) => setInterviewer(event.target.value)} placeholder="例如：张三" />
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">轮次</span>
              <Input value={roundName} onChange={(event) => setRoundName(event.target.value)} placeholder="一面 / 二面 / HR 面" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">评分</span>
              <InputNumber className="w-full" min={0} max={100} value={score} onChange={setScore} />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">结论</span>
              <Select className="w-full" value={decision} onChange={setDecision} options={[
                { label: '强烈推荐', value: 'strong_yes' },
                { label: '推荐', value: 'yes' },
                { label: '待定', value: 'hold' },
                { label: '不推荐', value: 'no' },
              ]} />
            </label>
          </div>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">候选人亮点（每行一条）</span>
            <Input.TextArea rows={3} value={strengths} onChange={(event) => setStrengths(event.target.value)} />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">风险或待确认点（每行一条）</span>
            <Input.TextArea rows={3} value={risks} onChange={(event) => setRisks(event.target.value)} />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">补充备注</span>
            <Input.TextArea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
        </div>
      </Modal>
    </div>
  );
}
