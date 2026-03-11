<template>
  <div class="dashboard">
    <header class="dash-header">
      <h1>Catplanner</h1>
      <div class="header-right">
        <NotificatieBel />
        <span class="user-info">{{ profile?.display_name || auth.state.user?.email }}</span>
        <button class="btn-logout" @click="auth.signOut()">Uitloggen</button>
      </div>
    </header>

    <div v-if="loading" class="loading">Laden...</div>

    <template v-else>
      <div v-if="planners.length" class="planner-lijst">
        <h2>Mijn planningen</h2>
        <div
          v-for="p in planners"
          :key="p.planner_id"
          class="planner-kaart"
          @click="openPlanner(p)"
        >
          <div class="kaart-info">
            <span class="kaart-naam">{{ p.planner_naam }}</span>
            <span v-if="p.student_profile" class="kaart-profiel">
              {{ p.student_profile.naam }} &middot;
              {{ p.student_profile.richting }}
              {{ p.student_profile.route }}-route
              {{ p.student_profile.wiskunde }}
            </span>
          </div>
          <span class="kaart-role">{{ p.role }}</span>
        </div>
      </div>

      <div v-else class="empty-state">
        <template v-if="profile?.user_type === 'student'">
          <p>Je hebt nog geen planning. Maak er een aan!</p>
          <button class="btn-primary" @click="nieuwePlanning">Nieuwe planning</button>
        </template>
        <template v-else>
          <p>Je hebt nog geen planningen om te volgen.</p>
          <p class="hint">Vraag een leerling om een uitnodigingslink te delen.</p>
        </template>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../stores/auth.js';
import * as sync from '../stores/sync.js';
import NotificatieBel from '../components/NotificatieBel.vue';

const router = useRouter();
const auth = useAuth();

const loading = ref(true);
const planners = ref([]);
const profile = ref(null);

onMounted(async () => {
  try {
    const [prof, myPlanners] = await Promise.all([
      sync.getMyProfile(),
      sync.getMyPlanners(),
    ]);
    profile.value = prof;
    planners.value = myPlanners;

    // Student met precies 1 planner → ga direct naar planner
    if (prof?.user_type === 'student' && myPlanners.length === 1) {
      router.replace(`/planner/${myPlanners[0].planner_id}`);
      return;
    }
  } catch (e) {
    console.error('Dashboard load error:', e);
  }
  loading.value = false;
});

function openPlanner(p) {
  router.push(`/planner/${p.planner_id}`);
}

async function nieuwePlanning() {
  // Student without planner → go to onboarding to set up profile
  router.push('/onboarding');
}
</script>

<style scoped>
.dashboard {
  max-width: 640px;
  margin: 0 auto;
  padding: 1rem;
}

.dash-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--clr-border, #ddd);
}

.dash-header h1 {
  margin: 0;
  font-size: 1.3rem;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.user-info {
  font-size: 0.85rem;
  color: var(--clr-text-muted, #888);
}

.btn-logout {
  font-size: 0.8rem;
  padding: 0.3rem 0.75rem;
  border: 1px solid var(--clr-border, #ddd);
  border-radius: 0.4rem;
  background: var(--clr-surface, #fff);
  cursor: pointer;
}

h2 {
  font-size: 1.1rem;
  margin: 0 0 0.75rem;
}

.planner-lijst {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.planner-kaart {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border: 1px solid var(--clr-border, #ddd);
  border-radius: 0.75rem;
  background: var(--clr-surface, #fff);
  cursor: pointer;
  transition: border-color 0.15s;
}

.planner-kaart:hover {
  border-color: var(--clr-accent, #6366f1);
}

.kaart-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.kaart-naam {
  font-weight: 600;
}

.kaart-profiel {
  font-size: 0.8rem;
  color: var(--clr-text-muted, #888);
}

.kaart-role {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--clr-text-muted, #888);
  background: var(--clr-bg, #f5f5f5);
  padding: 0.2rem 0.5rem;
  border-radius: 0.25rem;
}

.loading {
  text-align: center;
  padding: 3rem;
  color: var(--clr-text-muted, #888);
}

.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--clr-text-muted, #888);
}

.hint {
  font-size: 0.85rem;
  opacity: 0.7;
}

.btn-primary {
  margin-top: 1rem;
  padding: 0.65rem 1.5rem;
  background: var(--clr-accent, #6366f1);
  color: #fff;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  font-size: 0.95rem;
}

@media (max-width: 480px) {
  .dash-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  .header-right {
    width: 100%;
    justify-content: flex-end;
  }
  .user-info {
    font-size: 0.75rem;
  }
  .planner-kaart {
    padding: 0.75rem;
  }
  .kaart-naam {
    font-size: 0.9rem;
  }
}
</style>
