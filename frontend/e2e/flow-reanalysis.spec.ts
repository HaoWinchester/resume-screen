import { test, expect } from './fixtures';
import {
  API_BASE,
  createJobViaAPI,
  getAuthToken,
  login,
  uploadSampleResume,
  waitForCompletedAnalysis,
} from './helpers';

test.describe('Reanalysis Flow', () => {
  test.setTimeout(120000);

  test('re-analyze resumes after updating job criteria', async ({ request }) => {
    const token = await getAuthToken();
    const job = await createJobViaAPI(token, `重分析岗位_${Date.now()}`, 'active');
    await uploadSampleResume(request, token, job.id);
    const [analysis] = await waitForCompletedAnalysis(request, token, job.id);

    const updateResponse = await request.patch(`${API_BASE}/api/v1/job-requirements/${job.id}`, {
      headers: { 'Authorization': `Bearer ${token}` },
      data: {
        criteria: {
          ...job.criteria,
          required_skills: ['Python', 'React', 'TypeScript'],
          min_experience_years: 5,
        },
      },
    });
    expect(updateResponse.ok()).toBeTruthy();

    const retryResponse = await request.post(`${API_BASE}/api/v1/analysis/${analysis.id}/retry`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    expect(retryResponse.status()).toBe(202);

    const [reanalyzed] = await waitForCompletedAnalysis(request, token, job.id);
    expect(reanalyzed.id).toBe(analysis.id);
  });

  test('analysis comparison across different job criteria', async ({ page, request }) => {
    const token = await getAuthToken();
    const firstJob = await createJobViaAPI(token, `对比岗位A_${Date.now()}`, 'active');
    const secondJob = await createJobViaAPI(token, `对比岗位B_${Date.now()}`, 'active');

    await uploadSampleResume(request, token, firstJob.id, `compare-a-${Date.now()}.pdf`);
    await uploadSampleResume(request, token, secondJob.id, `compare-b-${Date.now()}.pdf`);
    const [firstAnalysis] = await waitForCompletedAnalysis(request, token, firstJob.id);
    const [secondAnalysis] = await waitForCompletedAnalysis(request, token, secondJob.id);

    await login(page);
    await page.goto(`/dashboard/analysis/compare?ids=${firstAnalysis.id},${secondAnalysis.id}`);

    await expect(page.locator('h3').filter({ hasText: '候选人对比' })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.locator('.ant-layout-content')).toContainText('维度评分对比');
    await expect(page.locator('.ant-layout-content')).toContainText('详细评分对比');
  });

  test('retry analysis endpoint requeues a completed analysis', async ({ request }) => {
    const token = await getAuthToken();
    const job = await createJobViaAPI(token, `重试分析_${Date.now()}`, 'active');
    await uploadSampleResume(request, token, job.id);
    const [analysis] = await waitForCompletedAnalysis(request, token, job.id);

    const retryResponse = await request.post(`${API_BASE}/api/v1/analysis/${analysis.id}/retry`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    expect(retryResponse.status()).toBe(202);

    const [retried] = await waitForCompletedAnalysis(request, token, job.id);
    expect(retried.id).toBe(analysis.id);
  });
});
