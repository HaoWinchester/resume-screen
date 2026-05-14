'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Alert, Button, Card, Descriptions, Empty, List, Spin, Tag, message } from 'antd';
import { ArrowLeftOutlined, DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { useParams, useRouter } from 'next/navigation';
import { downloadResumeFile, fetchResumeDetail, retryResumeParse } from '@/lib/api/resume';
import type { Certificate, Education, LanguageAbility, Project, Resume, WorkExperience } from '@/types/resume';

function parseStatusLabel(status: Resume['parse_status']) {
  const statusMap = {
    pending: { color: 'default', text: '等待解析' },
    parsing: { color: 'processing', text: '解析中' },
    success: { color: 'success', text: '解析成功' },
    failed: { color: 'error', text: '解析失败' },
  };
  return statusMap[status] || { color: 'default', text: status };
}

function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return '-';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function displayValue(value?: string | number | null) {
  return value === undefined || value === null || value === '' ? '-' : String(value);
}

function renderTextList(values?: string[] | null) {
  const items = Array.isArray(values) ? values.filter(Boolean) : [];
  if (!items.length) return null;
  return (
    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-600">
      {items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  );
}

function SectionList<T>({
  title,
  items,
  renderItem,
  emptyText,
}: {
  title: string;
  items?: T[] | null;
  renderItem: (item: T, index: number) => ReactNode;
  emptyText: string;
}) {
  const data = Array.isArray(items) ? items : [];
  return (
    <Card title={title} className="rounded-2xl shadow-sm">
      {data.length ? (
        <List dataSource={data} renderItem={(item, index) => <List.Item>{renderItem(item, index)}</List.Item>} />
      ) : (
        <Empty description={emptyText} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}
    </Card>
  );
}

export default function ResumeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [resume, setResume] = useState<Resume | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadResume = async () => {
      setLoading(true);
      setError('');
      try {
        setResume(await fetchResumeDetail(id));
      } catch {
        setError('简历详情加载失败，请确认该简历是否仍然存在。');
      } finally {
        setLoading(false);
      }
    };
    void loadResume();
  }, [id]);

  const handleDownload = async () => {
    if (!resume) return;
    try {
      const blob = await downloadResumeFile(resume.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = resume.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      message.success('下载成功');
    } catch {
      message.error('下载失败');
    }
  };

  const handleRetry = async () => {
    if (!resume) return;
    try {
      await retryResumeParse(resume.id);
      message.success('已重新提交解析');
      setResume(await fetchResumeDetail(resume.id));
    } catch {
      message.error('重新解析失败');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  if (error) return <Alert type="error" showIcon message={error} />;
  if (!resume) return <Empty description="暂无简历详情" />;

  const parsed = resume.parsed_data;
  const status = parseStatusLabel(resume.parse_status);

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] bg-[#071a44] p-8 text-white shadow-sm lg:p-10">
        <Button className="mb-6 border-white/30 bg-white/10 text-white" icon={<ArrowLeftOutlined />} onClick={() => router.back()}>
          返回简历库
        </Button>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Tag className="mb-5 border-0 bg-white/10 px-3 py-1 font-bold text-blue-50">简历详情</Tag>
            <h1 className="text-4xl font-black tracking-tight">{displayValue(resume.candidate_name || parsed?.name || '未识别姓名')}</h1>
            <p className="mt-3 text-blue-100">{resume.job_title || '未关联岗位'} · {resume.file_name}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button className="border-white/30 bg-white/10 text-white" icon={<DownloadOutlined />} onClick={handleDownload}>
              下载原文件
            </Button>
            <Button className="bg-white text-[#071a44]" icon={<ReloadOutlined />} onClick={handleRetry}>
              重新解析
            </Button>
          </div>
        </div>
      </section>

      {resume.parse_status === 'failed' && (
        <Alert type="error" showIcon message="解析失败" description={resume.parse_error || '没有返回具体失败原因。'} />
      )}

      {(resume.parse_status === 'pending' || resume.parse_status === 'parsing') && (
        <Alert type="info" showIcon message="简历正在解析中" description="解析完成后，这里会自动展示候选人的结构化信息。" />
      )}

      <Card className="rounded-2xl shadow-sm">
        <Descriptions title="基础信息" bordered column={{ xs: 1, md: 2, xl: 3 }}>
          <Descriptions.Item label="候选人">{displayValue(resume.candidate_name || parsed?.name)}</Descriptions.Item>
          <Descriptions.Item label="邮箱">{displayValue(resume.candidate_email || parsed?.email)}</Descriptions.Item>
          <Descriptions.Item label="电话">{displayValue(resume.candidate_phone || parsed?.phone)}</Descriptions.Item>
          <Descriptions.Item label="性别">{displayValue(parsed?.gender)}</Descriptions.Item>
          <Descriptions.Item label="年龄">{displayValue(parsed?.age)}</Descriptions.Item>
          <Descriptions.Item label="当前职位">{displayValue(parsed?.current_title)}</Descriptions.Item>
          <Descriptions.Item label="期望岗位">{displayValue(parsed?.target_position)}</Descriptions.Item>
          <Descriptions.Item label="所在地">{displayValue(parsed?.location)}</Descriptions.Item>
          <Descriptions.Item label="期望薪资">{displayValue(parsed?.expected_salary)}</Descriptions.Item>
          <Descriptions.Item label="到岗时间">{displayValue(parsed?.availability)}</Descriptions.Item>
          <Descriptions.Item label="工作年限">{displayValue(parsed?.years_of_experience)}</Descriptions.Item>
          <Descriptions.Item label="所属岗位">{displayValue(resume.job_title)}</Descriptions.Item>
          <Descriptions.Item label="解析状态">
            <Tag color={status.color}>{status.text}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="文件类型">{resume.file_type.toUpperCase()}</Descriptions.Item>
          <Descriptions.Item label="文件大小">{formatFileSize(resume.file_size)}</Descriptions.Item>
          <Descriptions.Item label="上传时间">{new Date(resume.created_at).toLocaleString('zh-CN')}</Descriptions.Item>
          <Descriptions.Item label="最近处理">{new Date(resume.updated_at).toLocaleString('zh-CN')}</Descriptions.Item>
        </Descriptions>
      </Card>

      {(parsed?.summary || parsed?.structured_by || parsed?.ai_parse_error) && (
        <Card
          title="AI 结构化结果"
          extra={parsed?.structured_by ? <Tag color={parsed.structured_by.startsWith('ai:') ? 'purple' : 'default'}>{parsed.structured_by}</Tag> : null}
          className="rounded-2xl shadow-sm"
        >
          {parsed.summary ? <p className="leading-7 text-slate-700">{parsed.summary}</p> : <p className="text-slate-500">模型未返回摘要。</p>}
          {parsed.self_evaluation ? <p className="mt-3 leading-7 text-slate-600">自我评价：{parsed.self_evaluation}</p> : null}
          {parsed.ai_parse_error ? <Alert className="mt-4" type="warning" showIcon message="AI 结构化未启用或调用失败，当前使用本地规则结果。" description={parsed.ai_parse_error} /> : null}
        </Card>
      )}

      <Card title="技能标签" className="rounded-2xl shadow-sm">
        {parsed?.skills?.length ? (
          <div className="flex flex-wrap gap-2">
            {parsed.skills.map((skill) => <Tag key={skill} color="blue">{skill}</Tag>)}
          </div>
        ) : (
          <Empty description="暂未识别到技能标签" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </Card>

      <Card
        title="原文预览"
        extra={parsed?.text_extractor ? <Tag color="geekblue">解析工具：{parsed.text_extractor}</Tag> : null}
        className="rounded-2xl shadow-sm"
      >
        {parsed?.raw_text ? (
          <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-950 p-5 text-sm leading-7 text-slate-50">
            {parsed.raw_text}
          </pre>
        ) : (
          <Empty description="暂无可预览的简历原文" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </Card>

      <section className="grid gap-6 xl:grid-cols-2">
        <SectionList<Education>
          title="教育经历"
          items={parsed?.education}
          emptyText="暂未识别到教育经历"
          renderItem={(item, index) => (
            <div className="w-full">
              <p className="font-bold text-slate-900">{displayValue(item.school)} · {displayValue(item.degree)}</p>
              <p className="mt-1 text-sm text-slate-500">{displayValue(item.major)} · {displayValue(item.start_date)} - {displayValue(item.end_date)}</p>
              {item.description ? <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p> : null}
            </div>
          )}
        />
        <SectionList<WorkExperience>
          title="工作经历"
          items={parsed?.work_experience}
          emptyText="暂未识别到工作经历"
          renderItem={(item) => (
            <div className="w-full">
              <p className="font-bold text-slate-900">{displayValue(item.company)} · {displayValue(item.position)}</p>
              <p className="mt-1 text-sm text-slate-500">{displayValue(item.start_date)} - {displayValue(item.end_date)}</p>
              {item.description ? <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p> : null}
              {renderTextList(item.responsibilities)}
              {renderTextList(item.achievements)}
              {item.technologies?.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {item.technologies.map((tech) => <Tag key={tech}>{tech}</Tag>)}
                </div>
              ) : null}
            </div>
          )}
        />
      </section>

      <SectionList<Project>
        title="项目经历"
        items={parsed?.projects}
        emptyText="暂未识别到项目经历"
        renderItem={(item) => (
          <div className="w-full">
            <p className="font-bold text-slate-900">{displayValue(item.name)} · {displayValue(item.role)}</p>
            {(item.start_date || item.end_date) ? <p className="mt-1 text-sm text-slate-500">{displayValue(item.start_date)} - {displayValue(item.end_date)}</p> : null}
            {item.description ? <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p> : null}
            {renderTextList(item.responsibilities)}
            {renderTextList(item.achievements)}
            {item.technologies?.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {item.technologies.map((tech) => <Tag key={tech}>{tech}</Tag>)}
              </div>
            ) : null}
          </div>
        )}
      />

      <section className="grid gap-6 xl:grid-cols-3">
        <SectionList<Certificate>
          title="证书资质"
          items={parsed?.certificates}
          emptyText="暂未识别到证书资质"
          renderItem={(item) => (
            <div className="w-full">
              <p className="font-bold text-slate-900">{displayValue(item.name)}</p>
              <p className="mt-1 text-sm text-slate-500">{displayValue(item.issuer)} · {displayValue(item.date)}</p>
            </div>
          )}
        />
        <SectionList<LanguageAbility>
          title="语言能力"
          items={parsed?.languages}
          emptyText="暂未识别到语言能力"
          renderItem={(item) => (
            <div className="w-full">
              <p className="font-bold text-slate-900">{displayValue(item.name)}</p>
              <p className="mt-1 text-sm text-slate-500">{displayValue(item.level)}</p>
            </div>
          )}
        />
        <SectionList<string>
          title="奖项荣誉"
          items={parsed?.awards}
          emptyText="暂未识别到奖项荣誉"
          renderItem={(item) => <p className="text-sm leading-6 text-slate-700">{item}</p>}
        />
      </section>
    </div>
  );
}
