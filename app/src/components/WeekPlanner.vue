<template>
  <div class="weekplan">
    <div class="wp-layout">
      <!-- Sidebar: unplanned tasks -->
      <div
        class="wp-sidebar"
        @dragover.prevent
        @dragenter.prevent="dragOverTarget = '__pool__'"
        @dragleave="onDragLeave($event, '__pool__')"
        @drop="onDropPool($event)"
      >
        <div class="wp-sb-header">
          <span class="wp-sb-titel">Ongepland</span>
          <span class="wp-sb-count">{{ gefilterdeOngeplande.length }} · {{ gefilterdeOngeplandMinuten }}'</span>
        </div>
        <div v-if="selectedVak" class="wp-sb-vakfilter">
          <span class="wp-sb-vakfilter-label">{{ selectedVak }}</span>
          <button class="wp-sb-vakfilter-clear" @click="selectedVak = null">&times;</button>
        </div>
        <div v-else class="wp-sb-filters">
          <button :class="{ on: sidebarFilter !== 'rooster' }" @click="toggleFilter('huistaken')">Huistaken</button>
          <button :class="{ on: sidebarFilter !== 'huistaken' }" @click="toggleFilter('rooster')">Rooster</button>
        </div>
        <div class="wp-sb-taken" :class="{ 'drag-over': dragOverTarget === '__pool__' }">
          <template v-for="groep in sidebarGroepen" :key="groep.vak">
            <button class="vak-rij-header" @click="toggleVak(groep.vak)">
              <span class="vak-chevron" :class="{ open: isVakOpen(groep.vak) }">&#9656;</span>
              <span class="vak-naam">{{ groep.vak || 'Overig' }}</span>
              <span class="vak-samenvatting">{{ groep.taken.length }} · {{ groepMinuten(groep) }}'</span>
            </button>
            <template v-if="isVakOpen(groep.vak)">
              <div
                v-for="taak in groep.taken"
                :key="taak.id"
                class="kanban-kaart"
                :class="[hoofdgroepClass(taak), dragRelatedClass(taak), { 'is-rooster': taak.tijd?.type === 'rooster', dragging: draggingTaak?.id === taak.id }]"
                :draggable="!isReadOnly"
                @dragstart="onDragStart($event, taak)"
                @dragend="onDragEnd"
              >
                <div class="kaart-top">
                  <span v-if="taak.code" class="code">{{ taak.code }}</span>
                  <span v-if="taakKeten(taak)" class="kaart-keten" :title="ketenTooltip(taak)">
                    <template v-for="(stap, si) in taakKeten(taak)" :key="stap.id">
                      <span class="keten-stap" :class="[ketenStapKleur(stap, taak), { 'keten-eigen': stap.id === taak.id }]">{{ stap.volgorde }}</span>
                      <span v-if="si < taakKeten(taak).length - 1" class="keten-pijl">→</span>
                    </template>
                  </span>
                  <div class="flags">
                    <span v-for="f in taak.flags" :key="f" class="flag" :title="flagTooltips[f] || f">{{ f }}</span>
                  </div>
                  <span class="kaart-duur prominent">{{ formatDuur(taak) }}</span>
                </div>
                <p class="kaart-tekst">{{ taak.omschrijving }}</p>
              </div>
            </template>
          </template>
          <div v-if="!gefilterdeOngeplande.length" class="wp-sb-leeg">
            {{ sidebarFilter === 'rooster' ? 'Geen roostertaken' : sidebarFilter === 'huistaken' ? 'Geen huistaken' : 'Alle taken ingepland!' }}
          </div>
        </div>
      </div>

      <!-- Main area -->
      <div class="wp-main">
        <div class="wp-header">
          <h2>Weekplan</h2>
          <span class="wp-deadline">Deadline: zo 21:00</span>
          <button class="wp-action-btn" @click="autoSuggest" title="Rooster-taken automatisch inplannen">Auto</button>
          <button v-if="hasGeplande" class="wp-action-btn wp-reset-btn" @click="resetWeekplan" title="Weekplanning wissen">Reset</button>
        </div>

        <!-- Timeline grid: gutter + 7 day columns -->
        <div class="wp-timeline-wrap">
          <!-- Column headers ABOVE the scrollable area -->
          <div class="wp-col-headers">
            <div class="wp-gutter-placeholder"></div>
            <div
              v-for="dag in dagen"
              :key="'h-' + dag"
              class="wp-col-header"
              :class="{ 'is-weekend': dag === 'za' || dag === 'zo', 'is-vandaag': dag === vandaagDag }"
            >
              <span class="wp-col-naam">{{ dagKort[dag] }}</span>
              <span class="wp-col-cap" :class="capaciteitClass(dag)">{{ geplandMinuten(dag) }}' / {{ beschikbareMinuten(dag) }}'</span>
            </div>
          </div>

          <!-- Scrollable timeline -->
          <div class="wp-timeline-row">
            <!-- Time gutter -->
            <div class="wp-gutter">
              <div v-for="h in 14" :key="h" class="wp-gutter-hour" :style="{ top: (h - 1) * BLOKKEN_PER_UUR * BLOK_PX + 'px', height: BLOKKEN_PER_UUR * BLOK_PX + 'px' }">
                {{ formatUur(h) }}
              </div>
            </div>

            <!-- Day columns -->
            <div
              v-for="dag in dagen"
              :key="dag"
              class="wp-tl-col"
              :class="{ 'wp-tl-dragover': dragOverTarget === dag, 'is-weekend': dag === 'za' || dag === 'zo', 'is-vandaag': dag === vandaagDag }"
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
                  :class="[`wp-band-${slot.type}`, { 'wp-band-selected': isBandSelected(slot), 'wp-band-drag-match': isBandDragMatch(slot) }]"
                  :style="slotStyle(slot)"
                  @click="slot.type === 'les' ? toggleVakFilter(slot.titel) : null"
                >
                  <span class="wp-band-label">{{ kortLabel(slot.titel) }}</span>
                </div>

                <!-- Deadline line: Sunday 21:00 -->
                <div
                  v-if="dag === 'zo'"
                  class="wp-deadline-line"
                  :style="{ top: DEADLINE_BLOK * BLOK_PX + 'px' }"
                >
                  <span class="wp-deadline-label">21:00</span>
                </div>

                <!-- Drop indicator -->
                <div
                  v-if="dragOverTarget === dag && dropBlok !== null"
                  class="wp-drop-indicator"
                  :class="dropIndicatorClass(dag)"
                  :style="{ top: dropBlok * BLOK_PX + 'px', height: draggingTaakBlokken * BLOK_PX + 'px' }"
                ></div>

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
                  @dragstart="onDragStart($event, placed.taak)"
                  @dragend="onDragEnd"
                >
                  <div class="tl-compact-row">
                    <button
                      class="tl-check-btn"
                      :class="{ checked: placed.taak.voortgang.status === 'klaar' || placed.taak.voortgang.status === 'ingediend' }"
                      :title="placed.taak.voortgang.status === 'klaar' ? 'Markeer als open' : 'Markeer als klaar'"
                      @click.stop="toggleKlaar(placed.taak)"
                    >✓</button>
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
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import { usePlanner } from '../stores/planner.js';

const { state, alleTaken, planTaak, updateVoortgang, isReadOnly } = usePlanner();

const dagen = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
const dagKort = { ma: 'MA', di: 'DI', wo: 'WO', do: 'DO', vr: 'VR', za: 'ZA', zo: 'ZO' };
const flagTooltips = { P: 'Inleveren op papier', M: 'Materiaal meebrengen', U: 'Uitgestelde deadline', G: 'Groepswerk' };

// ---- Timeline constants ----
const BLOK_PX = 22;          // pixels per 15-min block (~half day on screen)
const BLOKKEN_PER_UUR = 4;   // 4 × 15 min = 60 min
const TOTAL_BLOKKEN = 14 * BLOKKEN_PER_UUR; // 56 blocks
const TOTAL_PX = TOTAL_BLOKKEN * BLOK_PX;   // 1232px

// Deadline line: 21:00 on the timeline
// Timeline starts at 8:30 (h=1). Hour h covers (7+h):30 to (8+h):30
// 21:00 = 12h30m after 8:30 = 12.5 hours = 50 blocks
const DEADLINE_BLOK = 50;

const dragOverTarget = ref(null);
const draggingTaak = ref(null);
const dropBlok = ref(null);
const sidebarFilter = ref(null);
const selectedVak = ref(null);
const openVakken = reactive({});

// ---- Helpers ----

function formatUur(h) {
  const hour = 7 + h;
  return `${hour}:30`;
}

function formatDuur(taak) {
  if (taak.voortgang?.customMinuten != null) return `${taak.voortgang.customMinuten}'`;
  if (!taak.tijd) return '15\'';
  if (taak.tijd.type === 'rooster') return 'R';
  if (taak.tijd.type === 'minuten') return `${taak.tijd.minuten}'`;
  return '15\'';
}

function duurTooltip(taak) {
  if (!taak.tijd) return '15 minuten (standaard)';
  if (taak.tijd.type === 'rooster') return 'Roosteruur';
  if (taak.tijd.type === 'minuten') return `${taak.tijd.minuten} minuten`;
  return '';
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

function hoofdgroepClass(taak) {
  const hg = (taak.hoofdgroep || '').toUpperCase();
  if (hg.includes('WETENSCHAP')) return 'hg-wetenschap';
  if (hg.includes('TALEN')) return 'hg-talen';
  if (hg.includes('WISKUNDE')) return 'hg-wiskunde';
  if (hg.includes('PROJECT')) return 'hg-project';
  return 'hg-algemeen';
}

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
    top: startBlok * BLOK_PX + 'px',
    height: BLOKKEN_PER_UUR * BLOK_PX + 'px',
  };
}

// ---- Volgtijdelijkheid (dependency chains) ----

// All unique vakken from tasks
const alleVakken = computed(() => {
  const map = new Map();
  for (const taak of alleTaken.value) {
    const vak = taak.vak || '';
    if (!map.has(vak)) map.set(vak, []);
    map.get(vak).push(taak);
  }
  return Array.from(map.entries()).map(([naam, taken]) => ({ naam, taken }));
});

const volgordeKetens = computed(() => {
  const result = [];
  for (const vak of alleVakken.value) {
    const metVolgorde = [...vak.taken]
      .filter(t => typeof t.volgorde === 'number')
      .sort((a, b) => (a.origIndex ?? 0) - (b.origIndex ?? 0));

    if (metVolgorde.length < 2) continue;

    let huidigeKeten = [metVolgorde[0]];
    for (let i = 1; i < metVolgorde.length; i++) {
      if (metVolgorde[i].volgorde > metVolgorde[i - 1].volgorde) {
        huidigeKeten.push(metVolgorde[i]);
      } else {
        if (huidigeKeten.length > 1) result.push(huidigeKeten);
        huidigeKeten = [metVolgorde[i]];
      }
    }
    if (huidigeKeten.length > 1) result.push(huidigeKeten);
  }
  return result;
});

const relatedIds = computed(() => {
  const lookup = new Map();
  for (const keten of volgordeKetens.value) {
    const ids = keten.map(t => t.id);
    for (const id of ids) {
      lookup.set(id, new Set(ids));
    }
  }
  return lookup;
});

const taakKetenMap = computed(() => {
  const map = new Map();
  for (const keten of volgordeKetens.value) {
    for (const t of keten) {
      map.set(t.id, keten);
    }
  }
  return map;
});

function taakKeten(taak) {
  return taakKetenMap.value.get(taak.id) || null;
}

function ketenTooltip(taak) {
  const keten = taakKeten(taak);
  if (!keten) return '';
  return `Volgorde: ${keten.map(t => t.code || `#${t.volgorde}`).join(' → ')}`;
}

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
function ketenStapKleur(stap, kaart) {
  if (stap.id !== kaart.id) return 'keten-grijs';
  const keten = taakKetenMap.value.get(stap.id);
  if (!keten) return 'keten-grijs';
  const idx = keten.findIndex(t => t.id === stap.id);

  const gepland = effectiveGeplandOp(stap);

  // First in chain
  if (idx === 0) {
    return gepland ? 'keten-groen' : 'keten-grijs';
  }

  // Not planned → grey
  if (!gepland) return 'keten-grijs';

  const voorganger = keten[idx - 1];

  // Predecessor is done → always ok
  if (voorganger.voortgang.status === 'klaar' || voorganger.voortgang.status === 'ingediend') {
    return 'keten-groen';
  }

  const voorGepland = effectiveGeplandOp(voorganger);

  // Predecessor not planned → orange warning
  if (!voorGepland) return 'keten-oranje';

  // Both planned: check temporal order (using effective positions during drag)
  const stapTR = effectiveTemporalRank(stap);
  const voorTR = effectiveTemporalRank(voorganger);

  if (voorTR >= stapTR) return 'keten-rood'; // predecessor at same time or after
  return 'keten-groen'; // predecessor before
}

function isRelatedToDrag(taakId) {
  if (!draggingTaak.value) return false;
  const related = relatedIds.value.get(draggingTaak.value.id);
  return related?.has(taakId) && taakId !== draggingTaak.value.id;
}

function dragRelatedClass(taak) {
  if (!isRelatedToDrag(taak.id)) return '';
  const keten = taakKetenMap.value.get(taak.id);
  if (!keten) return 'drag-related-ok';
  let worstLevel = 0;
  for (let i = 1; i < keten.length; i++) {
    const kleur = ketenStapKleur(keten[i], keten[i]);
    if (kleur === 'keten-rood') worstLevel = 2;
    else if (kleur === 'keten-oranje' && worstLevel < 2) worstLevel = 1;
  }
  if (worstLevel === 2) return 'drag-related-conflict';
  if (worstLevel === 1) return 'drag-related-warn';
  return 'drag-related-ok';
}

// ---- Place tasks on timeline (no overlap) ----

function geplaatstetaken(dag) {
  const taken = alleTaken.value.filter(t => t.geplandOp === dag);
  if (!taken.length) return [];

  const result = [];

  for (const taak of taken) {
    const blokken = taakBlokken(taak);

    if (taak.geplandBlok !== null && taak.geplandBlok !== undefined) {
      // Use saved position, but ensure no overlap
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
  return alleTaken.value.filter(t => {
    if (t.geplandOp) return false;
    if (t.voortgang.status === 'klaar' || t.voortgang.status === 'ingediend') return false;
    return true;
  });
});

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

// ---- Sidebar grouping ----

const sidebarGroepen = computed(() => {
  const map = {};
  for (const taak of gefilterdeOngeplande.value) {
    const vak = taak.vak || '';
    if (!map[vak]) map[vak] = { vak, taken: [] };
    map[vak].taken.push(taak);
  }
  return Object.values(map).sort((a, b) => a.vak.localeCompare(b.vak));
});

function groepMinuten(groep) { return groep.taken.reduce((s, t) => (t.tijd?.type === 'minuten' ? s + t.tijd.minuten : s), 0); }
function isVakOpen(vak) { return openVakken[vak] !== false; }
function toggleVak(vak) { openVakken[vak] = !isVakOpen(vak); }
function toggleFilter(f) { sidebarFilter.value = sidebarFilter.value === f ? null : f; selectedVak.value = null; }
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
  const blok = Math.max(0, Math.min(TOTAL_BLOKKEN - 1, Math.floor(y / BLOK_PX)));
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

// Check if drop position would overlap
function dropIndicatorClass(dag) {
  if (!draggingTaak.value || dropBlok.value === null) return '';
  const blokken = taakBlokken(draggingTaak.value);
  const snapped = snapBlok(dropBlok.value, dag, draggingTaak.value.id);
  const placed = geplaatstetaken(dag).filter(p => p.taak.id !== draggingTaak.value.id);
  for (const p of placed) {
    if (snapped < p.blok + p.blokken && snapped + blokken > p.blok) return 'drop-conflict';
  }
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
  const pxPer5Min = BLOK_PX / 3;
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
  nowTimer = setInterval(() => { now.value = new Date(); }, 60000); // update every minute
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
/* ---- Layout ---- */
.wp-layout { display: flex; gap: 0.75rem; align-items: flex-start; }
.wp-main { flex: 1; min-width: 0; }

/* ---- Header ---- */
.wp-header { display: flex; align-items: baseline; gap: 1rem; margin-bottom: 0.5rem; }
.wp-header h2 { margin: 0; font-size: 1.3rem; }
.wp-deadline { font-size: 0.8rem; color: var(--clr-text-muted); background: var(--clr-bg); padding: 0.15rem 0.5rem; border-radius: 4px; }

.wp-action-btn {
  padding: 0.3rem 0.75rem; border: 1px solid var(--clr-border); border-radius: 6px;
  background: var(--clr-surface); cursor: pointer; font-size: 0.8rem; font-weight: 600;
  color: var(--clr-text-muted); transition: all 0.15s; white-space: nowrap;
  min-width: 5.5rem; text-align: center; box-sizing: border-box;
}
.wp-action-btn:hover { border-color: var(--clr-accent); color: var(--clr-accent); background: var(--clr-accent-light); }
.wp-action-btn.wp-reset-btn:hover { border-color: #ef4444; color: #ef4444; background: #fef2f2; }

/* ---- Column headers (above scroll area) ---- */
.wp-timeline-wrap { border: 1px solid var(--clr-border); border-radius: var(--radius); background: var(--clr-surface); overflow: hidden; }

.wp-col-headers {
  display: flex;
  border-bottom: 2px solid var(--clr-border);
  background: var(--clr-surface);
}

.wp-gutter-placeholder { width: 36px; flex-shrink: 0; border-right: 1px solid var(--clr-border); }

.wp-col-header {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column; align-items: center; gap: 0;
  padding: 0.3rem 0.15rem;
  border-left: 1px solid var(--clr-border);
}
.wp-col-header:first-of-type { border-left: none; }
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
  max-height: calc(100vh - 11rem);
}

/* Time gutter */
.wp-gutter {
  width: 36px;
  flex-shrink: 0;
  position: relative;
  background: var(--clr-bg);
  border-right: 1px solid var(--clr-border);
}

.wp-gutter-hour {
  position: absolute;
  left: 0; right: 0;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 1px;
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--clr-text-muted);
  font-variant-numeric: tabular-nums;
  border-top: 1px solid var(--clr-border);
}

/* Day column */
.wp-tl-col {
  flex: 1;
  min-width: 0;
  border-left: 1px solid var(--clr-border);
}
.wp-tl-col:first-of-type { border-left: none; }
.wp-tl-col.is-weekend { background: rgba(0,0,0,0.025); }
.wp-tl-col.wp-tl-dragover { background: rgba(99, 102, 241, 0.04); }

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

/* ---- Deadline line (Sunday 21:00) ---- */
.wp-deadline-line {
  position: absolute;
  left: 0; right: 0;
  height: 0;
  border-top: 3px solid #ef4444;
  z-index: 2;
  pointer-events: none;
}
.wp-deadline-label {
  position: absolute;
  top: -0.8rem;
  right: 2px;
  font-size: 0.6rem;
  font-weight: 800;
  color: #ef4444;
  background: var(--clr-surface);
  padding: 0 3px;
  line-height: 1;
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

/* Bezet-banden: diagonale strepen, duidelijk "geblokkeerd" */
.wp-band-bezet {
  background:
    repeating-linear-gradient(
      -45deg,
      rgba(245, 158, 11, 0.07),
      rgba(245, 158, 11, 0.07) 4px,
      rgba(245, 158, 11, 0.15) 4px,
      rgba(245, 158, 11, 0.15) 8px
    );
  border-left: 3px solid rgba(245, 158, 11, 0.5);
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
  background: rgba(16, 185, 129, 0.18) !important;
  border-left-color: #10b981 !important;
  animation: band-pulse 0.8s ease-in-out infinite;
}
.wp-band-drag-match .wp-band-label { color: #059669; }

@keyframes band-pulse {
  0%, 100% { box-shadow: inset 0 0 0 0 rgba(16, 185, 129, 0.1); }
  50% { box-shadow: inset 0 0 8px 2px rgba(16, 185, 129, 0.25); }
}

/* ---- Drop indicator ---- */
.wp-drop-indicator {
  position: absolute;
  left: 2px; right: 2px;
  background: rgba(99, 102, 241, 0.15);
  border: 2px dashed var(--clr-accent);
  border-radius: 4px;
  z-index: 5;
  pointer-events: none;
  animation: drop-pulse 0.8s ease-in-out infinite;
}

.wp-drop-indicator.drop-conflict {
  background: rgba(239, 68, 68, 0.15);
  border-color: #ef4444;
}

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

.wp-tl-taak.hg-wetenschap { border-left-color: var(--clr-wetenschap); }
.wp-tl-taak.hg-talen { border-left-color: var(--clr-talen); }
.wp-tl-taak.hg-wiskunde { border-left-color: var(--clr-wiskunde); }
.wp-tl-taak.hg-project { border-left-color: var(--clr-project); }

/* Rooster tasks: dashed border, white background */
.wp-tl-taak.is-rooster {
  border-left-style: dashed;
  background: white;
}

/* Huistaken: clean white card (default) */
.wp-tl-taak.is-huistaak {
  background: white;
}

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

/* ---- Drag highlights (chain related) ---- */
.wp-tl-taak.drag-related-ok,
.kanban-kaart.drag-related-ok {
  outline: 3px solid #10b981;
  outline-offset: -1px;
  background: #ecfdf5 !important;
  animation: drag-pulse-ok 0.7s ease-in-out infinite;
}

.wp-tl-taak.drag-related-warn,
.kanban-kaart.drag-related-warn {
  outline: 3px solid #d97706;
  outline-offset: -1px;
  background: #fffbeb !important;
  animation: drag-pulse-warn 0.7s ease-in-out infinite;
}

.wp-tl-taak.drag-related-conflict,
.kanban-kaart.drag-related-conflict {
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

/* ---- Dependency chain badges ---- */
.kaart-keten {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  font-size: 0.65rem;
  font-weight: 700;
}

.keten-stap {
  width: 1.2rem;
  height: 1.2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  background: var(--clr-bg);
  color: var(--clr-text-muted);
  font-variant-numeric: tabular-nums;
}

.keten-stap.keten-eigen {
  outline: 2px solid currentColor;
  outline-offset: -1px;
  font-weight: 900;
}

.keten-grijs { background: var(--clr-bg); color: var(--clr-text-muted); }
.keten-groen { background: #ecfdf5; color: #059669; }
.keten-oranje { background: #fffbeb; color: #d97706; }
.keten-rood { background: #fef2f2; color: #dc2626; }

.keten-pijl {
  color: var(--clr-text-muted);
  opacity: 0.4;
  font-size: 0.55rem;
}

/* ---- Sidebar ---- */
.wp-sidebar {
  width: 260px; flex-shrink: 0; background: var(--clr-surface);
  border: 1px solid var(--clr-border); border-radius: var(--radius);
  position: sticky; top: 1rem; max-height: calc(100vh - 8rem); overflow-y: auto;
}

.wp-sb-header { display: flex; align-items: baseline; justify-content: space-between; padding: 0.6rem 0.75rem 0.35rem; }
.wp-sb-titel { font-weight: 700; font-size: 0.95rem; }
.wp-sb-count { font-size: 0.75rem; color: var(--clr-text-muted); font-variant-numeric: tabular-nums; }

.wp-sb-filters { display: flex; gap: 2px; padding: 0 0.75rem 0.5rem; }
.wp-sb-filters button {
  flex: 1; padding: 0.25rem 0.4rem; border: 1px solid var(--clr-border); border-radius: 6px;
  background: var(--clr-surface); cursor: pointer; font-size: 0.7rem; font-weight: 600;
  color: var(--clr-text-muted); transition: all 0.15s;
}
.wp-sb-filters button.on { background: var(--clr-accent); color: white; border-color: var(--clr-accent); }
.wp-sb-filters button:hover:not(.on) { border-color: var(--clr-accent); color: var(--clr-accent); }

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

.wp-sb-taken { padding: 0 0.5rem 0.5rem; display: flex; flex-direction: column; gap: 0.3rem; min-height: 60px; transition: background 0.15s; }
.wp-sb-taken.drag-over { background: var(--clr-accent-light); }

.vak-rij-header {
  display: flex; align-items: center; gap: 0.4rem; width: 100%; padding: 0.4rem 0.25rem;
  border: none; background: none; cursor: pointer; font-size: 0.8rem; font-weight: 600;
  color: var(--clr-text); text-align: left; border-bottom: 1px solid var(--clr-border); transition: background 0.1s;
}
.vak-rij-header:hover { background: var(--clr-bg); }
.vak-chevron { font-size: 0.65rem; transition: transform 0.15s; color: var(--clr-text-muted); display: inline-block; }
.vak-chevron.open { transform: rotate(90deg); }
.vak-naam { font-weight: 700; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.vak-samenvatting { font-size: 0.7rem; font-weight: 500; color: var(--clr-text-muted); white-space: nowrap; }

/* Sidebar cards: identical to kanban open/bezig cards */
.kanban-kaart {
  background: var(--clr-surface); border-radius: 8px; padding: 0.6rem 0.75rem;
  box-shadow: var(--shadow); border-left: 3px solid var(--clr-todo);
  cursor: grab; transition: box-shadow 0.15s, opacity 0.15s, transform 0.15s; user-select: none;
}
.kanban-kaart:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.12); }
.kanban-kaart.dragging { opacity: 0.5; transform: rotate(1deg); }
.kanban-kaart.hg-wetenschap { border-left-color: var(--clr-wetenschap); }
.kanban-kaart.hg-talen { border-left-color: var(--clr-talen); }
.kanban-kaart.hg-wiskunde { border-left-color: var(--clr-wiskunde); }
.kanban-kaart.hg-project { border-left-color: var(--clr-project); }
.kanban-kaart.is-rooster { border-left-style: dashed; background: white; }

.kaart-top { display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.3rem; }
.kaart-top .flags { margin-left: auto; display: flex; gap: 0.25rem; }
.code { font-size: 0.8rem; font-weight: 700; color: var(--clr-accent); }
.flags { display: flex; gap: 0.2rem; }
.flag { font-size: 0.6rem; font-weight: 700; background: #fef3c7; color: #92400e; padding: 0.05rem 0.25rem; border-radius: 3px; }
.kaart-duur { font-size: 0.75rem; font-weight: 700; color: var(--clr-text-muted); background: var(--clr-bg); padding: 0.1rem 0.4rem; border-radius: 4px; font-variant-numeric: tabular-nums; }
.kaart-duur.prominent { font-size: 0.85rem; background: var(--clr-accent-light); color: var(--clr-accent); padding: 0.15rem 0.5rem; }
.kaart-tekst { margin: 0; font-size: 0.85rem; line-height: 1.4; color: var(--clr-text); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

.wp-sb-leeg { color: var(--clr-text-muted); font-size: 0.8rem; font-style: italic; padding: 1.5rem 0; text-align: center; }

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
  .wp-sidebar { width: 100%; position: static; max-height: none; }
}
</style>
