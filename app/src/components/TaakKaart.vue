<template>
  <div class="taak" :class="[statusClass, hoofdgroepClass]">
    <div class="taak-header">
      <span v-if="taak.code" class="code">{{ taak.code }}</span>
      <span v-if="taak.volgorde != null" class="volgorde">#{{ taak.volgorde }}</span>
      <div class="flags">
        <span v-for="flag in taak.flags" :key="flag" class="flag" :title="flagLabel(flag)">{{ flag }}</span>
      </div>
    </div>

    <p class="omschrijving">{{ taak.omschrijving || '(geen omschrijving)' }}</p>

    <div class="taak-footer">
      <span class="tijd" v-if="taak.tijd">
        <template v-if="taak.tijd.type === 'rooster'">
          Rooster<template v-if="taak.tijd.minuten"> ({{ taak.tijd.minuten }}')</template>
        </template>
        <template v-else-if="taak.tijd.type === 'minuten'">
          {{ taak.tijd.minuten }}'
        </template>
      </span>

      <div class="voortgang-controls">
        <select :value="taak.voortgang.status" @change="$emit('status', $event.target.value)">
          <option value="todo">Te doen</option>
          <option value="bezig">Bezig</option>
          <option value="klaar">Klaar</option>
        </select>
      </div>
    </div>

    <div v-if="taak.voortgang.status === 'bezig' && taak.tijd?.type === 'minuten'" class="progress-bar">
      <div class="progress-fill" :style="{ width: progressPct + '%' }"></div>
      <span class="progress-label">{{ taak.voortgang.minutenGewerkt }}/{{ taak.tijd.minuten }}'</span>
      <div class="progress-buttons">
        <button @click="$emit('werk', 15)" title="+15 min">+15'</button>
        <button @click="$emit('werk', 30)" title="+30 min">+30'</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({ taak: Object });
defineEmits(['status', 'werk']);

const statusClass = computed(() => `status-${props.taak.voortgang.status}`);

const hoofdgroepClass = computed(() => {
  const hg = (props.taak.hoofdgroep || '').toUpperCase();
  if (hg.includes('WETENSCHAP')) return 'hg-wetenschap';
  if (hg.includes('TALEN')) return 'hg-talen';
  if (hg.includes('WISKUNDE')) return 'hg-wiskunde';
  if (hg.includes('PROJECT')) return 'hg-project';
  return 'hg-algemeen';
});

const progressPct = computed(() => {
  const t = props.taak;
  if (!t.tijd || t.tijd.type !== 'minuten' || !t.tijd.minuten) return 0;
  return Math.min(100, Math.round((t.voortgang.minutenGewerkt / t.tijd.minuten) * 100));
});

function flagLabel(f) {
  const labels = { P: 'Op papier inleveren', M: 'Materiaal meebrengen', U: 'Uitgestelde deadline', G: 'Groepswerk', X: 'Speciale info' };
  return labels[f] || f;
}
</script>
