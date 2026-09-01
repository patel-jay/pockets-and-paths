import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 320, height: 568 } });

test('keeps the complete budgeting flow usable at the minimum mobile width', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sign in to the demo' })).toBeVisible();
  await page.getByRole('button', { name: 'Enter demo account' }).click();
  await expect(page.getByRole('heading', { name: /Welcome back, Alex/ })).toBeVisible();

  const mobileNav = page.getByRole('navigation', { name: 'Mobile navigation' });
  await expect(mobileNav).toBeVisible();
  for (const label of ['Home', 'Budgets', 'Expenses', 'Settings']) {
    const box = await mobileNav.getByRole('link', { name: label, exact: true }).boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }

  await mobileNav.getByRole('link', { name: 'Budgets', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Budgets' })).toBeVisible();
  const monthlyBudget = page.getByRole('link', { name: /Open .* monthly/i }).first();
  const monthlyBudgetName = (await monthlyBudget.getAttribute('aria-label'))!.replace('Open ', '');
  await monthlyBudget.click();
  await expect(page.getByRole('heading', { name: monthlyBudgetName, exact: true })).toBeVisible();

  const summaryValues = page.locator('.detail-summary strong');
  await expect(summaryValues).toHaveCount(4);
  for (const value of await summaryValues.all()) {
    const fit = await value.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      right: element.getBoundingClientRect().right,
      cellRight: element.parentElement!.getBoundingClientRect().right,
    }));
    expect(fit.scrollWidth).toBeLessThanOrEqual(fit.clientWidth);
    expect(fit.right).toBeLessThanOrEqual(fit.cellRight);
  }

  const horizontalFit = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(horizontalFit.scrollWidth).toBeLessThanOrEqual(horizontalFit.innerWidth);

  for (const target of [
    page.locator('.back-link'),
    page.getByRole('button', { name: 'Split evenly' }),
    page.getByRole('button', { name: 'Add', exact: true }),
    page.getByRole('button', { name: /Edit .* limit/ }).first(),
  ]) {
    const box = await target.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }

  const categoryToggle = page
    .locator('.category-actions')
    .getByRole('button', { name: 'Add', exact: true });
  await categoryToggle.click();
  const categoryColor = page.getByLabel('Category color');
  await expect(categoryColor).toHaveAttribute('type', 'color');
  await expect(categoryColor).toHaveValue('#2e7064');
  await categoryColor.fill('#e8795d');
  await expect(page.getByText('#E8795D')).toBeVisible();
  await categoryToggle.click();

  await page.locator('.detail-header .primary-button').click();
  const expenseDialog = page.getByRole('dialog', { name: 'Add an expense' });
  await expect(expenseDialog).toBeVisible();
  const closeBox = await expenseDialog.getByRole('button', { name: 'Close' }).boundingBox();
  expect(closeBox?.width).toBeGreaterThanOrEqual(44);
  expect(closeBox?.height).toBeGreaterThanOrEqual(44);
  await expenseDialog.getByRole('button', { name: 'Cancel' }).click();

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await mobileNav.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

  await page.getByRole('button', { name: 'Sign out' }).click();
  const loginHeading = page.getByRole('heading', { name: 'Sign in to the demo' });
  await expect(loginHeading).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  const loginLayout = await page.evaluate(() => ({
    heroHeight: document.querySelector('.login-story')!.getBoundingClientRect().height,
    headingBottom: document.querySelector('#login-title')!.getBoundingClientRect().bottom,
  }));
  expect(loginLayout.heroHeight).toBeLessThan(320);
  expect(loginLayout.headingBottom).toBeLessThanOrEqual(568);
});
