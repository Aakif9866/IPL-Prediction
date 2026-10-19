/** Typed access to the model outputs exported by ../export_web_data.py (never hand-edited). */
import championJson from "@/data/champion.json";
import battersJson from "@/data/batters.json";
import type { PosteriorPoint } from "./tournament";
import type { ConformalBand } from "./batter";

export type Team = {
  code: string;
  name: string;
  color: string;
  p_playoffs: number;
  p_final: number;
  p_champion: number;
  exp_points: number;
  elo_end: number;
  start_2027: number;
  tau_sensitivity: Record<string, number>;
  elo_history: { season: number; elo: number }[];
  titles: number[];
  finals: number[];
  playoffs: number[];
  seasons: number[];
  record_2025: Record2;
  record_2026: Record2;
};
type Record2 = { played: number; won: number; no_result: number };
type Row = Record<string, string | number>;

export type ChampionData = {
  meta: { data_cutoff: string; n_sims: number; elo: { k: number; carry: number; home: number }; base: number; format: string };
  teams: Team[];
  posterior: PosteriorPoint[];
  match_backtest: Row[];
  bootstrap: Row[];
  pre_tournament: Row[];
  tournament_backtest: {
    season: number; n_teams: number; champion: string; p_champion: number; rank_of_champion: number;
    favourite: string; p_favourite: number; playoff_brier: number; playoff_brier_uniform: number;
  }[];
  eras: { period: string; seasons: number; model_log_p: number; uniform_log_p: number; beats_uniform: number; playoff_brier: number; playoff_brier_uniform: number }[];
  profile: {
    date_range: [string, string]; result_counts: Record<string, number>; team1_bats_first: number; toss_winner_wins: number;
    home_team_win_rate: number; home_matches: number; season_2026_matches: number; win_by_runs_consistent_with_balls: number;
    matches: number; deliveries: number;
  };
};

export type SeasonLine = { season: number; runs: number; innings: number; balls: number; outs: number; fifties: number; team: string };
export type Split = { runs: number; balls: number; outs: number };
export type Batter = {
  slug: string; name: string; dataset_name: string; player_id: number; rank: number;
  team_2026: string; team_color: string; role: string; batting_position_w: number;
  expected_runs: number; lower_80: number; upper_80: number; expected_innings: number; expected_rpi: number;
  expected_average: number; expected_sr: number; confidence: "High" | "Medium" | "Low";
  scenarios: { full: number; strong: number; weak: number; reduced: number };
  share: number[];
  history: SeasonLine[];
  splits: Record<"pace" | "spin" | "powerplay" | "middle" | "death", Split>;
  recent_innings: number[];
  analysis: Record<string, string>;
};
export type BattersData = {
  meta: {
    target: number; team_matches_2027: number; form_ratio_p10_p90: [number, number];
    conformal: { offset: number; coverage: number; bands: ConformalBand[] }; partial_season: number; partial_season_matches: number;
  };
  players: Batter[];
  backtest: Row[];
  bootstrap: Row[];
  components: Row[];
  intervals: Row[];
  intervals_by_season: Row[];
};

export const champion = championJson as unknown as ChampionData;
export const batters = battersJson as unknown as BattersData;

export const teamsByChance = [...champion.teams].sort((a, b) => b.p_champion - a.p_champion);
export const teamByCode = (code: string) => champion.teams.find((t) => t.code === code);
export const playersByRuns = [...batters.players].sort((a, b) => b.expected_runs - a.expected_runs);
export const playerBySlug = (slug: string) => batters.players.find((p) => p.slug === slug);

/** Inputs for the TypeScript simulator, in a fixed team order (alphabetical, as in the Python pipeline). */
export const simTeams = [...champion.teams].sort((a, b) => a.code.localeCompare(b.code));
