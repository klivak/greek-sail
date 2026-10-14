import { Component, lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { startSmoothScroll } from "@/lib/smoothScroll";
import { ExperimentLoader } from "@/loader/ExperimentLoader";

const GreekSail = lazy(() => import("@/experiment"));
const POSTER = `${import.meta.env.BASE_URL}lab/greek-sail/poster.webp`;

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return !!gl;
  } catch {
    return false;
  }
}

function pickQuality(): "high" | "low" {
  const forced = new URLSearchParams(window.location.search).get("quality");
  if (forced === "low" || forced === "high") return forced;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return (memory !== undefined && memory <= 4) || navigator.hardwareConcurrency <= 4 ? "low" : "high";
}

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    if (this.state.failed)
      return (
        <p role="status" className="fixed inset-x-0 bottom-0 bg-bg/80 p-3 text-center text-sm text-fg-muted">
          The page could not load. The poster is shown instead.
        </p>
      );
    return this.props.children;
  }
}

/** Poster underneath, the Greek Sail page on top, and the loader until the first frame is ready (capped at 10 s). */
export function App() {
  const reducedMotion = useReducedMotion();
  const [webgl] = useState(hasWebGL);
  const [quality] = useState(pickQuality);
  const [ready, setReady] = useState(false);
  const markReady = useCallback(() => setReady(true), []);

  useEffect(() => (reducedMotion ? undefined : startSmoothScroll()), [reducedMotion]);
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 10000);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <main className="relative min-h-[70dvh]">
      <img src={POSTER} alt="" aria-hidden fetchPriority="high" decoding="async" className="absolute inset-x-0 top-0 h-[70dvh] w-full object-cover" />
      {webgl ? (
        <div className="relative z-10 min-h-[70dvh] bg-bg">
          <Boundary>
            <Suspense fallback={null}>
              <GreekSail reducedMotion={reducedMotion} quality={quality} onReady={markReady} />
            </Suspense>
          </Boundary>
        </div>
      ) : (
        <p role="status" className="fixed inset-x-0 bottom-0 z-20 bg-bg/80 p-3 text-center text-sm text-fg-muted">
          This page needs WebGL, which is not available here.
        </p>
      )}
      {webgl ? <ExperimentLoader done={ready} reducedMotion={reducedMotion} fullscreen skin="greek-sail" /> : null}
    </main>
  );
}
