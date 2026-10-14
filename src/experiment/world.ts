import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CapsuleGeometry,
  CatmullRomCurve3,
  ClampToEdgeWrapping,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DataTexture,
  DirectionalLight,
  DoubleSide,
  DynamicDrawUsage,
  FogExp2,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  InstancedMesh,
  Matrix4,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Quaternion,
  Points,
  RedFormat,
  RepeatWrapping,
  RingGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  UnsignedByteType,
  Vector3,
  Vector4,
  WebGLRenderer,
  type IUniform,
  type Material,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  boatAt,
  DOMAIN,
  fbm,
  heightAt,
  hourAt,
  ISLES,
  LAST,
  legPoints,
  STOPS,
  sunState,
} from "./data";

export type Quality = "high" | "low";

/** What the page hands the world each frame. */
export type FrameState = {
  /** Story position: 0 is the intro, n is day n. */
  s: number;
  /** Extra camera turn and tilt from the pointer, in radians. */
  yaw: number;
  pitch: number;
  /** Seconds of live animation; frozen when motion is reduced. */
  time: number;
  /** Subject shift on wide screens, fraction of the view width. */
  shiftX: number;
  shiftY: number;
};

const TAU = Math.PI * 2;
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lerpAngle = (a: number, b: number, t: number) =>
  a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

// Light colours, parsed once instead of every frame.
const SUN_DAY = new Color("#fff4e0");
const SUN_WARM = new Color("#ff9248");
const HEMI_SKY = new Color("#7aa8dd");
const HEMI_WARM = new Color("#ffd2a8");
const HEMI_GROUND = new Color("#8a7650");
const LAMP = new Color("#fff2c0");
const CLOUD_DAY = new Color("#ffffff");
const CLOUD_WARM = new Color("#ffb98a");
const STEAM = new Color("#f4f1ea");
const WARM_WHITE = new Color("#f3e6cc");

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Camera pose near the boat for each day: distance, pitch and the angle off straight behind. */
const DAY_POSE = [
  { dist: 2.3, pitch: 0.34, off: 0.75 },
  { dist: 1.8, pitch: 0.42, off: -0.85 },
  { dist: 2.1, pitch: 0.36, off: 0.95 },
  { dist: 1.7, pitch: 0.3, off: -0.65 },
  { dist: 2.2, pitch: 0.33, off: 0.55 },
  { dist: 1.7, pitch: 0.27, off: -0.95 },
  { dist: 1.6, pitch: 0.25, off: 0.65 },
  { dist: 8.5, pitch: 0.5, off: 0.4 },
];
const HERO = { tx: 3.2, tz: -2.5, dist: 27, pitch: 0.56, yaw: 0.45 };

const DAY_COLORS = {
  skyTop: new Color("#2f7fd0"),
  skyHorizon: new Color("#bfe0f2"),
  dusk: new Color("#ff9460"),
  duskTop: new Color("#4a4f9c"),
  nightTop: new Color("#040a1c"),
  nightHorizon: new Color("#101c3a"),
  abyss: new Color("#073a69"),
  deep: new Color("#0a5f8e"),
  shallow: new Color("#3fd6c8"),
  nightAbyss: new Color("#020a16"),
  nightDeep: new Color("#04121f"),
  nightShallow: new Color("#0b3040"),
};

const VERT_SEA = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const FRAG_SEA = /* glsl */ `
  precision highp float;
  varying highp vec3 vWorld;
  uniform highp float uTime;
  uniform highp vec3 uCam;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uAbyss;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uFogColor;
  uniform float uFog;
  uniform float uMotion;
  uniform float uNight;
  uniform float uWarm;
  uniform vec3 uMoonDir;
  // Boat x, z, heading and wake strength.
  uniform highp vec4 uBoat;
  uniform vec4 uDomain;
  uniform sampler2D uProx;

  float wave(highp vec2 p, vec2 d, float k, float a, float sp, out float s) {
    // Phases stay highp: world positions times wave numbers lose detail at mediump.
    highp float ph = dot(p, normalize(d)) * k + uTime * sp * 0.7 * uMotion;
    s = cos(ph) * a * k;
    return s;
  }

  #ifndef GS_LOW
  float hash2(highp vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  // Value noise: derivative in xy, value in z.
  vec3 noised(highp vec2 p) {
    highp vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    vec2 du = 6.0 * f * (1.0 - f);
    float a = hash2(i);
    float b = hash2(i + vec2(1.0, 0.0));
    float c = hash2(i + vec2(0.0, 1.0));
    float d = hash2(i + vec2(1.0, 1.0));
    float k1 = b - a;
    float k2 = c - a;
    float k4 = a - b - c + d;
    return vec3(du * vec2(k1 + k4 * u.y, k2 + k4 * u.x), a + k1 * u.x + k2 * u.y + k4 * u.x * u.y);
  }
  #endif

  void main() {
    highp vec2 p = vWorld.xz;
    vec3 toCam = uCam - vWorld;
    float dist = length(toCam);
    vec3 v = toCam / dist;
    highp float t = uTime * uMotion;
    float day = 1.0 - uNight;
    float sa, sb, sc;
    wave(p, vec2(0.8, 0.6), 7.0, 0.0075, 1.1, sa);
    wave(p, vec2(-0.5, 0.85), 11.0, 0.0055, 1.4, sb);
    wave(p, vec2(0.2, -0.98), 17.0, 0.0035, 1.8, sc);
    vec2 g = normalize(vec2(0.8, 0.6)) * sa + normalize(vec2(-0.5, 0.85)) * sb
           + normalize(vec2(0.2, -0.98)) * sc;
    #ifndef GS_LOW
    float sd;
    wave(p, vec2(-0.9, -0.3), 27.0, 0.002, 2.2, sd);
    g += normalize(vec2(-0.9, -0.3)) * sd;
    #endif
    g *= 1.0 - smoothstep(4.0, 26.0, dist) * 0.92;

    // Fine ripples (high tier): two scrolling octaves of value noise, faded out before they alias.
    float near = 1.0 - smoothstep(2.5, 10.0, dist);
    #ifndef GS_LOW
    vec2 glit = vec2(0.0);
    float rip = 0.5;
    if (near > 0.0) {
      vec3 n1 = noised(p * 34.0 + vec2(t * 0.45, t * 0.3));
      vec3 n2 = noised(mat2(0.8, -0.6, 0.6, 0.8) * p * 79.0 - vec2(t * 0.38, -t * 0.52));
      g += (n1.xy * 0.03 + n2.xy * 0.018) * near;
      rip = n1.z;
      glit = (n2.xy - n1.xy * 0.5) * near;
    }
    #endif
    vec3 n = normalize(vec3(-g.x, 1.0, -g.y));

    vec2 uv = (p - uDomain.xy) / uDomain.zw;
    float prox = texture2D(uProx, uv).r;
    float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
    prox *= inside;

    // Depth colour: navy open water, blue off the coast, turquoise in the shallows.
    float shallow = smoothstep(0.1, 0.48, prox);
    vec3 body = mix(uAbyss, uDeep, smoothstep(0.0, 0.16, prox));
    body = mix(body, uShallow, shallow);
    // Sunlit shallows glow a little.
    body += uShallow * shallow * 0.12 * (uSunColor * 0.5 + 0.5);

    #ifndef GS_LOW
    // Caustics on the sandy floor of coves.
    float cm = smoothstep(0.2, 0.4, prox) * (1.0 - smoothstep(0.46, 0.5, prox)) * (1.0 - smoothstep(3.0, 12.0, dist)) * day;
    if (cm > 0.0) {
      highp vec2 q = p * 11.0;
      highp float ct = t * 0.8;
      float c1 = sin(q.x + 1.7 * sin(q.y * 0.9 + ct) + ct * 0.6);
      float c2 = sin(q.y * 1.1 + 1.7 * sin(q.x * 1.2 - ct * 0.9) - ct * 0.5);
      float c3 = sin((q.x - q.y) * 0.8 + 1.5 * sin((q.x + q.y) * 0.7 + ct * 0.7));
      float cau = pow(1.0 - abs(c1 + c2 + c3) / 3.0, 7.0);
      body += uSunColor * cau * cm * 0.32 * clamp(uSunDir.y * 2.0, 0.2, 1.0);
    }
    #endif

    // Fresnel: looking down shows the water body, grazing angles reflect the sky.
    float ndv = clamp(dot(n, v), 0.0, 1.0);
    float fres = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
    vec3 r = reflect(-v, n);
    vec3 sky = mix(uHorizon, uTop, pow(clamp(r.y, 0.0, 1.0), 0.55));
    vec3 col = mix(body, sky, min(fres, 0.92));

    // Sun: a sharp disc reflection plus a glitter path, strongest with a low warm sun.
    float rs = max(dot(r, uSunDir), 0.0);
    float path = pow(rs, mix(60.0, 16.0, uWarm)) * (0.1 + 0.3 * uWarm);
    col += uSunColor * (pow(rs, 220.0) * 1.4 + path * (0.4 + fres));
    // Moon path at night.
    float rm = max(dot(r, uMoonDir), 0.0);
    vec3 moonCol = vec3(0.62, 0.72, 1.0) * uNight;
    col += moonCol * (pow(rm, 260.0) * 0.8 + pow(rm, 22.0) * 0.07);
    #ifndef GS_LOW
    if (near > 0.0) {
      // Glitter: tiny facets tilted by the fine ripples catch the sun (or moon) in sparks.
      vec3 rg = reflect(-v, normalize(n + vec3(glit.x, 0.0, glit.y) * 0.06));
      float sparkS = smoothstep(0.9975, 0.9998, dot(rg, uSunDir)) * (0.5 + 1.3 * uWarm) * day;
      float sparkM = smoothstep(0.996, 0.9997, dot(rg, uMoonDir));
      col += (uSunColor * sparkS * 1.3 + moonCol * sparkM * 1.4) * near;
    }
    #endif
    // The yacht's lamp on the water at night.
    if (uNight > 0.01) {
      highp vec3 lamp = vec3(uBoat.x, 0.2, uBoat.y) - vWorld;
      float ld = length(lamp);
      vec3 h = normalize(lamp / ld + v);
      float ls = pow(max(dot(n, h), 0.0), 90.0) * 1.6 + 0.05;
      col += vec3(1.0, 0.72, 0.4) * ls * uNight / (1.0 + ld * ld * 18.0);
    }

    // Foam: the shore line, surf bands rolling in and the yacht's wake.
    float lit = mix(0.22, 1.0, clamp(uSunDir.y * 3.0 + 0.35, 0.0, 1.0) * day) + uNight * 0.08;
    #ifdef GS_LOW
    float wob = 0.0;
    float brk = 0.7 + 0.3 * sin(p.x * 6.0 + p.y * 4.5);
    #else
    float wob = sin(p.x * 17.0 + t * 0.9) * 0.012 + sin(p.y * 21.0 - t * 0.7) * 0.012;
    float brk = smoothstep(0.15, 0.75, rip) * 0.6 + 0.4 * (0.5 + 0.5 * sin(p.x * 6.0 + p.y * 4.5 + t * 0.2));
    #endif
    float foam = smoothstep(0.43, 0.49, prox + wob) * (1.0 - smoothstep(0.5, 0.56, prox + wob)) * 0.7;
    float zone = smoothstep(0.18, 0.3, prox) * (1.0 - smoothstep(0.37, 0.47, prox));
    if (zone > 0.0) {
      highp float sp = prox * 28.0 - t * 0.85 + wob * 20.0;
      float fs = fract(sp);
      float crest = smoothstep(0.0, 0.1, fs) * (1.0 - smoothstep(0.1, 0.42, fs));
      foam = max(foam, crest * zone * brk * 0.6);
    }

    highp vec2 rel = vWorld.xz - uBoat.xy;
    vec2 fw = vec2(sin(uBoat.z), cos(uBoat.z));
    float along = 0.2 - dot(rel, fw);
    float side = abs(dot(rel, vec2(fw.y, -fw.x)));
    if (uBoat.w > 0.001 && along > -0.02 && along < 1.5 && side < 0.4) {
      float a = along / 1.5;
      float fade = (1.0 - a) * (1.0 - a) * smoothstep(-0.02, 0.06, along) * uBoat.w;
      float arm = abs(side - max(along, 0.0) * 0.21 - 0.03);
      float arms = 1.0 - smoothstep(0.0, 0.008 + along * 0.035, arm);
      float sig = 0.0015 + along * along * 0.006;
      float trail = exp(-side * side / sig) * smoothstep(0.15, 0.3, along) * 0.85;
      #ifdef GS_LOW
      float wb = 0.7 + 0.3 * sin(along * 70.0 - t * 2.5) * sin(side * 110.0);
      #else
      float wb = mix(0.45, 1.0, rip) * (0.75 + 0.25 * sin(along * 70.0 - t * 2.5) * sin(side * 110.0));
      #endif
      foam = max(foam, max(arms * 0.8, trail) * fade * wb);
    }
    col = mix(col, vec3(lit), clamp(foam, 0.0, 1.0));

    float f = 1.0 - exp(-pow(dist * uFog, 2.0));
    col = mix(col, uFogColor, f);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const VERT_SKY = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
  }
`;

const FRAG_SKY = /* glsl */ `
  precision highp float;
  varying vec3 vDir;
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uGlow;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uNight;
  float h21(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
  void main() {
    vec3 d = normalize(vDir);
    float up = clamp(d.y, 0.0, 1.0);
    vec3 col = mix(uHorizon, uTop, pow(up, 0.55));
    float sd = max(dot(d, uSunDir), 0.0);
    col += uGlow * pow(sd, 6.0) * 0.55;
    col += uSunColor * (pow(sd, 400.0) * 3.0 + pow(sd, 40.0) * 0.35);
    // Stars fade in at night.
    if (uNight > 0.01) {
      vec2 sp = floor(d.xz / max(d.y + 0.25, 0.2) * 70.0);
      float star = step(0.9965, h21(sp)) * smoothstep(0.05, 0.4, d.y);
      col += vec3(star) * uNight * 0.85;
    }
    col = mix(col, uHorizon, smoothstep(0.0, -0.2, d.y));
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const VERT_DOTS = /* glsl */ `
  attribute float aPath;
  uniform float uPath;
  uniform float uScale;
  varying float vDone;
  varying float vNear;
  void main() {
    vDone = step(aPath, uPath);
    vNear = 1.0 - smoothstep(0.0, 0.35, abs(aPath - uPath));
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = (0.022 + vNear * 0.01) * uScale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG_DOTS = /* glsl */ `
  precision highp float;
  varying float vDone;
  varying float vNear;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.2, d);
    vec3 col = mix(vec3(1.0), vec3(1.0, 0.78, 0.35), vDone);
    gl_FragColor = vec4(col, a * mix(0.45, 0.95, vDone));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const VERT_STEAM = /* glsl */ `
  attribute vec4 aSeed;
  uniform float uTime;
  uniform float uScale;
  uniform float uMotion;
  varying float vLife;
  void main() {
    float life = fract(aSeed.x + uTime * 0.07 * uMotion);
    vLife = life;
    vec3 p = position;
    p.y += life * 0.55;
    p.x += (aSeed.y - 0.5) * 0.12 + sin(life * 6.0 + aSeed.z * 6.0) * 0.05 * life + life * 0.12;
    p.z += (aSeed.z - 0.5) * 0.12;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = (0.09 + life * 0.3) * (0.7 + aSeed.w * 0.6) * uScale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG_STEAM = /* glsl */ `
  precision highp float;
  uniform vec3 uColor;
  varying float vLife;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.0, d) * sin(vLife * 3.14159) * 0.28;
    gl_FragColor = vec4(uColor, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// Clouds: one instanced draw of camera-facing quads (what Sprite does), with per-cloud alpha. All clouds share one colour, so their blend order does not change the result.
const VERT_CLOUD = /* glsl */ `
  attribute vec3 aCenter;
  attribute vec2 aSize;
  attribute float aAlpha;
  varying vec2 vUv;
  varying float vAlpha;
  void main() {
    vUv = uv;
    vAlpha = aAlpha;
    vec4 mv = viewMatrix * vec4(aCenter, 1.0);
    mv.xy += position.xy * aSize;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG_CLOUD = /* glsl */ `
  precision mediump float;
  uniform sampler2D uMap;
  uniform vec3 uColor;
  varying vec2 vUv;
  varying float vAlpha;
  void main() {
    vec4 t = texture2D(uMap, vUv);
    gl_FragColor = vec4(uColor * t.rgb, t.a * vAlpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function softTexture(): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(255,255,255,0.95)");
  r.addColorStop(0.5, "rgba(255,255,255,0.45)");
  r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export function createWorld(canvasEl: HTMLCanvasElement, quality: Quality) {
  const high = quality === "high";
  const renderer = new WebGLRenderer({
    canvas: canvasEl,
    // MSAA stays on for the low tier too: thin rigging and masts shimmer badly without it, and on the tile-based GPUs of phones 4x MSAA resolves on-chip for little cost. The low tier's DPR cap (1.25) is what keeps it cheap.
    antialias: true,
    powerPreference: "high-performance",
  });
  const baseDpr = Math.min(window.devicePixelRatio, high ? 2 : 1.25);
  let detail = 1;
  renderer.setPixelRatio(baseDpr);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;

  const scene = new Scene();
  const fog = new FogExp2("#bfe0f2", 0.016);
  scene.fog = fog;
  const camera = new PerspectiveCamera(46, 1, 0.04, 600);

  const disposables: { dispose(): void }[] = [];
  const own = <T extends { dispose(): void }>(x: T): T => {
    disposables.push(x);
    return x;
  };

  // ---------------------------------------------------------------- lights
  const sun = new DirectionalLight("#fff3dd", 2.6);
  const moon = new DirectionalLight("#8aa6ff", 0);
  moon.position.set(-3, 5, 2);
  const hemi = new HemisphereLight("#a8d4f5", "#6b5a3c", 0.8);
  const boatLamp = new PointLight("#ffb866", 0, 1.6, 1.6);
  scene.add(sun, moon, hemi, boatLamp);

  // ---------------------------------------------------------------- sky
  const skyMat = own(
    new ShaderMaterial({
      vertexShader: VERT_SKY,
      fragmentShader: FRAG_SKY,
      side: BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTop: { value: new Color() },
        uHorizon: { value: new Color() },
        uGlow: { value: new Color() },
        uSunDir: { value: new Vector3(0, 1, 0) },
        uSunColor: { value: new Color() },
        uNight: { value: 0 },
      },
    }),
  );
  const sky = new Mesh(own(new SphereGeometry(300, 32, 16)), skyMat);
  sky.renderOrder = -10;
  scene.add(sky);

  // ---------------------------------------------------------------- land
  const W = DOMAIN.x1 - DOMAIN.x0;
  const D = DOMAIN.z1 - DOMAIN.z0;
  const step = high ? 0.2 : 0.3;
  const nx = Math.round(W / step);
  const nz = Math.round(D / step);
  const terrainGeo = own(new PlaneGeometry(W, D, nx, nz));
  terrainGeo.rotateX(-Math.PI / 2);
  terrainGeo.translate(DOMAIN.x0 + W / 2, 0, DOMAIN.z0 + D / 2);
  {
    const pos = terrainGeo.attributes.position as BufferAttribute;
    // Village centres (x, z, radius): relief and cliffs stay out of them so houses keep sitting on heightAt.
    const villages = [
      [-2.45, -7.1, 1.3],
      [-1.45, 7.55, 1.1],
      [-0.8, 15.45, 1.4],
      [-3.1, 2.3, 0.9],
      [0.7, -3.0, 0.9],
    ] as const;
    const rockAmt = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = heightAt(x, z);
      let free = 1;
      for (const [vx, vz, vr] of villages)
        free = Math.min(free, smooth(vr, vr + 0.5, Math.hypot(x - vx, z - vz)));
      // Fine relief on the hills.
      let y = h + (fbm(x * 9, z * 9) - 0.5) * 0.02 * smooth(0.06, 0.3, h) * free;
      // Rocky cliffs at the waterline: the shore rim is lifted and broken up, except on the sandy coves.
      const cove = smooth(0.5, 0.65, fbm(x * 1.7 + 11, z * 1.7 - 4));
      const rim = Math.exp(-(((h - 0.01) / 0.03) ** 2)) * (1 - cove) * free;
      if (rim > 0.01) {
        const jag = fbm(x * 14 + 3, z * 14 - 7);
        y += rim * (0.012 + jag * 0.022) * (h > -0.02 ? 1 : 0);
        rockAmt[i] = clamp01(rim * 1.4);
      }
      pos.setY(i, y);
    }
    terrainGeo.computeVertexNormals();
    const nor = terrainGeo.attributes.normal as BufferAttribute;
    const col = new Float32Array(pos.count * 3);
    const c = new Color();
    const sand = new Color("#e6d6ae");
    const wet = new Color("#bba97f");
    const scrub = new Color("#8a9a55");
    const forest = new Color("#4f7040");
    const dry = new Color("#b9a96c");
    const rock = new Color("#a39682");
    const rockHi = new Color("#c8bda8");
    const under = new Color("#8f8260");
    const ochre = new Color("#b9835a");
    const redRock = new Color("#9c5f45");
    const lava = new Color("#5f544e");
    const beach = new Color("#f1e4c2");
    const soil = new Color("#9b7a55");
    const straw = new Color("#c9b47a");
    const path = new Color("#d6c4a0");
    const veg = new Color();
    const cliff = new Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = pos.getY(i);
      const slope = 1 - nor.getY(i);
      const n1 = fbm(x * 3.1, z * 3.1);
      const n2 = fbm(x * 1.7 + 11, z * 1.7 - 4);
      if (h < 0) c.copy(under);
      else {
        c.copy(wet).lerp(sand, smooth(0.0, 0.018, h));
        // Pale beaches in the flat coves.
        c.lerp(
          beach,
          smooth(0.55, 0.7, n2) * (1 - smooth(0.02, 0.05, h)) * (1 - smooth(0.05, 0.2, slope)),
        );
        veg.copy(scrub).lerp(forest, smooth(0.05, 0.4, h) * (0.4 + n1));
        veg.lerp(dry, smooth(0.45, 0.8, n1) * (1 - smooth(0.2, 0.5, h)) * 0.8);
        c.lerp(
          veg,
          smooth(0.02, 0.07, h) * (1 - smooth(0.55, 0.7, n2) * 0.7 * (1 - smooth(0.05, 0.1, h))),
        );
        // Cliffs vary from grey limestone to ochre and red; Methana is dark volcanic rock.
        cliff.copy(h > 0.5 ? rockHi : rock).lerp(ochre, smooth(0.45, 0.7, n2) * 0.8);
        cliff.lerp(redRock, smooth(0.62, 0.8, n1) * 0.6);
        cliff.lerp(lava, Math.exp(-((Math.hypot(x + 5.4, z - 2.9) / 1.4) ** 2)) * 0.85);
        // Ground variety: bare soil patches and straw-dry grass on the open hills.
        const n3 = fbm(x * 5.3 - 7, z * 5.3 + 2);
        c.lerp(soil, smooth(0.58, 0.72, n3) * smooth(0.04, 0.1, h) * 0.7);
        c.lerp(
          straw,
          smooth(0.3, 0.45, n1) * (1 - smooth(0.5, 0.6, n1)) * smooth(0.05, 0.12, h) * 0.45,
        );
        // Light sand just above the water line.
        c.lerp(beach, (1 - smooth(0.004, 0.025, h)) * 0.55);
        // Footpaths: thin winding lines of trodden earth on the gentle slopes.
        const pv = fbm(x * 2.3 + 31, z * 2.3 - 17) * 9;
        const pd = Math.abs(pv - Math.round(pv));
        c.lerp(
          path,
          (1 - smooth(0.03, 0.07, pd)) *
            smooth(0.03, 0.06, h) *
            (1 - smooth(0.12, 0.25, slope)) *
            0.75,
        );
        const r = clamp01(smooth(0.14, 0.4, slope) + smooth(0.55, 0.95, h) * 0.65 + rockAmt[i]!);
        c.lerp(cliff, r);
      }
      // Terraces: stepped bands (dry-stone risers) on the gentle mid slopes.
      const tb = h * 70 - Math.floor(h * 70);
      const terr =
        h > 0.06 && h < 0.4 && slope < 0.3 ? (tb < 0.18 ? -0.1 : 0.03 * Math.sin(tb * Math.PI)) : 0;
      const shade = 0.82 + 0.18 * nor.getY(i) + terr;
      col[i * 3] = c.r * shade;
      col[i * 3 + 1] = c.g * shade;
      col[i * 3 + 2] = c.b * shade;
    }
    terrainGeo.setAttribute("color", new BufferAttribute(col, 3));
  }
  const terrainMat = own(new MeshStandardMaterial({ vertexColors: true, roughness: 0.96 }));
  const terrain = new Mesh(terrainGeo, terrainMat);
  scene.add(terrain);

  // ---------------------------------------------------------------- sea
  const PX = 128;
  const PZ = Math.round((PX * D) / W);
  const prox = (() => {
    let a = new Float32Array(PX * PZ);
    for (let j = 0; j < PZ; j++)
      for (let i = 0; i < PX; i++) {
        const x = DOMAIN.x0 + ((i + 0.5) / PX) * W;
        const z = DOMAIN.z0 + ((j + 0.5) / PZ) * D;
        a[j * PX + i] = heightAt(x, z) > 0 ? 1 : 0;
      }
    for (let pass = 0; pass < 2; pass++) {
      for (const horizontal of [true, false]) {
        const b = new Float32Array(a.length);
        const R = 2;
        for (let j = 0; j < PZ; j++)
          for (let i = 0; i < PX; i++) {
            let sum = 0;
            for (let k = -R; k <= R; k++) {
              const ii = horizontal ? Math.min(PX - 1, Math.max(0, i + k)) : i;
              const jj = horizontal ? j : Math.min(PZ - 1, Math.max(0, j + k));
              sum += a[jj * PX + ii]!;
            }
            b[j * PX + i] = sum / (2 * R + 1);
          }
        a = b;
      }
    }
    const bytes = new Uint8Array(a.length);
    for (let i = 0; i < a.length; i++) bytes[i] = Math.round(clamp01(a[i]!) * 255);
    return bytes;
  })();
  const proxTex = own(new DataTexture(prox, PX, PZ, RedFormat, UnsignedByteType));
  proxTex.magFilter = proxTex.minFilter = LinearFilter;
  proxTex.wrapS = proxTex.wrapT = ClampToEdgeWrapping;
  proxTex.needsUpdate = true;

  const seaMat = own(
    new ShaderMaterial({
      vertexShader: VERT_SEA,
      // Low tier: mediump by default (phases stay highp), three waves, no ripple noise, caustics, glitter sparks or foam wobble.
      fragmentShader: high
        ? FRAG_SEA
        : FRAG_SEA.replace("precision highp float;", "precision mediump float;"),
      defines: high ? {} : { GS_LOW: "" },
      uniforms: {
        uTime: { value: 0 },
        uMotion: { value: 1 },
        uCam: { value: new Vector3() },
        uSunDir: { value: new Vector3(0, 1, 0) },
        uSunColor: { value: new Color() },
        uAbyss: { value: new Color() },
        uDeep: { value: new Color() },
        uNight: { value: 0 },
        uWarm: { value: 0 },
        uMoonDir: { value: new Vector3(-0.55, 0.32, 0.77).normalize() },
        uBoat: { value: new Vector4(0, 0, 0, 0) },
        uShallow: { value: new Color() },
        uTop: { value: new Color() },
        uHorizon: { value: new Color() },
        uFogColor: { value: new Color() },
        uFog: { value: fog.density },
        uDomain: { value: [DOMAIN.x0, DOMAIN.z0, W, D] },
        uProx: { value: proxTex },
      },
    }),
  );
  const sea = new Mesh(own(new PlaneGeometry(700, 700)), seaMat);
  sea.rotateX(-Math.PI / 2);
  scene.add(sea);

  // ---------------------------------------------------------------- places
  const rand = rng(20270);
  const dummy = new Object3D();
  const gradient = (x: number, z: number) => {
    const e = 0.06;
    return [
      heightAt(x + e, z) - heightAt(x - e, z),
      heightAt(x, z + e) - heightAt(x, z - e),
    ] as const;
  };

  type Town = { x: number; z: number; r: number; n: number; stone?: boolean };
  const TOWNS: Town[] = [
    { x: -2.45, z: -7.1, r: 0.95, n: high ? 260 : 150 },
    { x: -1.45, z: 7.55, r: 0.8, n: high ? 260 : 150 },
    { x: -0.8, z: 15.45, r: 1.05, n: high ? 330 : 190, stone: true },
    { x: -3.1, z: 2.3, r: 0.6, n: high ? 130 : 80 },
    { x: 0.7, z: -3.0, r: 0.6, n: high ? 90 : 56 },
  ];
  type Kind = "cube" | "two" | "ell" | "stack";
  type House = {
    x: number;
    y: number;
    z: number;
    w: number;
    h: number;
    yaw: number;
    wall: Color;
    roof: Color;
    dome: boolean;
    flat: boolean;
    /** The flat flag from the base layout; keeps the shared random stream stable. */
    flat0: boolean;
    town: number;
    /** Massing: a plain cube, a two-storey house, an L with a side wing, or a cube stacked on the roof. */
    kind: Kind;
    side: number;
    gable: boolean;
  };
  const houses: House[] = [];
  const walls = ["#fbf8f1", "#f4efe3", "#ece5d6", "#fdfdfb", "#e9dcc0", "#f2f2f0"].map(
    (c) => new Color(c),
  );
  const stones = ["#d9cfba", "#cdbf9f", "#e8e0cf", "#bfb4a0"].map((c) => new Color(c));
  const roofs = ["#c8623a", "#b9552f", "#d77a4c", "#a94a2a"].map((c) => new Color(c));
  // A few island houses are washed in ochre, pink or pale blue.
  const pastels = ["#efd9a8", "#f1cfc2", "#d8e6ee", "#f3e3b5"].map((c) => new Color(c));
  // A separate stream for house variety, so the rest of the islands keep their layout.
  const hr = rng(7331);
  for (const [ti, t] of TOWNS.entries()) {
    let placed = 0;
    let tries = 0;
    while (placed < t.n && tries++ < t.n * 40) {
      const a = rand() * TAU;
      const d = Math.sqrt(rand()) * t.r;
      const x = t.x + Math.cos(a) * d;
      const z = t.z + Math.sin(a) * d * 0.8;
      const h = heightAt(x, z);
      if (h < 0.012 || h > 0.34) continue;
      const [gx, gz] = gradient(x, z);
      const yaw =
        Math.round(Math.atan2(-gx, -gz) / (Math.PI / 2)) * (Math.PI / 2) + (rand() - 0.5) * 0.25;
      const w = 0.026 + rand() * 0.02;
      const base = {
        x,
        y: h - 0.004,
        z,
        w,
        h: w * (0.75 + rand() * 0.5),
        yaw,
        wall:
          rand() < 0.1
            ? pastels[Math.floor(rand() * pastels.length)]!
            : (t.stone ? stones : walls)[Math.floor(rand() * (t.stone ? stones : walls).length)]!,
        roof: roofs[Math.floor(rand() * roofs.length)]!,
        dome: !t.stone && rand() < 0.06,
        flat: !t.stone && rand() < 0.35,
        town: ti,
      };
      const k = hr();
      const kind: Kind = base.dome
        ? "cube"
        : k < 0.28
          ? "two"
          : k < 0.46
            ? "ell"
            : k < 0.62 && !t.stone
              ? "stack"
              : "cube";
      // Cycladic villages are mostly flat-roofed; Hydra and Poros keep their tiled roofs.
      const flat = !base.dome && (base.flat || kind === "stack" || (!t.stone && hr() < 0.35));
      houses.push({
        ...base,
        h: kind === "two" ? w * (1.35 + hr() * 0.3) : base.h,
        flat,
        flat0: base.flat,
        kind,
        side: hr() < 0.5 ? -1 : 1,
        gable: hr() < 0.55,
      });
      placed++;
    }
  }
  // Variety pass on its own stream (placements already drawn above stay put): whites range from chalk to warm lime-wash, and house sizes spread wider.
  {
    const vr = rng(5101);
    for (const hs of houses) {
      const f = 0.86 + vr() * 0.34;
      hs.w *= f;
      hs.h *= f * (0.92 + vr() * 0.18);
      hs.wall = hs.wall.clone().multiplyScalar(0.93 + vr() * 0.09);
      if (vr() < 0.25) hs.wall.lerp(WARM_WHITE, 0.35);
    }
  }
  const wallMat = own(
    new MeshStandardMaterial({
      roughness: 0.9,
      emissive: new Color("#ffc57a"),
      emissiveIntensity: 0,
    }),
  );
  // Terracotta tiles: courses and barrel channels drawn once, tinted per roof.
  const tileTex = own(
    (() => {
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      const g = c.getContext("2d")!;
      g.fillStyle = "#ffffff";
      g.fillRect(0, 0, 64, 64);
      for (let x = 0; x < 64; x += 8) {
        const gr = g.createLinearGradient(x, 0, x + 8, 0);
        gr.addColorStop(0, "rgba(40,16,8,0.28)");
        gr.addColorStop(0.5, "rgba(255,255,255,0)");
        gr.addColorStop(1, "rgba(40,16,8,0.28)");
        g.fillStyle = gr;
        g.fillRect(x, 0, 8, 64);
      }
      g.fillStyle = "rgba(50,20,10,0.35)";
      for (let y = 0; y < 64; y += 8) g.fillRect(0, y, 64, 1.5);
      const tx = new CanvasTexture(c);
      tx.colorSpace = SRGBColorSpace;
      tx.wrapS = tx.wrapT = RepeatWrapping;
      tx.repeat.set(5, 4);
      return tx;
    })(),
  );
  const roofMat = own(new MeshStandardMaterial({ roughness: 0.85, map: tileTex }));
  const wallGeo = own(new BoxGeometry(1, 1, 1.15));
  const roofGeo = own(new ConeGeometry(0.78, 0.5, 4));
  roofGeo.rotateY(Math.PI / 4);
  // Gable roof: a triangular prism along the house depth, base at 0, ridge at 1.
  const gableGeo = own(new CylinderGeometry(0.5, 0.5, 1, 3, 1, false, Math.PI));
  gableGeo.rotateX(Math.PI / 2);
  gableGeo.translate(0, 0.25, 0);
  gableGeo.scale(1 / 0.866, 1 / 0.75, 1);
  const wallMesh = new InstancedMesh(wallGeo, wallMat, houses.length);
  const roofMesh = new InstancedMesh(roofGeo, roofMat, houses.length);
  const gableMesh = new InstancedMesh(gableGeo, roofMat, houses.length);
  // Blue domes: on chapels in the towns and on the island chapels added below.
  const domeGeo = own(new SphereGeometry(0.5, 10, 5, 0, TAU, 0, Math.PI / 2));
  const domeMat = own(new MeshStandardMaterial({ color: "#2a64b8", roughness: 0.45 }));
  const domeSpots: { x: number; y: number; z: number; r: number }[] = [];
  const flatMats: Matrix4[] = [];
  const skipRoof = new Object3D();
  skipRoof.scale.setScalar(0);
  skipRoof.updateMatrix();
  houses.forEach((hs, i) => {
    dummy.position.set(hs.x, hs.y + hs.h / 2, hs.z);
    dummy.rotation.set(0, hs.yaw, 0);
    dummy.scale.set(hs.w, hs.h, hs.w);
    dummy.updateMatrix();
    wallMesh.setMatrixAt(i, dummy.matrix);
    wallMesh.setColorAt(i, hs.dome ? walls[3]! : hs.wall);
    roofMesh.setMatrixAt(i, skipRoof.matrix);
    gableMesh.setMatrixAt(i, skipRoof.matrix);
    if (hs.dome) {
      domeSpots.push({ x: hs.x, y: hs.y + hs.h, z: hs.z, r: hs.w * 0.95 });
    } else if (hs.flat) {
      // A flat terrace roof slab.
      dummy.position.set(hs.x, hs.y + hs.h + hs.w * 0.04, hs.z);
      dummy.scale.set(hs.w * 1.04, hs.w * 0.08, hs.w * 1.2);
      dummy.updateMatrix();
      flatMats.push(dummy.matrix.clone());
    } else if (hs.gable) {
      dummy.position.set(hs.x, hs.y + hs.h, hs.z);
      dummy.scale.set(hs.w * 1.14, hs.w * 0.42, hs.w * 1.24);
      dummy.updateMatrix();
      gableMesh.setMatrixAt(i, dummy.matrix);
    } else {
      dummy.position.set(hs.x, hs.y + hs.h + hs.w * 0.16, hs.z);
      dummy.scale.set(hs.w * 1.12, hs.w * 0.64, hs.w * 1.12);
      dummy.updateMatrix();
      roofMesh.setMatrixAt(i, dummy.matrix);
    }
    roofMesh.setColorAt(i, hs.roof);
    gableMesh.setColorAt(i, hs.roof);
  });
  scene.add(wallMesh, roofMesh, gableMesh);

  // House detail: doors with steps, framed windows with lintels and sills, shutters, wings and stacked cubes, parapets, balconies, outdoor stairs, chimneys, pots and bougainvillea.
  const windowMat = own(
    new MeshStandardMaterial({
      color: "#2b3440",
      roughness: 0.4,
      emissive: new Color("#ffc06a"),
      emissiveIntensity: 0,
    }),
  );
  const litWindowMat = own(windowMat.clone());
  {
    const unit = own(new BoxGeometry(1, 1, 1));
    /** A box in house space: x across the front, y up from the base, z out of the front; all in units of the house width. */
    const at = (
      hs: House,
      lx: number,
      ly: number,
      lz: number,
      sx: number,
      sy: number,
      sz: number,
      rx = 0,
    ) => {
      const c = Math.cos(hs.yaw);
      const s = Math.sin(hs.yaw);
      dummy.position.set(
        hs.x + (c * lx + s * lz) * hs.w,
        hs.y + ly * hs.w,
        hs.z + (-s * lx + c * lz) * hs.w,
      );
      dummy.rotation.set(rx, hs.yaw, 0, "YXZ");
      dummy.scale.set(sx * hs.w, sy * hs.w, sz * hs.w);
      dummy.updateMatrix();
      return dummy.matrix.clone();
    };
    const FRONT = 0.585;
    const openings: Matrix4[] = [];
    const shutters: Matrix4[] = [];
    const chimneys: Matrix4[] = [];
    const ledges: Matrix4[] = [];
    const masonry: Matrix4[] = [];
    const masonryCol: Color[] = [];
    const frames: Matrix4[] = [];
    const frameCol: Color[] = [];
    const rails: Matrix4[] = [];
    const pots: Matrix4[] = [];
    const leaves: Matrix4[] = [];
    const leafCol: Color[] = [];
    const frameTones = ["#2a64b8", "#3d7f6c", "#2f7fa6", "#7a4a2c"].map((c) => new Color(c));
    const blooms = ["#c2185b", "#d81b7a", "#b0287a", "#e0408a", "#a61e6a"].map((c) => new Color(c));
    const greens = ["#4f7a3a", "#5d8a42", "#3f6a33"].map((c) => new Color(c));
    const ledgeStone = new Color("#e6dfcf");
    const wall = (hs: House, m: Matrix4) => {
      masonry.push(m);
      masonryCol.push(hs.dome ? walls[3]! : hs.wall);
    };
    const framed = (
      hs: House,
      u: number,
      y: number,
      sw: number,
      sh: number,
      tone: Color | null,
    ) => {
      openings.push(at(hs, u, y, FRONT, sw, sh, 0.06));
      if (!high) return;
      ledges.push(at(hs, u, y + sh / 2 + 0.03, FRONT + 0.02, sw + 0.1, 0.04, 0.08)); // lintel
      ledges.push(at(hs, u, y - sh / 2 - 0.02, FRONT + 0.03, sw + 0.08, 0.03, 0.1)); // sill
      if (tone) {
        frames.push(at(hs, u, y, FRONT - 0.003, sw + 0.05, sh + 0.05, 0.05));
        frameCol.push(tone);
      }
    };
    for (const hs of houses) {
      const H = hs.h / hs.w;
      const tone = hr() < 0.6 ? frameTones[Math.floor(hr() * frameTones.length)]! : null;
      // Door with a stone step and a lintel.
      openings.push(at(hs, -0.22, 0.24, FRONT, 0.2, 0.44, 0.06));
      if (high) {
        ledges.push(at(hs, -0.22, 0.48, FRONT + 0.02, 0.3, 0.04, 0.08));
        ledges.push(at(hs, -0.22, 0.025, FRONT + 0.07, 0.34, 0.05, 0.16));
        if (tone) {
          frames.push(at(hs, -0.22, 0.24, FRONT - 0.003, 0.25, 0.48, 0.05));
          frameCol.push(tone);
        }
      }
      framed(hs, 0.2, 0.52, 0.2, 0.2, tone);
      const upper = H > 1.2;
      if (upper) framed(hs, -0.22, H - 0.36, 0.18, 0.22, tone);
      else if (high && H > 0.95) framed(hs, -0.22, H - 0.22, 0.14, 0.14, tone);
      if (high) {
        // A small window on the side wall.
        openings.push(at(hs, hs.side * 0.505, 0.55, 0, 0.06, 0.18, 0.18));
      }
      if (high && (hs.town === 1 || hs.town === 2)) {
        shutters.push(at(hs, 0.06, 0.52, FRONT + 0.005, 0.07, 0.24, 0.05));
        shutters.push(at(hs, 0.34, 0.52, FRONT + 0.005, 0.07, 0.24, 0.05));
      }

      // Massing: a side wing or a cube on the roof terrace.
      if (hs.kind === "ell") {
        const h2 = H * 0.68;
        wall(hs, at(hs, hs.side * 0.8, h2 / 2, -0.15, 0.62, h2, 0.8));
        wall(hs, at(hs, hs.side * 0.8, h2 + 0.03, -0.15, 0.66, 0.06, 0.84));
        openings.push(at(hs, hs.side * 0.8, h2 * 0.55, 0.255, 0.18, 0.18, 0.06));
        if (high) {
          for (const lz of [-0.56, 0.26])
            wall(hs, at(hs, hs.side * 0.8, h2 + 0.1, lz, 0.66, 0.1, 0.05));
          wall(hs, at(hs, hs.side * 1.11, h2 + 0.1, -0.15, 0.05, 0.1, 0.84));
        }
      } else if (hs.kind === "stack") {
        const sx = -hs.side * 0.18;
        wall(hs, at(hs, sx, H + 0.3, -0.2, 0.55, 0.6, 0.6));
        wall(hs, at(hs, sx, H + 0.62, -0.2, 0.59, 0.05, 0.64));
        openings.push(at(hs, sx, H + 0.25, 0.105, 0.15, 0.32, 0.06));
      }
      // Parapets round flat roof terraces.
      if (high && hs.flat && !hs.dome) {
        for (const lz of [-0.56, 0.56]) wall(hs, at(hs, 0, H + 0.12, lz, 1.04, 0.1, 0.05));
        for (const lx of [-0.5, 0.5]) wall(hs, at(hs, lx, H + 0.12, 0, 0.05, 0.1, 1.15));
      }
      // A balcony with an iron railing on the upper floor.
      if (high && hs.kind === "two" && hr() < 0.65) {
        const y = H - 0.6;
        ledges.push(at(hs, 0.2, y, FRONT + 0.1, 0.5, 0.04, 0.22));
        openings.push(at(hs, 0.2, y + 0.2, FRONT, 0.18, 0.36, 0.06));
        rails.push(at(hs, 0.2, y + 0.17, FRONT + 0.2, 0.5, 0.02, 0.02));
        for (const du of [-0.24, 0.24])
          rails.push(at(hs, 0.2 + du, y + 0.17, FRONT + 0.1, 0.02, 0.02, 0.2));
        for (let p = 0; p < 5; p++)
          rails.push(at(hs, 0.2 - 0.24 + p * 0.12, y + 0.09, FRONT + 0.2, 0.015, 0.15, 0.015));
      }
      // Whitewashed outdoor stairs up the side wall to the upper floor or the roof.
      if (high && (hs.kind === "two" || hs.kind === "stack") && hr() < 0.55) {
        const rise = hs.kind === "two" ? H - 0.62 : H;
        const n = 5;
        const lx = hs.side * 0.61;
        for (let s = 0; s < n; s++) {
          const hi = (rise * (s + 1)) / n;
          wall(hs, at(hs, lx, hi / 2, 0.475 - s * 0.2, 0.22, hi, 0.2));
        }
        wall(
          hs,
          at(
            hs,
            hs.side * 0.71,
            rise / 2 + 0.05,
            -0.02,
            0.03,
            0.08,
            Math.hypot(1, rise),
            Math.atan2(rise, 1),
          ),
        );
      }
      // Chimneys on tiled roofs.
      const chim = !hs.dome && !hs.flat0 && rand() < 0.35;
      if (chim && !hs.flat) {
        dummy.position.set(hs.x + hs.w * 0.25, hs.y + hs.h + hs.w * 0.3, hs.z - hs.w * 0.2);
        dummy.rotation.set(0, hs.yaw, 0, "XYZ");
        dummy.scale.set(hs.w * 0.16, hs.w * 0.5, hs.w * 0.16);
        dummy.updateMatrix();
        chimneys.push(dummy.matrix.clone());
      }
      // Bougainvillea over the front wall and pots by the door.
      if (high && hr() < 0.3) {
        const u = hs.side * 0.38;
        leaves.push(at(hs, u, H * 0.62, FRONT + 0.06, 0.36, 0.5, 0.16));
        leafCol.push(blooms[Math.floor(hr() * blooms.length)]!);
        leaves.push(at(hs, u * 0.6, H * 0.9, FRONT + 0.05, 0.3, 0.2, 0.14));
        leafCol.push(blooms[Math.floor(hr() * blooms.length)]!);
        leaves.push(at(hs, u * 1.1, H * 0.3, FRONT + 0.05, 0.14, 0.6, 0.1));
        leafCol.push(greens[0]!);
      }
      if (high && hr() < 0.4) {
        for (const u of hr() < 0.5 ? [0.02] : [0.02, -0.46]) {
          pots.push(at(hs, u, 0.07, FRONT + 0.1, 0.1, 0.14, 0.1));
          leaves.push(at(hs, u, 0.2, FRONT + 0.1, 0.14, 0.13, 0.14));
          leafCol.push(hr() < 0.35 ? blooms[0]! : greens[Math.floor(hr() * greens.length)]!);
        }
      }
    }
    // Courtyards, roof terraces and solar heaters, on their own stream so the details above keep their draw order.
    const furniture: Matrix4[] = [];
    const panels: Matrix4[] = [];
    const tanks: Matrix4[] = [];
    {
      const yr = rng(6203);
      for (const hs of houses) {
        if (hs.dome) continue;
        const H = hs.h / hs.w;
        // A low whitewashed courtyard wall in front, open at the door.
        if (yr() < 0.3) {
          wall(hs, at(hs, 0.2, 0.09, FRONT + 0.42, 0.62, 0.18, 0.06));
          wall(hs, at(hs, 0.5, 0.09, FRONT + 0.21, 0.06, 0.18, 0.42));
        }
        if (!high || !hs.flat) continue;
        const roofY = H + 0.08;
        // A small table with two chairs on the terrace.
        if (yr() < 0.4) {
          const tx = -hs.side * 0.22;
          furniture.push(at(hs, tx, roofY + 0.12, 0.3, 0.16, 0.02, 0.16));
          furniture.push(at(hs, tx, roofY + 0.06, 0.3, 0.03, 0.12, 0.03));
          for (const d of [-1, 1]) {
            furniture.push(at(hs, tx + d * 0.15, roofY + 0.04, 0.3, 0.07, 0.08, 0.07));
            furniture.push(at(hs, tx + d * 0.185, roofY + 0.1, 0.3, 0.015, 0.12, 0.07));
          }
        }
        // A solar water heater: a tilted panel facing the sun with its tank on top.
        if (yr() < 0.35) {
          const sx = hs.side * 0.28;
          panels.push(at(hs, sx, roofY + 0.09, -0.3, 0.32, 0.02, 0.24, -0.6));
          panels.push(at(hs, sx, roofY + 0.04, -0.4, 0.3, 0.08, 0.02));
          tanks.push(at(hs, sx, roofY + 0.22, -0.4, 0.09, 0.32, 0.09));
        }
      }
    }
    dummy.rotation.set(0, 0, 0, "XYZ");
    const fill = (
      mats: Matrix4[],
      mat: Material,
      color?: Color | Color[],
      geo: BufferGeometry = unit,
    ) => {
      if (!mats.length) return;
      const m = new InstancedMesh(geo, mat, mats.length);
      mats.forEach((mx, i) => {
        m.setMatrixAt(i, mx);
        if (color) m.setColorAt(i, Array.isArray(color) ? color[i]! : color);
      });
      scene.add(m);
    };
    // At night only some windows are lit; the rest stay dark.
    {
      const lr = rng(8117);
      const lit: Matrix4[] = [];
      const dark: Matrix4[] = [];
      for (const m of openings) (lr() < 0.38 ? lit : dark).push(m);
      fill(lit, litWindowMat);
      fill(dark, windowMat);
    }
    fill(furniture, own(new MeshStandardMaterial({ color: "#8a6a4a", roughness: 0.8 })));
    fill(
      panels,
      own(new MeshStandardMaterial({ color: "#1f2f4a", roughness: 0.3, metalness: 0.5 })),
    );
    {
      const tankGeo = own(new CylinderGeometry(0.5, 0.5, 1, 8));
      tankGeo.rotateZ(Math.PI / 2);
      fill(
        tanks,
        own(new MeshStandardMaterial({ color: "#d9dcdf", roughness: 0.4, metalness: 0.6 })),
        undefined,
        tankGeo,
      );
    }
    fill(shutters, own(new MeshStandardMaterial({ color: "#2a64b8", roughness: 0.7 })));
    fill(chimneys, wallMat, walls[2]);
    fill(flatMats, wallMat, walls[0]);
    fill(masonry, wallMat, masonryCol);
    fill(ledges, wallMat, ledgeStone);
    fill(frames, own(new MeshStandardMaterial({ roughness: 0.6 })), frameCol);
    fill(
      rails,
      own(new MeshStandardMaterial({ color: "#2b3138", roughness: 0.5, metalness: 0.4 })),
    );
    {
      const potGeo = own(new CylinderGeometry(0.5, 0.36, 1, 7));
      fill(
        pots,
        own(new MeshStandardMaterial({ color: "#b4552e", roughness: 0.9 })),
        undefined,
        potGeo,
      );
      const leafGeo = own(new IcosahedronGeometry(0.5, 0));
      fill(
        leaves,
        own(new MeshStandardMaterial({ roughness: 0.95, flatShading: true })),
        leafCol,
        leafGeo,
      );
    }

    // A bell tower with a blue dome and a cross in every harbour village.
    const bell: Matrix4[] = [];
    const crosses: Matrix4[] = [];
    for (const t of TOWNS.slice(0, 4)) {
      const spot = scatter(1, t.x, t.z, t.r * 0.6, 0.02, 0.2)[0];
      if (!spot) continue;
      dummy.rotation.set(0, 0.3, 0);
      dummy.position.set(spot.x, spot.h + 0.05, spot.z);
      dummy.scale.set(0.03, 0.11, 0.03);
      dummy.updateMatrix();
      bell.push(dummy.matrix.clone());
      domeSpots.push({ x: spot.x, y: spot.h + 0.105, z: spot.z, r: 0.03 });
      dummy.position.set(spot.x, spot.h + 0.135, spot.z);
      dummy.scale.set(0.003, 0.03, 0.003);
      dummy.updateMatrix();
      crosses.push(dummy.matrix.clone());
      dummy.position.set(spot.x, spot.h + 0.14, spot.z);
      dummy.scale.set(0.016, 0.003, 0.003);
      dummy.updateMatrix();
      crosses.push(dummy.matrix.clone());
    }
    fill(bell, wallMat, walls[3]);
    fill(
      crosses,
      own(new MeshStandardMaterial({ color: "#e7c76a", roughness: 0.4, metalness: 0.5 })),
    );

    // Dry-stone walls holding terraces on the slopes around the villages.
    {
      const N = high ? 220 : 90;
      const sw: Matrix4[] = [];
      let tries = 0;
      while (sw.length < N && tries++ < N * 30) {
        const t = TOWNS[Math.floor(rand() * TOWNS.length)]!;
        const a = rand() * TAU;
        const d = t.r * (1 + rand() * 0.9);
        const x = t.x + Math.cos(a) * d;
        const z = t.z + Math.sin(a) * d * 0.8;
        const h = heightAt(x, z);
        if (h < 0.04 || h > 0.45) continue;
        const [gx, gz] = gradient(x, z);
        if (Math.hypot(gx, gz) < 0.004) continue;
        dummy.position.set(x, h + 0.002, z);
        dummy.rotation.set(0, Math.atan2(gx, gz) + Math.PI / 2, 0);
        dummy.scale.set(0.008, 0.012, 0.16 + rand() * 0.14);
        dummy.updateMatrix();
        sw.push(dummy.matrix.clone());
      }
      fill(sw, own(new MeshStandardMaterial({ color: "#b3a58a", roughness: 1 })));
    }
  }

  // Athens: flat-roofed blocks packed along the northern coast.
  {
    const count = high ? 1500 : 800;
    const blocks = new InstancedMesh(own(new BoxGeometry(1, 1, 1)), wallMat, count);
    let i = 0;
    let tries = 0;
    const tone = ["#e8e2d4", "#d9d2c3", "#f1ece1", "#cfc7b8", "#e2d8c4"].map((c) => new Color(c));
    while (i < count && tries++ < count * 60) {
      const x = 2.8 + rand() * 14;
      const z = -17.6 + 0.55 * Math.max(0, x - 4) + 0.5 - rand() * 2.6;
      const h = heightAt(x, z);
      if (h < 0.015 || h > 0.2) continue;
      const w = 0.045 + rand() * 0.05;
      const bh = 0.035 + rand() * rand() * 0.1;
      dummy.position.set(x, h + bh / 2 - 0.004, z);
      dummy.rotation.set(0, -0.32 + (rand() - 0.5) * 0.12, 0);
      dummy.scale.set(w, bh, w * (0.8 + rand() * 0.5));
      dummy.updateMatrix();
      blocks.setMatrixAt(i, dummy.matrix);
      blocks.setColorAt(i, tone[Math.floor(rand() * tone.length)]!);
      i++;
    }
    blocks.count = i;
    scene.add(blocks);
  }

  // Trees: pines on the hills, a few tall cypresses by the towns.
  {
    const count = high ? 3400 : 1300;
    const pineGeo = own(new ConeGeometry(0.03, 0.14, 6));
    pineGeo.translate(0, 0.07, 0);
    const pineMat = own(new MeshStandardMaterial({ roughness: 0.95 }));
    const pines = new InstancedMesh(pineGeo, pineMat, count);
    const greens = ["#3c5f34", "#456b38", "#355a30", "#527a3e", "#2f5230"].map((c) => new Color(c));
    let i = 0;
    let tries = 0;
    while (i < count && tries++ < count * 25) {
      const x = DOMAIN.x0 + 1 + rand() * (W - 2);
      const z = DOMAIN.z0 + 1 + rand() * (D - 2);
      const h = heightAt(x, z);
      if (h < 0.035 || h > 0.62) continue;
      if (fbm(x * 2.6, z * 2.6) < 0.4 + smooth(0.3, 0.6, h) * 0.2) continue;
      if (TOWNS.some((t) => Math.hypot(x - t.x, z - t.z) < t.r * 0.8 && rand() < 0.85)) continue;
      const s = 0.7 + rand() * 0.9;
      dummy.position.set(x, h - 0.01, z);
      dummy.rotation.set(0, rand() * TAU, 0);
      dummy.scale.set(s, s * (0.85 + rand() * 0.5), s);
      dummy.updateMatrix();
      pines.setMatrixAt(i, dummy.matrix);
      pines.setColorAt(i, greens[Math.floor(rand() * greens.length)]!);
      i++;
    }
    pines.count = i;
    scene.add(pines);

    const cy = high ? 160 : 60;
    const cypGeo = own(new ConeGeometry(0.014, 0.12, 5));
    cypGeo.translate(0, 0.06, 0);
    const cyp = new InstancedMesh(cypGeo, pineMat, cy);
    let j = 0;
    tries = 0;
    while (j < cy && tries++ < cy * 60) {
      const t = TOWNS[Math.floor(rand() * TOWNS.length)]!;
      const a = rand() * TAU;
      const d = Math.sqrt(rand()) * t.r * 1.2;
      const x = t.x + Math.cos(a) * d;
      const z = t.z + Math.sin(a) * d * 0.8;
      const h = heightAt(x, z);
      if (h < 0.02 || h > 0.4) continue;
      dummy.position.set(x, h - 0.005, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(0.8 + rand() * 0.7);
      dummy.updateMatrix();
      cyp.setMatrixAt(j, dummy.matrix);
      cyp.setColorAt(j, new Color("#3b6b3c"));
      j++;
    }
    cyp.count = j;
    scene.add(cyp);
  }

  // Temples: the Parthenon on its rock and the Temple of Aphaia on Aegina.
  const stone = own(
    new MeshStandardMaterial({
      color: "#f0e6d0",
      roughness: 0.8,
      emissive: new Color("#ffcf8a"),
      emissiveIntensity: 0,
    }),
  );
  function temple(x: number, z: number, scale: number, cols: number): Group {
    const g = new Group();
    const len = 0.22;
    const wid = 0.12;
    const base = new Mesh(own(new BoxGeometry(len, 0.012, wid)), stone);
    base.position.y = 0.006;
    const base2 = new Mesh(own(new BoxGeometry(len * 0.95, 0.008, wid * 0.92)), stone);
    base2.position.y = 0.016;
    const roof = new Mesh(own(new BoxGeometry(len * 0.97, 0.012, wid * 0.94)), stone);
    roof.position.y = 0.075;
    const colGeo = own(new CylinderGeometry(0.0045, 0.0055, 0.052, 8));
    const colMesh = new InstancedMesh(colGeo, stone, cols * 2);
    let k = 0;
    for (let side = 0; side < 2; side++)
      for (let i = 0; i < cols; i++) {
        dummy.position.set(
          -len * 0.44 + (i / (cols - 1)) * len * 0.88,
          0.046,
          (side ? 1 : -1) * wid * 0.42,
        );
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        colMesh.setMatrixAt(k++, dummy.matrix);
      }
    const ped = new Mesh(own(new ConeGeometry(wid * 0.55, 0.03, 3)), stone);
    ped.rotation.set(Math.PI / 2, 0, Math.PI / 2);
    ped.scale.set(1, 0.4, 1);
    ped.position.set(len * 0.48, 0.09, 0);
    g.add(base, base2, colMesh, roof);
    g.position.set(x, heightAt(x, z) - 0.004, z);
    g.rotation.y = 0.3;
    g.scale.setScalar(scale);
    scene.add(g);
    return g;
  }
  temple(5.2, -17.4, 1.5, 8);
  temple(1.0, -5.7, 1.1, 6);

  // Moored boats in the harbours.
  {
    const hullGeo = own(new CapsuleGeometry(0.014, 0.07, 3, 8));
    hullGeo.rotateX(Math.PI / 2);
    const sailGeo = own(new ConeGeometry(0.02, 0.1, 3));
    sailGeo.translate(0, 0.07, 0);
    const hullMat = own(new MeshStandardMaterial({ roughness: 0.6 }));
    const sailMat = own(
      new MeshStandardMaterial({ color: "#f6f2e8", roughness: 0.8, side: DoubleSide }),
    );
    const N = high ? 36 : 16;
    const hulls = new InstancedMesh(hullGeo, hullMat, N);
    const sails = new InstancedMesh(sailGeo, sailMat, N);
    const tones = ["#f3f3f3", "#2d5fa8", "#c8452e", "#f0c84a", "#e9e9e9"].map((c) => new Color(c));
    let n = 0;
    let tries = 0;
    while (n < N && tries++ < N * 80) {
      const st = STOPS[Math.floor(rand() * STOPS.length)]!;
      const x = st.x + (rand() - 0.5) * 1.8;
      const z = st.z + (rand() - 0.5) * 1.8;
      if (heightAt(x, z) > -0.04) continue;
      if (Math.hypot(x - st.x, z - st.z) < 0.9) continue;
      dummy.position.set(x, 0.008, z);
      dummy.rotation.set(0, rand() * TAU, 0);
      dummy.scale.setScalar(0.5 + rand() * 0.35);
      dummy.updateMatrix();
      hulls.setMatrixAt(n, dummy.matrix);
      hulls.setColorAt(n, tones[Math.floor(rand() * tones.length)]!);
      sails.setMatrixAt(n, dummy.matrix);
      n++;
    }
    hulls.count = sails.count = n;
    scene.add(hulls, sails);
  }

  // ---------------------------------------------------------------- island detail
  // Everything here is instanced: one draw call per kind of thing, whatever the count.
  /** Walk from (ax, az) toward (bx, bz) and return the last point on land, with the walk direction. */
  const coastToward = (ax: number, az: number, bx: number, bz: number) => {
    const len = Math.hypot(bx - ax, bz - az);
    const dx = (bx - ax) / len;
    const dz = (bz - az) / len;
    let x = ax;
    let z = az;
    for (let d = 0; d < len; d += 0.015) {
      const nx2 = ax + dx * d;
      const nz2 = az + dz * d;
      if (heightAt(nx2, nz2) < 0) break;
      x = nx2;
      z = nz2;
    }
    return { x, z, dx, dz };
  };
  function scatter(
    n: number,
    cx: number,
    cz: number,
    r: number,
    hMin: number,
    hMax: number,
    away: { x: number; z: number; r: number }[] = [],
  ) {
    const out: { x: number; z: number; h: number }[] = [];
    let tries = 0;
    while (out.length < n && tries++ < n * 200) {
      const a = rand() * TAU;
      const d = Math.sqrt(rand()) * r;
      const x = cx + Math.cos(a) * d;
      const z = cz + Math.sin(a) * d;
      const h = heightAt(x, z);
      if (h < hMin || h > hMax) continue;
      if (away.some((p) => Math.hypot(x - p.x, z - p.z) < p.r)) continue;
      if (out.some((p) => Math.hypot(x - p.x, z - p.z) < 0.12)) continue;
      out.push({ x, z, h });
    }
    return out;
  }
  const isle = (id: string) => ISLES.find((i) => i.id === id)!;

  // Harbours: a quay along the shore and piers reaching out toward each anchorage.
  {
    const quayMat = own(new MeshStandardMaterial({ color: "#d9cdb4", roughness: 0.9 }));
    const piers: { x: number; z: number; yaw: number; len: number; w: number }[] = [];
    const harbour = (fromX: number, fromZ: number, toX: number, toZ: number, count: number) => {
      const c = coastToward(fromX, fromZ, toX, toZ);
      const yaw = Math.atan2(c.dx, c.dz);
      // Quay along the shore.
      piers.push({
        x: c.x - c.dx * 0.03,
        z: c.z - c.dz * 0.03,
        yaw: yaw + Math.PI / 2,
        len: 0.55,
        w: 0.07,
      });
      for (let k = 0; k < count; k++) {
        const side = (k - (count - 1) / 2) * 0.16;
        const len = 0.24 + (k % 2) * 0.08;
        piers.push({
          x: c.x + c.dx * len * 0.5 + c.dz * side,
          z: c.z + c.dz * len * 0.5 - c.dx * side,
          yaw,
          len,
          w: 0.03,
        });
      }
    };
    harbour(-2.45, -7.1, -2.6, -8.1, 2); // Aegina town
    harbour(-1.45, 7.55, -0.25, 6.3, 2); // Poros
    harbour(-0.8, 15.6, -0.6, 14.4, 3); // Hydra
    harbour(-3.1, 2.3, -1.9, 2.6, 1); // Methana
    harbour(9.0, -15.2, 9.0, -13.7, 4); // Alimos marina
    harbour(-6.7, -2.2, -5.15, -2.0, 1); // Moni
    const mesh = new InstancedMesh(own(new BoxGeometry(1, 1, 1)), quayMat, piers.length);
    piers.forEach((p, i) => {
      dummy.position.set(p.x, 0.006, p.z);
      dummy.rotation.set(0, p.yaw, 0);
      dummy.scale.set(p.w, 0.014, p.len);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    scene.add(mesh);
  }

  // Lighthouses on the capes: white towers with a red band and a lamp that glows at night.
  const lampMat = own(new MeshBasicMaterial({ color: "#fff2c0", fog: false }));
  {
    const capes: [string, number][] = [
      ["aegina", 2.6],
      ["aegina", -0.9],
      ["poros", 0.4],
      ["hydra", 0.2],
      ["hydra", Math.PI + 0.3],
      ["methana", 2.2],
      ["salamis", 2.0],
      ["agistri", -1.2],
      ["moni", 0.8],
    ];
    const spots = capes.map(([id, a]) => {
      const i = isle(id);
      return coastToward(i.x, i.z, i.x + Math.cos(a + i.rot) * 9, i.z + Math.sin(a + i.rot) * 9);
    });
    const towerGeo = own(new CylinderGeometry(0.008, 0.012, 0.09, 8));
    towerGeo.translate(0, 0.045, 0);
    const bandGeo = own(new CylinderGeometry(0.0095, 0.0105, 0.014, 8));
    const lampGeo = own(new SphereGeometry(0.009, 8, 6));
    const towerMat = own(new MeshStandardMaterial({ color: "#fbf8f1", roughness: 0.6 }));
    const bandMat = own(new MeshStandardMaterial({ color: "#c8452e", roughness: 0.6 }));
    const towers = new InstancedMesh(towerGeo, towerMat, spots.length);
    const bands = new InstancedMesh(bandGeo, bandMat, spots.length);
    const lamps = new InstancedMesh(lampGeo, lampMat, spots.length);
    spots.forEach((p, i) => {
      const y = Math.max(0, heightAt(p.x, p.z)) - 0.004;
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.position.set(p.x, y, p.z);
      dummy.updateMatrix();
      towers.setMatrixAt(i, dummy.matrix);
      dummy.position.set(p.x, y + 0.06, p.z);
      dummy.updateMatrix();
      bands.setMatrixAt(i, dummy.matrix);
      dummy.position.set(p.x, y + 0.098, p.z);
      dummy.updateMatrix();
      lamps.setMatrixAt(i, dummy.matrix);
    });
    scene.add(towers, bands, lamps);
  }

  // Windmills: a row on the ridge above Hydra town, a few on Poros and Aegina. Their sails turn.
  const mills = [
    ...scatter(high ? 7 : 4, -1.2, 16.2, 2.2, 0.14, 0.55),
    ...scatter(high ? 3 : 2, -1.8, 8.2, 0.9, 0.08, 0.3),
    ...scatter(high ? 3 : 1, -1.0, -5.6, 2.0, 0.1, 0.4),
  ]
    .map((m) => ({ ...m, yaw: rand() * TAU, spin: rand() * TAU }))
    // The hub position never changes; only the blade rotation is updated per frame.
    .map((m) => ({
      ...m,
      hx: m.x + Math.sin(m.yaw) * 0.018,
      hy: m.h + 0.036,
      hz: m.z + Math.cos(m.yaw) * 0.018,
    }));
  const BLADES = 4;
  const millBlades = new InstancedMesh(
    (() => {
      const g = own(new BoxGeometry(0.006, 0.05, 0.0015));
      g.translate(0, 0.025, 0);
      return g;
    })(),
    own(new MeshStandardMaterial({ color: "#f3ead8", roughness: 0.8, side: DoubleSide })),
    mills.length * BLADES,
  );
  {
    const bodyGeo = own(new CylinderGeometry(0.014, 0.017, 0.045, 10));
    bodyGeo.translate(0, 0.0225, 0);
    const capGeo = own(new ConeGeometry(0.017, 0.022, 10));
    const bodies = new InstancedMesh(bodyGeo, wallMat, mills.length);
    const caps = new InstancedMesh(capGeo, roofMat, mills.length);
    mills.forEach((m, i) => {
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.position.set(m.x, m.h - 0.004, m.z);
      dummy.updateMatrix();
      bodies.setMatrixAt(i, dummy.matrix);
      bodies.setColorAt(i, walls[0]!);
      dummy.position.set(m.x, m.h + 0.051, m.z);
      dummy.updateMatrix();
      caps.setMatrixAt(i, dummy.matrix);
      caps.setColorAt(i, new Color("#8a5a3a"));
    });
    scene.add(bodies, caps, millBlades);
  }
  const placeMillBlades = (time: number) => {
    dummy.scale.setScalar(1);
    for (let i = 0; i < mills.length; i++) {
      const m = mills[i]!;
      dummy.position.set(m.hx, m.hy, m.hz);
      for (let k = 0; k < BLADES; k++) {
        dummy.rotation.set(0, m.yaw, m.spin + time * 0.8 + (k * TAU) / BLADES);
        dummy.updateMatrix();
        millBlades.setMatrixAt(i * BLADES + k, dummy.matrix);
      }
    }
    millBlades.instanceMatrix.needsUpdate = true;
  };
  placeMillBlades(0);

  // Chapels with blue domes on the hillsides, and a monastery high on Hydra.
  {
    const towns = TOWNS.map((t) => ({ x: t.x, z: t.z, r: t.r }));
    const chapels = [
      ...scatter(high ? 5 : 3, -1.3, 16.6, 3.4, 0.1, 0.7, towns),
      ...scatter(high ? 4 : 2, -0.5, -5, 2.6, 0.08, 0.5, towns),
      ...scatter(high ? 3 : 2, -1.75, 8.3, 1.2, 0.06, 0.3, towns),
      ...scatter(high ? 3 : 1, -6.0, 2.8, 2.6, 0.06, 0.4, towns),
      ...scatter(1, -4.6, -7.6, 0.6, 0.03, 0.3),
    ].map((c) => ({ ...c, s: 0.03 }));
    const mon = scatter(1, -1.6, 16.9, 1.2, 0.55, 0.95)[0];
    if (mon) chapels.push({ ...mon, s: 0.06 });
    const bodies = new InstancedMesh(wallGeo, wallMat, chapels.length + (mon ? 2 : 0));
    chapels.forEach((c, i) => {
      dummy.position.set(c.x, c.h + c.s * 0.4 - 0.004, c.z);
      dummy.rotation.set(0, rand() * TAU, 0);
      dummy.scale.set(c.s, c.s * 0.8, c.s * 1.2);
      dummy.updateMatrix();
      bodies.setMatrixAt(i, dummy.matrix);
      bodies.setColorAt(i, walls[3]!);
      domeSpots.push({ x: c.x, y: c.h + c.s * 0.8 - 0.004, z: c.z, r: c.s * 0.8 });
    });
    if (mon) {
      // The monastery's walled courtyard and a bell tower.
      const yaw = 0.4;
      dummy.position.set(mon.x + 0.07, mon.h + 0.01, mon.z + 0.02);
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.set(0.16, 0.03, 0.12);
      dummy.updateMatrix();
      bodies.setMatrixAt(chapels.length, dummy.matrix);
      bodies.setColorAt(chapels.length, stones[2]!);
      dummy.position.set(mon.x - 0.05, mon.h + 0.04, mon.z - 0.04);
      dummy.scale.set(0.022, 0.09, 0.022);
      dummy.updateMatrix();
      bodies.setMatrixAt(chapels.length + 1, dummy.matrix);
      bodies.setColorAt(chapels.length + 1, walls[0]!);
    }
    scene.add(bodies);
    const domes = new InstancedMesh(domeGeo, domeMat, domeSpots.length);
    domeSpots.forEach((d, i) => {
      dummy.position.set(d.x, d.y, d.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(d.r);
      dummy.updateMatrix();
      domes.setMatrixAt(i, dummy.matrix);
    });
    scene.add(domes);
  }

  // Olive groves: rows of round grey-green trees on the low, gentle slopes.
  {
    const max = high ? 900 : 300;
    const oliveGeo = own(new SphereGeometry(0.016, 6, 4));
    oliveGeo.scale(1, 0.8, 1);
    oliveGeo.translate(0, 0.014, 0);
    const olives = new InstancedMesh(
      oliveGeo,
      own(new MeshStandardMaterial({ roughness: 0.95 })),
      max,
    );
    const tones = ["#7d8a5a", "#8a9566", "#6f7d52"].map((c) => new Color(c));
    let n = 0;
    let tries = 0;
    while (n < max && tries++ < 4000) {
      const cx = DOMAIN.x0 + 2 + rand() * (W - 4);
      const cz = DOMAIN.z0 + 2 + rand() * (D - 4);
      const h0 = heightAt(cx, cz);
      if (h0 < 0.03 || h0 > 0.2) continue;
      const yaw = rand() * Math.PI;
      const ca = Math.cos(yaw);
      const sa = Math.sin(yaw);
      for (let r = 0; r < 5 && n < max; r++)
        for (let c = 0; c < 7 && n < max; c++) {
          const u = (c - 3) * 0.05;
          const v = (r - 2) * 0.05;
          const x = cx + u * ca - v * sa;
          const z = cz + u * sa + v * ca;
          const h = heightAt(x, z);
          if (h < 0.025 || h > 0.24) continue;
          if (TOWNS.some((t) => Math.hypot(x - t.x, z - t.z) < t.r * 0.7)) continue;
          dummy.position.set(x, h - 0.006, z);
          dummy.rotation.set(0, rand() * TAU, 0);
          dummy.scale.setScalar(0.75 + rand() * 0.5);
          dummy.updateMatrix();
          olives.setMatrixAt(n, dummy.matrix);
          olives.setColorAt(n, tones[Math.floor(rand() * tones.length)]!);
          n++;
        }
    }
    olives.count = n;
    scene.add(olives);
  }

  // ---------------------------------------------------------------- shore and village life
  // Its own random stream, so adding these never moves anything placed above.
  {
    const dr = rng(90517);
    const put = (
      list: Matrix4[],
      x: number,
      y: number,
      z: number,
      yaw: number,
      sx: number,
      sy = sx,
      sz = sx,
      pitch = 0,
      roll = 0,
    ) => {
      dummy.position.set(x, y, z);
      dummy.rotation.set(pitch, yaw, roll);
      dummy.scale.set(sx, sy, sz);
      dummy.updateMatrix();
      list.push(dummy.matrix.clone());
    };
    const add = (geo: BufferGeometry, mat: Material, mats: Matrix4[], cols?: Color[]) => {
      if (!mats.length) return;
      const m = new InstancedMesh(geo, mat, mats.length);
      mats.forEach((mx, i) => {
        m.setMatrixAt(i, mx);
        if (cols) m.setColorAt(i, cols[i % cols.length]!);
      });
      scene.add(m);
    };
    /** Seaward direction at a land point (toward the lowest neighbour), or null if not on the shore. */
    const seaward = (x: number, z: number, reach: number) => {
      let best = 0;
      let bx = 0;
      let bz = 0;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU;
        const h = heightAt(x + Math.cos(a) * reach, z + Math.sin(a) * reach);
        if (h < best) {
          best = h;
          bx = Math.cos(a);
          bz = Math.sin(a);
        }
      }
      return best < 0 ? { dx: bx, dz: bz } : null;
    };
    const nearTown = (x: number, z: number, f: number) =>
      TOWNS.some((t) => Math.hypot(x - t.x, z - t.z) < t.r * f);
    const inDomain = () => ({
      x: DOMAIN.x0 + 1 + dr() * (W - 2),
      z: DOMAIN.z0 + 1 + dr() * (D - 2),
    });
    const methana = (x: number, z: number) => Math.hypot(x + 5.4, z - 2.9) < 1.4;

    // Boulders and rocky outcrops along the shores; dark lava rock around the Methana crater.
    {
      const N = high ? 900 : 320;
      const geo = own(new IcosahedronGeometry(0.5, 0));
      const mats: Matrix4[] = [];
      const cols: Color[] = [];
      const pale = ["#b9ad98", "#a89c88", "#c7bca8", "#968a78"].map((c) => new Color(c));
      const lava = ["#3b3532", "#4a403a", "#2e2a28", "#5a4a40"].map((c) => new Color(c));
      let tries = 0;
      while (mats.length < N && tries++ < N * 60) {
        const p = inDomain();
        const h = heightAt(p.x, p.z);
        const volcanic = methana(p.x, p.z);
        if (h < -0.004 || h > (volcanic ? 0.5 : 0.05)) continue;
        if (!volcanic && !seaward(p.x, p.z, 0.05)) continue;
        if (nearTown(p.x, p.z, 0.6)) continue;
        // A small cluster: one big rock with a couple of smaller ones around it.
        const n = 1 + Math.floor(dr() * 3);
        for (let k = 0; k < n && mats.length < N; k++) {
          const s = k === 0 ? 0.018 + dr() * 0.022 : 0.008 + dr() * 0.01;
          const x = p.x + (k ? (dr() - 0.5) * 0.05 : 0);
          const z = p.z + (k ? (dr() - 0.5) * 0.05 : 0);
          const y = Math.max(heightAt(x, z), -0.006) + s * 0.15;
          put(
            mats,
            x,
            y,
            z,
            dr() * TAU,
            s,
            s * (0.5 + dr() * 0.4),
            s * (0.7 + dr() * 0.5),
            dr() * 0.4,
            dr() * 0.4,
          );
          const set = volcanic ? lava : pale;
          cols.push(set[Math.floor(dr() * set.length)]!);
        }
      }
      add(geo, own(new MeshStandardMaterial({ roughness: 1, flatShading: true })), mats, cols);
    }

    // Maquis: low dark shrubs on the dry slopes (mastic, kermes oak, broom in flower).
    {
      const N = high ? 1600 : 520;
      const geo = own(new IcosahedronGeometry(0.5, 0));
      geo.translate(0, 0.35, 0);
      const mats: Matrix4[] = [];
      const cols: Color[] = [];
      const tones = ["#4f5d33", "#5d6b3a", "#46522e", "#6b7440", "#b9a23a"].map(
        (c) => new Color(c),
      );
      let tries = 0;
      while (mats.length < N && tries++ < N * 20) {
        const p = inDomain();
        const h = heightAt(p.x, p.z);
        if (h < 0.03 || h > 0.7 || nearTown(p.x, p.z, 0.8) || methana(p.x, p.z)) continue;
        const n = 2 + Math.floor(dr() * 4);
        for (let k = 0; k < n && mats.length < N; k++) {
          const x = p.x + (dr() - 0.5) * 0.08;
          const z = p.z + (dr() - 0.5) * 0.08;
          const hh = heightAt(x, z);
          if (hh < 0.02) continue;
          const s = 0.008 + dr() * 0.01;
          put(mats, x, hh - 0.003, z, dr() * TAU, s * 1.3, s, s * 1.1);
          cols.push(tones[dr() < 0.06 ? 4 : Math.floor(dr() * 4)]!);
        }
      }
      add(geo, own(new MeshStandardMaterial({ roughness: 1, flatShading: true })), mats, cols);
    }

    // Aegina pistachio orchards: neat rows of small, spreading trees on the island's west plain.
    {
      const N = high ? 420 : 140;
      const geo = own(new IcosahedronGeometry(0.5, 1));
      geo.scale(1, 0.7, 1);
      geo.translate(0, 0.55, 0);
      const mats: Matrix4[] = [];
      const cols: Color[] = [];
      const tones = ["#77843f", "#6c7a3a", "#86904a", "#8f7a45"].map((c) => new Color(c));
      let tries = 0;
      while (mats.length < N && tries++ < 300) {
        const cx = -2.2 + (dr() - 0.5) * 3.2;
        const cz = -5.4 + (dr() - 0.5) * 3.0;
        const h0 = heightAt(cx, cz);
        if (h0 < 0.03 || h0 > 0.22 || nearTown(cx, cz, 1)) continue;
        const yaw = 0.3 + (dr() - 0.5) * 0.3;
        const ca = Math.cos(yaw);
        const sa = Math.sin(yaw);
        for (let r = 0; r < 4; r++)
          for (let c = 0; c < 6 && mats.length < N; c++) {
            const u = (c - 2.5) * 0.04;
            const v = (r - 1.5) * 0.04;
            const x = cx + u * ca - v * sa;
            const z = cz + u * sa + v * ca;
            const h = heightAt(x, z);
            if (h < 0.025 || h > 0.25) continue;
            put(mats, x, h - 0.004, z, dr() * TAU, 0.016 + dr() * 0.006);
            cols.push(tones[Math.floor(dr() * tones.length)]!);
          }
      }
      add(geo, own(new MeshStandardMaterial({ roughness: 0.95, flatShading: true })), mats, cols);
    }

    // Beaches: pale sand strips in the gentle coves.
    type Beach = { x: number; z: number; dx: number; dz: number; len: number };
    const beaches: Beach[] = [];
    {
      const N = high ? 34 : 16;
      let tries = 0;
      while (beaches.length < N && tries++ < 6000) {
        const p = inDomain();
        const h = heightAt(p.x, p.z);
        if (h < 0.001 || h > 0.012) continue;
        const s = seaward(p.x, p.z, 0.06);
        if (!s || methana(p.x, p.z) || nearTown(p.x, p.z, 0.9)) continue;
        // Gentle: the land a little inland rises slowly.
        if (heightAt(p.x - s.dx * 0.12, p.z - s.dz * 0.12) > 0.06) continue;
        if (beaches.some((b) => Math.hypot(b.x - p.x, b.z - p.z) < 0.6)) continue;
        beaches.push({ ...p, ...s, len: 0.14 + dr() * 0.14 });
      }
      const geo = own(new CylinderGeometry(0.5, 0.5, 1, 14));
      const mats: Matrix4[] = [];
      // Local z faces the sea, so the long axis (x) runs along the shore.
      for (const b of beaches)
        put(mats, b.x, 0.003, b.z, Math.atan2(b.dx, b.dz), b.len, 0.008, 0.07);
      add(geo, own(new MeshStandardMaterial({ color: "#e9dcb8", roughness: 1 })), mats);
    }

    // The harbours (same spots as the quays above).
    const harbours = [
      coastToward(-2.45, -7.1, -2.6, -8.1),
      coastToward(-1.45, 7.55, -0.25, 6.3),
      coastToward(-0.8, 15.6, -0.6, 14.4),
      coastToward(-3.1, 2.3, -1.9, 2.6),
      coastToward(9.0, -15.2, 9.0, -13.7),
      coastToward(-6.7, -2.2, -5.15, -2.0),
    ];
    const hydra = harbours[2]!;
    const poros = harbours[1]!;

    // Harbour street lamps along every quay: iron posts with lanterns that glow at night.
    {
      const per = high ? 9 : 4;
      const posts: Matrix4[] = [];
      const heads: Matrix4[] = [];
      for (const c of harbours)
        for (let k = 0; k < per; k++) {
          const t = (k / (per - 1) - 0.5) * 0.5;
          const x = c.x - c.dx * 0.06 + c.dz * t;
          const z = c.z - c.dz * 0.06 - c.dx * t;
          const y = Math.max(0.012, heightAt(x, z));
          put(posts, x, y, z, 0, 1);
          put(heads, x, y + 0.026, z, 0, 1);
        }
      const postGeo = own(new CylinderGeometry(0.0012, 0.0018, 0.026, 5));
      postGeo.translate(0, 0.013, 0);
      add(
        postGeo,
        own(
          new MeshStandardMaterial({
            color: "#2b3138",
            roughness: 0.5,
            metalness: 0.5,
          }),
        ),
        posts,
      );
      add(own(new SphereGeometry(0.0034, 6, 4)), lampMat, heads);
    }

    // Poros: the clock tower on the hill above the town, with a red tiled cap and glowing dials.
    {
      const x = poros.x - poros.dx * 0.35;
      const z = poros.z - poros.dz * 0.35;
      const h = Math.max(0, heightAt(x, z));
      const body: Matrix4[] = [];
      put(body, x, h + 0.03, z, 0.3, 0.018, 0.06, 0.018 / 1.15);
      add(wallGeo, wallMat, body, [walls[0]!]);
      const cap: Matrix4[] = [];
      put(cap, x, h + 0.068, z, 0.3 + Math.PI / 4, 0.018, 0.035, 0.018);
      add(roofGeo, roofMat, cap, [roofs[0]!]);
      const face: Matrix4[] = [];
      for (let k = 0; k < 4; k++) {
        const a = 0.3 + (k * Math.PI) / 2;
        put(
          face,
          x + Math.sin(a) * 0.0092,
          h + 0.05,
          z + Math.cos(a) * 0.0092,
          a,
          1,
          1,
          1,
          Math.PI / 2,
        );
      }
      add(own(new CylinderGeometry(0.005, 0.005, 0.0008, 12)), lampMat, face);
    }

    if (high) {
      // Umbrellas and sunbeds in pairs on the beaches; caiques pulled up at the ends.
      const poles: Matrix4[] = [];
      const tops: Matrix4[] = [];
      const topCols: Color[] = [];
      const beds: Matrix4[] = [];
      const canopy = ["#d8c08a", "#2a64b8", "#f2efe6", "#c8452e"].map((c) => new Color(c));
      const hullsM: Matrix4[] = [];
      const hullCols: Color[] = [];
      const cabins: Matrix4[] = [];
      const hullTones = ["#2a64b8", "#f4f1ea", "#c8452e", "#2f8a6a", "#e2b33c"].map(
        (c) => new Color(c),
      );
      for (const b of beaches) {
        const yaw = Math.atan2(b.dx, b.dz);
        const tx = b.dz;
        const tz = -b.dx;
        const n = Math.floor(b.len / 0.035);
        const straw = dr() < 0.5;
        for (let k = 0; k < n; k++) {
          const t = (k / Math.max(1, n - 1) - 0.5) * b.len * 0.75;
          const x = b.x + tx * t - b.dx * 0.012;
          const z = b.z + tz * t - b.dz * 0.012;
          const y = 0.007;
          put(poles, x, y, z, 0, 1);
          put(tops, x, y + 0.016, z, dr() * TAU, 1);
          topCols.push(straw ? canopy[0]! : canopy[1 + (k % 3)]!);
          for (const side of [-1, 1])
            put(
              beds,
              x + tx * side * 0.006 + b.dx * 0.006,
              y + 0.0012,
              z + tz * side * 0.006 + b.dz * 0.006,
              yaw,
              0.0045,
              0.0014,
              0.011,
            );
        }
        const boats = dr() < 0.6 ? 1 + Math.floor(dr() * 2) : 0;
        for (let k = 0; k < boats; k++) {
          const t = (0.48 + k * 0.08) * b.len * (dr() < 0.5 ? -1 : 1);
          const x = b.x + tx * t + b.dx * 0.004;
          const z = b.z + tz * t + b.dz * 0.004;
          const by = yaw + (dr() - 0.5) * 0.5;
          put(hullsM, x, 0.006, z, by, 1, 1, 1, 0, (dr() - 0.5) * 0.25);
          hullCols.push(hullTones[Math.floor(dr() * hullTones.length)]!);
          put(cabins, x, 0.009, z, by, 1);
        }
      }
      // Caiques also tie up inside each harbour, stern to the quay.
      for (const c of harbours)
        for (let k = 0; k < 4; k++) {
          const t = (k - 1.5) * 0.05 + 0.13;
          const x = c.x + c.dx * 0.03 + c.dz * t;
          const z = c.z + c.dz * 0.03 - c.dx * t;
          if (heightAt(x, z) > -0.01) continue;
          const yaw = Math.atan2(c.dx, c.dz);
          put(hullsM, x, 0.004, z, yaw, 1);
          hullCols.push(hullTones[k % hullTones.length]!);
          put(cabins, x, 0.007, z, yaw, 1);
        }
      const poleGeo = own(new CylinderGeometry(0.0006, 0.0006, 0.017, 4));
      poleGeo.translate(0, 0.0085, 0);
      add(poleGeo, own(new MeshStandardMaterial({ color: "#8a6a48", roughness: 0.9 })), poles);
      add(
        own(new ConeGeometry(0.009, 0.005, 8)),
        own(new MeshStandardMaterial({ roughness: 0.9, flatShading: true })),
        tops,
        topCols,
      );
      add(
        own(new BoxGeometry(1, 1, 1)),
        own(new MeshStandardMaterial({ color: "#f6f2e8", roughness: 0.8 })),
        beds,
      );
      // Caique: a beamy double-ended hull, shallow and long, with a small white wheelhouse aft.
      const hullGeo = own(new CapsuleGeometry(0.0055, 0.022, 3, 8));
      hullGeo.rotateX(Math.PI / 2);
      hullGeo.scale(1, 0.55, 1);
      add(hullGeo, own(new MeshStandardMaterial({ roughness: 0.6 })), hullsM, hullCols);
      const cabGeo = own(new BoxGeometry(0.006, 0.005, 0.008));
      cabGeo.translate(0, 0.0025, -0.005);
      add(cabGeo, own(new MeshStandardMaterial({ color: "#fbf8f1", roughness: 0.7 })), cabins);

      // Tavernas on the waterfronts: timber pergolas with reed shade and blue tables under them.
      {
        const pergs: Matrix4[] = [];
        const tables: Matrix4[] = [];
        for (const c of harbours)
          for (let k = 0; k < 3; k++) {
            const t = (k - 1) * 0.13 + (dr() - 0.5) * 0.03;
            const x = c.x - c.dx * 0.11 + c.dz * t;
            const z = c.z - c.dz * 0.11 - c.dx * t;
            const h = heightAt(x, z);
            if (h < 0.004 || h > 0.08) continue;
            const yaw = Math.atan2(c.dx, c.dz);
            put(pergs, x, h, z, yaw, 1);
            for (let q = 0; q < 4; q++) {
              const u = ((q % 2) - 0.5) * 0.016;
              const v = (Math.floor(q / 2) - 0.5) * 0.012;
              put(tables, x + c.dz * u + c.dx * v, h, z - c.dx * u + c.dz * v, yaw, 1);
            }
          }
        // Pergola: four posts and a slatted roof merged into one geometry.
        const parts: BufferGeometry[] = [];
        for (const [px, pz] of [
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ] as const) {
          const p = new BoxGeometry(0.0012, 0.014, 0.0012);
          p.translate(px * 0.016, 0.007, pz * 0.011);
          parts.push(p);
        }
        for (let s = 0; s < 6; s++) {
          const sl = new BoxGeometry(0.036, 0.0008, 0.002);
          sl.translate(0, 0.0145, (s - 2.5) * 0.0045);
          parts.push(sl);
        }
        const pergGeo = own(mergeGeometries(parts)!);
        parts.forEach((p) => p.dispose());
        add(pergGeo, own(new MeshStandardMaterial({ color: "#9a7650", roughness: 0.9 })), pergs);
        const tab = [
          new CylinderGeometry(0.003, 0.003, 0.0008, 8),
          new CylinderGeometry(0.0004, 0.0004, 0.005, 4),
        ];
        tab[0]!.translate(0, 0.0052, 0);
        tab[1]!.translate(0, 0.0025, 0);
        const tabGeo = own(mergeGeometries(tab)!);
        tab.forEach((p) => p.dispose());
        add(tabGeo, own(new MeshStandardMaterial({ color: "#2a64b8", roughness: 0.6 })), tables);
      }

      // Hydra: cannons on the harbour walls; donkeys and mules on the waterfront (no cars on the island).
      // Moni: a few of its tame fallow deer by the pine cove.
      {
        const cannons: Matrix4[] = [];
        for (const side of [-1, 1])
          for (let k = 0; k < 4; k++) {
            const t = side * (0.2 + k * 0.025);
            const x = hydra.x - hydra.dx * 0.02 + hydra.dz * t;
            const z = hydra.z - hydra.dz * 0.02 - hydra.dx * t;
            put(
              cannons,
              x,
              Math.max(0.013, heightAt(x, z)) + 0.002,
              z,
              Math.atan2(hydra.dx, hydra.dz),
              1,
              1,
              1,
              Math.PI / 2 - 0.1,
            );
          }
        add(
          own(new CylinderGeometry(0.0011, 0.0018, 0.014, 6)),
          own(
            new MeshStandardMaterial({
              color: "#23272b",
              roughness: 0.4,
              metalness: 0.7,
            }),
          ),
          cannons,
        );

        const animals: Matrix4[] = [];
        const aCols: Color[] = [];
        const coats = ["#6b5444", "#8a7563", "#4a3b31", "#9d8a76"].map((c) => new Color(c));
        for (let k = 0; k < 7; k++) {
          const t = (dr() - 0.5) * 0.4;
          const d = 0.08 + dr() * 0.03;
          const x = hydra.x - hydra.dx * d + hydra.dz * t;
          const z = hydra.z - hydra.dz * d - hydra.dx * t;
          const h = heightAt(x, z);
          if (h < 0.003) continue;
          put(animals, x, h, z, Math.atan2(hydra.dz, -hydra.dx) + (dr() < 0.5 ? 0 : Math.PI), 1);
          aCols.push(coats[k % coats.length]!);
        }
        const deer = new Color("#a8784a");
        let placed = 0;
        for (let k = 0; k < 60 && placed < 5; k++) {
          const x = -6.6 + (dr() - 0.5) * 0.9;
          const z = -2.2 + (dr() - 0.5) * 0.7;
          const h = heightAt(x, z);
          if (h < 0.01 || h > 0.12) continue;
          put(animals, x, h, z, dr() * TAU, 0.85, 1.05, 0.85);
          aCols.push(deer);
          placed++;
        }
        // Four-legged animal: body, neck, head and legs, merged.
        const parts: BufferGeometry[] = [];
        const body = new BoxGeometry(0.0035, 0.0035, 0.008);
        body.translate(0, 0.0058, 0);
        const neck = new BoxGeometry(0.0018, 0.004, 0.0018);
        neck.rotateX(0.5);
        neck.translate(0, 0.0085, 0.0042);
        const head = new BoxGeometry(0.0018, 0.0018, 0.0038);
        head.translate(0, 0.0105, 0.0062);
        parts.push(body, neck, head);
        for (const [lx, lz] of [
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ] as const) {
          const l = new BoxGeometry(0.0009, 0.0042, 0.0009);
          l.translate(lx * 0.0012, 0.0021, lz * 0.003);
          parts.push(l);
        }
        const animalGeo = own(mergeGeometries(parts)!);
        parts.forEach((p) => p.dispose());
        add(animalGeo, own(new MeshStandardMaterial({ roughness: 0.95 })), animals, aCols);
      }

      // Agaves near the shore paths: spiky rosettes of blue-grey leaves.
      {
        const N = 260;
        const leaves: BufferGeometry[] = [];
        for (let k = 0; k < 7; k++) {
          const l = new ConeGeometry(0.0012, 0.009, 3);
          l.translate(0, 0.0045, 0);
          l.rotateZ(0.7);
          l.rotateY((k / 7) * TAU);
          leaves.push(l);
        }
        const up = new ConeGeometry(0.0012, 0.01, 3);
        up.translate(0, 0.005, 0);
        leaves.push(up);
        const agaveGeo = own(mergeGeometries(leaves)!);
        leaves.forEach((p) => p.dispose());
        const mats: Matrix4[] = [];
        const cols: Color[] = [];
        const tones = ["#7f9a8c", "#6f8a6a", "#8aa494"].map((c) => new Color(c));
        let tries = 0;
        while (mats.length < N && tries++ < N * 40) {
          const p = inDomain();
          const h = heightAt(p.x, p.z);
          if (h < 0.006 || h > 0.08 || !seaward(p.x, p.z, 0.15)) continue;
          put(mats, p.x, h - 0.001, p.z, dr() * TAU, 0.8 + dr() * 0.6);
          cols.push(tones[Math.floor(dr() * tones.length)]!);
        }
        add(
          agaveGeo,
          own(new MeshStandardMaterial({ roughness: 0.8, flatShading: true })),
          mats,
          cols,
        );
      }
    }
  }
  // ---------------------------------------------------------------- sea life
  // Channel buoys: red to port and green to starboard as each leg leaves and reaches a stop.
  {
    const spots: { x: number; z: number; red: boolean }[] = [];
    for (let i = 0; i < STOPS.length; i++) {
      const pts = legPoints(i);
      for (const [ia, ib] of [
        [0, 1],
        [pts.length - 1, pts.length - 2],
      ] as const) {
        const [ax, az] = pts[ia]!;
        const [bx, bz] = pts[ib]!;
        const len = Math.hypot(bx - ax, bz - az);
        const dx = (bx - ax) / len;
        const dz = (bz - az) / len;
        for (const side of [-1, 1]) {
          const x = ax + dx * 0.55 - dz * side * 0.22;
          const z = az + dz * 0.55 + dx * side * 0.22;
          if (heightAt(x, z) < -0.03) spots.push({ x, z, red: side < 0 });
        }
      }
    }
    const buoyGeo = own(new ConeGeometry(0.012, 0.035, 8));
    buoyGeo.translate(0, 0.016, 0);
    const buoys = new InstancedMesh(
      buoyGeo,
      own(new MeshStandardMaterial({ roughness: 0.5 })),
      spots.length,
    );
    spots.forEach((b, i) => {
      dummy.position.set(b.x, 0, b.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      buoys.setMatrixAt(i, dummy.matrix);
      buoys.setColorAt(i, new Color(b.red ? "#d0402c" : "#2f9e5a"));
    });
    scene.add(buoys);
  }

  // Other yachts sailing slow loops in open water.
  const SAILERS = high ? 9 : 4;
  const sailers: { cx: number; cz: number; rx: number; rz: number; sp: number; ph: number }[] = [];
  {
    let tries = 0;
    while (sailers.length < SAILERS && tries++ < 400) {
      const cx = -4 + rand() * 13;
      const cz = -12 + rand() * 26;
      const rx = 0.6 + rand() * 1.2;
      const rz = 0.5 + rand() * 1.2;
      let wet = true;
      for (let a = 0; a < TAU && wet; a += 0.3)
        if (heightAt(cx + Math.cos(a) * rx, cz + Math.sin(a) * rz) > -0.04) wet = false;
      if (!wet) continue;
      sailers.push({
        cx,
        cz,
        rx,
        rz,
        sp: (0.012 + rand() * 0.02) * (rand() < 0.5 ? -1 : 1),
        ph: rand() * TAU,
      });
    }
  }
  const sailerHullGeo = own(new CapsuleGeometry(0.016, 0.08, 3, 8));
  sailerHullGeo.rotateX(Math.PI / 2);
  sailerHullGeo.scale(1, 0.7, 1);
  const sailerSailGeo = own(new ConeGeometry(0.024, 0.13, 3));
  sailerSailGeo.scale(0.35, 1, 1);
  sailerSailGeo.translate(0, 0.085, -0.004);
  const sailerHulls = new InstancedMesh(
    sailerHullGeo,
    own(new MeshStandardMaterial({ color: "#f3f3f3", roughness: 0.5 })),
    sailers.length,
  );
  const sailerSails = new InstancedMesh(
    sailerSailGeo,
    own(new MeshStandardMaterial({ color: "#f6f2e8", roughness: 0.8, side: DoubleSide })),
    sailers.length,
  );
  scene.add(sailerHulls, sailerSails);

  // A ferry shuttling between the mainland and Aegina along the open-water lane.
  const ferry = new Group();
  {
    const hullM = own(new MeshStandardMaterial({ color: "#f4f4f2", roughness: 0.5 }));
    const blueM = own(new MeshStandardMaterial({ color: "#1f4f8f", roughness: 0.5 }));
    const winM = own(new MeshStandardMaterial({ color: "#16293a", roughness: 0.2 }));
    const parts: [BufferGeometry, Material, number, number, number][] = [
      [new BoxGeometry(0.075, 0.03, 0.3), hullM, 0, 0.012, 0],
      [new BoxGeometry(0.077, 0.008, 0.3), blueM, 0, 0.004, 0],
      [new BoxGeometry(0.06, 0.03, 0.17), hullM, 0, 0.042, -0.02],
      [new BoxGeometry(0.062, 0.008, 0.172), winM, 0, 0.046, -0.02],
      [new BoxGeometry(0.045, 0.02, 0.07), hullM, 0, 0.066, 0.02],
      [new CylinderGeometry(0.008, 0.009, 0.03, 8), blueM, 0, 0.09, -0.04],
    ];
    // One mesh per material: the static parts are merged, so the ferry costs three draw calls instead of six.
    const byMat = new Map<Material, BufferGeometry[]>();
    for (const [g, m, x, y, z] of parts) {
      g.translate(x, y, z);
      const list = byMat.get(m) ?? [];
      list.push(g);
      byMat.set(m, list);
    }
    for (const [m, list] of byMat) {
      const merged = own(mergeGeometries(list)!);
      list.forEach((g) => g.dispose());
      ferry.add(new Mesh(merged, m));
    }
    scene.add(ferry);
  }

  // Gulls circling over the boat.
  const GULLS = high ? 14 : 0;
  const gullGeo = own(new BufferGeometry());
  gullGeo.setAttribute(
    "position",
    new BufferAttribute(
      new Float32Array([
        0, 0, 0.006, 0, 0, -0.008, -0.03, 0.01, -0.004, 0, 0, 0.006, 0.03, 0.01, -0.004, 0, 0,
        -0.008,
      ]),
      3,
    ),
  );
  gullGeo.computeVertexNormals();
  const gulls = new InstancedMesh(
    gullGeo,
    own(new MeshBasicMaterial({ color: "#f4f6f8", side: DoubleSide })),
    Math.max(1, GULLS),
  );
  gulls.count = GULLS;
  gulls.frustumCulled = false;
  const gullSeed = Array.from({ length: GULLS }, () => ({
    r: 0.35 + rand() * 0.6,
    y: 0.3 + rand() * 0.35,
    sp: 0.25 + rand() * 0.25,
    ph: rand() * TAU,
  }));
  scene.add(gulls);

  // ---------------------------------------------------------------- clouds
  const cloudTex = own(softTexture());
  // All clouds are one instanced draw; each fades near the wrap edges and near the camera through its own alpha.
  const CLOUD_SPAN = 90;
  const CLOUD_X0 = -40;
  const CLOUDS = high ? 16 : 8;
  const clouds: { x0: number; y: number; z: number; speed: number }[] = [];
  const cloudCenter = new Float32Array(CLOUDS * 3);
  const cloudSize = new Float32Array(CLOUDS * 2);
  const cloudAlpha = new Float32Array(CLOUDS);
  for (let i = 0; i < CLOUDS; i++) {
    const s = 5 + rand() * 6;
    cloudSize[i * 2] = s * 1.8;
    cloudSize[i * 2 + 1] = s * 0.6;
    const c = { x0: CLOUD_X0 + rand() * CLOUD_SPAN, y: 7 + rand() * 5, z: DOMAIN.z0 + rand() * D };
    clouds.push({ ...c, speed: 0.015 + rand() * 0.025 });
    cloudCenter.set([c.x0, c.y, c.z], i * 3);
  }
  const cloudGeo = own(new InstancedBufferGeometry());
  {
    const quad = new PlaneGeometry(1, 1);
    cloudGeo.index = quad.index;
    cloudGeo.setAttribute("position", quad.attributes.position!);
    cloudGeo.setAttribute("uv", quad.attributes.uv!);
    quad.dispose();
  }
  const cloudCenterAttr = new InstancedBufferAttribute(cloudCenter, 3);
  const cloudAlphaAttr = new InstancedBufferAttribute(cloudAlpha, 1);
  cloudCenterAttr.setUsage(DynamicDrawUsage);
  cloudAlphaAttr.setUsage(DynamicDrawUsage);
  cloudGeo.setAttribute("aCenter", cloudCenterAttr);
  cloudGeo.setAttribute("aSize", new InstancedBufferAttribute(cloudSize, 2));
  cloudGeo.setAttribute("aAlpha", cloudAlphaAttr);
  cloudGeo.instanceCount = CLOUDS;
  const cloudColor = new Color();
  const cloudMat = own(
    new ShaderMaterial({
      vertexShader: VERT_CLOUD,
      fragmentShader: FRAG_CLOUD,
      transparent: true,
      depthWrite: false,
      uniforms: { uMap: { value: cloudTex }, uColor: { value: cloudColor } },
    }),
  );
  const cloudMesh = new Mesh(cloudGeo, cloudMat);
  cloudMesh.frustumCulled = false;
  scene.add(cloudMesh);
  let cloudBase = 0.55;

  // ---------------------------------------------------------------- steam over Methana
  const steamMat = own(
    new ShaderMaterial({
      vertexShader: VERT_STEAM,
      fragmentShader: FRAG_STEAM,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uScale: { value: 1 },
        uMotion: { value: 1 },
        uColor: { value: new Color("#f4f1ea") },
      },
    }),
  );
  {
    const count = 54;
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      const spring = i % 3 === 0;
      const x = spring ? -3.0 : -5.4;
      const z = spring ? 2.9 : 2.9;
      pos[i * 3] = x;
      pos[i * 3 + 1] = Math.max(0, heightAt(x, z)) + 0.02;
      pos[i * 3 + 2] = z;
      seed.set([rand(), rand(), rand(), rand()], i * 4);
    }
    const geo = own(new BufferGeometry());
    geo.setAttribute("position", new BufferAttribute(pos, 3));
    geo.setAttribute("aSeed", new BufferAttribute(seed, 4));
    const steam = new Points(geo, steamMat);
    steam.frustumCulled = false;
    scene.add(steam);
  }

  // ---------------------------------------------------------------- route
  const curves = STOPS.map((_, i) => {
    const pts = legPoints(i).map(([x, z]) => new Vector3(x, 0, z));
    return new CatmullRomCurve3(pts, false, "centripetal");
  });
  const legLength = curves.map((c) => c.getLength());
  const dotsMat = own(
    new ShaderMaterial({
      vertexShader: VERT_DOTS,
      fragmentShader: FRAG_DOTS,
      transparent: true,
      depthWrite: false,
      uniforms: { uPath: { value: 0 }, uScale: { value: 1 } },
    }),
  );
  {
    const pos: number[] = [];
    const path: number[] = [];
    curves.forEach((c, i) => {
      const n = Math.max(2, Math.round(legLength[i]! / 0.16));
      for (let j = 0; j <= n; j++) {
        const p = c.getPointAt(j / n);
        pos.push(p.x, 0.012, p.z);
        path.push(i + j / n);
      }
    });
    const geo = own(new BufferGeometry());
    geo.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
    geo.setAttribute("aPath", new BufferAttribute(new Float32Array(path), 1));
    const dots = new Points(geo, dotsMat);
    dots.frustumCulled = false;
    dots.renderOrder = 2;
    scene.add(dots);
  }
  // Beacon rings at the stops.
  const ringMats: MeshBasicMaterial[] = [];
  const rings: Mesh[] = STOPS.map((st) => {
    const m = own(
      new MeshBasicMaterial({
        color: "#ffd27a",
        transparent: true,
        opacity: 0.4,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
        fog: false,
      }),
    );
    ringMats.push(m);
    const r = new Mesh(own(new RingGeometry(0.2, 0.235, 48)), m);
    r.rotation.x = -Math.PI / 2;
    r.position.set(st.x, 0.015, st.z);
    r.renderOrder = 3;
    scene.add(r);
    return r;
  });

  // ---------------------------------------------------------------- the catamaran
  const boat = new Group();
  const boatBody = new Group();
  boat.add(boatBody);
  const white = own(
    new MeshStandardMaterial({
      color: "#f7f6f2",
      roughness: 0.35,
      emissive: new Color("#8a8e94"),
      emissiveIntensity: 0.35,
    }),
  );
  const trim = own(new MeshStandardMaterial({ color: "#1d3d5c", roughness: 0.5 }));
  const teak = own(new MeshStandardMaterial({ color: "#b98a56", roughness: 0.7 }));
  const glass = own(
    new MeshStandardMaterial({
      color: "#16293a",
      roughness: 0.1,
      metalness: 0.3,
      emissive: new Color("#ffb866"),
      emissiveIntensity: 0,
    }),
  );
  const panel = own(new MeshStandardMaterial({ color: "#1b2c4d", roughness: 0.3, metalness: 0.4 }));
  const sailMat = own(
    new MeshStandardMaterial({
      color: "#f5efe2",
      roughness: 0.85,
      side: DoubleSide,
      emissive: new Color("#6d675c"),
      emissiveIntensity: 0.4,
    }),
  );
  const mastMat = own(
    new MeshStandardMaterial({ color: "#c9ced4", roughness: 0.4, metalness: 0.6 }),
  );
  const dark = own(
    new MeshStandardMaterial({
      color: "#2b2f35",
      roughness: 0.45,
      metalness: 0.5,
    }),
  );
  const tube = own(new MeshStandardMaterial({ color: "#8e979f", roughness: 0.8 }));
  const lineMat = own(new MeshBasicMaterial({ color: "#dfe6ec" }));
  const gold = own(
    new MeshStandardMaterial({
      color: "#c9a24a",
      roughness: 0.4,
      metalness: 0.5,
    }),
  );
  const navRed = own(new MeshBasicMaterial({ color: "#ff3b30" }));
  const navGreen = own(new MeshBasicMaterial({ color: "#2bd96b" }));
  const navWhite = own(new MeshBasicMaterial({ color: "#fff4d6" }));
  // Static parts are baked into one merged mesh per material.
  const parts = new Map<Material, BufferGeometry[]>();
  const put = (
    g: BufferGeometry,
    m: Material,
    x: number,
    y: number,
    z: number,
    rx = 0,
    ry = 0,
    rz = 0,
  ) => {
    dummy.position.set(x, y, z);
    dummy.rotation.set(rx, ry, rz, "XYZ");
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    g.applyMatrix4(dummy.matrix);
    const list = parts.get(m) ?? [];
    list.push(g);
    parts.set(m, list);
  };
  const box = (
    m: Material,
    sx: number,
    sy: number,
    sz: number,
    x: number,
    y: number,
    z: number,
    rx = 0,
  ) => put(new BoxGeometry(sx, sy, sz), m, x, y, z, rx);
  const UP = new Vector3(0, 1, 0);
  const rod = (a: Vector3, b: Vector3, r: number, m: Material, seg = 4) => {
    const g = new CylinderGeometry(r, r, a.distanceTo(b), seg);
    g.applyQuaternion(new Quaternion().setFromUnitVectors(UP, b.clone().sub(a).normalize()));
    put(g, m, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  };
  const p3 = (x: number, y: number, z: number) => new Vector3(x, y, z);

  // Twin hulls lofted from sections: fine raked bows, flat transoms, a soft V below the waterline.
  const DECK = 0.058;
  const KEEL = -0.004;
  const Z0 = -0.212;
  const Z1 = 0.214;
  const halfWidth = (z: number) => {
    const f = clamp01((z - 0.02) / (Z1 - 0.02));
    return 0.031 * Math.pow(1 - Math.pow(f, 1.8), 0.7) + 0.0008;
  };
  const makeHull = () => {
    const ST = 22;
    const RING = 18;
    const pos: number[] = [];
    const idx: number[] = [];
    const ringAt = (i: number) => {
      const t = i / ST;
      const z = mix(Z0, Z1, t);
      const f = clamp01((z - 0.02) / (Z1 - 0.02));
      const hw = halfWidth(z);
      const depth = (DECK - KEEL) * (1 - 0.5 * f * f) * (t < 0.08 ? 0.82 + t * 2.2 : 1);
      const rake = f * f * 0.035;
      const ring: number[] = [];
      for (let j = 0; j < RING; j++) {
        const th = (j / RING) * TAU;
        const c = Math.cos(th);
        const s = Math.sin(th);
        const x = hw * Math.sign(c) * Math.pow(Math.abs(c), 0.55);
        if (s >= 0) ring.push(x, DECK + s * 0.0025, z);
        else {
          const k = Math.pow(-s, 0.8);
          ring.push(x * (1 - 0.15 * k), DECK - depth * k, z - rake * k);
        }
      }
      return ring;
    };
    for (let i = 0; i <= ST; i++) pos.push(...ringAt(i));
    for (let i = 0; i < ST; i++)
      for (let j = 0; j < RING; j++) {
        const a = i * RING + j;
        const b = (i + 1) * RING + j;
        const c = i * RING + ((j + 1) % RING);
        const d = (i + 1) * RING + ((j + 1) % RING);
        idx.push(a, c, b, c, d, b);
      }
    // Caps with their own vertices so the transom keeps a crisp edge.
    const cap = (i: number, out: number) => {
      const ring = ringAt(i);
      const start = pos.length / 3;
      let cy = 0;
      for (let j = 0; j < RING; j++) cy += ring[j * 3 + 1]!;
      pos.push(0, cy / RING, ring[2]!, ...ring);
      for (let j = 0; j < RING; j++) {
        const p = start + 1 + j;
        const q = start + 1 + ((j + 1) % RING);
        if (out > 0) idx.push(start, p, q);
        else idx.push(start, q, p);
      }
    };
    cap(0, -1);
    cap(ST, 1);
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute("uv", new BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };
  for (const side of [-1, 1]) {
    const cx = side * 0.085;
    put(makeHull(), white, cx, 0, 0);
    for (const o of [-1, 1]) {
      // Navy name stripe and a gold cove line along both faces of each hull.
      box(trim, 0.002, 0.007, 0.26, cx + o * 0.0301, 0.029, -0.07);
      box(gold, 0.002, 0.0014, 0.25, cx + o * 0.0309, 0.035, -0.07);
    }
    // Long hull windows on the outside, a short one aft.
    box(glass, 0.002, 0.007, 0.1, cx + side * 0.0309, 0.044, 0.0);
    box(glass, 0.002, 0.005, 0.04, cx + side * 0.0309, 0.044, -0.12);
    for (const z of [-0.06, 0.04])
      box(glass, 0.002, 0.004, 0.008, cx + side * 0.031, 0.045, z + 0.06);
    // Transom steps cut down to the water, with teak treads.
    box(white, 0.05, 0.034, 0.02, cx, 0.027, -0.222);
    box(teak, 0.05, 0.003, 0.02, cx, 0.0455, -0.222);
    box(white, 0.05, 0.02, 0.018, cx, 0.02, -0.241);
    box(teak, 0.05, 0.003, 0.018, cx, 0.0315, -0.241);
    // Foredeck hatches and mooring cleats.
    for (const z of [0.125, 0.165]) {
      box(white, 0.024, 0.004, 0.024, cx, DECK + 0.002, z);
      box(glass, 0.019, 0.002, 0.019, cx, DECK + 0.005, z);
    }
    for (const z of [0.19, -0.2]) {
      box(mastMat, 0.004, 0.003, 0.004, cx + side * 0.014, DECK + 0.0015, z);
      box(mastMat, 0.003, 0.002, 0.014, cx + side * 0.014, DECK + 0.004, z);
    }
    // Davit arms reaching over the dinghy.
    rod(p3(side * 0.045, 0.075, -0.2), p3(side * 0.045, 0.118, -0.25), 0.0022, mastMat, 6);
    rod(p3(side * 0.045, 0.118, -0.25), p3(side * 0.045, 0.104, -0.255), 0.0007, lineMat);
  }
  // Bridge deck, crossbeams and the cabin with wrap-around windows and a raked windscreen.
  box(white, 0.23, 0.014, 0.26, 0, 0.066, -0.02);
  box(white, 0.24, 0.012, 0.012, 0, 0.064, 0.205); // front beam
  box(white, 0.2, 0.01, 0.012, 0, 0.062, -0.205); // aft beam
  box(white, 0.17, 0.03, 0.15, 0, 0.088, -0.03);
  box(glass, 0.174, 0.022, 0.154, 0, 0.114, -0.03);
  box(white, 0.19, 0.008, 0.17, 0, 0.129, -0.03);
  box(white, 0.17, 0.024, 0.027, 0, 0.085, 0.0585);
  box(glass, 0.17, 0.004, 0.043, 0, 0.112, 0.058, 0.88);
  for (const x of [-0.087, 0.087]) {
    for (const z of [-0.104, -0.05, 0.0, 0.045]) box(white, 0.006, 0.022, 0.006, x, 0.114, z);
  }
  for (const x of [-0.04, 0.04]) box(white, 0.006, 0.022, 0.006, x, 0.114, -0.106);
  box(panel, 0.12, 0.004, 0.06, -0.02, 0.135, -0.065); // solar on the coachroof
  for (const x of [-0.05, 0.05]) {
    box(white, 0.034, 0.005, 0.034, x, 0.1355, 0.025); // hatch frame
    box(glass, 0.028, 0.002, 0.028, x, 0.1385, 0.025);
  }
  box(dark, 0.004, 0.003, 0.12, 0, 0.1345, -0.03); // handrail track
  // Cockpit: teak floor, helm console, seat, wheel, winches.
  box(teak, 0.15, 0.006, 0.07, 0, 0.074, -0.15);
  box(white, 0.03, 0.02, 0.02, 0.07, 0.085, -0.17); // helm seat
  box(white, 0.032, 0.026, 0.012, 0.07, 0.09, -0.13); // helm console
  box(panel, 0.026, 0.002, 0.008, 0.07, 0.104, -0.13);
  put(new CylinderGeometry(0.012, 0.012, 0.002, 14), mastMat, 0.07, 0.11, -0.15, Math.PI / 2);
  put(new TorusGeometry(0.012, 0.0012, 4, 16), mastMat, 0.07, 0.11, -0.1505);
  for (const [x, y, z] of [
    [-0.07, 0.081, -0.115],
    [0.07, 0.081, -0.115],
    [-0.075, 0.137, -0.1],
    [0.075, 0.137, -0.1],
  ] as const) {
    put(new CylinderGeometry(0.0055, 0.0068, 0.009, 10), mastMat, x, y, z);
    put(new CylinderGeometry(0.0035, 0.0035, 0.003, 8), dark, x, y + 0.006, z);
  }
  box(teak, 0.15, 0.004, 0.11, 0, 0.07, 0.17); // trampoline frame
  box(trim, 0.146, 0.003, 0.106, 0, 0.0712, 0.17); // trampoline net
  for (let i = 0; i < 6; i++) box(mastMat, 0.0012, 0.002, 0.11, -0.065 + i * 0.026, 0.0725, 0.17);
  // Mast with spreaders and a radar dome; boom raised clear of the bimini.
  put(new CylinderGeometry(0.006, 0.007, 0.62, 10), mastMat, 0, 0.38, 0.05);
  rod(p3(-0.07, 0.42, 0.05), p3(0.07, 0.42, 0.05), 0.0016, mastMat);
  put(new SphereGeometry(0.012, 10, 6), white, 0, 0.3, 0.066);
  rod(p3(0, 0.2, 0.05), p3(0, 0.2, -0.22), 0.0042, mastMat, 8);
  put(new SphereGeometry(0.0045, 6, 4), dark, 0, 0.2, -0.22);
  rod(p3(0, 0.09, 0.044), p3(0, 0.198, -0.02), 0.0015, dark); // vang
  // Mainsheet: blocks on the boom end and the traveller on the bimini.
  box(dark, 0.15, 0.003, 0.005, 0, 0.18, -0.19);
  put(new SphereGeometry(0.0035, 6, 4), dark, 0, 0.195, -0.19);
  put(new SphereGeometry(0.0035, 6, 4), dark, 0, 0.184, -0.19);
  rod(p3(-0.001, 0.195, -0.19), p3(-0.001, 0.184, -0.19), 0.0008, lineMat);
  rod(p3(0.001, 0.195, -0.19), p3(0.001, 0.184, -0.19), 0.0008, lineMat);
  // Bimini with solar panels on its frame.
  box(trim, 0.17, 0.004, 0.09, 0, 0.175, -0.145);
  for (const x of [-0.042, 0.042]) {
    box(panel, 0.076, 0.002, 0.08, x, 0.178, -0.145);
    for (let k = 1; k < 4; k++) box(mastMat, 0.076, 0.0024, 0.0008, x, 0.178, -0.185 + k * 0.02);
  }
  for (const x of [-0.08, 0.08])
    for (const z of [-0.185, -0.105])
      put(new CylinderGeometry(0.0015, 0.0015, 0.1, 4), mastMat, x, 0.125, z);
  // Forestay base: longeron, bow roller, anchor, furling drum, bridles.
  rod(p3(0, 0.064, 0.2), p3(0, 0.07, 0.345), 0.0035, white, 8);
  put(new CylinderGeometry(0.007, 0.007, 0.012, 12), dark, 0, 0.08, 0.335);
  put(new CylinderGeometry(0.0035, 0.0035, 0.016, 8), dark, 0, 0.066, 0.214, 0, 0, Math.PI / 2);
  box(mastMat, 0.003, 0.003, 0.022, 0, 0.058, 0.222, -0.7); // anchor shank
  box(mastMat, 0.016, 0.003, 0.007, 0, 0.049, 0.232, -0.3); // anchor flukes
  put(new ConeGeometry(0.004, 0.008, 4), mastMat, 0, 0.049, 0.237, Math.PI / 2);
  for (const side of [-1, 1])
    rod(p3(0, 0.07, 0.34), p3(side * 0.085, 0.056, 0.205), 0.0008, lineMat);
  // Navigation lights: red to port, green to starboard, white stern and masthead.
  box(navRed, 0.005, 0.005, 0.006, 0.112, 0.09, 0.19);
  box(navGreen, 0.005, 0.005, 0.006, -0.112, 0.09, 0.19);
  box(navWhite, 0.005, 0.005, 0.005, 0, 0.074, -0.212);
  put(new SphereGeometry(0.004, 6, 4), navWhite, 0, 0.695, 0.05);
  // Railings: stanchions following the outer hull lines, joined by a top rail and a bow rail.
  {
    for (const side of [-1, 1]) {
      let prev: Vector3 | null = null;
      for (let z = -0.19; z <= 0.2; z += 0.065) {
        const x = side * (0.085 + halfWidth(z) * 0.8);
        put(new CylinderGeometry(0.0011, 0.0011, 0.034, 4), mastMat, x, 0.075, z);
        const top = p3(x, 0.092, z);
        if (prev) rod(prev, top, 0.001, mastMat);
        prev = top;
      }
    }
    rod(p3(-0.1, 0.092, 0.205), p3(0.1, 0.092, 0.205), 0.001, mastMat);
  }
  // Liferaft canister on the aft beam.
  put(new CylinderGeometry(0.009, 0.009, 0.036, 10), white, 0, 0.076, -0.205, 0, 0, Math.PI / 2);
  for (const x of [-0.01, 0.01]) box(dark, 0.003, 0.02, 0.02, x, 0.076, -0.205);
  // Inflatable dinghy hanging on the davits: tubes, floor and an outboard.
  for (const dz of [-0.011, 0.011])
    put(new CapsuleGeometry(0.0075, 0.07, 3, 8), tube, 0, 0.098, -0.258 + dz, 0, 0, Math.PI / 2);
  box(tube, 0.075, 0.004, 0.018, 0, 0.093, -0.258);
  box(dark, 0.008, 0.02, 0.009, -0.046, 0.094, -0.258);
  box(dark, 0.012, 0.009, 0.012, -0.048, 0.106, -0.258);

  // Standing rigging: forestay with the furling foil, backstay, shrouds over the spreaders.
  {
    const head = p3(0, 0.68, 0.05);
    rod(head, p3(0, 0.086, 0.335), 0.0019, mastMat);
    rod(head, p3(0, 0.07, -0.22), 0.0012, lineMat);
    for (const side of [-1, 1]) {
      rod(head, p3(side * 0.07, 0.42, 0.05), 0.0012, lineMat);
      rod(p3(side * 0.07, 0.42, 0.05), p3(side * 0.1, 0.07, 0.02), 0.0012, lineMat);
    }
  }

  for (const [m, list] of parts) {
    const merged = mergeGeometries(list);
    list.forEach((g) => g.dispose());
    if (merged) boatBody.add(new Mesh(own(merged), m));
  }

  // Flag at the masthead: Greek blue with white stripes, waving.
  const flag = new Group();
  flag.position.set(0, 0.69, 0.045);
  {
    const blue = own(
      new MeshStandardMaterial({
        color: "#2a64b8",
        roughness: 0.7,
        side: DoubleSide,
      }),
    );
    const f = new Mesh(own(new BoxGeometry(0.002, 0.026, 0.04)), blue);
    f.position.z = -0.02;
    const w1 = new Mesh(own(new BoxGeometry(0.0024, 0.004, 0.04)), sailMat);
    w1.position.set(0, 0.004, -0.02);
    const w2 = w1.clone();
    w2.position.y = -0.006;
    flag.add(f, w1, w2);
  }
  boatBody.add(flag);
  // Fenders hanging on the outer hulls.
  {
    const fenders = new InstancedMesh(
      own(new CapsuleGeometry(0.0055, 0.014, 2, 6)),
      own(new MeshStandardMaterial({ color: "#2a64b8", roughness: 0.6 })),
      6,
    );
    let i = 0;
    for (const side of [-1, 1])
      for (const z of [-0.1, 0, 0.1]) {
        dummy.position.set(side * 0.121, 0.04, z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        fenders.setMatrixAt(i++, dummy.matrix);
      }
    boatBody.add(fenders);
  }

  const SAIL_FOOT = 0.2;
  const mainGeo = new BufferGeometry();
  // Per-vertex belly depth, leech weight and flutter phase, so the sail can fill and flutter without rebuilding.
  const sailBelly: number[] = [];
  const sailLeech: number[] = [];
  const sailPhase: number[] = [];
  {
    // Triangle from mast base to masthead to boom end, billowed to one side.
    const seg = 10;
    const pos: number[] = [];
    const idx: number[] = [];
    const top = { y: 0.66, z: 0.045 };
    const toe = { y: SAIL_FOOT, z: 0.045 };
    const clew = { y: SAIL_FOOT, z: -0.215 };
    for (let r = 0; r <= seg; r++) {
      const v = r / seg;
      const a = { y: mix(toe.y, top.y, v), z: mix(toe.z, top.z, v) };
      const b = { y: mix(clew.y, top.y, v), z: mix(clew.z, top.z, v) };
      for (let c = 0; c <= seg; c++) {
        const u = c / seg;
        const y = mix(a.y, b.y, u);
        const z = mix(a.z, b.z, u);
        pos.push(0.014 + Math.sin(u * Math.PI) * Math.sin(v * Math.PI * 0.9 + 0.2) * 0.055, y, z);
        sailBelly.push(Math.sin(u * Math.PI) * Math.sin(v * Math.PI * 0.9 + 0.2) * 0.055);
        sailLeech.push(smooth(0.6, 1, u) * (0.4 + 0.6 * v));
        sailPhase.push(v * 9 + u * 3);
      }
    }
    for (let r = 0; r < seg; r++)
      for (let c = 0; c < seg; c++) {
        const i = r * (seg + 1) + c;
        idx.push(i, i + 1, i + seg + 1, i + 1, i + seg + 2, i + seg + 1);
      }
    mainGeo.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
    mainGeo.setIndex(idx);
    mainGeo.computeVertexNormals();
  }
  const mainsail = new Mesh(own(mainGeo), sailMat);
  mainsail.position.set(0, 0, 0);
  boatBody.add(mainsail);
  const battens: Mesh[] = [];
  // Battens across the mainsail, from the luff to the leech.
  for (const y of [0.28, 0.37, 0.46, 0.55]) {
    const v = (y - SAIL_FOOT) / (0.66 - SAIL_FOOT);
    const leech = mix(-0.215, 0.045, v);
    const len = 0.045 - leech;
    const bt = new Mesh(own(new BoxGeometry(0.003, 0.003, len * 0.9)), mastMat);
    bt.position.set(0.014 + Math.sin(v * Math.PI * 0.9 + 0.2) * 0.04, y, 0.045 - len / 2);
    bt.userData.belly = Math.sin(v * Math.PI * 0.9 + 0.2) * 0.04;
    battens.push(bt);
    mainsail.add(bt);
  }

  const jibGeo = new BufferGeometry();
  jibGeo.setAttribute(
    "position",
    new BufferAttribute(
      new Float32Array([
        -0.006, 0.6, 0.075, -0.014, 0.1, 0.33, 0.026, 0.1, 0.09, -0.01, 0.36, 0.14,
      ]),
      3,
    ),
  );
  jibGeo.setIndex([0, 1, 3, 0, 3, 2, 3, 1, 2]);
  jibGeo.computeVertexNormals();
  const jib = new Mesh(own(jibGeo), sailMat);
  let sailFill = 0;
  /** Sails fill and bulge while under way and the leech flutters; at anchor they hang nearly still. Allocation-free. */
  const shapeSails = (target: number, motion: number) => {
    sailFill += (target - sailFill) * 0.05;
    const f = sailFill;
    const belly = 0.75 + 0.45 * f;
    const mp = mainGeo.attributes.position as BufferAttribute;
    for (let i = 0; i < mp.count; i++) {
      const fl = sailLeech[i]! * (0.0006 + f * 0.0035) * Math.sin(motion * 13 + sailPhase[i]!);
      mp.setX(i, 0.014 + sailBelly[i]! * belly + fl);
    }
    mp.needsUpdate = true;
    mainGeo.computeVertexNormals();
    for (const bt of battens) bt.position.x = 0.014 + (bt.userData.belly as number) * belly;
    const jp = jibGeo.attributes.position as BufferAttribute;
    jp.setX(3, -0.01 - f * 0.014);
    jp.setX(1, -0.014 + f * 0.003 * Math.sin(motion * 15));
    jp.needsUpdate = true;
    jibGeo.computeVertexNormals();
  };
  boatBody.add(jib);

  boat.scale.setScalar(1.15);
  scene.add(boat);

  // Wake: drawn by the sea shader as a foam V behind the boat (uBoat), so no geometry here.

  // ---------------------------------------------------------------- the frame
  const v3 = new Vector3();
  const tan = new Vector3();
  const tanPrev = new Vector3();
  const tmpTop = new Color();
  const tmpHorizon = new Color();
  const tmpSun = new Color();
  const tmpSunDir = new Vector3();
  const ferryPos = new Vector3();
  const ferryTan = new Vector3();
  let width = 1;
  let height = 1;
  const lastBoat = { x: STOPS[0]!.x, z: STOPS[0]!.z };
  const boatPt = new Vector3();
  // What the last frame was built from, so unchanged work can be skipped (the low tier freezes time).
  let lastMotion = Number.NaN;
  let lastHour = Number.NaN;
  const projected = { x: 0, y: 0 };
  // Gulls only gather while the boat rests at an island; they fade away once it sails.
  let gullsIn = 1;

  const legTangent = (leg: number, f: number, out: Vector3) =>
    curves[leg]!.getTangentAt(clamp01(f), out);
  const angleOf = (t: Vector3) => Math.atan2(t.x, t.z);
  const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
  // Where a turn ends, unwrapped from `from`. The side is chosen once from the departure angle, so a near-U-turn never flips to the other side mid-leg.
  const turnEnd = (from: number, depart: number, cur: number) =>
    from + wrap(depart - from) + wrap(cur - depart);
  const tan0 = new Vector3();

  function frame(st: FrameState) {
    const s = Math.min(LAST, Math.max(0, st.s));
    const motion = st.time;

    // Where the boat is, and which way it points.
    const b = boatAt(s);
    let px: number;
    let pz: number;
    let heading: number;
    // The camera turns slower than the boat, so leaving an island never swings the view across it.
    let camFrom: number;
    let camTo: number;
    let camDepart: number;
    let pathCoord: number;
    if (b.leg >= 0) {
      const p = curves[b.leg]!.getPointAt(b.f, boatPt);
      px = p.x;
      pz = p.z;
      legTangent(b.leg, b.f, tan);
      const k = Math.floor(s);
      const arrive = k <= 1 ? 0 : (b.leg + curves.length - 1) % curves.length;
      legTangent(arrive, k <= 1 ? 0 : 1, tanPrev);
      legTangent(b.leg, 0, tan0);
      const from = angleOf(tanPrev);
      const depart = angleOf(tan0);
      heading = mix(from, turnEnd(from, depart, angleOf(tan)), smooth(0.1, 0.4, s - k));
      camFrom = from;
      camTo = angleOf(tan);
      camDepart = depart;
      pathCoord = b.leg + b.f;
    } else {
      const stop = STOPS[b.rest]!;
      px = stop.x;
      pz = stop.z;
      const arrive = s <= 1 ? 0 : (b.rest + curves.length - 1) % curves.length;
      legTangent(arrive, s <= 1 ? 0 : 1, tan);
      heading = angleOf(tan);
      camFrom = heading;
      camTo = heading;
      camDepart = heading;
      pathCoord = s <= 1 ? 0 : b.rest === 0 ? curves.length : b.rest;
    }
    const moved = Math.hypot(px - lastBoat.x, pz - lastBoat.z);
    const boatMoved = moved > 0;
    lastBoat.x = px;
    lastBoat.z = pz;
    const motionChanged = motion !== lastMotion;
    lastMotion = motion;
    // A calm, slow swell: gentle bob, pitch and roll.
    const bob = Math.sin(motion * 0.85) * 0.0035;
    boat.position.set(px, 0.006 + bob, pz);
    boat.rotation.set(
      Math.sin(motion * 0.7) * 0.01,
      heading,
      Math.sin(motion * 0.55) * 0.016 + Math.min(0.05, moved * 5),
    );
    mainsail.rotation.y = Math.sin(motion * 0.5) * 0.018 + 0.05;
    jib.rotation.y = Math.sin(motion * 0.6 + 1) * 0.025;
    shapeSails(b.leg >= 0 ? smooth(0, 0.08, b.f) * (1 - smooth(0.9, 1, b.f)) : 0, motion);
    flag.rotation.y = Math.sin(motion * 3.2) * 0.25;

    // Life around the boat: other yachts, the ferry, gulls, windmill sails.
    if (motionChanged) {
      for (let i = 0; i < sailers.length; i++) {
        const y = sailers[i]!;
        const a = y.ph + motion * y.sp * 2;
        const x = y.cx + Math.cos(a) * y.rx;
        const z = y.cz + Math.sin(a) * y.rz;
        const dir = Math.sign(y.sp);
        dummy.position.set(x, 0.006 + Math.sin(motion * 0.8 + i) * 0.002, z);
        dummy.rotation.set(
          0,
          Math.atan2(-Math.sin(a) * y.rx * dir, Math.cos(a) * y.rz * dir),
          0.08 * dir,
        );
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        sailerHulls.setMatrixAt(i, dummy.matrix);
        sailerSails.setMatrixAt(i, dummy.matrix);
      }
      sailerHulls.instanceMatrix.needsUpdate = true;
      sailerSails.instanceMatrix.needsUpdate = true;
      placeMillBlades(motion);
    }
    if (motionChanged) {
      // Ping-pong along the Aegina lane, held a little to the side of our route.
      const u = (motion * 0.006) % 2;
      const f = u < 1 ? u : 2 - u;
      const fe = f * f * (3 - 2 * f);
      const ferryLeg = curves[curves.length - 1]!;
      ferryLeg.getPointAt(0.08 + fe * 0.84, ferryPos);
      ferryLeg.getTangentAt(0.08 + fe * 0.84, ferryTan);
      if (u >= 1) ferryTan.negate();
      ferry.position.set(ferryPos.x - ferryTan.z * 0.3, 0.004, ferryPos.z + ferryTan.x * 0.3);
      ferry.rotation.set(0, angleOf(ferryTan), 0);
    }
    const gullsWas = gullsIn;
    gullsIn += ((b.leg < 0 ? 1 : 0) - gullsIn) * 0.06;
    gulls.visible = gullsIn > 0.01;
    const gullsLive =
      GULLS > 0 && gulls.visible && (motionChanged || boatMoved || gullsIn !== gullsWas);
    if (gullsLive) {
      for (let i = 0; i < GULLS; i++) {
        const g = gullSeed[i]!;
        const gs = 1.4 * gullsIn;
        const a = g.ph + motion * g.sp;
        dummy.position.set(
          px + Math.cos(a) * g.r,
          g.y + Math.sin(motion * 0.7 + i) * 0.04,
          pz + Math.sin(a) * g.r,
        );
        dummy.rotation.set(0, -a, Math.sin(motion * 0.9 + i) * 0.25);
        dummy.scale.set(gs, gs * Math.sin(motion * 5 + g.ph * 3), gs);
        dummy.updateMatrix();
        gulls.setMatrixAt(i, dummy.matrix);
      }
      gulls.instanceMatrix.needsUpdate = true;
    }

    // Wake: builds up leaving a stop and settles on arrival.
    const wakeOn = b.leg >= 0 ? smooth(0, 0.08, b.f) * (1 - smooth(0.9, 1, b.f)) : 0;

    // Light: colours and sky/sea uniforms depend only on the hour, so they are rebuilt only when it changes.
    const hour = hourAt(s);
    const ss = sunState(hour);
    const sunDir = tmpSunDir;
    const se = seaMat.uniforms as Record<string, IUniform>;
    if (hour !== lastHour) {
      lastHour = hour;
      const e = Math.max(ss.elev, 0.05) * 1.15;
      sunDir.set(
        Math.cos(e) * Math.sin(ss.azimuth),
        Math.sin(e),
        Math.cos(e) * Math.cos(ss.azimuth),
      );
      sun.color.copy(SUN_DAY).lerp(SUN_WARM, ss.warm);
      sun.intensity = 3.0 * ss.day + 0.05 + ss.warm * ss.day * 1.2;
      moon.intensity = (1 - ss.day) * 0.55;
      hemi.intensity = 0.5 + ss.day * 0.9;
      hemi.color
        .copy(HEMI_SKY)
        .lerp(HEMI_WARM, ss.warm * 0.6)
        .multiplyScalar(0.55 + 0.45 * ss.day);
      hemi.groundColor.copy(HEMI_GROUND).multiplyScalar(0.4 + 0.6 * ss.day);
      const night = 1 - ss.day;

      const top = tmpTop.copy(DAY_COLORS.nightTop).lerp(DAY_COLORS.skyTop, ss.day);
      top.lerp(DAY_COLORS.duskTop, ss.warm * ss.day * 0.65);
      const horizon = tmpHorizon.copy(DAY_COLORS.nightHorizon).lerp(DAY_COLORS.skyHorizon, ss.day);
      horizon.lerp(DAY_COLORS.dusk, ss.warm * (0.25 + 0.55 * ss.day) * (ss.elev > -0.1 ? 1 : 0));
      const sunCol = tmpSun.copy(sun.color).multiplyScalar(ss.day > 0.02 ? 1 : 0);

      const su = skyMat.uniforms as Record<string, IUniform>;
      su.uTop!.value.copy(top);
      su.uHorizon!.value.copy(horizon);
      su.uGlow!.value.copy(DAY_COLORS.dusk).multiplyScalar(ss.warm * ss.day + 0.1);
      su.uSunDir!.value.copy(sunDir);
      su.uSunColor!.value.copy(sunCol);
      su.uNight!.value = night;
      fog.color.copy(horizon).lerp(top, 0.12);
      fog.density = mix(0.017, 0.012, ss.day);

      se.uSunDir!.value.copy(sunDir);
      se.uSunColor!.value.copy(sunCol);
      se.uAbyss!.value.copy(DAY_COLORS.nightAbyss).lerp(DAY_COLORS.abyss, ss.day);
      se.uDeep!.value.copy(DAY_COLORS.nightDeep).lerp(DAY_COLORS.deep, ss.day);
      se.uNight!.value = night;
      se.uWarm!.value = ss.warm * ss.day;
      se.uShallow!.value.copy(DAY_COLORS.nightShallow).lerp(DAY_COLORS.shallow, ss.day);
      se.uTop!.value.copy(top);
      se.uHorizon!.value.copy(horizon);
      se.uFogColor!.value.copy(fog.color);
      se.uFog!.value = fog.density;

      wallMat.emissiveIntensity = night * 0.35;
      windowMat.emissiveIntensity = night * 0.12;
      litWindowMat.emissiveIntensity = night * 1.7;
      stone.emissiveIntensity = night * 0.25;
      glass.emissiveIntensity = night * 1.1;
      boatLamp.intensity = night * 0.9;
      lampMat.color.copy(LAMP).multiplyScalar(0.35 + night * 1.2);
      cloudColor
        .copy(CLOUD_DAY)
        .lerp(CLOUD_WARM, ss.warm * ss.day * 0.8)
        .multiplyScalar(0.25 + 0.75 * ss.day);
      cloudBase = 0.2 + 0.4 * ss.day;
      (steamMat.uniforms.uColor!.value as Color).copy(STEAM).multiplyScalar(0.35 + 0.65 * ss.day);
    }
    sun.position.copy(sunDir).multiplyScalar(40).add(boat.position);
    sun.target.position.copy(boat.position);
    sun.target.updateMatrixWorld();
    se.uTime!.value = motion;
    (se.uBoat!.value as Vector4).set(px, pz, heading, wakeOn);
    boatLamp.position.set(px, 0.2, pz);
    // Route progress and beacons.
    (dotsMat.uniforms as Record<string, IUniform>).uPath!.value = pathCoord;
    const active = b.leg >= 0 ? -1 : b.rest;
    for (let i = 0; i < rings.length; i++) {
      const on = i === active;
      const pulse = on ? 1 + 0.1 * Math.sin(motion * 1.6) : 1;
      rings[i]!.scale.setScalar(pulse * (on ? 1.15 : 0.8));
      ringMats[i]!.opacity = on ? 0.85 : 0.22;
    }

    // Camera.
    const k = Math.min(LAST, Math.floor(s));
    const frac = s - k;
    const dayPose = (d: number) => DAY_POSE[Math.min(DAY_POSE.length - 1, Math.max(0, d - 1))]!;
    let dist: number;
    let pitch: number;
    let offA: number;
    let offB: number;
    let turn = 0;
    if (s <= 1) {
      const t = smooth(0, 1, s);
      const p1 = dayPose(1);
      dist = mix(HERO.dist, p1.dist, t * t * (3 - 2 * t));
      pitch = mix(HERO.pitch, p1.pitch, t);
      offA = p1.off;
      offB = p1.off;
    } else {
      const a = dayPose(k);
      const c = dayPose(Math.min(LAST, k + 1));
      const t = smooth(0.1, 0.9, frac);
      dist = mix(a.dist, c.dist, t);
      pitch = mix(a.pitch, c.pitch, t);
      offA = a.off;
      offB = c.off;
      turn = smooth(0.02, 0.85, frac);
    }
    dist *= camera.aspect < 0.8 ? 1.4 : 1; // portrait phones need more room around the boat
    // Blend the whole camera angle, not heading and side offset apart: at Moni the boat turns round, and two separate swings read as a jump.
    const yawFrom = camFrom + offA;
    const yawTo = turnEnd(yawFrom, camDepart + offB, camTo + offB);
    const yaw = mix(yawFrom, yawTo, turn) + Math.PI + st.yaw;
    let tx = px;
    let tz = pz;
    let ty = 0.12;
    let camYaw = yaw;
    if (s < 1) {
      const t = smooth(0.05, 1, s);
      tx = mix(HERO.tx, px, t);
      tz = mix(HERO.tz, pz, t);
      ty = mix(0, 0.12, t);
      camYaw = lerpAngle(HERO.yaw, yaw, t);
    } else if (s > 7) {
      const t = smooth(0, 1, s - 7);
      tx = mix(px, 4.5, t * 0.55);
      tz = mix(pz, -8, t * 0.55);
      ty = mix(0.12, 0.1, t);
    }
    const cp = Math.min(1.3, Math.max(0.05, pitch + st.pitch));
    const cx = tx + Math.sin(camYaw) * Math.cos(cp) * dist;
    const cz = tz + Math.cos(camYaw) * Math.cos(cp) * dist;
    const floor = Math.max(heightAt(cx, cz), 0) + 0.14;
    const cy = Math.max(ty + Math.sin(cp) * dist, floor);
    camera.position.set(cx, cy, cz);
    // Shift the subject on wide screens by moving the look-at sideways.
    v3.set(tx, ty, tz);
    camera.lookAt(v3);
    camera.updateMatrixWorld();
    if (st.shiftX || st.shiftY) {
      const right = tan.setFromMatrixColumn(camera.matrixWorld, 0);
      const upv = tanPrev.setFromMatrixColumn(camera.matrixWorld, 1);
      const span = 2 * Math.tan((camera.fov * Math.PI) / 360) * Math.max(dist, 0.5);
      v3.addScaledVector(right, st.shiftX * span * camera.aspect).addScaledVector(
        upv,
        -st.shiftY * span,
      );
      camera.lookAt(v3);
      camera.updateMatrixWorld();
    }

    const scale =
      (height / (2 * Math.tan((camera.fov * Math.PI) / 360))) * renderer.getPixelRatio();
    (dotsMat.uniforms as Record<string, IUniform>).uScale!.value = scale;
    const sm = steamMat.uniforms as Record<string, IUniform>;
    sm.uScale!.value = scale;
    sm.uTime!.value = motion;
    se.uCam!.value.copy(camera.position);
    sky.position.copy(camera.position);

    // Clouds drift and wrap; they fade at the wrap edges and when the camera gets close.
    const cam = camera.position;
    let anyCloud = false;
    for (let i = 0; i < CLOUDS; i++) {
      const c = clouds[i]!;
      const u = (((c.x0 - CLOUD_X0 + motion * c.speed) % CLOUD_SPAN) + CLOUD_SPAN) % CLOUD_SPAN;
      const x = CLOUD_X0 + u;
      cloudCenter[i * 3] = x;
      const edge = smooth(0, 8, u) * (1 - smooth(CLOUD_SPAN - 8, CLOUD_SPAN, u));
      const near = smooth(6, 12, Math.hypot(x - cam.x, c.y - cam.y, c.z - cam.z));
      const a = cloudBase * edge * near;
      cloudAlpha[i] = a > 0.01 ? a : 0;
      if (a > 0.01) anyCloud = true;
    }
    cloudCenterAttr.needsUpdate = true;
    cloudAlphaAttr.needsUpdate = true;
    cloudMesh.visible = anyCloud;

    renderer.render(scene, camera);
  }

  return {
    /** Render-resolution factor (0.75 during the dimmed intro); only reallocates when it changes. */
    setDetail(k: number) {
      const next = Math.max(1, baseDpr * k) === baseDpr ? 1 : k;
      if (next === detail) return;
      detail = next;
      renderer.setPixelRatio(Math.max(1, baseDpr * detail));
      renderer.setSize(width, height, false);
    },
    resize(w: number, h: number) {
      width = Math.max(1, w);
      height = Math.max(1, h);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      // A narrower field on portrait phones keeps the boat large.
      camera.fov = camera.aspect < 0.8 ? 58 : 46;
      camera.updateProjectionMatrix();
    },
    frame,
    /** Screen position of a world point, or null if it is behind the camera. */
    project(x: number, y: number, z: number) {
      v3.set(x, y, z).project(camera);
      if (v3.z > 1 || v3.z < -1) return null;
      // One shared result object: read it before the next call.
      projected.x = (v3.x * 0.5 + 0.5) * width;
      projected.y = (-v3.y * 0.5 + 0.5) * height;
      return projected;
    },
    compile() {
      renderer.compile(scene, camera);
    },
    dispose() {
      for (const d of disposables) d.dispose();
      for (const o of [wallMesh, roofMesh]) o.dispose();
      scene.traverse((o) => {
        if (o instanceof InstancedMesh) o.dispose();
      });
      renderer.dispose();
      // Free the GPU context now instead of waiting for garbage collection.
      renderer.forceContextLoss();
    },
  };
}

export type World = ReturnType<typeof createWorld>;
