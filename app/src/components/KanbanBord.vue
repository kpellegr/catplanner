<template>
  <FilterBar :ongepland-count="ongeplandCount" :vandaag-count="vandaagCount" :overdue-count="overdueCount" :in-te-dienen-count="inTeDienenCount" :conflict-count="conflictCount">
    <template #expand>
      <button class="btn-expand" @click="toggleAlles" :title="allesOpen ? 'Alles dichtklappen' : 'Alles openklappen'">
        <span class="expand-icon" :class="{ open: allesOpen }">&#9656;</span>
      </button>
    </template>
  </FilterBar>

  <div class="kanban-grid" :style="{ gridTemplateColumns: gridCols }">
    <!-- Sticky column headers -->
    <div
      v-for="(kolom, ki) in kolommen"
      :key="'h-' + kolom.status"
      class="kolom-header"
      :class="[`kolom-${kolom.status}`, { 'kolom-focus': focusKolomIdx !== null && isFocusPair(ki) }]"
      @click="focusKolom(ki)"
    >
      <h3>{{ kolom.label }}</h3>
      <span class="kolom-count">{{ kolomTaken(kolom.status).length }}</span>
      <button v-if="kolom.status === 'open' && !isReadOnly" class="kolom-add-btn" @click.stop="openAdd" title="Eigen taak toevoegen">
        <Icon icon="mdi:plus" width="14" height="14" />
      </button>
      <span class="kolom-minuten">{{ kolomMinuten(kolom.status) }}'</span>
    </div>

    <!-- Per vak: header row + content row -->
    <template v-for="vak in vakken" :key="vak.naam">
      <!-- Vak header spanning all columns -->
      <button
        class="vak-rij-header"
        @click="toggleVak(vak.naam)"
      >
        <span class="vak-chevron" :class="{ open: isVakOpen(vak.naam) }">&#9656;</span>
        <span class="vak-naam">{{ vak.naam || 'Overig' }}</span>
        <span class="vak-samenvatting">{{ vak.taken.length }} taken, {{ vakMinuten(vak.taken) }} min</span>
        <!-- Mini stats per kolom when collapsed -->
        <span v-if="!isVakOpen(vak.naam)" class="vak-mini-stats">
          <span
            v-for="kolom in kolommen"
            :key="kolom.status"
            class="vak-mini-stat"
            :class="`mini-${kolom.status}`"
          >{{ vakKolomTaken(vak.naam, kolom.status).length }}</span>
        </span>
      </button>

      <!-- Expanded: 4 cells -->
      <template v-if="isVakOpen(vak.naam)">
        <div
          v-for="(kolom, ki) in kolommen"
          :key="vak.naam + '-' + kolom.status"
          class="vak-cel"
          :class="[
            `cel-${kolom.status}`,
            { 'drag-over': dragOverCel === vak.naam + '_' + kolom.status }
          ]"
          @dragover.prevent
          @dragenter.prevent="dragEnterCel(vak.naam, kolom.status)"
          @dragleave="dragLeaveCel($event, vak.naam, kolom.status)"
          @drop="drop($event, kolom.status)"
        >
          <div v-if="dragOverCel === vak.naam + '_' + kolom.status" class="drop-icon-overlay">
            <Icon icon="mdi:target" width="28" height="28" />
          </div>
          <TaakKaart
            v-for="taak in vakKolomTaken(vak.naam, kolom.status)"
            :key="taak.id"
            :taak="taak"
            :compact="isKolomCompact(ki)"
            :is-expanded="!!expandedKaarten[taak.id]"
            :draggable="!isReadOnly"
            :is-dragging="draggingTaak?.id === taak.id"
            :drag-related-class="dragRelatedClass(taak)"
            :keten="taakKeten(taak)"
            :keten-tooltip-text="ketenTooltip(taak)"
            :keten-stap-kleur="ketenStapKleur"
            :duur-text="formatDuur(taak)"
            :duur-tooltip-text="duurTooltip(taak)"
            :gepland-label="geplandLabel(taak)"
            :is-overdue="isOverdue(taak)"
            @dragstart="(e) => !isReadOnly && dragStart(e, taak)"
            @dragend="dragEnd"
            :is-selected="selectedTaakId === taak.id"
            @click="onKaartClick(taak, kolom)"
            @dblclick="!isReadOnly && openEdit(taak)"
            @toggle-klaar="toggleKlaar"
            @cycle-status="cycleStatus"
          />
        </div>
      </template>
    </template>

  </div>

  <!-- Detail popup (compact card click) -->
  <div v-if="detailTaak" class="edit-overlay" @click.self="detailTaak = null">
    <div class="detail-popup">
      <div class="detail-top">
        <span v-if="detailTaak.code" class="code">{{ detailTaak.code }}</span>
        <span class="detail-vak">{{ detailTaak.vak }}</span>
        <span class="kaart-duur prominent">{{ formatDuur(detailTaak) }}</span>
        <button class="detail-close" @click="detailTaak = null">&times;</button>
      </div>
      <p class="detail-tekst">{{ detailTaak.omschrijving || '(geen omschrijving)' }}</p>
      <div v-if="detailTaak.flags?.length" class="detail-flags">
        <span v-for="f in detailTaak.flags" :key="f" class="flag" :data-tooltip="flagTooltip(f)">{{ f }}</span>
      </div>
      <div v-if="geplandLabel(detailTaak)" class="detail-gepland">Gepland: {{ geplandLabel(detailTaak) }}</div>
      <div class="detail-actions">
        <button class="btn-klaar" :class="{ checked: detailTaak.voortgang.status === 'klaar' }" @click="toggleKlaar(detailTaak); detailTaak = null">
          {{ detailTaak.voortgang.status === 'klaar' || detailTaak.voortgang.status === 'ingediend' ? 'Markeer als open' : 'Markeer als klaar' }}
        </button>
        <button v-if="!isReadOnly" @click="openEdit(detailTaak); detailTaak = null">Bewerken</button>
      </div>
    </div>
  </div>

  <!-- Unified edit/add modal -->
  <div v-if="editingTaak" class="edit-overlay" @click.self="editingTaak = null">
    <div class="edit-modal">
      <h3>{{ editingTaak.isNew ? 'Nieuwe taak' : 'Taak bewerken' }}</h3>
      <label>
        <span>Vak / categorie</span>
        <input v-model="editForm.vak" placeholder="bv. Persoonlijk, Piano, Sport..." @input="autoSuggestCode" />
      </label>
      <label>
        <span>Code</span>
        <input v-model="editForm.code" :placeholder="suggestedCode || ''" @input="codeIsAutoGenerated = false" />
      </label>
      <label>
        <span>Omschrijving</span>
        <textarea v-model="editForm.omschrijving" rows="3" placeholder="Wat moet je doen?" ref="editInput"></textarea>
      </label>
      <label>
        <span>Duur (minuten)</span>
        <input v-model.number="editForm.minuten" type="number" min="0" placeholder="bv. 30" />
      </label>
      <div class="edit-actions">
        <button v-if="editingTaak.bron === 'eigen' && !editingTaak.isNew" class="btn-delete" @click="doDelete">Verwijderen</button>
        <button class="btn-save" @click="saveEdit" :disabled="!editForm.omschrijving.trim()">
          {{ editingTaak.isNew ? 'Toevoegen' : 'Opslaan' }}
        </button>
        <button @click="editingTaak = null">Annuleer</button>
      </div>
    </div>
  </div>

  <!-- Confetti canvas -->
  <canvas ref="confettiCanvas" class="confetti-canvas"></canvas>
</template>

<script setup>
import { ref, reactive, computed, onMounted, nextTick } from 'vue';
import { Icon } from '@iconify/vue';
import { usePlanner } from '../stores/planner.js';
import { hoofdgroepClass, formatDuur, duurTooltip, flagTooltip, flagTooltips, useVakGroepen, useVolgordeKetens, useDragRelated } from '../composables/useTakenLogic.js';
import TaakKaart from './TaakKaart.vue';
import FilterBar from './FilterBar.vue';

const { alleTaken, updateVoortgang, editTaak, addEigenTaak, removeEigenTaak, editEigenTaak, isReadOnly, selectedTaakId, selectTaak, filters } = usePlanner();

onMounted(() => {
  if (selectedTaakId.value) {
    nextTick(() => {
      const el = document.querySelector('.kanban-kaart.is-selected');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }
});

// ---- Date awareness ----
const dagen = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
const now = new Date();
const jsDay = now.getDay();
const dagMap = [6, 0, 1, 2, 3, 4, 5];
const vandaagDag = dagen[dagMap[jsDay]] || null;

function isOverdue(taak) {
  if (!taak.geplandOp) return false;
  if (taak.voortgang.status === 'klaar' || taak.voortgang.status === 'ingediend') return false;
  return dagen.indexOf(taak.geplandOp) < dagen.indexOf(vandaagDag);
}

function isVandaag(taak) {
  return taak.geplandOp === vandaagDag;
}

const dagKort = { ma: 'MA', di: 'DI', wo: 'WO', do: 'DO', vr: 'VR', za: 'ZA', zo: 'ZO' };

function blokToTijd(blok) {
  const min = blok * 15 + 8 * 60 + 30;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

function geplandLabel(taak) {
  if (!taak.geplandOp) return '';
  const dag = dagKort[taak.geplandOp] || taak.geplandOp;
  if (taak.geplandBlok != null) return `${dag} ${blokToTijd(taak.geplandBlok)}`;
  return dag;
}

// Local kanban-specific state (filter logic now uses global filters)
const dragOverCel = ref(null);
const dragOverStatus = ref(null);
const draggingTaak = ref(null);
const confettiCanvas = ref(null);
const expandedKaarten = reactive({});
const detailTaak = ref(null);
const editingTaak = ref(null);
const editForm = reactive({ code: '', vak: '', omschrijving: '', minuten: 0 });

// ---- Column focus (wide/narrow) ----
const focusKolomIdx = ref(null); // null = default layout

const gridCols = computed(() => {
  if (focusKolomIdx.value === null) return '2fr 2fr 1fr 1fr';
  const idx = focusKolomIdx.value;
  // Two broad columns: the focused one and its neighbor
  let pairIdx;
  if (idx >= kolommen.length - 1) {
    // Last column: pair with previous
    pairIdx = idx - 1;
  } else {
    pairIdx = idx + 1;
  }
  return kolommen.map((_, i) => (i === idx || i === pairIdx) ? '3fr' : '1fr').join(' ');
});

function focusKolom(idx) {
  focusKolomIdx.value = focusKolomIdx.value === idx ? null : idx;
}

function isFocusPair(idx) {
  if (focusKolomIdx.value === null) return false;
  const fi = focusKolomIdx.value;
  const pairIdx = fi >= kolommen.length - 1 ? fi - 1 : fi + 1;
  return idx === fi || idx === pairIdx;
}

function isKolomCompact(idx) {
  if (focusKolomIdx.value === null) return kolommen[idx].compact;
  return !isFocusPair(idx);
}

const kolommen = [
  { status: 'open', label: 'Open', compact: false },
  { status: 'bezig', label: 'Bezig', compact: false },
  { status: 'klaar', label: 'Klaar', compact: true },
  { status: 'ingediend', label: 'Ingediend', compact: true },
];

const gefilterdeTaken = computed(() => {
  return alleTaken.value.filter(taak => {
    // Type filter
    const isRooster = taak.tijd?.type === 'rooster';
    if (isRooster && !filters.rooster) return false;
    if (!isRooster && !filters.huistaken) return false;

    // Ongepland drill-down
    if (filters.alleenOngepland && taak.geplandOp) return false;

    // Vandaag drill-down
    if (filters.vandaag && !isVandaag(taak)) return false;

    // Status filter
    const status = taak.voortgang?.status || 'open';
    const gepland = !!taak.geplandOp;
    if (status === 'ingediend' && !filters.ingediend) return false;
    if (status === 'klaar' && !filters.klaar) return false;
    if ((status === 'open' || status === 'bezig') && gepland && !filters.gepland) return false;
    if ((status === 'open' || status === 'bezig') && !gepland && !filters.ongepland) return false;

    // Warning drill-down
    const anyWarning = filters.overdue || filters.inTeDienen || filters.conflict;
    if (anyWarning) {
      let matchesWarning = false;
      if (filters.overdue && isOverdue(taak)) matchesWarning = true;
      if (filters.inTeDienen && status === 'klaar') matchesWarning = true;
      if (filters.conflict) {
        // Show task if it's red OR if any task in its chain is red
        const keten = taakKetenMap.value.get(taak.id);
        if (keten && keten.some(t => ketenStapKleur(t) === 'keten-rood')) matchesWarning = true;
      }
      if (!matchesWarning) return false;
    }

    return true;
  });
});

// Filter counts for FilterBar chips
const ongeplandCount = computed(() => alleTaken.value.filter(t => !t.geplandOp).length);
const vandaagCount = computed(() => alleTaken.value.filter(t => isVandaag(t)).length);
const overdueCount = computed(() => alleTaken.value.filter(t => isOverdue(t)).length);
const inTeDienenCount = computed(() => alleTaken.value.filter(t => t.voortgang?.status === 'klaar').length);
const conflictCount = computed(() => alleTaken.value.filter(t => ketenStapKleur(t) === 'keten-rood').length);

const totaalMinuten = computed(() => {
  return gefilterdeTaken.value.reduce((sum, t) => {
    if (t.tijd?.type === 'minuten') return sum + t.tijd.minuten;
    return sum;
  }, 0);
});

// All unique vakken, sorted alphabetically — via composable
const { vakken, isVakOpen, toggleVak, allesOpen, toggleAlles, vakMinuten } = useVakGroepen(gefilterdeTaken);

function basisSort(a, b) {
  const codeA = (a.code || '').toUpperCase();
  const codeB = (b.code || '').toUpperCase();
  if (codeA !== codeB) return codeA.localeCompare(codeB);
  return (a.volgorde || 0) - (b.volgorde || 0);
}

function kolomTaken(status) {
  return gefilterdeTaken.value.filter((t) => t.voortgang.status === status);
}

function kolomMinuten(status) {
  return kolomTaken(status).reduce((sum, t) => {
    if (t.tijd?.type === 'minuten') return sum + t.tijd.minuten;
    return sum;
  }, 0);
}

function vakKolomTaken(vakNaam, status) {
  return gefilterdeTaken.value
    .filter((t) => (t.vak || '') === vakNaam && t.voortgang.status === status)
    .sort(basisSort);
}

function toggleKaart(id) {
  expandedKaarten[id] = !expandedKaarten[id];
}

function onKaartClick(taak, kolom) {
  selectTaak(taak.id);
  const ki = kolommen.indexOf(kolom);
  if (ki >= 0 && focusKolomIdx.value !== ki) focusKolom(ki);
  if (kolom.compact) openDetail(taak);
}

function openDetail(taak) {
  detailTaak.value = taak;
}

// ---- Edit / Add ----
const editInput = ref(null);
const suggestedCode = ref('');
const codeIsAutoGenerated = ref(false);

function generateCode(vak) {
  if (!vak || !vak.trim()) return '';
  const prefix = vak.trim().slice(0, 2).toUpperCase();
  const count = alleTaken.value.filter(t => (t.vak || '').toLowerCase() === vak.trim().toLowerCase()).length;
  return `${prefix} ${count + 1}`;
}

function autoSuggestCode() {
  if (!editingTaak.value?.isNew) return;
  const suggestion = generateCode(editForm.vak);
  suggestedCode.value = suggestion;
  if (codeIsAutoGenerated.value) {
    editForm.code = suggestion;
  }
}

function openAdd() {
  editingTaak.value = { isNew: true, bron: 'eigen' };
  editForm.code = '';
  editForm.vak = 'Persoonlijk';
  editForm.omschrijving = '';
  editForm.minuten = null;
  codeIsAutoGenerated.value = true;
  nextTick(() => {
    autoSuggestCode();
    editInput.value?.focus();
  });
}

function openEdit(taak) {
  editingTaak.value = taak;
  editForm.code = taak.code || '';
  editForm.vak = taak.vak || '';
  editForm.omschrijving = taak.omschrijving || '';
  editForm.minuten = taak.tijd?.type === 'minuten' ? taak.tijd.minuten : 0;
  codeIsAutoGenerated.value = false;
  suggestedCode.value = '';
  nextTick(() => editInput.value?.focus());
}

async function saveEdit() {
  if (!editingTaak.value) return;
  if (editingTaak.value.isNew) {
    // Add new eigen taak
    await addEigenTaak({
      omschrijving: editForm.omschrijving.trim(),
      duur: editForm.minuten || null,
      vak: editForm.vak.trim() || 'Persoonlijk',
      code: editForm.code.trim() || '',
    });
  } else if (editingTaak.value.bron === 'eigen') {
    // Edit existing eigen taak
    await editEigenTaak(editingTaak.value.id, {
      code: editForm.code.trim(),
      vak: editForm.vak.trim() || 'Persoonlijk',
      omschrijving: editForm.omschrijving.trim(),
      duur: editForm.minuten || null,
    });
  } else {
    // Edit studiewijzer taak
    await editTaak(editingTaak.value.id, {
      code: editForm.code,
      vak: editForm.vak,
      omschrijving: editForm.omschrijving,
      minuten: editForm.minuten || null,
    });
  }
  editingTaak.value = null;
}

async function doDelete() {
  if (!editingTaak.value?.id) return;
  await removeEigenTaak(editingTaak.value.id);
  editingTaak.value = null;
}

// ---- Drag & Drop ----

function dragStart(e, taak) {
  draggingTaak.value = taak;
  e.dataTransfer.effectAllowed = 'move';
}

function dragEnd() {
  draggingTaak.value = null;
  dragOverCel.value = null;
  dragOverStatus.value = null;
}

function dragEnterCel(vak, status) {
  dragOverCel.value = vak + '_' + status;
  dragOverStatus.value = status;
}

function dragLeaveCel(e, vak, status) {
  if (!e.currentTarget.contains(e.relatedTarget)) {
    const key = vak + '_' + status;
    if (dragOverCel.value === key) dragOverCel.value = null;
  }
}

function toggleKlaar(taak) {
  const isKlaar = taak.voortgang.status === 'klaar' || taak.voortgang.status === 'ingediend';
  const newStatus = isKlaar ? 'open' : 'klaar';
  updateVoortgang(taak.id, { status: newStatus });
  if (newStatus === 'klaar') fireConfetti();
}

function cycleStatus(taak, newStatus) {
  updateVoortgang(taak.id, { status: newStatus });
  if (newStatus === 'klaar' || newStatus === 'ingediend') fireConfetti();
}

function drop(e, status) {
  dragOverCel.value = null;
  if (!draggingTaak.value) return;
  const taak = draggingTaak.value;
  draggingTaak.value = null;
  dragOverStatus.value = null;
  if (taak.voortgang.status === status) return;

  updateVoortgang(taak.id, { status });

  if (status === 'klaar' || status === 'ingediend') {
    fireConfetti();
  }
}

// ---- Confetti ----

function fireConfetti() {
  const canvas = confettiCanvas.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.display = 'block';

  const colors = ['#10b981', '#f59e0b', '#4f46e5', '#ef4444', '#ec4899', '#8b5cf6', '#06b6d4'];
  const particles = [];
  for (let i = 0; i < 80; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: -10 - Math.random() * 40,
      w: 6 + Math.random() * 6,
      h: 4 + Math.random() * 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 6,
      vy: 2 + Math.random() * 4,
      rot: Math.random() * Math.PI * 2,
      rv: (Math.random() - 0.5) * 0.2,
      life: 1,
    });
  }

  let frame;
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    for (const p of particles) {
      p.x += p.vx;
      p.vy += 0.1;
      p.y += p.vy;
      p.rot += p.rv;
      p.life -= 0.008;
      if (p.life <= 0) continue;
      alive = true;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (alive) {
      frame = requestAnimationFrame(animate);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.style.display = 'none';
      cancelAnimationFrame(frame);
    }
  }
  animate();
}

// ---- Volgtijdelijkheid — via composable ----
// Use ALL tasks for chain computation, not just filtered ones,
// so conflict detection stays stable regardless of active filters
const alleVakken = computed(() => {
  const map = new Map();
  for (const taak of alleTaken.value) {
    const vak = taak.vak || '';
    if (!map.has(vak)) map.set(vak, []);
    map.get(vak).push(taak);
  }
  return Array.from(map.entries()).map(([naam, taken]) => ({ naam, taken }));
});

const { taakKetenMap, taakKeten, ketenTooltip, relatedIds } = useVolgordeKetens(alleVakken);

const statusRank = { open: 0, bezig: 1, klaar: 2, ingediend: 3 };

// Effectieve status: houdt rekening met actieve drag
function effectieveStatus(stap) {
  if (draggingTaak.value?.id === stap.id && dragOverStatus.value) {
    return dragOverStatus.value;
  }
  return stap.voortgang.status;
}

// Kleur per stap op basis van relatie met voorganger
// Colors ALL steps in the chain (not just the card's own step)
function ketenStapKleur(stap) {
  const keten = taakKetenMap.value.get(stap.id);
  if (!keten) return 'keten-grijs';
  const idx = keten.findIndex(t => t.id === stap.id);

  const status = effectieveStatus(stap);
  const rank = statusRank[status] ?? 0;

  if (rank === 0) return 'keten-grijs';
  if (idx === 0) return 'keten-groen';

  const voorganger = keten[idx - 1];
  const vStatus = effectieveStatus(voorganger);
  const vRank = statusRank[vStatus] ?? 0;

  if (vRank > rank) return 'keten-groen';
  if (vRank === rank) return rank === 1 ? 'keten-oranje' : 'keten-groen';
  return 'keten-rood';
}

const { dragRelatedClass } = useDragRelated(draggingTaak, relatedIds, taakKetenMap, ketenStapKleur);
</script>

<style scoped>
/* Expand/collapse +/- button */

.btn-expand {
  width: 2rem;
  height: 2rem;
  border: 1px solid var(--clr-border);
  border-radius: var(--radius);
  background: var(--clr-surface);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: all 0.15s;
}

.btn-expand:hover {
  border-color: var(--clr-accent);
  background: var(--clr-accent-light);
}

.expand-icon {
  font-size: 0.85rem;
  font-weight: 700;
  line-height: 1;
  color: var(--clr-text-muted);
  transition: transform 0.2s;
}

.expand-icon.open {
  transform: rotate(90deg);
}

/* ---- Grid layout ---- */

.kanban-grid {
  display: grid;
  gap: 0;
  transition: grid-template-columns 0.25s ease;
}

/* ---- Column headers (sticky) ---- */

.kolom-header {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  padding: 0.6rem 0.75rem;
  background: var(--clr-surface);
  border-bottom: 2px solid var(--clr-border);
  position: sticky;
  top: 0;
  z-index: 10;
  cursor: pointer;
  transition: background 0.15s;
}
.kolom-header:hover {
  background: var(--clr-bg);
}

.kolom-header h3 {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 700;
}

.kolom-count {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--clr-text-muted);
}

.kolom-minuten {
  margin-left: auto;
  font-size: 1rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.kolom-open .kolom-minuten { color: var(--clr-todo); }
.kolom-bezig .kolom-minuten { color: var(--clr-bezig); }
.kolom-klaar .kolom-minuten { color: #7c3aed; }
.kolom-ingediend .kolom-minuten { color: #059669; }

.kolom-open { border-bottom-color: var(--clr-todo); }
.kolom-bezig { border-bottom-color: var(--clr-bezig); }
.kolom-klaar { border-bottom-color: #7c3aed; }
.kolom-ingediend { border-bottom-color: #059669; }

/* ---- Vak row header ---- */

.vak-rij-header {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--clr-surface);
  border: none;
  border-bottom: 1px solid var(--clr-border);
  border-top: 1px solid var(--clr-border);
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--clr-text);
  text-align: left;
  transition: background 0.1s;
}

.vak-rij-header:hover {
  background: var(--clr-bg);
}

.vak-chevron {
  font-size: 0.7rem;
  transition: transform 0.15s;
  color: var(--clr-text-muted);
}

.vak-chevron.open {
  transform: rotate(90deg);
}

.vak-naam {
  font-weight: 700;
}

.vak-samenvatting {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--clr-text-muted);
}

.vak-mini-stats {
  margin-left: auto;
  display: flex;
  gap: 0.35rem;
}

.vak-mini-stat {
  font-size: 0.7rem;
  font-weight: 700;
  width: 1.4rem;
  height: 1.4rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  background: var(--clr-bg);
}

.mini-open { color: var(--clr-todo); }
.mini-bezig { color: var(--clr-bezig); }
.mini-klaar { color: #7c3aed; }
.mini-ingediend { color: #059669; }

/* Chain and drag highlight CSS now in TaakKaart.vue */

/* ---- Vak cel (expanded content per kolom) ---- */

.vak-cel {
  padding: 0.4rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-height: 2.5rem;
  background: var(--clr-bg);
  border-bottom: 1px solid var(--clr-border);
  transition: background 0.15s;
}

.vak-cel:nth-child(4n+2) { /* open */
  border-right: 1px solid var(--clr-border);
}
.vak-cel:nth-child(4n+3) { /* bezig */
  border-right: 1px solid var(--clr-border);
}
.vak-cel:nth-child(4n) { /* klaar */
  border-right: 1px solid var(--clr-border);
}

.vak-cel.drag-over {
  outline: 2px dashed var(--clr-accent);
  outline-offset: -2px;
  border-radius: 6px;
  position: relative;
}
.drop-icon-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--clr-accent);
  opacity: 0.25;
  pointer-events: none;
  z-index: 0;
}

/* Card CSS now in TaakKaart.vue */

/* ---- Edit modal ---- */

.edit-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.edit-modal {
  background: var(--clr-surface);
  border-radius: var(--radius);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
  padding: 1.25rem;
  width: 400px;
  max-width: 90vw;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.edit-modal h3 {
  margin: 0;
  font-size: 1rem;
}

.edit-modal label {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.edit-modal label span {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--clr-text-muted);
}

.edit-modal input,
.edit-modal textarea {
  font-size: 0.9rem;
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--clr-border);
  border-radius: 6px;
  font-family: inherit;
  resize: vertical;
}

.edit-modal input:focus,
.edit-modal textarea:focus {
  outline: none;
  border-color: var(--clr-accent);
  box-shadow: 0 0 0 2px var(--clr-accent-light);
}

.edit-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  margin-top: 0.25rem;
}

.edit-actions button {
  padding: 0.4rem 0.8rem;
  border: 1px solid var(--clr-border);
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
  background: var(--clr-surface);
  color: var(--clr-text-muted);
}

.edit-actions .btn-save {
  background: var(--clr-accent);
  color: white;
  border-color: var(--clr-accent);
  font-weight: 600;
}

/* ---- Detail popup ---- */
.detail-popup {
  background: var(--clr-surface);
  border-radius: var(--radius);
  padding: 1.25rem;
  width: min(360px, 90vw);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.detail-top {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.detail-top .code { font-size: 1rem; }
.detail-vak {
  font-size: 0.8rem;
  color: var(--clr-text-muted);
  flex: 1;
}
.detail-close {
  background: none; border: none; cursor: pointer;
  font-size: 1.2rem; color: var(--clr-text-muted); padding: 0 0.25rem;
}
.detail-close:hover { color: var(--clr-text); }
.detail-tekst {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.5;
  color: var(--clr-text);
}
.detail-flags { display: flex; gap: 0.25rem; }
.detail-gepland {
  font-size: 0.8rem;
  color: var(--clr-text-muted);
}
.detail-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.25rem;
}
.detail-actions button {
  padding: 0.4rem 0.8rem;
  border: 1px solid var(--clr-border);
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
  background: var(--clr-surface);
  color: var(--clr-text-muted);
}
.detail-actions .btn-klaar {
  background: #059669;
  color: white;
  border-color: #059669;
  font-weight: 600;
}
.detail-actions .btn-klaar.checked {
  background: var(--clr-surface);
  color: var(--clr-text-muted);
  border-color: var(--clr-border);
}

/* ---- Add task button in column header ---- */
.kolom-add-btn {
  width: 1.4rem;
  height: 1.4rem;
  border: 1px solid var(--clr-border);
  border-radius: 4px;
  background: var(--clr-surface);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  align-self: center;
  padding: 0;
  color: var(--clr-text-muted);
  transition: all 0.15s;
  flex-shrink: 0;
}
.kolom-add-btn:hover {
  border-color: var(--clr-accent);
  color: var(--clr-accent);
  background: var(--clr-accent-light);
}

/* ---- Delete button ---- */
.btn-delete {
  background: #fef2f2 !important;
  color: #ef4444 !important;
  border-color: #fecaca !important;
  margin-right: auto;
}
.btn-delete:hover {
  background: #fee2e2 !important;
  border-color: #ef4444 !important;
}

/* ---- Confetti ---- */

.confetti-canvas {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  z-index: 9999;
  display: none;
}

/* ---- Responsive ---- */

@media (max-width: 900px) {
  .kanban-grid {
    grid-template-columns: 1fr 1fr 1fr 1fr !important;
  }
}

@media (max-width: 600px) {
  .kanban-grid {
    grid-template-columns: 1fr 1fr !important;
  }
  .vak-rij-header {
    grid-column: 1 / -1;
  }
}
</style>
