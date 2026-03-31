import { test, expect } from '@playwright/test';

test.describe('Settings page', () => {
  test('/dashboard/instagram/settings shows "Configuracoes" or "Sistema" heading or redirects to login', async ({ page }) => {
    await page.goto('/dashboard/instagram/settings', { waitUntil: 'networkidle' });

    if (page.url().includes('/login')) {
      await expect(page).toHaveURL(/\/login/);
      return;
    }

    const heading = page.getByRole('heading', { name: /Configura[cç][oõ]es|Sistema/i }).first();
    await expect(heading).toBeVisible();
  });

  test('system health page shows Status Geral section or redirects to login', async ({ page }) => {
    await page.goto('/dashboard/instagram/settings', { waitUntil: 'networkidle' });

    if (page.url().includes('/login')) {
      await expect(page).toHaveURL(/\/login/);
      return;
    }

    await expect(page.getByText(/Status Geral/i).first()).toBeVisible();
  });
});
