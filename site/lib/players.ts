import { readFileSync } from "fs";
import path from "path";

// All data is produced by ../data_processing (see its README section) and
// saved or synced into site/data/ — no copy step:
//   data/players/index.json        group -> [{id, name}], from data_processing/players.py
//   data/players/<id>.json         one file per player, by MLBAM id
//   data/league/hits_by_season.json
const DATA_DIR = path.join(process.cwd(), "data");
const PLAYERS_DIR = path.join(DATA_DIR, "players");
const PLAYER_INDEX_PATH = path.join(PLAYERS_DIR, "index.json");
const LEAGUE_HITS_PATH = path.join(DATA_DIR, "league", "hits_by_season.json");
const MILESTONE = 3000;

type PlayerGroup = "tracked" | "retired_3000" | "retired_2000";
type PlayerIndex = Partial<Record<PlayerGroup, { id: number; name: string }[]>>;

function readPlayerIndex(): PlayerIndex {
  return JSON.parse(readFileSync(PLAYER_INDEX_PATH, "utf-8")) as PlayerIndex;
}

// Parsed player files for a group, skipping IDs whose file hasn't been fetched yet.
function readGroup<T>(group: PlayerGroup): T[] {
  return (readPlayerIndex()[group] ?? []).flatMap(({ id }) => {
    try {
      return [JSON.parse(readFileSync(path.join(PLAYERS_DIR, `${id}.json`), "utf-8")) as T];
    } catch {
      return [];
    }
  });
}

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

  // Keyed by season (year as string); produced by fetch/player_active.py.
  games_per_season?: Record<string, number>;
  hits_per_season?: Record<string, number>;
  hits_season_cumulative?: Record<string, number>;
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
  return readGroup<PlayerSnapshot>("tracked")
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
// ../data_processing/jobs/daily.py and jobs/backfill_league.py. Keyed by season (year as string).
export function getLeagueHitsMeanBySeason(): Record<string, number> {
  try {
    const raw = readFileSync(LEAGUE_HITS_PATH, "utf-8");
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
// ../data_processing/jobs/daily.py and jobs/backfill_league.py. Keyed by season (year as string).
export function getLeagueHitsMaxBySeason(): Record<string, number> {
  try {
    const raw = readFileSync(LEAGUE_HITS_PATH, "utf-8");
    const parsed = JSON.parse(raw) as {
      all_qualified_hitters_max_season?: { Season: number; Hits_Max: number }[];
    };
    const rows = parsed.all_qualified_hitters_max_season ?? [];
    return Object.fromEntries(rows.map((r) => [String(r.Season), r.Hits_Max]));
  } catch {
    return {};
  }
}

// Retired 3,000-hit club members, produced by
// ../data_processing/jobs/backfill_retired.py.
export type ClubCumulative = {
  // MLBAM player id as a string, e.g. "110987" (Craig Biggio).
  key: string;
  full_name: string;
  last_name: string;
  hits_season_cumulative: Record<string, number>;
};

type RetiredPlayerFile = {
  player_id: number;
  full_name: string;
  last_name: string;
  hits_season_cumulative: Record<string, number>;
};

// Career cumulative hits by season for every club member, sorted by last name.
export function getAllClubCumulative(): ClubCumulative[] {
  try {
    return readGroup<RetiredPlayerFile>("retired_3000")
      .map((p) => ({
        key: String(p.player_id),
        full_name: p.full_name,
        last_name: p.last_name,
        hits_season_cumulative: p.hits_season_cumulative,
      }))
      .sort((a, b) => a.last_name.localeCompare(b.last_name));
  } catch {
    return [];
  }
}
