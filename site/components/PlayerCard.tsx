import Link from "next/link";
import type { PlayerSnapshot } from "@/lib/players";
import { slugify } from "@/lib/players";

export function PlayerCard({ snapshot }: { snapshot: PlayerSnapshot }) {
  return (
    <Link
      href={`/players/${slugify(snapshot.player_lastName)}`}
      className="flex flex-col gap-3 rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-200 transition-colors hover:ring-zinc-300 dark:bg-zinc-900 dark:ring-zinc-800 dark:hover:ring-zinc-700"
    >
      <div>
        <p className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          {snapshot.player_fullName}
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {snapshot.player_Position} &middot; {snapshot.season_current_team}
        </p>
      </div>
      <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800">
        <p className="text-2xl font-bold tabular-nums text-zinc-950 dark:text-zinc-50">
          {snapshot.remaining_hits.toLocaleString()}
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          hits to 3,000 &middot; {snapshot.career_hits.toLocaleString()} career
          hits
        </p>
      </div>
    </Link>
  );
}
