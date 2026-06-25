export type PageParams = { limit: number; offset: number };

/**
 * Liest und begrenzt limit/offset aus Query-Parametern. Ungültige Werte fallen
 * auf sinnvolle Defaults zurück; `limit` wird auf `maxLimit` gedeckelt, damit ein
 * Client nie die komplette Tabelle in einem Request anfordern kann.
 */
export function parsePageParams(
  query: { limit?: unknown; offset?: unknown },
  opts: { defaultLimit: number; maxLimit: number }
): PageParams {
  const rawLimit = Number(query.limit);
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), opts.maxLimit)
      : opts.defaultLimit;

  const rawOffset = Number(query.offset);
  const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0;

  return { limit, offset };
}
