// URL del backend: sale SOLO de VITE_API_URL (inyectada en el build por
// scripts/vercel-build.js -> Frontend/js/env-config.js -> window.API_BASE).
// Se normaliza: sin espacios ni "/" final.
var API_BASE = (function(){
  var url = '';
  if (typeof window !== 'undefined' && window.API_BASE) url = String(window.API_BASE);
  url = url.trim().replace(/\/+$/, '');
  var esLocal = typeof location !== 'undefined' &&
    (location.hostname === 'localhost' || location.hostname === '127.0.0.1');
  if (!url && !esLocal) {
    // Produccion (Vercel) sin VITE_API_URL: avisar en consola, no asumir
    // el dominio actual ni localhost.
    console.error('Falta VITE_API_URL');
    return '';
  }
  // Desarrollo (localhost): mismo origen (el backend sirve el frontend).
  return url;
})();

// Enviar la cookie de sesion en TODOS los fetch por defecto
// (frontend en Vercel y backend en Railway = dominios distintos; sin
// credentials:'include' el navegador no envia la cookie y el backend
// responde 401). Se respeta cualquier credentials explicito que traiga
// la llamada original.
if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
  var _fetchClubMaster = window.fetch.bind(window);
  window.fetch = function (input, init) {
    init = init || {};
    if (!init.credentials) init.credentials = 'include';
    return _fetchClubMaster(input, init);
  };
}
