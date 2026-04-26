import { test as base, expect } from '@playwright/test';
import { faker } from '@faker-js/faker';

// Real backend credentials for full-stack testing
const ADMIN_EMAIL = 'admin@test.com';
const ADMIN_PASSWORD = '12345678';

// Extend test with authenticated page fixture
export const test = base.extend<{
  authenticatedPage: import('@playwright/test').Page;
  adminPage: import('@playwright/test').Page;
}>({
  authenticatedPage: async ({ page }, use) => {
    // Login with real backend admin account
    await page.goto('/login');
    await page.getByPlaceholder(/邮箱/i).fill(ADMIN_EMAIL);
    await page.getByPlaceholder(/密码/i).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /登\s*录/ }).click();
    await page.waitForURL('**/dashboard/**', { timeout: 10000 });
    await use(page);
  },
  adminPage: async ({ page }, use) => {
    // Login as admin (same account - first user is admin)
    await page.goto('/login');
    await page.getByPlaceholder(/邮箱/i).fill(ADMIN_EMAIL);
    await page.getByPlaceholder(/密码/i).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /登\s*录/ }).click();
    await page.waitForURL('**/dashboard/**', { timeout: 10000 });
    await use(page);
  },
});

export { expect };
export { faker };
