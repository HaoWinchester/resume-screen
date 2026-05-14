'use client';

import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Checkbox, Empty, Input, Select, Spin, Tag, message } from 'antd';
import { useRouter } from 'next/navigation';
import { importChannelCandidates } from '@/lib/api/channels';
import { fetchJobRequirements } from '@/lib/api/job';
import type { ChannelContentFormat, ChannelPlatform } from '@/types/channels';
import type { JobRequirementListItem } from '@/types/job';

const { TextArea } = Input;

function MaterialIcon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

const platformOptions: Array<{ label: string; value: ChannelPlatform; hint: string }> = [
  { label: 'BOSS直聘', value: 'boss_zhipin', hint: '粘贴已沟通/已下载候选人的页面文本或导出内容' },
  { label: '猎聘', value: 'liepin', hint: '适合企业账号授权查看后的候选人资料' },
  { label: '拉勾', value: 'lagou', hint: '适合技术岗位候选人资料导入' },
  { label: '邮件投递', value: 'email', hint: '从邮箱简历正文或附件解析结果导入' },
  { label: '其他渠道', value: 'other', hint: '线下推荐、人才库、公开授权页面等' },
];

function splitCandidateBlocks(content: string) {
  return content
    .split(/\n\s*---+\s*\n/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function ChannelImportPage() {
  const router = useRouter();
  const [jobOptions, setJobOptions] = useState<JobRequirementListItem[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [platform, setPlatform] = useState<ChannelPlatform>('boss_zhipin');
  const [contentFormat, setContentFormat] = useState<ChannelContentFormat>('text');
  const [candidateName, setCandidateName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [content, setContent] = useState('');
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<{
    total_imported: number;
    total_failed: number;
  } | null>(null);

  useEffect(() => {
    void loadActiveJobs();
  }, []);

  const selectedPlatform = platformOptions.find((item) => item.value === platform) || platformOptions[0];
  const candidateBlocks = useMemo(() => splitCandidateBlocks(content), [content]);

  const loadActiveJobs = async () => {
    setLoadingJobs(true);
    try {
      const response = await fetchJobRequirements({ status: 'active', per_page: 100 });
      setJobOptions(response.items);
      if (response.items[0]) {
        setSelectedJobId(response.items[0].id);
      }
    } catch {
      message.error('加载活跃岗位失败');
    } finally {
      setLoadingJobs(false);
    }
  };

  const handleImport = async () => {
    if (!selectedJobId) {
      message.warning('请先选择目标岗位');
      return;
    }
    if (!consentConfirmed) {
      message.warning('请先确认候选人数据来源已获得授权');
      return;
    }
    if (candidateBlocks.length === 0) {
      message.warning('请粘贴候选人简历文本或授权页面内容');
      return;
    }

    setSubmitting(true);
    setLastResult(null);
    try {
      const response = await importChannelCandidates({
        job_requirement_id: selectedJobId,
        source_platform: platform,
        consent_confirmed: consentConfirmed,
        candidates: candidateBlocks.map((block, index) => ({
          content: block,
          content_format: contentFormat,
          candidate_name: index === 0 ? candidateName.trim() || undefined : undefined,
          source_url: index === 0 ? sourceUrl.trim() || undefined : undefined,
        })),
      });
      setLastResult({
        total_imported: response.total_imported,
        total_failed: response.total_failed,
      });
      message.success(`导入完成：${response.total_imported} 位候选人已进入自动筛选`);
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '导入失败，请检查内容格式');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingJobs) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  if (jobOptions.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-12 shadow-sm">
        <Empty description="暂无可导入候选人的活跃岗位">
          <Button type="primary" className="bg-[#00288e]" onClick={() => router.push('/dashboard/jobs/new')}>
            创建岗位
          </Button>
        </Empty>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] bg-[#071a44] text-white shadow-sm">
        <div className="grid gap-8 p-8 lg:grid-cols-[1.4fr_0.8fr] lg:p-10">
          <div>
            <Tag className="mb-5 border-0 bg-white/10 px-3 py-1 font-bold text-blue-50">渠道候选人自动筛选</Tag>
            <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-tight">
              不上传简历，也能把授权渠道候选人送进 AI 推荐队列
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-blue-100">
              粘贴 HR 已授权查看、候选人主动投递或平台允许导出的候选人资料。系统会自动抽取姓名、联系方式、技能和经验，并按岗位要求生成推荐结果。
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-6">
            <MaterialIcon name="policy" className="text-4xl text-blue-100" />
            <h2 className="mt-4 text-xl font-black">合规边界</h2>
            <p className="mt-3 text-sm leading-7 text-blue-100">
              当前版本不绕过登录、不破解反爬、不抓取未授权简历。后续如果拿到平台官方接口或企业授权导出，我们直接接入这个渠道层。
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_380px]">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-black text-[#1a1b22]">导入候选人资料</h2>
              <p className="mt-1 text-sm text-slate-600">多位候选人可用单独一行 `---` 分隔。</p>
            </div>
            <Tag color="blue">待导入 {candidateBlocks.length} 位</Tag>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label>
              <span className="mb-2 block text-sm font-bold text-slate-700">目标岗位</span>
              <Select
                value={selectedJobId}
                onChange={setSelectedJobId}
                className="h-12 w-full"
                options={jobOptions.map((job) => ({ label: job.title, value: job.id }))}
              />
            </label>
            <label>
              <span className="mb-2 block text-sm font-bold text-slate-700">来源渠道</span>
              <Select
                value={platform}
                onChange={setPlatform}
                className="h-12 w-full"
                options={platformOptions.map((item) => ({ label: item.label, value: item.value }))}
              />
            </label>
            <label>
              <span className="mb-2 block text-sm font-bold text-slate-700">候选人姓名（可选）</span>
              <Input
                value={candidateName}
                onChange={(event) => setCandidateName(event.target.value)}
                placeholder="如果页面中姓名不明显，可手动填写"
                className="h-12"
              />
            </label>
            <label>
              <span className="mb-2 block text-sm font-bold text-slate-700">来源链接（可选）</span>
              <Input
                value={sourceUrl}
                onChange={(event) => setSourceUrl(event.target.value)}
                placeholder="用于追溯来源，不会自动绕权抓取"
                className="h-12"
              />
            </label>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-700">内容格式</span>
              <span className="text-xs text-slate-500">系统只处理你实际粘贴的授权候选人资料</span>
            </div>
            <Select
              value={contentFormat}
              onChange={setContentFormat}
              className="mb-3 h-11 w-44"
              options={[
                { label: '纯文本', value: 'text' },
                { label: 'HTML', value: 'html' },
              ]}
            />
            <TextArea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={14}
              placeholder="粘贴候选人简历正文、邮件正文、授权导出的页面文本或 HTML..."
              className="rounded-xl"
            />
          </div>

          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <Checkbox checked={consentConfirmed} onChange={(event) => setConsentConfirmed(event.target.checked)}>
              我确认这些候选人信息来自平台授权查看、候选人主动投递、邮件投递、官方导出，或其他合法可处理来源。
            </Checkbox>
          </div>

          {lastResult && (
            <Alert
              className="mt-5"
              type={lastResult.total_failed > 0 ? 'warning' : 'success'}
              showIcon
              message={`导入完成：${lastResult.total_imported} 位成功，${lastResult.total_failed} 位失败`}
              description="成功导入的候选人已进入 AI 匹配队列，可前往候选人结果页查看推荐分数。"
            />
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button
              type="primary"
              loading={submitting}
              onClick={handleImport}
              icon={<MaterialIcon name="auto_awesome" />}
              className="h-12 rounded-lg bg-[#00288e] px-8 font-black"
            >
              导入并自动筛选
            </Button>
            <Button className="h-12 rounded-lg px-8" onClick={() => router.push(`/dashboard/analysis?job=${selectedJobId}`)}>
              查看候选人结果
            </Button>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-black text-[#1a1b22]">{selectedPlatform.label} 导入建议</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">{selectedPlatform.hint}</p>
            <div className="mt-5 space-y-3 text-sm text-slate-600">
              <div className="flex gap-3">
                <MaterialIcon name="check_circle" className="text-emerald-600" />
                <span>优先导入已沟通、已投递、已下载或候选人授权资料。</span>
              </div>
              <div className="flex gap-3">
                <MaterialIcon name="check_circle" className="text-emerald-600" />
                <span>系统会保留来源渠道，方便后续追溯候选人来源。</span>
              </div>
              <div className="flex gap-3">
                <MaterialIcon name="block" className="text-red-500" />
                <span>不要导入无权访问、绕过平台限制或明显敏感的个人信息。</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-[#f4f7ff] p-6">
            <MaterialIcon name="hub" className="text-4xl text-[#00288e]" />
            <h2 className="mt-4 text-lg font-black text-[#1a1b22]">后续可扩展</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              这个入口后面可以接官方 API、企业导出 CSV、邮件自动转发、浏览器插件采集当前页正文。核心解析和推荐逻辑不需要重写。
            </p>
          </div>
        </aside>
      </section>
    </div>
  );
}
