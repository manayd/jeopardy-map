"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { PracticeDeck } from "@/components/practice-deck";
import { SiteNav } from "@/components/site-nav";
import type { PracticeCard, PracticeDeckConfig } from "@/lib/practice-data";

type ClueResponse = {
  id: string;
  title: string;
  total: number;
  clues: Array<{
    prompt?: string;
    answer?: string;
  }>;
};

const CLUE_FETCH_LIMIT = 200;

// Each topic deck draws a deterministic pseudo-random sample of the topic's
// full clue pool, keyed by a seed kept in localStorage: reloads resume the
// same deck, while "Restart deck" rotates the seed for a fresh draw.
const seedKey = (topicId: string) => `jeopardy-map:practice-seed:topic-${topicId}`;

const newSeed = () => Math.floor(Math.random() * 1_000_000);

function loadOrCreateSeed(topicId: string): number {
  try {
    const raw = window.localStorage.getItem(seedKey(topicId));
    const parsed = raw === null ? NaN : Number(raw);
    if (Number.isFinite(parsed)) return parsed;
    const seed = newSeed();
    window.localStorage.setItem(seedKey(topicId), String(seed));
    return seed;
  } catch {
    return newSeed();
  }
}

function rotateSeed(topicId: string): number {
  const seed = newSeed();
  try {
    window.localStorage.setItem(seedKey(topicId), String(seed));
  } catch {
    // ignore — deck still rotates for this visit
  }
  return seed;
}

function buildTopicDeck(topicId: string, data: ClueResponse): PracticeDeckConfig {
  const seen = new Set<string>();
  const items: PracticeCard[] = [];

  for (const clue of data.clues) {
    const prompt = (clue.prompt ?? "").trim();
    const answer = (clue.answer ?? "").trim();
    if (!prompt || !answer) continue;
    const key = `${prompt}::${answer}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ prompt, answer });
  }

  return {
    slug: `topic-${topicId}`,
    title: data.title,
    description:
      data.total > items.length
        ? `Drill ${items.length} real Jeopardy clues from this topic (of ${data.total} in the archive).`
        : `Drill ${items.length} real Jeopardy clues from this topic.`,
    promptLabel: "Clue",
    answerLabel: "Correct response",
    notes: [
      "These are real clues as they aired, pulled straight from the archive for this map topic.",
      "Use flashcards for recall practice and multiple choice when you want scored reps.",
    ],
    items,
    questionPrompt: (item) => item.prompt,
    correctFeedback: (item) => `Correct — ${item.answer}.`,
    incorrectFeedback: (item) => `The correct response was ${item.answer}.`,
    // A Jeopardy clue can't be recalled from its answer, so don't offer flip.
    reversible: false,
  };
}

export default function TopicPracticePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const topicId = decodeURIComponent(id);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [deck, setDeck] = useState<PracticeDeckConfig | null>(null);
  const [seed, setSeed] = useState<number | null>(null);

  useEffect(() => {
    setSeed(loadOrCreateSeed(topicId));
  }, [topicId]);

  useEffect(() => {
    if (seed === null) return;
    let alive = true;
    const load = async () => {
      setStatus("loading");
      try {
        const response = await fetch(
          `/api/topics/${encodeURIComponent(topicId)}/clues?limit=${CLUE_FETCH_LIMIT}&seed=${seed}`,
        );
        if (!response.ok) throw new Error("Failed to load clues");
        const data = (await response.json()) as ClueResponse;
        if (!alive) return;
        setDeck(buildTopicDeck(topicId, data));
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
  }, [topicId, seed]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-slate-50">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(120,119,198,0.15),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.12),transparent_25%),radial-gradient(circle_at_50%_80%,rgba(16,185,129,0.12),transparent_35%)]" />
        <SiteNav current="practice" />

        <main className="relative mx-auto max-w-[94vw] px-6 pb-16 pt-8 lg:px-10">
          <section className="rounded-[2rem] border border-white/10 bg-white/6 p-8 shadow-2xl shadow-black/30 backdrop-blur-xl">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-indigo-200">
                  Topic Practice
                </p>
                <h1 className="mt-3 text-4xl font-semibold text-white">
                  {deck?.title ?? (status === "loading" ? "Loading topic…" : "Topic practice")}
                </h1>
                <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-200">
                  {status === "ready" && deck
                    ? deck.description
                    : status === "loading"
                      ? "Pulling real Jeopardy clues for this topic from the archive."
                      : "We could not load clues for this topic."}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/"
                  className="inline-flex rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-indigo-50 transition hover:border-white/40 hover:bg-white/10"
                >
                  Back to map
                </Link>
                <Link
                  href="/practice"
                  className="inline-flex rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-indigo-50 transition hover:border-white/40 hover:bg-white/10"
                >
                  Curated decks
                </Link>
              </div>
            </div>
          </section>

          <div className="mt-6">
            {status === "ready" && deck ? (
              <PracticeDeck
                key={seed}
                deck={deck}
                onRestart={() => setSeed(rotateSeed(topicId))}
              />
            ) : status === "loading" ? (
              <div className="rounded-[2rem] border border-white/10 bg-white/6 p-6 text-slate-200">
                Loading clues…
              </div>
            ) : (
              <div className="rounded-[2rem] border border-rose-300/20 bg-rose-300/10 p-6 text-rose-50">
                Could not load clues for this topic. Head back to the map and try
                another node.
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
