import { DomainError } from '../errors';
import type {
  BudgetStatus,
  YearAnalysis,
  YearCategoryTotal,
  YearCurrencyAnalysis,
  YearTripAnalysis,
} from '../types';
import { ensureViewerYearPeriods } from './periods';

interface AmountRow {
  month: string;
  currency: string;
  amount_minor: number;
}

interface CategoryAmountRow extends AmountRow {
  name: string;
}

interface TripRow {
  id: string;
  name: string;
  reporting_currency: string;
  start_date: string;
  end_date: string | null;
  status: BudgetStatus;
  amount_minor: number;
  spent_minor: number;
  cash_flow_in_year_minor: number;
}

function requireReportYear(year: number): number {
  if (!Number.isInteger(year) || year < 1900 || year > 2200) {
    throw new DomainError('Choose a year between 1900 and 2200.');
  }
  return year;
}

function addCategory(target: YearCategoryTotal[], name: string, spentMinor: number): void {
  const existing = target.find((category) => category.name === name);
  if (existing) existing.spentMinor += spentMinor;
  else target.push({ name, spentMinor });
}

function createCurrencyAnalysis(
  currency: string,
  year: number,
  monthsIncluded: number,
): YearCurrencyAnalysis {
  return {
    currency,
    plannedMinor: 0,
    monthlySpentMinor: 0,
    tripSpentMinor: 0,
    totalSpentMinor: 0,
    remainingMinor: 0,
    overspentMinor: 0,
    months: Array.from({ length: monthsIncluded }, (_, index) => ({
      month: index + 1,
      periodStart: `${year}-${String(index + 1).padStart(2, '0')}-01`,
      plannedMinor: 0,
      monthlySpentMinor: 0,
      tripSpentMinor: 0,
      totalSpentMinor: 0,
      categories: [],
    })),
    categories: [],
  };
}

function monthNumber(month: string): number {
  return Number(month.slice(5, 7));
}

export async function getYearAnalysis(
  db: D1Database,
  viewerId: string,
  requestedYear: number,
): Promise<YearAnalysis> {
  const year = requireReportYear(requestedYear);
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const isCurrentYear = year === currentYear;
  const monthsIncluded = isCurrentYear ? now.getUTCMonth() + 1 : 12;
  const rangeStart = `${year}-01-01`;
  const rangeEnd = isCurrentYear
    ? new Date(Date.UTC(year, monthsIncluded, 1)).toISOString().slice(0, 10)
    : `${year + 1}-01-01`;

  if (year >= currentYear) {
    await ensureViewerYearPeriods(db, viewerId, year);
  }

  const [yearRows, plannedRows, monthlyRows, tripRows, categoryRows, tripBudgetRows] =
    await Promise.all([
      db
        .prepare(
          `WITH report_years(year) AS (
             SELECT substr(period_start, 1, 4) FROM budget_periods WHERE viewer_id = ?
             UNION
             SELECT substr(expense_date, 1, 4) FROM expenses WHERE viewer_id = ?
             UNION
             SELECT substr(start_date, 1, 4) FROM budgets WHERE viewer_id = ?
             UNION
             SELECT ?
           )
           SELECT CAST(year AS INTEGER) AS year
           FROM report_years
           WHERE year GLOB '[0-9][0-9][0-9][0-9]'
           ORDER BY year DESC`,
        )
        .bind(viewerId, viewerId, viewerId, String(currentYear))
        .all<{ year: number }>(),
      db
        .prepare(
          `SELECT substr(p.period_start, 1, 7) AS month,
                  b.reporting_currency AS currency,
                  SUM(p.amount_minor) AS amount_minor
           FROM budget_periods p
           JOIN budgets b ON b.id = p.budget_id AND b.viewer_id = p.viewer_id
           WHERE p.viewer_id = ? AND p.period_start >= ? AND p.period_start < ?
           GROUP BY month, currency`,
        )
        .bind(viewerId, rangeStart, rangeEnd)
        .all<AmountRow>(),
      db
        .prepare(
          `SELECT substr(e.expense_date, 1, 7) AS month,
                  b.reporting_currency AS currency,
                  SUM(e.converted_amount_minor) AS amount_minor
           FROM expenses e
           JOIN budgets b ON b.id = e.budget_id AND b.viewer_id = e.viewer_id
           WHERE e.viewer_id = ? AND b.type = 'MONTHLY'
             AND e.expense_date >= ? AND e.expense_date < ?
           GROUP BY month, currency`,
        )
        .bind(viewerId, rangeStart, rangeEnd)
        .all<AmountRow>(),
      db
        .prepare(
          `SELECT substr(e.expense_date, 1, 7) AS month,
                  b.reporting_currency AS currency,
                  SUM(e.converted_amount_minor) AS amount_minor
           FROM expenses e
           JOIN budgets b ON b.id = e.budget_id AND b.viewer_id = e.viewer_id
           WHERE e.viewer_id = ? AND b.type = 'TEMPORARY'
             AND e.expense_date >= ? AND e.expense_date < ?
           GROUP BY month, currency`,
        )
        .bind(viewerId, rangeStart, rangeEnd)
        .all<AmountRow>(),
      db
        .prepare(
          `SELECT substr(e.expense_date, 1, 7) AS month,
                  b.reporting_currency AS currency,
                  c.name,
                  SUM(e.converted_amount_minor) AS amount_minor
           FROM expenses e
           JOIN budgets b ON b.id = e.budget_id AND b.viewer_id = e.viewer_id
           JOIN categories c ON c.id = e.category_id AND c.viewer_id = e.viewer_id
           WHERE e.viewer_id = ? AND e.expense_date >= ? AND e.expense_date < ?
           GROUP BY month, currency, c.name
           ORDER BY amount_minor DESC`,
        )
        .bind(viewerId, rangeStart, rangeEnd)
        .all<CategoryAmountRow>(),
      db
        .prepare(
          `SELECT b.id, b.name, b.reporting_currency, b.start_date, b.end_date,
                  b.status, b.amount_minor,
                  COALESCE(SUM(e.converted_amount_minor), 0) AS spent_minor,
                  COALESCE(SUM(
                    CASE WHEN e.expense_date >= ? AND e.expense_date < ?
                      THEN e.converted_amount_minor ELSE 0 END
                  ), 0) AS cash_flow_in_year_minor
           FROM budgets b
           LEFT JOIN expenses e
             ON e.budget_id = b.id AND e.viewer_id = b.viewer_id
           WHERE b.viewer_id = ? AND b.type = 'TEMPORARY'
             AND b.start_date >= ? AND b.start_date < ?
           GROUP BY b.id
           ORDER BY b.start_date ASC, b.name ASC`,
        )
        .bind(rangeStart, rangeEnd, viewerId, rangeStart, `${year + 1}-01-01`)
        .all<TripRow>(),
    ]);

  const currencies = new Map<string, YearCurrencyAnalysis>();
  const getCurrency = (currency: string) => {
    let analysis = currencies.get(currency);
    if (!analysis) {
      analysis = createCurrencyAnalysis(currency, year, monthsIncluded);
      currencies.set(currency, analysis);
    }
    return analysis;
  };

  for (const row of plannedRows.results) {
    const analysis = getCurrency(row.currency);
    const month = analysis.months[monthNumber(row.month) - 1];
    if (month) month.plannedMinor += Number(row.amount_minor);
  }
  for (const row of monthlyRows.results) {
    const analysis = getCurrency(row.currency);
    const month = analysis.months[monthNumber(row.month) - 1];
    if (month) month.monthlySpentMinor += Number(row.amount_minor);
  }
  for (const row of tripRows.results) {
    const analysis = getCurrency(row.currency);
    const month = analysis.months[monthNumber(row.month) - 1];
    if (month) month.tripSpentMinor += Number(row.amount_minor);
  }
  for (const row of categoryRows.results) {
    const analysis = getCurrency(row.currency);
    const amount = Number(row.amount_minor);
    addCategory(analysis.categories, row.name, amount);
    const month = analysis.months[monthNumber(row.month) - 1];
    if (month) addCategory(month.categories, row.name, amount);
  }

  const trips: YearTripAnalysis[] = tripBudgetRows.results.map((trip) => {
    const plannedMinor = Number(trip.amount_minor);
    const spentMinor = Number(trip.spent_minor);
    getCurrency(trip.reporting_currency);
    return {
      id: trip.id,
      name: trip.name,
      currency: trip.reporting_currency,
      startDate: trip.start_date,
      endDate: trip.end_date,
      status: trip.status,
      plannedMinor,
      spentMinor,
      remainingMinor: Math.max(plannedMinor - spentMinor, 0),
      overspentMinor: Math.max(spentMinor - plannedMinor, 0),
      cashFlowInYearMinor: Number(trip.cash_flow_in_year_minor),
    };
  });

  for (const analysis of currencies.values()) {
    for (const month of analysis.months) {
      month.totalSpentMinor = month.monthlySpentMinor + month.tripSpentMinor;
      month.categories.sort((a, b) => b.spentMinor - a.spentMinor || a.name.localeCompare(b.name));
      analysis.plannedMinor += month.plannedMinor;
      analysis.monthlySpentMinor += month.monthlySpentMinor;
      analysis.tripSpentMinor += month.tripSpentMinor;
      analysis.totalSpentMinor += month.totalSpentMinor;
    }
    analysis.remainingMinor = Math.max(analysis.plannedMinor - analysis.monthlySpentMinor, 0);
    analysis.overspentMinor = Math.max(analysis.monthlySpentMinor - analysis.plannedMinor, 0);
    analysis.categories.sort((a, b) => b.spentMinor - a.spentMinor || a.name.localeCompare(b.name));
  }

  const availableYears = new Set(yearRows.results.map((row) => Number(row.year)));
  availableYears.add(year);

  return {
    year,
    isCurrentYear,
    monthsIncluded,
    availableYears: [...availableYears].sort((a, b) => b - a),
    currencies: [...currencies.values()].sort((a, b) => a.currency.localeCompare(b.currency)),
    trips,
  };
}
