import type { PlayerSnapshot } from "@/lib/players";

type Entry = { season: string; value: number };

type TrendLine = {
  label: string;
  color: string;
  data: Record<string, number>;
  dashed?: boolean;
};

const CHART_HEIGHT = 176; // px, matches h-44
const PLAYER_LINE_COLOR = "#34d399"; // emerald-400
const PLAYER_FILL_COLOR = "rgba(52, 211, 153, 0.25)";

function toEntries(dict: Record<string, number> | undefined): Entry[] {
  if (!dict) return [];
  return Object.entries(dict)
    .map(([season, value]) => ({ season, value }))
    .sort((a, b) => Number(a.season) - Number(b.season));
}

// Picks a "nice" step (1/2/5 x a power of 10) so axis ticks land on
// round numbers, then returns ascending ticks from 0 up to >= maxValue.
function getNiceTicks(maxValue: number, tickCount = 4): number[] {
  if (maxValue <= 0) return [0, 1];
  const rawStep = maxValue / tickCount;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / magnitude;
  const step =
    (residual > 5 ? 10 : residual > 2 ? 5 : residual > 1 ? 2 : 1) * magnitude;
  const niceMax = Math.ceil(maxValue / step) * step;

  const ticks: number[] = [];
  for (let v = 0; v <= niceMax + step / 2; v += step) {
    ticks.push(Math.round(v));
  }
  return ticks;
}

// Like getNiceTicks, but the axis max is pinned to a caller-supplied value
// (e.g. 162 games — a full MLB season) instead of being rounded up.
function getFixedMaxTicks(maxValue: number, tickCount = 4): number[] {
  const rawStep = maxValue / tickCount;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / magnitude;
  const step =
    (residual > 5 ? 10 : residual > 2 ? 5 : residual > 1 ? 2 : 1) * magnitude;

  const ticks: number[] = [];
  for (let v = 0; v < maxValue; v += step) {
    ticks.push(Math.round(v));
  }
  ticks.push(maxValue);
  return ticks;
}

function SeasonLineChart({
  title,
  entries,
  yMax,
  trends,
}: {
  title: string;
  entries: Entry[];
  // Pin the axis max to a fixed value instead of auto-scaling to the data.
  yMax?: number;
  // Optional overlay lines, keyed by season. Only seasons already present in
  // `entries` are drawn — no extra years are added to the axis.
  trends?: TrendLine[];
}) {
  const trendValues = (trends ?? []).flatMap((t) =>
    entries.map((e) => t.data[e.season]).filter((v): v is number => v != null),
  );
  const rawMax = Math.max(...entries.map((e) => e.value), ...trendValues, 1);

  const ticks =
    yMax != null
      ? getFixedMaxTicks(Math.max(yMax, rawMax))
      : getNiceTicks(rawMax);
  const max = ticks[ticks.length - 1];

  // y-axis (horizontal) lines at each non-zero tick, x-axis (vertical) lines
  // at each season — drawn as background layers so they sit behind the data.
  const gridTicks = ticks.filter((t) => t > 0);
  const gridLines = [
    ...gridTicks.map((t) => ({
      size: "100% 1px",
      position: `0 ${100 - (t / max) * 100}%`,
    })),
    ...entries.map((_, i) => ({
      size: "1px 100%",
      position: `${((i + 0.5) / entries.length) * 100}% 0`,
    })),
  ];
  const gridStyle = gridLines.length
    ? {
        backgroundImage: gridLines
          .map(() => "linear-gradient(rgba(255,255,255,0.12), rgba(255,255,255,0.12))")
          .join(", "),
        backgroundSize: gridLines.map((l) => l.size).join(", "),
        backgroundPosition: gridLines.map((l) => l.position).join(", "),
        backgroundRepeat: "no-repeat",
      }
    : undefined;

  const trendLines = (trends ?? []).map((t) => ({
    ...t,
    points: entries
      .map((e, i) => {
        const v = t.data[e.season];
        if (v == null) return null;
        const x = ((i + 0.5) / entries.length) * 100;
        const y = 100 - (v / max) * 100;
        return `${x},${y}`;
      })
      .filter((p): p is string => p !== null),
  }));

  // Player's own data — a filled line, matching the "filled" style in
  // https://www.chartjs.org/docs/latest/samples/line/styling.html
  const playerPoints = entries.map((e, i) => ({
    x: ((i + 0.5) / entries.length) * 100,
    y: 100 - (e.value / max) * 100,
  }));
  const playerLine = playerPoints.map((p) => `${p.x},${p.y}`).join(" ");
  const playerArea =
    playerPoints.length > 0
      ? [
          `${playerPoints[0].x},100`,
          playerLine,
          `${playerPoints[playerPoints.length - 1].x},100`,
        ].join(" ")
      : "";

  return (
    <div className="rounded-xl bg-emerald-900 p-5 shadow-sm ring-1 ring-zinc-800">
      <div className="mb-4">
        <p className="text-sm font-medium uppercase tracking-wide text-zinc-200">
          {title}
        </p>
        {trendLines.length > 0 ? (
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
            {trendLines.map((t) => (
              <p
                key={t.label}
                className="flex items-center gap-2 text-[11px] text-zinc-200"
              >
                <span
                  className="inline-block h-0.5 w-4 rounded"
                  style={{ backgroundColor: t.color }}
                />
                {t.label}
              </p>
            ))}
          </div>
        ) : (
          // invisible placeholder — keeps this chart's plot area lined up
          // with charts that do show a legend row (e.g. Hits by season)
          <p className="invisible mt-1 text-[11px]" aria-hidden>
            &nbsp;
          </p>
        )}
      </div>

      <div className="flex gap-2">

        {/* y-axis ticks */}
        <div
          className="flex w-8 shrink-0 flex-col justify-between text-right text-[10px] tabular-nums text-zinc-200"
          style={{ height: CHART_HEIGHT }}
        >
          {[...ticks].reverse().map((t) => (
            <span key={t}>{t.toLocaleString()}</span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          {/* plot area */}
          <div
            className="relative border-b border-zinc-200"
            style={{ height: CHART_HEIGHT, ...gridStyle }}
          >
            {playerPoints.length > 1 && (
              <svg
                className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden
              >
                <polygon points={playerArea} fill={PLAYER_FILL_COLOR} stroke="none" />
                <polyline
                  points={playerLine}
                  fill="none"
                  stroke={PLAYER_LINE_COLOR}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            )}

            {trendLines.map(
              (t) =>
                t.points.length > 1 && (
                  <svg
                    key={t.label}
                    className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    aria-hidden
                  >
                    <polyline
                      points={t.points.join(" ")}
                      fill="none"
                      stroke={t.color}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={t.dashed ? "4 3" : undefined}
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                ),
            )}
          </div>

          {/* x-axis labels — mirror the flex layout above */}
          <div className="mt-1 flex gap-1">
            {entries.map((e) => (
              <div
                key={e.season}
                className="flex min-w-[1.25rem] flex-1 flex-col items-center leading-tight"
              >
                <span className="text-[10px] tabular-nums text-zinc-200">
                  {e.value}
                </span>
                <span className="text-[10px] tabular-nums text-zinc-200">
                  {`'${e.season.slice(-2)}`}
                </span>
              </div>
            ))}
          </div>

          {/* x-axis title */}
          <p className="mt-1 text-center text-[10px] font-medium uppercase tracking-wide text-zinc-200">
            Season
          </p>
        </div>
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
  const games = toEntries(snapshot.games_per_season);
  const hits = toEntries(snapshot.hits_per_season);

  if (games.length === 0 && hits.length === 0) return null;

  const hitsTrends: TrendLine[] = [
    leagueHitsMean && {
      label: "Hits: League Avg",
      color: "#38bdf8",
      data: leagueHitsMean,
      dashed: true,
    },
    leagueHitsMax && {
      label: "Hits: League Max",
      color: "#fbbf24",
      data: leagueHitsMax,
    },
  ].filter((t): t is TrendLine => Boolean(t));

  return (
    <section className="w-full max-w-5xl">
      <h2 className="mb-3 text-lg font-semibold text-zinc-200">
        Season Charts
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-1 lg:grid-cols-2">
        {games.length > 0 && (
          <SeasonLineChart
            title="Games by season"
            entries={games}
            yMax={162}
          />
        )}
        {hits.length > 0 && (
          <SeasonLineChart
            title="Hits by season"
            entries={hits}
            trends={hitsTrends}
            yMax={262}
          />
        )}
      </div>
    </section>
  );
}
