import { describe, expect, it } from 'vitest';
import { accountBalances, budgetStatus, detectRecurring, goalProjection, monthlyCashflow, netWorthSeries } from './analytics';
import { importCSV, parseCSV, toCSV } from './csv';
import { addMonths } from './dates';
import { parseMoney } from './money';
import { generateDemo } from './seed';
import type { Transaction } from './types';

const END = '2026-11-22';
const demo = generateDemo(END);

describe('demo data', () => {
  it('ends on the given day and spans about 13 months', () => {
    expect(demo.transactions[0].date <= END).toBe(true);
    expect(demo.transactions.at(-1)!.date.startsWith('2025-10')).toBe(true);
    expect(demo.transactions.length).toBeGreaterThan(600);
  });

  it('keeps the checking account solvent', () => {
    const series = netWorthSeries(demo.accounts.filter((a) => a.id === 'chk'), demo.transactions, '2025-10-01', END);
    expect(Math.min(...series.map((p) => p.value))).toBeGreaterThan(0);
  });

  it('net worth series ends at the summed balances', () => {
    const series = netWorthSeries(demo.accounts, demo.transactions, '2026-01-01', END);
    const total = Object.values(accountBalances(demo.accounts, demo.transactions)).reduce((s, v) => s + v, 0);
    expect(series.at(-1)!.value).toBe(total);
  });
});

describe('cashflow', () => {
  it('ignores transfers between own accounts', () => {
    const txns: Transaction[] = [
      { id: '1', date: '2026-05-02', amount: 100000, merchant: 'Pay', categoryId: 'salary', accountId: 'a' },
      { id: '2', date: '2026-05-03', amount: -20000, merchant: 'To savings', categoryId: 'transfer', accountId: 'a' },
      { id: '3', date: '2026-05-04', amount: -3000, merchant: 'Cafe', categoryId: 'dining', accountId: 'a' },
    ];
    const [m] = monthlyCashflow(txns, '2026-05-30', 1);
    expect(m).toEqual({ month: '2026-05', income: 100000, spending: 3000, net: 97000 });
  });
});

describe('recurring detection', () => {
  const found = detectRecurring(demo.transactions, END);
  const names = found.map((r) => r.merchant);

  it('finds fixed monthly bills and subscriptions', () => {
    for (const m of ['Netflix', 'Spotify', 'Mission Bay Residences', 'Equinox Membership', 'PG&E']) expect(names).toContain(m);
  });

  it('does not flag random everyday merchants', () => {
    expect(names).not.toContain('Uber');
    expect(names).not.toContain('Souvla');
  });

  it('projects the next charge in the future', () => {
    for (const r of found) expect(r.nextDate >= END).toBe(true);
  });
});

describe('budgets', () => {
  it('projects pace and flags overspend', () => {
    const txns: Transaction[] = [{ id: '1', date: '2026-11-10', amount: -30000, merchant: 'X', categoryId: 'dining', accountId: 'a' }];
    const [b] = budgetStatus([{ categoryId: 'dining', amount: 50000 }], txns, '2026-11-10');
    expect(b.spent).toBe(30000);
    expect(b.projected).toBe(90000);
    expect(b.state).toBe('watch');
  });

  it('adds fixed bills as scheduled instead of extrapolating them', () => {
    const txns: Transaction[] = [1, 2, 3].map((m) => ({ id: String(m), date: `2026-${String(8 + m).padStart(2, '0')}-05`, amount: -24500, merchant: 'Gym', categoryId: 'fitness', accountId: 'a' }));
    const rec = detectRecurring(txns, '2026-11-10');
    const [b] = budgetStatus([{ categoryId: 'fitness', amount: 26000 }], txns, '2026-11-10', rec);
    expect(b.projected).toBe(24500);
    expect(b.state).toBe('ok');
  });
});

describe('goals', () => {
  it('estimates an arrival date from recent contributions', () => {
    const p = goalProjection(
      { id: 'g', name: 'Trip', target: 100000, saved: 40000, icon: 'plane', color: '#fff', createdAt: '2026-01-01', deadline: addMonths(END, 12), contributions: [
        { date: '2026-09-01', amount: 10000 }, { date: '2026-10-01', amount: 10000 }, { date: '2026-11-01', amount: 10000 },
      ] },
      END,
    );
    expect(p.monthlyAvg).toBe(10000);
    expect(p.etaDate).toBe(addMonths(END, 6));
    expect(p.onTrack).toBe(true);
  });
});

describe('csv', () => {
  it('round-trips quotes, commas and formula-looking text safely', () => {
    const txns: Transaction[] = [{ id: '1', date: '2026-11-01', amount: -1234, merchant: 'Say "hi", Inc', categoryId: 'dining', accountId: 'chk', note: '=SUM(A1)' }];
    const csv = toCSV(txns, demo.accounts);
    const rows = parseCSV(csv);
    expect(rows[1][1]).toBe('Say "hi", Inc');
    expect(rows[1][5]).toBe("'=SUM(A1)");
  });

  it('imports debit/credit bank exports', () => {
    const csv = 'Posted Date,Description,Debit,Credit\n11/03/2026,Blue Bottle Coffee,6.50,\n11/04/2026,Refund,,(12.00)';
    const r = importCSV(csv, 'chk', () => 'dining');
    expect(r.transactions[0]).toMatchObject({ date: '2026-11-03', amount: -650, categoryId: 'dining' });
    expect(r.transactions[1].amount).toBe(1200);
  });

  it('parses money input', () => {
    expect(parseMoney('1,234.50')).toBe(123450);
    expect(parseMoney('$-12')).toBe(-1200);
    expect(parseMoney('abc')).toBeNull();
  });
});
