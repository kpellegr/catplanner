<template>
  <div class="kanban-toolbar">
    <div class="toolbar-links">
      <button
        :class="{ active: verbergRooster }"
        @click="verbergRooster = !verbergRooster"
      >
        Rooster
      </button>
      <button
        :class="{ active: verbergHuistaken }"
        @click="verbergHuistaken = !verbergHuistaken"
      >
        Huistaken
      </button>
    </div>
    <div class="toolbar-sort">
      <label>Groepeer:</label>
      <select v-model="sortering">
        <option value="standaard">Standaard</option>
        <option value="vak">Per vak</option>
        <option value="kort">Kortste eerst</option>
        <option value="lang">Langste eerst</option>
      </select>
    </div>
  </div>

  <div class="kanban-bord">
    <div
      v-for="kolom in kolommen"
      :key="kolom.status"
      class="kanban-kolom"
      :class="[`kolom-${kolom.status}`, { compact: kolom.compact }]"
      @dragover.prevent
      @dragenter.prevent="dragEnter($event, kolom.status)"
      @dragleave="dragLeave($event, kolom.status)"
      @drop="drop($event, kolom.status)"
    >
      <div class="kolom-header">
        <h3>{{ kolom.label }}</h3>
        <span class="kolom-stats">
          {{ kolomMinuten(kolom.status) }} / {{ totaalMinuten }}'
        </span>
        <span class="kolom-count">{{ kolomTaken(kolom.status).length }}</span>
      </div>

      <div
        class="kolom-body"
        :class="{ 'drag-over': dragOverKolom === kolom.status }"
      >
        <!-- Grouped by vak -->
        <template v-if="sortering === 'vak'">
          <div
            v-for="groep in kolomGroepen(kolom.status)"
            :key="groep.vak"
            class="vak-groep"
          >
            <button
              class="vak-groep-header"
              @click="toggleGroep(kolom.status, groep.vak)"
            >
              <span class="vak-groep-chevron" :class="{ open: isGroepOpen(kolom.status, groep.vak) }">&#9656;</span>
              <span class="vak-groep-naam">{{ groep.vak || 'Overig' }}</span>
              <span class="vak-groep-info">{{ groep.taken.length }} taken, {{ groepMinuten(groep.taken) }} min</span>
            </button>
            <div v-show="isGroepOpen(kolom.status, groep.vak)" class="vak-groep-body">
              <template v-if="kolom.compact">
                <div
                  v-for="taak in groep.taken"
                  :key="taak.id"
                  class="kanban-kaart compact"
                  :class="[hoofdgroepClass(taak), { 'is-rooster': taak.tijd?.type === 'rooster', expanded: expandedKaarten[taak.id] }]"
                  draggable="true"
                  @dragstart="dragStart($event, taak)"
                  @dragend="dragEnd"
                  @click="toggleKaart(taak.id)"
                >
                  <div class="kaart-compact-row">
                    <span v-if="taak.code" class="code">{{ taak.code }}</span>
                    <span class="kaart-duur">{{ formatDuur(taak) }}</span>
                  </div>
                  <div v-if="expandedKaarten[taak.id]" class="kaart-expand">
                    <p class="kaart-tekst">{{ taak.omschrijving || '(geen omschrijving)' }}</p>
                    <div class="kaart-meta">
                      <span v-if="taak.vak" class="kaart-vak">{{ taak.vak }}</span>
                      <div class="flags">
                        <span v-for="flag in taak.flags" :key="flag" class="flag">{{ flag }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
              <template v-else>
                <div
                  v-for="taak in groep.taken"
                  :key="taak.id"
                  class="kanban-kaart"
                  :class="[hoofdgroepClass(taak), { 'is-rooster': taak.tijd?.type === 'rooster' }]"
                  draggable="true"
                  @dragstart="dragStart($event, taak)"
                  @dragend="dragEnd"
                >
                  <div class="kaart-top">
                    <span v-if="taak.code" class="code">{{ taak.code }}</span>
                    <span v-if="taak.volgorde != null" class="volgorde">#{{ taak.volgorde }}</span>
                    <div class="flags">
                      <span v-for="flag in taak.flags" :key="flag" class="flag">{{ flag }}</span>
                    </div>
                    <span class="kaart-duur prominent">{{ formatDuur(taak) }}</span>
                  </div>
                  <p class="kaart-tekst">{{ taak.omschrijving || '(geen omschrijving)' }}</p>
                  <div class="kaart-bottom">
                    <span v-if="taak.vak" class="kaart-vak">{{ taak.vak }}</span>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </template>

        <!-- Flat list (no grouping) -->
        <template v-else>
          <template v-if="kolom.compact">
            <div
              v-for="taak in kolomTaken(kolom.status)"
              :key="taak.id"
              class="kanban-kaart compact"
              :class="[hoofdgroepClass(taak), { 'is-rooster': taak.tijd?.type === 'rooster', expanded: expandedKaarten[taak.id] }]"
              draggable="true"
              @dragstart="dragStart($event, taak)"
              @dragend="dragEnd"
              @click="toggleKaart(taak.id)"
            >
              <div class="kaart-compact-row">
                <span v-if="taak.code" class="code">{{ taak.code }}</span>
                <span class="kaart-duur">{{ formatDuur(taak) }}</span>
              </div>
              <div v-if="expandedKaarten[taak.id]" class="kaart-expand">
                <p class="kaart-tekst">{{ taak.omschrijving || '(geen omschrijving)' }}</p>
                <div class="kaart-meta">
                  <span v-if="taak.vak" class="kaart-vak">{{ taak.vak }}</span>
                  <div class="flags">
                    <span v-for="flag in taak.flags" :key="flag" class="flag">{{ flag }}</span>
                  </div>
                </div>
              </div>
            </div>
          </template>
          <template v-else>
            <div
              v-for="taak in kolomTaken(kolom.status)"
              :key="taak.id"
              class="kanban-kaart"
              :class="[hoofdgroepClass(taak), { 'is-rooster': taak.tijd?.type === 'rooster' }]"
              draggable="true"
              @dragstart="dragStart($event, taak)"
              @dragend="dragEnd"
            >
              <div class="kaart-top">
                <span v-if="taak.code" class="code">{{ taak.code }}</span>
                <span v-if="taak.volgorde != null" class="volgorde">#{{ taak.volgorde }}</span>
                <span class="kaart-duur prominent">{{ formatDuur(taak) }}</span>
                <div class="flags">
                  <span v-for="flag in taak.flags" :key="flag" class="flag">{{ flag }}</span>
                </div>
              </div>
              <p class="kaart-tekst">{{ taak.omschrijving || '(geen omschrijving)' }}</p>
              <div class="kaart-bottom">
                <span v-if="taak.vak" class="kaart-vak">{{ taak.vak }}</span>
              </div>
            </div>
          </template>
        </template>

        <div v-if="!kolomTaken(kolom.status).length" class="kolom-leeg">
          Sleep taken hierheen
        </div>
      </div>
    </div>
  </div>

  <!-- Confetti canvas -->
  <canvas ref="confettiCanvas" class="confetti-canvas"></canvas>
</template>

<script setup>
import { ref, reactive, computed } from 'vue';
import { usePlanner } from '../stores/planner.js';

const { alleTaken, updateVoortgang } = usePlanner();

const verbergRooster = ref(false);
const verbergHuistaken = ref(false);
const sortering = ref('vak');
const dragOverKolom = ref(null);
const draggingTaak = ref(null);
const confettiCanvas = ref(null);
const expandedKaarten = reactive({});
const collapsedGroepen = reactive({});

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
  return taken;
});

const totaalMinuten = computed(() => {
  return gefilterdeTaken.value.reduce((sum, t) => {
    if (t.tijd?.type === 'minuten') return sum + t.tijd.minuten;
    return sum;
  }, 0);
});

function formatDuur(taak) {
  if (!taak.tijd) return '';
  if (taak.tijd.type === 'rooster') return 'R';
  if (taak.tijd.type === 'minuten') {
    const m = taak.tijd.minuten;
    if (m >= 60) {
      const u = Math.floor(m / 60);
      const rest = m % 60;
      return rest ? `${u}u${rest}'` : `${u}u`;
    }
    return `${m}'`;
  }
  return '';
}

function kolomMinuten(status) {
  return kolomTaken(status).reduce((sum, t) => {
    if (t.tijd?.type === 'minuten') return sum + t.tijd.minuten;
    return sum;
  }, 0);
}

function groepMinuten(taken) {
  return taken.reduce((sum, t) => {
    if (t.tijd?.type === 'minuten') return sum + t.tijd.minuten;
    return sum;
  }, 0);
}

function basisSort(a, b) {
  const codeA = (a.code || '').toUpperCase();
  const codeB = (b.code || '').toUpperCase();
  if (codeA !== codeB) return codeA.localeCompare(codeB);
  return (a.volgorde || 0) - (b.volgorde || 0);
}

function sorteerTaken(taken) {
  const sorted = [...taken];
  switch (sortering.value) {
    case 'vak':
      sorted.sort(basisSort);
      break;
    case 'kort':
      sorted.sort((a, b) => (a.tijd?.minuten || 0) - (b.tijd?.minuten || 0) || basisSort(a, b));
      break;
    case 'lang':
      sorted.sort((a, b) => (b.tijd?.minuten || 0) - (a.tijd?.minuten || 0) || basisSort(a, b));
      break;
    default:
      sorted.sort(basisSort);
      break;
  }
  return sorted;
}

function kolomTaken(status) {
  return sorteerTaken(
    gefilterdeTaken.value.filter((t) => t.voortgang.status === status)
  );
}

function kolomGroepen(status) {
  const taken = kolomTaken(status);
  const map = new Map();
  for (const taak of taken) {
    const vak = taak.vak || '';
    if (!map.has(vak)) map.set(vak, []);
    map.get(vak).push(taak);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([vak, taken]) => ({ vak, taken }));
}

function groepKey(status, vak) {
  return `${status}_${vak}`;
}

function isGroepOpen(status, vak) {
  const key = groepKey(status, vak);
  return collapsedGroepen[key] === true; // collapsed by default
}

function toggleGroep(status, vak) {
  const key = groepKey(status, vak);
  collapsedGroepen[key] = !collapsedGroepen[key];
}

function toggleKaart(id) {
  expandedKaarten[id] = !expandedKaarten[id];
}

function hoofdgroepClass(taak) {
  const hg = (taak.hoofdgroep || '').toUpperCase();
  if (hg.includes('WETENSCHAP')) return 'hg-wetenschap';
  if (hg.includes('TALEN')) return 'hg-talen';
  if (hg.includes('WISKUNDE')) return 'hg-wiskunde';
  if (hg.includes('PROJECT')) return 'hg-project';
  return 'hg-algemeen';
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
  dragOverKolom.value = null;
}

function dragEnter(e, status) {
  dragOverKolom.value = status;
}

function dragLeave(e, status) {
  if (!e.currentTarget.contains(e.relatedTarget)) {
    if (dragOverKolom.value === status) dragOverKolom.value = null;
  }
}

function drop(e, status) {
  dragOverKolom.value = null;
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
</script>

<style scoped>
.kanban-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.toolbar-links button {
  background: var(--clr-surface);
  border: 1px solid var(--clr-border);
  border-radius: var(--radius);
  padding: 0.4rem 0.8rem;
  font-size: 0.85rem;
  cursor: pointer;
  color: var(--clr-text-muted);
  transition: all 0.15s;
}

.toolbar-links button.active {
  background: var(--clr-bg);
  color: var(--clr-text-muted);
  border-color: var(--clr-border);
  text-decoration: line-through;
  opacity: 0.6;
}

.toolbar-sort {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.toolbar-sort label {
  font-size: 0.85rem;
  color: var(--clr-text-muted);
}

.toolbar-sort select {
  font-size: 0.85rem;
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--clr-border);
  border-radius: var(--radius);
  background: var(--clr-surface);
  cursor: pointer;
}

/* ---- Kanban Grid ---- */

.kanban-bord {
  display: grid;
  grid-template-columns: 2fr 2fr 1fr 1fr;
  gap: 0.75rem;
  min-height: 60vh;
}

.kanban-kolom {
  background: var(--clr-bg);
  border-radius: var(--radius);
  border: 2px solid var(--clr-border);
  display: flex;
  flex-direction: column;
  min-height: 300px;
}

.kolom-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  border-bottom: 2px solid var(--clr-border);
}

.kolom-header h3 {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 700;
}

.kolom-stats {
  font-size: 0.75rem;
  color: var(--clr-text-muted);
  font-variant-numeric: tabular-nums;
}

.kolom-count {
  margin-left: auto;
  background: var(--clr-border);
  color: var(--clr-text-muted);
  font-size: 0.75rem;
  font-weight: 700;
  width: 1.5rem;
  height: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.kolom-open .kolom-header { border-bottom-color: var(--clr-todo); }
.kolom-bezig .kolom-header { border-bottom-color: var(--clr-bezig); }
.kolom-klaar .kolom-header { border-bottom-color: var(--clr-klaar); }
.kolom-ingediend .kolom-header { border-bottom-color: var(--clr-accent); }

.kolom-body {
  flex: 1;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  transition: background 0.15s;
  border-radius: 0 0 var(--radius) var(--radius);
  overflow-y: auto;
}

.kolom-body.drag-over {
  background: var(--clr-accent-light);
}

.kolom-leeg {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--clr-text-muted);
  font-size: 0.8rem;
  opacity: 0.5;
  min-height: 80px;
}

/* ---- Vak Groep ---- */

.vak-groep {
  margin-bottom: 0.25rem;
}

.vak-groep-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  background: none;
  border: none;
  padding: 0.35rem 0.25rem;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--clr-text);
  border-radius: 6px;
  transition: background 0.1s;
}

.vak-groep-header:hover {
  background: var(--clr-surface);
}

.vak-groep-chevron {
  font-size: 0.7rem;
  transition: transform 0.15s;
  color: var(--clr-text-muted);
}

.vak-groep-chevron.open {
  transform: rotate(90deg);
}

.vak-groep-naam {
  flex: 1;
  text-align: left;
}

.vak-groep-info {
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--clr-text-muted);
}

.vak-groep-body {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding-left: 0.25rem;
  margin-top: 0.25rem;
}

/* ---- Kanban Kaart (full) ---- */

.kanban-kaart {
  background: var(--clr-surface);
  border-radius: 8px;
  padding: 0.6rem 0.75rem;
  box-shadow: var(--shadow);
  border-left: 3px solid var(--clr-todo);
  cursor: grab;
  transition: box-shadow 0.15s, opacity 0.15s, transform 0.15s;
  user-select: none;
}

.kanban-kaart:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,0.12);
}

.kanban-kaart.dragging {
  opacity: 0.4;
  transform: rotate(2deg);
}

.kanban-kaart.hg-wetenschap { border-left-color: var(--clr-wetenschap); }
.kanban-kaart.hg-talen { border-left-color: var(--clr-talen); }
.kanban-kaart.hg-wiskunde { border-left-color: var(--clr-wiskunde); }
.kanban-kaart.hg-project { border-left-color: var(--clr-project); }

.kanban-kaart.is-rooster {
  border-left-style: dashed;
}

.kaart-top {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.3rem;
}

.kaart-top .flags {
  margin-left: auto;
  display: flex;
  gap: 0.25rem;
}

.kaart-tekst {
  margin: 0 0 0.35rem 0;
  font-size: 0.85rem;
  line-height: 1.4;
  color: var(--clr-text);
}

.kaart-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.25rem;
}

/* Duration badge - prominent */
.kaart-duur {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--clr-text-muted);
  background: var(--clr-bg);
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  font-variant-numeric: tabular-nums;
}

.kaart-duur.prominent {
  font-size: 0.85rem;
  background: var(--clr-accent-light);
  color: var(--clr-accent);
  padding: 0.15rem 0.5rem;
}

.kaart-vak {
  font-size: 0.7rem;
  color: var(--clr-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

/* ---- Compact kaart (klaar/ingediend) ---- */

.kanban-kaart.compact {
  padding: 0.35rem 0.6rem;
  cursor: pointer;
}

.kaart-compact-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
}

.kanban-kaart.compact .code {
  font-size: 0.8rem;
}

.kanban-kaart.compact .kaart-duur {
  font-size: 0.8rem;
  font-weight: 700;
}

.kaart-expand {
  margin-top: 0.35rem;
  padding-top: 0.35rem;
  border-top: 1px solid var(--clr-border);
}

.kaart-expand .kaart-tekst {
  font-size: 0.8rem;
  margin-bottom: 0.25rem;
}

.kaart-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
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
  .kanban-bord {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 500px) {
  .kanban-bord {
    grid-template-columns: 1fr;
  }
}
</style>
