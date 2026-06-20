export const SESSION_EXPIRED_MESSAGE = "Deine Anmeldung ist abgelaufen. Bitte melde dich erneut an.";

type SessionExpiredListener = () => void;
const listeners = new Set<SessionExpiredListener>();

export function notifySessionExpired() {
  listeners.forEach(l => l());
}

export function onSessionExpired(listener: SessionExpiredListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
