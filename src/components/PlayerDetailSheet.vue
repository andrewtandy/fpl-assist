<!-- src/components/PlayerDetailSheet.vue -->
<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useFplStore } from "@/stores/fpl";

const store = useFplStore();
const showZeroPoints = ref(false);

// Reset the toggle each time a new player is opened
watch(() => store.selectedPlayerId, () => {
  showZeroPoints.value = false;
});

const player = computed(() => {
  const id = store.selectedPlayerId;
  if (!id || !store.bootstrap) return null;
  return store.bootstrap.elements.find(e => e.id === id) ?? null;
});

const team = computed(() => {
  if (!player.value || !store.bootstrap) return null;
  return store.bootstrap.teams.find(t => t.id === player.value!.team) ?? null;
});

const liveEl = computed(() => {
  const id = store.selectedPlayerId;
  if (!id || !store.liveEvent) return null;
  return store.liveEvent.elements[id] ?? null;
});

const fixture = computed(() => {
  if (!player.value) return null;
  return store.fixturesWithLiveMinutes.find(
    f => f.team_h === player.value!.team || f.team_a === player.value!.team
  ) ?? null;
});

const opponent = computed(() => {
  if (!fixture.value || !player.value || !store.bootstrap) return null;
  const oppId = fixture.value.team_h === player.value.team
    ? fixture.value.team_a
    : fixture.value.team_h;
  return store.bootstrap.teams.find(t => t.id === oppId) ?? null;
});

const isHome = computed(() =>
  fixture.value?.team_h === player.value?.team
);

const scoreLabel = computed(() => {
  const f = fixture.value;
  if (!f || f.team_h_score === null || f.team_a_score === null) return null;
  return isHome.value
    ? `${f.team_h_score}–${f.team_a_score}`
    : `${f.team_a_score}–${f.team_h_score}`;
});

const fixtureStatus = computed(() => {
  const f = fixture.value;
  if (!f) return "";
  if (f.finished) return "FT";
  if (f.started) return `${f.minutes}'`;
  return new Date(f.kickoff_time).toLocaleString([], {
    weekday: "short", hour: "2-digit", minute: "2-digit"
  });
});

const positionLabel = computed(() => {
  const t = player.value?.element_type;
  return t === 1 ? "GK" : t === 2 ? "DEF" : t === 3 ? "MID" : t === 4 ? "FWD" : "";
});

const photoUrl = computed(() => {
  if (!player.value) return "";
  return `https://resources.premierleague.com/premierleague/photos/players/250x250/p${player.value.code}.png`;
});

// Break down the explain stats — separate bonus and BPS for special treatment
const scoringStats = computed(() => {
  if (!liveEl.value) return [];

  // explain is Array<[stats[], fixtureId]> — flatten and aggregate
  const all = liveEl.value.explain.flatMap(([stats]) => stats);

  const merged = new Map<string, { name: string; points: number; value: number }>();
  for (const s of all) {
    const existing = merged.get(s.stat);
    if (existing) {
      existing.points += s.points;
      existing.value += s.value;
    } else {
      merged.set(s.stat, { name: s.name, points: s.points, value: s.value });
    }
  }

  return Array.from(merged.entries()).map(([stat, v]) => ({
    identifier: stat,        // keep 'identifier' as the field name for downstream code
    label: v.name,           // use FPL's pre-formatted name
    points: v.points,
    value: v.value,
  }));
});

const visibleStats = computed(() => {
  const nonBps = scoringStats.value.filter(s => s.identifier !== "bps");
  return showZeroPoints.value
    ? nonBps
    : nonBps.filter(s => s.points !== 0);
});

const bpsStat = computed(() =>
  scoringStats.value.find(s => s.identifier === "bps")
);

const totalPoints = computed(() =>
  liveEl.value?.stats.total_points ?? 0
);

const hasHiddenZeros = computed(() =>
  !showZeroPoints.value &&
  scoringStats.value.filter(s => s.identifier !== "bps" && s.points === 0).length > 0
);

function handlePhotoError(e: Event) {
  (e.target as HTMLImageElement).style.display = "none";
}
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="player" class="sheet-root" @click.self="store.closePlayerDetail()">
        <div class="sheet" role="dialog" aria-modal="true">
          <div class="sheet__handle" />

          <header class="sheet__header">
            <div class="sheet__photo">
              <img
                v-if="player.code"
                :src="photoUrl"
                :alt="`${player.first_name} ${player.second_name}`"
                @error="handlePhotoError"
              />
            </div>
            <div class="sheet__id">
              <div class="sheet__name">
                {{ player.first_name }} {{ player.second_name }}
              </div>
              <div class="sheet__meta">
                {{ team?.short_name }} · {{ positionLabel }}
              </div>
            </div>
            <div class="sheet__pts">
              <div class="sheet__pts-num">{{ totalPoints }}</div>
              <div class="sheet__pts-label">points</div>
            </div>
          </header>

          <section v-if="fixture" class="sheet__fixture">
            <span class="sheet__opp">
              {{ isHome ? "vs" : "at" }} {{ opponent?.short_name }}
            </span>
            <span v-if="scoreLabel" class="sheet__score">{{ scoreLabel }}</span>
            <span class="sheet__status">{{ fixtureStatus }}</span>
          </section>

          <section class="sheet__stats">
            <div v-if="visibleStats.length === 0" class="sheet__empty">
              No points yet this gameweek.
            </div>
            <ul v-else class="stat-list">
              <li v-for="s in visibleStats" :key="s.identifier" class="stat">
                <span class="stat__label">{{ s.label }}</span>
                <span class="stat__value">{{ s.value }}</span>
                <span
                  class="stat__pts"
                  :class="{
                    'stat__pts--pos': s.points > 0,
                    'stat__pts--neg': s.points < 0,
                  }"
                >
                  {{ s.points > 0 ? `+${s.points}` : s.points }}
                </span>
              </li>
            </ul>

            <button
              v-if="hasHiddenZeros"
              class="sheet__toggle"
              @click="showZeroPoints = true"
            >
              Show all stats
            </button>

            <div v-if="bpsStat" class="sheet__bps">
              <span>BPS</span>
              <span>{{ bpsStat.value }}</span>
            </div>
          </section>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sheet-root {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(0, 0, 0, 0.5);
  display: flex; align-items: flex-end;
  backdrop-filter: blur(2px);
}

.sheet {
  width: 100%;
  max-height: 85vh;
  background: var(--bg-elevated, #1a1a1a);
  border-radius: 16px 16px 0 0;
  overflow-y: auto;
  padding: 8px 16px 32px;
  color: #fff;
  display: flex; flex-direction: column; gap: 16px;
}

.sheet__handle {
  width: 40px; height: 4px;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 2px;
  margin: 4px auto 8px;
}

.sheet__header {
  display: grid;
  grid-template-columns: 56px 1fr auto;
  gap: 12px;
  align-items: center;
}
.sheet__photo {
  width: 56px; height: 56px;
  border-radius: 50%;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.06);
  display: flex; align-items: center; justify-content: center;
}
.sheet__photo img { width: 100%; height: auto; }

.sheet__name { font-size: 18px; font-weight: 600; }
.sheet__meta { font-size: 12px; opacity: 0.6; margin-top: 2px; }

.sheet__pts { text-align: right; }
.sheet__pts-num { font-size: 32px; font-weight: 700; line-height: 1; }
.sheet__pts-label { font-size: 10px; opacity: 0.5; text-transform: uppercase; letter-spacing: 0.05em; }

.sheet__fixture {
  display: flex; gap: 8px; align-items: center;
  font-size: 13px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 8px;
}
.sheet__opp { font-weight: 500; }
.sheet__score { font-variant-numeric: tabular-nums; font-weight: 600; }
.sheet__status { margin-left: auto; opacity: 0.6; font-size: 12px; }

.sheet__stats { display: flex; flex-direction: column; gap: 12px; }
.sheet__empty {
  text-align: center;
  padding: 24px;
  opacity: 0.5;
  font-size: 14px;
}

.stat-list { list-style: none; margin: 0; padding: 0; }
.stat {
  display: grid;
  grid-template-columns: 1fr auto 40px;
  gap: 12px;
  align-items: center;
  padding: 8px 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  font-size: 14px;
}
.stat:last-child { border-bottom: none; }
.stat__label { }
.stat__value { opacity: 0.55; font-variant-numeric: tabular-nums; font-size: 13px; }
.stat__pts {
  text-align: right; font-weight: 700; font-variant-numeric: tabular-nums;
}
.stat__pts--pos { color: var(--c-done, #22c55e); }
.stat__pts--neg { color: var(--c-danger, #ef4444); }

.sheet__toggle {
  all: unset; cursor: pointer;
  text-align: center; font-size: 12px; opacity: 0.6;
  padding: 8px;
}
.sheet__toggle:hover { opacity: 0.9; }

.sheet__bps {
  display: flex; justify-content: space-between;
  padding: 10px 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 12px; opacity: 0.6;
  font-variant-numeric: tabular-nums;
}

/* Transitions */
.sheet-enter-active, .sheet-leave-active {
  transition: opacity 200ms ease;
}
.sheet-enter-active .sheet, .sheet-leave-active .sheet {
  transition: transform 220ms cubic-bezier(0.32, 0.72, 0, 1);
}
.sheet-enter-from, .sheet-leave-to { opacity: 0; }
.sheet-enter-from .sheet, .sheet-leave-to .sheet {
  transform: translateY(100%);
}
</style>