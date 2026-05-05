import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ButtonLink } from "../components/ui";
import { api } from "../services/api";
import type { Tool, Workshop } from "../types/domain";

export function DashboardPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const toolsData = await api.getTools({}, "");
        setTools(toolsData.slice(0, 4));
        const workshopsData = await api.getWorkshops({}, "");
        setWorkshops(workshopsData.slice(0, 3).map(w => w.workshop));
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    void loadData();
  }, []);

  return (
    <section className="dashboard">
      {/* Hero Section */}
      <div className="hero-playtomic">
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

      {/* Quick Start Cards with Icons */}
      <div className="quick-start-section">
        <h2>Schnell starten</h2>
        <div className="quick-start-grid">
          {/* Werkzeuge Card */}
          <Link to="/tools" className="quick-start-card">
            <div className="card-icon tools-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12h18M8 12l2-4m0 4l-2 4m8-4l2-4m0 4l-2 4M6 6l2-2m0 2l-2 2m12 0l2-2m0 2l-2 2M4 18l2-2m0 2l-2 2m14 0l2-2m0 2l-2 2" />
              </svg>
            </div>
            <h3>Werkzeuge entdecken</h3>
            <p>Suche nach Kategorie, Verfügbarkeit und starte eine Ausleihanfrage.</p>
            <span className="card-arrow">→</span>
          </Link>

          {/* Werkstätten Card */}
          <Link to="/workshops" className="quick-start-card">
            <div className="card-icon workshops-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <h3>Werkstätten buchen</h3>
            <p>Finde freie Zeitslots und buche den passenden Arbeitsraum.</p>
            <span className="card-arrow">→</span>
          </Link>

          {/* Inbox Card */}
          <Link to="/inbox" className="quick-start-card">
            <div className="card-icon inbox-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 8h18M3 8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2m0 0V7a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1" />
              </svg>
            </div>
            <h3>Anfragen verwalten</h3>
            <p>Status, Benachrichtigungen und Entscheidungen zentral in der Inbox.</p>
            <span className="card-arrow">→</span>
          </Link>
        </div>
      </div>

      {/* Featured Tools Scroll */}
      {tools.length > 0 && (
        <div className="featured-section">
          <h2>Werkzeuge</h2>
          <div className="horizontal-scroll">
            {tools.map((tool) => (
              <Link key={tool.id} to={`/tools/${tool.id}`} className="scroll-card">
                <div className="scroll-card-image">
                  <img src={tool.imageUrl || "https://via.placeholder.com/240x160"} alt={tool.name} />
                </div>
                <h4>{tool.name}</h4>
                <p className="scroll-card-category">{tool.category}</p>
                <div className="scroll-card-status">
                  {tool.status === "VERFUEGBAR" ? (
                    <span className="status-badge available">Verfügbar</span>
                  ) : (
                    <span className="status-badge borrowed">Ausgeliehen</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Featured Workshops Scroll */}
      {workshops.length > 0 && (
        <div className="featured-section">
          <h2>Verfügbare Werkstätten</h2>
          <div className="horizontal-scroll">
            {workshops.map((workshop) => (
              <div key={workshop.id} className="scroll-card">
                <div className="scroll-card-image">
                  <img src={workshop.imageUrls?.[0] || "https://via.placeholder.com/240x160"} alt={workshop.name} />
                </div>
                <h4>{workshop.name}</h4>
                <p>{workshop.location}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
