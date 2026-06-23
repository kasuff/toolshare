import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { DateInput } from "../components/DateInput";
import { OfferCard } from "../components/OfferCard";
import { EmptyState, Field, GuestBanner, SkeletonCards, Surface } from "../components/ui";
import { SearchRadiusMap } from "../components/SearchRadiusMap";
import { useTools } from "../hooks/queries/tools.queries";
import {  TOOL_CATEGORIES  } from "@toolshare/shared";
import { distanceBetweenLocations, isWithinRadius } from "@toolshare/shared";
import { formatOfferDistance } from "../utils/offerFormatting";
import {  pluralize  } from "@toolshare/shared";
import type {  User  } from "@toolshare/shared";
import { usePageAuth } from "../hooks/usePageAuth";

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

type Props = {
  currentUser?: User;
  token?: string | null;
};

export function ToolsPage({ currentUser: propUser, token: propToken }: Props = {}) {
  const { currentUser, token } = usePageAuth(propUser, propToken);
  const defaultLocation = currentUser?.address ?? "München Zentrum";
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [borrowFrom, setBorrowFrom] = useState("");
  const [borrowUntil, setBorrowUntil] = useState("");
  const [radiusKm, setRadiusKm] = useState(5);

  const { data: tools = [], isLoading, isFetched } = useTools({ q }, token);

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
            {isLoading ? "Suche läuft..." : pluralize(filteredTools.length, "Ergebnis", "Ergebnisse")}
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
                  <DateInput value={borrowFrom} onChange={setBorrowFrom} />
                </Field>
                <Field label="Ausleihe bis">
                  <DateInput value={borrowUntil} onChange={setBorrowUntil} />
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
      <div className={`cards ${!isLoading && isFetched && filteredTools.length === 0 ? "cards-empty" : ""}`}>
        {isLoading && <SkeletonCards />}
        {!isLoading && isFetched && filteredTools.length === 0 && (
          <EmptyState title="Kein Werkzeug gefunden" text="Passe Suche oder Kategorie an, um passende Werkzeuge zu finden." />
        )}
        {filteredTools.map((tool) => {
          const distance = distanceBetweenLocations(defaultLocation, tool.pickupLocation);
          const ownerName = tool.ownerName ?? "Unbekannt";
          return (
            <OfferCard
              key={tool.id}
              to={`/tools/${tool.id}`}
              name={tool.name}
              description={tool.description}
              imageUrl={tool.imageUrl}
              meta={formatOfferDistance(distance)}
              ownerName={ownerName}
            />
          );
        })}
      </div>
    </section>
  );
}
