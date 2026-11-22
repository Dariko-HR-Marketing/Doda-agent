/* DODA service worker: ilova qobig'i oflayn ochilishi uchun. API va boshqa saytlar KESHLANMAYDI (maxfiylik).
   Strategiya: tarmoq birinchi, yo'q bo'lsa keshdan. Yangilanish avtomatik (eski kesh versiyasi o'chiriladi). */
const VERSION = 'doda-shell-v3';
const SHELL = ['./', './index.html', './app-min.css', './app-min.js', './auth.css', './auth.js', './tasks.css', './tasks.js', './agents.css', './agents.js', './keys.js', './today.js', './pwa.js', './workspace.css', './workspace.js', './manifest.webmanifest', './icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => Promise.allSettled(SHELL.map((u) => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // API (boshqa domen), shriftlar va h.k. brauzerga qoldiriladi
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))),
  );
});
