import { test, expect } from './fixtures';
import {
  closeJobViaAPI,
  createJobViaAPI,
  getAuthToken,
  login,
  uploadSampleResume,
  waitForCompletedAnalysis,
} from './helpers';

test.describe('Closed Job Flow', () => {
  test.setTimeout(120000);

  test('closed job cannot accept new resume uploads', async ({ page, request }) => {
    const token = await getAuthToken();
    const job = await createJobViaAPI(token, `关闭后禁止上传_${Date.now()}`, 'closed');

    await login(page);
    await page.goto('/dashboard/resumes/upload');
    await page.locator('.ant-select').first().click();
    await expect(page.locator('.ant-select-dropdown:visible')).not.toContainText(job.title);

    let uploadError = '';
    try {
      await uploadSampleResume(request, token, job.id);
    } catch (error) {
      uploadError = String(error);
    }
    expect(uploadError).toContain('仅活跃状态的岗位可上传简历');
  });

  test('closed job analysis results remain accessible', async ({ page, request }) => {
    const token = await getAuthToken();
    const job = await createJobViaAPI(token, `关闭岗位分析可见_${Date.now()}`, 'active');
    await uploadSampleResume(request, token, job.id);
    const [analysis] = await waitForCompletedAnalysis(request, token, job.id);
    await closeJobViaAPI(token, job.id);

    await login(page);
    await page.goto(`/dashboard/analysis/${analysis.id}`);

    await expect(page.getByText('分析详情')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.ant-layout-content')).toContainText(job.title);
  });

  test('closed job can be copied to create a new draft', async ({ page }) => {
    const token = await getAuthToken();
    const job = await createJobViaAPI(token, `关闭岗位复制_${Date.now()}`, 'closed');

    await login(page);
    await page.goto('/dashboard/jobs');
    await page.getByRole('tab', { name: /已\s*关\s*闭/ }).click();

    const jobRow = page.locator('tr.ant-table-row').filter({ hasText: job.title });
    await expect(jobRow).toBeVisible({ timeout: 10000 });
    await jobRow.locator('.ant-btn').last().click();

    const copyOption = page.locator('.ant-dropdown-menu-item').filter({ hasText: /复\s*制/ });
    await expect(copyOption).toBeVisible();
    await copyOption.click();

    await page.getByRole('tab', { name: /草\s*稿/ }).click();
    await expect(page.locator('tr.ant-table-row').filter({ hasText: `${job.title} (副本)` })).toBeVisible({
      timeout: 10000,
    });
  });
});
