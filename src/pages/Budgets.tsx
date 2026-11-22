import { Pencil, PiggyBank, Plus } from 'lucide-react';
import { useMemo, useRef, useState, type FormEvent } from 'react';
import { CategoryIcon } from '../components/CategoryIcon';
import { Ring } from '../components/charts/Donut';
import { Modal } from '../components/Modal';
import { Money, useMoney } from '../components/Money';
import { budgetStatus, spendingByCategory, type BudgetStatus } from '../lib/analytics';
import { getCategory, SPENDING_CATEGORIES } from '../lib/categories';
import { addDays, addMonths, dayOfMonth, daysInMonth, fmt, startOfMonth } from '../lib/dates';
import { parseMoney } from '../lib/money';
import { useFinance } from '../lib/useFinance';
import { useStore } from '../store/useStore';
import { useUI } from '../store/ui';

const STATE_LABEL = { ok: 'On track', watch: 'Watch', over: 'Over' } as const;
const STATE_CHIP = { ok: 'pos', watch: 'warn', over: 'neg' } as const;

export default function Budgets() {
  const { transactions, recurring, asOf } = useFinance();
  const budgets = useStore((s) => s.budgets);
  const [editing, setEditing] = useState<{ categoryId: string; amount?: number } | null>(null);
  const status = useMemo(() => budgetStatus(budgets, transactions, asOf, recurring), [budgets, transactions, asOf, recurring]);

  // 3-month average spend per category, used for suggestions.
  const avg = useMemo(() => {
    const from = addMonths(startOfMonth(asOf), -3);
    const to = addDays(startOfMonth(asOf), -1);
    return new Map(spendingByCategory(transactions, from, to).map((r) => [r.categoryId, Math.round(r.total / 3)]));
  }, [transactions, asOf]);

  const total = status.reduce((s, b) => s + b.limit, 0);
  const spent = status.reduce((s, b) => s + b.spent, 0);
  const projected = status.reduce((s, b) => s + b.projected, 0);
  const dim = daysInMonth(asOf);
  const dom = dayOfMonth(asOf);
  const daysLeft = dim - dom + 1;
  const left = total - spent;
  const unbudgeted = SPENDING_CATEGORIES.filter((c) => !budgets.some((b) => b.categoryId === c.id) && c.id !== 'rent');
  const order = { over: 0, watch: 1, ok: 2 };
  const sorted = [...status].sort((a, b) => order[a.state] - order[b.state] || b.pct - a.pct);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Budgets</h1>
          <p>
            {fmt.monthLong(asOf)} · {daysLeft} day{daysLeft === 1 ? '' : 's'} left
          </p>
        </div>
        <div className="head-actions">
          <button type="button" className="btn btn-primary" onClick={() => setEditing({ categoryId: unbudgeted[0]?.id ?? 'dining' })} disabled={!unbudgeted.length}>
            <Plus size={16} aria-hidden="true" /> New budget
          </button>
        </div>
      </div>

      {status.length === 0 ? (
        <section className="card">
          <div className="empty">
            <span className="empty-icon">
              <PiggyBank size={24} aria-hidden="true" />
            </span>
            <h3>No budgets yet</h3>
            <p>Set a monthly limit for a category and Tidewise will forecast where you’ll land.</p>
            <button type="button" className="btn btn-primary" onClick={() => setEditing({ categoryId: 'dining' })}>
              Create your first budget
            </button>
          </div>
        </section>
      ) : (
        <div className="grid grid-dash">
          <section className="card span-12" aria-label="Budget summary">
            <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
              <Ring pct={(spent / (total || 1)) * 100} color={spent > total ? 'var(--danger)' : projected > total ? 'var(--warn)' : 'var(--accent)'}>
                <strong className="num">{Math.round((spent / (total || 1)) * 100)}%</strong>
                <span>used</span>
              </Ring>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', flex: 1, gap: 18 }}>
                <div className="kpi">
                  <span className="kpi-label">Budgeted</span>
                  <span className="kpi-value"><Money value={total} cents={false} /></span>
                </div>
                <div className="kpi">
                  <span className="kpi-label">Spent</span>
                  <span className="kpi-value"><Money value={spent} cents={false} /></span>
                </div>
                <div className="kpi">
                  <span className="kpi-label">Forecast</span>
                  <span className={`kpi-value ${projected > total ? 'neg' : ''}`}><Money value={projected} cents={false} /></span>
                  <span className="kpi-foot">{projected > total ? <>About <Money value={projected - total} cents={false} /> over</> : <>About <Money value={total - projected} cents={false} /> to spare</>}</span>
                </div>
                <div className="kpi">
                  <span className="kpi-label">Safe to spend</span>
                  <span className="kpi-value"><Money value={Math.max(0, Math.floor(left / daysLeft))} cents={false} /></span>
                  <span className="kpi-foot">per day, across budgets</span>
                </div>
              </div>
            </div>
          </section>

          {sorted.map((b) => (
            <BudgetCard key={b.categoryId} b={b} dom={dom} dim={dim} onEdit={() => setEditing({ categoryId: b.categoryId, amount: b.limit })} />
          ))}
        </div>
      )}

      {editing && <BudgetDialog initial={editing} unbudgeted={unbudgeted.map((c) => c.id)} avg={avg} onClose={() => setEditing(null)} />}
    </div>
  );
}

function BudgetCard({ b, dom, dim, onEdit }: { b: BudgetStatus; dom: number; dim: number; onEdit: () => void }) {
  const c = getCategory(b.categoryId);
  const color = b.state === 'over' ? 'var(--danger)' : b.state === 'watch' ? 'var(--warn)' : c.color;
  const pace = (dom / dim) * 100;
  return (
    <section className="card budget-card span-4" aria-label={`${c.name} budget`}>
      <div className="budget-top">
        <CategoryIcon id={b.categoryId} />
        <div className="row-main">
          <h2 className="card-title">{c.name}</h2>
          <span className={`chip ${STATE_CHIP[b.state]}`} style={{ marginTop: 4 }}>
            {STATE_LABEL[b.state]}
          </span>
        </div>
        <button type="button" className="icon-btn" onClick={onEdit} aria-label={`Edit ${c.name} budget`}>
          <Pencil size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="bar" role="img" aria-label={`${Math.round(b.pct)}% used, forecast ${Math.round((b.projected / b.limit) * 100)}%`} style={{ height: 10 }}>
        <span className="bar-proj" style={{ width: `${Math.min(100, (b.projected / b.limit) * 100)}%`, background: color }} />
        <span style={{ width: `${Math.min(100, b.pct)}%`, background: color }} />
        <i className="bar-marker" style={{ left: `${pace}%` }} title="Where you'd be at an even pace" />
      </div>
      <div className="budget-nums">
        <span>
          <b><Money value={b.spent} cents={false} /></b> of <Money value={b.limit} cents={false} />
        </span>
        <span>
          {b.remaining >= 0 ? (
            <>
              <b><Money value={b.remaining} cents={false} /></b> left
            </>
          ) : (
            <b className="neg">
              <Money value={-b.remaining} cents={false} /> over
            </b>
          )}
        </span>
      </div>
      <p className="muted" style={{ fontSize: 13 }}>
        {b.state === 'over' ? (
          <>Already past the limit. Forecast <Money value={b.projected} cents={false} /> by month end.</>
        ) : b.projected > b.limit ? (
          <>Heading for <Money value={b.projected} cents={false} />. Keep to <Money value={b.dailyAllowance} cents={false} /> a day to stay inside.</>
        ) : (
          <>Forecast <Money value={b.projected} cents={false} />. You can spend about <Money value={b.dailyAllowance} cents={false} /> a day.</>
        )}
      </p>
    </section>
  );
}

function BudgetDialog({ initial, unbudgeted, avg, onClose }: { initial: { categoryId: string; amount?: number }; unbudgeted: string[]; avg: Map<string, number>; onClose: () => void }) {
  const setBudget = useStore((s) => s.setBudget);
  const removeBudget = useStore((s) => s.removeBudget);
  const toast = useUI((s) => s.toast);
  const money = useMoney();
  const editing = initial.amount !== undefined;
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [amount, setAmount] = useState(initial.amount ? String(initial.amount / 100) : '');
  const [error, setError] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  const suggestion = avg.get(categoryId);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const cents = parseMoney(amount);
    if (!cents || cents <= 0) return setError('Enter a monthly amount greater than zero.');
    setBudget(categoryId, cents);
    toast(`${getCategory(categoryId).name} budget saved`);
    onClose();
  };

  return (
    <Modal
      title={editing ? `Edit ${getCategory(categoryId).name} budget` : 'New budget'}
      onClose={onClose}
      initialFocus={ref}
      footer={
        <>
          {editing && (
            <button
              type="button"
              className="btn btn-ghost btn-danger spacer"
              onClick={() => {
                removeBudget(categoryId);
                toast('Budget removed', { label: 'Undo', run: () => setBudget(categoryId, initial.amount!) });
                onClose();
              }}
            >
              Remove
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="budget-form" className="btn btn-primary">
            Save budget
          </button>
        </>
      }
    >
      <form id="budget-form" className="dialog-body" onSubmit={submit} noValidate>
        {!editing && (
          <label className="field">
            <span>Category</span>
            <select className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {unbudgeted.map((id) => (
                <option key={id} value={id}>
                  {getCategory(id).name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="field">
          <span>Monthly limit</span>
          <input ref={ref} className="input num" inputMode="decimal" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={Boolean(error)} aria-describedby="budget-hint" />
          {error && <span className="field-error">{error}</span>}
        </label>
        <p id="budget-hint" className="muted" style={{ fontSize: 13 }}>
          {suggestion ? (
            <>
              You’ve averaged <b className="num money-mask">{money(suggestion, { cents: false })}</b> a month here over the last 3 months.{' '}
              <button type="button" className="link-btn" style={{ padding: 0 }} onClick={() => setAmount(String(Math.ceil(suggestion / 1000) * 10))}>
                Use {money(Math.ceil(suggestion / 1000) * 1000, { cents: false })}
              </button>
            </>
          ) : (
            'No recent spending in this category.'
          )}
        </p>
      </form>
    </Modal>
  );
}
