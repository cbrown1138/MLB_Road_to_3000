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

// Counting stats over one span of games, all prefixed with the span name,
// e.g. StatLine<"season"> = { season_hits, season_games, ..., season_AB_pace }.
// *_pace fields are hits per game / per PA / per AB.
type StatLine<P extends string> = {
  [K in `${P}_${"hits" | "games" | "PA" | "AB" | "AVG" | "games_pace" | "PA_pace" | "AB_pace"}`]: number;
};

// A 30-game window with the dates it spans (YYYY-MM-DD).
type StreakLine<P extends string> = StatLine<P> & {
  [K in `${P}_${"start_date" | "end_date"}`]: string;
};

export type PlayerSnapshot = {
  today: string;
  season: number;

  player_id: number;
  full_name: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  birth_city: string;
  birth_country: string;
  age: number;
  position: string;
  debut_date: string;
  debut_age: number;
  current_team: string;

  remaining_hits: number;

  // URL segment for /players/[slug]; added by getAllPlayers, not in the JSON.
  slug: string;

  // Keyed by season (year as string).
  games_per_season?: Record<string, number>;
  hits_per_season?: Record<string, number>;
  PA_per_season?: Record<string, number>;
  AB_per_season?: Record<string, number>;
  hits_season_cumulative?: Record<string, number>;
  age_per_season?: Record<string, number>;
} & StatLine<"career">
  & StatLine<"season">
  & StatLine<"last30games">
  & StatLine<"last15games">
  & StatLine<"last120PA">
  & StreakLine<"best30games">
  & StreakLine<"worst30games">;

// "José De La Cruz" -> "jose-de-la-cruz"
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Player photos in public/images/players/, named by MLBAM id:
// <id>.jpeg (portrait, home-page card) and <id>-hero.jpeg (wide, player page).
export function playerPhoto(player: Pick<PlayerSnapshot, "player_id">): string {
  return `/images/players/${player.player_id}.jpeg`;
}

export function playerHeroPhoto(player: Pick<PlayerSnapshot, "player_id">): string {
  return `/images/players/${player.player_id}-hero.jpeg`;
}

// MLB birth_country values -> ISO 3166-1 alpha-2 codes, for flag emoji.
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

// Batting average in the usual ".300" form.
export function formatAvg(avg: number): string {
  return avg.toFixed(3).replace(/^0/, "");
}

// Slugs are the last name ("/players/altuve") unless another tracked player
// shares it, in which case each of them gets the full name instead.
export function getAllPlayers(): PlayerSnapshot[] {
  const players = readGroup<Omit<PlayerSnapshot, "slug">>("tracked");
  const lastNameCounts = new Map<string, number>();
  for (const p of players) {
    const key = slugify(p.last_name);
    lastNameCounts.set(key, (lastNameCounts.get(key) ?? 0) + 1);
  }
  return players
    .map((p) => ({
      ...p,
      slug: slugify(
        lastNameCounts.get(slugify(p.last_name))! > 1 ? p.full_name : p.last_name,
      ),
    }))
    .sort((a, b) => a.last_name.localeCompare(b.last_name));
}

export function getPlayerBySlug(slug: string): PlayerSnapshot | undefined {
  return getAllPlayers().find((p) => p.slug === slug);
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
  age_per_season: Record<string, number>;
};

type RetiredPlayerFile = {
  player_id: number;
  full_name: string;
  last_name: string;
  hits_season_cumulative: Record<string, number>;
  age_per_season: Record<string, number>;
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
        age_per_season: p.age_per_season,
      }))
      .sort((a, b) => a.last_name.localeCompare(b.last_name));
  } catch {
    return [];
  }
}
