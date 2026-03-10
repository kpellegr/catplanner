<template>
  <div id="planner" :class="{ 'print-mode': view === 'print' }">
    <div v-if="!state.loaded" class="loading">
      <p>Planning laden...</p>
    </div>

    <template v-else>
      <header class="no-print">
        <div class="header-titel">
          <h1 v-if="weekInfo">Planning week {{ weekInfo.week }} <span class="header-datum">{{ weekInfo.datum }}</span></h1>
          <h1 v-else>Catplanner</h1>
          <label v-if="!isReadOnly" class="header-upload" @dragover.prevent @drop.prevent="onDrop">
            <input ref="fileInput" type="file" accept=".md,.txt" multiple @change="onFiles" hidden />
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 10v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-3"/><polyline points="5 5 8 2 11 5"/><line x1="8" y1="2" x2="8" y2="10"/></svg>
          </label>
        </div>
        <nav>
          <template v-if="state.weken.length">
            <button :class="{ active: view === 'kanban' }" @click="view = 'kanban'">Kanban</button>
            <button :class="{ active: view === 'print' }" @click="view = 'print'">Afdrukken</button>
          </template>
          <button v-if="isEigenaar" class="btn-share" @click="showDeel = true">Delen</button>
          <button v-if="isEigenaar" class="btn-reset" @click="onReset">Reset</button>
          <button class="btn-logout" @click="onLogout">
            <span class="user-email">{{ userEmail }}</span>
            Uitloggen
          </button>
        </nav>
      </header>

      <StatsBar v-if="state.weken.length && view === 'kanban'" class="no-print" />

      <main>
        <FileUpload v-if="view === 'kanban' && !isReadOnly" ref="fileUploadRef" />

        <KanbanBord v-if="state.weken.length && view === 'kanban'" />

        <template v-if="state.weken.length && view === 'print'">
          <div class="print-actions no-print">
            <button class="btn-print" @click="print">Afdrukken</button>
            <button @click="view = 'kanban'">Terug naar kanban</button>
          </div>
          <PrintRapport />
        </template>

        <div v-if="!state.weken.length" class="empty-state">
          <template v-if="isReadOnly">
            <p>Er is nog geen planning geladen. Vraag de eigenaar om een studiewijzer te importeren.</p>
          </template>
          <template v-else>
            <p>Klik op het upload-icoon in de header om een studiewijzer (.md) te laden.</p>
          </template>
        </div>
      </main>

      <DeelModal
        v-if="showDeel && state.plannerId"
        :plannerId="state.plannerId"
        @sluit="showDeel = false"
      />
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { usePlanner } from '../stores/planner.js';
import { useAuth } from '../stores/auth.js';
import FileUpload from './FileUpload.vue';
import KanbanBord from './KanbanBord.vue';
import StatsBar from './StatsBar.vue';
import PrintRapport from './PrintRapport.vue';
import DeelModal from './DeelModal.vue';

const props = defineProps({
  plannerId: { type: String, default: null },
});

const { state, isReadOnly, isEigenaar, resetAlles, init } = usePlanner();
const auth = useAuth();

const view = ref('kanban');
const fileUploadRef = ref(null);
const fileInput = ref(null);
const showDeel = ref(false);

const userEmail = computed(() => auth.state.user?.email || '');

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

async function onReset() {
  if (confirm('Alle data wissen? Dit kan niet ongedaan gemaakt worden.')) {
    await resetAlles();
    view.value = 'kanban';
  }
}

async function onLogout() {
  await auth.signOut();
}

onMounted(async () => {
  if (!state.loaded || (props.plannerId && state.plannerId !== props.plannerId)) {
    await init(props.plannerId);
  }
});
</script>

<style scoped>
.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 40vh;
  color: var(--clr-text-muted);
}

.btn-share {
  background: var(--clr-surface) !important;
  border: 1px solid var(--clr-accent) !important;
  color: var(--clr-accent) !important;
}

.btn-share:hover {
  background: var(--clr-accent-light) !important;
}

.btn-logout {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-left: 0.5rem;
  font-size: 0.8rem !important;
  color: var(--clr-text-muted) !important;
}

.user-email {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.75rem;
  opacity: 0.7;
}
</style>
