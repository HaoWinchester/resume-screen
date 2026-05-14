'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Empty, Select, Spin, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { getErrorMessage } from '@/lib/api';
import { completeHrReminder, dispatchDueHrReminders, fetchHrReminders } from '@/lib/api/hrExtensions';
import type { HrReminder } from '@/types/hrExtensions';

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
  if (!value) return '未设置';
  return new Date(value).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function statusTone(status: string) {
  if (status === 'done') return 'green';
  if (status === 'overdue' || status === 'failed') return 'red';
  if (status === 'sending') return 'gold';
  return 'blue';
}

function statusLabel(status: string) {
  if (status === 'done') return '已完成';
  if (status === 'overdue') return '已逾期';
  if (status === 'pending') return '待处理';
  if (status === 'sending') return '发送中';
  if (status === 'failed') return '发送失败';
  return status;
}

function reminderTypeLabel(value?: string | null) {
  const labels: Record<string, string> = {
    follow_up: '跟进提醒',
    interview: '面试提醒',
    interview_reminder_3h: '面试前3小时',
    interview_reminder_1h: '面试前1小时',
    email: '邮件提醒',
    task: '任务提醒',
  };
  return value ? labels[value] || value : '通用提醒';
}

export default function RemindersPage() {
  const [items, setItems] = useState<HrReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | undefined>();
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState('');
  const [dispatching, setDispatching] = useState(false);

  const loadReminders = useCallback(async (nextStatus?: string) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetchHrReminders({ status: nextStatus });
      setItems(response.items);
    } catch (err) {
      setError(getErrorMessage(err) || '提醒列表加载失败，请确认 /api/v1/hr/reminders 已就绪。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReminders(status);
  }, [loadReminders, status]);

  const handleComplete = async (record: HrReminder) => {
    setUpdatingId(record.id);
    try {
      await completeHrReminder(record.id);
      message.success('提醒已标记完成');
      await loadReminders(status);
    } catch (err) {
      message.error(getErrorMessage(err) || '更新提醒失败');
    } finally {
      setUpdatingId('');
    }
  };

  const handleDispatchDue = async () => {
    setDispatching(true);
    try {
      const result = await dispatchDueHrReminders();
      if (result.total === 0) {
        message.info('当前没有到期的面试提醒');
      } else if (result.failed > 0) {
        message.warning(`已处理 ${result.total} 条到期提醒，成功 ${result.sent} 条，失败 ${result.failed} 条`);
      } else {
        message.success(`已发送 ${result.sent} 条到期面试提醒`);
      }
      await loadReminders(status);
    } catch (err) {
      message.error(getErrorMessage(err) || '发送到期提醒失败');
    } finally {
      setDispatching(false);
    }
  };

  const columns: ColumnsType<HrReminder> = [
    {
      title: '提醒',
      key: 'title',
      render: (_, record) => (
        <div className="max-w-[420px]">
          <p className="font-bold text-slate-900">{record.title}</p>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">{record.description || '无补充说明'}</p>
        </div>
      ),
    },
    {
      title: '候选人',
      key: 'candidate',
      width: 210,
      render: (_, record) => (
        <div>
          <p className="font-semibold text-slate-800">{record.candidate_name || '未关联候选人'}</p>
          <p className="text-xs text-slate-500">{record.job_title || '未关联岗位'}</p>
        </div>
      ),
    },
    {
      title: '类型',
      dataIndex: 'reminder_type',
      key: 'reminder_type',
      width: 120,
      render: (value?: string | null) => reminderTypeLabel(value),
    },
    {
      title: '截止时间',
      dataIndex: 'due_at',
      key: 'due_at',
      width: 170,
      render: formatDate,
    },
    {
      title: '负责人',
      dataIndex: 'owner_name',
      key: 'owner_name',
      width: 120,
      render: (value?: string | null) => value || '未分配',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (value: string) => <Tag color={statusTone(value)}>{statusLabel(value)}</Tag>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 130,
      render: (_, record) => (
        <Button
          size="small"
          disabled={record.status === 'done'}
          loading={updatingId === record.id}
          onClick={() => void handleComplete(record)}
        >
          标记完成
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

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] bg-[#071a44] p-8 text-white shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Tag className="mb-5 border-0 bg-white/10 px-3 py-1 font-bold text-blue-50">自动提醒</Tag>
            <h1 className="text-[34px] font-black tracking-tight">每个下一步都有提醒</h1>
            <p className="mt-3 max-w-2xl leading-7 text-blue-100">
              集中展示待跟进、待发送、待面试和逾期事项，支持真实接口标记完成。
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button className="border-white/30 bg-white/10 text-white" icon={<MaterialIcon name="outgoing_mail" />} loading={dispatching} onClick={() => void handleDispatchDue()}>
              立即发送到期提醒
            </Button>
            <Button className="border-white/30 bg-white/10 text-white" icon={<MaterialIcon name="refresh" />} onClick={() => void loadReminders(status)}>
              刷新
            </Button>
          </div>
        </div>
      </section>

      {error ? <Alert type="error" showIcon message={error} /> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 px-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-black">提醒队列</h2>
            <p className="mt-1 text-sm text-slate-500">当前共 {items.length} 条提醒</p>
          </div>
          <Select
            allowClear
            className="w-full md:w-48"
            placeholder="筛选状态"
            value={status}
            onChange={setStatus}
            options={[
              { label: '待处理', value: 'pending' },
              { label: '发送中', value: 'sending' },
              { label: '发送失败', value: 'failed' },
              { label: '已逾期', value: 'overdue' },
              { label: '已完成', value: 'done' },
            ]}
          />
        </div>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={items}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: <Empty description="暂无自动提醒" /> }}
          scroll={{ x: 1280 }}
        />
      </section>
    </div>
  );
}
