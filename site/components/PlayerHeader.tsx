import Link from "next/link";
import type { PlayerSnapshot } from "@/lib/players";
import { SnapshotMeta } from "@/components/SnapshotMeta";

export function PlayerHeader({ snapshot }: { snapshot: PlayerSnapshot }) {
  return (
    <header className="flex w-full max-w-3xl flex-col gap-1">
      <Link
        href="/"
        className="text-sm text-zinc-400 hover:text-zinc-200"
      >
        &larr; All players
      </Link>
      <h1 className="text-2xl font-bold text-zinc-50">
        {snapshot.player_fullName}
        {" "}&mdash; Road to 3,000
      </h1>
      <p className="text-sm text-zinc-400">
        {snapshot.player_Position} &middot; {snapshot.season_current_team}{" "}
        &middot; Age {snapshot.player_age} &middot; Career {snapshot.career_avg}{" "}
        avg
      </p>
      <SnapshotMeta snapshot={snapshot} />
    </header>
  );
}
