const CACHE = 'void-lion-v1';
const urls = ['./', './index.html', './auth.html', './css/style.css', './js/firebase.js', './js/auth.js', './js/app.js', './manifest.json'];

self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(urls))));
self.addEventListener('fetch', e => e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))));

self.addEventListener('push', e => {
    const d = e.data?.json() || { title: 'VOID LION', body: 'إشعار جديد' };
    e.waitUntil(self.registration.showNotification(d.title, { body: d.body, icon: './icon.png', vibrate: [200,100,200] }));
});

self.addEventListener('notificationclick', e => { e.notification.close(); e.waitUntil(clients.openWindow('./')); });
