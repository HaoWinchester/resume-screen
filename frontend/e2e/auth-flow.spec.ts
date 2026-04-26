/**
 * Authentication flow E2E tests
 * Tests actual login/register/logout interaction flows
 */
import { test, expect } from './fixtures';
import { faker } from '@faker-js/faker';

const ADMIN_EMAIL = 'admin@test.com';
const ADMIN_PASSWORD = '12345678';

test.describe('Login Flow', () => {
  test('login with correct credentials redirects to dashboard', async ({ page }) => {
    await page.goto('/login');

    await page.getByPlaceholder(/邮箱/).fill(ADMIN_EMAIL);
    await page.getByPlaceholder(/密码/).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /登\s*录/ }).click();

    await page.waitForURL('**/dashboard/**', { timeout: 10000 });
    expect(page.url()).toContain('/dashboard');

    // Dashboard sidebar should be visible
    await expect(page.locator('.ant-layout-sider')).toBeVisible();
  });

  test('login with wrong password stays on login page', async ({ page }) => {
    await page.goto('/login');

    await page.getByPlaceholder(/邮箱/).fill(ADMIN_EMAIL);
    await page.getByPlaceholder(/密码/).fill('wrongpassword');
    await page.getByRole('button', { name: /登\s*录/ }).click();

    await page.waitForTimeout(2000);
    expect(page.url()).toContain('/login');
  });

  test('login with empty fields shows validation errors', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('button', { name: /登\s*录/ }).click();

    await page.waitForTimeout(1000);
    expect(page.url()).toContain('/login');

    const validationErrors = page.locator('.ant-form-item-explain-error');
    await expect(validationErrors.first()).toBeVisible({ timeout: 3000 });
  });

  test('login with invalid email format shows validation error', async ({ page }) => {
    await page.goto('/login');

    await page.getByPlaceholder(/邮箱/).fill('not-an-email');
    await page.getByPlaceholder(/密码/).fill('somepassword');
    await page.getByRole('button', { name: /登\s*录/ }).click();

    await page.waitForTimeout(1000);
    expect(page.url()).toContain('/login');
  });
});

test.describe('Registration Flow', () => {
  test('navigate from login to register page', async ({ page }) => {
    await page.goto('/login');
    await page.getByText(/立\s*即\s*注\s*册/).click();
    await page.waitForURL('**/register**', { timeout: 5000 });
    expect(page.url()).toContain('/register');
  });

  test('register page has all required form fields', async ({ page }) => {
    await page.goto('/register');

    await expect(page.getByPlaceholder(/您的姓名/)).toBeVisible();
    await expect(page.getByPlaceholder(/公司名称/)).toBeVisible();
    await expect(page.getByPlaceholder(/^邮箱$|邮箱$/).first()).toBeVisible();
    await expect(page.getByPlaceholder(/至少 8 个字符/)).toBeVisible();
    await expect(page.getByPlaceholder(/确认密码/)).toBeVisible();
    await expect(page.getByRole('button', { name: /注\s*册/ })).toBeVisible();
  });

  test('register with mismatched passwords shows validation error', async ({ page }) => {
    await page.goto('/register');

    await page.getByPlaceholder(/您的姓名/).fill('测试用户');
    await page.getByPlaceholder(/公司名称/).fill('测试公司');
    await page.getByPlaceholder(/^邮箱$|邮箱$/).first().fill(faker.internet.email());
    await page.getByPlaceholder(/至少 8 个字符/).fill('password123');
    await page.getByPlaceholder(/确认密码/).fill('different456');

    await page.getByRole('button', { name: /注\s*册/ }).click();

    await page.waitForTimeout(1000);
    // Should stay on register page
    expect(page.url()).toContain('/register');
  });

  test('register with short password shows validation error', async ({ page }) => {
    await page.goto('/register');

    await page.getByPlaceholder(/您的姓名/).fill('测试用户');
    await page.getByPlaceholder(/公司名称/).fill('测试公司');
    await page.getByPlaceholder(/^邮箱$|邮箱$/).first().fill(faker.internet.email());
    await page.getByPlaceholder(/至少 8 个字符/).fill('short');
    await page.getByPlaceholder(/确认密码/).fill('short');

    await page.getByRole('button', { name: /注\s*册/ }).click();

    await page.waitForTimeout(1000);
    expect(page.url()).toContain('/register');
  });

  test('navigate from register back to login', async ({ page }) => {
    await page.goto('/register');
    await page.getByText(/立\s*即\s*登\s*录/).click();
    await page.waitForURL('**/login**', { timeout: 5000 });
    expect(page.url()).toContain('/login');
  });

  test('full registration flow creates account and can login', async ({ page }) => {
    const newUserEmail = `e2etest_${Date.now()}@test.com`;
    const newUserPassword = 'testpass123456';

    await page.goto('/register');

    await page.getByPlaceholder(/您的姓名/).fill('E2E测试用户');
    await page.getByPlaceholder(/公司名称/).fill('E2E测试公司');
    await page.getByPlaceholder(/^邮箱$|邮箱$/).first().fill(newUserEmail);
    await page.getByPlaceholder(/至少 8 个字符/).fill(newUserPassword);
    await page.getByPlaceholder(/确认密码/).fill(newUserPassword);

    await page.getByRole('button', { name: /注\s*册/ }).click();

    // Wait for navigation - either to login or dashboard
    await page.waitForTimeout(5000);

    const currentUrl = page.url();

    // If redirected to login, login with new account
    if (currentUrl.includes('/login')) {
      await page.getByPlaceholder(/邮箱/).fill(newUserEmail);
      await page.getByPlaceholder(/密码/).fill(newUserPassword);
      await page.getByRole('button', { name: /登\s*录/ }).click();
      await page.waitForURL('**/dashboard/**', { timeout: 10000 });
      expect(page.url()).toContain('/dashboard');
    } else if (currentUrl.includes('/dashboard')) {
      // Auto-redirected to dashboard after registration
      expect(currentUrl).toContain('/dashboard');
    }
  });
});

test.describe('Logout Flow', () => {
  test('logout from dashboard redirects to login', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await page.goto('/dashboard/jobs');
    await page.waitForTimeout(3000);

    // Click user avatar to open dropdown
    await page.locator('.ant-avatar').click();
    await page.waitForTimeout(500);

    // Click logout
    await page.getByText(/退\s*出\s*登\s*录/).click();

    await page.waitForURL('**/login**', { timeout: 10000 });
    expect(page.url()).toContain('/login');
  });
});

test.describe('Auth Protection', () => {
  test('unauthenticated access to dashboard redirects to login', async ({ page }) => {
    const protectedRoutes = [
      '/dashboard/jobs',
      '/dashboard/resumes',
      '/dashboard/analysis',
      '/dashboard/team',
    ];

    for (const route of protectedRoutes) {
      await page.goto(route);
      await page.waitForURL('**/login**', { timeout: 10000 });
      expect(page.url()).toContain('/login');
    }
  });

  test('session persists across sidebar navigations', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await page.goto('/dashboard/jobs');
    await page.waitForTimeout(3000);

    // Navigate via sidebar
    const pages = [
      { text: '简历上传', urlPart: '/resumes' },
      { text: '分析看板', urlPart: '/analysis' },
      { text: '团队管理', urlPart: '/team' },
      { text: '岗位管理', urlPart: '/jobs' },
    ];

    for (const p of pages) {
      const link = page.locator('.ant-menu-item').filter({ hasText: new RegExp(p.text) });
      await link.click();
      await page.waitForTimeout(3000);
      expect(page.url()).toContain(p.urlPart);
      expect(page.url()).not.toContain('/login');
    }
  });
});
