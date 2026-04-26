import { test, expect } from './fixtures';
import {
  getAuthToken,
  inviteMemberViaAPI,
  login,
} from './helpers';

test.describe('Multi-Company Flow', () => {
  test('admin can manage team members and assign roles', async ({ adminPage }) => {
    const timestamp = Date.now();
    const email = `multi-member-${timestamp}@example.com`;
    const page = adminPage;
    await page.goto('/dashboard/team');

    await page.getByRole('button', { name: /邀请成员/ }).click();
    await page.getByPlaceholder(/请输入成员姓名/).fill(`新成员${timestamp}`);
    await page.getByPlaceholder(/请输入邮箱地址/).fill(email);
    await page.getByRole('button', { name: /发送邀请/ }).click();

    await expect(page.locator('tr.ant-table-row').filter({ hasText: email })).toBeVisible({
      timeout: 10000,
    });

    const memberRow = page.locator('tr.ant-table-row').filter({ hasText: email });
    await memberRow.locator('.ant-select').click();
    await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: '管理员' }).click();
    await expect(page.locator('.ant-message-notice').filter({ hasText: '角色更新成功' })).toBeVisible({
      timeout: 10000,
    });
  });

  test('operator cannot access team management', async ({ page }) => {
    const token = await getAuthToken();
    const timestamp = Date.now();
    const email = `operator-${timestamp}@example.com`;
    const invite = await inviteMemberViaAPI(token, email, `操作员${timestamp}`, 'operator');

    await login(page, email, invite.temp_password);
    await page.goto('/dashboard/team');

    await page.waitForURL('**/dashboard/jobs', { timeout: 10000 });
    await expect(page.locator('.ant-message-notice')).toContainText('您没有访问团队管理页面的权限', {
      timeout: 10000,
    });
  });
});
