type Listener = () => void;

const listeners = new Set<Listener>();

export function notifyInboxBadgeRefresh(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeInboxBadgeRefresh(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
