<template>
  <div class="weekplan">
    <!-- Toolbar: FilterBar + vak filter + action buttons -->
    <FilterBar :ongepland-count="ongeplandCount" :vandaag-count="vandaagCount" :overdue-count="overdueCount" :in-te-dienen-count="inTeDienenCount" :conflict-count="conflictCount">
      <template #expand>
        <button class="btn-expand" @click="poolRef?.toggleAlles()" :title="poolRef?.allesOpen ? 'Alles dichtklappen' : 'Alles openklappen'">
          <span class="expand-icon" :class="{ open: poolRef?.allesOpen }">&#9656;</span>
        </button>
      </template>
      <template #actions>
        <div v-if="activeVakFilter" class="wp-vak-chip">
          <span class="wp-vak-chip-label">{{ activeVakFilter }}</span>
          <button class="wp-vak-chip-clear" @click="clearVakFilter">&times;</button>
        </div>
        <div class="wp-toolbar-actions">
          <button class="wp-sb-icon-btn" @click="autoSuggest" title="Rooster-taken automatisch inplannen">
            <Icon icon="mdi:lightning-bolt" width="14" height="14" />
          </button>
          <button v-if="hasGeplande" class="wp-sb-icon-btn wp-sb-icon-danger" @click="resetWeekplan" title="Weekplanning wissen">
            <Icon icon="mdi:delete-outline" width="14" height="14" />
          </button>
        </div>
      </template>
    </FilterBar>

    <!-- Connected header bar: pool header + gutter + day headers -->
    <div class="wp-connected-header" :style="{ paddingRight: scrollbarWidth + 'px' }">
      <div class="wp-pool-header" :style="{ width: poolWidth + 'px' }">
        <span class="wp-pool-count"><strong>{{ ongeplandCount }}</strong> ongepland <span class="wp-pool-total">/ {{ alleTaken.length }}</span></span>
        <span class="wp-pool-minuten">{{ poolRef?.totalMinuten ?? 0 }}'</span>
        <div class="wp-pool-resize-handle" @mousedown.prevent="onPoolResizeStart"></div>
      </div>
      <div class="wp-time-gutter-header"></div>
      <div
        v-for="dag in zichtbareDagen"
        :key="'h-' + dag"
        class="wp-col-header"
        :class="{
          'is-weekend': dag === 'za' || dag === 'zo',
          'is-vandaag': dag === vandaagDag,
          'is-focus': viewMode === 'dag',
        }"
      >
        <template v-if="viewMode === 'dag'">
          <div class="wp-focus-header">
            <button class="wp-nav-btn" @click.stop="navigeerDag(-1)" title="Vorige dag">&lsaquo;</button>
            <span class="wp-col-naam">{{ dagLang[dag] }}</span>
            <button class="wp-nav-btn" @click.stop="navigeerDag(1)" title="Volgende dag">&rsaquo;</button>
          </div>
        </template>
        <template v-else>
          <span class="wp-col-naam">{{ dagKort[dag] }}</span>
        </template>
        <span class="wp-col-cap" :class="capaciteitClass(dag)">{{ geplandMinuten(dag) }}' / {{ beschikbareMinuten(dag) }}'</span>
      </div>
    </div>

    <!-- Content: pool + timeline side by side -->
    <div class="wp-layout" :class="{ 'is-dragging-mode': !!draggingTaak, 'is-dragging-rooster': draggingTaak?.tijd?.type === 'rooster' }">
      <!-- Sidebar: unplanned tasks (headerless — header is above) -->
      <TakenPool
        ref="poolRef"
        :taken="gefilterdeOngeplande"
        titel="Ongepland"
        headerless
        :width="poolWidth"
        :resizable="false"
        :read-only="isReadOnly"
        :is-drag-over="dragOverTarget === '__pool__'"
        :selected-taak-id="selectedTaakId"
        :dragging-taak-id="draggingTaak?.id"
        :taak-keten="taakKeten"
        :keten-tooltip="ketenTooltipWP"
        :keten-stap-kleur="ketenStapKleur"
        :drag-related-class-fn="dragRelatedClass"
        :format-duur-fn="formatDuur"
        :duur-tooltip-fn="duurTooltip"
        :gepland-label-fn="geplandLabel"
        :is-rooster-les-fn="isRoosterOpLes"
        :is-overdue-fn="isOverdue"
        @dragenter="dragOverTarget = '__pool__'"
        @dragleave="onDragLeave($event, '__pool__')"
        @drop="onDropPool($event)"
        @card-click="selectTaak"
        @card-dragstart="(e, taak) => onDragStart(e, taak)"
        @card-dragend="onDragEnd"
        @card-toggle-klaar="toggleKlaar"
        @card-cycle-status="cycleStatus"
      >
        <template #empty>
          Alle taken ingepland!
        </template>
      </TakenPool>

      <!-- Main area -->
      <div class="wp-main">
        <!-- Timeline grid: gutter + day columns -->
        <div class="wp-timeline-wrap">

          <!-- Scrollable timeline -->
          <div ref="timelineRowRef" class="wp-timeline-row">
            <!-- Time gutter -->
            <div class="wp-time-gutter" :style="{ height: TOTAL_PX + 'px' }">
              <span
                v-for="h in 14"
                :key="'t-' + h"
                class="wp-time-label"
                :style="{ top: ((h - 1) * BLOKKEN_PER_UUR + 2) * BLOK_PX + 'px' }"
              >{{ h + 8 }}</span>
            </div>
            <!-- Day columns -->
            <div
              v-for="dag in zichtbareDagen"
              :key="dag"
              class="wp-tl-col"
              :class="[
                {
                  'wp-tl-dragover': dragOverTarget === dag,
                  'is-weekend': dag === 'za' || dag === 'zo',
                  'is-vandaag': dag === vandaagDag,
                  'is-focus': viewMode === 'dag',
                },
                dragOverTarget === dag ? dropIndicatorClass(dag) : ''
              ]"
              @dragover.prevent="onDragOverTimeline($event, dag)"
              @dragenter.prevent="dragOverTarget = dag"
              @dragleave="onDragLeave($event, dag)"
              @drop="onDropTimeline($event, dag)"
            >
              <!-- Timeline body -->
              <div class="wp-tl-body" :style="{ height: TOTAL_PX + 'px' }">
                <!-- Hour grid lines -->
                <div
                  v-for="h in 14"
                  :key="'grid-' + h"
                  class="wp-grid-line"
                  :style="{ top: (h - 1) * BLOKKEN_PER_UUR * BLOK_PX + 'px' }"
                ></div>

                <!-- Rooster background bands -->
                <div
                  v-for="slot in roosterSlots(dag)"
                  :key="'r-' + slot.uur"
                  class="wp-rooster-band"
                  :class="[`wp-band-${slot.type}`, bandDropStatus(slot, dag), { 'wp-band-selected': isBandSelected(slot), 'wp-band-drag-match': isBandDragMatch(slot) }]"
                  :style="slotStyle(slot)"
                  @click="slot.type === 'les' ? toggleVakFilter(slot.titel) : null"
                >
                  <span class="wp-band-label">{{ kortLabel(slot.titel) }}</span>
                  <Icon v-if="isBandDragMatch(slot)" icon="mdi:target" class="band-drop-icon" :class="bandDropStatus(slot, dag)" />
                </div>


                <!-- Drop indicator -->
                <div
                  v-if="dragOverTarget === dag && dropBlok !== null"
                  class="wp-drop-indicator"
                  :class="dropIndicatorClass(dag)"
                  :style="{ top: dropBlok * BLOK_PX + 'px', height: draggingTaakBlokken * BLOK_PX + 'px' }"
                >
                  <Icon icon="mdi:target" class="drop-icon" />
                </div>

                <!-- "Nu" indicator line -->
                <div
                  v-if="dag === vandaagDag && nuBlok >= 0"
                  class="wp-nu-line"
                  :style="{ top: nuBlok * BLOK_PX + 'px' }"
                >
                  <span class="wp-nu-dot"></span>
                  <span class="wp-nu-time">{{ nuTijd }}</span>
                </div>

                <!-- Deadline indicator: zondag 21:00 = "Indienen!" -->
                <div
                  v-if="dag === 'zo'"
                  class="wp-nu-line wp-deadline-line"
                  :style="{ top: DEADLINE_BLOK * BLOK_PX + 'px' }"
                >
                  <span class="wp-deadline-label">{{ deadlineLabel }}</span>
                </div>

                <!-- Placed tasks -->
                <div
                  v-for="placed in geplaatstetaken(dag)"
                  :key="placed.taak.id"
                  class="wp-tl-taak"
                  :class="[
                    hoofdgroepClass(placed.taak),
                    statusClass(placed.taak),
                    dragRelatedClass(placed.taak),
                    {
                      'is-rooster-les': isRoosterOpLes(placed.taak),
                      'is-rooster': placed.taak.tijd?.type === 'rooster' && !isRoosterOpLes(placed.taak),
                      'is-huistaak': placed.taak.tijd?.type !== 'rooster',
                      'is-klaar': placed.taak.voortgang.status === 'klaar' || placed.taak.voortgang.status === 'ingediend',
                      'is-overdue': isOverdue(placed.taak),
                      'is-in-te-dienen': placed.taak.voortgang.status === 'klaar',
                      'is-selected': selectedTaakId === placed.taak.id,
                      dragging: draggingTaak?.id === placed.taak.id,
                    }
                  ]"
                  :style="{ top: placed.blok * BLOK_PX + 'px', height: placed.blokken * BLOK_PX + 'px' }"
                  :draggable="!isReadOnly"
                  :title="compactTooltip(placed.taak)"
                  @click="selectTaak(placed.taak)"
                  @dragstart="onDragStart($event, placed.taak)"
                  @dragend="onDragEnd"
                >
                  <!-- Full card in day view (matches kanban card style) -->
                  <template v-if="viewMode === 'dag'">
                    <div class="tl-day-card">
                      <div class="kaart-top">
                        <button
                          class="tl-check-btn"
                          :class="{ checked: placed.taak.voortgang.status === 'klaar' || placed.taak.voortgang.status === 'ingediend' }"
                          :title="placed.taak.voortgang.status === 'klaar' ? 'Markeer als open' : 'Markeer als klaar'"
                          @click.stop="toggleKlaar(placed.taak)"
                        >✓</button>
                        <span v-if="placed.taak.code" class="code">{{ placed.taak.code }}</span>
                        <span v-if="taakKeten(placed.taak)" class="kaart-keten" :title="ketenTooltipWP(placed.taak)">
                          <template v-for="(stap, si) in taakKeten(placed.taak)" :key="stap.id">
                            <span class="keten-stap" :class="[ketenStapKleur(stap, placed.taak), { 'keten-eigen': stap.id === placed.taak.id }]">{{ stap.volgorde }}</span>
                            <span v-if="si < taakKeten(placed.taak).length - 1" class="keten-pijl">→</span>
                          </template>
                        </span>
                        <div class="flags">
                          <span v-for="f in placed.taak.flags" :key="f" class="flag" :title="flagTooltips[f] || f">{{ f }}</span>
                        </div>
                        <span class="kaart-duur prominent" :class="{ 'tl-duur-custom': isCustomDuur(placed.taak) }" @dblclick.stop="resetCustomDuur(placed.taak)">{{ formatDuur(placed.taak) }}</span>
                        <button v-if="placed.taak.voortgang.status !== 'klaar' && placed.taak.voortgang.status !== 'ingediend'" class="tl-unplan" @click.stop="unplan(placed.taak)">&times;</button>
                      </div>
                      <p class="kaart-tekst">{{ placed.taak.omschrijving }}</p>
                      <span v-if="placed.taak.geplandBlok != null" class="tl-gepland-label">{{ blokToTijd(placed.blok) }} – {{ blokToTijd(placed.blok + placed.blokken) }}</span>
                    </div>
                  </template>
                  <!-- Compact card in week view / side columns -->
                  <template v-else>
                    <div class="tl-compact-row">
                      <span class="tl-code">{{ placed.taak.code || kortVak(placed.taak.vak) }}</span>
                      <span v-if="taakKeten(placed.taak)" class="kaart-keten tl-keten" :title="ketenTooltipWP(placed.taak)">
                        <template v-for="(stap, si) in taakKeten(placed.taak)" :key="stap.id">
                          <span class="keten-stap" :class="[ketenStapKleur(stap, placed.taak), { 'keten-eigen': stap.id === placed.taak.id }]">{{ stap.volgorde }}</span>
                          <span v-if="si < taakKeten(placed.taak).length - 1" class="keten-pijl">→</span>
                        </template>
                      </span>
                      <span class="tl-duur" :class="{ 'tl-duur-custom': isCustomDuur(placed.taak) }" @dblclick.stop="resetCustomDuur(placed.taak)">{{ formatDuur(placed.taak) }}</span>
                      <button v-if="placed.taak.voortgang.status !== 'klaar' && placed.taak.voortgang.status !== 'ingediend'" class="tl-unplan" @click.stop="unplan(placed.taak)">&times;</button>
                    </div>
                  </template>
                  <!-- Resize handle -->
                  <div
                    v-if="!isReadOnly"
                    class="tl-resize-handle"
                    @mousedown.stop.prevent="onResizeStart($event, placed.taak, placed)"
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue';
import { Icon } from '@iconify/vue';
import { usePlanner } from '../stores/planner.js';
import { hoofdgroepClass, formatDuur as _formatDuur, duurTooltip as _duurTooltip, flagTooltips, useVolgordeKetens, useDragRelated } from '../composables/useTakenLogic.js';
import TakenPool from './TakenPool.vue';
import FilterBar from './FilterBar.vue';

const { state, alleTaken, planTaak, updateVoortgang, isReadOnly, wpViewMode, wpFocusDag, wpFocusBlok, selectedTaakId, selectTaak: globalSelectTaak, filters } = usePlanner();

const dagen = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
const dagKort = { ma: 'MA', di: 'DI', wo: 'WO', do: 'DO', vr: 'VR', za: 'ZA', zo: 'ZO' };
const dagLang = { ma: 'Maandag', di: 'Dinsdag', wo: 'Woensdag', do: 'Donderdag', vr: 'Vrijdag', za: 'Zaterdag', zo: 'Zondag' };

// ---- View mode (week / dag) — stored in planner store to survive remounts ----
const viewMode = wpViewMode;
const focusDag = wpFocusDag;

function setDayView() {
  viewMode.value = 'dag';
  if (!focusDag.value) focusDag.value = vandaagDag.value || 'ma';
}

function navigeerDag(offset) {
  const idx = dagen.indexOf(focusDag.value);
  const newIdx = Math.max(0, Math.min(dagen.length - 1, idx + offset));
  focusDag.value = dagen[newIdx];
}

const zichtbareDagen = computed(() => {
  if (viewMode.value === 'week') return dagen;
  const dag = focusDag.value || vandaagDag.value || 'ma';
  return [dag];
});

function colFlex() {
  return {};
}

// ---- Timeline constants ----
const BLOK_PX_WEEK = 22;
const BLOK_PX_DAG = 36;
const BLOK_PX = computed(() => viewMode.value === 'dag' ? BLOK_PX_DAG : BLOK_PX_WEEK);
const DEADLINE_BLOK = 50; // 21:00 = 12.5h after 8:30 = 750min / 15 = 50 blokken

const deadlineLabel = computed(() => {
  const nog = alleTaken.value.filter(t => t.voortgang?.status !== 'ingediend').length;
  if (nog === 0) return 'Alles ingediend!';
  return `nog ${nog} indienen`;
});
const BLOKKEN_PER_UUR = 4;   // 4 × 15 min = 60 min
const TOTAL_BLOKKEN = 14 * BLOKKEN_PER_UUR; // 56 blocks
const TOTAL_PX = computed(() => TOTAL_BLOKKEN * BLOK_PX.value);

// Deadline line: 21:00 on the timeline

const poolRef = ref(null);
const poolWidth = ref(280);
const timelineRowRef = ref(null);
const scrollbarWidth = ref(0);

// ---- Pool resize (header handle) ----
let poolResizeStartX = 0;
let poolResizeStartW = 0;

function onPoolResizeStart(e) {
  poolResizeStartX = e.clientX;
  poolResizeStartW = poolWidth.value;
  document.addEventListener('mousemove', onPoolResizeMove);
  document.addEventListener('mouseup', onPoolResizeEnd);
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
}
function onPoolResizeMove(e) {
  const dx = e.clientX - poolResizeStartX;
  poolWidth.value = Math.max(180, Math.min(500, poolResizeStartW + dx));
  // Sync TakenPool width
  if (poolRef.value) poolRef.value.currentWidth = poolWidth.value;
}
function onPoolResizeEnd() {
  document.removeEventListener('mousemove', onPoolResizeMove);
  document.removeEventListener('mouseup', onPoolResizeEnd);
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
}

const dragOverTarget = ref(null);
const draggingTaak = ref(null);
const dropBlok = ref(null);
const selectedVak = ref(null);       // rooster title filter (from band click)
const selectedVakDirect = ref(null);  // direct vak name filter (from task click)
// ---- Global filter check ----
function passeertFilters(taak) {
  // Type filter
  const isRooster = taak.tijd?.type === 'rooster';
  if (isRooster && !filters.rooster) return false;
  if (!isRooster && !filters.huistaken) return false;

  // Ongepland drill-down
  if (filters.alleenOngepland && taak.geplandOp) return false;

  // Vandaag drill-down
  if (filters.vandaag && taak.geplandOp !== vandaagDag.value) return false;

  // Status filter
  const status = taak.voortgang?.status || 'open';
  const gepland = !!taak.geplandOp;
  if (status === 'ingediend' && !filters.ingediend) return false;
  if (status === 'klaar' && !filters.klaar) return false;
  if ((status === 'open' || status === 'bezig') && gepland && !filters.gepland) return false;
  if ((status === 'open' || status === 'bezig') && !gepland && !filters.ongepland) return false;

  // Warning drill-down (any active warning filter = show ONLY matching)
  const anyWarning = filters.overdue || filters.inTeDienen || filters.conflict;
  if (anyWarning) {
    let matchesWarning = false;
    if (filters.overdue && isOverdue(taak)) matchesWarning = true;
    if (filters.inTeDienen && status === 'klaar') matchesWarning = true;
    if (filters.conflict) {
      const kleur = ketenStapKleur(taak);
      if (kleur === 'keten-rood') matchesWarning = true;
    }
    if (!matchesWarning) return false;
  }

  return true;
}

// ---- Helpers ----


function formatDuur(taak) {
  return _formatDuur(taak, { showCustom: true, defaultMinutes: 15 });
}

function duurTooltip(taak) {
  return _duurTooltip(taak, { defaultMinutes: 15 });
}

function compactTooltip(taak) {
  const parts = [];
  if (taak.code) parts.push(taak.code);
  if (taak.omschrijving) parts.push(taak.omschrijving);
  if (taak.voortgang?.customMinuten != null) parts.push(`${taak.voortgang.customMinuten} min (aangepast, dubbelklik duur om te resetten)`);
  else if (taak.tijd?.type === 'minuten') parts.push(`${taak.tijd.minuten} min`);
  else if (taak.tijd?.type === 'rooster') parts.push('Roosteruur');
  if (taak.flags?.length) parts.push(`Flags: ${taak.flags.map(f => flagTooltips[f] || f).join(', ')}`);
  if (taak.voortgang.status === 'klaar') parts.push('✓ Klaar');
  if (isOverdue(taak)) parts.push('⚠ Achterstand!');
  return parts.join('\n');
}

function blokToTijd(blok) {
  const min = blok * 15 + 8 * 60 + 30; // timeline starts at 8:30
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

function geplandLabel(taak) {
  if (!taak.geplandOp) return '';
  const dag = dagKort[taak.geplandOp] || taak.geplandOp;
  if (taak.geplandBlok != null) return `${dag} ${blokToTijd(taak.geplandBlok)}`;
  return dag;
}

function taakBlokken(taak) {
  if (taak.voortgang?.customMinuten != null) return Math.max(1, Math.ceil(taak.voortgang.customMinuten / 15));
  if (taak.tijd?.type === 'minuten') return Math.max(1, Math.ceil(taak.tijd.minuten / 15));
  if (taak.tijd?.type === 'rooster') return BLOKKEN_PER_UUR; // 1 hour default
  return 1; // default 15 min = 1 block
}

const draggingTaakBlokken = computed(() => {
  if (!draggingTaak.value) return 1;
  return taakBlokken(draggingTaak.value);
});


function statusClass(taak) { return `status-${taak.voortgang.status}`; }

// Abbreviate rooster band labels for compact display
const KORT_LABELS = {
  'wiskunde': 'WIS', 'wiskunde 6': 'WIS6', 'wiskunde 8': 'WIS8',
  'biologie': 'BIO', 'fysica': 'FY', 'chemie': 'CH',
  'nederlands': 'NED', 'frans': 'FRA', 'engels': 'ENG',
  'taal': 'TAAL', 'science@lab': 'S@L', 'lab@work': 'L@W', 'stem@lab': 'STEM',
  'stem project': 'STEM', 'zebra': 'ZEBRA', 'coaching': 'CO',
  'cultuur': 'CUL', 'cb': 'CUL', 'rb': 'RB',
  'pauze': 'PAUZE', 'volleybal': 'VOLLEY', 'badminton': 'BADM',
  'piano': 'PIANO', 'lo': 'LO',
};
// Abbreviate vak name for compact card display
const VAK_KORT = {
  'biologie': 'BIO', 'fysica': 'FY', 'chemie': 'CH',
  'nederlands': 'NED', 'frans': 'FRA', 'engels': 'ENG',
  'wiskunde 6': 'WIS6', 'wiskunde 8': 'WIS8', 'wiskunde': 'WIS',
  'burgerschap': 'CUL', 'cultuurbeschouwing': 'CUL',
  'ruimtelijk': 'RB', 'aardwetenschap': 'RB',
};
function kortVak(vak) {
  if (!vak) return '';
  const lower = vak.toLowerCase();
  for (const [key, kort] of Object.entries(VAK_KORT)) {
    if (lower.includes(key)) return kort;
  }
  // Extract first word, max 4 chars
  const first = vak.split(/[\s:]/)[0];
  return first.length > 5 ? first.slice(0, 4).toUpperCase() : first.toUpperCase();
}

function kortLabel(titel) {
  const lower = titel.toLowerCase();
  if (KORT_LABELS[lower]) return KORT_LABELS[lower];
  // Try prefix match
  for (const [key, kort] of Object.entries(KORT_LABELS)) {
    if (lower.startsWith(key) || key.startsWith(lower)) return kort;
  }
  // Fallback: first 4 chars uppercase
  return titel.slice(0, 5).toUpperCase();
}

// ---- Rooster ----

function roosterSlots(dag) {
  const slots = state.weekRooster?.[dag];
  if (!slots || typeof slots !== 'object') return [];
  return Object.entries(slots)
    .map(([uur, slot]) => ({ uur: parseInt(uur), ...slot }))
    .sort((a, b) => a.uur - b.uur);
}

function slotStyle(slot) {
  const startBlok = (slot.uur - 1) * BLOKKEN_PER_UUR;
  return {
    top: startBlok * BLOK_PX.value + 'px',
    height: BLOKKEN_PER_UUR * BLOK_PX.value + 'px',
  };
}

// Is an R-task placed on a matching lesson band?
function isRoosterOpLes(taak) {
  if (taak.tijd?.type !== 'rooster' || !taak.geplandOp || taak.geplandBlok == null) return false;
  const slots = roosterSlots(taak.geplandOp);
  for (const slot of slots) {
    if (slot.type !== 'les') continue;
    if (!matchesRoosterVak(taak, slot.titel)) continue;
    const bandStart = (slot.uur - 1) * BLOKKEN_PER_UUR;
    const bandEnd = bandStart + BLOKKEN_PER_UUR;
    // Task overlaps with this lesson band
    if (taak.geplandBlok < bandEnd && taak.geplandBlok + taakBlokken(taak) > bandStart) return true;
  }
  return false;
}

// ---- Volgtijdelijkheid (dependency chains) — via composable ----

const alleVakken = computed(() => {
  const map = new Map();
  for (const taak of alleTaken.value) {
    const vak = taak.vak || '';
    if (!map.has(vak)) map.set(vak, []);
    map.get(vak).push(taak);
  }
  return Array.from(map.entries()).map(([naam, taken]) => ({ naam, taken }));
});

const { taakKetenMap, taakKeten, ketenTooltip, relatedIds } = useVolgordeKetens(alleVakken);

const statusRank = { open: 0, bezig: 1, klaar: 2, ingediend: 3 };

// Temporal rank: earlier in the week = lower number
function temporalRank(taak) {
  if (!taak.geplandOp) return -1;
  const dagIndex = dagen.indexOf(taak.geplandOp);
  const blok = taak.geplandBlok ?? 0;
  return dagIndex * TOTAL_BLOKKEN + blok;
}

// Effective position during drag: previews where the dragged task would land
function effectiveGeplandOp(taak) {
  if (draggingTaak.value?.id === taak.id && dragOverTarget.value) {
    if (dragOverTarget.value === '__pool__') return null;
    return dragOverTarget.value;
  }
  return taak.geplandOp;
}

function effectiveTemporalRank(taak) {
  if (draggingTaak.value?.id === taak.id && dragOverTarget.value && dragOverTarget.value !== '__pool__' && dropBlok.value !== null) {
    const dagIndex = dagen.indexOf(dragOverTarget.value);
    return dagIndex * TOTAL_BLOKKEN + dropBlok.value;
  }
  return temporalRank(taak);
}

// Weekplanner-specific: uses temporal position (dag + blok) for conflict detection
// During drag, uses the preview position for live feedback
// Colors ALL steps in the chain — checks both predecessor AND successor
function ketenStapKleur(stap) {
  const keten = taakKetenMap.value.get(stap.id);
  if (!keten) return 'keten-grijs';
  const idx = keten.findIndex(t => t.id === stap.id);

  const gepland = effectiveGeplandOp(stap);
  if (!gepland) return 'keten-grijs';

  const stapTR = effectiveTemporalRank(stap);
  let hasConflict = false;
  let hasWarning = false;

  // Check predecessor (must be before this step)
  if (idx > 0) {
    const voor = keten[idx - 1];
    if (voor.voortgang.status !== 'klaar' && voor.voortgang.status !== 'ingediend') {
      const voorGepland = effectiveGeplandOp(voor);
      if (!voorGepland) hasWarning = true;
      else if (effectiveTemporalRank(voor) >= stapTR) hasConflict = true;
    }
  }

  // Check successor (must be after this step)
  if (idx < keten.length - 1) {
    const na = keten[idx + 1];
    if (na.voortgang.status !== 'klaar' && na.voortgang.status !== 'ingediend') {
      const naGepland = effectiveGeplandOp(na);
      if (naGepland && effectiveTemporalRank(na) <= stapTR) hasConflict = true;
    }
  }

  if (hasConflict) return 'keten-rood';
  if (hasWarning) return 'keten-oranje';
  return 'keten-groen';
}

// Enhanced tooltip with conflict info
function ketenTooltipWP(taak) {
  const base = ketenTooltip(taak);
  if (!base) return '';
  const kleur = ketenStapKleur(taak);
  if (kleur === 'keten-rood') return `${base}\n⚠ Volgorde-conflict: taken staan in verkeerde volgorde`;
  if (kleur === 'keten-oranje') return `${base}\n⚠ Voorganger nog niet ingepland`;
  return base;
}

const { dragRelatedClass } = useDragRelated(draggingTaak, relatedIds, taakKetenMap, ketenStapKleur);

// ---- Place tasks on timeline (no overlap) ----

function geplaatstetaken(dag) {
  const taken = alleTaken.value.filter(t => t.geplandOp === dag);
  if (!taken.length) return [];

  const result = [];

  for (const taak of taken) {
    const blokken = taakBlokken(taak);

    if (taak.geplandBlok !== null && taak.geplandBlok !== undefined) {
      let blok = taak.geplandBlok;
      if (overlapsWith(result, blok, blokken, taak.id)) {
        blok = findNonOverlapping(result, blok, blokken, taak.id);
      }
      result.push({ taak, blok, blokken });
    } else {
      // Rooster-taken: try matching lesson slot
      if (taak.tijd?.type === 'rooster') {
        const lesSlot = findMatchingLesSlot(dag, taak);
        if (lesSlot !== null) {
          const startBlok = (lesSlot - 1) * BLOKKEN_PER_UUR;
          if (!overlapsWith(result, startBlok, blokken, taak.id)) {
            result.push({ taak, blok: startBlok, blokken });
            continue;
          }
        }
      }
      const taakBezet = new Set();
      for (const r of result) {
        for (let b = r.blok; b < r.blok + r.blokken; b++) taakBezet.add(b);
      }
      const startBlok = findFreeGap(taakBezet, blokken);
      result.push({ taak, blok: startBlok, blokken });
    }
  }

  return result;
}

function overlapsWith(placed, blok, blokken, excludeId) {
  for (const p of placed) {
    if (p.taak.id === excludeId) continue;
    if (blok < p.blok + p.blokken && blok + blokken > p.blok) return true;
  }
  return false;
}

function findNonOverlapping(placed, preferredBlok, blokken, excludeId) {
  // Try nearby positions first (closest to preferred)
  for (let offset = 0; offset < TOTAL_BLOKKEN; offset++) {
    const down = preferredBlok + offset;
    if (down + blokken <= TOTAL_BLOKKEN && !overlapsWith(placed, down, blokken, excludeId)) return down;
    const up = preferredBlok - offset;
    if (up >= 0 && up + blokken <= TOTAL_BLOKKEN && !overlapsWith(placed, up, blokken, excludeId)) return up;
  }
  return preferredBlok;
}

function findMatchingLesSlot(dag, taak) {
  for (const slot of roosterSlots(dag)) {
    if (slot.type !== 'les') continue;
    if (matchesRoosterVak(taak, slot.titel)) return slot.uur;
  }
  return null;
}

function findFreeGap(taakBezet, needed) {
  for (let start = 0; start <= TOTAL_BLOKKEN - needed; start++) {
    let fits = true;
    for (let b = start; b < start + needed; b++) {
      if (taakBezet.has(b)) { fits = false; break; }
    }
    if (fits) return start;
  }
  return TOTAL_BLOKKEN - needed;
}

// ---- Unplanned tasks ----

function geplandeTaken(dag) {
  return alleTaken.value.filter(t => t.geplandOp === dag);
}

const alleOngeplande = computed(() => alleTaken.value);

// Warning counts for FilterBar badges
const vandaagCount = computed(() => alleTaken.value.filter(t => t.geplandOp === vandaagDag.value).length);
const overdueCount = computed(() => alleTaken.value.filter(t => isOverdue(t)).length);
const inTeDienenCount = computed(() => alleTaken.value.filter(t => t.voortgang?.status === 'klaar').length);
const conflictCount = computed(() => alleTaken.value.filter(t => ketenStapKleur(t) === 'keten-rood').length);

// Map rooster slot titles to task vak/hoofdgroep keywords
// Equivalenten:
// Hardcoded fallback maps (used when no configuratie is set)
const DEFAULT_ROOSTER_VAK_MAP = {
  'taal': ['nederlands', 'frans', 'engels', 'duits', 'taal'],
  'wiskunde': ['wiskunde 6', 'wiskunde 8', 'wiskunde'],
  'wiskunde 6': ['wiskunde 6', 'wiskunde'],
  'wiskunde 8': ['wiskunde 8', 'wiskunde'],
  'biologie': ['biologie'],
  'fysica': ['fysica'],
  'chemie': ['chemie'],
  'cultuur': ['burgerschap', 'cultuurbeschouwing', 'historisch'],
  'cb': ['burgerschap', 'cultuurbeschouwing', 'historisch'],
  'rb': ['ruimtelijk', 'aardwetenschap'],
  'science@lab': ['biologie', 'fysica', 'chemie', 'science', 'stem'],
  'lab@work': null,
  'stem@lab': ['stem'],
};
const DEFAULT_CODE_ROOSTER_MAP = {
  'hb': ['cultuur', 'cb'],
  'cb': ['cultuur', 'cb'],
  'aa': ['rb'],
};

// Dynamic rooster-vak map: built from configuratie if available, else fallback
const roosterVakMap = computed(() => {
  const config = state.configuratie;
  const vakken = config?.vakken;
  const wildcards = config?.wildcardTitels || [];
  if (!vakken || Object.keys(vakken).length === 0) return DEFAULT_ROOSTER_VAK_MAP;

  const map = {};
  // Build from vakken config: each vak's roosterTitels maps titel → [vak keywords]
  // Extract short vak name (before ":" or " - ") + full name for robust matching
  for (const [naam, vak] of Object.entries(vakken)) {
    if (!vak.actief) continue;
    const naamLower = naam.toLowerCase();
    const kort = naamLower.split(/[:–—]\s*/)[0].replace(/\s*$/, '');
    for (const titel of (vak.roosterTitels || [])) {
      if (!map[titel]) map[titel] = [];
      if (!map[titel].includes(naamLower)) map[titel].push(naamLower);
      if (kort !== naamLower && !map[titel].includes(kort)) map[titel].push(kort);
    }
  }
  // Add wildcards
  for (const wc of wildcards) {
    map[wc] = null; // null = matches all
  }
  // If map is empty (no koppelingen configured yet), fall back to defaults
  if (Object.keys(map).length === 0) return DEFAULT_ROOSTER_VAK_MAP;
  return map;
});

const codeRoosterMap = computed(() => {
  const config = state.configuratie;
  const vakken = config?.vakken;
  if (!vakken || Object.keys(vakken).length === 0) return DEFAULT_CODE_ROOSTER_MAP;

  const map = {};
  for (const [naam, vak] of Object.entries(vakken)) {
    if (!vak.actief) continue;
    for (const alias of (vak.aliassen || [])) {
      const lower = alias.toLowerCase();
      if (!map[lower]) map[lower] = [];
      for (const titel of (vak.roosterTitels || [])) {
        if (!map[lower].includes(titel)) map[lower].push(titel);
      }
    }
  }
  if (Object.keys(map).length === 0) return DEFAULT_CODE_ROOSTER_MAP;
  return map;
});

// Matching uses only configured koppelingen (from configuratie.vakken.roosterTitels)
// All fuzzy/heuristic matching happens at import time via autoKoppelVakken
function matchesRoosterVak(taak, roosterTitel) {
  const titel = roosterTitel.toLowerCase();
  const vak = (taak.vak || '').toLowerCase();
  const code = (taak.code || '').toLowerCase().replace(/[\d\s]+$/, '');

  const rvm = roosterVakMap.value;

  // Wildcard: matches any vak
  if (rvm[titel] === null) return true;

  // Check configured keywords for this rooster title
  const keywords = rvm[titel];
  if (keywords && vak) {
    for (const kw of keywords) {
      if (vak.includes(kw) || kw.includes(vak)) return true;
    }
  }

  // Code-based matching (e.g. "BIO" → "biologie")
  const crm = codeRoosterMap.value;
  if (code && crm[code]) {
    if (crm[code].includes(titel)) return true;
  }

  return false;
}

// Reverse: given a task, which rooster titles match it?
function matchingRoosterTitels(taak) {
  const result = new Set();
  const vak = (taak.vak || '').toLowerCase();
  const code = (taak.code || '').toLowerCase().replace(/[\d\s]+$/, '');

  const rvm = roosterVakMap.value;
  for (const [titel, keywords] of Object.entries(rvm)) {
    if (keywords === null) { result.add(titel); continue; }
    if (keywords && vak) {
      for (const kw of keywords) {
        if (vak.includes(kw) || kw.includes(vak)) { result.add(titel); break; }
      }
    }
  }

  const crm = codeRoosterMap.value;
  if (code && crm[code]) {
    for (const titel of crm[code]) {
      result.add(titel);
    }
  }

  return result;
}

const gefilterdeOngeplande = computed(() => {
  let taken = alleOngeplande.value.filter(passeertFilters);
  if (selectedVakDirect.value) {
    taken = taken.filter(t => t.vak === selectedVakDirect.value);
  } else if (selectedVak.value) {
    taken = taken.filter(t => matchesRoosterVak(t, selectedVak.value));
  }
  return taken.sort((a, b) => {
    const vakCmp = (a.vak || '').localeCompare(b.vak || '');
    if (vakCmp !== 0) return vakCmp;
    return (a.code || '').localeCompare(b.code || '');
  });
});

const ongeplandCount = computed(() => gefilterdeOngeplande.value.filter(t => !t.geplandOp).length);

const gefilterdeOngeplandMinuten = computed(() => {
  return gefilterdeOngeplande.value.reduce((sum, t) => (t.tijd?.type === 'minuten' ? sum + t.tijd.minuten : sum), 0);
});

function toggleVakFilter(titel) { selectedVak.value = selectedVak.value === titel ? null : titel; selectedVakDirect.value = null; globalSelectTaak(null); }

const activeVakFilter = computed(() => selectedVakDirect.value || selectedVak.value || null);

function clearVakFilter() {
  selectedVak.value = null;
  selectedVakDirect.value = null;
  globalSelectTaak(null);
}

function selectTaak(taak) {
  // If already selected, deselect
  if (selectedTaakId.value === taak.id) {
    globalSelectTaak(null);
    selectedVak.value = null;
    selectedVakDirect.value = null;
    return;
  }
  selectedVak.value = null;
  selectedVakDirect.value = taak.vak;
  globalSelectTaak(taak.id);
  // Ensure the vak group is open
  if (poolRef.value?.openVakken && poolRef.value.openVakken[taak.vak] === false) {
    poolRef.value.openVakken[taak.vak] = true;
  }
  // Scroll to the task in sidebar + timeline after DOM update
  nextTick(() => {
    const poolEl = document.querySelector(`.taken-pool [data-taak-id="${taak.id}"]`);
    if (poolEl) poolEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    const tlEl = document.querySelector(`.wp-tl-taak.is-selected`);
    if (tlEl) tlEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

// Band selection: clicked vak filter (matches equivalent vakken)
function isBandSelected(slot) {
  if (slot.type !== 'les' || !selectedVak.value) return false;
  const sel = selectedVak.value.toLowerCase();
  const titel = slot.titel.toLowerCase();
  // Direct match
  if (sel === titel) return true;
  // Check if both are equivalent (e.g. selectedVak='Taal' highlights 'Nederlands' band and vice versa)
  const rvm = roosterVakMap.value;
  const selKeywords = rvm[sel];
  if (selKeywords && selKeywords.includes(titel)) return true;
  if (selKeywords === null) return true;
  const titelKeywords = rvm[titel];
  if (titelKeywords && titelKeywords.includes(sel)) return true;
  if (titelKeywords === null) return true;
  return false;
}

// Band highlight during drag: highlight bands that match the dragged task
function isBandDragMatch(slot) {
  if (slot.type !== 'les' || !draggingTaak.value) return false;
  // Only highlight lesson bands for roostertaken, not for huistaken
  if (draggingTaak.value.tijd?.type !== 'rooster') return false;
  return matchesRoosterVak(draggingTaak.value, slot.titel);
}

// Chain conflict status if the dragged task were placed at this band's position
function bandDropStatus(slot, dag) {
  if (!isBandDragMatch(slot) || !draggingTaak.value) return '';
  const taak = draggingTaak.value;
  const keten = taakKetenMap.value.get(taak.id);
  if (!keten) return 'band-ok';
  const idx = keten.findIndex(t => t.id === taak.id);

  const bandBlok = (slot.uur - 1) * BLOKKEN_PER_UUR;
  const bandTR = dagen.indexOf(dag) * TOTAL_BLOKKEN + bandBlok;

  // Check predecessor (must be before this position)
  if (idx > 0) {
    const voor = keten[idx - 1];
    if (voor.voortgang.status !== 'klaar' && voor.voortgang.status !== 'ingediend') {
      const voorGepland = effectiveGeplandOp(voor);
      if (voorGepland && effectiveTemporalRank(voor) >= bandTR) return 'band-conflict';
    }
  }

  // Check successor (must be after this position)
  if (idx < keten.length - 1) {
    const na = keten[idx + 1];
    if (na.voortgang.status !== 'klaar' && na.voortgang.status !== 'ingediend') {
      const naGepland = effectiveGeplandOp(na);
      if (naGepland && effectiveTemporalRank(na) <= bandTR) return 'band-conflict';
    }
  }

  return 'band-ok';
}

// ---- Capacity ----

function beschikbareMinuten(dag) {
  const slots = roosterSlots(dag);
  const lesUren = slots.filter(s => s.type === 'les').length;
  const bezetSlots = slots.filter(s => s.type === 'bezet').length;
  return (14 - lesUren - bezetSlots) * 50;
}

function geplandMinuten(dag) {
  return geplandeTaken(dag).reduce((s, t) => {
    if (t.voortgang?.customMinuten != null) return s + t.voortgang.customMinuten;
    if (t.tijd?.type === 'minuten') return s + t.tijd.minuten;
    if (!t.tijd) return s + 15; // no time = 15 min
    return s;
  }, 0);
}

function capaciteitPct(dag) {
  const b = beschikbareMinuten(dag);
  return b <= 0 ? 100 : Math.min(100, (geplandMinuten(dag) / b) * 100);
}

function capaciteitClass(dag) {
  const pct = capaciteitPct(dag);
  if (pct >= 100) return 'cap-rood';
  if (pct >= 80) return 'cap-oranje';
  return 'cap-groen';
}

// ---- Drag & drop ----

function onDragStart(e, taak) {
  if (isReadOnly.value) return;
  draggingTaak.value = taak;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', taak.id);
}

function onDragEnd() {
  draggingTaak.value = null;
  dragOverTarget.value = null;
  dropBlok.value = null;
}

function onDragLeave(e, target) {
  if (!e.currentTarget.contains(e.relatedTarget)) {
    if (dragOverTarget.value === target) { dragOverTarget.value = null; dropBlok.value = null; }
  }
}

function onDragOverTimeline(e, dag) {
  dragOverTarget.value = dag;
  const body = e.currentTarget.querySelector('.wp-tl-body');
  if (!body) return;
  const rect = body.getBoundingClientRect();
  const y = e.clientY - rect.top;
  const blok = Math.max(0, Math.min(TOTAL_BLOKKEN - 1, Math.floor(y / BLOK_PX.value)));
  dropBlok.value = blok;
}

function snapBlok(blok, dag, taakId) {
  const SNAP_THRESHOLD = 1;
  const placed = geplaatstetaken(dag).filter(p => p.taak.id !== taakId);
  const blokken = draggingTaak.value ? taakBlokken(draggingTaak.value) : 1;

  // Snap to rooster slots: if drop is within a lesson band, snap to first free spot in that band
  for (const slot of roosterSlots(dag)) {
    const slotStart = (slot.uur - 1) * BLOKKEN_PER_UUR;
    const slotEnd = slotStart + BLOKKEN_PER_UUR;
    if (blok >= slotStart - 1 && blok < slotEnd) {
      // Find the end of existing tasks in this slot
      let freeStart = slotStart;
      for (const p of placed) {
        const pEnd = p.blok + p.blokken;
        if (pEnd > freeStart && p.blok < slotEnd) {
          freeStart = pEnd;
        }
      }
      // If there's room after existing tasks, snap there; otherwise snap to slot start
      const snapTo = (freeStart + blokken <= slotEnd) ? freeStart : slotStart;
      return Math.max(0, Math.min(snapTo, TOTAL_BLOKKEN - blokken));
    }
  }

  // Snap to adjacent tasks
  for (const p of placed) {
    const pEnd = p.blok + p.blokken;
    if (Math.abs((blok + blokken) - p.blok) <= SNAP_THRESHOLD) return p.blok - blokken;
    if (Math.abs(blok - pEnd) <= SNAP_THRESHOLD) return pEnd;
  }

  return Math.max(0, Math.min(blok, TOTAL_BLOKKEN - blokken));
}

// Check if drop position would overlap or cause chain conflict
function dropIndicatorClass(dag) {
  if (!draggingTaak.value || dropBlok.value === null) return '';
  const blokken = taakBlokken(draggingTaak.value);
  const snapped = snapBlok(dropBlok.value, dag, draggingTaak.value.id);
  const placed = geplaatstetaken(dag).filter(p => p.taak.id !== draggingTaak.value.id);
  for (const p of placed) {
    if (snapped < p.blok + p.blokken && snapped + blokken > p.blok) return 'drop-conflict';
  }
  // Check chain conflict at this specific position (green/red only, no orange)
  const kleur = ketenStapKleur(draggingTaak.value);
  if (kleur === 'keten-rood') return 'drop-conflict';
  return 'drop-ok';
}

function onDropTimeline(e, dag) {
  e.preventDefault();
  const taakId = e.dataTransfer.getData('text/plain');
  if (!taakId || isReadOnly.value) return;

  let blok = dropBlok.value ?? 0;
  blok = snapBlok(blok, dag, taakId);

  // Prevent overlap: find non-overlapping position
  const blokken = draggingTaak.value ? taakBlokken(draggingTaak.value) : 1;
  const placed = geplaatstetaken(dag).filter(p => p.taak.id !== taakId);
  if (overlapsWith(placed.map(p => ({ ...p })), blok, blokken, taakId)) {
    blok = findNonOverlapping(placed, blok, blokken, taakId);
  }

  planTaak(taakId, dag, blok);

  dragOverTarget.value = null;
  draggingTaak.value = null;
  dropBlok.value = null;
}

function onDropPool(e) {
  e.preventDefault();
  const taakId = e.dataTransfer.getData('text/plain');
  if (!taakId || isReadOnly.value) return;
  planTaak(taakId, null);
  dragOverTarget.value = null;
  draggingTaak.value = null;
  dropBlok.value = null;
}

function unplan(taak) {
  if (isReadOnly.value) return;
  planTaak(taak.id, null);
}

// ---- Auto-suggest & reset ----

const hasGeplande = computed(() => alleTaken.value.some(t => t.geplandOp));

function codeNummer(taak) {
  const m = (taak.code || '').match(/(\d+)\s*$/);
  return m ? parseInt(m[1]) : 999;
}

function autoSuggest() {
  if (isReadOnly.value) return;

  const rTaken = alleTaken.value.filter(t =>
    t.tijd?.type === 'rooster' && !t.geplandOp &&
    t.voortgang.status !== 'klaar' && t.voortgang.status !== 'ingediend'
  );

  if (!rTaken.length) return;

  const allSlots = [];
  for (const dag of dagen) {
    for (const slot of roosterSlots(dag)) {
      if (slot.type === 'les') {
        allSlots.push({ dag, uur: slot.uur, titel: slot.titel });
      }
    }
  }

  const usedSlots = new Set();
  for (const t of alleTaken.value) {
    if (t.geplandOp && t.tijd?.type === 'rooster') {
      const placed = geplaatstetaken(t.geplandOp);
      for (const p of placed) {
        if (p.taak.id === t.id) {
          const uur = Math.floor(p.blok / BLOKKEN_PER_UUR) + 1;
          usedSlots.add(`${t.geplandOp}_${uur}`);
        }
      }
    }
  }

  const grouped = {};
  for (const taak of rTaken) {
    const matchingTitels = [...new Set(allSlots.map(s => s.titel))]
      .filter(titel => matchesRoosterVak(taak, titel));

    const key = matchingTitels.sort().join('|') || '__none__';
    if (!grouped[key]) grouped[key] = { titels: matchingTitels, taken: [] };
    grouped[key].taken.push(taak);
  }

  for (const group of Object.values(grouped)) {
    if (!group.titels.length) continue;

    group.taken.sort((a, b) => codeNummer(a) - codeNummer(b));

    const availSlots = allSlots
      .filter(s => group.titels.includes(s.titel) && !usedSlots.has(`${s.dag}_${s.uur}`))
      .sort((a, b) => {
        const dayDiff = dagen.indexOf(a.dag) - dagen.indexOf(b.dag);
        return dayDiff !== 0 ? dayDiff : a.uur - b.uur;
      });

    for (let i = 0; i < group.taken.length && i < availSlots.length; i++) {
      const taak = group.taken[i];
      const slot = availSlots[i];
      const blok = (slot.uur - 1) * BLOKKEN_PER_UUR;
      planTaak(taak.id, slot.dag, blok);
      usedSlots.add(`${slot.dag}_${slot.uur}`);
    }
  }
}

async function resetWeekplan() {
  if (isReadOnly.value) return;
  const geplande = alleTaken.value.filter(t => t.geplandOp);
  for (const taak of geplande) {
    await planTaak(taak.id, null);
  }
}

// ---- Toggle klaar ----

function toggleKlaar(taak) {
  if (isReadOnly.value) return;
  const newStatus = taak.voortgang.status === 'klaar' ? 'open' : 'klaar';
  updateVoortgang(taak.id, { status: newStatus });
}

function cycleStatus(taak, newStatus) {
  if (isReadOnly.value) return;
  updateVoortgang(taak.id, { status: newStatus });
}

// ---- Resize (manual duration) ----

const resizing = ref(null); // { taakId, startY, startBlokken, placed }

function isCustomDuur(taak) {
  return taak.voortgang.customMinuten != null;
}

function resetCustomDuur(taak) {
  if (isReadOnly.value || !isCustomDuur(taak)) return;
  updateVoortgang(taak.id, { customMinuten: null });
}

function onResizeStart(e, taak, placed) {
  const startMinuten = taak.voortgang?.customMinuten ?? (placed.blokken * 15);
  resizing.value = {
    taakId: taak.id,
    startY: e.clientY,
    startMinuten,
  };
  document.addEventListener('mousemove', onResizeMove);
  document.addEventListener('mouseup', onResizeEnd);
  document.body.style.cursor = 'ns-resize';
  document.body.style.userSelect = 'none';
}

function onResizeMove(e) {
  if (!resizing.value) return;
  const dy = e.clientY - resizing.value.startY;
  // 5-minute increments: each pixel step = BLOK_PX/3 (since 15min/3 = 5min)
  const pxPer5Min = BLOK_PX.value / 3;
  const delta5 = Math.round(dy / pxPer5Min) * 5;
  const newMinuten = Math.max(5, resizing.value.startMinuten + delta5);
  // Live preview: temporarily update voortgang
  const taak = alleTaken.value.find(t => t.id === resizing.value.taakId);
  if (taak) {
    taak.voortgang.customMinuten = newMinuten;
  }
}

function onResizeEnd() {
  if (!resizing.value) return;
  const taak = alleTaken.value.find(t => t.id === resizing.value.taakId);
  if (taak && taak.voortgang.customMinuten != null) {
    updateVoortgang(taak.id, { customMinuten: taak.voortgang.customMinuten });
  }
  resizing.value = null;
  document.removeEventListener('mousemove', onResizeMove);
  document.removeEventListener('mouseup', onResizeEnd);
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
}

// ---- "Nu" indicator ----

const now = ref(new Date());
let nowTimer = null;

function measureScrollbar() {
  const el = timelineRowRef.value;
  if (el) scrollbarWidth.value = el.offsetWidth - el.clientWidth;
}

onMounted(() => {
  nowTimer = setInterval(() => { now.value = new Date(); }, 60000);
  // Set focusDag to today only on first visit
  if (!focusDag.value && vandaagDag.value) focusDag.value = vandaagDag.value;
  nextTick(() => {
    measureScrollbar();
    // Scroll to target block if set (e.g. from dashboard click)
    if (wpFocusBlok.value !== null) {
      const targetPx = wpFocusBlok.value * BLOK_PX.value;
      wpFocusBlok.value = null; // consume
      if (timelineRowRef.value) {
        timelineRowRef.value.scrollTop = 0;
        requestAnimationFrame(() => {
          timelineRowRef.value?.scrollTo({
            top: Math.max(0, targetPx - 60),
            behavior: 'smooth',
          });
        });
      }
    }
  });
  window.addEventListener('resize', measureScrollbar);
});
onUnmounted(() => {
  if (nowTimer) clearInterval(nowTimer);
  document.removeEventListener('mousemove', onResizeMove);
  document.removeEventListener('mouseup', onResizeEnd);
  window.removeEventListener('resize', measureScrollbar);
});

// Which day column is "today"?
const vandaagDag = computed(() => {
  const jsDay = now.value.getDay(); // 0=Sun, 1=Mon, ...
  const dagMap = [6, 0, 1, 2, 3, 4, 5]; // Sun=zo(6), Mon=ma(0), ...
  return dagen[dagMap[jsDay]] || null;
});

// "Nu" blok position on the timeline (timeline starts at 8:30)
const nuBlok = computed(() => {
  const h = now.value.getHours();
  const m = now.value.getMinutes();
  const minutesSince830 = (h - 8) * 60 + (m - 30);
  if (minutesSince830 < 0) return -1; // before 8:30
  const blok = Math.floor(minutesSince830 / 15);
  if (blok >= TOTAL_BLOKKEN) return -1; // after 22:30
  return blok;
});

const nuTijd = computed(() => {
  const h = now.value.getHours();
  const m = now.value.getMinutes();
  return `${h}:${m.toString().padStart(2, '0')}`;
});

// Is a task in the past? (planned on a day before today and not klaar)
function isOverdue(taak) {
  if (!taak.geplandOp) return false;
  if (taak.voortgang.status === 'klaar' || taak.voortgang.status === 'ingediend') return false;
  return dagen.indexOf(taak.geplandOp) < dagen.indexOf(vandaagDag.value);
}
</script>

<style scoped>
.wp-toolbar-actions { margin-left: auto; display: flex; gap: 2px; }

.btn-expand {
  width: 2rem; height: 2rem; border: 1px solid var(--clr-border); border-radius: var(--radius);
  background: var(--clr-surface); cursor: pointer; display: flex; align-items: center;
  justify-content: center; padding: 0; transition: all 0.15s;
}
.btn-expand:hover { border-color: var(--clr-accent); background: var(--clr-accent-light); }
.expand-icon {
  font-size: 0.85rem; font-weight: 700; line-height: 1; color: var(--clr-text-muted); transition: transform 0.2s;
}
.expand-icon.open { transform: rotate(90deg); }


/* ---- Connected header bar ---- */
.wp-connected-header {
  display: flex;
  background: var(--clr-surface);
  border: 1px solid var(--clr-border);
  border-bottom: 2px solid var(--clr-border);
  border-radius: var(--radius) var(--radius) 0 0;
}

.wp-pool-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.75rem;
  border-right: 1px solid var(--clr-border);
  font-size: 0.9rem;
  position: relative;
}

.wp-pool-resize-handle {
  position: absolute;
  top: 0;
  right: -4px;
  width: 8px;
  height: 100%;
  cursor: col-resize;
  z-index: 10;
}
.wp-pool-resize-handle::after {
  content: '⋮';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 0.75rem;
  color: var(--clr-border);
  transition: color 0.15s;
}
.wp-pool-resize-handle:hover::after {
  color: var(--clr-accent);
}
.wp-pool-count {
  font-size: 0.7rem;
  color: var(--clr-text);
  font-variant-numeric: tabular-nums;
}
.wp-pool-count strong {
  font-weight: 800;
}
.wp-pool-total {
  color: var(--clr-text-muted);
  font-weight: 400;
}
.wp-pool-minuten {
  margin-left: auto;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--clr-text-muted);
  font-variant-numeric: tabular-nums;
}

/* ---- Content layout ---- */
.wp-layout {
  display: flex;
  align-items: stretch;
  border: 1px solid var(--clr-border);
  border-top: none;
  border-radius: 0 0 var(--radius) var(--radius);
  overflow: hidden;
  max-height: calc(100vh - 11rem);
}
.wp-main { flex: 1; min-width: 0; overflow: hidden; display: flex; flex-direction: column; }

/* Day nav */
.wp-nav-btn {
  width: 28px; height: 28px; border: 1px solid var(--clr-border); border-radius: 6px;
  background: var(--clr-surface); cursor: pointer; font-size: 1.1rem; font-weight: 700;
  color: var(--clr-text-muted); display: inline-flex; align-items: center; justify-content: center;
  transition: all 0.15s; padding: 0;
}
.wp-nav-btn:hover { border-color: var(--clr-accent); color: var(--clr-accent); background: var(--clr-accent-light); }

/* ---- Timeline (no own border — part of connected layout) ---- */
.wp-timeline-wrap { background: var(--clr-surface); overflow: hidden; flex: 1; min-height: 0; display: flex; flex-direction: column; }


.wp-col-header {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column; align-items: center; gap: 0;
  padding: 0.3rem 0.15rem;
  border-left: 1px solid var(--clr-border);
}
.wp-col-header.is-weekend { background: rgba(0,0,0,0.02); }

.wp-col-naam { font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; }
.wp-col-cap { font-size: 0.65rem; font-weight: 600; font-variant-numeric: tabular-nums; padding: 0.05rem 0.2rem; border-radius: 3px; }

.cap-groen { color: #059669; background: #ecfdf5; }
.cap-oranje { color: #d97706; background: #fffbeb; }
.cap-rood { color: #dc2626; background: #fef2f2; }

/* ---- Time gutter ---- */
.wp-time-gutter-header {
  width: 22px;
  flex-shrink: 0;
  border-right: 1px solid var(--clr-border);
}
.wp-time-gutter {
  width: 22px;
  flex-shrink: 0;
  position: relative;
  border-right: 1px solid var(--clr-border);
}
.wp-time-label {
  position: absolute;
  left: 0;
  width: 100%;
  font-size: 0.55rem;
  font-weight: 600;
  color: var(--clr-text-muted);
  line-height: 1;
  text-align: right;
  padding-right: 3px;
  transform: translateY(-50%);
  font-variant-numeric: tabular-nums;
}
/* ---- Timeline row (gutter + 7 columns) ---- */
.wp-timeline-row {
  display: flex;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}


/* Day column */
.wp-tl-col {
  flex: 1;
  min-width: 0;
  border-left: 1px solid var(--clr-border);
}
.wp-tl-col.is-weekend { background: rgba(0,0,0,0.025); }
/* Column dragover: no outline (drop-indicator is sufficient) */


/* Focus column styling */
.wp-col-header.is-focus {
  background: rgba(99, 102, 241, 0.1);
  border-bottom: 2px solid var(--clr-accent);
}
.wp-col-header.is-focus .wp-col-naam { font-size: 0.9rem; color: var(--clr-accent); }

.wp-focus-header {
  display: flex; align-items: center; gap: 0.4rem; justify-content: center; width: 100%;
}
.wp-focus-header .wp-nav-btn { width: 22px; height: 22px; font-size: 0.9rem; }
.wp-focus-header .wp-col-naam { font-size: 0.9rem; }

/* Timeline body — light grey base so bands pop */
.wp-tl-body {
  position: relative;
  background: #f8f8fa;
}

/* Hour grid lines */
.wp-grid-line {
  position: absolute;
  left: 0; right: 0;
  height: 0;
  border-top: 1px solid rgba(0,0,0,0.06);
}


/* ---- Rooster background bands ---- */
.wp-rooster-band {
  position: absolute;
  left: 0; right: 0;
  border-radius: 2px;
  display: flex;
  align-items: flex-start;
  padding: 2px 4px;
  overflow: hidden;
  z-index: 1;
}

/* Les-banden: zachte indigo achtergrond */
.wp-band-les {
  background: rgba(99, 102, 241, 0.06);
  cursor: pointer;
  transition: background 0.15s;
}
.wp-band-les:hover { background: rgba(99, 102, 241, 0.14); }

/* Bezet-banden: diagonale strepen (geblokkeerd) */
.wp-band-bezet {
  background: repeating-linear-gradient(
    -45deg,
    transparent,
    transparent 4px,
    rgba(0, 0, 0, 0.04) 4px,
    rgba(0, 0, 0, 0.04) 8px
  );
}

/* Vrij-banden: transparant (leeg = vrij) */
.wp-band-vrij {
  background: transparent;
}

.wp-band-label {
  font-size: 0.8rem;
  font-weight: 800;
  color: rgba(99, 102, 241, 0.7);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.1;
  position: sticky;
  top: 0;
  letter-spacing: 0.02em;
}

.wp-band-bezet .wp-band-label { color: rgba(0, 0, 0, 0.3); font-weight: 600; font-size: 0.7rem; }
.wp-band-vrij .wp-band-label { display: none; }

.wp-band-selected {
  background: rgba(99, 102, 241, 0.18) !important;
}
.wp-band-selected .wp-band-label { color: var(--clr-accent); }

.wp-band-drag-match {
  outline: 2px dashed var(--clr-accent);
  outline-offset: -2px;
}
.wp-band-drag-match .wp-band-label { color: var(--clr-accent); }

/* Band drop status colors */
.wp-band-drag-match.band-ok {
  outline-color: #10b981;
}
.wp-band-drag-match.band-ok .wp-band-label { color: #059669; }

.wp-band-drag-match.band-conflict {
  outline-color: #ef4444;
}
.wp-band-drag-match.band-conflict .wp-band-label { color: #dc2626; }

.band-drop-icon {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 28px;
  height: 28px;
  opacity: 0.4;
  pointer-events: none;
  color: var(--clr-accent);
}
.band-drop-icon.band-ok { color: #10b981; }
.band-drop-icon.band-conflict { color: #ef4444; }

/* ---- Drop indicator ---- */
.wp-drop-indicator {
  position: absolute;
  left: 2px; right: 2px;
  border: 3px dashed var(--clr-accent);
  border-radius: 4px;
  z-index: 5;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
}
.drop-icon {
  color: var(--clr-accent);
  opacity: 0.35;
  width: 24px;
  height: 24px;
}

.wp-drop-indicator.drop-ok {
  border-color: #10b981;
}
.wp-drop-indicator.drop-ok .drop-icon { color: #10b981; }

.wp-drop-indicator.drop-conflict {
  border-color: #ef4444;
}
.wp-drop-indicator.drop-conflict .drop-icon { color: #ef4444; }

@keyframes drop-pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

/* ---- Placed tasks on timeline ---- */
.wp-tl-taak {
  position: absolute;
  left: 3px; right: 3px;
  background: white;
  border-radius: 4px;
  border-left: 4px solid var(--clr-todo);
  box-shadow: 0 1px 4px rgba(0,0,0,0.13), 0 0 0 1px rgba(0,0,0,0.04);
  padding: 1px 5px;
  overflow: hidden;
  cursor: grab;
  z-index: 3;
  transition: box-shadow 0.15s, opacity 0.15s;
  user-select: none;
  display: flex;
  align-items: center;
  font-size: 0.72rem;
  line-height: 1.1;
}

.wp-tl-taak:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.06); z-index: 4; }
.wp-tl-taak.dragging { opacity: 0.4; }
.wp-tl-taak:active { cursor: grabbing; }

/* Type border colors: rooster=indigo, huistaak/Z=slate */
.wp-tl-taak.is-rooster-les { border-left-color: #6366f1; background: white; }
.wp-tl-taak.is-rooster { border-left-color: #6366f1; background: white; }
.wp-tl-taak.is-huistaak { border-left-color: #64748b; background: white; }

/* Klaar: strikethrough + faded */
.wp-tl-taak.is-klaar {
  opacity: 0.45;
  text-decoration: line-through;
  text-decoration-color: rgba(0,0,0,0.3);
}
.wp-tl-taak.is-klaar .tl-code,
.wp-tl-taak.is-klaar .tl-duur { text-decoration: line-through; text-decoration-color: inherit; }

/* Overdue: orange border */
.wp-tl-taak.is-overdue {
  border-left-color: #f59e0b !important;
}
/* In te dienen (klaar, niet ingediend): red border */
.wp-tl-taak.is-in-te-dienen {
  border-left-color: #ef4444 !important;
}

/* Selected task highlight */
.wp-tl-taak.is-selected {
  outline: 2px solid var(--clr-accent);
  outline-offset: -1px;
  z-index: 3;
}

.tl-compact-row {
  display: flex;
  align-items: center;
  gap: 3px;
  width: 100%;
  min-width: 0;
}

.tl-code { font-weight: 800; font-size: 0.72rem; color: var(--clr-accent); white-space: nowrap; }
.tl-duur { font-weight: 700; font-size: 0.65rem; color: var(--clr-text-muted); white-space: nowrap; margin-left: auto; background: rgba(0,0,0,0.05); padding: 1px 5px; border-radius: 3px; }
.tl-duur.tl-duur-custom { background: #fff7ed; color: #d97706; }

.tl-keten { font-size: 0.55rem; }
.tl-keten .keten-stap { width: 0.9rem; height: 0.9rem; font-size: 0.5rem; }

/* Keten chain step colors (needed for inline chain rendering in timeline) */
.keten-grijs { background: var(--clr-bg); color: var(--clr-text-muted); }
.keten-groen { background: #ecfdf5; color: #059669; }
.keten-oranje { background: #fffbeb; color: #d97706; }
.keten-rood { background: #fef2f2; color: #dc2626; }

/* Day view card styles (duplicated from TaakKaart since scoped CSS doesn't cross components) */
.tl-day-card {
  width: 100%; min-width: 0;
}
.tl-day-card .kaart-top {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.15rem;
}
.tl-day-card .kaart-top .flags { margin-left: auto; display: flex; gap: 0.25rem; }
.tl-day-card .code { font-size: 0.8rem; font-weight: 700; color: var(--clr-accent); }
.tl-day-card .kaart-tekst {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.4;
  color: var(--clr-text);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.tl-day-card .kaart-duur {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--clr-text-muted);
  background: var(--clr-bg);
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  font-variant-numeric: tabular-nums;
}
.tl-day-card .kaart-duur.prominent {
  font-size: 0.85rem;
  background: var(--clr-accent-light);
  color: var(--clr-accent);
  padding: 0.15rem 0.5rem;
}
.tl-day-card .flags { display: flex; gap: 0.2rem; }
.tl-day-card .flag {
  font-size: 0.6rem;
  font-weight: 700;
  background: #fef3c7;
  color: #92400e;
  padding: 0.1rem 0.35rem;
  border-radius: 3px;
}
.tl-gepland-label {
  font-size: 0.7rem;
  color: var(--clr-text-muted);
  font-variant-numeric: tabular-nums;
  margin-top: 0.15rem;
}
/* Focus column: cards get more room */
.is-focus .wp-tl-taak {
  padding: 3px 8px;
  font-size: 0.8rem;
  min-height: 48px;
}
.is-focus .tl-code { font-size: 0.8rem; }
.is-focus .tl-duur { font-size: 0.7rem; }
.is-focus .tl-check-btn { width: 16px; height: 16px; font-size: 0.6rem; }

.tl-unplan {
  background: none; border: none; font-size: 0.8rem; cursor: pointer;
  color: var(--clr-text-muted); padding: 0; line-height: 1; flex-shrink: 0;
  opacity: 0; transition: opacity 0.1s;
}
.wp-tl-taak:hover .tl-unplan { opacity: 1; }
.tl-unplan:hover { color: #ef4444; }

/* Resize handle */
.tl-resize-handle {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  height: 6px;
  cursor: ns-resize;
  border-radius: 0 0 4px 4px;
  opacity: 0;
  transition: opacity 0.1s;
  background: linear-gradient(transparent, rgba(0,0,0,0.12));
}
.wp-tl-taak:hover .tl-resize-handle { opacity: 1; }
.tl-resize-handle::after {
  content: '';
  position: absolute;
  left: 50%; bottom: 1px;
  transform: translateX(-50%);
  width: 16px; height: 2px;
  background: rgba(0,0,0,0.25);
  border-radius: 1px;
}

/* ---- Drag highlights (timeline tasks) ---- */
.wp-tl-taak.drag-related-ok {
  outline: 2px solid #6366f1;
  outline-offset: -1px;
  background: #eef2ff !important;
  animation: drag-pulse-ok 1.2s ease-in-out infinite;
}

.wp-tl-taak.drag-related-warn {
  outline: 2px solid #d97706;
  outline-offset: -1px;
  background: #fffbeb !important;
  animation: drag-pulse-warn 1.2s ease-in-out infinite;
}

.wp-tl-taak.drag-related-conflict {
  outline: 2px solid #ef4444;
  outline-offset: -1px;
  background: #fef2f2 !important;
  animation: drag-pulse-conflict 1.2s ease-in-out infinite;
}

@keyframes drag-pulse-ok {
  0%, 100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.25); }
  50% { box-shadow: 0 0 8px 3px rgba(99, 102, 241, 0.25); }
}

@keyframes drag-pulse-warn {
  0%, 100% { box-shadow: 0 0 0 0 rgba(217, 119, 6, 0.25); }
  50% { box-shadow: 0 0 8px 3px rgba(217, 119, 6, 0.25); }
}

@keyframes drag-pulse-conflict {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.25); }
  50% { box-shadow: 0 0 8px 3px rgba(239, 68, 68, 0.25); }
}

/* ---- Dependency chain (timeline-specific sizes) ---- */

/* ---- Sidebar (icon buttons used in slot) ---- */
.wp-sb-icon-btn {
  width: 26px; height: 26px; border: 1px solid var(--clr-border); border-radius: 5px;
  background: var(--clr-surface); cursor: pointer; color: var(--clr-text-muted);
  display: flex; align-items: center; justify-content: center; padding: 0;
  transition: all 0.15s;
}
.wp-sb-icon-btn:hover { border-color: var(--clr-accent); color: var(--clr-accent); background: var(--clr-accent-light); }
.wp-sb-icon-btn.wp-sb-icon-danger:hover { border-color: #ef4444; color: #ef4444; background: #fef2f2; }

/* Vak-filter chip in pool header */
.wp-vak-chip {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: var(--clr-accent);
  color: white;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 700;
  max-width: 100%;
  overflow: hidden;
}
.wp-vak-chip-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.wp-vak-chip-clear {
  background: none;
  border: none;
  color: rgba(255,255,255,0.7);
  font-size: 0.85rem;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  flex-shrink: 0;
}
.wp-vak-chip-clear:hover { color: white; }

/* ---- "Nu" indicator ---- */
.wp-nu-line {
  position: absolute;
  left: 0; right: 0;
  height: 0;
  border-top: 2px solid #ef4444;
  z-index: 6;
  pointer-events: none;
}
.wp-nu-dot {
  position: absolute;
  left: -5px; top: -5px;
  width: 8px; height: 8px;
  background: #ef4444;
  border-radius: 50%;
}

/* Nu time label on the red line */
.wp-nu-time {
  position: absolute;
  right: 2px;
  top: -0.95rem;
  font-size: 0.7rem;
  font-weight: 800;
  color: #ef4444;
  line-height: 1;
  pointer-events: none;
}

/* Deadline line on sunday */
.wp-deadline-line {
  border-top-style: dashed;
}
.wp-deadline-label {
  position: absolute;
  right: 2px;
  top: -0.95rem;
  font-size: 0.7rem;
  font-weight: 800;
  color: #ef4444;
  line-height: 1;
  white-space: nowrap;
}

/* Today column highlight */
.wp-col-header.is-vandaag {
  background: rgba(99, 102, 241, 0.08);
}
.wp-col-header.is-vandaag .wp-col-naam {
  color: var(--clr-accent);
}
.wp-tl-col.is-vandaag .wp-tl-body {
  background: rgba(99, 102, 241, 0.03);
}

/* Check button on compact cards */
.tl-check-btn {
  width: 14px; height: 14px;
  border: 1.5px solid var(--clr-border);
  border-radius: 3px;
  background: white;
  color: transparent;
  font-size: 0.55rem; font-weight: 900;
  display: inline-flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  cursor: pointer;
  padding: 0;
  transition: all 0.15s;
}
.tl-check-btn:hover { border-color: #059669; color: #059669; background: #ecfdf5; }
.tl-check-btn.checked { background: #059669; border-color: #059669; color: white; }

/* Vak label on compact cards (top row) */
.tl-vak {
  font-size: 0.55rem;
  font-weight: 700;
  color: var(--clr-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
/* ---- Drag-dimming: focus on dragged task + chain ---- */
.wp-layout.is-dragging-mode .wp-tl-taak {
  opacity: 0.25;
  transition: opacity 0.15s;
}
.wp-layout.is-dragging-mode .wp-tl-taak.dragging,
.wp-layout.is-dragging-mode .wp-tl-taak.drag-related-ok,
.wp-layout.is-dragging-mode .wp-tl-taak.drag-related-warn,
.wp-layout.is-dragging-mode .wp-tl-taak.drag-related-conflict {
  opacity: 1;
}
.wp-layout.is-dragging-rooster .wp-rooster-band {
  opacity: 0.3;
  transition: opacity 0.15s;
}
.wp-layout.is-dragging-rooster .wp-rooster-band.wp-band-drag-match {
  opacity: 1;
}

/* ---- Responsive ---- */
@media (max-width: 900px) {
  .wp-layout { flex-direction: column; }
}
</style>
