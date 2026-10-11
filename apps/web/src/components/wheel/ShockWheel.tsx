import { useElementSize } from "@mantine/hooks";
import { tokens } from "../../theme";
import { polar, sliceStep, sliceTone, wrapLabel } from "../../wheelMath";

export interface WheelItem {
  id: string;
  shortLabel: string;
  color: string;
}

interface Props {
  items: WheelItem[];
  rotation: number;
  flap: number;
  /** Rotation the labels are oriented for (the resting angle), so they don't flip mid-spin. */
  labelRotation: number;
  /** Slice under the pointer once landed; gets the brass outline and fills the hub. */
  landedIndex: number | null;
  /** Rendered width cap in px. */
  maxWidth?: number;
  /** Accessible name, e.g. "Renewal wheel" */
  label?: string;
}

const VB_W = 440;
const C = 220; // centre x
const CY = 232; // centre y, leaves room for the flapper above the rim
const R = 200;
const HUB_R = 52;
const LABEL_R = 126;
const LABEL_SPAN = R - HUB_R - 24; // radial room for a label
const PIVOT_Y = 8;

const mod360 = (d: number) => ((d % 360) + 360) % 360;

function slicePath(i: number, count: number) {
  const step = sliceStep(count);
  const a = polar(C, CY, R, i * step);
  const b = polar(C, CY, R, (i + 1) * step);
  return `M ${C} ${CY} L ${a.x} ${a.y} A ${R} ${R} 0 0 1 ${b.x} ${b.y} Z`;
}

/**
 * The shock wheel. Purely presentational: rotation and flapper angle come from useWheelSpin.
 * Label size is computed from the rendered width so text never drops below 13px on screen.
 */
export function ShockWheel({ items, rotation, flap, labelRotation, landedIndex, maxWidth = 440, label = "Shock wheel" }: Props) {
  const { ref, width } = useElementSize();
  const count = items.length;
  const step = sliceStep(count || 1);
  const rendered = width || maxWidth;
  // 13.5px on screen at any size: scale the viewBox font up as the wheel renders smaller
  const font = (13.5 * VB_W) / rendered;
  const lineH = font * 1.15;
  const capacity = Math.max(6, Math.floor(LABEL_SPAN / (font * 0.56)));
  const hubCapacity = Math.max(5, Math.floor((HUB_R * 1.6) / (font * 0.56)));
  const landed = landedIndex !== null ? items[landedIndex] : undefined;
  const hubLines = landed ? wrapLabel(landed.shortLabel, hubCapacity, 3) : [];

  return (
    <div ref={ref} style={{ width: "100%", maxWidth, margin: "0 auto" }}>
      <svg
        viewBox={`0 0 ${VB_W} ${CY + R + 8}`}
        width="100%"
        role="img"
        aria-label={landed ? `${label}, landed on ${landed.shortLabel}` : `${label} with ${count} slices`}
        style={{ display: "block", overflow: "visible" }}
      >
        <g style={{ transform: `rotate(${rotation}deg)`, transformOrigin: `${C}px ${CY}px` }}>
          {items.map((item, i) => {
            const tone = sliceTone(i, item.color);
            const mid = (i + 0.5) * step;
            const lines = wrapLabel(item.shortLabel, capacity, 2);
            // Radial: read from the hub outward; flip on the left half so nothing is upside down
            const restsLeft = mod360(mid + labelRotation) > 180;
            const flip = restsLeft ? ` rotate(180 ${C + LABEL_R} ${CY})` : "";
            return (
              <g key={item.id}>
                <path d={slicePath(i, count)} fill={tone.fill} />
                <text
                  transform={`rotate(${mid - 90} ${C} ${CY})${flip}`}
                  textAnchor="middle"
                  fill={tone.label}
                  style={{ fontFamily: "var(--mantine-font-family-headings)", fontWeight: 600, fontSize: font }}
                >
                  {lines.map((line, j) => (
                    <tspan key={j} x={C + LABEL_R} y={CY + (j - (lines.length - 1) / 2) * lineH} dominantBaseline="central">
                      {line}
                    </tspan>
                  ))}
                </text>
              </g>
            );
          })}
          {landedIndex !== null && count > 0 && (
            <path d={slicePath(landedIndex, count)} fill="none" stroke={tokens.brass} strokeWidth={3} strokeLinejoin="round" />
          )}
          {/* Pegs on the rim at every slice boundary */}
          {items.map((item, i) => {
            const p = polar(C, CY, R - 9, i * step);
            return <circle key={`peg-${item.id}`} cx={p.x} cy={p.y} r={4.5} fill={tokens.surface} stroke={tokens.ink} strokeWidth={1.5} />;
          })}
        </g>

        {/* Housing, hub and flapper stay still */}
        <circle cx={C} cy={CY} r={R + 3} fill="none" stroke={tokens.ink} strokeWidth={7} />
        <circle cx={C} cy={CY} r={HUB_R} fill={tokens.ink} />
        <circle cx={C} cy={CY} r={HUB_R - 6} fill="none" stroke={tokens.brass} strokeWidth={2} />
        {hubLines.length > 0 ? (
          <text
            textAnchor="middle"
            fill="#FFFFFF"
            style={{ fontFamily: "var(--mantine-font-family-headings)", fontWeight: 600, fontSize: font }}
            aria-hidden
          >
            {hubLines.map((line, j) => (
              <tspan key={j} x={C} y={CY + (j - (hubLines.length - 1) / 2) * lineH} dominantBaseline="central">
                {line}
              </tspan>
            ))}
          </text>
        ) : (
          <circle cx={C} cy={CY} r={6} fill={tokens.brass} />
        )}
        <g transform={`rotate(${flap} ${C} ${PIVOT_Y})`}>
          <path
            d={`M ${C - 10} ${PIVOT_Y} A 10 10 0 1 1 ${C + 10} ${PIVOT_Y} L ${C} ${CY - R + 14} Z`}
            fill={tokens.brass}
            stroke={tokens.ink}
            strokeWidth={2}
            strokeLinejoin="round"
          />
          <circle cx={C} cy={PIVOT_Y} r={3} fill={tokens.ink} />
        </g>
      </svg>
    </div>
  );
}
