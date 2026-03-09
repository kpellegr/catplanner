<template>
  <div id="app">
    <header>
      <h1>Catplanner</h1>
    </header>

    <StatsBar v-if="state.weken.length" />

    <main>
      <FileUpload />

      <KanbanBord v-if="state.weken.length" />

      <div v-if="!state.weken.length" class="empty-state">
        <p>Upload een studiewijzer (.md) om te beginnen.</p>
      </div>
    </main>
  </div>
</template>

<script setup>
import { usePlanner } from './stores/planner.js';
import FileUpload from './components/FileUpload.vue';
import KanbanBord from './components/KanbanBord.vue';
import StatsBar from './components/StatsBar.vue';

const { state } = usePlanner();
</script>
