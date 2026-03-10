<template>
  <div class="onboarding">
    <div class="card">
      <h1>Welkom bij Catplanner!</h1>
      <p class="subtitle">Vertel ons wie je bent zodat we alles goed instellen.</p>

      <!-- Stap 1: Kies type -->
      <div v-if="stap === 1" class="stap">
        <h2>Ik ben een...</h2>
        <div class="keuze-groep">
          <button
            v-for="t in types"
            :key="t.value"
            :class="['keuze-btn', { selected: type === t.value }]"
            @click="type = t.value"
          >
            <span class="keuze-icon">{{ t.icon }}</span>
            <span class="keuze-label">{{ t.label }}</span>
          </button>
        </div>
        <button class="btn-next" :disabled="!type" @click="volgendeStap">Volgende</button>
      </div>

      <!-- Stap 2: Naam -->
      <div v-if="stap === 2" class="stap">
        <h2>Hoe heet je?</h2>
        <input
          v-model="naam"
          type="text"
          placeholder="Je naam"
          class="text-input"
          @keyup.enter="volgendeStap"
        />
        <div class="btn-row">
          <button class="btn-back" @click="stap--">Terug</button>
          <button class="btn-next" :disabled="!naam.trim()" @click="volgendeStap">
            {{ type === 'student' ? 'Volgende' : 'Klaar!' }}
          </button>
        </div>
      </div>

      <!-- Stap 3: Student profiel (alleen voor studenten) -->
      <div v-if="stap === 3" class="stap">
        <h2>Jouw profiel</h2>

        <label class="field-label">Richting</label>
        <div class="keuze-groep compact">
          <button
            v-for="r in richtingen"
            :key="r"
            :class="['keuze-btn small', { selected: richting === r }]"
            @click="richting = r"
          >{{ r }}</button>
        </div>

        <label class="field-label">Route</label>
        <div class="keuze-groep compact">
          <button
            v-for="r in routes"
            :key="r"
            :class="['keuze-btn small', { selected: route === r }]"
            @click="route = r"
          >{{ r }}-route</button>
        </div>

        <label class="field-label">Wiskunde</label>
        <div class="keuze-groep compact">
          <button
            v-for="w in wiskundeOpties"
            :key="w"
            :class="['keuze-btn small', { selected: wiskunde === w }]"
            @click="wiskunde = w"
          >{{ w }}</button>
        </div>

        <div class="btn-row">
          <button class="btn-back" @click="stap--">Terug</button>
          <button
            class="btn-next"
            :disabled="!richting || !route || !wiskunde || saving"
            @click="afronden"
          >
            {{ saving ? 'Even geduld...' : 'Klaar!' }}
          </button>
        </div>
      </div>

      <p v-if="error" class="error">{{ error }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import * as sync from '../stores/sync.js';

const router = useRouter();

const stap = ref(1);
const type = ref(null);
const naam = ref('');
const richting = ref(null);
const route = ref(null);
const wiskunde = ref(null);
const saving = ref(false);
const error = ref('');

const types = [
  { value: 'student', label: 'Leerling', icon: '\uD83C\uDF93' },
  { value: 'ouder', label: 'Ouder', icon: '\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67' },
  { value: 'coach', label: 'Coach', icon: '\uD83E\uDDD1\u200D\uD83C\uDFEB' },
];

const richtingen = ['WW', 'HW', 'MT'];
const routes = ['B', 'Z'];
const wiskundeOpties = ['3u', '4u', '6u', '8u'];

function volgendeStap() {
  if (stap.value === 1 && type.value) {
    stap.value = 2;
  } else if (stap.value === 2 && naam.value.trim()) {
    if (type.value === 'student') {
      stap.value = 3;
    } else {
      afronden();
    }
  }
}

async function afronden() {
  saving.value = true;
  error.value = '';

  try {
    // Save user profile
    await sync.createUserProfile(type.value, naam.value.trim());

    if (type.value === 'student') {
      // Create planner with student profile
      const studentProfile = {
        naam: naam.value.trim(),
        richting: richting.value,
        route: route.value,
        wiskunde: wiskunde.value,
      };
      const plannerId = await sync.createPlanner(
        `Planning ${naam.value.trim()}`,
        studentProfile
      );
      router.push(`/planner/${plannerId}`);
    } else {
      // Ouder/coach → dashboard
      router.push('/dashboard');
    }
  } catch (e) {
    error.value = e.message || 'Er ging iets mis. Probeer opnieuw.';
    saving.value = false;
  }
}
</script>

<style scoped>
.onboarding {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: var(--clr-bg, #f5f5f5);
}

.card {
  background: var(--clr-surface, #fff);
  border-radius: 1rem;
  padding: 2rem;
  max-width: 480px;
  width: 100%;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

h1 {
  margin: 0 0 0.25rem;
  font-size: 1.5rem;
}

.subtitle {
  color: var(--clr-text-muted, #888);
  margin: 0 0 1.5rem;
}

h2 {
  font-size: 1.1rem;
  margin: 0 0 0.75rem;
}

.keuze-groep {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}

.keuze-groep.compact {
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.keuze-btn {
  flex: 1;
  padding: 1rem 0.5rem;
  border: 2px solid var(--clr-border, #ddd);
  border-radius: 0.75rem;
  background: var(--clr-surface, #fff);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.95rem;
  transition: all 0.15s;
}

.keuze-btn.small {
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  flex-direction: row;
  justify-content: center;
}

.keuze-btn:hover {
  border-color: var(--clr-accent, #6366f1);
}

.keuze-btn.selected {
  border-color: var(--clr-accent, #6366f1);
  background: var(--clr-accent-light, #eef2ff);
  font-weight: 600;
}

.keuze-icon {
  font-size: 1.5rem;
}

.field-label {
  display: block;
  font-weight: 600;
  font-size: 0.85rem;
  margin-bottom: 0.4rem;
  color: var(--clr-text-muted, #666);
}

.text-input {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid var(--clr-border, #ddd);
  border-radius: 0.5rem;
  font-size: 1rem;
  margin-bottom: 1.25rem;
  box-sizing: border-box;
}

.text-input:focus {
  outline: none;
  border-color: var(--clr-accent, #6366f1);
}

.btn-row {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.btn-next,
.btn-back {
  padding: 0.65rem 1.5rem;
  border-radius: 0.5rem;
  font-size: 0.95rem;
  cursor: pointer;
  border: none;
}

.btn-next {
  background: var(--clr-accent, #6366f1);
  color: #fff;
  margin-top: 0.5rem;
}

.btn-next:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-back {
  background: var(--clr-surface, #fff);
  border: 1px solid var(--clr-border, #ddd);
}

.error {
  color: #e53e3e;
  margin-top: 1rem;
  font-size: 0.9rem;
}
</style>
