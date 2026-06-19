import { Link } from "react-router-dom";
import { HammerIcon } from "../components/ui";
import discoverToolsHero from "../assets/discover-tools-hero-orange.png";

export function DashboardPage() {
  return (
    <section className="dashboard discover-page">
      <div className="discover-hero">
        <img
          src={discoverToolsHero}
          alt="Werkzeuge auf einer Werkbank in einer gemeinschaftlichen Werkstatt"
          className="discover-hero-image"
        />
        <div className="discover-hero-copy">
          <p className="eyebrow">Nachbarschaftlich teilen</p>
          <h1>Finde Werkzeuge und Werkstätten in deiner Community.</h1>
        </div>
      </div>

      <section className="quick-start-section" aria-labelledby="quick-start-title">
        <h2 id="quick-start-title">Schnell starten</h2>
        <div className="quick-start-grid">
          <Link to="/tools" className="quick-start-card">
            <div className="card-icon tools-icon" aria-hidden="true">
              <HammerIcon />
            </div>
            <h3>Werkzeuge entdecken</h3>
            <p>Suche nach Kategorie, Verfügbarkeit und starte eine Ausleihanfrage.</p>
            <span className="material-symbols-outlined card-arrow" aria-hidden="true">arrow_forward</span>
          </Link>

          <Link to="/workshops" className="quick-start-card">
            <div className="card-icon workshops-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <h3>Werkstätten buchen</h3>
            <p>Finde freie Zeitslots und buche den passenden Arbeitsraum.</p>
            <span className="material-symbols-outlined card-arrow" aria-hidden="true">arrow_forward</span>
          </Link>

          <Link to="/inbox" className="quick-start-card">
            <div className="card-icon inbox-icon" aria-hidden="true">
              <span className="material-symbols-outlined">chat_bubble_outline</span>
            </div>
            <h3>Anfragen verwalten</h3>
            <p>Status, Benachrichtigungen und Entscheidungen zentral in der Inbox.</p>
            <span className="material-symbols-outlined card-arrow" aria-hidden="true">arrow_forward</span>
          </Link>
        </div>
      </section>
    </section>
  );
}
