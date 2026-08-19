import { getAllPlayers } from "@/lib/players";
import { PlayerCard } from "@/components/PlayerCard";

export default function Home() {
  const players = getAllPlayers().sort(
    (a, b) => a.remaining_hits - b.remaining_hits,
  );

  return (
    <div className="flex min-h-screen w-full flex-col items-center gap-8 bg-sky-950 px-4 py-12 sm:px-8">
      <header className="flex w-full max-w-6xl flex-col items-center gap-2">
        <h1 className="font-[family-name:var(--font-tourney)] text-7xl font-bold tracking-wide text-zinc-200">
          Road to 3,000
        </h1>
        <br/>
        <p className="max-w-2xl text-zinc-200 text-center">
          Only 33 batters in Major League Baseball have achived 3,000 career hits.
          A unique combination of skill, consistency and longevity make this one of sports toughest milestones.          
        </p>
        <p className="max-w-2xl text-zinc-200 text-center">
          Follow the few who have a chance to reach this milestone in the upcoming seasons. 
          Watch their career pace, recent hot and cold stretches, and more! <br/>
        </p>
      </header>

      <section className="grid w-full max-w-4xl grid-cols-[repeat(auto-fill,200px)] justify-center gap-8">
        {players.map((player) => (
          <PlayerCard key={player.player_lastName} snapshot={player} />
        ))}
      </section>
    </div>
  );
}
