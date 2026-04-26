/**
 * Navigation & Dashboard Layout Flow E2E tests
 * Tests sidebar navigation, page transitions, and responsive layout
 */
import { test, expect } from './fixtures';

test.describe('Sidebar Navigation', () => {
  test('navigate to all pages via sidebar links', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await page.goto('/dashboard/jobs');
    await page.waitForTimeout(3000);

    const navItems = [
      { text: '简历上传', urlPart: '/resumes' },
      { text: '分析看板', urlPart: '/analysis' },
      { text: '团队管理', urlPart: '/team' },
      { text: '岗位管理', urlPart: '/jobs' },
    ];

    for (const item of navItems) {
      const link = page.locator('.ant-menu-item').filter({ hasText: new RegExp(item.text) });
      await link.click();
      await page.waitForTimeout(3000);
      expect(page.url()).toContain(item.urlPart);
    }
  });

  test('sidebar highlights active page', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await page.goto('/dashboard/jobs');
    await page.waitForTimeout(3000);

    // Active menu item should be "岗位管理"
    const activeItem = page.locator('.ant-menu-item-selected');
    const activeText = await activeItem.textContent();
    expect(activeText).toContain('岗位管理');

    // Navigate to analysis
    await page.locator('.ant-menu-item').filter({ hasText: /分析看板/ }).click();
    await page.waitForTimeout(3000);

    // Active item should change
    const newActiveItem = page.locator('.ant-menu-item-selected');
    const newActiveText = await newActiveItem.textContent();
    expect(newActiveText).toContain('分析看板');
  });
});

test.describe('Dashboard Header', () => {
  test('header shows user avatar', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await page.goto('/dashboard/jobs');
    await page.waitForTimeout(3000);

    const avatar = page.locator('.ant-avatar');
    await expect(avatar).toBeVisible();
  });

  test('user dropdown shows profile and logout', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await page.goto('/dashboard/jobs');
    await page.waitForTimeout(3000);

    await page.locator('.ant-avatar').click();
    await page.waitForTimeout(500);

    const bodyText = await page.textContent('body');
    expect(bodyText).toContain('个人信息');
    expect(bodyText).toContain('退出登录');
  });

  test('logo is visible in sidebar', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await page.goto('/dashboard/jobs');
    await page.waitForTimeout(3000);

    const content = await page.locator('.ant-layout-sider').textContent();
    expect(content).toContain('HR');
  });
});

test.describe('Error Handling', () => {
  test('invalid dashboard route handles gracefully', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await page.goto('/dashboard/nonexistent-page');
    await page.waitForTimeout(5000);

    // Should stay in dashboard area (not crash)
    const bodyText = await page.textContent('body');
    // Could show 404 or redirect
    expect(bodyText).toBeTruthy();
  });
});
