"use client";

import Link from "next/link";
import { PracticeDeck } from "@/components/practice-deck";
import { SiteNav } from "@/components/site-nav";
import { getPracticeDeck } from "@/lib/practice-data";

export function PracticeDeckPage({ deckSlug }: { deckSlug: string }) {
  const deck = getPracticeDeck(deckSlug);

  if (!deck) return null;

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
                  Practice Deck
                </p>
                <h1 className="mt-3 text-4xl font-semibold text-white">{deck.title}</h1>
                <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-200/85">
                  {deck.description}
                </p>
              </div>
              <Link
                href="/practice"
                className="inline-flex rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-indigo-50 transition hover:border-white/40 hover:bg-white/10"
              >
                Back to practice list
              </Link>
            </div>
          </section>

          <div className="mt-6">
            <PracticeDeck deck={deck} />
          </div>
        </main>
      </div>
    </div>
  );
}
