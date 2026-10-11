// src/lib/autoSub.ts (or inline in the store — your call)

import type { Pick, Element } from "@/types/fpl";

interface AutoSubResult {
  // element id → element id it's replacing
  incoming: Map<number, number>;
  // element id → element id replacing it
  outgoing: Map<number, number>;
}

const MIN = { DEF: 3, MID: 2, FWD: 1 };
const MAX = { DEF: 5, MID: 5, FWD: 3 };

// element_type: 1=GK, 2=DEF, 3=MID, 4=FWD
function isLegalFormation(elementTypes: number[]): boolean {
  if (elementTypes.length !== 11) return false;
  const gk  = elementTypes.filter(t => t === 1).length;
  const def = elementTypes.filter(t => t === 2).length;
  const mid = elementTypes.filter(t => t === 3).length;
  const fwd = elementTypes.filter(t => t === 4).length;
  if (gk !== 1) return false;
  if (def < MIN.DEF || def > MAX.DEF) return false;
  if (mid < MIN.MID || mid > MAX.MID) return false;
  if (fwd < MIN.FWD || fwd > MAX.FWD) return false;
  return true;
}

export function computeAutoSubs(
  picks: Pick[],
  projectedOutIds: Set<number>,       // starter element ids projected to DNP
  ineligibleBenchIds: Set<number>,    // bench element ids also at DNP risk
  elementById: Map<number, Element>
): AutoSubResult {
  const incoming = new Map<number, number>();
  const outgoing = new Map<number, number>();

  // Split picks by their squad position
  const starters = picks.filter(p => p.position <= 11);
  const bench = picks
    .filter(p => p.position >= 12 && p.position <= 15)
    .sort((a, b) => a.position - b.position);   // bench order matters

  // Current effective starter element_types (mutated as we swap)
  const currentStarterIds = starters.map(p => p.element);
  const typeOf = (id: number) => elementById.get(id)?.element_type ?? 0;

  // ── GK first: only the bench GK can cover the starting GK ────
  const startGk = starters.find(p => typeOf(p.element) === 1);
  const benchGk = bench.find(p => typeOf(p.element) === 1);
  if (
    startGk && benchGk &&
    projectedOutIds.has(startGk.element) &&
    !ineligibleBenchIds.has(benchGk.element)
  ) {
    incoming.set(benchGk.element, startGk.element);
    outgoing.set(startGk.element, benchGk.element);
    const idx = currentStarterIds.indexOf(startGk.element);
    currentStarterIds[idx] = benchGk.element;
  }

  // ── Outfield: DNP starters in position order, bench in order ──
  const dnpOutfieldStarters = starters
    .filter(p => typeOf(p.element) !== 1 && projectedOutIds.has(p.element))
    .sort((a, b) => a.position - b.position);

  const usedBenchIds = new Set<number>([...incoming.keys()]);
  const outfieldBench = bench.filter(p => typeOf(p.element) !== 1);

  for (const dnp of dnpOutfieldStarters) {
    for (const benchPick of outfieldBench) {
      if (usedBenchIds.has(benchPick.element)) continue;
      if (ineligibleBenchIds.has(benchPick.element)) continue;

      // Tentative swap
      const tentative = currentStarterIds.map(id =>
        id === dnp.element ? benchPick.element : id
      );
      if (!isLegalFormation(tentative.map(typeOf))) continue;

      // Commit
      incoming.set(benchPick.element, dnp.element);
      outgoing.set(dnp.element, benchPick.element);
      usedBenchIds.add(benchPick.element);
      const idx = currentStarterIds.indexOf(dnp.element);
      currentStarterIds[idx] = benchPick.element;
      break;
    }
    // If no bench player fits, the DNP slot stays empty — this is correct
  }

  return { incoming, outgoing };
}