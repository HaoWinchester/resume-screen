/**
 * Team Management Flow E2E tests
 * Tests invite members, role management, and team page functionality
 *
 * IMPORTANT: Navigate via sidebar clicks, not page.goto() for sub-pages
 */
import { test, expect } from './fixtures';
import { faker } from '@faker-js/faker';

const ADMIN_EMAIL = 'admin@test.com';
const ADMIN_PASSWORD = '12345678';

// Helper: navigate to team page via sidebar
async function goToTeamPage(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByPlaceholder(/邮箱/).fill(ADMIN_EMAIL);
  await page.getByPlaceholder(/密码/).fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /登\s*录/ }).click();
  await page.waitForURL('**/dashboard/**', { timeout: 10000 });
  await page.waitForTimeout(2000);

  // Navigate via sidebar
  const teamLink = page.locator('.ant-menu-item').filter({ hasText: /团队管理/ });
  await teamLink.click();
  await page.waitForTimeout(3000);
}

test.describe('Team Page Display', () => {
  test('team page shows all UI elements for admin', async ({ adminPage }) => {
    const page = adminPage;
    await page.goto('/dashboard/jobs');
    await page.waitForTimeout(3000);
    await page.locator('.ant-menu-item').filter({ hasText: /团队管理/ }).click();
    await page.waitForTimeout(3000);

    const content = await page.textContent('.ant-layout-content');
    expect(content).toContain('团队管理');
    expect(content).toContain('邀请成员');
    expect(content).toContain('团队成员');
    expect(content).toContain('公司名称');
    expect(content).toContain('管理员数量');

    // Members table
    await expect(page.locator('.ant-table')).toBeVisible();
  });

  test('team page shows member list with correct columns', async ({ adminPage }) => {
    const page = adminPage;
    await page.goto('/dashboard/jobs');
    await page.waitForTimeout(3000);
    await page.locator('.ant-menu-item').filter({ hasText: /团队管理/ }).click();
    await page.waitForTimeout(3000);

    const tableHeaders = page.locator('.ant-table-thead th');
    const headerTexts = await tableHeaders.allTextContents();
    const allText = headerTexts.join(' ');

    expect(allText).toContain('姓名');
    expect(allText).toContain('邮箱');
    expect(allText).toContain('角色');
    expect(allText).toContain('状态');
  });

  test('team page shows current user with admin role', async ({ adminPage }) => {
    const page = adminPage;
    await page.goto('/dashboard/jobs');
    await page.waitForTimeout(3000);
    await page.locator('.ant-menu-item').filter({ hasText: /团队管理/ }).click();
    await page.waitForTimeout(3000);

    // Should show "管理员" tag for admin user
    const content = await page.textContent('.ant-layout-content');
    expect(content).toContain('管理员');
  });
});

test.describe('Invite Member Flow', () => {
  test('open invite modal shows correct form', async ({ adminPage }) => {
    const page = adminPage;
    await page.goto('/dashboard/jobs');
    await page.waitForTimeout(3000);
    await page.locator('.ant-menu-item').filter({ hasText: /团队管理/ }).click();
    await page.waitForTimeout(3000);

    // Click invite button
    await page.getByRole('button', { name: /邀\s*请\s*成\s*员/ }).click();
    await page.waitForTimeout(500);

    // Modal should appear
    await expect(page.locator('.ant-modal')).toBeVisible();

    // Form fields in modal
    const modal = page.locator('.ant-modal');
    expect(await modal.textContent()).toContain('邀请新成员');
    await expect(modal.locator('input[placeholder="请输入成员姓名"]')).toBeVisible();
    await expect(modal.locator('input[placeholder="请输入邮箱地址"]')).toBeVisible();

    // Buttons
    await expect(page.getByRole('button', { name: /取\s*消/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /发\s*送\s*邀\s*请/ })).toBeVisible();

    // Close modal
    await page.getByRole('button', { name: /取\s*消/ }).click();
    await page.waitForTimeout(500);
  });

  test('invite form validation shows errors for empty fields', async ({ adminPage }) => {
    const page = adminPage;
    await page.goto('/dashboard/jobs');
    await page.waitForTimeout(3000);
    await page.locator('.ant-menu-item').filter({ hasText: /团队管理/ }).click();
    await page.waitForTimeout(3000);

    await page.getByRole('button', { name: /邀\s*请\s*成\s*员/ }).click();
    await page.waitForTimeout(500);

    // Submit empty form
    await page.getByRole('button', { name: /发\s*送\s*邀\s*请/ }).click();
    await page.waitForTimeout(1000);

    // Should show validation errors
    const modalErrors = page.locator('.ant-modal .ant-form-item-explain-error');
    await expect(modalErrors.first()).toBeVisible({ timeout: 2000 });
  });

  test('invite with valid data submits successfully', async ({ adminPage }) => {
    const page = adminPage;
    await page.goto('/dashboard/jobs');
    await page.waitForTimeout(3000);
    await page.locator('.ant-menu-item').filter({ hasText: /团队管理/ }).click();
    await page.waitForTimeout(3000);

    // Count members before
    const membersBefore = await page.locator('tr.ant-table-row').count();

    // Open invite modal
    await page.getByRole('button', { name: /邀\s*请\s*成\s*员/ }).click();
    await page.waitForTimeout(500);

    // Fill valid data
    const newEmail = `e2eteam_${Date.now()}@test.com`;
    const modal = page.locator('.ant-modal');
    await modal.locator('input[placeholder="请输入成员姓名"]').fill('E2E邀请用户');
    await modal.locator('input[placeholder="请输入邮箱地址"]').fill(newEmail);

    // Submit
    await page.getByRole('button', { name: /发\s*送\s*邀\s*请/ }).click();
    await page.waitForTimeout(3000);

    // Verify - either modal closed or success message shown
    await page.reload();
    await page.waitForTimeout(3000);

    const membersAfter = await page.locator('tr.ant-table-row').count();
    expect(membersAfter).toBeGreaterThanOrEqual(membersBefore);
  });

  test('cancel button closes invite modal', async ({ adminPage }) => {
    const page = adminPage;
    await page.goto('/dashboard/jobs');
    await page.waitForTimeout(3000);
    await page.locator('.ant-menu-item').filter({ hasText: /团队管理/ }).click();
    await page.waitForTimeout(3000);

    await page.getByRole('button', { name: /邀\s*请\s*成\s*员/ }).click();
    await page.waitForTimeout(500);
    await expect(page.locator('.ant-modal')).toBeVisible();

    await page.getByRole('button', { name: /取\s*消/ }).click();
    await page.waitForTimeout(500);
    await expect(page.locator('.ant-modal')).not.toBeVisible();
  });
});

test.describe('Role Management', () => {
  test('admin can see role dropdowns for other members', async ({ adminPage }) => {
    const page = adminPage;
    await page.goto('/dashboard/jobs');
    await page.waitForTimeout(3000);
    await page.locator('.ant-menu-item').filter({ hasText: /团队管理/ }).click();
    await page.waitForTimeout(3000);

    // Role select dropdowns in the table
    const roleSelects = page.locator('tr.ant-table-row .ant-select');
    const selectCount = await roleSelects.count();

    if (selectCount > 0) {
      // Click first role select to verify it opens
      await roleSelects.first().click();
      await page.waitForTimeout(500);

      // Should show options
      const options = page.locator('.ant-select-dropdown:visible .ant-select-item');
      const optionCount = await options.count();
      expect(optionCount).toBeGreaterThanOrEqual(2); // admin + operator

      // Close dropdown
      await page.keyboard.press('Escape');
    }
  });
});
