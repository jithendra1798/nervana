import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { ErrorBox, Loading } from "../components/States";
import { api } from "../lib/api";
import { useApi } from "../lib/hooks";
import { useSpeech } from "../lib/speech";
import type { Profile } from "../lib/types";

const EMPTY: Profile = {
  triggers: [], helps: [], home: {}, support_person: "", safe_places: [], notes: "", share_with_care_team: false,
};

function Chips({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button key={o} type="button" className="chip" aria-pressed={selected.includes(o)} onClick={() => onToggle(o)}>
          {selected.includes(o) && <Icon name="check" size={13} />}
          {o}
        </button>
      ))}
    </div>
  );
}

/**
 * The client fills this in once. It is what makes the advice theirs rather than
 * generic: their triggers, what works for them, what home is like, who they call.
 */
export function AboutYou() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const loaded = useApi(() => api.profile(id), [id]);
  const [form, setForm] = useState<Profile>(EMPTY);
  const [places, setPlaces] = useState("");
  const speech = useSpeech();
  const [voice, setVoice] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<Error>();

  useEffect(() => {
    if (loaded.data?.profile) {
      setForm({ ...EMPTY, ...loaded.data.profile });
      setPlaces((loaded.data.profile.safe_places ?? []).join(", "));
    }
  }, [loaded.data]);

  if (loaded.error) return <div className="page"><ErrorBox error={loaded.error} /></div>;
  if (!loaded.data) return <div className="page"><Loading /></div>;
  const options = loaded.data.options;

  const toggle = (key: "triggers" | "helps") => (value: string) =>
    setForm((f) => ({ ...f, [key]: f[key].includes(value) ? f[key].filter((x) => x !== value) : [...f[key], value] }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr(undefined);
    try {
      await api.saveProfile(id, { ...form, safe_places: places.split(",").map((s) => s.trim()).filter(Boolean) });
      setSaved(true);
      setTimeout(() => nav(`/me/${id}`), 700);
    } catch (e2) {
      setErr(e2 as Error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="phone-stage">
      <form className="phone" onSubmit={submit}>
        <div className="phone-head">
          <Link to={`/me/${id}`} className="btn ghost" style={{ marginLeft: -10 }}><Icon name="back" /> Back</Link>
          <h1 style={{ marginTop: 8 }}>About you</h1>
          <p className="subtle small" style={{ marginTop: 4 }}>Five questions, once. Your answers shape what we suggest.</p>
        </div>
        <div className="phone-body">

        <h2 style={{ margin: "20px 0 8px" }}>What sets you off?</h2>
        <Chips options={options.triggers} selected={form.triggers} onToggle={toggle("triggers")} />

        <h2 style={{ margin: "20px 0 8px" }}>What helps you?</h2>
        <Chips options={options.helps} selected={form.helps} onToggle={toggle("helps")} />

        <h2 style={{ margin: "20px 0 8px" }}>Your home</h2>
        <div className="stack">
          <label className="check">
            <input type="checkbox" checked={form.home.air_conditioning === true}
              onChange={(e) => setForm((f) => ({ ...f, home: { ...f.home, air_conditioning: e.target.checked } }))} />
            <span>I have air conditioning that works</span>
          </label>
          <label className="check">
            <input type="checkbox" checked={form.home.quiet_room === true}
              onChange={(e) => setForm((f) => ({ ...f, home: { ...f.home, quiet_room: e.target.checked } }))} />
            <span>I have a room away from the street</span>
          </label>
        </div>

        <h2 style={{ margin: "20px 0 8px" }}>Who do you call?</h2>
        <input type="text" style={{ width: "100%" }} placeholder="e.g. my sister Dana"
          value={form.support_person ?? ""} onChange={(e) => setForm((f) => ({ ...f, support_person: e.target.value }))} />

        <h2 style={{ margin: "20px 0 8px" }}>Calmer places you go</h2>
        <input type="text" style={{ width: "100%" }} placeholder="e.g. the library on Jackson Ave"
          value={places} onChange={(e) => setPlaces(e.target.value)} />
        <p className="tiny muted" style={{ marginTop: 6 }}>Separate several with commas.</p>

        {speech.supported && speech.voices.length > 0 && (
          <>
            <h2 style={{ margin: "20px 0 8px" }}>How it sounds</h2>
            <div className="row" style={{ gap: 8 }}>
              <select value={voice ?? speech.current ?? ""} style={{ flex: 1 }}
                onChange={(e) => { setVoice(e.target.value); speech.setVoice(e.target.value); }}>
                {speech.voices.map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
              </select>
              <button type="button" className="btn" onClick={() => speech.speak(["Hi. When things get loud, I'll read your plan out to you."])}>
                <Icon name="sound" /> Try
              </button>
            </div>
            <p className="tiny muted" style={{ marginTop: 6 }}>Pick the voice you find easiest to listen to.</p>
          </>
        )}

        <h2 style={{ margin: "20px 0 8px" }}>Anything else we should know?</h2>
        <textarea value={form.notes ?? ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          placeholder="Optional" style={{ minHeight: 70 }} />

        <label className="check" style={{ marginTop: 18 }}>
          <input type="checkbox" checked={form.share_with_care_team}
            onChange={(e) => setForm((f) => ({ ...f, share_with_care_team: e.target.checked }))} />
          <span>Share this with my care team, so they know what works for me.<br />
            <span className="tiny muted">If you leave this off, your answers only shape what you see here.</span></span>
        </label>

        {err && <div style={{ marginTop: 12 }}><ErrorBox error={err} /></div>}
        </div>
        <div className="phone-foot row">
          <button className="btn primary" type="submit" disabled={saving} style={{ flex: 1 }}>
            <Icon name="check" /> {saved ? "Saved" : saving ? "Saving…" : "Save"}
          </button>
          <Link className="btn ghost" to={`/me/${id}`}>Cancel</Link>
        </div>
      </form>
    </div>
  );
}
