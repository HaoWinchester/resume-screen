'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Dropdown, Popconfirm, Select, Space, Spin, Table, Tag, message } from 'antd';
import type { ColumnsType, TableProps } from 'antd/es/table';
import { useRouter, useSearchParams } from 'next/navigation';
import { deleteResume } from '@/lib/api/resume';
import { exportAnalysis, fetchAnalysisList } from '@/lib/api/analysis';
import { fetchJobRequirements } from '@/lib/api/job';
import type { AnalysisListItem, AnalysisStatistics, DimensionType, RecommendationLevel } from '@/types/analysis';
import type { JobRequirementListItem } from '@/types/job';

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

function scoreColor(score: number) {
  if (score >= 85) return '#6cf8bb';
  if (score >= 75) return '#b8c4ff';
  return '#c4c5d5';
}

function candidateLabel(record?: AnalysisListItem | null) {
  if (!record) return '候选人';
  return record.candidate_name || `候选人-${record.resume_id.slice(0, 8)}`;
}

function getCandidateExperienceYears(record?: AnalysisListItem | null) {
  const value = record?.dimension_scores.find((item) => item.dimension === 'experience_match')?.match_details?.years_of_experience;
  return typeof value === 'number' ? value : null;
}

function dimensionLabel(dimension: DimensionType) {
  const labels = {
    skill_match: '技能匹配',
    experience_match: '经验匹配',
    education: '教育背景',
    project_relevance: '项目相关',
    overall_quality: '整体质量',
  };
  return labels[dimension];
}

export default function AnalysisPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [jobs, setJobs] = useState<JobRequirementListItem[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [analyses, setAnalyses] = useState<AnalysisListItem[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<AnalysisListItem | null>(null);
  const [statistics, setStatistics] = useState<AnalysisStatistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [recommendationFilter, setRecommendationFilter] = useState<RecommendationLevel | 'all'>('all');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });

  useEffect(() => {
    void loadJobs();
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!selectedJobId) return;
    void loadAnalyses();
    startAutoRefresh();
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [selectedJobId, recommendationFilter, pagination.current, pagination.pageSize]);

  const loadJobs = async () => {
    try {
      const response = await fetchJobRequirements({ status: 'active', per_page: 100 });
      const sortedJobs = [...response.items].sort((a, b) => {
        const aTime = new Date(a.created_at).getTime();
        const bTime = new Date(b.created_at).getTime();
        return bTime - aTime;
      });
      setJobs(sortedJobs);
      if (sortedJobs.length > 0) {
        const requestedJobId = searchParams.get('job');
        const requestedJob = sortedJobs.find((job) => job.id === requestedJobId);
        const jobWithResults =
          requestedJob ||
          sortedJobs.find((job) => job.analyzed_count > 0) ||
          sortedJobs.find((job) => job.resume_count > 0) ||
          sortedJobs[0];
        setSelectedJobId(jobWithResults.id);
      }
    } catch {
      message.error('加载岗位列表失败');
    }
  };

  const startAutoRefresh = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    intervalRef.current = setInterval(() => {
      void loadAnalyses(true);
    }, 5000);
  };

  const loadAnalyses = async (silent = false) => {
    if (!selectedJobId) return;
    if (!silent) setLoading(true);

    try {
      const response = await fetchAnalysisList({
        job_requirement_id: selectedJobId,
        sort_by: 'overall_score',
        sort_order: 'desc',
        recommendation: recommendationFilter !== 'all' ? recommendationFilter : undefined,
        page: pagination.current,
        per_page: pagination.pageSize,
      });
      setAnalyses(response.items);
      setStatistics(response.statistics);
      setPagination({ current: response.page, pageSize: response.per_page, total: response.total });
      setSelectedCandidate((current) => {
        if (current && response.items.some((item) => item.id === current.id)) {
          return current;
        }
        return response.items[0] || null;
      });

      if (response.statistics.pending === 0 && response.statistics.failed === 0 && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    } catch {
      if (!silent) message.error('加载候选人结果失败');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleExport = async (format: 'xlsx' | 'csv') => {
    if (!selectedJobId) {
      message.warning('请先选择岗位');
      return;
    }

    try {
      const blob = await exportAnalysis({
        job_requirement_id: selectedJobId,
        format,
        recommendation: recommendationFilter !== 'all' ? recommendationFilter : undefined,
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `candidates_${selectedJobId}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      message.success('导出成功');
    } catch {
      message.error('导出失败');
    }
  };

  const handleDeleteResume = async (record: AnalysisListItem) => {
    try {
      await deleteResume(record.resume_id);
      message.success('简历已删除，分析结果已同步移除');
      await loadAnalyses();
    } catch {
      message.error('删除简历失败');
    }
  };

  const handleTableChange: TableProps<AnalysisListItem>['onChange'] = (newPagination) => {
    setPagination({
      current: newPagination.current || 1,
      pageSize: newPagination.pageSize || 10,
      total: newPagination.total || 0,
    });
  };

  const selectedJob = jobs.find((job) => job.id === selectedJobId);
  const minScore = analyses.length > 0 ? Math.min(...analyses.map((item) => Math.round(item.overall_score))) : 85;
  const skillDetails = selectedCandidate?.dimension_scores.find((item) => item.dimension === 'skill_match')?.match_details;
  const experienceDetails = selectedCandidate?.dimension_scores.find((item) => item.dimension === 'experience_match')?.match_details;
  const topSkill = skillDetails?.matched_skills?.[0] || skillDetails?.bonus_skills_matched?.[0] || '暂无';
  const experienceYears = typeof experienceDetails?.years_of_experience === 'number' ? experienceDetails.years_of_experience : null;

  const columns: ColumnsType<AnalysisListItem> = [
    {
      title: '姓名',
      key: 'candidate',
      width: 180,
      render: (_, record) => (
        <button type="button" className="flex items-center gap-3 border-0 bg-transparent p-0 text-left" onClick={() => setSelectedCandidate(record)}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#c4c5d5] bg-[#f4f2fc] text-xs font-black text-[#00288e]">
            {candidateLabel(record).slice(0, 1)}
          </span>
          <span>
            <span className="block whitespace-nowrap font-semibold">{candidateLabel(record)}</span>
            <span className="block text-xs text-slate-500">已完成分析</span>
          </span>
        </button>
      ),
    },
    {
      title: '匹配分值',
      dataIndex: 'overall_score',
      key: 'overall_score',
      width: 110,
      sorter: true,
      render: (score: number) => (
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border-4 text-sm font-black" style={{ borderColor: scoreColor(score), color: score >= 85 ? '#006c49' : '#1a1b22' }}>
          {Math.round(score)}%
        </div>
      ),
    },
    {
      title: '工作经验',
      key: 'experience',
      width: 90,
      render: (_, record) => {
        const years = getCandidateExperienceYears(record);
        return <span className="font-semibold">{years !== null ? `${years} 年` : '待确认'}</span>;
      },
    },
    {
      title: '技能标签',
      key: 'skills',
      width: 150,
      render: (_, record) => {
        const skills = record.dimension_scores.find((item) => item.dimension === 'skill_match')?.match_details?.matched_skills || [];
        const fallback = record.dimension_scores.slice(0, 2).map((item) => dimensionLabel(item.dimension));
        return (
          <div className="flex flex-wrap gap-2">
            {(skills.length ? skills : fallback).slice(0, 2).map((skill) => (
              <Tag key={skill} className="rounded-md border-0 bg-blue-50 px-2 py-1 font-bold text-[#00288e]">{skill}</Tag>
            ))}
            {(skills.length || fallback.length) > 2 && <Tag className="rounded-md border-0 bg-slate-100 px-2 py-1 font-bold">+{(skills.length || fallback.length) - 2}</Tag>}
          </div>
        );
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space size={4}>
          <Button type="text" icon={<MaterialIcon name="grade" className="text-[#00288e]" fill />} onClick={() => message.success(`${candidateLabel(record)} 已加入短名单`)} />
          <Popconfirm
            title="删除这份简历？"
            description="会同时移除对应分析结果，操作不可恢复。"
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDeleteResume(record)}
          >
            <Button type="text" danger icon={<MaterialIcon name="block" />} />
          </Popconfirm>
          <Button type="primary" className="rounded-lg bg-[#00288e] px-3 text-xs font-bold" onClick={() => router.push(`/dashboard/analysis/${record.id}`)}>
            查看
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <h1 className="text-[32px] font-bold leading-tight tracking-tight text-[#1a1b22]">候选人结果</h1>
          <p className="mt-2 text-base text-slate-700">
            {selectedJob?.title || '目标职位'} 的匹配结果 · {pagination.total || statistics?.total_resumes || 0} 名候选人
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Select
            value={selectedJobId}
            onChange={(value) => {
              setSelectedJobId(value);
              setSelectedCandidate(null);
              setPagination((prev) => ({ ...prev, current: 1 }));
              router.replace(`/dashboard/analysis?job=${value}`);
            }}
            className="h-12 min-w-56"
            options={jobs.map((job) => ({ label: job.title, value: job.id }))}
          />
          <Dropdown
            menu={{
              items: [
                { key: 'all', label: '全部候选人', onClick: () => setRecommendationFilter('all') },
                { key: 'strongly_recommended', label: '强烈推荐', onClick: () => setRecommendationFilter('strongly_recommended') },
                { key: 'recommended', label: '推荐', onClick: () => setRecommendationFilter('recommended') },
                { key: 'pending', label: '待定', onClick: () => setRecommendationFilter('pending') },
              ],
            }}
          >
          <Button icon={<MaterialIcon name="filter_list" className="text-[20px]" />} className="h-12 rounded-lg px-5 font-bold">
            高级筛选
          </Button>
          </Dropdown>
          <Dropdown.Button
            type="primary"
            className="candidate-export-button"
            icon={<MaterialIcon name="file_download" className="text-[20px]" />}
            menu={{
              items: [
                { key: 'csv', label: '导出 CSV', onClick: () => handleExport('csv') },
                { key: 'xlsx', label: '导出 Excel', onClick: () => handleExport('xlsx') },
              ],
            }}
            onClick={() => handleExport('csv')}
          >
            导出 CSV
          </Dropdown.Button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <Metric label="最低分值" value={`${minScore}%`} icon={<MaterialIcon name="trending_up" />} tone="primary" />
        <Metric label="工作经验" value={experienceYears !== null ? `${experienceYears}年` : '待确认'} icon={<MaterialIcon name="work_history" />} />
        <Metric label="核心技能" value={topSkill} icon={<MaterialIcon name="verified" />} />
        <Metric label="工作地点" value="远程办公" icon={<MaterialIcon name="public" />} />
      </section>

      <section className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
          <Table
            className="analysis-table candidate-result-table"
            columns={columns}
            dataSource={analyses}
            rowKey="id"
            loading={loading}
            pagination={pagination}
            onChange={handleTableChange}
            scroll={{ x: 660 }}
            rowClassName={(record) => (record.id === selectedCandidate?.id ? 'candidate-row-active' : '')}
            onRow={(record) => ({ onClick: () => setSelectedCandidate(record) })}
          />
        </div>

        <CandidatePreview
          candidate={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
          onView={() => {
            if (selectedCandidate) router.push(`/dashboard/analysis/${selectedCandidate.id}`);
          }}
        />
      </section>
    </div>
  );
}

function Metric({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone?: 'primary' }) {
  return (
    <div className="flex min-h-[124px] flex-col gap-1 rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-600">{label}</p>
      <div className="mt-3 flex items-center justify-between gap-4">
        <span className={`truncate text-2xl font-semibold ${tone === 'primary' ? 'text-[#00288e]' : 'text-[#1a1b22]'}`}>{value}</span>
        <span className="text-2xl text-slate-400">{icon}</span>
      </div>
    </div>
  );
}

function CandidatePreview({ candidate, onClose, onView }: { candidate: AnalysisListItem | null; onClose: () => void; onView: () => void }) {
  if (!candidate) {
    return (
      <aside className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <Spin />
        <p className="mt-4 text-slate-500">请选择候选人查看 AI 简历预览。</p>
      </aside>
    );
  }

  const skills = candidate.dimension_scores.find((item) => item.dimension === 'skill_match')?.match_details?.matched_skills || [];
  const education = candidate.dimension_scores.find((item) => item.dimension === 'education')?.score || 80;
  const experienceYears = getCandidateExperienceYears(candidate);

  return (
    <aside className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="rounded-full bg-[#6cf8bb] px-4 py-2 text-sm font-black text-[#002113]">入围面试</span>
          <h2 className="mt-4 text-2xl font-semibold text-[#1a1b22]">{candidateLabel(candidate)}</h2>
          <p className="mt-2 text-slate-600">候选人 @ TalentScreen</p>
        </div>
        <Button type="text" icon={<MaterialIcon name="close" />} onClick={onClose} />
      </div>

      <div className="mt-8">
        <p className="mb-3 font-black">AI 简历预览</p>
        <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-500 p-8 text-center text-white">
          <div className="mx-auto h-80 max-w-80 rounded-lg bg-slate-400/70 p-8">
            <div className="rounded bg-sky-300 px-5 py-3 text-left text-2xl font-black">Resume</div>
            <div className="mt-8 space-y-3">
              <div className="h-5 rounded bg-slate-300/70" />
              <div className="h-5 rounded bg-slate-300/70" />
              <div className="h-20 rounded bg-white/80" />
            </div>
          </div>
          <Button icon={<MaterialIcon name="visibility" className="text-[18px]" />} onClick={onView} className="absolute left-1/2 top-1/2 h-12 -translate-x-1/2 -translate-y-1/2 rounded-lg font-black shadow-lg">
            查看完整简历
          </Button>
        </div>
      </div>

      <div className="mt-8 divide-y divide-slate-100">
        <PreviewRow label="工作经历" value={experienceYears !== null ? `总计 ${experienceYears} 年` : '待确认'} />
        <PreviewRow label="教育背景" value={education >= 85 ? '硕士及以上' : '本科及以上'} />
        <div className="flex items-center justify-between py-4">
          <span className="text-slate-700">技术匹配度</span>
          <span className="flex gap-1">
            {[0, 1, 2, 3, 4].map((item) => (
              <span key={item} className={`h-3 w-3 rounded-full ${item < Math.round(candidate.overall_score / 20) ? 'bg-emerald-700' : 'bg-slate-200'}`} />
            ))}
          </span>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {skills.slice(0, 5).map((skill) => (
          <Tag key={skill} className="rounded-full border-0 bg-blue-50 px-3 py-1 font-bold text-[#00288e]">{skill}</Tag>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4">
        <Button type="primary" className="h-14 rounded-lg bg-[#00288e] text-lg font-black" onClick={() => message.success('面试安排已加入待办')}>
          安排面试
        </Button>
        <Button className="h-14 rounded-lg text-lg font-black" onClick={() => message.info('备注功能已记录在候选人跟进流程中')}>
          添加备注
        </Button>
      </div>
    </aside>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-4">
      <span className="text-slate-700">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
