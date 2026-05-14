'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Form,
  Input,
  Button,
  Card,
  Steps,
  Select,
  Slider,
  Space,
  message,
  Radio,
  Divider,
  Tag,
  Modal,
} from 'antd';
import { PlusOutlined, SaveOutlined } from '@ant-design/icons';
import {
  activateJobRequirement,
  createJobRequirement,
  fetchJobTemplates,
  createJobTemplate as apiCreateJobTemplate,
} from '@/lib/api/job';
import { createJobSkillOption, fetchJobSkillOptions } from '@/lib/api/jobSkillOption';
import { defaultWeightConfig, resolveWeightConfig, weightOptions } from '@/config/jobOptions';
import {
  getBuiltinJobSkillOptions,
  inferJobSkillCategory,
  mergeSkillOptions,
  toSelectOptions,
  type JobSkillOptionType,
} from '@/lib/jobSkillCatalog';
import type { Criteria, JobTemplate } from '@/types/job';

const { TextArea } = Input;
const { Step } = Steps;

interface JobTemplateOption {
  id: string;
  name: string;
  title: string;
  description: string;
  content: Criteria;
  isBuiltin?: boolean;
}

const makeCriteria = (overrides: Partial<Criteria>): Criteria => ({
  required_skills: [],
  bonus_skills: [],
  min_experience_years: 3,
  education: 'bachelor',
  industry_preference: ['互联网'],
  languages: ['中文'],
  weights: defaultWeightConfig,
  other_requirements: '具备良好的业务理解、沟通协作和结果交付意识。',
  ...overrides,
});

const builtinTemplates: JobTemplateOption[] = [
  {
    id: 'builtin-frontend',
    name: '高级前端工程师',
    title: '高级前端工程师',
    description: '负责核心业务前端架构、组件体系建设和复杂交互落地，持续提升页面性能、工程效率与用户体验。',
    isBuiltin: true,
    content: makeCriteria({
      required_skills: ['React', 'TypeScript', 'Next.js', 'Vue', '前端工程化'],
      bonus_skills: ['性能优化', '微前端', 'Ant Design', '可视化图表', '状态管理'],
      min_experience_years: 3,
      industry_preference: ['互联网', 'SaaS'],
      weights: { skill_match: 'high', experience_match: 'medium', education: 'low', project_relevance: 'medium', overall_quality: 'medium' },
    }),
  },
  {
    id: 'builtin-backend',
    name: 'Java 后端工程师',
    title: 'Java 后端工程师',
    description: '负责服务端核心模块、业务接口、数据模型和系统稳定性建设，支撑高并发业务场景与持续交付。',
    isBuiltin: true,
    content: makeCriteria({
      required_skills: ['Java', 'Spring Boot', 'MySQL', 'Redis', '消息队列'],
      bonus_skills: ['高并发', '微服务', '分布式系统', '性能调优', '容器化部署'],
      min_experience_years: 3,
      industry_preference: ['互联网', '企业服务'],
      weights: { skill_match: 'high', experience_match: 'medium', education: 'low', project_relevance: 'medium', overall_quality: 'medium' },
    }),
  },
  {
    id: 'builtin-test',
    name: '测试开发工程师',
    title: '测试开发工程师',
    description: '负责自动化测试体系、接口与端到端测试、质量平台和发布质量保障，提升研发交付稳定性。',
    isBuiltin: true,
    content: makeCriteria({
      required_skills: ['Python', '自动化测试', '接口测试', 'Playwright', 'Pytest'],
      bonus_skills: ['质量保障', '测试平台', '回归测试', '性能测试', 'CI/CD'],
      min_experience_years: 2,
      industry_preference: ['互联网', '企业服务'],
      weights: { skill_match: 'high', experience_match: 'medium', education: 'low', project_relevance: 'medium', overall_quality: 'medium' },
    }),
  },
  {
    id: 'builtin-product',
    name: '资深产品经理',
    title: '资深产品经理',
    description: '负责产品规划、需求分析、业务流程设计和跨团队推进，持续提升产品价值、转化效率与客户体验。',
    isBuiltin: true,
    content: makeCriteria({
      required_skills: ['需求分析', '产品规划', '原型设计', '数据分析', '项目推进'],
      bonus_skills: ['B端产品', 'SaaS', 'PRD', '用户增长', '商业化'],
      min_experience_years: 5,
      industry_preference: ['SaaS', '互联网'],
      weights: { skill_match: 'medium', experience_match: 'high', education: 'low', project_relevance: 'high', overall_quality: 'medium' },
    }),
  },
  {
    id: 'builtin-ui',
    name: 'UI 设计师',
    title: 'UI 设计师',
    description: '负责产品视觉体验、交互方案、设计系统和高保真交付，保障 B 端复杂场景的一致性和易用性。',
    isBuiltin: true,
    content: makeCriteria({
      required_skills: ['Figma', 'UI设计', '交互设计', '设计系统', '视觉规范'],
      bonus_skills: ['B端设计', '组件库', '可用性测试', '用户体验', '设计交付'],
      min_experience_years: 2,
      industry_preference: ['互联网', 'SaaS'],
      weights: { skill_match: 'high', experience_match: 'medium', education: 'low', project_relevance: 'medium', overall_quality: 'high' },
    }),
  },
  {
    id: 'builtin-data',
    name: '数据分析师',
    title: '数据分析师',
    description: '负责业务指标体系、数据看板、专题分析和增长洞察，帮助团队用数据定位问题并推动业务决策。',
    isBuiltin: true,
    content: makeCriteria({
      required_skills: ['SQL', 'Python', '数据分析', 'Tableau', '指标体系'],
      bonus_skills: ['业务分析', '漏斗分析', '用户画像', 'BI报表', '数据建模'],
      min_experience_years: 3,
      industry_preference: ['互联网', '金融科技'],
      weights: { skill_match: 'high', experience_match: 'medium', education: 'low', project_relevance: 'high', overall_quality: 'medium' },
    }),
  },
];

export default function NewJobPage() {
  const router = useRouter();
  const [form] = Form.useForm();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<JobTemplateOption[]>(builtinTemplates);
  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  const [requiredSkills, setRequiredSkills] = useState<string[]>([]);
  const [bonusSkills, setBonusSkills] = useState<string[]>([]);
  const [industryPreference, setIndustryPreference] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [industryInput, setIndustryInput] = useState('');
  const [languageInput, setLanguageInput] = useState('');
  const [customRequiredOptions, setCustomRequiredOptions] = useState<string[]>([]);
  const [customBonusOptions, setCustomBonusOptions] = useState<string[]>([]);
  const watchedTitle = Form.useWatch('title', form) as string | undefined;
  const jobSkillCategory = useMemo(() => inferJobSkillCategory(watchedTitle), [watchedTitle]);
  const requiredSkillOptions = useMemo(
    () => toSelectOptions(mergeSkillOptions(getBuiltinJobSkillOptions(jobSkillCategory, 'required'), customRequiredOptions, requiredSkills)),
    [customRequiredOptions, jobSkillCategory, requiredSkills]
  );
  const bonusSkillOptions = useMemo(
    () => toSelectOptions(mergeSkillOptions(getBuiltinJobSkillOptions(jobSkillCategory, 'bonus'), customBonusOptions, bonusSkills)),
    [bonusSkills, customBonusOptions, jobSkillCategory]
  );

  useEffect(() => {
    loadTemplates();
  }, []);

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

  const loadTemplates = async () => {
    try {
      const response = await fetchJobTemplates();
      const customTemplates: JobTemplateOption[] = (response.items || []).map((template: JobTemplate) => ({
        id: template.id,
        name: template.name,
        title: '',
        description: '',
        content: template.content,
      }));
      setTemplates([...builtinTemplates, ...customTemplates]);
    } catch (error) {
      console.error('加载模板失败', error);
    }
  };

  const educationOptions = [
    { label: '不限', value: '' },
    { label: '高中', value: 'high_school' },
    { label: '大专', value: 'vocational' },
    { label: '本科', value: 'bachelor' },
    { label: '硕士', value: 'master' },
    { label: '博士', value: 'doctor' },
  ];

  const commonIndustries = ['互联网', '金融', '教育', '医疗', '制造业', '零售', '房地产'];
  const commonLanguages = ['中文', '英语', '日语', '韩语'];

  const handleRemoveSkill = (skill: string) => {
    setRequiredSkills(requiredSkills.filter(s => s !== skill));
  };

  const handleRemoveBonusSkill = (skill: string) => {
    setBonusSkills(bonusSkills.filter(s => s !== skill));
  };

  const handleAddIndustry = () => {
    if (industryInput && !industryPreference.includes(industryInput)) {
      setIndustryPreference([...industryPreference, industryInput]);
      setIndustryInput('');
    }
  };

  const handleRemoveIndustry = (industry: string) => {
    setIndustryPreference(industryPreference.filter(i => i !== industry));
  };

  const handleAddLanguage = () => {
    if (languageInput && !languages.includes(languageInput)) {
      setLanguages([...languages, languageInput]);
      setLanguageInput('');
    }
  };

  const handleRemoveLanguage = (language: string) => {
    setLanguages(languages.filter(l => l !== language));
  };

  const loadFromTemplate = (template: JobTemplateOption) => {
    const criteria = template.content;
    form.setFieldsValue({
      title: template.title,
      description: template.description,
      min_experience_years: criteria.min_experience_years || 0,
      education: criteria.education || '',
      weights: resolveWeightConfig(criteria.weights),
      other_requirements: criteria.other_requirements || '',
    });
    setRequiredSkills(criteria.required_skills || []);
    setBonusSkills(criteria.bonus_skills || []);
    setIndustryPreference(criteria.industry_preference || []);
    setLanguages(criteria.languages || []);
    setTemplateModalVisible(false);
    message.success('已从模板加载');
  };

  const persistCustomSkillOptions = async (optionType: JobSkillOptionType, values: string[]) => {
    const builtin = getBuiltinJobSkillOptions(jobSkillCategory, optionType);
    const custom = optionType === 'required' ? customRequiredOptions : customBonusOptions;
    const selected = optionType === 'required' ? requiredSkills : bonusSkills;
    const nextValues = mergeSkillOptions(values).filter((value) => !builtin.includes(value) && !custom.includes(value) && !selected.includes(value));
    if (nextValues.length === 0) return;

    try {
      const saved = await Promise.all(
        nextValues.map((value) => createJobSkillOption({ job_type: jobSkillCategory, option_type: optionType, value }))
      );
      const savedValues = saved.map((item) => item.value);
      if (optionType === 'required') {
        setCustomRequiredOptions((current) => mergeSkillOptions(current, savedValues));
      } else {
        setCustomBonusOptions((current) => mergeSkillOptions(current, savedValues));
      }
    } catch {
      message.warning('自定义选项已加入当前表单，但保存到账户失败，请稍后重试');
    }
  };

  const handleRequiredSkillsChange = (values: string[]) => {
    const normalized = mergeSkillOptions(values);
    const previous = requiredSkills;
    setRequiredSkills(normalized);
    void persistCustomSkillOptions('required', normalized.filter((value) => !previous.includes(value)));
  };

  const handleBonusSkillsChange = (values: string[]) => {
    const normalized = mergeSkillOptions(values);
    const previous = bonusSkills;
    setBonusSkills(normalized);
    void persistCustomSkillOptions('bonus', normalized.filter((value) => !previous.includes(value)));
  };

  const handleSubmit = async (publish = false) => {
    try {
      await form.validateFields();
      const values = form.getFieldsValue(true);
      setLoading(true);

      const criteria: Criteria = {
        required_skills: requiredSkills,
        bonus_skills: bonusSkills,
        min_experience_years: values.min_experience_years || 0,
        education: values.education || null,
        industry_preference: industryPreference,
        languages: languages,
        weights: resolveWeightConfig(values.weights),
        other_requirements: values.other_requirements || '',
      };

      const job = await createJobRequirement({
        title: values.title,
        description: values.description,
        criteria,
      });
      if (publish) {
        await activateJobRequirement(job.id);
        message.success('职位已发布');
      } else {
        message.success('岗位已保存为草稿');
      }
      router.push('/dashboard/jobs');
    } catch (error) {
      message.error(publish ? '发布失败，请检查筛选条件后重试' : '保存失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAsTemplate = async () => {
    try {
      await form.validateFields();
      const values = form.getFieldsValue(true);

      const criteria: Criteria = {
        required_skills: requiredSkills,
        bonus_skills: bonusSkills,
        min_experience_years: values.min_experience_years || 0,
        education: values.education || null,
        industry_preference: industryPreference,
        languages: languages,
        weights: resolveWeightConfig(values.weights),
        other_requirements: values.other_requirements || '',
      };

      let templateName = '';
      const confirm = await new Promise<boolean>((resolve) => {
        Modal.confirm({
          title: '保存为模板',
          content: (
            <Input
              placeholder="请输入模板名称"
              onChange={(e) => (templateName = e.target.value)}
            />
          ),
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        });
      });

      if (confirm && templateName) {
        setLoading(true);
        await apiCreateJobTemplate({ name: templateName, content: criteria });
        message.success('模板保存成功');
        loadTemplates();
      }
    } catch (error) {
      // 用户取消或错误
    } finally {
      setLoading(false);
    }
  };

  const handleNextStep = async () => {
    if (currentStep === 0) {
      await form.validateFields(['title']);
    }
    setCurrentStep(currentStep + 1);
  };

  const steps = [
    {
      title: '基本信息',
      content: (
        <Card>
          <Form.Item
            name="title"
            label="岗位名称"
            rules={[{ required: true, message: '请输入岗位名称' }]}
          >
            <Input placeholder="例如: 高级前端工程师" />
          </Form.Item>

          <Form.Item name="description" label="岗位描述">
            <TextArea rows={4} placeholder="描述岗位职责、工作内容等..." />
          </Form.Item>

          <Divider>从模板加载</Divider>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {builtinTemplates.slice(0, 6).map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => loadFromTemplate(template)}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:-translate-y-0.5 hover:border-[#00288e]/40 hover:bg-white hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-black text-slate-950">{template.name}</span>
                  <Tag className="m-0 border-0 bg-blue-50 font-bold text-[#00288e]">默认</Tag>
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{template.description}</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {template.content.required_skills.slice(0, 3).map((skill) => (
                    <Tag key={skill} className="m-0 border-0 bg-white text-slate-600">{skill}</Tag>
                  ))}
                </div>
              </button>
            ))}
          </div>
          <div className="mt-4">
            <Button onClick={() => setTemplateModalVisible(true)}>查看更多模板 / 使用自定义模板</Button>
          </div>
        </Card>
      ),
    },
    {
      title: '筛选条件',
      content: (
        <Card>
          {/* 必备技能 */}
          <div className="mb-6">
            <label className="block mb-2 font-medium">必备技能</label>
            <Select
              mode="tags"
              value={requiredSkills}
              onChange={handleRequiredSkillsChange}
              tokenSeparators={[',', '，']}
              placeholder="根据岗位推荐技能，也可以直接输入新技能"
              options={requiredSkillOptions}
              className="mb-2 w-full"
            />
            <p className="mb-3 text-xs text-slate-500">当前按“{jobSkillCategory}”推荐选项；自己输入的新技能会保存到当前账号。</p>
            <div className="flex flex-wrap gap-2">
              {requiredSkills.map((skill) => (
                <Tag
                  key={skill}
                  closable
                  onClose={() => handleRemoveSkill(skill)}
                  color="blue"
                >
                  {skill}
                </Tag>
              ))}
            </div>
          </div>

          {/* 加分技能 */}
          <div className="mb-6">
            <label className="block mb-2 font-medium">加分技能</label>
            <Select
              mode="tags"
              value={bonusSkills}
              onChange={handleBonusSkillsChange}
              tokenSeparators={[',', '，']}
              placeholder="根据岗位推荐关键词，也可以直接输入新关键词"
              options={bonusSkillOptions}
              className="mb-2 w-full"
            />
            <p className="mb-3 text-xs text-slate-500">自定义加分技能会绑定当前账号，后续同类岗位可继续选择。</p>
            <div className="flex flex-wrap gap-2">
              {bonusSkills.map((skill) => (
                <Tag
                  key={skill}
                  closable
                  onClose={() => handleRemoveBonusSkill(skill)}
                  color="green"
                >
                  {skill}
                </Tag>
              ))}
            </div>
          </div>

          {/* 工作年限 */}
          <Form.Item name="min_experience_years" label="最低工作年限" initialValue={0}>
            <Slider
              min={0}
              max={15}
              marks={{
                0: '不限',
                3: '3年',
                5: '5年',
                10: '10年+',
              }}
              tooltip={{ formatter: (value) => `${value} 年` }}
            />
          </Form.Item>

          {/* 学历要求 */}
          <Form.Item name="education" label="学历要求" initialValue="">
            <Select>
              {educationOptions.map((option) => (
                <Select.Option key={option.value} value={option.value}>
                  {option.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          {/* 行业偏好 */}
          <div className="mb-6">
            <label className="block mb-2 font-medium">行业偏好</label>
            <div className="flex gap-2 mb-2">
              <Select
                placeholder="选择或输入行业"
                value={industryInput || undefined}
                onChange={setIndustryInput}
                style={{ flex: 1 }}
                showSearch
                options={commonIndustries.map((i) => ({ label: i, value: i }))}
              />
              <Button onClick={handleAddIndustry} icon={<PlusOutlined />}>
                添加
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {industryPreference.map((industry) => (
                <Tag
                  key={industry}
                  closable
                  onClose={() => handleRemoveIndustry(industry)}
                  color="purple"
                >
                  {industry}
                </Tag>
              ))}
            </div>
          </div>

          {/* 语言要求 */}
          <div className="mb-6">
            <label className="block mb-2 font-medium">语言要求</label>
            <div className="flex gap-2 mb-2">
              <Select
                placeholder="选择或输入语言"
                value={languageInput || undefined}
                onChange={setLanguageInput}
                style={{ flex: 1 }}
                showSearch
                options={commonLanguages.map((l) => ({ label: l, value: l }))}
              />
              <Button onClick={handleAddLanguage} icon={<PlusOutlined />}>
                添加
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {languages.map((language) => (
                <Tag
                  key={language}
                  closable
                  onClose={() => handleRemoveLanguage(language)}
                  color="orange"
                >
                  {language}
                </Tag>
              ))}
            </div>
          </div>

          {/* 其他要求 */}
          <Form.Item name="other_requirements" label="其他要求">
            <TextArea rows={3} placeholder="其他筛选条件或要求..." />
          </Form.Item>
        </Card>
      ),
    },
    {
      title: '权重设置',
      content: (
        <Card>
          <p className="mb-4 text-gray-600">
            设置各维度在综合评分中的权重，权重越高该维度对最终评分影响越大。
          </p>

          <Form.Item
            name={['weights', 'skill_match']}
            label="技能匹配度"
          >
            <Radio.Group options={weightOptions} optionType="button" buttonStyle="solid" />
          </Form.Item>

          <Form.Item
            name={['weights', 'experience_match']}
            label="工作经验匹配度"
          >
            <Radio.Group options={weightOptions} optionType="button" buttonStyle="solid" />
          </Form.Item>

          <Form.Item name={['weights', 'education']} label="教育背景">
            <Radio.Group options={weightOptions} optionType="button" buttonStyle="solid" />
          </Form.Item>

          <Form.Item
            name={['weights', 'project_relevance']}
            label="项目经历相关性"
          >
            <Radio.Group options={weightOptions} optionType="button" buttonStyle="solid" />
          </Form.Item>

          <Form.Item
            name={['weights', 'overall_quality']}
            label="简历整体质量"
          >
            <Radio.Group options={weightOptions} optionType="button" buttonStyle="solid" />
          </Form.Item>

          <div className="mt-4 p-4 bg-blue-50 rounded">
            <p className="text-sm text-gray-700">
              <strong>权重说明:</strong> 高(系数3) &gt; 中(系数2) &gt; 低(系数1)
            </p>
          </div>
        </Card>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold">创建新岗位</h2>
      </div>

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          min_experience_years: 0,
          education: '',
          weights: defaultWeightConfig,
        }}
      >
        <Steps current={currentStep} className="mb-8">
          {steps.map((step, index) => (
            <Step key={index} title={step.title} />
          ))}
        </Steps>

        <div className="mb-6">{steps[currentStep].content}</div>

        <div className="flex justify-between">
          <Space>
            {currentStep > 0 && (
              <Button onClick={() => setCurrentStep(currentStep - 1)}>上一步</Button>
            )}
            {currentStep === 2 && (
              <Button icon={<SaveOutlined />} onClick={handleSaveAsTemplate} loading={loading}>
                保存为模板
              </Button>
            )}
          </Space>

          <Space>
            {currentStep < steps.length - 1 ? (
              <Button type="primary" onClick={handleNextStep}>
                下一步
              </Button>
            ) : (
              <>
                <Button onClick={() => handleSubmit(false)} loading={loading}>
                  保存草稿
                </Button>
                <Button type="primary" onClick={() => handleSubmit(true)} loading={loading}>
                  发布职位
                </Button>
              </>
            )}
          </Space>
        </div>
      </Form>

      {/* 模板选择弹窗 */}
      <Modal
        title="选择模板"
        open={templateModalVisible}
        onCancel={() => setTemplateModalVisible(false)}
        footer={null}
      >
        <div className="space-y-2">
          {templates.map((template) => (
            <Card
              key={template.id}
              hoverable
              onClick={() => loadFromTemplate(template)}
              className="cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">{template.name}</div>
                {template.isBuiltin ? <Tag color="blue">默认模板</Tag> : <Tag>自定义</Tag>}
              </div>
              {template.description ? <div className="mt-1 text-sm text-gray-500">{template.description}</div> : null}
              <div className="text-sm text-gray-500">
                技能: {(template.content.required_skills || []).slice(0, 3).join(', ')}
                {template.content.required_skills?.length > 3 && '...'}
              </div>
            </Card>
          ))}
          {templates.length === 0 && (
            <div className="text-center text-gray-500 py-4">暂无模板，请先创建模板</div>
          )}
        </div>
      </Modal>
    </div>
  );
}
