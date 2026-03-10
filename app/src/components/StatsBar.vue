<template>
  <div class="stats-bar">
    <div class="stat">
      <span class="stat-heading">Totaal</span>
      <span class="stat-value">{{ stats.total }}</span>
      <span class="stat-min">{{ stats.totalMinuten }}'</span>
    </div>
    <div class="stat">
      <span class="stat-heading">Open</span>
      <span class="stat-value todo">{{ stats.todo }}</span>
      <span class="stat-min todo">{{ stats.todoMin }}'</span>
    </div>
    <div class="stat">
      <span class="stat-heading">Bezig</span>
      <span class="stat-value bezig">{{ stats.bezig }}</span>
      <span class="stat-min bezig">{{ stats.bezigMin }}'</span>
    </div>
    <div class="stat">
      <span class="stat-heading">Klaar</span>
      <span class="stat-value klaar">{{ stats.klaar }}</span>
      <span class="stat-min klaar">{{ stats.klaarMin }}'</span>
    </div>
    <div class="stat">
      <span class="stat-heading">Ingediend</span>
      <span class="stat-value ingediend">{{ stats.ingediend }}</span>
      <span class="stat-min ingediend">{{ stats.ingediendMin }}'</span>
    </div>
  </div>
</template>

<script setup>
import { usePlanner } from '../stores/planner.js';
const { stats } = usePlanner();
</script>
