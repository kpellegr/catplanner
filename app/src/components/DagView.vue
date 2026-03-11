<template>
  <div class="dag-view"
    @dragover.prevent="dragOver = true"
    @dragleave.self="dragOver = false"
    @drop.prevent="onDrop"
    :class="{ 'drag-active': dragOver }"
  >
    <div class="dag-header">
      <h3>{{ dagNaam }}</h3>
      <span class="dag-samenvatting" v-if="taken.length">
        {{ taken.length }} taken · {{ formatTijd(totaalMinuten) }} zelfwerk
      </span>
    </div>

    <!-- Lesblokken -->
    <div class="les-blokken">
      <div v-for="(les, i) in blokken" :key="i" class="les-blok">
        <span class="les-label">{{ les }}</span>
        <button class="les-remove" @click="verwijderLes(i)" title="Verwijder">&times;</button>
      </div>
      <div class="les-toevoegen">
        <input
          ref="lesInput"
          v-model="nieuweLes"
          placeholder="+ les toevoegen (bijv. BIO, LO)"
          @keydown.enter="voegLesToe"
          class="les-input"
        />
      </div>
    </div>

    <!-- Ingeplande taken -->
    <div v-if="taken.length" class="dag-taken">
      <TaakKaart
        v-for="taak in taken"
        :key="taak.id"
        :taak="taak"
        :planbaar="true"
        :is-selected="selectedTaakId === taak.id"
        @click="selectTaak(taak.id)"
        @status="(s) => updateVoortgang(taak.id, { status: s })"
        @werk="(m) => addMinuten(taak, m)"
        @unplan="planTaak(taak.id, null)"
      />
    </div>

    <div v-if="!taken.length" class="dag-leeg">
      <p>Nog geen taken ingepland.</p>
      <p class="dag-leeg-hint">Klik op + in het zijpaneel, of sleep taken hierheen.</p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, nextTick } from 'vue';
import { usePlanner } from '../stores/planner.js';
import TaakKaart from './TaakKaart.vue';

const props = defineProps({
  dag: String,
  periode: Number,
  weekNr: Number,
  taken: Array,
});

const { updateVoortgang, planTaak, getLesBlokken, updateLesBlokken, selectedTaakId, selectTaak } = usePlanner();

onMounted(() => {
  if (selectedTaakId.value) {
    nextTick(() => {
      const el = document.querySelector('.kanban-kaart.is-selected');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }
});

const dagOver = { ma: 'Maandag', di: 'Dinsdag', wo: 'Woensdag', do: 'Donderdag', vr: 'Vrijdag' };
const dagNaam = computed(() => dagOver[props.dag] || props.dag);

const blokken = computed(() => getLesBlokken(props.periode, props.weekNr, props.dag));

const totaalMinuten = computed(() =>
  props.taken.reduce((s, t) => s + (t.tijd?.type === 'minuten' ? t.tijd.minuten : 0), 0)
);

const dragOver = ref(false);
const nieuweLes = ref('');

function voegLesToe() {
  const val = nieuweLes.value.trim();
  if (!val) return;
  updateLesBlokken(props.periode, props.weekNr, props.dag, [...blokken.value, val]);
  nieuweLes.value = '';
}

function verwijderLes(i) {
  const copy = [...blokken.value];
  copy.splice(i, 1);
  updateLesBlokken(props.periode, props.weekNr, props.dag, copy);
}

function addMinuten(taak, extra) {
  const current = taak.voortgang;
  const nieuw = current.minutenGewerkt + extra;
  const isKlaar = taak.tijd?.type === 'minuten' && nieuw >= taak.tijd.minuten;
  updateVoortgang(taak.id, {
    status: isKlaar ? 'klaar' : 'bezig',
    minutenGewerkt: nieuw,
  });
}

function onDrop(e) {
  dragOver.value = false;
  const id = e.dataTransfer.getData('text/plain');
  if (id) planTaak(id, props.dag);
}

function formatTijd(min) {
  if (!min) return '0\'';
  if (min < 60) return `${min}'`;
  const u = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${u}u${String(m).padStart(2, '0')}` : `${u}u`;
}
</script>

<style scoped>
.dag-view {
  background: var(--clr-surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow: hidden;
  transition: box-shadow 0.15s;
  min-height: 300px;
}

.dag-view.drag-active {
  box-shadow: 0 0 0 2px var(--clr-accent), var(--shadow);
}

.dag-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--clr-accent-light);
  border-bottom: 2px solid var(--clr-accent);
}

.dag-header h3 {
  margin: 0;
  font-size: 1rem;
  color: var(--clr-accent);
}

.dag-samenvatting {
  font-size: 0.8rem;
  color: var(--clr-text-muted);
}

/* Lesblokken */

.les-blokken {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.3rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--clr-border);
  min-height: 2.2rem;
}

.les-blok {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  background: #e0e7ff;
  color: #4338ca;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.les-remove {
  background: none;
  border: none;
  color: #4338ca;
  font-size: 0.85rem;
  cursor: pointer;
  padding: 0;
  opacity: 0.4;
  line-height: 1;
}

.les-remove:hover {
  opacity: 1;
}

.les-input {
  border: none;
  outline: none;
  font-size: 0.75rem;
  color: var(--clr-text);
  background: transparent;
  padding: 0.15rem 0.3rem;
  min-width: 10rem;
}

.les-input::placeholder {
  color: var(--clr-text-muted);
  opacity: 0.6;
}

/* Taken */

.dag-taken {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
}

.dag-leeg {
  padding: 2rem 1rem;
  text-align: center;
  color: var(--clr-text-muted);
}

.dag-leeg p {
  margin: 0.25rem 0;
}

.dag-leeg-hint {
  font-size: 0.8rem;
  opacity: 0.7;
}
</style>
