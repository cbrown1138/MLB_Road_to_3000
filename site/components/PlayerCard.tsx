import Image from "next/image";
import Link from "next/link";
import type { PlayerSnapshot } from "@/lib/players";
import { countryFlag, slugify } from "@/lib/players";

export function PlayerCard({ snapshot }: { snapshot: PlayerSnapshot }) {
  return (
    <Link
      href={`/players/${slugify(snapshot.player_lastName)}`}
      className="flex flex-col overflow-hidden rounded-xl bg-emerald-900 shadow-sm ring-1 ring-zinc-800 transition-colors hover:ring-zinc-700"
    >
      <div className="relative aspect-[3/4] w-full">
        <Image
          src={`/${slugify(snapshot.player_lastName)}.jpeg`}
          alt={snapshot.player_fullName}
          fill
          sizes="(max-width: 1024px) 50vw, 25vw"
          className="object-cover"
        />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <p className="text-lg font-semibold text-zinc-200">
            {snapshot.player_fullName}
          </p>
          <p className="text-sm text-zinc-200">
            {snapshot.player_Position} | {snapshot.season_current_team}
          </p>
          <p className="text-sm text-zinc-200">
             MLB debut {new Date(snapshot.career_mlb_debut).getFullYear()} | Age {snapshot.player_age}
          </p>
          <p className="text-sm text-zinc-200">
            {snapshot.player_birthCity},{" "}
            {snapshot.player_birthCountry} {countryFlag(snapshot.player_birthCountry)}{" "}
          </p>
        </div>
        <div className="mt-auto border-t border-zinc-800 pt-3 text-center">
          <p className="text-xl font-bold tabular-nums text-red-300">
            {snapshot.remaining_hits.toLocaleString()} HITS REMAINING
          </p>
        </div>
        <div className="mt-auto border-t border-zinc-800 pt-3">
          <p className="text-s text-zinc-200 text-center">
            {snapshot.career_avg.toLocaleString()} AVG | {snapshot.career_hits.toLocaleString()} Hits <br/>
            {snapshot.career_gamesPlayed.toLocaleString()} Games
          </p>
        </div>
      </div>
    </Link>
  );
}
