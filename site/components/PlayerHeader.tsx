
import type { PlayerSnapshot } from "@/lib/players";
import { SnapshotMeta } from "@/components/SnapshotMeta";

export function PlayerHeader({ snapshot }: { snapshot: PlayerSnapshot }) {
  return (
    <header className="flex w-full max-w-3xl flex-col gap-1">
      <h1 className="text-2xl font-bold text-zinc-200">
        {snapshot.player_fullName}
      </h1>
      <p className="text-sm text-zinc-200">
        {snapshot.player_Position} &middot; {snapshot.season_current_team}{" "}
        &middot; Age {snapshot.player_age} 
        <SnapshotMeta snapshot={snapshot} />
      </p>
    </header>
  );
}
