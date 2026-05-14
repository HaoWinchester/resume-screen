'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Empty, Spin, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useRouter } from 'next/navigation';
import { getErrorMessage } from '@/lib/api';
import { fetchHrCalendar } from '@/lib/api/hrExtensions';
import type { HrCalendarEvent } from '@/types/hrExtensions';

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

function calendarStatusLabel(value?: string | null) {
  const labels: Record<string, string> = {
    scheduled: '已排期',
    cancelled: '已取消',
    completed: '已完成',
    pending: '待确认',
  };
  return value ? labels[value] || value : '未标记';
}

function calendarStatusColor(value?: string | null) {
  if (value === 'completed') return 'green';
  if (value === 'cancelled') return 'red';
  if (value === 'pending') return 'orange';
  return 'blue';
}

export default function CalendarPage() {
  const router = useRouter();
  const [items, setItems] = useState<HrCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadCalendar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetchHrCalendar();
      setItems(response.items);
    } catch (err) {
      setError(getErrorMessage(err) || '日历排期加载失败，请确认 /api/v1/hr/calendar 已就绪。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCalendar();
  }, [loadCalendar]);

  const columns: ColumnsType<HrCalendarEvent> = [
    {
      title: '日程',
      key: 'event',
      render: (_, record) => (
        <div className="max-w-[420px]">
          <p className="font-bold text-slate-900">{record.title}</p>
          <p className="mt-1 text-sm text-slate-500">{record.candidate_name || '未关联候选人'} · {record.job_title || '未关联岗位'}</p>
        </div>
      ),
    },
    {
      title: '开始',
      dataIndex: 'starts_at',
      key: 'starts_at',
      width: 170,
      render: formatDate,
    },
    {
      title: '结束',
      dataIndex: 'ends_at',
      key: 'ends_at',
      width: 170,
      render: formatDate,
    },
    {
      title: '地点 / 链接',
      key: 'place',
      width: 280,
      render: (_, record) => (
        <div className="break-all text-sm leading-6 text-slate-700">
          {record.meeting_link || record.location || '未设置'}
        </div>
      ),
    },
    {
      title: '参与人',
      dataIndex: 'attendees',
      key: 'attendees',
      width: 260,
      render: (values: string[]) => (
        <div className="flex flex-wrap gap-2">
          {values.length ? values.map((value) => <Tag key={value} className="border-0 bg-slate-100 font-bold text-slate-700">{value}</Tag>) : '未记录'}
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (value?: string | null) => <Tag color={calendarStatusColor(value)}>{calendarStatusLabel(value)}</Tag>,
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
            <Tag className="mb-5 border-0 bg-white/10 px-3 py-1 font-bold text-blue-50">附件 / 日历</Tag>
            <h1 className="text-[34px] font-black tracking-tight">面试日历与排期入口</h1>
            <p className="mt-3 max-w-2xl leading-7 text-blue-100">
              读取后端统一日历事件，为面试通知、附件准备和团队协同提供一个入口。
            </p>
          </div>
          <div className="flex gap-3">
            <Button className="border-white/30 bg-white/10 text-white" icon={<MaterialIcon name="refresh" />} onClick={() => void loadCalendar()}>
              刷新
            </Button>
            <Button type="primary" className="bg-white text-[#071a44]" onClick={() => router.push('/dashboard/interviews')}>
              安排面试
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
          locale={{ emptyText: <Empty description="暂无日历排期" /> }}
          scroll={{ x: 1260 }}
        />
      </section>
    </div>
  );
}
