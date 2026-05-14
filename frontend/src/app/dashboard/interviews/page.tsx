'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Empty, Input, Modal, Spin, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useRouter } from 'next/navigation';
import { getErrorMessage } from '@/lib/api';
import { fetchCandidateWorkflows, scheduleCandidateInterview, workflowStatusLabel } from '@/lib/api/candidateWorkflow';
import type { CandidateWorkflowItem } from '@/types/candidateWorkflow';

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
  if (!value) return '待确认';
  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function candidateName(record: CandidateWorkflowItem) {
  return record.candidate_name || record.candidate_email || `候选人-${record.analysis_id.slice(0, 8)}`;
}

export default function InterviewsPage() {
  const router = useRouter();
  const [items, setItems] = useState<CandidateWorkflowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingInterview, setEditingInterview] = useState<CandidateWorkflowItem | null>(null);
  const [interviewTime, setInterviewTime] = useState('');
  const [interviewEmail, setInterviewEmail] = useState('');
  const [interviewLocation, setInterviewLocation] = useState('');
  const [interviewNote, setInterviewNote] = useState('');

  const loadInterviews = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetchCandidateWorkflows({ status: 'interview_scheduled' });
      setItems(response.items);
    } catch (err) {
      const text = getErrorMessage(err) || '待面试列表加载失败';
      setError(text);
      message.error(text);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInterviews();
  }, [loadInterviews]);

  const openResendModal = (record: CandidateWorkflowItem) => {
    setEditingInterview(record);
    setInterviewTime(toDateTimeLocal(record.interview_scheduled_at));
    setInterviewEmail(record.candidate_email || '');
    setInterviewLocation(record.interview_location || '');
    setInterviewNote(record.note || '');
  };

  const closeResendModal = () => {
    setEditingInterview(null);
    setInterviewTime('');
    setInterviewEmail('');
    setInterviewLocation('');
    setInterviewNote('');
  };

  const handleResendInterview = async () => {
    if (!editingInterview) return;
    if (!interviewTime) {
      message.warning('请选择面试时间');
      return;
    }
    if (!interviewEmail.trim()) {
      message.warning('该面试者没有邮箱，请输入邮箱');
      return;
    }
    if (!interviewLocation.trim()) {
      message.warning('请填写面试地点或会议链接');
      return;
    }

    try {
      const workflow = await scheduleCandidateInterview({
        analysisId: editingInterview.analysis_id,
        scheduled_at: new Date(interviewTime).toISOString(),
        mode: editingInterview.interview_mode || 'online',
        location: interviewLocation.trim(),
        note: interviewNote.trim() || undefined,
        candidate_email: interviewEmail.trim(),
      });
      setItems((prev) => prev.map((item) => (item.id === workflow.id ? workflow : item)));
      message.success(workflow.email_delivery_message || '面试通知已发送');
      closeResendModal();
    } catch (err) {
      message.error(getErrorMessage(err) || '发送面试通知失败');
    }
  };

  const columns: ColumnsType<CandidateWorkflowItem> = [
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
            <p className="text-xs text-slate-500">{workflowStatusLabel(record.status)}</p>
          </div>
        </div>
      ),
    },
    {
      title: '岗位',
      dataIndex: 'job_title',
      key: 'job_title',
      width: 180,
      render: (value: string | null) => <span className="font-semibold text-slate-700">{value || '未关联岗位'}</span>,
    },
    {
      title: '邮箱',
      dataIndex: 'candidate_email',
      key: 'candidate_email',
      width: 210,
      render: (value: string | null) => value ? <span className="text-slate-700">{value}</span> : <Tag color="red">缺少邮箱</Tag>,
    },
    {
      title: '面试时间',
      dataIndex: 'interview_scheduled_at',
      key: 'interview_scheduled_at',
      width: 170,
      render: (value: string | null) => <span className="font-semibold">{formatDate(value)}</span>,
    },
    {
      title: '地点 / 会议链接',
      dataIndex: 'interview_location',
      key: 'interview_location',
      width: 240,
      render: (value: string | null) => <span className="break-all text-slate-700">{value || '未填写'}</span>,
    },
    {
      title: '下一步',
      key: 'next_step',
      width: 260,
      render: (_, record) => (
        <div className="max-w-[240px] whitespace-normal break-words">
          <p className="line-clamp-2 text-sm leading-6 text-slate-700">{record.next_step || '等待候选人参加面试'}</p>
          {record.email_delivery_message ? (
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{record.email_delivery_message}</p>
          ) : (
            <Tag className="mt-1 border-0 bg-amber-50 text-amber-700">未记录通知发送</Tag>
          )}
        </div>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 190,
      render: (_, record) => (
        <div className="flex gap-2">
          <Button size="small" onClick={() => router.push(`/dashboard/reports/${record.analysis_id}`)}>查看报告</Button>
          <Button size="small" type="primary" className="bg-[#00288e]" onClick={() => openResendModal(record)}>
            {record.candidate_email && record.email_delivery_message ? '重发通知' : '补发通知'}
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

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] bg-[#071a44] p-8 text-white shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Tag className="mb-5 border-0 bg-white/10 px-3 py-1 font-bold text-blue-50">面试排期</Tag>
            <h1 className="text-[32px] font-black tracking-tight">待面试候选人</h1>
            <p className="mt-3 text-blue-100">集中查看已经安排面试的人、时间、地点和通知状态。</p>
          </div>
          <Button className="border-white/30 bg-white/10 text-white" icon={<MaterialIcon name="refresh" />} onClick={() => void loadInterviews()}>
            刷新列表
          </Button>
        </div>
      </section>

      {error ? <Alert type="error" showIcon message={error} /> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={items}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: <Empty description="暂无已安排面试的候选人" /> }}
          scroll={{ x: 1370 }}
        />
      </section>

      <Modal
        title={`补发面试通知${editingInterview ? `：${candidateName(editingInterview)}` : ''}`}
        open={!!editingInterview}
        onOk={handleResendInterview}
        onCancel={closeResendModal}
        okText="保存并发送邮件"
        cancelText="取消"
      >
        <div className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">面试时间</span>
            <input
              type="datetime-local"
              value={interviewTime}
              onChange={(event) => setInterviewTime(event.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 px-3"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">候选人邮箱</span>
            <Input type="email" value={interviewEmail} onChange={(event) => setInterviewEmail(event.target.value)} placeholder="没有邮箱时请在这里输入，用于发送面试通知" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">面试地点 / 会议链接</span>
            <Input value={interviewLocation} onChange={(event) => setInterviewLocation(event.target.value)} placeholder="例如：腾讯会议链接 / 公司会议室 A" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">面试备注</span>
            <Input.TextArea value={interviewNote} onChange={(event) => setInterviewNote(event.target.value)} rows={4} placeholder="记录面试重点、注意事项或候选人偏好" />
          </label>
        </div>
      </Modal>
    </div>
  );
}
