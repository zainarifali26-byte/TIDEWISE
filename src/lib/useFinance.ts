import { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { accountBalances, detectRecurring } from './analytics';
import { today } from './dates';

/** Shared derived data, memoised on the raw store slices. */
export function useFinance() {
  const accounts = useStore((s) => s.accounts);
  const transactions = useStore((s) => s.transactions);
  const asOf = today();
  return useMemo(() => {
    const balances = accountBalances(accounts, transactions);
    const recurring = detectRecurring(transactions, asOf);
    const netWorth = Object.values(balances).reduce((s, v) => s + v, 0);
    return { accounts, transactions, balances, recurring, netWorth, asOf };
  }, [accounts, transactions, asOf]);
}
