import { getAllPlayers } from "@/lib/players";
import { PlayerCard } from "@/components/PlayerCard";

export default function Home() {
  const players = getAllPlayers().sort(
    (a, b) => a.remaining_hits - b.remaining_hits,
  );

  return (
    <div className="flex min-h-screen w-full flex-col items-center gap-8 bg-green-950 px-4 py-12 sm:px-8">
      <header className="flex w-full max-w-3xl flex-col items-start gap-2">
        <h1 className="font-[family-name:var(--font-tourney)] text-4xl font-bold tracking-wide text-zinc-200">
          Road to 3,000
        </h1>
        <p className="max-w-2xl text-zinc-200">
          Welcome! Hit tracker for active MLB players chasing the 3,000-hit
          milestone. <br/>
          Career pace, recent hot and cold stretches, and more! <br/> 
          Pick a player below to see their full breakdown.
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
