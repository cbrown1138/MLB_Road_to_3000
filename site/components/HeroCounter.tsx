import type { PlayerSnapshot } from "@/lib/players";
import { playerHeroPhoto } from "@/lib/players";
import Image from "next/image";

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
    <section className="relative aspect-[16/9] min-h-[360px] w-full max-w-5xl overflow-hidden rounded-2xl shadow-sm ring-1 ring-zinc-800">
      <Image
        src={playerHeroPhoto(snapshot)}
        alt={snapshot.full_name}
        fill
        sizes="(max-width: 768px) 100vw, 768px"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 p-8">
        <p className="text-xl font-semibold text-zinc-100">
          {snapshot.full_name}
        </p>
        <p className="text-sm text-zinc-200">
          {snapshot.position} &ndash; {snapshot.current_team}
        </p>
        <p className="text-sm text-zinc-200">
          MLB debut {new Date(snapshot.debut_date).getFullYear()} &ndash; Age {snapshot.age}
        </p>
        <p className="mt-2 text-xl font-bold tabular-nums tracking-tight text-red-400">
          {snapshot.remaining_hits.toLocaleString()} HITS REMAINING
        </p>

        <div className="mt-4">
          <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-800/70">
            <div
              className="h-full rounded-full bg-emerald-500 transition-[width]"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-sm text-zinc-200">
            <span>{snapshot.career_hits.toLocaleString()} career hits</span>
            <span>{progressPct.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    </section>
  );
}
