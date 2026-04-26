import { test, expect } from './fixtures';

test.describe('Job Management', () => {
  test('job list page redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/dashboard/jobs');
    await page.waitForURL('**/login**', { timeout: 10000 });
    expect(page.url()).toContain('/login');
  });

  test('new job page redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/dashboard/jobs/new');
    await page.waitForURL('**/login**', { timeout: 10000 });
    expect(page.url()).toContain('/login');
  });

  test('edit job page redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/dashboard/jobs/nonexistent-id/edit');
    await page.waitForURL('**/login**', { timeout: 10000 });
    expect(page.url()).toContain('/login');
  });

  test('job creation page loads with form elements after auth', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await page.goto('/dashboard/jobs/new');
    // The new job page has a multi-step form with title "创建新岗位"
    await expect(page.getByText(/创\s*建\s*新\s*岗\s*位/)).toBeVisible();
    // Step indicator should be visible
    await expect(page.getByText(/基\s*本\s*信\s*息/)).toBeVisible();
    await expect(page.getByText(/筛\s*选\s*条\s*件/)).toBeVisible();
    await expect(page.getByText(/权\s*重\s*设\s*置/)).toBeVisible();
    // The first step has "岗位名称" field
    await expect(page.getByPlaceholder(/例如: 高级前端工程师/)).toBeVisible();
  });

  test('job list page shows header and create button after auth', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await page.goto('/dashboard/jobs');
    await expect(page.getByRole('heading', { name: /岗\s*位\s*管\s*理/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /新\s*建\s*岗\s*位/ })).toBeVisible();
  });
});
