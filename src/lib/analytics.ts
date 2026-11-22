// Pure functions that turn raw transactions into everything the UI shows.
// No UI code here, so each piece is unit-testable.
import { getCategory, isTransfer } from './categories';
import { addDays, addMonths, dayOfMonth, daysBetween, daysInMonth, fmt, monthKey, startOfMonth } from './dates';
import type { Account, Budget, Cents, Goal, Transaction } from './types';

export function accountBalances(accounts: Account[], txns: Transaction[]) {
  const out: Record<string, Cents> = Object.fromEntries(accounts.map((a) => [a.id, a.openingBalance]));
  for (const t of txns) if (t.accountId in out) out[t.accountId] += t.amount;
  return out;
}

export function netWorth(accounts: Account[], txns: Transaction[]) {
  return Object.values(accountBalances(accounts, txns)).reduce((s, v) => s + v, 0);
}

export interface Point {
  date: string;
  value: number;
}

/** Daily net worth from `from` to `to` (inclusive). */
export function netWorthSeries(accounts: Account[], txns: Transaction[], from: string, to: string): Point[] {
  const ids = new Set(accounts.map((a) => a.id));
  let running = accounts.reduce((s, a) => s + a.openingBalance, 0);
  const byDay = new Map<string, number>();
  for (const t of txns) {
    if (!ids.has(t.accountId)) continue;
    if (t.date < from) running += t.amount;
    else if (t.date <= to) byDay.set(t.date, (byDay.get(t.date) ?? 0) + t.amount);
  }
  const out: Point[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    running += byDay.get(d) ?? 0;
    out.push({ date: d, value: running });
  }
  return out;
}

export function isIncome(t: Transaction) {
  return !isTransfer(t.categoryId) && getCategory(t.categoryId).group === 'income';
}

export function isSpending(t: Transaction) {
  return !isTransfer(t.categoryId) && getCategory(t.categoryId).group !== 'income';
}

export interface MonthFlow {
  month: string; // YYYY-MM
  income: Cents;
  spending: Cents; // positive number
  net: Cents;
}

export function monthlyCashflow(txns: Transaction[], endMonthDate: string, months: number): MonthFlow[] {
  const keys = Array.from({ length: months }, (_, i) => monthKey(addMonths(startOfMonth(endMonthDate), i - months + 1)));
  const map = new Map(keys.map((k) => [k, { month: k, income: 0, spending: 0, net: 0 }]));
  for (const t of txns) {
    const row = map.get(monthKey(t.date));
    if (!row) continue;
    if (isIncome(t)) row.income += t.amount;
    else if (isSpending(t)) row.spending += -t.amount;
  }
  for (const r of map.values()) r.net = r.income - r.spending;
  return keys.map((k) => map.get(k)!);
}

export function spendingByCategory(txns: Transaction[], from: string, to: string) {
  const totals = new Map<string, Cents>();
  for (const t of txns) {
    if (t.date < from || t.date > to || !isSpending(t)) continue;
    totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) - t.amount);
  }
  return [...totals.entries()]
    .filter(([, v]) => v > 0)
    .map(([categoryId, total]) => ({ categoryId, total }))
    .sort((a, b) => b.total - a.total);
}

export function sumSpending(txns: Transaction[], from: string, to: string) {
  let s = 0;
  for (const t of txns) if (t.date >= from && t.date <= to && isSpending(t)) s -= t.amount;
  return s;
}

// ---------- Budgets ----------

export type BudgetState = 'ok' | 'watch' | 'over';

export interface BudgetStatus {
  categoryId: string;
  limit: Cents;
  spent: Cents;
  projected: Cents;
  remaining: Cents;
  pct: number;
  state: BudgetState;
  dailyAllowance: Cents; // what can still be spent per remaining day
}

export function budgetStatus(budgets: Budget[], txns: Transaction[], asOf: string, recurring: Recurring[] = []): BudgetStatus[] {
  const from = startOfMonth(asOf);
  const dim = daysInMonth(asOf);
  const dom = dayOfMonth(asOf);
  const daysLeft = dim - dom + 1;
  const monthEnd = addDays(from, dim - 1);
  const fixedKeys = new Set(recurring.map((r) => r.key));

  // Split this month's spend into fixed (known recurring bills) and variable.
  const spent = new Map<string, { fixed: number; variable: number }>();
  for (const t of txns) {
    if (t.date < from || t.date > asOf || !isSpending(t)) continue;
    const row = spent.get(t.categoryId) ?? { fixed: 0, variable: 0 };
    if (fixedKeys.has(normalizeMerchant(t.merchant))) row.fixed -= t.amount;
    else row.variable -= t.amount;
    spent.set(t.categoryId, row);
  }
  // Bills still due before the month ends.
  const dueLater = new Map<string, number>();
  for (const r of recurring) if (r.nextDate > asOf && r.nextDate <= monthEnd) dueLater.set(r.categoryId, (dueLater.get(r.categoryId) ?? 0) + r.amount);

  return budgets.map((b) => {
    const row = spent.get(b.categoryId) ?? { fixed: 0, variable: 0 };
    const s = row.fixed + row.variable;
    // Variable spend continues at its current daily pace; fixed bills are added as scheduled.
    const projected = Math.round(s + (row.variable / dom) * (dim - dom) + (dueLater.get(b.categoryId) ?? 0));
    const pct = b.amount ? (s / b.amount) * 100 : 0;
    const state: BudgetState = s > b.amount ? 'over' : projected > b.amount || (row.variable > 0 && pct >= 90) ? 'watch' : 'ok';
    return {
      categoryId: b.categoryId,
      limit: b.amount,
      spent: s,
      projected,
      remaining: b.amount - s,
      pct,
      state,
      dailyAllowance: Math.max(0, Math.floor((b.amount - s - (dueLater.get(b.categoryId) ?? 0)) / daysLeft)),
    };
  });
}

// ---------- Recurring detection ----------

export type Cadence = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

export interface Recurring {
  key: string;
  merchant: string;
  categoryId: string;
  accountId: string;
  amount: Cents; // typical charge, positive
  cadence: Cadence;
  intervalDays: number;
  lastDate: string;
  nextDate: string;
  count: number;
  monthlyCost: Cents;
  varies: boolean;
}

const CADENCES: { cadence: Cadence; days: number; tol: number }[] = [
  { cadence: 'weekly', days: 7, tol: 1 },
  { cadence: 'biweekly', days: 14, tol: 2 },
  { cadence: 'monthly', days: 30.4, tol: 4 },
  { cadence: 'quarterly', days: 91, tol: 8 },
  { cadence: 'yearly', days: 365, tol: 15 },
];

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function normalizeMerchant(m: string) {
  return m.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

/** Finds charges that repeat on a steady schedule with a steady amount. */
export function detectRecurring(txns: Transaction[], asOf: string): Recurring[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of txns) {
    if (t.amount >= 0 || isTransfer(t.categoryId)) continue;
    const k = normalizeMerchant(t.merchant);
    const g = groups.get(k);
    if (g) g.push(t);
    else groups.set(k, [t]);
  }

  const out: Recurring[] = [];
  for (const [key, list] of groups) {
    if (list.length < 3) continue;
    const sorted = [...list].sort((a, b) => (a.date < b.date ? -1 : 1));
    const gaps = sorted.slice(1).map((t, i) => daysBetween(sorted[i].date, t.date));
    const med = median(gaps);
    const match = CADENCES.find((c) => Math.abs(med - c.days) <= c.tol);
    if (!match) continue;
    const regular = gaps.filter((g) => Math.abs(g - match.days) <= match.tol + 1).length / gaps.length;
    if (regular < 0.75) continue;

    const amounts = sorted.map((t) => -t.amount);
    const mean = amounts.reduce((s, v) => s + v, 0) / amounts.length;
    const sd = Math.sqrt(amounts.reduce((s, v) => s + (v - mean) ** 2, 0) / amounts.length);
    const cv = sd / mean;
    if (cv > 0.35) continue;

    const last = sorted[sorted.length - 1];
    // Stopped: no charge for well over two cycles.
    if (daysBetween(last.date, asOf) > match.days * 2 + match.tol) continue;

    let next = match.cadence === 'monthly' ? addMonths(last.date, 1) : addDays(last.date, Math.round(match.days));
    while (next < asOf) next = match.cadence === 'monthly' ? addMonths(next, 1) : addDays(next, Math.round(match.days));

    const typical = Math.round(cv < 0.02 ? last.amount * -1 : median(amounts.slice(-4)));
    out.push({
      key,
      merchant: last.merchant,
      categoryId: last.categoryId,
      accountId: last.accountId,
      amount: typical,
      cadence: match.cadence,
      intervalDays: Math.round(match.days),
      lastDate: last.date,
      nextDate: next,
      count: sorted.length,
      monthlyCost: Math.round((typical * 30.4) / match.days),
      varies: cv >= 0.02,
    });
  }
  return out.sort((a, b) => (a.nextDate < b.nextDate ? -1 : 1));
}

export function upcoming(recurring: Recurring[], from: string, days: number) {
  const until = addDays(from, days);
  return recurring.filter((r) => r.nextDate >= from && r.nextDate <= until);
}

// ---------- Goals ----------

export interface GoalProjection {
  pct: number;
  remaining: Cents;
  monthlyAvg: Cents;
  etaDate: string | null;
  neededPerMonth: Cents | null;
  onTrack: boolean | null;
}

export function goalProjection(goal: Goal, asOf: string): GoalProjection {
  const remaining = Math.max(0, goal.target - goal.saved);
  const recent = goal.contributions.filter((c) => daysBetween(c.date, asOf) <= 92);
  const monthlyAvg = recent.length ? Math.round(recent.reduce((s, c) => s + c.amount, 0) / 3) : 0;
  const etaDate = remaining === 0 ? asOf : monthlyAvg > 0 ? addMonths(asOf, Math.ceil(remaining / monthlyAvg)) : null;
  let neededPerMonth: Cents | null = null;
  let onTrack: boolean | null = null;
  if (goal.deadline) {
    const monthsLeft = Math.max(1, Math.round(daysBetween(asOf, goal.deadline) / 30.4));
    neededPerMonth = Math.ceil(remaining / monthsLeft);
    onTrack = remaining === 0 || (etaDate !== null && etaDate <= goal.deadline);
  }
  return { pct: goal.target ? Math.min(100, (goal.saved / goal.target) * 100) : 0, remaining, monthlyAvg, etaDate, neededPerMonth, onTrack };
}

// ---------- Insights ----------

export interface Insight {
  id: string;
  tone: 'good' | 'warn' | 'info';
  title: string;
  body: string;
  to?: string;
}

type Fmt = (c: Cents) => string;

export function buildInsights(txns: Transaction[], budgets: Budget[], recurring: Recurring[], asOf: string, money: Fmt): Insight[] {
  const out: Insight[] = [];
  const dom = dayOfMonth(asOf);
  const thisFrom = startOfMonth(asOf);
  const prevFrom = addMonths(thisFrom, -1);
  const prevSame = addDays(prevFrom, Math.min(dom, daysInMonth(prevFrom)) - 1);

  const nowSpend = sumSpending(txns, thisFrom, asOf);
  const prevSpend = sumSpending(txns, prevFrom, prevSame);
  if (prevSpend > 0) {
    const diff = ((nowSpend - prevSpend) / prevSpend) * 100;
    const less = diff < 0;
    out.push({
      id: 'pace',
      tone: less ? 'good' : diff > 10 ? 'warn' : 'info',
      title: less ? `Spending is down ${Math.abs(diff).toFixed(0)}%` : `Spending is up ${diff.toFixed(0)}%`,
      body: `${money(nowSpend)} so far in ${fmt.monthShort(asOf)}, against ${money(prevSpend)} by this day in ${fmt.monthShort(prevFrom)}.`,
      to: '/transactions',
    });
  }

  // Biggest category mover, month to date vs the same days last month.
  const now = new Map(spendingByCategory(txns, thisFrom, asOf).map((r) => [r.categoryId, r.total]));
  const prev = new Map(spendingByCategory(txns, prevFrom, prevSame).map((r) => [r.categoryId, r.total]));
  let mover: { id: string; delta: number } | null = null;
  for (const id of new Set([...now.keys(), ...prev.keys()])) {
    if (id === 'rent') continue;
    const delta = (now.get(id) ?? 0) - (prev.get(id) ?? 0);
    if (!mover || Math.abs(delta) > Math.abs(mover.delta)) mover = { id, delta };
  }
  if (mover && Math.abs(mover.delta) >= 5000) {
    const name = getCategory(mover.id).name;
    out.push({
      id: 'mover',
      tone: mover.delta > 0 ? 'warn' : 'good',
      title: `${name} ${mover.delta > 0 ? 'up' : 'down'} ${money(Math.abs(mover.delta))}`,
      body: `Compared with the same days last month. ${mover.delta > 0 ? 'Worth a look before the month closes.' : 'Nice restraint.'}`,
      to: `/transactions?category=${mover.id}`,
    });
  }

  const risky = budgetStatus(budgets, txns, asOf, recurring)
    .filter((b) => b.state !== 'ok')
    .sort((a, b) => b.projected - b.limit - (a.projected - a.limit))[0];
  if (risky) {
    const name = getCategory(risky.categoryId).name;
    out.push({
      id: 'budget',
      tone: 'warn',
      title: risky.state === 'over' ? `${name} is over budget` : `${name} is running hot`,
      body:
        risky.state === 'over'
          ? `${money(risky.spent - risky.limit)} past the ${money(risky.limit)} limit.`
          : `On pace for ${money(risky.projected)} against a ${money(risky.limit)} budget. About ${money(risky.dailyAllowance)} a day keeps it on track.`,
      to: '/budgets',
    });
  }

  const last = monthlyCashflow(txns, addMonths(thisFrom, -1), 1)[0];
  if (last && last.income > 0) {
    const rate = (last.net / last.income) * 100;
    out.push({
      id: 'savings',
      tone: rate >= 20 ? 'good' : rate >= 0 ? 'info' : 'warn',
      title: `You kept ${rate.toFixed(0)}% of ${fmt.monthShort(last.month)} income`,
      body: `${money(last.income)} in, ${money(last.spending)} out. ${rate >= 20 ? 'Above the 20% rule of thumb.' : 'The usual target is 20%.'}`,
      to: '/',
    });
  }

  const subs = recurring.filter((r) => r.categoryId === 'subscriptions' || r.categoryId === 'fitness');
  if (subs.length) {
    const monthly = subs.reduce((s, r) => s + r.monthlyCost, 0);
    out.push({
      id: 'subs',
      tone: 'info',
      title: `${subs.length} subscriptions, ${money(monthly)} a month`,
      body: `That is ${money(monthly * 12)} a year. Review what you still use.`,
      to: '/recurring',
    });
  }

  return out;
}
