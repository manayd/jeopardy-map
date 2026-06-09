"use client";

import { useSyncExternalStore } from "react";
import { flashcardProgressKey, parseFlashcardProgress } from "@/lib/practice-progress";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

export function DeckProgressChip({ slug }: { slug: string }) {
  const raw = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return window.localStorage.getItem(flashcardProgressKey(slug));
      } catch {
        return null;
      }
    },
    () => null,
  );

  const saved = parseFlashcardProgress(raw);
  if (!saved) return null;

  if (saved.completed) {
    return (
      <span className="rounded-full bg-emerald-300/15 px-3 py-1 text-[11px] font-semibold text-emerald-100 ring-1 ring-emerald-300/30">
        Mastered
      </span>
    );
  }

  const toReview = saved.needAgainQueue.length;
  const started =
    saved.round > 1 || saved.queueIndex > 0 || toReview > 0 || saved.roundComplete;
  if (!started) return null;

  return (
    <span className="rounded-full bg-amber-300/15 px-3 py-1 text-[11px] font-semibold text-amber-100 ring-1 ring-amber-300/30">
      {toReview > 0
        ? `Round ${saved.round} · ${toReview} to review`
        : `Round ${saved.round} in progress`}
    </span>
  );
}
