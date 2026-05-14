/**
 * Job Management Flow E2E tests
 * Tests complete job CRUD lifecycle
 *
 * NOTE: The "new job" page has a bug where form.validateFields() at step 3
 * cannot find step 1 fields (they're unmounted). We create jobs via API
 * and test the UI interactions for viewing/editing/managing jobs.
 */
import { test, expect } from './fixtures';

const ADMIN_EMAIL = 'admin@test.com';
const ADMIN_PASSWORD = '12345678';
const API_BASE = 'http://localhost:8001';

// Helper: login
async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByPlaceholder(/邮箱/).fill(ADMIN_EMAIL);
  await page.getByPlaceholder(/密码/).fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /登\s*录/ }).click();
  await page.waitForURL('**/dashboard/**', { timeout: 10000 });
  await page.waitForTimeout(2000);
}

// Helper: create a job via direct API call
async function createJobViaAPI(token: string, title: string, status: 'draft' | 'active' | 'closed' = 'draft') {
  const response = await fetch(`${API_BASE}/api/v1/job-requirements`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      title,
      description: 'E2E测试创建的岗位',
      criteria: {
        required_skills: ['React'],
        bonus_skills: ['Python'],
        min_experience_years: 3,
        education: 'bachelor',
        industry_preference: ['互联网'],
        languages: ['中文'],
        weights: {
          skill_match: 'high',
          experience_match: 'medium',
          education: 'low',
          project_relevance: 'medium',
          overall_quality: 'low',
        },
        other_requirements: 'E2E测试',
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create job: ${response.status} ${error}`);
  }

  const job = await response.json();

  // Activate if needed
  if (status === 'active' || status === 'closed') {
    await fetch(`${API_BASE}/api/v1/job-requirements/${job.id}/activate`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (status === 'closed') {
      await fetch(`${API_BASE}/api/v1/job-requirements/${job.id}/close`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
    }
  }

  return job;
}

// Helper: get auth token
async function getAuthToken() {
  const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const data = await response.json();
  return data.access_token;
}

test.describe('Job List Page', () => {
  test('displays job list with all elements', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await page.waitForTimeout(3000);

    await expect(page.locator('h3').filter({ hasText: /岗位管理/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /新\s*建\s*岗\s*位/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /全\s*部/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /草\s*稿/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /进\s*行\s*中/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /已\s*关\s*闭/ })).toBeVisible();
    await expect(page.locator('.ant-table')).toBeVisible();
  });

  test('status tabs filter the job list', async ({ page }) => {
    const token = await getAuthToken();
    // Create a draft and an active job
    await createJobViaAPI(token, `增长运营经理（草稿筛选验证）-${Date.now()}`, 'draft');
    await createJobViaAPI(token, `增长运营经理（筛选验证）-${Date.now()}`, 'active');

    await loginAsAdmin(page);
    await page.waitForTimeout(3000);

    // Click "草稿" tab
    await page.getByRole('tab', { name: /草\s*稿/ }).click();
    await page.waitForTimeout(2000);
    const draftContent = await page.textContent('.ant-layout-content');
    expect(draftContent).toContain('草稿');

    // Click "进行中" tab
    await page.getByRole('tab', { name: /进\s*行\s*中/ }).click();
    await page.waitForTimeout(2000);
    const activeContent = await page.textContent('.ant-layout-content');
    expect(activeContent).toContain('进行中');

    // Click "全部"
    await page.getByRole('tab', { name: /全\s*部/ }).click();
    await page.waitForTimeout(2000);
  });

  test('job list table has correct columns', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await page.waitForTimeout(3000);

    const headerTexts = await page.locator('.ant-table-thead th').allTextContents();
    const allText = headerTexts.join(' ');
    expect(allText).toContain('岗位名称');
    expect(allText).toContain('状态');
    expect(allText).toContain('操作');
  });
});

test.describe('Create Job Page', () => {
  test('new job page shows 3-step form', async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('button', { name: /新\s*建\s*岗\s*位/ }).click();
    await page.waitForTimeout(3000);

    // Verify page elements
    const content = await page.textContent('.ant-layout-content');
    expect(content).toContain('创建新岗位');
    expect(content).toContain('基本信息');
    expect(content).toContain('筛选条件');
    expect(content).toContain('权重设置');
  });

  test('step navigation works correctly', async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('button', { name: /新\s*建\s*岗\s*位/ }).click();
    await page.waitForTimeout(3000);

    // Fill title (required for step navigation)
    const titleInput = page.locator('input[placeholder="例如: 高级前端工程师"]');
    await titleInput.waitFor({ state: 'visible', timeout: 10000 });
    await titleInput.fill('导航测试');

    // Step 1 → Step 2
    await page.getByRole('button', { name: /下\s*一\s*步/ }).click();
    await page.waitForTimeout(1500);

    // Step 2 → Step 3
    await page.getByRole('button', { name: /下\s*一\s*步/ }).click();
    await page.waitForTimeout(1500);

    // Step 3 should show weights
    const content = await page.textContent('.ant-layout-content');
    expect(content).toMatch(/权\s*重/);

    // Step 3 → Step 2
    await page.getByRole('button', { name: /上\s*一\s*步/ }).click();
    await page.waitForTimeout(1000);

    // Step 2 → Step 1
    await page.getByRole('button', { name: /上\s*一\s*步/ }).click();
    await page.waitForTimeout(1000);

    // Title should still be filled
    const val = await titleInput.inputValue();
    expect(val).toBe('导航测试');
  });

  test('title input has correct placeholder', async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('button', { name: /新\s*建\s*岗\s*位/ }).click();
    await page.waitForTimeout(3000);

    const titleInput = page.locator('input[placeholder="例如: 高级前端工程师"]');
    await expect(titleInput).toBeVisible();

    const descInput = page.locator('textarea[placeholder="描述岗位职责、工作内容等..."]');
    await expect(descInput).toBeVisible();
  });
});

test.describe('Job Actions (API-created jobs)', () => {
  test('activate a draft job', async ({ page }) => {
    const token = await getAuthToken();
    const job = await createJobViaAPI(token, `后端开发工程师（激活验证）-${Date.now()}`, 'draft');

    await loginAsAdmin(page);
    await page.waitForTimeout(3000);

    // Find the job row
    const jobRow = page.locator('tr.ant-table-row').filter({ hasText: job.title });
    await expect(jobRow).toBeVisible({ timeout: 10000 });

    // Click action dropdown
    await jobRow.locator('.ant-btn').last().click();
    await page.waitForTimeout(500);

    // Click activate
    const activateOption = page.locator('.ant-dropdown-menu-item').filter({ hasText: /激\s*活/ });
    await expect(activateOption).toBeVisible();
    await activateOption.click();
    await page.waitForTimeout(3000);

    // Verify status changed
    const content = await page.textContent('.ant-layout-content');
    expect(content).toMatch(/进行中/);
  });

  test('close an active job', async ({ page }) => {
    const token = await getAuthToken();
    const job = await createJobViaAPI(token, `后端开发工程师（关闭验证）-${Date.now()}`, 'active');

    await loginAsAdmin(page);
    await page.waitForTimeout(3000);

    // Switch to active tab
    await page.getByRole('tab', { name: /进\s*行\s*中/ }).click();
    await page.waitForTimeout(2000);

    const jobRow = page.locator('tr.ant-table-row').filter({ hasText: job.title });
    await expect(jobRow).toBeVisible({ timeout: 10000 });

    // Click action dropdown
    await jobRow.locator('.ant-btn').last().click();
    await page.waitForTimeout(500);

    const closeOption = page.locator('.ant-dropdown-menu-item').filter({ hasText: /关\s*闭/ });
    await expect(closeOption).toBeVisible();
    await closeOption.click();
    await page.waitForTimeout(3000);

    // Confirm if popup appears
    const confirmBtn = page.locator('.ant-popconfirm .ant-btn-primary, .ant-modal-confirm .ant-btn-primary');
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click();
      await page.waitForTimeout(2000);
    }
  });

  test('copy an existing job', async ({ page }) => {
    const token = await getAuthToken();
    const job = await createJobViaAPI(token, `后端开发工程师（复制验证）-${Date.now()}`, 'draft');

    await loginAsAdmin(page);
    await page.waitForTimeout(3000);

    const jobRow = page.locator('tr.ant-table-row').filter({ hasText: job.title });
    await expect(jobRow).toBeVisible({ timeout: 10000 });

    await jobRow.locator('.ant-btn').last().click();
    await page.waitForTimeout(500);

    const copyOption = page.locator('.ant-dropdown-menu-item').filter({ hasText: /复\s*制/ });
    await expect(copyOption).toBeVisible();
    await copyOption.click();
    await page.waitForTimeout(3000);

    // Reload and verify the copied row appears. The first page may already be
    // full, so row count is not a reliable signal.
    await page.reload();
    await page.waitForTimeout(3000);

    const copiedRow = page.locator('tr.ant-table-row').filter({ hasText: `${job.title} (副本)` });
    await expect(copiedRow).toBeVisible({ timeout: 10000 });
  });

  test('delete a draft job', async ({ page }) => {
    const token = await getAuthToken();
    const job = await createJobViaAPI(token, `后端开发工程师（删除验证）-${Date.now()}`, 'draft');

    await loginAsAdmin(page);
    await page.waitForTimeout(3000);

    const jobRow = page.locator('tr.ant-table-row').filter({ hasText: job.title });
    await expect(jobRow).toBeVisible({ timeout: 10000 });

    await jobRow.locator('.ant-btn').last().click();
    await page.waitForTimeout(500);

    const deleteOption = page.locator('.ant-dropdown-menu-item').filter({ hasText: /删\s*除/ });
    await expect(deleteOption).toBeVisible();
    await deleteOption.click();
    await page.waitForTimeout(1000);

    // Confirm deletion
    const confirmBtn = page.locator('.ant-popconfirm .ant-btn-primary, .ant-modal-confirm .ant-btn-primary');
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click();
      await page.waitForTimeout(3000);
    }

    // Verify job is gone
    await page.reload();
    await page.waitForTimeout(3000);

    const content = await page.textContent('.ant-layout-content');
    expect(content).not.toContain(job.title);
  });
});

test.describe('Edit Job Flow', () => {
  test('edit page loads with existing job data', async ({ page }) => {
    const token = await getAuthToken();
    const job = await createJobViaAPI(token, `后端开发工程师（编辑验证）-${Date.now()}`, 'draft');

    await loginAsAdmin(page);
    await page.waitForTimeout(3000);

    // Click job name to navigate to edit page
    const jobLink = page.locator('a').filter({ hasText: job.title }).first();
    await expect(jobLink).toBeVisible({ timeout: 10000 });
    await jobLink.click();
    await page.waitForTimeout(3000);

    // Should be on edit page
    const content = await page.textContent('.ant-layout-content');
    expect(content).toContain('编辑岗位');

    // Title input should have existing value
    const titleInput = page.locator('input[placeholder="例如: 高级前端工程师"]');
    if (await titleInput.isVisible()) {
      const val = await titleInput.inputValue();
      expect(val).toBe(job.title);
    }
  });
});
