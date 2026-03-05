<template>
  <div class="import-preview">
    <div class="preview-header">
      <div>
        <h2>{{ metadata.titel }}</h2>
        <p class="meta">
          Periode {{ metadata.periode }} · Week {{ metadata.week }}
          <span v-if="metadata.datumRange"> · {{ metadata.datumRange.van }} – {{ metadata.datumRange.tot }}</span>
        </p>
      </div>
      <div class="preview-stats">
        <span class="stat-pill">{{ takenCount }} taken</span>
        <span class="stat-pill">{{ formatTijd(zelfwerkMin) }} zelfwerk</span>
        <span class="stat-pill">{{ roosterCount }} rooster</span>
      </div>
    </div>

    <div v-if="verworpen.length > 0" class="filter-toggle-bar">
      <label class="toggle-label">
        <input type="checkbox" v-model="toonGefilterd" />
        <span class="toggle-switch"></span>
        <span>Toon {{ verworpen.length }} gefilterde taken</span>
      </label>
    </div>

    <div class="preview-table">
      <div v-for="section in zichtbareSections" :key="sectionKey(section)" class="preview-section">
        <div class="section-header" :class="hoofdgroepClass(section.hoofdgroep)">
          <span class="hg-badge">{{ section.hoofdgroep }}</span>
          <span class="vak-naam">{{ section.vak || '' }}</span>
        </div>

        <table>
          <tbody>
            <tr v-for="(taak, i) in section.taken" :key="i"
                :class="[tijdClass(taak), { 'row-gefilterd': taak._gefilterd }]">
              <td class="col-nr">{{ taak.volgorde ?? '' }}</td>
              <td class="col-code">{{ taak.code || '–' }}</td>
              <td class="col-opdracht">
                {{ taak.omschrijving || '(geen omschrijving)' }}
                <span v-if="taak._gefilterd" class="reden-badge">{{ taak.filterReden }}</span>
              </td>
              <td class="col-tijd">
                <span v-if="taak.tijd?.type === 'rooster'" class="badge-rooster">
                  rooster<template v-if="taak.tijd.minuten"> ({{ taak.tijd.minuten }}')</template>
                </span>
                <span v-else-if="taak.tijd?.type === 'minuten'" class="badge-minuten">
                  {{ taak.tijd.minuten }}'
                </span>
                <span v-else class="badge-leeg">–</span>
              </td>
              <td class="col-flags">
                <span v-for="flag in taak.flags" :key="flag" class="flag-badge" :title="flagLabel(flag)">{{ flag }}</span>
              </td>
              <td class="col-actie">
                <button v-if="taak._gefilterd" class="btn-taak-actie btn-herstel" @click="$emit('herstel', taak)" title="Alsnog toevoegen">+</button>
                <button v-else class="btn-taak-actie btn-verwerp" @click="$emit('verwerp', taak)" title="Toch niet opnemen">−</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="preview-actions">
      <button class="btn-cancel" @click="$emit('annuleer')">Annuleren</button>
      <button class="btn-confirm" @click="$emit('bevestig')">Importeren</button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';

const props = defineProps({
  metadata: Object,
  sections: Array,
  verworpen: { type: Array, default: () => [] },
});

defineEmits(['bevestig', 'annuleer', 'herstel', 'verwerp']);

const toonGefilterd = ref(false);

const zichtbareSections = computed(() => {
  if (!toonGefilterd.value) return props.sections;

  // Merge accepted + rejected into combined sections
  const map = new Map();
  for (const section of props.sections) {
    const key = `${section.hoofdgroep}||${section.vak}`;
    map.set(key, { ...section, taken: [...section.taken] });
  }
  for (const taak of props.verworpen) {
    const key = `${taak.hoofdgroep}||${taak.vak}`;
    if (!map.has(key)) {
      map.set(key, { hoofdgroep: taak.hoofdgroep, vak: taak.vak, taken: [] });
    }
    map.get(key).taken.push({ ...taak, _gefilterd: true });
  }
  // Sort tasks within each section by original order
  for (const section of map.values()) {
    section.taken.sort((a, b) => (a.origIndex ?? 0) - (b.origIndex ?? 0));
  }
  return [...map.values()];
});

const takenCount = computed(() => props.sections.reduce((sum, s) => sum + s.taken.length, 0));

const zelfwerkMin = computed(() =>
  props.sections.reduce((sum, s) =>
    sum + s.taken.reduce((ts, t) =>
      ts + (t.tijd?.type === 'minuten' ? t.tijd.minuten : 0), 0), 0)
);

const roosterCount = computed(() =>
  props.sections.reduce((sum, s) =>
    sum + s.taken.filter((t) => t.tijd?.type === 'rooster').length, 0)
);

function formatTijd(min) {
  if (!min) return '0u';
  const u = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${u}u${String(m).padStart(2, '0')}` : `${u}u`;
}

function sectionKey(section) {
  return `${section.hoofdgroep}-${section.vak}`;
}

function hoofdgroepClass(hg) {
  const h = (hg || '').toUpperCase();
  if (h.includes('WETENSCHAP')) return 'hg-wetenschap';
  if (h.includes('TALEN')) return 'hg-talen';
  if (h.includes('WISKUNDE')) return 'hg-wiskunde';
  if (h.includes('PROJECT')) return 'hg-project';
  return 'hg-algemeen';
}

function tijdClass(taak) {
  if (taak.tijd?.type === 'rooster') return 'row-rooster';
  return '';
}

function flagLabel(f) {
  const labels = { P: 'Op papier', M: 'Materiaal meebrengen', U: 'Uitgestelde deadline', G: 'Groepswerk', X: 'Speciale info' };
  return labels[f] || f;
}
</script>

<style scoped>
.import-preview {
  background: var(--clr-surface);
  border-radius: var(--radius);
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  overflow: hidden;
  margin-bottom: 1.5rem;
}

.preview-header {
  padding: 1.25rem 1.5rem;
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
}

.preview-header h2 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
}

.preview-header .meta {
  margin: 0.25rem 0 0;
  font-size: 0.85rem;
  opacity: 0.85;
}

.preview-stats {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.stat-pill {
  background: rgba(255,255,255,0.2);
  padding: 0.25rem 0.6rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
}

/* ---- Table ---- */

.preview-table {
  padding: 0.75rem;
}

.preview-section {
  margin-bottom: 0.5rem;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  margin-bottom: 2px;
}

.section-header.hg-wetenschap { background: var(--clr-wetenschap-bg); }
.section-header.hg-talen { background: var(--clr-talen-bg); }
.section-header.hg-wiskunde { background: var(--clr-wiskunde-bg); }
.section-header.hg-project { background: var(--clr-project-bg); }
.section-header.hg-algemeen { background: var(--clr-algemeen-bg); }

.hg-badge {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 700;
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
  white-space: nowrap;
}

.hg-wetenschap .hg-badge { background: var(--clr-wetenschap); color: white; }
.hg-talen .hg-badge { background: var(--clr-talen); color: white; }
.hg-wiskunde .hg-badge { background: var(--clr-wiskunde); color: white; }
.hg-project .hg-badge { background: var(--clr-project); color: white; }
.hg-algemeen .hg-badge { background: var(--clr-algemeen); color: white; }

.vak-naam {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--clr-text);
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
  margin-bottom: 0.5rem;
}

thead th {
  text-align: left;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--clr-text-muted);
  padding: 0.3rem 0.5rem;
  border-bottom: 1px solid var(--clr-border);
}

tbody tr {
  border-bottom: 1px solid #f0f0ec;
}

tbody tr:hover {
  background: #fafaf8;
}

tbody tr.row-rooster {
  background: #f8f9ff;
}

td {
  padding: 0.4rem 0.5rem;
  vertical-align: top;
}

.col-nr { width: 2rem; text-align: center; color: var(--clr-text-muted); font-size: 0.75rem; }
.col-code { width: 5rem; font-weight: 600; color: var(--clr-accent); font-size: 0.8rem; }
.col-opdracht { line-height: 1.35; }
.col-tijd { width: 6rem; white-space: nowrap; }
.col-flags { width: 3rem; }

.badge-rooster {
  display: inline-block;
  background: #e0e7ff;
  color: #4338ca;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.badge-minuten {
  display: inline-block;
  background: #ecfdf5;
  color: #059669;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 700;
}

.badge-leeg {
  color: var(--clr-text-muted);
}

.flag-badge {
  display: inline-block;
  font-size: 0.65rem;
  font-weight: 700;
  background: #fef3c7;
  color: #92400e;
  padding: 0.05rem 0.3rem;
  border-radius: 3px;
  margin-right: 0.15rem;
  cursor: help;
}

/* ---- Filter toggle ---- */

.filter-toggle-bar {
  padding: 0.5rem 1rem;
  background: #fafaf8;
  border-bottom: 1px solid var(--clr-border);
}

.toggle-label {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.82rem;
  color: var(--clr-text-muted);
  user-select: none;
}

.toggle-label input {
  display: none;
}

.toggle-switch {
  position: relative;
  width: 2rem;
  height: 1.1rem;
  background: #d1d5db;
  border-radius: 0.55rem;
  transition: background 0.2s;
}

.toggle-switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 0.75rem;
  height: 0.75rem;
  background: white;
  border-radius: 50%;
  transition: transform 0.2s;
}

.toggle-label input:checked + .toggle-switch {
  background: var(--clr-accent);
}

.toggle-label input:checked + .toggle-switch::after {
  transform: translateX(0.85rem);
}

/* ---- Gefilterde rijen ---- */

.row-gefilterd {
  background: repeating-linear-gradient(
    -45deg,
    #fafaf8,
    #fafaf8 4px,
    #f5f0e8 4px,
    #f5f0e8 8px
  );
  color: var(--clr-text-muted);
}

.row-gefilterd td {
  opacity: 0.55;
}

.row-gefilterd:hover td {
  opacity: 0.85;
}

.row-gefilterd .col-opdracht {
  text-decoration: line-through;
  text-decoration-color: #d1ccc0;
}

.row-gefilterd .col-actie {
  opacity: 1 !important;
}

.reden-badge {
  display: inline-block;
  font-size: 0.65rem;
  color: #b45309;
  background: #fef3c7;
  padding: 0.1rem 0.45rem;
  border-radius: 4px;
  margin-left: 0.4rem;
  vertical-align: middle;
  text-decoration: none;
  font-weight: 600;
  letter-spacing: 0.01em;
}

/* ---- Actie knoppen per rij ---- */

.col-actie {
  width: 2rem;
  text-align: center;
}

.btn-taak-actie {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.4rem;
  height: 1.4rem;
  border-radius: 50%;
  border: 1px solid #d1d5db;
  background: white;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  line-height: 1;
  opacity: 0.4;
  transition: opacity 0.15s;
}

tr:hover .btn-taak-actie,
.row-gefilterd .btn-taak-actie {
  opacity: 1;
}

.btn-herstel {
  color: #059669;
}

.btn-herstel:hover {
  background: #ecfdf5;
  border-color: #059669;
}

.btn-verwerp {
  color: #dc2626;
}

.btn-verwerp:hover {
  background: #fef2f2;
  border-color: #dc2626;
}

/* ---- Actions ---- */

.preview-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--clr-border);
  background: #fafaf8;
}

.btn-cancel, .btn-confirm {
  padding: 0.5rem 1.25rem;
  border-radius: var(--radius);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
}

.btn-cancel {
  background: var(--clr-surface);
  border: 1px solid var(--clr-border);
  color: var(--clr-text-muted);
}

.btn-cancel:hover {
  background: #fee2e2;
  border-color: #ef4444;
  color: #ef4444;
}

.btn-confirm {
  background: var(--clr-accent);
  color: white;
}

.btn-confirm:hover {
  background: #4338ca;
}
</style>
