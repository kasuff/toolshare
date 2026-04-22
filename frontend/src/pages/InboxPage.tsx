import { useMemo, useState } from "react";
import { api } from "../services/mockApi";
import type { Booking, BookingStatus, BookingType, User } from "../types/domain";

type Props = {
  currentUser: User;
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

export function InboxPage({ currentUser }: Props) {
  const [altByBooking, setAltByBooking] = useState<Record<string, string>>({});
  const bookings = useMemo(() => api.getBookingsForUser(currentUser.id), [currentUser.id]);
  const notifications = useMemo(() => api.getNotifications(currentUser.id), [currentUser.id]);

  const isProvider = (b: Booking) => b.providerId === currentUser.id;

  const decide = (bookingId: string, accept: boolean) => {
    api.decideBooking(bookingId, accept ? "BESTAETIGT" : "ABGELEHNT");
    window.location.reload();
  };

  const suggestAlternative = (bookingId: string) => {
    const value = altByBooking[bookingId];
    if (!value) {
      alert("Bitte Alternativzeit eintragen.");
      return;
    }
    api.suggestAlternativePickup(bookingId, value);
    window.location.reload();
  };

  const close = (bookingId: string) => {
    api.closeBooking(bookingId);
    window.location.reload();
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
                  <button onClick={() => decide(b.id, true)}>Annehmen</button>
                  <button className="ghost" onClick={() => decide(b.id, false)}>
                    Ablehnen
                  </button>
                  {b.type === "TOOL" && (
                    <>
                      <input
                        type="datetime-local"
                        value={altByBooking[b.id] || ""}
                        onChange={(e) =>
                          setAltByBooking((prev) => ({ ...prev, [b.id]: e.target.value }))
                        }
                      />
                      <button className="ghost" onClick={() => suggestAlternative(b.id)}>
                        Alternativzeit senden
                      </button>
                    </>
                  )}
                </div>
              )}
              {b.status === "BESTAETIGT" && (
                <button onClick={() => close(b.id)}>Als abgeschlossen markieren</button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
