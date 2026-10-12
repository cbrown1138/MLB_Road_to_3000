import Image from "next/image";
import Link from "next/link";
import type { PlayerSnapshot } from "@/lib/players";
import { countryFlag, formatAvg, playerPhoto } from "@/lib/players";

export function PlayerCard({ snapshot }: { snapshot: PlayerSnapshot }) {
  return (
    <Link
      href={`/players/${snapshot.slug}`}
      className="flex flex-col overflow-hidden rounded-xl bg-emerald-900 shadow-sm ring-1 ring-zinc-800 transition-colors hover:ring-zinc-700"
    >
      <div className="relative aspect-[3/4] w-full">
        <Image
          src={playerPhoto(snapshot)}
          alt={snapshot.full_name}
          fill
          sizes="(max-width: 1024px) 50vw, 25vw"
          className="object-cover"
        />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <p className="text-lg font-semibold text-zinc-200">
            {snapshot.full_name}
          </p>
          <p className="text-sm text-zinc-200">
            {snapshot.position} | {snapshot.current_team}
          </p>
          <p className="text-sm text-zinc-200">
             MLB debut {new Date(snapshot.debut_date).getFullYear()} | Age {snapshot.age}
          </p>
          <p className="text-sm text-zinc-200">
            {snapshot.birth_city},{" "}
            {snapshot.birth_country} {countryFlag(snapshot.birth_country)}{" "}
          </p>
        </div>
        <div className="mt-auto border-t border-zinc-800 pt-3 text-center">
          <p className="text-xl font-bold tabular-nums text-red-300">
            {snapshot.remaining_hits.toLocaleString()} HITS REMAINING
          </p>
        </div>
        <div className="mt-auto border-t border-zinc-800 pt-3">
          <p className="text-s text-zinc-200 text-center">
            {formatAvg(snapshot.career_AVG)} AVG | {snapshot.career_hits.toLocaleString()} Hits <br/>
            {snapshot.career_games.toLocaleString()} Games
          </p>
        </div>
      </div>
    </Link>
  );
}
