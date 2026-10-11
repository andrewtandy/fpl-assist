<!-- src/components/TotalLeagueTable.vue -->
<script setup lang="ts">
import { computed } from "vue";
import { useFplStore } from "@/stores/fpl";
import TotalLeagueTeamRow from "./TotalLeagueTeamRow.vue";

const store = useFplStore();

const ranked = computed(() =>
  [...store.overallStandings]
    .sort((a, b) => b.total - a.total)  // total already includes liveDelta
    .map((team, i) => ({ team, rank: i + 1 })),
);

</script>

<template>
  <section class="league">
    <header class="league__header">
      <h2 class="league__title">Season Standings</h2>
    </header>

    <div class="league__columns" aria-hidden="true">
    <span class="col col--rank">#</span>
    <span class="col col--name">Team</span>
    <span class="col col--pts">Pts</span>
    </div>

    <ul class="league__list">
      <TotalLeagueTeamRow
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
  margin-bottom: 0.7rem;
}
.league__header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 4px 8px;
}
.league__title { font-size: 14px; font-weight: 600; margin: 0; opacity: 0.75; }

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
.col--stat, .col--pts { text-align: right; }

.league__list {
  list-style: none; margin: 0; padding: 0;
  background: var(--surface, #0b1220);
  border-radius: 12px; overflow: hidden;
}
</style>