import type { PlayerSnapshot } from "@/lib/players";

function StreakCard({
  tone,
  label,
  hits,
  date,
  pace,
}: {
  tone: "hot" | "cold";
  label: string;
  hits: number;
  date: string;
  pace: number;
}) {
  const accent = tone === "hot" ? "text-emerald-400" : "text-red-300";
  const borderAccent =
    tone === "hot" ? "border-emerald-400" : "border-red-300";
  const [year, month, day] = date.split("-");
  const formattedDate = `${month}/${day}/${year}`;

  return (
    <div
      className={`rounded-xl border-l-4 bg-emerald-900 p-5 shadow-sm ring-1 ring-zinc-800 ${borderAccent}`}
    >
      <p className={`text-sm font-medium uppercase tracking-wide ${accent}`}>
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-200">
        {hits} hits
      </p>
      <p className="text-sm text-zinc-200">
        {formattedDate}
      </p>
    </div>
  );
}

export function HotColdBand({ snapshot }: { snapshot: PlayerSnapshot }) {
  return (
    <section className="w-full max-w-5xl">
      <h2 className="mb-3 text-lg font-semibold text-zinc-200">
        Best &amp; worst 30-game stretches
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StreakCard
          tone="hot"
          label="Hottest stretch"
          hits={snapshot.games_30_hits_max}
          date={snapshot.games_30_hits_max_date}
          pace={snapshot.games_30_hits_max_pace}
        />
        <StreakCard
          tone="cold"
          label="Coldest stretch"
          hits={snapshot.games_30_hits_min}
          date={snapshot.games_30_hits_min_date}
          pace={snapshot.games_30_hits_min_pace}
        />
      </div>
    </section>
  );
}
