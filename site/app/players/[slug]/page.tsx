import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllPlayers, getPlayerBySlug, getMilestone, slugify } from "@/lib/players";
import { PlayerHeader } from "@/components/PlayerHeader";
import { HeroCounter } from "@/components/HeroCounter";
import { PaceGrid } from "@/components/PaceGrid";
import { HotColdBand } from "@/components/HotColdBand";

export function generateStaticParams() {
  return getAllPlayers().map((player) => ({
    slug: slugify(player.player_lastName),
  }));
}

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const snapshot = getPlayerBySlug(slug);

  if (!snapshot) {
    notFound();
  }

  const milestone = getMilestone();

  return (
    <div className="flex min-h-screen w-full flex-col items-center gap-8 bg-sky-950 px-4 py-12 sm:px-8">
      <header className="flex w-full max-w-5xl items-center gap-4">
        <Link
          href="/"
          className="text-sm text-zinc-400 hover:text-zinc-200"
        > &larr; All players
        </Link>
        <h1 className="font-[family-name:var(--font-tourney)] text-2xl font-bold tracking-wide text-zinc-200">
          Road to 3,000
        </h1>
      </header>
      <HeroCounter snapshot={snapshot} milestone={milestone} />
      <PaceGrid snapshot={snapshot} />
      <HotColdBand snapshot={snapshot} />
    </div>
  );
}
