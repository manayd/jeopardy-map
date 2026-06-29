export type DailyAnswer = {
  guess: string;
  verdict: "correct" | "incorrect";
};

export type DailyResult = {
  version: 1;
  date: string;
  answers: DailyAnswer[];
  completedAt?: string;
};

export type DailyStreak = {
  version: 1;
  lastPlayed: string;
  streak: number;
  bestStreak: number;
};

const RESULT_PREFIX = "jeopardy-map:daily:";
const STREAK_KEY = "jeopardy-map:daily-streak";

export function localDateString(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function loadDailyResult(date: string): DailyResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${RESULT_PREFIX}${date}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DailyResult;
    if (parsed?.version !== 1 || !Array.isArray(parsed.answers)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export type DailyDay = {
  date: string;
  score: number;
  total: number;
  completed: boolean;
};

const DAILY_QUIZ_SIZE = 10;

/** One entry per day the user has any saved Daily 10 result for. */
export function loadDailyHistory(): Map<string, DailyDay> {
  const out = new Map<string, DailyDay>();
  if (typeof window === "undefined") return out;
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key?.startsWith(RESULT_PREFIX)) continue;
      const date = key.slice(RESULT_PREFIX.length);
      const result = loadDailyResult(date);
      if (!result) continue;
      const score = result.answers.filter((a) => a.verdict === "correct").length;
      const total = result.answers.length;
      out.set(date, {
        date,
        score,
        total,
        completed: Boolean(result.completedAt) || total >= DAILY_QUIZ_SIZE,
      });
    }
  } catch {
    return out;
  }
  return out;
}

/** Stable serialized form of the daily history, for useSyncExternalStore. */
export function dailyHistorySnapshot(): string {
  if (typeof window === "undefined") return "";
  const parts: string[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key?.startsWith(RESULT_PREFIX)) continue;
      parts.push(`${key}=${window.localStorage.getItem(key) ?? ""}`);
    }
  } catch {
    return "";
  }
  return parts.sort().join("\n");
}

export function saveDailyResult(result: DailyResult) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      `${RESULT_PREFIX}${result.date}`,
      JSON.stringify(result),
    );
  } catch {
    // quiz still playable without persistence
  }
}

export function loadDailyStreak(): DailyStreak | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STREAK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DailyStreak;
    if (parsed?.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

function previousDateString(date: string): string {
  const noon = new Date(`${date}T12:00:00`);
  noon.setDate(noon.getDate() - 1);
  return localDateString(noon);
}

/**
 * Record that today's quiz was completed. Consecutive days extend the
 * streak; a gap resets it to 1. Idempotent for the same date.
 */
export function recordDailyPlay(date: string): DailyStreak {
  const existing = loadDailyStreak();
  if (existing && existing.lastPlayed === date) return existing;

  const continued = existing?.lastPlayed === previousDateString(date);
  const streak = continued ? existing!.streak + 1 : 1;
  const next: DailyStreak = {
    version: 1,
    lastPlayed: date,
    streak,
    bestStreak: Math.max(streak, existing?.bestStreak ?? 0),
  };
  try {
    window.localStorage.setItem(STREAK_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}
