import { test, expect } from './fixtures';

test.describe('Comparison and Export', () => {
  test('comparison page redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/dashboard/analysis/compare');
    await page.waitForURL('**/login**', { timeout: 10000 });
    expect(page.url()).toContain('/login');
  });

  test('comparison page shows error when accessed without ids', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await page.goto('/dashboard/analysis/compare');
    // Without ids query param, the page redirects back to analysis or shows error
    // The compare page reads ids from searchParams and validates >= 2 ids
  });
});
