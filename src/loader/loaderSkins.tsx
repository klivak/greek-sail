import type { ReactNode } from "react";
import css from "./loaderSkins.module.css";

/** What the loader look receives from the shared ExperimentLoader. */
export type SkinProps = { pct: number; finished: boolean; reducedMotion: boolean };

const pad = (pct: number) => String(pct).padStart(3, "0");

export type LoaderSkin = {
  /** Background and colours of the whole panel. */
  className: string;
  Body: (p: SkinProps) => ReactNode;
};


function GreekSailBody({ pct, finished, reducedMotion }: SkinProps) {
  const p = reducedMotion && !finished ? 0.5 : pct / 100;
  const a = (cls: string | undefined) => (reducedMotion ? undefined : cls);
  // The boat sails along the dotted route; the route behind it turns gold.
  const bx = 14 + p * 128;
  const by = 66 - Math.sin(p * Math.PI) * 4;
  const wave = (y: number, cls: string | undefined, color: string, op: number, amp: number) => (
    <path
      className={a(cls)}
      d={`M-40 ${y} q5 ${-amp} 10 0${" t10 0".repeat(22)} V96 H-40 Z`}
      fill={color}
      opacity={op}
    />
  );
  // A white house with a blue window and, on chapels, a blue dome; y is its base.
  const house = (x: number, y: number, w: number, h: number, dome = false) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y - h} width={w} height={h} fill="#fbf8f1" />
      <rect
        x={x + w * 0.35}
        y={y - h * 0.55}
        width={w * 0.3}
        height={h * 0.3}
        fill="#2b5f9e"
        opacity="0.8"
      />
      {dome ? <path d={`M${x} ${y - h} a${w / 2} ${w / 2} 0 0 1 ${w} 0 Z`} fill="#2a64b8" /> : null}
    </g>
  );
  const gull = (x: number, y: number, s: number, delay: string) => (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path
        className={a(css.gsFlap)}
        style={{ animationDelay: delay }}
        d="M-4 0 q2 -2.4 4 0 q2 -2.4 4 0"
        fill="none"
        stroke="#f6f9fb"
        strokeWidth="0.7"
        strokeLinecap="round"
      />
    </g>
  );
  const route = "M14 66 Q80 58 142 66";
  return (
    <div className="flex flex-col items-center gap-5">
      <svg viewBox="0 0 160 96" className="w-[min(26rem,86vw)]" aria-hidden="true">
        <defs>
          <linearGradient id="gs-ld-sea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1a8ec0" />
            <stop offset="1" stopColor="#0a4a80" />
          </linearGradient>
          <radialGradient id="gs-ld-sun">
            <stop offset="0" stopColor="#fff3c4" />
            <stop offset="0.45" stopColor="#ffd98a" stopOpacity="0.55" />
            <stop offset="1" stopColor="#ffd98a" stopOpacity="0" />
          </radialGradient>
          <mask id="gs-ld-done">
            <rect x="0" y="0" width={bx} height="96" fill="#fff" />
          </mask>
        </defs>

        {/* Sun with slowly turning rays. */}
        <circle cx="128" cy="20" r="18" fill="url(#gs-ld-sun)" />
        <g transform="translate(128 20)">
          <g className={a(css.gsRays)}>
            {Array.from({ length: 12 }, (_, i) => (
              <line
                key={i}
                x1="0"
                y1="-10"
                x2="0"
                y2="-14"
                stroke="#ffe7a8"
                strokeWidth="0.8"
                strokeLinecap="round"
                transform={`rotate(${i * 30})`}
                opacity="0.7"
              />
            ))}
          </g>
        </g>
        <circle cx="128" cy="20" r="7" fill="#ffe39b" />

        {/* Clouds drift. */}
        <g className={a(css.gsCloud)} opacity="0.75">
          <ellipse cx="34" cy="16" rx="12" ry="3.2" fill="#f4fbff" />
          <ellipse cx="40" cy="13.5" rx="7" ry="3" fill="#f4fbff" />
        </g>
        <g className={a(css.gsCloud2)} opacity="0.55">
          <ellipse cx="88" cy="10" rx="9" ry="2.4" fill="#f4fbff" />
        </g>

        {/* Far mountains of the Peloponnese. */}
        <path
          d="M0 52 L12 40 L22 45 L34 33 L46 42 L58 37 L70 48 L76 52 Z"
          fill="#7fa8c4"
          opacity="0.6"
        />

        {/* An island town: terraces of white houses, chapels with blue domes, a windmill. */}
        <path
          d="M2 54 L10 46 Q16 40 24 41 L32 36 Q38 34 44 39 L54 44 Q60 47 64 54 Z"
          fill="#c9b48c"
        />
        <path
          d="M8 44 Q16 39 22 41 L30 37 Q36 35 40 37 L34 40 L20 43 Z"
          fill="#6f8a4c"
          opacity="0.6"
        />
        <path d="M6 54 L14 49 L30 50 L48 47 L62 54 Z" fill="#b59d74" />
        {house(14, 49, 3, 2.6)}
        {house(18, 48.4, 2.6, 2.2, true)}
        {house(22, 49.4, 3.2, 2.4)}
        {house(26, 46.4, 2.8, 2.2)}
        {house(30, 47.6, 2.4, 2.6, true)}
        {house(34, 45.6, 3, 2.2)}
        {house(38, 47.2, 2.6, 2.4)}
        {house(42, 48.2, 3, 2.2, true)}
        {house(46, 49.6, 2.6, 2.2)}
        {house(24, 42.6, 2.6, 2)}
        {house(36, 40.8, 2.6, 2.2, true)}
        <rect x="50.2" y="40.4" width="2.4" height="5" fill="#f6f1e6" />
        <path d="M50 40.6 L51.4 38.8 L52.8 40.6 Z" fill="#8a5a3a" />
        <g transform="translate(51.4 39.6)">
          <g className={a(css.gsMill)}>
            {[0, 60, 120, 180, 240, 300].map((r) => (
              <path
                key={r}
                d="M0 0 L0.5 -4.5 L-0.3 -4.5 Z"
                fill="#f6f1e6"
                stroke="#8a5a3a"
                strokeWidth="0.15"
                transform={`rotate(${r})`}
              />
            ))}
          </g>
        </g>
        {/* Harbour quay with a lighthouse. */}
        <rect x="58" y="53" width="14" height="1.2" fill="#d8ccb2" />
        <rect x="70.6" y="47" width="1.6" height="6" fill="#fbf8f1" />
        <rect x="70.6" y="49" width="1.6" height="1" fill="#c8452e" />
        <rect x="70.3" y="46.2" width="2.2" height="1" fill="#2a3a4a" />
        <circle
          className={a(css.gsBeam)}
          cx="71.4"
          cy="46.6"
          r="2.2"
          fill="#fff0b0"
          opacity="0.6"
        />

        {/* A small far island with a chapel. */}
        <path d="M96 55 Q102 47 110 48 Q118 48 124 55 Z" fill="#b8a27c" />
        <rect x="107" y="46" width="3" height="2.6" fill="#fbf8f1" />
        <path d="M107 46 a1.5 1.5 0 0 1 3 0 Z" fill="#2a64b8" />
        <path d="M112.5 48.4 v-2 h1 v2" fill="#fbf8f1" />

        <g className={a(css.gsGulls)}>
          {gull(60, 22, 1, "0s")}
          {gull(70, 27, 0.8, "-0.4s")}
          {gull(80, 19, 0.65, "-0.8s")}
        </g>

        {/* Sea in layers, with sun glints. */}
        <rect x="0" y="54" width="160" height="42" fill="url(#gs-ld-sea)" />
        <path
          d="M118 56 h22"
          stroke="#fff3c4"
          strokeWidth="0.6"
          opacity="0.6"
          className={a(css.gsGlint)}
        />
        <path
          d="M122 59 h14"
          stroke="#fff3c4"
          strokeWidth="0.5"
          opacity="0.45"
          className={a(css.gsGlint)}
          style={{ animationDelay: "-1.2s" }}
        />
        {wave(58, css.gsWave3, "#2aa3cc", 0.55, 1.2)}

        {/* The route: faint dots ahead, gold dots behind the boat. */}
        <path
          d={route}
          fill="none"
          stroke="#e6f6fa"
          strokeWidth="0.9"
          strokeDasharray="0.1 3"
          strokeLinecap="round"
          opacity="0.5"
        />
        <path
          d={route}
          fill="none"
          stroke="#ffd27a"
          strokeWidth="1.3"
          strokeDasharray="0.1 3"
          strokeLinecap="round"
          mask="url(#gs-ld-done)"
        />
        <circle cx="14" cy="66" r="1.6" fill="none" stroke="#ffd27a" strokeWidth="0.6" />
        <circle
          cx="142"
          cy="66"
          r="1.6"
          fill="none"
          stroke={p > 0.98 ? "#ffd27a" : "#e6f6fa"}
          strokeWidth="0.6"
        />

        {/* The catamaran. */}
        <g transform={`translate(${bx} ${by})`}>
          <g className={a(css.gsBob)}>
            <path
              d="M-14 3.6 q-6 0.6 -14 2.6 M-14 2.6 q-5 -0.4 -11 -1.6"
              stroke="#e6f6fa"
              strokeWidth="0.5"
              fill="none"
              opacity="0.7"
              className={a(css.gsGlint)}
            />
            {/* Twin hulls (the near one hides the far one), boot stripe and fenders. */}
            <path d="M-14 1.4 H12 Q16 1.6 17 0.4 L16 3.6 H-12 Q-14 3.4 -14 1.4 Z" fill="#f6f9fb" />
            <path d="M-12 3.6 H16 L15.6 4.4 H-11.4 Z" fill="#1d3d5c" />
            <path d="M-11 1.6 H13" stroke="#2b5f9e" strokeWidth="0.5" />
            <rect x="-6" y="2" width="0.9" height="1.7" rx="0.4" fill="#2a64b8" />
            <rect x="4" y="2" width="0.9" height="1.7" rx="0.4" fill="#2a64b8" />
            {/* Deck, trampoline net and railings. */}
            <rect x="-13" y="0" width="24" height="1.4" fill="#e5edf2" />
            <path
              d="M9 0.2 L15.6 0.2"
              stroke="#7a8d9e"
              strokeWidth="0.4"
              strokeDasharray="0.5 0.4"
            />
            <path d="M-13 -1.4 H-4 M6 -1.2 H15" stroke="#cfd6dc" strokeWidth="0.25" />
            {[-13, -10, -7, 7, 10, 13, 15].map((x) => (
              <path key={x} d={`M${x} 0 v-1.4`} stroke="#cfd6dc" strokeWidth="0.25" />
            ))}
            {/* Cabin with a row of windows. */}
            <path d="M-8 0 L-6.6 -3.2 H5 L7.6 0 Z" fill="#f6f9fb" />
            <path d="M-6 -2.4 H4.4 L5.8 -0.8 H-6.6 Z" fill="#16293a" />
            {[-5, -2.4, 0.2, 2.8].map((x) => (
              <rect
                key={x}
                x={x}
                y="-2.1"
                width="1.8"
                height="1"
                rx="0.3"
                fill="#5fb8d8"
                opacity="0.8"
              />
            ))}
            <rect x="-7" y="-3.6" width="12" height="0.5" fill="#e5edf2" />
            {/* Dinghy on the stern davits. */}
            <path
              d="M-17 -0.6 H-13.6 Q-13.4 0.8 -14.4 1 H-16.4 Q-17.2 0.6 -17 -0.6 Z"
              fill="#c8452e"
            />
            <path d="M-15 -1.6 L-13.4 -0.6" stroke="#cfd6dc" strokeWidth="0.25" />
            {/* Mast, boom and rigging. */}
            <path d="M0 -3.6 V-34" stroke="#cfd6dc" strokeWidth="0.7" />
            <path d="M0 -6 H-13" stroke="#cfd6dc" strokeWidth="0.6" strokeLinecap="round" />
            <path
              d="M0 -34 L15.6 0 M0 -34 L-13 -0.4 M0 -26 L4 -26"
              stroke="#dfe6ec"
              strokeWidth="0.2"
            />
            {/* Mainsail with battens, and the jib. */}
            <g className={a(css.gsSail)}>
              <path d="M-0.6 -33 Q-6 -20 -12.6 -6.4 H-0.6 Z" fill="#f6f9fb" />
              {[-28, -23, -18, -13, -8.8].map((y) => (
                <path
                  key={y}
                  d={`M-0.6 ${y} L${(-0.6 - ((y + 33) / 26.6) * 11.6).toFixed(2)} ${y + 0.4}`}
                  stroke="#c9d3db"
                  strokeWidth="0.25"
                />
              ))}
              <path
                d="M-0.6 -33 Q-6 -20 -12.6 -6.4"
                fill="none"
                stroke="#2b5f9e"
                strokeWidth="0.35"
              />
            </g>
            <g className={a(css.gsJib)}>
              <path d="M0.8 -31 Q6 -16 14.6 -0.8 H0.8 Z" fill="#f4efe2" opacity="0.95" />
            </g>
            {/* Greek flag at the masthead. */}
            <g transform="translate(0 -35)">
              <g className={a(css.gsFlag)}>
                <rect x="0" y="-2.4" width="4.2" height="2.6" fill="#2a64b8" />
                <path d="M0 -1.8 H4.2 M0 -0.8 H4.2" stroke="#fff" strokeWidth="0.3" />
                <rect x="0" y="-2.4" width="1.6" height="1.4" fill="#2a64b8" />
                <path d="M0.8 -2.4 V-1 M0 -1.7 H1.6" stroke="#fff" strokeWidth="0.3" />
              </g>
            </g>
          </g>
        </g>

        {/* Near waves wash over the hulls; a buoy rocks by the start. */}
        {wave(70, css.gsWave2, "#127bb0", 0.55, 1.8)}
        <g transform="translate(28 75)">
          <g className={a(css.gsBuoy)}>
            <path d="M-1.4 0 L0 -4 L1.4 0 Z" fill="#c8452e" />
            <rect x="-1.6" y="-0.4" width="3.2" height="1" rx="0.5" fill="#f6f1e6" />
          </g>
        </g>
        {wave(77, css.gsWave, "#0d6799", 0.7, 2.2)}
        {wave(85, css.gsWave2, "#0a5689", 0.85, 2.6)}
      </svg>

      {/* Compass: the gold ring fills and the needle swings round as the load completes. */}
      <div className="flex items-center gap-4">
        <svg viewBox="-20 -20 40 40" className="size-12" aria-hidden="true">
          <circle
            r="18"
            fill="#06182b"
            fillOpacity="0.35"
            stroke="#e6f6fa"
            strokeOpacity="0.5"
            strokeWidth="0.8"
          />
          <circle
            r="15"
            fill="none"
            stroke="#ffd27a"
            strokeWidth="1.6"
            pathLength={1}
            strokeDasharray="1"
            strokeDashoffset={1 - p}
            transform="rotate(-90)"
            className={css.gsDial}
          />
          {[0, 90, 180, 270].map((r) => (
            <path
              key={r}
              d="M0 -12 v-2"
              stroke="#e6f6fa"
              strokeWidth="0.8"
              transform={`rotate(${r})`}
            />
          ))}
          <text y="-6.5" textAnchor="middle" fontSize="4.2" fill="#ffd27a" fontFamily="monospace">
            N
          </text>
          <g style={{ transform: `rotate(${-30 + p * 255}deg)` }} className={css.gsNeedle}>
            <path d="M0 -10 L2 0 L0 1.6 L-2 0 Z" fill="#ffd27a" />
            <path d="M0 10 L2 0 L-2 0 Z" fill="#e6f6fa" opacity="0.7" />
          </g>
          <circle r="1.1" fill="#06182b" />
        </svg>
        <div className="flex flex-col">
          <span className="font-mono text-xs tracking-[0.3em] text-[#f6f9fb] uppercase tabular-nums">
            {finished ? "Σ · all aboard" : `${pad(Math.round(p * 100))} %`}
          </span>
          <span className="mt-1 font-mono text-[10px] tracking-[0.24em] text-[#e6f6fa]/75 uppercase">
            Saronic Gulf · 37°N 23°E
          </span>
        </div>
      </div>
    </div>
  );
}

const greekSail: LoaderSkin = {
  className: "bg-[linear-gradient(180deg,#8fd0ee_0%,#5bb3dc_38%,#2a86b8_62%,#0b3f72_100%)]",
  Body: GreekSailBody,
};

export function loaderSkin(_slug?: string): LoaderSkin {
  return greekSail;
}
