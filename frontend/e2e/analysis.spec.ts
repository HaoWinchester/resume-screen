import { test, expect } from './fixtures';

test.describe('Analysis Dashboard', () => {
  test('analysis page redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/dashboard/analysis');
    await page.waitForURL('**/login**', { timeout: 10000 });
    expect(page.url()).toContain('/login');
  });

  test('analysis detail page redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/dashboard/analysis/nonexistent-id');
    await page.waitForURL('**/login**', { timeout: 10000 });
    expect(page.url()).toContain('/login');
  });

  test('analysis page loads with header after auth', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await page.goto('/dashboard/analysis');
    await expect(page.getByRole('heading', { name: /分\s*析\s*看\s*板/ })).toBeVisible();
  });
});
