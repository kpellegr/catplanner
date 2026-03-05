<template>
  <div id="app">
    <header>
      <h1>Catplanner</h1>
      <nav>
        <button :class="{ active: view === 'week' }" @click="view = 'week'">Weekoverzicht</button>
        <button :class="{ active: view === 'vandaag' }" @click="view = 'vandaag'">Vandaag</button>
      </nav>
    </header>

    <StatsBar v-if="state.weken.length" />

    <main>
      <FileUpload />

      <template v-if="view === 'week'">
        <WeekView
          v-for="week in state.weken"
          :key="`${week.metadata.periode}-${week.metadata.week}`"
          :week="week"
          @verwijder="verwijderWeek(week.metadata.periode, week.metadata.week)"
        />
      </template>

      <template v-if="view === 'vandaag'">
        <div class="vandaag-view" v-if="openTaken.length">
          <h2>Nog te doen</h2>
          <div class="taken-list">
            <TaakKaart
              v-for="taak in openTaken"
              :key="taak.id"
              :taak="taak"
              @status="(s) => updateVoortgang(taak.id, { status: s })"
              @werk="(m) => addMinuten(taak, m)"
            />
          </div>
        </div>
        <div v-else class="empty-state">
          <p>Alles is klaar! Of upload eerst een studiewijzer.</p>
        </div>
      </template>

      <div v-if="!state.weken.length" class="empty-state">
        <p>Upload een studiewijzer (.md) om te beginnen.</p>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { usePlanner } from './stores/planner.js';
import FileUpload from './components/FileUpload.vue';
import WeekView from './components/WeekView.vue';
import TaakKaart from './components/TaakKaart.vue';
import StatsBar from './components/StatsBar.vue';

const { state, alleTaken, updateVoortgang, verwijderWeek } = usePlanner();
const view = ref('week');

const openTaken = computed(() => {
  return alleTaken.value.filter((t) => t.voortgang.status !== 'klaar');
});

function addMinuten(taak, extra) {
  const current = taak.voortgang;
  const nieuw = current.minutenGewerkt + extra;
  const isKlaar = taak.tijd?.type === 'minuten' && nieuw >= taak.tijd.minuten;
  updateVoortgang(taak.id, {
    status: isKlaar ? 'klaar' : 'bezig',
    minutenGewerkt: nieuw,
  });
}
</script>
