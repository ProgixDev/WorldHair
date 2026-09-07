"use client";

import { cn } from "@/lib/utils";
import { type StatsRange, getBookingStats } from "@/services/adminApi";
import { useCallback, useEffect, useRef, useState } from "react";

const RANGE_OPTIONS: { label: string; value: StatsRange }[] = [
  { label: "Jour", value: "day" },
  { label: "Semaine", value: "week" },
  { label: "Mois", value: "month" },
];

/**
 * The SVG is drawn at its container's own pixel width rather than at a fixed
 * 720 scaled to fit. Scaled-to-fit is what a phone actually got: ~167px of
 * space for a 720-unit viewBox is a 0.23 ratio, which rendered the 11px tick
 * and axis labels at under 3px — present, but unreadable. Drawing 1:1 keeps
 * every label at its true size at any width.
 */
const FALLBACK_W = 720;
const MIN_W = 260;
/** Below this the chart is tall enough to read but not so tall it pushes the
 *  cards under it off a phone screen. */
const NARROW_W = 420;
const PAD = { left: 48, right: 12, top: 14, bottom: 28 };
/** Horizontal room one x-axis label needs before its neighbours collide. */
const LABEL_SLOT = 46;

const currency = (value: number) =>
  value.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

function niceMax(value: number): number {
  const step = value > 1500 ? 500 : value > 600 ? 250 : value > 150 ? 50 : 10;
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

export function RevenueChart() {
  const [range, setRange] = useState<StatsRange>("month");
  const [hovered, setHovered] = useState<number | null>(null);
  const [labels, setLabels] = useState<string[]>([]);
  const [revenue, setRevenue] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewW, setViewW] = useState(FALLBACK_W);
  const svgRef = useRef<SVGSVGElement>(null);
  const plotRef = useRef<HTMLDivElement>(null);

  const load = useCallback((nextRange: StatsRange) => {
    getBookingStats(nextRange)
      .then((data) => {
        setLabels(data.points.map((p) => p.label));
        setRevenue(data.points.map((p) => p.revenue));
        setError(null);
      })
      .catch(() => setError("Impossible de charger les statistiques."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(range);
  }, [range, load]);

  // Track the container's real width so the viewBox can match it 1:1.
  useEffect(() => {
    const element = plotRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect.width;
      if (width) setViewW(Math.max(MIN_W, Math.round(width)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const handleRangeChange = (next: StatsRange) => {
    setLoading(true);
    setHovered(null);
    setRange(next);
  };

  const viewH = viewW < NARROW_W ? 200 : 240;
  const plotW = viewW - PAD.left - PAD.right;
  const plotH = viewH - PAD.top - PAD.bottom;

  const yMax = niceMax(Math.max(0, ...revenue));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(yMax * t));

  // Show every nth label once they no longer fit side by side — twelve months
  // across a phone-width plot would otherwise overlap into a grey smear.
  const labelStep = Math.max(1, Math.ceil(labels.length / Math.max(1, Math.floor(plotW / LABEL_SLOT))));

  const xAt = (i: number) =>
    PAD.left + (labels.length === 1 ? plotW / 2 : (i / (labels.length - 1)) * plotW);
  const yAt = (v: number) => PAD.top + plotH - (v / yMax) * plotH;

  const revenuePoints = revenue.map((v, i) => ({ x: xAt(i), y: yAt(v) }));
  const areaPath = `${smoothPath(revenuePoints)} L ${xAt(labels.length - 1)} ${PAD.top + plotH} L ${PAD.left} ${PAD.top + plotH} Z`;

  // Pointer events rather than mouse ones: on a phone there is no hover, so
  // without touch the tooltip was unreachable and the numbers behind it
  // simply unavailable.
  const handlePointer = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg || labels.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * viewW;
    const ratio = (x - PAD.left) / plotW;
    const index = Math.round(ratio * (labels.length - 1));
    setHovered(Math.min(labels.length - 1, Math.max(0, index)));
  };

  return (
    <section className="rounded-2xl bg-[#111c2e] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <h2 className="text-base font-medium text-[#f2f6fb]">Revenus</h2>

        <div className="flex items-center gap-4 sm:gap-5">
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

      {/* Always mounted, even while loading — it is what the ResizeObserver
          measures, and a ref inside a conditional would never be observed. */}
      <div ref={plotRef} className="relative mt-4">
      {loading && <p className="py-12 text-center text-sm text-[#93a6bc]">Chargement…</p>}
      {error && <p className="py-12 text-center text-sm text-[#ff7a70]">{error}</p>}

      {!loading && !error && (
      <>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${viewW} ${viewH}`}
          className="h-auto w-full touch-pan-y"
          role="img"
          aria-label={`Revenus par ${RANGE_OPTIONS.find((o) => o.value === range)?.label.toLowerCase()}`}
          onMouseMove={(event) => handlePointer(event.clientX)}
          onMouseLeave={() => setHovered(null)}
          onTouchStart={(event) => handlePointer(event.touches[0].clientX)}
          onTouchMove={(event) => handlePointer(event.touches[0].clientX)}
        >
          <defs>
            <linearGradient id="revenueArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2a93d5" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#2a93d5" stopOpacity="0" />
            </linearGradient>
          </defs>

          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={viewW - PAD.right}
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
                {tick.toLocaleString("fr-FR")}
              </text>
            </g>
          ))}

          {labels.map((label, i) =>
            i % labelStep === 0 ? (
              <text
                key={label}
                x={xAt(i)}
                y={viewH - 8}
                textAnchor="middle"
                className="fill-[#5b7186] text-[11px]"
              >
                {label}
              </text>
            ) : null,
          )}

          <path d={areaPath} fill="url(#revenueArea)" />

          {hovered !== null && (
            <line
              x1={xAt(hovered)}
              x2={xAt(hovered)}
              y1={PAD.top}
              y2={PAD.top + plotH}
              stroke="#93a6bc"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
          )}

          <path
            d={smoothPath(revenuePoints)}
            fill="none"
            stroke="#2a93d5"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {hovered !== null && (
            <circle
              cx={revenuePoints[hovered].x}
              cy={revenuePoints[hovered].y}
              r="4.5"
              fill="#2a93d5"
              stroke="#111c2e"
              strokeWidth="2"
            />
          )}
        </svg>

        {hovered !== null && (
          <div
            className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-xl border border-[#1e2e45] bg-[#0c1524] px-3 py-2 shadow-lg"
            // Clamped: at the first or last point an unclamped centre would
            // hang the card half outside the chart, off a phone screen.
            style={{
              left: `${Math.min(85, Math.max(15, (xAt(hovered) / viewW) * 100))}%`,
            }}
          >
            <p className="text-[11px] font-medium text-[#f2f6fb]">
              {labels[hovered]}
            </p>
            <p className="mt-1 text-[11px] font-medium text-[#f2f6fb]">
              {currency(revenue[hovered])}
            </p>
          </div>
        )}
      </>
      )}
      </div>
    </section>
  );
}
