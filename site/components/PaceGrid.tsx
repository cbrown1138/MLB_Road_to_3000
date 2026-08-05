import type { PlayerSnapshot } from "@/lib/players";

type PaceCardData = {
  label: string;
  hits: number;
  gamesPlayed: number;
  pace: number;
  gamesRemaining?: number;
};

function PaceCard({ data }: { data: PaceCardData }) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
      <p className="text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {data.label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
        {data.pace.toFixed(3)}
      </p>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        hits/game &middot; {data.hits.toLocaleString()} hits over{" "}
        {data.gamesPlayed.toLocaleString()} games
      </p>
      {data.gamesRemaining !== undefined && (
        <div className="mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            <span className="font-semibold text-zinc-950 dark:text-zinc-50">
              {data.gamesRemaining.toLocaleString()}
            </span>{" "}
            games to 3,000
          </p>
        </div>
      )}
    </div>
  );
}

export function PaceGrid({ snapshot }: { snapshot: PlayerSnapshot }) {
  const cards: PaceCardData[] = [
    {
      label: "Career pace",
      hits: snapshot.career_hits,
      gamesPlayed: snapshot.career_gamesPlayed,
      pace: snapshot.career_pace,
      gamesRemaining: snapshot.career_pace_remaining,
    },
    {
      label: `${snapshot.season} season pace`,
      hits: snapshot.season_hits,
      gamesPlayed: snapshot.season_games_played,
      pace: snapshot.season_pace,
      gamesRemaining: snapshot.season_pace_remaining,
    },
    {
      label: "Last 30 games",
      hits: snapshot.games30_hits,
      gamesPlayed: 30,
      pace: snapshot.games30_pace,
      gamesRemaining: snapshot.games30_pace_remaining,
    },
    {
      label: "Last 15 games",
      hits: snapshot.games15_hits,
      gamesPlayed: 15,
      pace: snapshot.games15_pace,
    },
  ];

  return (
    <section className="w-full max-w-3xl">
      <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        Pace comparison
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <PaceCard key={card.label} data={card} />
        ))}
      </div>
      <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
        Games-to-3,000 figures assume the given pace continues; projected
        calendar dates aren&apos;t available until schedule-aware projection
        lands.
      </p>
    </section>
  );
}
