import { useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtHour, fmtTick, pct, sameHour, TRIGGER_LABEL } from "../lib/format";
import { usePalette } from "../lib/theme";
import type { TimelinePoint, Trigger } from "../lib/types";
import { TriggerKey } from "./Badges";

const SERIES: Trigger[] = ["noise", "heat", "air"];

interface TipProps {
  active?: boolean;
  label?: string;
  payload?: { dataKey: string; value: number }[];
}

function ChartTip({ active, label, payload }: TipProps) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="tooltip">
      <div className="tooltip-title">{fmtHour(label)}</div>
      {SERIES.map((s) => {
        const v = payload.find((p) => p.dataKey === s)?.value ?? 0;
        return (
          <div className="tooltip-row" key={s}>
            <span className="key-line" style={{ background: `var(--${s})` }} />
            <b>{pct(v)}</b>
            <span className="muted">{TRIGGER_LABEL[s]}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Severity (0–100) of each trigger at the person's ZIP, hour by hour. */
export function TimelineChart({ points, asOf, height = 240 }: { points: TimelinePoint[]; asOf?: string; height?: number }) {
  const c = usePalette();
  const [asTable, setAsTable] = useState(false);
  const now = asOf ? points.find((p) => sameHour(p.hour, asOf))?.hour : undefined;
  const ticks = points.filter((_, i) => i % 3 === 0).map((p) => p.hour);

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
        <div className="chart-legend" style={{ margin: 0 }}>
          {SERIES.map((s) => <TriggerKey key={s} trigger={s} line label={TRIGGER_LABEL[s]} />)}
        </div>
        <button className="linkish" onClick={() => setAsTable((t) => !t)}>{asTable ? "Show chart" : "Show as table"}</button>
      </div>
      {asTable ? (
        <div className="table-wrap" style={{ maxHeight: height + 20, overflowY: "auto" }}>
          <table className="table">
            <thead>
              <tr><th>Hour</th>{SERIES.map((s) => <th key={s} className="num">{TRIGGER_LABEL[s]}</th>)}</tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.hour} style={now === p.hour ? { fontWeight: 650 } : undefined}>
                  <td>{fmtHour(p.hour)}{now === p.hour ? " (now)" : ""}</td>
                  {SERIES.map((s) => <td key={s} className="num">{pct(p[s])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="chart-box" style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 16, right: 12, bottom: 4, left: -18 }}>
              <CartesianGrid vertical={false} stroke={c.grid} />
              <XAxis dataKey="hour" ticks={ticks} tickFormatter={fmtTick} stroke={c.axis} tick={{ fill: c.muted, fontSize: 12 }} tickLine={false} />
              <YAxis domain={[0, 1]} ticks={[0, 0.5, 1]} tickFormatter={(v: number) => pct(v)} stroke={c.axis} tick={{ fill: c.muted, fontSize: 12 }} tickLine={false} axisLine={false} />
              {now && <ReferenceLine x={now} stroke={c.ink2} strokeWidth={1} label={{ value: "Now", position: "top", fill: c.ink2, fontSize: 12 }} />}
              <Tooltip content={<ChartTip />} cursor={{ stroke: c.axis, strokeWidth: 1 }} isAnimationActive={false} />
              {SERIES.map((s) => (
                <Line key={s} type="monotone" dataKey={s} stroke={c[s]} strokeWidth={2} dot={false} isAnimationActive={false}
                  activeDot={{ r: 4, fill: c[s], stroke: c.surface, strokeWidth: 2 }} strokeLinecap="round" strokeLinejoin="round" />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
