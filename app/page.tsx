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
  index?: number;
  radius?: number;
};

const goldenAngle = Math.PI * (3 - Math.sqrt(5));

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const mulberry32 = (seed: number) => {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

function scatterLayout(
  children: Topic[],
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  seed: number,
): PositionedNode[] {
  if (!children.length) return [];
  const margin = Math.max(140, Math.min(width, height) * 0.12);
  const minRadius = Math.max(200, Math.min(width, height) * 0.2);
  const maxX = Math.max(220, width / 2 - margin);
  const maxY = Math.max(180, height / 2 - margin);
  const baseRadius = 60;
  const orbitPadding = 18;
  const gap = 18;
  const centerRadius = 86;
  const points: PositionedNode[] = [];

  children.forEach((topic, index) => {
    const rng = mulberry32(seed + index * 101);
    const nodeRadius = baseRadius + orbitPadding;
    const centerExclusion = centerRadius + nodeRadius + gap;
    let x = centerX;
    let y = centerY;
    let placed = false;

    for (let attempt = 0; attempt < 64; attempt += 1) {
      const rx = (rng() * 2 - 1) * maxX;
      const ry = (rng() * 2 - 1) * maxY;
      if (Math.hypot(rx, ry) < Math.max(minRadius, centerExclusion)) continue;
      const candidate = { x: centerX + rx, y: centerY + ry };
      const collision = points.some(
        (p) => Math.hypot(p.x - candidate.x, p.y - candidate.y) < (p.radius ?? baseRadius) + nodeRadius + gap,
      );
      if (!collision) {
        x = candidate.x;
        y = candidate.y;
        placed = true;
        break;
      }
    }

    if (!placed) {
      const maxRadius = Math.max(minRadius + 60, Math.min(maxX, maxY));
      for (let attempt = 0; attempt < 80; attempt += 1) {
        const angle = (index + attempt * 0.5) * goldenAngle;
        const radius = minRadius + (attempt / 80) * (maxRadius - minRadius);
        const candidate = {
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle),
        };
        if (Math.hypot(candidate.x - centerX, candidate.y - centerY) < centerExclusion) {
          continue;
        }
        const collision = points.some(
          (p) =>
            Math.hypot(p.x - candidate.x, p.y - candidate.y) <
            (p.radius ?? baseRadius) + nodeRadius + gap,
        );
        if (!collision) {
          x = candidate.x;
          y = candidate.y;
          placed = true;
          break;
        }
      }
    }

    if (!placed) {
      const angle = (index + 1) * goldenAngle;
      x = centerX + centerExclusion * Math.cos(angle);
      y = centerY + centerExclusion * Math.sin(angle);
    }

    points.push({ topic, x, y, depth: 1, index, radius: nodeRadius });
  });

  return points;
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

function splitTitle(title: string): string[] {
  if (title.length < 16) return [title];
  const spaceIndex = title.indexOf(" ");
  if (spaceIndex === -1) return [title];
  return [title.slice(0, spaceIndex), title.slice(spaceIndex + 1)];
}

const nodePalette = [
  "#f97316",
  "#f43f5e",
  "#06b6d4",
  "#22c55e",
  "#a855f7",
  "#eab308",
  "#3b82f6",
  "#ec4899",
  "#14b8a6",
  "#f59e0b",
  "#8b5cf6",
  "#10b981",
];

function pickNodeColor(topic: Topic, index: number) {
  const seed = hashString(topic.id);
  return nodePalette[(seed + index) % nodePalette.length];
}

function textColorFor(hexColor: string) {
  const hex = hexColor.replace("#", "");
  if (hex.length !== 6) return "#0b1021";
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.6 ? "#0b1021" : "#f8fafc";
}

function orbitDotCount(topic: Topic) {
  const count = topic.childCount ?? topic.children?.length ?? 0;
  if (!count) return 0;
  return Math.min(10, Math.max(2, Math.round(Math.sqrt(count))));
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
  const [zooming, setZooming] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState({ w: 1120, h: 780 });
  const current = path[path.length - 1];

  const positioned = useMemo(() => {
    const sidebarInset = detailOpen ? 380 : 0;
    const layoutWidth = Math.max(320, dimensions.w - sidebarInset);
    const cx = sidebarInset + layoutWidth / 2;
    const cy = dimensions.h / 2;
    const seed = hashString(current.id);
    const center: PositionedNode = { topic: current, x: cx, y: cy, depth: 0 };
    const spokes = scatterLayout(
      current.children ?? [],
      cx,
      cy,
      layoutWidth,
      dimensions.h,
      seed,
    );
    return [center, ...spokes];
  }, [current, dimensions, detailOpen]);

  const centerNode = positioned[0];
  const childNodes = positioned.slice(1);

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
    setZooming(true);
    const timer = setTimeout(() => setZooming(false), 320);
    return () => clearTimeout(timer);
  }, [current.id]);

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
              className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 transition-transform duration-500 ease-out ${
                zooming ? "scale-[1.03]" : "scale-100"
              } ${isFullscreen ? "h-[calc(100vh-4rem)]" : "h-[78vh] min-h-[620px]"}`}
              style={{ transformOrigin: "50% 50%" }}
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
                {centerNode &&
                  childNodes.map((node) => {
                    const dx = node.x - centerNode.x;
                    const dy = node.y - centerNode.y;
                    const distance = Math.max(Math.hypot(dx, dy), 1);
                    const centerRadius = 86;
                    const childRadius = 60;
                    const startX = centerNode.x + (dx / distance) * centerRadius;
                    const startY = centerNode.y + (dy / distance) * centerRadius;
                    const endX = node.x - (dx / distance) * childRadius;
                    const endY = node.y - (dy / distance) * childRadius;
                    return (
                      <line
                        key={`link-${node.topic.id}`}
                        x1={startX}
                        y1={startY}
                        x2={endX}
                        y2={endY}
                        stroke="rgba(255,255,255,0.35)"
                        strokeWidth={1.4}
                      />
                    );
                  })}
                {positioned.map((node) => {
                  const isCenter = node.depth === 0;
                  const isHover = hoveredId === node.topic.id;
                  const centerClickable = isCenter && hasParent;
                  const color = isCenter
                    ? "url(#centerGradient)"
                    : pickNodeColor(node.topic, node.index ?? 0);
                  const nodeRadius = isCenter ? 86 : 60;
                  const orbitCount = isCenter ? 0 : orbitDotCount(node.topic);
                  const orbitRadius = nodeRadius + 14;
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
                      style={{ transition: "transform 500ms ease" }}
                    >
                      <circle
                        r={nodeRadius}
                        fill={color}
                        fillOpacity={isCenter ? 1 : isHover ? 0.95 : 0.82}
                        stroke="rgba(255,255,255,0.6)"
                        strokeWidth={isCenter ? 4 : 2}
                        className={isHover && !isCenter ? "scale-105 shadow-lg" : ""}
                      />
                      {!isCenter && orbitCount > 0 && (
                        <g>
                          {Array.from({ length: orbitCount }).map((_, idx) => {
                            const angle = (2 * Math.PI * idx) / orbitCount;
                            return (
                              <circle
                                key={`${node.topic.id}-orbit-${idx}`}
                                cx={Math.cos(angle) * orbitRadius}
                                cy={Math.sin(angle) * orbitRadius}
                                r={3}
                                fill={color}
                                fillOpacity={0.9}
                              />
                            );
                          })}
                        </g>
                      )}
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
                        fill={isCenter ? "#0b1021" : textColorFor(String(color))}
                        style={{ fontSize: isCenter ? "16px" : "13px" }}
                      >
                        {splitTitle(node.topic.title).map((line, index, lines) => (
                          <tspan
                            key={`${node.topic.id}-${line}`}
                            x="0"
                            dy={
                              lines.length === 1
                                ? "0.35em"
                                : index === 0
                                  ? "-0.35em"
                                  : "1.1em"
                            }
                          >
                            {line}
                          </tspan>
                        ))}
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

              <div className="pointer-events-auto absolute right-6 top-6 z-10 flex flex-col items-end gap-2">
                {(dataStatus !== "idle" || dataMode === "lazy") && (
                  <div className="pointer-events-none rounded-full border border-white/15 bg-slate-900/70 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-indigo-100">
                    {dataStatus === "loading"
                      ? "Loading dataset"
                      : dataMode === "lazy"
                        ? "Lazy loading nodes"
                        : "Using fallback data"}
                  </div>
                )}
                <button
                  onClick={isFullscreen ? exitFullscreen : enterFullscreen}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-slate-900/70 text-indigo-50 shadow-lg shadow-indigo-900/40 backdrop-blur-sm transition hover:border-white/50 hover:bg-white/10"
                  aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"}
                  title={isFullscreen ? "Exit full screen" : "Enter full screen"}
                >
                  {isFullscreen ? (
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M9 3H5v4" />
                      <path d="M15 3h4v4" />
                      <path d="M9 21H5v-4" />
                      <path d="M15 21h4v-4" />
                    </svg>
                  ) : (
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M8 3H5v3" />
                      <path d="M16 3h3v3" />
                      <path d="M8 21H5v-3" />
                      <path d="M16 21h3v-3" />
                    </svg>
                  )}
                </button>
              </div>

            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
