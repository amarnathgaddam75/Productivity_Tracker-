/* eslint-disable no-restricted-globals */
// Service worker built by CRA (Workbox InjectManifest). It precaches the app
// shell so LifeTracker opens instantly and works fully offline.

import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate } from 'workbox-strategies';

clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);

// App-shell routing: serve index.html for navigations (SPA).
const fileExtensionRegexp = new RegExp('/[^/?]+\\.[^/]+$');
registerRoute(({ request, url }) => {
  if (request.mode !== 'navigate') return false;
  if (url.pathname.startsWith('/_')) return false;
  if (url.pathname.match(fileExtensionRegexp)) return false;
  return true;
}, createHandlerBoundToURL(process.env.PUBLIC_URL + '/index.html'));

// Runtime cache for same-origin images/icons.
registerRoute(
  ({ url }) => url.origin === self.location.origin && url.pathname.endsWith('.png'),
  new StaleWhileRevalidate({ cacheName: 'images', plugins: [new ExpirationPlugin({ maxEntries: 50 })] }),
);

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// Notifications pushed by the desktop assistant (Web Push). They arrive even
// when the app is closed.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'LifeTracker', body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'LifeTracker', {
      body: data.body || '',
      tag: data.tag || 'lifetracker',
      renotify: true,
      icon: process.env.PUBLIC_URL + '/icon-192.png',
      badge: process.env.PUBLIC_URL + '/favicon.png',
      data: { url: data.url || process.env.PUBLIC_URL + '/' },
    }),
  );
});

// Focus (or open) the app when a notification is tapped.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || process.env.PUBLIC_URL + '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const client = clients.find((c) => 'focus' in c);
      if (client) return client.focus();
      return self.clients.openWindow(url);
    }),
  );
});
