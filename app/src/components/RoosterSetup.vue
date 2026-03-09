<template>
  <div class="rooster-setup">
    <div class="setup-header">
      <h3>Lessenrooster instellen</h3>
      <p>Welke vakken heeft Daan op welke dag?</p>
    </div>

    <div class="rooster-grid">
      <div v-for="dag in DAGEN" :key="dag" class="rooster-dag">
        <span class="dag-kop">{{ dagLabel[dag] }}</span>
        <div class="vak-chips">
          <button
            v-for="vak in beschikbareVakken"
            :key="vak"
            class="vak-chip"
            :class="{ selected: isSelected(dag, vak) }"
            @click="toggle(dag, vak)"
          >
            {{ vak }}
          </button>
        </div>
      </div>
    </div>

    <div class="setup-actions">
      <button class="btn-save" @click="opslaan">Opslaan</button>
    </div>
  </div>
</template>

<script setup>
import { reactive, computed } from 'vue';
import { usePlanner } from '../stores/planner.js';

const { state, DAGEN, updateRooster, alleTaken } = usePlanner();

const dagLabel = { ma: 'Maandag', di: 'Dinsdag', wo: 'Woensdag', do: 'Donderdag', vr: 'Vrijdag' };

// Collect unique vak names from imported data
const beschikbareVakken = computed(() => {
  const vakken = new Set();
  for (const week of state.weken) {
    for (const section of week.sections) {
      if (section.vak) {
        // Use short name: first word or code
        const kort = kortVak(section.vak);
        vakken.add(kort);
      }
    }
  }
  return [...vakken].sort();
});

function kortVak(naam) {
  // "BIOLOGIE: POWERED BY ATP..." -> "BIO"
  // "CHEMIE: Ontwerpen..." -> "CH"
  // "ENGELS: Victorian..." -> "EN"
  const map = {
    'BIOLOGIE': 'BIO', 'CHEMIE': 'CH', 'FYSICA': 'FY',
    'ENGELS': 'EN', 'FRANS': 'FR', 'NEDERLANDS': 'NE',
    'RUIMTELIJK': 'AA', 'BURGERSCHAP': 'HB',
  };
  const upper = naam.toUpperCase();
  for (const [prefix, kort] of Object.entries(map)) {
    if (upper.startsWith(prefix)) return kort;
  }
  // Wiskunde routes
  if (upper.includes('6 UUR') || upper.includes('6U')) return 'WI6';
  if (upper.includes('8 UUR') || upper.includes('8U')) return 'WI8';
  if (upper.includes('WISKUNDE') || upper.includes('WI')) return 'WI';
  // Fallback: first word
  return naam.split(/[:\s]/)[0].slice(0, 4).toUpperCase();
}

// Local editable copy
const lokaal = reactive(
  JSON.parse(JSON.stringify(state.rooster))
);

function isSelected(dag, vak) {
  return (lokaal[dag] || []).includes(vak);
}

function toggle(dag, vak) {
  if (!lokaal[dag]) lokaal[dag] = [];
  const idx = lokaal[dag].indexOf(vak);
  if (idx >= 0) {
    lokaal[dag].splice(idx, 1);
  } else {
    lokaal[dag].push(vak);
  }
}

function opslaan() {
  updateRooster(JSON.parse(JSON.stringify(lokaal)));
}
</script>

<style scoped>
.rooster-setup {
  background: var(--clr-surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow: hidden;
  margin-bottom: 1.5rem;
}

.setup-header {
  padding: 1rem 1.25rem 0.5rem;
}

.setup-header h3 {
  margin: 0;
  font-size: 1rem;
}

.setup-header p {
  margin: 0.25rem 0 0;
  font-size: 0.82rem;
  color: var(--clr-text-muted);
}

.rooster-grid {
  padding: 0.5rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.rooster-dag {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.dag-kop {
  min-width: 5.5rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--clr-text);
}

.vak-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.vak-chip {
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  border: 1px solid var(--clr-border);
  background: var(--clr-surface);
  color: var(--clr-text-muted);
  cursor: pointer;
  transition: all 0.1s;
}

.vak-chip:hover {
  border-color: var(--clr-accent);
  color: var(--clr-text);
}

.vak-chip.selected {
  background: var(--clr-accent);
  color: white;
  border-color: var(--clr-accent);
}

.setup-actions {
  padding: 0.75rem 1.25rem;
  border-top: 1px solid var(--clr-border);
  display: flex;
  justify-content: flex-end;
}

.btn-save {
  padding: 0.4rem 1rem;
  border-radius: var(--radius);
  border: none;
  background: var(--clr-accent);
  color: white;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-save:hover {
  background: #4338ca;
}
</style>
