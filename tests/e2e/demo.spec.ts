import { expect, test } from '@playwright/test';

test('opens the isolated demo and reaches the primary budgeting flow', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Sign in to the demo' })).toBeVisible();
  await page.getByRole('button', { name: 'Enter demo account' }).click();

  await expect(page.getByRole('heading', { name: /Welcome back, Alex/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your active budgets' })).toBeVisible();

  await page.getByRole('link', { name: 'Budgets', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Budgets' })).toBeVisible();

  await page
    .getByRole('link', { name: /monthly/i })
    .first()
    .click();
  await page.getByRole('button', { name: 'Add expense' }).first().click();
  await expect(page.getByRole('dialog', { name: 'Add an expense' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('dialog', { name: 'Add an expense' })).toBeHidden();
});
