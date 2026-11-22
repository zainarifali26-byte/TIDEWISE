import { CalendarCheck, Pencil, Plus, Target, Trash2 } from 'lucide-react';
import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Icon } from '../components/CategoryIcon';
import { Ring } from '../components/charts/Donut';
import { Modal } from '../components/Modal';
import { Money, useMoney } from '../components/Money';
import { goalProjection } from '../lib/analytics';
import { addMonths, fmt, today } from '../lib/dates';
import { parseMoney } from '../lib/money';
import type { Goal } from '../lib/types';
import { useStore } from '../store/useStore';
import { useUI } from '../store/ui';

const COLORS = ['#3ddc97', '#38bdf8', '#a78bfa', '#f472b6', '#fbbf24', '#fb923c'];
const ICONS = ['shield', 'plane', 'home', 'laptop', 'gift', 'heart', 'sparkles', 'briefcase'];

export default function Goals() {
  const goals = useStore((s) => s.goals);
  const asOf = today();
  const [editor, setEditor] = useState<{ goal?: Goal } | null>(null);
  const [adding, setAdding] = useState<Goal | null>(null);
  const totalSaved = goals.reduce((s, g) => s + g.saved, 0);
  const totalTarget = goals.reduce((s, g) => s + g.target, 0);
  const monthly = useMemo(() => goals.reduce((s, g) => s + goalProjection(g, asOf).monthlyAvg, 0), [goals, asOf]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Goals</h1>
          <p>Save on purpose. Tidewise forecasts when you’ll get there.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setEditor({})}>
          <Plus size={16} aria-hidden="true" /> New goal
        </button>
      </div>

      {goals.length === 0 ? (
        <section className="card">
          <div className="empty">
            <span className="empty-icon">
              <Target size={24} aria-hidden="true" />
            </span>
            <h3>No goals yet</h3>
            <p>An emergency fund, a trip, a new laptop: name it, set a number and track it.</p>
            <button type="button" className="btn btn-primary" onClick={() => setEditor({})}>
              Create a goal
            </button>
          </div>
        </section>
      ) : (
        <div className="grid grid-dash">
          <section className="card span-12" aria-label="Goals summary">
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 18 }}>
              <div className="kpi">
                <span className="kpi-label">Saved toward goals</span>
                <span className="kpi-value"><Money value={totalSaved} cents={false} /></span>
                <span className="kpi-foot">
                  of <Money value={totalTarget} cents={false} /> ({((totalSaved / (totalTarget || 1)) * 100).toFixed(0)}%)
                </span>
              </div>
              <div className="kpi">
                <span className="kpi-label">Average monthly saving</span>
                <span className="kpi-value"><Money value={monthly} cents={false} /></span>
                <span className="kpi-foot">last 3 months, all goals</span>
              </div>
              <div className="kpi">
                <span className="kpi-label">Active goals</span>
                <span className="kpi-value num">{goals.length}</span>
                <span className="kpi-foot">{goals.filter((g) => g.saved >= g.target).length} completed</span>
              </div>
            </div>
          </section>
          {goals.map((g) => (
            <GoalCard key={g.id} goal={g} asOf={asOf} onEdit={() => setEditor({ goal: g })} onAdd={() => setAdding(g)} />
          ))}
        </div>
      )}

      {editor && <GoalDialog goal={editor.goal} onClose={() => setEditor(null)} />}
      {adding && <ContributeDialog goal={adding} onClose={() => setAdding(null)} />}
    </div>
  );
}

function GoalCard({ goal, asOf, onEdit, onAdd }: { goal: Goal; asOf: string; onEdit: () => void; onAdd: () => void }) {
  const p = goalProjection(goal, asOf);
  const done = p.remaining === 0;
  return (
    <section className="card goal-card span-6" aria-label={goal.name}>
      <div className="goal-head">
        <span className="cat-icon" style={{ background: `color-mix(in srgb, ${goal.color} 16%, transparent)`, color: goal.color }} aria-hidden="true">
          <Icon name={goal.icon} size={17} />
        </span>
        <div className="row-main">
          <h2 className="card-title">{goal.name}</h2>
          <p className="row-sub">{goal.deadline ? `Target date ${fmt.full(goal.deadline)}` : 'No deadline'}</p>
        </div>
        {done ? (
          <span className="chip pos">Reached</span>
        ) : p.onTrack === null ? null : p.onTrack ? (
          <span className="chip pos">On track</span>
        ) : (
          <span className="chip warn">Behind</span>
        )}
      </div>
      <div className="goal-body">
        <Ring pct={p.pct} color={goal.color}>
          <strong className="num">{Math.floor(p.pct)}%</strong>
          <span>saved</span>
        </Ring>
        <div className="goal-stats">
          <div>
            <span>Saved</span>
            <b><Money value={goal.saved} cents={false} /></b>
          </div>
          <div>
            <span>Target</span>
            <b><Money value={goal.target} cents={false} /></b>
          </div>
          <div>
            <span>Monthly pace</span>
            <b><Money value={p.monthlyAvg} cents={false} /></b>
          </div>
          {!done && p.neededPerMonth !== null && (
            <div>
              <span>Needed per month</span>
              <b className={p.onTrack ? '' : 'neg'}><Money value={p.neededPerMonth} cents={false} /></b>
            </div>
          )}
          <div>
            <span>Estimated arrival</span>
            <b style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <CalendarCheck size={14} aria-hidden="true" />
              {done ? 'Done' : p.etaDate ? fmt.monthLong(p.etaDate) : 'Add money to estimate'}
            </b>
          </div>
        </div>
      </div>
      <div className="goal-actions">
        <button type="button" className="btn btn-sm btn-primary" onClick={onAdd}>
          <Plus size={15} aria-hidden="true" /> Add money
        </button>
        <button type="button" className="btn btn-sm" onClick={onEdit}>
          <Pencil size={14} aria-hidden="true" /> Edit
        </button>
      </div>
    </section>
  );
}

function ContributeDialog({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const contribute = useStore((s) => s.contributeGoal);
  const toast = useUI((s) => s.toast);
  const money = useMoney();
  const [amount, setAmount] = useState('');
  const [withdraw, setWithdraw] = useState(false);
  const [error, setError] = useState('');
  const ref = useRef<HTMLInputElement>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const cents = parseMoney(amount);
    if (!cents || cents <= 0) return setError('Enter an amount greater than zero.');
    if (withdraw && cents > goal.saved) return setError(`You can withdraw up to ${money(goal.saved)}.`);
    contribute(goal.id, withdraw ? -cents : cents);
    const after = goal.saved + (withdraw ? -cents : cents);
    toast(after >= goal.target && !withdraw ? `Goal reached: ${goal.name}` : `${withdraw ? 'Withdrew' : 'Added'} ${money(cents)} ${withdraw ? 'from' : 'to'} ${goal.name}`);
    onClose();
  };

  return (
    <Modal
      title={goal.name}
      onClose={onClose}
      initialFocus={ref}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="contrib-form" className="btn btn-primary">
            {withdraw ? 'Withdraw' : 'Add money'}
          </button>
        </>
      }
    >
      <form id="contrib-form" className="dialog-body" onSubmit={submit} noValidate>
        <div className="segmented" role="radiogroup" aria-label="Direction" style={{ justifySelf: 'start' }}>
          <button type="button" role="radio" aria-checked={!withdraw} onClick={() => setWithdraw(false)}>
            Add
          </button>
          <button type="button" role="radio" aria-checked={withdraw} onClick={() => setWithdraw(true)}>
            Withdraw
          </button>
        </div>
        <label className="field">
          <span>Amount</span>
          <div className="amount-input">
            <input ref={ref} className="input num" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={Boolean(error)} />
          </div>
          {error && <span className="field-error">{error}</span>}
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[50, 100, 250, 500].map((v) => (
            <button key={v} type="button" className="btn btn-sm" onClick={() => setAmount(String(v))}>
              {money(v * 100, { cents: false })}
            </button>
          ))}
        </div>
        <p className="muted" style={{ fontSize: 13 }}>
          <Money value={goal.saved} cents={false} /> saved of <Money value={goal.target} cents={false} />.
        </p>
      </form>
    </Modal>
  );
}

function GoalDialog({ goal, onClose }: { goal?: Goal; onClose: () => void }) {
  const addGoal = useStore((s) => s.addGoal);
  const updateGoal = useStore((s) => s.updateGoal);
  const removeGoal = useStore((s) => s.removeGoal);
  const goals = useStore((s) => s.goals);
  const toast = useUI((s) => s.toast);
  const [name, setName] = useState(goal?.name ?? '');
  const [target, setTarget] = useState(goal ? String(goal.target / 100) : '');
  const [saved, setSaved] = useState(goal ? String(goal.saved / 100) : '');
  const [deadline, setDeadline] = useState(goal?.deadline ?? addMonths(today(), 12));
  const [hasDeadline, setHasDeadline] = useState(goal ? Boolean(goal.deadline) : true);
  const [color, setColor] = useState(goal?.color ?? COLORS[1]);
  const [icon, setIcon] = useState(goal?.icon ?? 'plane');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const ref = useRef<HTMLInputElement>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = parseMoney(target);
    const s = saved.trim() ? parseMoney(saved) : 0;
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Give the goal a name.';
    if (!t || t <= 0) errs.target = 'Enter a target greater than zero.';
    if (s === null || s < 0) errs.saved = 'Enter zero or more.';
    if (hasDeadline && deadline <= today()) errs.deadline = 'Pick a date in the future.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const data = { name: name.trim().slice(0, 60), target: t!, color, icon, deadline: hasDeadline ? deadline : undefined };
    if (goal) {
      updateGoal(goal.id, { ...data, saved: s! });
      toast('Goal updated');
    } else {
      addGoal({ ...data, saved: s! });
      toast('Goal created');
    }
    onClose();
  };

  const onDelete = () => {
    if (!goal) return;
    const index = goals.findIndex((g) => g.id === goal.id);
    removeGoal(goal.id);
    toast(`${goal.name} deleted`, {
      label: 'Undo',
      run: () =>
        useStore.setState((st) => {
          const next = [...st.goals];
          next.splice(index, 0, goal);
          return { goals: next };
        }),
    });
    onClose();
  };

  return (
    <Modal
      title={goal ? 'Edit goal' : 'New goal'}
      onClose={onClose}
      initialFocus={ref}
      footer={
        <>
          {goal && (
            <button type="button" className="btn btn-ghost btn-danger spacer" onClick={onDelete}>
              <Trash2 size={15} aria-hidden="true" /> Delete
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="goal-form" className="btn btn-primary">
            {goal ? 'Save goal' : 'Create goal'}
          </button>
        </>
      }
    >
      <form id="goal-form" className="dialog-body" onSubmit={submit} noValidate>
        <label className="field">
          <span>Name</span>
          <input ref={ref} className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Japan in spring" maxLength={60} aria-invalid={Boolean(errors.name)} />
          {errors.name && <span className="field-error">{errors.name}</span>}
        </label>
        <div className="two-col">
          <label className="field">
            <span>Target amount</span>
            <input className="input num" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="0" aria-invalid={Boolean(errors.target)} />
            {errors.target && <span className="field-error">{errors.target}</span>}
          </label>
          <label className="field">
            <span>Already saved</span>
            <input className="input num" inputMode="decimal" value={saved} onChange={(e) => setSaved(e.target.value)} placeholder="0" aria-invalid={Boolean(errors.saved)} />
            {errors.saved && <span className="field-error">{errors.saved}</span>}
          </label>
        </div>
        <div className="field">
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            Target date
            <button type="button" className="switch" role="switch" aria-checked={hasDeadline} aria-label="Has a target date" onClick={() => setHasDeadline((v) => !v)} />
          </span>
          {hasDeadline && <input className="input" type="date" value={deadline} min={today()} onChange={(e) => setDeadline(e.target.value)} aria-invalid={Boolean(errors.deadline)} aria-label="Target date" />}
          {errors.deadline && <span className="field-error">{errors.deadline}</span>}
        </div>
        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend>Icon and colour</legend>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
            {ICONS.map((i) => (
              <button
                key={i}
                type="button"
                className="icon-btn bordered"
                aria-pressed={icon === i}
                aria-label={i}
                onClick={() => setIcon(i)}
                style={icon === i ? { borderColor: color, color } : undefined}
              >
                <Icon name={i} size={17} />
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={color === c}
                aria-label={`Colour ${c}`}
                onClick={() => setColor(c)}
                style={{ width: 30, height: 30, borderRadius: '50%', background: c, border: color === c ? '3px solid var(--text)' : '3px solid transparent' }}
              />
            ))}
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
