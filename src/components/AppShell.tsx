import { useState } from 'react';
import {
  CircleDollarSign,
  Home,
  LogOut,
  Plus,
  ReceiptText,
  Settings,
  WalletCards,
} from 'lucide-react';
import { NavLink, Outlet } from 'react-router';
import { useDashboard } from '../lib/queries';
import type { AppOutletContext } from '../lib/app-actions';
import { useAuth } from '../lib/auth-context';
import { AddExpenseModal } from './AddExpenseModal';
import { CreateBudgetModal } from './CreateBudgetModal';

const navItems = [
  { to: '/', label: 'Overview', icon: Home, end: true },
  { to: '/budgets', label: 'Budgets', icon: CircleDollarSign },
  { to: '/expenses', label: 'Expenses', icon: ReceiptText },
];

function initials(name?: string) {
  return (name ?? 'Guest')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export function AppShell() {
  const { logout } = useAuth();
  const dashboard = useDashboard();
  const profile = dashboard.data?.dashboard.profile;
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [preferredBudgetId, setPreferredBudgetId] = useState<string>();

  const openExpense = (budgetId?: string) => {
    setPreferredBudgetId(budgetId);
    setExpenseOpen(true);
  };

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <NavLink className="brand" to="/" aria-label="Pockets & Paths home">
          <span className="brand__mark" aria-hidden="true">
            <WalletCards size={20} strokeWidth={2.2} />
          </span>
          <span>
            Pockets <i>&</i> Paths
          </span>
        </NavLink>
        <nav className="side-nav">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `side-nav__item${isActive ? ' side-nav__item--active' : ''}`
              }
            >
              <Icon size={19} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar__bottom">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `side-nav__item${isActive ? ' side-nav__item--active' : ''}`
            }
          >
            <Settings size={19} />
            Settings
          </NavLink>
          <div className="profile-row">
            <div className="profile-chip">
              <span className="profile-chip__avatar">{initials(profile?.displayName)}</span>
              <span>
                <strong>{profile?.displayName ?? 'Loading…'}</strong>
                <small>{profile?.baseCurrency ?? '—'} profile</small>
              </span>
            </div>
            <button
              className="profile-logout"
              type="button"
              aria-label="Sign out"
              title="Sign out"
              onClick={() => void logout().catch(() => undefined)}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <Outlet
          context={
            { openExpense, openBudget: () => setBudgetOpen(true) } satisfies AppOutletContext
          }
        />
      </main>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navItems.slice(0, 2).map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => (isActive ? 'mobile-nav__active' : '')}
          >
            <Icon size={20} />
            {label === 'Overview' ? 'Home' : label}
          </NavLink>
        ))}
        <button type="button" aria-label="Add expense" onClick={() => openExpense()}>
          <Plus size={24} />
        </button>
        <NavLink
          to="/expenses"
          className={({ isActive }) => (isActive ? 'mobile-nav__active' : '')}
        >
          <ReceiptText size={20} />
          Expenses
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) => (isActive ? 'mobile-nav__active' : '')}
        >
          <Settings size={20} />
          Settings
        </NavLink>
      </nav>

      {expenseOpen && (
        <AddExpenseModal
          open
          onClose={() => setExpenseOpen(false)}
          preferredBudgetId={preferredBudgetId}
        />
      )}
      {budgetOpen && <CreateBudgetModal open onClose={() => setBudgetOpen(false)} />}
    </div>
  );
}
