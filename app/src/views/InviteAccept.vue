<template>
  <AuthGate>
    <div class="invite-page">
      <div class="invite-card">
        <template v-if="loading">
          <p>Uitnodiging verwerken...</p>
        </template>
        <template v-else-if="error">
          <h2>Oeps</h2>
          <p>{{ error }}</p>
          <button @click="gaNaarHome">Ga naar Catplanner</button>
        </template>
        <template v-else>
          <h2>Welkom!</h2>
          <p>Je hebt nu toegang tot de planning.</p>
          <button @click="gaNaarHome">Open planning</button>
        </template>
      </div>
    </div>
  </AuthGate>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { acceptInvite } from '../stores/sync.js';
import AuthGate from '../components/AuthGate.vue';

const route = useRoute();
const router = useRouter();
const loading = ref(true);
const error = ref('');

function gaNaarHome() {
  router.push('/');
}

onMounted(async () => {
  try {
    await acceptInvite(route.params.token);
  } catch (e) {
    error.value = e.message || 'Ongeldige of verlopen uitnodiging.';
  }
  loading.value = false;
});
</script>

<style scoped>
.invite-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
}

.invite-card {
  background: var(--clr-surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 2rem;
  width: 380px;
  max-width: 90vw;
  text-align: center;
}

.invite-card h2 {
  margin: 0 0 0.5rem;
}

.invite-card p {
  color: var(--clr-text-muted);
  margin: 0 0 1rem;
}

.invite-card button {
  padding: 0.6rem 1.2rem;
  border: none;
  border-radius: 6px;
  background: var(--clr-accent);
  color: white;
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
}
</style>
