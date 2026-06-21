import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { OfferCard } from "../components/OfferCard";
import { EmptyState, GuestBanner, SkeletonCards } from "../components/ui";
import { useToast } from "../hooks/useToast";
import {  api  } from "@toolshare/shared";
import type {  Tool, User, Workshop, WorkshopSlot, Booking  } from "@toolshare/shared";
import { distanceBetweenLocations } from "@toolshare/shared";
import { formatOfferDistance } from "../utils/offerFormatting";
import {
  getToolStatusBadge,
  getWorkshopStatusBadge,
  isWorkshopCurrentlyInUse
} from "../utils/offerStatus";

type Props = {
  token?: string;
  currentUser?: User;
};

type WorkshopOffer = {
  workshop: Workshop;
  slots: WorkshopSlot[];
};

export function MyOffersPage({ token, currentUser }: Props) {
  const { pushToast } = useToast();
  const [tools, setTools] = useState<Tool[]>([]);
  const [workshops, setWorkshops] = useState<WorkshopOffer[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!token || !currentUser) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const loadOffers = async () => {
      setIsLoading(true);
      setHasError(false);
      try {
        const [ownedTools, ownedWorkshops, userBookings] = await Promise.all([
          api.getTools({ ownerId: currentUser.id }, token),
          api.getWorkshops({ managerId: currentUser.id }, token),
          api.getBookingsForUser(token)
        ]);
        if (cancelled) return;
        setTools(ownedTools.filter((tool) => tool.ownerId === currentUser.id));
        setWorkshops(
          ownedWorkshops
            .filter((entry) => entry.workshop.ownerId === currentUser.id)
            .map(({ workshop, slots }) => ({ workshop, slots }))
        );
        setBookings(userBookings);
      } catch (error) {
        if (cancelled) return;
        setHasError(true);
        pushToast(error instanceof Error ? error.message : "Deine Angebote konnten nicht geladen werden.", "error");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadOffers();
    return () => {
      cancelled = true;
    };
  }, [currentUser, pushToast, token]);

  if (!token || !currentUser) {
    return (
      <section className="stack search-page my-offers-page">
        <GuestBanner text="Melde dich an, um deine Werkzeuge und Werkstätten zu verwalten." />
      </section>
    );
  }

  const hasOffers = tools.length > 0 || workshops.length > 0;

  return (
    <section className="stack search-page my-offers-page">
      <div className="offer-strip my-offers-strip">
        <div>
          <h2>Easy verleihen. Schnell Nachbarn helfen.</h2>
          <p>Jetzt ganz einfach Werkzeuge oder Werkstätten einstellen.</p>
        </div>
        <div className="my-offers-actions">
          <Link to="/tools/new" className="btn offer-tool">
            Werkzeug anbieten
          </Link>
          <Link to="/workshops/new" className="btn offer-tool">
            Werkstatt anbieten
          </Link>
        </div>
      </div>

      <h1>Meine Angebote</h1>

      {isLoading && <SkeletonCards count={4} />}

      {!isLoading && hasError && (
        <EmptyState
          title="Angebote konnten nicht geladen werden"
          text="Bitte versuche es später erneut."
        />
      )}

      {!isLoading && !hasError && !hasOffers && (
        <div className="my-offers-empty">
          <EmptyState
            title="Keine Angebote vorhanden"
            text="Du hast noch keine Werkzeuge oder Werkstätten angeboten."
          />
          <div className="my-offers-actions">
            <Link to="/tools/new" className="btn">
              Werkzeug anbieten
            </Link>
            <Link to="/workshops/new" className="btn secondary">
              Werkstatt anbieten
            </Link>
          </div>
        </div>
      )}

      {!isLoading && !hasError && hasOffers && (
        <>
          <section className="my-offers-section" aria-labelledby="my-workshops-heading">
            <h2 id="my-workshops-heading">Werkstätten</h2>
            {workshops.length === 0 ? (
              <p className="my-offers-section-empty">Du hast noch keine Werkstatt angeboten.</p>
            ) : (
              <div className="cards">
                {workshops.map(({ workshop }) => {
                  const workshopStatus = getWorkshopStatusBadge(
                    isWorkshopCurrentlyInUse(workshop.id, bookings)
                  );
                  return (
                    <OfferCard
                      key={workshop.id}
                      to={{ pathname: `/workshops/${workshop.id}`, search: "?manage=1" }}
                      name={workshop.name}
                      description={workshop.description}
                      imageUrl={workshop.imageUrls[0]}
                      statusLabel={workshopStatus.label}
                      statusUnavailable={workshopStatus.unavailable}
                      meta={formatOfferDistance(
                        distanceBetweenLocations(currentUser.address ?? "München Zentrum", workshop.location)
                      )}
                      ownerName={workshop.ownerName ?? currentUser.name}
                    />
                  );
                })}
              </div>
            )}
          </section>

          <section className="my-offers-section" aria-labelledby="my-tools-heading">
            <h2 id="my-tools-heading">Werkzeuge</h2>
            {tools.length === 0 ? (
              <p className="my-offers-section-empty">Du hast noch kein Werkzeug angeboten.</p>
            ) : (
              <div className="cards">
                {tools.map((tool) => {
                  const toolStatus = getToolStatusBadge(tool.status);
                  return (
                    <OfferCard
                      key={tool.id}
                      to={{ pathname: `/tools/${tool.id}`, search: "?manage=1" }}
                      name={tool.name}
                      description={tool.description}
                      imageUrl={tool.imageUrl}
                      statusLabel={toolStatus.label}
                      statusUnavailable={toolStatus.unavailable}
                      meta={formatOfferDistance(
                        distanceBetweenLocations(currentUser.address ?? "München Zentrum", tool.pickupLocation)
                      )}
                      ownerName={tool.ownerName ?? currentUser.name}
                    />
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
