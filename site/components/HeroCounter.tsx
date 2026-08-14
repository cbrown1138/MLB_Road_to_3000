import type { PlayerSnapshot } from "@/lib/players";

export function HeroCounter({
  snapshot,
  milestone,
}: {
  snapshot: PlayerSnapshot;
  milestone: number;
}) {
  const progressPct = Math.min(
    100,
    (snapshot.career_hits / milestone) * 100,
  );

  return (
    <section className="w-full max-w-3xl rounded-2xl bg-zinc-900 p-8 shadow-sm ring-1 ring-zinc-800">
      <p className="text-sm font-medium uppercase tracking-wide text-zinc-400">
        Road to {milestone.toLocaleString()}
      </p>
      <p className="mt-2 text-6xl font-bold tabular-nums tracking-tight text-zinc-50">
        {snapshot.remaining_hits.toLocaleString()}
      </p>
      <p className="mt-1 text-lg text-zinc-400">
        hits remaining
      </p>

      <div className="mt-6">
        <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-emerald-500 transition-[width]"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-sm text-zinc-400">
          <span>{snapshot.career_hits.toLocaleString()} career hits</span>
          <span>{progressPct.toFixed(1)}%</span>
        </div>
      </div>
    </section>
  );
}
