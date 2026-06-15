import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { EmptyState, Field, GuestBanner, SkeletonCards, Surface } from "../components/ui";
import { SearchRadiusMap } from "../components/SearchRadiusMap";
import { useToast } from "../hooks/useToast";
import { api } from "../services/api";
import { TOOL_CATEGORIES } from "../utils/categories";
import { distanceBetweenLocations, isWithinRadius } from "../utils/searchFilters";
import type { User } from "../types/domain";

type Props = {
  token?: string;
  currentUser?: User;
};

function categoryMatches(toolCategory: string, selectedCategory: string) {
  if (!selectedCategory) return true;
  const normalizedTool = toolCategory.toLowerCase();
  const category = TOOL_CATEGORIES.find((item) => item.value === selectedCategory);
  return (
    normalizedTool.includes(selectedCategory.toLowerCase()) ||
    Boolean(category && normalizedTool.includes(category.label.toLowerCase())) ||
    Boolean(category && category.label.toLowerCase().includes(normalizedTool))
  );
}

function formatCardDistance(distance: number | null) {
  return distance === null ? "Distanz offen" : `${distance.toFixed(1)} km`;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function ToolsPage({ token, currentUser }: Props) {
  const { pushToast } = useToast();
  const defaultLocation = currentUser?.address ?? "München Zentrum";
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [borrowFrom, setBorrowFrom] = useState("");
  const [borrowUntil, setBorrowUntil] = useState("");
  const [radiusKm, setRadiusKm] = useState(5);
  const [tools, setTools] = useState<Awaited<ReturnType<typeof api.getTools>>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    const run = async () => {
      setIsLoading(true);
      try {
        const next = await api.getTools({ q }, token ?? "");
        setTools(next);
      } catch (error) {
        pushToast(error instanceof Error ? error.message : "Werkzeuge konnten nicht geladen werden.", "error");
      } finally {
        setIsLoading(false);
        setHasLoaded(true);
      }
    };
    void run();
  }, [q, token, pushToast]);

  const candidateTools = useMemo(() => {
    return tools
      .filter((tool) => categoryMatches(tool.category, category))
      .filter((tool) => {
        if (!borrowFrom && !borrowUntil) return true;
        return tool.status === "VERFUEGBAR";
      });
  }, [borrowFrom, borrowUntil, category, tools]);

  const filteredTools = useMemo(() => {
    return candidateTools.filter((tool) => isWithinRadius(defaultLocation, tool.pickupLocation, radiusKm));
  }, [candidateTools, defaultLocation, radiusKm]);

  const hasActiveFilters = Boolean(
    q || category || borrowFrom || borrowUntil || radiusKm !== 5
  );

  const resetFilters = () => {
    setQ("");
    setCategory("");
    setBorrowFrom("");
    setBorrowUntil("");
    setRadiusKm(5);
  };

  return (
    <section className="stack search-page">
      {!token && (
        <GuestBanner text="Du kannst als Gast stöbern. Für Ausleihanfragen melde dich bitte an." />
      )}

      {token && (
        <div className="offer-strip">
          <div>
            <h2>Easy verleihen. Schnell Nachbarn helfen.</h2>
            <p>Jetzt ganz einfach privat Werkzeuge einstellen.</p>
          </div>
          <Link to="/tools/new" className="btn offer-tool">
            Werkzeug anbieten
          </Link>
        </div>
      )}

      <h1>Werkzeuge</h1>

      <Surface title="Suche und Filter" className="interactive">
        <div className="filter-toolbar">
          <p className="result-summary">
            {isLoading ? "Suche läuft..." : `${filteredTools.length} Ergebnis${filteredTools.length === 1 ? "" : "se"}`}
          </p>
          {hasActiveFilters && (
            <button className="btn secondary" type="button" onClick={resetFilters}>
              Filter zurücksetzen
            </button>
          )}
        </div>
        <div className="grid grid-2">
          <Field label="Suche">
            <input placeholder="Name oder Beschreibung" value={q} onChange={(e) => setQ(e.target.value)} />
          </Field>
          <Field label="Kategorie">
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Alle Kategorien</option>
              {TOOL_CATEGORIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <details className="advanced-filter-panel">
          <summary>Erweiterte Filter anzeigen</summary>
          <div className="advanced-filter-grid">
            <div className="advanced-filter-fields">
              <div className="grid grid-2">
                <Field label="Ausleihe von">
                  <input type="date" value={borrowFrom} onChange={(e) => setBorrowFrom(e.target.value)} />
                </Field>
                <Field label="Ausleihe bis">
                  <input type="date" value={borrowUntil} onChange={(e) => setBorrowUntil(e.target.value)} />
                </Field>
              </div>
            </div>
            <SearchRadiusMap
              centerAddress={defaultLocation}
              points={candidateTools.map((tool) => ({ id: tool.id, label: tool.name, location: tool.pickupLocation }))}
              radiusKm={radiusKm}
              onRadiusChange={setRadiusKm}
              sliderId="tool-radius-slider"
            />
          </div>
        </details>
      </Surface>
      <div className={`cards ${!isLoading && hasLoaded && filteredTools.length === 0 ? "cards-empty" : ""}`}>
        {isLoading && <SkeletonCards />}
        {!isLoading && hasLoaded && filteredTools.length === 0 && (
          <EmptyState title="Kein Werkzeug gefunden" text="Passe Suche oder Kategorie an, um passende Werkzeuge zu finden." />
        )}
        {filteredTools.map((tool) => {
          const distance = distanceBetweenLocations(defaultLocation, tool.pickupLocation);
          const ownerName = tool.ownerName ?? "Unbekannt";
          return (
            <Link
              key={tool.id}
              to={`/tools/${tool.id}`}
              className="ds-workshop-card card-enter card-link"
            >
              <div className="ds-workshop-card-media">
                <span className={`ds-workshop-card-badge ${tool.status === "VERFUEGBAR" ? "" : "unavailable"}`.trim()}>
                  {tool.status === "VERFUEGBAR" ? "✓ Verfügbar" : "✕ Nicht verfügbar"}
                </span>
                {tool.imageUrl ? (
                  <img className="ds-workshop-card-image" src={tool.imageUrl} alt={tool.name} />
                ) : (
                  <div className="ds-workshop-card-icon" aria-label={tool.name} title={tool.name}>
                    🪛
                  </div>
                )}
              </div>
              <div className="ds-workshop-card-body">
                <div className="ds-workshop-card-distance">{formatCardDistance(distance)}</div>
                <h3>{tool.name}</h3>
                <p className="ds-workshop-card-description">{tool.description}</p>
                <div className="ds-workshop-card-divider" />
                <div className="ds-workshop-card-footer">
                  <div className="ds-workshop-card-owner">
                    <span className="ds-workshop-card-avatar">{getInitials(ownerName)}</span>
                    <span>{ownerName}</span>
                  </div>
                  <span className="ds-workshop-card-details">Details</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
