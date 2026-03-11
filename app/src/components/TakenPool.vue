<template>
  <div
    class="taken-pool"
    :class="{ 'pool-headerless': headerless }"
    :style="{ width: currentWidth + 'px' }"
    @dragover.prevent
    @dragenter.prevent="$emit('dragenter', $event)"
    @dragleave="$emit('dragleave', $event)"
    @drop="$emit('drop', $event)"
  >
    <!-- Header (hidden in headerless mode — parent renders its own) -->
    <template v-if="!headerless">
      <div class="pool-header">
        <span class="pool-titel">{{ titel }}</span>
        <span class="pool-count">{{ taken.length }} · {{ totalMinuten }}'</span>
        <div class="pool-actions">
          <slot name="header-actions"></slot>
        </div>
      </div>

      <!-- Extra (e.g. selectedVak chip) -->
      <slot name="header-extra"></slot>
    </template>

    <!-- Task list grouped by vak -->
    <div class="pool-taken" :class="{ 'drag-over': isDragOver }">
      <div v-if="isDragOver" class="drop-icon-overlay">
        <Icon icon="mdi:target" width="32" height="32" />
      </div>
      <template v-for="groep in groepen" :key="groep.naam">
        <button class="vak-rij-header" @click="toggleVak(groep.naam)">
          <span class="vak-chevron" :class="{ open: isVakOpen(groep.naam) }">&#9656;</span>
          <span class="vak-naam">{{ groep.naam || 'Overig' }}</span>
          <span class="vak-samenvatting">{{ groep.taken.length }} · {{ vakMinuten(groep.taken) }}'</span>
        </button>
        <template v-if="isVakOpen(groep.naam)">
          <TaakKaart
            v-for="taak in groep.taken"
            :key="taak.id"
            :data-taak-id="taak.id"
            :class="{ 'is-selected': selectedTaakId === taak.id }"
            :taak="taak"
            :draggable="!readOnly"
            :is-dragging="draggingTaakId === taak.id"
            :drag-related-class="dragRelatedClassFn(taak)"
            :keten="taakKeten(taak)"
            :keten-tooltip-text="ketenTooltip(taak)"
            :keten-stap-kleur="ketenStapKleur"
            :duur-text="formatDuurFn(taak)"
            :duur-tooltip-text="duurTooltipFn(taak)"
            :gepland-label="geplandLabelFn(taak)"
            :is-rooster-les="isRoosterLesFn(taak)"
            @dragstart="$emit('card-dragstart', $event, taak)"
            @dragend="$emit('card-dragend', $event)"
            @click="$emit('card-click', taak)"
            @dblclick="$emit('card-dblclick', taak)"
            @toggle-klaar="$emit('card-toggle-klaar', taak)"
          />
        </template>
      </template>
      <div v-if="!taken.length" class="pool-leeg">
        <slot name="empty">Geen taken</slot>
      </div>
    </div>

    <!-- Resize handle -->
    <div
      v-if="resizable"
      class="pool-resize-handle"
      @mousedown.prevent="onResizeStart"
    ></div>
  </div>
</template>

<script setup>
import { ref, computed, onUnmounted } from 'vue';
import { Icon } from '@iconify/vue';
import { useVakGroepen } from '../composables/useTakenLogic.js';
import TaakKaart from './TaakKaart.vue';

const props = defineProps({
  taken: { type: Array, required: true },
  titel: { type: String, default: 'Taken' },
  width: { type: Number, default: 280 },
  resizable: { type: Boolean, default: true },
  headerless: { type: Boolean, default: false },
  readOnly: { type: Boolean, default: false },
  isDragOver: { type: Boolean, default: false },
  selectedTaakId: { type: String, default: null },
  draggingTaakId: { type: String, default: null },
  // Chain functions (provided by parent)
  taakKeten: { type: Function, default: () => null },
  ketenTooltip: { type: Function, default: () => '' },
  ketenStapKleur: { type: Function, default: () => 'keten-grijs' },
  dragRelatedClassFn: { type: Function, default: () => '' },
  // Duration format functions (provided by parent)
  formatDuurFn: { type: Function, default: (t) => '' },
  duurTooltipFn: { type: Function, default: (t) => '' },
  // Planned label function (provided by parent)
  geplandLabelFn: { type: Function, default: () => '' },
  // Rooster-op-les check function (provided by parent)
  isRoosterLesFn: { type: Function, default: () => false },
});

const emit = defineEmits([
  'dragenter', 'dragleave', 'drop',
  'card-dragstart', 'card-dragend', 'card-dblclick', 'card-toggle-klaar',
  'resize',
]);

// Use shared vak grouping
const takenRef = computed(() => props.taken);
const { vakken: groepen, openVakken, isVakOpen, toggleVak, allesOpen, toggleAlles, vakMinuten } = useVakGroepen(takenRef);

const totalMinuten = computed(() => {
  return props.taken.reduce((sum, t) => (t.tijd?.type === 'minuten' ? sum + t.tijd.minuten : sum), 0);
});


// ---- Resize handle ----
const currentWidth = ref(props.width);
let resizeStartX = 0;
let resizeStartWidth = 0;

function onResizeStart(e) {
  resizeStartX = e.clientX;
  resizeStartWidth = currentWidth.value;
  document.addEventListener('mousemove', onResizeMove);
  document.addEventListener('mouseup', onResizeEnd);
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
}

function onResizeMove(e) {
  const dx = e.clientX - resizeStartX;
  currentWidth.value = Math.max(180, Math.min(500, resizeStartWidth + dx));
}

function onResizeEnd() {
  document.removeEventListener('mousemove', onResizeMove);
  document.removeEventListener('mouseup', onResizeEnd);
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  emit('resize', currentWidth.value);
}

onUnmounted(() => {
  document.removeEventListener('mousemove', onResizeMove);
  document.removeEventListener('mouseup', onResizeEnd);
});

defineExpose({ currentWidth, totalMinuten, allesOpen, toggleAlles, openVakken });
</script>

<style scoped>
.taken-pool {
  flex-shrink: 0;
  background: var(--clr-surface);
  border: 1px solid var(--clr-border);
  border-radius: var(--radius);
  position: sticky;
  top: 1rem;
  max-height: calc(100vh - 8rem);
  overflow-y: auto;
  /* For resize handle */
  position: relative;
}

.taken-pool.pool-headerless {
  border: none;
  border-right: 1px solid var(--clr-border);
  border-radius: 0;
  top: 0;
  position: relative;
  max-height: none;
  overflow-y: auto;
}

/* ---- Header ---- */
.pool-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.6rem 0.75rem 0.35rem;
  flex-wrap: wrap;
}
.pool-titel { font-weight: 700; font-size: 0.95rem; }
.pool-count { font-size: 0.75rem; color: var(--clr-text-muted); font-variant-numeric: tabular-nums; }
.pool-actions { margin-left: auto; display: flex; gap: 2px; }

/* ---- Filters ---- */
/* ---- Task list ---- */
.pool-taken {
  padding: 0 0.5rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-height: 60px;
  transition: background 0.15s;
}
.pool-taken.drag-over {
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
  opacity: 0.3;
  pointer-events: none;
  z-index: 0;
}

/* ---- Vak header ---- */
.vak-rij-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  padding: 0.4rem 0.25rem;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--clr-text);
  text-align: left;
  border-bottom: 1px solid var(--clr-border);
  transition: background 0.1s;
}
.vak-rij-header:hover { background: var(--clr-bg); }

.vak-chevron {
  font-size: 0.65rem;
  transition: transform 0.15s;
  color: var(--clr-text-muted);
  display: inline-block;
}
.vak-chevron.open { transform: rotate(90deg); }

.vak-naam { font-weight: 700; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.vak-samenvatting { font-size: 0.7rem; font-weight: 500; color: var(--clr-text-muted); white-space: nowrap; }

/* ---- Selected state ---- */
.is-selected {
  outline: 2px solid var(--clr-accent);
  outline-offset: -1px;
  background: var(--clr-accent-light) !important;
}

/* ---- Empty state ---- */
.pool-leeg {
  color: var(--clr-text-muted);
  font-size: 0.8rem;
  font-style: italic;
  padding: 1.5rem 0;
  text-align: center;
}

/* ---- Resize handle ---- */
.pool-resize-handle {
  position: absolute;
  top: 0;
  right: 0;
  width: 8px;
  height: 100%;
  cursor: col-resize;
  z-index: 10;
}
.pool-resize-handle::after {
  content: '⋮';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 0.9rem;
  color: var(--clr-border);
  line-height: 1;
  transition: color 0.15s;
}
.pool-resize-handle:hover::after,
.taken-pool:has(.pool-resize-handle:active)::after {
  color: var(--clr-accent);
}

/* ---- Responsive ---- */
@media (max-width: 900px) {
  .taken-pool { width: 100% !important; position: static; max-height: none; }
  .pool-resize-handle { display: none; }
}
</style>
