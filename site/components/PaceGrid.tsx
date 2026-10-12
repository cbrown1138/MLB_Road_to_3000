"use client";

import { useState } from "react";
import type { PlayerSnapshot } from "@/lib/players";
import { SegmentedControl } from "@/components/SegmentedControl";

// What a pace is measured against: hits per game, per plate appearance, or
// per at-bat (the last is batting average).
type Basis = "games" | "PA" | "AB";

const BASIS_OPTIONS: { value: Basis; label: string }[] = [
  { value: "games", label: "Per game" },
  { value: "PA", label: "Per PA" },
  { value: "AB", label: "By AVG" },
];

// Stat-line prefixes in the player JSON, see StatLine in lib/players.ts.
type Span = "career" | "season" | "last30games" | "last15games" | "last120PA";

const SPANS: { span: Span; label: string }[] = [
  { span: "career", label: "Career pace" },
  { span: "season", label: "Season pace" },
  { span: "last30games", label: "Last 30 games" },
  { span: "last15games", label: "Last 15 games" },
  { span: "last120PA", label: "Last 120 PA" },
];

type PaceCardData = {
  label: string;
  className?: string;
  hits: number;
  denominator: number;
  unit: string;
  pace: number;
  careerPace?: number;
};

function PaceCard({ data }: { data: PaceCardData }) {
  const pctOffCareer =
    data.careerPace !== undefined
      ? ((data.pace - data.careerPace) / data.careerPace) * 100
      : undefined;
  const isUp = (pctOffCareer ?? 0) >= 0;
  const borderAccent =
    pctOffCareer === undefined
      ? "border-l-4 border-transparent"
      : isUp
        ? "border-l-4 border-emerald-400"
        : "border-l-4 border-red-300";

  return (
    <div
      className={`rounded-xl bg-emerald-900 p-5 shadow-sm ring-1 ring-zinc-800 ${borderAccent} ${data.className ?? ""}`}
    >
      <p className="text-sm font-medium uppercase tracking-wide text-zinc-200">
        {data.label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-200">
        {data.pace.toFixed(3)}
      </p>
      <p className="text-sm text-zinc-200">
        {data.hits.toLocaleString()} hits from {" "}
        {data.denominator.toLocaleString()} {data.unit}
      </p>
      {pctOffCareer !== undefined && (
        <p
          className={`mt-1 flex items-center gap-1 text-sm font-medium ${
            isUp ? "text-emerald-400" : "text-red-300"
          }`}
        >
          {isUp ? "▲" : "▼"} {Math.abs(pctOffCareer).toFixed(1)}% vs career pace
        </p>
      )}
    </div>
  );
}

export function PaceGrid({ snapshot }: { snapshot: PlayerSnapshot }) {
  const [basis, setBasis] = useState<Basis>("games");
  const careerPace = snapshot[`career_${basis}_pace`];

  const cards: PaceCardData[] = SPANS.map(({ span, label }) => ({
    label,
    hits: snapshot[`${span}_hits`],
    denominator: snapshot[`${span}_${basis}`],
    unit: basis,
    pace: snapshot[`${span}_${basis}_pace`],
    careerPace: span === "career" ? undefined : careerPace,
    // career spans two columns on its own row; the comparison cards start below it
    className:
      span === "career" ? "sm:col-span-2" : span === "season" ? "lg:col-start-1" : undefined,
  }));

  return (
    <section className="w-full max-w-5xl">
      <div className="mb-3 flex flex-wrap items-center gap-4">
        <h2 className="text-lg font-semibold text-zinc-200">
          Pace comparison
        </h2>
        <SegmentedControl
          label="Pace measured in hits"
          options={BASIS_OPTIONS}
          value={basis}
          onChange={setBasis}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <PaceCard key={card.label} data={card} />
        ))}
      </div>
    </section>
  );
}
