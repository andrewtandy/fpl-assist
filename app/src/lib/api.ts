import type {
  Bootstrap, Game, LeagueDetails, LiveEvent, EntryEvent,
  Fixture, DraftChoices, ClassicFixture
} from "@/types/fpl";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`/api/${path}`);
  if (!res.ok) throw new Error(`FPL /${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export const fplApi = {
  bootstrap: () => get<Bootstrap>("bootstrap-static"),
  game: () => get<Game>("game"),
  league: (id: string) => get<LeagueDetails>(`league/${id}/details`),
  liveEvent: (eventId: number) => get<LiveEvent>(`event/${eventId}/live`),
  eventFixtures: (eventId: number) => get<Fixture[]>(`event/${eventId}/fixtures`),
  classicFixtures: () => get<ClassicFixture[]>(`classic/fixtures`),
  entryEvent: (entryId: number, eventId: number) =>
    get<EntryEvent>(`entry/${entryId}/event/${eventId}`),
  draftChoices: (leagueId: string) => get<DraftChoices>(`draft/${leagueId}/choices`)
};