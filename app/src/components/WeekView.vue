<template>
  <div class="week-view">
    <WeekStrip
      :week="week"
      :geselecteerdeDag="geselecteerdeDag"
      :taken="enrichedTaken"
      @selectDag="geselecteerdeDag = $event"
      @verwijder="$emit('verwijder')"
    />

    <div class="week-body">
      <DagView
        :dag="geselecteerdeDag"
        :periode="week.metadata.periode"
        :weekNr="week.metadata.week"
        :taken="ingeplandVoorDag"
      />

      <div class="zijpaneel">
        <div class="zijpaneel-header">
          <span class="zijpaneel-titel">Nog in te plannen</span>
          <span class="zijpaneel-stats">{{ ongepland.length }} · {{ formatTijd(ongeplandMinuten) }}</span>
        </div>
        <div class="zijpaneel-lijst">
          <div
            v-for="taak in ongepland"
            :key="taak.id"
            class="zij-taak"
            :class="hoofdgroepClass(taak.hoofdgroep)"
            draggable="true"
            @dragstart="onDragStart($event, taak)"
          >
            <span class="zij-code">{{ taak.code || '–' }}</span>
            <span class="zij-omschrijving">{{ taak.omschrijving }}</span>
            <span class="zij-tijd" v-if="taak.tijd?.type === 'minuten'">{{ taak.tijd.minuten }}'</span>
            <span class="zij-tijd rooster-tag" v-else-if="taak.tijd?.type === 'rooster'">les</span>
            <button class="btn-plan-zij" @click="planTaak(taak.id, geselecteerdeDag)" title="Plan op deze dag">+</button>
          </div>
          <div v-if="!ongepland.length" class="zij-leeg">Alles is ingepland!</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { usePlanner } from '../stores/planner.js';
import WeekStrip from './WeekStrip.vue';
import DagView from './DagView.vue';

const props = defineProps({ week: Object });
defineEmits(['verwijder']);

const { state, planTaak } = usePlanner();

const dagIndex = new Date().getDay();
const dagMap = { 1: 'ma', 2: 'di', 3: 'wo', 4: 'do', 5: 'vr' };
const geselecteerdeDag = ref(dagMap[dagIndex] || 'ma');

function taakId(taak) {
  const m = props.week.metadata;
  return `P${m.periode}W${m.week}_${taak.code || ''}_${(taak.omschrijving || '').slice(0, 30)}`.replace(/\s+/g, '_');
}

const enrichedTaken = computed(() => {
  const taken = [];
  for (const section of props.week.sections) {
    for (const taak of section.taken) {
      const id = taakId(taak);
      taken.push({
        ...taak,
        id,
        voortgang: state.voortgang[id] || { status: 'todo', minutenGewerkt: 0 },
        geplandOp: state.planning[id] || null,
      });
    }
  }
  return taken;
});

const ingeplandVoorDag = computed(() =>
  enrichedTaken.value.filter((t) => t.geplandOp === geselecteerdeDag.value)
);

const ongepland = computed(() =>
  enrichedTaken.value.filter((t) => !t.geplandOp && t.voortgang.status !== 'klaar')
);

const ongeplandMinuten = computed(() =>
  ongepland.value.reduce((s, t) => s + (t.tijd?.type === 'minuten' ? t.tijd.minuten : 0), 0)
);

function formatTijd(min) {
  if (!min) return '0\'';
  if (min < 60) return `${min}'`;
  const u = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${u}u${String(m).padStart(2, '0')}` : `${u}u`;
}

function hoofdgroepClass(hg) {
  const h = (hg || '').toUpperCase();
  if (h.includes('WETENSCHAP')) return 'hg-wetenschap';
  if (h.includes('TALEN')) return 'hg-talen';
  if (h.includes('WISKUNDE')) return 'hg-wiskunde';
  if (h.includes('PROJECT')) return 'hg-project';
  return 'hg-algemeen';
}

function onDragStart(e, taak) {
  e.dataTransfer.setData('text/plain', taak.id);
  e.dataTransfer.effectAllowed = 'move';
}
</script>

<style scoped>
.week-view {
  margin-bottom: 2rem;
}

.week-body {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 0.75rem;
  align-items: start;
}

/* ---- Zijpaneel ---- */

.zijpaneel {
  background: var(--clr-surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow: hidden;
  position: sticky;
  top: 1rem;
  max-height: calc(100vh - 2rem);
  display: flex;
  flex-direction: column;
}

.zijpaneel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid var(--clr-border);
  background: #fafaf8;
}

.zijpaneel-titel {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--clr-text-muted);
}

.zijpaneel-stats {
  font-size: 0.75rem;
  font-weight: 600;
  color: #b45309;
}

.zijpaneel-lijst {
  overflow-y: auto;
  padding: 0.35rem;
  flex: 1;
}

.zij-taak {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.4rem;
  border-radius: 5px;
  font-size: 0.78rem;
  cursor: grab;
  border-left: 3px solid transparent;
  transition: background 0.1s;
}

.zij-taak:hover {
  background: #f5f5f0;
}

.zij-taak:active {
  cursor: grabbing;
}

.zij-taak.hg-wetenschap { border-left-color: var(--clr-wetenschap); }
.zij-taak.hg-talen { border-left-color: var(--clr-talen); }
.zij-taak.hg-wiskunde { border-left-color: var(--clr-wiskunde); }
.zij-taak.hg-project { border-left-color: var(--clr-project); }
.zij-taak.hg-algemeen { border-left-color: var(--clr-algemeen); }

.zij-code {
  font-weight: 700;
  color: var(--clr-accent);
  min-width: 2.8rem;
  font-size: 0.72rem;
}

.zij-omschrijving {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.zij-tijd {
  font-size: 0.72rem;
  font-weight: 700;
  color: #059669;
  white-space: nowrap;
}

.zij-tijd.rooster-tag {
  color: #4338ca;
  font-size: 0.65rem;
  text-transform: uppercase;
}

.btn-plan-zij {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.2rem;
  height: 1.2rem;
  border-radius: 50%;
  border: 1px solid #d1d5db;
  background: white;
  color: var(--clr-accent);
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  opacity: 0;
  flex-shrink: 0;
  transition: opacity 0.1s;
}

.zij-taak:hover .btn-plan-zij {
  opacity: 1;
}

.btn-plan-zij:hover {
  background: var(--clr-accent-light);
  border-color: var(--clr-accent);
}

.zij-leeg {
  padding: 1.5rem 0.5rem;
  text-align: center;
  font-size: 0.8rem;
  color: var(--clr-text-muted);
}

@media (max-width: 700px) {
  .week-body {
    grid-template-columns: 1fr;
  }

  .zijpaneel {
    position: static;
    max-height: none;
  }
}
</style>
