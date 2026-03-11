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

    <!-- Tijdlijn: alle uren + taken -->
    <div class="dm-schedule">
      <template v-for="slot in timeline" :key="slot.key">
        <!-- Uur header -->
        <div class="dm-slot" :class="'dm-slot-' + slot.slotType">
          <span class="dm-slot-tijd">{{ slot.tijd }}</span>
          <span class="dm-slot-titel">{{ slot.titel }}</span>
        </div>

        <!-- Taken in dit uur -->
        <div
          v-for="taak in slot.taken"
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
              <span class="dm-taak-status" :class="'dm-status-' + statusLabel(taak).cls">{{ statusLabel(taak).text }}</span>
            </span>
          </div>
          <div class="dm-taak-omschrijving">{{ taak.omschrijving }}</div>
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
import { ref, computed } from 'vue';
import { Icon } from '@iconify/vue';
import { usePlanner } from '../stores/planner.js';

const { alleTaken, state, updateVoortgang, wpFocusDag } = usePlanner();

const dagen = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
const dagenVol = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];

const now = new Date();
const dagMap = [6, 0, 1, 2, 3, 4, 5];
const vandaagIdx = dagMap[now.getDay()];
const vandaagDag = dagen[vandaagIdx] || 'ma';

const openOngepland = ref(false);

// Use shared wpFocusDag so desktop and mobile stay in sync
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

// Dag caption: "3 taken · 75'"
const dagCaption = computed(() => {
  const open = dagTaken.value.filter(t => !isKlaar(t));
  const min = open.reduce((s, t) => s + taakMinuten(t), 0);
  if (!dagTaken.value.length) return 'geen taken';
  const klaar = dagTaken.value.filter(isKlaar).length;
  if (klaar === dagTaken.value.length) return `${klaar} taken afgewerkt`;
  return `${open.length} open · ${min}'`;
});

// Detect max uren from weekRooster
function detectMaxUur() {
  let max = 10; // default: 8:30–17:30
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

// Full timeline: all hours with rooster info + tasks placed in each hour
const timeline = computed(() => {
  const maxUur = detectMaxUur();
  const dagRooster = state.weekRooster?.[dag.value] || {};

  // Build uur→taken map based on geplandBlok
  const takenPerUur = {};
  const sortedTaken = [...dagTaken.value].sort((a, b) => {
    if (a.geplandBlok != null && b.geplandBlok != null) return a.geplandBlok - b.geplandBlok;
    if (a.geplandBlok != null) return -1;
    if (b.geplandBlok != null) return 1;
    return (a.code || '').localeCompare(b.code || '');
  });

  const bezet = new Set();
  for (const taak of sortedTaken) {
    const isR = taak.tijd?.type === 'rooster';
    const min = taakMinuten(taak);
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

    // Map to uur (blok 0-3 = uur 1, blok 4-7 = uur 2, etc.)
    const uur = Math.floor(blok / 4) + 1;
    if (!takenPerUur[uur]) takenPerUur[uur] = [];
    takenPerUur[uur].push(taak);
  }

  const slots = [];
  for (let uur = 1; uur <= maxUur; uur++) {
    const rooster = dagRooster[uur] || dagRooster[String(uur)];
    const slotType = rooster?.type || 'vrij';
    const titel = rooster?.titel || (slotType === 'vrij' ? '' : slotType);
    const startBlok = (uur - 1) * 4;

    slots.push({
      key: `s_${uur}`,
      uur,
      slotType,
      titel,
      tijd: blokToTijd(startBlok),
      taken: takenPerUur[uur] || [],
    });
  }

  return slots;
});

function statusLabel(taak) {
  if (taak.voortgang.status === 'klaar') return { text: 'KLAAR', cls: 'klaar' };
  if (taak.voortgang.status === 'ingediend') return { text: 'INGEDIEND', cls: 'klaar' };
  if (taak.voortgang.status === 'bezig') return { text: 'BEZIG', cls: 'bezig' };
  if (taak.geplandOp && isDagVerleden(taak.geplandOp)) return { text: 'GEMIST', cls: 'gemist' };
  return { text: 'OPEN', cls: 'open' };
}

function taakClass(taak) {
  if (isKlaar(taak)) return 'dm-taak-klaar';
  if (taak.geplandOp && isDagVerleden(taak.geplandOp)) return 'dm-taak-gemist';
  if (taak.tijd?.type === 'rooster') return 'dm-taak-rooster';
  return 'dm-taak-huiswerk';
}

function toggleKlaar(taak) {
  const nieuw = isKlaar(taak) ? 'open' : 'klaar';
  updateVoortgang(taak.id, { status: nieuw });
}
</script>

<style scoped>
.dm {
  max-width: 700px;
  margin: 0 auto;
}

/* Dag navigatie — typographic, minimal */
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

/* Uur header — studiewijzer-style: uppercase, small, border-bottom */
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

/* Vrij slot — subtle */
.dm-slot-vrij {
  border-bottom-color: rgba(0,0,0,0.04);
}
.dm-slot-vrij .dm-slot-titel::after {
  content: '—';
  color: var(--clr-text-muted);
  opacity: 0.25;
}

/* Taak — white card for depth against bg */
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
  border-left-color: #ef4444;
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

/* Duur badge — like studiewijzer tijd */
.dm-taak-duur {
  font-size: 0.7rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--clr-text-muted);
}

/* Status badge — studiewijzer-style pills */
.dm-taak-status {
  font-size: 0.65rem;
  font-weight: 700;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
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
  color: #dc2626;
  background: #fef2f2;
}
.dm-status-open {
  color: var(--clr-text-muted);
  background: var(--clr-bg);
}

/* Ongepland sectie — studiewijzer groep-header style */
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

/* Empty */
.dm-empty {
  text-align: center;
  padding: 2rem 1rem;
  color: var(--clr-text-muted);
  font-size: 0.85rem;
}
</style>
