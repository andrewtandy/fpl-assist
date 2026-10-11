import { Fixture, DNPRisk } from './../types/fpl';

export function computeDNPRisk(
  fixture: Fixture | undefined,
  playerMinutes: number,
  chanceOfPlaying: number | null,
  isGoalkeeper: boolean
): DNPRisk {
  // Player on pitch = not at risk
  if (playerMinutes > 0) return 'none';
  // Full time with 0 minutes -> confirmed
  if (fixture?.finished) return 'confirmed';
  // No fixture info yet
  if (!fixture) return 'none';

  // Pre match, only trust the pre-GW flag if it's meaningfully low
  if (!fixture.started) {
    if (chanceOfPlaying !== null && chanceOfPlaying <= 25) return 'likely';
    if (chanceOfPlaying !== null && chanceOfPlaying <= 50) return 'watch';
    return 'none';
  }

  // Match is live, player has 0 minutes, risk grows with elapsed time
  const m = fixture.minutes ?? 0;

  // Special behaviour for GKs as they almost never come on as subs - skip 'watch' to avoid false amber
  if (isGoalkeeper) {
    return m >= 75 ? 'likely' : 'none';
  }

  if (m >= 75) return 'likely';
  if (m >= 45) return 'watch';
  return 'none';
}