import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { normalizeMerchant } from '../lib/analytics';
import { today } from '../lib/dates';
import { generateDemo } from '../lib/seed';
import type { Account, Budget, Goal, Settings, Transaction } from '../lib/types';

export type NewTransaction = Omit<Transaction, 'id'>;

interface State {
  version: number;
  isDemo: boolean;
  seededOn: string;
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  settings: Settings;

  addTransaction: (t: NewTransaction) => string;
  addTransactions: (ts: NewTransaction[]) => number;
  updateTransaction: (id: string, patch: Partial<NewTransaction>) => void;
  removeTransactions: (ids: string[]) => Transaction[];
  restoreTransactions: (ts: Transaction[]) => void;
  recategorize: (ids: string[], categoryId: string) => void;

  setBudget: (categoryId: string, amount: number) => void;
  removeBudget: (categoryId: string) => void;

  addGoal: (g: Omit<Goal, 'id' | 'createdAt' | 'contributions' | 'saved'> & { saved?: number }) => void;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  contributeGoal: (id: string, amount: number) => void;
  removeGoal: (id: string) => void;

  addAccount: (a: Omit<Account, 'id'>) => void;
  updateAccount: (id: string, patch: Partial<Account>) => void;

  setSettings: (patch: Partial<Settings>) => void;
  loadDemo: () => void;
  startFresh: () => void;
  importBackup: (data: unknown) => boolean;
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`);

const sortDesc = (ts: Transaction[]) => [...ts].sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));

const DEFAULT_SETTINGS: Settings = { name: 'Alex', currency: 'USD', theme: 'system', hideAmounts: false };

function demoState() {
  const d = generateDemo(today());
  return { isDemo: true, seededOn: today(), ...d };
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      version: 1,
      ...demoState(),
      settings: DEFAULT_SETTINGS,

      addTransaction: (t) => {
        const id = uid();
        set((s) => ({ transactions: sortDesc([{ ...t, id }, ...s.transactions]) }));
        return id;
      },
      addTransactions: (ts) => {
        const existing = new Set(get().transactions.map((t) => `${t.date}|${t.amount}|${normalizeMerchant(t.merchant)}|${t.accountId}`));
        const fresh = ts.filter((t) => !existing.has(`${t.date}|${t.amount}|${normalizeMerchant(t.merchant)}|${t.accountId}`));
        set((s) => ({ transactions: sortDesc([...fresh.map((t) => ({ ...t, id: uid() })), ...s.transactions]) }));
        return fresh.length;
      },
      updateTransaction: (id, patch) =>
        set((s) => ({ transactions: sortDesc(s.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t))) })),
      removeTransactions: (ids) => {
        const set_ = new Set(ids);
        const removed = get().transactions.filter((t) => set_.has(t.id));
        set((s) => ({ transactions: s.transactions.filter((t) => !set_.has(t.id)) }));
        return removed;
      },
      restoreTransactions: (ts) => set((s) => ({ transactions: sortDesc([...ts, ...s.transactions]) })),
      recategorize: (ids, categoryId) => {
        const set_ = new Set(ids);
        set((s) => ({ transactions: s.transactions.map((t) => (set_.has(t.id) ? { ...t, categoryId } : t)) }));
      },

      setBudget: (categoryId, amount) =>
        set((s) => {
          const has = s.budgets.some((b) => b.categoryId === categoryId);
          return { budgets: has ? s.budgets.map((b) => (b.categoryId === categoryId ? { ...b, amount } : b)) : [...s.budgets, { categoryId, amount }] };
        }),
      removeBudget: (categoryId) => set((s) => ({ budgets: s.budgets.filter((b) => b.categoryId !== categoryId) })),

      addGoal: (g) =>
        set((s) => ({
          goals: [...s.goals, { ...g, id: uid(), saved: g.saved ?? 0, createdAt: today(), contributions: g.saved ? [{ date: today(), amount: g.saved }] : [] }],
        })),
      updateGoal: (id, patch) => set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),
      contributeGoal: (id, amount) =>
        set((s) => ({
          goals: s.goals.map((g) =>
            g.id === id ? { ...g, saved: Math.max(0, g.saved + amount), contributions: [...g.contributions, { date: today(), amount }] } : g,
          ),
        })),
      removeGoal: (id) => set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),

      addAccount: (a) => set((s) => ({ accounts: [...s.accounts, { ...a, id: uid() }] })),
      updateAccount: (id, patch) => set((s) => ({ accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),

      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      loadDemo: () => set({ ...demoState() }),
      startFresh: () =>
        set({
          isDemo: false,
          seededOn: today(),
          accounts: [{ id: uid(), name: 'Checking', type: 'checking', institution: 'My bank', last4: '0000', openingBalance: 0, color: '#3ddc97' }],
          transactions: [],
          budgets: [],
          goals: [],
        }),
      importBackup: (data) => {
        const d = data as Partial<State> | null;
        if (!d || !Array.isArray(d.accounts) || !Array.isArray(d.transactions)) return false;
        set({
          isDemo: false,
          accounts: d.accounts,
          transactions: sortDesc(d.transactions),
          budgets: Array.isArray(d.budgets) ? d.budgets : [],
          goals: Array.isArray(d.goals) ? d.goals : [],
          ...(d.settings ? { settings: { ...DEFAULT_SETTINGS, ...d.settings } } : {}),
        });
        return true;
      },
    }),
    {
      name: 'tidewise:v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        version: s.version,
        isDemo: s.isDemo,
        seededOn: s.seededOn,
        accounts: s.accounts,
        transactions: s.transactions,
        budgets: s.budgets,
        goals: s.goals,
        settings: s.settings,
      }),
      // Demo data is regenerated when it goes stale, so it always ends "today".
      onRehydrateStorage: () => (state) => {
        if (state?.isDemo && state.seededOn !== today()) state.loadDemo();
      },
    },
  ),
);

/** Simple merchant → category guess for quick-add and CSV import, learned from history. */
export function guessCategory(merchant: string, history: Transaction[]): string {
  const key = normalizeMerchant(merchant);
  if (!key) return 'shopping';
  const hit = history.find((t) => normalizeMerchant(t.merchant) === key);
  if (hit) return hit.categoryId;
  const rules: [RegExp, string][] = [
    [/coffee|cafe|café|bakery|restaurant|pizza|taco|sushi|doordash|grubhub|uber eats|bar\b|grill|kitchen/, 'dining'],
    [/market|grocery|trader|whole foods|safeway|costco|aldi|kroger/, 'groceries'],
    [/uber|lyft|clipper|shell|chevron|parking|transit|metro|bart/, 'transport'],
    [/netflix|spotify|hulu|disney|icloud|adobe|youtube|prime|subscription/, 'subscriptions'],
    [/airline|airbnb|hotel|marriott|hilton|expedia|delta|united/, 'travel'],
    [/pharmacy|walgreens|cvs|clinic|medical|dental/, 'health'],
    [/gym|fitness|equinox|yoga|peloton/, 'fitness'],
    [/electric|pg&e|pge|water|internet|wireless|verizon|comcast|at&t/, 'utilities'],
    [/rent|apartments|residences|property/, 'rent'],
    [/cinema|theater|theatre|ticket|amc|steam|concert/, 'entertainment'],
  ];
  return rules.find(([re]) => re.test(key))?.[1] ?? 'shopping';
}
