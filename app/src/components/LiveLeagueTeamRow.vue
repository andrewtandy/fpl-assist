<!-- src/components/LeagueTeamRow.vue -->
<script setup lang="ts">
import { useFplStore } from "@/stores/fpl.ts";
import { ref, computed } from "vue";
import type { TeamSummary, PlayerRow, DNPRisk } from "@/types/fpl";
import PlayerEvents from "./PlayerEvents.vue";

const store = useFplStore();

const props = defineProps<{ team: TeamSummary; rank: number }>();

const expanded = ref(false);
const showAllFinished = ref(false);

const total = computed(
  () => props.team.done + props.team.live + props.team.toPlay || 1,
);
const donePct = computed(() => (props.team.done / total.value) * 100);
const livePct = computed(() => (props.team.live / total.value) * 100);

const finishedVisible = computed<PlayerRow[]>(() =>
  showAllFinished.value
    ? props.team.players.done
    : props.team.players.done.slice(0, 2),
);

const finishedHidden = computed(
  () => props.team.players.done.length - finishedVisible.value.length,
);

function dotTitle(risk: DNPRisk, minute?: number): string {
  if (risk === 'confirmed') return 'Did not play';
  if (risk === 'likely')    return minute ? `At ${minute}', still hasn't played` : 'Likely to miss';
  if (risk === 'watch')     return minute ? `At ${minute}', still hasn't played` : 'Doubt over fitness';
  return '';
}

function pointsDisplay(p: PlayerRow): string {
  if (p.projectedOut) return "0";   // auto-subbed out — points don't count
  // Never played: em-dash
  if (!p.hasPlayed) return "–";
  // Played but zero: show the zero
  return String(p.points);
}

</script>

<template>
  <li class="row" :class="{ 'row--open': expanded }">
    <button
      class="row__head"
      :aria-expanded="expanded"
      :aria-controls="`team-${team.entryId}-detail`"
      @click="expanded = !expanded"
    >
      <!-- <span class="row__chev" :class="{ 'row__chev--open': expanded }">›</span> -->
      <span class="row__rank">{{ rank }}</span>

      <span class="row__body">
        <span class="row__name">{{ team.entryName }}</span>
        <span class="row__bar" role="presentation">
          <span class="seg seg--done" :style="{ width: `${donePct}%` }" />
          <span class="seg seg--live" :style="{ width: `${livePct}%` }" />
        </span>
        <span class="row__meta">
          {{ team.done }} done · {{ team.live }} live · {{ team.toPlay }} to play
        </span>
      </span>

      <span class="row__pts">
        <span class="row__pts-now">{{ team.points }}</span>
        <span class="row__pts-proj">proj {{ team.projected }}</span>
      </span>
    </button>

    <button
      class="row__toggle"
      :aria-label="expanded ? 'Collapse' : 'Expand'"
      @click="expanded = !expanded"
    >
      <svg
        class="row__chev"
        :class="{ 'row__chev--open': expanded }"
        width="20"
        height="10"
        viewBox="0 0 20 10"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M2 2 L10 8 L18 2"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>

    <div
      v-show="expanded"
      :id="`team-${team.entryId}-detail`"
      class="row__detail"
    >
      <section v-if="team.players.live.length" class="grp">
        <h3 class="grp__title grp__title--live">
          PLAYING NOW · {{ team.players.live.length }}
        </h3>
        <ul class="grp__list">
          <li v-for="p in team.players.live" :key="p.id"
              class="p"
              :class="{
                'p--muted': p.isOnBench || p.projectedOut,
                'p--projected-in': p.projectedIn
              }"
              role="button"
              tabindex="0"
              @click="store.openPlayerDetail(p.id)"
              @keydown.enter="store.openPlayerDetail(p.id)"
              >
            <span class="p__name">
              <span
                v-if="p.dnpRisk !== 'none'"
                class="p__dot"
                :class="`p__dot--${p.dnpRisk}`"
                :title="dotTitle(p.dnpRisk, p.minute)"
                aria-hidden="true"
              />
              <span class="p__who">{{ p.webName }}</span>
              <span class="p__team">{{ p.teamShort }}</span>
              <span class="p__sep">·</span>
              <span class="p__when">{{ p.isOnBench ? 'bench' : `${p.minute}'` }}</span>
              <span v-if="p.projectedOut" class="p__hint">→ {{ p.replacedByName }}</span>
              <span v-else-if="p.projectedIn" class="p__hint p__hint--in">↑ for {{ p.replacingName }}</span>
            </span>
            <PlayerEvents :events="p.events" />
            <span class="p__pts">{{ pointsDisplay(p) }}</span>
          </li>
        </ul>
      </section>

      <section v-if="team.players.done.length" class="grp">
        <h3 class="grp__title grp__title--done">
          FINISHED · {{ team.players.done.length }}
        </h3>
        <ul class="grp__list">
          <li v-for="p in finishedVisible" :key="p.id"
              class="p"
              :class="{
                'p--muted': p.didNotPlay || p.projectedOut,
                'p--projected-in': p.projectedIn
              }"
              role="button"
              tabindex="0"
              @click="store.openPlayerDetail(p.id)"
              @keydown.enter="store.openPlayerDetail(p.id)"
              >
            <span class="p__name">
              <span
                v-if="p.dnpRisk !== 'none'"
                class="p__dot"
                :class="`p__dot--${p.dnpRisk}`"
                :title="dotTitle(p.dnpRisk, p.minute)"
                aria-hidden="true"
              />
              <span class="p__who">{{ p.webName }}</span>
              <span class="p__team">{{ p.teamShort }}</span>
              <span v-if="p.projectedOut" class="p__hint">→ {{ p.replacedByName }}</span>
              <span v-else-if="p.projectedIn" class="p__hint p__hint--in">↑ for {{ p.replacingName }}</span>
            </span>
            <PlayerEvents :events="p.events" />
            <span class="p__pts">{{ pointsDisplay(p) }}</span>
          </li>
            <li v-if="finishedHidden > 0" class="p p--more">
              <button class="more" @click="showAllFinished = true">
                + {{ finishedHidden }} more
              </button>
          </li>
        </ul>
      </section>

      <section v-if="team.players.toPlay.length" class="grp">
        <h3 class="grp__title grp__title--todo">
          YET TO PLAY · {{ team.players.toPlay.length }}
        </h3>
        <ul class="grp__list">
          <li v-for="p in team.players.toPlay" :key="p.id"
              class="p"
              :class="{ 'p--projected-in': p.projectedIn }"
              role="button"
              tabindex="0"
              @click="store.openPlayerDetail(p.id)"
              @keydown.enter="store.openPlayerDetail(p.id)"
              >
            <span class="p__name">
              <span
                v-if="p.dnpRisk !== 'none'"
                class="p__dot"
                :class="`p__dot--${p.dnpRisk}`"
                :title="dotTitle(p.dnpRisk)"
                aria-hidden="true"
              />
              <span class="p__icon" v-else aria-hidden="true" />
              <span class="p__who">{{ p.webName }}</span>
              <span class="p__team">{{ p.teamShort }}</span>
              <span class="p__sep">·</span>
              <span class="p__when">{{ p.kickoffLabel }}</span>
              <span v-if="p.projectedIn" class="p__hint p__hint--in">↑ for {{ p.replacingName }}</span>
            </span>
            <span class="p__pts p__pts--muted">–</span>
          </li>
        </ul>
      </section>
    </div>
  </li>
</template>

<style scoped>
.row + .row { border-top: 1px solid rgba(255, 255, 255, 0.06); }

.row__head {
  all: unset;
  display: grid;
  grid-template-columns: 18px 1fr auto;   
  gap: 8px;
  align-items: center;
  padding: 8px 12px;
  width: 100%;
  min-height: 44px;
  cursor: pointer;
  box-sizing: border-box;
}

.row__toggle {
  all: unset;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 12px;
  /* background: rgba(255, 255, 255, 0.025); */
  cursor: pointer;
  transition: background 120ms ease;
  box-sizing: border-box;
}
.row__toggle:hover {
  background: rgba(255, 255, 255, 0.06);
}
.row__toggle:focus-visible {
  outline: 2px solid var(--focus, #60a5fa);
  outline-offset: -2px;
}
.row__chev {
  color: rgba(255, 255, 255, 0.4);
  transition: transform 180ms ease, color 120ms ease;
}
.row__toggle:hover .row__chev {
  color: rgba(255, 255, 255, 0.75);
}
.row__chev--open {
  transform: rotate(180deg);
}

.row__head:focus-visible {
  outline: 2px solid var(--focus, #60a5fa);
  outline-offset: -2px;
}

.row__rank { font-size: 13px; opacity: 0.55; text-align: center; }

.row__body { min-width: 0; }
.row__name {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--accent, #60a5fa);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.row__bar {
  display: flex; height: 3px; margin: 4px 0 3px; border-radius: 2px;
  background: var(--c-todo, #4b5563); overflow: hidden;
}
.seg { display: block; height: 100%; }
.seg--done { background: var(--c-done, #22c55e); }
.seg--live { background: var(--c-live, #f59e0b); }
.row__meta { font-size: 11px; opacity: 0.55; }

.row__pts { text-align: right; display: flex; flex-direction: column; gap: 1px; }
.row__pts-now { font-size: 17px; font-weight: 700; line-height: 1; }
.row__pts-proj { font-size: 10px; opacity: 0.5; }

.row__detail { padding: 4px 12px 12px 38px; }

.grp + .grp { margin-top: 12px; }
.grp__title {
  font-size: 11px; letter-spacing: 0.05em; font-weight: 700;
  margin: 0 0 6px;
}
.grp__title--live { color: var(--c-live, #f59e0b); }
.grp__title--done { color: var(--c-done, #22c55e); }
.grp__title--todo { color: rgba(255, 255, 255, 0.5); }

.grp__list { list-style: none; margin: 0; padding: 0; }
.p {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  font-size: 14px;
}

.p:hover { background: rgba(255, 255, 255, 0.03); }
.p--more { cursor: default; }
.p--more:hover { background: none; }

.p__name {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;         /* pushes events + points to the right */
}
.p__who { font-weight: 500; }
.p__team, .p__sep, .p__when { font-size: 12px; opacity: 0.6; }
.p__icon {
  width: 10px; height: 10px; border-radius: 50%;
  border: 1.5px solid rgba(255, 255, 255, 0.35);
  display: inline-block;
}
.p__pts { font-variant-numeric: tabular-nums; font-weight: 600; }
.p__pts--muted { opacity: 0.35; }

.p--muted { opacity: 0.5; }
.p--muted .p__pts { opacity: 0.6; }

.p__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  display: inline-block;
}
.p__dot--watch     { background: var(--c-warn, #f59e0b); opacity: 0.7; }
.p__dot--likely    { background: var(--c-warn, #f59e0b); }
.p__dot--confirmed { background: var(--c-danger, #ef4444); }

.p__hint {
  font-size: 11px;
  opacity: 0.6;
  font-style: italic;
  margin-left: 4px;
  white-space: nowrap;
}
.p__hint--in {
  color: var(--c-done, #22c55e);
  opacity: 0.75;
  font-style: normal;
  font-weight: 500;
}

.p--projected-in {
  border-left: 2px solid var(--c-done, #22c55e);
  padding-left: 6px;
  margin-left: -8px;
}

.more {
  all: unset; cursor: pointer; font-size: 12px; opacity: 0.6;
  padding: 4px 0;
}
.more:hover { opacity: 0.9; }
</style>