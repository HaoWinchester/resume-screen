import { test, expect } from './fixtures';
import {
  createJobViaAPI,
  getAuthToken,
  login,
} from './helpers';

test.describe('Error Recovery Flow', () => {
  test('login with wrong credentials shows error', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder(/邮箱/).fill('wrong@example.com');
    await page.getByPlaceholder(/密码/).fill('wrongpassword');
    const loginButton = page.getByRole('button', { name: /登\s*录/ });
    await expect(loginButton).toBeEnabled();

    const loginResponse = page.waitForResponse((response) =>
      response.url().includes('/api/v1/auth/login') && response.request().method() === 'POST'
    );

    await loginButton.click();
    expect((await loginResponse).status()).toBe(401);
    await expect(page).toHaveURL(/\/login/);
    await expect(loginButton).toBeEnabled();
  });

  test('upload invalid file type shows error', async ({ page }) => {
    const token = await getAuthToken();
    await createJobViaAPI(token, `前端开发工程师（非法文件验证）-${Date.now()}`, 'active');

    await login(page);
    await page.goto('/dashboard/resumes/upload');
    await page.locator('input[type="file"]').setInputFiles('e2e/test-data/corrupted.txt');

    await expect(page.locator('.ant-message-notice')).toContainText('不支持的文件类型', {
      timeout: 10000,
    });
    await expect(page.getByRole('button', { name: /开\s*始\s*上\s*传/ })).toBeDisabled();
  });

  test('network error during analysis is handled gracefully', async ({ page }) => {
    const token = await getAuthToken();
    await createJobViaAPI(token, `前端开发工程师（网络异常验证）-${Date.now()}`, 'active');

    await login(page);
    await page.route('**/api/v1/analysis?**', (route) => route.abort());
    await page.goto('/dashboard/analysis');

    await expect(page.locator('.ant-message-notice')).toContainText('加载分析数据失败', {
      timeout: 15000,
    });
    await expect(page.getByRole('button', { name: /刷\s*新/ })).toBeVisible();
  });

  test('duplicate job titles remain manageable in job list', async ({ page }) => {
    const token = await getAuthToken();
    const title = `客户成功经理（重复校验）-${Date.now()}`;
    await createJobViaAPI(token, title, 'draft');
    await createJobViaAPI(token, title, 'draft');

    await login(page);
    await page.goto('/dashboard/jobs');

    const rows = page.locator('tr.ant-table-row').filter({ hasText: title });
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    expect(await rows.count()).toBeGreaterThanOrEqual(2);
  });
});
