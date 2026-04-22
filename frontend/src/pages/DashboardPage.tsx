import { Link } from "react-router-dom";

export function DashboardPage() {
  return (
    <section>
      <div className="hero">
        <p className="eyebrow">Nachbarschaftlich teilen</p>
        <h1>Willkommen bei ToolShare Neufreimann</h1>
        <p>
          Leihe Werkzeuge in der Nachbarschaft aus oder buche verfügbare Werkstätten für dein
          nächstes Projekt.
        </p>
        <div className="row">
          <Link className="button-link" to="/tools">
            Werkzeuge entdecken
          </Link>
          <Link className="button-link ghost-link" to="/workshops">
            Werkstätten buchen
          </Link>
        </div>
      </div>

      <div className="panel">
        <h2>Schnell starten</h2>
        <ul>
          <li>Werkzeuge durchsuchen und direkt anfragen</li>
          <li>Werkstätten finden und freie Slots buchen</li>
          <li>Anfragen und Status in der Inbox verfolgen</li>
        </ul>
      </div>

      <div className="panel">
        <h2>Für Anbieter</h2>
        <ul>
          <li>Eigene Werkzeuge mit Foto einstellen</li>
          <li>Werkstatt mit Ausstattung und Slots verwalten</li>
          <li>Anfragen annehmen, ablehnen oder abschließen</li>
        </ul>
      </div>

      <div className="panel">
        <h2>Hinweis</h2>
        <p>Diese Oberfläche nutzt jetzt die echte REST-API und keine lokalen Mockdaten mehr.</p>
      </div>
    </section>
  );
}
