'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, Form, Input, Spin, Tag, message } from 'antd';
import { getErrorMessage } from '@/lib/api';
import { fetchCompanyInfo, updateCompanyInfo } from '@/lib/api/team';
import { useAuthStore } from '@/lib/auth';
import type { Company } from '@/types/team';

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

export default function SettingsPage() {
  const { user } = useAuthStore();
  const [form] = Form.useForm();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const info = await fetchCompanyInfo();
        setCompany(info);
        form.setFieldsValue({
          name: info.name,
          industry: info.industry || '',
          contact_name: info.contact_name || user?.name || '',
          contact_phone: info.contact_phone || '',
          contact_email: info.contact_email || user?.email || '',
        });
      } catch (err) {
        setError(getErrorMessage(err) || '基础信息加载失败');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [form, user?.email, user?.name]);

  const handleSave = async (values: {
    name: string;
    industry?: string;
    contact_name?: string;
    contact_phone?: string;
    contact_email?: string;
  }) => {
    setSaving(true);
    try {
      const nextCompany = await updateCompanyInfo({
        name: values.name.trim(),
        industry: values.industry?.trim() || null,
        contact_name: values.contact_name?.trim() || null,
        contact_phone: values.contact_phone?.trim() || null,
        contact_email: values.contact_email?.trim() || null,
      });
      setCompany(nextCompany);
      message.success('基础信息已保存，后续面试邮件会自动带上联系人和联系电话');
    } catch (err) {
      message.error(getErrorMessage(err) || '保存基础信息失败');
    } finally {
      setSaving(false);
    }
  };

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
        <Tag className="mb-5 border-0 bg-white/10 px-3 py-1 font-bold text-blue-50">系统设置</Tag>
        <h1 className="text-[32px] font-black tracking-tight">基础信息配置</h1>
        <p className="mt-3 text-blue-100">配置公司和 HR 联系方式。安排面试时，邮件会自动包含联系人和联系电话。</p>
      </section>

      {error ? <Alert type="error" showIcon message={error} /> : null}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <Form form={form} layout="vertical" onFinish={handleSave} requiredMark={false}>
            <div className="grid gap-4 md:grid-cols-2">
              <Form.Item name="name" label="公司名称" rules={[{ required: true, message: '请输入公司名称' }]}>
                <Input placeholder="例如：幻谱科技" />
              </Form.Item>
              <Form.Item name="industry" label="所属行业">
                <Input placeholder="例如：人工智能 / 互联网 / 制造业" />
              </Form.Item>
              <Form.Item name="contact_name" label="联系人" rules={[{ required: true, message: '请输入联系人' }]}>
                <Input placeholder="例如：张经理 / HR Talent" />
              </Form.Item>
              <Form.Item name="contact_phone" label="联系电话" rules={[{ required: true, message: '请输入联系电话' }]}>
                <Input placeholder="例如：13800000000 / 021-xxxxxxx" />
              </Form.Item>
              <Form.Item
                name="contact_email"
                label="联系邮箱"
                rules={[{ type: 'email', message: '请输入有效邮箱' }]}
                className="md:col-span-2"
              >
                <Input placeholder="可选。填写后会一起出现在面试邮件中" />
              </Form.Item>
            </div>
            <div className="mt-4 flex justify-end">
              <Button type="primary" htmlType="submit" loading={saving} className="h-11 rounded-lg bg-[#00288e] px-8 font-bold">
                保存基础信息
              </Button>
            </div>
          </Form>
        </div>

        <aside className="rounded-2xl border border-blue-100 bg-blue-50 p-6 text-slate-700">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#00288e] text-white">
            <MaterialIcon name="mail" fill />
          </div>
          <h2 className="mt-5 text-xl font-black text-slate-900">邮件使用规则</h2>
          <p className="mt-3 text-sm leading-7">
            候选人面试通知会使用这里配置的联系人和联系电话。若缺少联系人或联系电话，系统会阻止保存面试安排，防止发出不完整通知。
          </p>
          <div className="mt-5 rounded-xl bg-white p-4 text-sm">
            <p className="font-bold text-slate-900">当前公司</p>
            <p className="mt-1 text-slate-500">{company?.name || '-'}</p>
          </div>
        </aside>
      </section>
    </div>
  );
}
