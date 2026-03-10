<template>
  <div v-if="show" class="notif-bel">
    <button
      class="bel-btn"
      :class="{ active: subscribed }"
      :title="subscribed ? 'Meldingen uitschakelen' : 'Meldingen inschakelen'"
      @click="toggle"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" style="stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        <circle v-if="subscribed" cx="18" cy="5" r="3" fill="#22c55e" style="stroke: none;" />
      </svg>
    </button>
    <div v-if="iosTip" class="ios-tip">
      Voeg de app toe aan je beginscherm om meldingen te ontvangen.
      <button class="tip-close" @click="iosTip = false">OK</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { isPushSupported, isIosNotStandalone, isSubscribed as checkSubscribed, subscribeToPush, unsubscribeFromPush, syncSubscription } from '../lib/push.js';

const show = ref(false);
const subscribed = ref(false);
const iosTip = ref(false);

onMounted(async () => {
  if (isIosNotStandalone()) {
    show.value = true; // show bell so we can display the iOS tip
    return;
  }
  if (!isPushSupported()) return;
  show.value = true;
  subscribed.value = await checkSubscribed();
  // Sync current subscription to DB on every page load
  if (subscribed.value) await syncSubscription();
});

async function toggle() {
  if (isIosNotStandalone()) {
    iosTip.value = true;
    return;
  }

  try {
    if (subscribed.value) {
      if (confirm('Meldingen uitschakelen?')) {
        await unsubscribeFromPush();
        subscribed.value = false;
      }
    } else {
      await subscribeToPush();
      subscribed.value = true;
    }
  } catch (e) {
    console.error('Push toggle error:', e);
    if (Notification.permission === 'denied') {
      alert('Meldingen zijn geblokkeerd in je browser-instellingen. Sta meldingen toe voor deze site.');
    }
  }
}
</script>

<style scoped>
.notif-bel {
  position: relative;
}

.bel-btn {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 2rem !important;
  height: 2rem !important;
  padding: 0 !important;
  border: 1px solid var(--clr-border, #ddd) !important;
  border-radius: 0.4rem !important;
  background: var(--clr-surface, #fff) !important;
  cursor: pointer;
  color: var(--clr-text-muted, #888) !important;
  transition: all 0.15s;
}

.bel-btn:hover,
.bel-btn.active {
  color: var(--clr-accent, #6366f1) !important;
  border-color: var(--clr-accent, #6366f1) !important;
}

.ios-tip {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 0.5rem;
  background: var(--clr-surface, #fff);
  border: 1px solid var(--clr-border, #ddd);
  border-radius: 0.5rem;
  padding: 0.75rem;
  font-size: 0.8rem;
  width: 220px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 100;
}

.tip-close {
  display: block;
  margin-top: 0.5rem;
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--clr-border, #ddd);
  border-radius: 0.25rem;
  background: var(--clr-surface, #fff);
  cursor: pointer;
  font-size: 0.75rem;
}
</style>
