import { Building2, CreditCard, Landmark, LineChart, Plus, Wallet } from 'lucide-react';
import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Sparkline } from '../components/charts/Donut';
import { Modal } from '../components/Modal';
import { Money } from '../components/Money';
import { netWorthSeries } from '../lib/analytics';
import { addDays } from '../lib/dates';
import { parseMoney } from '../lib/money';
import type { AccountType } from '../lib/types';
import { useFinance } from '../lib/useFinance';
import { useStore } from '../store/useStore';
import { useUI } from '../store/ui';

const TYPE = {
  checking: { label: 'Checking', icon: Wallet },
  savings: { label: 'Savings', icon: Landmark },
  credit: { label: 'Credit card', icon: CreditCard },
  investment: { label: 'Investments', icon: LineChart },
} as const;

export default function Accounts() {
  const { accounts, transactions, balances, netWorth, asOf } = useFinance();
  const [adding, setAdding] = useState(false);
  const assets = accounts.filter((a) => balances[a.id] >= 0).reduce((s, a) => s + balances[a.id], 0);
  const debts = accounts.filter((a) => balances[a.id] < 0).reduce((s, a) => s + balances[a.id], 0);
  const sparks = useMemo(
    () =>
      Object.fromEntries(
        accounts.map((a) => {
          const pts = netWorthSeries([a], transactions, addDays(asOf, -90), asOf);
          return [a.id, pts.filter((_, i) => i % 3 === 0 || i === pts.length - 1).map((p) => p.value)];
        }),
      ),
    [accounts, transactions, asOf],
  );
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of transactions) m.set(t.accountId, (m.get(t.accountId) ?? 0) + 1);
    return m;
  }, [transactions]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Accounts</h1>
          <p>Balances are calculated from each account’s transactions.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
          <Plus size={16} aria-hidden="true" /> Add account
        </button>
      </div>

      <div className="grid grid-dash">
        <section className="card span-12" aria-label="Net worth breakdown">
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 18 }}>
            <div className="kpi">
              <span className="kpi-label">Net worth</span>
              <span className="kpi-value"><Money value={netWorth} cents={false} /></span>
            </div>
            <div className="kpi">
              <span className="kpi-label">Assets</span>
              <span className="kpi-value pos"><Money value={assets} cents={false} /></span>
            </div>
            <div className="kpi">
              <span className="kpi-label">Debts</span>
              <span className="kpi-value"><Money value={debts} cents={false} /></span>
            </div>
          </div>
          <div className="bar" style={{ height: 12, marginTop: 18, display: 'flex' }} role="img" aria-label="Share of assets by account">
            {accounts
              .filter((a) => balances[a.id] > 0)
              .map((a, i, arr) => {
                const left = arr.slice(0, i).reduce((s, x) => s + balances[x.id], 0);
                return <span key={a.id} style={{ left: `${(left / assets) * 100}%`, width: `${(balances[a.id] / assets) * 100}%`, background: a.color, borderRadius: 0 }} />;
              })}
          </div>
          <div className="legend" style={{ marginTop: 10 }}>
            {accounts
              .filter((a) => balances[a.id] > 0)
              .map((a) => (
                <span key={a.id}>
                  <i className="cat-dot" style={{ background: a.color }} /> {a.name} {((balances[a.id] / assets) * 100).toFixed(0)}%
                </span>
              ))}
          </div>
        </section>

        {accounts.map((a) => {
          const T = TYPE[a.type];
          const s = sparks[a.id] ?? [];
          const change = s.length ? s[s.length - 1] - s[0] : 0;
          return (
            <section className="card acct-card span-6" key={a.id} aria-label={a.name}>
              <span className="acct-stripe" style={{ background: a.color }} aria-hidden="true" />
              <div className="acct-top">
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
                  <span className="acct-badge" style={{ background: `color-mix(in srgb, ${a.color} 16%, transparent)`, color: a.color }} aria-hidden="true">
                    <T.icon size={19} />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <h2 className="card-title">{a.name}</h2>
                    <p className="row-sub">
                      <Building2 size={12} aria-hidden="true" style={{ verticalAlign: '-1px' }} /> {a.institution} · •••• {a.last4}
                    </p>
                  </div>
                </div>
                <span className="chip neutral">{T.label}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div className="acct-bal">
                    <Money value={balances[a.id]} />
                  </div>
                  <p className="row-sub">
                    <Money value={change} sign colored cents={false} /> over 90 days
                  </p>
                </div>
                <Sparkline values={s} color={a.color} width={120} height={40} />
              </div>
              <Link className="link-btn" to={`/transactions?account=${a.id}`}>
                {counts.get(a.id) ?? 0} transactions →
              </Link>
            </section>
          );
        })}
      </div>

      {adding && <AccountDialog onClose={() => setAdding(false)} />}
    </div>
  );
}

const PALETTE = ['#3ddc97', '#38bdf8', '#a78bfa', '#f472b6', '#fbbf24', '#fb923c', '#f87171'];

function AccountDialog({ onClose }: { onClose: () => void }) {
  const add = useStore((s) => s.addAccount);
  const count = useStore((s) => s.accounts.length);
  const toast = useUI((s) => s.toast);
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('checking');
  const [institution, setInstitution] = useState('');
  const [balance, setBalance] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const ref = useRef<HTMLInputElement>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const b = balance.trim() ? parseMoney(balance) : 0;
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Name the account.';
    if (b === null) errs.balance = 'Enter a number, e.g. 2500 or -300.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const opening = type === 'credit' ? -Math.abs(b!) : b!;
    add({ name: name.trim().slice(0, 40), type, institution: institution.trim().slice(0, 40) || 'Manual', last4: String(Math.floor(1000 + Math.random() * 9000)), openingBalance: opening, color: PALETTE[count % PALETTE.length] });
    toast('Account added');
    onClose();
  };

  return (
    <Modal
      title="Add an account"
      onClose={onClose}
      initialFocus={ref}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="acct-form" className="btn btn-primary">
            Add account
          </button>
        </>
      }
    >
      <form id="acct-form" className="dialog-body" onSubmit={submit} noValidate>
        <label className="field">
          <span>Account name</span>
          <input ref={ref} className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Joint checking" aria-invalid={Boolean(errors.name)} />
          {errors.name && <span className="field-error">{errors.name}</span>}
        </label>
        <div className="two-col">
          <label className="field">
            <span>Type</span>
            <select className="select" value={type} onChange={(e) => setType(e.target.value as AccountType)}>
              {Object.entries(TYPE).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Bank (optional)</span>
            <input className="input" value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="e.g. Harbor Bank" />
          </label>
        </div>
        <label className="field">
          <span>{type === 'credit' ? 'Amount owed today' : 'Balance today'}</span>
          <input className="input num" inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="0.00" aria-invalid={Boolean(errors.balance)} />
          {errors.balance && <span className="field-error">{errors.balance}</span>}
        </label>
      </form>
    </Modal>
  );
}
