<template>
  <div class="week-strip">
    <div class="week-strip-header">
      <h2>Week {{ week.metadata.week }}</h2>
      <span class="datum" v-if="week.metadata.datumRange">
        {{ week.metadata.datumRange.van }} – {{ week.metadata.datumRange.tot }}
      </span>
      <button class="btn-remove" @click="$emit('verwijder')" title="Verwijder week">&times;</button>
    </div>

    <div class="dagen-strip">
      <button
        v-for="dag in DAGEN"
        :key="dag"
        class="dag-cel"
        :class="{ active: dag === geselecteerdeDag }"
        @click="$emit('selectDag', dag)"
      >
        <span class="dag-label">{{ dagLabel(dag) }}</span>
        <span class="dag-taken" v-if="dagInfo(dag).taken > 0">{{ dagInfo(dag).taken }}t</span>
        <span class="dag-tijd" v-if="dagInfo(dag).minuten > 0">{{ formatKort(dagInfo(dag).minuten) }}</span>
        <div class="dag-progress" v-if="dagInfo(dag).taken > 0">
          <div class="dag-progress-fill" :style="{ width: dagInfo(dag).pct + '%' }"></div>
        </div>
      </button>
    </div>

    <div class="ongepland-strip" v-if="ongepland.length > 0">
      <span class="ongepland-label">{{ ongepland.length }} niet ingepland</span>
      <span class="ongepland-tijd">{{ formatKort(ongeplandMinuten) }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { usePlanner } from '../stores/planner.js';

const props = defineProps({
  week: Object,
  geselecteerdeDag: String,
  taken: Array,
});

defineEmits(['selectDag', 'verwijder']);

const { DAGEN } = usePlanner();

function dagLabel(dag) {
  return { ma: 'Ma', di: 'Di', wo: 'Wo', do: 'Do', vr: 'Vr' }[dag];
}

function takenVoorDag(dag) {
  return props.taken.filter((t) => t.geplandOp === dag);
}

function dagInfo(dag) {
  const dt = takenVoorDag(dag);
  const taken = dt.length;
  const minuten = dt.reduce((s, t) => s + (t.tijd?.type === 'minuten' ? t.tijd.minuten : 0), 0);
  const klaar = dt.filter((t) => t.voortgang.status === 'klaar').length;
  const pct = taken > 0 ? Math.round((klaar / taken) * 100) : 0;
  return { taken, minuten, klaar, pct };
}

const ongepland = computed(() => props.taken.filter((t) => !t.geplandOp));

const ongeplandMinuten = computed(() =>
  ongepland.value.reduce((s, t) => s + (t.tijd?.type === 'minuten' ? t.tijd.minuten : 0), 0)
);

function formatKort(min) {
  if (!min) return '';
  if (min < 60) return `${min}'`;
  const u = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${u}u${String(m).padStart(2, '0')}` : `${u}u`;
}
</script>

<style scoped>
.week-strip {
  background: var(--clr-surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  margin-bottom: 1rem;
  overflow: hidden;
}

.week-strip-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--clr-border);
}

.week-strip-header h2 {
  margin: 0;
  font-size: 1.1rem;
}

.datum {
  color: var(--clr-text-muted);
  font-size: 0.82rem;
}

.btn-remove {
  margin-left: auto;
  background: none;
  border: 1px solid var(--clr-border);
  border-radius: var(--radius);
  font-size: 1.1rem;
  width: 1.75rem;
  height: 1.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--clr-text-muted);
  padding: 0;
  line-height: 1;
}

.btn-remove:hover {
  background: #fee2e2;
  border-color: #ef4444;
  color: #ef4444;
}

.dagen-strip {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 1px;
  background: var(--clr-border);
}

.dag-cel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  padding: 0.6rem 0.4rem;
  background: var(--clr-surface);
  border: none;
  cursor: pointer;
  transition: background 0.15s;
  position: relative;
}

.dag-cel:hover {
  background: var(--clr-accent-light);
}

.dag-cel.active {
  background: var(--clr-accent-light);
  box-shadow: inset 0 -3px 0 var(--clr-accent);
}

.dag-label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--clr-text-muted);
}

.dag-cel.active .dag-label {
  color: var(--clr-accent);
}

.dag-taken {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--clr-text);
}

.dag-tijd {
  font-size: 0.7rem;
  color: var(--clr-text-muted);
}

.dag-progress {
  width: 80%;
  height: 3px;
  background: var(--clr-border);
  border-radius: 2px;
  overflow: hidden;
  margin-top: 0.15rem;
}

.dag-progress-fill {
  height: 100%;
  background: var(--clr-klaar);
  border-radius: 2px;
  transition: width 0.3s;
}

.ongepland-strip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.4rem;
  background: #fef9f0;
  border-top: 1px solid #fde68a;
  font-size: 0.75rem;
  color: #b45309;
  font-weight: 600;
}
</style>
