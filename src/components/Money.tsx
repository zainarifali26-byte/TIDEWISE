import { useCallback } from 'react';
import { formatMoney, type FormatOpts } from '../lib/money';
import type { Cents } from '../lib/types';
import { useStore } from '../store/useStore';

export function useMoney() {
  const currency = useStore((s) => s.settings.currency);
  return useCallback((v: Cents, opts?: FormatOpts) => formatMoney(v, currency, opts), [currency]);
}

interface Props extends FormatOpts {
  value: Cents;
  className?: string;
  colored?: boolean;
}

/** Renders an amount; respects the "hide amounts" privacy setting via CSS blur. */
export function Money({ value, className = '', colored = false, ...opts }: Props) {
  const money = useMoney();
  const tone = colored ? (value > 0 ? 'pos' : value < 0 ? '' : 'muted') : '';
  return <span className={`num money-mask ${tone} ${className}`.trim()}>{money(value, opts)}</span>;
}
