'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Empty, Input, Modal, Select, Switch, Table, Tag, message, Spin } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { getErrorMessage } from '@/lib/api';
import { createHrEmailTemplate, fetchHrEmailTemplates, updateHrEmailTemplate } from '@/lib/api/hrExtensions';
import type { HrEmailTemplate } from '@/types/hrExtensions';

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

function splitVariables(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function scenarioLabel(value: string) {
  const labels: Record<string, string> = {
    interview_invitation: '面试邀约',
    interview_reminder: '面试提醒',
    interview_reschedule: '面试改期',
    follow_up: '沟通跟进',
    rejection: '候选人婉拒',
    offer_intent: 'Offer 意向',
    general: '通用模板',
  };
  return labels[value] || value;
}

const scenarioOptions = [
  { label: '面试邀约', value: 'interview_invitation' },
  { label: '面试提醒', value: 'interview_reminder' },
  { label: '面试改期', value: 'interview_reschedule' },
  { label: '沟通跟进', value: 'follow_up' },
  { label: '候选人婉拒', value: 'rejection' },
  { label: 'Offer 意向', value: 'offer_intent' },
  { label: '通用模板', value: 'general' },
];

export default function EmailTemplatesPage() {
  const [items, setItems] = useState<HrEmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<HrEmailTemplate | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [scenario, setScenario] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [variables, setVariables] = useState('');
  const [isActive, setIsActive] = useState(true);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetchHrEmailTemplates();
      setItems(response.items);
    } catch (err) {
      setError(getErrorMessage(err) || '邮件模板加载失败，请确认 /api/v1/hr/email-templates 已就绪。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const openModal = (record?: HrEmailTemplate) => {
    setEditing(record ?? null);
    setName(record?.name ?? '');
    setScenario(record?.scenario ?? '');
    setSubject(record?.subject ?? '');
    setBody(record?.body ?? '');
    setVariables(record?.variables.join(', ') ?? '');
    setIsActive(record?.is_active ?? true);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !scenario.trim() || !subject.trim() || !body.trim()) {
      message.warning('请补全模板名称、场景、标题和正文');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        scenario: scenario.trim(),
        subject: subject.trim(),
        body: body.trim(),
        variables: splitVariables(variables),
        is_active: isActive,
      };
      if (editing) {
        await updateHrEmailTemplate(editing.id, payload);
      } else {
        await createHrEmailTemplate(payload);
      }
      message.success('邮件模板已保存');
      setModalOpen(false);
      await loadTemplates();
    } catch (err) {
      message.error(getErrorMessage(err) || '保存邮件模板失败');
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnsType<HrEmailTemplate> = [
    {
      title: '模板',
      key: 'template',
      width: 260,
      render: (_, record) => (
        <div>
          <p className="font-bold text-slate-900">{record.name}</p>
          <p className="text-xs text-slate-500">{scenarioLabel(record.scenario)}</p>
        </div>
      ),
    },
    {
      title: '邮件标题',
      dataIndex: 'subject',
      key: 'subject',
      render: (value: string) => <span className="font-semibold text-slate-700">{value}</span>,
    },
    {
      title: '变量',
      dataIndex: 'variables',
      key: 'variables',
      width: 280,
      render: (values: string[]) => (
        <div className="flex flex-wrap gap-2">
          {values.length ? values.map((value) => <Tag key={value} className="border-0 bg-slate-100 font-bold text-slate-700">{value}</Tag>) : '无变量'}
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (value: boolean) => value ? <Tag color="green">启用</Tag> : <Tag>停用</Tag>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_, record) => <Button size="small" onClick={() => openModal(record)}>编辑</Button>,
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
            <Tag className="mb-5 border-0 bg-white/10 px-3 py-1 font-bold text-blue-50">邮件模板</Tag>
            <h1 className="text-[34px] font-black tracking-tight">可复用的候选人邮件话术</h1>
            <p className="mt-3 max-w-2xl leading-7 text-blue-100">
              已内置面试邀约、提醒、改期、跟进、拒信和 Offer 意向模板。模板会真实保存到数据库，可编辑后供自动提醒与沟通记录复用。
            </p>
          </div>
          <div className="flex gap-3">
            <Button className="border-white/30 bg-white/10 text-white" icon={<MaterialIcon name="refresh" />} onClick={() => void loadTemplates()}>
              刷新
            </Button>
            <Button type="primary" className="bg-white text-[#071a44]" onClick={() => openModal()}>
              新建模板
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
          locale={{ emptyText: <Empty description="暂无邮件模板" /> }}
          scroll={{ x: 980 }}
        />
      </section>

      <Modal
        title={editing ? '编辑邮件模板' : '新建邮件模板'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
        width={760}
      >
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">模板名称</span>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：一面邀约" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">适用场景</span>
              <Select
                className="w-full"
                value={scenario || undefined}
                onChange={setScenario}
                options={scenarioOptions}
                placeholder="请选择适用场景"
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">邮件标题</span>
            <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="例如：{{岗位名称}} 面试邀约" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">邮件正文</span>
            <Input.TextArea rows={8} value={body} onChange={(event) => setBody(event.target.value)} />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">模板变量（中文逗号分隔）</span>
            <Input value={variables} onChange={(event) => setVariables(event.target.value)} placeholder="候选人姓名, 岗位名称, 面试时间" />
          </label>
          <div className="flex items-center gap-3">
            <Switch checked={isActive} onChange={setIsActive} />
            <span className="font-semibold text-slate-700">启用模板</span>
          </div>
        </div>
      </Modal>
    </div>
  );
}
