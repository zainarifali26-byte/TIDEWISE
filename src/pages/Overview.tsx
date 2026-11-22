import { AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, CalendarClock, Lightbulb, PiggyBank, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CategoryIcon } from '../components/CategoryIcon';
import { AreaChart } from '../components/charts/AreaChart';
import { Donut } from '../components/charts/Donut';
import { FlowChart } from '../components/charts/FlowChart';
import { Money, useMoney } from '../components/Money';
import { useCountUp } from '../components/useCountUp';
import { budgetStatus, buildInsights, monthlyCashflow, netWorthSeries, spendingByCategory, upcoming } from '../lib/analytics';
import { getCategory } from '../lib/categories';
import { addDays, addMonths, fmt, relativeDay, startOfMonth } from '../lib/dates';
import { useFinance } from '../lib/useFinance';
import { useStore } from '../store/useStore';
import { useUI } from '../store/ui';

const RANGES = [
  { id: '1M', days: 30 },
  { id: '3M', days: 91 },
  { id: '6M', days: 182 },
  { id: '1Y', days: 365 },
] as const;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Overview() {
  const { accounts, transactions, recurring, netWorth, asOf } = useFinance();
  const budgets = useStore((s) => s.budgets);
  const name = useStore((s) => s.settings.name);
  const openTx = useUI((s) => s.openTx);
  const money = useMoney();
  const compact = (v: number) => money(v, { compact: true });
  const whole = (v: number) => money(v, { cents: false });

  const [range, setRange] = useState<(typeof RANGES)[number]['id']>('6M');
  const [flowMonths, setFlowMonths] = useState(6);
  const [catMonth, setCatMonth] = useState<'this' | 'last'>('this');
  const [activeCat, setActiveCat] = useState<string | null>(null);

  const earliest = transactions.length ? transactions[transactions.length - 1].date : asOf;
  const days = RANGES.find((r) => r.id === range)!.days;
  const from = addDays(asOf, -days) < earliest ? earliest : addDays(asOf, -days);
  const series = useMemo(() => netWorthSeries(accounts, transactions, from, asOf), [accounts, transactions, from, asOf]);
  const change = series.length ? series[series.length - 1].value - series[0].value : 0;
  const changePct = series.length && series[0].value ? (change / Math.abs(series[0].value)) * 100 : 0;
  const animated = useCountUp(netWorth);

  const monthStart = startOfMonth(asOf);
  const flows = useMemo(() => monthlyCashflow(transactions, asOf, flowMonths), [transactions, asOf, flowMonths]);
  const thisMonth = flows[flows.length - 1];
  const insights = useMemo(() => buildInsights(transactions, budgets, recurring, asOf, whole), [transactions, budgets, recurring, asOf, money]);
  const bills = useMemo(() => upcoming(recurring, asOf, 14), [recurring, asOf]);
  const billTotal = bills.reduce((s, b) => s + b.amount, 0);

  const catRange = catMonth === 'this' ? [monthStart, asOf] : [addMonths(monthStart, -1), addDays(monthStart, -1)];
  const cats = useMemo(() => spendingByCategory(transactions, catRange[0], catRange[1]), [transactions, catRange[0], catRange[1]]);
  const catTotal = cats.reduce((s, c) => s + c.total, 0);
  const topCats = cats.slice(0, 6);
  const otherTotal = cats.slice(6).reduce((s, c) => s + c.total, 0);
  const segments = [
    ...topCats.map((c) => ({ id: c.categoryId, value: c.total, color: getCategory(c.categoryId).color, label: getCategory(c.categoryId).name })),
    ...(otherTotal ? [{ id: 'other', value: otherTotal, color: 'var(--muted)', label: 'Everything else' }] : []),
  ];
  const activeSeg = segments.find((s) => s.id === activeCat);

  const bstat = useMemo(() => budgetStatus(budgets, transactions, asOf, recurring), [budgets, transactions, asOf, recurring]);
  const watchList = [...bstat].sort((a, b) => b.projected / b.limit - a.projected / a.limit).slice(0, 4);
  const recent = transactions.slice(0, 7);
  const savedPct = thisMonth?.income ? Math.max(0, (thisMonth.net / thisMonth.income) * 100) : 0;

  const insightIcon = { good: TrendingUp, warn: AlertTriangle, info: Lightbulb } as const;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>
            {greeting()}, {name}
          </h1>
          <p>Here’s where your money stands on {fmt.day(asOf)}.</p>
        </div>
      </div>

      <div className="grid grid-dash">
        <section className="card hero span-8" aria-labelledby="nw-title">
          <div className="hero-top">
            <div>
              <h2 className="eyebrow" id="nw-title">
                Net worth
              </h2>
              <div className="big-num num money-mask" aria-live="off">
                {money(animated, { cents: false })}
              </div>
              <div className="delta">
                <span className={`chip ${change >= 0 ? 'pos' : 'neg'}`}>
                  {change >= 0 ? <ArrowUpRight size={14} aria-hidden="true" /> : <ArrowDownRight size={14} aria-hidden="true" />}
                  {Math.abs(changePct).toFixed(1)}%
                </span>
                <span className="muted">
                  <Money value={change} sign cents={false} /> in the last {range === '1Y' ? 'year' : range === '1M' ? 'month' : `${range.replace('M', '')} months`}
                </span>
              </div>
            </div>
            <div className="segmented" role="group" aria-label="Chart range">
              {RANGES.map((r) => (
                <button key={r.id} type="button" aria-pressed={range === r.id} onClick={() => setRange(r.id)}>
                  {r.id}
                </button>
              ))}
            </div>
          </div>
          <AreaChart data={series} format={whole} compact={compact} label="Net worth over time" height={250} />
        </section>

        <section className="card span-4" aria-labelledby="month-title">
          <div className="card-head">
            <div>
              <h2 id="month-title">{fmt.monthLong(asOf)}</h2>
              <p className="sub">Month to date</p>
            </div>
            <Link className="link-btn" to="/transactions">
              Details <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
          <div className="grid" style={{ gap: 14 }}>
            <div className="kpi">
              <span className="kpi-label">
                <span className="kpi-icon" style={{ color: 'var(--pos)' }}>
                  <TrendingUp size={16} aria-hidden="true" />
                </span>
                Money in
              </span>
              <span className="kpi-value">
                <Money value={thisMonth?.income ?? 0} cents={false} />
              </span>
            </div>
            <div className="kpi">
              <span className="kpi-label">
                <span className="kpi-icon">
                  <TrendingDown size={16} aria-hidden="true" />
                </span>
                Money out
              </span>
              <span className="kpi-value">
                <Money value={thisMonth?.spending ?? 0} cents={false} />
              </span>
            </div>
            <div className="kpi">
              <span className="kpi-label">
                <span className="kpi-icon" style={{ color: 'var(--accent)' }}>
                  <PiggyBank size={16} aria-hidden="true" />
                </span>
                Kept so far
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span className="kpi-value">
                  <Money value={thisMonth?.net ?? 0} cents={false} />
                </span>
                {(thisMonth?.net ?? 0) >= 0 ? (
                  <span className="chip pos num">{savedPct.toFixed(0)}% of income</span>
                ) : (
                  <span className="chip warn">More out than in so far</span>
                )}
              </div>
              <div className="bar" aria-hidden="true">
                <span style={{ width: `${Math.min(100, savedPct)}%`, background: 'var(--accent)' }} />
              </div>
            </div>
          </div>
        </section>

        {insights.length > 0 && (
          <section className="card span-12" aria-labelledby="ins-title">
            <div className="card-head">
              <h2 id="ins-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={16} aria-hidden="true" style={{ color: 'var(--accent)' }} /> Insights
              </h2>
              <span className="sub">Calculated from your own transactions</span>
            </div>
            <div className="insights">
              {insights.map((i) => {
                const I = insightIcon[i.tone];
                return (
                  <Link key={i.id} to={i.to ?? '/'} className={`insight ${i.tone}`}>
                    <span className="insight-icon">
                      <I size={16} aria-hidden="true" />
                    </span>
                    <span>
                      <h3 className="money-mask">{i.title}</h3>
                      <p className="money-mask">{i.body}</p>
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <section className="card span-7" aria-labelledby="flow-title">
          <div className="card-head">
            <div>
              <h2 id="flow-title">Cash flow</h2>
              <div className="legend" style={{ marginTop: 6 }}>
                <span>
                  <i className="cat-dot" style={{ background: 'var(--accent)' }} /> Money in
                </span>
                <span>
                  <i className="cat-dot" style={{ background: 'var(--text-2)', opacity: 0.55 }} /> Money out
                </span>
              </div>
            </div>
            <div className="segmented" role="group" aria-label="Months shown">
              {[6, 12].map((m) => (
                <button key={m} type="button" aria-pressed={flowMonths === m} onClick={() => setFlowMonths(m)}>
                  {m}M
                </button>
              ))}
            </div>
          </div>
          <FlowChart data={flows} format={whole} compact={compact} height={250} />
        </section>

        <section className="card span-5" aria-labelledby="cat-title">
          <div className="card-head">
            <h2 id="cat-title">Spending by category</h2>
            <div className="segmented" role="group" aria-label="Month">
              <button type="button" aria-pressed={catMonth === 'this'} onClick={() => setCatMonth('this')}>
                {fmt.monthShort(asOf)}
              </button>
              <button type="button" aria-pressed={catMonth === 'last'} onClick={() => setCatMonth('last')}>
                {fmt.monthShort(addMonths(asOf, -1))}
              </button>
            </div>
          </div>
          {catTotal === 0 ? (
            <p className="empty">No spending in this period yet.</p>
          ) : (
            <div className="donut-wrap">
              <Donut
                segments={segments}
                active={activeCat}
                onActive={setActiveCat}
                center={
                  <>
                    <strong className="num money-mask">{money(activeSeg ? activeSeg.value : catTotal, { cents: false })}</strong>
                    <span>{activeSeg ? activeSeg.label : 'Total spent'}</span>
                  </>
                }
              />
              <div className="cat-legend">
                {segments.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={activeCat === s.id ? 'on' : ''}
                    onMouseEnter={() => setActiveCat(s.id)}
                    onMouseLeave={() => setActiveCat(null)}
                    onFocus={() => setActiveCat(s.id)}
                    onBlur={() => setActiveCat(null)}
                  >
                    <i className="cat-dot" style={{ background: s.color }} />
                    <span>{s.label}</span>
                    <Money value={s.value} cents={false} />
                    <span className="pct num">{((s.value / catTotal) * 100).toFixed(0)}%</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="card span-4" aria-labelledby="bills-title">
          <div className="card-head">
            <div>
              <h2 id="bills-title">Coming up</h2>
              <p className="sub">
                Next 14 days · <Money value={billTotal} cents={false} />
              </p>
            </div>
            <Link className="link-btn" to="/recurring">
              All bills <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
          {bills.length === 0 ? (
            <div className="empty">
              <span className="empty-icon">
                <CalendarClock size={22} aria-hidden="true" />
              </span>
              Nothing due in the next two weeks.
            </div>
          ) : (
            <ul className="list">
              {bills.slice(0, 5).map((b) => (
                <li className="row" key={b.key}>
                  <CategoryIcon id={b.categoryId} />
                  <div className="row-main">
                    <div className="row-title">{b.merchant}</div>
                    <div className="row-sub">{relativeDay(b.nextDate, asOf)}</div>
                  </div>
                  <span className="row-amt">
                    {b.varies && <span className="muted">~</span>}
                    <Money value={b.amount} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card span-4" aria-labelledby="bud-title">
          <div className="card-head">
            <div>
              <h2 id="bud-title">Budgets to watch</h2>
              <p className="sub">Projected to month end</p>
            </div>
            <Link className="link-btn" to="/budgets">
              Budgets <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
          {watchList.length === 0 ? (
            <p className="empty">No budgets yet.</p>
          ) : (
            <ul className="list">
              {watchList.map((b) => {
                const c = getCategory(b.categoryId);
                const color = b.state === 'over' ? 'var(--danger)' : b.state === 'watch' ? 'var(--warn)' : c.color;
                return (
                  <li key={b.categoryId} className="row" style={{ display: 'grid', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13.5 }}>
                      <span style={{ fontWeight: 600 }}>{c.name}</span>
                      <span className="muted">
                        <Money value={b.spent} cents={false} /> / <Money value={b.limit} cents={false} />
                      </span>
                    </div>
                    <div className="bar" role="img" aria-label={`${c.name}: ${Math.round(b.pct)}% used`}>
                      <span className="bar-proj" style={{ width: `${Math.min(100, (b.projected / b.limit) * 100)}%`, background: color }} />
                      <span style={{ width: `${Math.min(100, b.pct)}%`, background: color }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card span-4" aria-labelledby="recent-title">
          <div className="card-head">
            <h2 id="recent-title">Recent activity</h2>
            <Link className="link-btn" to="/transactions">
              See all <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
          <ul className="list">
            {recent.map((t) => (
              <li key={t.id}>
                <button type="button" className="row" style={{ width: '100%', border: 0, background: 'none', textAlign: 'left', cursor: 'pointer' }} onClick={() => openTx(t)}>
                  <CategoryIcon id={t.categoryId} />
                  <span className="row-main">
                    <span className="row-title" style={{ display: 'block' }}>
                      {t.merchant}
                    </span>
                    <span className="row-sub" style={{ display: 'block' }}>
                      {getCategory(t.categoryId).name} · {relativeDay(t.date, asOf)}
                    </span>
                  </span>
                  <Money className="row-amt" value={t.amount} colored sign />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
