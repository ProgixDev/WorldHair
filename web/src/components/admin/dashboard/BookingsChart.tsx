"use client";

import { cn } from "@/lib/utils";
import { type StatsRange, getBookingStats } from "@/services/adminApi";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Two series, one axis — both are counts of appointments, so they share a
 * scale (never a dual-axis chart). Colours are WorldHair's own accent blue
 * and DESIGN.md's warm gold, each snapped to the dark-mode lightness band so
 * the pair passes CVD separation against the #111c2e card surface.
 */
const SERIES = [
  { key: "confirmed", label: "Confirmées", color: "#2a93d5" },
  { key: "cancelled", label: "Annulées", color: "#b8813f" },
] as const;

const RANGE_OPTIONS: { label: string; value: StatsRange }[] = [
  { label: "Jour", value: "day" },
  { label: "Semaine", value: "week" },
  { label: "Mois", value: "month" },
];

const VIEW_W = 720;
const VIEW_H = 240;
const PAD = { left: 40, right: 12, top: 14, bottom: 28 };
const PLOT_W = VIEW_W - PAD.left - PAD.right;
const PLOT_H = VIEW_H - PAD.top - PAD.bottom;

function niceMax(value: number): number {
  const step = value > 150 ? 50 : value > 60 ? 25 : 10;
  return Math.max(step, Math.ceil(value / step) * step);
}

function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    d += ` Q ${prev.x} ${prev.y} ${(prev.x + cur.x) / 2} ${(prev.y + cur.y) / 2}`;
  }
  const last = points[points.length - 1];
  return `${d} L ${last.x} ${last.y}`;
}

export function BookingsChart() {
  const [range, setRange] = useState<StatsRange>("month");
  const [hovered, setHovered] = useState<number | null>(null);
  const [labels, setLabels] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState<number[]>([]);
  const [cancelled, setCancelled] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const load = useCallback((nextRange: StatsRange) => {
    getBookingStats(nextRange)
      .then((data) => {
        setLabels(data.points.map((p) => p.label));
        setConfirmed(data.points.map((p) => p.confirmed));
        setCancelled(data.points.map((p) => p.cancelled));
        setError(null);
      })
      .catch(() => setError("Impossible de charger les statistiques."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(range);
  }, [range, load]);

  const handleRangeChange = (next: StatsRange) => {
    setLoading(true);
    setHovered(null);
    setRange(next);
  };

  const yMax = niceMax(Math.max(0, ...confirmed, ...cancelled));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(yMax * t));

  const xAt = (i: number) =>
    PAD.left + (labels.length === 1 ? PLOT_W / 2 : (i / (labels.length - 1)) * PLOT_W);
  const yAt = (v: number) => PAD.top + PLOT_H - (v / yMax) * PLOT_H;

  const pointsFor = (values: number[]) =>
    values.map((v, i) => ({ x: xAt(i), y: yAt(v) }));

  const confirmedPoints = pointsFor(confirmed);
  const cancelledPoints = pointsFor(cancelled);
  const areaPath = `${smoothPath(confirmedPoints)} L ${xAt(labels.length - 1)} ${PAD.top + PLOT_H} L ${PAD.left} ${PAD.top + PLOT_H} Z`;

  const handleMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * VIEW_W;
    const ratio = (x - PAD.left) / PLOT_W;
    const index = Math.round(ratio * (labels.length - 1));
    setHovered(Math.min(labels.length - 1, Math.max(0, index)));
  };

  return (
    <section className="rounded-2xl bg-[#111c2e] p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-base font-medium text-[#f2f6fb]">Réservations</h2>

        <div className="flex items-center gap-5">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleRangeChange(option.value)}
              className={cn(
                "text-xs transition-colors",
                option.value === range
                  ? "border-b-2 border-[#2a93d5] pb-0.5 font-medium text-[#f2f6fb]"
                  : "text-[#93a6bc] hover:text-white",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Legend — identity never rests on colour alone. */}
      <ul className="mt-4 flex items-center gap-5">
        {SERIES.map((series) => (
          <li
            key={series.key}
            className="flex items-center gap-2 text-xs text-[#93a6bc]"
          >
            <span
              aria-hidden="true"
              className="size-2.5 rounded-full"
              style={{ backgroundColor: series.color }}
            />
            {series.label}
          </li>
        ))}
      </ul>

      {loading && <p className="py-12 text-center text-sm text-[#93a6bc]">Chargement…</p>}
      {error && <p className="py-12 text-center text-sm text-[#ff7a70]">{error}</p>}

      {!loading && !error && (
      <div className="relative mt-2">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="h-auto w-full"
          role="img"
          aria-label={`Réservations confirmées et annulées par ${RANGE_OPTIONS.find((o) => o.value === range)?.label.toLowerCase()}`}
          onMouseMove={handleMove}
          onMouseLeave={() => setHovered(null)}
        >
          <defs>
            <linearGradient id="confirmedArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2a93d5" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#2a93d5" stopOpacity="0" />
            </linearGradient>
          </defs>

          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={VIEW_W - PAD.right}
                y1={yAt(tick)}
                y2={yAt(tick)}
                stroke="#1e2e45"
                strokeWidth="1"
              />
              <text
                x={PAD.left - 10}
                y={yAt(tick) + 4}
                textAnchor="end"
                className="fill-[#5b7186] text-[11px]"
              >
                {tick}
              </text>
            </g>
          ))}

          {labels.map((label, i) => (
            <text
              key={label}
              x={xAt(i)}
              y={VIEW_H - 8}
              textAnchor="middle"
              className="fill-[#5b7186] text-[11px]"
            >
              {label}
            </text>
          ))}

          <path d={areaPath} fill="url(#confirmedArea)" />

          {hovered !== null && (
            <line
              x1={xAt(hovered)}
              x2={xAt(hovered)}
              y1={PAD.top}
              y2={PAD.top + PLOT_H}
              stroke="#93a6bc"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
          )}

          <path
            d={smoothPath(cancelledPoints)}
            fill="none"
            stroke="#b8813f"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d={smoothPath(confirmedPoints)}
            fill="none"
            stroke="#2a93d5"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {hovered !== null &&
            SERIES.map((series) => {
              const point =
                series.key === "confirmed"
                  ? confirmedPoints[hovered]
                  : cancelledPoints[hovered];
              return (
                <circle
                  key={series.key}
                  cx={point.x}
                  cy={point.y}
                  r="4.5"
                  fill={series.color}
                  stroke="#111c2e"
                  strokeWidth="2"
                />
              );
            })}
        </svg>

        {hovered !== null && (
          <div
            className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-xl border border-[#1e2e45] bg-[#0c1524] px-3 py-2 shadow-lg"
            style={{ left: `${(xAt(hovered) / VIEW_W) * 100}%` }}
          >
            <p className="text-[11px] font-medium text-[#f2f6fb]">
              {labels[hovered]}
            </p>
            {SERIES.map((series) => (
              <p
                key={series.key}
                className="mt-1 flex items-center gap-2 text-[11px] text-[#93a6bc]"
              >
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full"
                  style={{ backgroundColor: series.color }}
                />
                {series.label}
                <span className="ml-auto font-medium text-[#f2f6fb]">
                  {series.key === "confirmed"
                    ? confirmed[hovered]
                    : cancelled[hovered]}
                </span>
              </p>
            ))}
          </div>
        )}
      </div>
      )}
    </section>
  );
}
