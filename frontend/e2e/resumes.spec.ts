import { test, expect } from './fixtures';

test.describe('Resume Upload', () => {
  test('upload page redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/dashboard/resumes/upload');
    await page.waitForURL('**/login**', { timeout: 10000 });
    expect(page.url()).toContain('/login');
  });

  test('resume list page redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/dashboard/resumes');
    await page.waitForURL('**/login**', { timeout: 10000 });
    expect(page.url()).toContain('/login');
  });

  test('upload page loads with correct elements after auth', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await page.goto('/dashboard/resumes/upload');
    await expect(page.getByRole('heading', { name: /上\s*传\s*简\s*历/ })).toBeVisible();
  });

  test('resume list page shows header after auth', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await page.goto('/dashboard/resumes');
    await expect(page.getByText(/简\s*历\s*管\s*理/)).toBeVisible();
    await expect(page.getByRole('button', { name: /上\s*传\s*简\s*历/ })).toBeVisible();
  });
});
