<template>
  <div class="weekplan">
    <!-- Toolbar: filters + action buttons (above header, like kanban) -->
    <div class="wp-toolbar">
      <button class="btn-expand" @click="poolRef?.toggleAlles()" :title="poolRef?.allesOpen ? 'Alles dichtklappen' : 'Alles openklappen'">
        <span class="expand-icon" :class="{ open: poolRef?.allesOpen }">+</span>
      </button>
      <div class="wp-toolbar-filters">
        <div v-if="selectedVak" class="wp-sb-vakfilter">
          <span class="wp-sb-vakfilter-label">{{ selectedVak }}</span>
          <button class="wp-sb-vakfilter-clear" @click="selectedVak = null">&times;</button>
        </div>
        <div v-else class="segmented-group">
          <button :class="{ on: sidebarFilter !== 'rooster' }" @click="toggleFilter('huistaken')">Huistaken ({{ huistakenCount }})</button>
          <button :class="{ on: sidebarFilter !== 'huistaken' }" @click="toggleFilter('rooster')">Rooster ({{ roosterCount }})</button>
        </div>
      </div>
      <div class="wp-toolbar-actions">
        <button class="wp-sb-icon-btn" @click="autoSuggest" title="Rooster-taken automatisch inplannen">
          <Icon icon="mdi:lightning-bolt" width="14" height="14" />
        </button>
        <button v-if="hasGeplande" class="wp-sb-icon-btn wp-sb-icon-danger" @click="resetWeekplan" title="Weekplanning wissen">
          <Icon icon="mdi:delete-outline" width="14" height="14" />
        </button>
      </div>
    </div>

    <!-- Connected header bar: pool header + gutter + day headers -->
    <div class="wp-connected-header">
      <div class="wp-pool-header" :style="{ width: poolRef?.currentWidth + 'px' }">
        <div class="wp-pool-segmented">
          <button :class="{ active: !sidebarShowAll }" @click="sidebarShowAll = false" title="Ongeplande taken">
            <Icon icon="mdi:calendar-edit-outline" width="16" height="16" />
          </button>
          <button :class="{ active: sidebarShowAll }" @click="sidebarShowAll = true" title="Alle taken">
            <Icon icon="mdi:list-box-outline" width="16" height="16" />
          </button>
        </div>
        <span class="wp-pool-count">{{ gefilterdeOngeplande.length }}</span>
        <span class="wp-pool-minuten">{{ poolRef?.totalMinuten ?? 0 }}'</span>
      </div>
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
    <div class="wp-layout">
      <!-- Sidebar: unplanned tasks (headerless — header is above) -->
      <TakenPool
        ref="poolRef"
        :taken="gefilterdeOngeplande"
        titel="Ongepland"
        headerless
        :read-only="isReadOnly"
        :is-drag-over="dragOverTarget === '__pool__'"
        :dragging-taak-id="draggingTaak?.id"
        :taak-keten="taakKeten"
        :keten-tooltip="ketenTooltip"
        :keten-stap-kleur="ketenStapKleur"
        :drag-related-class-fn="dragRelatedClass"
        :format-duur-fn="formatDuur"
        :duur-tooltip-fn="duurTooltip"
        :filter="sidebarFilter"
        :rooster-count="roosterCount"
        :huistaken-count="huistakenCount"
        @dragenter="dragOverTarget = '__pool__'"
        @dragleave="onDragLeave($event, '__pool__')"
        @drop="onDropPool($event)"
        @card-dragstart="(e, taak) => onDragStart(e, taak)"
        @card-dragend="onDragEnd"
        @update:filter="onFilterUpdate"
      >
        <template #empty>
          {{ sidebarFilter === 'rooster' ? 'Geen roostertaken' : sidebarFilter === 'huistaken' ? 'Geen huistaken' : 'Alle taken ingepland!' }}
        </template>
      </TakenPool>

      <!-- Main area -->
      <div class="wp-main">
        <!-- Timeline grid: gutter + day columns -->
        <div class="wp-timeline-wrap">

          <!-- Scrollable timeline -->
          <div class="wp-timeline-row">
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
                      'is-rooster': placed.taak.tijd?.type === 'rooster',
                      'is-huistaak': placed.taak.tijd?.type !== 'rooster',
                      'is-klaar': placed.taak.voortgang.status === 'klaar' || placed.taak.voortgang.status === 'ingediend',
                      'is-overdue': isOverdue(placed.taak),
                      dragging: draggingTaak?.id === placed.taak.id,
                    }
                  ]"
                  :style="{ top: placed.blok * BLOK_PX + 'px', height: placed.blokken * BLOK_PX + 'px' }"
                  :draggable="!isReadOnly"
                  :title="compactTooltip(placed.taak)"
                  @click="toggleVakFilter(placed.taak.vak)"
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
                        <span v-if="isOverdue(placed.taak)" class="tl-overdue-icon" title="Achterstand!">!</span>
                        <span v-if="placed.taak.code" class="code">{{ placed.taak.code }}</span>
                        <span v-if="taakKeten(placed.taak)" class="kaart-keten" :title="ketenTooltip(placed.taak)">
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
                      <span v-if="isOverdue(placed.taak)" class="tl-overdue-icon" title="Achterstand!">!</span>
                      <span class="tl-code">{{ placed.taak.code || kortVak(placed.taak.vak) }}</span>
                      <span v-if="taakKeten(placed.taak)" class="kaart-keten tl-keten" :title="ketenTooltip(placed.taak)">
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
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { Icon } from '@iconify/vue';
import { usePlanner } from '../stores/planner.js';
import { hoofdgroepClass, formatDuur as _formatDuur, duurTooltip as _duurTooltip, flagTooltips, useVolgordeKetens, useDragRelated } from '../composables/useTakenLogic.js';
import TakenPool from './TakenPool.vue';

const { state, alleTaken, planTaak, updateVoortgang, isReadOnly, wpViewMode, wpFocusDag } = usePlanner();

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
const BLOKKEN_PER_UUR = 4;   // 4 × 15 min = 60 min
const TOTAL_BLOKKEN = 14 * BLOKKEN_PER_UUR; // 56 blocks
const TOTAL_PX = computed(() => TOTAL_BLOKKEN * BLOK_PX.value);

// Deadline line: 21:00 on the timeline

const poolRef = ref(null);
const dragOverTarget = ref(null);
const draggingTaak = ref(null);
const dropBlok = ref(null);
const sidebarFilter = ref('rooster');
const selectedVak = ref(null);
const sidebarShowAll = ref(false);

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
  parts.push('Sleep onderrand om duur aan te passen');
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

const alleOngeplande = computed(() => {
  if (sidebarShowAll.value) return alleTaken.value;
  return alleTaken.value.filter(t => {
    if (t.geplandOp) return false;
    if (t.voortgang.status === 'klaar' || t.voortgang.status === 'ingediend') return false;
    return true;
  });
});

const roosterCount = computed(() => alleOngeplande.value.filter(t => t.tijd?.type === 'rooster').length);
const huistakenCount = computed(() => alleOngeplande.value.filter(t => t.tijd?.type !== 'rooster').length);

// Map rooster slot titles to task vak/hoofdgroep keywords
// Equivalenten:
//   Taal → Nederlands, Frans, Engels
//   Science@Lab → Biologie, Fysica, Chemie
//   Lab@Work → alle vakken (wildcard)
const ROOSTER_VAK_MAP = {
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
  'lab@work': null,  // null = wildcard, matches all vakken
  'stem@lab': ['stem'],
};

// Map task code prefixes to rooster slot titles
const CODE_ROOSTER_MAP = {
  'hb': ['cultuur', 'cb'],
  'cb': ['cultuur', 'cb'],
  'aa': ['rb'],
};

function matchesRoosterVak(taak, roosterTitel) {
  const titel = roosterTitel.toLowerCase();
  const vak = (taak.vak || '').toLowerCase();
  const hg = (taak.hoofdgroep || '').toLowerCase();
  const code = (taak.code || '').toLowerCase().replace(/[\d\s]+$/, '');

  // Lab@Work = wildcard: matches any vak
  if (ROOSTER_VAK_MAP[titel] === null) return true;

  if (vak.includes(titel) || titel.includes(vak)) return true;
  if (hg.includes(titel) || titel.includes(hg)) return true;

  const keywords = ROOSTER_VAK_MAP[titel];
  if (keywords) {
    for (const kw of keywords) {
      if (vak.includes(kw) || hg.includes(kw)) return true;
    }
  }

  // Match task code prefix to rooster slot (HB→cultuur, AA→rb)
  if (code && CODE_ROOSTER_MAP[code]) {
    if (CODE_ROOSTER_MAP[code].includes(titel)) return true;
  }

  return false;
}

// Reverse: given a task, which rooster titles match it?
// Used to highlight lesson bands when dragging a task.
function matchingRoosterTitels(taak) {
  const result = new Set();
  const vak = (taak.vak || '').toLowerCase();
  const hg = (taak.hoofdgroep || '').toLowerCase();
  const code = (taak.code || '').toLowerCase().replace(/[\d\s]+$/, '');

  for (const [titel, keywords] of Object.entries(ROOSTER_VAK_MAP)) {
    // Wildcard (Lab@Work)
    if (keywords === null) { result.add(titel); continue; }
    // Direct match
    if (vak.includes(titel) || titel.includes(vak)) { result.add(titel); continue; }
    if (hg.includes(titel) || titel.includes(hg)) { result.add(titel); continue; }
    // Keyword match
    for (const kw of keywords) {
      if (vak.includes(kw) || hg.includes(kw)) { result.add(titel); break; }
    }
  }

  // Code-based match (HB→cultuur/cb, AA→rb)
  if (code && CODE_ROOSTER_MAP[code]) {
    for (const titel of CODE_ROOSTER_MAP[code]) {
      result.add(titel);
    }
  }

  return result;
}

const gefilterdeOngeplande = computed(() => {
  let taken = alleOngeplande.value;
  if (selectedVak.value) {
    taken = taken.filter(t => matchesRoosterVak(t, selectedVak.value));
  } else if (sidebarFilter.value === 'rooster') {
    taken = taken.filter(t => t.tijd?.type === 'rooster');
  } else if (sidebarFilter.value === 'huistaken') {
    taken = taken.filter(t => t.tijd?.type !== 'rooster');
  }
  return taken.sort((a, b) => {
    const vakCmp = (a.vak || '').localeCompare(b.vak || '');
    if (vakCmp !== 0) return vakCmp;
    return (a.code || '').localeCompare(b.code || '');
  });
});

const gefilterdeOngeplandMinuten = computed(() => {
  return gefilterdeOngeplande.value.reduce((sum, t) => (t.tijd?.type === 'minuten' ? sum + t.tijd.minuten : sum), 0);
});

// ---- Sidebar (handled by TakenPool component) ----
function toggleFilter(f) { sidebarFilter.value = sidebarFilter.value === f ? null : f; selectedVak.value = null; }
function onFilterUpdate(f) { sidebarFilter.value = f; selectedVak.value = null; }
function toggleVakFilter(titel) { selectedVak.value = selectedVak.value === titel ? null : titel; }

// Band selection: clicked vak filter (matches equivalent vakken)
function isBandSelected(slot) {
  if (slot.type !== 'les' || !selectedVak.value) return false;
  const sel = selectedVak.value.toLowerCase();
  const titel = slot.titel.toLowerCase();
  // Direct match
  if (sel === titel) return true;
  // Check if both are equivalent (e.g. selectedVak='Taal' highlights 'Nederlands' band and vice versa)
  const selKeywords = ROOSTER_VAK_MAP[sel];
  if (selKeywords && selKeywords.includes(titel)) return true;
  if (selKeywords === null) return true; // Lab@Work selected → all bands
  const titelKeywords = ROOSTER_VAK_MAP[titel];
  if (titelKeywords && titelKeywords.includes(sel)) return true;
  if (titelKeywords === null) return true; // Lab@Work band always matches
  return false;
}

// Band highlight during drag: highlight bands that match the dragged task
function isBandDragMatch(slot) {
  if (slot.type !== 'les' || !draggingTaak.value) return false;
  const titels = matchingRoosterTitels(draggingTaak.value);
  return titels.has(slot.titel.toLowerCase());
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

  let hasConflict = false;
  let hasWarning = false;

  // Check predecessor (must be before this position)
  if (idx > 0) {
    const voor = keten[idx - 1];
    if (voor.voortgang.status !== 'klaar' && voor.voortgang.status !== 'ingediend') {
      const voorGepland = effectiveGeplandOp(voor);
      if (!voorGepland) hasWarning = true;
      else if (effectiveTemporalRank(voor) >= bandTR) hasConflict = true;
    }
  }

  // Check successor (must be after this position)
  if (idx < keten.length - 1) {
    const na = keten[idx + 1];
    if (na.voortgang.status !== 'klaar' && na.voortgang.status !== 'ingediend') {
      const naGepland = effectiveGeplandOp(na);
      if (naGepland && effectiveTemporalRank(na) <= bandTR) hasConflict = true;
    }
  }

  if (hasConflict) return 'band-conflict';
  if (hasWarning) return 'band-warn';
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
  // Check chain conflict for the dragged task at this position
  const kleur = ketenStapKleur(draggingTaak.value);
  if (kleur === 'keten-rood') return 'drop-conflict';
  if (kleur === 'keten-oranje') return 'drop-warn';
  if (kleur === 'keten-groen') return 'drop-ok';
  return '';
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

onMounted(() => {
  nowTimer = setInterval(() => { now.value = new Date(); }, 60000);
  // Set focusDag to today only on first visit
  if (!focusDag.value && vandaagDag.value) focusDag.value = vandaagDag.value;
});
onUnmounted(() => {
  if (nowTimer) clearInterval(nowTimer);
  document.removeEventListener('mousemove', onResizeMove);
  document.removeEventListener('mouseup', onResizeEnd);
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

// Is a task in the past? (planned before "now" and not klaar)
function isOverdue(taak) {
  if (!taak.geplandOp) return false;
  if (taak.voortgang.status === 'klaar' || taak.voortgang.status === 'ingediend') return false;
  const taakDagIdx = dagen.indexOf(taak.geplandOp);
  const vandaagIdx = dagen.indexOf(vandaagDag.value);
  if (taakDagIdx < vandaagIdx) return true;
  if (taakDagIdx === vandaagIdx && taak.geplandBlok !== null && nuBlok.value >= 0) {
    const taakEnd = taak.geplandBlok + taakBlokken(taak);
    if (taakEnd <= nuBlok.value) return true;
  }
  return false;
}
</script>

<style scoped>
/* ---- Toolbar (above header, like kanban) ---- */
.wp-toolbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}
.wp-toolbar-filters { display: flex; align-items: center; gap: 0.5rem; }
.wp-toolbar-actions { margin-left: auto; display: flex; gap: 2px; }

.btn-expand {
  width: 2rem; height: 2rem; border: 1px solid var(--clr-border); border-radius: var(--radius);
  background: var(--clr-surface); cursor: pointer; display: flex; align-items: center;
  justify-content: center; padding: 0; transition: all 0.15s;
}
.btn-expand:hover { border-color: var(--clr-accent); background: var(--clr-accent-light); }
.expand-icon {
  font-size: 1.1rem; font-weight: 700; line-height: 1; color: var(--clr-text-muted); transition: transform 0.2s;
}
.expand-icon.open { transform: rotate(45deg); }

.segmented-group {
  display: flex;
  border: 1px solid var(--clr-border);
  border-radius: var(--radius);
  overflow: hidden;
}
.segmented-group button {
  background: var(--clr-bg);
  border: none;
  border-right: 1px solid var(--clr-border);
  padding: 0.4rem 0.8rem;
  font-size: 0.85rem;
  cursor: pointer;
  color: var(--clr-text-muted);
  transition: all 0.15s;
  font-weight: 500;
}
.segmented-group button:last-child { border-right: none; }
.segmented-group button.on { background: var(--clr-accent); color: white; }

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
}
.wp-pool-segmented {
  display: flex;
  border: 1px solid var(--clr-border);
  border-radius: 6px;
  overflow: hidden;
}
.wp-pool-segmented button {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.2rem 0.4rem;
  border: none;
  background: var(--clr-surface);
  cursor: pointer;
  color: var(--clr-text-muted);
  transition: all 0.15s;
}
.wp-pool-segmented button + button { border-left: 1px solid var(--clr-border); }
.wp-pool-segmented button.active { background: var(--clr-accent); color: white; }
.wp-pool-segmented button:hover:not(.active) { background: var(--clr-accent-light); color: var(--clr-accent); }
.wp-pool-count {
  font-size: 0.75rem;
  color: var(--clr-text-muted);
  font-variant-numeric: tabular-nums;
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
.wp-main { flex: 1; min-width: 0; overflow: hidden; }

/* Day nav */
.wp-nav-btn {
  width: 28px; height: 28px; border: 1px solid var(--clr-border); border-radius: 6px;
  background: var(--clr-surface); cursor: pointer; font-size: 1.1rem; font-weight: 700;
  color: var(--clr-text-muted); display: inline-flex; align-items: center; justify-content: center;
  transition: all 0.15s; padding: 0;
}
.wp-nav-btn:hover { border-color: var(--clr-accent); color: var(--clr-accent); background: var(--clr-accent-light); }

/* ---- Timeline (no own border — part of connected layout) ---- */
.wp-timeline-wrap { background: var(--clr-surface); overflow: hidden; }


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

/* ---- Timeline row (gutter + 7 columns) ---- */
.wp-timeline-row {
  display: flex;
  overflow-y: auto;
}


/* Day column */
.wp-tl-col {
  flex: 1;
  min-width: 0;
  border-left: 1px solid var(--clr-border);
}
.wp-tl-col.is-weekend { background: rgba(0,0,0,0.025); }
.wp-tl-col.wp-tl-dragover {
  outline: 2px dashed var(--clr-accent);
  outline-offset: -2px;
}
.wp-tl-col.drop-ok { outline-color: #10b981; }
.wp-tl-col.drop-warn { outline-color: #d97706; }
.wp-tl-col.drop-conflict { outline-color: #ef4444; }


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

/* Les-banden: stevige blauwe achtergrond */
.wp-band-les {
  background: rgba(99, 102, 241, 0.12);
  border-left: 3px solid rgba(99, 102, 241, 0.5);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.wp-band-les:hover { background: rgba(99, 102, 241, 0.2); border-left-color: var(--clr-accent); }

/* Bezet-banden: zacht pastel, activiteiten */
.wp-band-bezet {
  background: rgba(245, 158, 11, 0.08);
  border-left: 3px solid rgba(245, 158, 11, 0.35);
}

/* Vrij-banden */
.wp-band-vrij {
  background: rgba(16, 185, 129, 0.06);
  border-left: 3px solid rgba(16, 185, 129, 0.3);
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

.wp-band-bezet .wp-band-label { color: rgba(217, 119, 6, 0.6); font-weight: 700; }
.wp-band-vrij .wp-band-label { color: rgba(5, 150, 105, 0.6); }

.wp-band-selected {
  background: rgba(99, 102, 241, 0.22) !important;
  border-left-color: var(--clr-accent) !important;
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
  border-left-color: #10b981 !important;
}
.wp-band-drag-match.band-ok .wp-band-label { color: #059669; }

.wp-band-drag-match.band-warn {
  outline-color: #d97706;
  border-left-color: #d97706 !important;
}
.wp-band-drag-match.band-warn .wp-band-label { color: #d97706; }

.wp-band-drag-match.band-conflict {
  outline-color: #ef4444;
  border-left-color: #ef4444 !important;
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
.band-drop-icon.band-warn { color: #d97706; }
.band-drop-icon.band-conflict { color: #ef4444; }

/* ---- Drop indicator ---- */
.wp-drop-indicator {
  position: absolute;
  left: 2px; right: 2px;
  border: 2px dashed var(--clr-accent);
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

.wp-drop-indicator.drop-warn {
  border-color: #d97706;
}
.wp-drop-indicator.drop-warn .drop-icon { color: #d97706; }

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

/* Type border colors: rooster=oranje, huistaak=blauw */
.wp-tl-taak.is-rooster { border-left-color: #d97706; background: white; }
.wp-tl-taak.is-huistaak { border-left-color: #3b82f6; background: white; }

/* Klaar: strikethrough + faded */
.wp-tl-taak.is-klaar {
  opacity: 0.45;
  text-decoration: line-through;
  text-decoration-color: rgba(0,0,0,0.3);
}
.wp-tl-taak.is-klaar .tl-code,
.wp-tl-taak.is-klaar .tl-duur { text-decoration: line-through; text-decoration-color: inherit; }

/* Overdue: red warning */
.wp-tl-taak.is-overdue {
  border-left-color: #ef4444 !important;
  background: #fef2f2 !important;
  animation: overdue-pulse 2s ease-in-out infinite;
}
@keyframes overdue-pulse {
  0%, 100% { box-shadow: 0 1px 4px rgba(239,68,68,0.15), 0 0 0 1px rgba(239,68,68,0.1); }
  50% { box-shadow: 0 1px 4px rgba(239,68,68,0.35), 0 0 0 2px rgba(239,68,68,0.2); }
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

/* Day view card (reuses kanban card styles: .kaart-top, .code, .flags, .kaart-duur, .kaart-tekst) */
.tl-day-card {
  width: 100%; min-width: 0;
}
.tl-day-card .kaart-top { margin-bottom: 0.15rem; }
.tl-day-card .kaart-tekst { -webkit-line-clamp: 2; }
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
  outline: 3px solid #10b981;
  outline-offset: -1px;
  background: #ecfdf5 !important;
  animation: drag-pulse-ok 0.7s ease-in-out infinite;
}

.wp-tl-taak.drag-related-warn {
  outline: 3px solid #d97706;
  outline-offset: -1px;
  background: #fffbeb !important;
  animation: drag-pulse-warn 0.7s ease-in-out infinite;
}

.wp-tl-taak.drag-related-conflict {
  outline: 3px solid #ef4444;
  outline-offset: -1px;
  background: #fef2f2 !important;
  animation: drag-pulse-conflict 0.7s ease-in-out infinite;
}

@keyframes drag-pulse-ok {
  0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
  50% { box-shadow: 0 0 12px 4px rgba(16, 185, 129, 0.4); }
}

@keyframes drag-pulse-warn {
  0%, 100% { box-shadow: 0 0 0 0 rgba(217, 119, 6, 0.4); }
  50% { box-shadow: 0 0 12px 4px rgba(217, 119, 6, 0.4); }
}

@keyframes drag-pulse-conflict {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
  50% { box-shadow: 0 0 12px 4px rgba(239, 68, 68, 0.4); }
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

.wp-sb-vakfilter {
  display: flex; align-items: center; gap: 0.4rem; padding: 0.25rem 0.75rem 0.5rem;
}
.wp-sb-vakfilter-label {
  flex: 1; font-size: 0.75rem; font-weight: 700; color: var(--clr-accent);
  background: var(--clr-accent-light); padding: 0.25rem 0.5rem; border-radius: 6px;
}
.wp-sb-vakfilter-clear {
  background: none; border: none; font-size: 1rem; cursor: pointer;
  color: var(--clr-text-muted); padding: 0; line-height: 1;
}
.wp-sb-vakfilter-clear:hover { color: #ef4444; }

/* pool-filters in the filters slot */
.pool-filters { display: flex; gap: 2px; padding: 0 0.75rem 0.5rem; }
.pool-filters button {
  flex: 1; padding: 0.25rem 0.4rem; border: 1px solid var(--clr-border); border-radius: 6px;
  background: var(--clr-surface); cursor: pointer; font-size: 0.7rem; font-weight: 600;
  color: var(--clr-text-muted); transition: all 0.15s;
}
.pool-filters button.on { background: var(--clr-accent); color: white; border-color: var(--clr-accent); }
.pool-filters button:hover:not(.on) { border-color: var(--clr-accent); color: var(--clr-accent); }

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
.tl-overdue-icon {
  font-size: 0.65rem;
  font-weight: 900;
  color: #ef4444;
  background: #fef2f2;
  border-radius: 50%;
  width: 14px; height: 14px;
  display: inline-flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}

/* ---- Responsive ---- */
@media (max-width: 900px) {
  .wp-layout { flex-direction: column; }
}
</style>
