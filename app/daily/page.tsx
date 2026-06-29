"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { DailyHeatmap } from "@/components/daily-heatmap";
import { SiteNav } from "@/components/site-nav";
import { judgeAnswer } from "@/lib/answer-match";
import {
  loadDailyResult,
  loadDailyStreak,
  localDateString,
  recordDailyPlay,
  saveDailyResult,
  type DailyAnswer,
  type DailyStreak,
} from "@/lib/daily-quiz";
import { amendJudgmentToCorrect, recordJudgment } from "@/lib/practice-stats";

type DailyClue = {
  prompt: string;
  answer: string;
  round: number;
  value: number;
  daily_double_value: number;
  air_date: string;
  category: string;
};

type DailyResponse = {
  date: string;
  clues: DailyClue[];
};

function clueValueLabel(clue: DailyClue): string {
  if (clue.round === 3) return "Final Jeopardy!";
  const value = clue.daily_double_value > 0 ? clue.daily_double_value : clue.value;
  const round = clue.round === 2 ? "Double" : "Single";
  return value > 0 ? `${round} · $${value}` : round;
}

export default function DailyQuizPage() {
  const [date] = useState(() => localDateString());
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [clues, setClues] = useState<DailyClue[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<DailyAnswer[]>([]);
  const [guess, setGuess] = useState("");
  const [phase, setPhase] = useState<"answering" | "judged">("answering");
  const [streak, setStreak] = useState<DailyStreak | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const response = await fetch(`/api/daily?date=${date}`);
        if (!response.ok) throw new Error("failed");
        const data = (await response.json()) as DailyResponse;
        if (!alive) return;
        setClues(data.clues);

        const saved = loadDailyResult(date);
        if (saved && saved.answers.length > 0) {
          const restored = saved.answers.slice(0, data.clues.length);
          setAnswers(restored);
          setIndex(restored.length);
        }
        setStreak(loadDailyStreak());
        setStatus("ready");
      } catch {
        if (!alive) return;
        setStatus("error");
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [date]);

  const total = clues.length;
  const done = status === "ready" && total > 0 && index >= total && phase === "answering";
  const currentClue = clues[index] ?? clues[0];
  const score = answers.filter((a) => a.verdict === "correct").length;
  const lastAnswer = answers[answers.length - 1];

  useEffect(() => {
    if (status === "ready" && !done && phase === "answering") {
      inputRef.current?.focus();
    }
  }, [status, done, phase, index]);

  const persist = (nextAnswers: DailyAnswer[]) => {
    const completed = nextAnswers.length === total;
    saveDailyResult({
      version: 1,
      date,
      answers: nextAnswers,
      completedAt: completed ? new Date().toISOString() : undefined,
    });
    if (completed) setStreak(recordDailyPlay(date));
  };

  const commitVerdict = (verdict: "correct" | "incorrect") => {
    recordJudgment({
      slug: "daily",
      title: "The Daily 10",
      mode: "daily",
      prompt: currentClue.prompt,
      answer: currentClue.answer,
      correct: verdict === "correct",
      category: currentClue.category,
      value: currentClue.value,
      round: currentClue.round,
    });
    const nextAnswers = [...answers, { guess: guess.trim(), verdict }];
    setAnswers(nextAnswers);
    setPhase("judged");
    persist(nextAnswers);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (phase === "judged") {
      setIndex((value) => value + 1);
      setGuess("");
      setPhase("answering");
      return;
    }
    if (!guess.trim()) return;
    commitVerdict(judgeAnswer(guess, currentClue.answer));
  };

  const skipQuestion = () => {
    if (phase === "answering") commitVerdict("incorrect");
  };

  const overrideCorrect = () => {
    if (phase !== "judged" || !lastAnswer || lastAnswer.verdict === "correct") return;
    amendJudgmentToCorrect({
      slug: "daily",
      mode: "daily",
      prompt: currentClue.prompt,
    });
    const nextAnswers = [...answers];
    nextAnswers[nextAnswers.length - 1] = { ...lastAnswer, verdict: "correct" };
    setAnswers(nextAnswers);
    persist(nextAnswers);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-slate-50">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(120,119,198,0.15),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.12),transparent_25%),radial-gradient(circle_at_50%_80%,rgba(16,185,129,0.12),transparent_35%)]" />
        <SiteNav current="daily" />

        <main className="relative mx-auto max-w-4xl px-6 pb-16 pt-8 lg:px-10">
          <section className="rounded-[2rem] border border-white/10 bg-white/6 p-8 shadow-2xl shadow-black/30 backdrop-blur-xl">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-indigo-200">
                  The Daily 10 · {date}
                </p>
                <h1 className="mt-3 text-4xl font-semibold text-white">
                  Ten clues from the whole archive.
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-200">
                  Same ten for everyone today, easy to hard. Type your responses —
                  spelling close enough counts.
                </p>
              </div>
              {streak && (
                <div className="flex gap-3">
                  <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-4 py-2 text-sm font-semibold text-amber-100">
                    🔥 {streak.streak} day{streak.streak === 1 ? "" : "s"}
                  </span>
                  <span className="rounded-full border border-white/15 bg-slate-950/50 px-4 py-2 text-sm text-slate-200">
                    Best: {streak.bestStreak}
                  </span>
                </div>
              )}
            </div>
          </section>

          <div className="mt-6">
            {status === "loading" ? (
              <div className="rounded-[2rem] border border-white/10 bg-white/6 p-6 text-slate-200">
                Drawing today&rsquo;s clues…
              </div>
            ) : status === "error" ? (
              <div className="rounded-[2rem] border border-rose-300/20 bg-rose-300/10 p-6 text-rose-50">
                Could not load today&rsquo;s quiz. Refresh to try again.
              </div>
            ) : done ? (
              <div className="space-y-5">
                <div className="rounded-[2rem] border border-emerald-300/30 bg-[linear-gradient(160deg,rgba(6,78,59,0.6),rgba(15,23,42,0.85))] p-6 lg:p-8">
                  <p className="text-[11px] uppercase tracking-[0.26em] text-emerald-200">
                    Today&rsquo;s result
                  </p>
                  <h2 className="mt-3 text-4xl font-semibold text-white">
                    {score} / {total}
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-emerald-50/90">
                    {score === total
                      ? "Perfect — a clean sweep. See you tomorrow."
                      : score >= 7
                        ? "Strong board. Review the misses below and come back tomorrow."
                        : "The misses below are tomorrow's strengths. Come back for a fresh ten."}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link
                      href="/practice"
                      className="rounded-full bg-emerald-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200"
                    >
                      Keep practicing
                    </Link>
                    <Link
                      href="/"
                      className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-indigo-50 transition hover:border-white/40 hover:bg-white/10"
                    >
                      Explore the map
                    </Link>
                  </div>
                </div>

                <div className="space-y-3">
                  {clues.map((clue, i) => {
                    const answer = answers[i];
                    const correct = answer?.verdict === "correct";
                    return (
                      <div
                        key={`${clue.prompt.slice(0, 40)}-${i}`}
                        className={`rounded-[1.5rem] border p-5 ${
                          correct
                            ? "border-emerald-300/20 bg-emerald-300/5"
                            : "border-rose-300/20 bg-rose-300/5"
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-indigo-200/80">
                          <span>{correct ? "✓" : "✗"}</span>
                          <span>{clue.category}</span>
                          <span>· {clueValueLabel(clue)}</span>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-slate-100">
                          {clue.prompt}
                        </p>
                        <p className="mt-2 text-sm text-emerald-100">{clue.answer}</p>
                        {!correct && answer?.guess && (
                          <p className="mt-1 text-xs text-rose-200/80">
                            You said: {answer.guess}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-200">
                  <span className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1.5">
                    Question {Math.min(index + 1, total)} of {total}
                  </span>
                  <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-emerald-100">
                    Correct: {score}
                  </span>
                </div>

                <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(160deg,rgba(15,23,42,0.95),rgba(30,41,59,0.85))] p-6 lg:p-8">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-indigo-200">
                    <span>{currentClue.category}</span>
                    <span className="text-indigo-200/60">· {clueValueLabel(currentClue)}</span>
                  </div>
                  <h2 className="mt-4 text-2xl font-semibold leading-snug text-white lg:text-3xl">
                    {currentClue.prompt}
                  </h2>

                  <form onSubmit={handleSubmit} className="mt-8">
                    <label
                      htmlFor="daily-answer"
                      className="text-[11px] uppercase tracking-[0.24em] text-slate-300"
                    >
                      Your response
                    </label>
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                      <input
                        ref={inputRef}
                        id="daily-answer"
                        type="text"
                        value={guess}
                        onChange={(event) => setGuess(event.target.value)}
                        readOnly={phase === "judged"}
                        placeholder="Type your response…"
                        autoComplete="off"
                        autoCapitalize="off"
                        autoCorrect="off"
                        spellCheck={false}
                        className="w-full rounded-[1.25rem] border border-white/15 bg-black/30 px-5 py-3.5 text-lg text-white placeholder:text-slate-400/60 focus:border-emerald-300/60 focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="shrink-0 rounded-full bg-emerald-300 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200"
                      >
                        {phase === "answering"
                          ? "Submit"
                          : index + 1 === total
                            ? "See results →"
                            : "Next →"}
                        <span className="ml-2 text-xs opacity-60">Enter</span>
                      </button>
                    </div>
                  </form>

                  {phase === "judged" && lastAnswer && (
                    <div
                      aria-live="polite"
                      className={`mt-6 rounded-[1.5rem] border px-4 py-4 text-sm ${
                        lastAnswer.verdict === "correct"
                          ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-50"
                          : "border-rose-300/30 bg-rose-300/10 text-rose-50"
                      }`}
                    >
                      {lastAnswer.verdict === "correct"
                        ? `Correct — ${currentClue.answer}.`
                        : `The correct response: ${currentClue.answer}.`}
                      {lastAnswer.verdict === "incorrect" && lastAnswer.guess && (
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
                    onClick={skipQuestion}
                    className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-indigo-50 transition hover:border-white/40 hover:bg-white/10"
                  >
                    I don&rsquo;t know — show answer
                  </button>
                )}
              </div>
            )}
          </div>

          <section className="mt-6 rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl lg:p-8">
            <DailyHeatmap />
          </section>
        </main>
      </div>
    </div>
  );
}
