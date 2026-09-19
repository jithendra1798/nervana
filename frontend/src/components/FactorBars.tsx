import { TRIGGER_LABEL } from "../lib/format";
import type { Factor } from "../lib/types";

/**
 * Why a person was flagged: one bar per factor, length = its share of the score.
 * Bars carry the trigger color; every label and value stays in text ink.
 */
export function FactorBars({ factors }: { factors: Factor[] }) {
  if (!factors.length) return <p className="subtle">Nothing unusual contributes to this person's risk right now.</p>;
  const max = Math.max(0.5, ...factors.map((f) => f.contribution));
  return (
    <div className="factors">
      {factors.map((f) => (
        <div key={f.label}>
          <div className="factor-top">
            <div>
              <div className="factor-label">{f.label}</div>
              <div className="factor-meta">
                {TRIGGER_LABEL[f.trigger]} · {f.source}
              </div>
            </div>
            <span className="factor-val">+{f.contribution.toFixed(2)}</span>
          </div>
          <div className="factor-track" role="img" aria-label={`${TRIGGER_LABEL[f.trigger]} adds ${f.contribution.toFixed(2)} to the score`}>
            <div className="factor-bar" style={{ width: `${(f.contribution / max) * 100}%`, background: `var(--${f.trigger})` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
