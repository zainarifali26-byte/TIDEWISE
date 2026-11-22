import { useMemo, useState } from 'react';
import type { MonthFlow } from '../../lib/analytics';
import { fmt } from '../../lib/dates';
import { niceTicks, useWidth } from './useWidth';

interface Props {
  data: MonthFlow[];
  height?: number;
  format: (v: number) => string;
  compact: (v: number) => string;
}

const PAD = { top: 10, bottom: 26 };

/** Grouped income/spending bars per month, with a hover/focus readout. */
export function FlowChart({ data, height = 240, format, compact }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const geo = useMemo(() => {
    const max = Math.max(1, ...data.flatMap((d) => [d.income, d.spending]));
    const { ticks, hi } = niceTicks(0, max, 4);
    const axisW = Math.max(...ticks.map((t) => compact(t).length)) * 7 + 10;
    const innerW = width - axisW;
    const innerH = height - PAD.top - PAD.bottom;
    const slot = innerW / data.length;
    const bw = Math.max(4, Math.min(16, slot * 0.28));
    const y = (v: number) => PAD.top + innerH - (v / (hi || 1)) * innerH;
    return { ticks, y, slot, bw, innerW, innerH };
  }, [data, width, height, compact]);

  const a = active !== null ? data[active] : null;

  return (
    <div className="chart" ref={ref} onMouseLeave={() => setActive(null)}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Monthly income and spending">
        {geo.ticks.map((t) => (
          <g key={t}>
            <line className="grid-line" x1={0} x2={geo.innerW} y1={geo.y(t)} y2={geo.y(t)} />
            <text className="axis num" x={width} y={geo.y(t) + 4} textAnchor="end">
              {compact(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = geo.slot * i + geo.slot / 2;
          const dim = active !== null && active !== i ? 0.35 : 1;
          const showLabel = data.length <= 7 || i % 2 === (data.length - 1) % 2;
          return (
            <g key={d.month} onMouseEnter={() => setActive(i)}>
              <rect x={geo.slot * i} y={PAD.top} width={geo.slot} height={geo.innerH} fill="transparent" />
              <rect
                className="bar-rect"
                x={cx - geo.bw - 2}
                y={geo.y(d.income)}
                width={geo.bw}
                height={Math.max(0, geo.y(0) - geo.y(d.income))}
                rx={Math.min(5, geo.bw / 2)}
                fill="var(--accent)"
                opacity={dim}
                style={{ animationDelay: `${i * 40}ms` }}
              />
              <rect
                className="bar-rect"
                x={cx + 2}
                y={geo.y(d.spending)}
                width={geo.bw}
                height={Math.max(0, geo.y(0) - geo.y(d.spending))}
                rx={Math.min(5, geo.bw / 2)}
                fill="var(--text-2)"
                opacity={dim * 0.55}
                style={{ animationDelay: `${i * 40 + 60}ms` }}
              />
              {showLabel && (
                <text className="axis" x={cx} y={height - 6} textAnchor="middle">
                  {fmt.monthShort(d.month)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {/* Keyboard and screen-reader access to the same numbers */}
      <div className="sr-only">
        <table>
          <caption>Income and spending by month</caption>
          <thead>
            <tr>
              <th>Month</th>
              <th>Income</th>
              <th>Spending</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.month}>
                <td>{fmt.monthLong(d.month)}</td>
                <td>{format(d.income)}</td>
                <td>{format(d.spending)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {a && active !== null && (
        <div className="tooltip" style={{ left: Math.min(Math.max(geo.slot * active + geo.slot / 2, 90), width - 90), top: 0 }}>
          <span className="muted">{fmt.monthLong(a.month)}</span>
          <div className="t-row">
            <i className="cat-dot" style={{ background: 'var(--accent)' }} /> In <b className="num money-mask">{format(a.income)}</b>
          </div>
          <div className="t-row">
            <i className="cat-dot" style={{ background: 'var(--text-2)' }} /> Out <b className="num money-mask">{format(a.spending)}</b>
          </div>
          <div className="t-row">
            Net <b className={`num money-mask ${a.net >= 0 ? 'pos' : 'neg'}`}>{format(a.net)}</b>
          </div>
        </div>
      )}
    </div>
  );
}
