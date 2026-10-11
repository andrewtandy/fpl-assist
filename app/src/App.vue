<script setup lang="ts">
import { onMounted } from "vue";
import { useFplStore } from "@/stores/fpl";
import FixtureTicker from "@/components/FixtureTicker.vue";
import Header from "./components/Header.vue";
// import LiveLeagueTable from "./components/LiveLeagueTable.vue";
import PlayerDetailSheet from "./components/PlayerDetailSheet.vue";
import LeagueTabs from "./components/LeagueTabs.vue";

const fpl = useFplStore();
onMounted(() => fpl.loadInitial());

console.log("store keys:", Object.keys(fpl));

</script>

<template>
  <Header />
  <div style="padding: 0.7rem;">
    <p v-if="fpl.loading.initial">Loading…</p>
    <p v-else-if="fpl.error" style="color: crimson;">Error: {{ fpl.error }}</p>
    <div v-else>
      <div class="gw-header">
        <span class="gw-header__title">Gameweek {{ fpl.activeEventId }}</span>
        <span v-if="fpl.status == 'live'" class="gw-header__status">
          <span class="live-dot" />Live · {{ fpl.lastUpdated?.toLocaleTimeString() }}
        </span>
      </div>
      <FixtureTicker />
      <!-- <LiveLeagueTable /> -->
      <LeagueTabs />
      <!-- <p>Live: {{ fpl.isLive ? "yes" : "no" }}</p>
      <p>Deadline: {{ fpl.deadline?.toLocaleString() ?? "unknown" }}</p>
      <!-- <p>Last updated: {{ fpl.lastUpdated?.toLocaleTimeString() }}</p> -->
      <!-- <p>Managers in league: {{ fpl.league?.league_entries.length }}</p> --> 
      <!-- <button @click="fpl.refresh()" :disabled="fpl.loading.refreshing">
        {{ fpl.loading.refreshing ? "Refreshing…" : "Refresh" }}
      </button> -->

    </div>
  </div>
  <PlayerDetailSheet />
</template>

<style>
.gw-header {
  display: flex; align-items: baseline; gap: 10px;
  padding: 0 4px 8px;
}
.gw-header__title { font-size: 15px; font-weight: 700; }
.gw-header__status {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12px; opacity: 0.6;
}
.live-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: #4ade80;
}
/* @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&family=Rubik:ital,wght@0,300..900;1,300..900&display=swap'); */
</style>