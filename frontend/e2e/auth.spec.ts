import { test, expect } from './fixtures';

test.describe('Auth Flow', () => {
  test('should show login page with correct elements', async ({ page }) => {
    await page.goto('/login');
    // The login page has title "HR 简历智能筛查系统" and subtitle "欢迎回来，请登录您的账户"
    await expect(page.getByText(/HR\s*简\s*历\s*智\s*能\s*筛\s*查\s*系\s*统/)).toBeVisible();
    await expect(page.getByText(/欢\s*迎\s*回\s*来，\s*请\s*登\s*录\s*您\s*的\s*账\s*户/)).toBeVisible();
  });

  test('should show validation errors on empty login form submit', async ({ page }) => {
    await page.goto('/login');
    // Click the login button with empty fields
    await page.getByRole('button', { name: /登\s*录/ }).click();
    // Ant Design form validation should show "请输入邮箱" message
    await expect(page.getByText(/请\s*输\s*入\s*邮\s*箱/)).toBeVisible();
  });

  test('should navigate to register page', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: /立\s*即\s*注\s*册/ }).click();
    await expect(page).toHaveURL(/\/register/);
  });

  test('should show register page with correct elements', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByText(/创\s*建\s*您\s*的\s*账\s*户/)).toBeVisible();
    // Register form has fields: name, companyName, email, password, confirmPassword
    await expect(page.getByPlaceholder(/您的姓名/)).toBeVisible();
    await expect(page.getByPlaceholder(/公司名称/)).toBeVisible();
    await expect(page.getByPlaceholder(/邮箱/)).toBeVisible();
  });

  test('should redirect unauthenticated access to login', async ({ page }) => {
    await page.goto('/dashboard');
    // The root layout redirects unauthenticated users to /login
    await page.waitForURL('**/login**', { timeout: 10000 });
    expect(page.url()).toContain('/login');
  });

  test('should navigate from register back to login', async ({ page }) => {
    await page.goto('/register');
    await page.getByRole('link', { name: /立\s*即\s*登\s*录/ }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
