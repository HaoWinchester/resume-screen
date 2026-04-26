'use client';

import { useState, useEffect } from 'react';
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
  createJobRequirement,
  fetchJobTemplates,
  createJobTemplate as apiCreateJobTemplate,
} from '@/lib/api/job';
import { defaultWeightConfig, resolveWeightConfig, weightOptions } from '@/config/jobOptions';
import type { Criteria } from '@/types/job';

const { TextArea } = Input;
const { Step } = Steps;

export default function NewJobPage() {
  const router = useRouter();
  const [form] = Form.useForm();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  const [requiredSkills, setRequiredSkills] = useState<string[]>([]);
  const [bonusSkills, setBonusSkills] = useState<string[]>([]);
  const [industryPreference, setIndustryPreference] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [bonusSkillInput, setBonusSkillInput] = useState('');
  const [industryInput, setIndustryInput] = useState('');
  const [languageInput, setLanguageInput] = useState('');

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const response = await fetchJobTemplates();
      setTemplates(response.items || []);
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

  const handleAddSkill = () => {
    if (skillInput && !requiredSkills.includes(skillInput)) {
      setRequiredSkills([...requiredSkills, skillInput]);
      setSkillInput('');
    }
  };

  const handleRemoveSkill = (skill: string) => {
    setRequiredSkills(requiredSkills.filter(s => s !== skill));
  };

  const handleAddBonusSkill = () => {
    if (bonusSkillInput && !bonusSkills.includes(bonusSkillInput)) {
      setBonusSkills([...bonusSkills, bonusSkillInput]);
      setBonusSkillInput('');
    }
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

  const loadFromTemplate = (template: any) => {
    const criteria = template.content;
    form.setFieldsValue({
      title: '',
      description: '',
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

  const handleSubmit = async () => {
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

      await createJobRequirement({
        title: values.title,
        description: values.description,
        criteria,
      });
      message.success('岗位创建成功');
      router.push('/dashboard/jobs');
    } catch (error) {
      message.error('操作失败');
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
          <Space direction="vertical" className="w-full">
            <Button onClick={() => setTemplateModalVisible(true)}>从现有模板加载</Button>
            {templates.length > 0 && (
              <div className="text-sm text-gray-500">
                可用模板: {templates.map((t) => t.name).join(', ')}
              </div>
            )}
          </Space>
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
            <div className="flex gap-2 mb-2">
              <Input
                placeholder="输入技能名称，如 React"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onPressEnter={handleAddSkill}
              />
              <Button onClick={handleAddSkill} icon={<PlusOutlined />}>
                添加
              </Button>
            </div>
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
            <div className="flex gap-2 mb-2">
              <Input
                placeholder="输入技能名称"
                value={bonusSkillInput}
                onChange={(e) => setBonusSkillInput(e.target.value)}
                onPressEnter={handleAddBonusSkill}
              />
              <Button onClick={handleAddBonusSkill} icon={<PlusOutlined />}>
                添加
              </Button>
            </div>
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
              <Button type="primary" onClick={handleSubmit} loading={loading}>
                创建岗位
              </Button>
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
              <div className="font-medium">{template.name}</div>
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
