<template>
  <div v-if="auth.state.loading" class="auth-loading">
    <p>Laden...</p>
  </div>

  <div v-else-if="!auth.isLoggedIn.value" class="auth-gate">
    <div class="auth-card">
      <h1>Catplanner</h1>
      <p>Log in om verder te gaan.</p>

      <button class="btn-google" @click="onGoogle">
        <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
        Inloggen met Google
      </button>

      <div class="auth-divider">
        <span>of</span>
      </div>

      <form @submit.prevent="onSubmit" class="auth-form">
        <input
          v-model="email"
          type="email"
          placeholder="je@email.com"
          required
          :disabled="sending"
        />
        <button type="submit" :disabled="sending">
          {{ sending ? 'Verzenden...' : 'Stuur login-link via email' }}
        </button>
      </form>

      <p v-if="sent" class="auth-success">
        Link verstuurd! Check je inbox (en spam-folder).
      </p>
      <p v-if="error" class="auth-error">{{ error }}</p>
    </div>
  </div>

  <slot v-else />
</template>

<script setup>
import { ref } from 'vue';
import { useAuth } from '../stores/auth.js';

const auth = useAuth();

const email = ref('');
const sending = ref(false);
const sent = ref(false);
const error = ref('');

async function onGoogle() {
  error.value = '';
  try {
    await auth.signInWithGoogle();
  } catch (e) {
    error.value = e.message || 'Er ging iets mis.';
  }
}

async function onSubmit() {
  sending.value = true;
  sent.value = false;
  error.value = '';

  try {
    await auth.signIn(email.value);
    sent.value = true;
  } catch (e) {
    error.value = e.message || 'Er ging iets mis.';
  } finally {
    sending.value = false;
  }
}
</script>

<style scoped>
.auth-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  color: var(--clr-text-muted);
}

.auth-gate {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 80vh;
}

.auth-card {
  background: var(--clr-surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 2rem;
  width: 380px;
  max-width: 90vw;
  text-align: center;
}

.auth-card h1 {
  margin: 0 0 0.5rem;
  font-size: 1.5rem;
}

.auth-card p {
  color: var(--clr-text-muted);
  font-size: 0.9rem;
  margin: 0 0 1.25rem;
}

.btn-google {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  padding: 0.6rem;
  border: 1px solid var(--clr-border);
  border-radius: 6px;
  background: var(--clr-surface);
  font-size: 0.95rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s, box-shadow 0.15s;
}

.btn-google:hover {
  background: var(--clr-bg);
  box-shadow: 0 1px 4px rgba(0,0,0,0.1);
}

.auth-divider {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 0.25rem 0;
}

.auth-divider::before,
.auth-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--clr-border);
}

.auth-divider span {
  font-size: 0.8rem;
  color: var(--clr-text-muted);
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.auth-form input {
  font-size: 0.95rem;
  padding: 0.6rem 0.8rem;
  border: 1px solid var(--clr-border);
  border-radius: 6px;
  font-family: inherit;
}

.auth-form input:focus {
  outline: none;
  border-color: var(--clr-accent);
  box-shadow: 0 0 0 2px var(--clr-accent-light);
}

.auth-form button {
  font-size: 0.95rem;
  padding: 0.6rem;
  border: none;
  border-radius: 6px;
  background: var(--clr-accent);
  color: white;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}

.auth-form button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.auth-success {
  color: var(--clr-klaar) !important;
  font-weight: 500;
  margin-top: 1rem !important;
}

.auth-error {
  color: #ef4444 !important;
  font-weight: 500;
  margin-top: 1rem !important;
}
</style>
