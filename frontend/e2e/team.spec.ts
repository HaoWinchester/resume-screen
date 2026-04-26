import { test, expect } from './fixtures';

test.describe('Team Management', () => {
  test('team page redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/dashboard/team');
    await page.waitForURL('**/login**', { timeout: 10000 });
    expect(page.url()).toContain('/login');
  });

  test('team page loads with header after admin auth', async ({ adminPage }) => {
    const page = adminPage;
    await page.goto('/dashboard/team');
    await expect(page.getByRole('heading', { name: /团\s*队\s*管\s*理/ })).toBeVisible();
  });

  test('team page shows statistics cards after admin auth', async ({ adminPage }) => {
    const page = adminPage;
    await page.goto('/dashboard/team');
    await expect(page.getByText(/团\s*队\s*成\s*员/)).toBeVisible();
    await expect(page.getByText(/公\s*司\s*名\s*称/)).toBeVisible();
    await expect(page.getByText(/管\s*理\s*员\s*数\s*量/)).toBeVisible();
  });
});
