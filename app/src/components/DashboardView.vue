<template>
  <div class="db">
    <div class="db-wrap">

      <!-- Header -->
      <div class="db-header">
        <div class="db-date">{{ vandaagVol }}</div>
        <h2 class="db-title">Dagelijkse update voor {{ studentName }}</h2>
        <div class="db-sub">P3 Week {{ weekNr }}</div>
      </div>

      <!-- Week grid -->
      <div class="db-card">
        <WeekGrid compact />
      </div>

      <!-- Status samenvatting -->
      <div class="db-status">
        <div class="db-status-row">
          <span class="db-badge db-badge-klaar">{{ klaarCount }}</span>
          <span class="db-status-label">taken afgewerkt</span>
          <span class="db-status-min">{{ klaarMin }}' van {{ totaalMin }}'</span>
        </div>
        <div v-if="overdueCount" class="db-status-row">
          <span class="db-badge db-badge-rood">{{ overdueCount }}</span>
          <span class="db-status-label">taken achterstallig</span>
          <span class="db-status-min">{{ overdueMin }}'</span>
        </div>
        <div v-if="ongeplandCount" class="db-status-row">
          <span class="db-badge db-badge-oranje">{{ ongeplandCount }}</span>
          <span class="db-status-label">taken niet ingepland</span>
          <span class="db-status-min">{{ ongeplandMin }}'</span>
        </div>
      </div>

      <!-- Gisteren -->
      <div class="db-card">
        <h3 class="db-section-heading" @click="open.gisteren = !open.gisteren">
          <span class="db-chevron" :class="{ 'db-chevron-open': open.gisteren }">&#9656;</span>
          Gisteren ({{ gisterenDagVol }})
          <span class="db-heading-meta">· {{ gisterenKlaarMin }}' afgewerkt</span>
        </h3>
        <template v-if="open.gisteren">
          <div v-if="!gisterenTaken.length" class="db-empty">Geen taken gepland</div>
          <div v-for="taak in gisterenTaken" :key="taak.id" class="db-taak" :class="taakClass(taak, true)">
            <span class="db-code">{{ taak.code || '?' }}</span>
            <span class="db-omschrijving">{{ taak.omschrijving }}</span>
            <span class="db-tijd">
              <template v-if="taak.tijd?.type === 'minuten'">{{ taak.tijd.minuten }}'</template>
              <template v-else-if="taak.tijd?.type === 'rooster'">R</template>
            </span>
            <span v-if="!isKlaar(taak)" class="db-label db-label-rood">niet afgewerkt</span>
          </div>
        </template>
      </div>

      <!-- Vandaag -->
      <div class="db-card">
        <h3 class="db-section-heading" @click="open.vandaag = !open.vandaag">
          <span class="db-chevron" :class="{ 'db-chevron-open': open.vandaag }">&#9656;</span>
          Vandaag ({{ vandaagDagVol }})
          <span class="db-heading-meta">· {{ vandaagOpenMin }}' gepland</span>
        </h3>
        <template v-if="open.vandaag">
          <div v-if="!vandaagTaken.length" class="db-empty">Geen taken gepland</div>
          <div v-for="taak in vandaagTaken" :key="taak.id" class="db-taak" :class="taakClass(taak, false)">
            <span class="db-code">{{ taak.code || '?' }}</span>
            <span class="db-omschrijving">{{ taak.omschrijving }}</span>
            <span class="db-tijd">
              <template v-if="taak.tijd?.type === 'minuten'">{{ taak.tijd.minuten }}'</template>
              <template v-else-if="taak.tijd?.type === 'rooster'">R</template>
            </span>
          </div>
        </template>
      </div>

      <!-- Rest van de week -->
      <div v-if="restTaken.length" class="db-card">
        <h3 class="db-section-heading" @click="open.rest = !open.rest">
          <span class="db-chevron" :class="{ 'db-chevron-open': open.rest }">&#9656;</span>
          Rest van de week
          <span class="db-heading-meta">· {{ restOpenMin }}' gepland</span>
        </h3>
        <template v-if="open.rest">
          <div v-for="taak in restTaken" :key="taak.id" class="db-taak" :class="taakClass(taak, false)">
            <span class="db-dag">{{ taak.geplandOp }}</span>
            <span class="db-code">{{ taak.code || '?' }}</span>
            <span class="db-omschrijving">{{ taak.omschrijving }}</span>
            <span class="db-tijd">
              <template v-if="taak.tijd?.type === 'minuten'">{{ taak.tijd.minuten }}'</template>
              <template v-else-if="taak.tijd?.type === 'rooster'">R</template>
            </span>
          </div>
        </template>
      </div>

      <!-- CTA -->
      <a :href="plannerUrl" class="db-cta">Bekijk planning</a>

      <!-- Footer -->
      <div class="db-footer">
        Gekoppeld aan {{ studentName }}'s planning op Catplanner
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive } from 'vue';
import { usePlanner } from '../stores/planner.js';
import WeekGrid from './WeekGrid.vue';

const { alleTaken, state } = usePlanner();

const open = reactive({ gisteren: false, vandaag: false, rest: false });

const dagen = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
const dagenVol = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'];
const maanden = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

const now = new Date();
const jsDay = now.getDay();
const dagMap = [6, 0, 1, 2, 3, 4, 5];
const vandaagIdx = dagMap[jsDay];
const vandaagDag = dagen[vandaagIdx] || 'ma';
const vandaagDagVol = dagenVol[vandaagIdx] || 'maandag';
const gisterenIdx = vandaagIdx > 0 ? vandaagIdx - 1 : 6;
const gisterenDag = dagen[gisterenIdx];
const gisterenDagVol = dagenVol[gisterenIdx];
const vandaagVol = `${dagenVol[vandaagIdx]} ${now.getDate()} ${maanden[now.getMonth()]} ${now.getFullYear()}`;

const studentName = computed(() => state.studentProfile?.naam || 'Catplanner');
const weekNr = computed(() => state.weken?.[0]?.metadata?.week || '?');
const plannerUrl = computed(() => {
  const base = window.location.origin;
  return state.plannerId ? `${base}/planner/${state.plannerId}` : base;
});

function isKlaar(taak) {
  return taak.voortgang.status === 'klaar' || taak.voortgang.status === 'ingediend';
}

function taakMin(taak) {
  return taak.voortgang.customMinuten || (taak.tijd?.type === 'minuten' ? taak.tijd.minuten : 0);
}

function isDagVerleden(dag) {
  return dagen.indexOf(dag) < vandaagIdx;
}

// Lopend totaal: alle klare taken deze week
const klaarCount = computed(() =>
  alleTaken.value.filter(isKlaar).length
);
const klaarMin = computed(() =>
  alleTaken.value.filter(isKlaar).reduce((s, t) => s + taakMin(t), 0)
);
const totaalMin = computed(() =>
  alleTaken.value.reduce((s, t) => s + taakMin(t), 0)
);

// Achterstallig
const overdueTaken = computed(() =>
  alleTaken.value.filter(t => t.geplandOp && isDagVerleden(t.geplandOp) && !isKlaar(t))
);
const overdueCount = computed(() => overdueTaken.value.length);
const overdueMin = computed(() =>
  overdueTaken.value.reduce((s, t) => s + taakMin(t), 0)
);

// Ongepland
const ongeplandeTaken = computed(() =>
  alleTaken.value.filter(t => !t.geplandOp && !isKlaar(t))
);
const ongeplandCount = computed(() => ongeplandeTaken.value.length);
const ongeplandMin = computed(() =>
  ongeplandeTaken.value.reduce((s, t) => s + taakMin(t), 0)
);

// Gisteren
const gisterenTaken = computed(() =>
  alleTaken.value.filter(t => t.geplandOp === gisterenDag)
);
const gisterenKlaarMin = computed(() =>
  gisterenTaken.value.filter(isKlaar).reduce((s, t) => s + taakMin(t), 0)
);

// Vandaag
const vandaagTaken = computed(() =>
  alleTaken.value.filter(t => t.geplandOp === vandaagDag)
);
const vandaagOpenMin = computed(() =>
  vandaagTaken.value.filter(t => !isKlaar(t)).reduce((s, t) => s + taakMin(t), 0)
);

// Rest van de week (na vandaag)
const restTaken = computed(() =>
  alleTaken.value.filter(t => {
    if (!t.geplandOp) return false;
    return dagen.indexOf(t.geplandOp) > vandaagIdx;
  })
);
const restOpenMin = computed(() =>
  restTaken.value.filter(t => !isKlaar(t)).reduce((s, t) => s + taakMin(t), 0)
);

function taakClass(taak, isVerleden) {
  if (isKlaar(taak)) return 'db-taak-klaar';
  if (isVerleden || (taak.geplandOp && isDagVerleden(taak.geplandOp))) return 'db-taak-gemist';
  if (taak.tijd?.type === 'rooster') return 'db-taak-rooster';
  return 'db-taak-huiswerk';
}
</script>

<style scoped>
.db {
  padding: 16px 0;
}

.db-wrap {
  max-width: 520px;
  margin: 0 auto;
  background: var(--clr-surface);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

/* Header */
.db-header {
  padding: 20px 24px;
  border-bottom: 2px solid var(--clr-border);
}
.db-date {
  font-size: 0.75rem;
  color: var(--clr-text-muted);
}
.db-title {
  margin: 4px 0 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--clr-text);
}
.db-sub {
  margin-top: 2px;
  font-size: 0.8rem;
  color: var(--clr-text-muted);
}

/* Card sections */
.db-card {
  padding: 16px 24px;
  border-bottom: 1px solid var(--clr-border);
}

/* Status samenvatting */
.db-status {
  padding: 10px 24px;
  border-bottom: 1px solid var(--clr-border);
  display: flex;
  flex-direction: column;
  gap: 0;
}
.db-status-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 0;
  border-bottom: 1px solid var(--clr-bg);
}
.db-status-row:last-child {
  border-bottom: none;
}
.db-badge {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
  min-width: 1.4em;
  text-align: center;
}
.db-badge-klaar {
  color: #059669;
  background: #ecfdf5;
}
.db-badge-rood {
  color: #dc2626;
  background: #fef2f2;
}
.db-badge-oranje {
  color: #b45309;
  background: #fffbeb;
}
.db-status-label {
  font-size: 0.78rem;
  color: var(--clr-text);
}
.db-status-min {
  font-size: 0.7rem;
  color: var(--clr-text-muted);
  margin-left: auto;
}

/* Section heading */
.db-section-heading {
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--clr-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0;
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  gap: 4px;
}
.db-section-heading:hover {
  color: var(--clr-text);
}
.db-chevron {
  font-size: 0.7rem;
  transition: transform 0.15s;
  display: inline-block;
}
.db-chevron-open {
  transform: rotate(90deg);
}
.db-heading-meta {
  text-transform: none;
  font-weight: 400;
  letter-spacing: 0;
}

.db-empty {
  font-size: 0.8rem;
  color: var(--clr-text-muted);
  font-style: italic;
  margin-top: 10px;
}

/* Taak rij (email-style: border-left colored rows) */
.db-taak {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border-radius: 6px;
  margin-bottom: 3px;
  font-size: 0.8rem;
  border-left: 3px solid transparent;
  background: var(--clr-surface);
}
.db-taak:first-of-type {
  margin-top: 10px;
}

.db-taak-klaar {
  border-left-color: #86cfac;
  opacity: 0.55;
}
.db-taak-gemist {
  border-left-color: #e07878;
}
.db-taak-rooster {
  border-left-color: #b4a7d6;
}
.db-taak-huiswerk {
  border-left-color: #7eb8d8;
}

.db-dag {
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--clr-text-muted);
  text-transform: uppercase;
  flex-shrink: 0;
  width: 16px;
}

.db-code {
  font-weight: 700;
  color: var(--clr-accent);
  flex-shrink: 0;
}
.db-omschrijving {
  color: var(--clr-text);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.db-tijd {
  font-size: 0.7rem;
  color: var(--clr-text-muted);
  font-weight: 600;
  flex-shrink: 0;
}
.db-label {
  font-size: 0.65rem;
  font-weight: 600;
  flex-shrink: 0;
}
.db-label-rood {
  color: #ef4444;
}

/* CTA */
.db-cta {
  display: block;
  text-align: center;
  background: #7c6cad;
  color: white;
  padding: 12px;
  margin: 16px 24px;
  border-radius: 10px;
  text-decoration: none;
  font-weight: 700;
  font-size: 0.85rem;
}
.db-cta:hover {
  opacity: 0.9;
}

/* Footer */
.db-footer {
  text-align: center;
  font-size: 0.62rem;
  color: var(--clr-text-muted);
  padding: 0 24px 16px;
}
</style>
