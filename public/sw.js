const CACHE_NAME = 'xadrez-escolar-v1';
const urlsToCache = [
  '/',
  '/login.html',
  '/css/style.css',
  '/js/api.js',
  '/js/utils.js',
  '/pages/painel-publico.html',
  '/pages/admin-dashboard.html',
  '/pages/admin-usuarios.html',
  '/pages/admin-turmas.html',
  '/pages/admin-jogadores.html',
  '/pages/admin-torneios.html',
  '/pages/admin-torneio.html',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) return response;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      });
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names => {
      return Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)));
    })
  );
});
