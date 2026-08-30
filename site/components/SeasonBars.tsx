import type { PlayerSnapshot } from "@/lib/players";

type Entry = { season: string; value: number };

function toEntries(dict: Record<string, number> | undefined): Entry[] {
  if (!dict) return [];
  return Object.entries(dict)
    .map(([season, value]) => ({ season, value }))
    .sort((a, b) => Number(a.season) - Number(b.season));
}

function BarChart({ title, entries }: { title: string; entries: Entry[] }) {
  const max = Math.max(...entries.map((e) => e.value), 1);

  return (
    <div className="rounded-xl bg-emerald-900 p-5 shadow-sm ring-1 ring-zinc-800">
      <p className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-200">
        {title}
      </p>

      {/* plot area — flex columns stretch to full height so % bars resolve */}
      <div className="flex h-44 gap-1">
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

export function SeasonBars({ snapshot }: { snapshot: PlayerSnapshot }) {
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
        {hits.length > 0 && <BarChart title="Hits by season" entries={hits} />}
      </div>
    </section>
  );
}
