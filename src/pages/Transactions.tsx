import { Download, FileUp, Plus, ReceiptText, Search, Tag, Trash2, X } from 'lucide-react';
import { useDeferredValue, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CategoryIcon } from '../components/CategoryIcon';
import { Modal } from '../components/Modal';
import { Money } from '../components/Money';
import { isIncome, isSpending } from '../lib/analytics';
import { CATEGORIES, getCategory } from '../lib/categories';
import { download, importCSV, toCSV } from '../lib/csv';
import { fmt, monthKey, relativeDay } from '../lib/dates';
import { useFinance } from '../lib/useFinance';
import type { Transaction } from '../lib/types';
import { guessCategory, useStore } from '../store/useStore';
import { useUI } from '../store/ui';

const PAGE = 120;

export default function Transactions() {
  const { transactions, accounts, asOf } = useFinance();
  const recategorize = useStore((s) => s.recategorize);
  const remove = useStore((s) => s.removeTransactions);
  const restore = useStore((s) => s.restoreTransactions);
  const ui = useUI();
  const [params, setParams] = useSearchParams();
  const [qInput, setQInput] = useState(params.get('q') ?? '');
  const q = useDeferredValue(qInput.trim().toLowerCase());
  const category = params.get('category') ?? '';
  const account = params.get('account') ?? '';
  const type = params.get('type') ?? '';
  const month = params.get('month') ?? '';
  const [limit, setLimit] = useState(PAGE);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
    setLimit(PAGE);
    setSelected(new Set());
  };

  const months = useMemo(() => [...new Set(transactions.map((t) => monthKey(t.date)))], [transactions]);
  const accName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);

  const filtered = useMemo(
    () =>
      transactions.filter((t) => {
        if (category && t.categoryId !== category) return false;
        if (account && t.accountId !== account) return false;
        if (month && !t.date.startsWith(month)) return false;
        if (type === 'in' && t.amount <= 0) return false;
        if (type === 'out' && t.amount >= 0) return false;
        if (q && !(t.merchant.toLowerCase().includes(q) || (t.note ?? '').toLowerCase().includes(q) || getCategory(t.categoryId).name.toLowerCase().includes(q) || (Math.abs(t.amount) / 100).toFixed(2).includes(q)))
          return false;
        return true;
      }),
    [transactions, category, account, month, type, q],
  );

  const totals = useMemo(() => {
    let inc = 0;
    let out = 0;
    for (const t of filtered) {
      if (isIncome(t)) inc += t.amount;
      else if (isSpending(t)) out -= t.amount;
    }
    return { inc, out };
  }, [filtered]);

  const shown = filtered.slice(0, limit);
  const groups = useMemo(() => {
    const out: { date: string; items: Transaction[]; total: number }[] = [];
    for (const t of shown) {
      const last = out[out.length - 1];
      if (last && last.date === t.date) {
        last.items.push(t);
        last.total += t.amount;
      } else out.push({ date: t.date, items: [t], total: t.amount });
    }
    return out;
  }, [shown]);

  const filtersOn = Boolean(category || account || type || month || q);
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const bulkDelete = () => {
    const removed = remove([...selected]);
    setSelected(new Set());
    ui.toast(`${removed.length} transaction${removed.length === 1 ? '' : 's'} deleted`, { label: 'Undo', run: () => restore(removed) });
  };

  const bulkCategory = (id: string) => {
    if (!id) return;
    const ids = [...selected];
    const before = transactions.filter((t) => selected.has(t.id)).map((t) => [t.id, t.categoryId] as const);
    recategorize(ids, id);
    setSelected(new Set());
    ui.toast(`Moved ${ids.length} to ${getCategory(id).name}`, {
      label: 'Undo',
      run: () => {
        for (const [tid, cid] of before) recategorize([tid], cid);
      },
    });
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Transactions</h1>
          <p>Every dollar in and out, across all accounts.</p>
        </div>
        <div className="head-actions">
          <button type="button" className="btn" onClick={() => setImporting(true)}>
            <FileUp size={16} aria-hidden="true" /> Import CSV
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              download(`tidewise-transactions-${asOf}.csv`, toCSV(filtered, accounts));
              ui.toast(`Exported ${filtered.length} transactions`);
            }}
          >
            <Download size={16} aria-hidden="true" /> Export
          </button>
          <button type="button" className="btn btn-primary" onClick={() => ui.openTx()}>
            <Plus size={16} aria-hidden="true" /> Add
          </button>
        </div>
      </div>

      <section className="card">
        <div className="toolbar">
          <label className="input-wrap">
            <Search size={16} aria-hidden="true" />
            <span className="sr-only">Search transactions</span>
            <input
              className="input"
              type="search"
              placeholder="Search merchant, note, category or amount"
              value={qInput}
              onChange={(e) => {
                setQInput(e.target.value);
                setLimit(PAGE);
              }}
            />
          </label>
          <label>
            <span className="sr-only">Month</span>
            <select className="select" value={month} onChange={(e) => setParam('month', e.target.value)}>
              <option value="">All months</option>
              {months.map((m) => (
                <option key={m} value={m}>
                  {fmt.monthLong(m)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Category</span>
            <select className="select" value={category} onChange={(e) => setParam('category', e.target.value)}>
              <option value="">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Account</span>
            <select className="select" value={account} onChange={(e) => setParam('account', e.target.value)}>
              <option value="">All accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <div className="segmented" role="group" aria-label="Direction">
            {[
              ['', 'All'],
              ['out', 'Out'],
              ['in', 'In'],
            ].map(([v, l]) => (
              <button key={l} type="button" aria-pressed={type === v} onClick={() => setParam('type', v)}>
                {l}
              </button>
            ))}
          </div>
          {filtersOn && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setQInput('');
                setParams(new URLSearchParams(), { replace: true });
              }}
            >
              <X size={14} aria-hidden="true" /> Clear
            </button>
          )}
        </div>

        <p className="summary-strip" role="status">
          <span>
            <b className="num">{filtered.length.toLocaleString()}</b> transactions
          </span>
          <span>
            In <b><Money value={totals.inc} /></b>
          </span>
          <span>
            Out <b><Money value={totals.out} /></b>
          </span>
        </p>

        {filtered.length === 0 ? (
          <div className="empty">
            <span className="empty-icon">
              <ReceiptText size={24} aria-hidden="true" />
            </span>
            <h3>{transactions.length ? 'No transactions match' : 'No transactions yet'}</h3>
            <p>{transactions.length ? 'Try a different search or clear the filters.' : 'Add one by hand or import a CSV from your bank.'}</p>
          </div>
        ) : (
          groups.map((g) => (
            <div className="tx-group" key={g.date} role="group" aria-label={fmt.full(g.date)}>
              <div className="tx-date">
                <span>{relativeDay(g.date, asOf)}</span>
                <Money value={g.total} sign colored />
              </div>
              {g.items.map((t) => {
                const cat = getCategory(t.categoryId);
                return (
                  <div className={`tx-row ${selected.has(t.id) ? 'selected' : ''}`} key={t.id}>
                    <input type="checkbox" className="check" checked={selected.has(t.id)} onChange={() => toggle(t.id)} aria-label={`Select ${t.merchant}, ${fmt.short(t.date)}`} />
                    <CategoryIcon id={t.categoryId} />
                    <button type="button" className="tx-open" onClick={() => ui.openTx(t)} aria-label={`Edit ${t.merchant}`}>
                      <span className="row-title" style={{ display: 'block' }}>
                        {t.merchant}
                      </span>
                      <span className="row-sub" style={{ display: 'block' }}>
                        {t.note ? t.note : `${cat.name} · ${accName.get(t.accountId) ?? ''}`}
                      </span>
                    </button>
                    <label className="tx-cat">
                      <i className="cat-dot" style={{ background: cat.color }} />
                      <span className="sr-only">Category for {t.merchant}</span>
                      <select className="select" value={t.categoryId} onChange={(e) => recategorize([t.id], e.target.value)}>
                        {CATEGORIES.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <span className="tx-acc">{accName.get(t.accountId)}</span>
                    <Money className="row-amt" value={t.amount} sign colored />
                  </div>
                );
              })}
            </div>
          ))
        )}

        {filtered.length > limit && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 16 }}>
            <button type="button" className="btn" onClick={() => setLimit((l) => l + PAGE)}>
              Show more ({(filtered.length - limit).toLocaleString()} left)
            </button>
          </div>
        )}
      </section>

      {selected.size > 0 && (
        <div className="bulkbar" role="region" aria-label="Bulk actions">
          <b className="num">{selected.size} selected</b>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Tag size={15} aria-hidden="true" />
            <span className="sr-only">Move selected to category</span>
            <select className="select" style={{ minHeight: 34, width: 'auto' }} value="" onChange={(e) => bulkCategory(e.target.value)}>
              <option value="">Recategorize…</option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn btn-sm btn-ghost btn-danger" onClick={bulkDelete}>
            <Trash2 size={15} aria-hidden="true" /> Delete
          </button>
          <button type="button" className="icon-btn" onClick={() => setSelected(new Set())} aria-label="Clear selection">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      {importing && <ImportDialog onClose={() => setImporting(false)} />}
    </div>
  );
}

function ImportDialog({ onClose }: { onClose: () => void }) {
  const accounts = useStore((s) => s.accounts);
  const history = useStore((s) => s.transactions);
  const addMany = useStore((s) => s.addTransactions);
  const toast = useUI((s) => s.toast);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (file?: File) => {
    setError('');
    if (!file) return;
    if (file.size > 5_000_000) return setError('That file is over 5 MB. Export a shorter date range.');
    const text = await file.text();
    const res = importCSV(text, accountId, (m) => guessCategory(m, history));
    if (!res.transactions.length) return setError('No transactions found. The file needs date, description and amount (or debit/credit) columns.');
    const added = addMany(res.transactions);
    const dupes = res.transactions.length - added;
    toast(`Imported ${added} transactions${dupes ? `, skipped ${dupes} duplicates` : ''}${res.skipped ? `, ${res.skipped} unreadable rows` : ''}`);
    onClose();
  };

  return (
    <Modal title="Import from your bank" onClose={onClose}>
      <div className="dialog-body">
        <p className="muted" style={{ fontSize: 14 }}>
          Most banks can export a CSV. Tidewise reads the date, description and amount columns, guesses categories from your history and skips duplicates. The file is read on this device only.
        </p>
        <label className="field">
          <span>Add to account</span>
          <select className="select" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>CSV file</span>
          <input ref={fileRef} className="input" type="file" accept=".csv,text/csv" style={{ paddingTop: 9 }} onChange={(e) => onFile(e.target.files?.[0])} aria-describedby={error ? 'imp-err' : undefined} />
        </label>
        {error && (
          <p className="field-error" id="imp-err" role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
