<template>
  <div id="app" :class="{ 'print-mode': view === 'print' }">
    <header class="no-print">
      <h1>Catplanner</h1>
      <nav v-if="state.weken.length">
        <button :class="{ active: view === 'kanban' }" @click="view = 'kanban'">Kanban</button>
        <button :class="{ active: view === 'print' }" @click="view = 'print'">Afdrukken</button>
      </nav>
    </header>

    <StatsBar v-if="state.weken.length && view === 'kanban'" class="no-print" />

    <main>
      <FileUpload v-if="view === 'kanban'" class="no-print" />

      <KanbanBord v-if="state.weken.length && view === 'kanban'" />

      <template v-if="state.weken.length && view === 'print'">
        <div class="print-actions no-print">
          <button class="btn-print" @click="print">Afdrukken</button>
          <button @click="view = 'kanban'">Terug naar kanban</button>
        </div>
        <PrintRapport />
      </template>

      <div v-if="!state.weken.length" class="empty-state">
        <p>Upload een studiewijzer (.md) om te beginnen.</p>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { usePlanner } from './stores/planner.js';
import FileUpload from './components/FileUpload.vue';
import KanbanBord from './components/KanbanBord.vue';
import StatsBar from './components/StatsBar.vue';
import PrintRapport from './components/PrintRapport.vue';

const { state } = usePlanner();
const view = ref('kanban');

function print() {
  window.print();
}
</script>
