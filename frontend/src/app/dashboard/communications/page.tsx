'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Empty, Input, Modal, Select, Spin, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { getErrorMessage } from '@/lib/api';
import { createHrCommunication, fetchHrCommunications } from '@/lib/api/hrExtensions';
import type { HrCommunicationRecord } from '@/types/hrExtensions';

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
  if (!value) return '未记录';
  return new Date(value).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function candidateName(record: HrCommunicationRecord) {
  return record.candidate_name || (record.analysis_id ? `候选人-${record.analysis_id.slice(0, 8)}` : '未关联候选人');
}

function channelLabel(value: string) {
  const labels: Record<string, string> = {
    email: '邮件',
    phone: '电话',
    wechat: '微信',
    meeting: '会议',
    note: '内部备注',
  };
  return labels[value] || value;
}

function directionLabel(value: string) {
  const labels: Record<string, string> = {
    outbound: '外发',
    inbound: '收到回复',
    internal: '内部记录',
  };
  return labels[value] || value;
}

export default function CommunicationsPage() {
  const [items, setItems] = useState<HrCommunicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [analysisId, setAnalysisId] = useState('');
  const [channel, setChannel] = useState('email');
  const [direction, setDirection] = useState('outbound');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [nextFollowUp, setNextFollowUp] = useState('');

  const loadCommunications = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetchHrCommunications();
      setItems(response.items);
    } catch (err) {
      setError(getErrorMessage(err) || '沟通记录加载失败，请确认 /api/v1/hr/communications 已就绪。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCommunications();
  }, [loadCommunications]);

  const resetForm = () => {
    setAnalysisId('');
    setChannel('email');
    setDirection('outbound');
    setSubject('');
    setContent('');
    setNextFollowUp('');
  };

  const handleCreate = async () => {
    if (!analysisId.trim()) {
      message.warning('请填写候选人分析 ID');
      return;
    }
    if (!content.trim()) {
      message.warning('请填写沟通内容');
      return;
    }

    setSaving(true);
    try {
      await createHrCommunication({
        analysis_id: analysisId.trim(),
        channel,
        direction,
        subject: subject.trim() || undefined,
        content: content.trim(),
        next_follow_up_at: nextFollowUp ? new Date(nextFollowUp).toISOString() : undefined,
      });
      message.success('沟通记录已保存');
      setModalOpen(false);
      resetForm();
      await loadCommunications();
    } catch (err) {
      message.error(getErrorMessage(err) || '保存沟通记录失败');
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnsType<HrCommunicationRecord> = [
    {
      title: '候选人',
      key: 'candidate',
      width: 220,
      render: (_, record) => (
        <div>
          <p className="font-bold text-slate-900">{candidateName(record)}</p>
          <p className="text-xs text-slate-500">{record.job_title || '未关联岗位'}</p>
        </div>
      ),
    },
    {
      title: '渠道',
      dataIndex: 'channel',
      key: 'channel',
      width: 110,
      render: (value: string) => <Tag className="border-0 bg-blue-50 px-3 py-1 font-bold text-[#00288e]">{channelLabel(value)}</Tag>,
    },
    {
      title: '方向',
      dataIndex: 'direction',
      key: 'direction',
      width: 100,
      render: (value: string) => <span className="font-semibold text-slate-700">{directionLabel(value)}</span>,
    },
    {
      title: '主题 / 内容',
      key: 'content',
      render: (_, record) => (
        <div className="max-w-[420px]">
          <p className="font-bold text-slate-900">{record.subject || '无主题'}</p>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">{record.content || '未填写内容'}</p>
        </div>
      ),
    },
    {
      title: '负责人',
      dataIndex: 'owner_name',
      key: 'owner_name',
      width: 120,
      render: (value?: string | null) => value || '未分配',
    },
    {
      title: '沟通时间',
      dataIndex: 'contacted_at',
      key: 'contacted_at',
      width: 170,
      render: formatDate,
    },
    {
      title: '下次跟进',
      dataIndex: 'next_follow_up_at',
      key: 'next_follow_up_at',
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
            <Tag className="mb-5 border-0 bg-white/10 px-3 py-1 font-bold text-blue-50">沟通记录</Tag>
            <h1 className="text-[34px] font-black tracking-tight">候选人跟进时间线</h1>
            <p className="mt-3 max-w-2xl leading-7 text-blue-100">
              记录邮件、电话、微信和内部备注，避免多人协作时丢失候选人上下文。
            </p>
          </div>
          <div className="flex gap-3">
            <Button className="border-white/30 bg-white/10 text-white" icon={<MaterialIcon name="refresh" />} onClick={() => void loadCommunications()}>
              刷新
            </Button>
            <Button type="primary" className="bg-white text-[#071a44]" onClick={() => setModalOpen(true)}>
              新增跟进
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
          locale={{ emptyText: <Empty description="暂无沟通记录，请新增一次真实跟进。" /> }}
          scroll={{ x: 1300 }}
        />
      </section>

      <Modal
        title="新增沟通记录"
        open={modalOpen}
        onOk={handleCreate}
        onCancel={() => setModalOpen(false)}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
      >
        <div className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">候选人分析 ID</span>
            <Input value={analysisId} onChange={(event) => setAnalysisId(event.target.value)} placeholder="来自候选人报告或流程记录的 analysis_id" />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">渠道</span>
              <Select className="w-full" value={channel} onChange={setChannel} options={[
                { label: '邮件', value: 'email' },
                { label: '电话', value: 'phone' },
                { label: '微信', value: 'wechat' },
                { label: '会议', value: 'meeting' },
                { label: '备注', value: 'note' },
              ]} />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">方向</span>
              <Select className="w-full" value={direction} onChange={setDirection} options={[
                { label: '外发', value: 'outbound' },
                { label: '收到回复', value: 'inbound' },
                { label: '内部备注', value: 'internal' },
              ]} />
            </label>
          </div>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">主题</span>
            <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="例如：一面邀约、薪资沟通、Offer 跟进" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">沟通内容</span>
            <Input.TextArea rows={5} value={content} onChange={(event) => setContent(event.target.value)} placeholder="记录真实沟通内容或内部备注" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">下次跟进时间</span>
            <input
              type="datetime-local"
              value={nextFollowUp}
              onChange={(event) => setNextFollowUp(event.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 px-3"
            />
          </label>
        </div>
      </Modal>
    </div>
  );
}
