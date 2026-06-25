# Performance: Indizes, Query-Limits & Pagination

Dieses Dokument beschreibt die Maßnahmen gegen unbeschränkte Datenbank-Last und
den geplanten Ausbau zu echter Pagination.

## Ausgangslage

Mehrere List-Endpunkte luden die **komplette** Tabelle, und einige häufig
gefilterte Spalten hatten **keinen Index**. Besonders kritisch: die Inbox lädt
beim 20-Sekunden-Poll alle Buchungen eines Nutzers samt aller verschachtelten
Alternativvorschläge.

## Umgesetzt

### Datenbank-Indizes ([migration](../backend/prisma/migrations/20260625130000_add_performance_indexes))

| Tabelle | Index | Deckt ab |
|---------|-------|----------|
| `Tool` | `ownerId` | „Meine Werkzeuge" / Besitzabfragen |
| `Tool` | `status` | Verfügbarkeitsfilter |
| `Tool` | `category` | Kategoriefilter in der Suche |
| `Notification` | `(userId, createdAt)` | `listByUser` (Filter + Sortierung) |
| `RefreshToken` | `expiresAt` | künftiges Aufräumen abgelaufener Tokens |

### Query-Limits

- **Notifications** (`GET /api/notifications/me`): echte Pagination über
  `?limit=&offset=` (Default neueste **100**, max **200**). Response bleibt ein
  Array → keine Contract-Änderung. Helper: `src/utils/pagination.ts`.
- **Inbox** (`bookings.listForUserContext`): Sicherheits-Caps `take: 100` auf die
  Buchungen *und* auf die verschachtelten `pickupProposals` / `timeslotProposals`.
  Das schützt vor pathologisch großen Antworten (Abuse, sehr lange Verhandlungen);
  im Normalbetrieb (wenige Vorschläge je Thread) ändert sich nichts.

## Bewusst NICHT blind gecappt

**Browse-Endpunkte `GET /api/tools` und `GET /api/workshops`** dürfen **nicht**
einfach einen Default-Cap bekommen: Das Frontend filtert die Ergebnisliste
**clientseitig nach Radius** (Umkreissuche). Ein serverseitiger Cap auf z. B. die
ersten 100 nach Name würde Treffer außerhalb dieser ersten 100 still verschlucken
— die Umkreissuche würde unvollständig.

## Geplante Folgeschritte

1. **Geo-Pagination für Browse-Endpunkte:** Radius/Mittelpunkt an das Backend
   geben, dort filtern/sortieren und seitenweise zurückgeben (Frontend:
   Infinite-Scroll). Erst dann ist ein Cap auf Tools/Werkstätten sicher.
2. **Inbox – Nachrichten lazy laden:** Alternativvorschläge **nicht** in die
   Buchungsliste verschachteln, sondern erst beim Öffnen eines Chats über einen
   eigenen Endpunkt nachladen. Das löst das eigentliche „100 Chats × 100
   Nachrichten"-Szenario (heute durch die Caps nur begrenzt, nicht aufgelöst).
3. **Leichter Unread-Zähler:** Der Ungelesen-Status hängt aktuell am
   client-seitigen `readMessageIds` (localStorage). Für einen schlanken
   Glocken-Poll müsste der Lesestatus serverseitig nachgehalten werden
   (eigener Count-Endpunkt statt voller Inbox-Last).
4. **Pagination der Admin-/Moderations-Listen** analog (eigene Seiten-Navigation).

## Verwandt

- Rate-Limiting nutzt aktuell einen In-Memory-Store (pro Instanz). Vor horizontaler
  Skalierung sollte ein geteilter Redis-Store her — siehe Hinweis in
  `src/middleware/rate-limit.ts`.
