<template>
  <div
    class="kanban-kaart"
    :class="[
      hoofdgroepClass(taak),
      dragRelatedClass,
      {
        'is-rooster-les': isRoosterLes,
        'is-rooster': taak.tijd?.type === 'rooster' && !isRoosterLes,
        'is-klaar': taak.voortgang?.status === 'klaar' || taak.voortgang?.status === 'ingediend',
        'is-overdue': isOverdue,
        'is-selected': isSelected,
        dragging: isDragging,
        compact: compact,
        expanded: compact && isExpanded,
      }
    ]"
    :draggable="draggable"
    @dragstart="$emit('dragstart', $event, taak)"
    @dragend="$emit('dragend', $event)"
    @click="$emit('click', taak)"
    @dblclick="$emit('dblclick', taak)"
  >
    <!-- Compact card (klaar/ingediend in kanban) -->
    <template v-if="compact">
      <div class="kaart-compact-row">
        <span v-if="taak.code" class="code">{{ taak.code }}</span>
        <span v-if="keten" class="kaart-keten" :title="ketenTooltipText">
          <template v-for="(stap, si) in keten" :key="stap.id">
            <span class="keten-stap" :class="[ketenStapKleur(stap, taak), { 'keten-eigen': stap.id === taak.id }]">{{ stap.volgorde }}</span>
            <span v-if="si < keten.length - 1" class="keten-pijl">&rarr;</span>
          </template>
        </span>
        <span class="kaart-duur" :title="duurTooltipText">{{ duurText }}</span>
      </div>
      <div v-if="isExpanded" class="kaart-expand">
        <p class="kaart-tekst">{{ taak.omschrijving || '(geen omschrijving)' }}</p>
        <div class="kaart-meta">
          <div class="flags">
            <span v-for="flag in taak.flags" :key="flag" class="flag" :title="flagTooltip(flag)">{{ flag }}</span>
          </div>
        </div>
      </div>
    </template>

    <!-- Full card -->
    <template v-else>
      <div class="kaart-top">
        <button
          class="kaart-check-btn"
          :class="{ checked: taak.voortgang?.status === 'klaar' || taak.voortgang?.status === 'ingediend' }"
          :title="taak.voortgang?.status === 'klaar' ? 'Markeer als open' : 'Markeer als klaar'"
          @click.stop="$emit('toggle-klaar', taak)"
        >&#10003;</button>
        <span v-if="taak.code" class="code">{{ taak.code }}</span>
        <span v-if="keten" class="kaart-keten" :title="ketenTooltipText">
          <template v-for="(stap, si) in keten" :key="stap.id">
            <span class="keten-stap" :class="[ketenStapKleur(stap, taak), { 'keten-eigen': stap.id === taak.id }]">{{ stap.volgorde }}</span>
            <span v-if="si < keten.length - 1" class="keten-pijl">&rarr;</span>
          </template>
        </span>
        <div class="flags">
          <span v-for="flag in taak.flags" :key="flag" class="flag" :title="flagTooltip(flag)">{{ flag }}</span>
        </div>
        <span class="kaart-duur prominent" :title="duurTooltipText">{{ duurText }}</span>
      </div>
      <p class="kaart-tekst">{{ taak.omschrijving || '(geen omschrijving)' }}</p>
      <span v-if="geplandLabel" class="kaart-gepland">{{ geplandLabel }}</span>
    </template>
  </div>
</template>

<script setup>
import { hoofdgroepClass, flagTooltip } from '../composables/useTakenLogic.js';

const props = defineProps({
  taak: { type: Object, required: true },
  compact: { type: Boolean, default: false },
  isExpanded: { type: Boolean, default: false },
  isDragging: { type: Boolean, default: false },
  draggable: { type: Boolean, default: true },
  dragRelatedClass: { type: String, default: '' },
  keten: { type: Array, default: null },
  ketenTooltipText: { type: String, default: '' },
  ketenStapKleur: { type: Function, default: () => 'keten-grijs' },
  duurText: { type: String, default: '' },
  duurTooltipText: { type: String, default: '' },
  geplandLabel: { type: String, default: '' },
  isOverdue: { type: Boolean, default: false },
  isRoosterLes: { type: Boolean, default: false },
  isSelected: { type: Boolean, default: false },
});

defineEmits(['dragstart', 'dragend', 'click', 'dblclick', 'toggle-klaar']);
</script>

<style scoped>
/* ---- Kanban Card (full) ---- */
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
.kanban-kaart:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.12); }
.kanban-kaart.dragging { opacity: 0.5; transform: rotate(1deg); }
.kanban-kaart.is-klaar { opacity: 0.6; }
.kanban-kaart.is-klaar .kaart-tekst,
.kanban-kaart.is-klaar .code,
.kanban-kaart.is-klaar .kaart-compact-row .code { text-decoration: line-through; }

.kanban-kaart.is-selected {
  outline: 2px solid var(--clr-accent, #6366f1);
  outline-offset: -1px;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
  z-index: 1;
}

.kanban-kaart.is-overdue { border-left-color: #ef4444 !important; background: #fef2f2; }
.kanban-kaart.is-overdue .kaart-gepland { color: #ef4444; font-weight: 700; }

/* Type border colors */
.kanban-kaart.is-rooster-les { border-left-color: #d97706; }
.kanban-kaart.is-rooster { border-left-color: #eab308; }
.kanban-kaart:not(.is-rooster):not(.is-rooster-les) { border-left-color: #3b82f6; }

/* ---- Top row ---- */
.kaart-top {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.3rem;
}
.kaart-top .flags { margin-left: auto; display: flex; gap: 0.25rem; }

.code { font-size: 0.8rem; font-weight: 700; color: var(--clr-accent); }

.kaart-tekst {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.4;
  color: var(--clr-text);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ---- Check button ---- */
.kaart-check-btn {
  width: 16px; height: 16px;
  border: 1.5px solid var(--clr-border);
  border-radius: 3px;
  background: white;
  color: transparent;
  font-size: 0.6rem; font-weight: 900;
  display: inline-flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  cursor: pointer;
  padding: 0;
  transition: all 0.15s;
}
.kaart-check-btn:hover { border-color: #059669; color: #059669; background: #ecfdf5; }
.kaart-check-btn.checked { background: #059669; border-color: #059669; color: white; }

/* ---- Planned label ---- */
.kaart-gepland {
  font-size: 0.7rem;
  color: var(--clr-text-muted);
  font-variant-numeric: tabular-nums;
}

/* ---- Duration badge ---- */
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

/* ---- Flags ---- */
.flags { display: flex; gap: 0.2rem; }
.flag {
  font-size: 0.6rem;
  font-weight: 700;
  background: #fef3c7;
  color: #92400e;
  padding: 0.05rem 0.25rem;
  border-radius: 3px;
}

/* ---- Dependency chain ---- */
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
  background: #1e1e1e;
  color: #fff;
  font-weight: 900;
}
.keten-grijs { background: var(--clr-bg); color: var(--clr-text-muted); }
.keten-groen { background: #ecfdf5; color: #059669; }
.keten-oranje { background: #fffbeb; color: #d97706; }
.keten-rood { background: #fef2f2; color: #dc2626; }
.keten-pijl { color: var(--clr-text-muted); opacity: 0.4; font-size: 0.55rem; }

/* ---- Compact card (klaar/ingediend) ---- */
.kanban-kaart.compact { padding: 0.35rem 0.6rem; cursor: pointer; }
.kaart-compact-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
}
.kanban-kaart.compact .code { font-size: 0.8rem; }
.kanban-kaart.compact .kaart-duur { font-size: 0.8rem; font-weight: 700; }

.kaart-expand {
  margin-top: 0.35rem;
  padding-top: 0.35rem;
  border-top: 1px solid var(--clr-border);
}
.kaart-expand .kaart-tekst { font-size: 0.8rem; margin-bottom: 0.25rem; }
.kaart-meta { display: flex; align-items: center; gap: 0.5rem; }

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
</style>
