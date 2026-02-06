/* Interactive Jeopardy knowledge map.
 * Static placeholder data + client-side SVG layout for drilling down categories.
 */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Clue = {
  prompt: string;
  answer: string;
  air_date?: string;
  round?: number;
  value?: number;
  daily_double_value?: number;
  category?: string;
};

type Topic = {
  id: string;
  title: string;
  summary: string;
  clueSamples: Clue[];
  childCount?: number;
  children?: Topic[];
};

const mapData: Topic = {
  id: "root",
  title: "Jeopardy Universe",
  summary: "Loading the Jeopardy archive dataset.",
  clueSamples: [],
  children: [],
};

type PositionedNode = {
  topic: Topic;
  x: number;
  y: number;
  depth: number;
};

function polarLayout(
  children: Topic[],
  centerX: number,
  centerY: number,
  radius: number,
): PositionedNode[] {
  if (!children.length) return [];
  const angleStep = (2 * Math.PI) / children.length;
  return children.map((topic, index) => {
    const angle = -Math.PI / 2 + index * angleStep; // start at top
    return {
      topic,
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
      depth: 1,
    };
  });
}

function collectBreadcrumb(path: Topic[]) {
  return path.map((node) => ({ id: node.id, title: node.title }));
}

const fallbackClue: Clue = {
  prompt: "No sample clue yet.",
  answer: "Choose another node to explore.",
};

function inferDataMode(topic: Topic): "tree" | "lazy" {
  if (!topic.children || topic.children.length === 0) return "lazy";
  const hasDeepChildren = topic.children.some((child) => child.children && child.children.length > 0);
  return hasDeepChildren ? "tree" : "lazy";
}

function formatRound(round?: number) {
  if (round === 1) return "Single";
  if (round === 2) return "Double";
  if (round === 3) return "Final";
  return "Round";
}

function formatValue(clue: Clue) {
  const value =
    clue.daily_double_value && clue.daily_double_value > 0
      ? clue.daily_double_value
      : clue.value;
  if (!value) return clue.round === 3 ? "Final" : "Value —";
  return `$${value}`;
}

function formatDate(date?: string) {
  return date && date.trim().length ? date : "Date —";
}

export default function Home() {
  const [dataStatus, setDataStatus] = useState<"idle" | "loading" | "error">("idle");
  const [dataMode, setDataMode] = useState<"tree" | "lazy">("tree");
  const [path, setPath] = useState<Topic[]>([mapData]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [detailTopic, setDetailTopic] = useState<Topic | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailClues, setDetailClues] = useState<Clue[]>([]);
  const [detailCluesStatus, setDetailCluesStatus] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState({ w: 1120, h: 780 });
  const current = path[path.length - 1];

  const positioned = useMemo(() => {
    const cx = dimensions.w / 2;
    const cy = dimensions.h / 2;
    const mapRadius = Math.max(220, Math.min(Math.min(dimensions.w, dimensions.h) * 0.28, 380));
    const center: PositionedNode = { topic: current, x: cx, y: cy, depth: 0 };
    const spokes = polarLayout(current.children ?? [], cx, cy, mapRadius);
    return [center, ...spokes];
  }, [current, dimensions]);

  const breadcrumbs = collectBreadcrumb(path);

  const activeTopic =
    hoveredId == null
      ? current
      : positioned.find((p) => p.topic.id === hoveredId)?.topic ?? current;

  const hasParent = path.length > 1;

  const handleSelect = async (topic: Topic) => {
    if (topic.children && topic.children.length) {
      setPath((prev) => [...prev, topic]);
      setHoveredId(null);
      setDetailTopic(topic);
      setDetailOpen(true);
      return;
    }

    if (dataMode === "lazy") {
      try {
        const response = await fetch(`/api/topics/${topic.id}`);
        if (response.ok) {
          const data = (await response.json()) as Topic;
          setPath((prev) => [...prev, data]);
          setDetailTopic(data);
          setDetailOpen(true);
          setHoveredId(null);
          return;
        }
      } catch (error) {
        // fallback to local topic
      }
    }

    if (topic.childCount && topic.childCount > 0) {
      setDataStatus("error");
    }
    setDetailTopic(topic);
    setDetailOpen(true);
  };

  const handleBack = () => {
    if (hasParent) {
      setPath((prev) => prev.slice(0, -1));
      setHoveredId(null);
    }
    setDetailTopic(path[path.length - 2] ?? mapData);
  };

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setDataStatus("loading");
      try {
        const response = await fetch("/api/topics");
        if (!response.ok) throw new Error("Failed to load topics");
        const data = (await response.json()) as Topic;
        if (!alive) return;
        setPath([data]);
        setDetailTopic(data);
        setDataStatus("idle");
        setDataMode(inferDataMode(data));
      } catch (error) {
        if (!alive) return;
        setDataStatus("error");
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!detailTopic) return;
    let alive = true;
    const loadClues = async () => {
      setDetailCluesStatus("loading");
      try {
        const response = await fetch(`/api/topics/${detailTopic.id}/clues?limit=6`);
        if (!response.ok) throw new Error("Failed to load clues");
        const data = (await response.json()) as { clues?: Clue[] };
        if (!alive) return;
        setDetailClues(data.clues ?? []);
        setDetailCluesStatus("idle");
      } catch (error) {
        if (!alive) return;
        setDetailClues([]);
        setDetailCluesStatus("error");
      }
    };
    loadClues();
    return () => {
      alive = false;
    };
  }, [detailTopic?.id]);

  useEffect(() => {
    const handler = () => {
      setIsFullscreen(document.fullscreenElement === mapRef.current);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    const el = mapRef.current;
    const resize = () => {
      setDimensions({
        w: el.clientWidth || 1120,
        h: el.clientHeight || 780,
      });
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isFullscreen]);

  const enterFullscreen = () => {
    if (!mapRef.current) return;
    const el = mapRef.current as any;
    (el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen)?.call(el);
  };

  const exitFullscreen = () => {
    const doc: any = document;
    (document.exitFullscreen || doc.webkitExitFullscreen || doc.msExitFullscreen)?.call(document);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-slate-50">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(120,119,198,0.15),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.12),transparent_25%),radial-gradient(circle_at_50%_80%,rgba(16,185,129,0.12),transparent_35%)]" />
        <nav className="relative mx-auto flex max-w-[94vw] items-center justify-between px-6 pt-6 lg:px-10">
          <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.25em] text-indigo-100">
            <span className="h-3 w-3 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.6)]" />
            Jeopardy Mind Map
          </div>
          <a
            href="/about"
            className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-indigo-50 transition hover:border-white/40 hover:bg-white/10"
          >
            About
          </a>
        </nav>

        <main className="relative mx-auto flex max-w-[94vw] flex-col gap-6 px-0 pb-16 pt-6 lg:flex-row lg:items-stretch lg:gap-6 lg:px-10">
          <section
            ref={mapRef}
            className={`relative flex-1 rounded-3xl border border-white/5 bg-white/5 p-4 shadow-2xl shadow-black/30 transition-all duration-200 ${
              isFullscreen ? "h-screen w-screen" : ""
            }`}
          >
            <div className="mb-4 flex items-center justify-between px-2">
              <div className="text-sm font-medium text-indigo-100/90">
                {current.children?.length ? "Pick a branch to zoom in • Tap nodes to change focus • Center node goes up a level" : "Leaf topic • Use the breadcrumb trail to go up"}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-200/70">
                <span className="h-2 w-2 rounded-full bg-white" /> Current focus
                <span className="h-2 w-2 rounded-full bg-blue-300" /> Children
              </div>
            </div>
            <div
              className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 ${
                isFullscreen ? "h-[calc(100vh-4rem)]" : "h-[78vh] min-h-[620px]"
              }`}
            >
              <svg viewBox={`0 0 ${dimensions.w} ${dimensions.h}`} className="h-full w-full">
                <defs>
                  <linearGradient id="linkGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#c4d5ff" />
                    <stop offset="100%" stopColor="#7dd3fc" />
                  </linearGradient>
                  <radialGradient id="centerGradient" cx="50%" cy="50%" r="70%">
                    <stop offset="0%" stopColor="#c7d2fe" />
                    <stop offset="100%" stopColor="#a5b4fc" />
                  </radialGradient>
                </defs>
                {positioned.map((node) => {
                  const isCenter = node.depth === 0;
                  const isHover = hoveredId === node.topic.id;
                  const centerClickable = isCenter && hasParent;
                  return (
                    <g
                      key={node.topic.id}
                      transform={`translate(${node.x}, ${node.y})`}
                      onMouseEnter={() => setHoveredId(node.topic.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      onClick={() =>
                        isCenter ? centerClickable && handleBack() : handleSelect(node.topic)
                      }
                      className={`${centerClickable || !isCenter ? "cursor-pointer" : "cursor-default"} transition duration-150`}
                    >
                      <circle
                        r={isCenter ? 86 : 60}
                        fill={
                          isCenter
                            ? "url(#centerGradient)"
                            : isHover
                              ? "rgba(56, 189, 248, 0.9)"
                              : "rgba(56, 189, 248, 0.7)"
                        }
                        stroke="rgba(255,255,255,0.6)"
                        strokeWidth={isCenter ? 4 : 2}
                        className={isHover && !isCenter ? "scale-105 shadow-lg" : ""}
                      />
                      {isCenter && (
                        <circle
                          r={82}
                          fill="none"
                          stroke="rgba(255,255,255,0.15)"
                          strokeDasharray="6 8"
                        />
                      )}
                      <text
                        textAnchor="middle"
                        alignmentBaseline="middle"
                        className="font-semibold leading-tight"
                        fill={isCenter ? "#0b1021" : "#0f172a"}
                        style={{ fontSize: isCenter ? "16px" : "13px" }}
                      >
                        {node.topic.title}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {!current.children?.length && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="rounded-2xl bg-black/60 px-4 py-3 text-sm text-slate-100 ring-1 ring-white/10">
                    This is a leaf topic. Use the breadcrumb trail to go up.
                  </div>
                </div>
              )}

              {detailOpen && detailTopic && (
                <div className="pointer-events-auto absolute left-0 top-0 h-full w-[360px] max-w-[85vw] -translate-x-2 rounded-2xl bg-white/8 backdrop-blur-xl ring-1 ring-white/10 shadow-2xl shadow-indigo-900/40 transition">
                  <div className="flex items-start justify-between px-5 pt-5">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.22em] text-indigo-200">
                        Focus
                      </p>
                      <h2 className="mt-1 text-2xl font-semibold text-white">{detailTopic.title}</h2>
                    </div>
                    <button
                      onClick={() => setDetailOpen(false)}
                      className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-indigo-50 transition hover:border-white/40 hover:bg-white/10"
                    >
                      Close
                    </button>
                  </div>
                  <p className="px-5 pt-3 text-sm leading-relaxed text-slate-200/90">
                    {detailTopic.summary}
                  </p>
                  <div className="mt-4 space-y-4 px-5 pb-6">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-indigo-200/80">
                      {detailCluesStatus === "loading"
                        ? "Fetching clues"
                        : detailCluesStatus === "error"
                          ? "Showing sample clues"
                          : "Clues"}
                    </div>
                    <div className="max-h-[calc(100vh-340px)] overflow-y-auto pr-1">
                      <div className="grid gap-3">
                        {(detailClues.length
                          ? detailClues
                          : detailTopic.clueSamples.length
                            ? detailTopic.clueSamples
                            : [fallbackClue]
                        ).map((clue) => (
                          <div
                            key={`${clue.prompt}-${clue.answer}`}
                            className="rounded-xl bg-slate-900/60 p-4 text-sm ring-1 ring-white/5"
                          >
                            <p className="text-slate-50">“{clue.prompt}”</p>
                            <p className="mt-2 text-emerald-200">{clue.answer}</p>
                            <div className="mt-3 text-[11px] uppercase tracking-[0.2em] text-indigo-200/80">
                              {formatRound(clue.round)} · {formatValue(clue)}
                              {clue.daily_double_value && clue.daily_double_value > 0
                                ? " · Daily Double"
                                : ""}
                              {" · "}
                              {formatDate(clue.air_date)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {!detailOpen && detailTopic && (
                <button
                  onClick={() => setDetailOpen(true)}
                  className="pointer-events-auto absolute left-0 top-10 z-10 flex h-12 w-10 items-center justify-center rounded-r-xl bg-indigo-500 text-[10px] font-semibold uppercase tracking-[0.18em] text-white shadow-lg shadow-indigo-900/40 transition hover:bg-indigo-400"
                  aria-label="Open detail panel"
                >
                  Info
                </button>
              )}

              {(dataStatus !== "idle" || dataMode === "lazy") && (
                <div className="pointer-events-none absolute right-6 top-6 rounded-full border border-white/15 bg-slate-900/70 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-indigo-100">
                  {dataStatus === "loading"
                    ? "Loading dataset"
                    : dataMode === "lazy"
                      ? "Lazy loading nodes"
                      : "Using fallback data"}
                </div>
              )}

            </div>
          </section>
          <div className="fixed bottom-6 right-6 z-30 flex flex-col gap-2">
            {!isFullscreen && (
              <button
                onClick={enterFullscreen}
                className="rounded-full border border-white/20 bg-slate-900/80 px-4 py-3 text-xs font-semibold text-indigo-50 shadow-lg shadow-indigo-900/40 backdrop-blur-sm transition hover:border-white/50 hover:bg-white/10"
              >
                Full Screen Map
              </button>
            )}
            {isFullscreen && (
              <button
                onClick={exitFullscreen}
                className="rounded-full border border-white/30 bg-indigo-600/90 px-4 py-3 text-xs font-semibold text-white shadow-lg shadow-indigo-900/50 backdrop-blur-sm transition hover:border-white/60 hover:bg-indigo-500/90"
              >
                Exit Full Screen
              </button>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
