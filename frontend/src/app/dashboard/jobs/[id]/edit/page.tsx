'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
  Spin,
} from 'antd';
import { PlusOutlined, SaveOutlined } from '@ant-design/icons';
import {
  fetchJobRequirement,
  updateJobRequirement,
  activateJobRequirement,
  fetchJobTemplates,
  createJobTemplate as apiCreateJobTemplate,
} from '@/lib/api/job';
import { createJobSkillOption, fetchJobSkillOptions } from '@/lib/api/jobSkillOption';
import { resolveWeightConfig, weightOptions } from '@/config/jobOptions';
import {
  getBuiltinJobSkillOptions,
  inferJobSkillCategory,
  mergeSkillOptions,
  toSelectOptions,
  type JobSkillOptionType,
} from '@/lib/jobSkillCatalog';
import type { Criteria, JobRequirement } from '@/types/job';

const { TextArea } = Input;
const { Step } = Steps;

export default function EditJobPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params.id as string;

  const [form] = Form.useForm();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [jobData, setJobData] = useState<JobRequirement | null>(null);
  const [templates, setTemplates] = useState<any[]>([]);
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
  const jobSkillCategory = useMemo(() => inferJobSkillCategory(watchedTitle || jobData?.title), [jobData?.title, watchedTitle]);
  const requiredSkillOptions = useMemo(
    () => toSelectOptions(mergeSkillOptions(getBuiltinJobSkillOptions(jobSkillCategory, 'required'), customRequiredOptions, requiredSkills)),
    [customRequiredOptions, jobSkillCategory, requiredSkills]
  );
  const bonusSkillOptions = useMemo(
    () => toSelectOptions(mergeSkillOptions(getBuiltinJobSkillOptions(jobSkillCategory, 'bonus'), customBonusOptions, bonusSkills)),
    [bonusSkills, customBonusOptions, jobSkillCategory]
  );

  const loadJobData = useCallback(async () => {
    setFetchLoading(true);
    try {
      const data = await fetchJobRequirement(jobId);
      setJobData(data);

      // 填充表单
      form.setFieldsValue({
        title: data.title,
        description: data.description,
        min_experience_years: data.criteria.min_experience_years || 0,
        education: data.criteria.education || '',
        weights: resolveWeightConfig(data.criteria.weights),
        other_requirements: data.criteria.other_requirements || '',
      });

      // 填充标签数据
      setRequiredSkills(data.criteria.required_skills || []);
      setBonusSkills(data.criteria.bonus_skills || []);
      setIndustryPreference(data.criteria.industry_preference || []);
      setLanguages(data.criteria.languages || []);
    } catch (error) {
      message.error('加载岗位数据失败');
      router.push('/dashboard/jobs');
    } finally {
      setFetchLoading(false);
    }
  }, [form, jobId, router]);

  const loadTemplates = useCallback(async () => {
    try {
      const response = await fetchJobTemplates();
      setTemplates(response.items || []);
    } catch (error) {
      console.error('加载模板失败', error);
    }
  }, []);

  useEffect(() => {
    void loadJobData();
    void loadTemplates();
  }, [loadJobData, loadTemplates]);

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
    setRequiredSkills(requiredSkills.filter((s) => s !== skill));
  };

  const handleRemoveBonusSkill = (skill: string) => {
    setBonusSkills(bonusSkills.filter((s) => s !== skill));
  };

  const persistCustomSkillOptions = async (optionType: JobSkillOptionType, values: string[]) => {
    const builtin = getBuiltinJobSkillOptions(jobSkillCategory, optionType);
    const custom = optionType === 'required' ? customRequiredOptions : customBonusOptions;
    const current = optionType === 'required' ? requiredSkills : bonusSkills;
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

  const handleAddIndustry = () => {
    if (industryInput && !industryPreference.includes(industryInput)) {
      setIndustryPreference([...industryPreference, industryInput]);
      setIndustryInput('');
    }
  };

  const handleRemoveIndustry = (industry: string) => {
    setIndustryPreference(industryPreference.filter((i) => i !== industry));
  };

  const handleAddLanguage = () => {
    if (languageInput && !languages.includes(languageInput)) {
      setLanguages([...languages, languageInput]);
      setLanguageInput('');
    }
  };

  const handleRemoveLanguage = (language: string) => {
    setLanguages(languages.filter((l) => l !== language));
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

      await updateJobRequirement(jobId, {
        title: values.title,
        description: values.description,
        criteria,
      });
      message.success('岗位更新成功');
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

  const handleActivate = async () => {
    try {
      setLoading(true);
      await activateJobRequirement(jobId);
      message.success('已开始招聘');
      router.push('/dashboard/jobs');
    } catch (error) {
      message.error('开始招聘失败，请确认岗位筛选条件完整');
    } finally {
      setLoading(false);
    }
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

          {jobData && jobData.status !== 'draft' && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-sm text-yellow-800">
                注意: 此岗位当前状态为 <strong>{jobData.status === 'active' ? '招聘中' : '已结束'}</strong>
                ，编辑后不会自动开始招聘。
              </p>
            </div>
          )}
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
            <p className="mb-3 text-xs text-slate-500">当前按“{jobSkillCategory}”推荐；自定义技能会保存到当前账号。</p>
            <div className="flex flex-wrap gap-2">
              {requiredSkills.map((skill) => (
                <Tag key={skill} closable onClose={() => handleRemoveSkill(skill)} color="blue">
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
                <Tag key={skill} closable onClose={() => handleRemoveBonusSkill(skill)} color="green">
                  {skill}
                </Tag>
              ))}
            </div>
          </div>

          {/* 工作年限 */}
          <Form.Item name="min_experience_years" label="最低工作年限">
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
          <Form.Item name="education" label="学历要求">
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
                <Tag key={industry} closable onClose={() => handleRemoveIndustry(industry)} color="purple">
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
                <Tag key={language} closable onClose={() => handleRemoveLanguage(language)} color="orange">
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

          <Form.Item name={['weights', 'skill_match']} label="技能匹配度">
            <Radio.Group options={weightOptions} optionType="button" buttonStyle="solid" />
          </Form.Item>

          <Form.Item name={['weights', 'experience_match']} label="工作经验匹配度">
            <Radio.Group options={weightOptions} optionType="button" buttonStyle="solid" />
          </Form.Item>

          <Form.Item name={['weights', 'education']} label="教育背景">
            <Radio.Group options={weightOptions} optionType="button" buttonStyle="solid" />
          </Form.Item>

          <Form.Item name={['weights', 'project_relevance']} label="项目经历相关性">
            <Radio.Group options={weightOptions} optionType="button" buttonStyle="solid" />
          </Form.Item>

          <Form.Item name={['weights', 'overall_quality']} label="简历整体质量">
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

  if (fetchLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold">编辑岗位</h2>
      </div>

      <Form form={form} layout="vertical">
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
                <Button onClick={() => router.push('/dashboard/jobs')}>取消</Button>
                {jobData?.status === 'draft' && (
                  <Button type="primary" onClick={handleActivate} loading={loading}>
                    保存并开始招聘
                  </Button>
                )}
                <Button type="primary" onClick={handleSubmit} loading={loading}>
                  保存修改
                </Button>
              </>
            )}
          </Space>
        </div>
      </Form>
    </div>
  );
}
