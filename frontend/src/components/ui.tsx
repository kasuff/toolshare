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

export function HammerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11.414 10 4.031 17.418a2.091 2.091 0 0 0 0 2.967 2.11 2.11 0 0 0 2.976 0l7.407-7.385" />
      <path d="M18.121 15.293 20.707 12.707a1 1 0 0 0 0-1.414l-7.586-7.586a1 1 0 0 0-1.414 0L9.121 6.293a1 1 0 0 0 0 1.414l7.586 7.586a1 1 0 0 0 1.414 0" />
    </svg>
  );
}

export function InboxBubbleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2h11A2.5 2.5 0 0 1 20 4.5v8A2.5 2.5 0 0 1 17.5 15H10l-4.7 3.8c-.6.5-1.5.1-1.5-.7V15A2.5 2.5 0 0 1 4 12.5v-8z" />
      <circle cx="9" cy="8.5" r="1.1" />
      <circle cx="12" cy="8.5" r="1.1" />
      <circle cx="15" cy="8.5" r="1.1" />
    </svg>
  );
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
    <aside className="guest-banner" aria-labelledby="guest-banner-title">
      <span className="guest-banner-icon material-symbols-outlined" aria-hidden="true">
        login
      </span>
      <div className="guest-banner-copy">
        <h2 id="guest-banner-title">Bitte anmelden</h2>
        <p>{text}</p>
      </div>
      <Link to="/auth" className="btn">
        {cta}
      </Link>
    </aside>
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
  if (toasts.length === 0) return null;

  return (
    <aside className="toast-backdrop" aria-live="polite" aria-atomic="false">
      <div className="toast-viewport">
      {toasts.map((toast) => (
        <article key={toast.id} className="toast-popup" role={toast.tone === "error" ? "alert" : "status"}>
          <p>{toast.text}</p>
          <button className="icon-button" onClick={() => removeToast(toast.id)} aria-label="Meldung schließen">
            <span className="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        </article>
      ))}
      </div>
    </aside>
  );
}
