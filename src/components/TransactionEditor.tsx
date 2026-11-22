import { Trash2 } from 'lucide-react';
import { useMemo, useRef, useState, type FormEvent } from 'react';
import { CATEGORIES } from '../lib/categories';
import { today } from '../lib/dates';
import { parseMoney } from '../lib/money';
import { guessCategory, useStore } from '../store/useStore';
import { useUI } from '../store/ui';
import { Modal } from './Modal';

export function TransactionEditor() {
  const { tx } = useUI((s) => s.txEditor);
  const close = useUI((s) => s.closeTx);
  const toast = useUI((s) => s.toast);
  const accounts = useStore((s) => s.accounts);
  const history = useStore((s) => s.transactions);
  const add = useStore((s) => s.addTransaction);
  const update = useStore((s) => s.updateTransaction);
  const remove = useStore((s) => s.removeTransactions);
  const restore = useStore((s) => s.restoreTransactions);

  const [kind, setKind] = useState<'out' | 'in'>(tx && tx.amount > 0 ? 'in' : 'out');
  const [amount, setAmount] = useState(tx ? (Math.abs(tx.amount) / 100).toFixed(2) : '');
  const [merchant, setMerchant] = useState(tx?.merchant ?? '');
  const [categoryId, setCategoryId] = useState(tx?.categoryId ?? 'groceries');
  const [catTouched, setCatTouched] = useState(Boolean(tx));
  const [accountId, setAccountId] = useState(tx?.accountId ?? accounts.find((a) => a.type === 'credit')?.id ?? accounts[0]?.id ?? '');
  const [date, setDate] = useState(tx?.date ?? today());
  const [note, setNote] = useState(tx?.note ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const amountRef = useRef<HTMLInputElement>(null);

  const merchants = useMemo(() => [...new Set(history.slice(0, 400).map((t) => t.merchant))].slice(0, 60), [history]);
  const cats = CATEGORIES.filter((c) => (kind === 'in' ? c.group === 'income' || c.group === 'transfer' : c.group !== 'income'));

  const onMerchant = (v: string) => {
    setMerchant(v);
    if (!catTouched && kind === 'out') setCategoryId(guessCategory(v, history));
  };

  const onKind = (k: 'out' | 'in') => {
    setKind(k);
    if (!catTouched) setCategoryId(k === 'in' ? 'salary' : guessCategory(merchant, history));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const cents = parseMoney(amount);
    const errs: Record<string, string> = {};
    if (cents === null || cents <= 0) errs.amount = 'Enter an amount greater than zero.';
    if (!merchant.trim()) errs.merchant = 'Add who you paid or who paid you.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errs.date = 'Pick a date.';
    if (!accountId) errs.account = 'Choose an account.';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const value = (kind === 'out' ? -1 : 1) * Math.abs(cents!);
    const payload = { amount: value, merchant: merchant.trim().slice(0, 80), categoryId, accountId, date, ...(note.trim() ? { note: note.trim().slice(0, 200) } : { note: undefined }) };
    if (tx) {
      update(tx.id, payload);
      toast('Transaction updated');
    } else {
      add(payload);
      toast('Transaction added');
    }
    close();
  };

  const onDelete = () => {
    if (!tx) return;
    const removed = remove([tx.id]);
    close();
    toast('Transaction deleted', { label: 'Undo', run: () => restore(removed) });
  };

  return (
    <Modal
      title={tx ? 'Edit transaction' : 'New transaction'}
      onClose={close}
      initialFocus={amountRef}
      footer={
        <>
          {tx && (
            <button type="button" className="btn btn-ghost btn-danger spacer" onClick={onDelete}>
              <Trash2 size={16} aria-hidden="true" /> Delete
            </button>
          )}
          <button type="button" className="btn" onClick={close}>
            Cancel
          </button>
          <button type="submit" form="tx-form" className="btn btn-primary">
            {tx ? 'Save changes' : 'Add transaction'}
          </button>
        </>
      }
    >
      <form id="tx-form" className="dialog-body" onSubmit={submit} noValidate>
        <div className="segmented" role="radiogroup" aria-label="Type" style={{ justifySelf: 'start' }}>
          <button type="button" role="radio" aria-checked={kind === 'out'} onClick={() => onKind('out')}>
            Money out
          </button>
          <button type="button" role="radio" aria-checked={kind === 'in'} onClick={() => onKind('in')}>
            Money in
          </button>
        </div>

        <label className="field">
          <span>Amount</span>
          <div className="amount-input">
            <input
              ref={amountRef}
              className="input num"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-invalid={Boolean(errors.amount)}
              aria-describedby={errors.amount ? 'err-amount' : undefined}
            />
          </div>
          {errors.amount && (
            <span className="field-error" id="err-amount">
              {errors.amount}
            </span>
          )}
        </label>

        <label className="field">
          <span>{kind === 'out' ? 'Paid to' : 'Received from'}</span>
          <input
            className="input"
            list="merchant-list"
            value={merchant}
            onChange={(e) => onMerchant(e.target.value)}
            placeholder={kind === 'out' ? 'e.g. Blue Bottle Coffee' : 'e.g. Northline Labs Payroll'}
            autoComplete="off"
            aria-invalid={Boolean(errors.merchant)}
            aria-describedby={errors.merchant ? 'err-merchant' : undefined}
          />
          <datalist id="merchant-list">
            {merchants.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
          {errors.merchant && (
            <span className="field-error" id="err-merchant">
              {errors.merchant}
            </span>
          )}
        </label>

        <div className="two-col">
          <label className="field">
            <span>Category</span>
            <select
              className="select"
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setCatTouched(true);
              }}
            >
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Account</span>
            <select className="select" value={accountId} onChange={(e) => setAccountId(e.target.value)} aria-invalid={Boolean(errors.account)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="two-col">
          <label className="field">
            <span>Date</span>
            <input className="input" type="date" value={date} max="2100-12-31" onChange={(e) => setDate(e.target.value)} aria-invalid={Boolean(errors.date)} />
            {errors.date && <span className="field-error">{errors.date}</span>}
          </label>
          <label className="field">
            <span>Note (optional)</span>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note" maxLength={200} />
          </label>
        </div>
      </form>
    </Modal>
  );
}
