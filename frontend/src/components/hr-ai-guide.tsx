'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, Drawer, Input, Tag, Tooltip } from 'antd';
import { usePathname, useRouter } from 'next/navigation';

function MaterialIcon({
  name,
  className = '',
  fill = false,
}: {
  name: string;
  className?: string;
  fill?: boolean;
}) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={{ fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24` }}
    >
      {name}
    </span>
  );
}

type GuideCategory = 'quickstart' | 'sourcing' | 'screening' | 'followup' | 'growth' | 'system';

interface GuideAction {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: string;
  category: GuideCategory;
  keywords: string[];
  primary?: boolean;
}

const guideActions: GuideAction[] = [
  {
    id: 'dashboard',
    title: '查看今天招聘概览',
    description: '看简历总数、筛选进度、开放职位和最近活动。',
    href: '/dashboard',
    icon: 'dashboard',
    category: 'quickstart',
    keywords: ['概览', '控制面板', '数据', '今天', '进度'],
  },
  {
    id: 'workbench',
    title: '进入招聘工作台',
    description: '按待处理任务查看候选人、岗位和跟进事项。',
    href: '/dashboard/workbench',
    icon: 'view_kanban',
    category: 'quickstart',
    keywords: ['工作台', '任务', '待办', '处理'],
  },
  {
    id: 'settings',
    title: '先完善企业基础信息',
    description: '新人 HR 第一次使用时，建议先检查公司信息和基础配置。',
    href: '/dashboard/settings',
    icon: 'settings',
    category: 'quickstart',
    keywords: ['基础信息', '设置', '公司', '配置', '第一次'],
    primary: true,
  },
  {
    id: 'jobs',
    title: '配置岗位筛选条件',
    description: '设置技能、经验、学历和评分权重，后续分析会按这里匹配。',
    href: '/dashboard/jobs',
    icon: 'pageview',
    category: 'sourcing',
    keywords: ['岗位', '筛选', '条件', '权重', '技能', 'JD'],
    primary: true,
  },
  {
    id: 'new-job',
    title: '发布新职位',
    description: '从岗位画像开始创建一个新的招聘需求。',
    href: '/dashboard/jobs/new',
    icon: 'add_circle',
    category: 'sourcing',
    keywords: ['发布', '新职位', '创建岗位', '招聘需求'],
  },
  {
    id: 'upload',
    title: '上传简历并启动解析',
    description: '选择目标岗位后，批量上传 PDF、DOCX 或图片简历。',
    href: '/dashboard/resumes/upload',
    icon: 'cloud_upload',
    category: 'sourcing',
    keywords: ['上传', '简历', '解析', '文件', '批量'],
    primary: true,
  },
  {
    id: 'resume-library',
    title: '查看简历库',
    description: '按岗位和解析状态检查所有已上传简历。',
    href: '/dashboard/resumes',
    icon: 'folder_shared',
    category: 'sourcing',
    keywords: ['简历库', '文件', '解析状态', '候选人资料'],
  },
  {
    id: 'channels',
    title: '导入外部渠道候选人',
    description: '把渠道文本或授权导出的候选人信息导入系统。',
    href: '/dashboard/channels/import',
    icon: 'hub',
    category: 'sourcing',
    keywords: ['渠道', '导入', 'BOSS', '猎聘', '候选人'],
  },
  {
    id: 'analysis',
    title: '查看候选人匹配结果',
    description: '按 AI 分数、推荐等级和技能标签筛选候选人。',
    href: '/dashboard/analysis',
    icon: 'groups',
    category: 'screening',
    keywords: ['候选人', '结果', '评分', '推荐', '匹配', 'AI'],
    primary: true,
  },
  {
    id: 'shortlist',
    title: '处理优先沟通名单',
    description: '集中推进高分候选人，安排下一步沟通。',
    href: '/dashboard/shortlist',
    icon: 'connect_without_contact',
    category: 'screening',
    keywords: ['优先', '沟通', '入围', '高分', '名单'],
  },
  {
    id: 'pipeline',
    title: '查看招聘漏斗',
    description: '跟踪候选人从新简历到面试、录用的流转状态。',
    href: '/dashboard/pipeline',
    icon: 'conversion_path',
    category: 'followup',
    keywords: ['漏斗', '流程', '阶段', '跟进', '闭环'],
    primary: true,
  },
  {
    id: 'communications',
    title: '记录候选人沟通',
    description: '沉淀电话、邮件、微信和内部备注。',
    href: '/dashboard/communications',
    icon: 'forum',
    category: 'followup',
    keywords: ['沟通', '电话', '邮件', '微信', '备注'],
  },
  {
    id: 'interviews',
    title: '安排和查看面试',
    description: '查看待面试候选人和面试排期。',
    href: '/dashboard/interviews',
    icon: 'event_available',
    category: 'followup',
    keywords: ['面试', '安排', '待面试', '邀约'],
  },
  {
    id: 'feedback',
    title: '收集面试评价',
    description: '查看面试官反馈、风险点和录用建议。',
    href: '/dashboard/interview-feedback',
    icon: 'rate_review',
    category: 'followup',
    keywords: ['评价', '反馈', '面试官', '录用建议'],
  },
  {
    id: 'reminders',
    title: '查看自动提醒',
    description: '处理逾期跟进、待发送通知和流程提醒。',
    href: '/dashboard/reminders',
    icon: 'notification_important',
    category: 'followup',
    keywords: ['提醒', '自动', '逾期', '通知'],
  },
  {
    id: 'calendar',
    title: '打开日历排期',
    description: '用日历视图查看面试、沟通和关键时间点。',
    href: '/dashboard/calendar',
    icon: 'calendar_month',
    category: 'followup',
    keywords: ['日历', '排期', '时间', '会议'],
  },
  {
    id: 'templates',
    title: '维护邮件模板',
    description: '准备邀约、拒信、跟进等常用邮件内容。',
    href: '/dashboard/email-templates',
    icon: 'mail',
    category: 'followup',
    keywords: ['邮件', '模板', '邀约', '拒信'],
  },
  {
    id: 'talent-pool',
    title: '沉淀人才库',
    description: '把暂不入职但有价值的人才留存在长期池子里。',
    href: '/dashboard/talent-pool',
    icon: 'database',
    category: 'growth',
    keywords: ['人才库', '沉淀', '长期', '储备'],
  },
  {
    id: 'jd-optimizer',
    title: '优化 JD 文案',
    description: '检查岗位描述的吸引力、完整度和包容性。',
    href: '/dashboard/jd-optimizer',
    icon: 'auto_fix_high',
    category: 'growth',
    keywords: ['JD', '职位描述', '优化', '文案'],
  },
  {
    id: 'team',
    title: '管理团队成员',
    description: '邀请同事、调整角色，协同处理招聘任务。',
    href: '/dashboard/team',
    icon: 'group_add',
    category: 'system',
    keywords: ['团队', '成员', '权限', '邀请', '角色'],
  },
  {
    id: 'audit',
    title: '查看权限审计',
    description: '检查关键操作记录，适合管理员做合规回溯。',
    href: '/dashboard/audit',
    icon: 'admin_panel_settings',
    category: 'system',
    keywords: ['审计', '权限', '操作记录', '管理员'],
  },
];

const firstDayFlow = [
  'settings',
  'jobs',
  'upload',
  'analysis',
  'shortlist',
  'pipeline',
];

const pageTips = [
  {
    match: (pathname: string) => pathname === '/dashboard',
    title: '你现在在控制面板',
    detail: '适合先看今日招聘进度。如果要开始处理新人任务，下一步通常是去“搜索筛选”确认岗位标准。',
    nextId: 'jobs',
  },
  {
    match: (pathname: string) => pathname.startsWith('/dashboard/jobs'),
    title: '你现在在岗位筛选',
    detail: '这里决定 AI 怎么评估候选人。设置好技能、经验和权重后，就可以上传简历。',
    nextId: 'upload',
  },
  {
    match: (pathname: string) => pathname.startsWith('/dashboard/resumes/upload'),
    title: '你现在在简历上传',
    detail: '先选择目标岗位，再上传文件。上传完成后去候选人结果页看匹配评分。',
    nextId: 'analysis',
  },
  {
    match: (pathname: string) => pathname.startsWith('/dashboard/resumes'),
    title: '你现在在简历库',
    detail: '这里适合检查解析状态。想看 AI 推荐，请跳到候选人结果。',
    nextId: 'analysis',
  },
  {
    match: (pathname: string) => pathname.startsWith('/dashboard/analysis'),
    title: '你现在在候选人结果',
    detail: '先看强推荐和高分候选人，可以加入优先沟通或打开完整报告。',
    nextId: 'shortlist',
  },
  {
    match: (pathname: string) => pathname.startsWith('/dashboard/shortlist'),
    title: '你现在在优先沟通',
    detail: '这里处理最值得推进的人选。沟通后建议进入招聘漏斗统一跟进。',
    nextId: 'pipeline',
  },
  {
    match: (pathname: string) => pathname.startsWith('/dashboard/pipeline'),
    title: '你现在在招聘漏斗',
    detail: '这里适合检查每个候选人的阶段推进，面试和提醒都能从这里衔接。',
    nextId: 'interviews',
  },
  {
    match: (pathname: string) => pathname.startsWith('/dashboard/interviews'),
    title: '你现在在面试排期',
    detail: '面试结束后，可以到面试评价页集中查看反馈。',
    nextId: 'feedback',
  },
  {
    match: (pathname: string) => pathname.startsWith('/dashboard/talent-pool'),
    title: '你现在在人才库',
    detail: '这里适合沉淀暂不推进但长期有价值的人才。',
    nextId: 'jd-optimizer',
  },
];

interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  actions?: GuideAction[];
}

const starterPrompts = [
  '我是新人，从哪开始？',
  '我要上传简历',
  '怎么筛选候选人？',
  '怎么安排面试？',
  '我要优化 JD',
];

function findAction(id: string) {
  return guideActions.find((action) => action.id === id);
}

function getPageTip(pathname: string) {
  return pageTips.find((tip) => tip.match(pathname));
}

function findActionsByText(text: string) {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return [];

  return guideActions
    .map((action) => {
      const haystack = [action.title, action.description, action.category, ...action.keywords].join(' ').toLowerCase();
      const score =
        (haystack.includes(normalized) ? 3 : 0) +
        action.keywords.filter((keyword) => normalized.includes(keyword.toLowerCase()) || haystack.includes(normalized)).length +
        (action.primary ? 1 : 0);
      return { action, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((item) => item.action);
}

function buildAssistantReply(input: string, pathname: string): ChatMessage {
  const text = input.trim();
  const lowerText = text.toLowerCase();
  const pageTip = getPageTip(pathname);
  const nextAction = pageTip?.nextId ? findAction(pageTip.nextId) : undefined;

  if (/新人|新手|开始|不会|第一天|怎么用|流程/.test(text)) {
    return {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      text: '建议按“基础信息 → 岗位筛选 → 简历上传 → 候选人结果 → 优先沟通 → 招聘漏斗”的顺序走。这样新人 HR 不需要理解所有菜单，也能先完成一次招聘筛选闭环。',
      actions: firstDayFlow.map(findAction).filter((action): action is GuideAction => Boolean(action)),
    };
  }

  if (/面试|邀约|排期|评价|反馈/.test(text)) {
    return {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      text: '面试相关一般分三步：先在候选人结果或优先沟通里确定人选，再去待面试查看排期，面试结束后到面试评价查看反馈和风险点。',
      actions: ['shortlist', 'interviews', 'feedback', 'calendar'].map(findAction).filter((action): action is GuideAction => Boolean(action)),
    };
  }

  if (/上传|简历|解析|渠道|导入/.test(text)) {
    return {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      text: '简历进入系统有两条路：有文件就走“简历上传”，来自招聘平台或外部文本就走“渠道导入”。上传后可以在简历库检查解析状态。',
      actions: ['upload', 'channels', 'resume-library', 'analysis'].map(findAction).filter((action): action is GuideAction => Boolean(action)),
    };
  }

  if (/筛选|候选人|评分|推荐|匹配|结果/.test(text)) {
    return {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      text: '筛选候选人时，先确认岗位筛选条件，再查看候选人结果。高分或强推荐的人选可以加入优先沟通，之后进入招聘漏斗跟进。',
      actions: ['jobs', 'analysis', 'shortlist', 'pipeline'].map(findAction).filter((action): action is GuideAction => Boolean(action)),
    };
  }

  if (/jd|职位描述|文案|优化|岗位/.test(lowerText)) {
    return {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      text: '岗位相关可以先配置筛选条件，再用 JD 优化检查职位描述是否清晰、有吸引力，也可以直接发布新职位。',
      actions: ['jobs', 'jd-optimizer', 'new-job'].map(findAction).filter((action): action is GuideAction => Boolean(action)),
    };
  }

  if (/团队|成员|权限|审计|设置|公司/.test(text)) {
    return {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      text: '系统管理相关主要是基础信息、团队成员和权限审计。新人 HR 通常只需要先确认基础信息；管理员再处理成员和权限。',
      actions: ['settings', 'team', 'audit'].map(findAction).filter((action): action is GuideAction => Boolean(action)),
    };
  }

  const matched = findActionsByText(text);
  if (matched.length > 0) {
    return {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      text: '我找到这些可能相关的功能。你可以直接点下面的按钮跳过去。',
      actions: matched,
    };
  }

  return {
    id: `assistant-${Date.now()}`,
    role: 'assistant',
    text: pageTip
      ? `${pageTip.title}。${pageTip.detail}`
      : '我还没完全理解你的问题。你可以试试输入“上传简历”“筛选候选人”“安排面试”“优化 JD”，我会给你对应入口。',
    actions: nextAction ? [nextAction] : firstDayFlow.map(findAction).filter((action): action is GuideAction => Boolean(action)),
  };
}

export function HrAiGuide() {
  const router = useRouter();
  const pathname = usePathname() || '/dashboard';
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const pageTip = getPageTip(pathname);
  const nextAction = pageTip?.nextId ? findAction(pageTip.nextId) : undefined;
  const initialMessages = useMemo<ChatMessage[]>(
    () => [
      {
        id: 'welcome',
        role: 'assistant',
        text: '你好，我是新人 HR 引导助手。你可以直接问我“从哪开始”“怎么上传简历”“怎么筛选候选人”，我会告诉你该做什么，并给你对应页面入口。',
        actions: nextAction ? [nextAction] : firstDayFlow.map(findAction).filter((action): action is GuideAction => Boolean(action)),
      },
    ],
    [nextAction]
  );
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);

  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, open]);

  const navigateTo = (href: string) => {
    router.push(href);
    setOpen(false);
  };

  const ask = (content: string) => {
    const value = content.trim();
    if (!value) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: value,
    };
    const assistantMessage = buildAssistantReply(value, pathname);
    setMessages((current) => [...current, userMessage, assistantMessage]);
    setInput('');
  };

  const resetChat = () => {
    setMessages(initialMessages);
    setInput('');
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-[60]">
        <Tooltip title="新人 HR AI 引导">
          <Badge dot offset={[-6, 6]}>
            <Button
              type="primary"
              aria-label="打开新人 HR AI 引导"
              className="flex h-14 items-center gap-2 rounded-full bg-[#00288e] px-4 font-black shadow-xl shadow-blue-900/20"
              icon={<MaterialIcon name="psychology" className="text-2xl" fill />}
              onClick={() => setOpen(true)}
            >
              <span className="hidden sm:inline">新人引导</span>
            </Button>
          </Badge>
        </Tooltip>
      </div>

      <Drawer
        title={
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#dde1ff] text-[#00288e]">
              <MaterialIcon name="psychology" fill />
            </span>
            <span>
              <span className="block text-base font-black text-slate-950">新人 HR AI 引导</span>
              <span className="text-xs font-semibold text-slate-500">像聊天一样问我，点击建议即可跳转</span>
            </span>
          </div>
        }
        width={440}
        open={open}
        placement="right"
        onClose={() => setOpen(false)}
        styles={{ body: { padding: 0, background: '#fbf8ff' } }}
      >
        <div className="flex h-full min-h-[calc(100vh-56px)] flex-col">
          <div className="border-b border-slate-200 bg-white px-5 py-3">
            <div className="flex items-start gap-3 rounded-lg bg-blue-50 p-3">
              <MaterialIcon name="explore" className="mt-0.5 text-[#00288e]" />
              <div className="min-w-0">
                <p className="text-sm font-black text-[#00288e]">{pageTip?.title || '当前可以从新人路线开始'}</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  {pageTip?.detail || '不知道点哪里时，可以直接问我你想完成的事。'}
                </p>
                {nextAction ? (
                  <Button
                    size="small"
                    type="primary"
                    className="mt-2 rounded-lg bg-[#00288e] font-bold"
                    icon={<MaterialIcon name={nextAction.icon} className="text-base" />}
                    onClick={() => navigateTo(nextAction.href)}
                  >
                    去下一步
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            {messages.map((message) => (
              <div key={message.id} className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div className={message.role === 'user' ? 'max-w-[82%] rounded-2xl rounded-tr-md bg-[#00288e] px-4 py-3 text-white shadow-sm' : 'max-w-[88%] rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 shadow-sm'}>
                  {message.role === 'assistant' ? (
                    <div className="mb-2 flex items-center gap-2 text-xs font-black text-[#00288e]">
                      <MaterialIcon name="smart_toy" className="text-base" fill />
                      TalentScreen 助手
                    </div>
                  ) : null}
                  <p className="whitespace-pre-line text-sm leading-6">{message.text}</p>
                  {message.actions?.length ? (
                    <div className="mt-3 space-y-2">
                      {message.actions.map((action) => {
                        const active = pathname === action.href || pathname.startsWith(`${action.href}/`);
                        return (
                          <button
                            key={`${message.id}-${action.id}`}
                            type="button"
                            className={[
                              'flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition hover:border-blue-200 hover:bg-blue-50',
                              active ? 'border-[#00288e] bg-blue-50' : 'border-slate-100 bg-slate-50',
                            ].join(' ')}
                            onClick={() => navigateTo(action.href)}
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-[#00288e] shadow-sm">
                              <MaterialIcon name={action.icon} className="text-lg" fill={action.primary} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2">
                                <span className="truncate text-sm font-black text-slate-950">{action.title}</span>
                                {active ? <Tag color="blue" className="m-0 shrink-0">当前</Tag> : null}
                              </span>
                              <span className="block truncate text-xs text-slate-500">{action.description}</span>
                            </span>
                            <MaterialIcon name="arrow_forward" className="text-lg text-slate-400" />
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-slate-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap gap-2">
              {starterPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-[#00288e]"
                  onClick={() => ask(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onPressEnter={() => ask(input)}
                prefix={<MaterialIcon name="chat" className="text-slate-400" />}
                placeholder="问我：我要上传简历，下一步做什么？"
                className="h-11 rounded-lg"
              />
              <Button
                type="primary"
                className="h-11 rounded-lg bg-[#00288e] px-4 font-bold"
                icon={<MaterialIcon name="send" className="text-lg" />}
                onClick={() => ask(input)}
              >
                发送
              </Button>
            </div>
            <button
              type="button"
              className="mt-3 border-0 bg-transparent p-0 text-xs font-bold text-slate-400 hover:text-[#00288e]"
              onClick={resetChat}
            >
              清空对话并重新开始
            </button>
          </div>
        </div>
      </Drawer>
    </>
  );
}
