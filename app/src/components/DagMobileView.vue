<template>
  <div class="dm">
    <!-- Dag navigatie -->
    <div class="dm-nav">
      <button class="dm-nav-btn" :disabled="dagIdx <= 0" @click="navigeer(-1)">
        <Icon icon="mdi:chevron-left" width="22" height="22" />
      </button>
      <div class="dm-nav-center">
        <span class="dm-dag-naam" :class="{ 'dm-vandaag': dag === vandaagDag }">{{ dagVol }}</span>
        <span class="dm-dag-meta">{{ dagCaption }}</span>
      </div>
      <button class="dm-nav-btn" :disabled="dagIdx >= 6" @click="navigeer(1)">
        <Icon icon="mdi:chevron-right" width="22" height="22" />
      </button>
    </div>

    <!-- Tijdlijn -->
    <div ref="scheduleRef" class="dm-schedule">
      <template v-for="slot in timeline" :key="slot.key">
        <!-- "Nu" lijn -->
        <div v-if="dag === vandaagDag && nuUur === slot.uur" class="dm-nu-line">
          <span class="dm-nu-label">{{ nuTijd }}</span>
        </div>

        <!-- Deadline lijn (zondag 21:00) -->
        <div v-if="dag === 'zo' && deadlineUur === slot.uur" class="dm-nu-line dm-deadline-line">
          <span class="dm-nu-label">{{ deadlineLabel }}</span>
        </div>

        <!-- Uur header: verberg als een taak dit uur overspant -->
        <div v-if="!isUurVerborgen(slot.uur)" class="dm-slot" :class="'dm-slot-' + slot.slotType" :data-uur="slot.uur">
          <span class="dm-slot-tijd">{{ slot.tijd }}</span>
          <span class="dm-slot-titel">{{ slot.titel }}</span>
        </div>

        <!-- Taken die in dit uur starten -->
        <div
          v-for="item in takenVoorUur(slot.uur)"
          :key="item.taak.id"
          class="dm-taak"
          :class="taakClass(item.taak)"
          :style="taakHoogte(item)"
        >
          <div class="dm-taak-top">
            <span class="dm-taak-code">{{ item.taak.code || shortVak(item.taak) }}</span>
            <span class="dm-taak-badges">
              <span class="dm-taak-duur">
                <template v-if="item.taak.tijd?.type === 'rooster'">R</template>
                <template v-else>{{ taakMinuten(item.taak) }}'</template>
              </span>
              <span class="dm-taak-status" :class="'dm-status-' + statusLabel(item.taak).cls" @click.stop="toggleKlaar(item.taak, $event)">{{ statusLabel(item.taak).text }}</span>
            </span>
          </div>
          <div class="dm-taak-omschrijving">{{ item.taak.omschrijving }}</div>
        </div>
      </template>
    </div>

    <!-- Ongeplande taken -->
    <div v-if="ongepland.length" class="dm-section">
      <h3 class="dm-section-heading" @click="openOngepland = !openOngepland">
        <span class="dm-chevron" :class="{ 'dm-chevron-open': openOngepland }">&#9656;</span>
        Niet ingepland
        <span class="dm-section-meta">· {{ ongepland.length }} taken · {{ ongeplandMin }}'</span>
      </h3>
      <template v-if="openOngepland">
        <div
          v-for="taak in ongepland"
          :key="taak.id"
          class="dm-taak"
          :class="taakClass(taak)"
        >
          <div class="dm-taak-top">
            <span class="dm-taak-code">{{ taak.code || shortVak(taak) }}</span>
            <span class="dm-taak-badges">
              <span class="dm-taak-duur">
                <template v-if="taak.tijd?.type === 'rooster'">R</template>
                <template v-else>{{ taakMinuten(taak) }}'</template>
              </span>
            </span>
          </div>
          <div class="dm-taak-omschrijving">{{ taak.omschrijving }}</div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { Icon } from '@iconify/vue';
import { usePlanner } from '../stores/planner.js';

const { alleTaken, state, updateVoortgang, wpFocusDag, wpFocusBlok, dopamineEvent } = usePlanner();

const scheduleRef = ref(null);

onMounted(() => {
  if (wpFocusBlok.value !== null) {
    const targetUur = Math.floor(wpFocusBlok.value / 4) + 1;
    wpFocusBlok.value = null; // consume
    nextTick(() => {
      const el = scheduleRef.value?.querySelector(`[data-uur="${targetUur}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
});

const dagen = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
const dagenVol = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];

const now = new Date();
const dagMap = [6, 0, 1, 2, 3, 4, 5];
const vandaagIdx = dagMap[now.getDay()];
const vandaagDag = dagen[vandaagIdx] || 'ma';

const openOngepland = ref(false);

const dag = computed(() => wpFocusDag.value || vandaagDag);
const dagIdx = computed(() => dagen.indexOf(dag.value));
const dagVol = computed(() => dagenVol[dagIdx.value] || '');

function navigeer(offset) {
  const nieuw = dagIdx.value + offset;
  if (nieuw >= 0 && nieuw <= 6) {
    wpFocusDag.value = dagen[nieuw];
  }
}

function isKlaar(taak) {
  return taak.voortgang.status === 'klaar' || taak.voortgang.status === 'ingediend';
}

function isDagVerleden(d) {
  return dagen.indexOf(d) < vandaagIdx;
}

function taakMinuten(taak) {
  return taak.voortgang.customMinuten || (taak.tijd?.type === 'minuten' ? taak.tijd.minuten : 0);
}

function shortVak(taak) {
  const v = taak.vak || taak.sectie || '';
  if (!v) return '?';
  return v.split(/[\s/]+/)[0].substring(0, 4).toUpperCase();
}

function blokToTijd(blok) {
  const min = blok * 15 + 8 * 60 + 30;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

// Taken gepland op deze dag
const dagTaken = computed(() =>
  alleTaken.value.filter(t => t.geplandOp === dag.value)
);

// Ongeplande taken
const ongepland = computed(() =>
  alleTaken.value.filter(t => !t.geplandOp && !isKlaar(t))
);
const ongeplandMin = computed(() =>
  ongepland.value.reduce((s, t) => s + taakMinuten(t), 0)
);

const dagCaption = computed(() => {
  const open = dagTaken.value.filter(t => !isKlaar(t));
  const min = open.reduce((s, t) => s + taakMinuten(t), 0);
  if (!dagTaken.value.length) return 'geen taken';
  const klaar = dagTaken.value.filter(isKlaar).length;
  if (klaar === dagTaken.value.length) return `${klaar} taken afgewerkt`;
  return `${open.length} open · ${min}'`;
});

function detectMaxUur() {
  let max = 10;
  const wr = state.weekRooster;
  if (wr) {
    for (const d of dagen) {
      const slots = wr[d];
      if (!slots || typeof slots !== 'object') continue;
      for (const uur of Object.keys(slots)) {
        max = Math.max(max, parseInt(uur));
      }
    }
  }
  return max;
}

// Timeline: uur headers
const timeline = computed(() => {
  const maxUur = detectMaxUur();
  const dagRooster = state.weekRooster?.[dag.value] || {};
  const slots = [];
  for (let uur = 1; uur <= maxUur; uur++) {
    const rooster = dagRooster[uur] || dagRooster[String(uur)];
    const slotType = rooster?.type || 'vrij';
    const titel = rooster?.titel || (slotType === 'vrij' ? '' : slotType);
    slots.push({
      key: `s_${uur}`,
      uur,
      slotType,
      titel,
      tijd: blokToTijd((uur - 1) * 4),
    });
  }
  return slots;
});

// Placed taken met start/end uur
const placedTaken = computed(() => {
  const maxUur = detectMaxUur();
  const sorted = [...dagTaken.value].sort((a, b) => {
    if (a.geplandBlok != null && b.geplandBlok != null) return a.geplandBlok - b.geplandBlok;
    if (a.geplandBlok != null) return -1;
    if (b.geplandBlok != null) return 1;
    return (a.code || '').localeCompare(b.code || '');
  });

  const bezet = new Set();
  const items = [];

  for (const taak of sorted) {
    const isR = taak.tijd?.type === 'rooster';
    const min = isR ? 60 : taakMinuten(taak);
    const blokken = isR ? 4 : Math.max(1, Math.ceil(min / 15));
    let blok = taak.geplandBlok;

    if (blok == null) {
      for (let b = 0; b <= (maxUur * 4) - blokken; b++) {
        let vrij = true;
        for (let j = 0; j < blokken; j++) {
          if (bezet.has(b + j)) { vrij = false; break; }
        }
        if (vrij) { blok = b; break; }
      }
      if (blok == null) blok = 0;
    }

    for (let j = 0; j < blokken; j++) bezet.add(blok + j);

    const startUur = Math.floor(blok / 4) + 1;
    const endBlok = blok + blokken;
    const endUur = Math.floor((endBlok - 1) / 4) + 1;
    const spanUren = endUur - startUur + 1;

    items.push({ taak, startUur, endUur, spanUren });
  }

  return items;
});

// Welke uren zijn overspannen door een taak (niet het startuur)?
const verborgenUren = computed(() => {
  const set = new Set();
  for (const item of placedTaken.value) {
    for (let u = item.startUur + 1; u <= item.endUur; u++) {
      set.add(u);
    }
  }
  return set;
});

function isUurVerborgen(uur) {
  return verborgenUren.value.has(uur);
}

// Taken die in een bepaald uur starten
function takenVoorUur(uur) {
  return placedTaken.value.filter(item => item.startUur === uur);
}

// Proportionele hoogte voor taken die meerdere uren overspannen
// Elke verborgen slot-header = ~1.6rem die we moeten compenseren
function taakHoogte(item) {
  if (item.spanUren <= 1) return {};
  const extraSlots = item.spanUren - 1;
  return { minHeight: `calc(${item.spanUren * 2.5}rem + ${extraSlots * 1.6}rem)` };
}

// "Nu" indicator
const nuUur = computed(() => {
  const h = now.getHours();
  const m = now.getMinutes();
  const minutesSince830 = (h - 8) * 60 + (m - 30);
  if (minutesSince830 < 0) return -1;
  return Math.floor(minutesSince830 / 60) + 1;
});

const nuTijd = computed(() => {
  const h = now.getHours();
  const m = now.getMinutes();
  return `${h}:${String(m).padStart(2, '0')}`;
});

const deadlineUur = 14;

const deadlineLabel = computed(() => {
  const nog = alleTaken.value.filter(t => t.voortgang.status !== 'ingediend').length;
  if (nog === 0) return 'Alles ingediend!';
  return `nog ${nog} taken indienen`;
});

function statusLabel(taak) {
  if (taak.voortgang.status === 'klaar') return { text: 'KLAAR', cls: 'klaar' };
  if (taak.voortgang.status === 'ingediend') return { text: 'INGEDIEND', cls: 'klaar' };
  if (taak.voortgang.status === 'bezig') return { text: 'BEZIG', cls: 'bezig' };
  if (taak.geplandOp && isDagVerleden(taak.geplandOp)) return { text: 'OVERDUE', cls: 'gemist' };
  return { text: 'OPEN', cls: 'open' };
}

function taakClass(taak) {
  if (isKlaar(taak)) return 'dm-taak-klaar';
  if (taak.geplandOp && isDagVerleden(taak.geplandOp)) return 'dm-taak-gemist';
  if (taak.tijd?.type === 'rooster') return 'dm-taak-rooster';
  return 'dm-taak-huiswerk';
}

function toggleKlaar(taak, event) {
  const nieuw = isKlaar(taak) ? 'open' : 'klaar';
  updateVoortgang(taak.id, { status: nieuw });
  if (nieuw === 'klaar') {
    const rect = event?.target?.getBoundingClientRect?.();
    const pos = rect
      ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    dopamineEvent.value = { ...pos, type: 'klaar' };
  }
}
</script>

<style scoped>
.dm {
  max-width: 700px;
  margin: 0 auto;
}

/* Dag navigatie */
.dm-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0.25rem 0;
  border-bottom: 1px solid var(--clr-border);
  margin-bottom: 0.35rem;
}
.dm-nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: none;
  border-radius: var(--radius);
  background: transparent;
  color: var(--clr-text-muted);
  cursor: pointer;
  flex-shrink: 0;
}
.dm-nav-btn:disabled {
  opacity: 0.2;
  cursor: default;
}
.dm-nav-btn:not(:disabled):hover {
  color: var(--clr-accent);
}
.dm-nav-center {
  flex: 1;
  text-align: center;
}
.dm-dag-naam {
  display: block;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--clr-text);
}
.dm-dag-naam.dm-vandaag {
  color: var(--clr-accent);
}
.dm-dag-meta {
  font-size: 0.75rem;
  color: var(--clr-text-muted);
}

/* Schedule */
.dm-schedule {
  display: flex;
  flex-direction: column;
}

/* Uur header */
.dm-slot {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  padding: 0.5rem 0 0.2rem;
  border-bottom: 1px solid var(--clr-border);
  margin-top: 0.25rem;
}
.dm-slot-les {
  border-bottom-color: var(--clr-border);
}
.dm-slot-tijd {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--clr-text-muted);
  font-variant-numeric: tabular-nums;
  min-width: 32px;
}
.dm-slot-titel {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--clr-text-muted);
}
.dm-slot-les .dm-slot-titel {
  color: var(--clr-text);
}

/* Vrij slot */
.dm-slot-vrij {
  border-bottom-color: rgba(0,0,0,0.04);
}
.dm-slot-vrij .dm-slot-titel::after {
  content: '—';
  color: var(--clr-text-muted);
  opacity: 0.25;
}

/* Taak */
.dm-taak {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 0.4rem 0.6rem 0.4rem 0.75rem;
  border-left: 3px solid transparent;
  background: white;
  margin: 2px 0;
}
.dm-taak-klaar {
  border-left-color: #10b981;
  opacity: 0.5;
}
.dm-taak-gemist {
  border-left-color: #d97706;
}
.dm-taak-rooster {
  border-left-color: #c4b5fd;
}
.dm-taak-huiswerk {
  border-left-color: #93c5fd;
}

.dm-taak-top {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.dm-taak-code {
  font-weight: 700;
  font-size: 0.85rem;
}
.dm-taak-badges {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
}
.dm-taak-omschrijving {
  font-size: 0.8rem;
  color: var(--clr-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.dm-taak-klaar .dm-taak-omschrijving {
  text-decoration: line-through;
  text-decoration-color: #10b981;
}

/* Duur */
.dm-taak-duur {
  font-size: 0.7rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--clr-text-muted);
}

/* Status badge */
.dm-taak-status {
  font-size: 0.65rem;
  font-weight: 700;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.dm-taak-status:active {
  opacity: 0.6;
}
.dm-status-klaar {
  color: #059669;
  background: #ecfdf5;
}
.dm-status-bezig {
  color: #b45309;
  background: #fffbeb;
}
.dm-status-gemist {
  color: #b45309;
  background: #fff7ed;
}
.dm-status-open {
  color: var(--clr-text-muted);
  background: var(--clr-bg);
}

/* "Nu" lijn */
.dm-nu-line {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0.25rem 0;
}
.dm-nu-line::before {
  content: '';
  flex: 1;
  border-top: 2px solid #ef4444;
}
.dm-nu-label {
  font-size: 0.6rem;
  font-weight: 800;
  color: #ef4444;
  white-space: nowrap;
}
.dm-deadline-line::before {
  border-top-style: dashed;
}

/* Ongepland sectie */
.dm-section {
  margin-top: 0.75rem;
  padding-top: 0.5rem;
}
.dm-section-heading {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--clr-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 0;
  padding: 0.4rem 0 0.2rem;
  border-bottom: 1px solid var(--clr-border);
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  gap: 4px;
}
.dm-section-heading:hover {
  color: var(--clr-text);
}
.dm-section-meta {
  text-transform: none;
  font-weight: 400;
  letter-spacing: 0;
}
.dm-chevron {
  font-size: 0.7rem;
  transition: transform 0.15s;
  display: inline-block;
}
.dm-chevron-open {
  transform: rotate(90deg);
}
</style>
