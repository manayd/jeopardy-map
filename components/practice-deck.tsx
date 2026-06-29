"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { judgeAnswer } from "@/lib/answer-match";
import type { PracticeCard, PracticeDeckConfig } from "@/lib/practice-data";
import {
  clearFlashcardProgress,
  loadFlashcardProgress,
  loadFlashDirection,
  saveFlashDirection,
  saveFlashcardProgress,
  type FlashDirection,
} from "@/lib/practice-progress";
import { amendJudgmentToCorrect, recordJudgment } from "@/lib/practice-stats";

type PracticeMode = "flashcards" | "multiple-choice" | "typed";

const MODE_LABELS: Record<PracticeMode, string> = {
  flashcards: "Flashcards",
  "multiple-choice": "Multiple Choice",
  typed: "Type It",
};

type MultipleChoiceQuestion = {
  prompt: PracticeCard;
  options: string[];
};

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function pickCard(items: PracticeCard[], previousPrompt?: string): PracticeCard {
  let card = items[Math.floor(Math.random() * items.length)];
  while (items.length > 1 && card.prompt === previousPrompt) {
    card = items[Math.floor(Math.random() * items.length)];
  }
  return card;
}

function buildQuestion(items: PracticeCard[], previousPrompt?: string): MultipleChoiceQuestion {
  const prompt = pickCard(items, previousPrompt);

  const uniqueAnswers = Array.from(new Set(items.map((item) => item.answer)));
  const optionCount = Math.min(4, uniqueAnswers.length);
  const optionSet = new Set<string>([prompt.answer]);

  while (optionSet.size < optionCount) {
    const candidate = uniqueAnswers[Math.floor(Math.random() * uniqueAnswers.length)];
    optionSet.add(candidate);
  }

  return {
    prompt,
    options: shuffle(Array.from(optionSet)),
  };
}

export function PracticeDeck({
  deck,
  onRestart,
}: {
  deck: PracticeDeckConfig;
  /** Called after a deck restart — lets topic decks draw a fresh clue sample. */
  onRestart?: () => void;
}) {
  const items = deck.items;
  const deckIndices = items.map((_, index) => index);
  const [mode, setMode] = useState<PracticeMode>("flashcards");
  const [reviewQueue, setReviewQueue] = useState<number[]>(() => shuffle(deckIndices));
  const [queueIndex, setQueueIndex] = useState(0);
  const [needAgainQueue, setNeedAgainQueue] = useState<number[]>([]);
  const [round, setRound] = useState(1);
  const [knownThisRound, setKnownThisRound] = useState(0);
  const [reviewThisRound, setReviewThisRound] = useState(0);
  const [roundComplete, setRoundComplete] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [resumed, setResumed] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [flashDirection, setFlashDirection] = useState<FlashDirection>("forward");
  const [question, setQuestion] = useState(() => buildQuestion(items));
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [attemptCount, setAttemptCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [showMobileStats, setShowMobileStats] = useState(false);
  const [typedCard, setTypedCard] = useState<PracticeCard>(() => pickCard(items));
  const [guess, setGuess] = useState("");
  const [typedPhase, setTypedPhase] = useState<"answering" | "judged">("answering");
  const [typedVerdict, setTypedVerdict] = useState<"correct" | "incorrect">("incorrect");
  const [streakBeforeJudge, setStreakBeforeJudge] = useState(0);
  const [typedAttempts, setTypedAttempts] = useState(0);
  const [typedCorrect, setTypedCorrect] = useState(0);
  const [typedStreak, setTypedStreak] = useState(0);
  const [typedBestStreak, setTypedBestStreak] = useState(0);
  const typedInputRef = useRef<HTMLInputElement | null>(null);

  if (!items.length) {
    return (
      <div className="rounded-[2rem] border border-white/10 bg-white/6 p-6 text-slate-200">
        No items are available in this deck yet.
      </div>
    );
  }

  const currentCardIndex = reviewQueue[queueIndex] ?? deckIndices[0];
  const currentCard = items[currentCardIndex] ?? items[0];
  // Flashcards can flip: in reverse, the answer side becomes the cue and the
  // prompt side becomes what you recall. Judgments still record against the
  // canonical card (currentCard.prompt/answer), so direction never forks a
  // card's stats or spaced-repetition schedule.
  const reversible = deck.reversible !== false;
  const reversed = reversible && flashDirection === "reverse";
  const frontLabel = reversed ? deck.answerLabel : deck.promptLabel;
  const backLabel = reversed ? deck.promptLabel : deck.answerLabel;
  const frontText = reversed ? currentCard.answer : currentCard.prompt;
  const backText = reversed ? currentCard.prompt : currentCard.answer;
  const progress = queueIndex + 1;
  const roundSize = reviewQueue.length;
  const accuracy = attemptCount === 0 ? 0 : Math.round((correctCount / attemptCount) * 100);
  const typedAccuracy =
    typedAttempts === 0 ? 0 : Math.round((typedCorrect / typedAttempts) * 100);
  const answered = selectedOption !== null;
  const selectedCorrect = selectedOption === question.prompt.answer;

  const resetFlashcards = () => {
    clearFlashcardProgress(deck.slug);
    setReviewQueue(shuffle(deckIndices));
    setQueueIndex(0);
    setNeedAgainQueue([]);
    setRound(1);
    setKnownThisRound(0);
    setReviewThisRound(0);
    setRoundComplete(false);
    setCompleted(false);
    setShowAnswer(false);
    setResumed(false);
    onRestart?.();
  };

  const setDirection = (direction: FlashDirection) => {
    setFlashDirection(direction);
    saveFlashDirection(deck.slug, direction);
    setShowAnswer(false);
  };

  const nextFlashcard = () => {
    if (reviewQueue.length === 0) return;
    setQueueIndex((currentIndex) => (currentIndex + 1) % reviewQueue.length);
    setShowAnswer(false);
  };

  const scoreFlashcard = (result: "known" | "review") => {
    if (roundComplete || completed) return;
    setResumed(false);
    recordJudgment({
      slug: deck.slug,
      title: deck.title,
      mode: "flashcards",
      prompt: currentCard.prompt,
      answer: currentCard.answer,
      correct: result === "known",
    });

    let nextNeedAgain = needAgainQueue;
    if (result === "review") {
      if (!needAgainQueue.includes(currentCardIndex)) {
        nextNeedAgain = [...needAgainQueue, currentCardIndex];
      }
      setReviewThisRound((value) => value + 1);
    } else {
      if (needAgainQueue.includes(currentCardIndex)) {
        nextNeedAgain = needAgainQueue.filter((index) => index !== currentCardIndex);
      }
      setKnownThisRound((value) => value + 1);
    }
    setNeedAgainQueue(nextNeedAgain);

    const isLast = queueIndex >= reviewQueue.length - 1;
    if (isLast) {
      setShowAnswer(false);
      if (nextNeedAgain.length === 0) {
        setCompleted(true);
      } else {
        setRoundComplete(true);
      }
      return;
    }

    setQueueIndex((value) => value + 1);
    setShowAnswer(false);
  };

  const startNextRound = () => {
    if (needAgainQueue.length === 0) return;
    setReviewQueue(shuffle(needAgainQueue));
    setQueueIndex(0);
    setNeedAgainQueue([]);
    setRound((value) => value + 1);
    setKnownThisRound(0);
    setReviewThisRound(0);
    setRoundComplete(false);
    setShowAnswer(false);
    setResumed(false);
  };

  const nextQuestion = () => {
    setQuestion((currentQuestion) => buildQuestion(items, currentQuestion.prompt.prompt));
    setSelectedOption(null);
  };

  const resetMultipleChoice = () => {
    setCorrectCount(0);
    setAttemptCount(0);
    setStreak(0);
    setBestStreak(0);
    setSelectedOption(null);
    setQuestion(buildQuestion(items));
  };

  const commitTypedVerdict = (verdict: "correct" | "incorrect") => {
    recordJudgment({
      slug: deck.slug,
      title: deck.title,
      mode: "typed",
      prompt: typedCard.prompt,
      answer: typedCard.answer,
      correct: verdict === "correct",
    });
    setStreakBeforeJudge(typedStreak);
    setTypedPhase("judged");
    setTypedVerdict(verdict);
    setTypedAttempts((value) => value + 1);
    if (verdict === "correct") {
      setTypedCorrect((value) => value + 1);
      setTypedStreak((value) => {
        const next = value + 1;
        setTypedBestStreak((best) => Math.max(best, next));
        return next;
      });
    } else {
      setTypedStreak(0);
    }
  };

  const nextTypedQuestion = () => {
    setTypedCard(pickCard(items, typedCard.prompt));
    setGuess("");
    setTypedPhase("answering");
  };

  const handleTypedSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (typedPhase === "judged") {
      nextTypedQuestion();
      return;
    }
    if (!guess.trim()) return;
    commitTypedVerdict(judgeAnswer(guess, typedCard.answer));
  };

  const skipTyped = () => {
    if (typedPhase === "answering") commitTypedVerdict("incorrect");
  };

  // The matcher can't know every acceptable equivalence ("FDR" for
  // "Franklin Roosevelt"), so let the user overrule a wrong "incorrect".
  const overrideTypedCorrect = () => {
    if (typedPhase !== "judged" || typedVerdict === "correct") return;
    amendJudgmentToCorrect({
      slug: deck.slug,
      mode: "typed",
      prompt: typedCard.prompt,
    });
    setTypedVerdict("correct");
    setTypedCorrect((value) => value + 1);
    const next = streakBeforeJudge + 1;
    setTypedStreak(next);
    setTypedBestStreak((best) => Math.max(best, next));
  };

  const resetTyped = () => {
    setTypedAttempts(0);
    setTypedCorrect(0);
    setTypedStreak(0);
    setTypedBestStreak(0);
    setStreakBeforeJudge(0);
    setGuess("");
    setTypedPhase("answering");
    setTypedCard(pickCard(items));
  };

  const handleGuess = (option: string) => {
    if (selectedOption !== null) return;

    const isCorrect = option === question.prompt.answer;
    recordJudgment({
      slug: deck.slug,
      title: deck.title,
      mode: "multiple-choice",
      prompt: question.prompt.prompt,
      answer: question.prompt.answer,
      correct: isCorrect,
    });
    setSelectedOption(option);
    setAttemptCount((value) => value + 1);

    if (isCorrect) {
      setCorrectCount((value) => value + 1);
      setStreak((value) => {
        const nextStreak = value + 1;
        setBestStreak((best) => Math.max(best, nextStreak));
        return nextStreak;
      });
      return;
    }

    setStreak(0);
  };

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (mode !== "flashcards") return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (roundComplete) {
        if (e.code === "Enter") {
          e.preventDefault();
          startNextRound();
        }
        return;
      }

      if (completed) {
        if (e.code === "Enter") {
          e.preventDefault();
          resetFlashcards();
        }
        return;
      }

      switch (e.code) {
        case "Space":
          e.preventDefault();
          setShowAnswer((v) => !v);
          break;
        case "Digit1":
          if (showAnswer) scoreFlashcard("known");
          break;
        case "Digit2":
          if (showAnswer) scoreFlashcard("review");
          break;
        case "ArrowRight":
          nextFlashcard();
          break;
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // scoreFlashcard, nextFlashcard, startNextRound, resetFlashcards use stable setters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, showAnswer, roundComplete, completed]);

  // Restore saved flashcard progress once per deck. Saved indices are only
  // trusted when the deck is the same size it was when progress was written.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (reversible) setFlashDirection(loadFlashDirection(deck.slug));
    const saved = loadFlashcardProgress(deck.slug);
    if (saved && saved.deckSize === items.length) {
      const validIndex = (index: number) =>
        Number.isInteger(index) && index >= 0 && index < items.length;
      const savedReview = saved.reviewQueue.filter(validIndex);
      const savedNeedAgain = saved.needAgainQueue.filter(validIndex);
      if (savedReview.length > 0) {
        setReviewQueue(savedReview);
        setQueueIndex(Math.min(Math.max(saved.queueIndex, 0), savedReview.length - 1));
        setNeedAgainQueue(savedNeedAgain);
        setRound(saved.round >= 1 ? saved.round : 1);
        setKnownThisRound(saved.knownThisRound ?? 0);
        setReviewThisRound(saved.reviewThisRound ?? 0);
        setRoundComplete(Boolean(saved.roundComplete));
        setCompleted(Boolean(saved.completed));
        const hasProgress =
          saved.round > 1 ||
          saved.queueIndex > 0 ||
          savedNeedAgain.length > 0 ||
          saved.roundComplete ||
          saved.completed;
        if (hasProgress) setResumed(true);
      }
    }
    setStorageReady(true);
    // items derive from deck, so deck.slug is the only meaningful dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck.slug]);

  // Persist progress so a refresh (or returning days later) resumes the run.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!storageReady) return;
    saveFlashcardProgress(deck.slug, {
      version: 1,
      title: deck.title,
      deckSize: items.length,
      reviewQueue,
      queueIndex,
      needAgainQueue,
      round,
      knownThisRound,
      reviewThisRound,
      roundComplete,
      completed,
      updatedAt: new Date().toISOString(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    storageReady,
    deck.slug,
    reviewQueue,
    queueIndex,
    needAgainQueue,
    round,
    knownThisRound,
    reviewThisRound,
    roundComplete,
    completed,
  ]);

  // Keep the typed-answer input focused so the user can answer immediately.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (mode === "typed" && typedPhase === "answering") {
      typedInputRef.current?.focus();
    }
  }, [mode, typedPhase, typedCard]);

  const SidebarContent = () => (
    <aside className="space-y-4">
      <div className="rounded-[2rem] border border-white/10 bg-white/6 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <p className="text-[11px] uppercase tracking-[0.26em] text-indigo-200">Deck Stats</p>
        <div className="mt-4 grid gap-3">
          <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
            <div className="text-2xl font-semibold text-white">{items.length}</div>
            <div className="mt-1 text-sm text-slate-300">Entries in the deck</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
            <div className="text-2xl font-semibold text-white">
              {mode === "flashcards"
                ? `Round ${round}`
                : mode === "multiple-choice"
                  ? attemptCount
                  : typedAttempts}
            </div>
            <div className="mt-1 text-sm text-slate-300">
              {mode === "flashcards"
                ? `${roundSize} card${roundSize === 1 ? "" : "s"} this round`
                : mode === "multiple-choice"
                  ? "Questions answered"
                  : "Responses typed"}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[2rem] border border-white/10 bg-white/6 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <p className="text-[11px] uppercase tracking-[0.26em] text-indigo-200">How To Use</p>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-200">
          {deck.notes.map((note) => (
            <p key={note}>{note}</p>
          ))}
        </div>
        {mode === "flashcards" && (
          <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/50 p-3 text-xs text-slate-300">
            <p className="font-semibold text-slate-200 mb-1">Keyboard shortcuts</p>
            <p>Space — show / hide answer</p>
            <p>1 — I knew it</p>
            <p>2 — Need it again</p>
            <p>→ — Next card (skip)</p>
            <p>Enter — Start next round / Restart</p>
          </div>
        )}
      </div>
    </aside>
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="rounded-[2rem] border border-white/10 bg-white/6 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl lg:p-6">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.26em] text-indigo-200">
              Practice Modes
            </p>
            <p className="mt-2 hidden max-w-2xl text-sm leading-relaxed text-slate-200 lg:block">
              Self-graded flashcards or scored multiple choice — switch any time.
            </p>
          </div>
          <div
            role="tablist"
            aria-label="Practice mode"
            className="inline-flex rounded-full border border-white/10 bg-slate-950/50 p-1"
          >
            {(["flashcards", "multiple-choice", "typed"] as const).map((tab) => {
              const active = tab === mode;
              const label = MODE_LABELS[tab];
              return (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setMode(tab)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    active
                      ? "bg-emerald-300 text-slate-950"
                      : "border border-white/15 text-slate-200 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {mode === "flashcards" ? (
          <div className="mt-6 space-y-5">
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-200">
              <span className="rounded-full border border-indigo-300/20 bg-indigo-300/10 px-3 py-1.5 text-indigo-100">
                Round {round}
              </span>
              {resumed && (
                <span className="rounded-full border border-fuchsia-300/25 bg-fuchsia-300/10 px-3 py-1.5 text-fuchsia-100">
                  Resumed from last visit
                </span>
              )}
              {!completed && !roundComplete && (
                <span className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1.5">
                  Card {progress} of {roundSize}
                </span>
              )}
              {knownThisRound > 0 && (
                <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-emerald-100">
                  Knew it: {knownThisRound}
                </span>
              )}
              {reviewThisRound > 0 && (
                <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-amber-100">
                  Need again: {reviewThisRound}
                </span>
              )}
              {needAgainQueue.length > 0 && !completed && (
                <span className="rounded-full border border-sky-300/20 bg-sky-300/10 px-3 py-1.5 text-sky-100">
                  To review next: {needAgainQueue.length}
                </span>
              )}
            </div>

            {completed ? (
              <div className="rounded-[2rem] border border-emerald-300/30 bg-[linear-gradient(160deg,rgba(6,78,59,0.6),rgba(15,23,42,0.85))] p-6 lg:p-8">
                <p className="text-[11px] uppercase tracking-[0.26em] text-emerald-200">
                  Deck mastered
                </p>
                <h3 className="mt-4 text-3xl font-semibold text-white lg:text-4xl">
                  Nothing left to review!
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-emerald-50/90">
                  You cleared every card across {round} round{round === 1 ? "" : "s"}.
                  Start over to keep the recall fresh.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={resetFlashcards}
                    className="rounded-full bg-emerald-300 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200"
                  >
                    Restart deck
                    <span className="ml-2 text-xs opacity-60">Enter</span>
                  </button>
                </div>
              </div>
            ) : roundComplete ? (
              <div className="rounded-[2rem] border border-amber-300/30 bg-[linear-gradient(160deg,rgba(120,53,15,0.5),rgba(15,23,42,0.85))] p-6 lg:p-8">
                <p className="text-[11px] uppercase tracking-[0.26em] text-amber-200">
                  Round {round} complete
                </p>
                <h3 className="mt-4 text-3xl font-semibold text-white lg:text-4xl">
                  {needAgainQueue.length} card{needAgainQueue.length === 1 ? "" : "s"} to review
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-amber-50/90">
                  Round {round + 1} will only show the cards you marked
                  &ldquo;Need it again&rdquo;. Keep going until the queue is empty.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={startNextRound}
                    className="rounded-full bg-amber-300 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-200"
                  >
                    Start round {round + 1} →
                    <span className="ml-2 text-xs opacity-60">Enter</span>
                  </button>
                  <button
                    type="button"
                    onClick={resetFlashcards}
                    className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-indigo-50 transition hover:border-white/40 hover:bg-white/10"
                  >
                    Restart whole deck
                  </button>
                </div>
              </div>
            ) : (
              <>
                {reversible && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Direction
                    </span>
                    <div
                      role="group"
                      aria-label="Flashcard direction"
                      className="inline-flex rounded-full border border-white/10 bg-slate-950/50 p-1"
                    >
                      <button
                        type="button"
                        aria-pressed={!reversed}
                        onClick={() => setDirection("forward")}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                          !reversed
                            ? "bg-emerald-300 text-slate-950"
                            : "text-slate-200 hover:bg-white/10"
                        }`}
                      >
                        {deck.promptLabel} → {deck.answerLabel}
                      </button>
                      <button
                        type="button"
                        aria-pressed={reversed}
                        onClick={() => setDirection("reverse")}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                          reversed
                            ? "bg-emerald-300 text-slate-950"
                            : "text-slate-200 hover:bg-white/10"
                        }`}
                      >
                        {deck.answerLabel} → {deck.promptLabel}
                      </button>
                    </div>
                  </div>
                )}
                <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(160deg,rgba(15,23,42,0.95),rgba(30,41,59,0.85))] p-6 lg:p-8">
                  <p className="text-[11px] uppercase tracking-[0.26em] text-indigo-200">
                    {frontLabel}
                  </p>
                  <div className="mt-5 text-3xl font-semibold text-white lg:text-5xl">
                    {frontText}
                  </div>

                  <div className="mt-8 rounded-[1.5rem] border border-dashed border-white/15 bg-black/20 p-5">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-300">
                      {backLabel}
                    </p>
                    <div aria-live="polite">
                      {showAnswer ? (
                        <p className="mt-3 text-xl leading-relaxed text-emerald-100 lg:text-2xl">
                          {backText}
                        </p>
                      ) : (
                        <p className="mt-3 text-lg text-slate-300/70">
                          Reveal the answer when you are ready.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {!showAnswer ? (
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setShowAnswer(true)}
                      className="rounded-full bg-emerald-300 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200"
                    >
                      Show answer
                      <span className="ml-2 text-xs opacity-60">Space</span>
                    </button>
                    <button
                      type="button"
                      onClick={nextFlashcard}
                      className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-indigo-50 transition hover:border-white/40 hover:bg-white/10"
                    >
                      Skip card →
                    </button>
                    <button
                      type="button"
                      onClick={resetFlashcards}
                      className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-indigo-50 transition hover:border-white/40 hover:bg-white/10"
                    >
                      Restart deck
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="mb-2 text-xs text-slate-300">How well did you know this?</p>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => scoreFlashcard("known")}
                        className="rounded-full bg-emerald-300 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200"
                      >
                        ✓ I knew it
                        <span className="ml-2 text-xs opacity-60">1</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => scoreFlashcard("review")}
                        className="rounded-full bg-amber-300 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-200"
                      >
                        ↻ Need it again
                        <span className="ml-2 text-xs opacity-60">2</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAnswer(false)}
                        className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-indigo-50 transition hover:border-white/40 hover:bg-white/10"
                      >
                        Hide answer
                      </button>
                      <button
                        type="button"
                        onClick={nextFlashcard}
                        className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-indigo-50 transition hover:border-white/40 hover:bg-white/10"
                      >
                        Skip card →
                      </button>
                      <button
                        type="button"
                        onClick={resetFlashcards}
                        className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-indigo-50 transition hover:border-white/40 hover:bg-white/10"
                      >
                        Restart deck
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="xl:hidden">
              <button
                type="button"
                onClick={() => setShowMobileStats((v) => !v)}
                className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-indigo-50 transition hover:border-white/40 hover:bg-white/10"
              >
                {showMobileStats ? "Hide stats & help ▲" : "Stats & help ▼"}
              </button>
              {showMobileStats && (
                <div className="mt-4">
                  <SidebarContent />
                </div>
              )}
            </div>
          </div>
        ) : mode === "multiple-choice" ? (
          <div className="mt-6 space-y-5">
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-200">
              <span className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1.5">
                Attempts: {attemptCount}
              </span>
              <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-emerald-100">
                Correct: {correctCount}
              </span>
              <span className="rounded-full border border-sky-300/20 bg-sky-300/10 px-3 py-1.5 text-sky-100">
                Accuracy: {accuracy}%
              </span>
              <span className="rounded-full border border-fuchsia-300/20 bg-fuchsia-300/10 px-3 py-1.5 text-fuchsia-100">
                Best streak: {bestStreak}
              </span>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(160deg,rgba(15,23,42,0.95),rgba(30,41,59,0.85))] p-6 lg:p-8">
              <p className="text-[11px] uppercase tracking-[0.26em] text-indigo-200">Prompt</p>
              <h3 className="mt-4 text-2xl font-semibold text-white lg:text-4xl">
                {deck.questionPrompt(question.prompt)}
              </h3>

              <div className="mt-8 grid gap-3 md:grid-cols-2">
                {question.options.map((option) => {
                  const isCorrect = option === question.prompt.answer;
                  const isSelected = option === selectedOption;

                  let tone =
                    "border-white/10 bg-slate-950/50 text-slate-100 hover:border-white/35 hover:bg-white/10";

                  if (answered && isCorrect) {
                    tone = "border-emerald-300/40 bg-emerald-300/15 text-emerald-50";
                  } else if (answered && isSelected && !isCorrect) {
                    tone = "border-rose-300/40 bg-rose-300/15 text-rose-50";
                  }

                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => handleGuess(option)}
                      className={`rounded-[1.5rem] border px-4 py-4 text-left text-sm font-medium transition ${tone}`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>

              {answered && (
                <div
                  className={`mt-6 rounded-[1.5rem] border px-4 py-4 text-sm ${
                    selectedCorrect
                      ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-50"
                      : "border-rose-300/30 bg-rose-300/10 text-rose-50"
                  }`}
                >
                  {selectedCorrect
                    ? deck.correctFeedback(question.prompt)
                    : deck.incorrectFeedback(question.prompt)}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={nextQuestion}
                className="rounded-full bg-emerald-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200"
              >
                Next question
              </button>
              <button
                type="button"
                onClick={resetMultipleChoice}
                className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-indigo-50 transition hover:border-white/40 hover:bg-white/10"
              >
                Reset score
              </button>
              <span className="self-center text-sm text-slate-300">
                Current streak: {streak}
              </span>
            </div>

            <div className="xl:hidden">
              <button
                type="button"
                onClick={() => setShowMobileStats((v) => !v)}
                className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-indigo-50 transition hover:border-white/40 hover:bg-white/10"
              >
                {showMobileStats ? "Hide stats & help ▲" : "Stats & help ▼"}
              </button>
              {showMobileStats && (
                <div className="mt-4">
                  <SidebarContent />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-200">
              <span className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1.5">
                Attempts: {typedAttempts}
              </span>
              <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-emerald-100">
                Correct: {typedCorrect}
              </span>
              <span className="rounded-full border border-sky-300/20 bg-sky-300/10 px-3 py-1.5 text-sky-100">
                Accuracy: {typedAccuracy}%
              </span>
              <span className="rounded-full border border-fuchsia-300/20 bg-fuchsia-300/10 px-3 py-1.5 text-fuchsia-100">
                Best streak: {typedBestStreak}
              </span>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(160deg,rgba(15,23,42,0.95),rgba(30,41,59,0.85))] p-6 lg:p-8">
              <p className="text-[11px] uppercase tracking-[0.26em] text-indigo-200">Prompt</p>
              <h3 className="mt-4 text-2xl font-semibold text-white lg:text-4xl">
                {deck.questionPrompt(typedCard)}
              </h3>

              <form onSubmit={handleTypedSubmit} className="mt-8">
                <label
                  htmlFor="typed-answer"
                  className="text-[11px] uppercase tracking-[0.24em] text-slate-300"
                >
                  {deck.answerLabel}
                </label>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                  <input
                    ref={typedInputRef}
                    id="typed-answer"
                    type="text"
                    value={guess}
                    onChange={(event) => setGuess(event.target.value)}
                    readOnly={typedPhase === "judged"}
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
                    {typedPhase === "answering" ? "Submit" : "Next question →"}
                    <span className="ml-2 text-xs opacity-60">Enter</span>
                  </button>
                </div>
              </form>

              {typedPhase === "judged" && (
                <div
                  aria-live="polite"
                  className={`mt-6 rounded-[1.5rem] border px-4 py-4 text-sm ${
                    typedVerdict === "correct"
                      ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-50"
                      : "border-rose-300/30 bg-rose-300/10 text-rose-50"
                  }`}
                >
                  {typedVerdict === "correct"
                    ? deck.correctFeedback(typedCard)
                    : deck.incorrectFeedback(typedCard)}
                  {typedVerdict === "incorrect" && guess.trim().length > 0 && (
                    <button
                      type="button"
                      onClick={overrideTypedCorrect}
                      className="mt-3 block rounded-full border border-white/20 px-4 py-1.5 text-xs font-semibold text-rose-50 transition hover:border-white/45 hover:bg-white/10"
                    >
                      My answer was actually right
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              {typedPhase === "answering" && (
                <button
                  type="button"
                  onClick={skipTyped}
                  className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-indigo-50 transition hover:border-white/40 hover:bg-white/10"
                >
                  Show answer
                </button>
              )}
              <button
                type="button"
                onClick={resetTyped}
                className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-indigo-50 transition hover:border-white/40 hover:bg-white/10"
              >
                Reset score
              </button>
              <span className="self-center text-sm text-slate-300">
                Current streak: {typedStreak}
              </span>
            </div>

            <div className="xl:hidden">
              <button
                type="button"
                onClick={() => setShowMobileStats((v) => !v)}
                className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-indigo-50 transition hover:border-white/40 hover:bg-white/10"
              >
                {showMobileStats ? "Hide stats & help ▲" : "Stats & help ▼"}
              </button>
              {showMobileStats && (
                <div className="mt-4">
                  <SidebarContent />
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <div className="hidden xl:block">
        <SidebarContent />
      </div>
    </div>
  );
}
