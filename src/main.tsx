import { lazy, StrictMode, Suspense, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from './components/AppShell';
import { AuthGate } from './components/AuthGate';
import { LoadingState } from './components/AsyncState';
import { Dashboard } from './routes/Dashboard';
import { NotFoundPage } from './routes/NotFound';
import { RouteErrorPage } from './routes/RouteError';
import './styles/globals.scss';

const BudgetsPage = lazy(() =>
  import('./routes/Budgets').then((module) => ({ default: module.BudgetsPage })),
);
const BudgetDetailPage = lazy(() =>
  import('./routes/BudgetDetail').then((module) => ({ default: module.BudgetDetailPage })),
);
const ExpensesPage = lazy(() =>
  import('./routes/Expenses').then((module) => ({ default: module.ExpensesPage })),
);
const SettingsPage = lazy(() =>
  import('./routes/Settings').then((module) => ({ default: module.SettingsPage })),
);

function deferred(element: ReactNode) {
  return <Suspense fallback={<LoadingState />}>{element}</Suspense>;
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'budgets', element: deferred(<BudgetsPage />) },
      { path: 'budgets/:budgetId', element: deferred(<BudgetDetailPage />) },
      { path: 'expenses', element: deferred(<ExpensesPage />) },
      { path: 'settings', element: deferred(<SettingsPage />) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthGate>
        <RouterProvider router={router} />
      </AuthGate>
    </QueryClientProvider>
  </StrictMode>,
);
