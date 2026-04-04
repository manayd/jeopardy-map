"use client";

import Link from "next/link";
import { SiteNav } from "@/components/site-nav";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-slate-50">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(120,119,198,0.15),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.12),transparent_25%),radial-gradient(circle_at_50%_80%,rgba(16,185,129,0.12),transparent_35%)]" />
        <SiteNav current="about" />
        <main className="relative mx-auto max-w-3xl px-6 pb-16 pt-14 lg:px-10">
          <div className="rounded-3xl border border-white/10 bg-white/5 px-8 py-10 shadow-2xl shadow-black/30 backdrop-blur-lg">
            <p className="text-sm uppercase tracking-[0.25em] text-indigo-200">About</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Jeopardy Knowledge Map</h1>
            <p className="mt-4 text-sm leading-relaxed text-slate-200/90">
              This prototype is an exploratory atlas for Jeopardy-style trivia. Instead of traditional clue
              boards, it visualizes category relationships as a zoomable mind map so you can roam freely,
              dive into subtopics, and preview representative clues without timers or scoring.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-200/90">
              All content is placeholder for now; future iterations can pull from historical archives,
              add richer overlaps, and support curation tools. The goal is exploratory learning and
              conceptual coverage—not competitive play.
            </p>
            <div className="mt-6 flex gap-3 text-sm">
              <Link
                href="/"
                className="rounded-full border border-white/20 px-4 py-2 font-semibold text-indigo-50 transition hover:border-white/50 hover:bg-white/10"
              >
                Return to Map
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
