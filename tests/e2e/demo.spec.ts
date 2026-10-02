import { expect, test } from '@playwright/test';

test('opens the isolated demo and reaches the primary budgeting flow', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Sign in to the demo' })).toBeVisible();
  await page.getByRole('button', { name: 'Enter demo account' }).click();

  await expect(page.getByRole('heading', { name: /Welcome back, Alex/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your plans' })).toBeVisible();

  await page.getByRole('link', { name: 'Expenses', exact: true }).first().click();
  const recordRefund = page.getByRole('button', { name: /Record refund for/ }).first();
  const refundedExpenseTitle = (await recordRefund.getAttribute('aria-label'))!.replace(
    'Record refund for ',
    '',
  );
  await recordRefund.click();
  await expect(page.getByRole('heading', { name: 'Record refund' })).toBeVisible();
  await page.getByRole('button', { name: 'Record full refund' }).click();
  await expect(page.getByText('Fully refunded', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: `${refundedExpenseTitle} is fully refunded` }),
  ).toBeDisabled();

  await page.getByRole('button', { name: `Edit refund for ${refundedExpenseTitle}` }).click();
  const editRefundDialog = page.getByRole('dialog', { name: 'Edit refund' });
  await editRefundDialog.getByLabel(/Refund amount in/).fill('1.00');
  await editRefundDialog.getByRole('button', { name: 'Save refund' }).click();
  await expect(page.getByText('Partially refunded', { exact: true })).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: `Delete refund for ${refundedExpenseTitle}` }).click();
  await expect(page.getByText('Partially refunded', { exact: true })).toBeHidden();

  await page.getByRole('link', { name: 'Budgets', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Budgets' })).toBeVisible();

  await page.getByRole('link', { name: 'Analysis', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Yearly analysis' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Complete trip totals' })).toBeVisible();

  await page.getByRole('link', { name: 'Budgets', exact: true }).first().click();

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
  await page.getByRole('button', { name: 'Edit budget' }).click();
  await expect(page.getByRole('dialog', { name: 'Edit budget' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Add expense' }).first().click();
  await expect(page.getByRole('dialog', { name: 'Add an expense' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('dialog', { name: 'Add an expense' })).toBeHidden();
});
