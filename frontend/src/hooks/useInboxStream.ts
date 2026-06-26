import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { inboxKeys } from "./queries/inbox.queries";

const apiBaseUrl =
  ((import.meta as unknown as { env: { VITE_API_URL?: string } }).env.VITE_API_URL as
    | string
    | undefined) ?? "http://localhost:4000/api";

/**
 * Echtzeit-Aktualisierung der Inbox via Server-Sent Events. Der Server schickt bei
 * relevanten Ereignissen einen leichten "inbox-changed"-Ping; daraufhin werden die
 * Inbox-Queries (Daten + Read-Receipts, beide unter dem Key ["inbox"]) invalidiert
 * und neu geladen. EventSource übernimmt das automatische Reconnect; das Polling in
 * den Queries bleibt als Sicherheitsnetz.
 *
 * Token wird als Query-Param übergeben, da EventSource keine Header setzen kann.
 */
export function useInboxStream(token: string | null | undefined, userId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!token || !userId) return;
    // EventSource fehlt in Nicht-Browser-Umgebungen (Tests/jsdom, SSR) → dann kein
    // SSE; das Query-Polling bleibt als Fallback aktiv.
    if (typeof EventSource === "undefined") return;

    const url = `${apiBaseUrl}/inbox/stream?token=${encodeURIComponent(token)}`;
    const source = new EventSource(url);

    const onChanged = () => {
      void queryClient.invalidateQueries({ queryKey: inboxKeys.all });
    };
    source.addEventListener("inbox-changed", onChanged);

    return () => {
      source.removeEventListener("inbox-changed", onChanged);
      source.close();
    };
  }, [token, userId, queryClient]);
}
