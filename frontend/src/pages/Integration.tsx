import { useState } from "react";
import { Icon } from "../components/Icon";
import { ErrorBox, Loading } from "../components/States";
import { api } from "../lib/api";
import { useAsOf } from "../lib/asOf";
import { fmtDateTime } from "../lib/format";
import { useApi } from "../lib/hooks";

const INDICATOR_COLOR = { critical: "var(--critical)", warning: "var(--warning)", info: "var(--noise)" } as const;

/** The card's detail field is markdown; EHRs render it, so render it here too. */
function CardDetail({ detail }: { detail: string }) {
  return (
    <div style={{ marginTop: 10, color: "var(--ink-2)" }}>
      {detail.split("\n").map((line, i) => {
        if (!line.trim()) return <div key={i} style={{ height: 8 }} />;
        const heading = line.match(/^\*\*(.+)\*\*$/);
        if (heading) return <div key={i} style={{ fontWeight: 650, color: "var(--ink)", marginTop: i ? 6 : 0 }}>{heading[1]}</div>;
        if (line.startsWith("- ")) return <div key={i} style={{ paddingLeft: 14, textIndent: -14 }}>• {line.slice(2)}</div>;
        return <div key={i}>{line}</div>;
      })}
    </div>
  );
}

/**
 * Nervana is meant to live inside the systems clinicians already use. This page
 * shows the same alert in the two shapes those systems read: a CDS Hooks card,
 * which is what appears when a chart is opened, and a FHIR RiskAssessment, which
 * is what the record stores.
 */
export function Integration() {
  const { asOf } = useAsOf();
  const [patient, setPatient] = useState("SYN-0142");
  const alerts = useApi(() => (asOf ? api.alerts(asOf) : Promise.resolve(undefined)), [asOf]);
  const preview = useApi(() => (asOf ? api.integrationPreview(patient, asOf) : Promise.resolve(undefined)), [patient, asOf]);
  const card = preview.data?.cds_hooks.cards[0];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Inside the EHR</h1>
          <p className="subtle" style={{ marginTop: 4 }}>
            The same alert in the shapes provider systems already read. Nervana is an API with a reference screen, not another app to log into.
          </p>
        </div>
        <label className="field">
          Client
          <select value={patient} onChange={(e) => setPatient(e.target.value)}>
            {(alerts.data?.alerts ?? []).slice(0, 30).map((a) => (
              <option key={a.patient_id} value={a.patient_id}>{a.patient_name} · {a.care_team}</option>
            ))}
          </select>
        </label>
      </div>

      {preview.error && <ErrorBox error={preview.error} />}
      {!preview.data && preview.loading && <Loading />}

      {preview.data && (
        <div className="grid-2">
          <div>
            <section className="card">
              <div className="card-head">
                <h2>CDS Hooks card</h2>
                <span className="small muted">fires on <code>patient-view</code></span>
              </div>
              {card ? (
                <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 14, borderLeft: `4px solid ${INDICATOR_COLOR[card.indicator]}` }}>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <b>{card.summary}</b>
                    <span className="small muted">{card.source.label}</span>
                  </div>
                  <CardDetail detail={card.detail} />
                  {card.overrideReasons && (
                    <div className="row small muted" style={{ marginTop: 12, gap: 8 }}>
                      <Icon name="check" size={14} /> Override reasons offered: {card.overrideReasons.map((o) => o.display).join(" · ")}
                    </div>
                  )}
                </div>
              ) : (
                <p className="subtle">No card for this client at this hour: nothing unusual nearby.</p>
              )}
              <p className="small muted" style={{ marginTop: 12 }}>
                An in-basket message or care-management task carries the same content through the same API.
              </p>
            </section>

            <section className="card">
              <div className="card-head"><h2>What happened, logged</h2><span className="small muted">consent, actions and replies</span></div>
              {preview.data.audit.length ? (
                <table className="table">
                  <thead><tr><th>When</th><th>Event</th><th>Client</th><th>Who</th></tr></thead>
                  <tbody>
                    {preview.data.audit.map((e, i) => (
                      <tr key={i}>
                        <td className="small">{fmtDateTime(String(e.at))}</td>
                        <td>{String(e.event).replace(/_/g, " ")}</td>
                        <td className="small muted">{String(e.patient_id ?? "")}</td>
                        <td className="small muted">{String(e.clinician ?? "")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="subtle small">Nothing yet. Log outreach or send a help request and it appears here.</p>
              )}
            </section>
          </div>

          <section className="card">
            <div className="card-head"><h2>FHIR RiskAssessment</h2><span className="small muted">R4</span></div>
            <pre style={{ margin: 0, maxHeight: 620, overflow: "auto", fontSize: 12, lineHeight: 1.5, color: "var(--ink-2)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {JSON.stringify(preview.data.fhir, null, 2)}
            </pre>
          </section>
        </div>
      )}
    </div>
  );
}
