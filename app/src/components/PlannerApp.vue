<template>
  <div id="planner">
    <div v-if="!state.loaded" class="loading">
      <p>Planning laden...</p>
    </div>

    <template v-else>
      <header class="no-print">
        <!-- Left: home + title blocks + upload -->
        <div class="header-left">
          <button class="btn-home" data-tooltip="Overzicht" data-tooltip-pos="bottom" @click="goHome">
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

          <!-- Mini weekgrid -->
          <WeekGrid v-if="state.weken.length" mini />

          <!-- Upload -->
          <label v-if="!isReadOnly" class="tb-btn tb-upload" data-tooltip="Studiewijzer importeren" data-tooltip-pos="bottom" @dragover.prevent @drop.prevent="onDrop">
            <input ref="fileInput" type="file" accept=".md,.txt" multiple @change="onFiles" hidden />
            <Icon icon="mdi:upload-outline" width="16" height="16" />
          </label>
        </div>

        <!-- Right: toolbar -->
        <nav>
          <!-- View switcher -->
          <div class="view-switcher">
            <button v-if="state.weken.length" :class="{ active: view === 'dashboard' }" @click="setView('dashboard')" data-tooltip="Dashboard (H)" data-tooltip-pos="bottom">
              <Icon icon="mdi:view-dashboard-outline" width="18" height="18" />
            </button>
            <button v-if="state.weken.length" :class="{ active: view === 'studiewijzer' }" @click="setView('studiewijzer')" data-tooltip="Studiewijzer (S)" data-tooltip-pos="bottom">
              <Icon icon="mdi:book-open-page-variant-outline" width="18" height="18" />
            </button>
            <button v-if="state.weken.length" :class="{ active: view === 'weekplan' && wpViewMode === 'week' }" @click="setView('week')" data-tooltip="Week (W)" data-tooltip-pos="bottom">
              <Icon icon="mdi:calendar-multiselect-outline" width="18" height="18" />
            </button>
            <button v-if="state.weken.length" :class="{ active: view === 'weekplan' && wpViewMode === 'dag' }" @click="setView('dag')" data-tooltip="Dag (D)" data-tooltip-pos="bottom">
              <Icon icon="mdi:view-day-outline" width="18" height="18" />
            </button>
            <button v-if="state.weken.length" :class="{ active: view === 'kanban' }" @click="setView('kanban')" data-tooltip="Kanban (K)" data-tooltip-pos="bottom">
              <Icon icon="mdi:view-week" width="18" height="18" />
            </button>
          </div>

          <!-- Spacer -->
          <div class="tb-spacer"></div>

          <!-- Supporting actions (hidden on mobile, moved to profile dropdown) -->
          <div class="desktop-actions">
            <NotificatieBel ref="notifBelRef" />
            <button v-if="isEigenaar" class="tb-btn" data-tooltip="Delen" data-tooltip-pos="bottom" @click="showDeel = true">
              <Icon icon="mdi:share-variant-outline" width="18" height="18" />
            </button>
            <button v-if="isEigenaar" class="tb-btn tb-danger" data-tooltip="Reset" data-tooltip-pos="bottom" @click="onReset">
              <Icon icon="mdi:delete-outline" width="18" height="18" />
            </button>
          </div>

          <!-- DEV badge -->
          <span v-if="isDev" class="dev-badge">DEV</span>

          <!-- Avatar / profile dropdown -->
          <div class="avatar-wrapper" @click.stop="showProfile = !showProfile">
            <img v-if="userAvatar" :src="userAvatar" class="avatar" referrerpolicy="no-referrer" />
            <div v-else class="avatar avatar-initials">{{ userInitials }}</div>
            <div v-if="showProfile" class="profile-dropdown" @click.stop>
              <div class="profile-info">
                <span v-if="userName" class="profile-name">{{ userName }}</span>
                <span class="profile-email">{{ userEmail }}</span>
                <span v-if="profielLabel" class="profile-profiel">{{ profielLabel }}</span>
              </div>
              <!-- Mobile-only actions -->
              <div class="mobile-menu-actions">
                <button class="dropdown-btn" @click="showProfile = false; toggleNotif()">
                  <Icon icon="mdi:bell-outline" width="14" height="14" />
                  Meldingen
                </button>
                <button v-if="isEigenaar" class="dropdown-btn" @click="showProfile = false; showDeel = true">
                  <Icon icon="mdi:share-variant-outline" width="14" height="14" />
                  Delen
                </button>
                <button v-if="isEigenaar" class="dropdown-btn dropdown-danger" @click="showProfile = false; onReset()">
                  <Icon icon="mdi:delete-outline" width="14" height="14" />
                  Reset
                </button>
              </div>
              <button v-if="!isReadOnly" class="dropdown-btn" @click="showProfile = false; setView('config')">
                <Icon icon="mdi:cog-outline" width="14" height="14" />
                Instellingen
              </button>
              <button class="dropdown-btn dropdown-logout" @click="onLogout">Uitloggen</button>
              <div class="build-info">build {{ buildHash }}</div>
            </div>
          </div>
        </nav>
      </header>

      <main>
        <FileUpload v-if="!isReadOnly" ref="fileUploadRef" @imported="setView('studiewijzer')" />

        <DashboardView v-if="state.weken.length && view === 'dashboard'" />

        <KanbanBord v-if="state.weken.length && view === 'kanban'" />

        <WeekPlanner v-if="state.weken.length && view === 'weekplan'" />

        <StudiewijzerView v-if="view === 'studiewijzer'" />

        <ConfiguratieView v-if="view === 'config'" />


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
import DeelModal from './DeelModal.vue';
import NotificatieBel from './NotificatieBel.vue';
import WeekPlanner from './WeekPlanner.vue';
import ConfiguratieView from './ConfiguratieView.vue';
import StudiewijzerView from './StudiewijzerView.vue';
import DashboardView from './DashboardView.vue';
import WeekGrid from './WeekGrid.vue';

const props = defineProps({
  plannerId: { type: String, default: null },
});

const isDev = import.meta.env.DEV;
const buildHash = typeof __BUILD_HASH__ !== 'undefined' ? __BUILD_HASH__ : 'dev';

const router = useRouter();
const { state, stats, isReadOnly, isEigenaar, resetAlles, init, wpViewMode, activeView } = usePlanner();
const auth = useAuth();

const view = activeView;
const fileUploadRef = ref(null);
const fileInput = ref(null);
const notifBelRef = ref(null);
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

function toggleNotif() {
  notifBelRef.value?.toggle();
}

function setView(v) {
  if (v === 'kanban') { view.value = 'kanban'; }
  else if (v === 'week') { view.value = 'weekplan'; wpViewMode.value = 'week'; }
  else if (v === 'dag') { view.value = 'weekplan'; wpViewMode.value = 'dag'; }
  else if (v === 'studiewijzer') { view.value = 'studiewijzer'; }
  else if (v === 'dashboard') { view.value = 'dashboard'; }
  else if (v === 'config') { view.value = 'config'; }
}

function onKeydown(e) {
  // Skip if user is typing in an input/textarea/select
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  if (!state.weken.length) return;
  if (e.key === 'h' || e.key === 'H') setView('dashboard');
  else if (e.key === 'k' || e.key === 'K') setView('kanban');
  else if (e.key === 'w' || e.key === 'W') setView('week');
  else if (e.key === 'd' || e.key === 'D') setView('dag');
  else if (e.key === 's' || e.key === 'S') setView('studiewijzer');
  else if (e.key === 'p' || e.key === 'P') window.print();
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

.profile-profiel {
  font-size: 0.7rem;
  color: var(--clr-accent);
  font-weight: 500;
}

.dropdown-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.4rem 0.75rem;
  border: 1px solid var(--clr-border);
  border-radius: 0.4rem;
  background: var(--clr-surface);
  cursor: pointer;
  font-size: 0.8rem;
  color: var(--clr-text-muted);
  text-align: center;
  transition: all 0.15s;
  width: 100%;
}

.dropdown-btn:hover {
  border-color: var(--clr-accent);
  color: var(--clr-accent);
  background: var(--clr-accent-light);
}

.dropdown-logout:hover {
  border-color: #ef4444;
  color: #ef4444;
  background: #fef2f2;
}

.build-info {
  font-size: 0.6rem;
  color: var(--clr-text-muted);
  text-align: center;
  padding: 0.3rem 0 0;
  border-top: 1px solid var(--clr-border);
  margin-top: 0.25rem;
  font-variant-numeric: tabular-nums;
}

/* ---- Desktop/mobile action groups ---- */
.desktop-actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.mobile-menu-actions {
  display: none;
  flex-direction: column;
  gap: 0.35rem;
  padding-top: 0.35rem;
  border-top: 1px solid var(--clr-border);
}

.dropdown-danger:hover {
  border-color: #ef4444;
  color: #ef4444;
  background: #fef2f2;
}

/* ---- DEV badge ---- */
.dev-badge {
  font-size: 0.55rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  color: #dc2626;
  background: #fef2f2;
  border: 1.5px solid #fca5a5;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  line-height: 1;
}

/* ---- Responsive ---- */

@media (max-width: 700px) {
  .header-left {
    gap: 0.4rem;
    flex-wrap: wrap;
  }
  .planner-naam, .planner-select, .week-label {
    font-size: 1rem;
  }
  .header-block {
    padding-left: 0.5rem;
  }
  .tb-spacer {
    display: none;
  }
  .desktop-actions {
    display: none;
  }
  .tb-upload {
    display: none !important;
  }
  .mobile-menu-actions {
    display: flex;
  }
  .view-switcher button,
  .tb-btn,
  .btn-home {
    width: 2.4rem;
    height: 2.4rem;
  }
  .avatar {
    width: 2.4rem;
    height: 2.4rem;
  }
}

@media (max-width: 480px) {
  .header-left {
    gap: 0.3rem;
  }
  .btn-home {
    width: 2rem;
    height: 2rem;
  }
  .header-block {
    padding-left: 0.4rem;
    border-left-width: 1px;
  }
  .planner-naam, .planner-select, .week-label {
    font-size: 0.85rem;
  }
  .subtitel, .datum-inline {
    font-size: 0.7rem;
  }
  .werklast-badge {
    font-size: 0.7rem;
    padding: 0.05rem 0.35rem;
  }
  /* Hide mini weekgrid on very small screens */
  .wg-mini {
    display: none;
  }
  .view-switcher button,
  .tb-btn {
    width: 2.2rem;
    height: 2.2rem;
  }
  .avatar {
    width: 2.2rem;
    height: 2.2rem;
  }
}
</style>
