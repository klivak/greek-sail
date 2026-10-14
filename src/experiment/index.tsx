

import { Fragment, useEffect, useRef, useState, type FormEvent, type PointerEvent } from "react";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { scrollToTarget } from "@/lib/smoothScroll";
import type { ExperimentProps } from "@/types";
import {
  BASE,
  boatAt,
  CONTACT,
  DAYS,
  FEATURES,
  INCLUDED,
  LAST,
  SOURCE_URL,
  STEPS,
  STOPS,
  TEAM,
  UI,
  type Lang,
} from "./data";
import { createWorld, type World } from "./world";
import css from "./greek.module.css";

/** Unique string used by the budgets check to prove this chunk is not shared with other pages. */
export const MARKER = "GREEK_SAIL_MARKER_7b2e";

const POSTER = `${BASE}/poster.webp`;
const STORE = "greek-sail-lang";
const img = (name: string) => `${BASE}/${name}`;

function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(STORE);
    if (saved === "uk" || saved === "en") return saved;
  } catch {
    /* storage can be blocked */
  }
  return navigator.language.toLowerCase().startsWith("uk") ? "uk" : "en";
}

/** A heading split into masked words for the reveal; the text stays one readable heading. */
function Words({ text }: { text: string }) {
  return text.split(" ").map((w, i) => (
    <Fragment key={i}>
      {i ? " " : null}
      <span className={css.mask}>
        <span data-word className="inline-block">
          {w}
        </span>
      </span>
    </Fragment>
  ));
}

/** Mutable scene state: GSAP and pointer handlers write it, the render loop reads it. */
type S = {
  s: number;
  yaw: number;
  pitch: number;
  parX: number;
  parY: number;
  /** Where the pointer parallax is heading; parX/parY ease toward it so it never jumps. */
  parTX: number;
  parTY: number;
  visible: boolean;
  reduced: boolean;
  dirty: boolean;
};

/** A photo card that tilts toward a mouse pointer. */
function TiltCard({
  className = "",
  children,
  reduced,
}: {
  className?: string;
  children: React.ReactNode;
  reduced: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || reduced || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.dataset.live = "true";
    el.style.setProperty("--rx", `${((0.5 - py) * 9).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${((px - 0.5) * 12).toFixed(2)}deg`);
    el.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
    el.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
  };
  const leave = () => {
    const el = ref.current;
    if (!el) return;
    el.dataset.live = "false";
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  };
  return (
    <div
      ref={ref}
      onPointerMove={move}
      onPointerLeave={leave}
      className={`${css.tilt} ${className}`}
    >
      {children}
      <div
        aria-hidden="true"
        className={`${css.sheen} pointer-events-none absolute inset-0 rounded-[inherit]`}
      />
    </div>
  );
}

/** Phones only: the current day with overall progress; tapping opens the list of all days. Re-renders only when the chapter changes; the bar is written by the render loop. */
function DayPill({
  lang: L,
  chapter,
  barRef,
}: {
  lang: Lang;
  chapter: number;
  barRef: React.RefObject<HTMLSpanElement | null>;
}) {
  const [open, setOpen] = useState(false);
  const pill = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const day = chapter > 0 ? DAYS[chapter - 1]! : null;

  const close = (focusPill: boolean) => {
    setOpen(false);
    if (focusPill) pill.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const panel = sheet.current;
    // Focus the current day (or the first one) when the list opens.
    const items = () => Array.from(panel?.querySelectorAll<HTMLElement>("a,button") ?? []);
    (panel?.querySelector<HTMLElement>("[aria-current]") ?? items()[0])?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close(true);
        return;
      }
      if (e.key !== "Tab") return;
      // Keep focus inside the list while it is open.
      const list = items();
      const firstEl = list[0];
      const lastEl = list[list.length - 1];
      if (!firstEl || !lastEl) return;
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    const onDown = (e: Event) => {
      const t = e.target as Node;
      if (panel?.contains(t) || pill.current?.contains(t)) return;
      close(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const go = (e: React.MouseEvent<HTMLAnchorElement>, n: number) => {
    e.preventDefault();
    close(true);
    const target = document.getElementById(`gs-ch-${n}`);
    if (target) scrollToTarget(target);
  };

  return (
    <div className="pointer-events-auto relative mx-auto mt-2 w-fit md:hidden">
      <button
        ref={pill}
        type="button"
        aria-expanded={open}
        aria-controls="gs-days"
        aria-label={`${day ? `${UI.day[L]} ${day.n} / ${DAYS.length}, ${day.place[L]}` : UI.route[L]}. ${UI.routeOpen[L]}`}
        onClick={() => setOpen((o) => !o)}
        className={css.dayPill}
      >
        <span className="flex items-center gap-2">
          <span className="font-mono text-[10px] tracking-[0.2em] text-[#f2c46d] uppercase">
            {day ? `${UI.day[L]} ${day.n}/${DAYS.length}` : UI.route[L]}
          </span>
          <span aria-hidden="true" className="size-1 rounded-full bg-white/35" />
          <span className="max-w-[11rem] truncate text-[13px] font-medium text-white">
            {day ? day.place[L] : UI.routeDays[L]}
          </span>
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className={`${css.chev} size-3.5 text-white/70`}
            data-open={open}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <path d="M3.5 6l4.5 4.5L12.5 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span
          aria-hidden="true"
          className="absolute inset-x-3 bottom-1 h-px overflow-hidden rounded bg-white/15"
        >
          <span
            ref={barRef}
            className="block h-full origin-left bg-[#3fd6c8]"
            style={{ transform: "scaleX(0)" }}
          />
        </span>
      </button>
      <div
        ref={sheet}
        id="gs-days"
        role="dialog"
        aria-label={UI.routeList[L]}
        data-open={open}
        inert={!open}
        data-lenis-prevent
        className={css.sheet}
      >
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <p className="font-mono text-[10px] tracking-[0.24em] text-[#f2c46d] uppercase">
            {UI.routeList[L]}
          </p>
          <button
            type="button"
            onClick={() => close(true)}
            aria-label={UI.close[L]}
            className="-mr-2 grid size-11 place-items-center rounded-full text-white/70 hover:text-white focus-visible:outline-2 focus-visible:outline-[#f2c46d]"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            >
              <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <ol className="px-2 pb-2">
          {DAYS.map((d) => (
            <li key={d.n}>
              <a
                href={`#gs-ch-${d.n}`}
                aria-current={chapter === d.n ? "step" : undefined}
                onClick={(e) => go(e, d.n)}
                className={css.dayItem}
              >
                <span className="font-display text-xl leading-none font-semibold text-[#f2c46d] tabular-nums">
                  {String(d.n).padStart(2, "0")}
                </span>
                <span className="min-w-0">
                  <span className="block font-mono text-[10px] tracking-[0.2em] text-[#3fd6c8] uppercase">
                    {d.place[L]}
                  </span>
                  <span className="block truncate text-sm text-white/90">{d.title[L]}</span>
                </span>
              </a>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export default function GreekSail({ reducedMotion, quality, onReady }: ExperimentProps) {
  const container = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const canvasHost = useRef<HTMLDivElement>(null);
  const pinsRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLSpanElement>(null);
  const hudBarRef = useRef<HTMLSpanElement>(null);
  const pillBarRef = useRef<HTMLSpanElement>(null);
  const world = useRef<World | null>(null);
  const S = useRef<S>({
    s: 0,
    yaw: 0,
    pitch: 0,
    parX: 0,
    parY: 0,
    parTX: 0,
    parTY: 0,
    visible: true,
    reduced: false,
    dirty: true,
  });

  const [lang, setLang] = useState<Lang>(detectLang);
  const [chapter, setChapter] = useState(0);
  const [ready, setReady] = useState(false);
  const [lost, setLost] = useState(false);
  const [sent, setSent] = useState(false);
  const [debug] = useState(() => new URLSearchParams(window.location.search).has("debug"));
  // The dev-only poster capture route frames one story position instead of the first screen.
  const [posterShot] = useState(() => window.location.pathname.startsWith("/capture/"));
  const fpsRef = useRef<HTMLDivElement>(null);
  const dimRef = useRef<HTMLDivElement>(null);
  const redraw = () => (S.current.dirty = true);
  const L = lang;

  const chooseLang = (next: Lang) => {
    setLang(next);
    try {
      localStorage.setItem(STORE, next);
    } catch {
      /* ignore */
    }
  };

  // ------------------------------------------------------------ world + loop

  useEffect(() => {
    const slot = canvasHost.current;
    const host = stage.current;
    if (!slot || !host) return;
    // Each world gets its own canvas: a rebuilt world (new quality tier, or the dev double mount) never reuses the old context and its deleted shader programs.
    const canvas = document.createElement("canvas");
    canvas.className = "block size-full";
    slot.append(canvas);
    const w = createWorld(canvas, quality);
    world.current = w;
    // Host size cached from the ResizeObserver, never read from layout inside the frame.
    let hostW = host.clientWidth;
    let hostH = host.clientHeight;
    const ro = new ResizeObserver(() => {
      hostW = host.clientWidth;
      hostH = host.clientHeight;
      w.resize(hostW, hostH);
      redraw();
    });
    ro.observe(host);
    w.resize(hostW, hostH);

    const onLost = (e: Event) => {
      e.preventDefault();
      setLost(true);
    };
    const onRestored = () => {
      setLost(false);
      redraw();
    };
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);

    const desktopQuery = window.matchMedia("(min-width: 1024px)");
    let desktop = desktopQuery.matches;
    const onDesktop = () => {
      desktop = desktopQuery.matches;
      redraw();
    };
    desktopQuery.addEventListener("change", onDesktop);

    // Last values written to each stop label, so unchanged styles are not touched again.
    const pinOn: boolean[] = [];
    const pinX: number[] = [];
    const pinY: number[] = [];
    const pinActive: boolean[] = [];
    const pinOpacity: string[] = [];
    let progressShown = -1;

    let raf = 0;
    let last = performance.now();
    let time = 0;
    let first = true;
    let frames = 0;
    let fpsAt = last;
    let drawnAt = 0;
    let dimShown = -1;
    let animated = quality === "high";
    // Render detail: the dimmed intro and the fps watchdog lower it. Changes wait for a quiet moment, so the canvas reallocation never hitches mid-scroll.
    let detailCap = 1;
    let detailNow = -1;
    let busyAt = 0;
    // Fps watchdog (high tier only): sustained < 45 fps for ~3 s steps down once to 0.75 detail, then to a still scene like the low tier. It never steps back up.
    let slowFor = 0;
    let step = 0;
    let winFrames = 0;
    let winTime = 0;
    const loop = (now: number) => {
      const st = S.current;
      if (!st.visible || document.hidden) {
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(loop);
      const rawDt = (now - last) / 1000;
      const dt = Math.min(0.1, rawDt);
      last = now;
      const live = animated && !st.reduced;
      if (live && !first && rawDt < 0.5) {
        winFrames++;
        winTime += rawDt;
        if (winTime >= 0.5) {
          slowFor = winFrames / winTime < 45 ? slowFor + winTime : 0;
          winFrames = 0;
          winTime = 0;
          if (slowFor >= 3) {
            slowFor = 0;
            step++;
            if (step === 1) detailCap = 0.75;
            else animated = false;
            st.dirty = true;
          }
        }
      }
      if (live) time += dt;
      if (st.dirty) busyAt = now;
      const detail = Math.min(detailCap, st.s < 0.5 ? 0.75 : 1);
      // A still scene draws only on change, or once input settles to apply a pending detail change.
      if (!live && !st.dirty && !first && (detail === detailNow || now - busyAt < 300)) return;
      // The intro is a slow, far view and a rest stop holds still: without input those frames run at about 30 fps.
      const resting = st.s >= 1 && boatAt(st.s).leg < 0;
      if (live && !st.dirty && !first && (st.s < 0.9 || resting) && now - drawnAt < 32) return;
      drawnAt = now;
      st.dirty = false;
      if (detail !== detailNow && (first || now - busyAt > 250)) {
        detailNow = detail;
        w.setDetail(detail);
      }

      // The first screen starts dimmed and brightens as the story begins; scrolling back dims it again.
      const dim = Math.round((1 - Math.min(1, Math.max(0, st.s / 0.85))) * 100) / 100;
      if (dim !== dimShown && dimRef.current) {
        dimShown = dim;
        dimRef.current.style.opacity = String(dim * dim * (3 - 2 * dim));
      }

      if (!st.reduced) {
        const k = 1 - Math.exp(-Math.min(rawDt, 0.1) * 3.5);
        st.parX += (st.parTX - st.parX) * k;
        st.parY += (st.parTY - st.parY) * k;
      }
      w.frame({
        s: st.s,
        yaw: st.yaw + st.parX * 0.16,
        pitch: st.pitch + st.parY * 0.06,
        time,
        shiftX: desktop ? 0.17 * (st.s < 1 ? -1 : -Math.cos(Math.PI * (st.s - 1))) : 0,
        shiftY: desktop ? 0 : 0.12 * Math.min(1, st.s),
      });

      // Place the stop labels; the stop the boat rests at is highlighted.
      const pins = pinsRef.current;
      if (pins) {
        const b = boatAt(st.s);
        const rest = b.leg >= 0 ? -1 : b.rest;
        for (let i = 0; i < STOPS.length; i++) {
          const el = pins.children[i] as HTMLElement | undefined;
          const stop = STOPS[i]!;
          if (!el) continue;
          const p = w.project(stop.x, i === rest ? 0.85 : 0.1, stop.z);
          // While the hero text is up, labels keep clear of it: all of them below desktop width, the ones behind the text on desktop.
          const underText = st.s < 0.6 && !!p && (!desktop || p.x < hostW * 0.55);
          const on =
            !!p && !underText && p.x > 20 && p.x < hostW - 20 && p.y > 90 && p.y < hostH - 20;
          if (on !== pinOn[i]) {
            pinOn[i] = on;
            el.style.visibility = on ? "visible" : "hidden";
          }
          if (on && p) {
            const x = Math.round(p.x * 2) / 2;
            const y = Math.round(p.y * 2) / 2;
            if (x !== pinX[i] || y !== pinY[i]) {
              pinX[i] = x;
              pinY[i] = y;
              el.style.transform = `translate(${x}px, ${y}px)`;
            }
          }
          const active = i === rest;
          if (active !== pinActive[i]) {
            pinActive[i] = active;
            el.dataset.active = String(active);
          }
          const op = active || st.s < 1.2 || st.s > 7.3 ? "1" : "0.7";
          if (op !== pinOpacity[i]) {
            pinOpacity[i] = op;
            el.style.opacity = op;
          }
        }
      }
      const progress = Math.round((st.s / LAST) * 1000) / 1000;
      if (progress !== progressShown) {
        progressShown = progress;
        if (railRef.current) railRef.current.style.transform = `scaleY(${progress})`;
        if (hudBarRef.current) hudBarRef.current.style.transform = `scaleX(${progress})`;
        if (pillBarRef.current) pillBarRef.current.style.transform = `scaleX(${progress})`;
      }

      // Ease the pointer parallax; keep drawing until it settles.
      if (!st.reduced) {
        const dx = Math.abs(st.parTX - st.parX) + Math.abs(st.parTY - st.parY);
        if (dx > 0.002) st.dirty = true;
      }

      if (first) {
        first = false;
        requestAnimationFrame(() => {
          setReady(true);
          onReady();
        });
      }
      if (fpsRef.current) {
        frames++;
        if (now - fpsAt > 500) {
          fpsRef.current.textContent = `${Math.round((frames * 1000) / (now - fpsAt))} fps${step ? ` · step ${step}` : ""}`;
          frames = 0;
          fpsAt = now;
        }
      }
    };
    // The loop stops itself while the stage is off-screen or the tab is hidden; this restarts it.
    const wake = () => {
      redraw();
      if (raf || !S.current.visible || document.hidden) return;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    };
    w.compile();
    raf = requestAnimationFrame(loop);

    const io = new IntersectionObserver(([e]) => {
      S.current.visible = e?.isIntersecting ?? true;
      wake();
    });
    io.observe(host);
    document.addEventListener("visibilitychange", wake);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      desktopQuery.removeEventListener("change", onDesktop);
      document.removeEventListener("visibilitychange", wake);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      w.dispose();
      canvas.remove();
      world.current = null;
    };
    // onReady is stable for the page's lifetime; the world is rebuilt only when the tier changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quality]);

  useEffect(() => {
    S.current.reduced = reducedMotion;
    redraw();
  }, [reducedMotion]);

  // ------------------------------------------------------------ scroll story

  useGSAP(
    () => {
      const root = container.current;
      if (!root) return;
      const steps = gsap.utils.toArray<HTMLElement>("[data-step]", root);
      const story = root.querySelector<HTMLElement>("[data-story]");
      if (posterShot) {
        S.current.s = Number(new URLSearchParams(window.location.search).get("s") ?? 2);
        redraw();
        return;
      }
      const rail = steps.map((el, i) =>
        ScrollTrigger.create({
          trigger: el,
          start: "top 50%",
          end: "bottom 50%",
          onToggle: (self) => self.isActive && setChapter(i),
        }),
      );
      // Everything after the story fades and rises in as it scrolls into view.
      const rise = reducedMotion
        ? []
        : gsap.utils.toArray<HTMLElement>("[data-rise]", root).map((el) =>
            gsap.from(el, {
              opacity: 0,
              y: 46,
              duration: 0.9,
              ease: "power3.out",
              scrollTrigger: {
                trigger: el,
                start: "top 88%",
                toggleActions: "play none none reverse",
              },
            }),
          );
      const parallax = reducedMotion
        ? []
        : gsap.utils.toArray<HTMLElement>("[data-parallax]", root).map((el) =>
            gsap.fromTo(
              el,
              { yPercent: -8 },
              {
                yPercent: 8,
                ease: "none",
                scrollTrigger: {
                  trigger: el.parentElement,
                  start: "top bottom",
                  end: "bottom top",
                  scrub: true,
                },
              },
            ),
          );
      if (reducedMotion) {
        const triggers = steps.map((el, i) =>
          ScrollTrigger.create({
            trigger: el,
            start: "top 60%",
            end: "bottom 60%",
            onToggle: (self) => {
              if (!self.isActive) return;
              S.current.s = i;
              S.current.yaw = 0;
              gsap.fromTo(
                stage.current,
                { opacity: 0.25 },
                { opacity: 1, duration: 0.15, ease: "none" },
              );
              redraw();
            },
          }),
        );
        return () => [...triggers, ...rail].forEach((t) => t.kill());
      }
      S.current.s = 0;
      let motionBlur: (() => void) | null = null;
      if (story) {
        // One segment per chapter, weighted by its height, so a taller chapter (the long first crossing) sails slower.
        const sail = gsap.timeline({
          defaults: { ease: "none" },
          onUpdate: redraw,
          // Desktop gets a longer catch-up so the boat glides after the wheel instead of snapping to it.
          scrollTrigger: {
            trigger: story,
            start: "top top",
            end: "bottom bottom",
            scrub: window.matchMedia("(pointer: fine)").matches ? 4 : 2.2,
          },
        });
        for (let i = 1; i <= LAST; i++)
          sail.to(S.current, { s: i, duration: steps[i - 1]?.offsetHeight || 1 });
        // While the map is far behind the scroll (a fast scroll or a jump back to the start), it stays softly blurred until it catches up, so the catch-up reads as motion instead of a jump.
        const map = mapRef.current;
        let blur = 0;
        motionBlur = () => {
          const lag = Math.abs((sail.scrollTrigger?.progress ?? 0) - sail.progress()) * LAST;
          const goal = gsap.utils.clamp(0, 7, (lag - 0.35) * 5);
          blur += (goal - blur) * (goal > blur ? 0.25 : 0.08);
          if (map) map.style.filter = blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : "";
        };
        gsap.ticker.add(motionBlur);
      }
      // Each card comes in as one beat; scrolling past plays it back out.
      steps.forEach((el, i) => {
        const card = el.querySelector<HTMLElement>("[data-card]");
        if (!card) return;
        const tl = gsap.timeline({
          defaults: { ease: "expo.out" },
          scrollTrigger: {
            trigger: el,
            start: "top 68%",
            end: "bottom 32%",
            toggleActions: i === LAST ? "play none none reverse" : "play reverse play reverse",
          },
        });
        tl.from(card, { opacity: 0, y: 80, scale: 0.95, duration: 1 });
        const words = card.querySelectorAll("[data-word]");
        if (words.length)
          tl.from(words, { yPercent: 115, rotate: 4, duration: 0.9, stagger: 0.05 }, 0.15);
        const parts = card.querySelectorAll("[data-reveal]");
        if (parts.length)
          tl.from(
            parts,
            { opacity: 0, y: 28, duration: 0.8, stagger: 0.08, ease: "power3.out" },
            0.35,
          );
        const items = card.querySelectorAll("[data-item]");
        if (items.length)
          tl.from(
            items,
            { opacity: 0, x: -18, duration: 0.6, stagger: 0.07, ease: "power3.out" },
            0.5,
          );
        const photo = card.querySelector("[data-photo]");
        if (photo) tl.from(photo, { scale: 1.25, duration: 1.4, ease: "power3.out" }, 0.1);
      });
      return () => {
        rise.forEach((t) => t.scrollTrigger?.kill());
        parallax.forEach((t) => t.scrollTrigger?.kill());
        rail.forEach((t) => t.kill());
        if (motionBlur) gsap.ticker.remove(motionBlur);
        if (mapRef.current) mapRef.current.style.filter = "";
      };
    },
    { scope: container, dependencies: [reducedMotion, lang], revertOnUpdate: true },
  );

  // ------------------------------------------------------------ pointer

  const drag = useRef({ active: false, x: 0, y: 0 });
  const onDown = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    drag.current = { active: true, x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    const r = stage.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * 2 - 1;
    const py = ((e.clientY - r.top) / r.height) * 2 - 1;
    if (e.pointerType === "mouse" && !reducedMotion) {
      S.current.parTX = px;
      S.current.parTY = py;
      S.current.dirty = true;
    }
    const d = drag.current;
    if (d.active) {
      const dx = e.clientX - d.x;
      d.x = e.clientX;
      d.y = e.clientY;
      S.current.yaw = Math.max(-1.4, Math.min(1.4, S.current.yaw - dx * 0.006));
    }
    redraw();
  };
  const onUp = () => {
    drag.current.active = false;
  };

  // Settle the drag turn back when the chapter changes, and ease the parallax away on leave.
  useEffect(() => {
    if (reducedMotion) {
      S.current.yaw = 0;
      redraw();
      return;
    }
    gsap.to(S.current, { yaw: 0, duration: 1.4, ease: "power3.out", onUpdate: redraw });
  }, [chapter, reducedMotion]);

  // ------------------------------------------------------------ form

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const subject =
      L === "uk"
        ? "Запит на тур: Грузинська кухня та острови Греції"
        : "Tour request: Georgian cuisine and the islands of Greece";
    const body = [
      `${UI.name[L]}: ${String(f.get("name") ?? "")}`,
      `${UI.contact[L]}: ${String(f.get("contact") ?? "")}`,
      `${UI.guests[L]}: ${String(f.get("guests") ?? "")}`,
      "",
      String(f.get("message") ?? ""),
    ].join("\n");
    setSent(true);
    window.location.href = `mailto:${CONTACT.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const day = chapter > 0 ? DAYS[chapter - 1]! : null;

  return (
    <div
      ref={container}
      lang={lang}
      data-experiment="greek-sail"
      data-marker={MARKER}
      data-motion={reducedMotion ? "reduced" : "full"}
      data-ready={ready ? "true" : "false"}
      data-lost={lost ? "true" : "false"}
      data-lang={lang}
      data-chapter-now={chapter}
      className={`${css.root} relative bg-[#06182b] text-[#f6f9fb]`}
    >
      {/* On phones the day pill takes the top; the shared example bar would crowd it. */}
      <style>{"@media (max-width:767px){#example-bar{display:none}}"}</style>
      {/* Top bar: brand, language, booking. Sticks to the top while the story runs. */}
      <div data-poster-hide className="pointer-events-none sticky top-0 z-40 h-0">
        <div className="mx-auto flex max-w-[88rem] items-start justify-between gap-3 pt-[calc(0.75rem+env(safe-area-inset-top))] pr-[max(0.75rem,env(safe-area-inset-right))] pl-[max(0.75rem,env(safe-area-inset-left))] md:pt-[calc(1rem+env(safe-area-inset-top))] md:pr-[max(1.5rem,env(safe-area-inset-right))] md:pl-[max(1.5rem,env(safe-area-inset-left))]">
          <div className={`${css.bar} pointer-events-auto flex items-center gap-3 py-2 pr-4 pl-4`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- static export, plain img */}
            <img
              src={img("logo.svg")}
              alt="Sea4U"
              width={157}
              height={60}
              className="h-6 w-auto min-[1700px]:h-8 min-[2200px]:h-10"
            />
            <span className="hidden text-xs tracking-wide text-white/70 sm:inline">
              {UI.brand[L].replace("Sea4U · ", "")}
            </span>
          </div>
          <div className="pointer-events-auto flex items-center gap-2">
            <div role="group" aria-label={UI.language[L]} className={`${css.bar} flex p-1`}>
              {(["uk", "en"] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  lang={code}
                  aria-pressed={lang === code}
                  onClick={() => chooseLang(code)}
                  className={`min-h-9 min-w-11 rounded-full px-3 text-xs font-semibold tracking-wider transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f2c46d] min-[1700px]:min-h-11 min-[1700px]:min-w-14 min-[1700px]:text-sm pointer-coarse:min-h-11 ${
                    lang === code ? "bg-[#f2c46d] text-[#2a1704]" : "text-white/75 hover:text-white"
                  }`}
                >
                  {code === "uk" ? "UA" : "EN"}
                </button>
              ))}
            </div>
            <div className="hidden sm:block">
              <a href="#gs-book" className={`${css.btn} ${css.primary}`}>
                {UI.book[L]}
              </a>
            </div>
          </div>
        </div>
        <DayPill lang={lang} chapter={chapter} barRef={pillBarRef} />
      </div>

      {/* The story: one sticky 3D map and a card per chapter. */}
      <div data-story className="relative">
        <div
          ref={stage}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          className="sticky top-0 h-lvh touch-pan-y overflow-hidden"
        >
          <div ref={mapRef} aria-hidden="true" className="absolute inset-0">
            <div ref={canvasHost} className="size-full" />
            <div ref={pinsRef} data-poster-hide className="pointer-events-none absolute inset-0">
              {STOPS.map((stop) => (
                <div key={stop.id} className="invisible absolute top-0 left-0">
                  <div className={css.pin} data-active="false">
                    <span className="font-medium text-white">{stop.name[L]}</span>
                    <span className="ml-1.5 font-mono text-[10px] text-white/60">
                      {stop.days.join("·")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {lost ? (
              // eslint-disable-next-line @next/next/no-img-element -- static export, plain img
              <img src={POSTER} alt="" className="absolute inset-0 size-full object-cover" />
            ) : null}
            {debug ? (
              <div
                ref={fpsRef}
                className="absolute top-16 left-3 rounded bg-black/70 px-2 py-1 font-mono text-xs text-white"
              />
            ) : null}
          </div>
          {/* Dimmed first screen: fades out as the story starts (opacity set from the render loop). */}
          <div
            ref={dimRef}
            aria-hidden="true"
            data-dim
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(3_10_22/0.62)_0%,rgb(3_10_22/0.38)_45%,rgb(3_10_22/0.18)_100%)]"
            style={{ opacity: 1 }}
          />
          {/* Top shade keeps the bar readable over a bright sky. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#06182b]/55 to-transparent"
          />
          {/* Day readout. */}
          <div
            data-poster-hide
            className="pointer-events-none absolute right-3 bottom-4 hidden origin-bottom-right rounded-2xl border border-white/12 bg-[#06182b]/55 px-4 py-3 backdrop-blur-md min-[1700px]:scale-125 min-[2200px]:scale-150 md:right-6 md:bottom-6 md:block"
          >
            <p className="font-mono text-[11px] tracking-[0.24em] text-[#f2c46d] uppercase">
              {day ? `${UI.day[L]} ${day.n} / ${DAYS.length}` : UI.intro[L]}
            </p>
            <p className="mt-0.5 text-sm font-medium">{day ? day.place[L] : "Saronic Gulf"}</p>
            <span
              aria-hidden="true"
              className="mt-2 block h-0.5 w-40 overflow-hidden rounded bg-white/15"
            >
              <span
                ref={hudBarRef}
                className="block h-full origin-left bg-[#f2c46d]"
                style={{ transform: "scaleX(0)" }}
              />
            </span>
          </div>
        </div>

        {/* Chapter rail. */}
        <div data-poster-hide className="pointer-events-none absolute inset-0 z-20 hidden xl:block">
          <nav
            aria-label={UI.chapters[L]}
            className="pointer-events-auto sticky top-0 flex h-lvh w-44 items-center pl-6"
          >
            <div className="relative">
              <span
                aria-hidden="true"
                className="absolute top-1 bottom-1 left-[3px] w-px bg-white/15"
              >
                <span
                  ref={railRef}
                  className="absolute inset-0 origin-top bg-[#f2c46d]"
                  style={{ transform: "scaleY(0)" }}
                />
              </span>
              <ol className="space-y-0.5">
                {STEPS.map((id, i) => (
                  <li key={id}>
                    <a
                      href={`#gs-ch-${i}`}
                      aria-current={chapter === i ? "step" : undefined}
                      className={css.railLink}
                    >
                      <span aria-hidden="true" className={css.railDot} />
                      {i === 0 ? UI.intro[L] : `${UI.day[L]} ${i}`}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </nav>
        </div>

        <div data-poster-hide className="pointer-events-none relative z-10 -mt-[100lvh]">
          {/* Intro */}
          <section
            id="gs-ch-0"
            data-step={0}
            data-chapter="intro"
            aria-labelledby="gs-title"
            className="relative min-h-[160lvh]"
          >
            <div className="sticky top-0 flex min-h-svh items-end pt-[calc(6rem+env(safe-area-inset-top))] pr-[max(var(--spacing-gutter),env(safe-area-inset-right))] pb-[calc(3.5rem+env(safe-area-inset-bottom))] pl-[max(var(--spacing-gutter),env(safe-area-inset-left))] md:items-center md:pb-0 xl:pl-48 [@media(max-height:500px)]:pt-[calc(4.5rem+env(safe-area-inset-top))]">
              <div className="mx-auto w-full max-w-content">
                <div data-card className="pointer-events-auto max-w-2xl">
                  <p
                    data-reveal
                    className="inline-flex items-center gap-2 rounded-full border border-[#f2c46d]/50 bg-[#06182b]/50 px-3 py-1.5 text-[11px] tracking-[0.2em] text-[#f2c46d] uppercase backdrop-blur"
                  >
                    <span aria-hidden="true" className="size-1.5 rounded-full bg-[#f2c46d]" />
                    {UI.badge[L]}
                  </p>
                  <h2
                    id="gs-title"
                    className="mt-4 w-[min(90vw,52rem)] font-display text-[clamp(2.2rem,min(5vw,9vh),4.4rem)] leading-[0.98] font-semibold text-balance text-white [filter:drop-shadow(0_4px_28px_rgb(0_20_40/0.55))]"
                  >
                    <Words text={UI.heroTitle[L]} />
                  </h2>
                  <p
                    data-reveal
                    className="mt-5 max-w-xl text-lg leading-relaxed text-white/85 [text-shadow:0_2px_20px_rgb(0_20_40/0.6)] [@media(max-height:500px)]:mt-3 [@media(max-height:500px)]:text-[0.95rem]!"
                  >
                    {UI.heroSub[L]}
                  </p>
                  <ul
                    data-reveal
                    className="mt-5 flex flex-wrap gap-2 [@media(max-height:640px)]:hidden"
                    aria-label="8 days, up to 8 guests, catamaran"
                  >
                    {UI.facts[L].map((f) => (
                      <li
                        key={f}
                        className="rounded-full border border-white/20 bg-[#06182b]/45 px-3.5 py-1.5 text-sm backdrop-blur"
                      >
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div data-reveal className="mt-7 flex flex-wrap items-center gap-4">
                    <a href="#gs-book" className={`${css.btn} ${css.primary}`}>
                      {UI.book[L]}
                    </a>
                    <span className="flex items-center gap-2 text-sm text-white/75">
                      <span
                        aria-hidden="true"
                        className="inline-block animate-bounce motion-reduce:animate-none"
                      >
                        ↓
                      </span>
                      {UI.scroll[L]}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {DAYS.map((d, i) => {
            const right = i % 2 === 1;
            return (
              <section
                key={d.n}
                id={`gs-ch-${d.n}`}
                data-step={d.n}
                data-chapter={`day-${d.n}`}
                aria-labelledby={`gs-day-${d.n}`}
                className={`relative ${d.n === 1 ? "min-h-[280lvh]" : "min-h-[160lvh]"}`}
              >
                <div className="sticky top-0 flex min-h-svh items-end pt-[calc(6rem+env(safe-area-inset-top))] pr-[max(var(--spacing-gutter),env(safe-area-inset-right))] pb-[calc(2.5rem+env(safe-area-inset-bottom))] pl-[max(var(--spacing-gutter),env(safe-area-inset-left))] md:items-center md:pb-0 xl:pl-48 [@media(max-height:500px)]:pt-[calc(4.5rem+env(safe-area-inset-top))] [@media(max-height:500px)]:pb-[calc(1rem+env(safe-area-inset-bottom))]">
                  <div
                    className={`mx-auto flex w-full max-w-content ${right ? "md:justify-end" : "md:justify-start"}`}
                  >
                    <TiltCard
                      reduced={reducedMotion}
                      className="pointer-events-auto w-full max-w-md min-[1700px]:max-w-[38rem] min-[2200px]:max-w-[44rem] md:max-w-[26rem] lg:max-w-[30rem] xl:max-w-[32rem] [@media(max-height:500px)]:max-w-[24rem]!"
                    >
                      <article
                        data-card
                        className={`${css.card} ${css.dayCard} max-h-[calc(100svh-8.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] overflow-x-hidden overflow-y-auto [@media(max-height:500px)]:max-h-[calc(100svh-5.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))]`}
                      >
                        <div className="relative aspect-[16/8] overflow-hidden bg-[#0d2a46] max-sm:aspect-[16/6] [@media(max-height:640px)]:hidden [@media(max-height:820px)]:aspect-[16/6]">
                          {/* eslint-disable-next-line @next/next/no-img-element -- static export, plain img */}
                          <img
                            data-photo
                            src={img(d.photo)}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="size-full object-cover"
                          />
                          <div
                            aria-hidden="true"
                            className="absolute inset-0 bg-gradient-to-t from-[#06182b]/80 via-transparent to-transparent"
                          />
                          <p className="absolute bottom-3 left-4 flex items-baseline gap-2 text-white">
                            <span className="font-display text-4xl leading-none font-semibold text-[#f2c46d] min-[1700px]:text-5xl min-[2200px]:text-6xl">
                              {String(d.n).padStart(2, "0")}
                            </span>
                            <span className="text-[11px] tracking-[0.24em] uppercase min-[1700px]:text-[13px] min-[2200px]:text-[15px]">
                              {d.place[L]}
                            </span>
                          </p>
                        </div>
                        <div className="p-5 min-[1700px]:px-8 min-[1700px]:py-7 min-[2200px]:px-10 min-[2200px]:py-9 md:px-6 md:py-5 [@media(max-height:500px)]:px-4! [@media(max-height:500px)]:py-3!">
                          <p className="font-mono text-[11px] tracking-[0.22em] text-[#3fd6c8] uppercase min-[1700px]:text-[13px] min-[2200px]:text-[15px]">
                            {UI.day[L]} {d.n} · {d.part[L]}
                          </p>
                          <h2
                            id={`gs-day-${d.n}`}
                            className="mt-1.5 font-display text-[1.45rem] leading-tight font-semibold text-balance min-[1700px]:text-[2.4rem] min-[2200px]:text-[2.9rem] md:text-[1.75rem] [@media(max-height:500px)]:mt-1 [@media(max-height:500px)]:text-[1.15rem]!"
                          >
                            <Words text={d.title[L]} />
                          </h2>
                          <p
                            data-reveal
                            className="mt-2.5 text-[0.9rem] leading-relaxed text-white/78 min-[1700px]:text-[1.1rem] min-[2200px]:text-[1.3rem] [@media(max-height:500px)]:mt-1.5 [@media(max-height:500px)]:text-[0.78rem]! [@media(max-height:600px)]:text-[0.82rem]"
                          >
                            {d.text[L]}
                          </p>
                          <ul className="mt-3 space-y-1 text-[0.85rem] text-white/88 min-[1700px]:text-[1rem] min-[2200px]:text-[1.2rem] [@media(max-height:560px)]:hidden">
                            {d.points[L].map((p) => (
                              <li key={p} data-item className="flex gap-2.5">
                                <span
                                  aria-hidden="true"
                                  className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-[#f2c46d]"
                                />
                                {p}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </article>
                    </TiltCard>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {/* After the voyage: why this route, what is on board, the crew, booking. */}
      <div data-poster-hide className="relative z-10 bg-[#06182b]">
        <section aria-labelledby="gs-why" className="px-gutter py-24 md:py-32">
          <div className="mx-auto max-w-content">
            <p
              data-rise
              className="font-mono text-[11px] tracking-[0.28em] text-[#f2c46d] uppercase"
            >
              {UI.whyKicker[L]}
            </p>
            <h2
              data-rise
              id="gs-why"
              className="mt-3 max-w-3xl font-display text-4xl leading-tight font-semibold text-balance md:text-6xl [@media(max-height:500px)]:text-3xl!"
            >
              {UI.whyTitle[L]}
            </h2>
            <div className="mt-12 grid gap-5 md:grid-cols-6">
              {FEATURES.map((f, i) => (
                <div key={f.id} data-rise className={i < 2 ? "md:col-span-3" : "md:col-span-2"}>
                  <TiltCard
                    reduced={reducedMotion}
                    className="relative h-full overflow-hidden rounded-3xl"
                  >
                    <div
                      className={`relative ${i < 2 ? "aspect-[16/10]" : "aspect-[4/5]"} overflow-hidden rounded-3xl bg-[#0d2a46]`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- static export, plain img */}
                      <img
                        data-parallax
                        src={img(f.photo)}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 size-full scale-[1.18] object-cover"
                      />
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 bg-gradient-to-t from-[#041120]/90 via-[#041120]/25 to-transparent"
                      />
                      <div className="lift absolute inset-x-0 bottom-0 p-6">
                        <p className="font-mono text-[11px] tracking-[0.22em] text-[#f2c46d]">
                          {String(i + 1).padStart(2, "0")}
                        </p>
                        <h3 className="mt-1 font-display text-2xl font-semibold">{f.title[L]}</h3>
                        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-white/80">
                          {f.text[L]}
                        </p>
                      </div>
                    </div>
                  </TiltCard>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="gs-included" className="relative overflow-hidden px-gutter py-24">
          {/* eslint-disable-next-line @next/next/no-img-element -- static export, plain img */}
          <img
            src={img("cuisine.webp")}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full object-cover opacity-30"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-b from-[#06182b] via-[#06182b]/70 to-[#06182b]"
          />
          <div className="relative mx-auto grid max-w-content gap-10 md:grid-cols-2 md:items-center">
            <h2
              data-rise
              id="gs-included"
              className="font-display text-4xl leading-tight font-semibold text-balance md:text-5xl [@media(max-height:500px)]:text-3xl!"
            >
              {UI.includedTitle[L]}
            </h2>
            <ul className="space-y-3">
              {INCLUDED[L].map((t) => (
                <li
                  key={t}
                  data-rise
                  className={`${css.card} flex items-start gap-3 px-4 py-3.5 text-[0.95rem]`}
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    className="mt-0.5 size-5 shrink-0 text-[#3fd6c8]"
                  >
                    <path
                      d="M4 10.5l4 4 8-9"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="gs-team" className="px-gutter py-24">
          <div className="mx-auto max-w-content">
            <p
              data-rise
              className="font-mono text-[11px] tracking-[0.28em] text-[#f2c46d] uppercase"
            >
              {UI.teamKicker[L]}
            </p>
            <h2
              data-rise
              id="gs-team"
              className="mt-3 max-w-3xl font-display text-3xl leading-tight font-semibold text-balance md:text-5xl [@media(max-height:500px)]:text-[1.6rem]!"
            >
              {UI.teamTitle[L]}
            </h2>
            <ul className="mt-10 grid gap-5 sm:grid-cols-2">
              {TEAM.map((p) => (
                <li key={p.id} data-rise>
                  <TiltCard
                    reduced={reducedMotion}
                    className={`${css.card} flex items-center gap-5 p-4`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- static export, plain img */}
                    <img
                      src={img(p.photo)}
                      alt={p.name[L]}
                      loading="lazy"
                      decoding="async"
                      className="size-28 shrink-0 rounded-2xl object-cover md:size-36"
                    />
                    <div>
                      <h3 className="font-display text-2xl font-semibold">{p.name[L]}</h3>
                      <p className="mt-1 text-sm text-white/75">{p.role[L]}</p>
                    </div>
                  </TiltCard>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          id="gs-book"
          aria-labelledby="gs-cta"
          className="relative overflow-hidden px-gutter py-24 md:py-32"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- static export, plain img */}
          <img
            src={img("cta-bg.webp")}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full object-cover"
          />
          <div aria-hidden="true" className="absolute inset-0 bg-[#06182b]/78" />
          <div className="relative mx-auto grid max-w-content gap-12 lg:grid-cols-2">
            <div>
              <p
                data-rise
                className="font-mono text-[11px] tracking-[0.28em] text-[#f2c46d] uppercase"
              >
                {UI.ctaKicker[L]}
              </p>
              <h2
                data-rise
                id="gs-cta"
                className="mt-3 font-display text-4xl leading-tight font-semibold text-balance md:text-6xl [@media(max-height:500px)]:text-3xl!"
              >
                {UI.ctaTitle[L]}
              </h2>
              <p data-rise className="mt-5 max-w-lg leading-relaxed text-white/85">
                {UI.ctaText[L]}
              </p>
              <p data-rise className="mt-3 text-sm text-[#f2c46d]">
                {UI.priceNote[L]}
              </p>
              <ul data-rise className="mt-7 space-y-2 text-white/90">
                <li>
                  <a
                    className="underline decoration-white/30 underline-offset-4 hover:decoration-[#f2c46d]"
                    href={`tel:${CONTACT.tel}`}
                  >
                    {CONTACT.phone}
                  </a>
                </li>
                <li>
                  <a
                    className="underline decoration-white/30 underline-offset-4 hover:decoration-[#f2c46d]"
                    href={`mailto:${CONTACT.email}`}
                  >
                    {CONTACT.email}
                  </a>
                </li>
                <li className="text-white/70">{CONTACT.city[L]}</li>
              </ul>
            </div>
            <form data-rise onSubmit={submit} className={`${css.card} space-y-4 p-6 md:p-8`}>
              <label className="block text-sm">
                <span className="mb-1.5 block text-white/80">{UI.name[L]}</span>
                <input name="name" required autoComplete="name" className={css.field} />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block text-white/80">{UI.contact[L]}</span>
                <input
                  name="contact"
                  required
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className={css.field}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block text-white/80">{UI.guests[L]}</span>
                <select name="guests" defaultValue="2" className={css.field}>
                  {Array.from({ length: 8 }, (_, i) => (
                    <option key={i} value={i + 1}>
                      {i + 1}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block text-white/80">{UI.message[L]}</span>
                <textarea name="message" rows={3} className={css.field} />
              </label>
              <button type="submit" className={`${css.btn} ${css.primary} w-full`}>
                {UI.send[L]}
              </button>
              <p role="status" className="min-h-5 text-sm text-[#3fd6c8]">
                {sent ? UI.sent[L] : ""}
              </p>
            </form>
          </div>
        </section>

        <p className="px-gutter py-8 text-center text-xs text-white/55">
          {UI.credit[L]}{" "}
          <a
            className="underline underline-offset-2 hover:text-white"
            href={SOURCE_URL}
            rel="noreferrer"
          >
            sea4u.org
          </a>
          .
        </p>
      </div>
    </div>
  );
}
