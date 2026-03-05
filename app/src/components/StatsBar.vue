<template>
  <div class="stats-bar">
    <div class="stat">
      <span class="stat-value">{{ stats.total }}</span>
      <span class="stat-label">taken</span>
    </div>
    <div class="stat">
      <span class="stat-value todo">{{ stats.todo }}</span>
      <span class="stat-label">te doen</span>
    </div>
    <div class="stat">
      <span class="stat-value bezig">{{ stats.bezig }}</span>
      <span class="stat-label">bezig</span>
    </div>
    <div class="stat">
      <span class="stat-value klaar">{{ stats.klaar }}</span>
      <span class="stat-label">klaar</span>
    </div>
    <div class="stat">
      <span class="stat-value">{{ formatTijd(stats.gewerktMinuten) }} / {{ formatTijd(stats.totalMinuten) }}</span>
      <span class="stat-label">gewerkt</span>
    </div>
  </div>
</template>

<script setup>
import { usePlanner } from '../stores/planner.js';
const { stats } = usePlanner();

function formatTijd(min) {
  if (!min) return '0u';
  const u = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${u}u${String(m).padStart(2, '0')}` : `${u}u`;
}
</script>
