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
          <template v-if="kolom.compact">
            <div
              v-for="taak in vakKolomTaken(vak.naam, kolom.status)"
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
                  <div class="flags">
                    <span v-for="flag in taak.flags" :key="flag" class="flag">{{ flag }}</span>
                  </div>
                </div>
              </div>
            </div>
          </template>
          <template v-else>
            <div
              v-for="taak in vakKolomTaken(vak.naam, kolom.status)"
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
            </div>
          </template>
        </div>
      </template>
    </template>
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
const dragOverCel = ref(null);
const draggingTaak = ref(null);
const confettiCanvas = ref(null);
const expandedKaarten = reactive({});
const openVakken = reactive({});

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

// All unique vakken, sorted alphabetically
const vakken = computed(() => {
  const map = new Map();
  for (const taak of gefilterdeTaken.value) {
    const vak = taak.vak || '';
    if (!map.has(vak)) map.set(vak, []);
    map.get(vak).push(taak);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([naam, taken]) => ({ naam, taken }));
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

function vakMinuten(taken) {
  return taken.reduce((sum, t) => {
    if (t.tijd?.type === 'minuten') return sum + t.tijd.minuten;
    return sum;
  }, 0);
}

function vakKolomTaken(vakNaam, status) {
  return gefilterdeTaken.value
    .filter((t) => (t.vak || '') === vakNaam && t.voortgang.status === status)
    .sort(basisSort);
}

function isVakOpen(vakNaam) {
  return openVakken[vakNaam] === true; // collapsed by default
}

function toggleVak(vakNaam) {
  openVakken[vakNaam] = !openVakken[vakNaam];
}

const allesOpen = computed(() => {
  return vakken.value.length > 0 && vakken.value.every((v) => openVakken[v.naam]);
});

function toggleAlles() {
  const open = !allesOpen.value;
  for (const vak of vakken.value) {
    openVakken[vak.naam] = open;
  }
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
  dragOverCel.value = null;
}

function dragEnterCel(vak, status) {
  dragOverCel.value = vak + '_' + status;
}

function dragLeaveCel(e, vak, status) {
  if (!e.currentTarget.contains(e.relatedTarget)) {
    const key = vak + '_' + status;
    if (dragOverCel.value === key) dragOverCel.value = null;
  }
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
</script>

<style scoped>
.kanban-toolbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

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
  background: var(--clr-accent-light);
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
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.4;
  color: var(--clr-text);
}

/* Duration badge */
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
