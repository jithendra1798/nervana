import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ConfidenceBadge, LevelBadge, StatusBadge } from "../components/Badges";
import { FactorBars } from "../components/FactorBars";
import { Icon } from "../components/Icon";
import { ErrorBox, Loading } from "../components/States";
import { TimelineChart } from "../components/TimelineChart";
import { VitalsCard } from "../components/VitalsCard";
import { api } from "../lib/api";
import { useAsOf } from "../lib/asOf";
import { CLINICIAN, DISMISS_REASONS } from "../lib/demo";
import { fmtDateTime, fmtHour } from "../lib/format";
import { useApi } from "../lib/hooks";

export function PatientDetail() {
  const { id = "" } = useParams();
  const { asOf } = useAsOf();
  const risk = useApi(() => (asOf ? api.patientRisk(id, asOf) : Promise.resolve(undefined)), [id, asOf]);
  const alerts = useApi(() => (asOf ? api.alerts(asOf) : Promise.resolve(undefined)), [asOf]);
  const plan = useApi(() => api.plan(id), [id, asOf], 5000);
  const vitals = useApi(() => (asOf ? api.vitals(id, asOf) : Promise.resolve(undefined)), [id, asOf]);
  const alert = alerts.data?.alerts.find((a) => a.patient_id === id);

  const [dismissing, setDismissing] = useState(false);
  const [reason, setReason] = useState(DISMISS_REASONS[0]);
  const [busy, setBusy] = useState(false);

  const act = async (action: "outreach" | "dismiss") => {
    if (!alert) return;
    setBusy(true);
    try {
      await api.alertAction(alert.alert_id, { action, clinician: CLINICIAN, reason: action === "dismiss" ? reason : undefined });
      alerts.reload();
      setDismissing(false);
    } finally {
      setBusy(false);
    }
  };

  if (risk.error) return <div className="page"><ErrorBox error={risk.error} /></div>;
  if (!risk.data) return <div className="page"><Loading /></div>;
  const r = risk.data;
  const p = r.patient;
  const careItems = plan.data?.items.filter((i) => i.source === "care_team") ?? [];

  return (
    <div className={`page ${risk.loading ? "stale" : ""}`}>
      <Link to="/" className="btn ghost" style={{ marginLeft: -10, marginBottom: 8 }}><Icon name="back" /> Inbox</Link>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1>{p.name} · {p.age}</h1>
            <p className="subtle" style={{ marginTop: 4 }}>
              {p.program} · {p.care_team} · ZIP {p.zip}{p.veteran ? " · Veteran" : ""}
            </p>
            <p className="small muted" style={{ marginTop: 4 }}>
              {p.diagnoses.join(" · ")} · Contact details updated {p.contact_last_updated}
            </p>
          </div>
          <div className="row">
            <LevelBadge level={r.level} />
            <span className="small subtle">Score {r.score.toFixed(2)}</span>
            <ConfidenceBadge confidence={r.uncertainty.confidence} />
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div>
          <section className="card">
            <div className="card-head">
              <h2>Why {p.name} is flagged</h2>
              <span className="small muted">{fmtHour(r.as_of)}</span>
            </div>
            <FactorBars factors={r.factors} />
          </section>

          <section className="card">
            <div className="card-head"><h2>How sure we are</h2><ConfidenceBadge confidence={r.uncertainty.confidence} /></div>
            <ul className="caveats">
              {r.uncertainty.caveats.map((c) => <li key={c}>{c}</li>)}
            </ul>
          </section>

          <section className="card">
            <div className="card-head"><h2>Conditions in ZIP {p.zip}</h2><span className="small muted">through {fmtHour(r.as_of)} · 0–100 severity</span></div>
            <TimelineChart points={r.timeline} asOf={r.as_of} />
          </section>

          {vitals.data && <VitalsCard vitals={vitals.data} />}
        </div>

        <div>
          <section className="card">
            <div className="card-head">
              <h2>Suggested next step</h2>
              <span className="small muted">{r.next_step.source === "care_team" ? "Care-team plan" : "Standard guidance"}</span>
            </div>
            <p style={{ fontSize: 16 }}>{r.next_step.text}</p>

            {alert?.flagged_since && (
              <p className="small muted" style={{ marginTop: 10 }}>
                Flagged since {fmtHour(alert.flagged_since)} · one alert for the whole event, so this doesn't re-fire every hour
              </p>
            )}

            {alert && (
              <div style={{ marginTop: 16 }}>
                {alert.status !== "new" && alert.action ? (
                  <div className="notice row" style={{ justifyContent: "space-between" }}>
                    <StatusBadge status={alert.status} />
                    <span className="small subtle">
                      {alert.action.clinician} · {fmtDateTime(alert.action.at)}{alert.action.reason ? ` · ${alert.action.reason}` : ""}
                    </span>
                  </div>
                ) : dismissing ? (
                  <div className="stack">
                    <label className="field" style={{ display: "flex" }}>
                      Reason
                      <select value={reason} onChange={(e) => setReason(e.target.value)} style={{ flex: 1 }}>
                        {DISMISS_REASONS.map((d) => <option key={d}>{d}</option>)}
                      </select>
                    </label>
                    <div className="row">
                      <button className="btn primary" disabled={busy} onClick={() => act("dismiss")}>Dismiss alert</button>
                      <button className="btn ghost" onClick={() => setDismissing(false)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="row">
                    <button className="btn primary" disabled={busy} onClick={() => act("outreach")}><Icon name="phone" /> Log outreach</button>
                    <button className="btn" disabled={busy} onClick={() => setDismissing(true)}>Dismiss…</button>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="card">
            <div className="card-head"><h2>Care-team plan</h2><Link className="small subtle" to={`/me/${p.id}`}>Client's view</Link></div>
            {careItems.length ? (
              <ul className="plain-list">
                {careItems.map((i) => (
                  <li key={i.text + i.created_at} className="plan-item care">
                    {i.text}
                    <div className="plan-meta">{i.author}{i.created_at ? ` · ${fmtDateTime(i.created_at)}` : ""}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="subtle small">No personal plan yet. Replies to help requests are saved here and shown to the client first.</p>
            )}
          </section>

          {r.profile_note && (
            <section className="card">
              <div className="card-head"><h2>What they told us</h2><span className="small muted">shared by the client</span></div>
              <p>{r.profile_note}</p>
            </section>
          )}

          <section className="card">
            <div className="card-head"><h2>Tips the client sees</h2></div>
            {r.tips.length ? (
              <ul className="plain-list">
                {r.tips.map((t) => (
                  <li key={t.text} className={`plan-item ${t.source === "your_profile" ? "personal" : ""}`}>
                    {t.text}
                    {t.source === "your_profile" && <div className="plan-meta">From their own answers</div>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="subtle small">No tips right now.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
