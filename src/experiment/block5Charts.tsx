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

import { useId } from "react";
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
  /**
   * Draws this bar APART from the ones above it: a dashed line across the chart with this label, then
   * the bar (since 28 September 2026, for scenario 6 behind the veil, which has no position and is not
   * part of the Position Effect but is measured on the same scale).
   */
  apartLabel?: string;
  /** Striped rather than solid, so a bar drawn apart never reads as one more category. */
  hatched?: boolean;
  /** A thin line under the bar from the first number to the second (e.g. the nearest and farthest option). */
  range?: [number, number];
}

/**
 * Horizontal bar chart with left-aligned labels. Good for comparing a handful of
 * categories (per-scenario scores, time per stage). Axis starts at zero (honest scale).
 */
export function HBarChart({ bars, max, unitHint }: { bars: HBar[]; max: number; unitHint?: string }) {
  const rowH = 34, padT = unitHint ? 22 : 8, padB = 8, labelW = 116, padL = 8, padR = 48, apartH = 26;
  const W = 480;
  const plotW = W - labelW - padL - padR;
  /* Where each row starts: a bar drawn apart gets room above it for its dashed line and label. */
  const tops: number[] = [];
  let cursor = padT;
  for (const b of bars) {
    if (b.apartLabel) cursor += apartH;
    tops.push(cursor);
    cursor += rowH;
  }
  const H = cursor + padB;
  const scale = (v: number) => (max <= 0 ? 0 : Math.max(0, Math.min(1, v / max)) * plotW);
  const hatchId = useId().replace(/:/g, "");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={SVG_STYLE}>
      {bars.some((b) => b.hatched) && (
        <defs>
          {bars.filter((b) => b.hatched).map((b, i) => (
            <pattern key={i} id={`${hatchId}-${i}`} width={6} height={6} patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
              <rect width={6} height={6} fill={b.color} fillOpacity={0.28} />
              <line x1={0} y1={0} x2={0} y2={6} stroke={b.color} strokeWidth={2.2} />
            </pattern>
          ))}
        </defs>
      )}
      {unitHint && <text x={labelW + padL} y={12} fontSize={10} fill={AXIS} fillOpacity={0.5}>{unitHint}</text>}
      {bars.map((b, i) => {
        const y = tops[i];
        const bw = scale(b.value);
        const hatchIndex = bars.slice(0, i).filter((x) => x.hatched).length;
        return (
          <g key={b.label}>
            {b.apartLabel && (
              <>
                <line x1={padL} y1={y - apartH + 8} x2={W - padR / 2} y2={y - apartH + 8} stroke={AXIS} strokeOpacity={0.35} strokeDasharray="4 4" />
                <text x={padL} y={y - 5} fontSize={9.5} fontWeight={700} fill={AXIS} fillOpacity={0.55} letterSpacing="0.04em">{b.apartLabel.toUpperCase()}</text>
              </>
            )}
            <text x={padL} y={y + rowH / 2} dy="0.32em" fontSize={11.5} fontWeight={600} fill={AXIS} fillOpacity={0.85}>{b.label}</text>
            <rect x={labelW + padL} y={y + 6} width={plotW} height={rowH - 14} rx={5} fill={AXIS} fillOpacity={0.06} />
            <rect x={labelW + padL} y={y + 6} width={Math.max(bw, 2)} height={rowH - 14} rx={5}
              fill={b.hatched ? `url(#${hatchId}-${hatchIndex})` : b.color}
              stroke={b.hatched ? b.color : undefined} strokeDasharray={b.hatched ? "3 2" : undefined} />
            {b.range && (
              <rect x={labelW + padL + scale(Math.min(...b.range))} y={y + rowH - 7}
                width={Math.max(2, scale(Math.max(...b.range)) - scale(Math.min(...b.range)))} height={3} rx={1.5}
                fill={b.color} fillOpacity={0.55} />
            )}
            <text x={labelW + padL + Math.max(bw, 2) + 6} y={y + rowH / 2} dy="0.32em" fontSize={11} fontWeight={700} fill={AXIS} fillOpacity={0.75}>
              {b.valueLabel ?? b.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------- Dumbbell ------------------------------- */

export interface DumbbellRow {
  label: string;
  /** 0-100: the chance the MPF gave its favourite option. */
  favourite: number;
  /** 0-100: the chance it gave the option finally chosen. */
  final: number;
  /** 0-100: the chance it gave the FIRST choice, only when that differs from the final one. */
  first?: number | null;
  /** True when the favourite IS the final choice: one dot with a ring. */
  same: boolean;
  /** 0-100: a blind guess on that menu (1 in 6, or 1 in 4). */
  guess: number;
  /** The line of words under the row. */
  note: string;
}

/**
 * Two dots per row on one 0-100% line (since 28 September 2026, the predictions card): the MPF's
 * favourite and the participant's final choice, at the chance the MPF gave each, joined by a line whose
 * length is the percentage points between them. A dashed tick marks a blind guess; a hollow dot marks a
 * first choice that differs from the final one. Colors come from the caller, with a text label always.
 */
export function DumbbellChart({ rows, colors }: {
  rows: DumbbellRow[]; colors: { favourite: string; choice: string; gap: string };
}) {
  const W = 560, labelW = 66, padL = 6, padR = 16, padT = 20, rowH = 48;
  const x0 = labelW + padL + 6, x1 = W - padR;
  const x = (p: number) => x0 + (Math.max(0, Math.min(100, p)) / 100) * (x1 - x0);
  const H = padT + rows.length * rowH + 4;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={SVG_STYLE}>
      {[0, 50, 100].map((p) => (
        <text key={p} x={x(p)} y={11} fontSize={10} textAnchor={p === 0 ? "start" : p === 100 ? "end" : "middle"}
          fill={AXIS} fillOpacity={0.5}>{p}%</text>
      ))}
      {rows.map((r, i) => {
        const cy = padT + i * rowH + 12;
        return (
          <g key={r.label}>
            <text x={padL} y={cy} dy="0.32em" fontSize={11.5} fontWeight={600} fill={AXIS} fillOpacity={0.85}>{r.label}</text>
            <line x1={x0} y1={cy} x2={x1} y2={cy} stroke={AXIS} strokeOpacity={0.12} strokeWidth={6} strokeLinecap="round" />
            <line x1={x(r.guess)} y1={cy - 9} x2={x(r.guess)} y2={cy + 9} stroke={AXIS} strokeOpacity={0.55} strokeDasharray="2 3" />
            {typeof r.first === "number" && (
              <circle cx={x(r.first)} cy={cy} r={5.5} fill="none" stroke={colors.choice} strokeWidth={2} />
            )}
            {r.same ? (
              <circle cx={x(r.final)} cy={cy} r={6.5} fill={colors.choice} stroke={colors.favourite} strokeWidth={3} />
            ) : (
              <>
                <line x1={x(r.final)} y1={cy} x2={x(r.favourite)} y2={cy} stroke={colors.gap} strokeWidth={3} />
                <circle cx={x(r.favourite)} cy={cy} r={6.5} fill={colors.favourite} />
                <circle cx={x(r.final)} cy={cy} r={6.5} fill={colors.choice} />
              </>
            )}
            <text x={x0} y={cy + 22} fontSize={10.5} fill={AXIS} fillOpacity={0.7}>{r.note}</text>
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
export interface RefLine { value: number; label: string; /** Line and label color; the axis gray when absent. */ color?: string; }

/**
 * Multi-series line chart over shared, ordered x categories (e.g. Before → after each scenario).
 * Used both for a single trajectory (with an optional dashed reference line) and for the
 * 4-value evolution. Y axis is fixed 0..max with light gridlines.
 */
export function LineChart({ xLabels, series, max = 100, refLine, refLines }: {
  xLabels: string[]; series: LineSeries[]; max?: number; refLine?: RefLine;
  /** Several dashed reference lines (since 28 September 2026: VCI and VCI_all on the consistency card). */
  refLines?: RefLine[];
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
      {/* Reference lines, highest first. When two sit within 12 units of each other, the lower one's
          label goes UNDER its line, so the two labels never print on top of each other. */}
      {[...(refLine ? [refLine] : []), ...(refLines ?? [])]
        .sort((a, b) => b.value - a.value)
        .map((ref, i, all) => {
          const crowded = i > 0 && Math.abs(y(ref.value) - y(all[i - 1].value)) < 12;
          const stroke = ref.color ?? AXIS;
          return (
            <g key={`${ref.label}-${i}`}>
              <line x1={padL} y1={y(ref.value)} x2={W - padR} y2={y(ref.value)} stroke={stroke}
                strokeOpacity={ref.color ? 0.75 : 0.45} strokeWidth={1.5} strokeDasharray="5 3" />
              <text x={W - padR} y={y(ref.value) + (crowded ? 12 : -4)} textAnchor="end" fontSize={10}
                fill={stroke} fillOpacity={ref.color ? 0.9 : 0.6} fontWeight={ref.color ? 600 : 400}>{ref.label}</text>
            </g>
          );
        })}
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
