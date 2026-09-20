import { readFileSync, readdirSync } from "fs";
import path from "path";

// Player JSON snapshots are produced by ../data_processing/daily/player_active_get_stats.py
// (one file per player, saved or synced into site/data/active) — no copy step.
const DATA_DIR = path.join(process.cwd(), "data", "active");
const FILE_PATTERN = /^stats_(.+)\.json$/;
const MILESTONE = 3000;

// Lives directly under data/, not data/active/ — it's not a per-player file.
const LEAGUE_STATS_PATH = path.join(process.cwd(), "data", "stats_league.json");

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

  season_current_team: string;
  season_hits: number;
  season_games_played: number;
  season_pace: number;
  season_pace_remaining: number;

  games30_hits: number;
  games30_pace: number;
  games30_pace_remaining: number;

  games15_hits: number;
  games15_pace: number;

  games_30_hits_max: number;
  games_30_hits_max_date_end: string;
  games_30_hits_max_date_start: string;
  games_30_hits_max_pace: number;

  games_30_hits_min: number;
  games_30_hits_min_date_end: string;
  games_30_hits_min_date_start: string;
  games_30_hits_min_pace: number;

  // Keyed by season (year as string); produced by player_active_get_stats.py.
  games_per_season?: Record<string, number>;
  hits_per_season?: Record<string, number>;
};

export function slugify(lastName: string): string {
  return lastName.toLowerCase();
}

// MLB player_birthCountry values -> ISO 3166-1 alpha-2 codes, for flag emoji.
const BIRTH_COUNTRY_CODES: Record<string, string> = {
  USA: "US",
  "United States": "US",
  "Dominican Republic": "DO",
  Venezuela: "VE",
  "Puerto Rico": "PR",
  Cuba: "CU",
  Mexico: "MX",
  Panama: "PA",
  Colombia: "CO",
  Curacao: "CW",
  Aruba: "AW",
  Japan: "JP",
  "South Korea": "KR",
  Korea: "KR",
  Taiwan: "TW",
  Canada: "CA",
  Nicaragua: "NI",
  Honduras: "HN",
  Brazil: "BR",
  Bahamas: "BS",
  Jamaica: "JM",
  Australia: "AU",
  Netherlands: "NL",
  Germany: "DE",
};

export function countryFlag(country: string): string {
  const code = BIRTH_COUNTRY_CODES[country];
  if (!code) return "";
  return [...code].map((c) => String.fromCodePoint(127397 + c.charCodeAt(0))).join("");
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

export function getLastUpdated(): string {
  const players = getAllPlayers();
  return players[0]?.today ?? "";
}

// League-wide hits per season for qualified hitters, produced by
// ../data_processing/daily/league_active_get_stats.py. Keyed by season (year as string).
export function getLeagueHitsMeanBySeason(): Record<string, number> {
  try {
    const raw = readFileSync(LEAGUE_STATS_PATH, "utf-8");
    const parsed = JSON.parse(raw) as {
      all_qualified_hitters_mean_season?: { Season: number; Hits_Mean: number }[];
    };
    const rows = parsed.all_qualified_hitters_mean_season ?? [];
    return Object.fromEntries(rows.map((r) => [String(r.Season), r.Hits_Mean]));
  } catch {
    return {};
  }
}

// League-wide max hits per season among qualified hitters, produced by
// ../data_processing/daily/league_active_get_stats.py. Keyed by season (year as string).
export function getLeagueHitsMaxBySeason(): Record<string, number> {
  try {
    const raw = readFileSync(LEAGUE_STATS_PATH, "utf-8");
    const parsed = JSON.parse(raw) as {
      all_qualified_hitters_max_season?: { Season: number; Hits_Max: number }[];
    };
    const rows = parsed.all_qualified_hitters_max_season ?? [];
    return Object.fromEntries(rows.map((r) => [String(r.Season), r.Hits_Max]));
  } catch {
    return {};
  }
}
