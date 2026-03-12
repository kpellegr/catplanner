<template>
  <div id="planner">
    <div v-if="isDev" class="dev-bar"></div>
    <div v-if="!state.loaded" class="loading">
      <p>Planning laden...</p>
    </div>

    <template v-else>
      <header class="no-print">
        <!-- Left: title blocks + upload -->
        <div class="header-left">
          <!-- Block 1: naam + profiel -->
          <div class="header-block header-block-first">
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
          <div v-if="weekInfo" class="header-block header-block-week">
            <div class="titel-row">
              <span class="week-label">Week {{ weekInfo.week }}</span>
              <span v-if="weekInfo.datum" class="datum-inline">– {{ weekInfo.datum }}</span>
            </div>
            <div class="subtitel">Werklast <span class="werklast-badge">{{ stats.totalMinuten }}'</span></div>
          </div>

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

        <DagMobileView v-if="state.weken.length && view === 'weekplan' && wpViewMode === 'dag' && isMobile" />
        <WeekPlanner v-if="state.weken.length && view === 'weekplan' && !(wpViewMode === 'dag' && isMobile)" />

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

      <!-- Mobile bottom nav -->
      <nav v-if="state.weken.length" class="bottom-nav no-print">
        <button :class="{ active: view === 'dashboard' }" @click="setView('dashboard')">
          <Icon icon="mdi:view-dashboard-outline" width="22" height="22" />
          <span>Dashboard</span>
        </button>
        <button :class="{ active: view === 'weekplan' && wpViewMode === 'dag' }" @click="setView('dag')">
          <Icon icon="mdi:view-day-outline" width="22" height="22" />
          <span>Dag</span>
        </button>
        <button :class="{ active: view === 'studiewijzer' }" @click="setView('studiewijzer')">
          <Icon icon="mdi:book-open-page-variant-outline" width="22" height="22" />
          <span>Wijzer</span>
        </button>
        <button :class="{ active: showMobileMenu }" @click.stop="showMobileMenu = !showMobileMenu">
          <Icon icon="mdi:menu" width="22" height="22" />
          <span>Menu</span>
        </button>
      </nav>

      <!-- Mobile menu overlay -->
      <div v-if="showMobileMenu" class="mobile-overlay no-print" @click="showMobileMenu = false">
        <div class="mobile-menu" @click.stop>
          <div class="profile-info">
            <div class="mobile-menu-avatar">
              <img v-if="userAvatar" :src="userAvatar" class="avatar" referrerpolicy="no-referrer" />
              <div v-else class="avatar avatar-initials">{{ userInitials }}</div>
            </div>
            <div>
              <span v-if="userName" class="profile-name">{{ userName }}</span>
              <span class="profile-email">{{ userEmail }}</span>
            </div>
          </div>
          <div class="mobile-menu-items">
            <button @click="showMobileMenu = false; setView('kanban')">
              <Icon icon="mdi:view-week" width="18" height="18" />
              Kanban
            </button>
            <button @click="showMobileMenu = false; toggleNotif()">
              <Icon icon="mdi:bell-outline" width="18" height="18" />
              Meldingen
            </button>
            <button v-if="isEigenaar" @click="showMobileMenu = false; showDeel = true">
              <Icon icon="mdi:share-variant-outline" width="18" height="18" />
              Delen
            </button>
            <button v-if="!isReadOnly" @click="showMobileMenu = false; setView('config')">
              <Icon icon="mdi:cog-outline" width="18" height="18" />
              Instellingen
            </button>
            <button v-if="isEigenaar" class="menu-danger" @click="showMobileMenu = false; onReset()">
              <Icon icon="mdi:delete-outline" width="18" height="18" />
              Reset
            </button>
            <button class="menu-logout" @click="showMobileMenu = false; onLogout()">
              <Icon icon="mdi:logout" width="18" height="18" />
              Uitloggen
            </button>
          </div>
        </div>
      </div>

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
import DagMobileView from './DagMobileView.vue';

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
const showMobileMenu = ref(false);
const allPlanners = ref([]);
const isMobile = ref(window.innerWidth <= 700);

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

function switchPlanner(plannerId) {
  router.push(`/planner/${plannerId}`);
}

// Close profile dropdown on outside click
if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    if (showProfile.value) showProfile.value = false;
  });
}

function onResize() { isMobile.value = window.innerWidth <= 700; }

onMounted(async () => {
  if (!state.loaded || (props.plannerId && state.plannerId !== props.plannerId)) {
    await init(props.plannerId);
  }
  try {
    allPlanners.value = await sync.getMyPlanners();
  } catch (_) { /* ignore */ }
  document.addEventListener('keydown', onKeydown);
  window.addEventListener('resize', onResize);
});
onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown);
  window.removeEventListener('resize', onResize);
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

.header-block {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding-left: 0.75rem;
  border-left: 2px solid var(--clr-border);
}

.header-block-first {
  border-left: none;
  padding-left: 0;
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

/* ---- Desktop action group ---- */
.desktop-actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

/* ---- DEV indicator bar ---- */
.dev-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #ef4444, #f59e0b, #ef4444);
  z-index: 9999;
  pointer-events: none;
}

/* ---- Bottom nav (mobile only) ---- */
.bottom-nav {
  display: none;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--clr-surface);
  border-top: 1px solid var(--clr-border);
  padding: 0.3rem 0;
  padding-bottom: max(0.3rem, env(safe-area-inset-bottom));
  z-index: 100;
  justify-content: space-around;
}
.bottom-nav button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  background: none;
  border: none;
  color: var(--clr-text-muted);
  font-size: 0.6rem;
  font-weight: 600;
  padding: 0.25rem 0.75rem;
  cursor: pointer;
  transition: color 0.15s;
  font-family: inherit;
}
.bottom-nav button.active {
  color: var(--clr-accent);
}

/* ---- Mobile menu overlay ---- */
.mobile-overlay {
  display: none;
}
.mobile-menu {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--clr-surface);
  border-radius: 16px 16px 0 0;
  padding: 1.25rem;
  padding-bottom: max(1.25rem, env(safe-area-inset-bottom));
  box-shadow: 0 -4px 24px rgba(0,0,0,0.12);
}

/* ---- Responsive ---- */

@media (max-width: 700px) {
  /* Header: hide desktop nav + home button, keep info only */
  header nav {
    display: none !important;
  }
  .header-left {
    gap: 0.4rem;
    flex-wrap: wrap;
    width: 100%;
  }
  .tb-upload {
    display: none !important;
  }
  .planner-naam, .planner-select, .week-label {
    font-size: 1rem;
  }
  .header-block {
    padding-left: 0.5rem;
  }
  .header-block-week {
    margin-left: auto;
    text-align: right;
  }

  /* Add bottom padding so content doesn't hide behind bottom nav */
  main {
    padding-bottom: 4.5rem;
  }

  /* Bottom nav */
  .bottom-nav {
    display: flex;
  }

  /* Mobile menu */
  .mobile-overlay {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.3);
    z-index: 200;
  }
  .mobile-menu .profile-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--clr-border);
    margin-bottom: 0.75rem;
  }
  .mobile-menu-avatar .avatar {
    width: 2.5rem;
    height: 2.5rem;
  }
  .mobile-menu .profile-name {
    display: block;
    font-weight: 600;
    font-size: 0.9rem;
  }
  .mobile-menu .profile-email {
    display: block;
    font-size: 0.75rem;
    color: var(--clr-text-muted);
  }
  .mobile-menu-items {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .mobile-menu-items button {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.6rem 0.5rem;
    border: none;
    background: none;
    border-radius: 8px;
    font-size: 0.85rem;
    color: var(--clr-text);
    cursor: pointer;
    transition: background 0.15s;
    font-family: inherit;
  }
  .mobile-menu-items button:hover,
  .mobile-menu-items button:active {
    background: var(--clr-bg);
  }
  .mobile-menu-items .menu-danger {
    color: #ef4444;
  }
  .mobile-menu-items .menu-logout {
    color: var(--clr-text-muted);
    margin-top: 0.25rem;
    padding-top: 0.6rem;
    border-top: 1px solid var(--clr-border);
    border-radius: 0;
  }
}

@media (max-width: 480px) {
  .header-left {
    gap: 0.3rem;
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
}
</style>
