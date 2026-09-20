import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ConfidenceBadge, LevelBadge, StatusBadge } from "../components/Badges";
import { Icon } from "../components/Icon";
import { Empty, ErrorBox, Loading } from "../components/States";
import { api } from "../lib/api";
import { useAsOf } from "../lib/asOf";
import { fmtHour, fmtTick } from "../lib/format";
import { useApi } from "../lib/hooks";

type LevelFilter = "all" | "act" | "watch";

export function Inbox() {
  const { asOf, scenario } = useAsOf();
  const nav = useNavigate();
  const [level, setLevel] = useState<LevelFilter>("all");
  const [program, setProgram] = useState("");
  const [team, setTeam] = useState("");
  const { data, error, loading } = useApi(() => (asOf ? api.alerts(asOf) : Promise.resolve(undefined)), [asOf], 5000);

  const all = data?.alerts ?? [];
  const programs = useMemo(() => [...new Set(all.map((a) => a.program))].sort(), [all]);
  const teams = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of all) counts.set(a.care_team, (counts.get(a.care_team) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [all]);

  const shown = all.filter((a) => (level === "all" || a.level === level) && (!program || a.program === program) && (!team || a.care_team === team));
  const counts = {
    act: shown.filter((a) => a.level === "act").length,
    watch: shown.filter((a) => a.level === "watch").length,
    handled: shown.filter((a) => a.status !== "new").length,
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Care-team inbox</h1>
          <p className="subtle" style={{ marginTop: 4 }}>
            Clients with PTSD whose surroundings raise their risk {asOf ? `at ${fmtHour(asOf)}` : ""}
            {scenario ? ` · ${scenario.label}` : ""}
          </p>
        </div>
      </div>

      <div className="tiles">
        <div className="tile">
          <div className="tile-label"><span style={{ color: "var(--critical)" }}><Icon name="alert" size={14} /></span>Act now</div>
          <div className="tile-value">{counts.act}</div>
        </div>
        <div className="tile">
          <div className="tile-label"><span style={{ color: "var(--warning)" }}><Icon name="eye" size={14} /></span>Watch</div>
          <div className="tile-value">{counts.watch}</div>
        </div>
        <div className="tile">
          <div className="tile-label"><span style={{ color: "var(--good)" }}><Icon name="check" size={14} /></span>Handled</div>
          <div className="tile-value">{counts.handled} <span className="muted" style={{ fontSize: 16, fontWeight: 500 }}>of {shown.length}</span></div>
        </div>
      </div>

      <div className="filters">
        <div className="segmented" role="group" aria-label="Level">
          {(["all", "act", "watch"] as LevelFilter[]).map((l) => (
            <button key={l} aria-pressed={level === l} onClick={() => setLevel(l)}>
              {l === "all" ? "All" : l === "act" ? "Act" : "Watch"}
            </button>
          ))}
        </div>
        <label className="field">
          Care team
          <select value={team} onChange={(e) => setTeam(e.target.value)}>
            <option value="">All teams ({teams.length})</option>
            {teams.map(([t, n]) => <option key={t} value={t}>{t} ({n})</option>)}
          </select>
        </label>
        <label className="field">
          Program
          <select value={program} onChange={(e) => setProgram(e.target.value)}>
            <option value="">All programs</option>
            {programs.map((p) => <option key={p}>{p}</option>)}
          </select>
        </label>
      </div>

      {all.length > 0 && (
        <p className="small muted" style={{ margin: "-4px 0 12px" }}>
          {all.length} flagged across {teams.length} care teams{team ? ` · ${shown.length} on ${team}` : ""} ·
          one alert per event, not per hour, so nobody is pinged again as the night goes on
        </p>
      )}

      <div className="card" style={{ padding: 0 }}>
        {error && <div style={{ padding: 16 }}><ErrorBox error={error} /></div>}
        {!data && loading && <Loading />}
        {data && !shown.length && (
          <Empty>
            {all.length ? "No one matches these filters." : "No one is flagged at this hour. Pick an evening hour in the replay to see alerts."}
          </Empty>
        )}
        {shown.length > 0 && (
          <div className={`table-wrap ${loading ? "stale" : ""}`}>
            <table className="table">
              <thead>
                <tr>
                  <th>Level</th>
                  <th>Client</th>
                  <th>Why now</th>
                  <th>Since</th>
                  <th>Confidence</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((a) => (
                  <tr key={a.alert_id} className="clickable" tabIndex={0}
                    onClick={() => nav(`/patients/${a.patient_id}`)}
                    onKeyDown={(e) => e.key === "Enter" && nav(`/patients/${a.patient_id}`)}>
                    <td><LevelBadge level={a.level} /></td>
                    <td>
                      <div className="person">{a.patient_name} · {a.age}</div>
                      <div className="small muted">{a.care_team} · ZIP {a.zip}</div>
                    </td>
                    <td style={{ maxWidth: 400 }}>{a.top_factor}</td>
                    <td className="small muted">{a.flagged_since ? fmtTick(a.flagged_since) : "not set"}</td>
                    <td><ConfidenceBadge confidence={a.confidence} /></td>
                    <td><StatusBadge status={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
