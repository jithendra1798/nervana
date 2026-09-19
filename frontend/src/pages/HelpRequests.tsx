import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LevelBadge } from "../components/Badges";
import { FactorBars } from "../components/FactorBars";
import { Icon } from "../components/Icon";
import { Empty, ErrorBox, Loading } from "../components/States";
import { TimelineChart } from "../components/TimelineChart";
import { api } from "../lib/api";
import { CLINICIAN } from "../lib/demo";
import { fmtDateTime } from "../lib/format";
import { useApi } from "../lib/hooks";
import type { Escalation } from "../lib/types";

const SUGGESTIONS: Record<string, string> = {
  noise: "Tonight: stay indoors with headphones on until the fireworks end. If the grounding exercise doesn't help within 10 minutes, call the team line and we'll call you back.",
  heat: "Today: stay in your coolest room, drink water every hour, and go to the nearest cooling center if home gets hot. We'll check in this afternoon.",
  air: "Today: keep windows closed and stay indoors. If you need to go out, wear the N95 we gave you. We'll check in tomorrow morning.",
};

export function HelpRequests() {
  const [tab, setTab] = useState<"open" | "answered">("open");
  const list = useApi(() => api.escalations(tab), [tab], 4000);
  const [selected, setSelected] = useState<string>();
  const items = list.data?.escalations ?? [];
  const current = items.find((e) => e.escalation_id === selected) ?? items[0];

  useEffect(() => {
    if (current && current.escalation_id !== selected) setSelected(current.escalation_id);
  }, [current, selected]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Help requests</h1>
          <p className="subtle" style={{ marginTop: 4 }}>Sent by clients from their phone, with their consent. Crisis lines are shown to them first.</p>
        </div>
        <div className="segmented" role="group" aria-label="Status">
          <button aria-pressed={tab === "open"} onClick={() => { setTab("open"); setSelected(undefined); }}>Open</button>
          <button aria-pressed={tab === "answered"} onClick={() => { setTab("answered"); setSelected(undefined); }}>Answered</button>
        </div>
      </div>
      {list.error && <ErrorBox error={list.error} />}
      {!list.data && list.loading && <Loading />}
      {list.data && !items.length && (
        <div className="card">
          <Empty>
            {tab === "open" ? (
              <>No open requests. When a client taps <b>I need help</b> in the <Link to="/me">client view</Link>, it shows up here.</>
            ) : "No answered requests yet."}
          </Empty>
        </div>
      )}
      {items.length > 0 && current && (
        <div className="split">
          <div>
            {items.map((e) => (
              <button key={e.escalation_id} className="req" aria-current={e.escalation_id === current.escalation_id} onClick={() => setSelected(e.escalation_id)}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="person">{e.patient_name}</span>
                  <LevelBadge level={e.packet.level} />
                </div>
                <div className="small muted" style={{ marginTop: 4 }}>
                  {e.trigger === "need_help" ? "Pressed I need help" : "Conditions crossed their threshold"} · {fmtDateTime(e.created_at)}
                </div>
              </button>
            ))}
          </div>
          <Detail key={current.escalation_id} esc={current} onDone={list.reload} />
        </div>
      )}
    </div>
  );
}

function Detail({ esc, onDone }: { esc: Escalation; onDone: () => void }) {
  const top = esc.packet.factors.find((f) => f.trigger !== "patient")?.trigger ?? "noise";
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Error>();

  const send = async () => {
    setBusy(true);
    setErr(undefined);
    try {
      await api.respond(esc.escalation_id, { text: text.trim(), clinician: CLINICIAN });
      onDone();
    } catch (e) {
      setErr(e as Error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <section className="card">
        <div className="card-head">
          <h2>{esc.patient_name} · {esc.care_team}</h2>
          <Link className="small subtle" to={`/patients/${esc.patient_id}`}>Open record</Link>
        </div>
        <p style={{ fontSize: 16 }}>{esc.packet.summary}</p>
        <p className="small muted" style={{ marginTop: 6 }}>Received {fmtDateTime(esc.created_at)} · client consented to share</p>
      </section>

      <section className="card">
        {esc.response ? (
          <>
            <div className="card-head"><h2>Your reply</h2><span className="small muted">{esc.response.clinician} · {fmtDateTime(esc.response.created_at)}</span></div>
            <div className="plan-item care">{esc.response.text}</div>
            <p className="small subtle" style={{ marginTop: 8 }}><Icon name="check" size={14} /> Saved to the client's plan. It shows first on their phone.</p>
          </>
        ) : (
          <>
            <div className="card-head"><h2>Reply with a personal plan</h2></div>
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="What should they do next? This goes straight to their phone." />
            <div className="row" style={{ marginTop: 10, justifyContent: "space-between" }}>
              <button className="linkish" onClick={() => setText(SUGGESTIONS[top] ?? SUGGESTIONS.noise)}>Start from a suggestion</button>
              <button className="btn primary" disabled={busy || !text.trim()} onClick={send}><Icon name="send" /> Send to client</button>
            </div>
            {err && <div style={{ marginTop: 10 }}><ErrorBox error={err} /></div>}
          </>
        )}
      </section>

      <section className="card">
        <div className="card-head"><h2>Why they may be struggling</h2></div>
        <FactorBars factors={esc.packet.factors} />
      </section>

      <section className="card">
        <div className="card-head"><h2>Conditions near them before the request</h2></div>
        <TimelineChart points={esc.packet.exposures_24h} height={200} />
      </section>

      <section className="card">
        <div className="grid-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <h3 style={{ marginBottom: 8 }}>Tips they've already seen</h3>
            <ul className="caveats">{esc.packet.tips_shown.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
          <div>
            <h3 style={{ marginBottom: 8 }}>What we don't know</h3>
            <ul className="caveats">{esc.packet.missing_data.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
        </div>
      </section>
    </div>
  );
}
