

import { useEffect, useState } from "react";
import { getLenis } from "@/lib/smoothScroll";
import { loaderSkin } from "./loaderSkins";

type Props = {
  done: boolean;
  reducedMotion: boolean;
  /** Covers the whole screen and locks scrolling (full layout) instead of filling its frame. */
  fullscreen?: boolean;
  /** Example slug; picks that example's own loader look (see loaderSkins.tsx). */
  skin?: string;
};

/** Shortest time the loader stays up. A deliberate delay: on a fast load the counter still runs through to 100 instead of flashing. */
const MIN_MS = 1600;
/** Shortest count-up from wherever the counter is to 100 once the experiment is ready. */
const FINISH_MS = 450;
/** Matches the exit transition in globals.css (.lab-loader). */
const EXIT_MS = 700;

const easeOut = (x: number) => 1 - (1 - x) ** 3;

/**
 * Opaque, styled loading screen, present from the first paint (static HTML, CSS-only motion), that covers the poster while an experiment's chunk loads and warms up. The counter eases towards 90 on its own; once the experiment reports ready it counts smoothly to 100, never sooner than MIN_MS after start, then the panel slides away. Fullscreen mode locks scrolling while visible; the stable scrollbar gutter keeps the layout from jumping. Under reduced motion nothing moves, there is no minimum delay and the panel disappears at once.
 */
export function ExperimentLoader({ done, reducedMotion, fullscreen, skin }: Props) {
  const { className: skinClass, Body } = loaderSkin(skin);
  const [start] = useState(() => performance.now());
  const [progress, setProgress] = useState(0);
  const [finished, setFinished] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    let raf = 0;
    // When ready: count from the current value to 100, ending no sooner than MIN_MS after start.
    let from = 0;
    let readyAt = 0;
    let endAt = 0;
    const tick = () => {
      const now = performance.now();
      const idle = 90 * (1 - Math.exp(-(now - start) / 1200));
      if (!done) {
        setProgress(idle);
      } else {
        if (!readyAt) {
          readyAt = now;
          from = idle;
          endAt = reducedMotion ? now : Math.max(now + FINISH_MS, start + MIN_MS);
        }
        const x = endAt > readyAt ? Math.min(1, (now - readyAt) / (endAt - readyAt)) : 1;
        setProgress(from + (100 - from) * easeOut(x));
        if (x >= 1) return setFinished(true);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [done, reducedMotion, start]);

  useEffect(() => {
    if (!finished) return;
    // Experiments can hold their entrance until the panel starts to leave.
    window.dispatchEvent(new Event("lab:reveal"));
    const remove = window.setTimeout(() => setGone(true), reducedMotion ? 0 : EXIT_MS);
    return () => window.clearTimeout(remove);
  }, [finished, reducedMotion]);

  // Lock scrolling under a fullscreen loader; released as soon as the panel starts to leave.
  useEffect(() => {
    if (!fullscreen || finished) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    window.scrollTo(0, 0);
    getLenis()?.stop();
    return () => {
      root.style.overflow = previous;
      getLenis()?.start();
    };
  }, [fullscreen, finished]);

  if (gone) return null;
  const pct = Math.round(progress);
  return (
    <>
      <noscript>
        <style>{"[data-loader]{display:none}"}</style>
      </noscript>
      <div
        role="status"
        aria-live="polite"
        aria-label={finished ? "Demo ready" : "Loading demo"}
        data-loader
        data-finished={finished || undefined}
        data-inline={!fullscreen || undefined}
        data-skin={skin}
        className={`lab-loader ${fullscreen ? "fixed" : "absolute"} inset-0 z-30 flex items-center justify-center ${skinClass}`}
      >
        <div aria-hidden>
          <Body pct={pct} finished={finished} reducedMotion={reducedMotion} />
        </div>
      </div>
    </>
  );
}
