import { Link, useParams } from "react-router-dom";
import { ConfidenceBadge, LevelBadge } from "../components/Badges";
import { FactorBars } from "../components/FactorBars";
import { Icon } from "../components/Icon";
import { ErrorBox, Loading } from "../components/States";
import { TimelineChart } from "../components/TimelineChart";
import { api } from "../lib/api";
import { useAsOf } from "../lib/asOf";
import { fmtDateTime, fmtHour, pct, TRIGGER_LABEL } from "../lib/format";
import { useApi } from "../lib/hooks";

/**
 * One page a clinician can print or save as a PDF: why this person was flagged,
 * how sure we are, what their body and surroundings did, and what was done.
 */
export function Report() {
  const { id = "" } = useParams();
  const { asOf } = useAsOf();
  const { data, error, loading } = useApi(() => (asOf ? api.report(id, asOf) : Promise.resolve(undefined)), [id, asOf]);

  if (error) return <div className="page"><ErrorBox error={error} /></div>;
  if (!data) return <div className="page">{loading ? <Loading /> : null}</div>;
  const r = data;
  const p = r.patient;

  return (
    <div className="page report">
      <div className="row no-print" style={{ justifyContent: "space-between", marginBottom: 16 }}>
        <Link to={`/patients/${id}`} className="btn ghost" style={{ marginLeft: -10 }}><Icon name="back" /> Record</Link>
        <button className="btn primary" onClick={() => window.print()}><Icon name="send" /> Print or save as PDF</button>
      </div>

      <header className="report-head">
        <div>
          <h1>{p.name}, {p.age}</h1>
          <p className="subtle">{p.program} · {p.care_team} · ZIP {p.zip}{p.veteran ? " · Veteran" : ""}</p>
          <p className="small muted">{p.diagnoses.join(" · ")}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <LevelBadge level={r.level} />
          <p className="small subtle" style={{ marginTop: 6 }}>Score {r.score.toFixed(2)}</p>
          <p className="small muted">{fmtHour(r.as_of)} · {r.scenario.label}</p>
        </div>
      </header>

      <section>
        <h2>Why flagged</h2>
        <FactorBars factors={r.factors} />
      </section>

      <section>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>How sure we are</h2>
          <ConfidenceBadge confidence={r.uncertainty.confidence} />
        </div>
        <ul className="caveats">{r.uncertainty.caveats.map((c) => <li key={c}>{c}</li>)}</ul>
      </section>

      <section>
        <h2>Conditions at ZIP {p.zip}</h2>
        <p className="small muted">
          Peaks today: {(["noise", "heat", "air"] as const).map((t) => `${TRIGGER_LABEL[t]} ${pct(r.peaks[t])}`).join(" · ")}
        </p>
        <TimelineChart points={r.timeline} asOf={r.as_of} height={180} />
      </section>

      <section>
        <h2>Vitals <span className="badge status">Simulated</span></h2>
        <p>
          Heart rate {r.vitals.now?.heart_rate} bpm against a usual {r.vitals.baseline.heart_rate}.
          Variability {r.vitals.now?.hrv} ms against {r.vitals.baseline.hrv}.
          {r.vitals.restless_tonight != null ? ` Restless sleep ${r.vitals.restless_tonight} minutes against ${r.vitals.baseline.restless_minutes}.` : ""}
        </p>
        <p className="small muted">{r.vitals.headline} {r.vitals.note}</p>
      </section>

      {r.profile_note && (
        <section>
          <h2>What they told us</h2>
          <p>{r.profile_note}</p>
        </section>
      )}

      <section>
        <h2>Next step</h2>
        <p>{r.next_step.text}</p>
      </section>

      {r.plan.length > 0 && (
        <section>
          <h2>Their plan</h2>
          <ul className="caveats">
            {r.plan.map((i) => (
              <li key={i.text}>{i.text}{i.author ? ` (${i.author})` : ""}</li>
            ))}
          </ul>
        </section>
      )}

      {r.history.length > 0 && (
        <section>
          <h2>What was done</h2>
          <table className="table">
            <thead><tr><th>When</th><th>Event</th><th>Who</th><th>Note</th></tr></thead>
            <tbody>
              {r.history.map((h, i) => (
                <tr key={i}>
                  <td className="small">{fmtDateTime(String(h.at))}</td>
                  <td>{String(h.event).replace(/_/g, " ")}</td>
                  <td className="small muted">{String(h.clinician ?? "")}</td>
                  <td className="small muted">{String(h.reason ?? h.action ?? "")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <footer className="report-foot">
        <p className="small muted">{r.method}</p>
        <p className="small muted">
          Sources: {r.sources.map((s) => s.name).join(" · ")}. Generated {fmtDateTime(r.generated_at)} by Nervana.
        </p>
      </footer>
    </div>
  );
}
