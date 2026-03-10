<template>
  <div id="planner" :class="{ 'print-mode': view === 'print' }">
    <div v-if="!state.loaded" class="loading">
      <p>Planning laden...</p>
    </div>

    <template v-else>
      <header class="no-print">
        <!-- Left: home + title blocks + upload -->
        <div class="header-left">
          <button class="btn-home" title="Overzicht" @click="goHome">
            <Icon icon="mdi:home-outline" width="20" height="20" />
          </button>

          <!-- Block 1: naam + profiel -->
          <div class="header-block">
            <div class="titel-row">
              <template v-if="otherPlanners.length > 0">
                <select class="planner-select" :value="state.plannerId" @change="switchPlanner($event.target.value)">
                  <option v-for="p in allPlanners" :key="p.planner_id" :value="p.planner_id">
                    {{ p.student_profile?.naam || p.planner_naam }}
                  </option>
                </select>
              </template>
              <h1 v-else class="planner-naam">{{ studentName }}</h1>
            </div>
            <div v-if="profielLabel" class="subtitel">{{ profielLabel }}</div>
          </div>

          <!-- Block 2: week + datums + werklast -->
          <div v-if="weekInfo" class="header-block">
            <div class="titel-row">
              <span class="week-label">Week {{ weekInfo.week }}</span>
              <span v-if="weekInfo.datum" class="datum-inline">– {{ weekInfo.datum }}</span>
            </div>
            <div class="subtitel">Werklast <span class="werklast-badge">{{ stats.totalMinuten }}'</span></div>
          </div>

          <!-- Upload -->
          <label v-if="!isReadOnly" class="tb-btn tb-upload" title="Studiewijzer importeren" @dragover.prevent @drop.prevent="onDrop">
            <input ref="fileInput" type="file" accept=".md,.txt" multiple @change="onFiles" hidden />
            <Icon icon="mdi:upload-outline" width="16" height="16" />
          </label>
        </div>

        <!-- Right: toolbar -->
        <nav>
          <!-- View switcher -->
          <div class="view-switcher">
            <button v-if="state.weken.length" :class="{ active: view === 'kanban' }" @click="setView('kanban')" title="Kanban (K)">
              <Icon icon="mdi:view-week" width="18" height="18" />
            </button>
            <button v-if="state.weken.length" :class="{ active: view === 'weekplan' && wpViewMode === 'week' }" @click="setView('week')" title="Week (W)">
              <Icon icon="mdi:view-week-outline" width="18" height="18" />
            </button>
            <button v-if="state.weken.length" :class="{ active: view === 'weekplan' && wpViewMode === 'dag' }" @click="setView('dag')" title="Dag (D)">
              <Icon icon="mdi:view-day-outline" width="18" height="18" />
            </button>
            <button :class="{ active: view === 'rooster' }" @click="setView('rooster')" title="Weekrooster">
              <Icon icon="mdi:grid" width="18" height="18" />
            </button>
            <button v-if="state.weken.length" :class="{ active: view === 'print' }" @click="setView('print')" title="Afdrukken (P)">
              <Icon icon="mdi:printer-outline" width="18" height="18" />
            </button>
          </div>

          <!-- Spacer -->
          <div class="tb-spacer"></div>

          <!-- Supporting actions -->
          <NotificatieBel />
          <button v-if="isEigenaar" class="tb-btn" title="Delen" @click="showDeel = true">
            <Icon icon="mdi:share-variant-outline" width="18" height="18" />
          </button>
          <button v-if="isEigenaar" class="tb-btn tb-danger" title="Reset" @click="onReset">
            <Icon icon="mdi:delete-outline" width="18" height="18" />
          </button>

          <!-- Avatar / profile dropdown -->
          <div class="avatar-wrapper" @click.stop="showProfile = !showProfile">
            <img v-if="userAvatar" :src="userAvatar" class="avatar" referrerpolicy="no-referrer" />
            <div v-else class="avatar avatar-initials">{{ userInitials }}</div>
            <div v-if="showProfile" class="profile-dropdown" @click.stop>
              <div class="profile-info">
                <span v-if="userName" class="profile-name">{{ userName }}</span>
                <span class="profile-email">{{ userEmail }}</span>
              </div>
              <button class="dropdown-btn" @click="onLogout">Uitloggen</button>
            </div>
          </div>
        </nav>
      </header>

      <main>
        <FileUpload v-if="view === 'kanban' && !isReadOnly" ref="fileUploadRef" />

        <KanbanBord v-if="state.weken.length && view === 'kanban'" />

        <WeekPlanner v-if="state.weken.length && view === 'weekplan'" />

        <WeekRoosterEditor v-if="view === 'rooster'" />

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
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { Icon } from '@iconify/vue';
import { usePlanner } from '../stores/planner.js';
import { useAuth } from '../stores/auth.js';
import * as sync from '../stores/sync.js';
import FileUpload from './FileUpload.vue';
import KanbanBord from './KanbanBord.vue';
import PrintRapport from './PrintRapport.vue';
import DeelModal from './DeelModal.vue';
import NotificatieBel from './NotificatieBel.vue';
import WeekRoosterEditor from './WeekRoosterEditor.vue';
import WeekPlanner from './WeekPlanner.vue';

const props = defineProps({
  plannerId: { type: String, default: null },
});

const router = useRouter();
const { state, stats, isReadOnly, isEigenaar, resetAlles, init, wpViewMode } = usePlanner();
const auth = useAuth();

const view = ref('kanban');
const fileUploadRef = ref(null);
const fileInput = ref(null);
const showDeel = ref(false);
const showProfile = ref(false);
const allPlanners = ref([]);

const userEmail = computed(() => auth.state.user?.email || '');
const userName = computed(() => {
  const meta = auth.state.user?.user_metadata;
  return meta?.full_name || meta?.name || '';
});
const userAvatar = computed(() => auth.state.user?.user_metadata?.avatar_url || '');
const userInitials = computed(() => {
  const name = userName.value || userEmail.value;
  if (!name) return '?';
  const parts = name.split(/[\s@]+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
});

const studentName = computed(() => {
  return state.studentProfile?.naam || 'Catplanner';
});

const profielLabel = computed(() => {
  const p = state.studentProfile;
  if (!p?.richting) return '';
  return `${p.richting} ${p.route}-route`;
});

const otherPlanners = computed(() => {
  return allPlanners.value.filter(p => p.planner_id !== state.plannerId);
});

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
    const [dVan, mVan] = w.datumRange.van.split('/');
    const [dTot, mTot] = w.datumRange.tot.split('/');
    if (mVan === mTot) {
      datum = `${parseInt(dVan)} tot ${parseInt(dTot)} ${maanden[parseInt(mTot) - 1]}`;
    } else {
      datum = `${parseInt(dVan)} ${maanden[parseInt(mVan) - 1]} – ${parseInt(dTot)} ${maanden[parseInt(mTot) - 1]}`;
    }
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
  showProfile.value = false;
  await auth.signOut();
}

function setView(v) {
  if (v === 'kanban') { view.value = 'kanban'; }
  else if (v === 'week') { view.value = 'weekplan'; wpViewMode.value = 'week'; }
  else if (v === 'dag') { view.value = 'weekplan'; wpViewMode.value = 'dag'; }
  else if (v === 'rooster') { view.value = 'rooster'; }
  else if (v === 'print') { view.value = 'print'; }
}

function onKeydown(e) {
  // Skip if user is typing in an input/textarea/select
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  if (!state.weken.length) return;
  if (e.key === 'k' || e.key === 'K') setView('kanban');
  else if (e.key === 'w' || e.key === 'W') setView('week');
  else if (e.key === 'd' || e.key === 'D') setView('dag');
  else if (e.key === 'p' || e.key === 'P') setView('print');
}

function goHome() {
  router.push('/dashboard');
}

function switchPlanner(plannerId) {
  router.push(`/planner/${plannerId}`);
}

// Close profile dropdown on outside click
if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    if (showProfile.value) showProfile.value = false;
  });
}

onMounted(async () => {
  if (!state.loaded || (props.plannerId && state.plannerId !== props.plannerId)) {
    await init(props.plannerId);
  }
  try {
    allPlanners.value = await sync.getMyPlanners();
  } catch (_) { /* ignore */ }
  document.addEventListener('keydown', onKeydown);
});
onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown);
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

/* ---- Header ---- */

.header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.btn-home {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  padding: 0;
  border: 1px solid var(--clr-border);
  border-radius: var(--radius);
  background: var(--clr-surface);
  cursor: pointer;
  color: var(--clr-text-muted);
  transition: all 0.15s;
  flex-shrink: 0;
}

.btn-home:hover {
  color: var(--clr-accent);
  border-color: var(--clr-accent);
  background: var(--clr-accent-light);
}

.header-block {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding-left: 0.75rem;
  border-left: 2px solid var(--clr-border);
}

.titel-row {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
}

.planner-naam {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 700;
  line-height: 1.2;
}

.werklast-badge {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--clr-accent);
  background: var(--clr-accent-light);
  padding: 0.1rem 0.5rem;
  border-radius: 4px;
  font-variant-numeric: tabular-nums;
}

.planner-select {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--clr-text);
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  padding-right: 1.2rem;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M3 4.5L6 8l3-3.5'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0 center;
}

.planner-select:focus {
  outline: none;
}

.week-label {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--clr-text);
}

.datum-inline {
  font-size: 0.9rem;
  font-weight: 400;
  color: var(--clr-text-muted);
}

.subtitel {
  font-size: 0.8rem;
  color: var(--clr-text-muted);
  margin-top: -0.1rem;
}

/* ---- Toolbar ---- */

nav {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.tb-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  padding: 0;
  border: 1px solid var(--clr-border);
  border-radius: var(--radius);
  background: var(--clr-surface);
  cursor: pointer;
  color: var(--clr-text-muted);
  transition: all 0.15s;
}

.tb-btn:hover {
  color: var(--clr-accent);
  border-color: var(--clr-accent);
  background: var(--clr-accent-light);
}

.tb-upload {
  border-style: dashed;
}

.tb-danger:hover {
  color: #ef4444;
  border-color: #ef4444;
  background: #fef2f2;
}

.tb-spacer {
  width: 1px;
  height: 2rem;
  background: var(--clr-border);
  margin: 0 0.25rem;
}

/* View switcher (segmented) */
.view-switcher {
  display: flex;
  border: 1px solid var(--clr-border);
  border-radius: var(--radius);
  overflow: hidden;
}

.view-switcher button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  padding: 0;
  border: none;
  background: var(--clr-surface);
  cursor: pointer;
  color: var(--clr-text-muted);
  transition: all 0.15s;
}

.view-switcher button + button {
  border-left: 1px solid var(--clr-border);
}

.view-switcher button.active {
  background: var(--clr-accent);
  color: white;
}

.view-switcher button:hover:not(.active) {
  background: var(--clr-accent-light);
  color: var(--clr-accent);
}

/* ---- Avatar / Profile dropdown ---- */

.avatar-wrapper {
  position: relative;
  cursor: pointer;
}

.avatar {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  border: 2px solid var(--clr-border);
  transition: border-color 0.15s;
  object-fit: cover;
}

.avatar:hover {
  border-color: var(--clr-accent);
}

.avatar-initials {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--clr-accent-light);
  color: var(--clr-accent);
  font-size: 0.9rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.profile-dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  background: var(--clr-surface);
  border: 1px solid var(--clr-border);
  border-radius: var(--radius);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  padding: 0.75rem;
  min-width: 200px;
  z-index: 50;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.profile-info {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.profile-name {
  font-weight: 600;
  font-size: 0.9rem;
}

.profile-email {
  font-size: 0.8rem;
  color: var(--clr-text-muted);
  word-break: break-all;
}

.dropdown-btn {
  padding: 0.4rem 0.75rem;
  border: 1px solid var(--clr-border);
  border-radius: 0.4rem;
  background: var(--clr-surface);
  cursor: pointer;
  font-size: 0.8rem;
  color: var(--clr-text-muted);
  text-align: center;
  transition: all 0.15s;
}

.dropdown-btn:hover {
  border-color: #ef4444;
  color: #ef4444;
  background: #fef2f2;
}

/* ---- Responsive ---- */

@media (max-width: 700px) {
  .header-left {
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .planner-naam, .planner-select, .week-label {
    font-size: 1rem;
  }
  .tb-spacer {
    display: none;
  }
}
</style>
