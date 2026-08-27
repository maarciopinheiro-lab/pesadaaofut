const CACHE_NAME = 'pesadao-fc-v14';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('supabase.co')) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (!response || response.status === 404) {
            return caches.match('/index.html') || response;
          }
          return response;
        })
        .catch(() => {
          return caches.match('/index.html') || caches.match('/');
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
});

// --- PUSH NOTIFICATIONS EVENT LISTENER ---
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      try {
        data = { data: { title: 'Pesadão F.C.', body: event.data.text() } };
      } catch (err) {
        data = {};
      }
    }
  }

  console.log('[ServiceWorker] Push event received:', data);

  const notificationData = data.notification || data.data || data.aps?.alert || data.payload?.aps?.alert || {};
  
  const title = notificationData.title || data.title || data.payload?.title || 'Pesadão F.C.';
  const body = notificationData.body || data.body || data.payload?.body || 'Nova notificação recebida!';
  const icon = notificationData.icon || data.icon || 'https://i.imgur.com/CxbCPR5.png';

  const finalTitle = typeof title === 'string' && title.trim() ? title : 'Pesadão F.C.';
  const finalBody = typeof body === 'string' && body.trim() ? body : 'Nova notificação do Pesadão F.C.';

  const options = {
    body: finalBody,
    icon: icon,
    badge: 'https://i.imgur.com/CxbCPR5.png',
    vibrate: [100, 50, 100],
    data: data.data || data || {},
    tag: 'pesadao-fc-notif',
    renotify: true,
    requireInteraction: true
  };

  event.waitUntil(
    self.registration.showNotification(finalTitle, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});