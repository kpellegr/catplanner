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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
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
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 10v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-3"/><polyline points="5 5 8 2 11 5"/><line x1="8" y1="2" x2="8" y2="10"/></svg>
          </label>
        </div>

        <!-- Right: toolbar -->
        <nav>
          <!-- View switcher -->
          <div class="view-switcher">
            <button v-if="state.weken.length" :class="{ active: view === 'kanban' }" @click="view = 'kanban'" title="Kanban">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="1" width="4" height="14" rx="1"/><rect x="6" y="1" width="4" height="9" rx="1"/><rect x="11" y="1" width="4" height="11" rx="1"/></svg>
            </button>
            <button v-if="state.weken.length" :class="{ active: view === 'weekplan' }" @click="view = 'weekplan'" title="Weekplanner">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="2" width="14" height="13" rx="1.5"/><line x1="1" y1="6" x2="15" y2="6"/><line x1="5.5" y1="6" x2="5.5" y2="15"/><line x1="10.5" y1="6" x2="10.5" y2="15"/></svg>
            </button>
            <button :class="{ active: view === 'rooster' }" @click="view = 'rooster'" title="Weekrooster">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="2" width="14" height="13" rx="1.5"/><line x1="1" y1="6" x2="15" y2="6"/><line x1="5.5" y1="2" x2="5.5" y2="15"/><line x1="10.5" y1="2" x2="10.5" y2="15"/><line x1="1" y1="10" x2="15" y2="10"/></svg>
            </button>
            <button v-if="state.weken.length" :class="{ active: view === 'print' }" @click="view = 'print'" title="Afdrukken">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 6 4 1 12 1 12 6"/><path d="M4 11H2a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-2"/><rect x="4" y="9" width="8" height="6" rx="1"/></svg>
            </button>
          </div>

          <!-- Spacer -->
          <div class="tb-spacer"></div>

          <!-- Supporting actions -->
          <NotificatieBel />
          <button v-if="isEigenaar" class="tb-btn" title="Delen" @click="showDeel = true">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="3" r="2"/><circle cx="4" cy="8" r="2"/><circle cx="12" cy="13" r="2"/><line x1="5.7" y1="9.1" x2="10.3" y2="11.9"/><line x1="10.3" y1="4.1" x2="5.7" y2="6.9"/></svg>
          </button>
          <button v-if="isEigenaar" class="tb-btn tb-danger" title="Reset" @click="onReset">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
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
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
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
const { state, stats, isReadOnly, isEigenaar, resetAlles, init } = usePlanner();
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
  // Load all planners for dropdown
  try {
    allPlanners.value = await sync.getMyPlanners();
  } catch (_) { /* ignore */ }
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
