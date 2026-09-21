/* Parvoz Davomat — service worker.
   Faqat panel qobig'ini keshlaydi; Supabase so'rovlari va sayt sahifalariga tegmaydi. */
const CACHE = 'parvoz-davomat-v3';
const SHELL = [
  '/davomat.html',
  '/assets/app.css',
  '/assets/app.js',
  '/assets/supabase.min.js',
  '/assets/logo-dark.webp',
  '/assets/logo.webp',
  '/favicon.png',
  '/app.webmanifest',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;          // Supabase, shriftlar — tegmaymiz
  if (!SHELL.includes(url.pathname)) return;                // faqat panel fayllari

  // Tarmoq birinchi, keshdan zaxira — yangilanishlar darhol yetib boradi
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match('/davomat.html')))
  );
});
