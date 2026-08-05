import { getAllPlayers } from "@/lib/players";
import { PlayerCard } from "@/components/PlayerCard";

export default function Home() {
  const players = getAllPlayers();

  return (
    <div className="flex min-h-screen w-full flex-col items-center gap-8 bg-zinc-50 px-4 py-12 dark:bg-zinc-950 sm:px-8">
      <header className="flex w-full max-w-3xl flex-col items-start gap-2">
        <h1 className="text-3xl font-bold text-zinc-950 dark:text-zinc-50">
          Road to 3,000
        </h1>
        <p className="max-w-2xl text-zinc-600 dark:text-zinc-400">
          Welcome! This site tracks active MLB players chasing the 3,000-hit
          milestone &mdash; career pace, recent hot and cold stretches, and
          how many hits and games each player has left. Pick a player below
          to see their full breakdown.
        </p>
      </header>

      <section className="grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
        {players.map((player) => (
          <PlayerCard key={player.player_lastName} snapshot={player} />
        ))}
      </section>
    </div>
  );
}
