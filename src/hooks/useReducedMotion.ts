

import { useSyncExternalStore } from "react";

export const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

const subscribe = (cb: () => void) => {
  const mql = window.matchMedia(reducedMotionQuery);
  mql.addEventListener("change", cb);
  return () => mql.removeEventListener("change", cb);
};

/** Single source of truth for reduced motion in components. The server render assumes motion is allowed. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(reducedMotionQuery).matches,
    () => false,
  );
}
