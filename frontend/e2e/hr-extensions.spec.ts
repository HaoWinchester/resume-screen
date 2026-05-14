import { test, expect } from './fixtures';

test.describe('HR extension routes', () => {
  test('unauthenticated HR extension routes redirect to login', async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());

    const routes = [
      '/dashboard/workbench',
      '/dashboard/channels/import',
      '/dashboard/shortlist',
      '/dashboard/interviews',
      '/dashboard/talent-pool',
      '/dashboard/settings',
      '/dashboard/pipeline',
      '/dashboard/communications',
      '/dashboard/interview-feedback',
      '/dashboard/email-templates',
    ];

    for (const route of routes) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    }
  });
});
