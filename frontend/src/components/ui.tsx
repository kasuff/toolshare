import { type ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { useToast } from "../hooks/useToast";

type SurfaceProps = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
};

export function Surface({ title, subtitle, children, className = "" }: SurfaceProps) {
  return (
    <section className={`surface ${className}`.trim()}>
      {(title || subtitle) && (
        <header className="surface-head">
          {title && <h2>{title}</h2>}
          {subtitle && <p>{subtitle}</p>}
        </header>
      )}
      {children}
    </section>
  );
}

type StatusTone = "neutral" | "success" | "warning" | "danger";

export function StatusPill({ label, tone = "neutral" }: { label: string; tone?: StatusTone }) {
  return <span className={`status-pill ${tone}`}>{label}</span>;
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

export function GuestBanner({
  text,
  cta = "Jetzt einloggen"
}: {
  text: string;
  cta?: string;
}) {
  return (
    <div className="guest-banner">
      <p>{text}</p>
      <Link to="/auth" className="btn">
        {cta}
      </Link>
    </div>
  );
}

export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div className="skeleton-grid" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="skeleton-card" />
      ))}
    </div>
  );
}

export function Field({
  label,
  children,
  hint
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function ButtonLink(props: LinkProps) {
  return <Link {...props} className={`btn ${props.className ?? ""}`.trim()} />;
}

export function ToastViewport() {
  const { toasts, removeToast } = useToast();
  return (
    <aside className="toast-viewport" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <article key={toast.id} className={`toast ${toast.tone}`}>
          <p>{toast.text}</p>
          <button className="icon-button" onClick={() => removeToast(toast.id)} aria-label="Meldung schließen">
            x
          </button>
        </article>
      ))}
    </aside>
  );
}
