"use client";

import {
  getBookingStats,
  listAccounts,
  listCoiffeurApplications,
} from "@/services/adminApi";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";

interface StatCard {
  id: string;
  label: string;
  /** Pre-formatted — separators, units and signs belong to the caller. */
  value: string;
  delta?: {
    /** Carries its own sign: "+12,4 %", "−0,2 pt". */
    label: string;
    direction: "up" | "down";
    /**
     * Whether that movement is good news. Direction and judgement are separate
     * on purpose: a rise in cancellations moves up and reads badly, and only
     * the caller knows which way round a given metric goes.
     */
    tone: "good" | "bad" | "neutral";
  };
  /** What the delta is measured against, e.g. "vs mois précédent". */
  caption?: string;
}

const ARROW = { up: ArrowUpRight, down: ArrowDownRight } as const;

const percent = (value: number, digits = 1) =>
  value.toLocaleString("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

const signed = (value: number, digits = 1) =>
  `${value >= 0 ? "+" : "−"}${percent(Math.abs(value), digits)}`;

/**
 * Headline figures, above the chart that explains how they got there — the
 * tiles answer "how are we doing", the chart answers "since when".
 *
 * Everything is derived from endpoints that already exist. There is no
 * revenue figure here because the API exposes none, and a tile is worth less
 * than nothing if its number is invented.
 *
 * Only bad news takes a colour, the arrow carries direction on its own and
 * every delta keeps its sign, so no reading here rests on colour alone.
 */
export function AdminStatCards() {
  const [cards, setCards] = useState<StatCard[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([
      getBookingStats("month"),
      listAccounts("coiffeur"),
      listCoiffeurApplications("pending"),
    ])
      .then(([stats, coiffeurs, pending]) => {
        const points = stats.points;
        const last = points[points.length - 1];
        const previous = points[points.length - 2];

        const next: StatCard[] = [];

        if (last) {
          const total = last.confirmed + last.cancelled;
          const previousTotal = previous
            ? previous.confirmed + previous.cancelled
            : 0;

          next.push({
            id: "bookings",
            label: "Réservations",
            value: total.toLocaleString("fr-FR"),
            // A percentage move needs something to move from; the first month
            // on record has no predecessor, so it simply gets no delta.
            delta:
              previousTotal > 0
                ? (() => {
                    const move = ((total - previousTotal) / previousTotal) * 100;
                    return {
                      label: `${signed(move)} %`,
                      direction: move >= 0 ? ("up" as const) : ("down" as const),
                      tone: move >= 0 ? ("good" as const) : ("bad" as const),
                    };
                  })()
                : undefined,
            caption: previousTotal > 0 ? "vs mois précédent" : "ce mois-ci",
          });

          const rate = total > 0 ? (last.cancelled / total) * 100 : 0;
          const previousRate =
            previousTotal > 0 ? (previous!.cancelled / previousTotal) * 100 : null;

          next.push({
            id: "cancellation-rate",
            label: "Taux d'annulation",
            value: `${percent(rate)} %`,
            delta:
              previousRate !== null
                ? (() => {
                    const move = rate - previousRate;
                    return {
                      label: `${signed(move)} pt`,
                      direction: move >= 0 ? ("up" as const) : ("down" as const),
                      // Up is bad here — this is why tone is not derived
                      // from direction.
                      tone: move > 0 ? ("bad" as const) : ("good" as const),
                    };
                  })()
                : undefined,
            caption: previousRate !== null ? "vs mois précédent" : "ce mois-ci",
          });
        }

        next.push({
          id: "coiffeurs",
          label: "Coiffeurs actifs",
          value: coiffeurs
            .filter((account) => account.accountStatus === "active")
            .length.toLocaleString("fr-FR"),
          caption: `sur ${coiffeurs.length.toLocaleString("fr-FR")} inscrits`,
        });

        next.push({
          id: "pending",
          label: "Dossiers en attente",
          value: pending.length.toLocaleString("fr-FR"),
          caption: pending.length > 0 ? "à traiter" : "rien à traiter",
        });

        setCards(next);
      })
      .catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <p className="rounded-2xl bg-[#111c2e] p-4 text-sm text-[#ff7a70]">
        Impossible de charger les indicateurs.
      </p>
    );
  }

  if (!cards) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            aria-hidden="true"
            className="h-[7.5rem] animate-pulse rounded-2xl bg-[#111c2e]"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((stat) => {
        const Arrow = stat.delta ? ARROW[stat.delta.direction] : ArrowRight;
        return (
          <section key={stat.id} className="rounded-2xl bg-[#111c2e] p-4 sm:p-5">
            <h2 className="text-xs font-medium text-[#93a6bc]">{stat.label}</h2>

            <p className="mt-2 text-2xl font-bold text-[#f2f6fb] tabular-nums">
              {stat.value}
            </p>

            {(stat.delta || stat.caption) && (
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                {stat.delta && (
                  <span
                    className={
                      stat.delta.tone === "bad"
                        ? "flex items-center gap-1 font-medium text-[#ff7a70]"
                        : stat.delta.tone === "good"
                          ? "flex items-center gap-1 font-medium text-[#f2f6fb]"
                          : "flex items-center gap-1 font-medium text-[#93a6bc]"
                    }
                  >
                    <Arrow className="size-3.5" aria-hidden="true" />
                    {stat.delta.label}
                  </span>
                )}
                {stat.caption && <span className="text-[#93a6bc]">{stat.caption}</span>}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
