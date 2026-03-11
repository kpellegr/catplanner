<template>
  <div class="wg" :class="{ 'wg-mini': mini }">
    <!-- Grid: 8 rijen x 14 uur-blokken -->
    <div class="wg-grid">
      <!-- Uur labels bovenaan -->
      <div v-if="!compact && !mini" class="wg-row wg-uur-row">
        <div class="wg-dag-cell"></div>
        <div v-for="u in 14" :key="'u'+u" class="wg-uur-label">{{ uurLabel(u - 1) }}</div>
        <div class="wg-label-cell"></div>
      </div>

      <!-- Per dag/ongepland een rij -->
      <div v-for="kol in kolommen" :key="kol.key" class="wg-row">
        <div v-if="!mini" class="wg-dag-cell" :class="{ 'wg-vandaag': kol.key === vandaagDag, 'wg-ongepland-dag': kol.key === '_' }">
          {{ kol.label }}
        </div>
        <div
          v-for="u in 14"
          :key="u"
          class="wg-cel"
          :class="uurClass(kol.key, u - 1)"
          :data-tooltip="uurTooltip(kol.key, u - 1)" data-tooltip-pos="bottom"
        ></div>
        <div v-if="!mini" class="wg-label-cell" :class="kol.minClass">{{ kol.minLabel }}</div>
      </div>
    </div>

    <!-- Footer -->
    <div v-if="!mini" class="wg-footer">
      <div class="wg-legende">
        <span><span class="wg-dot klaar"></span>klaar</span>
        <span><span class="wg-dot gemist"></span>gemist</span>
        <span><span class="wg-dot rooster"></span>rooster</span>
        <span><span class="wg-dot huiswerk"></span>huiswerk</span>
        <span><span class="wg-dot les"></span>les</span>
        <span><span class="wg-dot bezet"></span>bezet</span>
      </div>
      <div v-if="!compact" class="wg-verdict" :class="verdictClass">{{ verdictText }}</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { usePlanner } from '../stores/planner.js';

const props = defineProps({
  compact: { type: Boolean, default: false },
  mini: { type: Boolean, default: false },
});

const { alleTaken, state } = usePlanner();

const dagen = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
const BLOKKEN = 56;

const now = new Date();
const jsDay = now.getDay();
const dagMap = [6, 0, 1, 2, 3, 4, 5];
const vandaagIdx = dagMap[jsDay];
const vandaagDag = dagen[vandaagIdx] || null;

function isDagVerleden(dag) {
  return dagen.indexOf(dag) < vandaagIdx;
}

function uurLabel(uurIdx) {
  const h = 8 + Math.floor((30 + uurIdx * 60) / 60);
  return `${h}`;
}

// Laag 1: weekrooster (les/bezet/vrij)
const roosterMap = computed(() => {
  const map = {};
  for (const dag of dagen) map[dag] = {};
  const wr = state.weekRooster || {};
  for (const dag of dagen) {
    const dagSlots = wr[dag];
    if (!dagSlots || typeof dagSlots !== 'object') continue;
    for (const [uurStr, slot] of Object.entries(dagSlots)) {
      const uur = parseInt(uurStr);
      const startBlok = (uur - 1) * 4;
      const kleur = (slot.type === 'bezet' || slot.type === 'pauze') ? 'bezet' : slot.type === 'les' ? 'les' : null;
      if (kleur) {
        for (let j = 0; j < 4; j++) {
          map[dag][startBlok + j] = { kleur, tooltip: slot.titel || slot.type };
        }
      }
    }
  }
  return map;
});

// Laag 2: taken (rooster/huiswerk/klaar/gemist)
const takenMap = computed(() => {
  const map = {};
  for (const dag of dagen) map[dag] = {};
  map['_'] = {};

  let ongeplandBlok = 0;

  for (const taak of alleTaken.value) {
    const status = taak.voortgang.status;
    const isRooster = taak.tijd?.type === 'rooster';
    const minuten = taak.voortgang.customMinuten || (taak.tijd?.type === 'minuten' ? taak.tijd.minuten : 0);
    const aantalBlokken = isRooster ? 4 : Math.max(1, Math.ceil(minuten / 15));
    const label = `${taak.code || '?'} – ${(taak.omschrijving || '').slice(0, 40)}`;

    let kleur;
    if (status === 'klaar' || status === 'ingediend') kleur = 'klaar';
    else if (taak.geplandOp && isDagVerleden(taak.geplandOp)) kleur = 'gemist';
    else if (isRooster) kleur = 'rooster';
    else kleur = 'huiswerk';

    const tooltip = `${label}${minuten ? ` · ${minuten}min` : ''}`;

    if (taak.geplandOp && taak.geplandBlok != null) {
      for (let j = 0; j < aantalBlokken; j++) {
        const b = taak.geplandBlok + j;
        if (b < BLOKKEN && !map[taak.geplandOp]?.[b]) map[taak.geplandOp][b] = { kleur, tooltip };
      }
    } else if (taak.geplandOp) {
      // Gepland op dag maar geen blok — zoek eerste vrije plek (check beide lagen)
      const dag = taak.geplandOp;
      let start = 0;
      for (let b = 0; b <= BLOKKEN - aantalBlokken; b++) {
        let vrij = true;
        for (let j = 0; j < aantalBlokken; j++) {
          if (map[dag][b + j] || roosterMap.value[dag]?.[b + j]) { vrij = false; break; }
        }
        if (vrij) { start = b; break; }
      }
      for (let j = 0; j < aantalBlokken; j++) {
        if (start + j < BLOKKEN) map[dag][start + j] = { kleur, tooltip };
      }
    } else {
      for (let j = 0; j < aantalBlokken; j++) {
        if (ongeplandBlok + j < BLOKKEN) map['_'][ongeplandBlok + j] = { kleur, tooltip };
      }
      ongeplandBlok += aantalBlokken;
    }
  }
  return map;
});

// Uur-blok kleur: taken-laag wint over rooster-laag
const TAAK_PRIO = { gemist: 4, rooster: 3, huiswerk: 2, klaar: 1 };
const ROOSTER_PRIO = { bezet: 2, les: 1 };

function uurClass(kolKey, uurIdx) {
  const baseBlok = uurIdx * 4;
  const tm = takenMap.value[kolKey] || {};
  const rm = roosterMap.value[kolKey] || {};

  // Check taken-laag eerst
  let bestTaak = null;
  for (let j = 0; j < 4; j++) {
    const cel = tm[baseBlok + j];
    if (cel && (!bestTaak || (TAAK_PRIO[cel.kleur] || 0) > (TAAK_PRIO[bestTaak] || 0))) {
      bestTaak = cel.kleur;
    }
  }
  if (bestTaak) return bestTaak;

  // Fallback naar rooster-laag
  let bestRooster = null;
  for (let j = 0; j < 4; j++) {
    const cel = rm[baseBlok + j];
    if (cel && (!bestRooster || (ROOSTER_PRIO[cel.kleur] || 0) > (ROOSTER_PRIO[bestRooster] || 0))) {
      bestRooster = cel.kleur;
    }
  }
  if (bestRooster) return bestRooster;

  return 'vrij';
}

function uurTooltip(kolKey, uurIdx) {
  const baseBlok = uurIdx * 4;
  const tm = takenMap.value[kolKey] || {};
  const rm = roosterMap.value[kolKey] || {};
  const tips = new Set();
  for (let j = 0; j < 4; j++) {
    const cel = tm[baseBlok + j] || rm[baseBlok + j];
    if (cel?.tooltip) tips.add(cel.tooltip);
  }
  return [...tips].join('\n');
}

const kolommen = computed(() => {
  const cols = dagen.map(dag => {
    const taken = alleTaken.value.filter(t => t.geplandOp === dag);
    const openMin = taken
      .filter(t => t.voortgang.status !== 'klaar' && t.voortgang.status !== 'ingediend')
      .reduce((s, t) => s + (t.voortgang.customMinuten || (t.tijd?.type === 'minuten' ? t.tijd.minuten : 0)), 0);
    const heeftGemist = isDagVerleden(dag) && taken.some(t => t.voortgang.status !== 'klaar' && t.voortgang.status !== 'ingediend');
    const alleKlaar = taken.length > 0 && taken.every(t => t.voortgang.status === 'klaar' || t.voortgang.status === 'ingediend');
    return {
      key: dag, label: dag,
      minLabel: openMin ? formatMin(openMin) : alleKlaar && taken.length ? '✓' : '–',
      minClass: heeftGemist ? 'wg-min-rood' : alleKlaar && taken.length ? 'wg-min-groen' : '',
    };
  });
  const ongeplande = alleTaken.value.filter(t => !t.geplandOp && t.voortgang.status !== 'klaar' && t.voortgang.status !== 'ingediend');
  const ongeplandMin = ongeplande.reduce((s, t) => s + (t.voortgang.customMinuten || (t.tijd?.type === 'minuten' ? t.tijd.minuten : 0)), 0);
  cols.push({
    key: '_', label: '?',
    minLabel: ongeplande.length ? formatMin(ongeplandMin) : '–',
    minClass: ongeplande.length ? 'wg-min-oranje' : '',
  });
  return cols;
});

function formatMin(min) {
  if (!min) return '';
  return `${min}'`;
}

// Verdict
const resterendeMinuten = computed(() =>
  alleTaken.value
    .filter(t => t.voortgang.status !== 'klaar' && t.voortgang.status !== 'ingediend')
    .reduce((s, t) => s + (t.voortgang.customMinuten || (t.tijd?.type === 'minuten' ? t.tijd.minuten : 0)), 0)
);
const achterstandMinuten = computed(() => {
  let min = 0;
  for (const t of alleTaken.value) {
    if (!t.geplandOp || !isDagVerleden(t.geplandOp)) continue;
    if (t.voortgang.status === 'klaar' || t.voortgang.status === 'ingediend') continue;
    min += t.voortgang.customMinuten || (t.tijd?.type === 'minuten' ? t.tijd.minuten : 0);
  }
  return min;
});
const ongeplandCount = computed(() =>
  alleTaken.value.filter(t => !t.geplandOp && t.voortgang.status !== 'klaar' && t.voortgang.status !== 'ingediend').length
);
const verdictClass = computed(() => {
  if (achterstandMinuten.value > 60) return 'wg-verdict-rood';
  if (achterstandMinuten.value > 0 || ongeplandCount.value > 2) return 'wg-verdict-oranje';
  if (resterendeMinuten.value === 0) return 'wg-verdict-groen';
  return '';
});
const verdictText = computed(() => {
  const parts = [];
  if (resterendeMinuten.value > 0) parts.push(`Nog ${formatMin(resterendeMinuten.value)} te gaan`);
  else parts.push('Alles afgewerkt!');
  if (achterstandMinuten.value > 0) parts.push(`${formatMin(achterstandMinuten.value)} achterstand`);
  if (ongeplandCount.value > 0) parts.push(`${ongeplandCount.value} niet ingepland`);
  return parts.join(' · ');
});
</script>

<style scoped>
.wg {
  padding: 12px 0;
}

.wg-row {
  display: flex;
  gap: 3px;
  margin-bottom: 3px;
}

/* Uur labels */
.wg-uur-row {
  margin-bottom: 1px;
}
.wg-uur-label {
  flex: 1;
  font-size: 0.5rem;
  font-weight: 600;
  color: var(--clr-text-muted);
  text-align: center;
  line-height: 1;
  min-width: 0;
}

/* Dag label */
.wg-dag-cell {
  width: 20px;
  flex-shrink: 0;
  font-size: 0.6rem;
  font-weight: 700;
  color: var(--clr-text-muted);
  text-transform: uppercase;
  display: flex;
  align-items: center;
}
.wg-dag-cell.wg-vandaag { color: var(--clr-accent); }
.wg-dag-cell.wg-ongepland-dag { color: #d97706; }

/* Minuten label rechts */
.wg-label-cell {
  width: 32px;
  flex-shrink: 0;
  font-size: 0.55rem;
  font-weight: 600;
  color: var(--clr-text-muted);
  display: flex;
  align-items: center;
  justify-content: flex-end;
}
.wg-min-rood { color: #ef4444; }
.wg-min-groen { color: var(--clr-klaar); }
.wg-min-oranje { color: #d97706; }

/* Uur-blokken */
.wg-cel {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  flex-shrink: 0;
  transition: opacity 0.15s;
}

/* Kleuren: soft pastel palette */
.wg-cel.vrij { background: #f0f0ee; }
.wg-cel.klaar { background: #86cfac; }
.wg-cel.gemist { background: #e07878; }
.wg-cel.rooster { background: #b4a7d6; }
.wg-cel.huiswerk { background: #7eb8d8; }
.wg-cel.les { background: #e0ddd6; }
.wg-cel.bezet { background: #c8c8c8; }

/* Footer */
.wg-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
  flex-wrap: wrap;
}
.wg-legende {
  display: flex;
  gap: 8px;
  font-size: 0.6rem;
  color: var(--clr-text-muted);
}
.wg-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 2px;
  vertical-align: middle;
  margin-right: 2px;
}
.wg-dot.klaar { background: #86cfac; }
.wg-dot.gemist { background: #e07878; }
.wg-dot.rooster { background: #b4a7d6; }
.wg-dot.huiswerk { background: #7eb8d8; }
.wg-dot.les { background: #e0ddd6; }
.wg-dot.bezet { background: #c8c8c8; }
.wg-dot.vrij { background: #f0f0ee; border: 1px solid var(--clr-border); }

.wg-verdict {
  padding: 4px 10px;
  border-radius: 6px;
  border-left: 3px solid var(--clr-border);
  font-size: 0.7rem;
  color: var(--clr-text-muted);
  background: var(--clr-bg);
}
.wg-verdict-oranje { border-left-color: #f59e0b; background: #fff7ed; color: #b45309; }
.wg-verdict-rood { border-left-color: #ef4444; background: #fef2f2; color: #dc2626; }
.wg-verdict-groen { border-left-color: var(--clr-klaar); background: #ecfdf5; color: #059669; }

/* Mini mode: tiny heatmap for header */
.wg-mini { padding: 0; }
.wg-mini .wg-row { gap: 1px; margin-bottom: 1px; }
.wg-mini .wg-cel {
  width: 5px;
  height: 5px;
  border-radius: 1px;
}
</style>
