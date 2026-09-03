ALTER TABLE categories
ADD COLUMN icon_key TEXT NOT NULL DEFAULT 'receipt'
CHECK (
  icon_key IN (
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
    'pets'
  )
);
