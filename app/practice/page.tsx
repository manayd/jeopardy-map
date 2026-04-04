import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { practiceTopics } from "@/lib/practice-data";

export default function PracticePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-slate-50">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(120,119,198,0.15),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.12),transparent_25%),radial-gradient(circle_at_50%_80%,rgba(16,185,129,0.12),transparent_35%)]" />
        <SiteNav current="practice" />

        <main className="relative mx-auto max-w-[94vw] px-6 pb-16 pt-8 lg:px-10">
          <section className="rounded-[2rem] border border-white/10 bg-white/6 p-8 shadow-2xl shadow-black/30 backdrop-blur-xl">
            <p className="text-sm uppercase tracking-[0.25em] text-indigo-200">
              Memorization Practice
            </p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold text-white">
              Pick a deck and drill it until recall becomes automatic.
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-200/85">
              This area is for structured repetition instead of open-ended map exploration.
              Each deck uses the same practice flow, so you can jump between geography,
              chronology, and history without learning a different interface.
            </p>
          </section>

          <section className="mt-6 grid gap-4 lg:grid-cols-2">
            {practiceTopics.map((topic, index) => {
              const available = topic.status === "available" && topic.href;
              const content = (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.24em] text-indigo-200/85">
                        {index === 0 ? "Start Here" : "Ready Now"}
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold text-white">{topic.title}</h2>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                        available
                          ? "bg-emerald-300/15 text-emerald-100 ring-1 ring-emerald-300/30"
                          : "bg-white/10 text-slate-300 ring-1 ring-white/10"
                      }`}
                    >
                      {available ? "Ready" : "Soon"}
                    </span>
                  </div>

                  <p className="mt-4 text-sm leading-relaxed text-slate-200/85">
                    {topic.description}
                  </p>

                  <div className="mt-6 flex items-center justify-between">
                    <span className="text-sm text-slate-300/70">
                      {topic.itemCount ? `${topic.itemCount} prompts available` : "Deck in progress"}
                    </span>
                    <span className="text-sm font-semibold text-indigo-100">
                      {available ? "Open practice" : "On deck"}
                    </span>
                  </div>
                </>
              );

              if (!available || !topic.href) {
                return (
                  <article
                    key={topic.slug}
                    className="rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl"
                  >
                    {content}
                  </article>
                );
              }

              return (
                <Link
                  key={topic.slug}
                  href={topic.href}
                  className="rounded-[2rem] border border-emerald-300/20 bg-[linear-gradient(145deg,rgba(16,185,129,0.12),rgba(15,23,42,0.65))] p-6 shadow-2xl shadow-black/30 transition hover:-translate-y-1 hover:border-emerald-300/35 hover:bg-[linear-gradient(145deg,rgba(16,185,129,0.18),rgba(15,23,42,0.75))]"
                >
                  {content}
                </Link>
              );
            })}
          </section>
        </main>
      </div>
    </div>
  );
}
