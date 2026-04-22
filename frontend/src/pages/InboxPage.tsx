import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { Booking, BookingStatus, BookingType, User } from "../types/domain";

type Props = {
  currentUser: User;
  token: string;
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
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [notifications, setNotifications] = useState<Array<{ id: string; message: string; createdIso: string }>>([]);

  const loadData = async () => {
    try {
      const [bookingResult, notificationResult] = await Promise.all([
        api.getBookingsForUser(token),
        api.getNotifications(token)
      ]);
      setBookings(bookingResult);
      setNotifications(notificationResult);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Inbox konnte nicht geladen werden.");
    }
  };

  useEffect(() => {
    void loadData();
  }, [token]);

  const isProvider = (b: Booking) => b.providerId === currentUser.id;

  const decide = async (bookingId: string, accept: boolean) => {
    try {
      await api.decideBooking(bookingId, accept ? "BESTAETIGT" : "ABGELEHNT", token);
      await loadData();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Status konnte nicht gesetzt werden.");
    }
  };

  const close = async (bookingId: string) => {
    try {
      await api.decideBooking(bookingId, "ABGESCHLOSSEN", token);
      await loadData();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Buchung konnte nicht abgeschlossen werden.");
    }
  };

  return (
    <section>
      <h1>Inbox</h1>
      <div className="panel">
        <h2>Benachrichtigungen</h2>
        {notifications.length === 0 ? (
          <p>Keine Benachrichtigungen.</p>
        ) : (
          <ul>
            {notifications.map((n) => (
              <li key={n.id}>
                [{new Date(n.createdIso).toLocaleString()}] {n.message}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="panel">
        <h2>Buchungen und Anfragen</h2>
        {bookings.length === 0 && <p>Keine Einträge.</p>}
        <ul>
          {bookings.map((b) => (
            <li key={b.id} className="inbox-item">
              <p>
                <strong>{bookingTypeLabel[b.type]}</strong> | Status: <strong>{bookingStatusLabel[b.status]}</strong>
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
      </div>
    </section>
  );
}
