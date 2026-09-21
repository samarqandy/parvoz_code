/* Google Analytics 4 va Meta Pixel — faqat ID sozlangan bo'lsa yuklanadi. */
(function () {
  var C = window.PARVOZ_CONFIG || {};

  // --- Google Analytics 4 ---
  if (C.GA4_ID) {
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(C.GA4_ID);
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', C.GA4_ID, { anonymize_ip: true });
  }

  // --- Meta (Instagram/Facebook) Pixel ---
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

  /* Bir joydan barcha tizimlarga hodisa yuborish.
     parvozTrack('Lead', { course: 'Shaxmat' }) */
  window.parvozTrack = function (name, params) {
    params = params || {};
    try { if (window.gtag) window.gtag('event', name, params); } catch (e) {}
    try { if (window.fbq) window.fbq('track', name, params); } catch (e) {}
    try { if (window.ym) window.ym(107153329, 'reachGoal', name, params); } catch (e) {}
  };
})();
