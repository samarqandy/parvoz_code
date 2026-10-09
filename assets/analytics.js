/* Google tag (GA4 + Google Ads) va Meta Pixel — faqat ID sozlangan bo'lsa yuklanadi.
   Qo'shimcha: reklama manbasini (UTM, gclid...) eslab qoladi va ariza bilan birga yuboradi;
   telefon / Telegram / WhatsApp bosilishlarini hodisa sifatida yuboradi. */
(function () {
  var C = window.PARVOZ_CONFIG || {};
  var YM_ID = 107153329;

  /* ---------- Reklama manbasi (attribution) ----------
     Reklamadan kelgan odam ariza qoldirguncha bir necha sahifa ko'rishi mumkin, shuning uchun UTM va
     reklama bosish identifikatorlari (gclid, ...) brauzerda 90 kun saqlanadi. Faqat shu brauzerda,
     uchinchi tomonga yuborilmaydi — ariza yuborilganda serverga bitta paket bo'lib ketadi. */
  var KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
              'gclid', 'gbraid', 'wbraid', 'yclid', 'fbclid'];
  var STORE = 'parvoz_attr';
  var TTL = 90 * 86400000;

  function load() {
    try {
      var v = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (v && v.ts && Date.now() - v.ts < TTL) return v;
    } catch (e) {}
    return null;
  }
  function save(v) { try { localStorage.setItem(STORE, JSON.stringify(v)); } catch (e) {} }
  function externalReferrer() {
    try {
      if (!document.referrer) return '';
      var u = new URL(document.referrer);
      if (u.host === location.host) return '';
      return (u.origin + u.pathname).slice(0, 200);          // so'rov qismisiz
    } catch (e) { return ''; }
  }
  function fromUrl() {
    var out = {};
    try {
      var p = new URLSearchParams(location.search);
      KEYS.forEach(function (k) { var v = p.get(k); if (v) out[k] = String(v).slice(0, 200); });
    } catch (e) {}
    return out;
  }

  var store = load() || { ts: Date.now(), first: null, last: null };
  var cur = fromUrl();
  var touch = { landing: location.pathname, referrer: externalReferrer(), ts: Date.now() };
  if (Object.keys(cur).length) {
    // Yangi reklama bosilishi: oxirgi tegish yangilanadi (Google Ads ham oxirgi bosishni hisoblaydi)
    for (var k in cur) touch[k] = cur[k];
    store.last = touch;
    store.ts = Date.now();
    if (!store.first) store.first = touch;
    save(store);
  } else if (!store.first) {
    store.first = touch;
    save(store);
  }
  var memStore = store;   // localStorage ishlamasa ham shu sahifa ichida to'g'ri

  /* Ariza bilan yuboriladigan paket: oxirgi reklama bosilishi bo'lsa — o'sha, bo'lmasa birinchi tashrif */
  window.parvozAttribution = function () {
    var t = memStore.last || memStore.first || {};
    var out = {};
    KEYS.concat(['landing', 'referrer']).forEach(function (k) { if (t[k]) out[k] = t[k]; });
    return out;
  };

  /* ---------- Google tag: GA4 va/yoki Google Ads ---------- */
  var GA4 = C.GA4_ID, ADS = C.GOOGLE_ADS_ID, LABELS = C.ADS_LABELS || {};
  var gId = GA4 || ADS;
  if (gId) {
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(gId);
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    if (GA4) window.gtag('config', GA4, { anonymize_ip: true });
    if (ADS) window.gtag('config', ADS);
  }

  /* ---------- Meta (Instagram/Facebook) Pixel ---------- */
  if (C.META_PIXEL) {
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', C.META_PIXEL);
    window.fbq('track', 'PageView');
  }

  /* Google Ads konversiyasi: ADS_LABELS[kalit] ("AbCdEfGhIj") kiritilgan bo'lsagina */
  function adsConversion(key, params) {
    if (!window.gtag || !ADS || !LABELS[key]) return;
    var p = { send_to: ADS + '/' + LABELS[key] };
    for (var k in (params || {})) p[k] = params[k];
    window.gtag('event', 'conversion', p);
  }

  /* Bir joydan barcha tizimlarga hodisa yuborish.
       parvozTrack('Lead', { course: 'Shaxmat' })        — ariza yuborildi
       parvozTrack('Contact', { method: 'phone' })       — telefon / telegram / whatsapp bosildi
       parvozTrack('FormStart')                          — forma to'ldirila boshlandi */
  var YM_NAME = { phone: 'ClickPhone', telegram: 'ClickTelegram', whatsapp: 'ClickWhatsApp' };
  window.parvozTrack = function (name, params) {
    params = params || {};
    var method = params.method;
    try {
      if (window.gtag) {
        if (name === 'Lead') window.gtag('event', 'generate_lead', params);
        else if (name === 'Contact') window.gtag('event', 'contact', params);
        else window.gtag('event', name, params);
      }
    } catch (e) {}
    try {
      if (name === 'Lead') adsConversion('lead');
      else if (name === 'Contact' && method) adsConversion(method);
    } catch (e) {}
    try { if (window.fbq) window.fbq('track', name === 'FormStart' ? 'InitiateCheckout' : name, params); } catch (e) {}
    try {
      if (window.ym) window.ym(YM_ID, 'reachGoal', name === 'Contact' && YM_NAME[method] ? YM_NAME[method] : name, params);
    } catch (e) {}
  };

  /* Telefon / WhatsApp / Telegram havolalari bosilishi (butun sayt bo'yicha, bitta joydan) */
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var h = a.getAttribute('href') || '';
    var m = h.indexOf('tel:') === 0 ? 'phone'
      : /^https?:\/\/(wa\.me|api\.whatsapp\.com)\//i.test(h) ? 'whatsapp'
      : /^https?:\/\/t\.me\//i.test(h) ? 'telegram' : '';
    if (m) window.parvozTrack('Contact', { method: m, page: location.pathname });
  }, true);

  /* Forma birinchi marta bosilganda — voronka uchun (bir sahifa ochilishida bir marta) */
  var started = false;
  document.addEventListener('focusin', function (e) {
    if (started || !e.target || !e.target.closest || !e.target.closest('#leadForm')) return;
    started = true;
    window.parvozTrack('FormStart', { page: location.pathname });
  });
})();
