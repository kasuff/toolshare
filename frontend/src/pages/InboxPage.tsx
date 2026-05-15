import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, StatusPill, Surface } from "../components/ui";
import { useToast } from "../hooks/useToast";
import { api } from "../services/api";
import type { Booking, BookingStatus, BookingType, User } from "../types/domain";

type Props = {
  currentUser?: User;
  token?: string;
};

const bookingTypeLabel: Record<BookingType, string> = {
  TOOL: "Werkzeug",
  WORKSHOP: "Werkstatt",
};

const bookingStatusLabel: Record<BookingStatus, string> = {
  OFFEN: "Offen",
  BESTAETIGT: "Bestätigt",
  ABGELEHNT: "Abgelehnt",
  ABGESCHLOSSEN: "Abgeschlossen",
};

export function InboxPage({ currentUser, token }: Props) {
  const { pushToast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [notifications, setNotifications] = useState<Array<{ id: string; message: string; createdIso: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadData = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const [bookingResult, notificationResult] = await Promise.all([
        api.getBookingsForUser(token),
        api.getNotifications(token)
      ]);
      setBookings(bookingResult);
      setNotifications(notificationResult);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Inbox konnte nicht geladen werden.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const isProvider = (b: Booking) => (currentUser ? b.providerId === currentUser.id : false);

  const decide = async (bookingId: string, accept: boolean) => {
    if (!token) return;
    try {
      await api.decideBooking(bookingId, accept ? "BESTAETIGT" : "ABGELEHNT", token);
      await loadData();
      pushToast(`Anfrage ${accept ? "bestätigt" : "abgelehnt"}.`, "success");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Status konnte nicht gesetzt werden.", "error");
    }
  };

  const close = async (bookingId: string) => {
    if (!token) return;
    try {
      await api.decideBooking(bookingId, "ABGESCHLOSSEN", token);
      await loadData();
      pushToast("Buchung als abgeschlossen markiert.", "success");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Buchung konnte nicht abgeschlossen werden.", "error");
    }
  };

  if (!token || !currentUser) {
    return (
      <section className="stack">
        <h1>Inbox</h1>
        <Surface title="Login erforderlich" subtitle="Die Inbox ist nur für eingeloggte Nutzer verfügbar">
          <div className="row">
            <Link to="/auth" className="btn">
              Einloggen
            </Link>
          </div>
        </Surface>
      </section>
    );
  }

  return (
    <section className="stack">
      <h1>Inbox</h1>
      <Surface title="Benachrichtigungen">
        {isLoading && <p>Lade Inbox...</p>}
        {notifications.length === 0 ? (
          <EmptyState title="Keine Benachrichtigungen" text="Sobald sich ein Status ändert, erscheint hier ein Eintrag." />
        ) : (
          <ul className="meta-list">
            {notifications.map((n) => (
              <li key={n.id}>
                [{new Date(n.createdIso).toLocaleString()}] {n.message}
              </li>
            ))}
          </ul>
        )}
      </Surface>

      <Surface title="Buchungen und Anfragen">
        {bookings.length === 0 && <EmptyState title="Keine Einträge" text="Es liegen aktuell keine Buchungen oder Anfragen vor." />}
        <ul>
          {bookings.map((b) => (
            <li key={b.id} className="inbox-item">
              <p>
                <strong>{bookingTypeLabel[b.type]}</strong> | Status:{" "}
                <StatusPill
                  label={bookingStatusLabel[b.status]}
                  tone={b.status === "BESTAETIGT" ? "success" : b.status === "ABGELEHNT" ? "danger" : "neutral"}
                />
              </p>
              {b.pickupTimeIso && (
                <p>Angefragte Abholzeit: {new Date(b.pickupTimeIso).toLocaleString()}</p>
              )}
              {b.altPickupTimeIso && (
                <p>Alternativzeit: {new Date(b.altPickupTimeIso).toLocaleString()}</p>
              )}
              {isProvider(b) && b.status === "OFFEN" && (
                <div className="row">
                  <button onClick={() => void decide(b.id, true)}>Annehmen</button>
                  <button className="ghost" onClick={() => void decide(b.id, false)}>
                    Ablehnen
                  </button>
                </div>
              )}
              {b.status === "BESTAETIGT" && (
                <button onClick={() => void close(b.id)}>Als abgeschlossen markieren</button>
              )}
            </li>
          ))}
        </ul>
      </Surface>
    </section>
  );
}
