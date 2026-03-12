<template>
  <!-- Walking cat (ambient, crosses screen) -->
  <div v-if="walker.visible" class="dk-walker" :class="{ flipped: walker.dir === 'left', 'dk-nyan': walkerIsNyan }" :style="walkerStyle">
    <div ref="walkerLottieEl" class="dk-lottie-container"></div>
  </div>

  <!-- Push cup cat (ambient, sits on UI edges) -->
  <div v-if="pushCup.visible" class="dk-push-cup" :style="pushCupStyle">
    <div ref="pushCupLottieEl" class="dk-lottie-container"></div>
  </div>

  <!-- Play ball cat (ambient, lies on edges) -->
  <div v-if="playBall.visible" class="dk-play-ball" :style="playBallStyle">
    <div ref="playBallLottieEl" class="dk-lottie-container"></div>
  </div>

  <!-- High four paw (task completion) -->
  <div v-if="highFour.visible" class="dk-high-four" :style="highFourStyle">
    <div ref="highFourLottieEl" class="dk-lottie-container"></div>
    <div class="dk-high-four-text">high four!</div>
  </div>

  <!-- Typing cat (ambient, sits on edges) -->
  <div v-if="typing.visible" class="dk-typing" :style="typingStyle">
    <div ref="typingLottieEl" class="dk-lottie-container"></div>
  </div>

  <!-- Celebration overlay (all tasks ingediend) -->
  <Teleport to="body">
    <transition name="dk-celebrate">
      <div v-if="celebrate.visible" class="dk-celebrate-overlay" @click="celebrate.visible = false">
        <div class="dk-celebrate-content" @click.stop>
          <div ref="celebrateLottieEl" class="dk-celebrate-lottie"></div>
          <h2 class="dk-celebrate-title">Alles ingediend!</h2>
          <p class="dk-celebrate-text">Je hebt alle taken afgerond. Goed gedaan!</p>
          <button class="dk-celebrate-close" @click="celebrate.visible = false">Sluiten</button>
        </div>
      </div>
    </transition>
  </Teleport>

  <!-- Debug panel -->
  <div v-if="debug" class="dk-debug no-print">
    <div class="dk-debug-title">Dopamine Debug</div>
    <button @click="triggerWalker()">Walker</button>
    <button @click="forceNyan()">Nyan!</button>
    <button @click="triggerHighFour()">High four</button>
    <button @click="forcePushCup()">Push cup</button>
    <button @click="forcePlayBall()">Play ball</button>
    <button @click="forceTyping()">Typing</button>
    <button @click="triggerCelebration()">Feest!</button>
    <div class="dk-debug-status">
      <span>Lottie: {{ loadedSlots || 'geen' }}</span>
    </div>
    <label class="dk-debug-toggle">
      <input type="checkbox" v-model="ambientEnabled" />
      Ambient aan
    </label>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, watch, computed, nextTick } from 'vue';
import lottie from 'lottie-web';
import { usePlanner } from '../stores/planner.js';

const props = defineProps({
  debug: { type: Boolean, default: false },
});

const { stats, dopamineEvent } = usePlanner();

// ---- Lottie data registry ----
// Slots: 'walker', 'push_cup', 'celebrate'
const lottieData = reactive({
  walker: null,
  nyan: null,
  push_cup: null,
  play_ball: null,
  typing: null,
  high_four: null,
  celebrate: null,
});

const loadedSlots = computed(() =>
  Object.keys(lottieData).filter(k => lottieData[k]).join(', ')
);

async function loadLottieAssets() {
  const slots = Object.keys(lottieData);
  for (const slot of slots) {
    try {
      const resp = await fetch(`/lottie/${slot}.json`);
      if (resp.ok) {
        const ct = resp.headers.get('content-type') || '';
        if (!ct.includes('json') && !ct.includes('javascript')) continue;
        lottieData[slot] = await resp.json();
        console.log(`[DopamineKat] Loaded lottie: ${slot}`);
      }
    } catch (e) {
      console.warn(`[DopamineKat] Failed to load ${slot}:`, e);
    }
  }
}

// ---- Lottie player helper ----
const activeAnims = new Map();

function playLottie(container, slot, { loop = true, autoplay = true } = {}) {
  if (!container) return null;
  const existing = activeAnims.get(container);
  if (existing) { existing.destroy(); activeAnims.delete(container); }

  const data = lottieData[slot];
  if (!data) return null;

  const anim = lottie.loadAnimation({
    container,
    renderer: 'svg',
    loop,
    autoplay,
    animationData: JSON.parse(JSON.stringify(data)),
  });
  activeAnims.set(container, anim);
  return anim;
}

function destroyLottie(container) {
  const anim = activeAnims.get(container);
  if (anim) { anim.destroy(); activeAnims.delete(container); }
}

// ---- Walking cat (ambient, crosses screen) ----
const walker = reactive({ visible: false, x: -150, dir: 'right' });
const walkerStyle = computed(() => ({ left: walker.x + 'px', bottom: '0px' }));
const walkerLottieEl = ref(null);

let walkerAnimFrame = null;
const walkerIsNyan = ref(false);

function triggerWalker(direction) {
  if (walker.visible) return;
  walker.dir = direction || (Math.random() > 0.5 ? 'right' : 'left');
  walker.visible = true;

  // 15% chance for nyan cat (if available)
  walkerIsNyan.value = lottieData.nyan && Math.random() < 0.15;
  const slot = walkerIsNyan.value ? 'nyan' : 'walker';
  const catW = walkerIsNyan.value ? 120 : 150;

  const screenW = window.innerWidth;
  const startX = walker.dir === 'right' ? -catW : screenW + 20;
  const endX = walker.dir === 'right' ? screenW + 20 : -catW;
  walker.x = startX;

  nextTick(() => {
    if (walkerLottieEl.value) playLottie(walkerLottieEl.value, slot);
  });

  // Nyan is faster (more energetic)
  const duration = walkerIsNyan.value
    ? 6000 + Math.random() * 3000    // 6-9 sec
    : 15000 + Math.random() * 8000;  // 15-23 sec
  const start = performance.now();

  function step(now) {
    const t = Math.min((now - start) / duration, 1);
    walker.x = startX + (endX - startX) * t;
    if (t < 1) {
      walkerAnimFrame = requestAnimationFrame(step);
    } else {
      if (walkerLottieEl.value) destroyLottie(walkerLottieEl.value);
      walker.visible = false;
      walkerIsNyan.value = false;
    }
  }
  walkerAnimFrame = requestAnimationFrame(step);
}

// ---- High four paw (task completion) ----
const highFour = reactive({ visible: false, x: 0, y: 0 });
const highFourStyle = computed(() => ({
  left: highFour.x + 'px',
  top: highFour.y + 'px',
}));
const highFourLottieEl = ref(null);

function triggerHighFour(x, y) {
  if (!lottieData.high_four) return;
  // If already showing, kill previous
  if (highFour.visible && highFourLottieEl.value) {
    destroyLottie(highFourLottieEl.value);
  }

  const size = 100;
  highFour.x = (typeof x === 'number') ? x - size / 2 : window.innerWidth / 2 - size / 2;
  highFour.y = (typeof y === 'number') ? y - size / 2 : window.innerHeight / 2 - size / 2;
  highFour.visible = true;

  nextTick(() => {
    if (highFourLottieEl.value) {
      const anim = playLottie(highFourLottieEl.value, 'high_four', { loop: false });
      if (anim) {
        anim.addEventListener('complete', () => {
          setTimeout(() => {
            destroyLottie(highFourLottieEl.value);
            highFour.visible = false;
          }, 300);
        });
      }
    }
  });

  setTimeout(() => {
    if (highFour.visible) {
      if (highFourLottieEl.value) destroyLottie(highFourLottieEl.value);
      highFour.visible = false;
    }
  }, 3000);
}

// ---- Push cup cat (ambient, appears on random UI elements) ----
const pushCup = reactive({ visible: false, x: 0, y: 0 });
const pushCupStyle = computed(() => ({
  left: pushCup.x + 'px',
  top: pushCup.y + 'px',
}));
const pushCupLottieEl = ref(null);

// Find horizontal edges the cat can sit on (borders, card tops, separators)
function findVisibleEdges() {
  const candidates = [];
  const seen = new Set(); // avoid duplicates at same y

  function addEdge(x, y, w) {
    // Must be on screen with room for the cat above
    if (y < PUSH_CUP_SIZE * 0.3 || y > window.innerHeight - 40) return;
    if (w < PUSH_CUP_SIZE * 0.8) return;
    // Deduplicate edges at nearly the same y (within 5px)
    const key = Math.round(y / 5);
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({ x, y, w });
  }

  // Strategy 1: elements with visible borders (top or bottom)
  const borderEls = document.querySelectorAll(
    'header, .kolom-header, .vak-rij-header, .filter-bar, .view-switcher, ' +
    '.db-stat-row, .edit-modal, .detail-popup, .bd-dag-row'
  );
  for (const el of borderEls) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 60) continue;
    const style = getComputedStyle(el);
    if (parseFloat(style.borderBottomWidth) >= 1) addEdge(rect.left, rect.bottom, rect.width);
    if (parseFloat(style.borderTopWidth) >= 1) addEdge(rect.left, rect.top, rect.width);
  }

  // Strategy 2: cards and boxes — cat sits on top edge
  const boxEls = document.querySelectorAll(
    '.kanban-kaart, .kaart-expand, .vak-cel'
  );
  for (const el of boxEls) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 60) continue;
    addEdge(rect.left, rect.top, rect.width);
    addEdge(rect.left, rect.bottom, rect.width);
  }

  // Strategy 3: main content areas — use the bottom edge
  const areaEls = document.querySelectorAll(
    'main, .kanban-grid, .bd-svg-wrap, .wg-row, .week-grid'
  );
  for (const el of areaEls) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 100) continue;
    addEdge(rect.left, rect.bottom, rect.width);
  }

  return candidates;
}

const PUSH_CUP_SIZE = 120;
// How far from the bottom of the SVG the cat's "feet" are (tweak this!)
const PUSH_CUP_BOTTOM_OFFSET = Math.round(PUSH_CUP_SIZE * 0.75);
const PUSH_CUP_SPEED = 0.4;
const PUSH_CUP_IDLE = 4000; // ms to sit still before animation starts

function triggerPushCup() {
  if (pushCup.visible) return;
  if (!lottieData.push_cup) return;

  const edges = findVisibleEdges();
  const edge = edges.length ? edges[Math.floor(Math.random() * edges.length)] : null;

  if (edge) {
    // Horizontally: random position along the edge
    const margin = PUSH_CUP_SIZE * 0.2;
    const minX = edge.x + margin;
    const maxX = edge.x + edge.w - PUSH_CUP_SIZE - margin;
    pushCup.x = maxX > minX ? minX + Math.random() * (maxX - minX) : edge.x;
    // Vertically: cat's feet (at BOTTOM_OFFSET from top of SVG) sit on the edge
    pushCup.y = edge.y - PUSH_CUP_BOTTOM_OFFSET;
  } else {
    pushCup.x = Math.random() * (window.innerWidth - PUSH_CUP_SIZE);
    pushCup.y = 50 + Math.random() * (window.innerHeight * 0.4);
  }

  pushCup.visible = true;

  nextTick(() => {
    if (pushCupLottieEl.value) {
      // Load animation paused (cat sits still first)
      const anim = playLottie(pushCupLottieEl.value, 'push_cup', { loop: false, autoplay: false });
      if (anim) {
        anim.setSpeed(PUSH_CUP_SPEED);
        // Sit still for a moment, then start
        setTimeout(() => {
          anim.play();
        }, PUSH_CUP_IDLE);
        anim.addEventListener('complete', () => {
          setTimeout(() => {
            destroyLottie(pushCupLottieEl.value);
            pushCup.visible = false;
          }, 1000);
        });
      }
    }
  });

  // Safety timeout: idle + animation + linger
  const totalDuration = PUSH_CUP_IDLE + (1100 / PUSH_CUP_SPEED) + 2000;
  setTimeout(() => {
    if (pushCup.visible) {
      if (pushCupLottieEl.value) destroyLottie(pushCupLottieEl.value);
      pushCup.visible = false;
    }
  }, totalDuration);
}

// ---- Play ball cat (ambient, lies on an edge) ----
const playBall = reactive({ visible: false, x: 0, y: 0 });
const playBallStyle = computed(() => ({
  left: playBall.x + 'px',
  top: playBall.y + 'px',
}));
const playBallLottieEl = ref(null);

const PLAY_BALL_W = 150;  // wide format (1070x456 ratio), 25% smaller
const PLAY_BALL_H = 64;
const playBallBottomOffset = ref(53); // 71 * (64/85)

function triggerPlayBall() {
  if (playBall.visible) return;
  if (!lottieData.play_ball) return;

  const edges = findVisibleEdges();
  // Filter for wider edges (cat lies down, needs more space)
  const wideEdges = edges.filter(e => e.w > PLAY_BALL_W * 1.2);
  const edge = wideEdges.length
    ? wideEdges[Math.floor(Math.random() * wideEdges.length)]
    : edges.length ? edges[Math.floor(Math.random() * edges.length)] : null;

  if (edge) {
    const margin = PLAY_BALL_W * 0.1;
    const minX = edge.x + margin;
    const maxX = edge.x + edge.w - PLAY_BALL_W - margin;
    playBall.x = maxX > minX ? minX + Math.random() * (maxX - minX) : edge.x;
    playBall.y = edge.y - playBallBottomOffset.value;
  } else {
    playBall.x = Math.random() * (window.innerWidth - PLAY_BALL_W);
    playBall.y = 50 + Math.random() * (window.innerHeight * 0.4);
  }

  playBall.visible = true;

  nextTick(() => {
    if (playBallLottieEl.value) {
      const anim = playLottie(playBallLottieEl.value, 'play_ball', { loop: true });
      if (anim) {
        anim.setSpeed(0.8);
        // Play a few loops then disappear
        let loops = 0;
        const maxLoops = 4 + Math.floor(Math.random() * 5); // 4-8 loops
        anim.addEventListener('loopComplete', () => {
          loops++;
          if (loops >= maxLoops) {
            setTimeout(() => {
              destroyLottie(playBallLottieEl.value);
              playBall.visible = false;
            }, 500);
          }
        });
      }
    }
  });

  // Safety timeout
  setTimeout(() => {
    if (playBall.visible) {
      if (playBallLottieEl.value) destroyLottie(playBallLottieEl.value);
      playBall.visible = false;
    }
  }, 8000);
}

function forcePlayBall() {
  if (playBall.visible) {
    if (playBallLottieEl.value) destroyLottie(playBallLottieEl.value);
    playBall.visible = false;
  }
  nextTick(() => triggerPlayBall());
}

// ---- Typing cat (ambient, sits on edges) ----
const typing = reactive({ visible: false, x: 0, y: 0 });
const typingStyle = computed(() => ({
  left: typing.x + 'px',
  top: typing.y + 'px',
}));
const typingLottieEl = ref(null);

const TYPING_SIZE = 100;
const TYPING_BOTTOM_OFFSET = Math.round(TYPING_SIZE * 0.75);

function triggerTyping() {
  if (typing.visible) return;
  if (!lottieData.typing) return;

  const edges = findVisibleEdges();
  const edge = edges.length ? edges[Math.floor(Math.random() * edges.length)] : null;

  if (edge) {
    const margin = TYPING_SIZE * 0.2;
    const minX = edge.x + margin;
    const maxX = edge.x + edge.w - TYPING_SIZE - margin;
    typing.x = maxX > minX ? minX + Math.random() * (maxX - minX) : edge.x;
    typing.y = edge.y - TYPING_BOTTOM_OFFSET;
  } else {
    typing.x = Math.random() * (window.innerWidth - TYPING_SIZE);
    typing.y = 50 + Math.random() * (window.innerHeight * 0.4);
  }

  typing.visible = true;

  nextTick(() => {
    if (typingLottieEl.value) {
      const anim = playLottie(typingLottieEl.value, 'typing', { loop: true });
      if (anim) {
        let loops = 0;
        const maxLoops = 5 + Math.floor(Math.random() * 4); // 5-8 loops (25-40 sec)
        anim.addEventListener('loopComplete', () => {
          loops++;
          if (loops >= maxLoops) {
            setTimeout(() => {
              destroyLottie(typingLottieEl.value);
              typing.visible = false;
            }, 500);
          }
        });
      }
    }
  });

  setTimeout(() => {
    if (typing.visible) {
      if (typingLottieEl.value) destroyLottie(typingLottieEl.value);
      typing.visible = false;
    }
  }, 45000);
}

function forceTyping() {
  if (typing.visible) {
    if (typingLottieEl.value) destroyLottie(typingLottieEl.value);
    typing.visible = false;
  }
  nextTick(() => triggerTyping());
}

// ---- Celebration ----
const celebrate = reactive({ visible: false });
const celebrateLottieEl = ref(null);

function triggerCelebration() {
  celebrate.visible = true;
  nextTick(() => {
    if (celebrateLottieEl.value) playLottie(celebrateLottieEl.value, 'celebrate');
  });
}

watch(() => celebrate.visible, (v) => {
  if (!v && celebrateLottieEl.value) destroyLottie(celebrateLottieEl.value);
});

// ---- Ambient scheduler ----
const ambientEnabled = ref(true);
let ambientTimer = null;

// Available ambient animations (walker, push_cup)
function pickAmbient() {
  const available = [];
  if (lottieData.walker) available.push('walker');
  if (lottieData.push_cup) available.push('push_cup', 'push_cup'); // higher weight
  if (lottieData.play_ball) available.push('play_ball');
  if (lottieData.typing) available.push('typing');
  if (!available.length) return null;
  return available[Math.floor(Math.random() * available.length)];
}

function scheduleAmbient() {
  if (ambientTimer) clearTimeout(ambientTimer);
  const delay = 60000 + Math.random() * 90000; // 60-150 sec
  ambientTimer = setTimeout(() => {
    if (ambientEnabled.value) {
      const pick = pickAmbient();
      if (pick === 'walker' && !walker.visible) triggerWalker();
      else if (pick === 'push_cup' && !pushCup.visible) triggerPushCup();
      else if (pick === 'play_ball' && !playBall.visible) triggerPlayBall();
      else if (pick === 'typing' && !typing.visible) triggerTyping();
    }
    scheduleAmbient();
  }, delay);
}

// ---- Watch for task completion ----
// klaar → high four paw, ingediend → fireworks (handled by view)
watch(dopamineEvent, (evt) => {
  if (evt) {
    if (evt.type === 'klaar') triggerHighFour(evt.x, evt.y);
    dopamineEvent.value = null; // consume
  }
});

// ---- Watch for all-ingediend ----
const prevAllIngediend = ref(false);
watch(
  () => {
    const s = stats.value;
    return s.total > 0 && s.ingediend === s.total;
  },
  (allDone) => {
    if (allDone && !prevAllIngediend.value) {
      triggerCelebration();
    }
    prevAllIngediend.value = allDone;
  }
);

// Debug: force restart push cup (kills current, starts new)
function forcePushCup() {
  if (pushCup.visible) {
    if (pushCupLottieEl.value) destroyLottie(pushCupLottieEl.value);
    pushCup.visible = false;
  }
  nextTick(() => triggerPushCup());
}

// Force nyan for debug
function forceNyan() {
  if (walker.visible) {
    if (walkerLottieEl.value) destroyLottie(walkerLottieEl.value);
    walker.visible = false;
    walkerIsNyan.value = false;
    if (walkerAnimFrame) cancelAnimationFrame(walkerAnimFrame);
  }
  nextTick(() => {
    // Temporarily force nyan
    const origRandom = Math.random;
    Math.random = () => 0; // < 0.15 → nyan
    triggerWalker();
    Math.random = origRandom;
  });
}

defineExpose({ triggerHighFour, triggerPushCup, triggerPlayBall, triggerWalker, triggerCelebration });

onMounted(async () => {
  await loadLottieAssets();
  scheduleAmbient();
});

onUnmounted(() => {
  if (ambientTimer) clearTimeout(ambientTimer);
  if (walkerAnimFrame) cancelAnimationFrame(walkerAnimFrame);
  for (const anim of activeAnims.values()) anim.destroy();
  activeAnims.clear();
});
</script>

<style scoped>
/* ---- Shared ---- */
.dk-lottie-container {
  width: 100%;
  height: 100%;
}

/* ---- Walking cat ---- */
.dk-walker {
  position: fixed;
  z-index: 9990;
  pointer-events: none;
  width: 150px;
  height: 120px;
  filter: invert(1) hue-rotate(180deg);
}

.dk-walker.flipped {
  transform: scaleX(-1);
  filter: invert(1) hue-rotate(180deg);
}

/* Nyan cat: no invert, slightly smaller */
.dk-walker.dk-nyan {
  filter: none;
  width: 120px;
  height: 120px;
}
.dk-walker.dk-nyan.flipped {
  transform: scaleX(-1);
  filter: none;
}

/* ---- High four paw ---- */
.dk-high-four {
  position: fixed;
  z-index: 9995;
  pointer-events: none;
  width: 100px;
  height: 100px;
  animation: dk-high-four-in 0.2s ease-out;
}

@keyframes dk-high-four-in {
  from { opacity: 0; transform: scale(0.5); }
  to { opacity: 1; transform: scale(1); }
}

.dk-high-four-text {
  text-align: center;
  font-size: 0.75rem;
  font-weight: 800;
  color: var(--clr-accent, #6366f1);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  animation: dk-high-four-text-in 0.4s ease-out 0.3s both;
}

@keyframes dk-high-four-text-in {
  0% { opacity: 0; transform: translateY(-8px) scale(0.6); }
  60% { opacity: 1; transform: translateY(2px) scale(1.1); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}

/* ---- Push cup cat ---- */
.dk-push-cup {
  position: fixed;
  z-index: 9995;
  pointer-events: none;
  width: 120px;
  height: 120px;
  animation: dk-push-cup-in 0.3s ease-out;
}

@keyframes dk-push-cup-in {
  from { opacity: 0; transform: scale(0.7); }
  to { opacity: 1; transform: scale(1); }
}

/* ---- Play ball cat ---- */
.dk-play-ball {
  position: fixed;
  z-index: 9995;
  pointer-events: none;
  width: 150px;
  height: 64px;
  animation: dk-push-cup-in 0.3s ease-out;
}

/* ---- Typing cat ---- */
.dk-typing {
  position: fixed;
  z-index: 9995;
  pointer-events: none;
  width: 100px;
  height: 100px;
  animation: dk-push-cup-in 0.3s ease-out;
}

/* ---- Celebration overlay ---- */
.dk-celebrate-overlay {
  position: fixed;
  inset: 0;
  background: rgba(10, 10, 46, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(4px);
}

.dk-celebrate-content {
  text-align: center;
  padding: 2.5rem;
  max-width: 400px;
}

.dk-celebrate-lottie {
  width: 200px;
  height: 200px;
  margin: 0 auto;
}

/* Fallback when no Lottie: show app icon */
.dk-celebrate-lottie:empty::after {
  content: '';
  display: block;
  width: 120px;
  height: 120px;
  margin: 40px auto 0;
  background: url('/icons/icon-192.png') center/contain no-repeat;
  border-radius: 28px;
  animation: dk-celebrate-bounce 0.6s ease-out, dk-celebrate-float 3s ease-in-out 0.6s infinite;
  box-shadow: 0 0 40px rgba(99, 102, 241, 0.4), 0 0 80px rgba(99, 102, 241, 0.2);
}

@keyframes dk-celebrate-bounce {
  0% { transform: scale(0) rotate(-10deg); }
  50% { transform: scale(1.2) rotate(5deg); }
  100% { transform: scale(1) rotate(0deg); }
}

@keyframes dk-celebrate-float {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  25% { transform: translateY(-8px) rotate(2deg); }
  75% { transform: translateY(4px) rotate(-2deg); }
}

.dk-celebrate-title {
  color: white;
  font-size: 1.8rem;
  font-weight: 800;
  margin: 1.2rem 0 0.5rem;
  animation: dk-title-in 0.5s ease-out 0.3s both;
}

@keyframes dk-title-in {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.dk-celebrate-text {
  color: rgba(255, 255, 255, 0.7);
  font-size: 1rem;
  margin: 0 0 1.5rem;
  animation: dk-title-in 0.5s ease-out 0.5s both;
}

.dk-celebrate-close {
  padding: 0.5rem 1.5rem;
  border: 1px solid rgba(255,255,255,0.3);
  border-radius: 8px;
  background: rgba(255,255,255,0.1);
  color: white;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.15s;
  animation: dk-title-in 0.5s ease-out 0.7s both;
  font-family: inherit;
}

.dk-celebrate-close:hover {
  background: rgba(255,255,255,0.2);
  border-color: rgba(255,255,255,0.5);
}

/* Transition */
.dk-celebrate-enter-active { transition: opacity 0.3s ease; }
.dk-celebrate-leave-active { transition: opacity 0.3s ease; }
.dk-celebrate-enter-from, .dk-celebrate-leave-to { opacity: 0; }

/* ---- Debug panel ---- */
.dk-debug {
  position: fixed;
  bottom: 80px;
  right: 12px;
  background: rgba(30, 30, 30, 0.95);
  color: white;
  border-radius: 10px;
  padding: 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  z-index: 10001;
  font-size: 0.75rem;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  min-width: 160px;
}

.dk-debug-title {
  font-weight: 700;
  font-size: 0.8rem;
  padding-bottom: 0.25rem;
  border-bottom: 1px solid rgba(255,255,255,0.15);
  margin-bottom: 0.15rem;
}

.dk-debug button {
  padding: 0.35rem 0.6rem;
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 6px;
  background: rgba(255,255,255,0.08);
  color: white;
  cursor: pointer;
  font-size: 0.72rem;
  font-family: inherit;
  transition: background 0.15s;
}

.dk-debug button:hover {
  background: rgba(255,255,255,0.18);
}

.dk-debug-status {
  font-size: 0.6rem;
  color: rgba(255,255,255,0.4);
  padding: 0.15rem 0;
}

.dk-debug-toggle {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.7rem;
  color: rgba(255,255,255,0.7);
  padding-top: 0.25rem;
  border-top: 1px solid rgba(255,255,255,0.1);
  margin-top: 0.15rem;
  cursor: pointer;
}

.dk-debug-toggle input {
  margin: 0;
}
</style>
