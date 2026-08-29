import { referenceRateMicros } from '../money';

type SeedCategory = {
  id: string;
  name: string;
  limit: number | null;
  color: string;
};

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

export function buildSeedTimeline(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const today = now.getUTCDate();
  const recentDay = (offset: number) => Math.max(1, today - offset);
  const monthLabel = new Intl.DateTimeFormat('en', {
    month: 'long',
    timeZone: 'UTC',
  }).format(utcDate(year, month, 1));

  return {
    monthlyName: `${monthLabel} monthly`,
    monthlyStart: isoDate(utcDate(year, month, 1)),
    monthlyExpenseDates: [
      isoDate(utcDate(year, month, recentDay(1))),
      isoDate(utcDate(year, month, Math.min(2, today))),
      isoDate(utcDate(year, month, recentDay(3))),
      isoDate(utcDate(year, month, recentDay(5))),
    ],
    tripStart: isoDate(utcDate(year, month + 2, 12)),
    tripEnd: isoDate(utcDate(year, month + 2, 24)),
    bookingDates: [
      isoDate(utcDate(year, month, recentDay(2))),
      isoDate(utcDate(year, month, recentDay(7))),
    ],
  };
}

export async function seedViewer(
  db: D1Database,
  viewerId: string,
  now = new Date(),
): Promise<void> {
  const timestamp = now.toISOString();
  const timeline = buildSeedTimeline(now);
  const monthlyBudgetId = crypto.randomUUID();
  const tripBudgetId = crypto.randomUUID();
  const monthlyCategories: SeedCategory[] = [
    { id: crypto.randomUUID(), name: 'Food', limit: 3_200_000, color: '#2e7064' },
    { id: crypto.randomUUID(), name: 'Housing', limit: 4_500_000, color: '#6382a8' },
    { id: crypto.randomUUID(), name: 'Utilities', limit: 1_500_000, color: '#d1a64c' },
    { id: crypto.randomUUID(), name: 'Leisure', limit: null, color: '#e8795d' },
  ];
  const tripCategories: SeedCategory[] = [
    { id: crypto.randomUUID(), name: 'Transport', limit: 95_000, color: '#6382a8' },
    { id: crypto.randomUUID(), name: 'Stay', limit: 120_000, color: '#8774a8' },
    { id: crypto.randomUUID(), name: 'Food', limit: 70_000, color: '#e8795d' },
    { id: crypto.randomUUID(), name: 'Experiences', limit: null, color: '#d1a64c' },
  ];
  const expenses = [
    {
      budgetId: monthlyBudgetId,
      categoryId: monthlyCategories[0].id,
      title: 'Grocery basket',
      amountMinor: 284_000,
      currency: 'INR',
      converted: 284_000,
      date: timeline.monthlyExpenseDates[0],
    },
    {
      budgetId: monthlyBudgetId,
      categoryId: monthlyCategories[1].id,
      title: 'Monthly rent',
      amountMinor: 4_800_000,
      currency: 'INR',
      converted: 4_800_000,
      date: timeline.monthlyExpenseDates[1],
    },
    {
      budgetId: monthlyBudgetId,
      categoryId: monthlyCategories[2].id,
      title: 'Electricity bill',
      amountMinor: 312_000,
      currency: 'INR',
      converted: 312_000,
      date: timeline.monthlyExpenseDates[2],
    },
    {
      budgetId: monthlyBudgetId,
      categoryId: monthlyCategories[3].id,
      title: 'Weekend dinner',
      amountMinor: 195_000,
      currency: 'INR',
      converted: 195_000,
      date: timeline.monthlyExpenseDates[3],
    },
    {
      budgetId: tripBudgetId,
      categoryId: tripCategories[0].id,
      title: 'Shinkansen tickets',
      amountMinor: 28_400,
      currency: 'JPY',
      converted: 28_400,
      date: timeline.bookingDates[0],
    },
    {
      budgetId: tripBudgetId,
      categoryId: tripCategories[1].id,
      title: 'Kyoto hotel deposit',
      amountMinor: 55_800,
      currency: 'JPY',
      converted: 55_800,
      date: timeline.bookingDates[1],
    },
  ];

  await db.batch([
    db
      .prepare(
        `INSERT INTO profiles (viewer_id, display_name, base_currency, locale, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(viewerId, 'Alex Morgan', 'INR', 'en-IN', timestamp),
    db
      .prepare(
        `INSERT INTO budgets (
          id, viewer_id, name, type, reporting_currency, amount_minor,
          profile_rate_micros, start_date, end_date, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`,
      )
      .bind(
        monthlyBudgetId,
        viewerId,
        timeline.monthlyName,
        'MONTHLY',
        'INR',
        12_000_000,
        1_000_000,
        timeline.monthlyStart,
        null,
        timestamp,
      ),
    db
      .prepare(
        `INSERT INTO budgets (
          id, viewer_id, name, type, reporting_currency, amount_minor,
          profile_rate_micros, start_date, end_date, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`,
      )
      .bind(
        tripBudgetId,
        viewerId,
        'Japan journey',
        'TEMPORARY',
        'JPY',
        320_000,
        referenceRateMicros('JPY', 'INR'),
        timeline.tripStart,
        timeline.tripEnd,
        timestamp,
      ),
    ...monthlyCategories.map((category) =>
      db
        .prepare(
          `INSERT INTO categories
           (id, budget_id, viewer_id, name, limit_minor, limit_minor_optional, color, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          category.id,
          monthlyBudgetId,
          viewerId,
          category.name,
          category.limit ?? 0,
          category.limit,
          category.color,
          timestamp,
        ),
    ),
    ...tripCategories.map((category) =>
      db
        .prepare(
          `INSERT INTO categories
           (id, budget_id, viewer_id, name, limit_minor, limit_minor_optional, color, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          category.id,
          tripBudgetId,
          viewerId,
          category.name,
          category.limit ?? 0,
          category.limit,
          category.color,
          timestamp,
        ),
    ),
    ...expenses.map((expense) =>
      db
        .prepare(
          `INSERT INTO expenses (
            id, viewer_id, budget_id, category_id, title, amount_minor,
            currency, exchange_rate_micros, converted_amount_minor,
            expense_date, notes, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          viewerId,
          expense.budgetId,
          expense.categoryId,
          expense.title,
          expense.amountMinor,
          expense.currency,
          1_000_000,
          expense.converted,
          expense.date,
          timestamp,
        ),
    ),
  ]);
}
