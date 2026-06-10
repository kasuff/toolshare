import { useEffect, useRef, useState } from "react";
import {
  getActiveRequestCount,
  subscribeToRequestActivity
} from "../services/requestActivity";

const SHOW_DELAY_MS = 180;
const MIN_VISIBLE_MS = 420;

export function GlobalProgressBar() {
  const [isVisible, setIsVisible] = useState(false);
  const visibleSinceRef = useRef(0);
  const showTimerRef = useRef<number>();
  const hideTimerRef = useRef<number>();

  useEffect(() => {
    const clearShowTimer = () => {
      if (showTimerRef.current !== undefined) {
        window.clearTimeout(showTimerRef.current);
        showTimerRef.current = undefined;
      }
    };
    const clearHideTimer = () => {
      if (hideTimerRef.current !== undefined) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = undefined;
      }
    };

    const update = () => {
      if (getActiveRequestCount() > 0) {
        clearHideTimer();
        if (visibleSinceRef.current || showTimerRef.current !== undefined) return;

        showTimerRef.current = window.setTimeout(() => {
          showTimerRef.current = undefined;
          visibleSinceRef.current = Date.now();
          setIsVisible(true);
        }, SHOW_DELAY_MS);
        return;
      }

      clearShowTimer();
      if (!visibleSinceRef.current) return;

      const elapsed = Date.now() - visibleSinceRef.current;
      hideTimerRef.current = window.setTimeout(() => {
        hideTimerRef.current = undefined;
        visibleSinceRef.current = 0;
        setIsVisible(false);
      }, Math.max(0, MIN_VISIBLE_MS - elapsed));
    };

    update();
    const unsubscribe = subscribeToRequestActivity(update);
    return () => {
      unsubscribe();
      clearShowTimer();
      clearHideTimer();
    };
  }, []);

  return (
    <div
      className={`global-progress ${isVisible ? "visible" : ""}`}
      role="progressbar"
      aria-label="Aktion wird ausgeführt"
      aria-hidden={!isVisible}
    >
      <span className="global-progress-bar" />
    </div>
  );
}
