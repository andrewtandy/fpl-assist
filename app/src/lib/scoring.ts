// src/lib/scoring.ts

export const STAT_LABELS: Record<string, string> = {
  minutes: "Minutes played",
  goals_scored: "Goals scored",
  assists: "Assists",
  clean_sheets: "Clean sheet",
  goals_conceded: "Goals conceded",
  own_goals: "Own goals",
  penalties_saved: "Penalties saved",
  penalties_missed: "Penalties missed",
  yellow_cards: "Yellow card",
  red_cards: "Red card",
  saves: "Saves",
  bonus: "Bonus",
  bps: "BPS",
  starts: "Started",
  defensive_contribution: "Defensive contribution",
  mng_win: "Manager win",
  mng_draw: "Manager draw",
  mng_loss: "Manager loss",
  mng_underdog_win: "Underdog win",
  mng_underdog_draw: "Underdog draw",
  mng_clean_sheets: "Manager clean sheet",
  mng_goals_scored: "Manager goals",
};

export function statLabel(identifier: string): string {
  return STAT_LABELS[identifier]
    ?? identifier.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}