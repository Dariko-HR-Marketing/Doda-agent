/* DODA: service worker ro'yxati (CSP uchun alohida fayl) */
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  addEventListener('load', function () {
    navigator.serviceWorker.register('./sw.js').catch(function () {});
  });
}
