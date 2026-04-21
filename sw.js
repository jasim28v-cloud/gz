// ==================== VOID_LION - SERVICE WORKER ====================
const CACHE_NAME = 'void-lion-v2';
const urlsToCache = [
    '/',
    '/index.html',
    '/auth.html',
    '/css/style.css',
    '/js/firebase.js',
    '/js/auth.js',
    '/js/app.js',
    '/manifest.json'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
        ))
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    if (event.request.url.includes('firebaseio.com') || event.request.url.includes('cloudinary.com')) {
        return;
    }
    
    event.respondWith(
        caches.match(event.request).then(response => response || fetch(event.request))
    );
});

self.addEventListener('push', event => {
    const data = event.data?.json() || { title: 'VOID LION', body: 'لديك إشعار جديد' };
    
    const options = {
        body: data.body,
        icon: 'https://via.placeholder.com/192x192/00f2ff/000000?text=VL',
        badge: 'https://via.placeholder.com/72x72/00f2ff/000000?text=VL',
        vibrate: [200, 100, 200],
        data: { url: data.url || '/' },
        actions: [
            { action: 'open', title: 'فتح' },
            { action: 'close', title: 'إغلاق' }
        ]
    };
    
    event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    if (event.action === 'open' || !event.action) {
        event.waitUntil(clients.openWindow(event.notification.data.url));
    }
});
