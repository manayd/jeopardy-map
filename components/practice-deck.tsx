"use client";

import { useEffect, useState } from "react";
import type { PracticeCard, PracticeDeckConfig } from "@/lib/practice-data";

type PracticeMode = "flashcards" | "multiple-choice";

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

function buildQuestion(items: PracticeCard[], previousPrompt?: string): MultipleChoiceQuestion {
  let prompt = items[Math.floor(Math.random() * items.length)];

  while (items.length > 1 && prompt.prompt === previousPrompt) {
    prompt = items[Math.floor(Math.random() * items.length)];
  }

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

export function PracticeDeck({ deck }: { deck: PracticeDeckConfig }) {
  const items = deck.items;
  const deckIndices = items.map((_, index) => index);
  const [mode, setMode] = useState<PracticeMode>("flashcards");
  const [flashcardOrder, setFlashcardOrder] = useState(() => shuffle(deckIndices));
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [knownCount, setKnownCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [question, setQuestion] = useState(() => buildQuestion(items));
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [attemptCount, setAttemptCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [showMobileStats, setShowMobileStats] = useState(false);

  if (!items.length) {
    return (
      <div className="rounded-[2rem] border border-white/10 bg-white/6 p-6 text-slate-200">
        No items are available in this deck yet.
      </div>
    );
  }

  const currentCard = items[flashcardOrder[flashcardIndex] ?? 0] ?? items[0];
  const progress = flashcardIndex + 1;
  const accuracy = attemptCount === 0 ? 0 : Math.round((correctCount / attemptCount) * 100);
  const answered = selectedOption !== null;
  const selectedCorrect = selectedOption === question.prompt.answer;

  const resetFlashcards = () => {
    setFlashcardOrder(shuffle(deckIndices));
    setFlashcardIndex(0);
    setShowAnswer(false);
    setKnownCount(0);
    setReviewCount(0);
  };

  const nextFlashcard = () => {
    setFlashcardIndex((currentIndex) => (currentIndex + 1) % flashcardOrder.length);
    setShowAnswer(false);
  };

  const scoreFlashcard = (result: "known" | "review") => {
    if (result === "known") {
      setKnownCount((value) => value + 1);
    } else {
      setReviewCount((value) => value + 1);
    }
    nextFlashcard();
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

  const handleGuess = (option: string) => {
    if (selectedOption !== null) return;

    const isCorrect = option === question.prompt.answer;
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
    // scoreFlashcard and nextFlashcard only use stable setters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, showAnswer]);

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
              {mode === "flashcards" ? progress : attemptCount}
            </div>
            <div className="mt-1 text-sm text-slate-300">
              {mode === "flashcards" ? "Cards seen this run" : "Questions answered"}
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
            <p>→ — Next card</p>
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
            <h2 className="mt-2 text-2xl font-semibold text-white">{deck.title}</h2>
            <p className="mt-2 hidden max-w-2xl text-sm leading-relaxed text-slate-200 lg:block">
              Switch between self-graded flashcards and scored multiple choice for
              deliberate repetition instead of passive review.
            </p>
          </div>
          <div
            role="tablist"
            aria-label="Practice mode"
            className="inline-flex rounded-full border border-white/10 bg-slate-950/50 p-1"
          >
            {(["flashcards", "multiple-choice"] as const).map((tab) => {
              const active = tab === mode;
              const label = tab === "flashcards" ? "Flashcards" : "Multiple Choice";
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
              <span className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1.5">
                Card {progress} of {items.length}
              </span>
              <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-emerald-100">
                Knew it: {knownCount}
              </span>
              <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-amber-100">
                Review: {reviewCount}
              </span>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(160deg,rgba(15,23,42,0.95),rgba(30,41,59,0.85))] p-6 lg:p-8">
              <p className="text-[11px] uppercase tracking-[0.26em] text-indigo-200">
                {deck.promptLabel}
              </p>
              <div className="mt-5 text-3xl font-semibold text-white lg:text-5xl">
                {currentCard.prompt}
              </div>

              <div className="mt-8 rounded-[1.5rem] border border-dashed border-white/15 bg-black/20 p-5">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-300">
                  {deck.answerLabel}
                </p>
                <div aria-live="polite">
                  {showAnswer ? (
                    <p className="mt-3 text-xl leading-relaxed text-emerald-100 lg:text-2xl">
                      {currentCard.answer}
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
                  Next card →
                </button>
                <button
                  type="button"
                  onClick={resetFlashcards}
                  className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-indigo-50 transition hover:border-white/40 hover:bg-white/10"
                >
                  Shuffle deck
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
                    Next card →
                  </button>
                  <button
                    type="button"
                    onClick={resetFlashcards}
                    className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-indigo-50 transition hover:border-white/40 hover:bg-white/10"
                  >
                    Shuffle deck
                  </button>
                </div>
              </div>
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
        ) : (
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
        )}
      </section>

      <div className="hidden xl:block">
        <SidebarContent />
      </div>
    </div>
  );
}
