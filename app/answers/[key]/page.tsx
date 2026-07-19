"use client";

/*
 * One canonical answer, every angle the writers have used for it. Seeing all
 * the clues that point at the same answer teaches the facets Jeopardy
 * actually asks — the highest-density way to learn an entity.
 */

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { SiteNav } from "@/components/site-nav";

type AnswerDetail = {
  key: string;
  display: string;
  clue_count: number;
  subject_id: string;
  clues: Array<{
    prompt: string;
    answer: string;
    value: number;
    round: number;
    air_date: string;
    category: string;
  }>;
};

const clueYear = (airDate?: string) => /^(\d{4})/.exec(airDate ?? "")?.[1] ?? "";

export default function AnswerPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = use(params);
  const answerKey = decodeURIComponent(key);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [detail, setDetail] = useState<AnswerDetail | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const response = await fetch(
          `/api/answers/${encodeURIComponent(answerKey)}?limit=100`,
        );
        if (!response.ok) throw new Error("failed");
        const data = (await response.json()) as AnswerDetail;
        if (!alive) return;
        setDetail(data);
        setStatus("ready");
      } catch {
        if (!alive) return;
        setStatus("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [answerKey]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-slate-50">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(120,119,198,0.15),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.12),transparent_25%),radial-gradient(circle_at_50%_80%,rgba(16,185,129,0.12),transparent_35%)]" />
        <SiteNav current="map" />

        <main className="relative mx-auto max-w-4xl px-6 pb-16 pt-8 lg:px-10">
          <section className="rounded-[2rem] border border-white/10 bg-white/6 p-8 shadow-2xl shadow-black/30 backdrop-blur-xl">
            <p className="text-sm uppercase tracking-[0.25em] text-indigo-200">
              Canon Answer
            </p>
            <h1 className="mt-3 text-4xl font-semibold text-white">
              {detail?.display ??
                (status === "loading" ? "Loading…" : "Answer not found")}
            </h1>
            {detail && (
              <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-200">
                Asked {detail.clue_count} time{detail.clue_count === 1 ? "" : "s"} in
                the archive
                {detail.subject_id &&
                  detail.subject_id !== "misc" &&
                  detail.subject_id !== "potpourri" && (
                    <> · filed under {detail.subject_id.replace("-", " ")}</>
                  )}
                . Read the angles below — Jeopardy asks about the same entity many
                different ways.
              </p>
            )}
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/"
                className="inline-flex rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-indigo-50 transition hover:border-white/40 hover:bg-white/10"
              >
                ← Curriculum
              </Link>
              {detail?.subject_id &&
                detail.subject_id !== "misc" &&
                detail.subject_id !== "potpourri" && (
                  <Link
                    href={`/practice/topic/${encodeURIComponent(`canon:${detail.subject_id}`)}`}
                    className="inline-flex rounded-full bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-200"
                  >
                    Drill this subject&rsquo;s canon →
                  </Link>
                )}
            </div>
          </section>

          <div className="mt-6">
            {status === "loading" ? (
              <div className="rounded-[2rem] border border-white/10 bg-white/6 p-6 text-slate-200">
                Loading clues…
              </div>
            ) : status === "error" || !detail ? (
              <div className="rounded-[2rem] border border-rose-300/20 bg-rose-300/10 p-6 text-rose-50">
                Could not load this answer.
              </div>
            ) : (
              <div className="grid gap-3">
                {detail.clues.map((clue, index) => (
                  <div
                    key={`${clue.air_date}-${index}`}
                    className="rounded-2xl border border-white/10 bg-slate-950/50 p-4"
                  >
                    <div className="text-[11px] uppercase tracking-[0.2em] text-indigo-200/80">
                      {clue.category}
                      {clue.round === 3
                        ? " · Final Jeopardy!"
                        : clue.value > 0 && ` · $${clue.value}`}
                      {clueYear(clue.air_date) && ` · ${clueYear(clue.air_date)}`}
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-slate-100">
                      {clue.prompt}
                    </p>
                  </div>
                ))}
                {detail.clue_count > detail.clues.length && (
                  <p className="text-sm text-slate-400">
                    Showing the {detail.clues.length} most recent of{" "}
                    {detail.clue_count} clues.
                  </p>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
