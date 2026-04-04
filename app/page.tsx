/* Interactive Jeopardy knowledge map.
 * Static placeholder data + client-side SVG layout for drilling down categories.
 */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { SiteNav } from "@/components/site-nav";

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

type FullscreenCapableElement = HTMLDivElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenCapableDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void;
  msExitFullscreen?: () => Promise<void> | void;
};

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

/** Compute dynamic node radius based on child count and available space. */
function computeNodeRadius(childCount: number, width: number, height: number): number {
  const minDim = Math.min(width, height);
  if (childCount <= 6) return Math.min(60, minDim * 0.07);
  if (childCount <= 12) return Math.min(50, minDim * 0.06);
  if (childCount <= 20) return Math.min(40, minDim * 0.048);
  return Math.min(34, minDim * 0.04);
}

function computeCenterRadius(childCount: number, width: number, height: number): number {
  const minDim = Math.min(width, height);
  if (childCount <= 6) return Math.min(86, minDim * 0.1);
  if (childCount <= 12) return Math.min(72, minDim * 0.085);
  if (childCount <= 20) return Math.min(60, minDim * 0.07);
  return Math.min(52, minDim * 0.06);
}

/**
 * Radial layout: places children in concentric rings around center.
 * Dynamically sizes nodes and rings based on child count & available space.
 */
function radialLayout(
  children: Topic[],
  centerX: number,
  centerY: number,
  width: number,
  height: number,
): PositionedNode[] {
  if (!children.length) return [];

  const n = children.length;
  const nodeRadius = computeNodeRadius(n, width, height);
  const cRadius = computeCenterRadius(n, width, height);
  const gap = Math.max(8, nodeRadius * 0.3);
  const minRingRadius = cRadius + nodeRadius + gap + 20;

  // Determine how many rings we need and how many nodes per ring
  const rings: number[] = [];
  let remaining = n;

  // First ring: fit as many as possible with comfortable spacing
  const circumference = (r: number) => 2 * Math.PI * r;
  const nodeSpan = nodeRadius * 2 + gap;

  let ringRadius = minRingRadius;
  while (remaining > 0) {
    const canFit = Math.max(1, Math.floor(circumference(ringRadius) / nodeSpan));
    const count = Math.min(remaining, canFit);
    rings.push(count);
    remaining -= count;
    ringRadius += nodeRadius * 2 + gap + 12;
  }

  const points: PositionedNode[] = [];
  let childIdx = 0;
  let currentRingRadius = minRingRadius;

  for (let ring = 0; ring < rings.length; ring++) {
    const countInRing = rings[ring];
    // Offset odd rings by half a step for visual variety
    const angleOffset = ring % 2 === 0 ? 0 : Math.PI / countInRing;

    for (let i = 0; i < countInRing; i++) {
      const angle = angleOffset + (2 * Math.PI * i) / countInRing - Math.PI / 2;
      // Elliptical scaling to use the full rectangular viewport
      const rx = Math.min(currentRingRadius, width / 2 - nodeRadius - 20);
      const ry = Math.min(currentRingRadius, height / 2 - nodeRadius - 20);
      const x = centerX + rx * Math.cos(angle);
      const y = centerY + ry * Math.sin(angle);
      points.push({
        topic: children[childIdx],
        x,
        y,
        depth: 1,
        index: childIdx,
        radius: nodeRadius,
      });
      childIdx++;
    }
    currentRingRadius += nodeRadius * 2 + gap + 12;
  }

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
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dimensions, setDimensions] = useState({ w: 1120, h: 780 });
  const current = path[path.length - 1];

  // Pan & zoom state for the SVG viewBox
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 1120, h: 780 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, vx: 0, vy: 0 });

  const positioned = useMemo(() => {
    const layoutWidth = Math.max(320, dimensions.w);
    const cx = layoutWidth / 2;
    const cy = dimensions.h / 2;
    const childCount = current.children?.length ?? 0;
    const cRadius = computeCenterRadius(childCount, layoutWidth, dimensions.h);
    const center: PositionedNode = { topic: current, x: cx, y: cy, depth: 0, radius: cRadius };
    const spokes = radialLayout(
      current.children ?? [],
      cx,
      cy,
      layoutWidth,
      dimensions.h,
    );
    return [center, ...spokes];
  }, [current, dimensions]);

  const centerNode = positioned[0];
  const childNodes = positioned.slice(1);

  const breadcrumbs = collectBreadcrumb(path);

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
      } catch {
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
      } catch {
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

  // Reset viewBox when navigating or resizing
  useEffect(() => {
    setViewBox({ x: 0, y: 0, w: dimensions.w, h: dimensions.h });
  }, [current.id, dimensions]);

  // Wheel zoom — attached as non-passive so preventDefault works
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
      const rect = svg.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / rect.width;
      const my = (e.clientY - rect.top) / rect.height;
      setViewBox((vb) => {
        const newW = Math.max(dimensions.w * 0.2, Math.min(dimensions.w * 3, vb.w * zoomFactor));
        const newH = Math.max(dimensions.h * 0.2, Math.min(dimensions.h * 3, vb.h * zoomFactor));
        const newX = vb.x + (vb.w - newW) * mx;
        const newY = vb.y + (vb.h - newH) * my;
        return { x: newX, y: newY, w: newW, h: newH };
      });
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [dimensions]);

  // Pan handlers
  const handlePanStart = (e: React.MouseEvent<SVGSVGElement>) => {
    // Only start pan on middle-click or when clicking the background (not a node)
    if (e.button === 1 || (e.target as Element).tagName === "svg") {
      isPanning.current = true;
      panStart.current = { x: e.clientX, y: e.clientY, vx: viewBox.x, vy: viewBox.y };
      e.preventDefault();
    }
  };

  const handlePanMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isPanning.current || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const dx = ((e.clientX - panStart.current.x) / rect.width) * viewBox.w;
    const dy = ((e.clientY - panStart.current.y) / rect.height) * viewBox.h;
    setViewBox((vb) => ({ ...vb, x: panStart.current.vx - dx, y: panStart.current.vy - dy }));
  };

  const handlePanEnd = () => {
    isPanning.current = false;
  };

  const handleResetZoom = () => {
    setViewBox({ x: 0, y: 0, w: dimensions.w, h: dimensions.h });
  };

  const isZoomed = Math.abs(viewBox.w - dimensions.w) > 1 || Math.abs(viewBox.h - dimensions.h) > 1 || Math.abs(viewBox.x) > 1 || Math.abs(viewBox.y) > 1;

  const detailTopicId = detailTopic?.id;

  useEffect(() => {
    if (!detailTopicId) return;
    let alive = true;
    const loadClues = async () => {
      setDetailCluesStatus("loading");
      try {
        const response = await fetch(`/api/topics/${detailTopicId}/clues?limit=6`);
        if (!response.ok) throw new Error("Failed to load clues");
        const data = (await response.json()) as { clues?: Clue[] };
        if (!alive) return;
        setDetailClues(data.clues ?? []);
        setDetailCluesStatus("idle");
      } catch {
        if (!alive) return;
        setDetailClues([]);
        setDetailCluesStatus("error");
      }
    };
    loadClues();
    return () => {
      alive = false;
    };
  }, [detailTopicId]);

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
    const el = mapRef.current as FullscreenCapableElement;
    (el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen)?.call(el);
  };

  const exitFullscreen = () => {
    const doc = document as FullscreenCapableDocument;
    (document.exitFullscreen || doc.webkitExitFullscreen || doc.msExitFullscreen)?.call(document);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-slate-50">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(120,119,198,0.15),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.12),transparent_25%),radial-gradient(circle_at_50%_80%,rgba(16,185,129,0.12),transparent_35%)]" />
        <SiteNav current="map" />

        <main className="relative mx-auto flex max-w-[94vw] flex-col gap-6 px-0 pb-16 pt-6 lg:flex-row lg:items-stretch lg:gap-6 lg:px-10">
          {/* Detail sidebar — sits beside the canvas, not overlapping */}
          {detailOpen && detailTopic && (
            <aside className="hidden lg:flex w-[340px] shrink-0 flex-col rounded-3xl border border-white/5 bg-white/5 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-indigo-200">
                    Focus
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-white">{detailTopic.title}</h2>
                </div>
                <button
                  onClick={() => setDetailOpen(false)}
                  className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-indigo-50 transition hover:border-white/40 hover:bg-white/10"
                >
                  Close
                </button>
              </div>
              <p className="pt-3 text-sm leading-relaxed text-slate-200/90">
                {detailTopic.summary}
              </p>
              <div className="mt-4 flex-1 overflow-hidden flex flex-col">
                <div className="text-[11px] uppercase tracking-[0.22em] text-indigo-200/80 mb-3">
                  {detailCluesStatus === "loading"
                    ? "Fetching clues"
                    : detailCluesStatus === "error"
                      ? "Showing sample clues"
                      : "Clues"}
                </div>
                <div className="flex-1 overflow-y-auto pr-1">
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
            </aside>
          )}
          <section
            ref={mapRef}
            className={`relative flex-1 rounded-3xl border border-white/5 bg-white/5 p-4 shadow-2xl shadow-black/30 transition-all duration-200 ${
              isFullscreen ? "h-screen w-screen" : ""
            }`}
          >
            <div className="mb-4 rounded-2xl border border-emerald-300/15 bg-[linear-gradient(135deg,rgba(16,185,129,0.14),rgba(15,23,42,0.65))] p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-emerald-100/90">
                    Memorization Practice
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-white">
                    Switch from exploration to deliberate recall practice.
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-200/85">
                    Open the new practice area to work through world capitals now, with
                    more decks like state capitals and presidents queued behind it.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/practice"
                    className="rounded-full bg-emerald-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200"
                  >
                    Open Practice
                  </Link>
                  <Link
                    href="/practice/world-capitals"
                    className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-indigo-50 transition hover:border-white/40 hover:bg-white/10"
                  >
                    Start World Capitals
                  </Link>
                </div>
              </div>
            </div>
            {/* Breadcrumb trail */}
            {breadcrumbs.length > 1 && (
              <div className="mb-3 flex items-center gap-1 px-2 overflow-x-auto scrollbar-none">
                {breadcrumbs.map((crumb, idx) => {
                  const isLast = idx === breadcrumbs.length - 1;
                  return (
                    <span key={crumb.id} className="flex items-center gap-1 shrink-0">
                      {idx > 0 && (
                        <svg className="h-3 w-3 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      )}
                      <button
                        onClick={() => {
                          if (!isLast) {
                            setPath((prev) => prev.slice(0, idx + 1));
                            setHoveredId(null);
                            setDetailTopic(path[idx]);
                          }
                        }}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                          isLast
                            ? "bg-indigo-500/30 text-indigo-100 cursor-default ring-1 ring-indigo-400/30"
                            : "text-slate-300 hover:bg-white/10 hover:text-white cursor-pointer"
                        }`}
                      >
                        {crumb.title}
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
            <div className="mb-3 flex items-center justify-between px-2">
              <div className="text-xs text-indigo-100/70">
                {current.children?.length
                  ? `${current.children.length} topics • Click to explore • Center goes back`
                  : "Leaf topic • Use breadcrumbs to navigate up"}
              </div>
              <div className="flex items-center gap-3 text-[11px] text-slate-300/60">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-indigo-200" /> Focus</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-300" /> Children</span>
              </div>
            </div>
            <div
              className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 transition-transform duration-500 ease-out ${
                zooming ? "scale-[1.03]" : "scale-100"
              } ${isFullscreen ? "h-[calc(100vh-4rem)]" : "h-[78vh] min-h-[620px]"}`}
              style={{ transformOrigin: "50% 50%" }}
            >
              <svg
                ref={svgRef}
                viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
                className="h-full w-full"
                onMouseDown={handlePanStart}
                onMouseMove={handlePanMove}
                onMouseUp={handlePanEnd}
                onMouseLeave={handlePanEnd}
              >
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
                    const cR = centerNode.radius ?? 86;
                    const nR = node.radius ?? 60;
                    const startX = centerNode.x + (dx / distance) * cR;
                    const startY = centerNode.y + (dy / distance) * cR;
                    const endX = node.x - (dx / distance) * nR;
                    const endY = node.y - (dy / distance) * nR;
                    return (
                      <line
                        key={`link-${node.topic.id}`}
                        x1={startX}
                        y1={startY}
                        x2={endX}
                        y2={endY}
                        stroke="rgba(255,255,255,0.18)"
                        strokeWidth={1.2}
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
                  const nodeRadius = node.radius ?? (isCenter ? 86 : 60);
                  const fontSize = isCenter
                    ? `${Math.max(12, Math.min(16, nodeRadius * 0.2))}px`
                    : `${Math.max(9, Math.min(13, nodeRadius * 0.24))}px`;
                  const orbitCount = isCenter ? 0 : orbitDotCount(node.topic);
                  const orbitRadius = nodeRadius + Math.max(8, nodeRadius * 0.2);
                  const orbitDotR = Math.max(2, Math.min(3, nodeRadius * 0.05));
                  return (
                    <g
                      key={node.topic.id}
                      transform={`translate(${node.x}, ${node.y})`}
                      onMouseEnter={() => setHoveredId(node.topic.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      onClick={() =>
                        isCenter ? centerClickable && handleBack() : handleSelect(node.topic)
                      }
                      className={`${centerClickable || !isCenter ? "cursor-pointer" : "cursor-default"}`}
                      style={{ transition: "transform 300ms ease, opacity 300ms ease" }}
                    >
                      <circle
                        r={nodeRadius}
                        fill={color}
                        fillOpacity={isCenter ? 1 : isHover ? 0.95 : 0.82}
                        stroke={isHover && !isCenter ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.5)"}
                        strokeWidth={isCenter ? 3 : isHover ? 2.5 : 1.5}
                        style={{ transition: "r 300ms ease, fill-opacity 200ms ease, stroke-width 200ms ease" }}
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
                                r={orbitDotR}
                                fill={color}
                                fillOpacity={0.9}
                              />
                            );
                          })}
                        </g>
                      )}
                      {isCenter && (
                        <circle
                          r={nodeRadius - 4}
                          fill="none"
                          stroke="rgba(255,255,255,0.15)"
                          strokeDasharray="5 7"
                        />
                      )}
                      <text
                        textAnchor="middle"
                        alignmentBaseline="middle"
                        className="font-semibold leading-tight select-none"
                        fill={isCenter ? "#0b1021" : textColorFor(String(color))}
                        style={{ fontSize }}
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

              {/* Hover tooltip */}
              {hoveredId && hoveredId !== current.id && (() => {
                const hoveredNode = positioned.find((p) => p.topic.id === hoveredId);
                if (!hoveredNode) return null;
                const t = hoveredNode.topic;
                const childCount = t.childCount ?? t.children?.length ?? 0;
                // Position tooltip: prefer above the node, flip below if near top
                const tooltipWidth = 220;
                const nodeR = hoveredNode.radius ?? 60;
                const nearTop = hoveredNode.y < dimensions.h * 0.3;
                const tipX = Math.max(tooltipWidth / 2 + 8, Math.min(hoveredNode.x, dimensions.w - tooltipWidth / 2 - 8));
                const tipY = nearTop ? hoveredNode.y + nodeR + 16 : hoveredNode.y - nodeR - 16;
                return (
                  <div
                    className="pointer-events-none absolute z-20"
                    style={{
                      left: `${(tipX / dimensions.w) * 100}%`,
                      top: `${(tipY / dimensions.h) * 100}%`,
                      transform: `translate(-50%, ${nearTop ? "0" : "-100%"})`,
                    }}
                  >
                    <div className="rounded-xl bg-slate-900/90 backdrop-blur-md px-4 py-3 ring-1 ring-white/10 shadow-xl max-w-[220px]">
                      <p className="text-sm font-semibold text-white">{t.title}</p>
                      {t.summary && (
                        <p className="mt-1 text-xs leading-relaxed text-slate-300 line-clamp-2">{t.summary}</p>
                      )}
                      {childCount > 0 && (
                        <p className="mt-2 text-[11px] text-indigo-300">{childCount} subtopic{childCount !== 1 ? "s" : ""} · Click to explore</p>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Overlay detail panel — visible on mobile, or in fullscreen on desktop */}
              {detailOpen && detailTopic && (
                <div className={`pointer-events-auto absolute left-0 top-0 h-full w-[340px] max-w-[85vw] rounded-2xl bg-slate-900/95 backdrop-blur-xl ring-1 ring-white/10 shadow-2xl shadow-indigo-900/40 transition overflow-y-auto ${isFullscreen ? "" : "lg:hidden"}`}>
                  <div className="flex items-start justify-between px-5 pt-5">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.22em] text-indigo-200">
                        Focus
                      </p>
                      <h2 className="mt-1 text-xl font-semibold text-white">{detailTopic.title}</h2>
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
              )}

              {!detailOpen && detailTopic && (
                <button
                  onClick={() => setDetailOpen(true)}
                  className={`pointer-events-auto absolute left-0 top-10 z-10 flex h-12 w-10 items-center justify-center rounded-r-xl bg-indigo-500 text-[10px] font-semibold uppercase tracking-[0.18em] text-white shadow-lg shadow-indigo-900/40 transition hover:bg-indigo-400 ${isFullscreen ? "" : "lg:hidden"}`}
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
                {isZoomed && (
                  <button
                    onClick={handleResetZoom}
                    className="flex h-10 items-center justify-center rounded-full border border-white/20 bg-slate-900/70 px-3 text-[11px] font-medium text-indigo-50 shadow-lg shadow-indigo-900/40 backdrop-blur-sm transition hover:border-white/50 hover:bg-white/10"
                    title="Reset zoom"
                  >
                    Reset
                  </button>
                )}
              </div>

            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
