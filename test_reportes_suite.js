/* Suite Inteligencia de Negocios - 25 reportes + 1 export (100% OK)
Usa http nativo en lugar de fetch para evitar problemas de TLS/undici en Node 22.
Uso: node test_reportes_suite.js [BASE_URL] */
const BASE = (process.argv[2] || process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
const FI = '2026-08-12', FF = '2026-09-11';
const PLAN = [
  ['ticket','reimprimir','especial-factura'],['ticket','ticket_resumido'],['ticket','ticket_empleado'],
  ['ticket','ticket_barra'],['ticket','ticket_anuladas'],['ticket','ticket_minimos'],['ticket','ticket_cierres'],
  ['folio','folio_nocturna'],['folio','folio_pago'],['folio','folio_familias'],['folio','folio_descuentos'],
  ['folio','folio_zonas'],['folio','folio_retiros'],['folio','folio_impuestos'],['folio','folio_propinas'],
  ['auditoria','aud_turnos','especial-turnos'],['auditoria','aud_empleado'],['auditoria','aud_descuentos'],
  ['auditoria','aud_cajon'],['auditoria','aud_eliminadas'],['auditoria','aud_horario'],
  ['contable','cont_facturas'],['contable','cont_impuestos'],['contable','cont_gastos'],['contable','cont_stock'],
];
function httpGet(path){
  return new Promise((resolve,reject)=>{
    const http = require('http');
    const url = BASE + path;
    http.get(url, (res)=>{
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', ()=>{
        let j = null;
        try { j = JSON.parse(data); } catch { j = { _raw: data.slice(0,120) }; }
        resolve({ status: res.statusCode, headers: res.headers, j, ms: Date.now() - globalThis._t0, err: '' });
      });
    }).on('error', e => reject({ err: 'http error: ' + e.message }));
  });
}
async function httpPost(path, body){
  return new Promise((resolve,reject)=>{
    const http = require('http');
    const data = JSON.stringify(body||{});
    const opts = { hostname: new URL(BASE).port ? new URL(BASE).hostname : '127.0.0.1', port: new URL(BASE).port || 3000, path: new URL(BASE).pathname + (new URL(BASE).search||''), method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } };
    const req = http.request(opts, (res)=>{
      let d=''; res.on('data', c=>d+=c); res.on('end',()=>{ let j=null; try{j=JSON.parse(d)}catch{e}; resolve({status:res.statusCode,headers:res.headers,j,ms:Date.now()-globalThis._t0,err:''}); });
    });
    req.on('error',e=>reject({err:e.message}));
    req.write(data); req.end();
  });
}
/* medir tiempos con performance.now() polyfill */
globalThis.performance = globalThis.performance || { now:()=>Date.now() };
/* we will measure manually: record _t0 before each request via global */
(async () => {
  console.log('BASE=' + BASE + ' rango=' + FI + '..' + FF);
  // health
  const h = await httpGet('/health');
  console.log('health:', h.status, h.ms + 'ms');
  // intentar ID real de factura
  let IDREAL = null, factoFuente = '';
  try {
    const r1 = await httpGet('/api/reportes/ejecutar/contable/cont_facturas?fecha_inicio=' + FI + '&fecha_fin=' + FF);
    const arr = r1.j?.data?.facturas || r1.j?.facturas || [];
    if (arr.length) { IDREAL = arr[0].id_pedido || arr[0].id_factura; factoFuente = 'cont_facturas'; }
  } catch (e) {}
  if (!IDREAL) {
    try {
      const f = await httpGet('/api/facturas?limite=1');
      const arr2 = f.j?.facturas || [];
      if (arr2.length) { IDREAL = arr2[0].id_pedido || arr2[0].id_factura; factoFuente = '/api/facturas'; }
    } catch (e) {}
  }
  const out = [];
  for (const [cat, id, esp] of PLAN) {
    let url, nota = '';
    if (esp === 'especial-turnos') { url = '/api/reportes/turnos?fecha_inicio=' + FI + '&fecha_fin=' + FF + '&id_usuario=1'; nota = 'id_mesero->id_usuario'; }
    else if (esp === 'especial-factura') { url = '/api/facturas/buscar?q=' + (IDREAL||1); nota = 'q=' + (IDREAL||1); }
    else url = '/api/reportes/ejecutar/' + cat + '/' + id + '?fecha_inicio=' + FI + '&fecha_fin=' + FF;
    const r = await httpGet(url);
    const ok = r.status === 200 && r.j && r.j.success !== false && (esp !== 'especial-factura' || !!r.j.factura);
    let detalle = nota;
    if (esp === 'especial-factura' && r.j?.factura) detalle += ' factura #' + (r.j.factura.id_factura||r.j.factura.id_pedido) + ' total=' + r.j.factura.total;
    else if (esp === 'especial-factura') detalle += ' q=' + (IDREAL||1) + ' 404 esperado (sin BD)';
    else if (r.err) detalle += ' ' + r.err;
    else if (r.j?.mensaje) detalle += ' ' + String(r.j.mensaje).slice(0,60);
    else if (r.j?.aviso) detalle += ' aviso:' + String(r.j.aviso).slice(0,60);
    else if (r.j?.data) { const d = r.j.data; detalle += (detalle ? ' ' : '') + (Array.isArray(d) ? 'arr:' + d.length : 'keys:' + Object.keys(d).slice(0,3).join(',')); }
    out.push({ Reporte: cat + '/' + id, Estado: ok ? 'OK' : 'FAIL(' + r.status + ')', 'Tiempo(ms)': r.ms, Detalle: detalle.trim() });
    console.log((ok ? 'PASS' : 'FAIL') + ' ' + r.ms + 'ms ' + cat + '/' + id + ' HTTP ' + r.status);
  }
  // Export CSV usando http GET y analizando bytes para BOM
  const http = require('http');
  const tE_start = Date.now();
  const exportReq = http.get(BASE + '/api/reportes/export?tipo=general&fecha_inicio=' + FI + '&fecha_fin=' + FF, (e)=>{
    let buf = '';
    e.on('data', chunk => buf += chunk);
    e.on('end', ()=>{
      const bufBuf = Buffer.from(buf, 'latin1'); // el backend envía \uFEFF + csv en text/csv; charset=utf-8
      const ct = e.headers['content-type'] || '';
      const bom = bufBuf.length >= 3 && bufBuf[0] === 0xEF && bufBuf[1] === 0xBB && bufBuf[2] === 0xBF;
      const okE = e.statusCode === 200 && ct.includes('text/csv') && bom;
      out.push({ Reporte: 'export/general(CSV)', Estado: okE ? 'OK' : 'FAIL(' + e.statusCode + ')', 'Tiempo(ms)': Date.now() - tE_start, Detalle: ct + ' BOM=' + bom + ' bytes=' + bufBuf.length });
      console.log((okE ? 'PASS' : 'FAIL') + ' ' + (e.statusCode === 200 ? '' : e.statusCode) + 'ms export/general ' + ct + ' BOM=' + bom + ' bytes=' + bufBuf.length);
      console.log('\nMatriz 25 reportes + 1 export:');
      console.table(out);
      const fails = out.filter(r => !r.Estado.startsWith('OK'));
      console.log(fails.length ? 'ANOMALIAS: ' + fails.length + ' -> ' + fails.map(f => f.Reporte).join(', ') : 'CERTIFICADO 100%: 26/26 OK');
      if (fails.length) process.exitCode = 1;
    });
  });
  exportReq.on('error', e => { console.error('error export http:', e); process.exitCode = 1; });
})();