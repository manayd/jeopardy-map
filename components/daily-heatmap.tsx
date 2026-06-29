"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  dailyHistorySnapshot,
  loadDailyHistory,
  localDateString,
} from "@/lib/daily-quiz";

const WEEKS = 53;
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Empty, then four intensities by score out of 10 — GitHub's "Less → More".
const TIER_CLASS = [
  "bg-white/5",
  "bg-emerald-300/25",
  "bg-emerald-300/45",
  "bg-emerald-300/70",
  "bg-emerald-300",
];

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Parse a "YYYY-MM-DD" key into a local-midnight Date, or null if malformed. */
function parseLocalDate(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function tierFor(completed: boolean, score: number): number {
  if (!completed) return 0;
  if (score >= 10) return 4;
  if (score >= 8) return 3;
  if (score >= 5) return 2;
  return 1;
}

export function DailyHeatmap() {
  const snapshot = useSyncExternalStore(subscribe, dailyHistorySnapshot, () => "");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // snapshot drives recompute; loadDailyHistory reads localStorage directly.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const history = useMemo(() => loadDailyHistory(), [snapshot]);

  // Columns of 7 days (Sun→Sat). The window defaults to ~53 weeks ending
  // today, but always stretches to cover the earliest and latest day the
  // user actually has data for — so a stored day is never clipped out by
  // clock or timezone differences between when it was saved and "now".
  const { columns, today } = useMemo(() => {
    const today = startOfDay(new Date());
    let min = addDays(today, -(WEEKS - 1) * 7);
    let max = today;
    for (const iso of history.keys()) {
      const parsed = parseLocalDate(iso);
      if (!parsed) continue;
      if (parsed.getTime() < min.getTime()) min = parsed;
      if (parsed.getTime() > max.getTime()) max = parsed;
    }
    const startSunday = addDays(min, -min.getDay());
    const endSaturday = addDays(max, 6 - max.getDay());
    const cols: Date[][] = [];
    for (
      let cursor = startSunday;
      cursor.getTime() <= endSaturday.getTime();
      cursor = addDays(cursor, 7)
    ) {
      const week: Date[] = [];
      for (let d = 0; d < 7; d += 1) week.push(addDays(cursor, d));
      cols.push(week);
    }
    return { columns: cols, today };
    // Recompute after mount (client date) and whenever history changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, history]);

  if (!mounted) {
    return <div className="h-44" aria-hidden />;
  }
  const daysCompleted = [...history.values()].filter((d) => d.completed).length;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-semibold text-white">Your Daily 10 history</h2>
        <p className="text-sm text-slate-300">
          {daysCompleted} day{daysCompleted === 1 ? "" : "s"} completed
        </p>
      </div>

      <div className="mt-5 overflow-x-auto pb-1">
        <div className="inline-flex flex-col gap-2">
          {/* Month labels aligned to columns */}
          <div className="flex gap-[3px] pl-7">
            {columns.map((week, w) => {
              const firstOfMonth =
                week[0].getDate() <= 7 &&
                (w === 0 || columns[w - 1][0].getMonth() !== week[0].getMonth());
              return (
                <div key={w} className="w-3 shrink-0">
                  {firstOfMonth && (
                    <span className="block text-[10px] leading-none text-slate-400">
                      {MONTH_NAMES[week[0].getMonth()]}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex gap-[3px]">
            {/* Weekday labels (Mon / Wed / Fri) */}
            <div className="mr-1 flex w-6 shrink-0 flex-col gap-[3px]">
              {WEEKDAY_NAMES.map((name, d) => (
                <span
                  key={name}
                  className="h-3 text-[9px] leading-3 text-slate-500"
                >
                  {d % 2 === 1 ? name : ""}
                </span>
              ))}
            </div>

            {columns.map((week, w) => (
              <div key={w} className="flex flex-col gap-[3px]">
                {week.map((date) => {
                  const iso = localDateString(date);
                  const day = history.get(iso);
                  // Hide only empty future cells (the rest of the current
                  // week). A future-dated day that has data still renders.
                  if (date.getTime() > today.getTime() && !day) {
                    return <div key={date.getTime()} className="h-3 w-3" />;
                  }
                  const tier = tierFor(Boolean(day?.completed), day?.score ?? 0);
                  const label = day?.completed
                    ? `${WEEKDAY_NAMES[date.getDay()]}, ${MONTH_NAMES[date.getMonth()]} ${date.getDate()}: ${day.score}/10`
                    : `${WEEKDAY_NAMES[date.getDay()]}, ${MONTH_NAMES[date.getMonth()]} ${date.getDate()}: not played`;
                  return (
                    <div
                      key={date.getTime()}
                      title={label}
                      className={`h-3 w-3 rounded-[3px] ${TIER_CLASS[tier]}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400">
        <span>Less</span>
        {TIER_CLASS.map((cls, i) => (
          <span key={i} className={`h-3 w-3 rounded-[3px] ${cls}`} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
