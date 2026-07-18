"use client";

import { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { loadDailyStreak } from "@/lib/daily-quiz";
import {
  isReviewEligible,
  practiceHrefForSlug,
  statsSnapshot,
  type CardStat,
  type DeckStats,
  type JudgmentMode,
} from "@/lib/practice-stats";

const MIN_ATTEMPTS_FOR_RANKING = 10;

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function parseSnapshot(snapshot: string): DeckStats[] {
  if (!snapshot) return [];
  const decks: DeckStats[] = [];
  for (const line of snapshot.split("\n")) {
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    try {
      const parsed = JSON.parse(line.slice(eq + 1)) as DeckStats;
      if (parsed?.version === 1) decks.push(parsed);
    } catch {
      // skip malformed entries
    }
  }
  return decks;
}

const accuracyOf = (attempts: number, correct: number) =>
  attempts === 0 ? 0 : Math.round((correct / attempts) * 100);

function relativeDay(ts: number): string {
  const days = Math.floor((Date.now() - ts) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

function accuracyTone(accuracy: number): string {
  if (accuracy < 50) return "text-rose-200";
  if (accuracy < 75) return "text-amber-200";
  return "text-emerald-200";
}

type TroubleCard = CardStat & { deckTitle: string; deckSlug: string };

export default function StatsPage() {
  const snapshot = useSyncExternalStore(subscribe, statsSnapshot, () => "");
  const decks = useMemo(() => parseSnapshot(snapshot), [snapshot]);
  const streak = useMemo(
    () => (typeof window === "undefined" ? null : loadDailyStreak()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snapshot],
  );

  const totals = useMemo(() => {
    let attempts = 0;
    let correct = 0;
    const recall = { attempts: 0, correct: 0 };
    const recognition = { attempts: 0, correct: 0 };
    for (const deck of decks) {
      attempts += deck.attempts;
      correct += deck.correct;
      for (const [mode, stat] of Object.entries(deck.byMode)) {
        const bucket =
          mode === "typed" || mode === "daily" || mode === "review"
            ? recall
            : mode === "multiple-choice"
              ? recognition
              : null;
        if (bucket && stat) {
          bucket.attempts += stat.attempts;
          bucket.correct += stat.correct;
        }
      }
    }
    return { attempts, correct, recall, recognition };
  }, [decks]);

  const ranked = useMemo(
    () =>
      decks
        .filter((deck) => deck.attempts >= MIN_ATTEMPTS_FOR_RANKING)
        .sort(
          (a, b) =>
            accuracyOf(a.attempts, a.correct) - accuracyOf(b.attempts, b.correct),
        ),
    [decks],
  );

  const troubleCards = useMemo(() => {
    const out: TroubleCard[] = [];
    for (const deck of decks) {
      for (const card of Object.values(deck.cards)) {
        if (card.misses >= 2) {
          out.push({ ...card, deckTitle: deck.title, deckSlug: deck.slug });
        }
      }
    }
    return out.sort((a, b) => b.misses - a.misses || b.last - a.last).slice(0, 15);
  }, [decks]);

  const allDecks = useMemo(
    () => [...decks].sort((a, b) => b.lastPracticed - a.lastPracticed),
    [decks],
  );

  const modeLabel: Record<JudgmentMode, string> = {
    flashcards: "Flashcards",
    "multiple-choice": "Multiple choice",
    typed: "Typed",
    daily: "Daily 20",
    review: "Review",
  };

  const dueCount = useMemo(() => {
    const now = Date.now();
    let count = 0;
    for (const deck of decks) {
      if (!isReviewEligible(deck)) continue;
      for (const card of Object.values(deck.cards)) {
        if (card.due !== undefined && card.due <= now) count += 1;
      }
    }
    return count;
  }, [decks]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-slate-50">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(120,119,198,0.15),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.12),transparent_25%),radial-gradient(circle_at_50%_80%,rgba(16,185,129,0.12),transparent_35%)]" />
        <SiteNav current="stats" />

        <main className="relative mx-auto max-w-5xl px-6 pb-16 pt-8 lg:px-10">
          <section className="rounded-[2rem] border border-white/10 bg-white/6 p-8 shadow-2xl shadow-black/30 backdrop-blur-xl">
            <p className="text-sm uppercase tracking-[0.25em] text-indigo-200">
              Your Stats
            </p>
            <h1 className="mt-3 text-4xl font-semibold text-white">
              Where you&rsquo;re weak — and where to drill.
            </h1>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <div className="text-2xl font-semibold text-white">{totals.attempts}</div>
                <div className="mt-1 text-sm text-slate-300">Judgments logged</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <div
                  className={`text-2xl font-semibold ${accuracyTone(accuracyOf(totals.attempts, totals.correct))}`}
                >
                  {accuracyOf(totals.attempts, totals.correct)}%
                </div>
                <div className="mt-1 text-sm text-slate-300">Overall accuracy</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <div className="text-2xl font-semibold text-white">
                  {totals.recall.attempts > 0
                    ? `${accuracyOf(totals.recall.attempts, totals.recall.correct)}%`
                    : "—"}
                </div>
                <div className="mt-1 text-sm text-slate-300">
                  Recall (typed) accuracy
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <div className="text-2xl font-semibold text-white">
                  {totals.recognition.attempts > 0
                    ? `${accuracyOf(totals.recognition.attempts, totals.recognition.correct)}%`
                    : "—"}
                </div>
                <div className="mt-1 text-sm text-slate-300">
                  Recognition (choice) accuracy
                </div>
              </div>
            </div>
            {streak && (
              <p className="mt-4 text-sm text-slate-300">
                Daily 20 streak: 🔥 {streak.streak} day{streak.streak === 1 ? "" : "s"}
                {" · "}best {streak.bestStreak}
              </p>
            )}
            {totals.recall.attempts >= 20 &&
              totals.recognition.attempts >= 20 &&
              accuracyOf(totals.recognition.attempts, totals.recognition.correct) -
                accuracyOf(totals.recall.attempts, totals.recall.correct) >=
                15 && (
                <p className="mt-2 text-sm text-amber-200/90">
                  Your recognition accuracy is well ahead of your recall — on the
                  buzzer only recall counts, so favor Type It over Multiple Choice.
                </p>
              )}
          </section>

          {dueCount > 0 && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-[2rem] border border-amber-300/30 bg-amber-300/10 p-6">
              <div>
                <p className="font-semibold text-amber-100">
                  {dueCount} card{dueCount === 1 ? "" : "s"} due for review
                </p>
                <p className="mt-1 text-sm text-amber-100/70">
                  Spaced repetition only works if the reps happen.
                </p>
              </div>
              <Link
                href="/review"
                className="rounded-full bg-amber-300 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-200"
              >
                Start review →
              </Link>
            </div>
          )}

          {decks.length === 0 ? (
            <div className="mt-6 rounded-[2rem] border border-white/10 bg-white/6 p-8 text-slate-200">
              <p>
                No judgments logged yet. Grade some flashcards, answer multiple
                choice or Type It questions, or play the{" "}
                <Link href="/daily" className="text-emerald-200 underline">
                  Daily 10
                </Link>{" "}
                — every answer you give starts building your weak-spots picture.
              </p>
            </div>
          ) : (
            <>
              {ranked.length > 0 && (
                <section className="mt-6 rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl lg:p-8">
                  <h2 className="text-xl font-semibold text-white">Weak spots</h2>
                  <p className="mt-1 text-sm text-slate-300">
                    Decks with at least {MIN_ATTEMPTS_FOR_RANKING} judgments, worst
                    accuracy first.
                  </p>
                  <div className="mt-5 space-y-3">
                    {ranked.slice(0, 6).map((deck) => {
                      const accuracy = accuracyOf(deck.attempts, deck.correct);
                      return (
                        <div
                          key={deck.slug}
                          className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-slate-950/50 p-4"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-semibold text-white">
                              {deck.title}
                            </div>
                            <div className="mt-1 text-xs text-slate-400">
                              {deck.attempts} judgments · last practiced{" "}
                              {relativeDay(deck.lastPracticed)}
                            </div>
                            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
                              <div
                                className={`h-full rounded-full ${
                                  accuracy < 50
                                    ? "bg-rose-400"
                                    : accuracy < 75
                                      ? "bg-amber-300"
                                      : "bg-emerald-300"
                                }`}
                                style={{ width: `${Math.max(accuracy, 4)}%` }}
                              />
                            </div>
                          </div>
                          <div className={`text-2xl font-semibold ${accuracyTone(accuracy)}`}>
                            {accuracy}%
                          </div>
                          <Link
                            href={practiceHrefForSlug(deck.slug)}
                            className="rounded-full bg-emerald-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200"
                          >
                            Drill →
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {troubleCards.length > 0 && (
                <section className="mt-6 rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl lg:p-8">
                  <h2 className="text-xl font-semibold text-white">Trouble cards</h2>
                  <p className="mt-1 text-sm text-slate-300">
                    Missed two or more times — these are tomorrow&rsquo;s easiest
                    points.
                  </p>
                  <div className="mt-5 grid gap-3">
                    {troubleCards.map((card) => (
                      <div
                        key={`${card.deckSlug}-${card.prompt.slice(0, 40)}`}
                        className="rounded-2xl border border-rose-300/15 bg-rose-300/5 p-4"
                      >
                        <p className="text-sm leading-relaxed text-slate-100">
                          {card.prompt}
                        </p>
                        <p className="mt-1.5 text-sm text-emerald-100">{card.answer}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                          <span className="text-rose-200">
                            ✗ missed {card.misses}×
                          </span>
                          <span>of {card.attempts} attempts</span>
                          <Link
                            href={practiceHrefForSlug(card.deckSlug)}
                            className="text-indigo-200 underline-offset-2 hover:underline"
                          >
                            {card.deckTitle}
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="mt-6 rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl lg:p-8">
                <h2 className="text-xl font-semibold text-white">All decks</h2>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-[0.18em] text-indigo-200/80">
                        <th className="pb-3 pr-4 font-semibold">Deck</th>
                        <th className="pb-3 pr-4 font-semibold">Judgments</th>
                        <th className="pb-3 pr-4 font-semibold">Accuracy</th>
                        <th className="pb-3 pr-4 font-semibold">Modes</th>
                        <th className="pb-3 font-semibold">Last practiced</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {allDecks.map((deck) => {
                        const accuracy = accuracyOf(deck.attempts, deck.correct);
                        return (
                          <tr key={deck.slug}>
                            <td className="py-3 pr-4">
                              <Link
                                href={practiceHrefForSlug(deck.slug)}
                                className="font-medium text-white underline-offset-2 hover:underline"
                              >
                                {deck.title}
                              </Link>
                            </td>
                            <td className="py-3 pr-4 text-slate-300">{deck.attempts}</td>
                            <td className={`py-3 pr-4 font-semibold ${accuracyTone(accuracy)}`}>
                              {accuracy}%
                            </td>
                            <td className="py-3 pr-4 text-xs text-slate-400">
                              {Object.keys(deck.byMode)
                                .map((mode) => modeLabel[mode as JudgmentMode] ?? mode)
                                .join(", ")}
                            </td>
                            <td className="py-3 text-slate-300">
                              {relativeDay(deck.lastPracticed)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
