import { test, expect } from './fixtures';

test.describe('Styles', () => {
  test('login page loads global and component styles', async ({ page }) => {
    await page.goto('/login');

    await expect(page.locator('.ant-card')).toBeVisible();
    await expect(page.locator('.ant-btn-primary')).toBeVisible();

    const styleState = await page.evaluate(() => {
      const bodyStyles = getComputedStyle(document.body);
      const cardStyles = getComputedStyle(document.querySelector('.ant-card') as Element);
      const buttonStyles = getComputedStyle(document.querySelector('.ant-btn-primary') as Element);

      return {
        bodyBackgroundImage: bodyStyles.backgroundImage,
        cardBoxShadow: cardStyles.boxShadow,
        buttonBackgroundColor: buttonStyles.backgroundColor,
        injectedStyleCount: document.querySelectorAll(
          'link[rel="stylesheet"], style[data-antd-ssr], style[data-ant-cssinjs]'
        ).length,
      };
    });

    expect(styleState.injectedStyleCount).toBeGreaterThan(0);
    expect(styleState.bodyBackgroundImage).not.toBe('none');
    expect(styleState.cardBoxShadow).not.toBe('none');
    expect(styleState.buttonBackgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  });
});
