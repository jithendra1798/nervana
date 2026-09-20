import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import type { GeoHit } from "../lib/types";
import { Icon } from "./Icon";

/**
 * Find a place in New York. A five-digit entry is treated as a ZIP and handed
 * straight back; anything else goes to the geocoder.
 */
export function AddressSearch({
  placeholder = "Search an address or ZIP",
  onPick,
  onZip,
  width = 280,
}: {
  placeholder?: string;
  onPick: (hit: GeoHit) => void;
  onZip?: (zip: string) => void;
  width?: number | string;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<GeoHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onAway = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onAway);
    return () => document.removeEventListener("mousedown", onAway);
  }, []);

  const run = async () => {
    const text = q.trim();
    if (!text) return;
    if (/^\d{5}$/.test(text) && onZip) {
      onZip(text);
      setOpen(false);
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const res = await api.geocode(text);
      setHits(res.results);
      setOpen(true);
      if (!res.results.length) setError("Nothing found in New York City for that.");
    } catch {
      setError("Address lookup is unavailable right now.");
      setOpen(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="search" ref={box} style={{ width }}>
      <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
        <input type="text" value={q} placeholder={placeholder} aria-label={placeholder} style={{ flex: 1, minWidth: 0 }}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); run(); } }} />
        <button className="btn" type="button" onClick={run} disabled={busy}>{busy ? "…" : <Icon name="eye" />}</button>
      </div>
      {open && (hits.length > 0 || error) && (
        <div className="search-results">
          {error && <div className="search-item muted">{error}</div>}
          {hits.map((h) => (
            <button key={`${h.lat},${h.lon}`} type="button" className="search-item"
              onClick={() => { onPick(h); setOpen(false); setQ(h.label); }}>
              {h.label}
              {h.zip && <span className="muted"> · ZIP {h.zip}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
