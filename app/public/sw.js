// Catplanner Service Worker v3 — Web Push notifications

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Fetch handler required for Chrome to properly handle push events
self.addEventListener('fetch', (event) => {
  // Pass through all requests — no caching
  return;
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data?.json() || {};
  } catch (e) {
    data = { title: 'Catplanner', body: event.data?.text() || 'Nieuwe melding' };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Catplanner', {
      body: data.body || 'Je hebt een nieuwe melding',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: data.data || {},
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});
