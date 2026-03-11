<template>
  <div class="rooster-editor">
    <div class="rooster-header">
      <h2>Weekrooster</h2>
      <p class="rooster-hint">Klik op een cel om te bewerken. Sleep om te verplaatsen, houd Alt/Option ingedrukt om te kopiëren.</p>
    </div>

    <!-- Import -->
    <div class="import-strip">
      <label class="import-btn">
        <input type="file" accept=".md,.txt" @change="onImport" hidden />
        <Icon icon="mdi:upload-outline" width="14" height="14" />
        Importeren (.md)
      </label>
      <button v-if="heeftData" class="import-btn" @click="exportRooster">
        <Icon icon="mdi:download-outline" width="14" height="14" />
        Exporteren (.md)
      </button>
    </div>

    <!-- Grid -->
    <div class="rooster-grid">
      <!-- Header row -->
      <div class="grid-corner">Uur</div>
      <div v-for="dag in dagen" :key="dag" class="grid-dag-header">
        {{ dagLabels[dag] }}
      </div>

      <!-- Data rows -->
      <template v-for="uur in aantalUren" :key="uur">
        <div class="grid-uur" :class="{ 'grid-middag': uur === 6 }">{{ uur }}</div>
        <div
          v-for="dag in dagen"
          :key="`${dag}-${uur}`"
          class="grid-cel"
          :class="[
            celClass(dag, uur),
            { 'grid-cel-actief': editCel?.dag === dag && editCel?.uur === uur },
            { 'grid-cel-drag-over': dragOver?.dag === dag && dragOver?.uur === uur },
            { 'grid-cel-drag-copy': dragOver?.dag === dag && dragOver?.uur === uur && dragCopy },
            { 'grid-middag': uur === 6 },
          ]"
          :draggable="!!getSlot(dag, uur) && !isReadOnly"
          @click="openEdit(dag, uur)"
          @dragstart="onCelDragStart($event, dag, uur)"
          @dragend="onCelDragEnd"
          @dragover.prevent="onCelDragOver($event, dag, uur)"
          @dragenter.prevent
          @dragleave="onCelDragLeave($event, dag, uur)"
          @drop="onCelDrop($event, dag, uur)"
        >
          <span v-if="getSlot(dag, uur)" class="cel-label">{{ getSlot(dag, uur).titel }}</span>
          <span v-if="getSlot(dag, uur)" class="cel-type">{{ typeLabels[getSlot(dag, uur).type] }}</span>
          <span v-if="dragOver?.dag === dag && dragOver?.uur === uur" class="cel-drag-hint">
            {{ dragCopy ? 'Kopieer' : 'Verplaats' }}
          </span>
        </div>
      </template>
    </div>

    <!-- Add extra row -->
    <div class="uur-controls">
      <button v-if="aantalUren < 16" class="uur-btn" @click="aantalUren++">+ Uur toevoegen</button>
      <button v-if="aantalUren > 6" class="uur-btn" @click="verwijderLaatsteUur">− Uur verwijderen</button>
    </div>

    <!-- Inline edit popup -->
    <div v-if="editCel" class="edit-popup" :style="popupStyle" @click.stop>
      <div class="edit-header">
        Uur {{ editCel.uur }} – {{ dagLabels[editCel.dag] }}
        <button class="edit-close" @click="editCel = null">&times;</button>
      </div>
      <div class="edit-body">
        <input
          ref="editInput"
          type="text"
          v-model="editForm.titel"
          placeholder="bv. Wiskunde, L@W, Piano..."
          @keydown.enter="saveEdit"
          @keydown.escape="editCel = null"
        />
        <div class="type-knoppen">
          <button
            v-for="t in types"
            :key="t"
            class="type-knop"
            :class="[`type-${t}`, { active: editForm.type === t }]"
            @click="editForm.type = t"
          >{{ typeLabels[t] }}</button>
        </div>
        <div class="edit-actions">
          <button class="btn-save" @click="saveEdit">OK</button>
          <button v-if="getSlot(editCel.dag, editCel.uur)" class="btn-wis" @click="wisEdit">Wissen</button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, nextTick, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { usePlanner } from '../stores/planner.js';

const { state, saveWeekRooster, isReadOnly } = usePlanner();

const dagen = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
const dagLabels = { ma: 'Maandag', di: 'Dinsdag', wo: 'Woensdag', do: 'Donderdag', vr: 'Vrijdag', za: 'Zaterdag', zo: 'Zondag' };
const types = ['les', 'bezet', 'vrij'];
const typeLabels = { les: 'Les', bezet: 'Bezet', vrij: 'Vrij' };

// Rooster data: { ma: { 1: { titel, type }, 2: ... }, di: ... }
const rooster = ref(loadFromState());
const aantalUren = ref(detectAantalUren());
const editCel = ref(null);
const editForm = ref({ titel: '', type: 'les' });
const editInput = ref(null);
const popupStyle = ref({});

// Drag state for moving/copying cells
const dragSource = ref(null);  // { dag, uur }
const dragOver = ref(null);    // { dag, uur }
const dragCopy = ref(false);   // true when Alt/Option is held

function loadFromState() {
  const wr = state.weekRooster;
  if (!wr || !wr.ma) return { ma: {}, di: {}, wo: {}, do: {}, vr: {}, za: {}, zo: {} };
  // Support both old (array) and new (object) format
  if (Array.isArray(wr.ma)) {
    // Convert array format to object format
    const result = {};
    for (const dag of ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo']) {
      result[dag] = {};
      if (Array.isArray(wr[dag])) {
        wr[dag].forEach((blok, i) => {
          if (blok) result[dag][i + 1] = blok;
        });
      }
    }
    return result;
  }
  return JSON.parse(JSON.stringify(wr));
}

function detectAantalUren() {
  let max = 14;
  const wr = state.weekRooster;
  if (wr) {
    for (const dag of ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo']) {
      const slots = wr[dag];
      if (!slots) continue;
      if (Array.isArray(slots)) {
        max = Math.max(max, slots.length);
      } else {
        for (const uur of Object.keys(slots)) {
          max = Math.max(max, parseInt(uur));
        }
      }
    }
  }
  return max;
}

watch(() => state.weekRooster, () => {
  rooster.value = loadFromState();
  aantalUren.value = detectAantalUren();
}, { deep: true });

const heeftData = computed(() => {
  for (const dag of dagen) {
    if (Object.keys(rooster.value[dag] || {}).length > 0) return true;
  }
  return false;
});

function getSlot(dag, uur) {
  return rooster.value[dag]?.[uur] || null;
}

function celClass(dag, uur) {
  const slot = getSlot(dag, uur);
  if (!slot) return 'grid-cel-leeg';
  return `grid-cel-${slot.type}`;
}

function openEdit(dag, uur) {
  if (isReadOnly.value) return;
  const slot = getSlot(dag, uur);
  editCel.value = { dag, uur };
  editForm.value = slot ? { ...slot } : { titel: '', type: 'les' };

  // Position popup near the click
  nextTick(() => {
    if (editInput.value) editInput.value.focus();
  });
}

function saveEdit() {
  if (!editCel.value || isReadOnly.value) return;
  const { dag, uur } = editCel.value;

  if (editForm.value.titel.trim()) {
    if (!rooster.value[dag]) rooster.value[dag] = {};
    rooster.value[dag][uur] = {
      titel: editForm.value.titel.trim(),
      type: editForm.value.type,
    };
  } else {
    delete rooster.value[dag]?.[uur];
  }

  editCel.value = null;
  persist();
}

function wisEdit() {
  if (!editCel.value || isReadOnly.value) return;
  const { dag, uur } = editCel.value;
  delete rooster.value[dag]?.[uur];
  editCel.value = null;
  persist();
}

function verwijderLaatsteUur() {
  // Remove last uur from all days
  for (const dag of dagen) {
    delete rooster.value[dag]?.[aantalUren.value];
  }
  aantalUren.value--;
  persist();
}

function persist() {
  saveWeekRooster(JSON.parse(JSON.stringify(rooster.value)));
}

// ---- Drag & drop (move / copy cells) ----

function onCelDragStart(e, dag, uur) {
  const slot = getSlot(dag, uur);
  if (!slot || isReadOnly.value) { e.preventDefault(); return; }
  dragSource.value = { dag, uur };
  dragCopy.value = e.altKey;
  e.dataTransfer.effectAllowed = 'copyMove';
  e.dataTransfer.setData('text/plain', `${dag}_${uur}`);
}

function onCelDragEnd() {
  dragSource.value = null;
  dragOver.value = null;
  dragCopy.value = false;
}

function onCelDragOver(e, dag, uur) {
  if (!dragSource.value) return;
  dragOver.value = { dag, uur };
  dragCopy.value = e.altKey;
  e.dataTransfer.dropEffect = e.altKey ? 'copy' : 'move';
}

function onCelDragLeave(e, dag, uur) {
  if (!e.currentTarget.contains(e.relatedTarget)) {
    if (dragOver.value?.dag === dag && dragOver.value?.uur === uur) {
      dragOver.value = null;
    }
  }
}

function onCelDrop(e, targetDag, targetUur) {
  e.preventDefault();
  if (!dragSource.value || isReadOnly.value) return;

  const { dag: srcDag, uur: srcUur } = dragSource.value;
  const isCopy = e.altKey;

  // Don't drop on self
  if (srcDag === targetDag && srcUur === targetUur) {
    dragSource.value = null;
    dragOver.value = null;
    return;
  }

  const srcSlot = getSlot(srcDag, srcUur);
  if (!srcSlot) return;

  const targetSlot = getSlot(targetDag, targetUur);

  if (isCopy) {
    // Copy: duplicate source to target
    if (!rooster.value[targetDag]) rooster.value[targetDag] = {};
    rooster.value[targetDag][targetUur] = { ...srcSlot };
  } else {
    // Move: swap source and target
    if (targetSlot) {
      // Swap
      if (!rooster.value[srcDag]) rooster.value[srcDag] = {};
      rooster.value[srcDag][srcUur] = { ...targetSlot };
      rooster.value[targetDag][targetUur] = { ...srcSlot };
    } else {
      // Move to empty
      if (!rooster.value[targetDag]) rooster.value[targetDag] = {};
      rooster.value[targetDag][targetUur] = { ...srcSlot };
      delete rooster.value[srcDag][srcUur];
    }
  }

  dragSource.value = null;
  dragOver.value = null;
  dragCopy.value = false;
  persist();
}

// ---- Vak code parsing ----

const vakMap = {
  'NED': 'Nederlands',
  'FRA': 'Frans',
  'ENG': 'Engels',
  'WIS': 'Wiskunde',
  'BIO': 'Biologie',
  'FY': 'Fysica',
  'CHEM': 'Chemie',
  'CUL': 'Cultuur',
  'LO': 'LO',
  'RB': 'Religie/Burgerzin',
  'TAAL': 'Taal',
};

// Codes die studie-blokken zijn (taken/huiswerk kan hier)
const studieBlokken = ['L@W', 'LAW', 'SCIENCE@LAB', 'STEM@LAB', 'ZEBRA'];

function parseVakCode(raw) {
  const upper = raw.toUpperCase().replace(/\s+/g, '');

  // Speciale blokken
  if (upper === 'L@W' || upper === 'LAW') return { titel: 'Lab@Work', type: 'les' };
  if (upper.includes('SCIENCE@LAB')) return { titel: 'Science@Lab', type: 'les' };
  if (upper.includes('STEM@LAB')) return { titel: 'STEM@Lab', type: 'les' };
  if (upper === 'ZEBRA') return { titel: 'Zebra', type: 'les' };
  if (upper.startsWith('STEM_PROJECT') || upper.includes('STEM_PROJECT')) return { titel: 'STEM Project', type: 'les' };

  // Coaching: CONaam → Coaching
  if (/^CO[A-Z]/.test(raw) && !raw.includes('_')) return { titel: 'Coaching', type: 'les' };

  // Standaard vakcode: [jaar][vak][_extra][route]
  // Strip leading digits (jaar)
  let code = raw.replace(/^\d+/, '');

  // Strip trailing route indicators (_Z, _B, Z, B) maar niet als het de hele code is
  let cleaned = code.replace(/[_]?(MC)?[_]?([BZ])$/i, '');
  // Also strip trailing digit+u+route like "6uZ", "8u"
  cleaned = cleaned.replace(/\d+u[BZ]?$/i, '');
  // Strip trailing _1, _2 etc (groepsnummers)
  cleaned = cleaned.replace(/[_]\d+$/g, '');
  // Strip leading/trailing underscores
  cleaned = cleaned.replace(/^_+|_+$/g, '');
  // Strip trailing WW/HW/MT (richting-suffix)
  cleaned = cleaned.replace(/(WW|HW|MT)$/i, '');

  // Lookup in vakMap (case-insensitive)
  const upperCleaned = cleaned.toUpperCase();
  for (const [key, label] of Object.entries(vakMap)) {
    if (upperCleaned === key) return { titel: label, type: 'les' };
  }

  // Als we niks vinden, gewoon de originele code netjes maken
  // Strip jaar-prefix en route-suffix voor leesbaarheid
  let fallback = raw.replace(/^\d+/, '').replace(/_/g, ' ').trim();
  if (!fallback) fallback = raw;
  return { titel: fallback, type: 'les' };
}

// ---- Import markdown rooster ----

function onImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    parseRoosterMd(reader.result);
    e.target.value = '';
  };
  reader.readAsText(file);
}

function exportRooster() {
  // Determine which days have data
  const activeDagen = dagen.filter(d => Object.keys(rooster.value[d] || {}).length > 0);
  if (!activeDagen.length) return;

  const dagH = activeDagen.map(d => dagLabels[d]);
  const colWidth = Math.max(...dagH.map(h => h.length), 12);
  const pad = (s) => s.padEnd(colWidth);

  let md = `| Uur | ${dagH.map(h => pad(h)).join(' | ')} |\n`;
  md += `| --- | ${dagH.map(() => '-'.repeat(colWidth)).join(' | ')} |\n`;

  for (let uur = 1; uur <= aantalUren.value; uur++) {
    const cells = activeDagen.map(d => {
      const slot = getSlot(d, uur);
      if (!slot) return pad('');
      const suffix = slot.type !== 'les' ? ` [${slot.type}]` : '';
      return pad(slot.titel + suffix);
    });
    md += `| ${String(uur).padStart(3)} | ${cells.join(' | ')} |\n`;
  }

  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'weekrooster.md';
  a.click();
  URL.revokeObjectURL(url);
}

function parseRoosterMd(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Find the header row (contains | Uur |)
  const headerIdx = lines.findIndex(l => /\|\s*Uur\s*\|/i.test(l));
  if (headerIdx < 0) return;

  // Split by | but keep positional columns (don't filter empty ones!)
  // "| Uur | Ma | Di | Wo |" → ["", " Uur ", " Ma ", " Di ", " Wo ", ""] → slice to ["Uur", "Ma", "Di", "Wo"]
  const headerCells = lines[headerIdx].split('|').map(c => c.trim());
  // Remove first/last empty strings from leading/trailing pipes
  if (headerCells[0] === '') headerCells.shift();
  if (headerCells[headerCells.length - 1] === '') headerCells.pop();

  // Map column indices to dag keys
  const dagMap = {};
  const dagPatterns = {
    ma: /maandag|monday/i,
    di: /dinsdag|tuesday/i,
    wo: /woensdag|wednesday/i,
    do: /donderdag|thursday/i,
    vr: /vrijdag|friday/i,
    za: /zaterdag|saturday/i,
    zo: /zondag|sunday/i,
  };

  for (let col = 1; col < headerCells.length; col++) {
    for (const [dag, pattern] of Object.entries(dagPatterns)) {
      if (pattern.test(headerCells[col])) {
        dagMap[col] = dag;
        break;
      }
    }
  }

  // Skip separator row (|---|---|...)
  let dataStart = headerIdx + 1;
  if (lines[dataStart] && /^\|[\s\-|]+\|$/.test(lines[dataStart])) {
    dataStart++;
  }

  // Parse data rows
  const result = { ma: {}, di: {}, wo: {}, do: {}, vr: {}, za: {}, zo: {} };
  let maxUur = 0;

  for (let r = dataStart; r < lines.length; r++) {
    const line = lines[r];
    if (!line.startsWith('|')) continue;

    // Keep empty cells to preserve column positions!
    const cells = line.split('|').map(c => c.trim());
    if (cells[0] === '') cells.shift();
    if (cells[cells.length - 1] === '') cells.pop();

    const uur = parseInt(cells[0]);
    if (isNaN(uur)) continue;
    maxUur = Math.max(maxUur, uur);

    for (let col = 1; col < cells.length; col++) {
      const dag = dagMap[col];
      if (!dag) continue;

      const celText = cells[col].replace(/<br>/g, '\n').trim();
      if (!celText) continue;

      // First line is the vak code/name
      const rawCode = celText.split('\n')[0].trim();
      if (!rawCode) continue;

      // Check for [bezet] or [vrij] suffix from export
      const typeMatch = rawCode.match(/^(.+?)\s*\[(bezet|vrij)\]\s*$/i);
      if (typeMatch) {
        result[dag][uur] = { titel: typeMatch[1].trim(), type: typeMatch[2].toLowerCase() };
      } else {
        const { titel, type } = parseVakCode(rawCode);
        result[dag][uur] = { titel, type };
      }
    }
  }

  rooster.value = result;
  aantalUren.value = Math.max(8, maxUur);
  persist();
}
</script>

<style scoped>
.rooster-editor {
  max-width: 900px;
  position: relative;
}

.rooster-header h2 {
  margin: 0 0 0.25rem;
  font-size: 1.3rem;
}

.rooster-hint {
  margin: 0 0 1rem;
  font-size: 0.85rem;
  color: var(--clr-text-muted);
}

/* ---- Import ---- */

.import-strip {
  margin-bottom: 1rem;
}

.import-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 1rem;
  border: 1px dashed var(--clr-border);
  border-radius: var(--radius);
  background: var(--clr-surface);
  cursor: pointer;
  font-size: 0.85rem;
  color: var(--clr-text-muted);
  transition: all 0.15s;
}

.import-btn:hover {
  border-color: var(--clr-accent);
  color: var(--clr-accent);
  background: var(--clr-accent-light);
}

/* ---- Grid ---- */

.rooster-grid {
  display: grid;
  grid-template-columns: 3rem repeat(7, 1fr);
  border: 1px solid var(--clr-border);
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--clr-border);
  gap: 1px;
}

.grid-corner,
.grid-dag-header,
.grid-uur,
.grid-cel {
  background: var(--clr-surface);
  padding: 0.35rem 0.4rem;
  font-size: 0.8rem;
}

.grid-corner {
  font-weight: 700;
  font-size: 0.7rem;
  color: var(--clr-text-muted);
  text-transform: uppercase;
  display: flex;
  align-items: center;
  justify-content: center;
}

.grid-dag-header {
  font-weight: 700;
  font-size: 0.8rem;
  text-align: center;
  padding: 0.5rem;
  background: var(--clr-bg);
}

.grid-uur {
  font-weight: 700;
  font-size: 0.8rem;
  color: var(--clr-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--clr-bg);
}

/* Midday separator between uur 5 and 6 */
.grid-middag {
  border-top: 3px solid var(--clr-accent) !important;
}

/* ---- Cells ---- */

.grid-cel {
  cursor: pointer;
  min-height: 2.5rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.1rem;
  transition: all 0.1s;
  position: relative;
}

.grid-cel:hover {
  outline: 2px solid var(--clr-accent);
  outline-offset: -2px;
  z-index: 1;
}

.grid-cel[draggable="true"] {
  cursor: grab;
}

.grid-cel[draggable="true"]:active {
  cursor: grabbing;
}

.grid-cel-drag-over {
  outline: 2px dashed var(--clr-accent) !important;
  outline-offset: -2px;
  background: var(--clr-accent-light) !important;
  z-index: 2;
}

.grid-cel-drag-copy {
  outline-color: #059669 !important;
  background: #ecfdf5 !important;
}

.cel-drag-hint {
  position: absolute;
  bottom: 1px;
  right: 3px;
  font-size: 0.55rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--clr-accent);
  pointer-events: none;
}

.grid-cel-drag-copy .cel-drag-hint {
  color: #059669;
}

.grid-cel-actief {
  outline: 2px solid var(--clr-accent) !important;
  outline-offset: -2px;
  z-index: 2;
}

.grid-cel-leeg {
  background: var(--clr-surface);
}

.grid-cel-leeg:hover {
  background: var(--clr-accent-light);
}

.grid-cel-les {
  background: var(--clr-accent-light);
  border-left: 3px solid var(--clr-accent);
}

.grid-cel-bezet {
  background: #fef3c7;
  border-left: 3px solid var(--clr-bezig);
}

.grid-cel-vrij {
  background: #ecfdf5;
  border-left: 3px solid var(--clr-klaar);
}

.cel-label {
  font-weight: 600;
  font-size: 0.78rem;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cel-type {
  font-size: 0.65rem;
  color: var(--clr-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

/* ---- Uur controls ---- */

.uur-controls {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.uur-btn {
  padding: 0.3rem 0.75rem;
  border: 1px solid var(--clr-border);
  border-radius: 6px;
  background: var(--clr-surface);
  cursor: pointer;
  font-size: 0.8rem;
  color: var(--clr-text-muted);
  transition: all 0.15s;
}

.uur-btn:hover {
  border-color: var(--clr-accent);
  color: var(--clr-accent);
}

/* ---- Edit popup ---- */

.edit-popup {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--clr-surface);
  border: 1px solid var(--clr-border);
  border-radius: var(--radius);
  box-shadow: 0 8px 32px rgba(0,0,0,0.15);
  z-index: 100;
  min-width: 280px;
}

.edit-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  font-size: 0.85rem;
  font-weight: 600;
  border-bottom: 1px solid var(--clr-border);
  background: var(--clr-bg);
  border-radius: var(--radius) var(--radius) 0 0;
}

.edit-close {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  color: var(--clr-text-muted);
  padding: 0 0.25rem;
  line-height: 1;
}

.edit-close:hover {
  color: var(--clr-text);
}

.edit-body {
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.edit-body input[type="text"] {
  padding: 0.4rem 0.5rem;
  border: 1px solid var(--clr-border);
  border-radius: 6px;
  font-size: 0.9rem;
  background: var(--clr-surface);
  color: var(--clr-text);
  width: 100%;
}

.edit-body input:focus {
  outline: none;
  border-color: var(--clr-accent);
  box-shadow: 0 0 0 2px var(--clr-accent-light);
}

/* ---- Type buttons ---- */

.type-knoppen {
  display: flex;
  gap: 0.35rem;
}

.type-knop {
  flex: 1;
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--clr-border);
  border-radius: 6px;
  background: var(--clr-surface);
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--clr-text-muted);
  transition: all 0.15s;
  text-align: center;
}

.type-knop:hover {
  border-color: var(--clr-accent);
}

.type-les.active {
  background: var(--clr-accent);
  color: white;
  border-color: var(--clr-accent);
}

.type-bezet.active {
  background: var(--clr-bezig);
  color: white;
  border-color: var(--clr-bezig);
}

.type-vrij.active {
  background: var(--clr-klaar);
  color: white;
  border-color: var(--clr-klaar);
}

/* ---- Actions ---- */

.edit-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-save {
  flex: 1;
  padding: 0.4rem 1rem;
  border: none;
  border-radius: 6px;
  background: var(--clr-accent);
  color: white;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-save:hover {
  opacity: 0.85;
}

.btn-wis {
  padding: 0.4rem 0.75rem;
  border: 1px solid var(--clr-border);
  border-radius: 6px;
  background: var(--clr-surface);
  color: #ef4444;
  font-size: 0.85rem;
  cursor: pointer;
}

.btn-wis:hover {
  border-color: #ef4444;
  background: #fef2f2;
}

/* ---- Responsive ---- */

@media (max-width: 600px) {
  .grid-dag-header {
    font-size: 0.7rem;
    padding: 0.4rem 0.2rem;
  }

  .cel-label {
    font-size: 0.7rem;
  }

  .cel-type {
    display: none;
  }

  .grid-cel {
    padding: 0.25rem;
  }
}
</style>
