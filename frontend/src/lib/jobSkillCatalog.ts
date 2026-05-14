export type JobSkillCategory =
  | 'frontend'
  | 'backend'
  | 'test'
  | 'product'
  | 'ui'
  | 'data'
  | 'algorithm'
  | 'operation'
  | 'customer_success'
  | 'general';

export type JobSkillOptionType = 'required' | 'bonus';

interface SkillProfile {
  category: JobSkillCategory;
  keywords: string[];
  required: string[];
  bonus: string[];
}

export const jobSkillProfiles: SkillProfile[] = [
  {
    category: 'frontend',
    keywords: ['前端', '全栈', 'frontend', 'web'],
    required: ['React', 'TypeScript', 'Next.js', 'Vue', '前端工程化', '组件化开发', 'HTML/CSS', 'JavaScript'],
    bonus: ['性能优化', '微前端', 'Ant Design', '可视化图表', '状态管理', '响应式布局', 'SSR', '低代码平台'],
  },
  {
    category: 'backend',
    keywords: ['后端', 'java', '服务端', 'backend'],
    required: ['Java', 'Spring Boot', 'MySQL', 'Redis', '消息队列', '分布式系统', 'RESTful API', 'Linux'],
    bonus: ['高并发', '微服务', '性能调优', '容器化部署', 'Kubernetes', 'DDD', '服务治理', 'CI/CD'],
  },
  {
    category: 'algorithm',
    keywords: ['算法', '机器学习', 'ai', '大模型', 'nlp'],
    required: ['Python', '机器学习', '深度学习', 'PyTorch', '特征工程', '模型评估', '数据清洗', '算法调优'],
    bonus: ['大模型', 'NLP', '推荐系统', '向量检索', '模型部署', 'RAG', 'AIGC', '多模态'],
  },
  {
    category: 'test',
    keywords: ['测试', 'qa', '质量'],
    required: ['Python', '自动化测试', '接口测试', 'Playwright', 'Pytest', '测试用例设计', '缺陷跟踪', 'SQL'],
    bonus: ['测试平台', '性能测试', '回归测试', 'CI/CD', '质量保障', '稳定性测试', 'Mock 服务', '测试左移'],
  },
  {
    category: 'product',
    keywords: ['产品', 'pm', 'product'],
    required: ['需求分析', '产品规划', '原型设计', '数据分析', '用户研究', '项目推进', 'PRD', '竞品分析'],
    bonus: ['B端产品', 'SaaS', '商业化', '用户增长', '跨部门协作', '流程设计', '客户访谈', '产品迭代'],
  },
  {
    category: 'ui',
    keywords: ['ui', '设计', '交互', '视觉'],
    required: ['Figma', 'UI设计', '交互设计', '设计系统', '视觉规范', '原型设计', '用户体验', '设计交付'],
    bonus: ['B端设计', '组件库', '可用性测试', '动效设计', '移动端适配', '品牌视觉', '设计走查', '信息架构'],
  },
  {
    category: 'data',
    keywords: ['数据分析', '数据', 'bi'],
    required: ['SQL', 'Python', '数据分析', 'Tableau', '指标体系', '统计分析', 'Excel', '数据建模'],
    bonus: ['业务分析', '漏斗分析', '用户画像', 'BI报表', '增长分析', 'A/B测试', '归因分析', '数据治理'],
  },
  {
    category: 'operation',
    keywords: ['运营', '增长'],
    required: ['用户增长', '数据分析', '活动策划', '渠道运营', '转化优化', '内容运营', 'CRM', '用户分层'],
    bonus: ['A/B测试', '私域运营', '留存提升', '线索转化', '增长模型', '社群运营', '投放优化', '复盘分析'],
  },
  {
    category: 'customer_success',
    keywords: ['客户成功', 'csm', '交付', '实施'],
    required: ['客户经营', '需求梳理', '项目交付', '续费转化', 'SaaS实施', '沟通协调', '培训赋能', '风险识别'],
    bonus: ['客户健康度', 'NPS', '续约率', '解决方案', '风险预警', '项目管理', '价值复盘', '客户分层'],
  },
];

const generalProfile: SkillProfile = {
  category: 'general',
  keywords: [],
  required: ['业务理解', '沟通协作', '项目推进', '数据分析', '问题拆解', '执行落地'],
  bonus: ['结果导向', '跨团队协作', '流程优化', '风险识别', '复盘沉淀', '客户意识'],
};

export function inferJobSkillCategory(title?: string | null): JobSkillCategory {
  const text = (title || '').toLowerCase();
  const profile = jobSkillProfiles.find((item) => item.keywords.some((keyword) => text.includes(keyword.toLowerCase())));
  return profile?.category || 'general';
}

export function getBuiltinJobSkillOptions(titleOrCategory: string | JobSkillCategory | null | undefined, optionType: JobSkillOptionType): string[] {
  const category = titleOrCategory && jobSkillProfiles.some((profile) => profile.category === titleOrCategory)
    ? titleOrCategory as JobSkillCategory
    : inferJobSkillCategory(titleOrCategory);
  const profile = jobSkillProfiles.find((item) => item.category === category) || generalProfile;
  return optionType === 'required' ? profile.required : profile.bonus;
}

export function mergeSkillOptions(...groups: Array<Array<string | null | undefined> | undefined>): string[] {
  const result: string[] = [];
  for (const group of groups) {
    for (const item of group || []) {
      const value = String(item || '').trim();
      if (value && !result.includes(value)) result.push(value);
    }
  }
  return result;
}

export function toSelectOptions(values: string[]) {
  return values.map((value) => ({ label: value, value }));
}
