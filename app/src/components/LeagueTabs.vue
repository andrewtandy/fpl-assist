<template>
    <div>
        <div class="league-tabs">
            <nav class="tab-bar">
            <button v-for="tab in tabs" :key="tab.id" @click="activeId = tab.id" :class="{active: activeId === tab.id}" class="tab-btns">
                {{ tab.label }}
            </button>
            </nav>
            <component :is="activeComponent" class="component-box"/>
    
        </div>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue'

import LiveLeagueTable from '@/components/LiveLeagueTable.vue';
import TotalLeagueTable from './TotalLeagueTable.vue';

const tabs = [
    {
        id: "live",
        label: "Live",
        component: LiveLeagueTable
    },
    {
        id: "league",
        label: "League",
        component: TotalLeagueTable
    },
    // {
    //     id: "activity",
    //     label: "Activity",
    //     component: LiveLeagueTable
    // },
    // {
    //     id: "scouting",
    //     label: "Scouting",
    //     component: LiveLeagueTable
    // },

]

const activeId = ref('live')
const activeComponent = computed(() => tabs.find(t => t.id === activeId.value)?.component)

</script>

<style lang="scss" scoped>

.tab-bar {
    display: flex;
    gap: 2px;
    border-bottom: 1px solid var(--border, #e5e5e5);

    button {
        padding: 8px 16px;
        background: transparent;
        border: 1px solid white;
        border-bottom: none;
        border-radius: 8px 8px 0 0;
        color: var(--text-secondary, #666);
        cursor: pointer;
        margin-bottom: -1px; // punches through the bottom border

        &:hover {
        background: var(--surface-1, #f5f5f5);
        }

        &.active {
        background: var(--surface-bg, #fff);
        border-color: var(--border, #e5e5e5);
        color: var(--text-primary, #111);
        }
    }
}


</style>