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

  // Columns of 7 days (Sun→Sat), ending with the week containing today.
  const columns = useMemo(() => {
    const today = startOfDay(new Date());
    const thisSunday = addDays(today, -today.getDay());
    const start = addDays(thisSunday, -(WEEKS - 1) * 7);
    const cols: Date[][] = [];
    for (let w = 0; w < WEEKS; w += 1) {
      const week: Date[] = [];
      for (let d = 0; d < 7; d += 1) {
        week.push(addDays(start, w * 7 + d));
      }
      cols.push(week);
    }
    return cols;
    // Recompute after mount so the date axis uses the client's local day.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  if (!mounted) {
    return <div className="h-44" aria-hidden />;
  }

  const today = startOfDay(new Date());
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
                  const inFuture = date.getTime() > today.getTime();
                  if (inFuture) {
                    return <div key={date.getTime()} className="h-3 w-3" />;
                  }
                  const iso = localDateString(date);
                  const day = history.get(iso);
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
