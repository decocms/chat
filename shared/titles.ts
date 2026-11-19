// Titles a person earns from what they and their agents did (Gui #3526): each axis has tiers at thresholds, and the
// headline title is the tier name plus the noun of the person's strongest axis ("Grandmaster Tokensmith"), the way old
// online RPGs named a character after their best skill. Browser-safe: no imports.

export type Axis = "tokens" | "messages" | "deploys" | "limits";
export type Stats = Record<Axis, number>;
type Lang = "pt" | "en";

/** The order decides ties: an equal tier goes to the earlier axis. */
export const AXES: readonly Axis[] = [
  "tokens",
  "deploys",
  "messages",
  "limits",
];

/** Minimum value for each tier, tier 0 included. Same length for every axis. */
export const THRESHOLDS: Record<Axis, readonly number[]> = {
  tokens: [0, 1e6, 1e7, 5e7, 2e8, 1e9, 5e9, 2e10],
  messages: [0, 25, 100, 500, 2_000, 8_000, 25_000, 100_000],
  deploys: [0, 1, 5, 20, 75, 250, 750, 2_500],
  limits: [0, 1, 3, 10, 25, 60, 150, 400],
};

const TIERS: Record<Lang, readonly string[]> = {
  en: [
    "Neophyte",
    "Apprentice",
    "Journeyman",
    "Expert",
    "Adept",
    "Master",
    "Grandmaster",
    "Legendary",
  ],
  pt: [
    "Neófito",
    "Aprendiz",
    "Oficial",
    "Perito",
    "Adepto",
    "Mestre",
    "Grão-mestre",
    "Lendário",
  ],
};
const NOUNS: Record<Lang, Record<Axis, string>> = {
  en: {
    tokens: "Tokensmith",
    deploys: "Shipwright",
    messages: "Orator",
    limits: "Limit Breaker",
  },
  pt: {
    tokens: "Forjador de tokens",
    deploys: "Lançador",
    messages: "Orador",
    limits: "Quebra-limites",
  },
};

export type AxisRank = {
  axis: Axis;
  value: number;
  tier: number;
  tierName: string;
  noun: string;
  /** The next tier's threshold, or null at the top. */
  next: number | null;
  /** 0..1 of the way from this tier's threshold to the next (1 at the top). */
  progress: number;
};

export function rank(axis: Axis, value: number, lang: Lang = "en"): AxisRank {
  const t = THRESHOLDS[axis];
  const v = Math.max(0, Number.isFinite(value) ? value : 0);
  let tier = 0;
  while (tier + 1 < t.length && v >= t[tier + 1]!) tier++;
  const next = tier + 1 < t.length ? t[tier + 1]! : null;
  const progress = next === null ? 1 : (v - t[tier]!) / (next - t[tier]!);
  return {
    axis,
    value: v,
    tier,
    tierName: TIERS[lang][tier]!,
    noun: NOUNS[lang][axis],
    next,
    progress,
  };
}

/** Every axis ranked, and the headline title from the strongest one. */
export function titleFor(stats: Stats, lang: Lang = "en") {
  const ranks = AXES.map((a) => rank(a, stats[a], lang));
  const best = ranks.reduce((b, r) => (r.tier > b.tier ? r : b), ranks[0]!);
  const title =
    lang === "pt"
      ? `${best.noun} ${best.tierName}`
      : `${best.tierName} ${best.noun}`;
  return { title, best, ranks, tiers: TIERS[lang].length };
}

/** 1234567 → "1.2M": the big numbers on a profile. */
export function compact(n: number) {
  const units: [number, string][] = [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "k"],
  ];
  for (const [d, u] of units)
    if (n >= d)
      return `${(n / d).toFixed(n / d >= 100 ? 0 : 1).replace(/\.0$/, "")}${u}`;
  return String(Math.round(n));
}
