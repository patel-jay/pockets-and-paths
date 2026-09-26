import { useState } from 'react';
import { ArrowUpRight, CalendarRange, Plane, WalletCards } from 'lucide-react';
import { Link } from 'react-router';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncState';
import { PageHeader } from '../components/PageHeader';
import { currencyFractionDigits, formatBudgetPeriod, formatMoney } from '../lib/money';
import { useProfile, useYearAnalysis } from '../lib/queries';
import type { Money, YearCurrencyAnalysis, YearMonthAnalysis } from '../types/app';

function monthLabel(periodStart: string, locale: string, style: 'short' | 'long' = 'short') {
  return new Intl.DateTimeFormat(locale, { month: style, timeZone: 'UTC' }).format(
    new Date(`${periodStart}T00:00:00Z`),
  );
}

function compactMoney(minor: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(minor / 10 ** currencyFractionDigits(currency));
}

function ReportMetric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className={`analysis-metric${tone ? ` analysis-metric--${tone}` : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function amountForView(
  currency: YearCurrencyAnalysis,
  month: YearMonthAnalysis | undefined,
  field: 'planned' | 'monthlySpent' | 'tripSpent' | 'totalSpent',
): Money {
  return month?.[field] ?? currency[field];
}

export function AnalysisPage() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(0);
  const query = useYearAnalysis(selectedYear);
  const profileQuery = useProfile();
  const locale = profileQuery.data?.profile.locale ?? 'en-IN';

  const analysis = query.data?.yearAnalysis;
  const viewLabel = selectedMonth
    ? analysis?.currencies[0]?.months.find((month) => month.month === selectedMonth)
      ? monthLabel(
          analysis.currencies[0].months.find((month) => month.month === selectedMonth)!.periodStart,
          locale,
          'long',
        )
      : 'Selected month'
    : analysis?.isCurrentYear
      ? 'Year to date'
      : 'Full year';

  const yearOptions = analysis?.availableYears ?? [selectedYear];
  const monthOptions = analysis?.currencies[0]?.months ?? [];

  if (query.isLoading) return <LoadingState label="Building your yearly analysis…" />;
  if (query.isError)
    return <ErrorState message={query.error.message} retry={() => query.refetch()} />;
  if (!analysis) return null;

  return (
    <>
      <PageHeader
        eyebrow="Patterns over time"
        title="Yearly analysis"
        copy="Compare monthly plans with actual spending, follow calendar-year cash flow, and review complete trip totals without mixing currencies."
      />

      <section className="analysis-toolbar" aria-label="Analysis period">
        <div className="analysis-toolbar__intro">
          <CalendarRange size={20} aria-hidden="true" />
          <div>
            <strong>
              {selectedYear} · {viewLabel}
            </strong>
            <span>
              {analysis.isCurrentYear
                ? `Includes January through ${monthLabel(`${selectedYear}-${String(analysis.monthsIncluded).padStart(2, '0')}-01`, locale, 'long')}.`
                : 'Includes all twelve calendar months.'}
            </span>
          </div>
        </div>
        <label>
          <span>Year</span>
          <select
            value={selectedYear}
            onChange={(event) => {
              setSelectedYear(Number(event.target.value));
              setSelectedMonth(0);
            }}
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
                {year === currentYear ? ' · YTD' : ''}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>View</span>
          <select
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(Number(event.target.value))}
          >
            <option value={0}>{analysis.isCurrentYear ? 'Year to date' : 'Full year'}</option>
            {monthOptions.map((month) => (
              <option key={month.month} value={month.month}>
                {monthLabel(month.periodStart, locale, 'long')}
              </option>
            ))}
          </select>
        </label>
      </section>

      <aside className="analysis-note">
        <WalletCards size={19} aria-hidden="true" />
        <p>
          <strong>Two useful lenses:</strong> cash flow follows each expense date, while the trip
          section compares each trip’s complete budget with all of its spending—including advance
          bookings made in another year.
        </p>
      </aside>

      {analysis.currencies.length === 0 ? (
        <EmptyState
          title={`No activity recorded for ${selectedYear}`}
          copy="Add a monthly plan, trip, or expense to start building this report."
        />
      ) : (
        <div className="analysis-currencies">
          {analysis.currencies.map((currency) => (
            <CurrencyReport
              key={currency.currency}
              currency={currency}
              locale={locale}
              selectedMonth={selectedMonth}
              viewLabel={viewLabel}
            />
          ))}
        </div>
      )}

      <section className="analysis-trips" aria-labelledby="trip-analysis-title">
        <div className="section-heading analysis-section-heading">
          <div>
            <p className="eyebrow">Trips starting in {selectedYear}</p>
            <h2 id="trip-analysis-title">Complete trip totals</h2>
          </div>
          <span className="section-count">
            {analysis.trips.length} {analysis.trips.length === 1 ? 'trip' : 'trips'}
          </span>
        </div>
        <p className="analysis-section-copy">
          These totals use the amount already stored in each trip’s reporting currency. Calendar
          cash flow shows only the part paid during {selectedYear}.
        </p>
        {analysis.trips.length === 0 ? (
          <EmptyState
            title="No trips started in this year"
            copy="Trip spending can still appear in the cash-flow chart when a trip starts in a different year."
          />
        ) : (
          <div className="analysis-trip-grid">
            {analysis.trips.map((trip) => (
              <article
                className={`analysis-trip${trip.isOverBudget ? ' analysis-trip--over' : ''}`}
                key={trip.id}
              >
                <header>
                  <span className="analysis-trip__icon">
                    <Plane size={18} aria-hidden="true" />
                  </span>
                  <div>
                    <h3>{trip.name}</h3>
                    <p>
                      {formatBudgetPeriod(trip.startDate, trip.endDate, 'TEMPORARY', locale)} ·{' '}
                      {trip.currency}
                    </p>
                  </div>
                  <Link to={`/budgets/${trip.id}`} aria-label={`Open ${trip.name}`}>
                    <ArrowUpRight size={18} />
                  </Link>
                </header>
                <dl>
                  <div>
                    <dt>Trip budget</dt>
                    <dd>{formatMoney(trip.planned.minor, trip.currency, locale)}</dd>
                  </div>
                  <div>
                    <dt>All trip spending</dt>
                    <dd>{formatMoney(trip.spent.minor, trip.currency, locale)}</dd>
                  </div>
                  <div>
                    <dt>Paid in {selectedYear}</dt>
                    <dd>{formatMoney(trip.cashFlowInYear.minor, trip.currency, locale)}</dd>
                  </div>
                  <div>
                    <dt>{trip.isOverBudget ? 'Over budget' : 'Remaining'}</dt>
                    <dd className={trip.isOverBudget ? 'status-over' : ''}>
                      {formatMoney(
                        trip.isOverBudget ? trip.overspent.minor : trip.remaining.minor,
                        trip.currency,
                        locale,
                      )}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function CurrencyReport({
  currency,
  locale,
  selectedMonth,
  viewLabel,
}: {
  currency: YearCurrencyAnalysis;
  locale: string;
  selectedMonth: number;
  viewLabel: string;
}) {
  const selected = currency.months.find((month) => month.month === selectedMonth);
  const planned = amountForView(currency, selected, 'planned');
  const monthlySpent = amountForView(currency, selected, 'monthlySpent');
  const tripSpent = amountForView(currency, selected, 'tripSpent');
  const totalSpent = amountForView(currency, selected, 'totalSpent');
  const remainingMinor = Math.max(Number(planned.minor) - Number(monthlySpent.minor), 0);
  const overspentMinor = Math.max(Number(monthlySpent.minor) - Number(planned.minor), 0);
  const categories = selected?.categories ?? currency.categories;
  const visibleMonths = selected ? [selected] : currency.months;
  const chartData = visibleMonths.map((month) => ({
    name: monthLabel(month.periodStart, locale),
    Planned: Number(month.planned.minor),
    Monthly: Number(month.monthlySpent.minor),
    Trips: Number(month.tripSpent.minor),
  }));

  return (
    <article className="analysis-report">
      <header className="analysis-report__header">
        <div>
          <span>{currency.currency}</span>
          <h2>{viewLabel} cash flow</h2>
        </div>
        <p>
          Monthly plan comparisons exclude trip budgets so their different time spans stay clear.
        </p>
      </header>

      <div className="analysis-metrics">
        <ReportMetric
          label="Monthly plan"
          value={formatMoney(planned.minor, currency.currency, locale)}
        />
        <ReportMetric
          label="Monthly spending"
          value={formatMoney(monthlySpent.minor, currency.currency, locale)}
        />
        <ReportMetric
          label={overspentMinor > 0 ? 'Monthly overspend' : 'Monthly remaining'}
          value={formatMoney(
            overspentMinor > 0 ? overspentMinor : remainingMinor,
            currency.currency,
            locale,
          )}
          tone={overspentMinor > 0 ? 'danger' : 'positive'}
        />
        <ReportMetric
          label="Trip cash flow"
          value={formatMoney(tripSpent.minor, currency.currency, locale)}
          tone="trip"
        />
        <ReportMetric
          label="Total cash flow"
          value={formatMoney(totalSpent.minor, currency.currency, locale)}
          tone="total"
        />
      </div>

      <div className="analysis-report__body">
        <div className="analysis-chart" aria-label={`${currency.currency} monthly spending chart`}>
          <ResponsiveContainer width="100%" height={310}>
            <BarChart data={chartData} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#dddcd4" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#687873', fontSize: 12 }}
              />
              <YAxis
                width={64}
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#687873', fontSize: 11 }}
                tickFormatter={(value) => compactMoney(Number(value), currency.currency, locale)}
              />
              <Tooltip
                cursor={{ fill: 'rgba(207, 225, 215, 0.28)' }}
                formatter={(value) => formatMoney(String(value), currency.currency, locale)}
              />
              <Legend iconType="circle" iconSize={8} />
              <Bar dataKey="Planned" fill="#a9bbb4" radius={[5, 5, 0, 0]} />
              <Bar dataKey="Monthly" fill="#2e7064" radius={[5, 5, 0, 0]} />
              <Bar dataKey="Trips" fill="#e8795d" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="analysis-categories">
          <h3>Top categories</h3>
          {categories.length === 0 ? (
            <p className="analysis-muted">No spending in this period.</p>
          ) : (
            <ol>
              {categories.slice(0, 6).map((category) => {
                const share =
                  Number(totalSpent.minor) > 0
                    ? Math.round((Number(category.spent.minor) / Number(totalSpent.minor)) * 100)
                    : 0;
                return (
                  <li key={category.name}>
                    <span>
                      <strong>{category.name}</strong>
                      <small>{share}% of cash flow</small>
                    </span>
                    <b>{formatMoney(category.spent.minor, currency.currency, locale)}</b>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>

      <div className="analysis-table-wrap">
        <table className="analysis-table">
          <thead>
            <tr>
              <th>Month</th>
              <th>Monthly plan</th>
              <th>Monthly spent</th>
              <th>Trip cash flow</th>
              <th>Total cash flow</th>
            </tr>
          </thead>
          <tbody>
            {visibleMonths.map((month) => (
              <tr key={month.month}>
                <th>{monthLabel(month.periodStart, locale, 'long')}</th>
                <td>{formatMoney(month.planned.minor, currency.currency, locale)}</td>
                <td>{formatMoney(month.monthlySpent.minor, currency.currency, locale)}</td>
                <td>{formatMoney(month.tripSpent.minor, currency.currency, locale)}</td>
                <td>{formatMoney(month.totalSpent.minor, currency.currency, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}
