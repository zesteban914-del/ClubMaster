function escapeHTML(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
if (typeof window !== 'undefined') {
  if (!window.escapeHTML) window.escapeHTML = escapeHTML;
  if (!window.escHtml) window.escHtml = escapeHTML;
  if (!window.escHTML) window.escHTML = escapeHTML;
  if (!window.cfgEsc) window.cfgEsc = escapeHTML;
  if (window.fetch && !window.__cmFetchAuth) {
    window.__cmFetchAuth = true;
    var _cmFetch = window.fetch.bind(window);
    window.fetch = function(url, opts) {
      if (typeof url === 'string' && url.indexOf('/api/') !== -1) {
        opts = opts || {};
        if (!opts.credentials) opts.credentials = 'include';
      }
      return _cmFetch(url, opts);
    };
  }
}
var MENSAJE_LIMITE = 'Límite de peticiones alcanzado. Por favor, espera unos segundos.';
function esErrorLimite(err) {
  if (!err) return false;
  if (err.status === 429 || err.statusCode === 429) return true;
  var m = String(err.mensaje || err.message || '');
  return /demasiad/i.test(m) && /intent|peticion|cobr|pin/i.test(m);
}
function textoErrorRed(err, generico) {
  if (esErrorLimite(err)) return MENSAJE_LIMITE;
  if (err && (err.mensaje || err.message)) return err.mensaje || err.message;
  return generico || 'No se pudo conectar con el servidor';
}
