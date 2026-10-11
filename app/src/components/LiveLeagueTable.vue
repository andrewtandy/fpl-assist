<!-- src/components/LiveLeagueTable.vue -->
<script setup lang="ts">
import { computed } from "vue";
import { useFplStore } from "@/stores/fpl";
import LiveLeagueTeamRow from "./LiveLeagueTeamRow.vue";

const store = useFplStore();

const ranked = computed(() =>
  [...store.teamSummaries]
    .sort((a, b) => b.points - a.points || b.projected - a.projected)
    .map((team, i) => ({ team, rank: i + 1 })),
);
</script>

<template>
  <section class="league">
    <header class="league__header">
      <h2 class="league__title">Live GW League</h2>
      <ul class="league__legend" aria-hidden="true">
        <li><span class="dot dot--done" /> done</li>
        <li><span class="dot dot--live" /> live</li>
        <li><span class="dot dot--todo" /> to play</li>
      </ul>
    </header>

    <div class="league__columns" aria-hidden="true">
      <span class="col col--rank">#</span>
      <span class="col col--name">Team</span>
      <span class="col col--pts">Pts</span>
    </div>

    <ul class="league__list">
      <LiveLeagueTeamRow
        v-for="{ team, rank } in ranked"
        :key="team.entryId"
        :team="team"
        :rank="rank"
      />
    </ul>
  </section>
</template>

<style scoped>
.league { 
  color: var(--text, #e5e7eb);
  /* margin-top: 0.7rem; */
  margin-bottom: 0.7rem;
 }
.league__header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 4px 8px;
}
.league__title { font-size: 14px; font-weight: 600; margin: 0; opacity: 0.75; }
.league__legend {
  display: flex; gap: 12px; list-style: none; margin: 0; padding: 0;
  font-size: 12px; opacity: 0.75;
}
.league__legend li { display: flex; align-items: center; gap: 6px; }
.dot { width: 8px; height: 8px; border-radius: 2px; display: inline-block; }
.dot--done { background: var(--c-done, #22c55e); }
.dot--live { background: var(--c-live, #f59e0b); }
.dot--todo { background: var(--c-todo, #4b5563); }
.league__list {
  list-style: none; margin: 0; padding: 0;
  background: var(--surface, #0b1220);
  border-radius: 12px; overflow: hidden;
}

.league__columns {
  display: grid;
  grid-template-columns: 18px 1fr 60px;
  gap: 12px;
  padding: 6px 12px;
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.5;
  font-weight: 600;
}
.col--rank { text-align: center; }
.col--pts { text-align: right; }
</style>