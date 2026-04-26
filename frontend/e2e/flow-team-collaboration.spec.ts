import { test, expect } from './fixtures';
import {
  createJobViaAPI,
  getAuthToken,
  inviteMemberViaAPI,
  login,
  uploadSampleResume,
} from './helpers';

test.describe('Team Collaboration Flow', () => {
  test('admin can invite team members', async ({ adminPage }) => {
    const page = adminPage;
    const timestamp = Date.now();
    const email = `member-${timestamp}@example.com`;

    await page.goto('/dashboard/team');
    await page.getByRole('button', { name: /邀请成员/ }).click();
    await page.getByPlaceholder(/请输入成员姓名/).fill(`测试成员${timestamp}`);
    await page.getByPlaceholder(/请输入邮箱地址/).fill(email);
    await page.getByRole('button', { name: /发送邀请/ }).click();

    await expect(page.locator('.ant-message-notice')).toContainText('邀请成功', {
      timeout: 10000,
    });
    await expect(page.locator('tr.ant-table-row').filter({ hasText: email })).toBeVisible({
      timeout: 10000,
    });
  });

  test('admin can change member roles', async ({ adminPage }) => {
    const token = await getAuthToken();
    const timestamp = Date.now();
    const email = `role-${timestamp}@example.com`;
    await inviteMemberViaAPI(token, email, `角色成员${timestamp}`, 'operator');

    const page = adminPage;
    await page.goto('/dashboard/team');

    const memberRow = page.locator('tr.ant-table-row').filter({ hasText: email });
    await expect(memberRow).toBeVisible({ timeout: 10000 });

    await memberRow.locator('.ant-select').click();
    await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: '管理员' }).click();

    await expect(page.locator('.ant-message-notice')).toContainText('角色更新成功', {
      timeout: 10000,
    });
    await expect(memberRow).toContainText('管理员');
  });

  test('team members share job and resume data within company', async ({ browser, request }) => {
    const token = await getAuthToken();
    const timestamp = Date.now();
    const memberEmail = `shared-${timestamp}@example.com`;
    const invite = await inviteMemberViaAPI(token, memberEmail, `共享成员${timestamp}`, 'operator');
    const job = await createJobViaAPI(token, `共享岗位_${timestamp}`, 'active');
    const fileName = `shared-resume-${timestamp}.pdf`;
    await uploadSampleResume(request, token, job.id, fileName);

    const context = await browser.newContext();
    const page = await context.newPage();

    await login(page, memberEmail, invite.temp_password);

    await page.goto('/dashboard/jobs');
    await expect(page.locator('tr.ant-table-row').filter({ hasText: job.title })).toBeVisible({
      timeout: 10000,
    });

    await page.goto('/dashboard/resumes');
    await expect(page.locator('tr.ant-table-row').filter({ hasText: fileName })).toBeVisible({
      timeout: 15000,
    });

    await context.close();
  });
});
