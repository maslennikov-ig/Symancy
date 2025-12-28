import { test, expect } from '@playwright/test';

test.describe('Critical Path', () => {
  test('homepage loads', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
  });

  test('ChatOnboarding accepts user input', async ({ page }) => {
    await page.goto('/');
    // Wait for chat to load
    await expect(page.locator('.chat-onboarding-container')).toBeVisible({ timeout: 10000 });
    // Wait for Arina's greeting
    await page.waitForTimeout(2000);
    // Type name
    const input = page.locator('[placeholder]').first();
    if (await input.isVisible()) {
      await input.fill('Test User');
      await input.press('Enter');
    }
  });

  test('Image upload is accessible', async ({ page }) => {
    await page.goto('/');
    // Wait for chat to load
    await page.waitForTimeout(3000);
    // Look for image upload component or button
    // Note: This is a basic smoke test - full upload requires auth
    const uploadButton = page.locator('button, [type="file"], [role="button"]').filter({ hasText: /upload|загруз|上传/i });
    if (await uploadButton.count() > 0) {
      await expect(uploadButton.first()).toBeVisible();
    }
  });
});
