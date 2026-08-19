import type { PlayerSnapshot } from "@/lib/players";

type PaceCardData = {
  label: string;
  hits: number;
  gamesPlayed: number;
  pace: number;
  gamesRemaining?: number;
  careerPace?: number;
};

function PaceCard({ data }: { data: PaceCardData }) {
  const pctOffCareer =
    data.careerPace !== undefined
      ? ((data.pace - data.careerPace) / data.careerPace) * 100
      : undefined;
  const isUp = (pctOffCareer ?? 0) >= 0;
  const borderAccent =
    pctOffCareer === undefined
      ? "border-l-4 border-transparent"
      : isUp
        ? "border-l-4 border-emerald-400"
        : "border-l-4 border-red-300";

  return (
    <div
      className={`rounded-xl bg-emerald-900 p-5 shadow-sm ring-1 ring-zinc-800 ${borderAccent}`}
    >
      <p className="text-sm font-medium uppercase tracking-wide text-zinc-200">
        {data.label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-200">
        {data.pace.toFixed(3)}
      </p>
      <p className="text-sm text-zinc-200">
        {data.hits.toLocaleString()} hits from {" "}
        {data.gamesPlayed.toLocaleString()} games
      </p>
      {pctOffCareer !== undefined && (
        <p
          className={`mt-1 flex items-center gap-1 text-sm font-medium ${
            isUp ? "text-emerald-400" : "text-red-300"
          }`}
        >
          {isUp ? "▲" : "▼"} {Math.abs(pctOffCareer).toFixed(1)}% vs career pace
        </p>
      )}
    </div>
  );
}

export function PaceGrid({ snapshot }: { snapshot: PlayerSnapshot }) {
  const cards: PaceCardData[] = [
    {
      label: "Career pace",
      hits: snapshot.career_hits,
      gamesPlayed: snapshot.career_gamesPlayed,
      pace: snapshot.career_pace,
    },
    {
      label: `current season pace`,
      hits: snapshot.season_hits,
      gamesPlayed: snapshot.season_games_played,
      pace: snapshot.season_pace,
      careerPace: snapshot.career_pace,
    },
    {
      label: "Last 30 games",
      hits: snapshot.games30_hits,
      gamesPlayed: 30,
      pace: snapshot.games30_pace,
      gamesRemaining: snapshot.games30_pace_remaining,
      careerPace: snapshot.career_pace,
    },
    {
      label: "Last 15 games",
      hits: snapshot.games15_hits,
      gamesPlayed: 15,
      pace: snapshot.games15_pace,
      careerPace: snapshot.career_pace,
    },
  ];

  return (
    <section className="w-full max-w-5xl">
      <h2 className="mb-3 text-lg font-semibold text-zinc-200">
        Pace comparison
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <PaceCard key={card.label} data={card} />
        ))}
      </div>
    </section>
  );
}
