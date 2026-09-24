const fs = require('fs');
const path = require('path');

const BASE = (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : process.env.STRESS_BASE) || 'http://localhost:3000';
const TIMEOUT_MS = Number(process.env.STRESS_TIMEOUT_MS || 15000);
const MESAS_OBJETIVO = Number(process.env.STRESS_MESAS || 10);
const BILL_DELAY_MS = Number(process.env.STRESS_BILL_DELAY_MS || 800);
const MANIFEST = path.join(__dirname, 'test_estres_manifest.json');

const USUARIOS = [
  { tag: 'mesero-1', correo: 'estres_m1@clubmaster.test', rol: 'mesero' },
  { tag: 'mesero-2', correo: 'estres_m2@clubmaster.test', rol: 'mesero' },
  { tag: 'cajero-1', correo: 'estres_c1@clubmaster.test', rol: 'cajero' },
  { tag: 'cajero-2', correo: 'estres_c2@clubmaster.test', rol: 'cajero' },
];
const PASSWORD = process.env.STRESS_PASSWORD || 'Estres123*';

const resumen = { fase: {}, errores: [] };

function clasificarError(err, contexto) {
  const msg = String((err && err.message) || err || '');
  let tipo = 'DESCONOCIDO';
  if (/aborted|abortion|timeout|AbortError/i.test(msg)) tipo = 'TIMEOUT_NODE';
  else if (/ECONNREFUSED|fetch failed|socket hang up|ECONNRESET|EPIPE/i.test(msg)) tipo = 'SERVIDOR_CAIDO';
  else if (/HTTP 500/i.test(msg)) tipo = 'HTTP_500';
  else if (/HTTP 429/i.test(msg)) tipo = 'HTTP_429_RATE_LIMIT';
  else if (/HTTP 403/i.test(msg)) tipo = 'HTTP_403_PERMISO';
  else if (/HTTP 400/i.test(msg)) tipo = 'HTTP_400_VALIDACION';
  else if (/Deadlock/i.test(msg)) tipo = 'MYSQL_DEADLOCK';
  else if (/Lock wait timeout/i.test(msg)) tipo = 'MYSQL_LOCK_WAIT_TIMEOUT';
  else if (/Too many connections/i.test(msg)) tipo = 'MYSQL_TOO_MANY_CONNECTIONS';
  else if (/Queue limit|pool is full|exceeded.*queue/i.test(msg)) tipo = 'POOL_COLA_LLENA';
  else if (/HTTP \d{3}/i.test(msg)) tipo = msg.match(/HTTP \d{3}/)[0].replace(' ', '_');
  resumen.errores.push({ contexto, tipo, detalle: msg.slice(0, 300) });
  return tipo;
}

async function req(metodo, ruta, sesion, cuerpo) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const t0 = Date.now();
  try {
    const opts = { method: metodo, signal: ctrl.signal, headers: { 'Content-Type': 'application/json' } };
    if (sesion && sesion.cookie) opts.headers.Cookie = sesion.cookie;
    if (cuerpo !== undefined) opts.body = JSON.stringify(cuerpo);
    const r = await fetch(BASE + ruta, opts);
    const setC = typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : [];
    if (sesion && setC.length) sesion.cookie = setC.map(c => c.split(';')[0]).join('; ');
    let data = null;
    try { data = await r.json(); } catch (e) { data = { sinJson: true }; }
    const ms = Date.now() - t0;
    if (!r.ok) {
      const e = new Error(`HTTP ${r.status} ${ruta}: ${(data && (data.mensaje || data.message)) || r.statusText}`);
      e.status = r.status; e.data = data; e.ms = ms;
      throw e;
    }
    return { data, ms };
  } catch (e) {
    if (e.name === 'AbortError') { const t = new Error(`Timeout Node (${TIMEOUT_MS}ms) ${metodo} ${ruta}`); t.ms = Date.now() - t0; throw t; }
    e.ms = e.ms !== undefined ? e.ms : Date.now() - t0;
    throw e;
  } finally { clearTimeout(tid); }
}

function stats(nombre, resultados) {
  const ok = resultados.filter(r => r.status === 'fulfilled');
  const fail = resultados.filter(r => r.status === 'rejected');
  const lat = ok.map(r => r.value.ms || 0).sort((a, b) => a - b);
  resumen.fase[nombre] = {
    total: resultados.length,
    exitosas: ok.length,
    fallidas: fail.length,
    latencia_ms: lat.length ? { min: lat[0], max: lat[lat.length - 1], p50: lat[Math.floor(lat.length / 2)] } : null,
  };
  fail.forEach(f => clasificarError(f.reason, nombre));
  return { ok: ok.map(r => r.value), fail: fail.map(f => f.reason) };
}

async function login(u) {
  const sesion = { cookie: '' };
  const { data, ms } = await req('POST', '/api/auth/login', sesion, { correo: u.correo, contrasena: PASSWORD });
  if (!data.exito && !data.success) throw new Error(`HTTP 401 /api/auth/login: ${data.mensaje || 'login rechazado'}`);
  const usr = data.usuario || {};
  return { ms, sesion, id_usuario: usr.id_usuario, nombre: usr.nombre, rol: usr.rol, tag: u.tag, tipo: u.rol };
}

async function main() {
  console.log(`BASE=${BASE} TIMEOUT=${TIMEOUT_MS}ms MESAS_OBJETIVO=${MESAS_OBJETIVO} BILL_DELAY=${BILL_DELAY_MS}ms`);
  const manifiesto = { idPedidos: [], mesas: [], ts: new Date().toISOString() };

  const t0 = Date.now();
  const rHealth = await Promise.allSettled(USUARIOS.map(u => login(u)));
  const logins = stats('login_concurrente', rHealth);
  console.log(`login: ${resumen.fase.login_concurrente.exitosas}/${resumen.fase.login_concurrente.total} ok`);
  if (logins.ok.length === 0) return finalizar(1, 'Sin logins: revisa usuarios de prueba y rate-limit (429).');

  const meseros = logins.ok.filter(s => s.tipo === 'mesero');
  const cajeros = logins.ok.filter(s => s.tipo === 'cajero');
  if (!meseros.length) return finalizar(1, 'Ningun mesero pudo entrar.');
  const sesRef = logins.ok[0].sesion;

  const { data: dj } = await req('GET', '/api/jornada/activa', sesRef).catch(e => { clasificarError(e, 'jornada_activa'); throw e; });
  const jornada = dj.jornada;
  if (!jornada) return finalizar(1, 'No hay jornada Abierta: abre caja antes del test.');
  console.log(`jornada abierta #${jornada.id_jornada}`);

  const { data: dm } = await req('GET', '/api/mesas', sesRef).catch(e => { clasificarError(e, 'listar_mesas'); throw e; });
  const libres = (dm.mesas || []).filter(m => m.estado === 'Disponible').slice(0, MESAS_OBJETIVO);
  console.log(`mesas disponibles para el test: ${libres.length}`);
  if (!libres.length) return finalizar(1, 'No hay mesas Disponibles.');

  const { data: dp } = await req('GET', '/api/productos/admin?estado=activos', sesRef).catch(e => { clasificarError(e, 'listar_productos'); throw e; });
  const prods = (dp.productos || []).filter(p => Number(p.stock) > 5 && Number(p.activo) === 1).slice(0, 3);
  if (prods.length < 2) return finalizar(1, 'Se requieren al menos 2 productos con stock>5.');
  console.log(`productos del test: ${prods.map(p => `${p.nombre}(stock ${p.stock})`).join(', ')}`);

  const detalle = (k) => prods.map((p, i) => ({
    id_producto: p.id_producto,
    cantidad: 1,
    precio_unitario: Number(p.precio) || 0,
    observaciones: `estres-${k}-${i}`,
    presentacion: 'Trago / Copa',
  }));

  const tareasComanda = libres.map((mesa, i) => {
    const mesero = meseros[i % meseros.length];
    return (async () => {
      const { data, ms } = await req('POST', '/api/pedidos', mesero.sesion, {
        id_mesa: mesa.id_mesa, id_usuario: mesero.id_usuario,
        id_jornada: jornada.id_jornada, detalles: detalle(i), id_mesero: mesero.id_usuario,
      });
      if (data.idPedido) manifiesto.idPedidos.push(data.idPedido);
      if (!manifiesto.mesas.find(m => m.id_mesa === mesa.id_mesa)) manifiesto.mesas.push({ id_mesa: mesa.id_mesa, numero: mesa.numero });
      return { ms, idPedido: data.idPedido, mesa: mesa.numero };
    })();
  });

  const promComandas = Promise.allSettled(tareasComanda);
  await new Promise(r => setTimeout(r, BILL_DELAY_MS));

  const tareasBilling = [];
  if (cajeros.length) {
    libres.forEach((mesa, i) => {
      const cajero = cajeros[i % cajeros.length];
      tareasBilling.push((async () => {
        const { data: dc } = await req('GET', `/api/mesas/${mesa.id_mesa}/cuenta?t=${Date.now()}`, cajero.sesion);
        const total = Number(dc.total || 0);
        const cubre = total > 0 ? total : 1;
        const { data, ms } = await req('POST', '/api/facturar-dividido', cajero.sesion, {
          id_mesa: mesa.id_mesa, id_usuario: cajero.id_usuario, id_jornada: jornada.id_jornada,
          pagos: [{ metodo_pago: 'Efectivo', monto: cubre, cubre }],
        });
        (data.id_pedido ? [data.id_pedido] : []).forEach(id => { if (!manifiesto.idPedidos.includes(id)) manifiesto.idPedidos.push(id); });
        return { ms, mesa: mesa.numero, total, mesaLiberada: data.mesaLiberada };
      })());
    });
  }
  const promBilling = Promise.allSettled(tareasBilling);

  const comandas = stats('comandas_simultaneas', await promComandas);
  const billing = stats('facturacion_cruzada', await promBilling);
  console.log(`comandas: ${resumen.fase.comandas_simultaneas.exitosas}/${resumen.fase.comandas_simultaneas.total} ok`);
  console.log(`facturacion: ${resumen.fase.facturacion_cruzada.exitosas}/${resumen.fase.facturacion_cruzada.total} ok`);

  if (!tareasBilling.length) { fs.writeFileSync(MANIFEST, JSON.stringify(manifiesto, null, 1)); return finalizar(1, 'Sin cajeros logueados: fase de facturacion NO ejecutada.'); }
  fs.writeFileSync(MANIFEST, JSON.stringify(manifiesto, null, 1));
  console.log(`manifiesto: ${manifiesto.idPedidos.length} pedidos en ${MANIFEST}`);

  const criticos = resumen.errores.filter(e => /TIMEOUT_NODE|SERVIDOR_CAIDO|HTTP_500|MYSQL_|POOL_/.test(e.tipo));
  finalizar(criticos.length ? 1 : 0, criticos.length ? 'Cuello de botella detectado (ver reporte).' : 'Sin bloqueos criticos.');
  console.log(`\nTOTAL ${(Date.now() - t0)}ms`);
}

function finalizar(code, nota) {
  const porTipo = {};
  resumen.errores.forEach(e => { porTipo[e.tipo] = (porTipo[e.tipo] || 0) + 1; });
  console.log('\n===== REPORTE FINAL =====');
  for (const [f, r] of Object.entries(resumen.fase)) {
    console.log(`- ${f}: total=${r.total} ok=${r.exitosas} fail=${r.fallidas}` +
      (r.latencia_ms ? ` lat_min=${r.latencia_ms.min}ms p50=${r.latencia_ms.p50}ms max=${r.latencia_ms.max}ms` : ''));
  }
  console.log('errores por tipo:', JSON.stringify(porTipo));
  resumen.errores.slice(0, 15).forEach(e => console.log(`  [${e.tipo}] ${e.contexto}: ${e.detalle}`));
  const criticos = resumen.errores.filter(e => /TIMEOUT_NODE|SERVIDOR_CAIDO|HTTP_500|MYSQL_|POOL_/.test(e.tipo));
  if (!resumen.errores.length) console.log('veredicto: pool y backend soportaron la carga sin fallos.');
  else if (!criticos.length) console.log('veredicto: sin bloqueos de pool/locks; fallos funcionales o de permisos/validacion (ver tipos).');
  else console.log('veredicto: CUELLO DE BOTELLA: ' + criticos.map(c => c.tipo).join(', '));
  console.log(`nota: ${nota}`);
  process.exit(code);
}

if (process.argv.includes('--setup')) {
  require('C:/Users/juan esteban/OneDrive/Desktop/ClubMaster/node_modules/dotenv')
    .config({ path: 'C:/Users/juan esteban/OneDrive/Desktop/ClubMaster/Backend/.env' });
  const m = require('C:/Users/juan esteban/OneDrive/Desktop/ClubMaster/Backend/config/database.js');
  (async () => {
    try {
      const roles = { mesero: 3, cajero: 4 };
      for (const u of USUARIOS) {
        await m.poolReal.query(
          'INSERT INTO usuarios (nombre, correo, contrasena, id_rol, activo) VALUES (?,?,?,?,1) ON DUPLICATE KEY UPDATE contrasena=VALUES(contrasena), id_rol=VALUES(id_rol), activo=1',
          [`ESTRES ${u.tag}`, u.correo, PASSWORD, roles[u.rol]]);
      }
      console.log('usuarios de prueba listos (4).');
    } catch (e) { console.log('SETUP ERROR:', e.message); process.exitCode = 1; }
    process.exit(0);
  })();
} else if (process.argv.includes('--cleanup')) {
  require('C:/Users/juan esteban/OneDrive/Desktop/ClubMaster/node_modules/dotenv')
    .config({ path: 'C:/Users/juan esteban/OneDrive/Desktop/ClubMaster/Backend/.env' });
  const m = require('C:/Users/juan esteban/OneDrive/Desktop/ClubMaster/Backend/config/database.js');
  (async () => {
    try {
      let mani = { idPedidos: [], mesas: [] };
      try { mani = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch (e) {}
      if (mani.idPedidos.length) {
        const ph = mani.idPedidos.map(() => '?').join(',');
        await m.poolReal.query(`DELETE FROM detalle_pedido WHERE id_pedido IN (${ph})`, mani.idPedidos);
        await m.poolReal.query(`DELETE FROM pedidos WHERE id_pedido IN (${ph})`, mani.idPedidos);
      }
      for (const mt of mani.mesas) {
        await m.poolReal.query('UPDATE mesas SET estado=\'Disponible\', id_mesero=NULL, fecha_ocupacion=NULL WHERE id_mesa=? AND NOT EXISTS (SELECT 1 FROM pedidos WHERE id_mesa=? AND estado=\'Pendiente\')', [mt.id_mesa, mt.id_mesa]);
      }
      await m.poolReal.query('DELETE FROM usuarios WHERE correo LIKE \'estres\\_%@clubmaster.test\'');
      console.log(`limpieza ok: ${mani.idPedidos.length} pedidos eliminados, usuarios de prueba borrados.`);
    } catch (e) { console.log('CLEANUP ERROR:', e.message); process.exitCode = 1; }
    process.exit(0);
  })();
} else {
  main().catch(e => { clasificarError(e, 'general'); finalizar(1, e.message); });
}
