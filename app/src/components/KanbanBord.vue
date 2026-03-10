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
              :class="[hoofdgroepClass(taak), dragRelatedClass(taak), { 'is-rooster': taak.tijd?.type === 'rooster', expanded: expandedKaarten[taak.id] }]"
              :data-taak-id="taak.id"
              :draggable="!isReadOnly"
              @dragstart="!isReadOnly && dragStart($event, taak)"
              @dragend="dragEnd"
              @click="toggleKaart(taak.id)"
              @dblclick.stop="!isReadOnly && openEdit(taak)"
            >
              <div class="kaart-compact-row">
                <span v-if="taak.code" class="code">{{ taak.code }}</span>
                <span v-if="taakKeten(taak)" class="kaart-keten" :title="ketenTooltip(taak)">
                  <template v-for="(stap, si) in taakKeten(taak)" :key="stap.id">
                    <span class="keten-stap" :class="[ketenStapKleur(stap, taak), { 'keten-eigen': stap.id === taak.id }]">{{ stap.volgorde }}</span>
                    <span v-if="si < taakKeten(taak).length - 1" class="keten-pijl">→</span>
                  </template>
                </span>
                <span class="kaart-duur" :title="duurTooltip(taak)">{{ formatDuur(taak) }}</span>
              </div>
              <div v-if="expandedKaarten[taak.id]" class="kaart-expand">
                <p class="kaart-tekst">{{ taak.omschrijving || '(geen omschrijving)' }}</p>
                <div class="kaart-meta">
                  <div class="flags">
                    <span v-for="flag in taak.flags" :key="flag" class="flag" :title="flagTooltip(flag)">{{ flag }}</span>
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
              :class="[hoofdgroepClass(taak), dragRelatedClass(taak), { 'is-rooster': taak.tijd?.type === 'rooster' }]"
              :data-taak-id="taak.id"
              :draggable="!isReadOnly"
              @dragstart="!isReadOnly && dragStart($event, taak)"
              @dragend="dragEnd"
              @dblclick="!isReadOnly && openEdit(taak)"
            >
              <div class="kaart-top">
                <span v-if="taak.code" class="code">{{ taak.code }}</span>
                <span v-if="taakKeten(taak)" class="kaart-keten" :title="ketenTooltip(taak)">
                  <template v-for="(stap, si) in taakKeten(taak)" :key="stap.id">
                    <span class="keten-stap" :class="[ketenStapKleur(stap, taak), { 'keten-eigen': stap.id === taak.id }]">{{ stap.volgorde }}</span>
                    <span v-if="si < taakKeten(taak).length - 1" class="keten-pijl">→</span>
                  </template>
                </span>
                <div class="flags">
                  <span v-for="flag in taak.flags" :key="flag" class="flag" :title="flagTooltip(flag)">{{ flag }}</span>
                </div>
                <span class="kaart-duur prominent" :title="duurTooltip(taak)">{{ formatDuur(taak) }}</span>
              </div>
              <p class="kaart-tekst">{{ taak.omschrijving || '(geen omschrijving)' }}</p>
            </div>
          </template>
        </div>
      </template>
    </template>

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
import { ref, reactive, computed } from 'vue';
import { usePlanner } from '../stores/planner.js';

const { alleTaken, updateVoortgang, editTaak, isReadOnly } = usePlanner();

const verbergRooster = ref(false);
const verbergHuistaken = ref(false);
const dragOverCel = ref(null);
const dragOverStatus = ref(null);
const draggingTaak = ref(null);
const confettiCanvas = ref(null);
const expandedKaarten = reactive({});
const openVakken = reactive({});
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

const flagTooltips = {
  P: 'Inleveren op papier',
  M: 'Materiaal meebrengen',
  U: 'Uitgestelde deadline',
  G: 'Groepswerk',
};

function flagTooltip(flag) {
  return flagTooltips[flag] || flag;
}

function formatDuur(taak) {
  if (!taak.tijd) return '';
  if (taak.tijd.type === 'rooster') return 'R';
  if (taak.tijd.type === 'minuten') return `${taak.tijd.minuten}'`;
  return '';
}

function duurTooltip(taak) {
  if (!taak.tijd) return '';
  if (taak.tijd.type === 'rooster') return 'Roosteruur';
  if (taak.tijd.type === 'minuten') return `${taak.tijd.minuten} minuten`;
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
  return openVakken[vakNaam] !== false; // expanded by default
}

function toggleVak(vakNaam) {
  openVakken[vakNaam] = !openVakken[vakNaam];
}

const allesOpen = computed(() => {
  return vakken.value.length > 0 && vakken.value.every((v) => openVakken[v.naam] !== false);
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

// ---- Volgtijdelijkheid ----

// Per vak: meerdere ketens van taken met volgorde
// Ketens worden gesplitst wanneer de nummering reset (1,2,1,2 = twee ketens)
const volgordeKetens = computed(() => {
  const result = []; // array van ketens (elke keten is een array van taken)
  for (const vak of vakken.value) {
    const metVolgorde = [...vak.taken]
      .filter(t => typeof t.volgorde === 'number')
      .sort((a, b) => (a.origIndex ?? 0) - (b.origIndex ?? 0)); // fysieke volgorde

    if (metVolgorde.length < 2) continue;

    // Split in ketens: als volgorde-nummer niet stijgt, start een nieuwe keten
    let huidigeKeten = [metVolgorde[0]];
    for (let i = 1; i < metVolgorde.length; i++) {
      if (metVolgorde[i].volgorde > metVolgorde[i - 1].volgorde) {
        huidigeKeten.push(metVolgorde[i]);
      } else {
        if (huidigeKeten.length > 1) result.push(huidigeKeten);
        huidigeKeten = [metVolgorde[i]];
      }
    }
    if (huidigeKeten.length > 1) result.push(huidigeKeten);
  }
  return result;
});

// Lookup: taak-id → set van gerelateerde taak-ids (hele keten)
const relatedIds = computed(() => {
  const lookup = new Map();
  for (const keten of volgordeKetens.value) {
    const ids = keten.map(t => t.id);
    for (const id of ids) {
      lookup.set(id, new Set(ids));
    }
  }
  return lookup;
});

// Lookup: taak-id → voorganger (de taak die eerst klaar moet zijn)
const voorgangerMap = computed(() => {
  const map = new Map();
  for (const keten of volgordeKetens.value) {
    for (let i = 1; i < keten.length; i++) {
      map.set(keten[i].id, keten[i - 1]);
    }
  }
  return map;
});

// Per taak-id → de keten waar die in zit (of null)
const taakKetenMap = computed(() => {
  const map = new Map();
  for (const keten of volgordeKetens.value) {
    for (const t of keten) {
      map.set(t.id, keten);
    }
  }
  return map;
});

function taakKeten(taak) {
  return taakKetenMap.value.get(taak.id) || null;
}

function ketenTooltip(taak) {
  const keten = taakKeten(taak);
  if (!keten) return '';
  const stappen = keten.map(t => t.code || `#${t.volgorde}`).join(' → ');
  return `Volgorde: ${stappen}`;
}

const statusRank = { open: 0, bezig: 1, klaar: 2, ingediend: 3 };

// Effectieve status: houdt rekening met actieve drag
function effectieveStatus(stap) {
  if (draggingTaak.value?.id === stap.id && dragOverStatus.value) {
    return dragOverStatus.value;
  }
  return stap.voortgang.status;
}

// Kleur per stap op basis van relatie met voorganger
function ketenStapKleur(stap, kaart) {
  if (stap.id !== kaart.id) return 'keten-grijs';
  const keten = taakKetenMap.value.get(stap.id);
  if (!keten) return 'keten-grijs';
  const idx = keten.findIndex(t => t.id === stap.id);

  const status = effectieveStatus(stap);
  const rank = statusRank[status] ?? 0;

  // Niet gestart → grijs
  if (rank === 0) return 'keten-grijs';
  // Eerste stap, gestart → altijd ok
  if (idx === 0) return 'keten-groen';

  const voorganger = keten[idx - 1];
  const vStatus = effectieveStatus(voorganger);
  const vRank = statusRank[vStatus] ?? 0;

  // Voorganger is strikt verder → groen (geen conflict)
  if (vRank > rank) return 'keten-groen';
  // Beiden in dezelfde fase: alleen oranje als ze allebei bezig zijn
  if (vRank === rank) return rank === 1 ? 'keten-oranje' : 'keten-groen';
  // Taak staat verder dan voorganger → rood (conflict)
  return 'keten-rood';
}

function isRelatedToDrag(taakId) {
  if (!draggingTaak.value) return false;
  const related = relatedIds.value.get(draggingTaak.value.id);
  return related?.has(taakId) && taakId !== draggingTaak.value.id;
}

function isVoorgangerKlaar(taakId) {
  const voorganger = voorgangerMap.value.get(taakId);
  if (!voorganger) return true;
  return voorganger.voortgang.status === 'klaar' || voorganger.voortgang.status === 'ingediend';
}

function dragRelatedClass(taak) {
  if (!isRelatedToDrag(taak.id)) return '';
  // Check of de drag een conflict veroorzaakt in de keten
  const keten = taakKetenMap.value.get(taak.id);
  if (!keten) return 'drag-related-ok';
  // Kijk of er ergens in de keten een conflict is
  let worstLevel = 0; // 0=ok, 1=oranje, 2=rood
  for (let i = 1; i < keten.length; i++) {
    const kleur = ketenStapKleur(keten[i], keten[i]);
    if (kleur === 'keten-rood') worstLevel = 2;
    else if (kleur === 'keten-oranje' && worstLevel < 2) worstLevel = 1;
  }
  if (worstLevel === 2) return 'drag-related-conflict';
  if (worstLevel === 1) return 'drag-related-warn';
  return 'drag-related-ok';
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

/* ---- Sequentie-ketting op kaart ---- */

.kaart-keten {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  font-size: 0.65rem;
  font-weight: 700;
}

.keten-stap {
  width: 1.2rem;
  height: 1.2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  background: var(--clr-bg);
  color: var(--clr-text-muted);
  font-variant-numeric: tabular-nums;
}

.keten-stap.keten-eigen {
  outline: 2px solid currentColor;
  outline-offset: -1px;
  font-weight: 900;
}

.keten-grijs {
  background: var(--clr-bg);
  color: var(--clr-text-muted);
}

.keten-groen {
  background: #ecfdf5;
  color: #059669;
}

.keten-oranje {
  background: #fffbeb;
  color: #d97706;
}

.keten-rood {
  background: #fef2f2;
  color: #dc2626;
}

.keten-pijl {
  color: var(--clr-text-muted);
  opacity: 0.4;
  font-size: 0.55rem;
}

/* ---- Drag highlights ---- */

.kanban-kaart.drag-related-ok {
  outline: 3px solid #10b981;
  outline-offset: -1px;
  background: #ecfdf5 !important;
  animation: drag-pulse-ok 0.7s ease-in-out infinite;
  transform: scale(1.02);
}

.kanban-kaart.drag-related-warn {
  outline: 3px solid #d97706;
  outline-offset: -1px;
  background: #fffbeb !important;
  animation: drag-pulse-warn 0.7s ease-in-out infinite;
  transform: scale(1.02);
}

.kanban-kaart.drag-related-conflict {
  outline: 3px solid #ef4444;
  outline-offset: -1px;
  background: #fef2f2 !important;
  animation: drag-pulse-conflict 0.7s ease-in-out infinite;
  transform: scale(1.02);
}

@keyframes drag-pulse-ok {
  0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
  50% { box-shadow: 0 0 12px 4px rgba(16, 185, 129, 0.4); }
}

@keyframes drag-pulse-warn {
  0%, 100% { box-shadow: 0 0 0 0 rgba(217, 119, 6, 0.4); }
  50% { box-shadow: 0 0 12px 4px rgba(217, 119, 6, 0.4); }
}

@keyframes drag-pulse-conflict {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
  50% { box-shadow: 0 0 12px 4px rgba(239, 68, 68, 0.4); }
}

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
  opacity: 0.5;
  transform: rotate(1deg);
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
