import Image from "next/image";
import Link from "next/link";
import type { PlayerSnapshot } from "@/lib/players";
import { countryFlag, slugify } from "@/lib/players";

export function PlayerCard({ snapshot }: { snapshot: PlayerSnapshot }) {
  return (
    <Link
      href={`/players/${slugify(snapshot.player_lastName)}`}
      className="flex flex-col gap-3 rounded-xl bg-sky-800 p-5 shadow-sm ring-1 ring-zinc-800 transition-colors hover:ring-zinc-700"
    >
      <div className="flex items-center gap-4">
        <Image
          src={`/${slugify(snapshot.player_lastName)}.jpeg`}
          alt={snapshot.player_fullName}
          width={56}
          height={56}
          className="h-16 w-16 shrink-0 rounded-full object-cover ring-1 ring-zinc-700"
        />
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
        </div>
      </div>
      <div className="border-t border-zinc-800 pt-3 text-center">
        <p className="text-2xl font-bold tabular-nums text-red-400">
          {snapshot.remaining_hits.toLocaleString()} HITS REMAINING
        </p>
        <p className="text-sm text-zinc-200">
          Career {snapshot.career_avg.toLocaleString()} AVG | {snapshot.career_hits.toLocaleString()} Hits | {snapshot.career_gamesPlayed.toLocaleString()} Games
        </p>
      </div>
    </Link>
  );
}
