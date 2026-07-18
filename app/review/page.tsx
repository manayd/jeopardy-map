"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { judgeAnswer } from "@/lib/answer-match";
import {
  amendJudgmentToCorrect,
  backfillCardMeta,
  deckCardsMissingMeta,
  loadDueCards,
  nextDueAt,
  practiceHrefForSlug,
  recordJudgment,
  statsSnapshot,
  type DueCard,
} from "@/lib/practice-stats";
import { loadDailyHistory } from "@/lib/daily-quiz";

const SESSION_CAP = 50;

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function formatUntil(ts: number): string {
  const hours = Math.round((ts - Date.now()) / 3_600_000);
  if (hours <= 1) return "within the hour";
  if (hours < 24) return `in about ${hours} hours`;
  const days = Math.round(hours / 24);
  return days === 1 ? "tomorrow" : `in ${days} days`;
}

// Mirrors the Leitner ladder in practice-stats: box N's interval in days.
const BOX_INTERVAL_DAYS = [1, 3, 7, 14, 30];

/** When a correctly-recalled card in `box` will next come due. */
function nextIntervalLabel(box: number): string {
  const nextBox = Math.min(box + 1, BOX_INTERVAL_DAYS.length);
  const days = BOX_INTERVAL_DAYS[nextBox - 1];
  if (days === 1) return "Back tomorrow";
  if (days < 7) return `Back in ${days} days`;
  if (days === 7) return "Back in 1 week";
  if (days < 30) return `Back in ${Math.round(days / 7)} weeks`;
  return "Back in a month";
}

/** "OPERA SETTINGS · $400 · 1998" style context line for a clue-based card. */
function clueContext(card: {
  category?: string;
  value?: number;
  round?: number;
  airDate?: string;
}): string {
  const parts: string[] = [];
  if (card.category) parts.push(card.category);
  if (card.round === 3) parts.push("Final Jeopardy!");
  else if (card.value && card.value > 0) parts.push(`$${card.value}`);
  const year = /^(\d{4})/.exec(card.airDate ?? "")?.[1];
  if (year) parts.push(year);
  return parts.join(" · ");
}

export default function ReviewPage() {
  // Live snapshot drives the landing screen; the session itself is captured
  // once on "Start" so answering cards doesn't reshuffle the queue mid-run.
  const snapshot = useSyncExternalStore(subscribe, statsSnapshot, () => "");
  const { dueCount, nextDue } = useMemo(() => {
    if (typeof window === "undefined") return { dueCount: 0, nextDue: null };
    return { dueCount: loadDueCards().length, nextDue: nextDueAt() };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot]);

  const [session, setSession] = useState<DueCard[] | null>(null);
  const [index, setIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [guess, setGuess] = useState("");
  const [phase, setPhase] = useState<"answering" | "judged">("answering");
  const [verdict, setVerdict] = useState<"correct" | "incorrect">("incorrect");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const advanceRef = useRef<HTMLButtonElement | null>(null);

  const startSession = () => {
    setSession(loadDueCards().slice(0, SESSION_CAP));
    setIndex(0);
    setCorrectCount(0);
    setGuess("");
    setPhase("answering");
  };

  const total = session?.length ?? 0;
  const card = session?.[index];
  const finished = session !== null && index >= total;

  const commitVerdict = (result: "correct" | "incorrect") => {
    if (!card) return;
    recordJudgment({
      slug: card.deckSlug,
      title: card.deckTitle,
      mode: "review",
      prompt: card.prompt,
      answer: card.answer,
      correct: result === "correct",
      key: card.key,
    });
    if (result === "correct") setCorrectCount((value) => value + 1);
    setVerdict(result);
    setPhase("judged");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!card) return;
    if (phase === "judged") {
      setIndex((value) => value + 1);
      setGuess("");
      setPhase("answering");
      return;
    }
    if (!guess.trim()) return;
    commitVerdict(judgeAnswer(guess, card.answer) === "correct" ? "correct" : "incorrect");
  };

  const overrideCorrect = () => {
    if (!card || phase !== "judged" || verdict === "correct") return;
    amendJudgmentToCorrect({
      slug: card.deckSlug,
      mode: "review",
      prompt: card.prompt,
      key: card.key,
    });
    setVerdict("correct");
    setCorrectCount((value) => value + 1);
  };

  const skipCard = () => {
    if (phase === "answering") commitVerdict("incorrect");
  };

  // Move focus to follow the phase: the input while answering, the advance
  // button once judged. This is what makes Enter work after a wrong answer or
  // an "I don't know" — otherwise focus is left on a button that unmounts and
  // the keypress never reaches the form.
  useEffect(() => {
    if (!session || index >= total) return;
    if (phase === "answering") inputRef.current?.focus();
    else advanceRef.current?.focus();
  }, [phase, index, session, total]);

  // One-time backfill: Daily 10 cards recorded before category/value were
  // captured can recover them from the deterministic date-seeded quiz. Run
  // once per session, only if some daily card is missing metadata.
  useEffect(() => {
    if (!deckCardsMissingMeta("daily")) return;
    if (sessionStorage.getItem("jeopardy-map:daily-backfilled")) return;
    sessionStorage.setItem("jeopardy-map:daily-backfilled", "1");
    let cancelled = false;
    (async () => {
      const dates = [...loadDailyHistory().keys()].slice(0, 120);
      for (const date of dates) {
        if (cancelled) return;
        try {
          const res = await fetch(`/api/daily?date=${date}`);
          if (!res.ok) continue;
          const data = (await res.json()) as {
            clues?: Array<{
              prompt?: string;
              category?: string;
              value?: number;
              round?: number;
              air_date?: string;
            }>;
          };
          backfillCardMeta(
            "daily",
            (data.clues ?? []).map((c) => ({
              prompt: c.prompt ?? "",
              category: c.category,
              value: c.value,
              round: c.round,
              airDate: c.air_date,
            })),
          );
        } catch {
          // skip this date; a failed fetch shouldn't break review
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Escape gives "I don't know" a keyboard shortcut without clashing with
  // typing the answer (Enter is taken by submit/advance).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && phase === "answering" && card) {
        event.preventDefault();
        skipCard();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, card]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-slate-50">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(120,119,198,0.15),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.12),transparent_25%),radial-gradient(circle_at_50%_80%,rgba(16,185,129,0.12),transparent_35%)]" />
        <SiteNav current="review" />

        <main className="relative mx-auto max-w-4xl px-6 pb-16 pt-8 lg:px-10">
          <section className="rounded-[2rem] border border-white/10 bg-white/6 p-8 shadow-2xl shadow-black/30 backdrop-blur-xl">
            <p className="text-sm uppercase tracking-[0.25em] text-indigo-200">
              Spaced Review
            </p>
            <h1 className="mt-3 text-4xl font-semibold text-white">
              {session === null
                ? dueCount > 0
                  ? `${dueCount} card${dueCount === 1 ? "" : "s"} due for review.`
                  : "Nothing due right now."
                : finished
                  ? "Review session complete."
                  : "Type the response from memory."}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-200">
              Cards you miss come back tomorrow; cards you know move out — 3 days,
              a week, two weeks, a month. Misses always return to the front.
            </p>
          </section>

          <div className="mt-6">
            {session === null ? (
              dueCount > 0 ? (
                <div className="rounded-[2rem] border border-white/10 bg-white/6 p-6 lg:p-8">
                  <p className="text-sm text-slate-200">
                    {dueCount > SESSION_CAP
                      ? `Starting with the ${SESSION_CAP} most overdue.`
                      : "Most overdue first."}
                  </p>
                  <button
                    type="button"
                    onClick={startSession}
                    className="mt-4 rounded-full bg-emerald-300 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200"
                  >
                    Start review →
                  </button>
                </div>
              ) : (
                <div className="rounded-[2rem] border border-emerald-300/20 bg-emerald-300/5 p-6 text-slate-200 lg:p-8">
                  <p>
                    Your review queue is clear.
                    {nextDue
                      ? ` The next card comes due ${formatUntil(nextDue)}.`
                      : " Practice any deck and missed cards will start scheduling themselves."}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      href="/daily"
                      className="rounded-full bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-200"
                    >
                      Play the Daily 10
                    </Link>
                    <Link
                      href="/practice"
                      className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-indigo-50 transition hover:border-white/40 hover:bg-white/10"
                    >
                      Open practice
                    </Link>
                  </div>
                </div>
              )
            ) : finished ? (
              <div className="rounded-[2rem] border border-emerald-300/30 bg-[linear-gradient(160deg,rgba(6,78,59,0.6),rgba(15,23,42,0.85))] p-6 lg:p-8">
                <p className="text-[11px] uppercase tracking-[0.26em] text-emerald-200">
                  Session result
                </p>
                <h2 className="mt-3 text-4xl font-semibold text-white">
                  {correctCount} / {total}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-emerald-50/90">
                  Recalled cards moved to longer intervals; misses come back
                  tomorrow.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href="/stats"
                    className="rounded-full bg-emerald-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200"
                  >
                    See your stats
                  </Link>
                  {dueCount > 0 && (
                    <button
                      type="button"
                      onClick={startSession}
                      className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-indigo-50 transition hover:border-white/40 hover:bg-white/10"
                    >
                      Review {dueCount} more →
                    </button>
                  )}
                </div>
              </div>
            ) : card ? (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-200">
                  <span className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1.5">
                    Card {index + 1} of {total}
                  </span>
                  <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-emerald-100">
                    Recalled: {correctCount}
                  </span>
                  <span className="rounded-full border border-rose-300/20 bg-rose-300/10 px-3 py-1.5 text-rose-100">
                    Missed before: {card.misses}×
                  </span>
                </div>

                <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(160deg,rgba(15,23,42,0.95),rgba(30,41,59,0.85))] p-6 lg:p-8">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-indigo-200">
                    <Link
                      href={practiceHrefForSlug(card.deckSlug)}
                      className="underline-offset-2 hover:underline"
                    >
                      {card.deckTitle}
                    </Link>
                    {clueContext(card) && (
                      <span className="text-indigo-200/70">· {clueContext(card)}</span>
                    )}
                  </div>
                  <h2 className="mt-4 text-2xl font-semibold leading-snug text-white lg:text-3xl">
                    {card.prompt}
                  </h2>

                  <form onSubmit={handleSubmit} className="mt-8">
                    <label
                      htmlFor="review-answer"
                      className="text-[11px] uppercase tracking-[0.24em] text-slate-300"
                    >
                      Your response
                    </label>
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                      <input
                        ref={inputRef}
                        id="review-answer"
                        type="text"
                        value={guess}
                        onChange={(event) => setGuess(event.target.value)}
                        readOnly={phase === "judged"}
                        placeholder="Type your response…"
                        autoComplete="off"
                        autoCapitalize="off"
                        autoCorrect="off"
                        spellCheck={false}
                        autoFocus
                        className="w-full rounded-[1.25rem] border border-white/15 bg-black/30 px-5 py-3.5 text-lg text-white placeholder:text-slate-400/60 focus:border-emerald-300/60 focus:outline-none"
                      />
                      <button
                        ref={advanceRef}
                        type="submit"
                        className="shrink-0 rounded-full bg-emerald-300 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200"
                      >
                        {phase === "answering"
                          ? "Submit"
                          : index + 1 === total
                            ? "Finish →"
                            : "Next →"}
                        <span className="ml-2 text-xs opacity-60">Enter</span>
                      </button>
                    </div>
                  </form>

                  {phase === "judged" && (
                    <div
                      aria-live="polite"
                      className={`mt-6 rounded-[1.5rem] border px-4 py-4 text-sm ${
                        verdict === "correct"
                          ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-50"
                          : "border-rose-300/30 bg-rose-300/10 text-rose-50"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <span className="font-medium">
                          {verdict === "correct"
                            ? `Correct — ${card.answer}`
                            : `The correct response: ${card.answer}`}
                        </span>
                        <span
                          className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                            verdict === "correct"
                              ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-100"
                              : "border-amber-300/40 bg-amber-300/10 text-amber-100"
                          }`}
                          title="When this card returns to your review queue"
                        >
                          {verdict === "correct"
                            ? nextIntervalLabel(card.box)
                            : "Back tomorrow"}
                        </span>
                      </div>
                      {verdict === "incorrect" && guess.trim().length > 0 && (
                        <button
                          type="button"
                          onClick={overrideCorrect}
                          className="mt-3 block rounded-full border border-white/20 px-4 py-1.5 text-xs font-semibold text-rose-50 transition hover:border-white/45 hover:bg-white/10"
                        >
                          My answer was actually right
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {phase === "answering" && (
                  <button
                    type="button"
                    onClick={skipCard}
                    className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-indigo-50 transition hover:border-white/40 hover:bg-white/10"
                  >
                    I don&rsquo;t know — show answer
                    <span className="ml-2 text-xs opacity-60">Esc</span>
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
