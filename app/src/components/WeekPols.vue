<template>
  <div class="wp" :title="tooltip">
    <div
      v-for="dag in dagBlokken"
      :key="dag.key"
      class="wp-blok"
      :class="dag.cls"
      :title="dag.tip"
    ></div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { usePlanner } from '../stores/planner.js';

const { alleTaken } = usePlanner();

const dagen = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
const now = new Date();
const jsDay = now.getDay();
const dagMap = [6, 0, 1, 2, 3, 4, 5];
const vandaagIdx = dagMap[jsDay];

function isKlaar(t) {
  return t.voortgang.status === 'klaar' || t.voortgang.status === 'ingediend';
}

function taakMin(t) {
  return t.voortgang.customMinuten || (t.tijd?.type === 'minuten' ? t.tijd.minuten : 0);
}

const dagBlokken = computed(() => {
  return dagen.map((dag, idx) => {
    const taken = alleTaken.value.filter(t => t.geplandOp === dag);
    if (!taken.length) return { key: dag, cls: 'wp-leeg', tip: `${dag}: geen taken` };

    const klaar = taken.filter(isKlaar);
    const open = taken.filter(t => !isKlaar(t));
    const klaarMin = klaar.reduce((s, t) => s + taakMin(t), 0);
    const openMin = open.reduce((s, t) => s + taakMin(t), 0);

    let cls;
    if (klaar.length === taken.length) {
      cls = 'wp-klaar';
    } else if (idx < vandaagIdx && open.length) {
      cls = 'wp-gemist';
    } else if (idx === vandaagIdx) {
      cls = klaar.length ? 'wp-bezig' : 'wp-gepland';
    } else {
      cls = 'wp-gepland';
    }

    if (idx === vandaagIdx) cls += ' wp-vandaag';

    const tip = `${dag}: ${klaar.length}/${taken.length} klaar` +
      (klaarMin ? ` (${klaarMin}')` : '') +
      (openMin ? ` · ${openMin}' open` : '');

    return { key: dag, cls, tip };
  });
});

const tooltip = computed(() => {
  const klaar = alleTaken.value.filter(isKlaar).length;
  const totaal = alleTaken.value.length;
  return `${klaar}/${totaal} taken klaar`;
});
</script>

<style scoped>
.wp {
  display: flex;
  gap: 2px;
  align-items: center;
}

.wp-blok {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  flex-shrink: 0;
}

.wp-leeg { background: #f0f0ee; }
.wp-klaar { background: #86cfac; }
.wp-gemist { background: #fbbf24; }
.wp-bezig { background: #7eb8d8; }
.wp-gepland { background: #b4a7d6; }

.wp-vandaag {
  outline: 1.5px solid var(--clr-accent);
  outline-offset: 1px;
}
</style>
