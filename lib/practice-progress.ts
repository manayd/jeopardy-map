export type FlashcardProgress = {
  version: 1;
  title: string;
  deckSize: number;
  reviewQueue: number[];
  queueIndex: number;
  needAgainQueue: number[];
  round: number;
  knownThisRound: number;
  reviewThisRound: number;
  roundComplete: boolean;
  completed: boolean;
  updatedAt: string;
};

const STORAGE_PREFIX = "jeopardy-map:practice:";
const DIRECTION_PREFIX = "jeopardy-map:flash-dir:";

export const flashcardProgressKey = (slug: string) => `${STORAGE_PREFIX}${slug}`;

export type FlashDirection = "forward" | "reverse";

export function loadFlashDirection(slug: string): FlashDirection {
  if (typeof window === "undefined") return "forward";
  try {
    return window.localStorage.getItem(`${DIRECTION_PREFIX}${slug}`) === "reverse"
      ? "reverse"
      : "forward";
  } catch {
    return "forward";
  }
}

export function saveFlashDirection(slug: string, direction: FlashDirection) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${DIRECTION_PREFIX}${slug}`, direction);
  } catch {
    // direction just won't persist; flashcards still flip for this session
  }
}

export function parseFlashcardProgress(raw: string | null): FlashcardProgress | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as FlashcardProgress;
    if (parsed?.version !== 1) return null;
    if (!Array.isArray(parsed.reviewQueue) || !Array.isArray(parsed.needAgainQueue)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function loadFlashcardProgress(slug: string): FlashcardProgress | null {
  if (typeof window === "undefined") return null;
  try {
    return parseFlashcardProgress(window.localStorage.getItem(flashcardProgressKey(slug)));
  } catch {
    return null;
  }
}

export function saveFlashcardProgress(slug: string, progress: FlashcardProgress) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(flashcardProgressKey(slug), JSON.stringify(progress));
  } catch {
    // Storage full or blocked — practice still works, just without resume.
  }
}

export function clearFlashcardProgress(slug: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(flashcardProgressKey(slug));
  } catch {
    // ignore
  }
}
