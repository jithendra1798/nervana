import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { Layer, PathOptions } from "leaflet";
import { useEffect, useMemo, useState } from "react";
import { GeoJSON, MapContainer, TileLayer } from "react-leaflet";
import { useNavigate } from "react-router-dom";
import { TriggerKey } from "../components/Badges";
import { ErrorBox } from "../components/States";
import { api } from "../lib/api";
import { useAsOf } from "../lib/asOf";
import { fmtHour, pct, TRIGGER_LABEL } from "../lib/format";
import { useApi } from "../lib/hooks";
import { usePalette, useTheme } from "../lib/theme";
import type { MapZip } from "../lib/types";
import "leaflet/dist/leaflet.css";

type Props = { MODZCTA: string; label: string };
type ZipFeature = Feature<Geometry, Props>;
const TRIGGERS = ["composite", "noise", "heat", "air"] as const;
const BINS = [0.2, 0.4, 0.6, 0.8];

let shapes: Promise<FeatureCollection<Geometry, Props>> | undefined;
const loadShapes = () => (shapes ??= fetch("/modzcta.geojson").then((r) => r.json()));

const binOf = (s: number) => BINS.filter((b) => s >= b).length; // 0..4

export function MapView() {
  const { asOf } = useAsOf();
  const nav = useNavigate();
  const c = usePalette();
  const { resolved } = useTheme();
  const [trigger, setTrigger] = useState<(typeof TRIGGERS)[number]>("composite");
  const [geo, setGeo] = useState<FeatureCollection<Geometry, Props>>();
  const map = useApi(() => (asOf ? api.map(asOf, trigger) : Promise.resolve(undefined)), [asOf, trigger]);
  const alerts = useApi(() => (asOf ? api.alerts(asOf) : Promise.resolve(undefined)), [asOf]);

  useEffect(() => {
    loadShapes().then(setGeo);
  }, []);

  const byZip = useMemo(() => new Map((map.data?.zips ?? []).map((z) => [z.zip, z])), [map.data]);
  const flagged = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of alerts.data?.alerts ?? []) m.set(a.zip, (m.get(a.zip) ?? 0) + 1);
    return m;
  }, [alerts.data]);
  const top = [...(map.data?.zips ?? [])].sort((a, b) => b.severity - a.severity).slice(0, 10);

  const style = (f?: ZipFeature): PathOptions => {
    const z = f && byZip.get(f.properties.MODZCTA);
    return {
      color: c.surface,
      weight: 1,
      fillColor: z ? c.seq[binOf(z.severity)] : c.noData,
      fillOpacity: z ? 0.78 : 0.35,
    };
  };

  const onEach = (f: ZipFeature, layer: Layer) => {
    const z: MapZip | undefined = byZip.get(f.properties.MODZCTA);
    const el = document.createElement("div");
    const title = document.createElement("div");
    title.style.fontWeight = "650";
    title.textContent = `ZIP ${f.properties.label}`;
    el.appendChild(title);
    const lines = z
      ? [
          `${TRIGGER_LABEL[trigger]}: ${pct(z.severity)} (${z.band})`,
          `Noise ${pct(z.noise)} · Heat ${pct(z.heat)} · Air ${pct(z.air)}`,
          `${flagged.get(z.zip) ?? 0} flagged client(s)`,
        ]
      : ["No data for this hour"];
    for (const t of lines) {
      const d = document.createElement("div");
      d.textContent = t;
      el.appendChild(d);
    }
    layer.bindTooltip(el, { sticky: true, className: "zip-tip" });
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Conditions by ZIP</h1>
          <p className="subtle" style={{ marginTop: 4 }}>{asOf ? fmtHour(asOf) : ""} · estimated for each ZIP, not each street</p>
        </div>
      </div>
      <div className="filters">
        <div className="segmented" role="group" aria-label="Trigger">
          {TRIGGERS.map((t) => (
            <button key={t} aria-pressed={trigger === t} onClick={() => setTrigger(t)}>
              {t !== "composite" && <span className="key-dot" style={{ background: `var(--${t})` }} />}
              {TRIGGER_LABEL[t]}
            </button>
          ))}
        </div>
      </div>
      {map.error && <ErrorBox error={map.error} />}
      <div className="map-layout">
        <div className={`map-box ${map.loading ? "stale" : ""}`}>
          <MapContainer center={[40.73, -73.93]} zoom={11} minZoom={10} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
            <TileLayer key={resolved} url={c.tiles} attribution="Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors" maxZoom={16} />
            {geo && map.data && (
              <GeoJSON key={`${map.data.as_of}-${trigger}-${resolved}-${flagged.size}`} data={geo} style={style as never} onEachFeature={onEach as never} />
            )}
          </MapContainer>
        </div>
        <div>
          <div className="card">
            <h3 style={{ marginBottom: 10 }}>{TRIGGER_LABEL[trigger]} severity</h3>
            <div className="legend">
              <div className="legend-scale">{c.seq.map((s) => <span key={s} style={{ background: s }} />)}</div>
              <div className="legend-ticks"><span>0</span><span>20</span><span>40</span><span>60</span><span>80</span><span>100</span></div>
              <div className="row small muted" style={{ marginTop: 4 }}>
                <span className="key-dot" style={{ background: c.noData }} /> No data
              </div>
            </div>
            {trigger === "composite" && (
              <div className="row small" style={{ marginTop: 12, gap: 12 }}>
                <span className="muted">Weights:</span>
                <TriggerKey trigger="noise" label="Noise 50%" />
                <TriggerKey trigger="heat" label="Heat 30%" />
                <TriggerKey trigger="air" label="Air 20%" />
              </div>
            )}
          </div>
          <div className="card">
            <h3 style={{ marginBottom: 6 }}>Highest ZIPs this hour</h3>
            <table className="table">
              <thead><tr><th>ZIP</th><th className="num">Severity</th><th>Main</th><th className="num">Flagged</th></tr></thead>
              <tbody>
                {top.map((z) => (
                  <tr key={z.zip} className={flagged.get(z.zip) ? "clickable" : undefined}
                    onClick={() => flagged.get(z.zip) && nav("/")}>
                    <td>{z.zip}</td>
                    <td className="num">{pct(z.severity)}</td>
                    <td><TriggerKey trigger={z.top_trigger} label={TRIGGER_LABEL[z.top_trigger]} /></td>
                    <td className="num">{flagged.get(z.zip) ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
