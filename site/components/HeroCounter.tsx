import type { PlayerSnapshot } from "@/lib/players";
import Image from "next/image";
import { countryFlag, slugify } from "@/lib/players";



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
    <section className="w-full max-w-3xl rounded-2xl bg-sky-800 p-8 shadow-sm ring-1 ring-zinc-800">
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl ring-1 ring-zinc-700">
        <Image
          src={`/${snapshot.player_lastName}2.jpeg`}
          alt={snapshot.player_fullName}
          fill
          sizes="(max-width: 768px) 100vw, 768px"
          className="object-cover"
        />
      </div>
        <div>
          <p className="text-xl font-semibold text-zinc-200">
            {snapshot.player_fullName}
          </p>
          <p className="text-m text-zinc-200">
            {snapshot.player_Position} &ndash; {snapshot.season_current_team}
          </p>
          <p className="text-m text-zinc-200">
             MLB debut {new Date(snapshot.career_mlb_debut).getFullYear()} &ndash; Age {snapshot.player_age}
          </p>
          <p className="text-m text-zinc-200">
            {snapshot.player_birthCity},{" "}
            {snapshot.player_birthCountry} {countryFlag(snapshot.player_birthCountry)}{" "}
          </p>
        <p className="mt-2 text-xl font-bold tabular-nums tracking-tight text-red-400">
        {snapshot.remaining_hits.toLocaleString()} HITS REMAINING
      </p>
        </div>

      <div className="mt-6">
        <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-emerald-500 transition-[width]"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-m text-zinc-200">
          <span>{snapshot.career_hits.toLocaleString()} career hits</span>
          <span>{progressPct.toFixed(1)}%</span>
        </div>
      </div>
    </section>
  );
}
