import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useMap } from "react-leaflet";
import { Icon } from "./Icon";

/** Keeps Leaflet's canvas in step when the frame resizes (full screen, layout changes). */
export function ResizeWatcher({ trigger }: { trigger: unknown }) {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 180);
    return () => clearTimeout(t);
  }, [trigger, map]);
  return null;
}

/**
 * A map box with a full-screen toggle. Uses the browser's full-screen mode where
 * it is allowed, and falls back to filling the window otherwise (iOS Safari).
 */
export function MapFrame({ children, height, label = "Map" }: { children: ReactNode; height: number | string; label?: string }) {
  const frame = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);

  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement === frame.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setFull(false);
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, []);

  const toggle = useCallback(async () => {
    const el = frame.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
        setFull(true);
      } else {
        await document.exitFullscreen();
        setFull(false);
      }
    } catch {
      setFull((f) => !f); // no browser full screen: fill the window instead
    }
  }, []);

  return (
    <div ref={frame} className={`map-box ${full ? "is-full" : ""}`} style={full ? undefined : { height }}>
      {children}
      <button type="button" className="map-full-btn" onClick={toggle}
        aria-label={full ? `Leave full screen (${label})` : `Full screen (${label})`}>
        <Icon name={full ? "collapse" : "expand"} size={15} />
        {full ? "Close" : "Full screen"}
      </button>
    </div>
  );
}
