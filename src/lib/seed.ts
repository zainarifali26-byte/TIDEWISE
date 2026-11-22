// Generates ~13 months of realistic demo activity for a San Francisco
// professional, ending today. Deterministic for a given start date, so the
// demo is stable and every number on screen is derived, not hard-coded.
import { addDays, addMonths, dayOfMonth, daysInMonth, fromISO, startOfMonth, toISO } from './dates';
import type { Account, Budget, Cents, Goal, Transaction } from './types';

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DEMO_ACCOUNTS: Account[] = [
  { id: 'chk', name: 'Everyday Checking', type: 'checking', institution: 'Harbor Bank', last4: '4821', openingBalance: 624000, color: '#3ddc97' },
  { id: 'sav', name: 'High-Yield Savings', type: 'savings', institution: 'Harbor Bank', last4: '9930', openingBalance: 1850000, color: '#38bdf8' },
  { id: 'cc', name: 'Summit Rewards Card', type: 'credit', institution: 'Atlas Card', last4: '1157', openingBalance: -124000, color: '#f87171' },
  { id: 'inv', name: 'Brokerage', type: 'investment', institution: 'Meridian Invest', last4: '3304', openingBalance: 4280000, color: '#a78bfa' },
];

export const DEMO_BUDGETS: Budget[] = [
  { categoryId: 'groceries', amount: 85000 },
  { categoryId: 'dining', amount: 60000 },
  { categoryId: 'shopping', amount: 40000 },
  { categoryId: 'utilities', amount: 30000 },
  { categoryId: 'transport', amount: 18000 },
  { categoryId: 'subscriptions', amount: 12000 },
  { categoryId: 'entertainment', amount: 15000 },
  { categoryId: 'fitness', amount: 26000 },
  { categoryId: 'personal', amount: 8000 },
  { categoryId: 'health', amount: 10000 },
];

export interface SeedResult {
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
}

export function generateDemo(end: string): SeedResult {
  const rand = mulberry32(20261122);
  const between = (min: number, max: number) => min + rand() * (max - min);
  const cents = (min: number, max: number): Cents => Math.round(between(min, max) * 100);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const chance = (p: number) => rand() < p;

  const start = startOfMonth(addMonths(end, -13));
  const txns: Transaction[] = [];
  let seq = 0;
  const add = (date: string, amount: Cents, merchant: string, categoryId: string, accountId: string, note?: string) => {
    txns.push({ id: `d${(seq++).toString(36)}`, date, amount, merchant, categoryId, accountId, ...(note ? { note } : {}) });
  };

  // Running balances, needed for card payments and market moves.
  const bal: Record<string, Cents> = Object.fromEntries(DEMO_ACCOUNTS.map((a) => [a.id, a.openingBalance]));
  const post = (date: string, amount: Cents, merchant: string, categoryId: string, accountId: string, note?: string) => {
    bal[accountId] += amount;
    add(date, amount, merchant, categoryId, accountId, note);
  };

  // First payday: the first Friday on or after the start.
  let payday = start;
  while (fromISO(payday).getDay() !== 5) payday = addDays(payday, 1);
  let nextFreelance = addDays(start, 18);
  const trips = [addMonths(end, -9), addMonths(end, -3)].map(startOfMonth);
  const primeDay = addDays(start, 40);

  for (let d = start; d <= end; d = addDays(d, 1)) {
    const dom = dayOfMonth(d);
    const dow = fromISO(d).getDay();
    const month = fromISO(d).getMonth();
    const monthsIn = (fromISO(d).getFullYear() - fromISO(start).getFullYear()) * 12 + month - fromISO(start).getMonth();

    // Income
    if (d === payday) {
      post(d, monthsIn >= 8 ? 440216 : 421538, 'Northline Labs Payroll', 'salary', 'chk');
      post(d, -60000, 'Transfer to High-Yield Savings', 'transfer', 'chk');
      post(d, 60000, 'Transfer from Everyday Checking', 'transfer', 'sav');
      payday = addDays(payday, 14);
    }
    if (d === nextFreelance) {
      post(d, cents(650, 1850), pick(['Brightline Studio (ACH)', 'Kestrel Health (ACH)', 'Oakmont Coffee Co. (ACH)']), 'freelance', 'chk', 'Design and front-end work');
      nextFreelance = addDays(d, Math.round(between(32, 58)));
    }
    if (dom === daysInMonth(d)) {
      post(d, Math.round(bal.sav * (0.043 / 12)), 'Interest paid', 'interest', 'sav');
      const move = Math.round(bal.inv * between(-0.03, 0.045));
      post(d, move, move >= 0 ? 'Market gain' : 'Market loss', 'market', 'inv');
    }

    // Fixed monthly
    if (dom === 1) post(d, -295000, 'Mission Bay Residences', 'rent', 'chk', 'Monthly rent');
    if (dom === 2) post(d, -1425, 'Lemonade Renters', 'insurance', 'cc');
    if (dom === 3) post(d, -299, 'iCloud+', 'subscriptions', 'cc');
    if (dom === 5) post(d, -24500, 'Equinox Membership', 'fitness', 'cc');
    if (dom === 7) post(d, -1549, 'Netflix', 'subscriptions', 'cc');
    if (dom === 9) post(d, -5999, 'Adobe Creative Cloud', 'subscriptions', 'cc');
    if (dom === 12) post(d, -7900, 'Sonic Internet', 'utilities', 'cc');
    if (dom === 14) post(d, -1199, 'Spotify', 'subscriptions', 'cc');
    if (dom === 15) {
      post(d, -50000, 'Transfer to Brokerage', 'transfer', 'chk');
      post(d, 50000, 'Contribution from Checking', 'transfer', 'inv');
    }
    if (dom === 18) {
      const winter = [10, 11, 0, 1].includes(month);
      post(d, -cents(winter ? 118 : 74, winter ? 162 : 112), 'PG&E', 'utilities', 'cc');
    }
    if (dom === 20) post(d, -1700, 'The New York Times', 'subscriptions', 'cc');
    if (dom === 22) post(d, -4500, 'Visible Wireless', 'utilities', 'cc');
    if (dom === 24) post(d, -cents(42, 58), 'Fellow Barber', 'personal', 'cc');
    if (dom === 25 && bal.cc < 0) {
      const due = -bal.cc;
      post(d, -due, 'Atlas Card Payment', 'card-payment', 'chk');
      post(d, due, 'Payment received, thank you', 'card-payment', 'cc');
    }
    if (d === primeDay) post(d, -13900, 'Amazon Prime', 'subscriptions', 'cc', 'Annual membership');

    // Everyday spending
    if ((dow === 0 || dow === 3) && chance(0.85)) post(d, -cents(38, 168), pick(["Trader Joe's", 'Whole Foods Market', 'Rainbow Grocery', 'Safeway']), 'groceries', 'cc');
    if (chance(dow === 5 || dow === 6 ? 0.8 : 0.45)) {
      const coffee = chance(0.45);
      post(
        d,
        coffee ? -cents(5.5, 14) : -cents(18, 96),
        coffee ? pick(['Blue Bottle Coffee', 'Philz Coffee', 'Sightglass Coffee', 'Tartine Bakery']) : pick(['Souvla', 'Nopalito', 'Zuni Café', 'Burma Superstar', 'DoorDash', 'Tacolicious', 'Delfina']),
        'dining',
        'cc',
      );
    }
    if (dow === 1 && fromISO(d).getDate() <= 14) post(d, -4000, 'Clipper Card Reload', 'transport', 'cc');
    if (chance(0.12)) post(d, -cents(11, 38), pick(['Uber', 'Lyft']), 'transport', 'cc');
    if (chance(0.13)) post(d, -cents(18, 210), pick(['Amazon', 'Uniqlo', 'Target', 'REI', 'Muji', 'Everlane']), 'shopping', 'cc');
    if (chance(0.06)) post(d, -cents(16, 120), pick(['AMC Metreon', 'Alamo Drafthouse', 'SFJAZZ Center', 'Ticketmaster', 'Steam']), 'entertainment', 'cc');
    if (chance(0.035)) post(d, -cents(9, 52), pick(['Walgreens', 'CVS Pharmacy']), 'health', 'cc');
    if (chance(0.012)) post(d, cents(20, 90), pick(['Amazon refund', 'REI refund', 'Uniqlo refund']), 'refund', 'cc');

    // Seasonal and one-off
    if (month === 11 && dom >= 5 && dom <= 22 && chance(0.3)) post(d, -cents(25, 180), pick(['Etsy', 'Paper Source', 'Gump’s', 'Amazon']), 'gifts', 'cc');
    for (const t of trips) {
      if (d === addDays(t, 4)) post(d, -cents(420, 560), 'United Airlines', 'travel', 'cc');
      if (d === addDays(t, 6)) post(d, -cents(690, 940), 'Airbnb', 'travel', 'cc');
      if (d === addDays(t, 20) || d === addDays(t, 21)) post(d, -cents(35, 120), pick(['Local restaurant', 'Museum tickets', 'Train fare']), 'travel', 'cc');
    }
    if (d === addDays(start, 120)) post(d, -129900, 'Apple Store', 'shopping', 'cc', 'iPhone upgrade');
    if (d === addDays(start, 200)) post(d, -19900, 'One Medical', 'health', 'cc', 'Annual membership');
  }

  // Goals: contributions spread over recent months so the ETA maths has history.
  const goal = (id: string, name: string, target: number, saved: number, monthly: number, icon: string, color: string, deadlineMonths?: number): Goal => {
    const contributions = Array.from({ length: 6 }, (_, i) => ({ date: addMonths(end, -5 + i).slice(0, 8) + '01', amount: Math.round(monthly * between(0.8, 1.2)) }));
    return {
      id,
      name,
      target,
      saved,
      icon,
      color,
      createdAt: addMonths(end, -10),
      contributions,
      ...(deadlineMonths ? { deadline: toISO(fromISO(addMonths(end, deadlineMonths))) } : {}),
    };
  };

  const goals = [
    goal('g1', 'Emergency fund', 2500000, 1560000, 60000, 'shield', '#3ddc97'),
    goal('g2', 'Japan in spring', 600000, 235000, 55000, 'plane', '#f472b6', 5),
    goal('g3', 'New MacBook Pro', 280000, 190000, 30000, 'laptop', '#38bdf8', 4),
    goal('g4', 'Home down payment', 12000000, 3100000, 150000, 'home', '#a78bfa', 36),
  ];

  txns.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));
  return { accounts: DEMO_ACCOUNTS, transactions: txns, budgets: DEMO_BUDGETS, goals };
}
