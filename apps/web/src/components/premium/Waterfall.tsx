import { Text } from "@mantine/core";
import { money, signedMoney } from "../../format";
import type { Driver } from "../../premiumGraphql";
import { tokens } from "../../theme";

interface Row {
  label: string;
  kind: "total" | "up" | "down";
  from: number;
  to: number;
  amount: number;
}

/** Running totals from last year's premium through each driver to this year's. */
export function waterfallRows(before: number, drivers: Driver[], after: number): Row[] {
  const rows: Row[] = [{ label: "Last year", kind: "total", from: before, to: before, amount: before }];
  let running = before;
  for (const d of drivers) {
    const next = Math.round((running + d.amount) * 100) / 100;
    rows.push({ label: d.label, kind: d.amount >= 0 ? "up" : "down", from: running, to: next, amount: d.amount });
    running = next;
  }
  rows.push({ label: "This year", kind: "total", from: after, to: after, amount: after });
  return rows;
}

/**
 * Waterfall as a table: each driver is a floating bar from the running total before it to the
 * one after. The axis spans only the range the totals move through, so totals are markers,
 * not bars from zero (a truncated bar would exaggerate the change).
 */
export function Waterfall({ before, drivers, after }: { before: number; drivers: Driver[]; after: number }) {
  const rows = waterfallRows(before, drivers, after);
  const values = rows.flatMap((r) => [r.from, r.to]);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = Math.max((hi - lo) * 0.08, before * 0.01, 1);
  const min = lo - pad;
  const span = hi + pad - min;
  const x = (v: number) => ((v - min) / span) * 100;

  return (
    <div className="table-scroll">
      <table className="detail-table waterfall">
        <caption className="sr-only">
          How the premium moved from {money(before)} to {money(after)}, driver by driver
        </caption>
        <thead>
          <tr>
            <th scope="col">Driver</th>
            <th scope="col" className="waterfall-bar-col">
              <span className="sr-only">Bar</span>
            </th>
            <th scope="col" className="r">
              Amount
            </th>
            <th scope="col" className="r waterfall-running">
              Running total
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const isTotal = r.kind === "total";
            const left = x(Math.min(r.from, r.to));
            const width = Math.max(x(Math.max(r.from, r.to)) - left, 0.6);
            const color = r.kind === "up" ? tokens.breach : tokens.cleared;
            return (
              <tr key={`${r.label}-${i}`} className={isTotal ? "waterfall-total" : undefined}>
                <th scope="row">{r.label}</th>
                <td>
                  <div className="waterfall-track" aria-hidden>
                    {/* Hairline at the running total this row starts from */}
                    <span className="waterfall-guide" style={{ left: `${x(r.from)}%` }} />
                    {isTotal ? (
                      <span className="waterfall-marker" style={{ left: `${x(r.to)}%` }} />
                    ) : (
                      <span
                        className="waterfall-bar"
                        title={`${r.label}: ${signedMoney(r.amount)}, running total ${money(r.to)}`}
                        style={{ left: `${left}%`, width: `${width}%`, background: color }}
                      />
                    )}
                  </div>
                </td>
                <td className={`r num${isTotal ? " strong" : ""}`}>{isTotal ? money(r.amount) : signedMoney(r.amount)}</td>
                <td className="r num waterfall-running">
                  <Text span fz={15} c={tokens.steel}>
                    {money(r.to)}
                  </Text>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
