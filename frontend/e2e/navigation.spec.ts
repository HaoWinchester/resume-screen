import { test, expect } from './fixtures';

test.describe('Navigation', () => {
  test('login page loads correctly with input fields', async ({ page }) => {
    await page.goto('/login');
    // The login form has email and password inputs with placeholders "邮箱" and "密码"
    await expect(page.getByPlaceholder(/邮箱/)).toBeVisible();
    await expect(page.getByPlaceholder(/密码/)).toBeVisible();
    await expect(page.getByRole('button', { name: /登\s*录/ })).toBeVisible();
  });

  test('register page loads correctly with all form fields', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByPlaceholder(/您的姓名/)).toBeVisible();
    await expect(page.getByPlaceholder(/公司名称/)).toBeVisible();
    await expect(page.getByPlaceholder(/邮箱/)).toBeVisible();
    await expect(page.getByPlaceholder(/密码（至少 8 个字符）/)).toBeVisible();
    await expect(page.getByPlaceholder(/确认密码/)).toBeVisible();
    await expect(page.getByRole('button', { name: /注\s*册/ })).toBeVisible();
  });

  test('unauthenticated dashboard routes redirect to login', async ({ page }) => {
    // Test several dashboard routes all redirect to login
    const dashboardRoutes = [
      '/dashboard',
      '/dashboard/jobs',
      '/dashboard/jobs/new',
      '/dashboard/resumes',
      '/dashboard/resumes/upload',
      '/dashboard/analysis',
      '/dashboard/team',
    ];

    for (const route of dashboardRoutes) {
      await page.goto(route);
      await page.waitForURL('**/login**', { timeout: 10000 });
      expect(page.url()).toContain('/login');
    }
  });
});
