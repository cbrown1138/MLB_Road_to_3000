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
    <div className="flex min-h-screen w-full flex-col items-center gap-8 bg-zinc-50 px-4 py-12 dark:bg-zinc-950 sm:px-8">
      <PlayerHeader snapshot={snapshot} />
      <HeroCounter snapshot={snapshot} milestone={milestone} />
      <PaceGrid snapshot={snapshot} />
      <HotColdBand snapshot={snapshot} />
    </div>
  );
}
