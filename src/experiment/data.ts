/** Pure data and maths for Greek Sail: copy in two languages, the map, the route and the light. No engine imports, so it is unit-tested. */

export type Lang = "uk" | "en";
export type T = Record<Lang, string>;
export type TL = Record<Lang, string[]>;

export const BASE = `${import.meta.env.BASE_URL}lab/greek-sail`;
export const SOURCE_URL = "https://sea4u.org/tours/greece/";
export const CONTACT = {
  phone: "+38 050 377 1887",
  tel: "+380503771887",
  email: "info@sea4u.org",
  city: { en: "Kharkiv, Ukraine", uk: "Харків, Україна" } satisfies T,
};

// ------------------------------------------------------------------ copy

export type Day = {
  n: number;
  /** Index into STOPS where the boat rests on this day. */
  stop: number;
  /** Local hour of the light in the 3D scene (illustrative). */
  hour: number;
  part: T;
  place: T;
  title: T;
  text: T;
  points: TL;
  photo: string;
};

export const DAYS: Day[] = [
  {
    n: 1,
    stop: 0,
    hour: 17.6,
    part: { en: "Evening", uk: "Вечір" },
    place: { en: "Athens", uk: "Афіни" },
    title: { en: "Welcome aboard", uk: "Ласкаво просимо на борт" },
    text: {
      en: "Land at Athens airport and come to the marina. The first evening is for settling in: your cabin, the crew, a glass in hand.",
      uk: "Прилітаєте до аеропорту Афін і їдете до марини. Перший вечір — щоб влаштуватися: каюта, екіпаж і келих у руці.",
    },
    points: {
      en: [
        "17:00 check-in on the catamaran",
        "Welcome drink",
        "Safety briefing",
        "Dinner on board",
      ],
      uk: [
        "17:00 заселення на катамаран",
        "Вітальний напій",
        "Інструктаж з безпеки",
        "Вечеря на борту",
      ],
    },
    photo: "program-day1.webp",
  },
  {
    n: 2,
    stop: 1,
    hour: 11.6,
    part: { en: "Morning to evening", uk: "Від ранку до вечора" },
    place: { en: "Moni island", uk: "Острів Moni" },
    title: { en: "Wild nature and pine forest", uk: "Дика природа і соснові ліси" },
    text: {
      en: "We leave the marina at 9:00 and drop anchor off a small pine island with clear water. A swim, lunch from the oven and a light Georgian dinner.",
      uk: "О 9:00 виходимо з марини й стаємо на якір біля маленького соснового острова з прозорою водою. Купання, обід із духовки та легка грузинська вечеря.",
    },
    points: {
      en: [
        "09:00 leave the marina for the anchorage",
        "Lunch: baked casserole",
        "Light Georgian dinner",
      ],
      uk: [
        "09:00 вихід із марини до якірної стоянки",
        "Обід: запіканка з духовки",
        "Легка грузинська вечеря",
      ],
    },
    photo: "program-day2.webp",
  },
  {
    n: 3,
    stop: 2,
    hour: 13.6,
    part: { en: "Afternoon", uk: "День" },
    place: { en: "Methana peninsula", uk: "Півострів Methana" },
    title: { en: "Hot springs and a volcano", uk: "Гарячі джерела і вулкан" },
    text: {
      en: "A volcanic peninsula with thermal springs and a view over the whole Saronic Gulf. In the evening the grill comes out.",
      uk: "Вулканічний півострів із термальними джерелами та краєвидом на всю Саронічну затоку. Ввечері запалюємо мангал.",
    },
    points: {
      en: [
        "Hot springs",
        "13:00–19:00 volcano excursion",
        "Lunch: grilled Georgian shawarma",
        "Evening shashlik barbecue",
      ],
      uk: [
        "Гарячі джерела",
        "13:00–19:00 екскурсія на вулкан",
        "Обід: грузинська шаурма на грилі",
        "Ввечері шашлик на мангалі",
      ],
    },
    photo: "program-day3.webp",
  },
  {
    n: 4,
    stop: 3,
    hour: 12.2,
    part: { en: "Day and evening", uk: "День і вечір" },
    place: { en: "Poros", uk: "Острів Poros" },
    title: { en: "Citrus groves and quad bikes", uk: "Цитрусові гаї та квадроцикли" },
    text: {
      en: "Lunch at the chef's café, then an island tour on quad bikes through pines and lemon trees. The evening ends with a shrimp pasta party.",
      uk: "Обід у кафе шефа, а далі огляд острова на квадроциклах крізь сосни та лимонні дерева. Вечір завершує паста з креветками.",
    },
    points: {
      en: ["Lunch at the chef's café", "15:00–19:00 quad bike tour", "Shrimp pasta party"],
      uk: ["Обід у кафе шефа", "15:00–19:00 тур на квадроциклах", "Паста-паті з креветками"],
    },
    photo: "program-day4.webp",
  },
  {
    n: 5,
    stop: 4,
    hour: 17.6,
    part: { en: "Day and dusk", uk: "День і сутінки" },
    place: { en: "Hydra", uk: "Острів Hydra" },
    title: { en: "The island without cars", uk: "Острів без автомобілів" },
    text: {
      en: "A ferry excursion to a car-free island of stone harbours and art. Back on board, the chef rolls khinkali for dinner.",
      uk: "Екскурсія поромом на острів без автомобілів, з кам'яними гаванями та мистецтвом. Назад на борт — а на вечерю шеф ліпить хінкалі.",
    },
    points: {
      en: [
        "Ferry excursion",
        "Walk through the car-free island",
        "Dinner on board: the chef's khinkali",
      ],
      uk: [
        "Екскурсія поромом",
        "Прогулянка островом без авто",
        "Вечеря на борту: хінкалі від шефа",
      ],
    },
    photo: "program-day5.webp",
  },
  {
    n: 6,
    stop: 5,
    hour: 15.4,
    part: { en: "Afternoon", uk: "Після обіду" },
    place: { en: "Aegina", uk: "Острів Aegina" },
    title: { en: "An ancient temple and pistachios", uk: "Давній храм і фісташки" },
    text: {
      en: "An early breakfast, a transfer to the Temple of Aphaia and pistachio groves. Lunch with kebab at the chef's place at 15:00.",
      uk: "Ранній сніданок, трансфер до храму Афаї та фісташкових гаїв. О 15:00 обід із кебабом у шефа.",
    },
    points: {
      en: [
        "Early breakfast and transfer",
        "Temple of Aphaia",
        "Pistachio groves",
        "15:00 lunch with kebab at the chef's place",
      ],
      uk: [
        "Ранній сніданок і трансфер",
        "Храм Афаї",
        "Фісташкові гаї",
        "15:00 обід із кебабом у шефа",
      ],
    },
    photo: "program-day6.webp",
  },
  {
    n: 7,
    stop: 0,
    hour: 19.3,
    part: { en: "Evening", uk: "Вечір" },
    place: { en: "Alimos marina", uk: "Марина Alimos" },
    title: { en: "The last sail and a captain's toast", uk: "Останній перехід і тост капітана" },
    text: {
      en: "Breakfast and lunch on the move as we sail back to Athens. We arrive at 17:00, and at 21:00 the captain's cocktail party closes the trip.",
      uk: "Сніданок і обід у русі, поки повертаємося до Афін. О 17:00 прибуваємо, а о 21:00 коктейль-паті від капітана завершує подорож.",
    },
    points: {
      en: [
        "Breakfast and lunch on the move",
        "17:00 arrival at the marina",
        "21:00 captain's cocktail party",
      ],
      uk: [
        "Сніданок і обід у русі",
        "17:00 прибуття до марини",
        "21:00 коктейль-паті від капітана",
      ],
    },
    photo: "program-day7.webp",
  },
  {
    n: 8,
    stop: 0,
    hour: 9.4,
    part: { en: "Morning", uk: "Ранок" },
    place: { en: "Athens", uk: "Афіни" },
    title: { en: "Farewell, Athens", uk: "До побачення, Афіни" },
    text: {
      en: "A last morning at the marina. You leave the yacht at 10:00 and take the islands home with you.",
      uk: "Останній ранок у марині. О 10:00 залишаєте яхту й забираєте острови з собою.",
    },
    points: { en: ["10:00 leave the yacht"], uk: ["10:00 залишаємо яхту"] },
    photo: "program-day8.webp",
  },
];

export type Feature = { id: string; photo: string; title: T; text: T };
export const FEATURES: Feature[] = [
  {
    id: "ancient",
    photo: "feature-ancient.webp",
    title: { en: "Ancient Greece", uk: "Давня Греція" },
    text: { en: "From the Acropolis to the Temple of Aphaia.", uk: "Від Акрополя до храму Афаї." },
  },
  {
    id: "volcanic",
    photo: "feature-volcanic.webp",
    title: { en: "Volcanic islands", uk: "Вулканічні острови" },
    text: {
      en: "Methana, thermal springs and views of the Saronic Gulf.",
      uk: "Methana, термальні джерела та краєвиди Саронічної затоки.",
    },
  },
  {
    id: "yacht",
    photo: "feature-yacht.webp",
    title: { en: "A real yacht trip", uk: "Справжня яхтова подорож" },
    text: {
      en: "Hidden bays, wild beaches and harbours you can only reach by sea.",
      uk: "Сховані бухти, дикі пляжі та гавані, куди дістатися можна лише морем.",
    },
  },
  {
    id: "lagoon",
    photo: "feature-lagoon.webp",
    title: { en: "Turquoise lagoons", uk: "Бірюзові лагуни" },
    text: {
      en: "Moni, clear water and islands covered in pines.",
      uk: "Moni, прозора вода та острови, вкриті соснами.",
    },
  },
  {
    id: "georgia",
    photo: "feature-georgia.webp",
    title: { en: "Georgia on your plate", uk: "Грузія на тарілці" },
    text: {
      en: "Georgian food, homemade wine and hospitality.",
      uk: "Грузинська кухня, домашнє вино та гостинність.",
    },
  },
];

export const INCLUDED: TL = {
  en: [
    "Georgian cuisine from the head chef, plus Greek tavernas",
    "A small group on a catamaran: up to 8 guests",
    "Excursions and history visits",
    "Snorkelling from the yacht",
    "Quad bike rides on island roads",
    "A sunset every day",
  ],
  uk: [
    "Грузинська кухня від шеф-кухаря та грецькі таверни",
    "Мала група на катамарані: до 8 гостей",
    "Екскурсії та історичні відвідини",
    "Снорклінг із яхти",
    "Поїздки на квадроциклах острівними дорогами",
    "Захід сонця щодня",
  ],
};

export const TEAM = [
  {
    id: "serhii",
    photo: "captain-1.jpg",
    name: { en: "Serhii Fedorenko", uk: "Сергій Федоренко" } satisfies T,
    role: { en: "IYT Yachtmaster, Sea4U captain", uk: "Яхтмастер IYT, капітан Sea4U" } satisfies T,
  },
  {
    id: "andrii",
    photo: "captain-2.jpg",
    name: { en: "Andrii Shpetnyi", uk: "Андрій Шпетний" } satisfies T,
    role: {
      en: "ISSA yachting instructor, fleet coordinator",
      uk: "Інструктор з яхтингу ISSA, координатор флоту",
    } satisfies T,
  },
];

export const UI = {
  brand: { en: "Sea4U · Greece 2027", uk: "Sea4U · Греція 2027" },
  badge: { en: "Greece, 2027 · announcement soon", uk: "Греція, 2027 · скоро анонс" },
  heroTitle: {
    en: "Georgian cuisine and the islands of Greece",
    uk: "Грузинська кухня та острови Греції",
  },
  heroSub: {
    en: "A yacht tour of the Saronic Islands with Georgian cuisine from our head chef.",
    uk: "Яхтовий тур Саронічними островами з грузинською кухнею від нашого шеф-кухаря.",
  },
  facts: {
    en: ["8 days", "up to 8 guests", "catamaran"],
    uk: ["8 днів", "до 8 гостей", "катамаран"],
  } satisfies TL,
  book: { en: "Book a place", uk: "Забронювати місце" },
  scroll: { en: "Scroll to set sail", uk: "Прокрутіть, щоб вирушити" },
  chapters: { en: "Chapters", uk: "Розділи" },
  language: { en: "Language", uk: "Мова" },
  day: { en: "Day", uk: "День" },
  intro: { en: "Start", uk: "Старт" },
  route: { en: "Route", uk: "Маршрут" },
  routeDays: { en: "8 days", uk: "8 днів" },
  routeList: { en: "Days of the voyage", uk: "Дні подорожі" },
  routeOpen: { en: "Show all days of the route", uk: "Показати всі дні маршруту" },
  close: { en: "Close", uk: "Закрити" },
  whyKicker: { en: "Why this route", uk: "Чому цей маршрут" },
  whyTitle: {
    en: "Two cultures, two coasts, one journey",
    uk: "Дві культури, два береги, одна подорож",
  },
  includedTitle: { en: "What is on board", uk: "Що на борту" },
  teamKicker: { en: "Your crew", uk: "Ваш екіпаж" },
  teamTitle: {
    en: "Sailing with people who do this for a living",
    uk: "Мандруєте з тими, для кого це справа життя",
  },
  ctaKicker: { en: "Book", uk: "Бронювання" },
  ctaTitle: { en: "Ready to join the tour?", uk: "Готові стати частиною туру?" },
  ctaText: {
    en: "Tours run now and then and are not always announced far ahead. Send a request and a manager will reply within 24 hours to answer questions and take your booking.",
    uk: "Тури відбуваються нечасто й не завжди анонсуються заздалегідь. Залиште запит, і менеджер відповість протягом 24 годин: відповість на запитання та прийме бронювання.",
  },
  priceNote: {
    en: "Price and dates are not published yet.",
    uk: "Ціна й дати ще не опубліковані.",
  },
  name: { en: "Your name", uk: "Ваше ім'я" },
  contact: { en: "Phone or email", uk: "Телефон або email" },
  guests: { en: "Guests", uk: "Кількість гостей" },
  message: { en: "Message (optional)", uk: "Повідомлення (необов'язково)" },
  send: { en: "Send request by email", uk: "Надіслати запит поштою" },
  sent: {
    en: "Your mail app should open with the request ready to send. Nothing is sent from this page.",
    uk: "Має відкритися поштова програма з готовим листом. Ця сторінка нічого не надсилає сама.",
  },
  credit: {
    en: "A 3D concept redesign of the Sea4U tour page. Text facts and photos come from",
    uk: "3D-концепт редизайну сторінки туру Sea4U. Факти й фото взято з",
  },
  sail: { en: "Sailing", uk: "У дорозі" },
  noWebgl: {
    en: "The 3D map needs WebGL; the full itinerary below works without it.",
    uk: "3D-карті потрібен WebGL; повна програма нижче працює й без нього.",
  },
  alt: {
    photoDay: { en: "Day {n}: {place}", uk: "День {n}: {place}" },
    hero: {
      en: "A white catamaran at anchor in a turquoise bay below a Greek island village",
      uk: "Білий катамаран на якорі в бірюзовій бухті біля грецького острівного села",
    },
  },
} satisfies Record<string, unknown>;

/** Read a translated string. */
export const tr = (t: T, lang: Lang) => t[lang];

// ------------------------------------------------------------------ stops and route

export type Stop = { id: string; name: T; x: number; z: number; days: number[] };

/** Where the boat rests. Coordinates are map units (about 2 km each), x east, z south. */
export const STOPS: Stop[] = [
  { id: "alimos", name: { en: "Alimos marina", uk: "Alimos" }, x: 9.0, z: -13.7, days: [1, 7, 8] },
  { id: "moni", name: { en: "Moni", uk: "Moni" }, x: -5.15, z: -2.0, days: [2] },
  { id: "methana", name: { en: "Methana", uk: "Methana" }, x: -1.9, z: 2.6, days: [3] },
  { id: "poros", name: { en: "Poros", uk: "Poros" }, x: -0.25, z: 6.3, days: [4] },
  { id: "hydra", name: { en: "Hydra", uk: "Hydra" }, x: -0.6, z: 14.4, days: [5] },
  { id: "aegina", name: { en: "Aegina", uk: "Aegina" }, x: -2.6, z: -8.1, days: [6] },
];

/** Open-water points between two stops: leg i runs from STOPS[i] to STOPS[i + 1] (the last leg returns to STOPS[0]). */
export const VIA: [number, number][][] = [
  [
    [6.6, -9.6],
    [4.9, -4.6],
    [3.4, -0.2],
    [0.4, 1.0],
    [-2.9, 0.1],
  ],
  [
    [-3.2, -0.6],
    [-2.0, 0.7],
  ],
  [[-1.2, 4.4]],
  [
    [0.9, 8.6],
    [1.1, 11.8],
  ],
  [
    [1.4, 11.4],
    [2.7, 6.5],
    [4.2, 1.5],
    [5.1, -4.2],
    [3.7, -8.6],
    [0.7, -9.2],
  ],
  [
    [1.6, -10.3],
    [5.5, -11.6],
  ],
];

/** Points of leg i, stop to stop. */
export function legPoints(i: number): [number, number][] {
  const a = STOPS[i]!;
  const b = STOPS[(i + 1) % STOPS.length]!;
  return [[a.x, a.z], ...VIA[i]!, [b.x, b.z]];
}

export const STEPS = ["intro", ...DAYS.map((d) => `day-${d.n}`)] as const;
export const LAST = STEPS.length - 1;

/** The boat holds still near a day and sails in the middle of the scroll between two days; a smootherstep so it eases off and arrives gently. */
export const hold = (f: number) => {
  const t = Math.min(1, Math.max(0, (f - 0.14) / 0.72));
  return t * t * t * (t * (t * 6 - 15) + 10);
};

/** Where the boat is on the story timeline: s = 0 is the intro, s = n is day n. */
export function boatAt(s: number): { leg: number; f: number; rest: number } {
  const clamped = Math.min(LAST, Math.max(0, s));
  if (clamped < 1) return { leg: -1, f: 0, rest: 0 };
  const k = Math.min(LAST - 1, Math.floor(clamped)); // day k -> day k + 1
  const here = DAYS[k - 1]!.stop;
  const next = DAYS[k]!.stop;
  if (here === next) return { leg: -1, f: 0, rest: here };
  return { leg: here, f: hold(clamped - k), rest: here };
}

/** Local hour of the light along the story. */
export function hourAt(s: number): number {
  const c = Math.min(LAST, Math.max(0, s));
  if (c < 1) return DAYS[0]!.hour - (1 - c) * 1.2;
  const k = Math.min(LAST - 1, Math.floor(c));
  const a = DAYS[k - 1]!.hour;
  const b = DAYS[k]!.hour;
  const f = hold(c - k);
  return a + (b - a) * f;
}

export const clock = (h: number) => {
  const m = Math.round(h * 60);
  return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/** Sun height 0..1 (0 at night) and warmth 0..1 (1 near the horizon) for an hour of the day. */
export function sunState(hour: number) {
  const a = ((hour - 6) / 13) * Math.PI; // 6:00 sunrise, 19:00 sunset
  const elev = Math.sin(a);
  return {
    elev,
    day: Math.min(1, Math.max(0, elev * 3)),
    warm: Math.min(1, Math.max(0, 1 - elev * 1.6)),
    azimuth: -1.9 + (hour / 24) * 2.4,
  };
}

// ------------------------------------------------------------------ the map

/** Terrain domain, in map units. */
export const DOMAIN = { x0: -16, x1: 17, z0: -21, z1: 24 };

const hash = (x: number, y: number) => {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

export function noise(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export const fbm = (x: number, y: number) =>
  (0.5 * noise(x, y) +
    0.25 * noise(x * 2.1 + 5.2, y * 2.1 + 1.3) +
    0.125 * noise(x * 4.3 + 9.1, y * 4.3 + 7.7) +
    0.0625 * noise(x * 8.7 + 2.9, y * 8.7 + 4.1)) /
  0.9375;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

type Isle = { id: string; x: number; z: number; rx: number; rz: number; rot: number; h: number };
export const ISLES: Isle[] = [
  { id: "aegina", x: -0.5, z: -5, rx: 3.1, rz: 2.5, rot: 0.3, h: 0.62 },
  { id: "moni", x: -6.7, z: -2.2, rx: 0.72, rz: 0.6, rot: 0.2, h: 0.2 },
  { id: "methana", x: -6.0, z: 2.8, rx: 3.3, rz: 1.9, rot: -0.15, h: 0.52 },
  { id: "poros", x: -1.75, z: 8.3, rx: 1.4, rz: 0.85, rot: -0.35, h: 0.36 },
  { id: "hydra", x: -1.3, z: 16.6, rx: 3.9, rz: 0.95, rot: -0.3, h: 0.95 },
  { id: "salamis", x: 3.4, z: -15.4, rx: 1.8, rz: 0.9, rot: 0.2, h: 0.28 },
  { id: "agistri", x: -4.6, z: -7.6, rx: 0.8, rz: 0.6, rot: 0.5, h: 0.22 },
  { id: "acropolis", x: 5.2, z: -17.4, rx: 0.42, rz: 0.32, rot: 0.4, h: 0.3 },
];

const isleHeight = (i: Isle, x: number, z: number) => {
  const dx = x - i.x;
  const dz = z - i.z;
  const c = Math.cos(i.rot);
  const s = Math.sin(i.rot);
  const u = (dx * c + dz * s) / i.rx;
  const v = (-dx * s + dz * c) / i.rz;
  let q = Math.sqrt(u * u + v * v);
  q *= 1 + 0.34 * (fbm(x * 0.8 + i.rx * 7, z * 0.8 + i.rz * 3) - 0.5);
  if (q >= 1) return -1;
  const body = i.h * Math.pow(1 - Math.pow(q, 1.7), 1.05) * (0.72 + 0.56 * fbm(x * 2.3, z * 2.3));
  return body - 0.02;
};

const coastX = (z: number) =>
  -8.6 + 5.2 * smooth(3.5, 8, z) - 3.0 * smooth(12, 19, z) + 2.4 * (fbm(z * 0.55, 3.3) - 0.5);
const coastZ = (x: number) =>
  -17.6 + 0.55 * Math.max(0, x - 4) + 1.4 * (fbm(x * 0.5, 7.7) - 0.5) * smooth(-6, 6, x);

/** Terrain height at a point; sea level is 0, anything below is under water. */
export function heightAt(x: number, z: number): number {
  let h = -0.08;
  for (const i of ISLES) h = Math.max(h, isleHeight(i, x, z));
  // The Methana volcano with its crater.
  const dv = Math.hypot(x + 5.4, z - 2.9);
  h += 0.34 * Math.exp(-((dv / 0.75) ** 2)) - 0.1 * Math.exp(-((dv / 0.17) ** 2));
  // Peloponnese on the west side.
  const tw = coastX(z) - x;
  if (tw > 0) {
    h = Math.max(h, 1.0 * (1 - Math.exp(-tw / 3.2)) * (0.55 + 0.9 * fbm(x * 0.5, z * 0.5)) - 0.03);
  }
  // Attica in the north.
  const tn = coastZ(x) - z;
  if (tn > 0) {
    h = Math.max(
      h,
      0.75 * (1 - Math.exp(-tn / 2.2)) * (0.55 + 0.9 * fbm(x * 0.55, z * 0.55)) - 0.03,
    );
  }
  // The map ends in open sea: land sinks away from the borders instead of being cut off.
  const edge = Math.min(x - DOMAIN.x0, DOMAIN.x1 - x, z - DOMAIN.z0, DOMAIN.z1 - z);
  if (edge < 3.5) h -= 1.3 * (1 - smooth(0, 3.5, edge));
  return h;
}

export const isLand = (x: number, z: number) => heightAt(x, z) > 0;
