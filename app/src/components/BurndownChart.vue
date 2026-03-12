<template>
  <div class="bd" :class="{ 'bd-fill': fill }">
    <!-- Chart area: y-labels left + SVG + right spacer -->
    <div class="bd-chart-row">
      <!-- Y-axis labels (same width as wg-dag-cell) -->
      <div v-if="showLabels" class="bd-y-axis">
        <span
          v-for="(tick, i) in yTicks"
          :key="'yl' + i"
          class="bd-y-label"
          :style="{ top: yPct(tick) + '%' }"
        >{{ tick }}'</span>
      </div>

      <!-- SVG chart (fills remaining space, like wg-cel area) -->
      <div class="bd-svg-wrap" ref="svgWrap">
        <svg viewBox="-15 -15 1030 530" preserveAspectRatio="none" class="bd-svg" style="overflow:visible">
          <!-- Horizontal grid lines -->
          <line
            v-for="(tick, i) in yTicks"
            :key="'gh' + i"
            x1="0" :y1="sy(tick)"
            x2="1000" :y2="sy(tick)"
            class="bd-grid"
          />

          <!-- Vertical grid lines: 8 lines (boundaries) -->
          <line
            v-for="i in 8"
            :key="'gv' + i"
            :x1="sx(i - 1)" y1="0"
            :x2="sx(i - 1)" y2="500"
            class="bd-grid"
            :class="{ 'bd-grid-today': isTodayLine(i - 1) }"
          />

          <!-- Totaal label bij startpunt -->
          <text
            :x="sx(0)" :y="sy(totaalMin) - 12"
            text-anchor="middle"
            class="bd-totaal-label"
          >{{ totaalMin }}'</text>

          <!-- Ideal line -->
          <polyline :points="idealPoints" class="bd-ideal" />

          <!-- Planned line -->
          <polyline v-if="plannedPoints" :points="plannedPoints" class="bd-planned" />
          <circle
            v-for="(p, i) in plannedDots"
            :key="'pdot' + i"
            :cx="p.x" :cy="p.y" r="6"
            class="bd-planned-dot"
          />

          <!-- Actual line -->
          <polyline v-if="actualPoints" :points="actualPoints" class="bd-actual" />
          <circle
            v-for="(p, i) in actualDots"
            :key="'dot' + i"
            :cx="p.x" :cy="p.y" r="8"
            class="bd-dot"
            :class="{ 'bd-dot-today': i === actualDots.length - 1 }"
          />

          <!-- Gap marker -->
          <template v-if="gapData">
            <rect
              :x="sx(7) - 30" :y="gapData.y"
              width="60" :height="gapData.h"
              rx="6"
              class="bd-gap-bar"
            />
            <text
              :x="sx(7)" :y="gapData.y - 12"
              text-anchor="middle"
              class="bd-gap-label"
            >{{ gapData.label }}</text>
          </template>
        </svg>
      </div>

      <!-- Right spacer (same width as wg-label-cell) -->
      <div v-if="showLabels" class="bd-right-spacer"></div>
    </div>

    <!-- Day labels row (aligned with grid) — labels centered between boundaries -->
    <div v-if="showLabels" class="bd-dag-row">
      <div class="bd-y-axis"></div>
      <div class="bd-dag-labels">
        <span
          v-for="(dag, i) in dagen"
          :key="'dl' + i"
          class="bd-dag-label"
          :class="{ 'bd-dag-today': i === vandaagIdx }"
          :style="{ left: dagLabelPct(i) + '%' }"
        >{{ dag }}</span>
      </div>
      <div class="bd-right-spacer"></div>
    </div>

    <!-- Legend (aligned like wg-legende) -->
    <div v-if="showLabels" class="bd-legend">
      <span class="bd-legend-ideal">ideaal</span>
      <span class="bd-legend-planned">gepland</span>
      <span class="bd-legend-actual">afgewerkt</span>
      <span class="bd-legend-gap">niet gepland</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { usePlanner } from '../stores/planner.js';

const props = defineProps({
  showLabels: { type: Boolean, default: true },
  fill: { type: Boolean, default: false },
});

const { alleTaken } = usePlanner();

const dagen = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
const jsDay = new Date().getDay();
const dagMap = [6, 0, 1, 2, 3, 4, 5];
const vandaagIdx = dagMap[jsDay];

function taakMin(taak) {
  return taak.voortgang.customMinuten || (taak.tijd?.type === 'minuten' ? taak.tijd.minuten : 0);
}

function isKlaar(taak) {
  return taak.voortgang.status === 'klaar' || taak.voortgang.status === 'ingediend';
}

const totaalMin = computed(() =>
  alleTaken.value.reduce((s, t) => s + taakMin(t), 0)
);

// Y-as: rond af naar boven op veelvoud van 200
const yStep = 200;
const maxY = computed(() => {
  const raw = totaalMin.value || 1;
  return Math.ceil(raw / yStep) * yStep;
});
const yTicks = computed(() => {
  const n = maxY.value / yStep;
  return Array.from({ length: n + 1 }, (_, i) => maxY.value - i * yStep);
});

// SVG internal coords: 1000 x 500
// 8 boundary points: 0=ma-ochtend, 1=ma→di, 2=di→wo, ..., 7=zo-avond
function sx(boundaryIdx) { return (boundaryIdx / 7) * 1000; }
function sy(val) { return 500 * (1 - val / maxY.value); }
function yPct(val) { return (15 + (1 - val / maxY.value) * 500) / 530 * 100; }

// Day label centered between its two boundaries
function dagLabelPct(dagIdx) {
  const midX = (sx(dagIdx) + sx(dagIdx + 1)) / 2;
  return (15 + midX) / 1030 * 100;
}

// Today line: the line AFTER today's dag (= einde vandaag)
function isTodayLine(boundaryIdx) {
  return boundaryIdx === vandaagIdx + 1;
}

// Per dag: cumulative afgewerkte minuten (na einde van die dag)
const cumulatieveKlaar = computed(() => {
  const perDag = new Array(7).fill(0);
  for (const t of alleTaken.value) {
    if (!isKlaar(t)) continue;
    const min = taakMin(t);
    const dagIdx = t.geplandOp ? dagen.indexOf(t.geplandOp) : -1;
    if (dagIdx >= 0) perDag[dagIdx] += min;
    else perDag[vandaagIdx] += min;
  }
  const cum = [];
  let running = 0;
  for (let i = 0; i < 7; i++) { running += perDag[i]; cum.push(running); }
  return cum;
});

// Per dag: cumulative geplande minuten (na einde van die dag)
const cumulatieveGepland = computed(() => {
  const perDag = new Array(7).fill(0);
  for (const t of alleTaken.value) {
    if (!t.geplandOp) continue;
    const dagIdx = dagen.indexOf(t.geplandOp);
    if (dagIdx >= 0) perDag[dagIdx] += taakMin(t);
  }
  const cum = [];
  let running = 0;
  for (let i = 0; i < 7; i++) { running += perDag[i]; cum.push(running); }
  return cum;
});

// 8 boundary values: [totaal, na-ma, na-di, ..., na-zo]
const remaining = computed(() => {
  const r = [totaalMin.value]; // boundary 0: start of week
  for (let i = 0; i < 7; i++) {
    r.push(Math.max(0, totaalMin.value - cumulatieveKlaar.value[i]));
  }
  return r;
});
const plannedRemaining = computed(() => {
  const r = [totaalMin.value]; // boundary 0: start of week
  for (let i = 0; i < 7; i++) {
    r.push(Math.max(0, totaalMin.value - cumulatieveGepland.value[i]));
  }
  return r;
});

// Ideale lijn: van totaalMin (punt 0) → 0 (punt 7)
const idealPoints = computed(() =>
  Array.from({ length: 8 }, (_, i) => `${sx(i)},${sy(totaalMin.value * (7 - i) / 7)}`).join(' ')
);

// Geplande lijn: alle 8 boundary punten
const plannedDots = computed(() =>
  Array.from({ length: 8 }, (_, i) => ({ x: sx(i), y: sy(plannedRemaining.value[i]) }))
);
const plannedPoints = computed(() =>
  plannedDots.value.map(p => `${p.x},${p.y}`).join(' ')
);

// Werkelijke lijn: punt 0 (start) tot en met einde vandaag (boundary vandaagIdx+1)
const actualDots = computed(() => {
  const dots = [];
  for (let i = 0; i <= vandaagIdx + 1 && i < 8; i++) {
    dots.push({ x: sx(i), y: sy(remaining.value[i]) });
  }
  return dots;
});
const actualPoints = computed(() => {
  if (actualDots.value.length < 2) return null;
  return actualDots.value.map(p => `${p.x},${p.y}`).join(' ');
});

// Gap marker (at boundary 7 = end of week)
const gapData = computed(() => {
  const min = plannedRemaining.value[7] || 0;
  if (min <= 0) return null;
  return {
    y: sy(min),
    h: sy(0) - sy(min),
    label: `${min}'`,
  };
});
</script>

<style scoped>
.bd {
  max-width: 560px;
}

.bd-chart-row {
  display: flex;
  gap: 3px;
}

.bd-y-axis {
  width: 20px;
  flex-shrink: 0;
  position: relative;
}

.bd-y-label {
  position: absolute;
  right: 0;
  transform: translateY(-50%);
  font-size: 0.6rem;
  font-weight: 700;
  color: var(--clr-text-muted, #9ca3af);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.bd-svg-wrap {
  flex: 1;
  min-width: 0;
  aspect-ratio: 2 / 1;
}

/* Fill mode: match height of sibling */
.bd-fill {
  height: 100%;
}
.bd-fill .bd-chart-row {
  height: 100%;
}
.bd-fill .bd-svg-wrap {
  aspect-ratio: unset;
  height: 100%;
}

.bd-svg {
  width: 100%;
  height: 100%;
  display: block;
}

.bd-right-spacer {
  flex-shrink: 0;
  min-width: 28px;
  padding-left: 4px;
}

/* Grid */
.bd-grid {
  stroke: #fff;
  stroke-width: 1;
}
.bd-grid-today {
  stroke: var(--clr-accent, #6366f1);
  stroke-width: 2;
  stroke-dasharray: 6 6;
}

/* Totaal label */
.bd-totaal-label {
  font-size: 22px;
  fill: var(--clr-text-muted, #9ca3af);
  font-weight: 700;
  font-family: inherit;
}

/* Lines */
.bd-ideal {
  fill: none;
  stroke: var(--clr-text-muted, #9ca3af);
  stroke-width: 6;
  stroke-dasharray: 12 8;
  opacity: 0.5;
}

.bd-planned {
  fill: none;
  stroke: #7eb8d8;
  stroke-width: 6;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.bd-planned-dot { fill: #7eb8d8; }

.bd-actual {
  fill: none;
  stroke: #86cfac;
  stroke-width: 6;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.bd-dot { fill: #86cfac; }
.bd-dot-today {
  fill: white;
  stroke: #86cfac;
  stroke-width: 6;
}

/* Gap */
.bd-gap-bar {
  fill: #f87171;
  opacity: 0.15;
}
.bd-gap-label {
  font-size: 22px;
  fill: #f87171;
  font-weight: 700;
  font-family: inherit;
}

/* Day labels */
.bd-dag-row {
  display: flex;
  gap: 3px;
  margin-top: 2px;
}
.bd-dag-labels {
  flex: 1;
  min-width: 0;
  position: relative;
  height: 1em;
}
.bd-dag-label {
  position: absolute;
  transform: translateX(-50%);
  font-size: 0.6rem;
  font-weight: 700;
  color: var(--clr-text-muted, #9ca3af);
  text-transform: uppercase;
}
.bd-dag-today {
  color: var(--clr-accent, #6366f1);
}

/* Legend */
.bd-legend {
  display: flex;
  gap: 8px;
  margin-top: 6px;
  margin-left: 23px;
  font-size: 0.6rem;
  color: var(--clr-text-muted);
}
.bd-legend span {
  display: flex;
  align-items: center;
  gap: 2px;
}
.bd-legend span::before {
  content: '';
  display: inline-block;
  width: 12px;
  height: 2px;
}
.bd-legend-ideal::before {
  background: var(--clr-text-muted, #9ca3af);
  opacity: 0.5;
}
.bd-legend-planned::before {
  background: #7eb8d8;
}
.bd-legend-actual::before {
  background: #86cfac;
  height: 3px;
}
.bd-legend-gap::before {
  background: #f87171;
}

@media (max-width: 700px) {
  .bd-legend { display: none; }
}
</style>
