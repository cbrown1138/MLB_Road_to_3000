import type { PlayerSnapshot } from "@/lib/players";

function StreakCard({
  tone,
  label,
  hits,
  date,
  pace,
  projectedDate,
}: {
  tone: "hot" | "cold";
  label: string;
  hits: number;
  date: string;
  pace: number;
  projectedDate: string;
}) {
  const accent =
    tone === "hot"
      ? "text-orange-600 dark:text-orange-400"
      : "text-sky-600 dark:text-sky-400";

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
      <p className={`text-sm font-medium uppercase tracking-wide ${accent}`}>
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
        {hits} hits
      </p>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        in a 30-game span ending {date} &middot; {pace.toFixed(3)} hits/game
      </p>
      <div className="mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          at that pace, 3,000 arrives around{" "}
          <span className="font-semibold text-zinc-950 dark:text-zinc-50">
            {projectedDate}
          </span>
        </p>
      </div>
    </div>
  );
}

export function HotColdBand({ snapshot }: { snapshot: PlayerSnapshot }) {
  return (
    <section className="w-full max-w-3xl">
      <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        Best &amp; worst 30-game stretches
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StreakCard
          tone="hot"
          label="Hottest stretch"
          hits={snapshot.games_30_hits_max}
          date={snapshot.games_30_hits_max_date}
          pace={snapshot.games_30_hits_max_pace}
          projectedDate={snapshot.games_30_hits_max_pace_remaining_date}
        />
        <StreakCard
          tone="cold"
          label="Coldest stretch"
          hits={snapshot.games_30_hits_min}
          date={snapshot.games_30_hits_min_date}
          pace={snapshot.games_30_hits_min_pace}
          projectedDate={snapshot.games_30_hits_min_pace_remaining_date}
        />
      </div>
    </section>
  );
}
