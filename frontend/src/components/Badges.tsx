import type { AlertStatus, Confidence, Level } from "../lib/types";
import { Icon } from "./Icon";

const LEVEL_TEXT: Record<Level, string> = { act: "Act", watch: "Watch", none: "No flag" };

/** Status color + icon + word, so the level never depends on color alone. */
export function LevelBadge({ level }: { level: Level }) {
  return (
    <span className={`badge ${level}`}>
      <Icon name={level === "act" ? "alert" : level === "watch" ? "eye" : "minus"} size={14} />
      {LEVEL_TEXT[level]}
    </span>
  );
}

const CONF_STEPS: Record<Confidence, number> = { low: 1, medium: 2, high: 3 };

export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  const on = CONF_STEPS[confidence];
  return (
    <span className="conf" title={`${confidence} confidence`}>
      <span className="conf-meter" aria-hidden>
        {[1, 2, 3].map((i) => <i key={i} className={i <= on ? "on" : ""} />)}
      </span>
      {confidence[0].toUpperCase() + confidence.slice(1)} confidence
    </span>
  );
}

export function StatusBadge({ status }: { status: AlertStatus }) {
  if (status === "new") return <span className="badge status">New</span>;
  return (
    <span className={`badge status ${status === "outreach" ? "done" : ""}`}>
      <Icon name={status === "outreach" ? "check" : "minus"} size={14} />
      {status === "outreach" ? "Outreach logged" : "Dismissed"}
    </span>
  );
}

export function TriggerKey({ trigger, line = false, label }: { trigger: string; line?: boolean; label: string }) {
  return (
    <span className="key">
      <span className={line ? "key-line" : "key-dot"} style={{ background: `var(--${trigger})` }} />
      {label}
    </span>
  );
}
