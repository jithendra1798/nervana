import type { Feature, FeatureCollection, Geometry } from "geojson";
import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Polyline, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { Link, useParams } from "react-router-dom";
import { AddressSearch } from "../components/AddressSearch";
import { Icon } from "../components/Icon";
import { MapFrame, ResizeWatcher } from "../components/MapFrame";
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

function Recentre({ point, zoom = 14 }: { point: [number, number] | undefined; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (point) map.flyTo(point, zoom, { duration: 0.6 });
  }, [point, zoom, map]);
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
  const [start, setStart] = useState<[number, number]>();
  const [startLabel, setStartLabel] = useState("your ZIP");
  const [dest, setDest] = useState<[number, number]>();
  const [destLabel, setDestLabel] = useState<string>();
  const [locating, setLocating] = useState(false);
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

  const from = start ?? home;

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setErr(new Error("This browser can't share your location. Search an address instead."));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStart([pos.coords.latitude, pos.coords.longitude]);
        setStartLabel("your location");
        setLocating(false);
      },
      (e) => {
        setErr(new Error(e.code === e.PERMISSION_DENIED
          ? "Location is turned off for this site, so we're starting from your ZIP. You can search an address instead."
          : "Couldn't get your location, so we're starting from your ZIP."));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  };

  const ask = async () => {
    if (!from || !dest || !asOf) return;
    setBusy(true);
    setErr(undefined);
    try {
      setAnswer(await api.route(from, dest, asOf));
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
          Search where you're heading, or tap the map. We'll show what the walk runs through right now — and whether waiting helps.
        </p>

        <div className="stack" style={{ marginTop: 14 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="small muted"><Icon name="pin" size={13} /> Starting from {startLabel}</span>
            <button className="btn ghost small" type="button" onClick={useMyLocation} disabled={locating}>
              {locating ? "Locating…" : "Use my location"}
            </button>
          </div>
          <AddressSearch width="100%" placeholder="Where are you going?"
            onPick={(hit) => { setDest([hit.lat, hit.lon]); setDestLabel(hit.label); }} />
        </div>

        <MapFrame height={280} label="Your walk">
          <MapContainer center={from ?? [40.745, -73.95]} zoom={12} style={{ height: "100%", width: "100%" }}>
            <TileLayer key={resolved} url={c.tiles} attribution="Tiles &copy; Esri" maxZoom={16} />
            <PickDestination onPick={(p) => { setDest(p); setDestLabel(undefined); }} />
            <Recentre point={dest ?? from} zoom={dest ? 13 : 14} />
            <ResizeWatcher trigger={`${dest?.join(",") ?? ""}-${answer?.as_of ?? ""}`} />
            {from && <CircleMarker center={from} radius={7} pathOptions={{ color: c.surface, weight: 2, fillColor: c.air, fillOpacity: 1 }} />}
            {dest && <CircleMarker center={dest} radius={7} pathOptions={{ color: c.surface, weight: 2, fillColor: c.heat, fillOpacity: 1 }} />}
            {answer && answer.is_detour && (
              <Polyline positions={answer.direct.geometry} pathOptions={{ color: c.muted, weight: 3, dashArray: "6 6" }} />
            )}
            {answer && <Polyline positions={answer.recommended.geometry} pathOptions={{ color: c.noise, weight: 5 }} />}
          </MapContainer>
        </MapFrame>

        <div className="row" style={{ marginTop: 12, justifyContent: "space-between" }}>
          <span className="small muted">
            {destLabel ? `To ${destLabel.slice(0, 40)}` : dest ? "Destination set on the map" : "Search above, or tap the map"}
          </span>
          <button className="btn primary" disabled={!dest || !from || busy} onClick={ask}>
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
