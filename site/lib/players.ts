import { readFileSync, readdirSync } from "fs";
import path from "path";

// Player JSON snapshots are produced by ../get_player_stats.py (one file
// per player, at the repo root) and read directly from there — no copy step.
const DATA_DIR = path.join(process.cwd(), "..");
const FILE_PATTERN = /^latest_stats_(.+)\.json$/;
const MILESTONE = 3000;

export type PlayerSnapshot = {
  today: string;
  season: number;

  player_lastName: string;
  player_fullName: string;
  player_age: number;
  player_birthDate: string;
  player_birthCity: string;
  player_birthCountry: string;
  player_Position: string;

  remaining_hits: number;

  career_mlb_debut: string;
  career_gamesPlayed: number;
  career_atBats: number;
  career_hits: number;
  career_avg: string;
  career_pace: number;
  career_pace_remaining: number;
  career_pace_remaining_date: string;

  season_current_team: string;
  season_hits: number;
  season_games_played: number;
  season_pace: number;
  season_pace_remaining: number;
  season_pace_remaining_date: string;

  games30_hits: number;
  games30_pace: number;
  games30_pace_remaining: number;
  games30_pace_remaining_date: string;

  games15_hits: number;
  games15_pace: number;
  games15_pace_remaining: number;
  games15_pace_remaining_date: string;

  games_30_hits_max: number;
  games_30_hits_max_date: string;
  games_30_hits_max_pace: number;
  games_30_hits_max_pace_remaining_date: string;

  games_30_hits_min: number;
  games_30_hits_min_date: string;
  games_30_hits_min_pace: number;
  games_30_hits_min_pace_remaining_date: string;
};

export function slugify(lastName: string): string {
  return lastName.toLowerCase();
}

export function getAllPlayers(): PlayerSnapshot[] {
  const files = readdirSync(DATA_DIR).filter((f) => FILE_PATTERN.test(f));
  return files
    .map(
      (f) =>
        JSON.parse(readFileSync(path.join(DATA_DIR, f), "utf-8")) as PlayerSnapshot,
    )
    .sort((a, b) => a.player_lastName.localeCompare(b.player_lastName));
}

export function getPlayerBySlug(slug: string): PlayerSnapshot | undefined {
  return getAllPlayers().find((p) => slugify(p.player_lastName) === slug);
}

export function getMilestone(): number {
  return MILESTONE;
}
