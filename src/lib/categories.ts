import type { Category } from './types';

export const CATEGORIES: Category[] = [
  { id: 'salary', name: 'Salary', group: 'income', icon: 'briefcase', color: '#3ddc97' },
  { id: 'freelance', name: 'Freelance', group: 'income', icon: 'laptop', color: '#5eead4' },
  { id: 'interest', name: 'Interest', group: 'income', icon: 'percent', color: '#a3e635' },
  { id: 'refund', name: 'Refunds', group: 'income', icon: 'rotate', color: '#86efac' },

  { id: 'rent', name: 'Rent', group: 'essentials', icon: 'home', color: '#818cf8' },
  { id: 'groceries', name: 'Groceries', group: 'essentials', icon: 'cart', color: '#34d399' },
  { id: 'utilities', name: 'Bills & utilities', group: 'essentials', icon: 'zap', color: '#fbbf24' },
  { id: 'transport', name: 'Transport', group: 'essentials', icon: 'train', color: '#38bdf8' },
  { id: 'health', name: 'Health', group: 'essentials', icon: 'heart', color: '#f472b6' },
  { id: 'insurance', name: 'Insurance', group: 'essentials', icon: 'shield', color: '#a78bfa' },

  { id: 'dining', name: 'Dining & coffee', group: 'lifestyle', icon: 'utensils', color: '#fb923c' },
  { id: 'shopping', name: 'Shopping', group: 'lifestyle', icon: 'bag', color: '#f87171' },
  { id: 'subscriptions', name: 'Subscriptions', group: 'lifestyle', icon: 'repeat', color: '#c084fc' },
  { id: 'entertainment', name: 'Entertainment', group: 'lifestyle', icon: 'ticket', color: '#e879f9' },
  { id: 'fitness', name: 'Fitness', group: 'lifestyle', icon: 'dumbbell', color: '#2dd4bf' },
  { id: 'travel', name: 'Travel', group: 'lifestyle', icon: 'plane', color: '#60a5fa' },
  { id: 'personal', name: 'Personal care', group: 'lifestyle', icon: 'sparkles', color: '#fda4af' },
  { id: 'gifts', name: 'Gifts & giving', group: 'lifestyle', icon: 'gift', color: '#facc15' },

  { id: 'transfer', name: 'Transfer', group: 'transfer', icon: 'arrows', color: '#94a3b8' },
  { id: 'card-payment', name: 'Card payment', group: 'transfer', icon: 'card', color: '#94a3b8' },
  { id: 'market', name: 'Market change', group: 'transfer', icon: 'trend', color: '#94a3b8' },
];

const byId = new Map(CATEGORIES.map((c) => [c.id, c]));

export function getCategory(id: string): Category {
  return byId.get(id) ?? { id, name: 'Uncategorized', group: 'lifestyle', icon: 'circle', color: '#94a3b8' };
}

export const SPENDING_CATEGORIES = CATEGORIES.filter((c) => c.group === 'essentials' || c.group === 'lifestyle');

/** Transfers move money between your own accounts: they are neither income nor spending. */
export function isTransfer(categoryId: string) {
  return getCategory(categoryId).group === 'transfer';
}
