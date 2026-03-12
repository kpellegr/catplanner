<template>
  <div class="bd">
    <!-- Chart area: y-labels left + SVG + right spacer -->
    <div class="bd-chart-row">
      <!-- Y-axis labels (same width as wg-dag-cell) -->
      <div class="bd-y-axis">
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

          <!-- Vertical grid lines per dag -->
          <line
            v-for="(_, i) in dagen"
            :key="'gv' + i"
            :x1="sx(i)" y1="0"
            :x2="sx(i)" y2="500"
            class="bd-grid"
            :class="{ 'bd-grid-today': i === vandaagIdx }"
          />

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
            :class="{ 'bd-dot-today': i === vandaagIdx }"
          />

          <!-- Gap marker -->
          <template v-if="gapData">
            <rect
              :x="sx(6) - 30" :y="gapData.y"
              width="60" :height="gapData.h"
              rx="6"
              class="bd-gap-bar"
            />
            <text
              :x="sx(6)" :y="gapData.y - 12"
              text-anchor="middle"
              class="bd-gap-label"
            >{{ gapData.label }}</text>
          </template>
        </svg>
      </div>

      <!-- Right spacer (same width as wg-label-cell) -->
      <div class="bd-right-spacer"></div>
    </div>

    <!-- Day labels row (aligned with grid) -->
    <div class="bd-dag-row">
      <div class="bd-y-axis"></div>
      <div class="bd-dag-labels">
        <span
          v-for="(dag, i) in dagen"
          :key="'dl' + i"
          class="bd-dag-label"
          :class="{ 'bd-dag-today': i === vandaagIdx }"
          :style="{ left: ((15 + i / 6 * 1000) / 1030 * 100) + '%' }"
        >{{ dag }}</span>
      </div>
      <div class="bd-right-spacer"></div>
    </div>

    <!-- Legend (aligned like wg-legende) -->
    <div class="bd-legend">
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
function sx(dayIdx) { return (dayIdx / 6) * 1000; }
function sy(val) { return 500 * (1 - val / maxY.value); }
function yPct(val) { return (15 + (1 - val / maxY.value) * 500) / 530 * 100; }

// Per dag: cumulative afgewerkte minuten
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

// Per dag: cumulative geplande minuten
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

const remaining = computed(() =>
  cumulatieveKlaar.value.map(c => Math.max(0, totaalMin.value - c))
);
const plannedRemaining = computed(() =>
  cumulatieveGepland.value.map(c => Math.max(0, totaalMin.value - c))
);

// Ideale lijn: van totaalMin → 0
const idealPoints = computed(() =>
  dagen.map((_, i) => `${sx(i)},${sy(totaalMin.value * (6 - i) / 6)}`).join(' ')
);

// Geplande lijn: alle 7 dagen
const plannedDots = computed(() =>
  dagen.map((_, i) => ({ x: sx(i), y: sy(plannedRemaining.value[i]) }))
);
const plannedPoints = computed(() =>
  plannedDots.value.map(p => `${p.x},${p.y}`).join(' ')
);

// Werkelijke lijn: tot en met vandaag
const actualDots = computed(() => {
  const dots = [];
  for (let i = 0; i <= vandaagIdx && i < 7; i++) {
    dots.push({ x: sx(i), y: sy(remaining.value[i]) });
  }
  return dots;
});
const actualPoints = computed(() => {
  if (actualDots.value.length < 2) return null;
  return actualDots.value.map(p => `${p.x},${p.y}`).join(' ');
});

// Gap marker
const gapData = computed(() => {
  const min = plannedRemaining.value[6] || 0;
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
  margin: 0 auto;
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
  stroke: var(--clr-border, #e5e7eb);
  stroke-width: 1;
}
.bd-grid-today {
  stroke: var(--clr-accent, #6366f1);
  stroke-width: 2;
  stroke-dasharray: 6 6;
}

/* Lines */
.bd-ideal {
  fill: none;
  stroke: var(--clr-text-muted, #9ca3af);
  stroke-width: 3;
  stroke-dasharray: 12 8;
  opacity: 0.5;
}

.bd-planned {
  fill: none;
  stroke: #93c5fd;
  stroke-width: 3;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.bd-planned-dot { fill: #93c5fd; }

.bd-actual {
  fill: none;
  stroke: #10b981;
  stroke-width: 5;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.bd-dot { fill: #10b981; }
.bd-dot-today {
  fill: white;
  stroke: #10b981;
  stroke-width: 5;
}

/* Gap */
.bd-gap-bar {
  fill: #ef4444;
  opacity: 0.15;
}
.bd-gap-label {
  font-size: 22px;
  fill: #ef4444;
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
  background: #93c5fd;
}
.bd-legend-actual::before {
  background: #10b981;
  height: 3px;
}
.bd-legend-gap::before {
  background: #ef4444;
}

@media (max-width: 700px) {
  .bd-legend { display: none; }
}
</style>
