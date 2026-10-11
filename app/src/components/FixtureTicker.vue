<script setup lang="ts">
import { computed, ref, onMounted, watch, nextTick } from "vue";
import { useFplStore } from "@/stores/fpl";

const fpl = useFplStore();
const tickerEl = ref<HTMLElement | null>(null);

const teamShortNames = computed(() => {
  const map = new Map<number, string>();
  fpl.bootstrap?.teams.forEach((t) => map.set(t.id, t.short_name));
  return map;
});

function teamShort(id: number): string {
  return teamShortNames.value.get(id) ?? "—";
}

function isLive(finished: boolean, finishedProvisional: boolean, started: boolean): boolean {
  return started && !finished && !finishedProvisional;
}

function statusLabel(f: {
  started: boolean;
  finished: boolean;
  finished_provisional: boolean;
  minutes: number;
  kickoff_time: string;
}): string {
  if (f.finished || f.finished_provisional) return "FT";
  if (f.started) return `${f.minutes}'`;
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(f.kickoff_time));
}

// Index of the first fixture from today or later (yesterday's games scroll off to the left)
const targetIndex = computed(() => {
  const fixtures = fpl.fixturesWithLiveMinutes;
  if (!fixtures.length) return 0;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const idx = fixtures.findIndex(
    (f) => new Date(f.kickoff_time).getTime() >= startOfToday.getTime()
  );
  return idx === -1 ? 0 : idx;
});

function scrollToTarget() {
  const container = tickerEl.value;
  if (!container) return;
  const target = container.children[targetIndex.value] as HTMLElement | undefined;
  if (!target) return;
  const targetRect = target.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  container.scrollLeft += targetRect.left - containerRect.left;
}

onMounted(async () => {
  await nextTick();
  scrollToTarget();
});

// Fixtures often arrive after mount (loadInitial is async) — re-align when they land
watch(() => fpl.fixturesWithLiveMinutes.length, async () => {
  await nextTick();
  scrollToTarget();
});
</script>

<template>
  <div class="ticker" ref="tickerEl" v-if="fpl.fixturesWithLiveMinutes.length">
    <div
      v-for="f in fpl.fixturesWithLiveMinutes"
      :key="f.id"
      class="fixture"
      :class="{ 'is-live': isLive(f.finished, f.finished_provisional, f.started) }"
    >
      <div class="row">
        <span class="team">{{ teamShort(f.team_h) }}</span>
        <span class="score">{{ f.started ? f.team_h_score : "-" }}</span>
        <span class="score">{{ f.started ? f.team_a_score : "-" }}</span>
        <span class="team">{{ teamShort(f.team_a) }}</span>
      </div>
      <div class="meta">
        <span v-if="isLive(f.finished, f.finished_provisional, f.started)" class="live-dot" />
        {{ statusLabel(f) }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.ticker {
  --ticker-card-bg: #1a1a1a;
  --ticker-card-border: #2e2e2e;
  --ticker-text: rgba(255, 255, 255, 0.87);
  --ticker-text-muted: #8a8a8a;
  --ticker-live: #4ade80;

  display: flex;
  flex-wrap: nowrap;
  gap: 0.4rem;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 8px 2px 8px;
  scroll-snap-type: x proximity;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
  margin-bottom: 1rem;
}
.ticker::-webkit-scrollbar { height: 4px; }
.ticker::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 2px;
}
.ticker::-webkit-scrollbar-track { background: transparent; }

.fixture {
  flex: 0 0 auto;
  scroll-snap-align: start;
  width: 6.5rem;
  padding: 0 1rem;
  border: 1px solid var(--ticker-card-border);
  border-radius: 8px;
  background: var(--ticker-card-bg);
  font-family: system-ui, -apple-system, sans-serif;
}

.fixture.is-live { border-color: var(--ticker-live); }

.row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 2px 0;
}

.team {
  font-size: 13px;
  font-weight: 600;
  color: var(--ticker-text);
}

.score {
  font-size: 13px;
  font-weight: 600;
  color: var(--ticker-text);
  min-width: 14px;
  text-align: center;
}

.meta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  font-size: 11px;
  color: var(--ticker-text-muted);
}

.live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ticker-live);
}
</style>