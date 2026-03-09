<template>
  <div class="print-rapport">
    <div class="rapport-filters no-print">
      <div class="segmented-group">
        <button :class="{ on: !verbergRooster }" @click="verbergRooster = !verbergRooster">Rooster</button>
        <button :class="{ on: !verbergKlaar }" @click="verbergKlaar = !verbergKlaar">Afgewerkt</button>
      </div>
    </div>

    <div class="rapport-header">
      <h1 v-if="weekInfo">Planning week {{ weekInfo.week }} <span class="rapport-week-datum">{{ weekInfo.datum }}</span></h1>
      <h1 v-else>Takenoverzicht</h1>
      <p class="rapport-datum">Afgedrukt op {{ vandaag }}</p>
    </div>

    <div
      v-for="vak in vakken"
      :key="vak.naam"
      class="vak-blok"
    >
      <h2 class="vak-titel">{{ vak.naam || 'Overig' }}</h2>
      <table class="taken-tabel">
        <thead>
          <tr>
            <th class="col-check"></th>
            <th class="col-code">Code</th>
            <th class="col-nr">#</th>
            <th class="col-omschrijving">Omschrijving</th>
            <th class="col-duur">Duur</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="taak in vak.taken"
            :key="taak.id"
            :class="{ ingediend: isIngediend(taak), klaar: isKlaar(taak) }"
          >
            <td class="col-check">
              <span class="checkbox" :class="{ checked: isKlaar(taak) || isIngediend(taak) }">
                {{ (isKlaar(taak) || isIngediend(taak)) ? '&#10003;' : '' }}
              </span>
            </td>
            <td class="col-code">{{ taak.code }}</td>
            <td class="col-nr">{{ taak.volgorde }}</td>
            <td class="col-omschrijving">{{ taak.omschrijving || '—' }}</td>
            <td class="col-duur">{{ formatDuur(taak) }}</td>
          </tr>
        </tbody>
      </table>
      <div class="vak-totaal">
        {{ vak.taken.length }} taken — {{ vakMinuten(vak.taken) }} min
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { usePlanner } from '../stores/planner.js';

const { state, alleTaken } = usePlanner();

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
    datum = `${fmtDatum(w.datumRange.van)} – ${fmtDatum(w.datumRange.tot)}`;
  }
  return { week: w.week, datum };
});

const verbergRooster = ref(false);
const verbergKlaar = ref(false);

const vandaag = new Date().toLocaleDateString('nl-BE', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
});

function basisSort(a, b) {
  const codeA = (a.code || '').toUpperCase();
  const codeB = (b.code || '').toUpperCase();
  if (codeA !== codeB) return codeA.localeCompare(codeB);
  return (a.volgorde || 0) - (b.volgorde || 0);
}

const gefilterdeTaken = computed(() => {
  let taken = alleTaken.value;
  if (verbergRooster.value) {
    taken = taken.filter((t) => t.tijd?.type !== 'rooster');
  }
  if (verbergKlaar.value) {
    taken = taken.filter((t) => t.voortgang.status !== 'klaar' && t.voortgang.status !== 'ingediend');
  }
  return taken;
});

const vakken = computed(() => {
  const map = new Map();
  for (const taak of gefilterdeTaken.value) {
    const vak = taak.vak || '';
    if (!map.has(vak)) map.set(vak, []);
    map.get(vak).push(taak);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([naam, taken]) => ({ naam, taken: taken.sort(basisSort) }));
});

function isKlaar(taak) {
  return taak.voortgang.status === 'klaar' || taak.voortgang.status === 'ingediend';
}

function isIngediend(taak) {
  return taak.voortgang.status === 'ingediend';
}

function formatDuur(taak) {
  if (!taak.tijd) return '';
  if (taak.tijd.type === 'rooster') return 'rooster';
  if (taak.tijd.type === 'minuten') return `${taak.tijd.minuten}'`;
  return '';
}

function vakMinuten(taken) {
  return taken.reduce((sum, t) => {
    if (t.tijd?.type === 'minuten') return sum + t.tijd.minuten;
    return sum;
  }, 0);
}
</script>

<style scoped>
.rapport-filters {
  margin-bottom: 1rem;
}

.segmented-group {
  display: inline-flex;
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

.segmented-group button:last-child {
  border-right: none;
}

.segmented-group button.on {
  background: var(--clr-accent);
  color: white;
}

.print-rapport {
  max-width: 800px;
  margin: 0 auto;
  padding: 1.5rem;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  color: #1a1a2e;
}

.rapport-header {
  margin-bottom: 1.5rem;
  border-bottom: 2px solid #1a1a2e;
  padding-bottom: 0.5rem;
}

.rapport-header h1 {
  margin: 0;
  font-size: 1.4rem;
}

.rapport-week-datum {
  font-size: 0.9rem;
  font-weight: 500;
  color: #6b7280;
}

.rapport-datum {
  margin: 0.25rem 0 0;
  font-size: 0.8rem;
  color: #6b7280;
}

/* Weduwe/wezen: vak-blok nooit breken */
.vak-blok {
  break-inside: avoid;
  page-break-inside: avoid;
  margin-bottom: 1.25rem;
}

.vak-titel {
  font-size: 1rem;
  font-weight: 700;
  margin: 0 0 0.35rem;
  padding: 0.3rem 0.5rem;
  background: #f0f0eb;
  border-radius: 4px;
}

.taken-tabel {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}

.taken-tabel th {
  text-align: left;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #6b7280;
  padding: 0.25rem 0.4rem;
  border-bottom: 1px solid #d1d5db;
}

.taken-tabel td {
  padding: 0.3rem 0.4rem;
  border-bottom: 1px solid #e5e7eb;
  vertical-align: top;
}

.col-check { width: 1.5rem; text-align: center; }
.col-code { width: 3.5rem; font-weight: 600; }
.col-nr { width: 1.5rem; text-align: center; color: #6b7280; }
.col-omschrijving { }
.col-duur { width: 3.5rem; text-align: right; font-variant-numeric: tabular-nums; }

.checkbox {
  display: inline-block;
  width: 0.9rem;
  height: 0.9rem;
  border: 1.5px solid #9ca3af;
  border-radius: 2px;
  text-align: center;
  line-height: 0.9rem;
  font-size: 0.65rem;
  vertical-align: middle;
}

.checkbox.checked {
  border-color: #10b981;
  color: #10b981;
}

tr.ingediend td {
  text-decoration: line-through;
  color: #9ca3af;
}

tr.ingediend .checkbox {
  border-color: #9ca3af;
  color: #9ca3af;
}

.vak-totaal {
  font-size: 0.75rem;
  color: #6b7280;
  text-align: right;
  padding: 0.2rem 0.4rem;
}

/* ---- Print styles ---- */

@media print {
  .print-rapport {
    padding: 0;
    max-width: 100%;
  }

  .vak-blok {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .vak-titel {
    background: #eee !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .checkbox.checked {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  tr.ingediend td {
    text-decoration: line-through;
  }
}
</style>
