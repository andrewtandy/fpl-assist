// src/lib/overallStandings.ts
import type {
  LeagueDetails,
  LeagueEntry,
  TeamSummary,
  OverallStanding,
} from "@/types/fpl";

export function buildOverallStandings(deps: {
  league: LeagueDetails;
  teamSummaries: TeamSummary[];
  entriesByLeagueEntry: Map<number, LeagueEntry>;
  isLiveOverlay: boolean;
}): OverallStanding[] {
  const { league: lg, teamSummaries, entriesByLeagueEntry, isLiveOverlay } = deps;

  if (!lg?.standings) return [];

  const liveByEntryId = new Map(teamSummaries.map(t => [t.entryId, t.points]));

  return lg.standings.map(s => {
    const entry = entriesByLeagueEntry.get(s.league_entry);
    const liveGwPoints = isLiveOverlay
      ? (liveByEntryId.get(entry?.entry_id ?? -1) ?? 0)
      : 0;
    const apiEventTotal = s.event_total ?? 0;
    const liveDelta = Math.max(0, liveGwPoints - apiEventTotal);

    return {
      entryId: entry?.entry_id ?? s.league_entry,
      entryName: entry?.entry_name ?? 'Unknown',
      managerName: entry
        ? `${entry.player_first_name} ${entry.player_last_name}`
        : '',
      total: (s.total ?? 0) + liveDelta,
      liveDelta,
      rank: s.rank,
      lastRank: s.last_rank,
    };
  });
}