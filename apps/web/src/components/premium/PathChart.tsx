import { Text } from "@mantine/core";
import { useElementSize } from "@mantine/hooks";
import { useState, type KeyboardEvent } from "react";
import { money } from "../../format";
import type { RenewalRun } from "../../premiumGraphql";
import { tokens } from "../../theme";
import { signedPctText } from "./RenewalRail";

export interface PathPoint {
  year: number;
  label: string;
  name: string;
  premium: number;
  change: number | null;
}

export function pathPoints(startPremium: number, runs: RenewalRun[]): PathPoint[] {
  return [
    { year: 0, label: "Start", name: "Premium before any renewals", premium: startPremium, change: null },
    ...runs.map((r) => ({ year: r.year, label: r.event.shortLabel, name: r.event.name, premium: r.premiumAfter, change: r.changePct })),
  ];
}

/** Round tick step for a range: 1, 2 or 5 times a power of ten. */
export function niceStep(range: number, target = 4) {
  const raw = range / target;
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

/** Axis label precise enough that neighbouring ticks never read the same. */
export function tickLabel(v: number, step: number) {
  if (v < 1000 || step < 100) return `$${Math.round(v).toLocaleString("en-US")}`;
  return `$${(v / 1000).toFixed(step >= 1000 ? 0 : 1)}K`;
}

const H = 280;
const M = { top: 44, right: 28, bottom: 36, left: 56 };

/** Premium by renewal year, each point labelled by the event that caused it. Single series, so no legend. */
export function PathChart({ points }: { points: PathPoint[] }) {
  const { ref, width } = useElementSize();
  const [active, setActive] = useState<number | null>(null);
  const w = Math.max(width, 280);
  const innerW = w - M.left - M.right;
  const innerH = H - M.top - M.bottom;

  const values = points.map((p) => p.premium);
  const step = niceStep(Math.max(...values) - Math.min(...values) || Math.max(...values) * 0.2);
  const yMin = Math.max(0, Math.floor((Math.min(...values) * 0.97) / step) * step);
  const yMax = Math.ceil((Math.max(...values) * 1.03) / step) * step;
  const ticks: number[] = [];
  for (let t = yMin; t <= yMax + 1e-9; t += step) ticks.push(t);

  const lastYear = Math.max(points.length - 1, 1);
  const x = (i: number) => M.left + (innerW * i) / lastYear;
  const y = (v: number) => M.top + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH;
  const spacing = innerW / lastYear;
  // Alternate labels above and below the line when points are close, so they don't collide
  const stagger = spacing < 110;

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") setActive((a) => Math.min((a ?? -1) + 1, points.length - 1));
    else if (e.key === "ArrowLeft") setActive((a) => Math.max((a ?? points.length) - 1, 0));
    else if (e.key === "Escape") setActive(null);
    else return;
    e.preventDefault();
  };

  const hovered = active !== null ? points[active] : null;
  const pointColor = (p: PathPoint) => (p.change === null ? tokens.steel : p.change > 0 ? tokens.breach : tokens.cleared);
  const line = points.map((p, i) => `${i ? "L" : "M"} ${x(i)} ${y(p.premium)}`).join(" ");

  return (
    <div
      ref={ref}
      className="path-chart"
      tabIndex={0}
      role="group"
      aria-label={`Premium path over ${points.length - 1} renewal years. Use the arrow keys to step through years.`}
      onKeyDown={onKey}
      onBlur={() => setActive(null)}
      style={{ position: "relative" }}
    >
      <svg width={w} height={H} role="img" aria-hidden style={{ display: "block", overflow: "visible" }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={w - M.right} y1={y(t)} y2={y(t)} stroke={tokens.line} strokeWidth={1} />
            <text x={M.left - 10} y={y(t)} textAnchor="end" dominantBaseline="central" fontSize={13} fill={tokens.steel} className="num">
              {tickLabel(t, step)}
            </text>
          </g>
        ))}
        {points.map((p, i) => (
          <text key={`x-${p.year}`} x={x(i)} y={H - 10} textAnchor="middle" fontSize={13} fill={tokens.steel}>
            {p.year === 0 ? "Now" : `Year ${p.year}`}
          </text>
        ))}

        {hovered && active !== null && <line x1={x(active)} x2={x(active)} y1={M.top - 8} y2={M.top + innerH} stroke={tokens.steel} strokeWidth={1} />}

        <path d={line} fill="none" stroke={tokens.ink} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {points.map((p, i) => {
          const above = !stagger || i % 2 === 0;
          return (
            <g key={p.year}>
              <circle cx={x(i)} cy={y(p.premium)} r={active === i ? 7 : 5} fill={pointColor(p)} stroke={tokens.surface} strokeWidth={2} />
              <text
                x={x(i)}
                y={y(p.premium) + (above ? -14 : 24)}
                textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
                fontSize={13}
                fontWeight={600}
                fill={tokens.ink}
                style={{ paintOrder: "stroke", stroke: tokens.surface, strokeWidth: 4 }}
              >
                {p.label}
              </text>
            </g>
          );
        })}

        {/* Hit areas: one column per year, wider than the dot */}
        {points.map((p, i) => {
          const left = Math.max(0, x(i) - spacing / 2);
          const right = Math.min(w, x(i) + spacing / 2);
          return (
          <rect
            key={`hit-${p.year}`}
            x={left}
            y={M.top - 20}
            width={right - left}
            height={innerH + 28}
            fill="transparent"
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
          />
          );
        })}
      </svg>

      {hovered && active !== null && (
        <div
          className="chart-tooltip"
          style={{
            left: Math.min(Math.max(x(active) - 110, 0), w - 220),
            top: Math.max(y(hovered.premium) - 96, 0),
          }}
        >
          <Text fz={13} c={tokens.steel}>
            {hovered.year === 0 ? "Before renewals" : `Year ${hovered.year}`}
          </Text>
          <Text fz={15} fw={600}>
            {hovered.name}
          </Text>
          <Text fz={15} className="num">
            {money(hovered.premium)}
            {hovered.change !== null && (
              <Text span fz={15} c={hovered.change > 0 ? tokens.breach : tokens.clearedInk} ml={8}>
                {signedPctText(hovered.change)}
              </Text>
            )}
          </Text>
        </div>
      )}
    </div>
  );
}
