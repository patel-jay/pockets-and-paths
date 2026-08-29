import { Plus } from 'lucide-react';
import { useAppActions } from '../lib/app-actions';

type Props = {
  eyebrow: string;
  title: string;
  copy?: string;
  action?: 'expense' | 'budget';
  actionLabel?: string;
};

export function PageHeader({ eyebrow, title, copy, action, actionLabel }: Props) {
  const { openExpense, openBudget } = useAppActions();
  return (
    <header className="topbar page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {copy && <p className="page-header__copy">{copy}</p>}
      </div>
      {action && (
        <button
          className="primary-button"
          type="button"
          onClick={() => (action === 'expense' ? openExpense() : openBudget())}
        >
          <Plus size={18} />
          {actionLabel ?? (action === 'expense' ? 'Add expense' : 'New budget')}
        </button>
      )}
    </header>
  );
}
