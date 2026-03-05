<template>
  <div class="week-view">
    <div class="week-header">
      <h2>Week {{ week.metadata.week }}</h2>
      <span class="datum">{{ week.metadata.datumRange?.van }} – {{ week.metadata.datumRange?.tot }}</span>
      <button class="btn-remove" @click="$emit('verwijder')" title="Verwijder week">&times;</button>
    </div>

    <div v-for="section in week.sections" :key="section.vak" class="section">
      <h3 class="section-title">
        <span class="hoofdgroep-label">{{ section.hoofdgroep }}</span>
        {{ vakNaam(section) }}
      </h3>

      <div class="taken-list">
        <TaakKaart
          v-for="taak in enriched(section.taken)"
          :key="taak.id"
          :taak="taak"
          @status="(s) => updateVoortgang(taak.id, { status: s })"
          @werk="(m) => addMinuten(taak, m)"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import TaakKaart from './TaakKaart.vue';
import { usePlanner } from '../stores/planner.js';

const props = defineProps({ week: Object });
defineEmits(['verwijder']);

const { state, updateVoortgang } = usePlanner();

function taakId(taak) {
  const m = props.week.metadata;
  return `P${m.periode}W${m.week}_${taak.code || ''}_${(taak.omschrijving || '').slice(0, 30)}`.replace(/\s+/g, '_');
}

function enriched(taken) {
  return taken.map((t) => {
    const id = taakId(t);
    return {
      ...t,
      id,
      voortgang: state.voortgang[id] || { status: 'todo', minutenGewerkt: 0 },
    };
  });
}

function vakNaam(section) {
  return section.vak || section.hoofdgroep || '';
}

function addMinuten(taak, extra) {
  const current = state.voortgang[taak.id] || { status: 'bezig', minutenGewerkt: 0 };
  const nieuw = current.minutenGewerkt + extra;
  const isKlaar = taak.tijd?.type === 'minuten' && nieuw >= taak.tijd.minuten;
  updateVoortgang(taak.id, {
    status: isKlaar ? 'klaar' : 'bezig',
    minutenGewerkt: nieuw,
  });
}
</script>
