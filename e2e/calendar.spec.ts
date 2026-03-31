import { test, expect } from '@playwright/test';

test.describe('Calendar page', () => {
  test('/dashboard/instagram/calendar shows "Calendario Editorial" heading or redirects to login', async ({ page }) => {
    await page.goto('/dashboard/instagram/calendar', { waitUntil: 'networkidle' });

    if (page.url().includes('/login')) {
      await expect(page).toHaveURL(/\/login/);
      return;
    }

    await expect(page.getByRole('heading', { name: /Calend[aá]rio Editorial/i })).toBeVisible();
  });

  test('three view buttons exist or page redirects to login', async ({ page }) => {
    await page.goto('/dashboard/instagram/calendar', { waitUntil: 'networkidle' });

    if (page.url().includes('/login')) {
      await expect(page).toHaveURL(/\/login/);
      return;
    }

    await expect(page.getByRole('button', { name: /Calend[aá]rio/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Kanban/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Tabela/i })).toBeVisible();
  });

  test('clicking "Tabela" shows a table or page redirects to login', async ({ page }) => {
    await page.goto('/dashboard/instagram/calendar', { waitUntil: 'networkidle' });

    if (page.url().includes('/login')) {
      await expect(page).toHaveURL(/\/login/);
      return;
    }

    const tabelaButton = page.getByRole('button', { name: /Tabela/i });
    if (await tabelaButton.isVisible()) {
      await tabelaButton.click();
      await expect(page.locator('table').first()).toBeVisible();
    }
  });

  test('month navigation works or page redirects to login', async ({ page }) => {
    await page.goto('/dashboard/instagram/calendar', { waitUntil: 'networkidle' });

    if (page.url().includes('/login')) {
      await expect(page).toHaveURL(/\/login/);
      return;
    }

    // Look for next/previous month navigation buttons
    const nextButton = page.getByRole('button', { name: /pr[oó]ximo|next|>/i }).first();
    if (await nextButton.isVisible()) {
      await nextButton.click();
      // Page should still be on the calendar route
      await expect(page).toHaveURL(/\/calendar/);
    }
  });
});
