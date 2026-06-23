import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DateInput } from "../components/DateInput";
import { OfferCard } from "../components/OfferCard";
import { SearchRadiusMap } from "../components/SearchRadiusMap";
import { EmptyState, Field, GuestBanner, SkeletonCards, Surface } from "../components/ui";
import { DEFAULT_PLACEHOLDER_IMAGE } from "@toolshare/shared";
import { useWorkshops, workshopKeys } from "../hooks/queries/workshops.queries";
import { distanceBetweenPoints, isDateRangeAvailable, isPointWithinRadius, type GeoPoint } from "@toolshare/shared";
import { formatOfferDistance } from "../utils/offerFormatting";
import { pluralize } from "@toolshare/shared";
import type { User } from "@toolshare/shared";
import { usePageAuth } from "../hooks/usePageAuth";
import { WorkshopDetailView, type WorkshopListItem } from "../components/WorkshopDetailView";

type Props = {
  currentUser?: User;
  token?: string | null;
};

export function WorkshopsPage({ currentUser: propUser, token: propToken }: Props = {}) {
  const { currentUser, token } = usePageAuth(propUser, propToken);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id: openWorkshopId } = useParams();
  const [searchParams] = useSearchParams();

  const [q, setQ] = useState("");
  const [toolFilter, setToolFilter] = useState("");
  const [borrowFrom, setBorrowFrom] = useState("");
  const [borrowUntil, setBorrowUntil] = useState("");
  const [maxCapacityFilter, setMaxCapacityFilter] = useState(10);
  const [radiusKm, setRadiusKm] = useState(15);
  const [selectedWorkshopId, setSelectedWorkshopId] = useState<string | null>(null);

  const defaultLocation = currentUser?.address ?? "München Zentrum";
  const originPoint: GeoPoint = {
    latitude: currentUser?.latitude,
    longitude: currentUser?.longitude,
    location: defaultLocation
  };
  const { data: rawItems = [], isLoading, isFetched } = useWorkshops({ q }, token);

  const items = useMemo<WorkshopListItem[]>(
    () =>
      rawItems.map(({ workshop, slots, bookedRanges, tools }) => ({
        workshop,
        slots,
        bookedRanges,
        tools:
          tools ??
          workshop.equipmentItems.map((item) => ({
            id: item.id,
            ownerId: workshop.ownerId,
            ownerName: workshop.ownerName,
            name: item.name,
            description: "Werkstatt-Werkzeug",
            category: item.category,
            imageUrl: DEFAULT_PLACEHOLDER_IMAGE,
            status: "VERFUEGBAR" as const,
            selectable: true
          }))
      })),
    [rawItems]
  );

  const toolFilterOptions = useMemo(() => {
    const options = new Map<string, string>();
    items.forEach((item) => {
      item.tools.filter((tool) => tool.selectable).forEach((tool) => {
        options.set(tool.id, tool.name);
      });
    });
    return Array.from(options, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [items]);

  const candidateItems = useMemo(() => {
    return items
      .filter((item) => {
        if (!toolFilter) return true;
        return item.tools.some((tool) => tool.selectable && (tool.id === toolFilter || tool.name.toLowerCase().includes(toolFilter.toLowerCase()) || tool.category === toolFilter));
      })
      .filter((item) => item.workshop.maxCapacity <= maxCapacityFilter)
      .filter((item) => (!borrowFrom || !borrowUntil) ? true : isDateRangeAvailable(borrowFrom, borrowUntil, item.slots, item.bookedRanges));
  }, [borrowFrom, borrowUntil, items, maxCapacityFilter, toolFilter]);

  const filteredItems = useMemo(() => {
    return candidateItems
      .map((item) => ({
        item,
        distance: distanceBetweenPoints(originPoint, {
          latitude: item.workshop.latitude,
          longitude: item.workshop.longitude,
          location: item.workshop.location
        })
      }))
      .filter(({ item }) =>
        isPointWithinRadius(
          originPoint,
          {
            latitude: item.workshop.latitude,
            longitude: item.workshop.longitude,
            location: item.workshop.location
          },
          radiusKm
        )
      )
      .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
      .map((entry) => entry.item);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateItems, currentUser?.latitude, currentUser?.longitude, defaultLocation, radiusKm]);

  const selectedWorkshop = useMemo(() => {
    const workshopId = selectedWorkshopId ?? openWorkshopId;
    if (!workshopId) return null;
    return items.find((item) => item.workshop.id === workshopId) ?? null;
  }, [items, openWorkshopId, selectedWorkshopId]);

  useEffect(() => {
    if (!openWorkshopId || selectedWorkshopId === openWorkshopId || items.length === 0) return;
    const match = items.find((item) => item.workshop.id === openWorkshopId);
    if (match) {
      setSelectedWorkshopId(openWorkshopId);
    }
  }, [items, openWorkshopId, selectedWorkshopId]);

  const hasActiveFilters = Boolean(q || toolFilter || borrowFrom || borrowUntil || maxCapacityFilter !== 10 || radiusKm !== 15);

  const resetFilters = () => {
    setQ("");
    setToolFilter("");
    setBorrowFrom("");
    setBorrowUntil("");
    setMaxCapacityFilter(10);
    setRadiusKm(15);
  };

  const openWorkshop = (workshop: WorkshopListItem) => {
    navigate(`/workshops/${workshop.workshop.id}`);
  };

  const closeWorkshop = () => {
    navigate(searchParams.get("manage") === "1" ? "/offers" : "/workshops");
  };

  const publicWorkshops = filteredItems;

  return (
    <section className={`stack search-page ${selectedWorkshop ? "has-workshop-detail" : ""}`.trim()}>
      {!selectedWorkshop && (
        <>
          {!token && <GuestBanner text="Du kannst als Gast stöbern. Für Buchungsanfragen melde dich bitte an." />}
          {token && (
            <div className="offer-strip">
              <div>
                <h2>Easy verleihen. Schnell Nachbarn helfen.</h2>
                <p>Jetzt ganz einfach private Werkstätten einstellen.</p>
              </div>
              <button className="btn offer-tool" onClick={() => navigate("/workshops/new")}>
                Werkstatt anbieten
              </button>
            </div>
          )}
          <div className="page-header">
            <div className="stack">
              <h1>Werkstätten</h1>
            </div>
          </div>
          <Surface title="Suche und Filter" className="interactive">
            <div className="filter-toolbar">
              <p className="result-summary">
                {isLoading ? "Suche läuft..." : pluralize(publicWorkshops.length, "Ergebnis", "Ergebnisse")}
              </p>
              {hasActiveFilters && (
                <button type="button" className="btn secondary" onClick={resetFilters}>
                  Filter zurücksetzen
                </button>
              )}
            </div>
            <div className="grid grid-2">
              <Field label="Suche">
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Werkstattname oder Beschreibung" />
              </Field>
              <Field label="Werkzeugfilter">
                <select value={toolFilter} onChange={(e) => setToolFilter(e.target.value)}>
                  <option value="">Alle verfügbaren Werkzeuge</option>
                  {toolFilterOptions.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
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
                  <div className="slider-row">
                    <label htmlFor="capacity-slider">
                      Maximale Kapazität bis: <strong>{maxCapacityFilter}</strong>
                    </label>
                    <input
                      id="capacity-slider"
                      className="capacity-slider"
                      type="range"
                      min={1}
                      max={10}
                      value={maxCapacityFilter}
                      style={{ "--range-progress": `${((maxCapacityFilter - 1) / 9) * 100}%` } as CSSProperties}
                      onChange={(e) => setMaxCapacityFilter(Number(e.target.value))}
                    />
                  </div>
                </div>
                <SearchRadiusMap
                  centerAddress={defaultLocation}
                  centerLatitude={currentUser?.latitude}
                  centerLongitude={currentUser?.longitude}
                  points={candidateItems.map((item) => ({
                    id: item.workshop.id,
                    label: item.workshop.name,
                    location: item.workshop.location,
                    latitude: item.workshop.latitude,
                    longitude: item.workshop.longitude
                  }))}
                  radiusKm={radiusKm}
                  onRadiusChange={setRadiusKm}
                  sliderId="workshop-radius-slider"
                />
              </div>
            </details>
          </Surface>
          <div className={`cards ${!isLoading && isFetched && publicWorkshops.length === 0 ? "cards-empty" : ""}`}>
            {isLoading && <SkeletonCards />}
            {!isLoading && isFetched && publicWorkshops.length === 0 && (
              <EmptyState title="Keine Werkstatt gefunden" text="Passe die Suche an oder prüfe später erneut." />
            )}
            {publicWorkshops.map((item) => {
              const distance = distanceBetweenPoints(originPoint, {
                latitude: item.workshop.latitude,
                longitude: item.workshop.longitude,
                location: item.workshop.location
              });
              const ownerName = item.workshop.ownerName ?? "Unbekannt";
              const primaryImage = item.workshop.imageUrls[0];
              const cardImage = primaryImage || DEFAULT_PLACEHOLDER_IMAGE;
              return (
                <OfferCard
                  key={item.workshop.id}
                  name={item.workshop.name}
                  description={item.workshop.description}
                  imageUrl={cardImage}
                  meta={formatOfferDistance(distance)}
                  ownerName={ownerName}
                  onSelect={() => openWorkshop(item)}
                />
              );
            })}
          </div>
        </>
      )}
      {selectedWorkshop && (
        <WorkshopDetailView
          selectedWorkshop={selectedWorkshop}
          selectedWorkshopOwnerOfferCount={items.filter(i => i.workshop.ownerId === selectedWorkshop.workshop.ownerId).length}
          currentUser={currentUser ?? undefined}
          token={token}
          onClose={closeWorkshop}
          onBlockSuccess={(workshopId, refreshed) => {
            queryClient.setQueriesData(
              { queryKey: workshopKeys.lists() },
              (current: typeof rawItems | undefined) => {
                if (!current) return current;
                return current.map((entry) =>
                  entry.workshop.id === workshopId
                    ? {
                        ...entry,
                        workshop: refreshed.workshop,
                        slots: refreshed.slots
                      }
                    : entry
                );
              }
            );
          }}
          onDeleteSuccess={() => navigate("/offers")}
        />
      )}
    </section>
  );
}
