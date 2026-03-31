import { test, expect } from '@playwright/test';

test.describe('Dashboard smoke tests', () => {
  test('/dashboard/instagram shows "Visao Geral" heading or redirects to login', async ({ page }) => {
    await page.goto('/dashboard/instagram', { waitUntil: 'networkidle' });

    // If redirected to login, that's expected for unauthenticated users
    if (page.url().includes('/login')) {
      await expect(page).toHaveURL(/\/login/);
      return;
    }

    await expect(page.getByRole('heading', { name: /Vis[aã]o Geral/i })).toBeVisible();
  });

  test('navigation groups are visible or page redirects to login', async ({ page }) => {
    await page.goto('/dashboard/instagram', { waitUntil: 'networkidle' });

    if (page.url().includes('/login')) {
      await expect(page).toHaveURL(/\/login/);
      return;
    }

    const navGroups = ['Analytics', 'Produ', 'Engajamento', 'Administra'];
    for (const group of navGroups) {
      await expect(page.getByText(new RegExp(group, 'i')).first()).toBeVisible();
    }
  });

  test('clicking on nav items changes the URL or page redirects to login', async ({ page }) => {
    await page.goto('/dashboard/instagram', { waitUntil: 'networkidle' });

    if (page.url().includes('/login')) {
      await expect(page).toHaveURL(/\/login/);
      return;
    }

    const navLink = page.getByRole('link').filter({ hasText: /campanha/i }).first();
    if (await navLink.isVisible()) {
      await navLink.click();
      await expect(page).not.toHaveURL(/\/dashboard\/instagram$/);
    }
  });
});
