import { test, expect } from '@playwright/test';

test.describe('Auth flow', () => {
  test('unauthenticated user is redirected to /login', async ({ page }) => {
    await page.goto('/dashboard/instagram', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/\/login/);
  });

  test('login page renders with email and password fields', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle' });
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"], input[name="password"]')).toBeVisible();
  });

  test('login page has a submit button', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle' });
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });
});
