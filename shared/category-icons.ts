export const categoryIconKeys = [
  'receipt',
  'food',
  'home',
  'utilities',
  'transport',
  'travel',
  'shopping',
  'health',
  'entertainment',
  'experiences',
  'work',
  'education',
  'pets',
] as const;

export type CategoryIconKey = (typeof categoryIconKeys)[number];

export const defaultCategoryIcon: CategoryIconKey = 'receipt';

export function isCategoryIconKey(value: string): value is CategoryIconKey {
  return categoryIconKeys.some((icon) => icon === value);
}

export function suggestCategoryIcon(name: string): CategoryIconKey {
  const normalizedName = name.toLowerCase();
  const suggestions: { terms: string[]; icon: CategoryIconKey }[] = [
    { terms: ['food', 'grocery', 'groceries', 'dining', 'restaurant', 'coffee'], icon: 'food' },
    { terms: ['home', 'housing', 'rent', 'stay', 'hotel'], icon: 'home' },
    { terms: ['utilities', 'bills', 'electricity', 'internet'], icon: 'utilities' },
    { terms: ['transport', 'train', 'bus', 'taxi', 'fuel'], icon: 'transport' },
    { terms: ['travel', 'trip', 'flight', 'holiday'], icon: 'travel' },
    { terms: ['shop', 'clothes', 'gifts'], icon: 'shopping' },
    { terms: ['health', 'medical', 'fitness'], icon: 'health' },
    { terms: ['leisure', 'fun', 'games', 'movies'], icon: 'entertainment' },
    { terms: ['experience', 'activity', 'event'], icon: 'experiences' },
    { terms: ['work', 'business', 'office'], icon: 'work' },
    { terms: ['education', 'school', 'course', 'books'], icon: 'education' },
    { terms: ['pet', 'dog', 'cat'], icon: 'pets' },
  ];

  return (
    suggestions.find(({ terms }) => terms.some((term) => normalizedName.includes(term)))?.icon ??
    defaultCategoryIcon
  );
}
