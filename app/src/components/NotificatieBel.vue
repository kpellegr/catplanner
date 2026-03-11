<template>
  <div v-if="show" class="notif-bel">
    <button
      class="bel-btn"
      :class="{ active: subscribed }"
      :title="subscribed ? 'Meldingen uitschakelen' : 'Meldingen inschakelen'"
      @click="toggle"
    >
      <Icon icon="mdi:bell-outline" width="18" height="18" />
    </button>
    <div v-if="iosTip" class="ios-tip">
      Voeg de app toe aan je beginscherm om meldingen te ontvangen.
      <button class="tip-close" @click="iosTip = false">OK</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
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

defineExpose({ toggle, subscribed });
</script>

<style scoped>
.notif-bel {
  position: relative;
}

.bel-btn {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 3rem !important;
  height: 3rem !important;
  padding: 0 !important;
  border: 1px solid var(--clr-border, #ddd) !important;
  border-radius: var(--radius, 10px) !important;
  background: var(--clr-surface, #fff) !important;
  cursor: pointer;
  color: var(--clr-text-muted, #888) !important;
  transition: all 0.15s;
}

.bel-btn:hover {
  color: var(--clr-accent, #6366f1) !important;
  border-color: var(--clr-accent, #6366f1) !important;
}

.bel-btn.active {
  color: white !important;
  background: var(--clr-accent, #6366f1) !important;
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
