/* Parvoz Davomat — service worker.
   Faqat panel qobig'ini keshlaydi; Supabase so'rovlari va sayt sahifalariga tegmaydi. */
const CACHE = 'parvoz-davomat-v4';
const NET_TIMEOUT = 4000;   // sekin internetda keshdagi qobiq 4 soniyadan keyin ochiladi
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

  // Tarmoq birinchi, keshdan zaxira — yangilanishlar darhol yetib boradi.
  // Sekin tarmoqda 4 soniyadan keyin keshdagi nusxa ochiladi (tarmoq javobi baribir keshni yangilaydi).
  const network = fetch(req).then((res) => {
    // Faqat to'g'ri javob keshlanadi: 404/5xx yoki portal sahifasi yaxshi nusxani bosib ketmasin
    if (res.ok && res.type === 'basic') {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    }
    // Xato javob: yaxshi nusxa bo'lsa panel shuni oladi (deploy paytidagi 404/502 paneli buzmasin)
    return caches.match(req).then((old) => old || res);
  });
  const cached = () => caches.match(req).then((r) => r || (req.mode === 'navigate' ? caches.match('/davomat.html') : undefined));
  network.catch(() => {});   // keshdagi nusxa yutsa, keyingi tarmoq xatosi "unhandled" bo'lmasin
  const slow = new Promise((resolve) => setTimeout(() => cached().then(resolve), NET_TIMEOUT));
  e.respondWith(
    Promise.race([network.catch(() => cached()), slow]).then((r) => r || network)
  );
});
