import { supabase } from './supabase.js';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export function isPushSupported() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  // iOS: push only works in standalone (PWA) mode
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
    return window.matchMedia('(display-mode: standalone)').matches;
  }
  return true;
}

export function isIosNotStandalone() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !window.matchMedia('(display-mode: standalone)').matches;
}

export function getPushPermission() {
  return typeof Notification !== 'undefined' ? Notification.permission : 'denied';
}

export async function isSubscribed() {
  if (!isPushSupported()) return false;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return !!sub;
}

export async function subscribeToPush() {
  if (!isPushSupported()) throw new Error('Push niet ondersteund');

  const reg = await navigator.serviceWorker.ready;

  // Unsubscribe any existing subscription first to get a fresh one
  const existing = await reg.pushManager.getSubscription();
  if (existing) await existing.unsubscribe();

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  const { endpoint } = sub;
  const keys = sub.toJSON().keys;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Niet ingelogd');

  // Remove all old subscriptions for this user, then insert fresh
  await supabase.from('push_subscriptions').delete().eq('user_id', user.id);
  const { error } = await supabase.from('push_subscriptions').insert({
    user_id: user.id,
    endpoint,
    keys_p256dh: keys.p256dh,
    keys_auth: keys.auth,
  });
  if (error) throw error;

  return true;
}

/** Sync current browser subscription to DB (call on page load) */
export async function syncSubscription() {
  if (!isPushSupported()) return;
  if (Notification.permission !== 'granted') return;

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const keys = sub.toJSON().keys;
  await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint: sub.endpoint,
      keys_p256dh: keys.p256dh,
      keys_auth: keys.auth,
    },
    { onConflict: 'user_id,endpoint' }
  );
}

export async function unsubscribeFromPush() {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;

  const endpoint = sub.endpoint;
  await sub.unsubscribe();

  // Remove from Supabase
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}
