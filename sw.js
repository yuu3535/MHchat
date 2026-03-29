const CACHE_NAME = 'mikhail-cache-v2';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// ─── INSTALL ──────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// ─── ACTIVATE ─────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(key => key !== CACHE_NAME)
        .map(key => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

// ─── FETCH ────────────────────────────────────────
self.addEventListener('fetch', event => {
  const request = event.request;

  // ページ遷移系は index.html を優先して返す
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const networkResponse = await fetch(request);
        const cache = await caches.open(CACHE_NAME);
        cache.put('./index.html', networkResponse.clone());
        return networkResponse;
      } catch (error) {
        const cached = await caches.match('./index.html');
        return cached || Response.error();
      }
    })());
    return;
  }

  // それ以外は cache-first + fallback network
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
      const networkResponse = await fetch(request);

      // GETのみキャッシュ対象
      if (request.method === 'GET') {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, networkResponse.clone());
      }

      return networkResponse;
    } catch (error) {
      return Response.error();
    }
  })());
});

// ─── PUSH NOTIFICATION ────────────────────────────
self.addEventListener('push', event => {
  let data = {
    title: 'Mikhail',
    body: 'メッセージがあります',
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: 'mikhail-general',
    url: './'
  };

  try {
    const incoming = event.data ? event.data.json() : {};
    data = {
      ...data,
      ...incoming
    };
  } catch (e) {
    // JSONじゃない場合の保険
    data.body = event.data ? event.data.text() : data.body;
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || './icon-192.png',
      badge: data.badge || './icon-192.png',
      tag: data.tag || 'mikhail-general',
      renotify: true,
      vibrate: [200, 100, 200],
      data: {
        url: data.url || './'
      }
    })
  );
});

// ─── NOTIFICATION CLICK ───────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || './';

  event.waitUntil((async () => {
    const clientList = await clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });

    for (const client of clientList) {
      const clientUrl = new URL(client.url);

      // 既存のアプリ画面があればそれを前面に
      if (clientUrl.pathname.endsWith('/index.html') || clientUrl.pathname.endsWith('/')) {
        await client.focus();
        return;
      }
    }

    await clients.openWindow(targetUrl);
  })());
});