import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtHour, fmtTick, sameHour } from "../lib/format";
import { usePalette } from "../lib/theme";
import type { Vitals } from "../lib/types";
import { TimelineChart } from "./TimelineChart";

interface TipProps {
  active?: boolean;
  label?: string;
  payload?: { value: number }[];
}

function HrTip({ active, label, payload }: TipProps) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="tooltip">
      <div className="tooltip-title">{fmtHour(label)}</div>
      <div className="tooltip-row"><b>{payload[0].value}</b><span className="muted">beats per minute</span></div>
    </div>
  );
}

/**
 * The body's side of the flag: one chart for heart rate, one for the conditions
 * underneath it, on the same hours. Two charts rather than two scales on one,
 * so nothing is implied by lines crossing.
 */
export function VitalsCard({ vitals, compact = false }: { vitals: Vitals; compact?: boolean }) {
  const c = usePalette();
  const now = vitals.series.find((r) => sameHour(r.hour, vitals.as_of))?.hour;
  const ticks = vitals.series.filter((_, i) => i % 4 === 0).map((r) => r.hour);
  const timeline = vitals.series.map((r) => ({ hour: r.hour, noise: r.noise, heat: r.heat, air: r.air, composite: 0 }));

  return (
    <section className="card">
      <div className="card-head">
        <h2>Vitals and conditions</h2>
        <span className="badge status">Simulated</span>
      </div>

      <div className="tiles" style={{ marginBottom: 14 }}>
        <div className="tile">
          <div className="tile-label">Heart rate now</div>
          <div className="tile-value">
            {vitals.now?.heart_rate ?? "?"} <span className="muted" style={{ fontSize: 15, fontWeight: 500 }}>bpm</span>
          </div>
          <div className="small muted">
            {vitals.above_baseline > 0 ? `${vitals.above_baseline} above` : `${Math.abs(vitals.above_baseline)} below`} their usual {vitals.baseline.heart_rate}
          </div>
        </div>
        <div className="tile">
          <div className="tile-label">Heart-rate variability</div>
          <div className="tile-value">{vitals.now?.hrv ?? "?"} <span className="muted" style={{ fontSize: 15, fontWeight: 500 }}>ms</span></div>
          <div className="small muted">usual {vitals.baseline.hrv}, lower means more strain</div>
        </div>
        {vitals.restless_tonight != null && (
          <div className="tile">
            <div className="tile-label">Restless sleep tonight</div>
            <div className="tile-value">{vitals.restless_tonight} <span className="muted" style={{ fontSize: 15, fontWeight: 500 }}>min</span></div>
            <div className="small muted">usual {vitals.baseline.restless_minutes} min</div>
          </div>
        )}
      </div>

      <h3 style={{ marginBottom: 6 }}>Heart rate, hour by hour</h3>
      <div className="chart-box" style={{ height: compact ? 150 : 190 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={vitals.series} margin={{ top: 12, right: 12, bottom: 4, left: -14 }}>
            <CartesianGrid vertical={false} stroke={c.grid} />
            <XAxis dataKey="hour" ticks={ticks} tickFormatter={fmtTick} stroke={c.axis} tick={{ fill: c.muted, fontSize: 12 }} tickLine={false} />
            <YAxis width={44} stroke={c.axis} tick={{ fill: c.muted, fontSize: 12 }} tickLine={false} axisLine={false} domain={["dataMin - 6", "dataMax + 6"]} />
            <ReferenceLine y={vitals.baseline.heart_rate} stroke={c.axis} strokeWidth={1}
              label={{ value: "their usual", position: "insideTopLeft", fill: c.muted, fontSize: 11 }} />
            {now && <ReferenceLine x={now} stroke={c.ink2} strokeWidth={1} label={{ value: "Now", position: "top", fill: c.ink2, fontSize: 12 }} />}
            <Tooltip content={<HrTip />} cursor={{ stroke: c.axis, strokeWidth: 1 }} isAnimationActive={false} />
            <Line type="monotone" dataKey="heart_rate" stroke={c.patient === "#898781" ? c.ink2 : c.ink2} strokeWidth={2} dot={false}
              isAnimationActive={false} activeDot={{ r: 4, fill: c.ink2, stroke: c.surface, strokeWidth: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <h3 style={{ margin: "10px 0 6px" }}>Conditions at their ZIP, same hours</h3>
      <TimelineChart points={timeline} asOf={vitals.as_of} height={compact ? 150 : 180} />

      <p className="small" style={{ marginTop: 10 }}>{vitals.headline}</p>
      <p className="tiny muted" style={{ marginTop: 4 }}>
        Noise r = {vitals.correlations.noise ?? "n/a"} · Heat r = {vitals.correlations.heat ?? "n/a"} · Air r = {vitals.correlations.air ?? "n/a"}.
        A correlation across one day is a hint, not evidence. {vitals.note}
      </p>
    </section>
  );
}
