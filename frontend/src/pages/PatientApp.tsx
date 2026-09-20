import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { Empty, ErrorBox, Loading } from "../components/States";
import { api } from "../lib/api";
import { useAsOf } from "../lib/asOf";
import { fmtDateTime, fmtHour } from "../lib/format";
import { useApi } from "../lib/hooks";
import { GROUNDING_LINES, useSpeech } from "../lib/speech";
import type { Escalation, PatientRisk } from "../lib/types";

/** /me: pick which client's phone to preview (demo only). */
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

// Clients see plain language, never the clinician's sentence.
const PLAIN: Record<string, { act: string; watch: string }> = {
  noise: {
    act: "It's much louder than usual around you tonight: fireworks and street noise.",
    watch: "It's louder than usual around you tonight.",
  },
  heat: {
    act: "It's much hotter than usual around you today.",
    watch: "It's hotter than usual around you today.",
  },
  air: {
    act: "The air around you is smoky right now.",
    watch: "The air around you isn't great right now.",
  },
};

function headline(r: PatientRisk): { title: string; body: string } {
  const trigger = r.factors.find((x) => x.trigger !== "patient")?.trigger ?? "noise";
  const plain = PLAIN[trigger] ?? PLAIN.noise;
  if (r.level === "act") return { title: "Tonight may be hard around you", body: plain.act };
  if (r.level === "watch") return { title: "A heads-up for today", body: plain.watch };
  return { title: "Nothing unusual near you right now", body: "We'll let you know if that changes." };
}

export function PatientApp() {
  const { id = "" } = useParams();
  const { asOf } = useAsOf();
  const risk = useApi(() => (asOf ? api.patientRisk(id, asOf) : Promise.resolve(undefined)), [id, asOf]);
  const plan = useApi(() => api.plan(id), [id, asOf], 4000);
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const speech = useSpeech();
  const autos = useApi(() => api.escalations("open"), [], 4000);

  if (risk.error) return <div className="page"><ErrorBox error={risk.error} /></div>;
  if (!risk.data) return <div className="page"><Loading /></div>;
  const r = risk.data;
  const h = headline(r);
  const items = plan.data?.items ?? [];
  const LABELS: Record<string, string> = {
    care_team: "From your team",
    your_profile: "Yours",
    standard_tips: "General",
  };
  const yours = r.tips.find((t) => t.source === "your_profile");
  const auto = autos.data?.escalations.find((e) => e.patient_id === r.patient.id && e.trigger === "threshold");
  // Keep the screen short: the team's words, a few of their own, one general tip.
  const CAPS: Record<string, number> = { care_team: 2, your_profile: 3, standard_tips: 1 };
  const groups = (["care_team", "your_profile", "standard_tips"] as const)
    .map((source) => {
      const list = items.filter((i) => i.source === source && i.text !== yours?.text);
      return [LABELS[source], showAll ? list : list.slice(0, CAPS[source]), list.length] as const;
    })
    .filter(([, list]) => list.length > 0);
  const hidden = groups.reduce((n, [, list, total]) => n + (total - list.length), 0);

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
          {yours && <p style={{ marginTop: 8, fontWeight: 550 }}>{yours.text}</p>}
        </div>

        {auto && (
          <div className="notice" style={{ borderLeft: "3px solid var(--critical)", marginBottom: 12 }}>
            <b>We let {r.patient.care_team} know</b>
            <div className="small subtle" style={{ marginTop: 4 }}>
              Your heart rate and the noise around you were both unusual. Someone will reach out.
            </div>
            <button className="btn" style={{ marginTop: 10 }}
              onClick={async () => { await api.cancelEscalation(auto.escalation_id, "client"); autos.reload(); }}>
              I'm OK, stop this
            </button>
          </div>
        )}

        <Link to={`/me/${r.patient.id}/going-out`} className="btn" style={{ width: "100%", marginBottom: 12 }}>
          <Icon name="send" /> Going out
        </Link>

        {open ? <HelpFlow patientId={r.patient.id} careTeam={r.patient.care_team} onClose={() => setOpen(false)} /> : (
          <button className="help-btn" onClick={() => setOpen(true)}><Icon name="heart" size={20} /> I need help</button>
        )}

        {!r.has_profile && (
          <Link to={`/me/${r.patient.id}/about`} className="notice" style={{ display: "block", marginTop: 16, textDecoration: "none" }}>
            <b>Tell us what helps you</b>
            <div className="small subtle" style={{ marginTop: 2 }}>Five questions, once.</div>
          </Link>
        )}

        <div className="row" style={{ justifyContent: "space-between", margin: "22px 0 10px" }}>
          <h2>Your plan</h2>
          <div className="row" style={{ gap: 10 }}>
            {speech.supported && items.length > 0 && (
              <button className="btn ghost small" onClick={() => (speech.speaking ? speech.stop() : speech.speak([h.body, ...items.slice(0, 5).map((i) => i.text)], { gap: 1 }))}>
                <Icon name={speech.speaking ? "stop" : "sound"} size={15} /> {speech.speaking ? "Stop" : "Listen"}
              </button>
            )}
            <Link className="small subtle" to={`/me/${r.patient.id}/about`}>About you</Link>
          </div>
        </div>
        {groups.map(([label, list]) => (
          <div key={label} style={{ marginBottom: 14 }}>
            <h3 className="muted" style={{ marginBottom: 8, fontWeight: 600 }}>{label}</h3>
            <ul className="plain-list">
              {list.map((i) => (
                <li key={i.text + i.created_at} className={`plan-item ${i.source === "care_team" ? "care" : i.source === "your_profile" ? "personal" : ""}`}>
                  {speech.supported && (
                    <button className="speak-btn" aria-label="Read this out loud" onClick={() => speech.speak([i.text])}>
                      <Icon name="sound" size={14} />
                    </button>
                  )}
                  {i.text}
                  {i.source === "care_team" && <div className="plan-meta">From {i.author}{i.created_at ? ` · ${fmtDateTime(i.created_at)}` : ""}</div>}
                </li>
              ))}
            </ul>
          </div>
        ))}
        {hidden > 0 && (
          <button className="linkish" onClick={() => setShowAll(true)}>Show {hidden} more</button>
        )}
        {showAll && <button className="linkish" onClick={() => setShowAll(false)}>Show less</button>}
        {plan.error && <ErrorBox error={plan.error} />}
        {!items.length && <p className="subtle small">Nothing here yet.</p>}
      </div>
    </div>
  );
}

function HelpFlow({ patientId, careTeam, onClose }: { patientId: string; careTeam: string; onClose: () => void }) {
  const speech = useSpeech();
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
      <div className="crisis" role="region" aria-label="Crisis lines">
        <div style={{ fontWeight: 700 }}>In a crisis?</div>
        <div className="crisis-row">
          <a className="call" href="tel:988"><Icon name="phone" /><b>988</b><span className="tiny muted">call</span></a>
          <a className="call" href="sms:988"><Icon name="message" /><b>988</b><span className="tiny muted">text</span></a>
          <a className="call" href="tel:911"><Icon name="phone" /><b>911</b><span className="tiny muted">emergency</span></a>
        </div>
        <p className="tiny muted" style={{ marginTop: 8 }}>Veterans: call 988, then press 1.</p>
      </div>

      {speech.supported && (
        <button className="btn" style={{ width: "100%", marginTop: 10 }}
          onClick={() => (speech.speaking ? speech.stop() : speech.speak(GROUNDING_LINES, { rate: 0.82, gap: 1 }))}>
          <Icon name={speech.speaking ? "stop" : "sound"} /> {speech.speaking ? "Stop" : "Breathe with me"}
        </button>
      )}

      <div style={{ marginTop: 16 }}>
        {sent ? (
          <div className="notice">
            <b>Sent to {careTeam}.</b> Their reply appears in your plan below.
          </div>
        ) : (
          <>
            <div style={{ fontWeight: 650 }}>Tell your care team</div>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What's happening (optional)" style={{ marginTop: 8, minHeight: 60 }} />
            <label className="check">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>Share this and today's conditions with {careTeam}.</span>
            </label>
            <div className="row">
              <button className="btn primary" disabled={!consent || busy} onClick={send}><Icon name="send" /> Send</button>
              <button className="btn ghost" onClick={onClose}>Not now</button>
            </div>
            {err && <div style={{ marginTop: 10 }}><ErrorBox error={err} /></div>}
          </>
        )}
      </div>
    </div>
  );
}
