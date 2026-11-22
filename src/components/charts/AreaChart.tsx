import { useId, useMemo, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { Point } from '../../lib/analytics';
import { fmt } from '../../lib/dates';
import { niceTicks, smoothPath, useWidth } from './useWidth';

interface Props {
  data: Point[];
  height?: number;
  format: (v: number) => string;
  compact: (v: number) => string;
  label: string;
}

const PAD = { top: 12, right: 8, bottom: 26, left: 0 };

export function AreaChart({ data, height = 240, format, compact, label }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const gid = useId().replace(/:/g, '');

  const geo = useMemo(() => {
    const values = data.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = (max - min) * 0.12 || Math.abs(max) * 0.05 || 100;
    const { ticks, lo, hi } = niceTicks(min - pad, max + pad, 4);
    const axisW = Math.max(...ticks.map((t) => compact(t).length)) * 7 + 10;
    const innerW = Math.max(10, width - PAD.left - PAD.right - axisW);
    const innerH = height - PAD.top - PAD.bottom;
    const x = (i: number) => PAD.left + (data.length < 2 ? innerW / 2 : (i / (data.length - 1)) * innerW);
    const y = (v: number) => PAD.top + innerH - ((v - lo) / (hi - lo || 1)) * innerH;
    const pts = data.map((p, i) => [x(i), y(p.value)] as [number, number]);
    const line = smoothPath(pts);
    const area = pts.length ? `${line}L${pts[pts.length - 1][0]},${PAD.top + innerH}L${pts[0][0]},${PAD.top + innerH}Z` : '';
    const len = pts.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0) * 1.05;
    const labelCount = Math.max(2, Math.min(6, Math.floor(innerW / 90)));
    const xLabels = Array.from({ length: labelCount }, (_, k) => Math.round((k / (labelCount - 1)) * (data.length - 1)));
    return { ticks, y, x, pts, line, area, len, innerW, innerH, axisW, xLabels };
  }, [data, width, height, compact]);

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left - PAD.left;
    const i = Math.round((px / geo.innerW) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };

  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const step = Math.max(1, Math.round(data.length / 30));
    setHover((h) => {
      const cur = h ?? data.length - 1;
      if (e.key === 'Home') return 0;
      if (e.key === 'End') return data.length - 1;
      return Math.max(0, Math.min(data.length - 1, cur + (e.key === 'ArrowLeft' ? -step : step)));
    });
  };

  if (!data.length) return null;
  const h = hover !== null ? data[hover] : null;
  const first = data[0].value;
  const last = data[data.length - 1].value;

  return (
    <div className="chart" ref={ref}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${label}: from ${format(first)} on ${fmt.full(data[0].date)} to ${format(last)} on ${fmt.full(data[data.length - 1].date)}. Use arrow keys to explore.`}
        tabIndex={0}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`g${gid}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {geo.ticks.map((t) => (
          <g key={t}>
            <line className="grid-line" x1={PAD.left} x2={PAD.left + geo.innerW} y1={geo.y(t)} y2={geo.y(t)} />
            <text className="axis num" x={width - PAD.right} y={geo.y(t) + 4} textAnchor="end">
              {compact(t)}
            </text>
          </g>
        ))}
        {geo.xLabels.map((i, k) => (
          <text
            key={`${i}-${k}`}
            className="axis"
            x={geo.x(i)}
            y={height - 6}
            textAnchor={k === 0 ? 'start' : k === geo.xLabels.length - 1 ? 'end' : 'middle'}
          >
            {data.length > 120 ? fmt.monthShort(data[i].date) : fmt.short(data[i].date)}
          </text>
        ))}
        <path className="area" d={geo.area} fill={`url(#g${gid})`} />
        <path key={`${data.length}-${data[0].date}`} className="line draw" d={geo.line} style={{ ['--len' as string]: geo.len }} />
        {h && hover !== null && (
          <g>
            <line className="crosshair" x1={geo.pts[hover][0]} x2={geo.pts[hover][0]} y1={PAD.top} y2={PAD.top + geo.innerH} />
            <circle className="dot" cx={geo.pts[hover][0]} cy={geo.pts[hover][1]} r={5.5} />
          </g>
        )}
      </svg>
      {h && hover !== null && (
        <div
          className="tooltip"
          style={{ left: Math.min(Math.max(geo.pts[hover][0], 70), width - 70), top: Math.max(0, geo.pts[hover][1] - 64) }}
          aria-live="polite"
        >
          <span className="muted">{fmt.full(h.date)}</span>
          <strong className="num money-mask">{format(h.value)}</strong>
        </div>
      )}
    </div>
  );
}
