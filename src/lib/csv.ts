import { CATEGORIES } from './categories';
import type { Account, Transaction } from './types';

const HEADER = ['Date', 'Merchant', 'Amount', 'Category', 'Account', 'Note'];

function esc(v: string) {
  // Neutralise spreadsheet formula injection and quote when needed.
  let s = /^[=+\-@\t\r]/.test(v) && !/^-?\d/.test(v) ? `'${v}` : v;
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCSV(txns: Transaction[], accounts: Account[]) {
  const accName = new Map(accounts.map((a) => [a.id, a.name]));
  const catName = new Map(CATEGORIES.map((c) => [c.id, c.name]));
  const rows = txns.map((t) =>
    [t.date, t.merchant, (t.amount / 100).toFixed(2), catName.get(t.categoryId) ?? t.categoryId, accName.get(t.accountId) ?? t.accountId, t.note ?? '']
      .map(esc)
      .join(','),
  );
  return [HEADER.join(','), ...rows].join('\r\n');
}

/** RFC 4180 parser: handles quotes, escaped quotes and newlines inside fields. */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push(row);
  return rows;
}

export interface ImportResult {
  transactions: Omit<Transaction, 'id'>[];
  skipped: number;
}

function normDate(s: string): string | null {
  const v = s.trim();
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/); // US M/D/Y
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  }
  return null;
}

/**
 * Imports a bank-style CSV. Looks for date, description/merchant and amount
 * columns (or separate debit/credit columns) by header name.
 */
export function importCSV(text: string, accountId: string, guessCategory: (merchant: string) => string): ImportResult {
  const rows = parseCSV(text);
  if (rows.length < 2) return { transactions: [], skipped: 0 };
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const col = (...names: string[]) => head.findIndex((h) => names.some((n) => h === n || h.includes(n)));
  const iDate = col('date', 'posted');
  const iDesc = col('merchant', 'description', 'payee', 'name');
  const iAmt = col('amount');
  const iDebit = col('debit', 'withdrawal');
  const iCredit = col('credit', 'deposit');
  const iNote = col('note', 'memo');
  const byName = new Map(CATEGORIES.map((c) => [c.name.toLowerCase(), c.id]));
  const iCat = col('category');

  const out: Omit<Transaction, 'id'>[] = [];
  let skipped = 0;
  for (const r of rows.slice(1)) {
    const date = iDate >= 0 ? normDate(r[iDate] ?? '') : null;
    const merchant = (iDesc >= 0 ? r[iDesc] : '')?.trim().replace(/^'/, '');
    const num = (s?: string) => {
      if (!s) return NaN;
      const neg = /^\(.*\)$/.test(s.trim());
      const n = Number(s.replace(/[^\d.-]/g, ''));
      return neg ? -Math.abs(n) : n;
    };
    let amount = iAmt >= 0 ? num(r[iAmt]) : NaN;
    if (Number.isNaN(amount) && (iDebit >= 0 || iCredit >= 0)) {
      const d = num(r[iDebit]);
      const c = num(r[iCredit]);
      amount = (Number.isNaN(c) ? 0 : Math.abs(c)) - (Number.isNaN(d) ? 0 : Math.abs(d));
    }
    if (!date || !merchant || Number.isNaN(amount)) {
      skipped++;
      continue;
    }
    const named = iCat >= 0 ? byName.get((r[iCat] ?? '').trim().toLowerCase()) : undefined;
    out.push({
      date,
      merchant: merchant.slice(0, 80),
      amount: Math.round(amount * 100),
      categoryId: named ?? (amount > 0 ? 'refund' : guessCategory(merchant)),
      accountId,
      ...(iNote >= 0 && r[iNote]?.trim() ? { note: r[iNote].trim().slice(0, 200) } : {}),
    });
  }
  return { transactions: out, skipped };
}

export function download(filename: string, content: string, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
