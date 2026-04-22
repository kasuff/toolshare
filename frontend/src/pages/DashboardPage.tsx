import { Link } from "react-router-dom";
import { ButtonLink, Surface } from "../components/ui";

export function DashboardPage() {
  return (
    <section className="stack">
      <div className="hero">
        <p className="eyebrow">Nachbarschaftlich teilen</p>
        <h1>Finde Werkzeuge und Werkstätten in deiner Community.</h1>
        <p>
          Toolshare verbindet Nachfrage und Angebot für lokale Projekte. Buche verfügbare
          Ressourcen, entscheide Anfragen in der Inbox und verwalte deine Angebote in wenigen Klicks.
        </p>
        <div className="row">
          <ButtonLink to="/tools">
            Werkzeuge entdecken
          </ButtonLink>
          <Link className="btn secondary" to="/workshops">
            Werkstätten buchen
          </Link>
        </div>
      </div>

      <Surface title="Schnell starten" subtitle="Die wichtigsten Flows in einer Übersicht">
        <div className="grid grid-3">
          <Surface className="interactive" title="Werkzeuge entdecken">
            <p className="hint">Suche nach Kategorie, Verfügbarkeit und starte eine Ausleihanfrage.</p>
            <Link className="btn secondary" to="/tools">
              Zu den Werkzeugen
            </Link>
          </Surface>
          <Surface className="interactive" title="Werkstätten buchen">
            <p className="hint">Finde freie Zeitslots und buche den passenden Arbeitsraum.</p>
            <Link className="btn secondary" to="/workshops">
              Zu den Werkstätten
            </Link>
          </Surface>
          <Surface className="interactive" title="Anfragen verwalten">
            <p className="hint">Status, Benachrichtigungen und Entscheidungen zentral in der Inbox.</p>
            <Link className="btn secondary" to="/inbox">
              Zur Inbox
            </Link>
          </Surface>
        </div>
      </Surface>

      <Surface title="Für Anbieter" subtitle="Angebote verwalten und transparent reagieren">
        <div className="grid grid-2">
          <div>
            <p className="hint">Eigene Werkzeuge mit Foto einstellen und Verfügbarkeit im Blick behalten.</p>
            <Link className="btn secondary" to="/tools/new">
              Werkzeug anbieten
            </Link>
          </div>
          <div>
            <p className="hint">Werkstatt inklusive Zeitslots anlegen und Buchungsanfragen steuern.</p>
            <Link className="btn secondary" to="/workshops/new">
              Werkstatt anbieten
            </Link>
          </div>
        </div>
      </Surface>

      <Surface title="Plattformstatus" subtitle="Aktuelle Systembasis">
        <p>Diese Oberfläche nutzt die REST-API als Source of Truth für alle Kernprozesse.</p>
      </Surface>
    </section>
  );
}
