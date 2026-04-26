'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Checkbox, Empty, Input, InputNumber, Select, Slider, Spin, Tag, message } from 'antd';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchJobRequirement, fetchJobRequirements, updateJobRequirement } from '@/lib/api/job';
import { defaultWeightConfig, resolveWeightConfig } from '@/config/jobOptions';
import type { Criteria, EducationLevel, JobRequirement, WeightConfig, WeightLevel } from '@/types/job';

function MaterialIcon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

const degreeChecks = [
  { label: '学士学位', value: 'bachelor' },
  { label: '硕士学位', value: 'master' },
  { label: '博士学位', value: 'doctor' },
  { label: '训练营学员', value: 'vocational' },
  { label: '自学成才', value: 'associate' },
];

const defaultCriteria: Criteria = {
  required_skills: ['React.js', 'TypeScript', 'Node.js'],
  bonus_skills: ['AWS', '微服务', '领导力'],
  min_experience_years: 3,
  education: 'bachelor',
  industry_preference: [],
  languages: [],
  weights: defaultWeightConfig,
  other_requirements: '',
};

function levelToPercent(level?: WeightLevel) {
  if (level === 'high') return 40;
  if (level === 'low') return 10;
  return 30;
}

function percentToLevel(percent: number): WeightLevel {
  if (percent >= 35) return 'high';
  if (percent <= 15) return 'low';
  return 'medium';
}

export default function JobsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [jobs, setJobs] = useState<JobRequirement[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [criteria, setCriteria] = useState<Criteria>(defaultCriteria);
  const [title, setTitle] = useState('');
  const [skillInput, setSkillInput] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [salary, setSalary] = useState<number | null>(120000);
  const [weights, setWeights] = useState({
    skill_match: 40,
    experience_match: 30,
    project_relevance: 20,
    education: 10,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadJobs();
  }, []);

  const selectedJob = jobs.find((job) => job.id === selectedJobId);
  const totalWeight = weights.skill_match + weights.experience_match + weights.project_relevance + weights.education;

  const loadJobs = async () => {
    setLoading(true);
    try {
      const response = await fetchJobRequirements({ per_page: 100 });
      const jobIds = response.items.map((job) => job.id);
      const details = await Promise.all(jobIds.map((id) => fetchJobRequirement(id)));
      setJobs(details);

      const requestedJob = searchParams.get('job');
      const initial = details.find((job) => job.id === requestedJob) || details.find((job) => job.status === 'active') || details[0];
      if (initial) {
        applyJob(initial);
      }
    } catch {
      message.error('加载岗位筛选条件失败');
    } finally {
      setLoading(false);
    }
  };

  const applyJob = (job: JobRequirement) => {
    const nextCriteria = {
      ...defaultCriteria,
      ...job.criteria,
      weights: resolveWeightConfig(job.criteria?.weights),
    };
    setSelectedJobId(job.id);
    setTitle(job.title);
    setCriteria(nextCriteria);
    setWeights({
      skill_match: levelToPercent(nextCriteria.weights.skill_match),
      experience_match: levelToPercent(nextCriteria.weights.experience_match),
      project_relevance: levelToPercent(nextCriteria.weights.project_relevance),
      education: levelToPercent(nextCriteria.weights.education),
    });
  };

  const normalizedWeights: WeightConfig = useMemo(
    () => ({
      skill_match: percentToLevel(weights.skill_match),
      experience_match: percentToLevel(weights.experience_match),
      project_relevance: percentToLevel(weights.project_relevance),
      education: percentToLevel(weights.education),
      overall_quality: percentToLevel(Math.max(10, 100 - totalWeight)),
    }),
    [totalWeight, weights]
  );

  const addRequiredSkill = () => {
    const value = skillInput.trim();
    if (!value) return;
    if (criteria.required_skills.includes(value)) {
      setSkillInput('');
      return;
    }
    setCriteria((prev) => ({ ...prev, required_skills: [...prev.required_skills, value] }));
    setSkillInput('');
  };

  const addKeyword = () => {
    const value = keywordInput.trim();
    if (!value) return;
    if (criteria.bonus_skills.includes(value)) {
      setKeywordInput('');
      return;
    }
    setCriteria((prev) => ({ ...prev, bonus_skills: [...prev.bonus_skills, value] }));
    setKeywordInput('');
  };

  const removeRequiredSkill = (skill: string) => {
    setCriteria((prev) => ({ ...prev, required_skills: prev.required_skills.filter((item) => item !== skill) }));
  };

  const removeKeyword = (keyword: string) => {
    setCriteria((prev) => ({ ...prev, bonus_skills: prev.bonus_skills.filter((item) => item !== keyword) }));
  };

  const handleEducationCheck = (checkedValues: Array<string | number>) => {
    const education = (checkedValues[checkedValues.length - 1] || '') as EducationLevel;
    setCriteria((prev) => ({ ...prev, education }));
  };

  const handleSave = async () => {
    if (!selectedJobId) {
      message.warning('请先选择一个岗位');
      return;
    }
    if (!title.trim()) {
      message.warning('岗位名称不能为空');
      return;
    }

    setSaving(true);
    try {
      await updateJobRequirement(selectedJobId, {
        title,
        criteria: {
          ...criteria,
          weights: normalizedWeights,
          other_requirements: [
            criteria.other_requirements,
            salary ? `最低年薪要求：${salary}` : '',
          ]
            .filter(Boolean)
            .join('\n'),
        },
      });
      message.success('筛选配置已保存，将应用于下一批简历分析');
      await loadJobs();
    } catch {
      message.error('保存失败，请确认该岗位允许编辑筛选条件');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (selectedJob) {
      applyJob(selectedJob);
      message.info('已恢复为当前岗位保存的设置');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-12 shadow-sm">
        <Empty description="还没有可配置的岗位">
          <Button type="primary" className="bg-[#00288e]" onClick={() => router.push('/dashboard/jobs/new')}>
            发布新职位
          </Button>
        </Empty>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="max-w-3xl">
        <h1 className="text-[32px] font-bold leading-tight tracking-tight text-[#1a1b22]">搜索筛选设置</h1>
        <p className="mt-2 text-base leading-7 text-slate-700">
          配置您的简历筛选标准，以自动对顶尖人才进行排名和优先级排序。您的设置将应用于下一批简历分析。
        </p>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_380px]">
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 grid gap-4 md:grid-cols-[1fr_220px]">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">目标岗位</span>
                <Input value={title} onChange={(event) => setTitle(event.target.value)} className="h-12 rounded-lg bg-[#f4f2fc]" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">切换岗位</span>
                <Select
                  value={selectedJobId}
                  onChange={(jobId) => {
                    const job = jobs.find((item) => item.id === jobId);
                    if (job) applyJob(job);
                  }}
                  className="h-12 w-full"
                  options={jobs.map((job) => ({ label: job.title, value: job.id }))}
                />
              </label>
            </div>

            <div className="mb-5 flex items-center gap-3">
              <MaterialIcon name="psychology" className="text-3xl text-[#00288e]" />
              <h2 className="text-lg font-semibold">技术专长与关键词</h2>
            </div>

            <div className="space-y-6">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">技术技能（标签）</span>
                <div className="min-h-28 rounded-xl border border-[#c4c5d5] bg-[#f4f2fc] p-3">
                  <div className="flex flex-wrap gap-2">
                    {criteria.required_skills.map((skill) => (
                      <Tag
                        key={skill}
                        closable
                        closeIcon={<MaterialIcon name="close" className="text-base" />}
                        onClose={() => removeRequiredSkill(skill)}
                        className="rounded-full border-0 bg-[#dde1ff] px-3 py-1 text-sm font-semibold text-[#001453]"
                      >
                        {skill}
                      </Tag>
                    ))}
                    <Input
                      bordered={false}
                      value={skillInput}
                      onChange={(event) => setSkillInput(event.target.value)}
                      onPressEnter={addRequiredSkill}
                      placeholder="添加技能..."
                      className="min-w-32 flex-1 bg-transparent"
                    />
                  </div>
                </div>
                <span className="mt-2 block text-xs text-slate-500">按回车键添加多个技能。</span>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">关键关键词</span>
                <div className="rounded-xl border border-[#c4c5d5] bg-[#f4f2fc] p-3">
                  <div className="mb-3 flex flex-wrap gap-2">
                    {criteria.bonus_skills.map((keyword) => (
                      <Tag
                        key={keyword}
                        closable
                        closeIcon={<MaterialIcon name="close" className="text-base" />}
                        onClose={() => removeKeyword(keyword)}
                        className="rounded-full border-0 bg-white px-3 py-1 text-sm font-semibold text-[#00288e]"
                      >
                        {keyword}
                      </Tag>
                    ))}
                  </div>
                  <Input.TextArea
                    bordered={false}
                    autoSize={{ minRows: 3 }}
                    value={keywordInput}
                    onChange={(event) => setKeywordInput(event.target.value)}
                    onPressEnter={(event) => {
                      event.preventDefault();
                      addKeyword();
                    }}
                    placeholder="例如：AWS, 微服务, 领导力, 敏捷开发, 全栈..."
                    className="bg-transparent"
                  />
                </div>
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <MaterialIcon name="history_edu" className="text-3xl text-[#00288e]" />
              <h2 className="text-lg font-semibold">工作经验与教育背景</h2>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <label>
                <span className="mb-2 block text-sm font-bold text-slate-700">经验等级</span>
                <Select
                  value={criteria.min_experience_years}
                  onChange={(value) => setCriteria((prev) => ({ ...prev, min_experience_years: value }))}
                  className="h-12 w-full"
                  options={[
                    { label: '初级（0-2 年）', value: 0 },
                    { label: '中高级（3-5 年）', value: 3 },
                    { label: '资深（5 年及以上）', value: 5 },
                    { label: '专家（10 年及以上）', value: 10 },
                  ]}
                />
              </label>
              <label>
                <span className="mb-2 block text-sm font-bold text-slate-700">最低年薪要求</span>
                <InputNumber
                  value={salary}
                  onChange={setSalary}
                  prefix="￥"
                  min={0}
                  step={10000}
                  className="h-12 w-full rounded-lg bg-[#f4f2fc]"
                />
              </label>
            </div>

            <div className="mt-6">
              <span className="mb-3 block text-sm font-bold text-slate-700">教育要求</span>
              <Checkbox.Group value={criteria.education ? [criteria.education] : []} onChange={handleEducationCheck} className="grid w-full grid-cols-1 gap-4 md:grid-cols-3">
                {degreeChecks.map((item) => (
                  <Checkbox key={item.value} value={item.value} className="m-0 rounded-xl border border-[#c4c5d5] bg-[#f4f2fc] px-4 py-3 font-semibold">
                    {item.label}
                  </Checkbox>
                ))}
              </Checkbox.Group>
            </div>

            <label className="mt-6 block">
              <span className="mb-2 block text-sm font-bold text-slate-700">其他要求</span>
              <Input.TextArea
                value={criteria.other_requirements}
                onChange={(event) => setCriteria((prev) => ({ ...prev, other_requirements: event.target.value }))}
                rows={4}
                placeholder="可填写团队规模、管理经验、行业背景、语言要求等..."
                className="rounded-xl bg-[#f4f2fc]"
              />
            </label>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <MaterialIcon name="analytics" className="text-3xl text-[#00288e]" />
              <h2 className="text-lg font-semibold">评分权重</h2>
            </div>
            <p className="mb-6 text-sm leading-6 text-slate-600">调整各部分的权重以计算最终候选人得分（0-100）。</p>

            <WeightSlider label="技术技能" value={weights.skill_match} onChange={(value) => setWeights((prev) => ({ ...prev, skill_match: value }))} />
            <WeightSlider label="工作经验" value={weights.experience_match} onChange={(value) => setWeights((prev) => ({ ...prev, experience_match: value }))} />
            <WeightSlider label="关键词匹配" value={weights.project_relevance} onChange={(value) => setWeights((prev) => ({ ...prev, project_relevance: value }))} />
            <WeightSlider label="教育背景" value={weights.education} onChange={(value) => setWeights((prev) => ({ ...prev, education: value }))} />

            <div className="mt-5 rounded-xl bg-blue-50 p-4 text-sm font-semibold text-[#00288e]">
              总计权重: {totalWeight}%
              <p className="mt-1 text-xs font-normal text-blue-700">与当前职位需求完美平衡</p>
            </div>

            <Button
              type="primary"
              icon={<MaterialIcon name="save" className="text-xl" />}
              loading={saving}
              onClick={handleSave}
              className="mt-6 h-14 w-full rounded-lg bg-[#00288e] text-lg font-bold"
            >
              保存配置
            </Button>
            <Button onClick={handleReset} className="mt-4 h-14 w-full rounded-lg text-lg font-bold">
              恢复默认设置
            </Button>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="h-24 bg-[#00288e] bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,.2)_1px,transparent_1px)] [background-size:18px_18px]" />
            <div className="px-6 pb-6 text-center">
              <span className="-mt-12 inline-flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-slate-200 text-4xl text-slate-600 shadow-lg">
                <MaterialIcon name="rocket_launch" className="text-5xl" />
              </span>
              <h3 className="mt-4 text-2xl font-black">{title || '资深前端开发工程师'}</h3>
              <p className="mt-2 text-sm">
                匹配状态: <span className="font-bold text-emerald-700">高度匹配</span>
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <span className="rounded-lg bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-700">匹配度: 94%</span>
                <span className="rounded-lg bg-[#f4f2fc] px-3 py-2 text-xs font-bold text-slate-600">{criteria.min_experience_years} 年经验</span>
              </div>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

function WeightSlider({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="mb-6">
      <div className="mb-2 flex justify-between">
        <span className="font-semibold text-[#1a1b22]">{label}</span>
        <span className="font-black text-[#00288e]">{value}%</span>
      </div>
      <Slider min={0} max={50} value={value} onChange={onChange} tooltip={{ formatter: (nextValue) => `${nextValue}%` }} />
    </div>
  );
}
