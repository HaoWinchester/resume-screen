'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Collapse,
  Drawer,
  Empty,
  List,
  Space,
  Spin,
  Steps,
  Tag,
  Tabs,
  Typography,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { getErrorMessage } from '@/lib/api';
import { createAgentRun, fetchAgentRun, fetchAgentRuns } from '@/lib/api/agentRun';
import type { AgentRunItem, AgentRunStatus, AgentRunStepItem } from '@/types/agentRun';

const { Text, Paragraph } = Typography;

const statusMeta: Record<AgentRunStatus, { label: string; color: string }> = {
  pending: { label: '等待执行', color: 'default' },
  running: { label: '运行中', color: 'processing' },
  completed: { label: '已完成', color: 'success' },
  failed: { label: '失败', color: 'error' },
};

const agentNames: Record<string, string> = {
  'orchestrator-agent': '编排',
  'candidate-review-agent': '候选人复核',
  'interview-agent': '面试设计',
  'communication-agent': '沟通草稿',
  'audit-agent': '审计复核',
};

const nextStepNames: Record<string, string> = {
  priority_contact: '优先沟通',
  keep_warm: '保持观察',
  hold: '暂缓推进',
  reject_review: '人工复核淘汰',
};

const toTextList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean)
    : [];

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const clampText = (value: string, maxLength = 48) =>
  value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;

const formatJson = (value: unknown) => JSON.stringify(value ?? {}, null, 2);

const normalizeStepSummary = (step: AgentRunStepItem): string | undefined => {
  const summary = step.summary?.trim();
  if (!summary) return undefined;
  if (summary === 'Agent step completed') {
    if (step.agent_name === 'interview-agent') return '已生成面试验证重点和追问问题。';
    return '该 Agent 已完成处理。';
  }
  return summary;
};

const getStepStatus = (step: AgentRunStepItem) => {
  if (step.status === 'completed') return 'finish';
  if (step.status === 'failed') return 'error';
  return 'process';
};

interface AgentTeamPanelProps {
  analysisId: string;
}

export function AgentTeamPanel({ analysisId }: AgentTeamPanelProps) {
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [run, setRun] = useState<AgentRunItem | null>(null);
  const [selectedStep, setSelectedStep] = useState<AgentRunStepItem | null>(null);
  const pollTimerRef = useRef<number | null>(null);

  const clearPoll = useCallback(() => {
    if (pollTimerRef.current) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const pollRun = useCallback(
    (runId: string) => {
      clearPoll();

      const tick = async () => {
        try {
          const latest = await fetchAgentRun(runId);
          setRun(latest);

          if (latest.status === 'pending' || latest.status === 'running') {
            pollTimerRef.current = window.setTimeout(tick, 2000);
            return;
          }

          setRunning(false);
          if (latest.status === 'completed') {
            message.success('Agent Team 已完成');
          } else if (latest.status === 'failed') {
            message.error(latest.error || 'Agent Team 运行失败');
          }
        } catch (error) {
          setRunning(false);
          message.error(getErrorMessage(error) || '刷新 Agent 运行状态失败');
        }
      };

      pollTimerRef.current = window.setTimeout(tick, 1200);
    },
    [clearPoll]
  );

  const loadLatestRun = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchAgentRuns({
        target_type: 'analysis',
        target_id: analysisId,
        limit: 1,
      });
      const latest = response.items[0] || null;
      setRun(latest);

      if (latest && (latest.status === 'pending' || latest.status === 'running')) {
        setRunning(true);
        pollRun(latest.id);
      } else {
        setRunning(false);
      }
    } catch (error) {
      message.error(getErrorMessage(error) || '加载 Agent Team 记录失败');
    } finally {
      setLoading(false);
    }
  }, [analysisId, pollRun]);

  useEffect(() => {
    void loadLatestRun();
    return clearPoll;
  }, [clearPoll, loadLatestRun]);

  const handleStart = async () => {
    clearPoll();
    setRunning(true);
    try {
      const created = await createAgentRun({
        task_type: 'candidate_next_step',
        target_type: 'analysis',
        target_id: analysisId,
        run_async: true,
      });
      setRun(created);
      message.success('Agent Team 已开始运行');
      if (created.status === 'pending' || created.status === 'running') {
        pollRun(created.id);
      } else {
        setRunning(false);
      }
    } catch (error) {
      setRunning(false);
      message.error(getErrorMessage(error) || '启动 Agent Team 失败');
    }
  };

  const outputByAgent = useMemo(
    () => asRecord(run?.result?.agent_outputs),
    [run?.result?.agent_outputs]
  );
  const reviewOutput = asRecord(outputByAgent['candidate-review-agent']);
  const interviewOutput = asRecord(outputByAgent['interview-agent']);
  const communicationOutput = asRecord(outputByAgent['communication-agent']);
  const auditOutput = asRecord(outputByAgent['audit-agent']);
  const reviewStrengths = toTextList(reviewOutput.strengths);
  const reviewRisks = toTextList(reviewOutput.risks);
  const nextActions = toTextList(reviewOutput.next_actions);
  const humanReviewPoints = toTextList(run?.result?.human_review_points);
  const auditNotes = toTextList(auditOutput.audit_notes);
  const interviewQuestions = Array.isArray(interviewOutput.questions)
    ? interviewOutput.questions.map(asRecord)
    : [];
  const status = run ? statusMeta[run.status] : null;
  const latestStepWithSummary = [...(run?.steps || [])].reverse().find((step) => normalizeStepSummary(step));
  const latestSummary = run?.result?.summary || (latestStepWithSummary ? normalizeStepSummary(latestStepWithSummary) : undefined);
  const recommendedNextStep = run?.result?.recommended_next_step || reviewOutput.recommendation;
  const recommendedNextStepText = recommendedNextStep
    ? nextStepNames[String(recommendedNextStep)] || String(recommendedNextStep)
    : null;
  const selectedOutput = asRecord(
    selectedStep?.output || (selectedStep ? outputByAgent[selectedStep.agent_name] : undefined)
  );
  const selectedSummary = selectedStep ? normalizeStepSummary(selectedStep) : undefined;

  const renderOutputList = (title: string, value: unknown, emptyText: string) => {
    const items = toTextList(value);
    return (
      <List
        size="small"
        header={<Text strong>{title}</Text>}
        dataSource={items}
        locale={{ emptyText }}
        renderItem={(item) => <List.Item>{item}</List.Item>}
      />
    );
  };

  const renderReadableOutput = (step: AgentRunStepItem | null) => {
    if (!step) return null;
    const output = selectedOutput;

    if (step.agent_name === 'orchestrator-agent') {
      return (
        <Space direction="vertical" size={16} className="w-full">
          <Paragraph>{String(output.summary || selectedSummary || '暂无编排摘要')}</Paragraph>
          {renderOutputList('推荐流程', output.recommended_flow, '暂无推荐流程')}
          {renderOutputList('执行约束', output.constraints, '暂无执行约束')}
        </Space>
      );
    }

    if (step.agent_name === 'candidate-review-agent') {
      return (
        <Space direction="vertical" size={16} className="w-full">
          <Paragraph>{String(output.summary || selectedSummary || '暂无候选人复核摘要')}</Paragraph>
          <Space wrap>
            {output.recommendation_label ? <Tag color="blue">{String(output.recommendation_label)}</Tag> : null}
            {output.recommendation ? <Tag>{nextStepNames[String(output.recommendation)] || String(output.recommendation)}</Tag> : null}
          </Space>
          <div className="grid gap-4 md:grid-cols-3">
            {renderOutputList('优势', output.strengths, '暂无优势')}
            {renderOutputList('风险', output.risks, '暂无风险')}
            {renderOutputList('下一步', output.next_actions, '暂无建议')}
          </div>
        </Space>
      );
    }

    if (step.agent_name === 'interview-agent') {
      const questions = Array.isArray(output.questions) ? output.questions.map(asRecord) : [];
      return (
        <Space direction="vertical" size={16} className="w-full">
          <Paragraph>{String(output.summary || selectedSummary || '暂无面试设计摘要')}</Paragraph>
          {renderOutputList('验证重点', output.focus_areas, '暂无验证重点')}
          <List
            size="small"
            header={<Text strong>面试问题</Text>}
            dataSource={questions}
            locale={{ emptyText: '暂无面试问题' }}
            renderItem={(item) => (
              <List.Item>
                <List.Item.Meta
                  title={String(item.question || '待补充问题')}
                  description={
                    <Space direction="vertical" size={4}>
                      {item.area ? <Text type="secondary">方向：{String(item.area)}</Text> : null}
                      {item.good_signal ? <Text type="secondary">正向信号：{String(item.good_signal)}</Text> : null}
                      {item.risk_signal ? <Text type="secondary">风险信号：{String(item.risk_signal)}</Text> : null}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
          {renderOutputList('面试前准备', output.pre_interview_notes, '暂无准备事项')}
        </Space>
      );
    }

    if (step.agent_name === 'communication-agent') {
      return (
        <Space direction="vertical" size={16} className="w-full">
          <Paragraph
            className="rounded-md bg-gray-50 p-3"
            copyable={
              output.candidate_message_draft
                ? { text: String(output.candidate_message_draft) }
                : false
            }
          >
            {String(output.candidate_message_draft || '暂无候选人沟通草稿')}
          </Paragraph>
          {output.internal_note ? <Paragraph>{String(output.internal_note)}</Paragraph> : null}
          {output.manual_confirmation ? (
            <Alert type="warning" showIcon message="人工确认" description={String(output.manual_confirmation)} />
          ) : null}
        </Space>
      );
    }

    if (step.agent_name === 'audit-agent') {
      return (
        <Space direction="vertical" size={16} className="w-full">
          <Paragraph>{String(output.final_summary || selectedSummary || '暂无审计结论')}</Paragraph>
          <Space wrap>
            {output.recommended_next_step ? (
              <Tag color="blue">{nextStepNames[String(output.recommended_next_step)] || String(output.recommended_next_step)}</Tag>
            ) : null}
            {output.safe_to_auto_apply === false ? (
              <Tag icon={<SafetyCertificateOutlined />} color="orange">HR 人工确认</Tag>
            ) : null}
          </Space>
          <div className="grid gap-4 md:grid-cols-2">
            {renderOutputList('人工审核点', output.human_review_points, '暂无审核点')}
            {renderOutputList('审计记录', output.audit_notes, '暂无审计记录')}
          </div>
        </Space>
      );
    }

    return (
      <pre className="max-h-[520px] overflow-auto rounded-md bg-slate-950 p-4 text-xs leading-5 text-slate-50">
        {formatJson(output)}
      </pre>
    );
  };

  return (
    <Card
      className="mb-6"
      title={
        <Space>
          <RobotOutlined />
          <span>Agent Team 工作台</span>
          {status && <Tag color={status.color}>{status.label}</Tag>}
        </Space>
      }
      extra={
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={loadLatestRun}
            loading={loading}
          >
            刷新
          </Button>
          <Button
            type="primary"
            icon={running ? <SyncOutlined spin /> : <PlayCircleOutlined />}
            onClick={handleStart}
            loading={running}
          >
            运行 Agent Team
          </Button>
        </Space>
      }
    >
      {loading ? (
        <div className="flex min-h-[120px] items-center justify-center">
          <Spin />
        </div>
      ) : !run ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="尚未生成 Agent 建议"
        />
      ) : (
        <div className="space-y-5">
          {run.error && (
            <Alert
              type="error"
              showIcon
              message="Agent Team 运行失败"
              description={run.error}
            />
          )}

          {latestSummary && (
            <Alert
              type={run.status === 'failed' ? 'error' : 'info'}
              showIcon
              message="最新结论"
              description={
                <Space direction="vertical" size={6}>
                  <Text>{String(latestSummary)}</Text>
                  <Space wrap>
                    {recommendedNextStepText ? <Tag color="blue">{recommendedNextStepText}</Tag> : null}
                    {run.result?.safe_to_auto_apply === false && (
                      <Tag icon={<SafetyCertificateOutlined />} color="orange">
                        HR 人工确认
                      </Tag>
                    )}
                  </Space>
                </Space>
              }
            />
          )}

          <Steps
            size="small"
            current={Math.max(0, run.steps.filter((step) => step.status === 'completed').length - 1)}
            items={
              run.steps.length > 0
                ? run.steps.map((step) => ({
                    title: agentNames[step.agent_name] || step.agent_name,
                    description: normalizeStepSummary(step)
                      ? clampText(normalizeStepSummary(step)!)
                      : step.error
                      ? clampText(step.error)
                      : undefined,
                    status: getStepStatus(step),
                    icon:
                      step.status === 'completed' ? (
                        <CheckCircleOutlined />
                      ) : step.status === 'failed' ? (
                        <ExclamationCircleOutlined />
                      ) : undefined,
                  }))
                : [
                    {
                      title: '等待编排',
                      description: '运行记录已创建',
                      status: run.status === 'failed' ? 'error' : 'process',
                    },
                  ]
            }
          />

          {run.steps.length > 0 && (
            <List
              size="small"
              className="rounded-md border border-gray-100"
              header={<Text strong>完整运行记录</Text>}
              dataSource={run.steps}
              renderItem={(step) => {
                const summary = normalizeStepSummary(step) || step.error || '暂无步骤摘要';
                const stepStatus = statusMeta[step.status === 'completed' ? 'completed' : step.status === 'failed' ? 'failed' : 'running'];

                return (
                  <List.Item
                    actions={[
                      <Button
                        key="detail"
                        type="link"
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => setSelectedStep(step)}
                      >
                        查看完整
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <Space wrap>
                          <Text strong>{agentNames[step.agent_name] || step.agent_name}</Text>
                          <Tag color={stepStatus.color}>{stepStatus.label}</Tag>
                        </Space>
                      }
                      description={
                        <Paragraph
                          className="!mb-0"
                          ellipsis={{ rows: 2, expandable: true, symbol: '展开' }}
                        >
                          {summary}
                        </Paragraph>
                      }
                    />
                  </List.Item>
                );
              }}
            />
          )}

          {run.status === 'completed' && (
            <Collapse
              size="small"
              items={[
                {
                  key: 'review',
                  label: '候选人复核',
                  children: (
                    <div className="grid gap-4 md:grid-cols-3">
                      <List
                        size="small"
                        header={<Text strong>优势</Text>}
                        dataSource={reviewStrengths}
                        locale={{ emptyText: '暂无优势' }}
                        renderItem={(item) => <List.Item>{item}</List.Item>}
                      />
                      <List
                        size="small"
                        header={<Text strong>风险</Text>}
                        dataSource={reviewRisks}
                        locale={{ emptyText: '暂无风险' }}
                        renderItem={(item) => <List.Item>{item}</List.Item>}
                      />
                      <List
                        size="small"
                        header={<Text strong>下一步</Text>}
                        dataSource={nextActions}
                        locale={{ emptyText: '暂无建议' }}
                        renderItem={(item) => <List.Item>{item}</List.Item>}
                      />
                    </div>
                  ),
                },
                {
                  key: 'interview',
                  label: '面试验证',
                  children: (
                    <List
                      size="small"
                      dataSource={interviewQuestions}
                      locale={{ emptyText: '暂无面试问题' }}
                      renderItem={(item) => {
                        const area = item.area ? String(item.area) : null;
                        const goodSignal = item.good_signal ? String(item.good_signal) : null;
                        const riskSignal = item.risk_signal ? String(item.risk_signal) : null;

                        return (
                          <List.Item>
                            <List.Item.Meta
                              title={String(item.question || '待补充问题')}
                              description={
                                <Space direction="vertical" size={4}>
                                  {area ? <Text type="secondary">方向：{area}</Text> : null}
                                  {goodSignal ? <Text type="secondary">正向信号：{goodSignal}</Text> : null}
                                  {riskSignal ? <Text type="secondary">风险信号：{riskSignal}</Text> : null}
                                </Space>
                              }
                            />
                          </List.Item>
                        );
                      }}
                    />
                  ),
                },
                {
                  key: 'communication',
                  label: '沟通草稿',
                  children: (
                    <Space direction="vertical" size={12} className="w-full">
                      <Paragraph
                        className="rounded-md bg-gray-50 p-3"
                        copyable={
                          communicationOutput.candidate_message_draft
                            ? { text: String(communicationOutput.candidate_message_draft) }
                            : false
                        }
                      >
                        {String(communicationOutput.candidate_message_draft || '暂无候选人沟通草稿')}
                      </Paragraph>
                      {communicationOutput.internal_note ? (
                        <Text type="secondary">{String(communicationOutput.internal_note)}</Text>
                      ) : null}
                    </Space>
                  ),
                },
                {
                  key: 'audit',
                  label: '人工审核点',
                  children: (
                    <div className="grid gap-4 md:grid-cols-2">
                      <List
                        size="small"
                        dataSource={humanReviewPoints}
                        locale={{ emptyText: '暂无审核点' }}
                        renderItem={(item) => <List.Item>{item}</List.Item>}
                      />
                      <List
                        size="small"
                        dataSource={auditNotes}
                        locale={{ emptyText: '暂无审计记录' }}
                        renderItem={(item) => <List.Item>{item}</List.Item>}
                      />
                    </div>
                  ),
                },
              ]}
            />
          )}

          <Drawer
            title={
              selectedStep ? (
                <Space>
                  <RobotOutlined />
                  <span>{agentNames[selectedStep.agent_name] || selectedStep.agent_name}</span>
                  <Tag>{`第 ${selectedStep.step_index} 步`}</Tag>
                </Space>
              ) : 'Agent 详情'
            }
            open={!!selectedStep}
            onClose={() => setSelectedStep(null)}
            width="min(760px, 100vw)"
            destroyOnClose
          >
            {selectedStep && (
              <Space direction="vertical" size={16} className="w-full">
                {selectedSummary ? (
                  <Alert type="info" showIcon message="步骤摘要" description={selectedSummary} />
                ) : null}
                {selectedStep.error ? (
                  <Alert type="error" showIcon message="执行错误" description={selectedStep.error} />
                ) : null}
                <Tabs
                  items={[
                    {
                      key: 'readable',
                      label: '完整内容',
                      children: renderReadableOutput(selectedStep),
                    },
                    {
                      key: 'output',
                      label: '输出 JSON',
                      children: (
                        <pre className="max-h-[560px] overflow-auto rounded-md bg-slate-950 p-4 text-xs leading-5 text-slate-50">
                          {formatJson(selectedOutput)}
                        </pre>
                      ),
                    },
                    {
                      key: 'input',
                      label: '输入 JSON',
                      children: (
                        <pre className="max-h-[560px] overflow-auto rounded-md bg-slate-950 p-4 text-xs leading-5 text-slate-50">
                          {formatJson(selectedStep.input_packet)}
                        </pre>
                      ),
                    },
                  ]}
                />
              </Space>
            )}
          </Drawer>
        </div>
      )}
    </Card>
  );
}
