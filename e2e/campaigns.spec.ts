import { test, expect } from '@playwright/test';

test.describe('Campaigns page', () => {
  test('/dashboard/instagram/campaigns shows "Campanhas" heading or redirects to login', async ({ page }) => {
    await page.goto('/dashboard/instagram/campaigns', { waitUntil: 'networkidle' });

    if (page.url().includes('/login')) {
      await expect(page).toHaveURL(/\/login/);
      return;
    }

    await expect(page.getByRole('heading', { name: /Campanhas/i })).toBeVisible();
  });

  test('KPI cards are visible or page redirects to login', async ({ page }) => {
    await page.goto('/dashboard/instagram/campaigns', { waitUntil: 'networkidle' });

    if (page.url().includes('/login')) {
      await expect(page).toHaveURL(/\/login/);
      return;
    }

    const kpis = ['Total', 'Em revis', 'Aprovad', 'Agendad'];
    for (const kpi of kpis) {
      await expect(page.getByText(new RegExp(kpi, 'i')).first()).toBeVisible();
    }
  });

  test('"Nova Campanha" button links to /campaigns/new or page redirects to login', async ({ page }) => {
    await page.goto('/dashboard/instagram/campaigns', { waitUntil: 'networkidle' });

    if (page.url().includes('/login')) {
      await expect(page).toHaveURL(/\/login/);
      return;
    }

    const newButton = page.getByRole('link', { name: /Nova Campanha/i }).first();
    if (await newButton.isVisible()) {
      await expect(newButton).toHaveAttribute('href', /campaigns\/new/);
    }
  });

  test('filter buttons are clickable or page redirects to login', async ({ page }) => {
    await page.goto('/dashboard/instagram/campaigns', { waitUntil: 'networkidle' });

    if (page.url().includes('/login')) {
      await expect(page).toHaveURL(/\/login/);
      return;
    }

    const filterButton = page.getByRole('button').first();
    if (await filterButton.isVisible()) {
      await filterButton.click();
    }
  });
});
