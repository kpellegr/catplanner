<template>
  <div class="db">
    <!-- Nog in te dienen -->
    <div v-if="nogInTeDienenCount" class="db-alert" :class="{ 'db-alert-link': !isMobile }" @click="gaNaarInTeDienen">
      <span class="db-alert-count">{{ nogInTeDienenCount }}</span>
      <span class="db-alert-text">{{ nogInTeDienenCount === 1 ? 'taak' : 'taken' }} klaar maar nog niet ingediend</span>
    </div>

    <!-- Grafieken naast elkaar -->
    <div class="db-charts">
      <div class="db-chart">
        <WeekGrid compact @cel-click="gaNaarDag" />
      </div>
      <div class="db-chart">
        <BurndownChart :show-labels="false" fill />
      </div>
    </div>

    <!-- Status samenvatting -->
    <div class="db-stats">
      <h3 class="db-stats-title">Samenvatting</h3>
      <div v-if="ingediendCount" class="db-stat">
        <span class="db-stat-count db-count-ingediend">{{ ingediendCount }}</span>
        <span class="db-stat-label">ingediend</span>
        <span class="db-stat-min db-min-ingediend">{{ ingediendMin }}'</span>
        <button v-if="!isMobile" class="db-stat-link" @click="gaNaarIngediend" title="Bekijk in kanban"><Icon icon="mdi:arrow-right-circle-outline" width="16" height="16" /></button>
      </div>
      <div v-if="klaarCount" class="db-stat">
        <span class="db-stat-count db-count-klaar">{{ klaarCount }}</span>
        <span class="db-stat-label">klaar</span>
        <span class="db-stat-min db-min-klaar">{{ klaarMin }}'</span>
        <button v-if="!isMobile" class="db-stat-link" @click="gaNaarKlaar" title="Bekijk in te dienen"><Icon icon="mdi:arrow-right-circle-outline" width="16" height="16" /></button>
      </div>
      <div class="db-stat">
        <span class="db-stat-count db-count-blauw">{{ geplandCount }}</span>
        <span class="db-stat-label">gepland</span>
        <span class="db-stat-min db-min-blauw">{{ geplandMin }}'</span>
        <button v-if="!isMobile" class="db-stat-link" @click="gaNaarGepland" title="Bekijk in kanban"><Icon icon="mdi:arrow-right-circle-outline" width="16" height="16" /></button>
      </div>
      <div v-if="overdueCount" class="db-stat">
        <span class="db-stat-count db-count-oranje">{{ overdueCount }}</span>
        <span class="db-stat-label">overdue</span>
        <span class="db-stat-min db-min-oranje">{{ overdueMin }}'</span>
        <button v-if="!isMobile" class="db-stat-link" @click="gaNaarOverdue" title="Bekijk overdue taken"><Icon icon="mdi:arrow-right-circle-outline" width="16" height="16" /></button>
      </div>
      <div v-if="ongeplandCount" class="db-stat">
        <span class="db-stat-count db-count-rood">{{ ongeplandCount }}</span>
        <span class="db-stat-label">niet ingepland</span>
        <span class="db-stat-min db-min-rood">{{ ongeplandMin }}'</span>
        <button v-if="!isMobile" class="db-stat-link" @click="gaNaarOngepland" title="Bekijk in weekplanner"><Icon icon="mdi:arrow-right-circle-outline" width="16" height="16" /></button>
      </div>
      <div class="db-stat db-stat-totaal">
        <span class="db-stat-count">{{ totaalCount }}</span>
        <span class="db-stat-label"></span>
        <span class="db-stat-min">{{ totaalMin }}'</span>
        <span v-if="!isMobile" class="db-stat-link-spacer"></span>
      </div>
    </div>

    <!-- Gisteren -->
    <div class="db-section">
      <h3 class="db-heading" @click="open.gisteren = !open.gisteren">
        <span class="db-chevron" :class="{ 'db-chevron-open': open.gisteren }">&#9656;</span>
        Gisteren ({{ gisterenDagVol }})
        <span class="db-heading-meta">· {{ gisterenKlaarMin }}' afgewerkt</span>
      </h3>
      <template v-if="open.gisteren">
        <div v-if="!gisterenTaken.length" class="db-empty">Geen taken gepland</div>
        <div v-for="taak in gisterenTaken" :key="taak.id" class="db-taak" :class="taakClass(taak, true)">
          <div class="db-taak-top">
            <span class="db-taak-code">{{ taak.code || shortVak(taak) }}</span>
            <span class="db-taak-badges">
              <span class="db-taak-duur">
                <template v-if="taak.tijd?.type === 'minuten'">{{ taakMin(taak) }}'</template>
                <template v-else-if="taak.tijd?.type === 'rooster'">R</template>
              </span>
              <span class="db-taak-status" :class="'db-status-' + statusLabel(taak, true).cls" @click.stop="toggleKlaar(taak)">{{ statusLabel(taak, true).text }}</span>
            </span>
          </div>
          <div class="db-taak-omschrijving">{{ taak.omschrijving }}</div>
        </div>
      </template>
    </div>

    <!-- Vandaag -->
    <div class="db-section">
      <h3 class="db-heading" @click="open.vandaag = !open.vandaag">
        <span class="db-chevron" :class="{ 'db-chevron-open': open.vandaag }">&#9656;</span>
        Vandaag ({{ vandaagDagVol }})
        <span class="db-heading-meta">· {{ vandaagOpenMin }}' gepland</span>
      </h3>
      <template v-if="open.vandaag">
        <div v-if="!vandaagTaken.length" class="db-empty">Geen taken gepland</div>
        <div v-for="taak in vandaagTaken" :key="taak.id" class="db-taak" :class="taakClass(taak, false)">
          <div class="db-taak-top">
            <span class="db-taak-code">{{ taak.code || shortVak(taak) }}</span>
            <span class="db-taak-badges">
              <span class="db-taak-duur">
                <template v-if="taak.tijd?.type === 'minuten'">{{ taakMin(taak) }}'</template>
                <template v-else-if="taak.tijd?.type === 'rooster'">R</template>
              </span>
              <span class="db-taak-status" :class="'db-status-' + statusLabel(taak, false).cls" @click.stop="toggleKlaar(taak)">{{ statusLabel(taak, false).text }}</span>
            </span>
          </div>
          <div class="db-taak-omschrijving">{{ taak.omschrijving }}</div>
        </div>
      </template>
    </div>

    <!-- Rest van de week -->
    <div v-if="restTaken.length" class="db-section">
      <h3 class="db-heading" @click="open.rest = !open.rest">
        <span class="db-chevron" :class="{ 'db-chevron-open': open.rest }">&#9656;</span>
        Rest van de week
        <span class="db-heading-meta">· {{ restOpenMin }}' gepland</span>
      </h3>
      <template v-if="open.rest">
        <div v-for="taak in restTaken" :key="taak.id" class="db-taak" :class="taakClass(taak, false)">
          <div class="db-taak-top">
            <span class="db-taak-code">{{ taak.code || shortVak(taak) }}</span>
            <span class="db-taak-badges">
              <span class="db-taak-duur">
                <template v-if="taak.tijd?.type === 'minuten'">{{ taakMin(taak) }}'</template>
                <template v-else-if="taak.tijd?.type === 'rooster'">R</template>
              </span>
              <span class="db-taak-status" :class="'db-status-' + statusLabel(taak, false).cls" @click.stop="toggleKlaar(taak)">{{ statusLabel(taak, false).text }}</span>
            </span>
          </div>
          <div class="db-taak-omschrijving">{{ taak.omschrijving }}</div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue';
import { Icon } from '@iconify/vue';
import { usePlanner } from '../stores/planner.js';
import WeekGrid from './WeekGrid.vue';
import BurndownChart from './BurndownChart.vue';

const { alleTaken, state, updateVoortgang, filters, activeView, resetFilters, wpViewMode, wpFocusDag, wpFocusBlok } = usePlanner();

const isMobile = ref(window.innerWidth <= 700);

function gaNaarInTeDienen() {
  if (isMobile.value) return;
  resetFilters();
  filters.inTeDienen = true;
  activeView.value = 'kanban';
}

function gaNaarIngediend() {
  if (isMobile.value) return;
  resetFilters();
  filters.inTeDienen = false;
  // Focus on ingediend column (idx 3) — we use a temporary marker
  filters._kanbanFocus = 3;
  activeView.value = 'kanban';
}

function gaNaarKlaar() {
  if (isMobile.value) return;
  resetFilters();
  filters.inTeDienen = true;
  activeView.value = 'kanban';
}

function gaNaarGepland() {
  if (isMobile.value) return;
  resetFilters();
  filters._kanbanFocus = 0;
  activeView.value = 'kanban';
}

function gaNaarOverdue() {
  if (isMobile.value) return;
  resetFilters();
  filters.overdue = true;
  filters._kanbanFocus = 0;
  activeView.value = 'kanban';
}

function gaNaarOngepland() {
  if (isMobile.value) return;
  resetFilters();
  filters.alleenOngepland = true;
  activeView.value = 'weekplan';
  wpViewMode.value = 'week';
}

function gaNaarDag({ dag, uur }) {
  if (dag === '_') {
    gaNaarOngepland();
    return;
  }
  resetFilters();
  wpFocusDag.value = dag;
  wpFocusBlok.value = uur * 4; // uur (0-based) → blok (15-min slot)
  wpViewMode.value = 'dag';
  activeView.value = 'weekplan';
}

const open = reactive({ gisteren: true, vandaag: false, rest: false });

const dagen = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
const dagenVol = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'];

const now = new Date();
const jsDay = now.getDay();
const dagMap = [6, 0, 1, 2, 3, 4, 5];
const vandaagIdx = dagMap[jsDay];
const vandaagDag = dagen[vandaagIdx] || 'ma';
const vandaagDagVol = dagenVol[vandaagIdx] || 'maandag';
const gisterenIdx = vandaagIdx > 0 ? vandaagIdx - 1 : 6;
const gisterenDag = dagen[gisterenIdx];
const gisterenDagVol = dagenVol[gisterenIdx];

function isKlaar(taak) {
  return taak.voortgang.status === 'klaar' || taak.voortgang.status === 'ingediend';
}

function taakMin(taak) {
  return taak.voortgang.customMinuten || (taak.tijd?.type === 'minuten' ? taak.tijd.minuten : 0);
}

function isDagVerleden(dag) {
  return dagen.indexOf(dag) < vandaagIdx;
}

const ingediendCount = computed(() =>
  alleTaken.value.filter(t => t.voortgang.status === 'ingediend').length
);
const ingediendMin = computed(() =>
  alleTaken.value.filter(t => t.voortgang.status === 'ingediend').reduce((s, t) => s + taakMin(t), 0)
);
const klaarCount = computed(() =>
  alleTaken.value.filter(t => t.voortgang.status === 'klaar').length
);
const klaarMin = computed(() =>
  alleTaken.value.filter(t => t.voortgang.status === 'klaar').reduce((s, t) => s + taakMin(t), 0)
);
const nogInTeDienenCount = computed(() => klaarCount.value);
const totaalMin = computed(() =>
  alleTaken.value.reduce((s, t) => s + taakMin(t), 0)
);
const totaalCount = computed(() => alleTaken.value.length);
const geplandCount = computed(() =>
  alleTaken.value.filter(t => !isKlaar(t) && t.geplandOp).length
);
const geplandMin = computed(() =>
  alleTaken.value.filter(t => !isKlaar(t) && t.geplandOp).reduce((s, t) => s + taakMin(t), 0)
);

const overdueTaken = computed(() =>
  alleTaken.value.filter(t => t.geplandOp && isDagVerleden(t.geplandOp) && !isKlaar(t))
);
const overdueCount = computed(() => overdueTaken.value.length);
const overdueMin = computed(() =>
  overdueTaken.value.reduce((s, t) => s + taakMin(t), 0)
);

const ongeplandeTaken = computed(() =>
  alleTaken.value.filter(t => !t.geplandOp && !isKlaar(t))
);
const ongeplandCount = computed(() => ongeplandeTaken.value.length);
const ongeplandMin = computed(() =>
  ongeplandeTaken.value.reduce((s, t) => s + taakMin(t), 0)
);

const gisterenTaken = computed(() =>
  alleTaken.value.filter(t => t.geplandOp === gisterenDag)
);
const gisterenKlaarMin = computed(() =>
  gisterenTaken.value.filter(isKlaar).reduce((s, t) => s + taakMin(t), 0)
);

const vandaagTaken = computed(() =>
  alleTaken.value.filter(t => t.geplandOp === vandaagDag)
);
const vandaagOpenMin = computed(() =>
  vandaagTaken.value.filter(t => !isKlaar(t)).reduce((s, t) => s + taakMin(t), 0)
);

const restTaken = computed(() =>
  alleTaken.value.filter(t => {
    if (!t.geplandOp) return false;
    return dagen.indexOf(t.geplandOp) > vandaagIdx;
  })
);
const restOpenMin = computed(() =>
  restTaken.value.filter(t => !isKlaar(t)).reduce((s, t) => s + taakMin(t), 0)
);

function shortVak(taak) {
  const v = taak.vak || taak.sectie || '';
  if (!v) return '?';
  return v.split(/[\s/]+/)[0].substring(0, 4).toUpperCase();
}

function statusLabel(taak, isVerleden) {
  if (taak.voortgang.status === 'ingediend') return { text: 'INGEDIEND', cls: 'ingediend' };
  if (taak.voortgang.status === 'klaar') return { text: 'KLAAR', cls: 'klaar' };
  if (taak.voortgang.status === 'bezig') return { text: 'BEZIG', cls: 'bezig' };
  if (isVerleden || (taak.geplandOp && isDagVerleden(taak.geplandOp))) return { text: 'OVERDUE', cls: 'gemist' };
  return { text: 'OPEN', cls: 'open' };
}

function taakClass(taak, isVerleden) {
  if (taak.voortgang.status === 'ingediend') return 'db-taak-ingediend';
  if (taak.voortgang.status === 'klaar') return 'db-taak-klaar';
  if (isVerleden || (taak.geplandOp && isDagVerleden(taak.geplandOp))) return 'db-taak-gemist';
  if (taak.tijd?.type === 'rooster') return 'db-taak-rooster';
  return 'db-taak-huiswerk';
}

function toggleKlaar(taak) {
  const nieuw = isKlaar(taak) ? 'open' : 'klaar';
  updateVoortgang(taak.id, { status: nieuw });
}
</script>

<style scoped>
.db {
  max-width: 900px;
  margin: 0 auto;
}

/* Charts side by side */
.db-charts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--clr-border);
}
.db-chart {
  min-width: 0;
}
.db-chart :deep(.wg) {
  max-width: none;
  padding: 0;
  margin: 0;
}
.db-chart :deep(.bd) {
  max-width: none;
  padding: 0;
}
.db-chart :deep(.wg-cel) {
  cursor: pointer;
}
.db-chart :deep(.wg-cel:hover) {
  opacity: 0.7;
}
/* Override tooltip position: show above instead of below on dashboard */
.db-chart :deep([data-tooltip-pos="bottom"])::after {
  bottom: calc(100% + 6px);
  top: auto;
}

@media (max-width: 700px) {
  .db-charts {
    grid-template-columns: 1fr;
  }
}

/* Alert: nog in te dienen */
.db-alert {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.6rem;
  margin-bottom: 0.5rem;
  background: #fffbeb;
  border: 1px solid #fbbf24;
  border-radius: 0.4rem;
}
.db-alert-count {
  font-size: 0.8rem;
  font-weight: 800;
  color: #b45309;
}
.db-alert-text {
  font-size: 0.7rem;
  font-weight: 600;
  color: #92400e;
}
.db-alert-link {
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.db-alert-link:hover {
  background: #fef3c7;
  border-color: #f59e0b;
}

/* Sections */
.db-section {
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--clr-border);
}

/* Stats row */
.db-stats {
  display: flex;
  flex-direction: column;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--clr-border);
  max-width: 320px;
}
.db-stats-title {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--clr-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 0 0 0.25rem;
}
.db-stat {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0;
  border-bottom: 1px solid rgba(0,0,0,0.04);
}
.db-stat:last-child {
  border-bottom: none;
}
.db-stat-count {
  font-size: 0.85rem;
  font-weight: 700;
  min-width: 1.8em;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.db-count-ingediend { color: #059669; }
.db-count-klaar { color: #4ade80; }
.db-count-blauw { color: #93c5fd; }
.db-count-rood { color: #f87171; }
.db-count-oranje { color: #fbbf24; }
.db-stat-label {
  font-size: 0.85rem;
  color: var(--clr-text-muted);
}
.db-stat-min {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--clr-text-muted);
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}
.db-min-ingediend { color: #059669; }
.db-min-klaar { color: #4ade80; }
.db-min-blauw { color: #93c5fd; }
.db-min-rood { color: #f87171; }
.db-min-oranje { color: #fbbf24; }
.db-stat-link {
  background: none;
  border: none;
  padding: 0;
  margin: 0 0 0 0.25rem;
  cursor: pointer;
  color: var(--clr-text-muted);
  opacity: 0.4;
  transition: opacity 0.15s, color 0.15s;
  display: flex;
  align-items: center;
  flex-shrink: 0;
}
.db-stat-link:hover {
  opacity: 1;
  color: var(--clr-accent, #6366f1);
}
.db-stat-link-spacer {
  width: 16px;
  margin: 0 0 0 0.25rem;
  flex-shrink: 0;
}
.db-stat-totaal {
  border-top: 1px solid var(--clr-border);
  margin-top: 0.15rem;
  padding-top: 0.4rem;
}

/* Section heading */
.db-heading {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--clr-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 0;
  padding: 0.4rem 0 0.2rem;
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  gap: 4px;
}
.db-heading:hover {
  color: var(--clr-text);
}
.db-chevron {
  font-size: 0.7rem;
  transition: transform 0.15s;
  display: inline-block;
}
.db-chevron-open {
  transform: rotate(90deg);
}
.db-heading-meta {
  text-transform: none;
  font-weight: 400;
  letter-spacing: 0;
}

.db-empty {
  font-size: 0.8rem;
  color: var(--clr-text-muted);
  font-style: italic;
  padding: 0.5rem 0;
}

/* Taak — twee-regelig, typografisch */
.db-taak {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 0.4rem 0.6rem 0.4rem 0.75rem;
  border-left: 3px solid transparent;
  background: white;
  margin: 2px 0;
}
.db-taak-ingediend {
  border-left-color: #059669;
  opacity: 0.5;
}
.db-taak-klaar {
  border-left-color: #4ade80;
  border-left-style: dashed;
  opacity: 0.7;
}
.db-taak-gemist {
  border-left-color: #fbbf24;
}
.db-taak-rooster {
  border-left-color: #c4b5fd;
}
.db-taak-huiswerk {
  border-left-color: #93c5fd;
}

.db-taak-top {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.db-taak-code {
  font-weight: 700;
  font-size: 0.85rem;
}
.db-taak-badges {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
}
.db-taak-omschrijving {
  font-size: 0.8rem;
  color: var(--clr-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.db-taak-ingediend .db-taak-omschrijving {
  text-decoration: line-through;
  text-decoration-color: #059669;
}
.db-taak-klaar .db-taak-omschrijving {
  text-decoration: line-through;
  text-decoration-color: #4ade80;
}

/* Duur */
.db-taak-duur {
  font-size: 0.7rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--clr-text-muted);
}

/* Status badge */
.db-taak-status {
  font-size: 0.65rem;
  font-weight: 700;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.db-taak-status:active {
  opacity: 0.6;
}
.db-status-ingediend {
  color: #059669;
  background: #ecfdf5;
}
.db-status-klaar {
  color: #4ade80;
  background: #f0fdf9;
}
.db-status-bezig {
  color: #b45309;
  background: #fffbeb;
}
.db-status-gemist {
  color: #f59e0b;
  background: #fffbeb;
}
.db-status-open {
  color: var(--clr-text-muted);
  background: var(--clr-bg);
}
</style>
