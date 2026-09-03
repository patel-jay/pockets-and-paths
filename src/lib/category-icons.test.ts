import { describe, expect, it } from 'vitest';
import { suggestCategoryIcon } from '../../shared/category-icons';
import { defaultCategoryAppearances } from '../../shared/category-presets';

describe('suggestCategoryIcon', () => {
  it('suggests useful icons for common category names', () => {
    expect(suggestCategoryIcon('Groceries')).toBe('food');
    expect(suggestCategoryIcon('Monthly electricity')).toBe('utilities');
    expect(suggestCategoryIcon('Airport taxi')).toBe('transport');
    expect(suggestCategoryIcon('Pet care')).toBe('pets');
  });

  it('falls back to the general receipt icon', () => {
    expect(suggestCategoryIcon('Something personal')).toBe('receipt');
  });
});

describe('defaultCategoryAppearances', () => {
  it('uses one consistent, distinct color for each default category', () => {
    const appearances = Object.values(defaultCategoryAppearances);
    const colors = appearances.map((appearance) => appearance.color);

    expect(new Set(colors).size).toBe(colors.length);
    expect(defaultCategoryAppearances.Food.icon).toBe('food');
    expect(defaultCategoryAppearances.Transport.icon).toBe('transport');
  });
});
