import { CalendarClock, Info } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CategoryIcon } from '../components/CategoryIcon';
import { Money, useMoney } from '../components/Money';
import type { Recurring as R } from '../lib/analytics';
import { getCategory } from '../lib/categories';
import { addDays, addMonths, fmt, fromISO, relativeDay, startOfMonth, toISO } from '../lib/dates';
import { useFinance } from '../lib/useFinance';

const CADENCE = { weekly: 'Weekly', biweekly: 'Every 2 weeks', monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly' } as const;

export default function Recurring() {
  const { recurring, accounts, asOf } = useFinance();
  const [monthOffset, setMonthOffset] = useState(0);
  const money = useMoney();
  const accName = new Map(accounts.map((a) => [a.id, a.name]));
  const subs = recurring.filter((r) => ['subscriptions', 'fitness', 'entertainment'].includes(r.categoryId));
  const bills = recurring.filter((r) => !subs.includes(r));
  const monthly = recurring.reduce((s, r) => s + r.monthlyCost, 0);
  const subMonthly = subs.reduce((s, r) => s + r.monthlyCost, 0);

  // Project every recurring charge onto the shown month.
  const monthStart = addMonths(startOfMonth(asOf), monthOffset);
  const days = useMemo(() => {
    const first = fromISO(monthStart);
    const dim = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const due = new Map<string, R[]>();
    for (const r of recurring) {
      let d = r.lastDate;
      let guard = 0;
      while (d < addDays(monthStart, dim) && guard++ < 60) {
        if (d >= monthStart) due.set(d, [...(due.get(d) ?? []), r]);
        d = r.cadence === 'monthly' ? addMonths(d, 1) : r.cadence === 'yearly' ? addMonths(d, 12) : r.cadence === 'quarterly' ? addMonths(d, 3) : addDays(d, r.intervalDays);
      }
    }
    const lead = (first.getDay() + 6) % 7; // Monday-first
    const cells: ({ date: string; items: R[] } | null)[] = Array.from({ length: lead }, () => null);
    for (let i = 0; i < dim; i++) {
      const date = toISO(new Date(first.getFullYear(), first.getMonth(), i + 1));
      cells.push({ date, items: due.get(date) ?? [] });
    }
    return cells;
  }, [recurring, monthStart]);
  const monthTotal = days.reduce((s, c) => s + (c ? c.items.reduce((a, r) => a + r.amount, 0) : 0), 0);

  const List = ({ items, title }: { items: R[]; title: string }) => (
    <section className="card span-6" aria-label={title}>
      <div className="card-head">
        <h2>{title}</h2>
        <span className="sub">
          <Money value={items.reduce((s, r) => s + r.monthlyCost, 0)} cents={false} /> / month
        </span>
      </div>
      {items.length === 0 ? (
        <p className="empty">Nothing detected yet.</p>
      ) : (
        <ul className="list">
          {items.map((r) => (
            <li className="row" key={r.key}>
              <CategoryIcon id={r.categoryId} />
              <div className="row-main">
                <div className="row-title">{r.merchant}</div>
                <div className="row-sub">
                  {CADENCE[r.cadence]} · {accName.get(r.accountId)} · charged {r.count}×
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="row-amt">
                  {r.varies && <span className="muted" title="Amount varies">~</span>}
                  <Money value={r.amount} />
                </div>
                <div className="row-sub">{relativeDay(r.nextDate, asOf)}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Bills & subscriptions</h1>
          <p>Found automatically in your history: same merchant, steady amount, steady schedule.</p>
        </div>
      </div>

      {recurring.length === 0 ? (
        <section className="card">
          <div className="empty">
            <span className="empty-icon">
              <CalendarClock size={24} aria-hidden="true" />
            </span>
            <h3>No repeating charges yet</h3>
            <p>Once a merchant charges you three times on a regular schedule, it shows up here.</p>
          </div>
        </section>
      ) : (
        <div className="grid grid-dash">
          <section className="card span-12" aria-label="Recurring summary">
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 18 }}>
              <div className="kpi">
                <span className="kpi-label">Fixed costs per month</span>
                <span className="kpi-value"><Money value={monthly} cents={false} /></span>
                <span className="kpi-foot">{recurring.length} repeating charges</span>
              </div>
              <div className="kpi">
                <span className="kpi-label">Subscriptions per year</span>
                <span className="kpi-value"><Money value={subMonthly * 12} cents={false} /></span>
                <span className="kpi-foot">{subs.length} services</span>
              </div>
              <div className="kpi">
                <span className="kpi-label">Next charge</span>
                <span className="kpi-value" style={{ fontSize: 20 }}>{recurring[0].merchant}</span>
                <span className="kpi-foot">
                  {relativeDay(recurring[0].nextDate, asOf)} · <Money value={recurring[0].amount} />
                </span>
              </div>
            </div>
          </section>

          <section className="card span-12" aria-labelledby="cal-title">
            <div className="card-head">
              <div>
                <h2 id="cal-title">{fmt.monthLong(monthStart)}</h2>
                <p className="sub">
                  <Money value={monthTotal} cents={false} /> scheduled
                </p>
              </div>
              <div className="segmented" role="group" aria-label="Month">
                {[0, 1, 2].map((o) => (
                  <button key={o} type="button" aria-pressed={monthOffset === o} onClick={() => setMonthOffset(o)}>
                    {fmt.monthShort(addMonths(startOfMonth(asOf), o))}
                  </button>
                ))}
              </div>
            </div>
            <div className="cal" role="grid" aria-label={`Bills in ${fmt.monthLong(monthStart)}`}>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <div className="cal-dow" key={d} role="columnheader">
                  {d}
                </div>
              ))}
              {days.map((c, i) =>
                c ? (
                  <div
                    key={c.date}
                    role="gridcell"
                    className={`cal-day ${c.date === asOf ? 'today' : ''} ${c.items.length ? 'has' : ''}`}
                    title={c.items.map((r) => r.merchant).join(', ')}
                    aria-label={`${fmt.day(c.date)}${c.items.length ? `: ${c.items.map((r) => r.merchant).join(', ')}` : ''}`}
                  >
                    <span className="num">{Number(c.date.slice(8))}</span>
                    <span className="cal-items" aria-hidden="true">
                      {c.items.slice(0, 2).map((r) => (
                        <span key={r.key} className="cal-item" style={{ ['--c' as string]: getCategory(r.categoryId).color }}>
                          <b>{r.merchant}</b>
                          <span className="num money-mask">{money(r.amount, { cents: false })}</span>
                        </span>
                      ))}
                      {c.items.length > 2 && <span className="cal-more">+{c.items.length - 2} more</span>}
                    </span>
                    <span className="cal-dots" aria-hidden="true">
                      {c.items.slice(0, 4).map((r) => (
                        <i key={r.key} style={{ background: getCategory(r.categoryId).color }} />
                      ))}
                    </span>
                  </div>
                ) : (
                  <div key={`b${i}`} className="cal-day blank" role="gridcell" aria-hidden="true" />
                ),
              )}
            </div>
          </section>

          <List items={subs} title="Subscriptions" />
          <List items={bills} title="Bills" />

          <div className="notice span-12">
            <Info size={18} aria-hidden="true" />
            <span>Detection needs at least three charges. Amounts marked ~ vary from month to month, so the typical recent amount is shown.</span>
          </div>
        </div>
      )}
    </div>
  );
}
