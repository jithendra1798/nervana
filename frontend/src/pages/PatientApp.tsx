import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { Empty, ErrorBox, Loading } from "../components/States";
import { api } from "../lib/api";
import { useAsOf } from "../lib/asOf";
import { fmtDateTime, fmtHour } from "../lib/format";
import { useApi } from "../lib/hooks";
import type { Escalation, PatientRisk } from "../lib/types";

/** /me — pick which client's phone to preview (demo only). */
export function PatientPicker() {
  const { asOf } = useAsOf();
  const { data, error } = useApi(() => (asOf ? api.alerts(asOf) : Promise.resolve(undefined)), [asOf]);
  return (
    <div className="page" style={{ maxWidth: 640 }}>
      <h1>Client view</h1>
      <p className="subtle" style={{ margin: "4px 0 16px" }}>What a client sees on their phone. Pick a flagged client to preview.</p>
      {error && <ErrorBox error={error} />}
      <div className="card" style={{ padding: 8 }}>
        {data?.alerts.length ? (
          data.alerts.map((a) => (
            <Link key={a.patient_id} to={`/me/${a.patient_id}`} className="req" style={{ textDecoration: "none", display: "block", marginTop: 0, marginBottom: 6 }}>
              <span className="person">{a.patient_name}</span> <span className="small muted">· {a.program} · ZIP {a.zip}</span>
            </Link>
          ))
        ) : (
          <Empty>No flagged clients at this hour.</Empty>
        )}
      </div>
    </div>
  );
}

function headline(r: PatientRisk): { title: string; body: string } {
  const f = r.factors.find((x) => x.trigger !== "patient");
  if (r.level === "act")
    return { title: "Tonight may be hard around you", body: f ? `${f.label}.` : "Conditions near you are unusual right now." };
  if (r.level === "watch")
    return { title: "A heads-up for today", body: f ? `${f.label}.` : "Some conditions near you are higher than usual." };
  return { title: "Nothing unusual near you right now", body: "We'll let you know if that changes." };
}

export function PatientApp() {
  const { id = "" } = useParams();
  const { asOf } = useAsOf();
  const risk = useApi(() => (asOf ? api.patientRisk(id, asOf) : Promise.resolve(undefined)), [id, asOf]);
  const plan = useApi(() => api.plan(id), [id, asOf], 4000);
  const [open, setOpen] = useState(false);

  if (risk.error) return <div className="page"><ErrorBox error={risk.error} /></div>;
  if (!risk.data) return <div className="page"><Loading /></div>;
  const r = risk.data;
  const h = headline(r);
  const items = plan.data?.items ?? [];

  return (
    <div className="phone-stage">
      <div className="phone" aria-label="Client phone preview">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="small muted">{asOf ? fmtHour(asOf) : ""}</span>
          <span className="small muted">Nervana</span>
        </div>
        <h1 style={{ marginTop: 14 }}>Hi {r.patient.name}</h1>

        <div className={`status-card ${r.level}`}>
          <div style={{ fontWeight: 650, fontSize: 17 }}>{h.title}</div>
          <p style={{ marginTop: 6 }}>{h.body}</p>
        </div>

        {open ? <HelpFlow patientId={r.patient.id} careTeam={r.patient.care_team} onClose={() => setOpen(false)} /> : (
          <button className="help-btn" onClick={() => setOpen(true)}><Icon name="heart" size={20} /> I need help</button>
        )}

        <h2 style={{ margin: "22px 0 10px" }}>Your plan</h2>
        {plan.error && <ErrorBox error={plan.error} />}
        {items.length ? (
          <ul className="plain-list">
            {items.map((i) => (
              <li key={i.text + i.created_at} className={`plan-item ${i.source === "care_team" ? "care" : ""}`}>
                {i.text}
                {i.source === "care_team" && <div className="plan-meta">From {i.author}{i.created_at ? ` · ${fmtDateTime(i.created_at)}` : ""}</div>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="subtle small">Your care team hasn't added anything yet.</p>
        )}
      </div>
    </div>
  );
}

function HelpFlow({ patientId, careTeam, onClose }: { patientId: string; careTeam: string; onClose: () => void }) {
  const [consent, setConsent] = useState(false);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState<Escalation>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Error>();

  const send = async () => {
    setBusy(true);
    setErr(undefined);
    try {
      setSent(await api.createEscalation({ patient_id: patientId, trigger: "need_help", consent, note: note.trim() || undefined }));
    } catch (e) {
      setErr(e as Error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="crisis" role="region" aria-label="Crisis support">
        <div style={{ fontWeight: 700 }}>If you're in crisis or thinking about hurting yourself</div>
        <a className="call" href="tel:988"><span>Call 988, then press 1 for veterans</span><Icon name="phone" /></a>
        <a className="call" href="sms:988"><span>Text 988</span><Icon name="message" /></a>
        <a className="call" href="tel:911"><span>Emergency: 911</span><Icon name="phone" /></a>
      </div>

      <div style={{ marginTop: 16 }}>
        {sent ? (
          <div className="notice">
            <b>Sent to {careTeam}</b> at {fmtDateTime(sent.created_at)}. Their reply will show up in your plan below.
          </div>
        ) : (
          <>
            <div style={{ fontWeight: 650 }}>Let my care team know</div>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything you want them to know (optional)" style={{ marginTop: 8, minHeight: 64 }} />
            <label className="check">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>I agree to share how I'm doing and today's conditions near me with {careTeam}.</span>
            </label>
            <div className="row">
              <button className="btn primary" disabled={!consent || busy} onClick={send}><Icon name="send" /> Send to my care team</button>
              <button className="btn ghost" onClick={onClose}>Not now</button>
            </div>
            {err && <div style={{ marginTop: 10 }}><ErrorBox error={err} /></div>}
          </>
        )}
      </div>
    </div>
  );
}
