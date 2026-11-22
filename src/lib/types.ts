// All money is stored as integer cents to avoid floating-point drift.
export type Cents = number;

export type AccountType = 'checking' | 'savings' | 'credit' | 'investment';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  institution: string;
  last4: string;
  openingBalance: Cents; // balance on the day before the first transaction
  color: string;
}

export type CategoryGroup = 'income' | 'essentials' | 'lifestyle' | 'transfer';

export interface Category {
  id: string;
  name: string;
  group: CategoryGroup;
  icon: string; // lucide icon key, see components/CategoryIcon
  color: string;
}

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD, local calendar date
  amount: Cents; // negative = money out, positive = money in
  merchant: string;
  categoryId: string;
  accountId: string;
  note?: string;
}

export interface Budget {
  categoryId: string;
  amount: Cents; // monthly limit
}

export interface Goal {
  id: string;
  name: string;
  target: Cents;
  saved: Cents;
  deadline?: string; // YYYY-MM-DD
  icon: string;
  color: string;
  createdAt: string;
  contributions: { date: string; amount: Cents }[];
}

export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD';
export type ThemePref = 'system' | 'dark' | 'light';

export interface Settings {
  name: string;
  currency: CurrencyCode;
  theme: ThemePref;
  hideAmounts: boolean;
}
