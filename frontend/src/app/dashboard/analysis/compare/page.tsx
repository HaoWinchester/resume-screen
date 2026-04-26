'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Card,
  Row,
  Col,
  Table,
  Typography,
  Button,
  Space,
  Tag,
  message,
  Spin,
} from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';
import { fetchCandidateComparison } from '@/lib/api/analysis';
import type { ComparisonCandidate, DimensionType } from '@/types/analysis';

const { Title, Text } = Typography;

function CompareContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const analysisIds = searchParams.get('ids')?.split(',') || [];

  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState<ComparisonCandidate[]>([]);

  useEffect(() => {
    if (analysisIds.length < 2) {
      message.error('请至少选择 2 位候选人进行对比');
      router.push('/dashboard/analysis');
      return;
    }
    if (analysisIds.length > 3) {
      message.error('最多只能对比 3 位候选人');
      router.push('/dashboard/analysis');
      return;
    }
    loadComparison();
  }, [analysisIds]);

  const loadComparison = async () => {
    setLoading(true);
    try {
      const response = await fetchCandidateComparison(analysisIds);
      setCandidates(response.candidates);
    } catch (error) {
      message.error('加载对比数据失败');
      router.push('/dashboard/analysis');
    } finally {
      setLoading(false);
    }
  };

  const getDimensionName = (dimension: DimensionType): string => {
    const names = {
      skill_match: '技能匹配度',
      experience_match: '工作经验匹配度',
      education: '教育背景',
      project_relevance: '项目经历相关性',
      overall_quality: '简历整体质量',
    };
    return names[dimension];
  };

  const getRadarData = () => {
    const dimensions: DimensionType[] = [
      'skill_match',
      'experience_match',
      'education',
      'project_relevance',
      'overall_quality',
    ];

    return dimensions.map((dim) => {
      const data: any = {
        dimension: getDimensionName(dim),
        fullMark: 100,
      };
      candidates.forEach((candidate, index) => {
        const dimScore = candidate.dimension_scores.find((d) => d.dimension === dim);
        data[`candidate${index}`] = dimScore?.score || 0;
      });
      return data;
    });
  };

  const getRadarColors = () => {
    const colors = ['#1890ff', '#52c41a', '#faad14'];
    return candidates.map((_, index) => ({
      name: candidates[index].candidate_name || `候选人 ${index + 1}`,
      dataKey: `candidate${index}`,
      stroke: colors[index],
      fill: colors[index],
      fillOpacity: 0.3,
    }));
  };

  const getKeyInfoColumns = () => {
    return [
      {
        title: '信息项',
        dataIndex: 'label',
        key: 'label',
        render: (label: string) => <Text strong>{label}</Text>,
      },
      ...candidates.map((candidate, index) => ({
        title: candidate.candidate_name,
        dataIndex: `candidate${index}`,
        key: `candidate${index}`,
        render: (_: any, record: any) => record[`candidate${index}`] || '-',
      })),
    ];
  };

  const getKeyInfoData = () => {
    return [
      {
        key: 'experience',
        label: '工作经验',
        ...Object.fromEntries(
          candidates.map((c, i) => [
            `candidate${i}`,
            c.key_info.experience_years ? `${c.key_info.experience_years}年` : '-',
          ])
        ),
      },
      {
        key: 'education',
        label: '教育背景',
        ...Object.fromEntries(
          candidates.map((c, i) => [`candidate${i}`, c.key_info.education || '-'])
        ),
      },
      {
        key: 'skills',
        label: '核心技能',
        ...Object.fromEntries(
          candidates.map((c, i) => [
            `candidate${i}`,
            c.key_info.top_skills?.slice(0, 5).join(', ') || '-',
          ])
        ),
      },
      {
        key: 'score',
        label: '综合评分',
        ...Object.fromEntries(
          candidates.map((c, i) => [
            `candidate${i}`,
            <Text
              key={c.analysis_id}
              strong
              style={{ color: c.overall_score >= 80 ? '#52c41a' : c.overall_score >= 60 ? '#1890ff' : '#8c8c8c' }}
            >
              {c.overall_score.toFixed(1)}
            </Text>,
          ])
        ),
      },
    ];
  };

  const getScoreComparisonColumns = () => {
    return [
      {
        title: '维度',
        dataIndex: 'dimension',
        key: 'dimension',
        render: (dim: DimensionType) => getDimensionName(dim),
      },
      ...candidates.map((candidate, index) => ({
        title: candidate.candidate_name,
        dataIndex: `candidate${index}`,
        key: `candidate${index}`,
        render: (_: any, record: any) => {
          const score = record[`candidate${index}`];
          const maxScore = Math.max(
            ...candidates.map((c) => {
              const s = c.dimension_scores.find((d) => d.dimension === record.dimension);
              return s?.score || 0;
            })
          );
          const isHighest = score === maxScore;
          return (
            <span
              style={{
                fontWeight: isHighest ? 'bold' : 'normal',
                color: isHighest ? '#52c41a' : 'inherit',
              }}
            >
              {score?.toFixed(1) || '-'}
            </span>
          );
        },
      })),
    ];
  };

  const getScoreComparisonData = () => {
    const dimensions: DimensionType[] = [
      'skill_match',
      'experience_match',
      'education',
      'project_relevance',
      'overall_quality',
    ];

    return dimensions.map((dim) => {
      const data: any = { key: dim, dimension: dim };
      candidates.forEach((candidate, index) => {
        const dimScore = candidate.dimension_scores.find((d) => d.dimension === dim);
        data[`candidate${index}`] = dimScore?.score || null;
      });
      return data;
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Spin size="large" />
      </div>
    );
  }

  if (candidates.length === 0) {
    return null;
  }

  const radarSeries = getRadarColors();

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.back()}>
            返回
          </Button>
          <Title level={3} className="mb-0">
            候选人对比
          </Title>
        </Space>
      </div>

      {/* 雷达图 */}
      <Card title="维度评分对比" className="mb-6">
        <ResponsiveContainer width="100%" height={400}>
          <RadarChart data={getRadarData()}>
            <PolarGrid />
            <PolarAngleAxis dataKey="dimension" />
            <PolarRadiusAxis angle={90} domain={[0, 100]} />
            {radarSeries.map((series) => (
              <Radar
                key={series.dataKey}
                name={series.name}
                dataKey={series.dataKey}
                stroke={series.stroke}
                fill={series.fill}
                fillOpacity={series.fillOpacity}
              />
            ))}
            <Legend />
            <Tooltip />
          </RadarChart>
        </ResponsiveContainer>
      </Card>

      {/* 关键信息对比 */}
      <Card title="关键信息对比" className="mb-6">
        <Table
          columns={getKeyInfoColumns()}
          dataSource={getKeyInfoData()}
          pagination={false}
          bordered
        />
      </Card>

      {/* 详细评分对比 */}
      <Card title="详细评分对比">
        <Table
          columns={getScoreComparisonColumns()}
          dataSource={getScoreComparisonData()}
          pagination={false}
          bordered
        />
        <div className="mt-4 text-sm text-gray-500">
          <Text>绿色高亮表示该维度最高分</Text>
        </div>
      </Card>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center min-h-[400px]">
          <Spin size="large" />
        </div>
      }
    >
      <CompareContent />
    </Suspense>
  );
}
