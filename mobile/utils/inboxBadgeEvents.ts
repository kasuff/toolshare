type Listener = (count?: number) => void;

const listeners = new Set<Listener>();

/** Pass a precomputed count to update the tab badge without another API round-trip. */
export function notifyInboxBadgeRefresh(count?: number): void {
  listeners.forEach((listener) => listener(count));
}

export function subscribeInboxBadgeRefresh(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
