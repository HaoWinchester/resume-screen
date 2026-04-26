import { test, expect, faker } from './fixtures';
import {
  API_BASE,
  TEST_PASSWORD,
  waitForCompletedAnalysis,
} from './helpers';

test.describe('Full Happy Path E2E', () => {
  test.setTimeout(120000);

  test('complete flow: register -> create job -> upload -> analyze -> export', async ({ page, request }) => {
    // Step 1: Register a new account
    await page.goto('/register');
    const userName = faker.person.fullName();
    const userEmail = faker.internet.email();
    const companyName = faker.company.name();
    const userPassword = TEST_PASSWORD;
    const jobTitle = `高级前端工程师_${Date.now()}`;

    await page.getByPlaceholder(/您的姓名/).fill(userName);
    await page.getByPlaceholder(/公司名称/).fill(companyName);
    await page.getByPlaceholder(/邮箱/).fill(userEmail);
    await page.getByPlaceholder(/密码（至少 8 个字符）/).fill(userPassword);
    await page.getByPlaceholder(/确认密码/).fill(userPassword);
    await page.getByRole('button', { name: /注\s*册/ }).click();

    // After successful registration, should redirect to dashboard
    await page.waitForURL('**/dashboard/**', { timeout: 10000 });

    // Step 2: Create a new job
    await page.goto('/dashboard/jobs/new');
    await page.getByPlaceholder(/例如: 高级前端工程师/).fill(jobTitle);
    await page.getByPlaceholder(/描述岗位职责/).fill('负责公司前端架构设计和开发');
    await page.getByRole('button', { name: /下一步/ }).click();

    // Add skills
    await page.getByPlaceholder(/输入技能名称，如 React/).fill('React');
    await page.locator('button').filter({ hasText: '添加' }).first().click();

    // Navigate through remaining steps
    await page.getByRole('button', { name: /下一步/ }).click();
    await page.getByRole('button', { name: /创建岗位/ }).click();

    await page.waitForURL('**/dashboard/jobs', { timeout: 10000 });
    const jobRow = page.locator('tr.ant-table-row').filter({ hasText: jobTitle });
    await expect(jobRow).toBeVisible({ timeout: 10000 });

    // Step 3: Activate the job so it can accept resumes
    await jobRow.locator('.ant-btn').last().click();
    await page.locator('.ant-dropdown-menu-item').filter({ hasText: /激\s*活/ }).click();
    await expect(page.locator('.ant-layout-content')).toContainText('进行中', { timeout: 10000 });

    // Step 4: Upload a resume through the UI
    await page.goto('/dashboard/resumes/upload');
    await expect(page.locator('.ant-layout-content')).toContainText(jobTitle);
    await page.locator('input[type="file"]').setInputFiles('e2e/test-data/sample.pdf');
    await expect(page.locator('.ant-layout-content')).toContainText('sample.pdf');
    await page.getByRole('button', { name: /开\s*始\s*上\s*传/ }).click();
    await expect(page.locator('.ant-message-notice')).toContainText('上传完成', {
      timeout: 15000,
    });

    // Step 5: Wait for backend parsing and analysis to complete
    const token = await page.evaluate(() => localStorage.getItem('access_token'));
    expect(token).toBeTruthy();
    const jobsResponse = await request.get(`${API_BASE}/api/v1/job-requirements`, {
      headers: { 'Authorization': `Bearer ${token}` },
      params: { status_filter: 'active', per_page: '100' },
    });
    const jobsPayload = await jobsResponse.json();
    const job = jobsPayload.items.find((item: any) => item.title === jobTitle);
    expect(job).toBeTruthy();

    await waitForCompletedAnalysis(request, token!, job.id);

    // Step 6: View analysis and export
    await page.getByRole('button', { name: /前\s*往\s*分\s*析\s*看\s*板/ }).click();
    await page.waitForURL('**/dashboard/analysis', { timeout: 10000 });
    await expect(page.locator('h3').filter({ hasText: '分析看板' })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator('tr.ant-table-row').first()).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: /^download$/ }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.locator('.ant-dropdown-menu-item').filter({ hasText: '导出 CSV' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(`analysis_${job.id}.csv`);
  });
});
