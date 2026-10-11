import { defineStore } from "pinia";
import { ref, computed, watch } from "vue";
import { fplApi } from "@/lib/api";
import {
  type Bootstrap,
  type Game,
  type LeagueDetails,
  type LeagueEntry,
  type LiveEvent,
  type EntryEvent,
  type DraftChoices,
  type Fixture,
  type ClassicFixture,
  // type TeamSummary,
  // type PlayerRow,
  // type PlayerEvent,
  // type PlayerStatus,
  // type DNPRisk,
  type OverallStanding
  // type Pick,
  // type Element
} from "@/types/fpl";

import { buildTeamSummaries } from "@/lib/teamSummaries";
import { buildOverallStandings } from "@/lib/overallStandings";

const LEAGUE_ID = import.meta.env.VITE_LEAGUE_ID as string;
const POLL_MS = 60_000;


// function computeDNPRisk(
//   fixture: Fixture | undefined,
//   playerMinutes: number,
//   chanceOfPlaying: number | null,
//   isGoalkeeper: boolean
// ): DNPRisk {
//   // Player on pitch = not at risk
//   if (playerMinutes > 0) return 'none';
//   // Full time with 0 minutes -> confirmed
//   if (fixture?.finished) return 'confirmed';
//   // No fixture info yet
//   if (!fixture) return 'none';

//   // Pre match, only trust the pre-GW flag if it's meaningfully low
//   if (!fixture.started) {
//     if (chanceOfPlaying !== null && chanceOfPlaying <= 25) return 'likely';
//     if (chanceOfPlaying !== null && chanceOfPlaying <= 50) return 'watch';
//     return 'none';
//   }

//   // Match is live, player has 0 minutes, risk grows with elapsed time
//   const m = fixture.minutes ?? 0;

//   // Special behaviour for GKs as they almost never come on as subs - skip 'watch' to avoid false amber
//   if (isGoalkeeper) {
//     return m >= 75 ? 'likely' : 'none';
//   }

//   if (m >= 75) return 'likely';
//   if (m >= 45) return 'watch';
//   return 'none';
// }

export const useFplStore = defineStore("fpl", () => {
  // ─── state ────────────────────────────────────────────────
  const bootstrap = ref<Bootstrap | null>(null);
  const game = ref<Game | null>(null);
  const league = ref<LeagueDetails | null>(null);
  const draftChoices = ref<DraftChoices | null>(null);
  const liveEvent = ref<LiveEvent | null>(null);
  const managerLineups = ref<Map<number, EntryEvent>>(new Map());
  const eventFixtures = ref<Fixture[]>([]);

  const loading = ref({ initial: false, refreshing: false });
  const error = ref<string | null>(null);
  const lastUpdated = ref<Date | null>(null);

  const classicFixtures = ref<ClassicFixture[]>([]);

  const selectedPlayerId = ref<number | null>(null);

  function openPlayerDetail(id: number) {
    selectedPlayerId.value = id;
  }

  function closePlayerDetail() {
    selectedPlayerId.value = null;
  }

  let pollHandle: ReturnType<typeof setInterval> | null = null;

  // ─── derived: gameweek ─────────────────────────────────────
  const currentEventId = computed(() => game.value?.current_event ?? null);
  const nextEventId = computed(() => game.value?.next_event ?? null);

  // the gameweek whose fixtures we care about: the live one, or the upcoming one
  const activeEventId = computed(() => currentEventId.value ?? nextEventId.value);

  // deadline for activeEventId, derived from its earliest fixture kickoff
  // (the draft API exposes no event metadata endpoint — see /api/event/{id}/fixtures)
  const deadline = computed(() => {
    if (!eventFixtures.value.length) return null;
    const earliest = eventFixtures.value.reduce<string | null>(
      (min, f) => (!min || f.kickoff_time < min ? f.kickoff_time : min),
      null
    );
    if (!earliest) return null;
    return new Date(new Date(earliest).getTime() - 90 * 60 * 1000);
  });

  const isLive = computed(() => {
    return currentEventId.value !== null && !game.value?.current_event_finished;
  });

  // ─── derived: status state machine ─────────────────────────
  const status = computed<
    "pre_draft" | "pre_season" | "pre_gameweek" | "live" | "finished"
  >(() => {
    if (!league.value?.league_entries?.length) return "pre_draft";
    if (currentEventId.value === null) {
      return deadline.value && new Date() < deadline.value ? "pre_gameweek" : "pre_season";
    }
    if (game.value?.current_event_finished) return "finished";
    return isLive.value ? "live" : "pre_gameweek";
  });

  // ─── derived: league lookups ───────────────────────────────
  // entry_id → LeagueEntry (used to join draft choices to standings)
  const entriesByEntryId = computed(() => {
    const map = new Map<number, LeagueEntry>();
    league.value?.league_entries.forEach((e) => map.set(e.entry_id, e));
    return map;
  });

  // league_entry id → LeagueEntry (used to join standings to entries)
  const entriesByLeagueEntry = computed(() => {
    const map = new Map<number, LeagueEntry>();
    league.value?.league_entries.forEach((e) => map.set(e.id, e));
    return map;
  });

  // entry_id → array of drafted player ids
  const managerSquads = computed(() => {
    const map = new Map<number, number[]>();
    if (!draftChoices.value) return map;
    for (const c of draftChoices.value.choices) {
      if (!map.has(c.entry)) map.set(c.entry, []);
      map.get(c.entry)!.push(c.element);
    }
    return map;
  });

  // player ids currently unowned (free-agent pool for waiver watch)
  const availablePlayerIds = computed(() => {
    return (
      draftChoices.value?.element_status
        .filter((s) => s.status === "a")
        .map((s) => s.element) ?? []
    );
  });

  // draft fixtures with classic's live `minutes` overlaid, keyed by match `code`
  const fixturesWithLiveMinutes = computed<Fixture[]>(() => {
    const classicByCode = new Map(
      classicFixtures.value.map((f) => [f.code, f])
    );
    return eventFixtures.value.map((f) => {
      const c = classicByCode.get(f.code);
      if (!c) return f;
      return {
        ...f,
        minutes: c.minutes ?? f.minutes,
        started: c.started ?? f.started,
        finished: c.finished || c.finished_provisional || f.finished,
      };
    });
  });

  const teamSummaries = computed(() => {
  if (!bootstrap.value || !liveEvent.value || !currentEventId.value || !league.value) return [];
  return buildTeamSummaries({
    bootstrap: bootstrap.value,        // unwrap the ref here
    liveEvent: liveEvent.value,        // unwrap here
    eventId: currentEventId.value,     // unwrap here
    league: league.value,              // unwrap here
    fixtures: fixturesWithLiveMinutes.value,
    managerLineups: managerLineups.value,
  });
});

const overallStandings = computed<OverallStanding[]>(() => {
  if (!league.value) return [];
  return buildOverallStandings({
    league: league.value,
    teamSummaries: teamSummaries.value,
    entriesByLeagueEntry: entriesByLeagueEntry.value,
    isLiveOverlay: status.value === 'live',
  });
});


//   const teamSummaries = computed<TeamSummary[]>(() => {
//     const bs = bootstrap.value;
//     const live = liveEvent.value;
//     const eventId = currentEventId.value;
//     const lg = league.value;
//     const fixtures = fixturesWithLiveMinutes.value;
//     if (!bs || !live || !eventId || !lg) return [];

//     const teamById = new Map(bs.teams.map((t) => [t.id, t]));
//     const elementById = new Map(bs.elements.map((e) => [e.id, e]));

//     const fixtureForTeam = (teamId: number): Fixture | undefined =>
//       fixtures.find(
//         (f) => f.event === eventId && (f.team_h === teamId || f.team_a === teamId)
//       );

//     const statusForFixture = (f?: Fixture): PlayerStatus => {
//       if (!f) return "to_play";
//       if (f.finished) return "done";
//       if (f.started) return "live";
//       return "to_play";
//     };

//     const kickoffLabel = (iso: string): string => {
//       const d = new Date(iso);
//       const sameDay = d.toDateString() === new Date().toDateString();
//       return sameDay
//         ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
//         : d.toLocaleDateString([], { weekday: "short" });
//     };

//     const projectPlayer = (
//       status: PlayerStatus,
//       points: number,
//       minute: number | undefined,
//       ppg: number,
//       multiplier: number
//     ): number => {
//       if (status === "done") return points;
//       if (status === "live") {
//         const m = Math.max(minute ?? 0, 1);
//         return Math.round((points / m) * 90);
//       }
//       return Math.round(ppg * multiplier);
//     };


//     return lg.league_entries.map((entry) => {
//       const lineup = managerLineups.value.get(entry.entry_id);
//       const entryName = entry.entry_name;

//       if (!lineup) {
//         return {
//           entryId: entry.entry_id,
//           entryName,
//           points: 0,
//           projected: 0,
//           done: 0,
//           live: 0,
//           toPlay: 0,
//           players: { live: [], done: [], toPlay: [] }
//         };

    
//       }

// // ── Phase 1: compute metadata for every pick (starters + bench) ──
// const picksWithMeta = lineup.picks
//   .filter((p) => p.position <= 15)
//   .map((pick) => {
//     const el = elementById.get(pick.element);
//     if (!el) return null;
//     const fixture = fixtureForTeam(el.team);
//     const liveEl = live.elements[pick.element];
//     const playerMinutes = liveEl?.stats.minutes ?? 0;
//     const started = liveEl?.stats.starts === 1;
//     const hasPlayed = started || playerMinutes > 0;
//     const dnpRisk = computeDNPRisk(
//       fixture,
//       playerMinutes,
//       el.chance_of_playing_this_round ?? null,
//       el.element_type === 1
//     );
//     return { pick, el, fixture, liveEl, playerMinutes, started, hasPlayed, dnpRisk };
//   })
//   .filter((x): x is NonNullable<typeof x> => x !== null);

// // ── Phase 2: run auto-sub algorithm ──
// const projectedOutIds = new Set(
//   picksWithMeta
//     .filter(m => m.pick.position <= 11 && (m.dnpRisk === 'likely' || m.dnpRisk === 'confirmed'))
//     .map(m => m.pick.element)
// );
// const ineligibleBenchIds = new Set(
//   picksWithMeta
//     .filter(m => m.pick.position >= 12 && (m.dnpRisk === 'likely' || m.dnpRisk === 'confirmed'))
//     .map(m => m.pick.element)
// );
// const { incoming, outgoing } = computeAutoSubs(
//   lineup.picks,
//   projectedOutIds,
//   ineligibleBenchIds,
//   elementById
// );

// // ── Phase 3: build rows for starters + projected-in bench players ──
// const rows: PlayerRow[] = picksWithMeta
//   .filter(m => m.pick.position <= 11 || incoming.has(m.pick.element))
//   .map(({ pick, el, fixture, liveEl, playerMinutes, started, hasPlayed, dnpRisk }): PlayerRow => {
//     const team = teamById.get(el.team);
//     const status = statusForFixture(fixture);

//     const projectedOut = outgoing.has(pick.element);
//     const projectedIn = incoming.has(pick.element);
//     const effectiveMultiplier =
//       projectedOut ? 0 :
//       projectedIn ? 1 :
//       (pick.multiplier ?? 1);

//     const points = (liveEl?.stats.total_points ?? 0) * effectiveMultiplier;
//     const ppg = parseFloat(el.points_per_game ?? "0");
//     const isOnBench = status === "live" && !hasPlayed && effectiveMultiplier > 0;
//     const didNotPlay = status === "done" && !hasPlayed && effectiveMultiplier > 0;

//     const minute =
//       status === "live" && hasPlayed ? fixture?.minutes ?? undefined : undefined;

//     // Replacement linkage — for the inline hints
//     const replacedById = outgoing.get(pick.element);
//     const replacingId = incoming.get(pick.element);
//     const replacedByName = replacedById
//       ? elementById.get(replacedById)?.web_name
//       : undefined;
//     const replacingName = replacingId
//       ? elementById.get(replacingId)?.web_name
//       : undefined;

//     // ── events (unchanged from what you have) ─────────────────
//     const events: PlayerEvent[] = [];
//     const s = liveEl?.stats;
//     if (s) {
//       if (!started && playerMinutes > 0) {
//         events.push({ type: "sub_on", count: 1 });
//       }
//       if (started && fixture?.finished && playerMinutes < 90 && (s.red_cards ?? 0) === 0) {
//         events.push({ type: "sub_off", count: 1 });
//       }
//       if (s.yellow_cards > 0)     events.push({ type: "yellow",   count: s.yellow_cards });
//       if (s.red_cards > 0)        events.push({ type: "red",      count: s.red_cards });
//       if (s.own_goals > 0)        events.push({ type: "own_goal", count: s.own_goals });
//       if (s.penalties_missed > 0) events.push({ type: "pen_miss", count: s.penalties_missed });
//       if (s.penalties_saved > 0)  events.push({ type: "pen_save", count: s.penalties_saved });
//       if (s.assists > 0)          events.push({ type: "assist",   count: s.assists });
//       if (s.goals_scored > 0)     events.push({ type: "goal",     count: s.goals_scored });
//     }

//     return {
//       id: pick.element,
//       webName: el.web_name,
//       teamShort: team?.short_name ?? "",
//       status,
//       points,
//       multiplier: effectiveMultiplier,
//       minute,
//       hasPlayed,
//       isOnBench,
//       didNotPlay,
//       dnpRisk,
//       projectedOut,
//       projectedIn,
//       replacedByName,
//       replacingName,
//       kickoffTime: status === "to_play" ? fixture?.kickoff_time : undefined,
//       kickoffLabel:
//         status === "to_play" && fixture?.kickoff_time
//           ? kickoffLabel(fixture.kickoff_time)
//           : undefined,
//       projected: projectPlayer(status, points, minute, ppg, effectiveMultiplier),
//       events
//     } satisfies PlayerRow;
//   });

//       const done = rows
//         .filter((r) => r.status === "done")
//         .sort((a, b) => b.points - a.points);
//       const liveP = rows
//         .filter((r) => r.status === "live")
//         .sort((a, b) => (b.minute ?? 0) - (a.minute ?? 0));
//       const toPlay = rows
//         .filter((r) => r.status === "to_play")
//         .sort((a, b) => (a.kickoffTime ?? "").localeCompare(b.kickoffTime ?? ""));

//       // const projected = rows.filter(r => r.projectedOut || r.projectedIn);
      
//       // if (projected.length > 0) {
//       //   console.log(`[auto-sub] ${entry.entry_name}:`, projected.map(r => ({
//       //     name: r.webName,
//       //     status: r.status,
//       //     projectedOut: r.projectedOut,
//       //     projectedIn: r.projectedIn,
//       //     replacedByName: r.replacedByName,
//       //     replacingName: r.replacingName,
//       //     points: r.points,
//       //     dnpRisk: r.dnpRisk,
//       //   })));
//       // }

//       return {
//         entryId: entry.entry_id,
//         entryName,
//         points: rows.reduce((s, r) => s + r.points, 0),
//         projected: rows.reduce((s, r) => s + r.projected, 0),
//         done: done.length,
//         live: liveP.length,
//         toPlay: toPlay.length,
//         players: { live: liveP, done, toPlay }
//       };
//     });
// });

  

  // ─── actions ───────────────────────────────────────────────
  
  async function loadInitial() {
    loading.value.initial = true;
    error.value = null;
    try {
      const [b, g, l, d] = await Promise.all([
        fplApi.bootstrap(),
        fplApi.game(),
        fplApi.league(LEAGUE_ID),
        fplApi.draftChoices(LEAGUE_ID)
      ]);
      bootstrap.value = b;
      game.value = g;
      league.value = l;
      draftChoices.value = d;

      if (activeEventId.value) {
        const [draft, classic] = await Promise.all([
          fplApi.eventFixtures(activeEventId.value),
          fplApi.classicFixtures()
        ])
        eventFixtures.value = draft;
        classicFixtures.value = classic;
      }

      if (currentEventId.value) {
        try {
          liveEvent.value = await fplApi.liveEvent(currentEventId.value);
        } catch {
          liveEvent.value = null; // pre-season or GW not started — expected
        }
      }

      if (currentEventId.value && league.value) {
        await fetchAllManagerLineups(currentEventId.value);
      }
      
      lastUpdated.value = new Date();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Unknown error";
    } finally {
      loading.value.initial = false;
    }
  }

  async function refresh() {
    if (!currentEventId.value) return;
    loading.value.refreshing = true;
    try {
      const [g, l, live, fixtures, classic] = await Promise.all([
        fplApi.game(),
        fplApi.league(LEAGUE_ID),
        fplApi.liveEvent(currentEventId.value),
        fplApi.eventFixtures(currentEventId.value),
        fplApi.classicFixtures()
      ]);
      game.value = g;
      league.value = l;
      liveEvent.value = live;
      eventFixtures.value = fixtures;
      classicFixtures.value = classic;

      // refresh any lineups that are currently open in the UI
      const ids = Array.from(managerLineups.value.keys());
      await Promise.all(
        ids.map(async (id) => {
          const lineup = await fplApi.entryEvent(id, currentEventId.value!);
          managerLineups.value.set(id, lineup);
        })
      );
      lastUpdated.value = new Date();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Refresh failed";
    } finally {
      loading.value.refreshing = false;
    }
  }

  async function fetchAllManagerLineups(eventId: number) {
    if (!league.value) return;
    await Promise.all(
      league.value.league_entries.map(async (e) => {
        if (managerLineups.value.has(e.entry_id)) return;
        try {
          const lineup = await fplApi.entryEvent(e.entry_id, eventId);
          managerLineups.value.set(e.entry_id, lineup);
        } catch {
          // 404 pre-GW1 — expected
        }
      })
    );
  }

  async function loadManagerLineup(entryId: number) {
    if (!currentEventId.value || managerLineups.value.has(entryId)) return;
    try {
      const lineup = await fplApi.entryEvent(entryId, currentEventId.value);
      managerLineups.value.set(entryId, lineup);
    } catch {
      // 404 is expected pre-GW1 — silently ignore
    }
  }

  // ─── polling: auto-start/stop with isLive ──────────────────
  watch(isLive, (nowLive) => {
    if (nowLive && !pollHandle) {
      pollHandle = setInterval(refresh, POLL_MS);
    } else if (!nowLive && pollHandle) {
      clearInterval(pollHandle);
      pollHandle = null;
    }
  });

  watch(currentEventId, (id, prev) => {
    if (id && id !== prev) {
      managerLineups.value.clear();
      fetchAllManagerLineups(id);
    }
  })

  function stopPolling() {
    if (pollHandle) clearInterval(pollHandle);
    pollHandle = null;
  }

  return {
    // state
    bootstrap,
    game,
    league,
    draftChoices,
    liveEvent,
    managerLineups,
    eventFixtures,
    loading,
    error,
    lastUpdated,
    // derived
    currentEventId,
    nextEventId,
    activeEventId,
    deadline,
    isLive,
    status,
    entriesByEntryId,
    entriesByLeagueEntry,
    managerSquads,
    availablePlayerIds,
    fixturesWithLiveMinutes,
    // actions
    loadInitial,
    refresh,
    loadManagerLineup,
    stopPolling,
    teamSummaries,
    fetchAllManagerLineups,
    selectedPlayerId,
    openPlayerDetail,
    closePlayerDetail,
    overallStandings
  };
});