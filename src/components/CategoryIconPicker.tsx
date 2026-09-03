import type { CategoryIconKey } from '../../shared/category-icons';
import { CategoryIcon } from './CategoryIcon';

const categoryIconOptions: { key: CategoryIconKey; label: string }[] = [
  { key: 'receipt', label: 'General' },
  { key: 'food', label: 'Food' },
  { key: 'home', label: 'Home and stay' },
  { key: 'utilities', label: 'Utilities' },
  { key: 'transport', label: 'Ground transport' },
  { key: 'travel', label: 'Travel' },
  { key: 'shopping', label: 'Shopping' },
  { key: 'health', label: 'Health' },
  { key: 'entertainment', label: 'Entertainment' },
  { key: 'experiences', label: 'Experiences' },
  { key: 'work', label: 'Work' },
  { key: 'education', label: 'Education' },
  { key: 'pets', label: 'Pets' },
];

type Props = {
  name: string;
  value: CategoryIconKey;
  onChange: (icon: CategoryIconKey) => void;
};

export function CategoryIconPicker({ name, value, onChange }: Props) {
  const selectedLabel = categoryIconOptions.find((option) => option.key === value)?.label;

  return (
    <fieldset className="category-icon-picker">
      <legend>
        Icon <span>· {selectedLabel}</span>
      </legend>
      <div>
        {categoryIconOptions.map((option) => (
          <label
            className={option.key === value ? 'category-icon-option--selected' : ''}
            key={option.key}
            title={option.label}
          >
            <input
              type="radio"
              name={name}
              value={option.key}
              checked={option.key === value}
              onChange={() => onChange(option.key)}
              aria-label={option.label}
            />
            <CategoryIcon icon={option.key} size={18} />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
