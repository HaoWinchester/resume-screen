'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Checkbox, Empty, Input, InputNumber, Modal, Select, Slider, Spin, Tag, message } from 'antd';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchAnalysisList } from '@/lib/api/analysis';
import {
  activateJobRequirement,
  closeJobRequirement,
  copyJobRequirement,
  deleteJobRequirement,
  fetchJobRequirement,
  fetchJobRequirements,
  updateJobRequirement,
} from '@/lib/api/job';
import { createJobSkillOption, fetchJobSkillOptions } from '@/lib/api/jobSkillOption';
import { defaultWeightConfig, resolveWeightConfig } from '@/config/jobOptions';
import {
  getBuiltinJobSkillOptions,
  inferJobSkillCategory,
  mergeSkillOptions,
  toSelectOptions,
  type JobSkillOptionType,
} from '@/lib/jobSkillCatalog';
import type { AnalysisListItem, RecommendationLevel } from '@/types/analysis';
import type { Criteria, EducationLevel, JobRequirement, JobStatus, WeightConfig, WeightLevel } from '@/types/job';

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

function candidateLabel(record: AnalysisListItem) {
  return record.candidate_name || `候选人-${record.resume_id.slice(0, 8)}`;
}

function recommendationLabel(level: RecommendationLevel) {
  if (level === 'strongly_recommended') return '强推荐';
  if (level === 'recommended') return '可沟通';
  return '待确认';
}

function jobStatusMeta(status?: JobStatus) {
  if (status === 'active') return { label: '招聘中', color: 'green', hint: '候选人可上传、解析和进入筛选流程。' };
  if (status === 'closed') return { label: '已结束', color: 'default', hint: '已停止招聘，可重新开启或复制为新岗位。' };
  return { label: '草稿', color: 'gold', hint: '草稿不会进入简历上传和筛选流程，请先开始招聘。' };
}

function candidateSearchText(record: AnalysisListItem) {
  const dimensionText = record.dimension_scores
    .flatMap((item) => {
      const details = item.match_details || {};
      return [
        item.dimension,
        item.analysis_text,
        ...(details.matched_skills || []),
        ...(details.missing_skills || []),
        ...(details.bonus_skills_matched || []),
      ];
    })
    .filter(Boolean)
    .join(' ');
  return [candidateLabel(record), record.recommendation_reason, dimensionText].filter(Boolean).join(' ').toLowerCase();
}

function matchedSkillNames(record: AnalysisListItem) {
  const skills = record.dimension_scores.find((item) => item.dimension === 'skill_match')?.match_details?.matched_skills || [];
  return skills.slice(0, 4);
}

export default function JobsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [jobs, setJobs] = useState<JobRequirement[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [criteria, setCriteria] = useState<Criteria>(defaultCriteria);
  const [title, setTitle] = useState('');
  const [salary, setSalary] = useState<number | null>(120000);
  const [customRequiredOptions, setCustomRequiredOptions] = useState<string[]>([]);
  const [customBonusOptions, setCustomBonusOptions] = useState<string[]>([]);
  const [previewItems, setPreviewItems] = useState<AnalysisListItem[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewRecommendation, setPreviewRecommendation] = useState<RecommendationLevel | 'all'>('all');
  const [previewMinScore, setPreviewMinScore] = useState(0);
  const [previewKeyword, setPreviewKeyword] = useState('');
  const [weights, setWeights] = useState({
    skill_match: 40,
    experience_match: 30,
    project_relevance: 20,
    education: 10,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState('');

  const selectedJob = jobs.find((job) => job.id === selectedJobId);
  const totalWeight = weights.skill_match + weights.experience_match + weights.project_relevance + weights.education;
  const jobSkillCategory = useMemo(() => inferJobSkillCategory(title), [title]);
  const requiredSkillOptions = useMemo(
    () => toSelectOptions(mergeSkillOptions(getBuiltinJobSkillOptions(jobSkillCategory, 'required'), customRequiredOptions, criteria.required_skills)),
    [criteria.required_skills, customRequiredOptions, jobSkillCategory]
  );
  const bonusSkillOptions = useMemo(
    () => toSelectOptions(mergeSkillOptions(getBuiltinJobSkillOptions(jobSkillCategory, 'bonus'), customBonusOptions, criteria.bonus_skills)),
    [criteria.bonus_skills, customBonusOptions, jobSkillCategory]
  );
  const filteredPreviewItems = useMemo(() => {
    const keyword = previewKeyword.trim().toLowerCase();
    return previewItems.filter((item) => {
      if (previewRecommendation !== 'all' && item.recommendation !== previewRecommendation) return false;
      if (item.overall_score < previewMinScore) return false;
      if (!keyword) return true;
      return candidateSearchText(item).includes(keyword);
    });
  }, [previewItems, previewKeyword, previewMinScore, previewRecommendation]);
  const previewAverageScore = filteredPreviewItems.length
    ? Math.round(filteredPreviewItems.reduce((sum, item) => sum + item.overall_score, 0) / filteredPreviewItems.length)
    : 0;

  const applyJob = useCallback((job: JobRequirement) => {
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
  }, []);

  const loadJobs = useCallback(async () => {
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
  }, [applyJob, searchParams]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    const loadCustomOptions = async () => {
      try {
        const [required, bonus] = await Promise.all([
          fetchJobSkillOptions({ job_type: jobSkillCategory, option_type: 'required' }),
          fetchJobSkillOptions({ job_type: jobSkillCategory, option_type: 'bonus' }),
        ]);
        setCustomRequiredOptions(required.map((item) => item.value));
        setCustomBonusOptions(bonus.map((item) => item.value));
      } catch {
        setCustomRequiredOptions([]);
        setCustomBonusOptions([]);
      }
    };
    void loadCustomOptions();
  }, [jobSkillCategory]);

  const loadPreview = useCallback(async () => {
    if (!selectedJobId) {
      setPreviewItems([]);
      return;
    }
    setPreviewLoading(true);
    try {
      const response = await fetchAnalysisList({
        job_requirement_id: selectedJobId,
        sort_by: 'overall_score',
        sort_order: 'desc',
        page: 1,
        per_page: 100,
      });
      setPreviewItems(response.items);
    } catch {
      setPreviewItems([]);
    } finally {
      setPreviewLoading(false);
    }
  }, [selectedJobId]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

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

  const handleEducationCheck = (checkedValues: Array<string | number>) => {
    const education = (checkedValues[checkedValues.length - 1] || '') as EducationLevel;
    setCriteria((prev) => ({ ...prev, education }));
  };

  const persistCustomSkillOptions = async (optionType: JobSkillOptionType, values: string[]) => {
    const builtin = getBuiltinJobSkillOptions(jobSkillCategory, optionType);
    const custom = optionType === 'required' ? customRequiredOptions : customBonusOptions;
    const current = optionType === 'required' ? criteria.required_skills : criteria.bonus_skills;
    const nextValues = mergeSkillOptions(values).filter((value) => !builtin.includes(value) && !custom.includes(value) && !current.includes(value));
    if (nextValues.length === 0) return;

    try {
      const saved = await Promise.all(
        nextValues.map((value) => createJobSkillOption({ job_type: jobSkillCategory, option_type: optionType, value }))
      );
      const savedValues = saved.map((item) => item.value);
      if (optionType === 'required') {
        setCustomRequiredOptions((prev) => mergeSkillOptions(prev, savedValues));
      } else {
        setCustomBonusOptions((prev) => mergeSkillOptions(prev, savedValues));
      }
    } catch {
      message.warning('自定义选项已加入当前岗位，但保存到账户失败，请稍后重试');
    }
  };

  const handleRequiredSkillsChange = (values: string[]) => {
    const normalized = mergeSkillOptions(values);
    const previous = criteria.required_skills;
    setCriteria((prev) => ({ ...prev, required_skills: normalized }));
    void persistCustomSkillOptions('required', normalized.filter((value) => !previous.includes(value)));
  };

  const handleBonusSkillsChange = (values: string[]) => {
    const normalized = mergeSkillOptions(values);
    const previous = criteria.bonus_skills;
    setCriteria((prev) => ({ ...prev, bonus_skills: normalized }));
    void persistCustomSkillOptions('bonus', normalized.filter((value) => !previous.includes(value)));
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

  const reloadJobs = async () => {
    await loadJobs();
    await loadPreview();
  };

  const handleStartRecruiting = async () => {
    if (!selectedJob) return;
    setActionLoading('start');
    try {
      await activateJobRequirement(selectedJob.id);
      message.success('已开始招聘');
      await reloadJobs();
    } catch {
      message.error('开始招聘失败，请确认岗位筛选条件完整');
    } finally {
      setActionLoading('');
    }
  };

  const handleEndRecruiting = () => {
    if (!selectedJob) return;
    Modal.confirm({
      title: '结束招聘',
      content: `确定结束「${selectedJob.title}」的招聘吗？结束后该岗位将不再接收新的简历上传。`,
      okText: '结束招聘',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        setActionLoading('close');
        try {
          await closeJobRequirement(selectedJob.id);
          message.success('已结束招聘');
          await reloadJobs();
        } catch {
          message.error('结束招聘失败');
        } finally {
          setActionLoading('');
        }
      },
    });
  };

  const handleCopyJob = async () => {
    if (!selectedJob) return;
    setActionLoading('copy');
    try {
      const copied = await copyJobRequirement(selectedJob.id);
      message.success('已复制岗位，请确认后开始招聘');
      router.push(`/dashboard/jobs/${copied.id}/edit`);
    } catch {
      message.error('复制岗位失败');
    } finally {
      setActionLoading('');
    }
  };

  const handleDeleteDraft = () => {
    if (!selectedJob) return;
    Modal.confirm({
      title: '删除草稿',
      content: `确定删除「${selectedJob.title}」吗？草稿删除后不可恢复。`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        setActionLoading('delete');
        try {
          await deleteJobRequirement(selectedJob.id);
          message.success('草稿已删除');
          await reloadJobs();
        } catch {
          message.error('删除失败，仅草稿岗位可删除');
        } finally {
          setActionLoading('');
        }
      },
    });
  };

  const openAnalysisResults = () => {
    if (!selectedJobId) return;
    const params = new URLSearchParams({ job: selectedJobId });
    if (previewRecommendation !== 'all') params.set('recommendation', previewRecommendation);
    router.push(`/dashboard/analysis?${params.toString()}`);
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
          配置岗位画像并直接预览当前候选人筛选结果。保存后会影响下一批简历分析，预览区可以立即筛出可沟通人选。
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
                  <Select
                    mode="tags"
                    value={criteria.required_skills}
                    onChange={handleRequiredSkillsChange}
                    tokenSeparators={[',', '，']}
                    placeholder="选择推荐技能，或直接输入自定义技能"
                    options={requiredSkillOptions}
                    bordered={false}
                    className="w-full"
                  />
                </div>
                <span className="mt-2 block text-xs text-slate-500">按“{jobSkillCategory}”推荐；自定义技能会保存到当前账号。</span>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">关键关键词</span>
                <div className="rounded-xl border border-[#c4c5d5] bg-[#f4f2fc] p-3">
                  <Select
                    mode="tags"
                    value={criteria.bonus_skills}
                    onChange={handleBonusSkillsChange}
                    tokenSeparators={[',', '，']}
                    placeholder="选择推荐关键词，或直接输入自定义关键词"
                    options={bonusSkillOptions}
                    bordered={false}
                    className="w-full"
                  />
                </div>
                <span className="mt-2 block text-xs text-slate-500">自定义关键词会绑定当前账号，后续同类岗位可继续选择。</span>
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
          {selectedJob && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-500">当前岗位</p>
                  <h2 className="mt-1 text-xl font-black text-slate-950">{selectedJob.title}</h2>
                </div>
                <Tag color={jobStatusMeta(selectedJob.status).color} className="m-0 px-3 py-1 font-bold">
                  {jobStatusMeta(selectedJob.status).label}
                </Tag>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-500">{jobStatusMeta(selectedJob.status).hint}</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <Button className="h-11 rounded-lg font-bold" onClick={() => router.push(`/dashboard/jobs/${selectedJob.id}/edit`)}>
                  编辑职位
                </Button>
                <Button className="h-11 rounded-lg font-bold" loading={actionLoading === 'copy'} onClick={handleCopyJob}>
                  复制职位
                </Button>
                {selectedJob.status === 'active' ? (
                  <Button danger className="col-span-2 h-11 rounded-lg font-bold" loading={actionLoading === 'close'} onClick={handleEndRecruiting}>
                    结束招聘
                  </Button>
                ) : (
                  <Button
                    type="primary"
                    className="col-span-2 h-11 rounded-lg bg-[#00288e] font-bold"
                    loading={actionLoading === 'start'}
                    onClick={handleStartRecruiting}
                  >
                    {selectedJob.status === 'closed' ? '重新开启招聘' : '开始招聘'}
                  </Button>
                )}
                {selectedJob.status === 'draft' && (
                  <Button danger className="col-span-2 h-11 rounded-lg font-bold" loading={actionLoading === 'delete'} onClick={handleDeleteDraft}>
                    删除草稿
                  </Button>
                )}
              </div>
            </div>
          )}

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

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <MaterialIcon name="filter_alt" className="text-3xl text-[#00288e]" />
              <div>
                <h2 className="text-lg font-semibold">筛选动作</h2>
                <p className="mt-1 text-xs text-slate-500">按当前岗位画像查看候选人结果。</p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <PreviewMetric label="符合条件" value={filteredPreviewItems.length} />
              <PreviewMetric label="平均分" value={previewAverageScore ? `${previewAverageScore}%` : '-'} />
            </div>
            <Button type="primary" className="mt-5 h-12 w-full rounded-lg bg-[#00288e] font-bold" onClick={openAnalysisResults}>
              查看筛选结果
            </Button>
            <Button className="mt-3 h-12 w-full rounded-lg font-bold" onClick={() => void loadPreview()}>
              刷新预览
            </Button>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="h-24 bg-[#00288e] bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,.2)_1px,transparent_1px)] [background-size:18px_18px]" />
            <div className="px-6 pb-6 text-center">
              <span className="-mt-12 inline-flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-slate-200 text-4xl text-slate-600 shadow-lg">
                <MaterialIcon name="tune" className="text-5xl" />
              </span>
              <h3 className="mt-4 text-2xl font-black">{title || '岗位筛选配置'}</h3>
              <p className="mt-2 text-sm">
                权重状态: <span className={`font-bold ${totalWeight === 100 ? 'text-emerald-700' : 'text-amber-700'}`}>{totalWeight === 100 ? '已平衡' : '待调整'}</span>
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <span className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-[#00288e]">总权重: {totalWeight}%</span>
                <span className="rounded-lg bg-[#f4f2fc] px-3 py-2 text-xs font-bold text-slate-600">{criteria.min_experience_years} 年经验</span>
                <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">
                  {criteria.required_skills.length} 个必需技能
                </span>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-[#071a44] p-6 text-white lg:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Tag className="mb-4 border-0 bg-white/10 px-3 py-1 font-bold text-blue-50">即时筛选预览</Tag>
              <h2 className="text-3xl font-black tracking-tight">当前岗位有哪些人符合条件</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">
                这里读取真实分析结果，可以按推荐等级、最低分和技能关键词快速缩小候选人范围。
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <PreviewMetric dark label="总候选人" value={previewItems.length} />
              <PreviewMetric dark label="筛中人数" value={filteredPreviewItems.length} />
              <PreviewMetric dark label="平均分" value={previewAverageScore ? `${previewAverageScore}%` : '-'} />
            </div>
          </div>
        </div>

        <div className="grid gap-4 border-b border-slate-100 p-5 lg:grid-cols-[180px_220px_1fr_160px]">
          <Select
            value={previewRecommendation}
            onChange={setPreviewRecommendation}
            className="h-12"
            options={[
              { label: '全部等级', value: 'all' },
              { label: '强推荐', value: 'strongly_recommended' },
              { label: '可沟通', value: 'recommended' },
              { label: '待确认', value: 'pending' },
            ]}
          />
          <div className="rounded-xl border border-slate-200 px-4 py-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>最低匹配分</span>
              <span className="text-[#00288e]">{previewMinScore}%</span>
            </div>
            <Slider min={0} max={100} value={previewMinScore} onChange={setPreviewMinScore} tooltip={{ formatter: (value) => `${value}%` }} />
          </div>
          <Input
            value={previewKeyword}
            onChange={(event) => setPreviewKeyword(event.target.value)}
            prefix={<MaterialIcon name="search" className="text-slate-400" />}
            placeholder="输入技能、关键词、候选人姓名，例如 React / 高并发 / Figma"
            className="h-12 rounded-xl"
          />
          <Button type="primary" className="h-12 rounded-xl bg-[#00288e] font-bold" onClick={openAnalysisResults}>
            应用筛选
          </Button>
        </div>

        <div className="p-5">
          {previewLoading ? (
            <div className="flex min-h-48 items-center justify-center">
              <Spin />
            </div>
          ) : filteredPreviewItems.length === 0 ? (
            <Empty description="当前条件下暂无候选人，请调整分数或关键词。" />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {filteredPreviewItems.slice(0, 9).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:-translate-y-0.5 hover:border-[#00288e]/40 hover:bg-white hover:shadow-lg"
                  onClick={() => router.push(`/dashboard/analysis/${item.id}`)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-black text-slate-950">{candidateLabel(item)}</p>
                      <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">{item.recommendation_reason || '暂无推荐理由'}</p>
                    </div>
                    <span className="rounded-full bg-[#00288e] px-3 py-2 text-sm font-black text-white">{Math.round(item.overall_score)}%</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Tag className="border-0 bg-emerald-50 px-3 py-1 font-bold text-emerald-700">{recommendationLabel(item.recommendation)}</Tag>
                    {matchedSkillNames(item).map((skill) => (
                      <Tag key={skill} className="border-0 bg-blue-50 px-3 py-1 font-bold text-[#00288e]">{skill}</Tag>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function PreviewMetric({ label, value, dark = false }: { label: string; value: string | number; dark?: boolean }) {
  return (
    <div className={dark ? 'rounded-2xl bg-white/10 p-3' : 'rounded-2xl bg-blue-50 p-3 text-center'}>
      <div className={dark ? 'text-2xl font-black text-white' : 'text-2xl font-black text-[#00288e]'}>{value}</div>
      <div className={dark ? 'mt-1 text-xs font-bold text-blue-100' : 'mt-1 text-xs font-bold text-slate-500'}>{label}</div>
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
