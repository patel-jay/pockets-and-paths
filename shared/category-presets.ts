import type { CategoryIconKey } from './category-icons';

type CategoryAppearance = {
  color: string;
  icon: CategoryIconKey;
};

export const defaultCategoryAppearances = {
  Food: { color: '#2e7064', icon: 'food' },
  Housing: { color: '#6382a8', icon: 'home' },
  Utilities: { color: '#d1a64c', icon: 'utilities' },
  Leisure: { color: '#e8795d', icon: 'entertainment' },
  Transport: { color: '#7c5fb3', icon: 'transport' },
  Stay: { color: '#b56a86', icon: 'home' },
  Experiences: { color: '#3f8f8c', icon: 'experiences' },
} satisfies Record<string, CategoryAppearance>;

export type DefaultCategoryName = keyof typeof defaultCategoryAppearances;

export const monthlyDefaultCategoryNames = [
  'Food',
  'Housing',
  'Transport',
  'Leisure',
] as const satisfies readonly DefaultCategoryName[];

export const temporaryDefaultCategoryNames = [
  'Transport',
  'Stay',
  'Food',
  'Experiences',
] as const satisfies readonly DefaultCategoryName[];
