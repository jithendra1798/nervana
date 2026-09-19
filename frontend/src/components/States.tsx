import type { ReactNode } from "react";

export function ErrorBox({ error }: { error: Error }) {
  return (
    <div className="error" role="alert">
      Couldn't load this: {error.message}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Loading() {
  return <div className="empty muted">Loading…</div>;
}
