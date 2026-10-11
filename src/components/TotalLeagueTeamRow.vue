<!-- src/components/TotalLeagueTeamRow.vue -->
<script setup lang="ts">
import type { OverallStanding } from "@/types/fpl";

defineProps<{ team: OverallStanding; rank: number }>();
</script>

<template>
  <li class="row">
    <div class="row__head">
      <span class="row__rank">{{ rank }}</span>

      <span class="row__body">
        <span class="row__name">{{ team.entryName }}</span>
        <span class="row__manager">{{ team.managerName }}</span>
      </span>

      <span class="row__pts">
        <span class="row__pts-now">{{ team.total }}</span>
        <span v-if="team.liveDelta > 0" class="row__pts-proj">
          +{{ team.liveDelta }} live
        </span>
      </span>
    </div>
  </li>
</template>

<style scoped>
.row + .row { border-top: 1px solid rgba(255, 255, 255, 0.06); }

.row__head {
  display: grid;
  grid-template-columns: 18px 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 10px 12px;
  min-height: 44px;
  box-sizing: border-box;
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

.row__manager {
  display: block;
  font-size: 11px;
  opacity: 0.55;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}

.row__pts {
  text-align: right;
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 60px;
}
.row__pts-now {
  font-size: 17px;
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.row__pts-proj {
  font-size: 10px;
  opacity: 0.7;
  font-style: italic;
  white-space: nowrap;
  color: var(--c-live, #f59e0b);
}
</style>