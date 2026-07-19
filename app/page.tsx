"use client";

/*
 * The Jeopardy Curriculum — the archive organized for studying.
 *
 * Replaces the old radial category map. Subjects come from clue-level
 * classification (category topics + answer propagation), each with full
 * archive coverage, your mastery from local practice stats, canon answer
 * lists, and archive-wide search.
 */

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { statsSnapshot, type DeckStats } from "@/lib/practice-stats";

type CurriculumSubject = {
  id: string;
  title: string;
  clueCount: number;
};

type SubjectDetail = {
  id: string;
  title: string;
  topAnswers: Array<{ key: string; display: string; clue_count: number }>;
  topCategories: Array<{ id: string; title: string; clue_count: number }>;
  subtopics: Array<{ id: string; title: string }>;
};

type SearchResults = {
  answers: Array<{ key: string; display: string; clue_count: number; subject_id: string }>;
  categories: Array<{ id: string; title: string; clue_count: number }>;
  clues: Array<{
    prompt: string;
    answer: string;
    value: number;
    round: number;
    air_date: string;
    category: string;
    subject_id: string;
  }>;
};

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function parseDecks(snapshot: string): DeckStats[] {
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

// Where each curated deck's judgments count for subject mastery.
const CURATED_SUBJECTS: Record<string, string> = {
  "world-capitals": "geography",
  "us-state-capitals": "geography",
  "canadian-provinces": "geography",
  "countries-currencies": "geography",
  "american-presidents": "history",
  "historic-battles": "history",
  "shakespeare-plays": "literature",
  "constitutional-amendments": "law-politics",
  "oscar-best-picture": "pop-culture",
  "greek-roman-gods": "religion-myth",
};

function subjectForSlug(slug: string): string | null {
  if (CURATED_SUBJECTS[slug]) return CURATED_SUBJECTS[slug];
  if (!slug.startsWith("topic-")) return null;
  const node = slug.slice("topic-".length);
  if (node.startsWith("subj:")) return node.slice(5);
  if (node.startsWith("canon:")) {
    const subject = node.slice(6);
    return subject === "all" ? null : subject;
  }
  if (node.startsWith("sub:")) return node.split(":")[1] ?? null;
  if (node.startsWith("grp:")) return node.split(":")[2] ?? null;
  if (node.startsWith("cat:")) return null;
  return node;
}

const clueYear = (airDate?: string) => /^(\d{4})/.exec(airDate ?? "")?.[1] ?? "";

const drillHref = (nodeId: string) => `/practice/topic/${encodeURIComponent(nodeId)}`;

export default function CurriculumPage() {
  const [subjects, setSubjects] = useState<CurriculumSubject[]>([]);
  const [unclassified, setUnclassified] = useState(0);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, SubjectDetail>>({});
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const searchSeq = useRef(0);

  const snapshot = useSyncExternalStore(subscribe, statsSnapshot, () => "");
  const mastery = useMemo(() => {
    const bySubject = new Map<string, { attempts: number; correct: number }>();
    for (const deck of parseDecks(snapshot)) {
      const subject = subjectForSlug(deck.slug);
      if (!subject) continue;
      const entry = bySubject.get(subject) ?? { attempts: 0, correct: 0 };
      entry.attempts += deck.attempts;
      entry.correct += deck.correct;
      bySubject.set(subject, entry);
    }
    return bySubject;
  }, [snapshot]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const response = await fetch("/api/curriculum");
        if (!response.ok) throw new Error("failed");
        const data = (await response.json()) as {
          subjects: CurriculumSubject[];
          unclassified: number;
        };
        if (!alive) return;
        setSubjects(data.subjects);
        setUnclassified(data.unclassified);
        setStatus("ready");
      } catch {
        if (!alive) return;
        setStatus("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Debounced archive search.
  useEffect(() => {
    const q = query.trim();
    const seq = ++searchSeq.current;
    if (q.length < 2) {
      setResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        if (!response.ok) return;
        const data = (await response.json()) as SearchResults;
        if (searchSeq.current === seq) setResults(data);
      } catch {
        // keep previous results on transient failure
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const toggleExpanded = async (subjectId: string) => {
    if (expanded === subjectId) {
      setExpanded(null);
      return;
    }
    setExpanded(subjectId);
    if (!details[subjectId]) {
      try {
        const response = await fetch(`/api/curriculum/${encodeURIComponent(subjectId)}`);
        if (!response.ok) return;
        const data = (await response.json()) as SubjectDetail;
        setDetails((prev) => ({ ...prev, [subjectId]: data }));
      } catch {
        // panel will show a loading row until retried
      }
    }
  };

  const totalClues = subjects.reduce((sum, s) => sum + s.clueCount, 0) + unclassified;
  const searching = query.trim().length >= 2;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-slate-50">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(120,119,198,0.15),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.12),transparent_25%),radial-gradient(circle_at_50%_80%,rgba(16,185,129,0.12),transparent_35%)]" />
        <SiteNav current="curriculum" />

        <main className="relative mx-auto max-w-6xl px-6 pb-16 pt-8 lg:px-10">
          <section className="rounded-[2rem] border border-white/10 bg-white/6 p-8 shadow-2xl shadow-black/30 backdrop-blur-xl">
            <p className="text-sm uppercase tracking-[0.25em] text-indigo-200">
              The Jeopardy Curriculum
            </p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold text-white">
              {totalClues > 0
                ? `${totalClues.toLocaleString()} real clues, organized for studying.`
                : "The archive, organized for studying."}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-200/85">
              Every subject covers its full slice of the archive — including clues
              rescued from wordplay and potpourri categories. Drill a subject, learn
              its canon answers, or search anything.
            </p>
            <div className="mt-6">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search the archive — try “opera”, “everest”, “shakespeare”…"
                autoComplete="off"
                spellCheck={false}
                className="w-full max-w-2xl rounded-[1.25rem] border border-white/15 bg-black/30 px-5 py-3.5 text-lg text-white placeholder:text-slate-400/60 focus:border-emerald-300/60 focus:outline-none"
              />
            </div>
          </section>

          {searching ? (
            <section className="mt-6 space-y-5">
              {results === null ? (
                <div className="rounded-[2rem] border border-white/10 bg-white/6 p-6 text-slate-200">
                  Searching…
                </div>
              ) : results.answers.length === 0 &&
                results.categories.length === 0 &&
                results.clues.length === 0 ? (
                <div className="rounded-[2rem] border border-white/10 bg-white/6 p-6 text-slate-200">
                  Nothing found for &ldquo;{query.trim()}&rdquo; — try a broader term.
                </div>
              ) : (
                <>
                  {results.answers.length > 0 && (
                    <div className="rounded-[2rem] border border-white/10 bg-white/6 p-6 lg:p-8">
                      <h2 className="text-lg font-semibold text-white">Answers</h2>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {results.answers.map((answer) => (
                          <Link
                            key={answer.key}
                            href={`/answers/${encodeURIComponent(answer.key)}`}
                            className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-300/20"
                          >
                            {answer.display}
                            <span className="ml-2 text-xs opacity-70">
                              {answer.clue_count} clues
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                  {results.categories.length > 0 && (
                    <div className="rounded-[2rem] border border-white/10 bg-white/6 p-6 lg:p-8">
                      <h2 className="text-lg font-semibold text-white">Categories</h2>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {results.categories.map((category) => (
                          <Link
                            key={category.id}
                            href={drillHref(category.id)}
                            className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm transition hover:border-white/30 hover:bg-white/10"
                          >
                            <span className="truncate font-medium text-slate-100">
                              {category.title}
                            </span>
                            <span className="ml-3 shrink-0 text-xs text-slate-400">
                              {category.clue_count} · drill →
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                  {results.clues.length > 0 && (
                    <div className="rounded-[2rem] border border-white/10 bg-white/6 p-6 lg:p-8">
                      <h2 className="text-lg font-semibold text-white">Clues</h2>
                      <div className="mt-3 grid gap-3">
                        {results.clues.map((clue, index) => (
                          <div
                            key={`${clue.prompt.slice(0, 40)}-${index}`}
                            className="rounded-2xl border border-white/10 bg-slate-950/50 p-4"
                          >
                            <div className="text-[11px] uppercase tracking-[0.2em] text-indigo-200/80">
                              {clue.category}
                              {clue.value > 0 && ` · $${clue.value}`}
                              {clueYear(clue.air_date) && ` · ${clueYear(clue.air_date)}`}
                            </div>
                            <p className="mt-2 text-sm leading-relaxed text-slate-100">
                              {clue.prompt}
                            </p>
                            <p className="mt-1.5 text-sm text-emerald-100">{clue.answer}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>
          ) : (
            <>
              <section className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-[2rem] border border-amber-300/25 bg-amber-300/10 p-6">
                <div>
                  <h2 className="text-lg font-semibold text-amber-100">
                    The Jeopardy Canon
                  </h2>
                  <p className="mt-1 max-w-xl text-sm text-amber-100/75">
                    The 100 most-asked answers across the whole archive — the
                    highest-yield studying there is.
                  </p>
                </div>
                <Link
                  href={drillHref("canon:all")}
                  className="rounded-full bg-amber-300 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-200"
                >
                  Drill the canon →
                </Link>
              </section>

              {status === "loading" ? (
                <div className="mt-6 rounded-[2rem] border border-white/10 bg-white/6 p-6 text-slate-200">
                  Loading the curriculum…
                </div>
              ) : status === "error" ? (
                <div className="mt-6 rounded-[2rem] border border-rose-300/20 bg-rose-300/10 p-6 text-rose-50">
                  Could not load the curriculum. Refresh to try again.
                </div>
              ) : (
                <section className="mt-6 grid gap-4 lg:grid-cols-2">
                  {subjects.map((subject) => {
                    const stats = mastery.get(subject.id);
                    const accuracy =
                      stats && stats.attempts >= 10
                        ? Math.round((stats.correct / stats.attempts) * 100)
                        : null;
                    const share = totalClues > 0
                      ? Math.round((subject.clueCount / totalClues) * 100)
                      : 0;
                    const isOpen = expanded === subject.id;
                    const detail = details[subject.id];
                    return (
                      <article
                        key={subject.id}
                        className={`rounded-[2rem] border bg-white/6 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl transition lg:p-7 ${
                          isOpen ? "border-emerald-300/30 lg:col-span-2" : "border-white/10"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-0">
                            <h2 className="text-2xl font-semibold text-white">
                              {subject.title}
                            </h2>
                            <p className="mt-1 text-sm text-slate-300">
                              {subject.clueCount.toLocaleString()} clues · {share}% of
                              the archive
                            </p>
                            <div className="mt-3 flex items-center gap-3">
                              <div className="h-2 w-40 overflow-hidden rounded-full bg-white/10">
                                {accuracy !== null && (
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
                                )}
                              </div>
                              <span className="text-xs text-slate-400">
                                {accuracy !== null
                                  ? `${accuracy}% accuracy · ${stats!.attempts} reps`
                                  : "No reps yet"}
                              </span>
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-2">
                            <Link
                              href={drillHref(`subj:${subject.id}`)}
                              className="rounded-full bg-emerald-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200"
                            >
                              Drill
                            </Link>
                            <Link
                              href={drillHref(`canon:${subject.id}`)}
                              className="rounded-full border border-amber-300/40 bg-amber-300/10 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-300/20"
                            >
                              Canon
                            </Link>
                            <button
                              type="button"
                              onClick={() => toggleExpanded(subject.id)}
                              aria-expanded={isOpen}
                              className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-indigo-50 transition hover:border-white/40 hover:bg-white/10"
                            >
                              {isOpen ? "Close ▲" : "Explore ▼"}
                            </button>
                          </div>
                        </div>

                        {isOpen && (
                          <div className="mt-6 grid gap-6 border-t border-white/10 pt-6 lg:grid-cols-3">
                            <div>
                              <h3 className="text-[11px] uppercase tracking-[0.24em] text-indigo-200">
                                Canon answers
                              </h3>
                              <div className="mt-3 space-y-1.5">
                                {(detail?.topAnswers ?? []).slice(0, 15).map((answer, i) => (
                                  <Link
                                    key={answer.key}
                                    href={`/answers/${encodeURIComponent(answer.key)}`}
                                    className="flex items-baseline justify-between gap-3 rounded-lg px-2 py-1 text-sm transition hover:bg-white/10"
                                  >
                                    <span className="truncate text-slate-100">
                                      <span className="mr-2 text-xs text-slate-500">
                                        {i + 1}.
                                      </span>
                                      {answer.display}
                                    </span>
                                    <span className="shrink-0 text-xs text-slate-400">
                                      {answer.clue_count}
                                    </span>
                                  </Link>
                                ))}
                                {!detail && (
                                  <p className="text-sm text-slate-400">Loading…</p>
                                )}
                              </div>
                            </div>
                            <div>
                              <h3 className="text-[11px] uppercase tracking-[0.24em] text-indigo-200">
                                Top categories
                              </h3>
                              <div className="mt-3 space-y-1.5">
                                {(detail?.topCategories ?? []).map((category) => (
                                  <Link
                                    key={category.id}
                                    href={drillHref(category.id)}
                                    className="flex items-baseline justify-between gap-3 rounded-lg px-2 py-1 text-sm transition hover:bg-white/10"
                                  >
                                    <span className="truncate text-slate-100">
                                      {category.title}
                                    </span>
                                    <span className="shrink-0 text-xs text-slate-400">
                                      {category.clue_count} →
                                    </span>
                                  </Link>
                                ))}
                              </div>
                            </div>
                            <div>
                              <h3 className="text-[11px] uppercase tracking-[0.24em] text-indigo-200">
                                Subtopics
                              </h3>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {(detail?.subtopics ?? []).map((subtopic) => (
                                  <Link
                                    key={subtopic.id}
                                    href={drillHref(subtopic.id)}
                                    className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-indigo-50 transition hover:border-white/40 hover:bg-white/10"
                                  >
                                    {subtopic.title}
                                  </Link>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </section>
              )}

              {status === "ready" && (
                <p className="mt-6 text-sm text-slate-400">
                  {unclassified.toLocaleString()} clues remain unclassified (pure
                  wordplay and grab-bag leftovers) — they still appear in{" "}
                  <Link
                    href={drillHref("root")}
                    className="text-indigo-200 underline-offset-2 hover:underline"
                  >
                    practice-everything decks
                  </Link>{" "}
                  and the Daily 20.
                </p>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
