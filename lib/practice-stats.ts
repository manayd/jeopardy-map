/**
 * Judgment logging — the signal layer behind the weak-spots dashboard.
 *
 * Every graded interaction (flashcard self-grade, multiple-choice pick,
 * typed answer, daily-quiz answer) records one judgment. Stats are stored
 * per deck under their own localStorage key so writes stay small, with
 * per-card counters capped and pruned by recency. This is also the
 * foundation for spaced-repetition scheduling later: each card carries
 * attempts, misses, and last-seen timestamps.
 */

export type JudgmentMode = "flashcards" | "multiple-choice" | "typed" | "daily";

export type CardStat = {
  prompt: string;
  answer: string;
  attempts: number;
  misses: number;
  last: number;
};

export type ModeStat = {
  attempts: number;
  correct: number;
};

export type DeckStats = {
  version: 1;
  slug: string;
  title: string;
  attempts: number;
  correct: number;
  byMode: Partial<Record<JudgmentMode, ModeStat>>;
  lastPracticed: number;
  cards: Record<string, CardStat>;
};

const PREFIX = "jeopardy-map:stats:";
const MAX_CARDS_PER_DECK = 400;
const PROMPT_SNIPPET = 110;
const ANSWER_SNIPPET = 70;

function cardKey(prompt: string): string {
  let hash = 2166136261;
  for (let i = 0; i < prompt.length; i += 1) {
    hash ^= prompt.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function loadDeckStats(slug: string): DeckStats | null {
  try {
    const raw = window.localStorage.getItem(`${PREFIX}${slug}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DeckStats;
    if (parsed?.version !== 1 || typeof parsed.cards !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveDeckStats(stats: DeckStats) {
  try {
    window.localStorage.setItem(`${PREFIX}${stats.slug}`, JSON.stringify(stats));
  } catch {
    // storage full or blocked — practice keeps working without stats
  }
}

function pruneCards(cards: Record<string, CardStat>) {
  const keys = Object.keys(cards);
  if (keys.length <= MAX_CARDS_PER_DECK) return;
  keys
    .sort((a, b) => cards[a].last - cards[b].last)
    .slice(0, keys.length - MAX_CARDS_PER_DECK)
    .forEach((key) => delete cards[key]);
}

export function recordJudgment(input: {
  slug: string;
  title: string;
  mode: JudgmentMode;
  prompt: string;
  answer: string;
  correct: boolean;
}) {
  if (typeof window === "undefined") return;
  const now = Date.now();
  const stats: DeckStats = loadDeckStats(input.slug) ?? {
    version: 1,
    slug: input.slug,
    title: input.title,
    attempts: 0,
    correct: 0,
    byMode: {},
    lastPracticed: now,
    cards: {},
  };

  stats.title = input.title;
  stats.attempts += 1;
  if (input.correct) stats.correct += 1;
  stats.lastPracticed = now;

  const modeStat = stats.byMode[input.mode] ?? { attempts: 0, correct: 0 };
  modeStat.attempts += 1;
  if (input.correct) modeStat.correct += 1;
  stats.byMode[input.mode] = modeStat;

  const key = cardKey(input.prompt);
  const card = stats.cards[key] ?? {
    prompt: input.prompt.slice(0, PROMPT_SNIPPET),
    answer: input.answer.slice(0, ANSWER_SNIPPET),
    attempts: 0,
    misses: 0,
    last: now,
  };
  card.attempts += 1;
  if (!input.correct) card.misses += 1;
  card.last = now;
  stats.cards[key] = card;
  pruneCards(stats.cards);

  saveDeckStats(stats);
}

/**
 * The typed-answer judge sometimes marks a right answer wrong; the user can
 * overrule it. Flip the most recent judgment for this card to correct.
 */
export function amendJudgmentToCorrect(input: {
  slug: string;
  mode: JudgmentMode;
  prompt: string;
}) {
  if (typeof window === "undefined") return;
  const stats = loadDeckStats(input.slug);
  if (!stats) return;

  stats.correct += 1;
  const modeStat = stats.byMode[input.mode];
  if (modeStat) modeStat.correct += 1;

  const card = stats.cards[cardKey(input.prompt)];
  if (card && card.misses > 0) card.misses -= 1;

  saveDeckStats(stats);
}

export function loadAllDeckStats(): DeckStats[] {
  if (typeof window === "undefined") return [];
  const out: DeckStats[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key?.startsWith(PREFIX)) continue;
      const stats = loadDeckStats(key.slice(PREFIX.length));
      if (stats) out.push(stats);
    }
  } catch {
    return out;
  }
  return out;
}

/** Raw serialized form of all stats keys — stable snapshot for useSyncExternalStore. */
export function statsSnapshot(): string {
  if (typeof window === "undefined") return "";
  const parts: string[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key?.startsWith(PREFIX)) continue;
      parts.push(`${key}=${window.localStorage.getItem(key) ?? ""}`);
    }
  } catch {
    return "";
  }
  return parts.sort().join("\n");
}

/** Where to practice a deck, given its stats slug. */
export function practiceHrefForSlug(slug: string): string {
  if (slug === "daily") return "/daily";
  if (slug.startsWith("topic-")) {
    return `/practice/topic/${encodeURIComponent(slug.slice("topic-".length))}`;
  }
  return `/practice/${slug}`;
}
