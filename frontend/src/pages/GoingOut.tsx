import type { Feature, FeatureCollection, Geometry } from "geojson";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, Polyline, TileLayer, useMapEvents } from "react-leaflet";
import { Link, useParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { ErrorBox, Loading } from "../components/States";
import { api } from "../lib/api";
import { useAsOf } from "../lib/asOf";
import { fmtTick, pct } from "../lib/format";
import { useApi } from "../lib/hooks";
import { usePalette, useTheme } from "../lib/theme";
import type { RouteAnswer } from "../lib/types";
import "leaflet/dist/leaflet.css";

type Props = { MODZCTA: string; label: string };

function centroid(f: Feature<Geometry, Props>): [number, number] | undefined {
  const geom = f.geometry;
  let rings: number[][][] = [];
  if (geom.type === "Polygon") rings = geom.coordinates as number[][][];
  else if (geom.type === "MultiPolygon") rings = (geom.coordinates as number[][][][]).map((poly) => poly[0]);
  if (!rings.length) return undefined;
  const ring = rings.reduce((a, b) => (a.length > b.length ? a : b));
  return [ring.reduce((sum, p) => sum + p[1], 0) / ring.length, ring.reduce((sum, p) => sum + p[0], 0) / ring.length];
}

function PickDestination({ onPick }: { onPick: (p: [number, number]) => void }) {
  useMapEvents({ click: (e) => onPick([e.latlng.lat, e.latlng.lng]) });
  return null;
}

/**
 * "I have to go somewhere." Shows what the walk runs through right now, whether
 * a calmer way around exists, and — usually more useful — whether waiting an
 * hour or two helps.
 */
export function GoingOut() {
  const { id = "" } = useParams();
  const { asOf } = useAsOf();
  const c = usePalette();
  const { resolved } = useTheme();
  const risk = useApi(() => (asOf ? api.patientRisk(id, asOf) : Promise.resolve(undefined)), [id, asOf]);
  const [home, setHome] = useState<[number, number]>();
  const [dest, setDest] = useState<[number, number]>();
  const [answer, setAnswer] = useState<RouteAnswer>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Error>();

  const zip = risk.data?.patient.zip;
  useEffect(() => {
    if (!zip) return;
    fetch("/modzcta.geojson")
      .then((r) => r.json())
      .then((geo: FeatureCollection<Geometry, Props>) => {
        const f = geo.features.find((x) => x.properties.MODZCTA === zip);
        const c2 = f && centroid(f);
        if (c2) setHome(c2);
      });
  }, [zip]);

  const ask = async () => {
    if (!home || !dest || !asOf) return;
    setBusy(true);
    setErr(undefined);
    try {
      setAnswer(await api.route(home, dest, asOf));
    } catch (e) {
      setErr(e as Error);
    } finally {
      setBusy(false);
    }
  };

  const hours = answer?.by_hour ?? [];
  const peak = useMemo(() => Math.max(0.01, ...hours.map((h) => h.mean)), [hours]);

  if (risk.error) return <div className="page"><ErrorBox error={risk.error} /></div>;
  if (!risk.data) return <div className="page"><Loading /></div>;

  return (
    <div className="phone-stage">
      <div className="phone" style={{ maxWidth: 460 }}>
        <Link to={`/me/${id}`} className="btn ghost" style={{ marginLeft: -10 }}><Icon name="back" /> Back</Link>
        <h1 style={{ marginTop: 10 }}>Going out?</h1>
        <p className="subtle small" style={{ marginTop: 6 }}>
          Tap where you're heading. We'll show what the walk runs through right now — and whether waiting helps.
        </p>

        <div className="map-box" style={{ height: 260, marginTop: 14 }}>
          <MapContainer center={home ?? [40.745, -73.95]} zoom={12} style={{ height: "100%", width: "100%" }}>
            <TileLayer key={resolved} url={c.tiles} attribution="Tiles &copy; Esri" maxZoom={16} />
            <PickDestination onPick={setDest} />
            {answer && answer.is_detour && (
              <Polyline positions={answer.direct.geometry} pathOptions={{ color: c.muted, weight: 3, dashArray: "6 6" }} />
            )}
            {answer && <Polyline positions={answer.recommended.geometry} pathOptions={{ color: c.noise, weight: 5 }} />}
          </MapContainer>
        </div>

        <div className="row" style={{ marginTop: 12, justifyContent: "space-between" }}>
          <span className="small muted">
            {dest ? `Destination set · from ZIP ${zip}` : "Tap the map to set where you're going"}
          </span>
          <button className="btn primary" disabled={!dest || !home || busy} onClick={ask}>
            {busy ? "Checking…" : "Check the walk"}
          </button>
        </div>
        {err && <div style={{ marginTop: 10 }}><ErrorBox error={err} /></div>}

        {answer && (
          <>
            <div className={`status-card ${answer.timing.now_mean >= 0.5 ? "act" : answer.timing.now_mean >= 0.25 ? "watch" : ""}`} style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 650 }}>
                {Math.round(answer.recommended.distance_m / 100) / 10} km · about {Math.round(answer.recommended.duration_s / 60)} min walk
              </div>
              <p style={{ marginTop: 6 }}>{answer.note}</p>
              <p style={{ marginTop: 6 }}>{answer.timing.advice}</p>
            </div>

            <h2 style={{ margin: "18px 0 8px" }}>How loud it is along the way</h2>
            <div className="hours" role="img" aria-label="Noise along this walk, hour by hour">
              {hours.map((h) => {
                const now = h.hour === answer.as_of;
                return (
                  <div key={h.hour} className="hour-col" title={`${fmtTick(h.hour)}: ${pct(h.mean)}`}>
                    <div className="hour-bar" style={{ height: `${Math.max(3, (h.mean / peak) * 52)}px`, background: now ? c.noise : c.grid }} />
                    {Number(h.hour.slice(11, 13)) % 6 === 0 && <span className="hour-tick">{fmtTick(h.hour)}</span>}
                  </div>
                );
              })}
            </div>
            <p className="tiny muted" style={{ marginTop: 6 }}>
              Now: {pct(answer.timing.now_mean)} of 100.{answer.timing.best_hour && answer.timing.worth_waiting
                ? ` Calmest soon: ${fmtTick(answer.timing.best_hour)} at ${pct(answer.timing.best_mean ?? 0)}.` : ""}
            </p>

            <h2 style={{ margin: "18px 0 8px" }}>Areas you'd pass through</h2>
            <p className="small">
              {answer.recommended.exposure.zips.join(" → ")}
              {answer.recommended.exposure.worst_zip &&
                ` · loudest right now: ZIP ${answer.recommended.exposure.worst_zip} at ${pct(answer.recommended.exposure.worst)}`}
            </p>
            <p className="tiny muted" style={{ marginTop: 10 }}>{answer.caveat}</p>
          </>
        )}
      </div>
    </div>
  );
}
