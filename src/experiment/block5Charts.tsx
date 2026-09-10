/**
 * block5Charts.tsx — small, dependency-free SVG chart primitives for the results
 * visualization view. Hand-rolled (no charting library) so they compile cleanly, theme
 * to the app, and stay fully under our control.
 *
 * Theming: structural elements (axes, gridlines, tick text) use `currentColor` with opacity.
 * Each chart's <svg> sets `color: var(--chakra-colors-fg)`, so they follow the app's
 * light/dark text color automatically. Data series use an explicit color-blind-safe
 * palette that reads on both light and dark cards. Meaning is never carried by color alone —
 * every series/bar is also labeled.
 *
 * These components only DRAW the values handed to them; they compute no experiment logic.
 */

import { Box } from "@chakra-ui/react";

const AXIS = "currentColor";
/** Inherits the app's light/dark text color so currentColor is theme-aware. */
const SVG_STYLE: React.CSSProperties = { display: "block", height: "auto", color: "var(--chakra-colors-fg)" };

/* --------------------------------- Radar --------------------------------- */

export interface RadarSeries {
  name: string;
  color: string;
  /** one value per axis (same order as `axes`), 0..max */
  values: number[];
  dashed?: boolean;
}

/**
 * Radar / spider chart for a small set of axes (e.g. the 4 policy values) with one or
 * more overlaid series. Great for comparing the SHAPE of two profiles (before vs after).
 */
export function RadarChart({ axes, series, max = 100, fillOpacity = 0.14, showDots = true, axisColor = AXIS }: {
  axes: string[];
  series: RadarSeries[];
  max?: number;
  /**
   * Color of the rings, spokes and spoke labels. Defaults to `currentColor`, which resolves
   * to the app-wide `--chakra-colors-fg` token — correct whenever the chart's surface follows
   * the app's color mode. Pass an explicit color when the surrounding surface is painted
   * from a palette of its own, so the axes cannot end up dark-on-dark.
   */
  axisColor?: string;
  /** Polygon fill alpha. Lower it when many series overlap so the shapes stay readable. */
  fillOpacity?: number;
  /** Vertex dots read well for 1-2 series; they clutter once several overlap. */
  showDots?: boolean;
}) {
  // Wide viewBox so the left/right spoke labels (e.g. "Greatest overall benefit") fit fully
  // inside the SVG instead of being clipped at the edges.
  const W = 480, H = 320, cx = W / 2, cy = H / 2, R = 104;
  const n = axes.length;
  const angle = (i: number) => (-90 + i * (360 / n)) * (Math.PI / 180);
  const pt = (i: number, frac: number): [number, number] => {
    const a = angle(i);
    return [cx + Math.cos(a) * R * frac, cy + Math.sin(a) * R * frac];
  };
  const ringFracs = [0.25, 0.5, 0.75, 1];
  const polyFor = (frac: number) => axes.map((_, i) => pt(i, frac).join(",")).join(" ");
  const seriesPoly = (s: RadarSeries) =>
    s.values.map((v, i) => pt(i, Math.max(0, Math.min(1, v / max))).join(",")).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={SVG_STYLE}>
      {ringFracs.map((f) => (
        <polygon key={f} points={polyFor(f)} fill="none" stroke={axisColor} strokeOpacity={0.14} strokeWidth={1} />
      ))}
      {axes.map((label, i) => {
        const [x, y] = pt(i, 1);
        const a = angle(i);
        const lx = cx + Math.cos(a) * (R + 16);
        const ly = cy + Math.sin(a) * (R + 16);
        const anchor = Math.abs(Math.cos(a)) < 0.3 ? "middle" : Math.cos(a) > 0 ? "start" : "end";
        const dy = Math.abs(Math.sin(a)) < 0.3 ? 0.32 : Math.sin(a) > 0 ? 0.9 : -0.2;
        const words = label.split(" ");
        const mid = Math.ceil(words.length / 2);
        const l1 = words.slice(0, mid).join(" ");
        const l2 = words.slice(mid).join(" ");
        return (
          <g key={label}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke={axisColor} strokeOpacity={0.18} strokeWidth={1} />
            <text x={lx} y={ly} textAnchor={anchor} fontSize={12} fontWeight={600} fill={axisColor} fillOpacity={0.85}>
              <tspan x={lx} dy={`${dy}em`}>{l1}</tspan>
              {l2 && <tspan x={lx} dy="1.05em">{l2}</tspan>}
            </text>
          </g>
        );
      })}
      {series.map((s) => (
        <g key={s.name}>
          <polygon points={seriesPoly(s)} fill={s.color} fillOpacity={fillOpacity} stroke={s.color}
            strokeWidth={2.5} strokeDasharray={s.dashed ? "5 3" : undefined} strokeLinejoin="round" />
          {showDots && s.values.map((v, i) => {
            const [x, y] = pt(i, Math.max(0, Math.min(1, v / max)));
            return <circle key={i} cx={x} cy={y} r={3.5} fill={s.color} />;
          })}
        </g>
      ))}
    </svg>
  );
}

/* ------------------------------ Horizontal bars ------------------------------ */

export interface HBar {
  label: string;
  value: number;
  color: string;
  /** text shown at the end of the bar (defaults to the value) */
  valueLabel?: string;
}

/**
 * Horizontal bar chart with left-aligned labels. Good for comparing a handful of
 * categories (per-scenario scores, time per stage). Axis starts at zero (honest scale).
 */
export function HBarChart({ bars, max, unitHint }: { bars: HBar[]; max: number; unitHint?: string }) {
  const rowH = 34, padT = unitHint ? 22 : 8, padB = 8, labelW = 116, padL = 8, padR = 48;
  const W = 480;
  const plotW = W - labelW - padL - padR;
  const H = padT + bars.length * rowH + padB;
  const scale = (v: number) => (max <= 0 ? 0 : Math.max(0, Math.min(1, v / max)) * plotW);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={SVG_STYLE}>
      {unitHint && <text x={labelW + padL} y={12} fontSize={10} fill={AXIS} fillOpacity={0.5}>{unitHint}</text>}
      {bars.map((b, i) => {
        const y = padT + i * rowH;
        const bw = scale(b.value);
        return (
          <g key={b.label}>
            <text x={padL} y={y + rowH / 2} dy="0.32em" fontSize={11.5} fontWeight={600} fill={AXIS} fillOpacity={0.85}>{b.label}</text>
            <rect x={labelW + padL} y={y + 6} width={plotW} height={rowH - 14} rx={5} fill={AXIS} fillOpacity={0.06} />
            <rect x={labelW + padL} y={y + 6} width={Math.max(bw, 2)} height={rowH - 14} rx={5} fill={b.color} />
            <text x={labelW + padL + Math.max(bw, 2) + 6} y={y + rowH / 2} dy="0.32em" fontSize={11} fontWeight={700} fill={AXIS} fillOpacity={0.75}>
              {b.valueLabel ?? b.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------- Vertical bars ------------------------------- */

export interface VBar { label: string; value: number; color: string; valueLabel?: string; }

/** Vertical bar chart — good for a few ordered categories (e.g. switches per scenario). */
export function VBarChart({ bars, max }: { bars: VBar[]; max: number }) {
  const W = 360, H = 240, padT = 26, padB = 34, padL = 14, padR = 14;
  const plotH = H - padT - padB;
  const slot = (W - padL - padR) / bars.length;
  const barW = Math.min(64, slot * 0.55);
  const scale = (v: number) => (max <= 0 ? 0 : Math.max(0, Math.min(1, v / max)) * plotH);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={SVG_STYLE}>
      <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke={AXIS} strokeOpacity={0.18} />
      {bars.map((b, i) => {
        const cxSlot = padL + slot * i + slot / 2;
        const bh = scale(b.value);
        const x = cxSlot - barW / 2;
        const y = H - padB - bh;
        return (
          <g key={b.label}>
            <rect x={x} y={y} width={barW} height={Math.max(bh, 1)} rx={5} fill={b.color} />
            <text x={cxSlot} y={y - 6} textAnchor="middle" fontSize={12} fontWeight={700} fill={AXIS} fillOpacity={0.8}>{b.valueLabel ?? b.value}</text>
            <text x={cxSlot} y={H - padB + 16} textAnchor="middle" fontSize={11} fontWeight={600} fill={AXIS} fillOpacity={0.7}>{b.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ---------------------------------- Lines ---------------------------------- */

export interface LineSeries { name: string; color: string; values: number[]; }
export interface RefLine { value: number; label: string; }

/**
 * Multi-series line chart over shared, ordered x categories (e.g. Before → after each scenario).
 * Used both for a single trajectory (with an optional dashed reference line) and for the
 * 4-value evolution. Y axis is fixed 0..max with light gridlines.
 */
export function LineChart({ xLabels, series, max = 100, refLine }: {
  xLabels: string[]; series: LineSeries[]; max?: number; refLine?: RefLine;
}) {
  // padL/padR are generous so the first and last x-axis labels (e.g. "Scenario 1",
  // "After S3") are centered under their end points without being clipped at the edges.
  const W = 480, H = 270, padT = 16, padB = 34, padL = 46, padR = 46;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const n = xLabels.length;
  const x = (i: number) => padL + (n <= 1 ? plotW / 2 : (i * plotW) / (n - 1));
  const y = (v: number) => padT + plotH * (1 - Math.max(0, Math.min(1, v / max)));
  const ticks = [0, 25, 50, 75, 100].filter((t) => t <= max);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={SVG_STYLE}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} y1={y(t)} x2={W - padR} y2={y(t)} stroke={AXIS} strokeOpacity={0.1} />
          <text x={padL - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10} fill={AXIS} fillOpacity={0.5}>{t}</text>
        </g>
      ))}
      {refLine && (
        <g>
          <line x1={padL} y1={y(refLine.value)} x2={W - padR} y2={y(refLine.value)} stroke={AXIS}
            strokeOpacity={0.45} strokeWidth={1.5} strokeDasharray="5 3" />
          <text x={W - padR} y={y(refLine.value) - 4} textAnchor="end" fontSize={10} fill={AXIS} fillOpacity={0.6}>{refLine.label}</text>
        </g>
      )}
      {xLabels.map((lbl, i) => (
        <text key={lbl + i} x={x(i)} y={H - padB + 16} textAnchor="middle" fontSize={11} fontWeight={600} fill={AXIS} fillOpacity={0.7}>{lbl}</text>
      ))}
      {series.map((s) => (
        <g key={s.name}>
          <polyline fill="none" stroke={s.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round"
            points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
          {s.values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={3.5} fill={s.color} />)}
        </g>
      ))}
    </svg>
  );
}

/* --------------------------------- Legend --------------------------------- */

export interface LegendItem { label: string; color: string; dashed?: boolean }

/** A small, wrapping legend used under charts (color swatch + label). */
export function ChartLegend({ items }: { items: LegendItem[] }) {
  return (
    <Box display="flex" flexWrap="wrap" gap="3" mt="2" justifyContent="center">
      {items.map((it) => (
        <Box key={it.label} display="inline-flex" alignItems="center" gap="1.5">
          <Box as="span" w="14px" h="0" borderTopWidth="3px" borderTopColor={it.color}
            borderStyle={it.dashed ? "dashed" : "solid"} rounded="full" />
          <Box as="span" fontSize="xs" color="fg.muted">{it.label}</Box>
        </Box>
      ))}
    </Box>
  );
}
