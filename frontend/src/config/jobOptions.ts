import type { WeightConfig, WeightLevel } from '@/types/job';

export const weightOptions: Array<{ label: string; value: WeightLevel }> = [
  { label: '高', value: 'high' },
  { label: '中', value: 'medium' },
  { label: '低', value: 'low' },
];

export const defaultWeightConfig: WeightConfig = {
  skill_match: 'medium',
  experience_match: 'medium',
  education: 'high',
  project_relevance: 'medium',
  overall_quality: 'high',
};

export const resolveWeightConfig = (weights?: Partial<WeightConfig> | null): WeightConfig => ({
  ...defaultWeightConfig,
  ...weights,
});
