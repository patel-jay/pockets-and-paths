import { expect, test } from '@playwright/test';

test('opens the isolated demo and reaches the primary budgeting flow', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Sign in to the demo' })).toBeVisible();
  await page.getByRole('button', { name: 'Enter demo account' }).click();

  await expect(page.getByRole('heading', { name: /Welcome back, Alex/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your plans' })).toBeVisible();

  await page.getByRole('link', { name: 'Budgets', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Budgets' })).toBeVisible();

  await page.getByRole('button', { name: 'New budget' }).click();
  const budgetDialog = page.getByRole('dialog', { name: 'Create a budget' });
  const [currencyTop, amountTop] = await Promise.all([
    budgetDialog.getByLabel('Currency').evaluate((element) => element.getBoundingClientRect().top),
    budgetDialog
      .getByLabel('Total budget')
      .evaluate((element) => element.getBoundingClientRect().top),
  ]);
  expect(Math.abs(currencyTop - amountTop)).toBeLessThanOrEqual(1);
  await budgetDialog.getByRole('button', { name: 'Cancel' }).click();

  await page
    .getByRole('link', { name: /monthly/i })
    .first()
    .click();
  await page.getByRole('button', { name: 'Add expense' }).first().click();
  await expect(page.getByRole('dialog', { name: 'Add an expense' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('dialog', { name: 'Add an expense' })).toBeHidden();
});
