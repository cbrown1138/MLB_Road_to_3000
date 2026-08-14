import type { PlayerSnapshot } from "@/lib/players";

export function SnapshotMeta({ snapshot }: { snapshot: PlayerSnapshot }) {
  return (
    <p className="text-sm text-zinc-400">
      As of {snapshot.today} &middot; {snapshot.season} season &middot;{" "}
      {snapshot.career_gamesPlayed.toLocaleString()} career games played
    </p>
  );
}
