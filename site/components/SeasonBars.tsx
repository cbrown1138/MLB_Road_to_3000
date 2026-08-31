import type { PlayerSnapshot } from "@/lib/players";

type Entry = { season: string; value: number };

function toEntries(dict: Record<string, number> | undefined): Entry[] {
  if (!dict) return [];
  return Object.entries(dict)
    .map(([season, value]) => ({ season, value }))
    .sort((a, b) => Number(a.season) - Number(b.season));
}

function BarChart({
  title,
  entries,
  trend,
}: {
  title: string;
  entries: Entry[];
  // Optional overlay line, keyed by season. Only seasons already present in
  // `entries` are drawn — no extra years are added to the axis.
  trend?: Record<string, number>;
}) {
  const trendValues = trend
    ? entries
        .map((e) => trend[e.season])
        .filter((v): v is number => v != null)
    : [];
  const max = Math.max(...entries.map((e) => e.value), ...trendValues, 1);

  const trendPoints = trend
    ? entries
        .map((e, i) => {
          const v = trend[e.season];
          if (v == null) return null;
          const x = ((i + 0.5) / entries.length) * 100;
          const y = 100 - (v / max) * 100;
          return `${x},${y}`;
        })
        .filter((p): p is string => p !== null)
    : [];

  return (
    <div className="rounded-xl bg-emerald-900 p-5 shadow-sm ring-1 ring-zinc-800">
      <div className="mb-4">
        <p className="text-sm font-medium uppercase tracking-wide text-zinc-200">
          {title}
        </p>
        {trend && (
          <p className="mt-1 flex items-center gap-2 text-[11px] text-zinc-400">
            <span className="inline-block h-0.5 w-4 rounded bg-amber-400" />
            Hits League Avg (Qualified Hitters)
          </p>
        )}
      </div>

      {/* plot area — flex columns stretch to full height so % bars resolve */}
      <div className="relative flex h-44 gap-1">
        {entries.map((e) => (
          <div
            key={e.season}
            className="flex min-w-[1.25rem] flex-1 items-end"
          >
            <div
              className="w-full rounded-t bg-emerald-400"
              style={{ height: `${(e.value / max) * 100}%` }}
              title={`${e.season}: ${e.value}`}
            />
          </div>
        ))}

        {trendPoints.length > 1 && (
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden
          >
            <polyline
              points={trendPoints.join(" ")}
              fill="none"
              stroke="#fbbf24"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}
      </div>

      {/* axis labels — mirror the flex layout above */}
      <div className="mt-1 flex gap-1">
        {entries.map((e) => (
          <div
            key={e.season}
            className="flex min-w-[1.25rem] flex-1 flex-col items-center leading-tight"
          >
            <span className="text-[10px] tabular-nums text-zinc-300">
              {e.value}
            </span>
            <span className="text-[10px] tabular-nums text-zinc-500">
              {`'${e.season.slice(-2)}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SeasonBars({
  snapshot,
  leagueHitsMean,
}: {
  snapshot: PlayerSnapshot;
  leagueHitsMean?: Record<string, number>;
}) {
  const games = toEntries(snapshot.games_per_season);
  const hits = toEntries(snapshot.hits_per_season);

  if (games.length === 0 && hits.length === 0) return null;

  return (
    <section className="w-full max-w-5xl">
      <h2 className="mb-3 text-lg font-semibold text-zinc-200">
        Season Charts
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-1 lg:grid-cols-2">
        {games.length > 0 && <BarChart title="Games by season" entries={games} />}
        {hits.length > 0 && (
          <BarChart title="Hits by season" entries={hits} trend={leagueHitsMean} />
        )}
      </div>
    </section>
  );
}
