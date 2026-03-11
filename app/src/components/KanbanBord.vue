<template>
  <div class="kanban-toolbar">
    <button class="btn-expand" @click="toggleAlles" :title="allesOpen ? 'Alles dichtklappen' : 'Alles openklappen'">
      <span class="expand-icon" :class="{ open: allesOpen }">+</span>
    </button>
    <div class="segmented-group">
      <button
        :class="{ on: !verbergRooster }"
        @click="verbergRooster = !verbergRooster"
      >Rooster</button>
      <button
        :class="{ on: !verbergHuistaken }"
        @click="verbergHuistaken = !verbergHuistaken"
      >Huistaken</button>
    </div>
    <div class="segmented-group">
      <button :class="{ on: kanbanFilter === 'all' }" @click="kanbanFilter = 'all'">Alle</button>
      <button :class="{ on: kanbanFilter === 'overdue' }" @click="kanbanFilter = 'overdue'">Achterstand</button>
      <button :class="{ on: kanbanFilter === 'today' }" @click="kanbanFilter = 'today'">Vandaag</button>
    </div>
    <div class="kb-legenda">
      <span class="kb-legenda-item" data-tip="Roostertaak (tijdens de les)"><span class="kb-legenda-swatch rooster-les"></span>R</span>
      <span class="kb-legenda-item" data-tip="Roostertaak (zelfstandig)"><span class="kb-legenda-swatch rooster"></span>Z</span>
      <span class="kb-legenda-item" data-tip="Huistaak"><span class="kb-legenda-swatch huistaak"></span>H</span>
      <span class="kb-legenda-sep"></span>
      <span class="kb-legenda-item" data-tip="Volgorde OK"><span class="kb-legenda-dot groen"></span></span>
      <span class="kb-legenda-item" data-tip="Voorganger niet ingepland"><span class="kb-legenda-dot oranje"></span></span>
      <span class="kb-legenda-item" data-tip="Volgorde-conflict"><span class="kb-legenda-dot rood"></span></span>
    </div>
  </div>

  <div class="kanban-grid">
    <!-- Sticky column headers -->
    <div
      v-for="kolom in kolommen"
      :key="'h-' + kolom.status"
      class="kolom-header"
      :class="`kolom-${kolom.status}`"
    >
      <h3>{{ kolom.label }}</h3>
      <span class="kolom-count">{{ kolomTaken(kolom.status).length }}</span>
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
          v-for="kolom in kolommen"
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
            :compact="kolom.compact"
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
        <span v-for="f in detailTaak.flags" :key="f" class="flag" :title="flagTooltip(f)">{{ f }}</span>
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

  <!-- Edit modal -->
  <div v-if="editingTaak" class="edit-overlay" @click.self="editingTaak = null">
    <div class="edit-modal">
      <h3>Taak bewerken</h3>
      <label>
        <span>Code</span>
        <input v-model="editForm.code" />
      </label>
      <label>
        <span>Vak</span>
        <input v-model="editForm.vak" />
      </label>
      <label>
        <span>Omschrijving</span>
        <textarea v-model="editForm.omschrijving" rows="3"></textarea>
      </label>
      <label>
        <span>Duur (minuten)</span>
        <input v-model.number="editForm.minuten" type="number" min="0" />
      </label>
      <div class="edit-actions">
        <button class="btn-save" @click="saveEdit">Opslaan</button>
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

const { alleTaken, updateVoortgang, editTaak, isReadOnly, selectedTaakId, selectTaak } = usePlanner();

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

const verbergRooster = ref(false);
const verbergHuistaken = ref(false);
const kanbanFilter = ref('all');
const dragOverCel = ref(null);
const dragOverStatus = ref(null);
const draggingTaak = ref(null);
const confettiCanvas = ref(null);
const expandedKaarten = reactive({});
const detailTaak = ref(null);
const editingTaak = ref(null);
const editForm = reactive({ code: '', vak: '', omschrijving: '', minuten: 0 });

const kolommen = [
  { status: 'open', label: 'Open', compact: false },
  { status: 'bezig', label: 'Bezig', compact: false },
  { status: 'klaar', label: 'Klaar', compact: true },
  { status: 'ingediend', label: 'Ingediend', compact: true },
];

const gefilterdeTaken = computed(() => {
  let taken = alleTaken.value;
  if (verbergRooster.value) {
    taken = taken.filter((t) => t.tijd?.type !== 'rooster');
  }
  if (verbergHuistaken.value) {
    taken = taken.filter((t) => t.tijd?.type === 'rooster');
  }
  if (kanbanFilter.value === 'overdue') {
    taken = taken.filter(t => isOverdue(t));
  } else if (kanbanFilter.value === 'today') {
    taken = taken.filter(t => isVandaag(t));
  }
  return taken;
});

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
  if (kolom.compact) openDetail(taak);
}

function openDetail(taak) {
  detailTaak.value = taak;
}

// ---- Edit ----

function openEdit(taak) {
  editingTaak.value = taak;
  editForm.code = taak.code || '';
  editForm.vak = taak.vak || '';
  editForm.omschrijving = taak.omschrijving || '';
  editForm.minuten = taak.tijd?.type === 'minuten' ? taak.tijd.minuten : 0;
}

async function saveEdit() {
  if (!editingTaak.value) return;
  await editTaak(editingTaak.value.id, {
    code: editForm.code,
    vak: editForm.vak,
    omschrijving: editForm.omschrijving,
    minuten: editForm.minuten || null,
  });
  editingTaak.value = null;
}

// ---- Drag & Drop ----

function dragStart(e, taak) {
  draggingTaak.value = taak;
  e.dataTransfer.effectAllowed = 'move';
  e.target.classList.add('dragging');
}

function dragEnd(e) {
  e.target.classList.remove('dragging');
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

function drop(e, status) {
  dragOverCel.value = null;
  if (!draggingTaak.value) return;
  const taak = draggingTaak.value;
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

const { taakKetenMap, taakKeten, ketenTooltip, relatedIds } = useVolgordeKetens(vakken);

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
.kanban-toolbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

/* Legend */
.kb-legenda {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--clr-text-muted);
  margin-left: auto;
}
.kb-legenda-item {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  cursor: default;
  position: relative;
}
.kb-legenda-item[data-tip]:hover::after {
  content: attr(data-tip);
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  background: var(--clr-text);
  color: var(--clr-surface);
  font-size: 0.6rem;
  font-weight: 500;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  z-index: 100;
  margin-top: 4px;
  pointer-events: none;
}
.kb-legenda-swatch {
  width: 3px;
  height: 12px;
  border-radius: 1px;
}
.kb-legenda-swatch.rooster-les { background: #d97706; }
.kb-legenda-swatch.rooster { background: #eab308; }
.kb-legenda-swatch.huistaak { background: #3b82f6; }
.kb-legenda-sep {
  width: 1px;
  height: 10px;
  background: var(--clr-border);
}
.kb-legenda-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.kb-legenda-dot.groen { background: #059669; }
.kb-legenda-dot.oranje { background: #d97706; }
.kb-legenda-dot.rood { background: #dc2626; }

/* Segmented toggle */

.segmented-group {
  display: flex;
  border: 1px solid var(--clr-border);
  border-radius: var(--radius);
  overflow: hidden;
}

.segmented-group button {
  background: var(--clr-bg);
  border: none;
  border-right: 1px solid var(--clr-border);
  padding: 0.4rem 0.8rem;
  font-size: 0.85rem;
  cursor: pointer;
  color: var(--clr-text-muted);
  transition: all 0.15s;
  font-weight: 500;
}

.segmented-group button:last-child {
  border-right: none;
}

.segmented-group button.on {
  background: var(--clr-accent);
  color: white;
}

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
  font-size: 1.1rem;
  font-weight: 700;
  line-height: 1;
  color: var(--clr-text-muted);
  transition: transform 0.2s;
}

.expand-icon.open {
  transform: rotate(45deg);
}

/* ---- Grid layout ---- */

.kanban-grid {
  display: grid;
  grid-template-columns: 2fr 2fr 1fr 1fr;
  gap: 0;
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
.kolom-klaar .kolom-minuten { color: var(--clr-klaar); }
.kolom-ingediend .kolom-minuten { color: var(--clr-accent); }

.kolom-open { border-bottom-color: var(--clr-todo); }
.kolom-bezig { border-bottom-color: var(--clr-bezig); }
.kolom-klaar { border-bottom-color: var(--clr-klaar); }
.kolom-ingediend { border-bottom-color: var(--clr-accent); }

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
.mini-klaar { color: var(--clr-klaar); }
.mini-ingediend { color: var(--clr-accent); }

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
    grid-template-columns: 1fr 1fr 1fr 1fr;
  }
}

@media (max-width: 600px) {
  .kanban-grid {
    grid-template-columns: 1fr 1fr;
  }
  .vak-rij-header {
    grid-column: 1 / -1;
  }
}
</style>
