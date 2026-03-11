<template>
  <div class="filter-bar">
    <!-- Expand/collapse (provided by parent via slot) -->
    <slot name="expand"></slot>

    <!-- Type filters -->
    <div class="fb-group">
      <button
        class="fb-btn"
        :class="{ on: filters.huistaken }"
        @click="filters.huistaken = !filters.huistaken"
        title="Huistaken / zelfstandig"
      >
        <span class="fb-swatch" style="background: #64748b"></span>
        <span class="fb-label">H</span>
      </button>
      <button
        class="fb-btn"
        :class="{ on: filters.rooster }"
        @click="filters.rooster = !filters.rooster"
        title="Roostertaken"
      >
        <span class="fb-swatch" style="background: #6366f1"></span>
        <span class="fb-label">R</span>
      </button>
    </div>

    <span class="fb-sep"></span>

    <!-- Status filters -->
    <div class="fb-group">
      <button
        class="fb-btn"
        :class="{ on: filters.ongepland }"
        @click="filters.ongepland = !filters.ongepland"
        title="Ongepland"
      >
        <Icon icon="mdi:circle-outline" width="14" height="14" />
      </button>
      <button
        class="fb-btn"
        :class="{ on: filters.gepland }"
        @click="filters.gepland = !filters.gepland"
        title="Gepland"
      >
        <Icon icon="mdi:calendar-check-outline" width="14" height="14" />
      </button>
      <button
        class="fb-btn"
        :class="{ on: filters.klaar }"
        @click="filters.klaar = !filters.klaar"
        title="Klaar"
      >
        <Icon icon="mdi:check-circle-outline" width="14" height="14" />
      </button>
      <button
        class="fb-btn"
        :class="{ on: filters.ingediend }"
        @click="filters.ingediend = !filters.ingediend"
        title="Ingediend"
      >
        <Icon icon="mdi:send-check-outline" width="14" height="14" />
      </button>
    </div>

    <span class="fb-sep"></span>

    <!-- Warning filters (drill-down) -->
    <div class="fb-group">
      <button
        class="fb-btn fb-warn"
        :class="{ on: filters.overdue }"
        @click="toggleWarning('overdue')"
        title="Overdue (niet klaar, gepland in verleden)"
      >
        <Icon icon="mdi:clock-alert-outline" width="14" height="14" />
      </button>
      <button
        class="fb-btn fb-warn"
        :class="{ on: filters.inTeDienen }"
        @click="toggleWarning('inTeDienen')"
        title="In te dienen (klaar maar niet ingediend)"
      >
        <Icon icon="mdi:file-alert-outline" width="14" height="14" />
      </button>
      <button
        class="fb-btn fb-warn"
        :class="{ on: filters.conflict }"
        @click="toggleWarning('conflict')"
        title="Volgtijdelijkheidsconflict"
      >
        <Icon icon="mdi:swap-horizontal" width="14" height="14" />
      </button>
    </div>

    <!-- Extra actions (provided by parent via slot) -->
    <slot name="actions"></slot>
  </div>
</template>

<script setup>
import { Icon } from '@iconify/vue';
import { usePlanner } from '../stores/planner.js';

const { filters } = usePlanner();

function toggleWarning(key) {
  const wasOn = filters[key];
  // Radio: turn all off, then toggle the clicked one
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

.fb-group {
  display: flex;
  align-items: center;
  gap: 2px;
}

.fb-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 1.5px solid var(--clr-border);
  border-radius: 6px;
  background: white;
  cursor: pointer;
  color: var(--clr-text-muted);
  font-size: 0.7rem;
  font-weight: 700;
  transition: all 0.15s;
}

.fb-btn:hover {
  border-color: var(--clr-accent);
  color: var(--clr-accent);
}

/* ON state: inverted */
.fb-btn.on {
  background: var(--clr-accent);
  border-color: var(--clr-accent);
  color: white;
}

.fb-btn.on:hover {
  background: var(--clr-accent);
  opacity: 0.85;
}

/* Warning buttons: red inverted when active */
.fb-btn.fb-warn.on {
  background: #ef4444;
  border-color: #ef4444;
  color: white;
}

.fb-btn.fb-warn:hover {
  border-color: #ef4444;
  color: #ef4444;
}

.fb-btn.fb-warn.on:hover {
  background: #ef4444;
  color: white;
}

.fb-swatch {
  width: 3px;
  height: 14px;
  border-radius: 1px;
  flex-shrink: 0;
}
.fb-btn.on .fb-swatch {
  background: rgba(255,255,255,0.7) !important;
}

.fb-label {
  line-height: 1;
}

.fb-sep {
  width: 1px;
  height: 18px;
  background: var(--clr-border);
  flex-shrink: 0;
}
</style>
