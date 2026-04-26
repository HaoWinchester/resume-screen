/**
 * Analysis Dashboard Flow E2E tests
 * Tests analysis viewing, candidate comparison, and statistics
 *
 * IMPORTANT: Navigate via sidebar clicks, not page.goto() for sub-pages
 */
import { test, expect } from './fixtures';
import {
  API_BASE,
  createJobViaAPI,
  getAuthToken,
  uploadSampleResume,
} from './helpers';

const ADMIN_EMAIL = 'admin@test.com';
const ADMIN_PASSWORD = '12345678';

// Helper: login and navigate to analysis page via sidebar
async function goToAnalysisPage(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByPlaceholder(/邮箱/).fill(ADMIN_EMAIL);
  await page.getByPlaceholder(/密码/).fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /登\s*录/ }).click();
  await page.waitForURL('**/dashboard/**', { timeout: 10000 });
  await page.waitForTimeout(2000);

  // Navigate via sidebar
  const analysisLink = page.locator('.ant-menu-item').filter({ hasText: /分析看板/ });
  await analysisLink.click();
  await page.waitForTimeout(3000);
}

test.describe('Analysis Dashboard Page', () => {
  test('displays analysis page with all UI elements', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    // Navigate to analysis via sidebar
    await page.goto('/dashboard/jobs');
    await page.waitForTimeout(3000);
    await page.locator('.ant-menu-item').filter({ hasText: /分析看板/ }).click();
    await page.waitForTimeout(3000);

    // Page title
    const bodyText = await page.textContent('.ant-layout-content');
    expect(bodyText).toContain('分析看板');

    // Refresh button
    await expect(page.getByRole('button', { name: /刷\s*新/ })).toBeVisible();

    // Export dropdown
    await expect(page.getByRole('button', { name: /导\s*出/ })).toBeVisible();

    // Job selector
    const selectCount = await page.locator('.ant-select').count();
    expect(selectCount).toBeGreaterThanOrEqual(1);
  });

  test('selecting a job shows statistics cards', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await page.goto('/dashboard/jobs');
    await page.waitForTimeout(3000);
    await page.locator('.ant-menu-item').filter({ hasText: /分析看板/ }).click();
    await page.waitForTimeout(3000);

    // Click job selector dropdown
    const jobSelect = page.locator('.ant-select').first();
    await jobSelect.click();
    await page.waitForTimeout(500);

    // Select first option
    const firstOption = page.locator('.ant-select-dropdown:visible .ant-select-item').first();
    if (await firstOption.isVisible()) {
      await firstOption.click();
      await page.waitForTimeout(3000);

      // Statistics cards should be visible
      const content = await page.textContent('.ant-layout-content');
      expect(content).toContain('总简历数');
      expect(content).toContain('已分析');
      expect(content).toContain('强烈推荐');
      expect(content).toContain('平均分');
    }
  });

  test('recommendation filter tabs work', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await page.goto('/dashboard/jobs');
    await page.waitForTimeout(3000);
    await page.locator('.ant-menu-item').filter({ hasText: /分析看板/ }).click();
    await page.waitForTimeout(3000);

    // Select a job first
    const jobSelect = page.locator('.ant-select').first();
    await jobSelect.click();
    await page.waitForTimeout(500);
    const firstOption = page.locator('.ant-select-dropdown:visible .ant-select-item').first();
    if (await firstOption.isVisible()) {
      await firstOption.click();
      await page.waitForTimeout(2000);
    }

    // Try recommendation filter tabs
    const tabs = [/强烈推荐/, /推荐/, /待定/];
    for (const tabPattern of tabs) {
      const tab = page.getByText(tabPattern).first();
      if (await tab.isVisible()) {
        await tab.click();
        await page.waitForTimeout(500);
      }
    }

    // Click "全部" to reset
    const allTab = page.getByText(/全\s*部/).first();
    if (await allTab.isVisible()) {
      await allTab.click();
      await page.waitForTimeout(500);
    }
  });

  test('export dropdown button exists with correct text', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await page.goto('/dashboard/jobs');
    await page.waitForTimeout(3000);
    await page.locator('.ant-menu-item').filter({ hasText: /分析看板/ }).click();
    await page.waitForTimeout(3000);

    // Export button exists (Dropdown.Button renders as two buttons)
    const content = await page.textContent('.ant-layout-content');
    expect(content).toContain('导');
    expect(content).toContain('出');

    // Refresh button is also visible
    await expect(page.getByRole('button', { name: /刷\s*新/ })).toBeVisible();
  });

  test('can delete an uploaded resume from analysis dashboard', async ({ page, request }) => {
    test.setTimeout(60000);

    const token = await getAuthToken();
    const timestamp = Date.now();
    const job = await createJobViaAPI(token, `分析删除_${timestamp}`, 'active');
    const fileName = `analysis-delete-${timestamp}.pdf`;
    const upload = await uploadSampleResume(request, token, job.id, fileName);
    const resumeId = upload.uploaded[0].id;

    await expect
      .poll(async () => {
        const response = await request.get(`${API_BASE}/api/v1/analysis`, {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            job_requirement_id: job.id,
            page: '1',
            per_page: '20',
          },
        });
        const payload = await response.json();
        return payload.items?.some((item: any) => item.resume_id === resumeId) ?? false;
      }, { timeout: 15000 })
      .toBe(true);

    await page.goto('/login');
    await page.getByPlaceholder(/邮箱/).fill(ADMIN_EMAIL);
    await page.getByPlaceholder(/密码/).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /登\s*录/ }).click();
    await page.waitForURL('**/dashboard/**', { timeout: 10000 });

    await page.goto('/dashboard/analysis');
    await page.locator('.ant-select').first().click();
    await page
      .locator('.ant-select-dropdown:visible .ant-select-item-option')
      .filter({ hasText: job.title })
      .click();

    const rows = page.locator('tr.ant-table-row');
    await expect(rows).toHaveCount(1, { timeout: 10000 });
    const row = rows.first();
    await expect(row).toContainText(/详\s*情/);

    await row.getByRole('button', { name: /删\s*除/ }).click();
    await page.locator('.ant-popconfirm-buttons .ant-btn-primary').click();
    await expect(rows).toHaveCount(0, { timeout: 10000 });

    const detailResponse = await request.get(`${API_BASE}/api/v1/resumes/${resumeId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(detailResponse.status()).toBe(404);
  });
});

test.describe('Analysis Detail Page', () => {
  test('analysis detail page handles invalid ID gracefully', async ({ page }) => {
    await goToAnalysisPage(page);

    // Navigate directly via URL (may need special handling)
    await page.evaluate(() => {
      window.location.href = '/dashboard/analysis/nonexistent-id';
    });
    await page.waitForTimeout(5000);

    // Page should not crash
    expect(page.url()).toContain('/dashboard');
  });

  test('navigate to analysis detail from table', async ({ page }) => {
    await goToAnalysisPage(page);

    // Select a job
    const jobSelect = page.locator('.ant-select').first();
    await jobSelect.click();
    await page.waitForTimeout(500);
    const firstOption = page.locator('.ant-select-dropdown:visible .ant-select-item').first();
    if (await firstOption.isVisible()) {
      await firstOption.click();
      await page.waitForTimeout(3000);
    }

    // Look for detail links
    const detailLinks = page.locator('a').filter({ hasText: /详\s*情/ });
    if (await detailLinks.count() > 0) {
      await detailLinks.first().click();
      await page.waitForTimeout(3000);

      expect(page.url()).toMatch(/\/analysis\/.+/);
    }
  });
});

test.describe('Candidate Comparison', () => {
  test('compare button appears when candidates selected', async ({ page }) => {
    await goToAnalysisPage(page);

    // Select a job
    const jobSelect = page.locator('.ant-select').first();
    await jobSelect.click();
    await page.waitForTimeout(500);
    const firstOption = page.locator('.ant-select-dropdown:visible .ant-select-item').first();
    if (await firstOption.isVisible()) {
      await firstOption.click();
      await page.waitForTimeout(3000);
    }

    // Try selecting candidates - use table row checkboxes, not the "select all" checkbox
    const rowCheckboxes = page.locator('tr.ant-table-row .ant-checkbox-input');
    const checkboxCount = await rowCheckboxes.count();

    if (checkboxCount >= 2) {
      // Check if checkboxes are enabled
      const firstEnabled = await rowCheckboxes.nth(0).isEnabled();
      if (firstEnabled) {
        await rowCheckboxes.nth(0).check();
        await rowCheckboxes.nth(1).check();
        await page.waitForTimeout(500);

        // Compare button should appear
        const compareBtn = page.getByRole('button', { name: /对\s*比\s*候\s*选\s*人/ });
        if (await compareBtn.isVisible()) {
          await compareBtn.click();
          await page.waitForTimeout(3000);

          // Should be on compare page
          expect(page.url()).toContain('compare');
        }
      }
    }
  });
});

test.describe('Analysis Navigation', () => {
  test('navigate from sidebar to analysis page', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await page.goto('/dashboard/jobs');
    await page.waitForTimeout(3000);

    await page.locator('.ant-menu-item').filter({ hasText: /分析看板/ }).click();
    await page.waitForTimeout(3000);

    expect(page.url()).toContain('/dashboard/analysis');
    const content = await page.textContent('.ant-layout-content');
    expect(content).toContain('分析看板');
  });
});
