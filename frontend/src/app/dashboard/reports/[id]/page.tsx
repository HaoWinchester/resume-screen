'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, Empty, Input, Modal, Spin, Tag, message } from 'antd';
import { useParams, useRouter } from 'next/navigation';
import { AgentTeamPanel } from '@/components/agent-team-panel';
import { getErrorMessage } from '@/lib/api';
import {
  addCandidateWorkflowNote,
  fetchCandidateWorkflow,
  markCandidateContacted,
  markCandidatePriority,
  scheduleCandidateInterview,
  workflowStatusLabel,
} from '@/lib/api/candidateWorkflow';
import { fetchCandidateReport } from '@/lib/api/recruitment';
import type { CandidateWorkflowItem } from '@/types/candidateWorkflow';
import type { CandidateReport } from '@/types/recruitment';

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

export default function CandidateReportPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [report, setReport] = useState<CandidateReport | null>(null);
  const [workflow, setWorkflow] = useState<CandidateWorkflowItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [interviewOpen, setInterviewOpen] = useState(false);
  const [interviewTime, setInterviewTime] = useState('');
  const [interviewEmail, setInterviewEmail] = useState('');
  const [interviewLocation, setInterviewLocation] = useState('');
  const [interviewNote, setInterviewNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [nextReport, nextWorkflow] = await Promise.all([
          fetchCandidateReport(id),
          fetchCandidateWorkflow(id),
        ]);
        setReport(nextReport);
        setWorkflow(nextWorkflow);
        setNoteText(nextWorkflow.note || '');
      } catch {
        setError('候选人报告加载失败。');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id]);

  const handlePriority = async () => {
    try {
      const nextWorkflow = await markCandidatePriority(id, 'HR 从候选人报告加入优先沟通');
      setWorkflow(nextWorkflow);
      message.success('已加入优先沟通名单');
    } catch {
      message.error('加入优先沟通失败');
    }
  };

  const handleContacted = async () => {
    try {
      const nextWorkflow = await markCandidateContacted(id, 'HR 已完成一次候选人沟通');
      setWorkflow(nextWorkflow);
      message.success('已标记为已沟通');
    } catch {
      message.error('标记沟通失败');
    }
  };

  const handleScheduleInterview = async () => {
    if (!interviewTime) {
      message.warning('请选择面试时间');
      return;
    }
    if (!interviewLocation.trim()) {
      message.warning('请填写面试地点或会议链接');
      return;
    }
    try {
      const nextWorkflow = await scheduleCandidateInterview({
        analysisId: id,
        scheduled_at: new Date(interviewTime).toISOString(),
        mode: 'online',
        location: interviewLocation.trim(),
        note: interviewNote.trim() || undefined,
        candidate_email: interviewEmail.trim() || undefined,
      });
      setWorkflow(nextWorkflow);
      setInterviewOpen(false);
      setInterviewTime('');
      setInterviewEmail('');
      setInterviewLocation('');
      setInterviewNote('');
      message.success(nextWorkflow.email_delivery_message || '面试安排已保存，通知已发送');
    } catch (error) {
      message.error(getErrorMessage(error) || '安排面试失败');
    }
  };

  const handleSaveNote = async () => {
    if (!noteText.trim()) {
      message.warning('请填写备注内容');
      return;
    }
    try {
      const nextWorkflow = await addCandidateWorkflowNote(id, noteText.trim());
      setWorkflow(nextWorkflow);
      setNoteOpen(false);
      message.success('备注已保存');
    } catch {
      message.error('保存备注失败');
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
  if (!report) return <Empty description="暂无候选人报告" />;

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] bg-[#071a44] p-8 text-white shadow-sm lg:p-10">
        <Button className="mb-6 border-white/30 bg-white/10 text-white" onClick={() => router.back()}>
          返回
        </Button>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Tag className="mb-5 border-0 bg-white/10 px-3 py-1 font-bold text-blue-50">候选人推荐报告</Tag>
            <h1 className="text-4xl font-black tracking-tight">{report.candidateName}</h1>
            <p className="mt-3 text-blue-100">{report.jobTitle}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-6 text-center">
            <p className="text-sm text-blue-100">匹配分</p>
            <p className="mt-1 text-5xl font-black">{Math.round(report.score)}%</p>
            <p className="mt-2 font-bold text-emerald-200">{report.recommendationLabel}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold text-slate-500">候选人跟进状态</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Tag className="border-0 bg-blue-50 px-3 py-1 font-bold text-[#00288e]">{workflowStatusLabel(workflow?.status)}</Tag>
              {workflow?.contact_count ? <span className="text-sm text-slate-600">已沟通 {workflow.contact_count} 次</span> : null}
              {workflow?.interview_scheduled_at ? (
                <span className="text-sm text-slate-600">面试：{new Date(workflow.interview_scheduled_at).toLocaleString()}</span>
              ) : null}
            </div>
            {workflow?.note && <p className="mt-2 text-sm text-slate-500">备注：{workflow.note}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handlePriority}>{workflow?.is_priority ? '已加入优先' : '加入优先沟通'}</Button>
            <Button onClick={handleContacted}>标记已沟通</Button>
            <Button
              type="primary"
              className="bg-[#00288e]"
              onClick={() => {
                setInterviewEmail(report.candidateEmail || workflow?.candidate_email || '');
                setInterviewOpen(true);
              }}
            >
              安排面试
            </Button>
            <Button onClick={() => setNoteOpen(true)}>添加备注</Button>
          </div>
        </div>
      </section>

      <AgentTeamPanel analysisId={id} />

      <section className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <Panel title="推荐理由" icon="thumb_up">
          {report.recommendationReasons.map((item) => <li key={item}>{item}</li>)}
        </Panel>
        <Panel title="技能标签" icon="verified">
          {(report.skills.length ? report.skills : ['待面试确认']).map((item) => <li key={item}>{item}</li>)}
        </Panel>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Panel title="风险点" icon="warning">
          {report.riskPoints.map((item) => <li key={item}>{item}</li>)}
        </Panel>
        <Panel title="AI 面试问题" icon="quiz">
          {report.interviewQuestions.map((item) => <li key={item}>{item}</li>)}
        </Panel>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <MaterialIcon name="chat" className="text-3xl text-[#00288e]" fill />
          <h2 className="text-xl font-black">沟通话术</h2>
        </div>
        <div className="mt-5 space-y-3">
          {report.outreachScripts.map((script) => (
            <div key={script} className="rounded-xl bg-blue-50 p-4 text-sm leading-7 text-slate-700">
              {script}
            </div>
          ))}
        </div>
      </section>

      <Modal
        title="安排面试"
        open={interviewOpen}
        onOk={handleScheduleInterview}
        onCancel={() => {
          setInterviewOpen(false);
          setInterviewEmail('');
        }}
        okText="保存面试安排"
        cancelText="取消"
      >
        <div className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">面试时间</span>
            <input
              type="datetime-local"
              value={interviewTime}
              onChange={(event) => setInterviewTime(event.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 px-3"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">候选人邮箱</span>
            <Input type="email" value={interviewEmail} onChange={(event) => setInterviewEmail(event.target.value)} placeholder="没有邮箱时请在这里输入，用于发送面试通知" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">面试地点 / 会议链接</span>
            <Input value={interviewLocation} onChange={(event) => setInterviewLocation(event.target.value)} placeholder="例如：腾讯会议链接 / 公司会议室 A" />
          </label>
          <Input.TextArea value={interviewNote} onChange={(event) => setInterviewNote(event.target.value)} rows={4} placeholder="面试备注" />
        </div>
      </Modal>

      <Modal title="添加备注" open={noteOpen} onOk={handleSaveNote} onCancel={() => setNoteOpen(false)} okText="保存备注" cancelText="取消">
        <Input.TextArea value={noteText} onChange={(event) => setNoteText(event.target.value)} rows={5} placeholder="记录候选人意向、风险点或下一步动作" />
      </Modal>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <MaterialIcon name={icon} className="text-3xl text-[#00288e]" fill />
        <h2 className="text-xl font-black">{title}</h2>
      </div>
      <ul className="space-y-3 text-sm leading-7 text-slate-700">{children}</ul>
    </div>
  );
}
