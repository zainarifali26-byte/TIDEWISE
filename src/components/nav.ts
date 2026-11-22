import { CalendarClock, LayoutDashboard, PiggyBank, ReceiptText, Settings, Target, Wallet, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  key?: string; // "G then <key>" shortcut
}

export const NAV: NavItem[] = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, key: 'o' },
  { to: '/transactions', label: 'Transactions', icon: ReceiptText, key: 't' },
  { to: '/budgets', label: 'Budgets', icon: PiggyBank, key: 'b' },
  { to: '/goals', label: 'Goals', icon: Target, key: 'g' },
  { to: '/recurring', label: 'Bills & subscriptions', icon: CalendarClock, key: 'r' },
  { to: '/accounts', label: 'Accounts', icon: Wallet, key: 'a' },
  { to: '/settings', label: 'Settings', icon: Settings, key: 's' },
];
