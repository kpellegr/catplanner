<template>
  <AuthGate>
    <div class="loading">Even geduld...</div>
  </AuthGate>
</template>

<script setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../stores/auth.js';
import * as sync from '../stores/sync.js';
import AuthGate from '../components/AuthGate.vue';

const router = useRouter();
const auth = useAuth();

onMounted(async () => {
  // Wait until auth is ready
  const check = () => new Promise((resolve) => {
    if (!auth.state.loading) return resolve();
    const stop = setInterval(() => {
      if (!auth.state.loading) { clearInterval(stop); resolve(); }
    }, 50);
  });
  await check();

  if (!auth.state.user) return; // AuthGate handles login

  try {
    const profile = await sync.getMyProfile();

    if (!profile) {
      // New user → onboarding
      router.replace('/onboarding');
      return;
    }

    // Existing user → dashboard (dashboard auto-redirects students with 1 planner)
    router.replace('/dashboard');
  } catch (e) {
    console.error('Home redirect error:', e);
    router.replace('/onboarding');
  }
});
</script>

<style scoped>
.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  color: var(--clr-text-muted, #888);
}
</style>
