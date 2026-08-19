"use client";

import { useMemo, useState } from "react";
import type { OverviewChart, OverviewRankedItem } from "@/lib/admin/overview-types";

const SERIES_BLUE = "#2a78d6";
const SERIES_ORANGE = "#eb6834";
const SERIES_AQUA = "#1aa86b";
const INK = "#0a1f28";
const MUTED = "#7a8d9a";
const GRID = "#e1e0d9";

const SERIES_COLORS = [SERIES_BLUE, SERIES_ORANGE, SERIES_AQUA];

function colorAt(i: number): string {
  return SERIES_COLORS[i % SERIES_COLORS.length];
}

export function Sparkline({
  values,
  up,
}: {
  values: number[];
  up: boolean;
}) {
  const color = up ? SERIES_AQUA : SERIES_ORANGE;
  const w = 220;
  const h = 40;
  const pad = 3;
  const path = useMemo(() => {
    if (values.length < 2) return { line: "", area: "", last: { x: pad, y: h / 2 } };
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min;
    const step = (w - pad * 2) / (values.length - 1);
    const pts = values.map((v, i) => {
      const x = pad + i * step;
      const y =
        range === 0
          ? h / 2
          : h - pad - ((v - min) / range) * (h - pad * 2);
      return [x, y] as const;
    });
    const line = pts
      .map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
      .join(" ");
    const last = pts[pts.length - 1];
    const area = `${line} L ${last[0].toFixed(1)},${h} L ${pts[0][0].toFixed(1)},${h} Z`;
    return { line, area, last: { x: last[0], y: last[1] } };
  }, [values]);

  if (!path.line) return null;

  return (
    <svg
      className="admin-dash-spark"
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      height={h}
      aria-hidden
    >
      <path d={path.area} fill={color} opacity="0.12" />
      <path
        d={path.line}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle
        cx={path.last.x.toFixed(1)}
        cy={path.last.y.toFixed(1)}
        r="3"
        fill={color}
        stroke="#fff"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function RankedBars({ items }: { items: OverviewRankedItem[] }) {
  const max = Math.max(1, ...items.map((item) => item.value));
  if (items.length === 0) {
    return <p className="admin-dash-empty">Chưa có dữ liệu trong kỳ này.</p>;
  }
  return (
    <div>
      {items.map((item) => (
        <div className="admin-dash-ranked" key={item.label}>
          <div className="admin-dash-ranked-label">{item.label}</div>
          <div className="admin-dash-ranked-track">
            <div
              className="admin-dash-ranked-fill"
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
          <div className="admin-dash-ranked-value">{item.value}%</div>
        </div>
      ))}
    </div>
  );
}

type TooltipState = {
  left: number;
  top: number;
  title: string;
  rows: { name: string; color: string; value: string }[];
};

function ChartTooltip({ tip }: { tip: TooltipState | null }) {
  if (!tip) return null;
  return (
    <div
      className="admin-dash-tooltip"
      style={{ left: tip.left, top: tip.top, opacity: 1 }}
    >
      <div className="admin-dash-tooltip-title">{tip.title}</div>
      {tip.rows.map((row) => (
        <div className="admin-dash-tooltip-row" key={row.name}>
          <span className="admin-dash-tooltip-dot" style={{ background: row.color }} />
          <span>{row.name}:</span>
          <b>{row.value}</b>
        </div>
      ))}
    </div>
  );
}

export function LineChart({ chart }: { chart: OverviewChart }) {
  const [tip, setTip] = useState<TooltipState | null>(null);
  const W = 640;
  const H = 260;
  const ml = 40;
  const mr = 34;
  const mt = 16;
  const mb = 30;
  const plotW = W - ml - mr;
  const plotH = H - mt - mb;
  const n = chart.categories.length;
  const xStep = n > 1 ? plotW / (n - 1) : plotW;

  const allVals = chart.series.flatMap((s) => s.values);
  const maxV = Math.max(0, ...allVals);
  let niceMax = Math.ceil((maxV || 1) / 10) * 10 * 1.15;
  niceMax = Math.ceil(niceMax / 5) * 5 || 5;

  function xAt(i: number) {
    return ml + i * xStep;
  }
  function yAt(v: number) {
    return mt + plotH - (v / niceMax) * plotH;
  }

  const ticks = 4;

  return (
    <div className="admin-dash-chart-wrap">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ display: "block" }}
        role="img"
        aria-label="Biểu đồ doanh thu theo thời gian"
        onMouseMove={(e) => {
          if (n < 1) return;
          const svg = e.currentTarget;
          const rect = svg.getBoundingClientRect();
          const relX = ((e.clientX - rect.left) / rect.width) * W;
          let idx = Math.round((relX - ml) / xStep);
          idx = Math.max(0, Math.min(n - 1, idx));
          setTip({
            left: (xAt(idx) / W) * rect.width,
            top: (mt / H) * rect.height,
            title: chart.categories[idx],
            rows: chart.series.map((s, si) => ({
              name: s.name,
              color: colorAt(si),
              value: `${s.values[idx] ?? 0} ${chart.unit || ""}`.trim(),
            })),
          });
        }}
        onMouseLeave={() => setTip(null)}
      >
        {Array.from({ length: ticks + 1 }, (_, g) => {
          const v = (niceMax / ticks) * g;
          const y = yAt(v);
          return (
            <g key={g}>
              <line
                x1={ml}
                x2={W - mr}
                y1={y}
                y2={y}
                stroke={GRID}
                strokeWidth="1"
              />
              <text
                x={ml - 8}
                y={y + 4}
                textAnchor="end"
                fontSize="10.5"
                fill={MUTED}
              >
                {Math.round(v)}
              </text>
            </g>
          );
        })}
        {chart.categories.map((c, i) => (
          <text
            key={c}
            x={xAt(i)}
            y={H - 8}
            textAnchor="middle"
            fontSize="10.5"
            fill={MUTED}
          >
            {c}
          </text>
        ))}
        {chart.series.map((s, si) => {
          const color = colorAt(si);
          const pts = s.values.map((v, i) => [xAt(i), yAt(v)] as const);
          if (pts.length === 0) return null;
          const line = pts
            .map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
            .join(" ");
          const last = pts[pts.length - 1];
          const area = `${line} L ${last[0].toFixed(1)},${mt + plotH} L ${pts[0][0].toFixed(1)},${mt + plotH} Z`;
          const lastV = s.values[s.values.length - 1];
          return (
            <g key={s.name}>
              <path d={area} fill={color} opacity="0.1" />
              <path
                d={line}
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {pts.map((p, i) => (
                <circle
                  key={i}
                  cx={p[0].toFixed(1)}
                  cy={p[1].toFixed(1)}
                  r={i === pts.length - 1 ? 4 : 3}
                  fill={color}
                  stroke="#fff"
                  strokeWidth="2"
                />
              ))}
              <text
                x={last[0] + 6}
                y={last[1] - 6}
                fontSize="11"
                fontWeight="700"
                fill={INK}
              >
                {lastV}
              </text>
            </g>
          );
        })}
      </svg>
      <ChartLegend series={chart.series} />
      <ChartTooltip tip={tip} />
    </div>
  );
}

export function BarChart({ chart }: { chart: OverviewChart }) {
  const [tip, setTip] = useState<TooltipState | null>(null);
  const W = 500;
  const H = 260;
  const ml = 36;
  const mr = 10;
  const mt = 16;
  const mb = 30;
  const plotW = W - ml - mr;
  const plotH = H - mt - mb;
  const n = chart.categories.length;
  const groupW = n > 0 ? plotW / n : plotW;
  const barGap = 3;
  const barW = Math.min(16, (groupW - barGap * 3) / Math.max(1, chart.series.length));

  const allVals = chart.series.flatMap((s) => s.values);
  const maxV = Math.max(0, ...allVals);
  let niceMax = Math.ceil((maxV || 100) / 100) * 100 * 1.1;
  niceMax = Math.ceil(niceMax / 100) * 100 || 100;

  function yAt(v: number) {
    return mt + plotH - (v / niceMax) * plotH;
  }

  type BarMeta = {
    x: number;
    y: number;
    w: number;
    name: string;
    color: string;
    value: number;
    cat: string;
  };
  const bars: BarMeta[] = [];
  for (let i = 0; i < n; i++) {
    const gx = ml + i * groupW;
    const totalBarsW =
      chart.series.length * barW + (chart.series.length - 1) * barGap;
    const startX = gx + (groupW - totalBarsW) / 2;
    chart.series.forEach((s, si) => {
      const v = s.values[i] || 0;
      bars.push({
        x: startX + si * (barW + barGap),
        y: yAt(v),
        w: barW,
        name: s.name,
        color: colorAt(si),
        value: v,
        cat: chart.categories[i],
      });
    });
  }

  const ticks = 4;

  return (
    <div className="admin-dash-chart-wrap">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ display: "block" }}
        role="img"
        aria-label="Biểu đồ lượt chuyển đổi PPTX và PDF"
        onMouseMove={(e) => {
          const svg = e.currentTarget;
          const rect = svg.getBoundingClientRect();
          const relX = ((e.clientX - rect.left) / rect.width) * W;
          const relY = ((e.clientY - rect.top) / rect.height) * H;
          let best: BarMeta | null = null;
          let bestD = Infinity;
          for (const b of bars) {
            if (relX >= b.x && relX <= b.x + b.w) {
              const d = Math.abs(relY - b.y);
              if (d < bestD) {
                bestD = d;
                best = b;
              }
            }
          }
          if (!best) {
            setTip(null);
            return;
          }
          setTip({
            left: ((best.x + best.w / 2) / W) * rect.width,
            top: (best.y / H) * rect.height,
            title: best.cat,
            rows: [
              {
                name: best.name,
                color: best.color,
                value: String(best.value),
              },
            ],
          });
        }}
        onMouseLeave={() => setTip(null)}
      >
        {Array.from({ length: ticks + 1 }, (_, g) => {
          const v = (niceMax / ticks) * g;
          const y = yAt(v);
          return (
            <g key={g}>
              <line
                x1={ml}
                x2={W - mr}
                y1={y}
                y2={y}
                stroke={GRID}
                strokeWidth="1"
              />
              <text
                x={ml - 6}
                y={y + 4}
                textAnchor="end"
                fontSize="10"
                fill={MUTED}
              >
                {Math.round(v)}
              </text>
            </g>
          );
        })}
        {bars.map((b, i) => (
          <rect
            key={`${b.cat}-${b.name}-${i}`}
            x={b.x.toFixed(1)}
            y={b.y.toFixed(1)}
            width={b.w}
            height={Math.max(0, mt + plotH - b.y).toFixed(1)}
            rx="3"
            fill={b.color}
          />
        ))}
        {chart.categories.map((c, i) => (
          <text
            key={c}
            x={ml + i * groupW + groupW / 2}
            y={H - 8}
            textAnchor="middle"
            fontSize="10"
            fill={MUTED}
          >
            {c}
          </text>
        ))}
      </svg>
      <ChartLegend series={chart.series} />
      <ChartTooltip tip={tip} />
    </div>
  );
}

function ChartLegend({ series }: { series: OverviewChart["series"] }) {
  return (
    <div className="admin-dash-legend">
      {series.map((s, i) => (
        <div className="admin-dash-legend-item" key={s.name}>
          <span
            className="admin-dash-legend-swatch"
            style={{ background: colorAt(i) }}
          />
          {s.name}
        </div>
      ))}
    </div>
  );
}

export function ChartDataTable({
  chart,
  colPrefix,
}: {
  chart: OverviewChart;
  colPrefix?: string;
}) {
  return (
    <table className="admin-dash-data-table">
      <thead>
        <tr>
          <th>{colPrefix || "Mốc"}</th>
          {chart.series.map((s) => (
            <th key={s.name}>
              {s.name}
              {chart.unit ? ` (${chart.unit})` : ""}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {chart.categories.map((cat, i) => (
          <tr key={cat}>
            <td>{cat}</td>
            {chart.series.map((s) => (
              <td key={s.name}>{s.values[i] ?? 0}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
