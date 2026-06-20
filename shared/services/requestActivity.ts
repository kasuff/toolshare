type ActivityListener = () => void;

const listeners = new Set<ActivityListener>();
let activeRequests = 0;

function notify() {
  listeners.forEach((listener) => listener());
}

export function beginRequestActivity() {
  let finished = false;
  activeRequests += 1;
  notify();

  return () => {
    if (finished) return;
    finished = true;
    activeRequests = Math.max(0, activeRequests - 1);
    notify();
  };
}

export function subscribeToRequestActivity(listener: ActivityListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getActiveRequestCount() {
  return activeRequests;
}
