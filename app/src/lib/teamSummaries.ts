// src/lib/teamSummaries.ts
import type {
  Bootstrap,
  LiveEvent,
  LeagueDetails,
  Fixture,
  EntryEvent,
  TeamSummary,
  PlayerRow,
  PlayerStatus,
  PlayerEvent,
} from "@/types/fpl";
import { computeAutoSubs } from "@/lib/autoSub";
import { computeDNPRisk } from "./dnpRisk";

export function buildTeamSummaries(deps: {
  bootstrap: Bootstrap;
  liveEvent: LiveEvent;
  eventId: number;
  league: LeagueDetails;
  fixtures: Fixture[];
  managerLineups: Map<number, EntryEvent>;
}): TeamSummary[] {
  const { bootstrap: bs, liveEvent: live, eventId, league: lg, fixtures, managerLineups } = deps;

  const teamById = new Map(bs.teams.map((t) => [t.id, t]));
  const elementById = new Map(bs.elements.map((e) => [e.id, e]));

  const fixtureForTeam = (teamId: number): Fixture | undefined =>
    fixtures.find(
      (f) => f.event === eventId && (f.team_h === teamId || f.team_a === teamId)
    );

  const statusForFixture = (f?: Fixture): PlayerStatus => {
    if (!f) return "to_play";
    if (f.finished) return "done";
    if (f.started) return "live";
    return "to_play";
  };

  const kickoffLabel = (iso: string): string => {
    const d = new Date(iso);
    const sameDay = d.toDateString() === new Date().toDateString();
    return sameDay
      ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString([], { weekday: "short" });
  };

  const projectPlayer = (
    status: PlayerStatus,
    points: number,
    minute: number | undefined,
    ppg: number,
    multiplier: number
  ): number => {
    if (status === "done") return points;
    if (status === "live") {
      const m = Math.max(minute ?? 0, 1);
      return Math.round((points / m) * 90);
    }
    return Math.round(ppg * multiplier);
  };

  return lg.league_entries.map((entry) => {
    const lineup = managerLineups.get(entry.entry_id);
    const entryName = entry.entry_name;

    if (!lineup) {
      return {
        entryId: entry.entry_id,
        entryName,
        points: 0,
        projected: 0,
        done: 0,
        live: 0,
        toPlay: 0,
        players: { live: [], done: [], toPlay: [] },
      };
    }

    // Phase 1: metadata for every pick (starters + bench)
    const picksWithMeta = lineup.picks
      .filter((p) => p.position <= 15)
      .map((pick) => {
        const el = elementById.get(pick.element);
        if (!el) return null;
        const fixture = fixtureForTeam(el.team);
        const liveEl = live.elements[pick.element];
        const playerMinutes = liveEl?.stats.minutes ?? 0;
        const started = liveEl?.stats.starts === 1;
        const hasPlayed = started || playerMinutes > 0;
        const dnpRisk = computeDNPRisk(
          fixture,
          playerMinutes,
          el.chance_of_playing_this_round ?? null,
          el.element_type === 1
        );
        return { pick, el, fixture, liveEl, playerMinutes, started, hasPlayed, dnpRisk };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    // Phase 2: run auto-sub algorithm
    const projectedOutIds = new Set(
      picksWithMeta
        .filter((m) => m.pick.position <= 11 && (m.dnpRisk === "likely" || m.dnpRisk === "confirmed"))
        .map((m) => m.pick.element)
    );
    const ineligibleBenchIds = new Set(
      picksWithMeta
        .filter((m) => m.pick.position >= 12 && (m.dnpRisk === "likely" || m.dnpRisk === "confirmed"))
        .map((m) => m.pick.element)
    );
    const { incoming, outgoing } = computeAutoSubs(
      lineup.picks,
      projectedOutIds,
      ineligibleBenchIds,
      elementById
    );

    // Phase 3: build rows for starters + projected-in bench
    const rows: PlayerRow[] = picksWithMeta
      .filter((m) => m.pick.position <= 11 || incoming.has(m.pick.element))
      .map(({ pick, el, fixture, liveEl, playerMinutes, started, hasPlayed, dnpRisk }): PlayerRow => {
        const team = teamById.get(el.team);
        const status = statusForFixture(fixture);

        const projectedOut = outgoing.has(pick.element);
        const projectedIn = incoming.has(pick.element);
        const effectiveMultiplier =
          projectedOut ? 0 :
          projectedIn ? 1 :
          (pick.multiplier ?? 1);

        const points = (liveEl?.stats.total_points ?? 0) * effectiveMultiplier;
        const ppg = parseFloat(el.points_per_game ?? "0");
        const isOnBench = status === "live" && !hasPlayed && effectiveMultiplier > 0;
        const didNotPlay = status === "done" && !hasPlayed && effectiveMultiplier > 0;

        const minute =
          status === "live" && hasPlayed ? fixture?.minutes ?? undefined : undefined;

        const replacedById = outgoing.get(pick.element);
        const replacingId = incoming.get(pick.element);
        const replacedByName = replacedById ? elementById.get(replacedById)?.web_name : undefined;
        const replacingName = replacingId ? elementById.get(replacingId)?.web_name : undefined;

        const events: PlayerEvent[] = [];
        const s = liveEl?.stats;
        if (s) {
          if (!started && playerMinutes > 0) {
            events.push({ type: "sub_on", count: 1 });
          }
          if (started && fixture?.finished && playerMinutes < 90 && (s.red_cards ?? 0) === 0) {
            events.push({ type: "sub_off", count: 1 });
          }
          if (s.yellow_cards > 0)     events.push({ type: "yellow",   count: s.yellow_cards });
          if (s.red_cards > 0)        events.push({ type: "red",      count: s.red_cards });
          if (s.own_goals > 0)        events.push({ type: "own_goal", count: s.own_goals });
          if (s.penalties_missed > 0) events.push({ type: "pen_miss", count: s.penalties_missed });
          if (s.penalties_saved > 0)  events.push({ type: "pen_save", count: s.penalties_saved });
          if (s.assists > 0)          events.push({ type: "assist",   count: s.assists });
          if (s.goals_scored > 0)     events.push({ type: "goal",     count: s.goals_scored });
        }

        return {
          id: pick.element,
          webName: el.web_name,
          teamShort: team?.short_name ?? "",
          status,
          points,
          multiplier: effectiveMultiplier,
          minute,
          hasPlayed,
          isOnBench,
          didNotPlay,
          dnpRisk,
          projectedOut,
          projectedIn,
          replacedByName,
          replacingName,
          kickoffTime: status === "to_play" ? fixture?.kickoff_time : undefined,
          kickoffLabel:
            status === "to_play" && fixture?.kickoff_time
              ? kickoffLabel(fixture.kickoff_time)
              : undefined,
          projected: projectPlayer(status, points, minute, ppg, effectiveMultiplier),
          events,
        } satisfies PlayerRow;
      });

    const done = rows
      .filter((r) => r.status === "done")
      .sort((a, b) => b.points - a.points);
    const liveP = rows
      .filter((r) => r.status === "live")
      .sort((a, b) => (b.minute ?? 0) - (a.minute ?? 0));
    const toPlay = rows
      .filter((r) => r.status === "to_play")
      .sort((a, b) => (a.kickoffTime ?? "").localeCompare(b.kickoffTime ?? ""));

    return {
      entryId: entry.entry_id,
      entryName,
      points: rows.reduce((s, r) => s + r.points, 0),
      projected: rows.reduce((s, r) => s + r.projected, 0),
      done: done.length,
      live: liveP.length,
      toPlay: toPlay.length,
      players: { live: liveP, done, toPlay },
    };
  });
}