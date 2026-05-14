'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Empty, Input, Select, Spin, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { getErrorMessage } from '@/lib/api';
import { fetchHrAuditLogs } from '@/lib/api/hrExtensions';
import type { HrAuditLog } from '@/types/hrExtensions';

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

export default function AuditPage() {
  const [items, setItems] = useState<HrAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resourceType, setResourceType] = useState<string | undefined>();
  const [action, setAction] = useState('');

  const loadAuditLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetchHrAuditLogs({
        action: action.trim() || undefined,
        resource_type: resourceType,
      });
      setItems(response.items);
    } catch (err) {
      setError(getErrorMessage(err) || '权限审计加载失败，请确认 /api/v1/hr/audit 已就绪。');
    } finally {
      setLoading(false);
    }
  }, [action, resourceType]);

  useEffect(() => {
    void loadAuditLogs();
  }, [loadAuditLogs]);

  const columns: ColumnsType<HrAuditLog> = [
    {
      title: '操作者',
      dataIndex: 'actor_name',
      key: 'actor_name',
      width: 150,
      render: (value?: string | null) => value || '系统',
    },
    {
      title: '动作',
      dataIndex: 'action',
      key: 'action',
      width: 170,
      render: (value: string) => <Tag className="border-0 bg-blue-50 px-3 py-1 font-bold text-[#00288e]">{value}</Tag>,
    },
    {
      title: '资源',
      key: 'resource',
      width: 260,
      render: (_, record) => (
        <div>
          <p className="font-semibold text-slate-800">{record.resource_type || 'unknown'}</p>
          <p className="text-xs text-slate-500">{record.resource_id || '无资源 ID'}</p>
        </div>
      ),
    },
    {
      title: '摘要',
      dataIndex: 'summary',
      key: 'summary',
      render: (value?: string | null) => <span className="line-clamp-2 text-sm leading-6 text-slate-700">{value || '无摘要'}</span>,
    },
    {
      title: 'IP',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 150,
      render: (value?: string | null) => value || '未记录',
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
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
            <Tag className="mb-5 border-0 bg-white/10 px-3 py-1 font-bold text-blue-50">权限审计</Tag>
            <h1 className="text-[34px] font-black tracking-tight">关键操作可追溯</h1>
            <p className="mt-3 max-w-2xl leading-7 text-blue-100">
              展示后端审计日志，覆盖权限、候选人、邮件模板、面试反馈等关键资源变更。
            </p>
          </div>
          <Button className="border-white/30 bg-white/10 text-white" icon={<MaterialIcon name="refresh" />} onClick={() => void loadAuditLogs()}>
            刷新
          </Button>
        </div>
      </section>

      {error ? <Alert type="error" showIcon message={error} /> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 grid gap-3 px-2 md:grid-cols-[1fr_220px_120px]">
          <Input value={action} onChange={(event) => setAction(event.target.value)} placeholder="按 action 搜索，例如 update_role" onPressEnter={() => void loadAuditLogs()} />
          <Select
            allowClear
            placeholder="资源类型"
            value={resourceType}
            onChange={setResourceType}
            options={[
              { label: '候选人', value: 'candidate' },
              { label: '岗位', value: 'job' },
              { label: '邮件模板', value: 'email_template' },
              { label: '面试反馈', value: 'interview_feedback' },
              { label: '权限', value: 'permission' },
            ]}
          />
          <Button type="primary" className="bg-[#00288e]" onClick={() => void loadAuditLogs()}>查询</Button>
        </div>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={items}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: <Empty description="暂无审计日志" /> }}
          scroll={{ x: 1200 }}
        />
      </section>
    </div>
  );
}
