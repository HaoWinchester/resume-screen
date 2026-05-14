'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Card,
  Row,
  Col,
  Descriptions,
  Tag,
  Typography,
  Button,
  Space,
  Divider,
  List,
  Progress,
  Spin,
  Alert,
  message,
  Timeline,
  Collapse,
} from 'antd';
import {
  PrinterOutlined,
  ArrowLeftOutlined,
  TrophyOutlined,
  CloseCircleOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { fetchAnalysisDetail } from '@/lib/api/analysis';
import { AgentTeamPanel } from '@/components/agent-team-panel';
import { formatEducationLevel } from '@/lib/formatters/education';
import type { AnalysisDetail, DimensionType } from '@/types/analysis';
import type { WorkExperience } from '@/types/resume';

const { Title, Text, Paragraph } = Typography;

interface DisplayWorkExperience {
  title: string;
  company: string;
  position?: string;
  period: string;
  summary?: string;
  highlights: string[];
  tags: string[];
  details: string[];
}

export default function AnalysisDetailPage() {
  const router = useRouter();
  const params = useParams();
  const analysisId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<AnalysisDetail | null>(null);

  const loadAnalysis = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAnalysisDetail(analysisId);
      setAnalysis(data);
    } catch (error) {
      message.error('加载分析详情失败');
      router.push('/dashboard/analysis');
    } finally {
      setLoading(false);
    }
  }, [analysisId, router]);

  useEffect(() => {
    void loadAnalysis();
  }, [loadAnalysis]);

  const handlePrint = () => {
    window.print();
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

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#52c41a';
    if (score >= 60) return '#1890ff';
    return '#8c8c8c';
  };

  const getRecommendationConfig = () => {
    if (!analysis) return null;
    const config = {
      strongly_recommended: {
        color: 'gold',
        text: '强烈推荐',
        icon: <TrophyOutlined />,
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
      },
      recommended: {
        color: 'blue',
        text: '推荐',
        icon: <TrophyOutlined />,
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
      },
      pending: {
        color: 'default',
        text: '待定',
        icon: <CloseCircleOutlined />,
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-200',
      },
    };
    return config[analysis.recommendation];
  };

  const prepareRadarData = () => {
    if (!analysis) return [];
    return analysis.dimension_scores.map((d) => ({
      dimension: getDimensionName(d.dimension),
      score: d.score,
      fullMark: 100,
    }));
  };

  const getMatchDetails = (dimension: DimensionType) => {
    if (!analysis) return null;
    const dimScore = analysis.dimension_scores.find((d) => d.dimension === dimension);
    return dimScore?.match_details || null;
  };

  const toTextList = (value: unknown) =>
    Array.isArray(value)
      ? value
          .map((item) => String(item || '').trim())
          .filter(Boolean)
      : [];

  const renderDetailList = (
    title: string,
    values: unknown,
    tone: 'blue' | 'green' | 'amber' | 'red' = 'blue'
  ) => {
    const items = toTextList(values);
    if (items.length === 0) return null;

    const toneClass = {
      blue: 'border-blue-100 bg-blue-50 text-blue-700',
      green: 'border-green-100 bg-green-50 text-green-700',
      amber: 'border-amber-100 bg-amber-50 text-amber-700',
      red: 'border-red-100 bg-red-50 text-red-700',
    }[tone];

    return (
      <div className={`rounded-lg border p-3 ${toneClass}`}>
        <Text strong className="text-xs">
          {title}
        </Text>
        <ul className="mt-2 space-y-1 pl-4 text-xs leading-5">
          {items.slice(0, 4).map((item) => (
            <li key={`${title}-${item}`}>{item}</li>
          ))}
        </ul>
      </div>
    );
  };

  const hasValue = (value: unknown) =>
    value !== null && value !== undefined && String(value).trim() !== '';

  const displayValue = (value: unknown, fallback = '-') =>
    hasValue(value) ? String(value) : fallback;

  const joinValues = (values: unknown[], separator = ' - ', fallback = '-') => {
    const parts = values.filter(hasValue).map(String);
    return parts.length > 0 ? parts.join(separator) : fallback;
  };

  const getDateRange = (start?: string | null, end?: string | null) => {
    if (hasValue(start) && hasValue(end)) return `${start} ~ ${end}`;
    if (hasValue(start)) {
      const startText = String(start);
      if (/(至今|现在|[-~～—])/.test(startText)) return startText;
      return `${startText} 起`;
    }
    if (hasValue(end)) return `截至 ${end}`;
    return '时间未填写';
  };

  const normalizeLine = (line: string) => line.replace(/\s+/g, ' ').trim();

  const isDateRangeLine = (line: string) =>
    /(\d{4}\s*年?\s*\d{0,2}\s*月?|\d{4}[./-]\d{1,2}).{0,24}(至今|现在|\d{4}|[-~～—])/.test(line);

  const isLikelyWorkTitle = (line: string) => {
    if (!line || line.length < 4 || line.length > 80) return false;
    if (/[:：]$/.test(line)) return false;
    if (/^[-•]/.test(line)) return false;
    return /(公司|集团|科技|信息|研究院|研究所|银行|大学|学院|部门|事业部|中心|工作室|有限公司|研发部|产品部|技术部)/.test(line);
  };

  const isStopSectionLine = (line: string) =>
    /^(教育背景|教育经历|项目经历|项目经验|技能|专业技能|证书|专业证书|自我评价|个人评价|社会职业|社会经历|获奖|语言能力|[一二三四五六七八九十]、)/.test(line) &&
    !/工作经历|工作经验|职业经历/.test(line);

  const isHeadingLikeLine = (line: string) =>
    /[:：]$/.test(line) || /^(核心成果|核心能力|技术难点|解决方案|项目职责|工作职责|主要职责|项目业绩|职责描述)/.test(line);

  const cleanHighlightLine = (line: string) =>
    normalizeLine(line.replace(/^[-•*]\s*/, '').replace(/^\d+[.)、]\s*/, ''));

  const splitWorkTitle = (titleLine: string) => {
    for (const separator of [' - ', '-', '—', '｜', '|', '/']) {
      if (titleLine.includes(separator)) {
        const [company, ...rest] = titleLine.split(separator);
        return {
          company: company.trim() || titleLine,
          position: rest.join(separator).trim() || undefined,
        };
      }
    }

    return { company: titleLine, position: undefined };
  };

  const splitInlineWorkHeader = (line: string) => {
    const match = line.match(
      /(\d{4}\s*年?\s*\d{1,2}\s*月?|\d{4}[./-]\d{1,2})\s*(?:-|~|～|—|至)\s*(?:至今|现在|\d{4}\s*年?\s*\d{1,2}\s*月?|\d{4}[./-]\d{1,2})/
    );

    if (!match || match.index === undefined) return null;

    const title = line.slice(0, match.index).trim();
    const period = match[0].trim();
    if (!title || !isLikelyWorkTitle(title)) return null;

    return { title, period };
  };

  const isSentenceComplete = (line: string) => /[。！？；;.!?]$/.test(line);

  const isStandaloneDetailTitle = (line: string) =>
    line.length <= 60 &&
    /[（(].+[）)]/.test(line) &&
    !/[，。；]/.test(line);

  const mergeWrappedWorkLines = (lines: string[]) => {
    const merged: string[] = [];

    lines
      .map(cleanHighlightLine)
      .filter((line) => line && !/^\d+$/.test(line) && !isHeadingLikeLine(line))
      .forEach((line) => {
        const previous = merged[merged.length - 1];
        const shouldMerge =
          previous &&
          !isSentenceComplete(previous) &&
          !isStandaloneDetailTitle(previous) &&
          !isStandaloneDetailTitle(line);

        if (shouldMerge) {
          merged[merged.length - 1] = `${previous}${line}`;
        } else {
          merged.push(line);
        }
      });

    return merged.filter((line, index, arr) => arr.indexOf(line) === index);
  };

  const clampText = (text: string, maxLength: number) =>
    text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;

  const scoreWorkLine = (line: string) => {
    let score = 0;
    if (/\d+(?:\.\d+)?%|>\s*\d+|≥\s*\d+|\d+(?:\.\d+)?\s*秒/.test(line)) score += 4;
    if (/从0\s*到\s*1|主导|负责|设计|实现|构建|搭建|交付|上线|提升|节省|解决|获得/.test(line)) score += 3;
    if (/准确率|响应时间|满意度|合规|检测|自动化|知识库|多模态|微调|RAG|LLM|AI/i.test(line)) score += 2;
    if (line.length >= 20) score += 1;
    return score;
  };

  const extractWorkTags = (text: string) => {
    const tags: string[] = [];
    const pushTag = (tag: string) => {
      if (!tags.includes(tag)) tags.push(tag);
    };

    [
      [/RAG/i, 'RAG'],
      [/Dify/i, 'Dify'],
      [/Qwen/i, 'Qwen'],
      [/Sentence-BERT/i, 'Sentence-BERT'],
      [/LLM|大模型/i, '大模型'],
      [/多模态/, '多模态'],
      [/内容安全|合规/, '内容安全'],
      [/知识库/, '知识库'],
      [/微调/, '模型微调'],
      [/自动化/, '自动化'],
    ].forEach(([pattern, tag]) => {
      if ((pattern as RegExp).test(text)) pushTag(tag as string);
    });

    const metrics = text.match(/(?:>|≥)?\s*\d+(?:\.\d+)?%|\d+(?:\.\d+)?\s*秒|0\s*到\s*1/g) || [];
    metrics.slice(0, 3).forEach((metric) => pushTag(metric.replace(/\s+/g, '')));

    return tags.slice(0, 6);
  };

  const buildDisplayWorkItem = (titleLine: string, periodLine: string, bodyLines: string[]): DisplayWorkExperience => {
    const { company, position } = splitWorkTitle(titleLine);
    const details = mergeWrappedWorkLines(bodyLines);
    const summarySource =
      details.find((line) => !isStandaloneDetailTitle(line) && line.length >= 18) ||
      details.find((line) => !isStandaloneDetailTitle(line));

    const scoredHighlights = details
      .map((line, index) => ({ line, index, score: scoreWorkLine(line) }))
      .filter(({ line, score }) =>
        line !== summarySource &&
        score > 0 &&
        !isStandaloneDetailTitle(line)
      )
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map(({ line }) => line);

    const highlights =
      scoredHighlights.length > 0
        ? scoredHighlights.slice(0, 3)
        : details
            .filter((line) => line !== summarySource && !isStandaloneDetailTitle(line))
            .slice(0, 3);

    return {
      title: titleLine,
      company,
      position,
      period: periodLine,
      summary: summarySource ? clampText(summarySource, 140) : undefined,
      highlights,
      tags: extractWorkTags([titleLine, ...details].join(' ')),
      details: details.slice(0, 12),
    };
  };

  const parseWorkExperienceFromRawText = (rawText?: string | null): DisplayWorkExperience[] => {
    if (!rawText) return [];

    const lines = rawText
      .split(/\r?\n/)
      .map(normalizeLine)
      .filter((line) => line && !/^\d+$/.test(line));

    const startIndex = lines.findIndex((line) => /工作经历|工作经验|职业经历|Work Experience|Experience/i.test(line));
    if (startIndex === -1) return [];

    const sectionLines: string[] = [];
    for (const line of lines.slice(startIndex + 1)) {
      if (isStopSectionLine(line)) break;
      sectionLines.push(line);
    }

    const entries: DisplayWorkExperience[] = [];
    const entryStarts: Array<{
      titleIndex: number;
      bodyStartIndex: number;
      title: string;
      period: string;
    }> = [];

    for (let i = 0; i < sectionLines.length; i += 1) {
      const inlineHeader = splitInlineWorkHeader(sectionLines[i]);
      if (inlineHeader) {
        entryStarts.push({
          titleIndex: i,
          bodyStartIndex: i + 1,
          title: inlineHeader.title,
          period: inlineHeader.period,
        });
        continue;
      }

      if (i > 0 && isDateRangeLine(sectionLines[i]) && isLikelyWorkTitle(sectionLines[i - 1])) {
        entryStarts.push({
          titleIndex: i - 1,
          bodyStartIndex: i + 1,
          title: sectionLines[i - 1],
          period: sectionLines[i],
        });
      }
    }

    entryStarts.forEach((entry, index) => {
      const nextEntry = entryStarts[index + 1];
      const bodyEnd = nextEntry ? nextEntry.titleIndex : sectionLines.length;
      entries.push(
        buildDisplayWorkItem(
          entry.title,
          entry.period,
          sectionLines.slice(entry.bodyStartIndex, bodyEnd)
        )
      );
    });

    return entries;
  };

  const normalizeParsedWorkExperience = (workExperience?: WorkExperience[]): DisplayWorkExperience[] => {
    if (!workExperience || workExperience.length === 0) return [];

    return workExperience
      .filter((work) =>
        [work.company, work.position, work.description].some(hasValue)
      )
      .map((work) =>
        buildDisplayWorkItem(
          joinValues([work.company, work.position]),
          getDateRange(work.start_date, work.end_date),
          hasValue(work.description) ? String(work.description).split(/\r?\n/) : []
        )
      );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Spin size="large" />
      </div>
    );
  }

  if (!analysis) {
    return null;
  }

  const recConfig = getRecommendationConfig();
  const parsedData = analysis.resume.parsed_data;
  const rawText = parsedData?.raw_text?.trim();
  const candidateName = analysis.resume.candidate_name || parsedData?.name || `候选人-${analysis.resume_id.slice(0, 8)}`;
  const candidateEmail = analysis.resume.candidate_email || parsedData?.email;
  const candidatePhone = analysis.resume.candidate_phone || parsedData?.phone;
  const candidateGender = parsedData?.gender;
  const candidateAge = parsedData?.age;
  const rawWorkExperiences = parseWorkExperienceFromRawText(rawText);
  const displayWorkExperiences =
    rawWorkExperiences.length > 0
      ? rawWorkExperiences
      : normalizeParsedWorkExperience(parsedData?.work_experience);
  const workTimelineItems = displayWorkExperiences.map((work, index) => {
    const summaryPrefix = work.summary?.replace(/\.\.\.$/, '') || '';
    const detailLines = work.details
      .filter((line) => !summaryPrefix || !line.startsWith(summaryPrefix))
      .filter((line) => !work.highlights.includes(line))
      .slice(0, 8);

    return {
      key: `${work.title}-${work.period}-${index}`,
      dot: <ClockCircleOutlined className="text-blue-500" />,
      children: (
        <div className="rounded-md border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
            <div>
              <Text strong className="text-base">
                {work.company}
              </Text>
              {work.position && (
                <div>
                  <Text type="secondary" className="text-sm">
                    {work.position}
                  </Text>
                </div>
              )}
            </div>
            <Tag color="blue">{work.period}</Tag>
          </div>

          {work.summary && (
            <Paragraph className="!mb-3 text-gray-700">
              {work.summary}
            </Paragraph>
          )}

          {work.tags.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {work.tags.map((tag) => (
                <Tag key={`${work.title}-${tag}`} color="geekblue">
                  {tag}
                </Tag>
              ))}
            </div>
          )}

          {work.highlights.length > 0 && (
            <div className="space-y-2">
              {work.highlights.map((item) => (
                <div key={`${work.title}-${item}`} className="flex gap-2">
                  <CheckCircleOutlined className="mt-1 text-green-600" />
                  <Text className="text-sm text-gray-700">
                    {clampText(item, 110)}
                  </Text>
                </div>
              ))}
            </div>
          )}

          {detailLines.length > 0 && (
            <Collapse
              ghost
              size="small"
              className="mt-2"
              items={[
                {
                  key: 'details',
                  label: '展开完整职责与项目',
                  children: (
                    <List
                      size="small"
                      dataSource={detailLines}
                      renderItem={(item) => (
                        <List.Item className="px-0">
                          <Text type="secondary" className="text-sm">
                            {clampText(item, 160)}
                          </Text>
                        </List.Item>
                      )}
                    />
                  ),
                },
              ]}
            />
          )}
        </div>
      ),
    };
  });

  return (
    <div className="print-container">
      <div className="mb-6 flex justify-between items-center no-print">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.back()}>
            返回
          </Button>
          <Title level={3} className="mb-0">
            分析详情
          </Title>
        </Space>
        <Button icon={<PrinterOutlined />} onClick={handlePrint}>
          打印报告
        </Button>
      </div>

      {/* 推荐等级横幅 */}
      <Card
        className={`mb-6 ${recConfig?.bgColor} ${recConfig?.borderColor} border-2`}
      >
        <div className="flex items-center gap-4">
          <div className={`text-4xl text-${recConfig?.color}`}>
            {recConfig?.icon}
          </div>
          <div className="flex-1">
            <div className="text-2xl font-bold mb-1">{recConfig?.text}</div>
            <Text type="secondary">{displayValue(analysis.recommendation_reason, '暂无推荐理由')}</Text>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold" style={{ color: getScoreColor(analysis.overall_score) }}>
              {analysis.overall_score.toFixed(1)}
            </div>
            <Text type="secondary">综合评分</Text>
          </div>
        </div>
      </Card>

      <div className="no-print">
        <AgentTeamPanel analysisId={analysis.id} />
      </div>

      <Row gutter={16} className="mb-6">
        {/* 左侧：简历内容 */}
        <Col span={12}>
          <Card title="候选人信息" className="mb-4">
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="姓名">
                {candidateName}
              </Descriptions.Item>
              <Descriptions.Item label="性别">
                {displayValue(candidateGender)}
              </Descriptions.Item>
              <Descriptions.Item label="年龄">
                {displayValue(candidateAge)}
              </Descriptions.Item>
              <Descriptions.Item label="邮箱">
                {displayValue(candidateEmail)}
              </Descriptions.Item>
              <Descriptions.Item label="电话">
                {displayValue(candidatePhone)}
              </Descriptions.Item>
              <Descriptions.Item label="文件名">
                {analysis.resume.file_name}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title="教育背景" className="mb-4">
            {parsedData?.education &&
            parsedData.education.length > 0 ? (
              <List
                dataSource={parsedData.education}
                renderItem={(edu) => (
                  <List.Item>
                    <List.Item.Meta
                      title={joinValues([edu.school, edu.major])}
                      description={joinValues([edu.degree, getDateRange(edu.start_date, edu.end_date)], ' | ')}
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Text type="secondary">无教育背景信息</Text>
            )}
          </Card>

          <Card title="工作经历" className="mb-4">
            {displayWorkExperiences.length > 0 ? (
              <Timeline className="mt-2" items={workTimelineItems} />
            ) : (
              <Text type="secondary">无工作经历信息</Text>
            )}
          </Card>

          <Card title="项目经历" className="mb-4">
            {parsedData?.projects &&
            parsedData.projects.length > 0 ? (
              <List
                dataSource={parsedData.projects}
                renderItem={(proj) => (
                  <List.Item>
                    <List.Item.Meta
                      title={joinValues([proj.name, proj.role])}
                      description={displayValue(proj.description, '暂无项目描述')}
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Text type="secondary">无项目经历信息</Text>
            )}
          </Card>

          <Card title="技能清单">
            <div className="flex flex-wrap gap-2">
              {parsedData?.skills && parsedData.skills.length > 0 ? (
                parsedData.skills.map((skill) => (
                <Tag key={skill} color="blue">
                  {skill}
                </Tag>
                ))
              ) : (
                <Text type="secondary">无技能信息</Text>
              )}
            </div>
          </Card>

          <Card title="简历原文" className="mt-4">
            {rawText ? (
              <Paragraph
                className="whitespace-pre-wrap max-h-[480px] overflow-auto rounded bg-gray-50 p-3 text-sm"
                copyable={{ text: rawText }}
              >
                {rawText}
              </Paragraph>
            ) : (
              <Alert
                message="暂无可展示的原文"
                description="当前文件未解析出可读文本，可能是扫描图片质量较低、PDF 无文本层，或解析任务尚未完成。"
                type="info"
                showIcon
              />
            )}
          </Card>
        </Col>

        {/* 右侧：分析报告 */}
        <Col span={12}>
          <Card title="维度评分" className="mb-4">
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={prepareRadarData()}>
                <PolarGrid />
                <PolarAngleAxis dataKey="dimension" />
                <PolarRadiusAxis angle={90} domain={[0, 100]} />
                <Radar
                  name="评分"
                  dataKey="score"
                  stroke="#1890ff"
                  fill="#1890ff"
                  fillOpacity={0.6}
                />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="核心优势" className="mb-4">
            {analysis.strengths && analysis.strengths.length > 0 ? (
              <List
                dataSource={analysis.strengths}
                renderItem={(item) => (
                  <List.Item>
                    <Tag color="green" className="mb-1">
                      ✓
                    </Tag>
                    <Text>{item}</Text>
                  </List.Item>
                )}
              />
            ) : (
              <Text type="secondary">暂无优势分析</Text>
            )}
          </Card>

          <Card title="待改进项" className="mb-4">
            {analysis.weaknesses && analysis.weaknesses.length > 0 ? (
              <List
                dataSource={analysis.weaknesses}
                renderItem={(item) => (
                  <List.Item>
                    <Tag color="red" className="mb-1">
                      !
                    </Tag>
                    <Text>{item}</Text>
                  </List.Item>
                )}
              />
            ) : (
              <Text type="secondary">暂无明显不足</Text>
            )}
          </Card>

          <Card title="维度详情">
            {analysis.dimension_scores.map((dim) => {
              const matchDetails = getMatchDetails(dim.dimension);
              return (
                <div key={dim.dimension} className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <Text strong>{getDimensionName(dim.dimension)}</Text>
                    <Space>
                      <Tag
                        color={
                          dim.weight === 'high'
                            ? 'red'
                            : dim.weight === 'medium'
                            ? 'blue'
                            : 'default'
                        }
                      >
                        {dim.weight === 'high' ? '高权重' : dim.weight === 'medium' ? '中权重' : '低权重'}
                      </Tag>
                      <Text
                        strong
                        style={{ color: getScoreColor(dim.score), fontSize: 18 }}
                      >
                        {dim.score.toFixed(1)}
                      </Text>
                    </Space>
                  </div>
                  <Progress
                    percent={dim.score}
                    strokeColor={getScoreColor(dim.score)}
                    showInfo={false}
                    className="mb-2"
                  />
                  <Paragraph className="text-sm text-gray-600 mb-2">
                    {displayValue(dim.analysis_text, '暂无该维度的详细说明')}
                  </Paragraph>
                  {matchDetails && (
                    <div className="space-y-3 rounded bg-gray-50 p-3">
                      {matchDetails.matched_skills &&
                        matchDetails.matched_skills.length > 0 && (
                          <div className="mb-1">
                            <Text type="secondary" className="text-xs">
                              匹配技能:
                            </Text>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {matchDetails.matched_skills.map((skill) => (
                                <Tag key={skill} color="green" className="text-xs">
                                  {skill}
                                </Tag>
                              ))}
                            </div>
                          </div>
                        )}
                      {matchDetails.missing_skills &&
                        matchDetails.missing_skills.length > 0 && (
                          <div className="mb-1">
                            <Text type="secondary" className="text-xs">
                              缺失技能:
                            </Text>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {matchDetails.missing_skills.map((skill) => (
                                <Tag key={skill} color="red" className="text-xs">
                                  {skill}
                                </Tag>
                              ))}
                            </div>
                          </div>
                        )}
                      {matchDetails.bonus_skills_matched &&
                        matchDetails.bonus_skills_matched.length > 0 && (
                          <div>
                            <Text type="secondary" className="text-xs">
                              加分技能:
                            </Text>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {matchDetails.bonus_skills_matched.map((skill) => (
                                <Tag key={skill} color="blue" className="text-xs">
                                  {skill}
                                </Tag>
                              ))}
                            </div>
                          </div>
                        )}
                      <div className="grid gap-3 md:grid-cols-2">
                        {renderDetailList('岗位关注点', matchDetails.job_focus, 'blue')}
                        {renderDetailList('匹配证据', matchDetails.evidence, 'green')}
                        {renderDetailList('风险与待验证', matchDetails.concerns, 'red')}
                        {renderDetailList('面试追问', matchDetails.interview_questions, 'amber')}
                        {renderDetailList('下一步建议', matchDetails.next_actions, 'blue')}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </Card>
        </Col>
      </Row>

      {/* 岗位要求参考 */}
      <Card title="岗位要求参考" className="mb-4">
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="岗位名称" span={2}>
            {analysis.job_requirement.title}
          </Descriptions.Item>
          <Descriptions.Item label="必备技能">
            <div className="flex flex-wrap gap-1">
              {analysis.job_requirement.criteria.required_skills?.length > 0 ? (
                analysis.job_requirement.criteria.required_skills.map((skill) => (
                <Tag key={skill} color="blue">
                  {skill}
                </Tag>
                ))
              ) : (
                <Text type="secondary">未设置</Text>
              )}
            </div>
          </Descriptions.Item>
          <Descriptions.Item label="最低工作年限">
            {analysis.job_requirement.criteria.min_experience_years} 年
          </Descriptions.Item>
          <Descriptions.Item label="学历要求">
            {formatEducationLevel(analysis.job_requirement.criteria.education)}
          </Descriptions.Item>
          <Descriptions.Item label="其他要求">
            {analysis.job_requirement.criteria.other_requirements || '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <div className="text-center text-gray-400 text-sm no-print">
        分析时间: {analysis.analyzed_at ? new Date(analysis.analyzed_at).toLocaleString('zh-CN') : '暂无'}
      </div>
    </div>
  );
}
