

import Lenis from "lenis";
import { reducedMotionQuery } from "@/hooks/useReducedMotion";
import { gsap, ScrollTrigger } from "@/lib/gsap";

let lenis: Lenis | null = null;

const prefersReduced = () => window.matchMedia(reducedMotionQuery).matches;

/** Lenis on the GSAP ticker, so Lenis, ScrollTrigger and canvases step on the same frame. Touch keeps native scrolling. */
export function startSmoothScroll(): () => void {
  if (prefersReduced()) return () => {};
  lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1, anchors: true });
  lenis.on("scroll", ScrollTrigger.update);
  const tick = (time: number) => lenis?.raf(time * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
  return () => {
    gsap.ticker.remove(tick);
    gsap.ticker.lagSmoothing(500, 33);
    lenis?.destroy();
    lenis = null;
  };
}

/** In-page links and buttons; falls back to native scrolling without Lenis. */
export function scrollToTarget(target: string | HTMLElement) {
  if (lenis) return lenis.scrollTo(target, { duration: 1 });
  const el = typeof target === "string" ? document.querySelector(target) : target;
  el?.scrollIntoView({ behavior: prefersReduced() ? "auto" : "smooth" });
}

export const getLenis = () => lenis;
