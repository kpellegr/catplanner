<template>
  <div class="filter-bar">
    <!-- Expand/collapse (provided by parent via slot) -->
    <slot name="expand"></slot>

    <!-- Type filter: segmented H / R -->
    <div class="fb-segmented">
      <button
        :class="{ on: filters.huistaken }"
        @click="filters.huistaken = !filters.huistaken"
        title="Huistaken / zelfstandig"
      >H</button>
      <button
        :class="{ on: filters.rooster }"
        @click="filters.rooster = !filters.rooster"
        title="Roostertaken"
      >R</button>
    </div>

    <!-- Ongepland chip -->
    <button
      class="fb-chip fb-chip-ongepland"
      :class="{ on: filters.alleenOngepland }"
      @click="toggleChip('alleenOngepland')"
      title="Toon alleen ongeplande taken"
    >
      <Icon icon="mdi:calendar-remove-outline" width="13" height="13" />
      <span class="fb-chip-count">{{ ongeplandCount }}</span>
      <span class="fb-chip-label">ongepland</span>
    </button>

    <!-- Warning chips -->
    <button
      class="fb-chip fb-chip-overdue"
      :class="{ on: filters.overdue }"
      @click="toggleChip('overdue')"
      title="Overdue (niet klaar, gepland in verleden)"
    >
      <Icon icon="mdi:clock-alert-outline" width="13" height="13" />
      <span class="fb-chip-count">{{ overdueCount }}</span>
      <span class="fb-chip-label">overdue</span>
    </button>

    <button
      class="fb-chip fb-chip-intedienen"
      :class="{ on: filters.inTeDienen }"
      @click="toggleChip('inTeDienen')"
      title="In te dienen (klaar maar niet ingediend)"
    >
      <Icon icon="mdi:file-alert-outline" width="13" height="13" />
      <span class="fb-chip-count">{{ inTeDienenCount }}</span>
      <span class="fb-chip-label">in te dienen</span>
    </button>

    <button
      class="fb-chip fb-chip-conflict"
      :class="{ on: filters.conflict }"
      @click="toggleChip('conflict')"
      title="Volgtijdelijkheidsconflict"
    >
      <Icon icon="mdi:swap-horizontal" width="13" height="13" />
      <span class="fb-chip-count">{{ conflictCount }}</span>
      <span class="fb-chip-label">conflict</span>
    </button>

    <!-- Extra actions (provided by parent via slot) -->
    <slot name="actions"></slot>
  </div>
</template>

<script setup>
import { Icon } from '@iconify/vue';
import { usePlanner } from '../stores/planner.js';

defineProps({
  ongeplandCount: { type: Number, default: 0 },
  overdueCount: { type: Number, default: 0 },
  inTeDienenCount: { type: Number, default: 0 },
  conflictCount: { type: Number, default: 0 },
});

const { filters } = usePlanner();

function toggleChip(key) {
  const wasOn = filters[key];
  // Radio: turn all off, then toggle the clicked one
  filters.alleenOngepland = false;
  filters.overdue = false;
  filters.inTeDienen = false;
  filters.conflict = false;
  if (!wasOn) filters[key] = true;
}
</script>

<style scoped>
.filter-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}

/* ---- Segmented H/R toggle ---- */
.fb-segmented {
  display: flex;
  border: 1.5px solid var(--clr-border);
  border-radius: 6px;
  overflow: hidden;
}
.fb-segmented button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: none;
  background: white;
  cursor: pointer;
  color: var(--clr-text-muted);
  font-size: 0.75rem;
  font-weight: 800;
  transition: all 0.15s;
}
.fb-segmented button + button {
  border-left: 1.5px solid var(--clr-border);
}
.fb-segmented button.on {
  background: var(--clr-accent);
  color: white;
}
.fb-segmented button:hover:not(.on) {
  background: var(--clr-accent-light);
  color: var(--clr-accent);
}

/* ---- Filter chips ---- */
.fb-chip {
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

.fb-chip-count {
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.fb-chip-label {
  font-weight: 600;
}

/* ---- Ongepland = accent/indigo ---- */
.fb-chip-ongepland {
  border-color: rgba(99, 102, 241, 0.3);
  color: #4f46e5;
}
.fb-chip-ongepland:hover {
  border-color: #6366f1;
  background: #eef2ff;
}
.fb-chip-ongepland.on {
  background: #6366f1;
  border-color: #6366f1;
  color: white;
}

/* ---- Overdue = orange ---- */
.fb-chip-overdue {
  border-color: rgba(245, 158, 11, 0.3);
  color: #b45309;
}
.fb-chip-overdue:hover {
  border-color: #f59e0b;
  background: #fffbeb;
}
.fb-chip-overdue.on {
  background: #f59e0b;
  border-color: #f59e0b;
  color: white;
}

/* ---- In te dienen = red ---- */
.fb-chip-intedienen {
  border-color: rgba(239, 68, 68, 0.3);
  color: #b91c1c;
}
.fb-chip-intedienen:hover {
  border-color: #ef4444;
  background: #fef2f2;
}
.fb-chip-intedienen.on {
  background: #ef4444;
  border-color: #ef4444;
  color: white;
}

/* ---- Conflict = purple ---- */
.fb-chip-conflict {
  border-color: rgba(139, 92, 246, 0.3);
  color: #6d28d9;
}
.fb-chip-conflict:hover {
  border-color: #8b5cf6;
  background: #f5f3ff;
}
.fb-chip-conflict.on {
  background: #8b5cf6;
  border-color: #8b5cf6;
  color: white;
}
</style>
