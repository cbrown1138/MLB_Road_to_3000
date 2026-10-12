"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Chart,
  CategoryScale,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import type { PlayerSnapshot } from "@/lib/players";

Chart.register(
  CategoryScale,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
);

const COVID_SEASON = "2020";

type Entry = { season: string; value: number };

type TrendLine = {
  label: string;
  color: string;
  data: Record<string, number>;
  dashed?: boolean;
};

const CHART_HEIGHT = 256; // px
const PLAYER_LINE_COLOR = "#34d399"; // emerald-400
const PLAYER_FILL_COLOR = "rgba(52, 211, 153, 0.25)";
const AXIS_COLOR = "#e4e4e7"; // zinc-200
const GRID_COLOR = "rgba(255,255,255,0.12)";

function toEntries(dict: Record<string, number> | undefined): Entry[] {
  if (!dict) return [];
  return Object.entries(dict)
    .map(([season, value]) => ({ season, value }))
    .sort((a, b) => Number(a.season) - Number(b.season));
}

// Per-season line chart. Styled after
// https://www.chartjs.org/docs/latest/samples/line/styling.html — the
// player's own line is "filled", overlay trend lines are "unfilled".
function SeasonLineChart({
  title,
  seriesLabel,
  entries,
  yMax,
  trends,
}: {
  title: string;
  // Legend / tooltip label for the player's own line.
  seriesLabel: string;
  entries: Entry[];
  // Pin the axis max to a fixed value instead of auto-scaling to the data.
  yMax?: number;
  // Optional overlay lines, keyed by season. Only seasons already present in
  // `entries` are drawn — no extra years are added to the axis.
  trends?: TrendLine[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || entries.length === 0) return;

    const labels = entries.map((e) => e.season);
    const trendSets = (trends ?? []).map((t) => ({
      label: t.label,
      data: entries.map((e) => t.data[e.season] ?? null),
      borderColor: t.color,
      backgroundColor: t.color,
      borderDash: t.dashed ? [4, 3] : [],
      fill: false,
      tension: 0.2,
      pointRadius: 2,
      spanGaps: true,
    }));

    const rawMax = Math.max(
      ...entries.map((e) => e.value),
      ...trendSets.flatMap((t) => t.data.filter((v): v is number => v != null)),
      1,
    );

    const chart = new Chart(canvasRef.current, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: seriesLabel,
            data: entries.map((e) => e.value),
            borderColor: PLAYER_LINE_COLOR,
            backgroundColor: PLAYER_FILL_COLOR,
            borderDash: [],
            fill: true,
            tension: 0.2,
            pointRadius: 2,
            spanGaps: false,
          },
          ...trendSets,
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            position: "top",
            align: "start",
            labels: { color: AXIS_COLOR, boxWidth: 16, font: { size: 11 } },
          },
          tooltip: {
            callbacks: {
              title: (items) => `${items[0]?.label ?? ""} season`,
              label: (item) =>
                `${item.dataset.label}: ${(item.parsed.y ?? 0).toLocaleString()}`,
            },
          },
        },
        scales: {
          x: {
            title: {
              display: true,
              text: "Season",
              color: AXIS_COLOR,
              font: { size: 10, weight: "bold" },
            },
            ticks: {
              color: AXIS_COLOR,
              font: { size: 10 },
              maxRotation: 0,
              autoSkip: true,
              callback: (_, i) => `'${labels[i]?.slice(-2) ?? ""}`,
            },
            grid: { color: GRID_COLOR },
          },
          y: {
            beginAtZero: true,
            max: yMax != null ? Math.max(yMax, rawMax) : undefined,
            ticks: {
              color: AXIS_COLOR,
              font: { size: 10 },
              callback: (v) => Number(v).toLocaleString(),
            },
            grid: { color: GRID_COLOR },
          },
        },
      },
    });

    return () => chart.destroy();
  }, [entries, seriesLabel, yMax, trends]);

  return (
    <div className="rounded-xl bg-emerald-900 p-5 shadow-sm ring-1 ring-zinc-800">
      <p className="mb-2 text-sm font-medium uppercase tracking-wide text-zinc-200">
        {title}
      </p>
      <div className="relative" style={{ height: CHART_HEIGHT }}>
        <canvas ref={canvasRef} role="img" aria-label={title} />
      </div>
    </div>
  );
}

export function SeasonCharts({
  snapshot,
  leagueHitsMean,
  leagueHitsMax,
}: {
  snapshot: PlayerSnapshot;
  leagueHitsMean?: Record<string, number>;
  leagueHitsMax?: Record<string, number>;
}) {
  const [includeCovidYear, setIncludeCovidYear] = useState(true);

  // Memoized so the charts are only rebuilt when their data actually changes.
  const allGames = useMemo(
    () => toEntries(snapshot.games_per_season),
    [snapshot.games_per_season],
  );
  const allHits = useMemo(
    () => toEntries(snapshot.hits_per_season),
    [snapshot.hits_per_season],
  );

  const games = useMemo(
    () =>
      includeCovidYear
        ? allGames
        : allGames.filter((e) => e.season !== COVID_SEASON),
    [allGames, includeCovidYear],
  );
  const hits = useMemo(
    () =>
      includeCovidYear
        ? allHits
        : allHits.filter((e) => e.season !== COVID_SEASON),
    [allHits, includeCovidYear],
  );

  const hitsTrends = useMemo(
    () =>
      [
        leagueHitsMean && {
          label: "League Avg",
          color: "#38bdf8", // sky-400
          data: leagueHitsMean,
          dashed: true,
        },
        leagueHitsMax && {
          label: "League Max",
          color: "#fbbf24", // amber-400
          data: leagueHitsMax,
        },
      ].filter((t): t is TrendLine => Boolean(t)),
    [leagueHitsMean, leagueHitsMax],
  );

  if (allGames.length === 0 && allHits.length === 0) return null;

  const hasCovidYear =
    allGames.some((e) => e.season === COVID_SEASON) ||
    allHits.some((e) => e.season === COVID_SEASON);

  return (
    <section className="w-full max-w-5xl">
      <h2 className="mb-3 text-lg font-semibold text-zinc-200">
        Season Charts
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-1 lg:grid-cols-2">
        {games.length > 0 && (
          <SeasonLineChart
            title="Games by season"
            seriesLabel={`${snapshot.player_fullName} games`}
            entries={games}
            yMax={162}
          />
        )}
        {hits.length > 0 && (
          <SeasonLineChart
            title="Hits by season"
            seriesLabel={`${snapshot.player_fullName} hits`}
            entries={hits}
            trends={hitsTrends}
            yMax={262}
          />
        )}
      </div>

      {hasCovidYear && (
        <label className="mt-4 flex items-left justify-start gap-3 text-sm text-zinc-200">
          <span>Include 2020 (shortened 60-game season)</span>
          <button
            type="button"
            role="switch"
            aria-checked={includeCovidYear}
            onClick={() => setIncludeCovidYear((v) => !v)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
              includeCovidYear ? "bg-emerald-500" : "bg-zinc-700"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                includeCovidYear ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </label>
      )}
    </section>
  );
}
