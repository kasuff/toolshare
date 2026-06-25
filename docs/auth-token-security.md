# Authentifizierung & Token-Sicherheit

Dieses Dokument beschreibt, wie ToolShare Anmelde-Tokens ausstellt, speichert und
widerruft – und warum.

## Überblick

ToolShare nutzt **JWT-Bearer-Tokens** mit einem Zwei-Token-Modell:

| Token | Lebensdauer | Secret | Speicherung Client | Zweck |
|-------|-------------|--------|--------------------|-------|
| Access-Token | kurz (`JWT_EXPIRES_IN`, Default 1h) | `JWT_SECRET` | `localStorage` | autorisiert jeden API-Request (stateless, nur Signaturprüfung) |
| Refresh-Token | lang (`JWT_REFRESH_EXPIRES_IN`, Default 7d) | `JWT_REFRESH_SECRET` | `localStorage` | holt neue Access-Tokens; **serverseitig nachgehalten** |

Der Access-Token bleibt bewusst stateless: keine DB-Abfrage pro Request, gut
skalierbar. Der **Refresh-Token** ist der sicherheitskritische Teil und wird
deshalb serverseitig kontrolliert.

## Refresh-Tokens werden serverseitig nachgehalten

Beim Login/Register/Refresh wird der ausgestellte Refresh-Token serverseitig
gespeichert – aber **nur sein SHA-256-Hash**, nie das Token selbst. Ein DB-Leak
gibt damit keine gültigen Tokens preis.

Tabelle `RefreshToken`: `tokenHash` (unique), `userId`, `expiresAt`, `revokedAt`.

Das ermöglicht drei Dinge, die mit reinen stateless JWTs nicht gehen:

1. **Echtes Logout** – `POST /auth/logout` entwertet den Refresh-Token
   serverseitig (`revokedAt` gesetzt). Danach kann er nicht mehr eingelöst werden.
2. **Rotation** – bei jedem `POST /auth/refresh` wird der alte Token entwertet und
   ein neuer ausgegeben. Ein abgefangener, bereits benutzter Token ist wertlos.
3. **Reuse-Erkennung** – wird ein bereits rotierter/entwerteter Token erneut
   vorgelegt (typisches Diebstahl-Signal), werden **alle** Sitzungen des Nutzers
   widerrufen (`revokeAllRefreshTokensForUser`).

Zusätzlich werden bei **Passwortänderung** alle Refresh-Tokens des Nutzers
widerrufen – ein Passwortwechsel beendet also alle aktiven Sitzungen.

## Getrennte Secrets

Access- und Refresh-Tokens werden mit **unterschiedlichen Secrets** signiert
(`JWT_SECRET` bzw. `JWT_REFRESH_SECRET`). So lässt sich ein geleaktes Access-Token
nicht als Refresh-Token (und umgekehrt) missbrauchen. `JWT_REFRESH_SECRET` fällt
aus Abwärtskompatibilität auf `JWT_SECRET` zurück, **sollte in Produktion aber
separat und zufällig gesetzt sein**.

> Hinweis beim Deploy dieser Änderung: Da Refresh-Tokens jetzt serverseitig
> bekannt sein müssen, werden bereits ausgegebene (alte) Refresh-Tokens ungültig –
> Nutzer müssen sich einmalig neu anmelden.

## Konfiguration

```env
JWT_SECRET=<zufälliges Secret>
JWT_REFRESH_SECRET=<anderes zufälliges Secret>
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d
```

## Bekannte Restschwäche & nächster Schritt

Beide Tokens liegen aktuell im **`localStorage`** und sind damit per JavaScript
lesbar – bei einer XSS-Lücke abgreifbar. Die Refresh-Rotation begrenzt den Schaden
(gestohlene Tokens fliegen bei der nächsten legitimen Rotation auf), beseitigt das
Risiko aber nicht.

**Empfohlene Härtung (separater Schritt):** Refresh-Token in ein
`httpOnly`-Cookie verlagern (nicht JS-lesbar), Access-Token nur im Speicher halten.
Das erfordert `credentials`-Handling in CORS, `SameSite`-Cookies gegen CSRF und
eine Anpassung des Frontend-Fetch-Layers – daher bewusst nicht Teil dieser
Änderung.
