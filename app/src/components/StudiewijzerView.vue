<template>
  <div class="sw-view">
    <div class="sw-header no-print">
      <div class="sw-title-row">
        <h2>Studiewijzer</h2>
        <button class="btn-print" @click="print()" title="Afdrukken">
          <Icon icon="mdi:printer-outline" width="16" height="16" />
          Afdrukken
        </button>
      </div>
      <div class="sw-chips">
        <button
          class="sw-chip sw-chip-uitgesloten"
          :class="{ on: toonUitgesloten }"
          @click="toonUitgesloten = !toonUitgesloten"
          title="Toon ook uitgesloten taken (profiel/handmatig)"
        >
          <Icon icon="mdi:eye-off-outline" width="13" height="13" />
          <span class="sw-chip-count">{{ uitgeslotenCount }}</span>
          <span class="sw-chip-label">uitgesloten</span>
        </button>
        <button
          class="sw-chip sw-chip-afgerond"
          :class="{ on: verbergAfgerond }"
          @click="verbergAfgerond = !verbergAfgerond"
          title="Verberg afgeronde taken"
        >
          <Icon icon="mdi:check-circle-outline" width="13" height="13" />
          <span class="sw-chip-count">{{ afgerondCount }}</span>
          <span class="sw-chip-label">afgerond</span>
        </button>
      </div>
      <p class="sw-hint">
        Originele studiewijzer. Uitgesloten taken (profiel/handmatig) zijn doorgestreept.
        Klik op ✓/✗ om taken in of uit te sluiten.
      </p>
    </div>

    <div v-if="!bronWeken.length" class="sw-leeg">
      Geen studiewijzer geladen. Importeer een .md bestand via de upload-knop.
    </div>

    <template v-for="week in bronWeken" :key="`P${week.metadata.periode}W${week.metadata.week}`">
      <!-- Week header -->
      <div class="sw-week-header">
        <span class="sw-week-label">Periode {{ week.metadata.periode }} – Week {{ week.metadata.week }}</span>
        <span v-if="week.metadata.datumRange" class="sw-week-datum">{{ fmtRange(week.metadata.datumRange) }}</span>
        <span class="sw-week-totals">
          {{ weekTotalsFiltered(week).zichtbaar }}/{{ weekTotals(week).totaal }} taken
          · {{ weekTotalsFiltered(week).minuten }}'
        </span>
      </div>

      <!-- Sections grouped by hoofdgroep -->
      <template v-for="groep in groepeerSections(week.sections)" :key="groep.naam">
        <div v-if="isGroepZichtbaar(groep, week)" class="sw-groep-header">{{ groep.naam }}</div>

        <div
          v-for="section in groep.sections"
          v-show="isSectionZichtbaar(section, week)"
          :key="section.vak"
          class="sw-section"
          :class="{ 'sw-section-inactief': !isVakActief(section.vak) }"
        >
          <!-- Vak header -->
          <div class="sw-vak-header">
            <button
              v-if="!isReadOnly"
              class="toggle-btn"
              :class="{ on: isVakActief(section.vak) }"
              @click="toggleVak(section.vak)"
              :title="isVakActief(section.vak) ? 'Vak uitzetten' : 'Vak aanzetten'"
            >
              <span class="toggle-knob"></span>
            </button>
            <span class="sw-vak-naam">{{ section.vak }}</span>
            <span v-if="section.projectTitel" class="sw-project-titel">{{ section.projectTitel }}</span>
            <span class="sw-vak-stats">
              {{ sectionActief(section, week) }}/{{ section.taken.length }} taken
              <template v-if="sectionStats(section).minuten">
                · {{ sectionStats(section).minuten }}'
              </template>
              <template v-if="sectionStats(section).rooster">
                · {{ sectionStats(section).rooster }}× R
              </template>
            </span>
            <!-- Vak-level filter reden -->
            <span v-if="!isVakActief(section.vak) && vakFilterReden(section, week)" class="sw-vak-reden">
              {{ vakFilterReden(section, week) }}
            </span>
          </div>
          <!-- Rooster koppeling -->
          <div v-if="isVakActief(section.vak) && heeftRooster" class="sw-koppeling-rij">
            <span class="koppeling-label">Rooster:</span>
            <!-- Actieve koppelingen (groen) -->
            <button
              v-for="t in gekoppeldeTitels(section.vak)"
              :key="'a-'+t"
              class="koppeling-pill active"
              @click.stop="toggleKoppeling(section.vak, t)"
              :title="`${t} ontkoppelen`"
            >{{ t }}</button>
            <!-- Suggesties (oranje) -->
            <button
              v-for="t in suggestieTitels(section.vak)"
              :key="'s-'+t"
              class="koppeling-pill suggestie"
              @click.stop="toggleKoppeling(section.vak, t)"
              :title="`${t} koppelen (suggestie)`"
            >{{ t }}</button>
            <span v-if="!gekoppeldeTitels(section.vak).length && !suggestieTitels(section.vak).length" class="koppeling-hint">niet gekoppeld</span>
            <!-- Openklapbare overige pills -->
            <button
              v-if="overigeTitels(section.vak).length"
              class="koppeling-expand-btn"
              @click.stop="toggleOverig(section.vak)"
              :title="overigOpen.has(section.vak) ? 'Overige verbergen' : 'Meer lessen tonen'"
            >{{ overigOpen.has(section.vak) ? '▾' : `+${overigeTitels(section.vak).length}` }}</button>
          </div>
          <div v-if="isVakActief(section.vak) && heeftRooster && overigOpen.has(section.vak) && overigeTitels(section.vak).length" class="sw-koppeling-rij sw-koppeling-overig">
            <button
              v-for="t in overigeTitels(section.vak)"
              :key="'o-'+t"
              class="koppeling-pill"
              @click.stop="toggleKoppeling(section.vak, t)"
              :title="`${t} koppelen`"
            >{{ t }}</button>
          </div>

          <!-- Taken tabel -->
          <table class="sw-tabel" v-if="section.taken.length">
            <thead>
              <tr>
                <th class="col-incl"></th>
                <th class="col-richting">Richting</th>
                <th class="col-code">Code</th>
                <th class="col-omschrijving">Opdracht</th>
                <th class="col-tijd">Tijd</th>
                <th class="col-flags">Flags</th>
                <th class="col-volgorde">V</th>
                <th class="col-status">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="taak in section.taken"
                v-show="isTaakZichtbaar(taak, section, week)"
                :key="rawTaakKey(taak, week.metadata)"
                :class="{
                  'taak-uitgesloten': !isTaakActief(taak, section, week),
                  'taak-klaar': isTaakKlaar(taak, week),
                  'taak-selected': selectedTaakId === rawTaakKey(taak, week.metadata)
                }"
                @click="selectTaak(rawTaakKey(taak, week.metadata))"
              >
                <td class="col-incl">
                  <button
                    v-if="!isReadOnly && isVakActief(section.vak)"
                    class="btn-toggle-taak"
                    :class="isTaakActief(taak, section, week) ? 'incl-ja' : 'incl-nee'"
                    @click="toggleTaak(taak, section, week)"
                    :title="isTaakActief(taak, section, week) ? 'Uitsluiten' : 'Opnemen'"
                  >
                    {{ isTaakActief(taak, section, week) ? '✓' : '✗' }}
                  </button>
                  <span v-else-if="isTaakActief(taak, section, week)" class="incl-ja-static">✓</span>
                  <span v-else class="incl-nee-static">✗</span>
                </td>
                <td class="col-richting">
                  <span v-if="taak.richting" class="richting-label">{{ taak.richting }}</span>
                </td>
                <td class="col-code">{{ taak.code || '' }}</td>
                <td class="col-omschrijving">
                  {{ taak.omschrijving }}
                  <span v-if="!isTaakActief(taak, section, week) && filterReden(taak, week)" class="filter-reden">
                    {{ filterReden(taak, week) }}
                  </span>
                </td>
                <td class="col-tijd">
                  <span v-if="taak.tijd?.type === 'rooster'" class="tijd-rooster">R</span>
                  <span v-else-if="taak.tijd?.type === 'rooster_zelf'" class="tijd-rooster-zelf">R/Z</span>
                  <span v-else-if="taak.tijd?.type === 'minuten'" class="tijd-minuten">{{ taak.tijd.minuten }}'</span>
                  <span v-else-if="taak.tijd?.type === 'minuten_per_route'" class="tijd-route">
                    B:{{ taak.tijd.B }}' Z:{{ taak.tijd.Z }}'
                  </span>
                  <span v-else-if="taak.tijd?.type === 'nvt'" class="tijd-nvt">—</span>
                </td>
                <td class="col-flags">
                  <span v-for="f in (taak.flags || [])" :key="f" class="flag-badge" :class="`flag-${f.toLowerCase()}`" :title="flagTip(f)">{{ f }}</span>
                </td>
                <td class="col-volgorde">
                  <span v-if="taak.volgorde" class="volgorde-num">{{ taak.volgorde }}</span>
                </td>
                <td class="col-status" @click.stop>
                  <span
                    v-if="taakStatusInfo(taak, week).label"
                    :class="taakStatusInfo(taak, week).cls"
                    class="status-link"
                    @click="goToWeekView(taak, week)"
                  >
                    {{ taakStatusInfo(taak, week).label }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, nextTick } from 'vue';
import { Icon } from '@iconify/vue';
import { usePlanner } from '../stores/planner.js';
import { filterVoorProfiel } from '../lib/parser.js';

const { state, saveConfiguratie, isReadOnly, wekenTaakIds, taakId, includeTaak, excludeTaak, selectedTaakId, selectTaak, activeView, wpViewMode, matchesVak } = usePlanner();

onMounted(() => {
  if (selectedTaakId.value) {
    nextTick(() => {
      const el = document.querySelector('tr.taak-selected');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }
});

// Filter toggles
const toonUitgesloten = ref(false);
const verbergAfgerond = ref(false);

function isTaakZichtbaar(taak, section, week) {
  const actief = isTaakActief(taak, section, week);
  if (!actief && !toonUitgesloten.value) return false;
  if (verbergAfgerond.value && actief) {
    const key = rawTaakKey(taak, week.metadata);
    const status = state.voortgang[key]?.status || 'open';
    if (status === 'klaar' || status === 'ingediend') return false;
  }
  return true;
}

function isSectionZichtbaar(section, week) {
  if (!toonUitgesloten.value && !isVakActief(section.vak)) return false;
  return section.taken.some(t => isTaakZichtbaar(t, section, week));
}

function isGroepZichtbaar(groep, week) {
  return groep.sections.some(s => isSectionZichtbaar(s, week));
}

// Counts for chips
const uitgeslotenCount = computed(() => {
  let count = 0;
  for (const week of bronWeken.value) {
    for (const section of week.sections) {
      for (const taak of section.taken) {
        if (!isTaakActief(taak, section, week)) count++;
      }
    }
  }
  return count;
});

const afgerondCount = computed(() => {
  let count = 0;
  for (const week of bronWeken.value) {
    for (const section of week.sections) {
      for (const taak of section.taken) {
        if (!isTaakActief(taak, section, week)) continue;
        const key = rawTaakKey(taak, week.metadata);
        const status = state.voortgang[key]?.status || 'open';
        if (status === 'klaar' || status === 'ingediend') count++;
      }
    }
  }
  return count;
});

// Use raw studiewijzer if available, fall back to filtered weken
const bronWeken = computed(() => {
  if (state.studiewijzer?.length) return state.studiewijzer;
  return state.weken;
});

const isRawData = computed(() => state.studiewijzer?.length > 0);

const maanden = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

function fmtRange(range) {
  if (!range?.van || !range?.tot) return '';
  const [dV, mV] = range.van.split('/');
  const [dT, mT] = range.tot.split('/');
  if (mV === mT) {
    return `${parseInt(dV)} tot ${parseInt(dT)} ${maanden[parseInt(mT) - 1]}`;
  }
  return `${parseInt(dV)} ${maanden[parseInt(mV) - 1]} – ${parseInt(dT)} ${maanden[parseInt(mT) - 1]}`;
}

function rawTaakKey(taak, metadata) {
  return taakId(taak, metadata);
}

// Check if a task from the raw studiewijzer is currently in the filtered weken
function isTaakActief(taak, section, week) {
  if (!isVakActief(section.vak)) return false;
  const key = rawTaakKey(taak, week.metadata);
  return wekenTaakIds.value.has(key);
}

// Get filter reason for auto-excluded tasks
const gefilterdeRedenen = computed(() => {
  if (!isRawData.value || !state.studentProfile) return new Map();
  const map = new Map();
  for (const week of state.studiewijzer) {
    const result = filterVoorProfiel(week, state.studentProfile);
    for (const v of result.verworpen) {
      const key = taakId(v, week.metadata);
      map.set(key, v.filterReden);
    }
  }
  return map;
});

function filterReden(taak, week) {
  const key = rawTaakKey(taak, week.metadata);
  return gefilterdeRedenen.value.get(key) || '';
}

// Toggle individual task in/out of weken
async function toggleTaak(taak, section, week) {
  const key = rawTaakKey(taak, week.metadata);
  if (wekenTaakIds.value.has(key)) {
    await excludeTaak(key, week.metadata);
  } else {
    await includeTaak(taak, week.metadata, section.vak, section.hoofdgroep);
  }
}

// Summarise why a vak was auto-deactivated (most common filter reason across its tasks)
function vakFilterReden(section, week) {
  const redenen = new Map();
  for (const taak of section.taken) {
    const r = filterReden(taak, week);
    if (r) redenen.set(r, (redenen.get(r) || 0) + 1);
  }
  if (!redenen.size) return '';
  // If all tasks share the same reason, show it directly
  if (redenen.size === 1) return [...redenen.keys()][0];
  // Otherwise show the most common one
  let best = '';
  let bestCount = 0;
  for (const [r, c] of redenen) {
    if (c > bestCount) { best = r; bestCount = c; }
  }
  return best;
}

function isTaakKlaar(taak, week) {
  const key = rawTaakKey(taak, week.metadata);
  const status = state.voortgang[key]?.status || 'open';
  return status === 'klaar' || status === 'ingediend';
}

const dagen = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
const dagKort = { ma: 'MA', di: 'DI', wo: 'WO', do: 'DO', vr: 'VR', za: 'ZA', zo: 'ZO' };
const now = new Date();
const vandaagIdx = dagen.indexOf(dagen[[6, 0, 1, 2, 3, 4, 5][now.getDay()]]);

function taakStatusInfo(taak, week) {
  const key = rawTaakKey(taak, week.metadata);
  const status = state.voortgang[key]?.status || 'open';
  const planVal = state.planning[key] || null;
  const geplandOp = planVal ? (typeof planVal === 'string' ? planVal : planVal.dag) : null;

  if (status === 'ingediend') return { label: 'Ingediend', cls: 'status-ingediend' };
  if (status === 'klaar') return { label: 'In te dienen', cls: 'status-intedienen' };
  if (geplandOp) {
    const dagIdx = dagen.indexOf(geplandOp);
    if (dagIdx < vandaagIdx && status !== 'klaar' && status !== 'ingediend') {
      return { label: dagKort[geplandOp], cls: 'status-overdue' };
    }
    return { label: dagKort[geplandOp], cls: 'status-gepland' };
  }
  return { label: '', cls: '' };
}

function isVakActief(vakNaam) {
  const vak = state.configuratie?.vakken?.[vakNaam];
  return vak?.actief !== false;
}

function toggleVak(vakNaam) {
  if (isReadOnly.value) return;
  const config = JSON.parse(JSON.stringify(state.configuratie));
  if (!config.vakken) config.vakken = {};
  if (!config.vakken[vakNaam]) config.vakken[vakNaam] = { actief: true, zRoute: false, aliassen: [], roosterTitels: [] };
  config.vakken[vakNaam].actief = !config.vakken[vakNaam].actief;
  saveConfiguratie(config);
}

function groepeerSections(sections) {
  const groepen = [];
  let current = null;
  for (const s of sections) {
    const naam = s.hoofdgroep || 'Overig';
    if (!current || current.naam !== naam) {
      current = { naam, sections: [] };
      groepen.push(current);
    }
    current.sections.push(s);
  }
  return groepen;
}

function sectionStats(section) {
  let minuten = 0;
  let rooster = 0;
  for (const t of section.taken) {
    if (t.tijd?.type === 'minuten') minuten += t.tijd.minuten;
    else if (t.tijd?.type === 'minuten_per_route') minuten += Math.max(t.tijd.B || 0, t.tijd.Z || 0);
    else if (t.tijd?.type === 'rooster' || t.tijd?.type === 'rooster_zelf') rooster++;
  }
  return { minuten, rooster };
}

function sectionActief(section, week) {
  let actief = 0;
  for (const taak of section.taken) {
    if (isTaakActief(taak, section, week)) actief++;
  }
  return actief;
}

function weekTotals(week) {
  let totaal = 0;
  let actief = 0;
  let minuten = 0;
  for (const section of week.sections) {
    for (const taak of section.taken) {
      totaal++;
      if (isTaakActief(taak, section, week)) {
        actief++;
        if (taak.tijd?.type === 'minuten') minuten += taak.tijd.minuten;
      }
    }
  }
  return { totaal, actief, minuten };
}

function weekTotalsFiltered(week) {
  let zichtbaar = 0;
  let minuten = 0;
  for (const section of week.sections) {
    for (const taak of section.taken) {
      if (isTaakZichtbaar(taak, section, week)) {
        zichtbaar++;
        if (taak.tijd?.type === 'minuten') minuten += taak.tijd.minuten;
      }
    }
  }
  return { zichtbaar, minuten };
}

// Rooster koppelingen
const heeftRooster = computed(() => {
  const wr = state.weekRooster;
  if (!wr) return false;
  for (const dag of ['ma', 'di', 'wo', 'do', 'vr']) {
    const slots = wr[dag];
    if (slots && typeof slots === 'object' && Object.keys(slots).length) return true;
  }
  return false;
});

// ---- Rooster koppeling helpers ----

const alleRoosterTitels = computed(() => {
  const wr = state.weekRooster;
  if (!wr) return [];
  const set = new Set();
  for (const dag of ['ma', 'di', 'wo', 'do', 'vr']) {
    const slots = wr[dag];
    if (!slots || typeof slots !== 'object') continue;
    for (const blok of Object.values(slots)) {
      if (blok?.type === 'les' && blok?.titel) set.add(blok.titel);
    }
  }
  return [...set].sort();
});

function isGekoppeld(vakNaam, titel) {
  const vak = state.configuratie?.vakken?.[vakNaam];
  if (!vak?.roosterTitels?.length) return false;
  const lower = titel.toLowerCase();
  return vak.roosterTitels.some(t => t.toLowerCase() === lower);
}

function isVerworpen(vakNaam, titel) {
  const vak = state.configuratie?.vakken?.[vakNaam];
  if (!vak?.verworpenKoppelingen?.length) return false;
  const lower = titel.toLowerCase();
  return vak.verworpenKoppelingen.some(t => t.toLowerCase() === lower);
}

function isSuggestie(vakNaam, titel) {
  if (isGekoppeld(vakNaam, titel)) return false;
  if (isVerworpen(vakNaam, titel)) return false;
  const vak = state.configuratie?.vakken?.[vakNaam];
  return matchesVak(titel.toLowerCase(), vakNaam, vak);
}

function gekoppeldeTitels(vakNaam) {
  return alleRoosterTitels.value.filter(t => isGekoppeld(vakNaam, t));
}

function suggestieTitels(vakNaam) {
  return alleRoosterTitels.value.filter(t => isSuggestie(vakNaam, t));
}

function overigeTitels(vakNaam) {
  return alleRoosterTitels.value.filter(t => !isGekoppeld(vakNaam, t) && !isSuggestie(vakNaam, t));
}

const overigOpen = ref(new Set());

function toggleOverig(vakNaam) {
  const s = new Set(overigOpen.value);
  if (s.has(vakNaam)) s.delete(vakNaam); else s.add(vakNaam);
  overigOpen.value = s;
}

function toggleKoppeling(vakNaam, titel) {
  if (isReadOnly.value) return;
  const config = JSON.parse(JSON.stringify(state.configuratie));
  if (!config.vakken) config.vakken = {};
  if (!config.vakken[vakNaam]) config.vakken[vakNaam] = { actief: true, zRoute: false, aliassen: [], roosterTitels: [] };
  const arr = config.vakken[vakNaam].roosterTitels || [];
  const verworpen = config.vakken[vakNaam].verworpenKoppelingen || [];
  const lower = titel.toLowerCase();
  const idx = arr.findIndex(t => t.toLowerCase() === lower);
  if (idx >= 0) {
    // Uitzetten: verwijder uit roosterTitels, voeg toe aan verworpen
    arr.splice(idx, 1);
    if (!verworpen.some(t => t.toLowerCase() === lower)) verworpen.push(titel);
  } else {
    // Aanzetten: voeg toe aan roosterTitels, verwijder uit verworpen
    arr.push(titel);
    const vIdx = verworpen.findIndex(t => t.toLowerCase() === lower);
    if (vIdx >= 0) verworpen.splice(vIdx, 1);
  }
  config.vakken[vakNaam].roosterTitels = arr;
  config.vakken[vakNaam].verworpenKoppelingen = verworpen;
  saveConfiguratie(config);
}

function print() { window.print(); }

function goToWeekView(taak, week) {
  const key = rawTaakKey(taak, week.metadata);
  activeView.value = 'weekplan';
  wpViewMode.value = 'week';
  selectTaak(key);
}

const FLAG_TIPS = { P: 'Papier', M: 'Materiaal', U: 'Uitgesteld', G: 'Groepswerk', X: 'Onbekend' };
const FLAG_LABELS = { P: 'Papier', M: 'Materiaal', U: 'Uitgesteld', G: 'Groep', X: 'Onbekend' };
function flagTip(f) { return FLAG_TIPS[f] || f; }
function flagLabel(f) { return FLAG_LABELS[f] || f; }
</script>

<style scoped>
.sw-view {
  max-width: 100%;
}

.sw-header {
  margin-bottom: 1.5rem;
}

.sw-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sw-header h2 {
  margin: 0 0 0.25rem;
  font-size: 1.3rem;
  font-weight: 700;
}

.btn-print {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.35rem 0.75rem;
  border: 1px solid var(--clr-border);
  border-radius: var(--radius);
  background: var(--clr-surface);
  cursor: pointer;
  font-size: 0.8rem;
  color: var(--clr-text-muted);
  transition: all 0.15s;
}

.btn-print:hover {
  border-color: var(--clr-accent);
  color: var(--clr-accent);
  background: var(--clr-accent-light);
}

/* Filter chips */
.sw-chips {
  display: flex;
  gap: 0.4rem;
  margin-top: 0.5rem;
  flex-wrap: wrap;
}

.sw-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.75rem;
  border: 1.5px solid var(--clr-border);
  border-radius: 999px;
  background: white;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--clr-text-muted);
  transition: all 0.15s;
  white-space: nowrap;
}
.sw-chip-count { font-weight: 800; font-variant-numeric: tabular-nums; }

/* Uitgesloten = slate */
.sw-chip-uitgesloten {
  border-color: rgba(100, 116, 139, 0.3);
  color: #475569;
}
.sw-chip-uitgesloten:hover {
  border-color: #64748b;
  background: #f8fafc;
}
.sw-chip-uitgesloten.on {
  background: #64748b;
  border-color: #64748b;
  color: white;
}

/* Afgerond = green */
.sw-chip-afgerond {
  border-color: rgba(5, 150, 105, 0.3);
  color: #047857;
}
.sw-chip-afgerond:hover {
  border-color: #059669;
  background: #ecfdf5;
}
.sw-chip-afgerond.on {
  background: #059669;
  border-color: #059669;
  color: white;
}

.sw-hint {
  font-size: 0.8rem;
  color: var(--clr-text-muted);
  margin: 0.35rem 0 0;
  line-height: 1.5;
}

.sw-leeg {
  color: var(--clr-text-muted);
  font-size: 0.85rem;
  font-style: italic;
  padding: 2rem 0;
  text-align: center;
}

/* Week header */
.sw-week-header {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  padding: 0.6rem 0;
  border-bottom: 2px solid var(--clr-accent);
  margin-bottom: 0.75rem;
}

.sw-week-label {
  font-weight: 700;
  font-size: 1.1rem;
}

.sw-week-datum {
  font-size: 0.85rem;
  color: var(--clr-text-muted);
}

.sw-week-totals {
  font-size: 0.8rem;
  color: var(--clr-text-muted);
  margin-left: auto;
}

/* Groep header (hoofdgroep) */
.sw-groep-header {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--clr-text-muted);
  padding: 0.75rem 0 0.25rem;
  border-bottom: 1px solid var(--clr-border);
  margin-bottom: 0.5rem;
}

/* Section (vak) */
.sw-section {
  margin-bottom: 1rem;
  border: 1px solid var(--clr-border);
  border-radius: var(--radius);
  overflow: hidden;
  transition: opacity 0.2s;
}

.sw-section-inactief {
  opacity: 0.45;
}

.sw-vak-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--clr-bg);
  border-bottom: 1px solid var(--clr-border);
  flex-wrap: wrap;
}

.sw-vak-naam {
  font-weight: 700;
  font-size: 0.9rem;
}

.sw-project-titel {
  font-size: 0.8rem;
  font-weight: 400;
  font-style: italic;
  color: var(--clr-text-muted);
}

.sw-vak-stats {
  font-size: 0.75rem;
  color: var(--clr-text-muted);
  margin-left: auto;
}

.sw-vak-reden {
  font-size: 0.75rem;
  font-style: italic;
  color: #d97706;
  background: #fef3c7;
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
}

.sw-koppeling-rij {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.75rem 0.35rem;
  background: var(--clr-bg);
  border-bottom: 1px solid var(--clr-border);
  flex-wrap: wrap;
}

.koppeling-label {
  font-size: 0.6rem;
  font-weight: 600;
  color: var(--clr-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin-right: 0.15rem;
}

.koppeling-chip {
  background: #ecfdf5;
  color: #059669;
  padding: 0.05rem 0.3rem;
  border-radius: 3px;
  font-weight: 500;
}

.koppeling-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.15rem 0.4rem;
  border: 1.5px solid var(--clr-border);
  border-radius: 999px;
  background: white;
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--clr-text-muted);
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.koppeling-pill:hover {
  border-color: #059669;
  color: #059669;
  background: #ecfdf5;
}

.koppeling-pill.active {
  background: #059669;
  border-color: #059669;
  color: white;
}

.koppeling-pill.active:hover {
  background: #047857;
  border-color: #047857;
}

.koppeling-pill.suggestie {
  border-color: #f59e0b;
  color: #b45309;
  background: #fffbeb;
}

.koppeling-pill.suggestie:hover {
  background: #fef3c7;
  border-color: #d97706;
}

.koppeling-expand-btn {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.45rem;
  border: 1.5px dashed var(--clr-border);
  border-radius: 999px;
  background: white;
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--clr-text-muted);
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.koppeling-expand-btn:hover {
  border-color: var(--clr-accent);
  color: var(--clr-accent);
  background: var(--clr-accent-light);
}

.sw-koppeling-overig {
  padding-left: calc(0.75rem + 3.2rem);
  background: var(--clr-surface);
}

.koppeling-hint {
  font-size: 0.65rem;
  font-style: italic;
  color: #d97706;
}

/* Toggle button */
.toggle-btn {
  width: 28px;
  height: 16px;
  border: none;
  border-radius: 8px;
  background: var(--clr-border);
  cursor: pointer;
  position: relative;
  transition: background 0.2s;
  padding: 0;
  flex-shrink: 0;
}

.toggle-btn.on {
  background: var(--clr-accent);
}

.toggle-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: white;
  transition: transform 0.2s;
  box-shadow: 0 1px 2px rgba(0,0,0,0.15);
}

.toggle-btn.on .toggle-knob {
  transform: translateX(12px);
}

/* Tabel */
.sw-tabel {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
  table-layout: fixed;
}

.sw-tabel th {
  text-align: left;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--clr-text-muted);
  padding: 0.35rem 0.6rem;
  border-bottom: 1px solid var(--clr-border);
  background: var(--clr-bg);
}

.sw-tabel td {
  padding: 0.4rem 0.6rem;
  border-bottom: 1px solid rgba(0,0,0,0.04);
  vertical-align: middle;
}

.sw-tabel tr:last-child td {
  border-bottom: none;
}

.sw-tabel tbody tr:hover {
  background: rgba(99, 102, 241, 0.03);
}

/* Toggle taak button */
.col-incl { width: 32px; text-align: center; }

.btn-toggle-taak {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1.5px solid var(--clr-border);
  background: white;
  font-size: 0.7rem;
  font-weight: 700;
  cursor: pointer;
  line-height: 1;
  transition: all 0.15s;
  color: transparent;
}

.btn-toggle-taak.incl-ja {
  border-color: #10b981;
  background: white;
  color: #10b981;
}

.btn-toggle-taak.incl-ja:hover {
  background: #fef2f2;
  border-color: #ef4444;
  color: #ef4444;
}

.btn-toggle-taak.incl-nee {
  border-color: #d1d5db;
  color: #d1d5db;
}

.btn-toggle-taak.incl-nee:hover {
  border-color: #10b981;
  color: #10b981;
  background: #ecfdf5;
}

.incl-ja-static { color: #10b981; font-weight: 700; font-size: 0.7rem; }
.incl-nee-static { color: #d1d5db; font-weight: 700; font-size: 0.7rem; }

/* Geselecteerde taak */
.taak-selected td {
  background: rgba(99, 102, 241, 0.08);
}

.taak-selected {
  outline: 2px solid var(--clr-accent, #6366f1);
  outline-offset: -2px;
}

.sw-tabel tbody tr {
  cursor: pointer;
}

/* Afgeronde taak */
.taak-klaar td {
  color: var(--clr-text-muted);
  opacity: 0.6;
}

.taak-klaar .col-omschrijving {
  text-decoration: line-through;
  text-decoration-color: #10b981;
}

.taak-klaar .col-incl {
  opacity: 1;
}

/* Uitgesloten rij */
.taak-uitgesloten td {
  color: var(--clr-text-muted);
  opacity: 0.55;
}

.taak-uitgesloten .col-incl {
  opacity: 1;
}

.taak-uitgesloten .col-omschrijving {
  text-decoration: line-through;
}

.filter-reden {
  display: block;
  font-size: 0.7rem;
  color: #d97706;
  font-style: italic;
  text-decoration: none;
  margin-top: 0.15rem;
}

/* Columns — all data inherits .sw-tabel font-size (0.85rem) */
.col-richting { width: 110px; }
.col-code { width: 75px; }
.col-omschrijving { /* flex */ }
.col-tijd { width: 55px; text-align: center; white-space: nowrap; }
.col-flags { width: 60px; text-align: center; white-space: nowrap; }
.col-volgorde { width: 28px; text-align: center; }
.col-status { width: 80px; text-align: center; white-space: nowrap; }

/* Status labels */
.status-gepland {
  font-size: 0.7rem; font-weight: 700; color: var(--clr-accent);
  background: var(--clr-accent-light); padding: 0.15rem 0.4rem; border-radius: 4px;
}
.status-overdue {
  font-size: 0.7rem; font-weight: 700; color: #b45309;
  background: #fffbeb; padding: 0.15rem 0.4rem; border-radius: 4px;
}
.status-intedienen {
  font-size: 0.7rem; font-weight: 700; color: #7c3aed;
  background: #f5f3ff; padding: 0.15rem 0.4rem; border-radius: 4px;
}
.status-ingediend {
  font-size: 0.7rem; font-weight: 700; color: #059669;
  background: #ecfdf5; padding: 0.15rem 0.4rem; border-radius: 4px;
}
.status-link { cursor: pointer; }
.status-link:hover { opacity: 0.8; text-decoration: underline; }

.richting-label {
  font-weight: 400;
}

.col-code {
  font-weight: 700;
}

/* Tijd badges */
.tijd-rooster {
  display: inline-block;
  background: #fef3c7;
  color: #92400e;
  font-weight: 700;
  font-size: 0.75rem;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
}

.tijd-rooster-zelf {
  display: inline-block;
  background: #fef3c7;
  color: #92400e;
  font-weight: 600;
  font-size: 0.7rem;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
}

.tijd-minuten {
  font-variant-numeric: tabular-nums;
}

.tijd-route {
  font-size: 0.75rem;
  color: var(--clr-text-muted);
}

.tijd-nvt {
  color: var(--clr-text-muted);
}

/* Flag badges */
.flag-badge {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.1rem 0.3rem;
  border-radius: 4px;
  margin-right: 0.15rem;
  cursor: help;
  min-width: 1.1em;
  text-align: center;
}

.flag-p { background: #dbeafe; color: #1e40af; }
.flag-m { background: #e0e7ff; color: #3730a3; }
.flag-u { background: #fef3c7; color: #92400e; }
.flag-g { background: #ede9fe; color: #6d28d9; }
.flag-x { background: var(--clr-bg); color: var(--clr-text-muted); }

.volgorde-num {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--clr-text-muted);
  background: var(--clr-bg);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
}

/* Responsive */
@media (max-width: 700px) {
  .sw-tabel { font-size: 0.75rem; }
  .col-code { width: 50px; }
  .col-richting { display: none; }
  .col-flags { display: none; }
  .col-volgorde { display: none; }
  .sw-tabel th.col-richting,
  .sw-tabel th.col-flags,
  .sw-tabel th.col-volgorde { display: none; }
}

@media print {
  .sw-view { max-width: 100%; color: black; }
  .no-print { display: none !important; }
  .sw-section-inactief { display: none; }
  .taak-uitgesloten { display: none; }
  .btn-toggle-taak { display: none; }
  .toggle-btn { display: none; }
  .sw-koppeling-rij { display: none; }
  .col-richting { display: none; }
  .sw-tabel th.col-richting { display: none; }
  .col-incl { display: none; }
  .sw-tabel th.col-incl { display: none; }
  .col-status span { color: black !important; background: none !important; font-weight: 700; }

  .sw-section {
    break-inside: avoid;
    page-break-inside: avoid;
    border-color: #999;
  }

  .sw-week-header {
    border-bottom: 2px solid black;
  }

  .sw-groep-header {
    border-bottom-color: #999;
    color: #333;
  }

  .sw-vak-header {
    background: #eee !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    color: black;
  }

  .sw-vak-naam { color: black; }
  .sw-vak-stats { color: #555; }
  .sw-week-datum, .sw-week-totals { color: #555; }

  .sw-tabel th {
    background: transparent !important;
    color: #333;
  }

  .sw-tabel td {
    color: black;
    border-bottom-color: #ddd;
  }

  .taak-klaar .col-omschrijving {
    text-decoration-color: #666;
  }

  .tijd-rooster, .tijd-rooster-zelf {
    background: #eee !important;
    color: black;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .flag-badge {
    background: #eee !important;
    color: #333;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .volgorde-num {
    background: #eee !important;
    color: #333;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .richting-label {
    background: #eee !important;
    color: #333;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
</style>
