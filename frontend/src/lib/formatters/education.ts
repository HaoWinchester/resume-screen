import type { EducationLevel } from '@/types/job';

const EDUCATION_LABELS: Record<Exclude<EducationLevel, ''>, string> = {
  high_school: '高中及以上',
  vocational: '中专 / 职高及以上',
  associate: '大专及以上',
  bachelor: '本科及以上',
  master: '硕士及以上',
  doctor: '博士及以上',
};

export function formatEducationLevel(value?: EducationLevel | string | null) {
  if (!value) return '不限';
  return EDUCATION_LABELS[value as Exclude<EducationLevel, ''>] || value;
}
