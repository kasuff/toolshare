import { Link } from "react-router-dom";
import { useMemo } from "react";
import { DateInput } from "../components/DateInput";
import { OfferCard } from "../components/OfferCard";
import { EmptyState, Field, GuestBanner, SkeletonCards, Surface } from "../components/ui";
import { SearchRadiusMap } from "../components/SearchRadiusMap";
import { useTools } from "../hooks/queries/tools.queries";
import {  TOOL_CATEGORIES  } from "@toolshare/shared";
import { distanceBetweenPoints, isPointWithinRadius, type GeoPoint } from "@toolshare/shared";
import { formatOfferDistance } from "../utils/offerFormatting";
import {  pluralize  } from "@toolshare/shared";
import type {  User  } from "@toolshare/shared";
import { usePageAuth } from "../hooks/usePageAuth";
import { DEFAULT_RADIUS_KM, useFilterStore } from "../store/filterStore";

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
  const originPoint: GeoPoint = {
    latitude: currentUser?.latitude,
    longitude: currentUser?.longitude,
    location: defaultLocation
  };
  const { q, category, borrowFrom, borrowUntil, radiusKm, advancedOpen } = useFilterStore(
    (state) => state.toolFilters
  );
  const setToolFilter = useFilterStore((state) => state.setToolFilter);
  const resetToolFilters = useFilterStore((state) => state.resetToolFilters);

  const setQ = (value: string) => setToolFilter("q", value);
  const setCategory = (value: string) => setToolFilter("category", value);
  const setBorrowFrom = (value: string) => setToolFilter("borrowFrom", value);
  const setBorrowUntil = (value: string) => setToolFilter("borrowUntil", value);
  const setRadiusKm = (value: number) => setToolFilter("radiusKm", value);

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
    return candidateTools
      .map((tool) => ({
        tool,
        distance: distanceBetweenPoints(originPoint, {
          latitude: tool.pickupLat,
          longitude: tool.pickupLon,
          location: tool.pickupLocation
        })
      }))
      .filter(({ tool }) =>
        isPointWithinRadius(
          originPoint,
          { latitude: tool.pickupLat, longitude: tool.pickupLon, location: tool.pickupLocation },
          radiusKm
        )
      )
      .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
      .map((entry) => entry.tool);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateTools, currentUser?.latitude, currentUser?.longitude, defaultLocation, radiusKm]);

  const hasActiveFilters = Boolean(
    q || category || borrowFrom || borrowUntil || radiusKm !== DEFAULT_RADIUS_KM
  );

  const resetFilters = resetToolFilters;

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
        <details
          className="advanced-filter-panel"
          open={advancedOpen}
          onToggle={(e) => setToolFilter("advancedOpen", e.currentTarget.open)}
        >
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
              centerLatitude={currentUser?.latitude}
              centerLongitude={currentUser?.longitude}
              points={candidateTools.map((tool) => ({
                id: tool.id,
                label: tool.name,
                location: tool.pickupLocation,
                latitude: tool.pickupLat,
                longitude: tool.pickupLon
              }))}
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
          const distance = distanceBetweenPoints(originPoint, {
            latitude: tool.pickupLat,
            longitude: tool.pickupLon,
            location: tool.pickupLocation
          });
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
