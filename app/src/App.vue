<template>
  <div id="app" :class="{ 'print-mode': view === 'print' }">
    <header class="no-print">
      <div class="header-titel">
        <h1 v-if="weekInfo">Planning week {{ weekInfo.week }} <span class="header-datum">{{ weekInfo.datum }}</span></h1>
        <h1 v-else>Catplanner</h1>
        <label class="header-upload" @dragover.prevent @drop.prevent="onDrop">
          <input ref="fileInput" type="file" accept=".md,.txt" multiple @change="onFiles" hidden />
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 10v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-3"/><polyline points="5 5 8 2 11 5"/><line x1="8" y1="2" x2="8" y2="10"/></svg>
        </label>
      </div>
      <nav v-if="state.weken.length">
        <button :class="{ active: view === 'kanban' }" @click="view = 'kanban'">Kanban</button>
        <button :class="{ active: view === 'print' }" @click="view = 'print'">Afdrukken</button>
      </nav>
    </header>

    <StatsBar v-if="state.weken.length && view === 'kanban'" class="no-print" />

    <main>
      <FileUpload v-if="view === 'kanban'" ref="fileUploadRef" />

      <KanbanBord v-if="state.weken.length && view === 'kanban'" />

      <template v-if="state.weken.length && view === 'print'">
        <div class="print-actions no-print">
          <button class="btn-print" @click="print">Afdrukken</button>
          <button @click="view = 'kanban'">Terug naar kanban</button>
        </div>
        <PrintRapport />
      </template>

      <div v-if="!state.weken.length" class="empty-state">
        <p>Klik op het upload-icoon in de header om een studiewijzer (.md) te laden.</p>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { usePlanner } from './stores/planner.js';
import FileUpload from './components/FileUpload.vue';
import KanbanBord from './components/KanbanBord.vue';
import StatsBar from './components/StatsBar.vue';
import PrintRapport from './components/PrintRapport.vue';

const { state } = usePlanner();
const view = ref('kanban');
const fileUploadRef = ref(null);
const fileInput = ref(null);

const maanden = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

function fmtDatum(ddmmyyyy) {
  const [d, m] = ddmmyyyy.split('/');
  return `${parseInt(d)} ${maanden[parseInt(m) - 1]}`;
}

const weekInfo = computed(() => {
  if (!state.weken.length) return null;
  const w = state.weken[0].metadata;
  let datum = '';
  if (w.datumRange) {
    datum = `${fmtDatum(w.datumRange.van)} – ${fmtDatum(w.datumRange.tot)}`;
  }
  return { week: w.week, datum };
});

function onFiles(e) {
  if (fileUploadRef.value) {
    fileUploadRef.value.processFiles(e.target.files);
  }
  e.target.value = '';
}

function onDrop(e) {
  if (fileUploadRef.value) {
    fileUploadRef.value.processFiles(e.dataTransfer.files);
  }
}

function print() {
  window.print();
}
</script>
