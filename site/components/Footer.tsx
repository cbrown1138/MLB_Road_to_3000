import { getLastUpdated } from "@/lib/players";

export function Footer() {
  const updated = getLastUpdated();

  return (
    <footer className="mt-auto w-full bg-sky-950 py-6 text-center text-xs text-zinc-400">
      <p>Data last updated {updated}</p>
    </footer>
  );
}
