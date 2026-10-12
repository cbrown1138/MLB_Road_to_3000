"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Chart, type ChartConfiguration, type ChartDataset } from "chart.js";
import type { PlayerSnapshot } from "@/lib/players";
import {
  AXIS_COLOR,
  CARD_BG_COLOR,
  GRID_COLOR,
  LEAGUE_AVG_COLOR,
  LEAGUE_BAND_COLOR,
  LEAGUE_MAX_COLOR,
  LEGEND_FONT,
  PLAYER_FILL_COLOR,
  PLAYER_LINE_COLOR,
  TICK_FONT,
  refLinePlugin,
  type RefLineOptions,
} from "@/lib/chartTheme";

const COVID_SEASON = "2020";
const FULL_SEASON_GAMES: RefLineOptions = { value: 162, label: "Full season: 162" };
const RECORD_SEASON_HITS: RefLineOptions = {
  value: 262,
  label: "Record: 262 (Ichiro, 2004)",
};

// The data has no schedule, so the current season counts as in progress until
// October 1 (the regular season ends in late September).
const REGULAR_SEASON_END_MONTH = 9; // zero-based: October

const CHART_HEIGHT = 256; // px

// `value` is null for a season that's on the axis but hidden (2020 toggled off).
type Entry = { season: string; value: number | null };

type TrendLine = {
  label: string;
  color: string;
  data: Record<string, number>;
  dashed?: boolean;
  width?: number;
  // Shade between this line and the trend line before it.
  fillToPrevious?: string;
  // Show the player's difference from this line in the tooltip.
  showDiff?: boolean;
};

type LineConfig = ChartConfiguration<"line", (number | null)[], string>;

function toEntries(dict: Record<string, number> | undefined): Entry[] {
  if (!dict) return [];
  return Object.entries(dict)
    .map(([season, value]) => ({ season, value }))
    .sort((a, b) => Number(a.season) - Number(b.season));
}

function formatCount(v: number): string {
  return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function inProgressSeason(snapshot: PlayerSnapshot): string | undefined {
  const today = new Date(snapshot.today);
  if (Number.isNaN(today.getTime())) return undefined;
  const seasonEnd = new Date(snapshot.season, REGULAR_SEASON_END_MONTH, 1);
  return today < seasonEnd ? String(snapshot.season) : undefined;
}

// Screen-reader summary, e.g. "Hits per season for X, 2010–2026. Most: 211 in 2023."
function describe(entries: Entry[], what: string, name: string): string {
  const shown = entries.filter((e): e is { season: string; value: number } => e.value != null);
  if (shown.length === 0) return `${what} for ${name}`;
  const best = shown.reduce((a, b) => (b.value > a.value ? b : a));
  const range = `${shown[0].season}–${shown[shown.length - 1].season}`;
  return `${what} for ${name}, ${range}. Most: ${formatCount(best.value)} in ${best.season}.`;
}

function buildConfig({
  seriesLabel,
  entries,
  trends,
  refLine,
  notes,
  inProgress,
}: {
  seriesLabel: string;
  entries: Entry[];
  trends: TrendLine[];
  refLine?: RefLineOptions;
  notes: Record<string, string>;
  inProgress?: string;
}): LineConfig {
  const labels = entries.map((e) => e.season);
  const hidden = new Set(entries.filter((e) => e.value == null).map((e) => e.season));
  const inProgressIndex = inProgress ? labels.indexOf(inProgress) : -1;
  const diffTrend = trends.find((t) => t.showDiff);

  const playerSet: ChartDataset<"line", (number | null)[]> = {
    label: seriesLabel,
    data: entries.map((e) => e.value),
    borderColor: PLAYER_LINE_COLOR,
    backgroundColor: PLAYER_FILL_COLOR,
    borderWidth: 2.5,
    // With league lines overlaid the fill just muddies them.
    fill: trends.length === 0,
    // Seasons with a note (debut, 2020, in progress) get a hollow point.
    pointRadius: labels.map((s) => (notes[s] ? 4 : 2.5)),
    pointHoverRadius: 5,
    pointBorderColor: PLAYER_LINE_COLOR,
    pointBackgroundColor: labels.map((s) => (notes[s] ? CARD_BG_COLOR : PLAYER_LINE_COLOR)),
    // Dash the segment into the in-progress season — it's still growing.
    segment: {
      borderDash: (ctx) => (ctx.p1DataIndex === inProgressIndex ? [5, 4] : undefined),
    },
  };

  const trendSets: ChartDataset<"line", (number | null)[]>[] = trends.map((t, i) => ({
    label: t.label,
    data: labels.map((s) => (hidden.has(s) ? null : (t.data[s] ?? null))),
    borderColor: t.color,
    backgroundColor: t.fillToPrevious ?? t.color,
    borderWidth: t.width ?? 1.5,
    borderDash: t.dashed ? [5, 4] : [],
    fill: t.fillToPrevious && i > 0 ? "-1" : false,
    pointRadius: 0,
    pointHoverRadius: 3,
  }));

  return {
    type: "line",
    data: { labels, datasets: [playerSet, ...trendSets] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      // Break the line at hidden seasons instead of bridging them.
      spanGaps: false,
      // Season totals are discrete; monotone curves never overshoot them.
      elements: { line: { cubicInterpolationMode: "monotone" } },
      plugins: {
        refLine: refLine ?? false,
        legend: {
          // A lone series is already named by the card title.
          display: trends.length > 0,
          position: "top",
          align: "start",
          labels: {
            color: AXIS_COLOR,
            font: LEGEND_FONT,
            usePointStyle: true,
            pointStyle: "line",
          },
        },
        tooltip: {
          callbacks: {
            title: (items) => `${items[0]?.label ?? ""} season`,
            afterTitle: (items) => notes[items[0]?.label ?? ""] ?? "",
            label: (item) => {
              const v = item.parsed.y;
              if (v == null) return "";
              let text = `${item.dataset.label}: ${formatCount(v)}`;
              const ref = diffTrend?.data[labels[item.dataIndex]];
              if (item.datasetIndex === 0 && diffTrend && ref != null) {
                const diff = Math.round(v - ref);
                text += ` (${diff >= 0 ? "+" : "−"}${Math.abs(diff)} vs ${diffTrend.label.toLowerCase()})`;
              }
              return text;
            },
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: AXIS_COLOR,
            font: TICK_FONT,
            maxRotation: 0,
            autoSkip: true,
            callback: (_, i) => `'${labels[i]?.slice(-2) ?? ""}`,
          },
          grid: { display: false },
          border: { color: GRID_COLOR },
        },
        y: {
          beginAtZero: true,
          // Headroom above the reference line so it and its label stay visible.
          suggestedMax: refLine ? refLine.value * 1.1 : undefined,
          ticks: {
            color: AXIS_COLOR,
            font: TICK_FONT,
            maxTicksLimit: 6,
            callback: (v) => Number(v).toLocaleString(),
          },
          grid: { color: GRID_COLOR },
          border: { display: false },
        },
      },
    },
  };
}

// Per-season line chart: the player's line, optional league context lines, and
// an optional labelled reference line.
function SeasonLineChart({
  title,
  caption,
  summary,
  valueHeader,
  seriesLabel,
  entries,
  trends,
  refLine,
  notes,
  inProgress,
}: {
  title: string;
  caption?: string;
  // aria-label for the canvas.
  summary: string;
  // Column header for the player's values in the screen-reader table.
  valueHeader: string;
  // Legend / tooltip label for the player's own line.
  seriesLabel: string;
  entries: Entry[];
  // Overlay lines, keyed by season. Only seasons in `entries` are drawn.
  trends?: TrendLine[];
  refLine?: RefLineOptions;
  // Tooltip note per season; those seasons get a hollow point.
  notes: Record<string, string>;
  inProgress?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart<"line", (number | null)[], string> | null>(null);
  const trendList = useMemo(() => trends ?? [], [trends]);

  const config = useMemo(
    () => buildConfig({ seriesLabel, entries, trends: trendList, refLine, notes, inProgress }),
    [seriesLabel, entries, trendList, refLine, notes, inProgress],
  );

  // Create the chart once, then update it in place so changes animate.
  useEffect(() => {
    if (!canvasRef.current) return;
    const chart = chartRef.current;
    if (!chart) {
      chartRef.current = new Chart(canvasRef.current, { ...config, plugins: [refLinePlugin] });
      return;
    }
    chart.data = config.data;
    chart.options = config.options ?? {};
    chart.update();
  }, [config]);

  useEffect(
    () => () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    },
    [],
  );

  return (
    <div className="rounded-xl bg-emerald-900 p-5 shadow-sm ring-1 ring-zinc-800">
      <p className="text-sm font-medium uppercase tracking-wide text-zinc-200">{title}</p>
      {caption && <p className="mt-1 text-xs text-zinc-300">{caption}</p>}
      <div className="relative mt-2" style={{ height: CHART_HEIGHT }}>
        <canvas ref={canvasRef} role="img" aria-label={summary} />
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Season</th>
            <th scope="col">{valueHeader}</th>
            {trendList.map((t) => (
              <th key={t.label} scope="col">
                {t.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.season}>
              <th scope="row">
                {e.season}
                {notes[e.season] ? ` (${notes[e.season]})` : ""}
              </th>
              <td>{e.value == null ? "hidden" : formatCount(e.value)}</td>
              {trendList.map((t) => (
                <td key={t.label}>
                  {t.data[e.season] != null ? formatCount(t.data[e.season]) : "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
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

  // Memoized so the charts are only updated when their data actually changes.
  const allGames = useMemo(
    () => toEntries(snapshot.games_per_season),
    [snapshot.games_per_season],
  );
  const allHits = useMemo(
    () => toEntries(snapshot.hits_per_season),
    [snapshot.hits_per_season],
  );

  // 2020 stays on the axis when hidden, so the line visibly breaks there.
  const games = useMemo(
    () =>
      includeCovidYear
        ? allGames
        : allGames.map((e) => (e.season === COVID_SEASON ? { ...e, value: null } : e)),
    [allGames, includeCovidYear],
  );
  const hits = useMemo(
    () =>
      includeCovidYear
        ? allHits
        : allHits.map((e) => (e.season === COVID_SEASON ? { ...e, value: null } : e)),
    [allHits, includeCovidYear],
  );

  const hitsTrends = useMemo(() => {
    const lines: (TrendLine | undefined)[] = [
      leagueHitsMean && {
        label: "Qualified avg",
        color: LEAGUE_AVG_COLOR,
        data: leagueHitsMean,
        dashed: true,
        showDiff: true,
      },
      leagueHitsMax && {
        label: "League max",
        color: LEAGUE_MAX_COLOR,
        data: leagueHitsMax,
        width: 1,
        fillToPrevious: LEAGUE_BAND_COLOR,
      },
    ];
    return lines.filter((t): t is TrendLine => Boolean(t));
  }, [leagueHitsMean, leagueHitsMax]);

  const hasCovidYear =
    allGames.some((e) => e.season === COVID_SEASON) ||
    allHits.some((e) => e.season === COVID_SEASON);
  const inProgress = inProgressSeason(snapshot);
  const debutSeason = (allGames[0] ?? allHits[0])?.season;

  const notes = useMemo(() => {
    const out: Record<string, string> = {};
    const add = (season: string | undefined, note: string) => {
      if (season) out[season] = out[season] ? `${out[season]} · ${note}` : note;
    };
    add(debutSeason, "Debut season");
    if (hasCovidYear) {
      add(COVID_SEASON, includeCovidYear ? "60-game season" : "60-game season (hidden)");
    }
    add(inProgress, "Season in progress");
    return out;
  }, [debutSeason, hasCovidYear, includeCovidYear, inProgress]);

  if (allGames.length === 0 && allHits.length === 0) return null;

  const name = snapshot.full_name;
  // The band needs both edges.
  const hasBand = hitsTrends.length > 1;

  return (
    <section className="w-full max-w-5xl">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-200">Season Charts</h2>
        {hasCovidYear && (
          <div className="flex items-center gap-3 text-sm text-zinc-200">
            <span id="covid-toggle-label">Include 2020 (60-game season)</span>
            <button
              type="button"
              role="switch"
              aria-checked={includeCovidYear}
              aria-labelledby="covid-toggle-label"
              onClick={() => setIncludeCovidYear((v) => !v)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                includeCovidYear ? "bg-emerald-500" : "bg-zinc-700"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  includeCovidYear ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {games.length > 0 && (
          <SeasonLineChart
            title="Games by season"
            summary={describe(games, "Games played per season", name)}
            valueHeader="Games"
            seriesLabel={`${snapshot.last_name} games`}
            entries={games}
            refLine={FULL_SEASON_GAMES}
            notes={notes}
            inProgress={inProgress}
          />
        )}
        {hits.length > 0 && (
          <SeasonLineChart
            title="Hits by season"
            caption={
              hasBand
                ? "Shaded band: qualified-hitter average up to the league max."
                : undefined
            }
            summary={describe(hits, "Hits per season", name)}
            valueHeader="Hits"
            seriesLabel={`${snapshot.last_name} hits`}
            entries={hits}
            trends={hitsTrends}
            refLine={RECORD_SEASON_HITS}
            notes={notes}
            inProgress={inProgress}
          />
        )}
      </div>
      {Object.keys(notes).length > 0 && (
        <p className="mt-2 text-xs text-zinc-300">
          Hollow points mark seasons with a note. Hover for details.
        </p>
      )}
    </section>
  );
}
