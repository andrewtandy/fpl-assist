export interface FplEvent {
  id: number;
  name: string;
  deadline_time: string;
  is_current: boolean;
  is_next: boolean;
  finished: boolean;
}

export interface Element {
  id: number;
  code: number; 
  web_name: string; 
  first_name: string;
  second_name: string;
  team: number; 
  element_type: number 
  points_per_game: string;
  chance_of_playing_this_round: number | null;
  chance_of_playing_next_round: number | null;
}

export interface Bootstrap {
  events: FplEvent[];
  elements: Element[];
  teams: Array<{ id: number; name: string; short_name: string }>;
}

// /api/game — flat status object, no event metadata
export interface Game {
  current_event: number | null;
  current_event_finished: boolean;
  next_event: number | null;
  processing_status: string;
  trades_time_for_approval: boolean;
  waivers_processed: boolean;
}

// /api/event/{id}/fixtures
export interface Fixture {
  id: number;
  code: number;
  event: number;
  kickoff_time: string;
  started: boolean;
  finished: boolean;
  finished_provisional: boolean;
  minutes: number;
  team_h: number;
  team_a: number;
  team_h_score: number | null;
  team_a_score: number | null;
}

export interface LeagueEntry {
  id: number;                    // used in standings.league_entry
  entry_id: number;              // used in /entry/{id}/... URLs
  entry_name: string;
  player_first_name: string;
  player_last_name: string;
  short_name: string;
  joined_time: string;
  waiver_pick: number | null;
}

export interface Standing {
  league_entry: number;          // matches LeagueEntry.id
  rank: number | null;           // null pre-season
  last_rank: number | null;
  rank_sort: number | null;
  total: number | null;
  event_total: number | null;
}

export interface LeagueDetails {
  league: { id: number; name: string };
  league_entries: LeagueEntry[];
  standings: Standing[];
}

export interface ExplainStat {
  stat: string;               // e.g. "goals_scored", "minutes"
  name: string;               // pre-formatted label from FPL
  points: number;
  value: number;
}

// Tuple: [stats, fixture_id]
export type Explain = [ExplainStat[], number];

export interface LiveElement {
  stats: { total_points: number; minutes: number; [k: string]: number };
  explain: Explain[];
}

export interface LiveEvent {
  elements: Record<string, LiveElement>;
}

export interface Pick {
  element: number;
  position: number;
  is_captain: boolean;
  multiplier: number;
}

export interface EntryEvent {
  entry_history: { event: number; points: number; total_points: number };
  picks: Pick[];
}

export interface DraftChoice {
  id: number;
  element: number;              // player id (matches Bootstrap.elements[].id)
  entry: number;                // manager's entry_id (matches LeagueEntry.entry_id)
  entry_name: string;
  player_first_name: string;
  player_last_name: string;
  pick: number;                 // pick number within the round
  round: number;
  index: number;                // overall pick number in the draft
  choice_time: string;
  seconds_to_pick: number;
  was_auto: boolean;
  draft: number;
  league: number;
}

export interface ElementStatus {
  element: number;              // player id
  status: "a" | "o" | string;   // 'a' = available, 'o' = owned
  owner: number | null;         // entry_id of owner, if owned
  in_accepted_trade: boolean;
}

export interface DraftChoices {
  choices: DraftChoice[];
  element_status: ElementStatus[];
  idle: number[];               // entry_ids of managers with no active picks
}

export interface ClassicFixture {
  code: number;
  event: number;
  minutes: number;
  started: boolean;
  finished: boolean;
  finished_provisional: boolean;
  team_h: number;
  team_a: number;
  kickoff_time: string;
}

export type PlayerStatus = 'done' | 'live' | 'to_play'

export interface PlayerRow {
  id: number;
  webName: string;
  teamShort: string;          // "ARS", "LIV", etc.
  status: PlayerStatus;
  points: number;             // already × multiplier
  projected: number;          // final-match projection
  multiplier: number;         // 0=benched-out, 1=starter, 2=captain
  minute?: number;            // status === 'live'
  kickoffTime?: string;       // status === 'to_play' (ISO)
  kickoffLabel?: string;      // "17:30", "Sun", "Mon"
  events: PlayerEvent[];
  hasPlayed: boolean;
  isOnBench: boolean;
  didNotPlay: boolean;
  dnpRisk: DNPRisk;
  projectedOut: boolean;
  projectedIn: boolean;
  replacedByName?: string;
  replacingName?: string;
}

export interface TeamSummary {
  entryId: number
  entryName: string
  points: number
  projected: number
  done: number
  live: number
  toPlay: number
  players: {
    live: PlayerRow[]
    done: PlayerRow[]
    toPlay: PlayerRow[]
  }
}

export type PlayerEventType =
  | "sub_off"
  | "sub_on"
  | "yellow"
  | "red"
  | "own_goal"
  | "pen_miss"
  | "pen_save"
  | "assist"
  | "goal";

export interface PlayerEvent {
  type: PlayerEventType;
  count: number;
}

export type DNPRisk = 'none' | 'watch' | 'likely' | 'confirmed';

export interface OverallStanding {
  entryId: number;
  entryName: string;
  managerName: string;  
  total: number;
  liveDelta: number;
  rank: number | null;
  lastRank: number | null;
}