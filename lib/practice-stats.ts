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

export type JudgmentMode =
  | "flashcards"
  | "multiple-choice"
  | "typed"
  | "daily"
  | "review";

export type CardStat = {
  prompt: string;
  answer: string;
  attempts: number;
  misses: number;
  last: number;
  /** Leitner box 1-5; missing on records from before scheduling existed. */
  box?: number;
  /** Timestamp when this card is due for review. */
  due?: number;
  /** Jeopardy metadata, present for clue-based cards (topic decks, Daily 10). */
  category?: string;
  value?: number;
  round?: number;
  airDate?: string;
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
  /** Set when the user first completes a full flashcard run of this deck. */
  completedAt?: number;
  /**
   * Manual override for spaced-review eligibility. When set it wins over the
   * default rule (daily always in; other decks join once completed).
   */
  reviewOptIn?: boolean;
};

const PREFIX = "jeopardy-map:stats:";
const MAX_CARDS_PER_DECK = 400;
// Stored prompt/answer must be long enough to re-drill the card from the
// review queue (the answer also feeds the fuzzy judge there).
const PROMPT_SNIPPET = 280;
const ANSWER_SNIPPET = 120;

/** Leitner intervals in days, indexed by box-1. Miss → box 1, correct → up. */
const BOX_INTERVALS_DAYS = [1, 3, 7, 14, 30];
const DAY_MS = 86_400_000;

function reschedule(card: CardStat, correct: boolean, now: number) {
  const box = correct ? Math.min((card.box ?? 1) + 1, BOX_INTERVALS_DAYS.length) : 1;
  card.box = box;
  card.due = now + BOX_INTERVALS_DAYS[box - 1] * DAY_MS;
}

function cardKey(prompt: string): string {
  let hash = 2166136261;
  for (let i = 0; i < prompt.length; i += 1) {
    hash ^= prompt.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Whether a deck's cards belong in the spaced-review queue.
 *
 * Default rule: the daily quiz is always in (its clues are one-shot
 * encounters with no other home), while practice decks join once the user
 * has completed a full flashcard run — until then the deck's own
 * round-based loop is the study surface and review would just duplicate
 * it. A manual opt-in/out override always wins.
 */
export function isReviewEligible(deck: DeckStats): boolean {
  if (deck.reviewOptIn !== undefined) return deck.reviewOptIn;
  if (deck.slug === "daily") return true;
  return deck.completedAt !== undefined;
}

/** Effective review eligibility for a deck by slug (false when no stats yet). */
export function getDeckReviewEligibility(slug: string): boolean {
  if (typeof window === "undefined") return false;
  const stats = loadDeckStats(slug);
  if (!stats) return slug === "daily";
  return isReviewEligible(stats);
}

const emptyDeckStats = (slug: string, title: string): DeckStats => ({
  version: 1,
  slug,
  title,
  attempts: 0,
  correct: 0,
  byMode: {},
  lastPracticed: Date.now(),
  cards: {},
});

/** Record that the user completed a full flashcard run (first time only). */
export function markDeckCompleted(slug: string, title: string) {
  if (typeof window === "undefined") return;
  const stats = loadDeckStats(slug) ?? emptyDeckStats(slug, title);
  if (stats.completedAt !== undefined) return;
  stats.completedAt = Date.now();
  saveDeckStats(stats);
}

/** Manually pull a deck into or out of the spaced-review rotation. */
export function setDeckReviewOptIn(slug: string, title: string, optIn: boolean) {
  if (typeof window === "undefined") return;
  const stats = loadDeckStats(slug) ?? emptyDeckStats(slug, title);
  stats.reviewOptIn = optIn;
  saveDeckStats(stats);
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
  /** Jeopardy metadata for clue-based cards (topic decks, Daily 10). */
  category?: string;
  value?: number;
  round?: number;
  airDate?: string;
  /**
   * Explicit card key. The review queue re-records judgments from STORED
   * (truncated) prompts whose hash differs from the original — passing the
   * stored key keeps the judgment on the same card instead of forking it.
   */
  key?: string;
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

  const key = input.key ?? cardKey(input.prompt);
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
  // Backfill metadata so older cards pick it up the next time they're seen.
  if (input.category !== undefined) card.category = input.category;
  if (input.value !== undefined) card.value = input.value;
  if (input.round !== undefined) card.round = input.round;
  if (input.airDate !== undefined) card.airDate = input.airDate;
  reschedule(card, input.correct, now);
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
  key?: string;
}) {
  if (typeof window === "undefined") return;
  const stats = loadDeckStats(input.slug);
  if (!stats) return;

  stats.correct += 1;
  const modeStat = stats.byMode[input.mode];
  if (modeStat) modeStat.correct += 1;

  const card = stats.cards[input.key ?? cardKey(input.prompt)];
  if (card) {
    if (card.misses > 0) card.misses -= 1;
    // The miss sent this card to box 1; the answer was actually right, so
    // promote it as a correct answer would have (from wherever box 1 is).
    reschedule(card, true, Date.now());
  }

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

export type DueCard = {
  deckSlug: string;
  deckTitle: string;
  key: string;
  prompt: string;
  answer: string;
  box: number;
  due: number;
  attempts: number;
  misses: number;
  category?: string;
  value?: number;
  round?: number;
  airDate?: string;
};

/** All scheduled cards now due from review-eligible decks, most overdue first. */
export function loadDueCards(now = Date.now()): DueCard[] {
  const out: DueCard[] = [];
  for (const deck of loadAllDeckStats()) {
    if (!isReviewEligible(deck)) continue;
    for (const [key, card] of Object.entries(deck.cards)) {
      if (card.due === undefined || card.due > now) continue;
      out.push({
        deckSlug: deck.slug,
        deckTitle: deck.title,
        key,
        prompt: card.prompt,
        answer: card.answer,
        box: card.box ?? 1,
        due: card.due,
        attempts: card.attempts,
        misses: card.misses,
        category: card.category,
        value: card.value,
        round: card.round,
        airDate: card.airDate,
      });
    }
  }
  return out.sort((a, b) => a.due - b.due);
}

/** True if any card in a deck is missing its Jeopardy metadata. */
export function deckCardsMissingMeta(slug: string): boolean {
  const stats = loadDeckStats(slug);
  if (!stats) return false;
  return Object.values(stats.cards).some(
    (card) => card.category === undefined || card.airDate === undefined,
  );
}

/**
 * Fill in category/value/round on stored cards that predate metadata capture,
 * matching by prompt. Used to backfill Daily 10 cards from the deterministic
 * date-seeded quiz. Returns how many cards were updated.
 */
export function backfillCardMeta(
  slug: string,
  entries: Array<{
    prompt: string;
    category?: string;
    value?: number;
    round?: number;
    airDate?: string;
  }>,
): number {
  if (typeof window === "undefined") return 0;
  const stats = loadDeckStats(slug);
  if (!stats) return 0;
  let updated = 0;
  for (const entry of entries) {
    const card = stats.cards[cardKey(entry.prompt)];
    if (!card) continue;
    const needsCategory = card.category === undefined && entry.category !== undefined;
    const needsDate = card.airDate === undefined && entry.airDate !== undefined;
    if (needsCategory) {
      card.category = entry.category;
      card.value = entry.value;
      card.round = entry.round;
    }
    if (needsDate) card.airDate = entry.airDate;
    if (needsCategory || needsDate) updated += 1;
  }
  if (updated > 0) saveDeckStats(stats);
  return updated;
}

/** Timestamp of the next scheduled review after `now`, or null if none. */
export function nextDueAt(now = Date.now()): number | null {
  let next: number | null = null;
  for (const deck of loadAllDeckStats()) {
    if (!isReviewEligible(deck)) continue;
    for (const card of Object.values(deck.cards)) {
      if (card.due === undefined || card.due <= now) continue;
      if (next === null || card.due < next) next = card.due;
    }
  }
  return next;
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
