export const SESSION_EXPIRED_EVENT = "toolshare:session-expired";
export const SESSION_EXPIRED_MESSAGE = "Deine Anmeldung ist abgelaufen. Bitte melde dich erneut an.";

export function notifySessionExpired() {
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}
