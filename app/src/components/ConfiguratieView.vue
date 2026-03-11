<template>
  <div class="config-view">
    <!-- Tabs -->
    <div class="config-tabs">
      <button :class="{ active: tab === 'vakken' }" @click="tab = 'vakken'">
        Vakken
        <span v-if="ongekoppeldeVakkenCount" class="tab-badge warn">{{ ongekoppeldeVakkenCount }}</span>
      </button>
      <button :class="{ active: tab === 'rooster' }" @click="tab = 'rooster'">
        Rooster
        <span v-if="ongekoppeldeTitelsCount" class="tab-badge warn">{{ ongekoppeldeTitelsCount }}</span>
      </button>
    </div>

    <!-- Tab: Vakken -->
    <div v-if="tab === 'vakken'" class="config-panel">
      <p class="config-hint">Vakken worden automatisch herkend uit de studiewijzer. Zet een vak uit om alle taken ervan te verbergen.</p>

      <div v-if="!vakNamen.length" class="config-leeg">
        Geen vakken gevonden. Importeer eerst een studiewijzer.
      </div>

      <template v-else>
        <!-- Warnings -->
        <div v-if="ongekoppeldeVakken.length" class="config-warn">
          <Icon icon="mdi:alert-outline" width="16" height="16" />
          <span>{{ ongekoppeldeVakken.length }} {{ ongekoppeldeVakken.length === 1 ? 'vak is' : 'vakken zijn' }} niet gekoppeld aan het rooster: <strong>{{ ongekoppeldeVakken.join(', ') }}</strong></span>
        </div>

        <div class="vak-lijst">
          <div class="vak-rij vak-rij-header-row">
            <span class="vak-col-naam">Vak</span>
            <span class="vak-col-toggle">Actief</span>
            <span class="vak-col-toggle">Z-route</span>
            <span class="vak-col-aliassen">Aliassen</span>
            <span class="vak-col-rooster">Rooster</span>
          </div>
          <div
            v-for="naam in vakNamen"
            :key="naam"
            class="vak-rij"
            :class="{ 'vak-inactief': !vakken[naam]?.actief }"
          >
            <span class="vak-col-naam">{{ naam }}</span>
            <span class="vak-col-toggle">
              <button class="toggle-btn" :class="{ on: vakken[naam]?.actief }" @click="toggleVakProp(naam, 'actief')">
                <span class="toggle-knob"></span>
              </button>
            </span>
            <span class="vak-col-toggle">
              <button class="toggle-btn" :class="{ on: vakken[naam]?.zRoute }" @click="toggleVakProp(naam, 'zRoute')">
                <span class="toggle-knob"></span>
              </button>
            </span>
            <span class="vak-col-aliassen">
              <span v-for="alias in (vakken[naam]?.aliassen || [])" :key="alias" class="alias-chip">
                {{ alias }}
                <button class="alias-remove" @click="removeAlias(naam, alias)">&times;</button>
              </span>
              <input class="alias-input" type="text" placeholder="+" @keydown.enter="addAlias(naam, $event)" @blur="addAlias(naam, $event)" />
            </span>
            <span class="vak-col-rooster">
              <template v-if="vakRoosterTitels(naam).length">
                <span v-for="t in vakRoosterTitels(naam)" :key="t" class="rooster-chip">{{ t }}</span>
              </template>
              <span v-else-if="vakken[naam]?.actief" class="rooster-geen">
                <Icon icon="mdi:alert-circle-outline" width="12" height="12" /> geen
              </span>
            </span>
          </div>
        </div>

        <div class="config-actions">
          <button class="btn-secondary" @click="redetectVakken">Vakken opnieuw detecteren</button>
          <button class="btn-secondary" @click="autoKoppel">Automatisch koppelen</button>
        </div>
      </template>
    </div>

    <!-- Tab: Rooster -->
    <div v-if="tab === 'rooster'" class="config-panel">
      <WeekRoosterEditor />

      <!-- Koppelingen summary below rooster -->
      <template v-if="roosterTitels.length">
        <h3 class="koppeling-header">Koppelingen rooster ↔ vakken</h3>
        <p class="config-hint">Koppel elk roosterslot aan de juiste vakken. Auto-suggesties worden getoond. "Wildcard" = slot voor alle vakken (bijv. Lab@Work).</p>

        <!-- Warnings -->
        <div v-if="ongekoppeldeTitels.length" class="config-warn">
          <Icon icon="mdi:alert-outline" width="16" height="16" />
          <span>{{ ongekoppeldeTitels.length }} roosterslot{{ ongekoppeldeTitels.length === 1 ? '' : 's' }} zonder koppeling: <strong>{{ ongekoppeldeTitels.join(', ') }}</strong></span>
        </div>

        <div class="koppeling-lijst">
          <div
            v-for="titel in roosterTitels"
            :key="titel"
            class="koppeling-rij"
            :class="{ 'koppeling-ok': isGekoppeld(titel), 'koppeling-warn': !isGekoppeld(titel) }"
          >
            <span class="koppeling-titel">{{ titel }}</span>
            <div class="koppeling-vakken">
              <label class="koppeling-wildcard">
                <input type="checkbox" :checked="isWildcard(titel)" @change="toggleWildcard(titel, $event.target.checked)" />
                Wildcard
              </label>
              <template v-if="!isWildcard(titel)">
                <!-- Confirmed links -->
                <span v-for="vak in gekoppeldeVakken(titel)" :key="vak" class="alias-chip">
                  {{ vak }}
                  <button class="alias-remove" @click="ontkoppelVak(titel, vak)">&times;</button>
                </span>
                <!-- Auto-suggestions (not yet saved) -->
                <span
                  v-for="vak in suggesties(titel)"
                  :key="'sug-' + vak"
                  class="alias-chip suggestie"
                  @click="koppelVak(titel, vak)"
                  :title="`Klik om '${vak}' te koppelen`"
                >
                  {{ vak }} ?
                </span>
                <!-- Manual add -->
                <select class="koppeling-add" @change="koppelVak(titel, $event.target.value); $event.target.value = ''">
                  <option value="">+ vak</option>
                  <option v-for="vak in beschikbareVakken(titel)" :key="vak" :value="vak">{{ vak }}</option>
                </select>
              </template>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import { usePlanner } from '../stores/planner.js';
import WeekRoosterEditor from './WeekRoosterEditor.vue';

const { state, saveConfiguratie, deriveVakkenConfig, autoKoppelVakken, matchesVak, extractKeywords, BEKENDE_GROEPEN, BEKENDE_WILDCARDS, isReadOnly } = usePlanner();

const tab = ref('vakken');

// Auto-koppel on first mount if no koppelingen exist yet
onMounted(() => {
  if (isReadOnly.value) return;
  const vakken = state.configuratie?.vakken || {};
  const heeftKoppelingen = Object.values(vakken).some(v => v.roosterTitels?.length > 0);
  const heeftWildcards = (state.configuratie?.wildcardTitels || []).length > 0;
  if (!heeftKoppelingen && !heeftWildcards && Object.keys(vakken).length > 0) {
    autoKoppel();
  }
});

// ---- Vakken ----

const vakken = computed(() => state.configuratie?.vakken || {});

const vakNamen = computed(() => {
  return Object.keys(vakken.value).sort((a, b) => a.localeCompare(b, 'nl'));
});

const actieveVakNamen = computed(() => {
  return vakNamen.value.filter(v => vakken.value[v]?.actief !== false);
});

function toggleVakProp(naam, prop) {
  if (isReadOnly.value) return;
  const config = JSON.parse(JSON.stringify(state.configuratie));
  if (!config.vakken[naam]) config.vakken[naam] = { actief: true, zRoute: false, aliassen: [], roosterTitels: [] };
  config.vakken[naam][prop] = !config.vakken[naam][prop];
  saveConfiguratie(config);
}

function addAlias(naam, event) {
  const input = event.target;
  const val = input.value.trim().toUpperCase();
  input.value = '';
  if (!val || isReadOnly.value) return;
  const config = JSON.parse(JSON.stringify(state.configuratie));
  if (!config.vakken[naam]) return;
  if (!config.vakken[naam].aliassen) config.vakken[naam].aliassen = [];
  if (config.vakken[naam].aliassen.includes(val)) return;
  config.vakken[naam].aliassen.push(val);
  saveConfiguratie(config);
}

function removeAlias(naam, alias) {
  if (isReadOnly.value) return;
  const config = JSON.parse(JSON.stringify(state.configuratie));
  if (!config.vakken[naam]?.aliassen) return;
  config.vakken[naam].aliassen = config.vakken[naam].aliassen.filter(a => a !== alias);
  saveConfiguratie(config);
}

function redetectVakken() {
  if (isReadOnly.value) return;
  const config = JSON.parse(JSON.stringify(state.configuratie));
  config.vakken = deriveVakkenConfig(state.weken, {});
  saveConfiguratie(config);
}

// Which rooster titles is a vak linked to?
function vakRoosterTitels(naam) {
  const vak = vakken.value[naam];
  if (!vak?.roosterTitels?.length) {
    // Check wildcards — if any wildcard exists, this vak is implicitly covered
    const wildcards = state.configuratie?.wildcardTitels || [];
    if (wildcards.length) return wildcards.map(w => `${w} *`);
    return [];
  }
  return vak.roosterTitels;
}

// ---- Rooster titels ----

const roosterTitels = computed(() => {
  const titels = new Set();
  const wr = state.weekRooster;
  if (!wr) return [];
  for (const dag of ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo']) {
    const slots = wr[dag];
    if (!slots || typeof slots !== 'object') continue;
    for (const slot of Object.values(slots)) {
      if (slot.type === 'les' && slot.titel) {
        titels.add(slot.titel);
      }
    }
  }
  return [...titels].sort((a, b) => a.localeCompare(b, 'nl'));
});

// ---- Koppelingen ----

function isWildcard(titel) {
  return (state.configuratie?.wildcardTitels || []).includes(titel.toLowerCase());
}

function isGekoppeld(titel) {
  return isWildcard(titel) || gekoppeldeVakken(titel).length > 0;
}

function toggleWildcard(titel, checked) {
  if (isReadOnly.value) return;
  const config = JSON.parse(JSON.stringify(state.configuratie));
  if (!config.wildcardTitels) config.wildcardTitels = [];
  const lower = titel.toLowerCase();
  if (checked) {
    if (!config.wildcardTitels.includes(lower)) config.wildcardTitels.push(lower);
    for (const vak of Object.values(config.vakken)) {
      if (vak.roosterTitels) {
        vak.roosterTitels = vak.roosterTitels.filter(t => t !== lower);
      }
    }
  } else {
    config.wildcardTitels = config.wildcardTitels.filter(t => t !== lower);
  }
  saveConfiguratie(config);
}

function gekoppeldeVakken(titel) {
  const lower = titel.toLowerCase();
  const result = [];
  for (const [naam, vak] of Object.entries(vakken.value)) {
    if (vak.roosterTitels?.includes(lower)) result.push(naam);
  }
  return result;
}

function beschikbareVakken(titel) {
  const gekoppeld = new Set(gekoppeldeVakken(titel));
  const gesuggereerd = new Set(suggesties(titel));
  return actieveVakNamen.value.filter(v => !gekoppeld.has(v) && !gesuggereerd.has(v));
}

// ---- Auto-suggesties ----

// Suggest vakken that likely match a rooster title, but aren't explicitly linked yet
function suggesties(titel) {
  if (isWildcard(titel)) return [];
  const lower = titel.toLowerCase();
  const alGekoppeld = new Set(gekoppeldeVakken(titel).map(v => v.toLowerCase()));
  const result = [];

  for (const naam of actieveVakNamen.value) {
    if (alGekoppeld.has(naam.toLowerCase())) continue;
    if (matchesVak(lower, naam, vakken.value[naam])) {
      result.push(naam);
    }
  }

  return result;
}

function koppelVak(titel, vakNaam) {
  if (!vakNaam || isReadOnly.value) return;
  const config = JSON.parse(JSON.stringify(state.configuratie));
  const lower = titel.toLowerCase();
  if (!config.vakken[vakNaam]) return;
  if (!config.vakken[vakNaam].roosterTitels) config.vakken[vakNaam].roosterTitels = [];
  if (!config.vakken[vakNaam].roosterTitels.includes(lower)) {
    config.vakken[vakNaam].roosterTitels.push(lower);
  }
  saveConfiguratie(config);
}

function ontkoppelVak(titel, vakNaam) {
  if (isReadOnly.value) return;
  const config = JSON.parse(JSON.stringify(state.configuratie));
  const lower = titel.toLowerCase();
  if (config.vakken[vakNaam]?.roosterTitels) {
    config.vakken[vakNaam].roosterTitels = config.vakken[vakNaam].roosterTitels.filter(t => t !== lower);
  }
  saveConfiguratie(config);
}

// Auto-koppel: accept all suggestions at once
function autoKoppel() {
  if (isReadOnly.value) return;
  const config = JSON.parse(JSON.stringify(state.configuratie));
  saveConfiguratie(autoKoppelVakken(config));
}

// ---- Warnings ----

// Actieve vakken without any rooster link (and no wildcard covering them)
const ongekoppeldeVakken = computed(() => {
  const wildcards = state.configuratie?.wildcardTitels || [];
  if (wildcards.length) return []; // wildcard covers all
  if (!roosterTitels.value.length) return []; // no rooster = nothing to warn about
  return actieveVakNamen.value.filter(naam => {
    const rt = vakken.value[naam]?.roosterTitels || [];
    return rt.length === 0;
  });
});

const ongekoppeldeVakkenCount = computed(() => ongekoppeldeVakken.value.length);

// Rooster titles without any vak link and not wildcard
const ongekoppeldeTitels = computed(() => {
  if (!vakNamen.value.length) return []; // no vakken = nothing to warn about
  return roosterTitels.value.filter(titel => !isGekoppeld(titel) && suggesties(titel).length === 0);
});

const ongekoppeldeTitelsCount = computed(() => ongekoppeldeTitels.value.length);
</script>

<style scoped>
.config-view {
  max-width: 800px;
}

/* ---- Tabs ---- */
.config-tabs {
  display: flex;
  gap: 0;
  border: 1px solid var(--clr-border);
  border-radius: var(--radius);
  overflow: hidden;
  margin-bottom: 1.5rem;
}

.config-tabs button {
  flex: 1;
  padding: 0.6rem 1rem;
  border: none;
  background: var(--clr-surface);
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--clr-text-muted);
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
}

.config-tabs button + button {
  border-left: 1px solid var(--clr-border);
}

.config-tabs button.active {
  background: var(--clr-accent);
  color: white;
}

.config-tabs button:hover:not(.active) {
  background: var(--clr-accent-light);
  color: var(--clr-accent);
}

.tab-badge {
  font-size: 0.65rem;
  font-weight: 700;
  padding: 0.1rem 0.35rem;
  border-radius: 8px;
  line-height: 1;
}

.tab-badge.warn {
  background: #fef3c7;
  color: #92400e;
}

.config-tabs button.active .tab-badge.warn {
  background: rgba(255,255,255,0.3);
  color: white;
}

/* ---- Panel ---- */
.config-panel {
  animation: fadeIn 0.15s;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.config-hint {
  font-size: 0.8rem;
  color: var(--clr-text-muted);
  margin: 0 0 1rem;
  line-height: 1.5;
}

.config-leeg {
  color: var(--clr-text-muted);
  font-size: 0.85rem;
  font-style: italic;
  padding: 2rem 0;
  text-align: center;
}

.config-warn {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.6rem 0.75rem;
  background: #fef3c7;
  border: 1px solid #fde68a;
  border-radius: var(--radius);
  font-size: 0.8rem;
  color: #92400e;
  margin-bottom: 1rem;
  line-height: 1.4;
}

.config-actions {
  margin-top: 1rem;
  display: flex;
  gap: 0.5rem;
}

.btn-secondary {
  padding: 0.4rem 1rem;
  border: 1px solid var(--clr-border);
  border-radius: 6px;
  background: var(--clr-surface);
  cursor: pointer;
  font-size: 0.8rem;
  color: var(--clr-text-muted);
  transition: all 0.15s;
}

.btn-secondary:hover {
  border-color: var(--clr-accent);
  color: var(--clr-accent);
}

/* ---- Vakken lijst ---- */
.vak-lijst {
  border: 1px solid var(--clr-border);
  border-radius: var(--radius);
  overflow: hidden;
}

.vak-rij {
  display: grid;
  grid-template-columns: 1.2fr 55px 55px 1fr 1fr;
  gap: 0.5rem;
  align-items: center;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--clr-border);
  font-size: 0.8rem;
}

.vak-rij:last-child {
  border-bottom: none;
}

.vak-rij-header-row {
  background: var(--clr-bg);
  font-weight: 700;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--clr-text-muted);
  padding: 0.4rem 0.75rem;
}

.vak-inactief {
  opacity: 0.5;
}

.vak-col-naam {
  font-weight: 600;
}

.vak-col-toggle {
  display: flex;
  justify-content: center;
}

.vak-col-aliassen,
.vak-col-rooster {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  align-items: center;
}

.rooster-chip {
  font-size: 0.65rem;
  font-weight: 500;
  color: var(--clr-text-muted);
  background: var(--clr-bg);
  padding: 0.1rem 0.35rem;
  border-radius: 3px;
}

.rooster-geen {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  font-size: 0.65rem;
  color: #d97706;
}

/* ---- Toggle button ---- */
.toggle-btn {
  width: 32px;
  height: 18px;
  border: none;
  border-radius: 9px;
  background: var(--clr-border);
  cursor: pointer;
  position: relative;
  transition: background 0.2s;
  padding: 0;
}

.toggle-btn.on {
  background: var(--clr-accent);
}

.toggle-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: white;
  transition: transform 0.2s;
  box-shadow: 0 1px 2px rgba(0,0,0,0.15);
}

.toggle-btn.on .toggle-knob {
  transform: translateX(14px);
}

/* ---- Alias chips ---- */
.alias-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  background: var(--clr-accent-light);
  color: var(--clr-accent);
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
}

.alias-chip.suggestie {
  background: #fef3c7;
  color: #92400e;
  border: 1px dashed #fde68a;
  cursor: pointer;
  transition: all 0.15s;
}

.alias-chip.suggestie:hover {
  background: #fde68a;
  border-style: solid;
}

.alias-remove {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--clr-accent);
  font-size: 0.8rem;
  padding: 0;
  line-height: 1;
  opacity: 0.6;
}

.alias-remove:hover {
  opacity: 1;
}

.alias-input {
  width: 2.5rem;
  padding: 0.1rem 0.3rem;
  border: 1px solid transparent;
  border-radius: 4px;
  font-size: 0.7rem;
  background: transparent;
  color: var(--clr-text-muted);
  text-align: center;
  transition: all 0.15s;
}

.alias-input:focus {
  width: 4rem;
  border-color: var(--clr-accent);
  background: var(--clr-surface);
  outline: none;
  text-align: left;
}

/* ---- Koppelingen (in rooster tab) ---- */
.koppeling-header {
  margin: 2rem 0 0.5rem;
  font-size: 1rem;
  font-weight: 700;
}

.koppeling-lijst {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.koppeling-rij {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.45rem 0.75rem;
  border: 1px solid var(--clr-border);
  border-radius: var(--radius);
  background: var(--clr-surface);
  transition: border-color 0.15s;
}

.koppeling-rij.koppeling-ok {
  border-left: 3px solid #059669;
}

.koppeling-rij.koppeling-warn {
  border-left: 3px solid #d97706;
}

.koppeling-titel {
  font-weight: 700;
  font-size: 0.85rem;
  min-width: 120px;
}

.koppeling-vakken {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  align-items: center;
  flex: 1;
}

.koppeling-wildcard {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.75rem;
  color: var(--clr-text-muted);
  cursor: pointer;
}

.koppeling-wildcard input {
  accent-color: var(--clr-accent);
}

.koppeling-add {
  padding: 0.15rem 0.3rem;
  border: 1px dashed var(--clr-border);
  border-radius: 4px;
  font-size: 0.7rem;
  background: var(--clr-surface);
  color: var(--clr-text-muted);
  cursor: pointer;
}

.koppeling-add:hover {
  border-color: var(--clr-accent);
  color: var(--clr-accent);
}

/* ---- Responsive ---- */
@media (max-width: 700px) {
  .vak-rij {
    grid-template-columns: 1fr 45px 45px;
  }
  .vak-col-aliassen,
  .vak-col-rooster {
    grid-column: 1 / -1;
  }
}
</style>
