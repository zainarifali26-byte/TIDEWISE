import type { Cents, CurrencyCode } from './types';

const LOCALE: Record<CurrencyCode, string> = {
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
  CAD: 'en-CA',
  AUD: 'en-AU',
};

export const CURRENCIES: { code: CurrencyCode; label: string }[] = [
  { code: 'USD', label: 'US dollar' },
  { code: 'EUR', label: 'Euro' },
  { code: 'GBP', label: 'British pound' },
  { code: 'CAD', label: 'Canadian dollar' },
  { code: 'AUD', label: 'Australian dollar' },
];

const cache = new Map<string, Intl.NumberFormat>();

function formatter(currency: CurrencyCode, compact: boolean, cents: boolean) {
  const key = `${currency}|${compact}|${cents}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(LOCALE[currency], {
      style: 'currency',
      currency,
      notation: compact ? 'compact' : 'standard',
      minimumFractionDigits: compact ? 0 : cents ? 2 : 0,
      maximumFractionDigits: compact ? 1 : cents ? 2 : 0,
    });
    cache.set(key, f);
  }
  return f;
}

export interface FormatOpts {
  compact?: boolean;
  cents?: boolean; // show .00 (default true)
  sign?: boolean; // prefix + for positive values
}

export function formatMoney(value: Cents, currency: CurrencyCode, opts: FormatOpts = {}) {
  const { compact = false, cents = true, sign = false } = opts;
  const text = formatter(currency, compact, cents).format(Math.abs(value) / 100);
  if (value < 0) return `−${text}`;
  if (sign && value > 0) return `+${text}`;
  return text;
}

/** Parse user input like "1,234.50" or "-12" into cents. Returns null if invalid. */
export function parseMoney(input: string): Cents | null {
  const clean = input.replace(/[^\d.,-]/g, '').replace(/,/g, '');
  if (!clean || clean === '-' || clean === '.') return null;
  const n = Number(clean);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function percent(part: number, whole: number) {
  if (!whole) return 0;
  return (part / whole) * 100;
}

export function formatPercent(value: number, digits = 0) {
  return `${value.toFixed(digits)}%`;
}
