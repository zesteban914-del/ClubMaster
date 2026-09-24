const fs = require('fs');
const path = require('path');

const BASE = (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : process.env.CHAOS_BASE) || 'http://localhost:3000';
const TIMEOUT_MS = Number(process.env.CHAOS_TIMEOUT_MS || 15000);
const MANIFEST = path.join(__dirname, 'test_seguridad_manifest.json');

const CORREO_MESERO = 'chaos_mesero@clubmaster.test';
const PASSWORD = process.env.CHAOS_PASSWORD || 'Chaos123*';

const reporte = [];

function veredicto(id, titulo, esperado, obtenido, dbAlterada, detalle) {
  const protegido = !dbAlterada && esperado === obtenido;
  reporte.push({ id, titulo, esperado, obtenido, dbAlterada: !!dbAlterada, veredicto: protegido ? 'PROTEGIDO' : 'VULNERABLE', detalle: String(detalle || '').slice(0, 250) });
  console.log(`${protegido ? 'OK  ' : 'FALLO'} [${id}] ${titulo} -> HTTP ${obtenido} (esperado ${esperado}) DB alterada: ${dbAlterada ? 'SI' : 'no'}`);
  return protegido;
}

async function req(metodo, ruta, sesion, cuerpo) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const opts = { method: metodo, signal: ctrl.signal, headers: { 'Content-Type': 'application/json' } };
    if (sesion && sesion.cookie) opts.headers.Cookie = sesion.cookie;
    if (cuerpo !== undefined) opts.body = JSON.stringify(cuerpo);
    const r = await fetch(BASE + ruta, opts);
    const setC = typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : [];
    if (sesion && setC.length) sesion.cookie = setC.map(c => c.split(';')[0]).join('; ');
    let data = null;
    try { data = await r.json(); } catch (e) { data = {}; }
    return { status: r.status, data };
  } finally { clearTimeout(tid); }
}

function db() {
  require('C:/Users/juan esteban/OneDrive/Desktop/ClubMaster/node_modules/dotenv')
    .config({ path: 'C:/Users/juan esteban/OneDrive/Desktop/ClubMaster/Backend/.env' });
  return require('C:/Users/juan esteban/OneDrive/Desktop/ClubMaster/Backend/config/database.js');
}

async function main() {
  console.log(`BASE=${BASE}`);
  const mani = { idVales: [], idPedidos: [], mesas: [], idTestProduct: null, ts: new Date().toISOString() };
  const { poolReal } = db();
  const q = (sql, p) => poolReal.query(sql, p).then(r => r[0]);
  try {
    const det = require('C:/Users/juan esteban/OneDrive/Desktop/ClubMaster/Backend/helpers/column-detection.js');
    await det.detectarColumnasProductos(poolReal);
  } catch (e) {}

  const sesMesero = { cookie: '' };
  const lr = await req('POST', '/api/auth/login', sesMesero, { correo: CORREO_MESERO, contrasena: PASSWORD });
  if (lr.status !== 200 || (!lr.data.exito && !lr.data.success)) {
    console.log('Sin mesero de prueba: ejecuta "node test_seguridad_fallos.js --setup" primero.');
    process.exit(2);
  }
  const mesero = lr.data.usuario;
  console.log(`mesero: ${mesero.nombre} (rol ${mesero.rol})`);
  const sesAnon = { cookie: '' };

  const jr = await req('GET', '/api/jornada/activa', sesMesero);
  const jornada = jr.data.jornada;
  if (!jornada) { console.log('No hay jornada Abierta.'); process.exit(2); }
  const mesas = (await req('GET', '/api/mesas', sesMesero)).data.mesas.filter(m => m.estado === 'Disponible');
  if (mesas.length < 3) { console.log('Se requieren 3 mesas Disponibles.'); process.exit(2); }
  const prods = (await req('GET', '/api/productos/admin?estado=activos', sesMesero)).data.productos.filter(p => Number(p.stock) > 5 && Number(p.activo) === 1);
  if (prods.length < 2) { console.log('Se requieren 2 productos con stock>5.'); process.exit(2); }
  const P = prods[0];

  const clienteService = require('C:/Users/juan esteban/OneDrive/Desktop/ClubMaster/Backend/services/cliente-service.js');
  const jornadaService = require('C:/Users/juan esteban/OneDrive/Desktop/ClubMaster/Backend/services/jornada-service.js');
  const valeFx = await clienteService.crearVale('CHAOS TEST', null, 50000, mesero.id_usuario, { referencia: 'chaos' });
  mani.idVales.push(valeFx.id_vale);
  const pedFx = await jornadaService.crearPedido(mesas[0].id_mesa, mesero.id_usuario, jornada.id_jornada,
    [{ id_producto: P.id_producto, cantidad: 1, precio_unitario: Number(P.precio) }], mesero.id_usuario);
  mani.idPedidos.push(pedFx.idPedido);
  mani.mesas.push({ id_mesa: mesas[0].id_mesa }, { id_mesa: mesas[1].id_mesa }, { id_mesa: mesas[2].id_mesa });
  console.log(`fixtures: vale #${valeFx.id_vale}, pedido #${pedFx.idPedido} en mesa ${mesas[0].numero}`);

  const valeAntes = (await q('SELECT saldo_pendiente, estado FROM cuentas_por_cobrar WHERE id_vale=?', [valeFx.id_vale]))[0];
  const e1 = await req('POST', `/api/vales/${valeFx.id_vale}/liquidar`, sesMesero, { metodo_pago: 'Efectivo', id_usuario: mesero.id_usuario });
  const valeDespues = (await q('SELECT saldo_pendiente, estado FROM cuentas_por_cobrar WHERE id_vale=?', [valeFx.id_vale]))[0];
  veredicto('E1', 'Mesero liquida vale', 403, e1.status, Number(valeDespues.saldo_pendiente) !== Number(valeAntes.saldo_pendiente), e1.data.mensaje);

  const prodTest = await q('SELECT id_producto FROM productos WHERE id_producto=?', [mani.idTestProduct || 0]);
  let idT = mani.idTestProduct;
  if (!prodTest.length) {
    const productoService = require('C:/Users/juan esteban/OneDrive/Desktop/ClubMaster/Backend/services/producto-service.js');
    idT = await productoService.insertarProducto({ nombre: 'CHAOS TEST', precio: 1000, categoria: 'General', stock_minimo: 0 });
    mani.idTestProduct = idT;
  }
  const e2 = await req('DELETE', `/api/productos/${idT}`, sesMesero);
  const tDespues = (await q('SELECT activo FROM productos WHERE id_producto=?', [idT]))[0];
  veredicto('E2', 'Mesero elimina producto', 403, e2.status, tDespues && Number(tDespues.activo) !== 1, e2.data.mensaje);

  const pedAntes = (await q('SELECT estado FROM pedidos WHERE id_pedido=?', [pedFx.idPedido]))[0];
  const e3 = await req('POST', `/api/mesas/${mesas[0].id_mesa}/cancelar-pedido`, sesMesero, { motivo: 'chaos', id_usuario: mesero.id_usuario });
  const pedDespues = await q('SELECT estado FROM pedidos WHERE id_pedido=?', [pedFx.idPedido]);
  veredicto('E3', 'Mesero cancela pedido sin PIN', 403, e3.status, pedDespues.length === 0 || (pedAntes && pedDespues[0] && pedDespues[0].estado !== pedAntes.estado), e3.data.mensaje);

  const orig = (await q('SELECT nombre, precio_venta AS precio FROM productos WHERE id_producto=?', [P.id_producto]))[0];
  const e4 = await req('PUT', `/api/productos/${P.id_producto}`, sesMesero, { nombre: orig.nombre, precio: Number(orig.precio) + 1, id_usuario: mesero.id_usuario });
  const precDespues = (await q('SELECT precio_venta AS precio FROM productos WHERE id_producto=?', [P.id_producto]))[0];
  veredicto('E4', 'Mesero cambia precio', 403, e4.status, Number(precDespues.precio) !== Number(orig.precio), e4.data.mensaje);
  if (Number(precDespues.precio) !== Number(orig.precio)) await q('UPDATE productos SET precio_venta=? WHERE id_producto=?', [orig.precio, P.id_producto]);

  const nPedAntes = (await q('SELECT COUNT(*) AS n FROM pedidos WHERE id_mesa=?', [mesas[1].id_mesa]))[0].n;
  const e5 = await req('POST', '/api/pedidos', sesAnon, { id_mesa: mesas[1].id_mesa, id_usuario: mesero.id_usuario, id_jornada: jornada.id_jornada, detalles: [{ id_producto: P.id_producto, cantidad: 1, precio_unitario: Number(P.precio) }] });
  const nPedDespues = (await q('SELECT COUNT(*) AS n FROM pedidos WHERE id_mesa=?', [mesas[1].id_mesa]))[0].n;
  const nuevos = await q('SELECT id_pedido FROM pedidos WHERE id_mesa=? ORDER BY id_pedido DESC LIMIT 1', [mesas[1].id_mesa]);
  if (nPedDespues > nPedAntes && nuevos.length) mani.idPedidos.push(nuevos[0].id_pedido);
  veredicto('E5', 'Comanda sin sesion', 401, e5.status, nPedDespues > nPedAntes, e5.data.mensaje);

  const stockAntes = (await q('SELECT stock FROM productos WHERE id_producto=?', [P.id_producto]))[0].stock;
  const t1 = await req('POST', '/api/pedidos', sesMesero, { id_mesa: mesas[1].id_mesa, id_usuario: mesero.id_usuario, id_jornada: jornada.id_jornada, detalles: [{ id_producto: P.id_producto, cantidad: -5, precio_unitario: Number(P.precio) }] });
  const stockT1 = (await q('SELECT stock FROM productos WHERE id_producto=?', [P.id_producto]))[0].stock;
  const pedT1 = (await q('SELECT COUNT(*) AS n FROM pedidos WHERE id_mesa=?', [mesas[1].id_mesa]))[0].n;
  veredicto('T1', 'Comanda cantidad negativa', 400, t1.status, Number(stockT1) !== Number(stockAntes) || pedT1 > nPedDespues, t1.data.mensaje);

  const precioReal = Number((await q('SELECT precio_venta AS precio FROM productos WHERE id_producto=?', [P.id_producto]))[0].precio);
  const precioFalso = Math.max(100, Math.floor(precioReal / 2));
  const t2 = await req('POST', '/api/pedidos', sesMesero, { id_mesa: mesas[2].id_mesa, id_usuario: mesero.id_usuario, id_jornada: jornada.id_jornada, detalles: [{ id_producto: P.id_producto, cantidad: 1, precio_unitario: precioFalso }] });
  let precioGuardado = null;
  if (t2.data && t2.data.idPedido) {
    mani.idPedidos.push(t2.data.idPedido);
    const det = await q('SELECT precio_unitario, subtotal FROM detalle_pedido WHERE id_pedido=? LIMIT 1', [t2.data.idPedido]);
    if (det.length) precioGuardado = Number(det[0].precio_unitario);
  }
  const t2Obtenido = precioGuardado === null ? ('HTTP ' + t2.status) : (precioGuardado === precioReal ? ('DB(' + precioReal + ')') : ('guardado ' + precioGuardado));
  veredicto('T2', 'Precio manipulado desde cliente', 'DB(' + precioReal + ')', t2Obtenido, precioGuardado !== null && precioGuardado !== precioReal, `cliente envio ${precioFalso}, DB ${precioReal}, guardado ${precioGuardado}`);

  const nR0 = (await q('SELECT COUNT(*) AS n FROM pedidos WHERE id_mesa=?', [mesas[1].id_mesa]))[0].n;
  const sR0 = (await q('SELECT stock FROM productos WHERE id_producto=?', [P.id_producto]))[0].stock;
  const r1 = await req('POST', '/api/pedidos', sesMesero, { id_mesa: mesas[1].id_mesa, id_usuario: mesero.id_usuario, id_jornada: jornada.id_jornada, detalles: [{ id_producto: P.id_producto, cantidad: 1, precio_unitario: Number(P.precio) }, { id_producto: 999999, cantidad: 1, precio_unitario: 1000 }] });
  const nR1 = (await q('SELECT COUNT(*) AS n FROM pedidos WHERE id_mesa=?', [mesas[1].id_mesa]))[0].n;
  const sR1 = (await q('SELECT stock FROM productos WHERE id_producto=?', [P.id_producto]))[0].stock;
  veredicto('R1', 'Item invalido revierte todo', 400, r1.status, nR1 !== nR0 || Number(sR1) !== Number(sR0), r1.data.mensaje);

  fs.writeFileSync(MANIFEST, JSON.stringify(mani, null, 1));
  const vulns = reporte.filter(r => r.veredicto === 'VULNERABLE');
  console.log('\n===== REPORTE DE VULNERABILIDADES =====');
  reporte.forEach(r => console.log(`[${r.veredicto}] ${r.id} ${r.titulo} | esperado ${r.esperado}, obtenido ${r.obtenido} | ${r.detalle}`));
  console.log(`\nTotal: ${reporte.length - vulns.length}/${reporte.length} protegidos, ${vulns.length} vulnerables.`);
  if (!vulns.length) console.log('veredicto: el backend rechazo todos los ataques.');
  else console.log('veredicto: FALLO EN PROTECCION: ' + vulns.map(v => v.id).join(', '));
  process.exit(vulns.length ? 1 : 0);
}

if (process.argv.includes('--setup')) {
  (async () => {
    const { poolReal } = db();
    try {
      await poolReal.query(
        'INSERT INTO usuarios (nombre, correo, contrasena, id_rol, activo) VALUES (?,?,?,3,1) ON DUPLICATE KEY UPDATE contrasena=VALUES(contrasena), id_rol=3, activo=1',
        ['CHAOS Mesero', CORREO_MESERO, PASSWORD]);
      console.log('usuario chaos_mesero listo.');
    } catch (e) { console.log('SETUP ERROR:', e.message); process.exitCode = 1; }
    process.exit(0);
  })();
} else if (process.argv.includes('--cleanup')) {
  (async () => {
    const { poolReal } = db();
    try {
      let mani = { idVales: [], idPedidos: [], mesas: [], idTestProduct: null };
      try { mani = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch (e) {}
      if (mani.idPedidos.length) {
        const ph = mani.idPedidos.map(() => '?').join(',');
        await poolReal.query(`DELETE FROM detalle_pedido WHERE id_pedido IN (${ph})`, mani.idPedidos);
        await poolReal.query(`DELETE FROM pedidos WHERE id_pedido IN (${ph})`, mani.idPedidos);
      }
      for (const idV of mani.idVales) {
        await poolReal.query('DELETE FROM movimientos_caja WHERE concepto LIKE ?', [`Vale #${idV} (%`]);
        await poolReal.query('DELETE FROM abonos_vales WHERE id_vale=?', [idV]);
        await poolReal.query('DELETE FROM cuentas_por_cobrar WHERE id_vale=?', [idV]);
      }
      if (mani.idTestProduct) await poolReal.query('DELETE FROM productos WHERE id_producto=?', [mani.idTestProduct]);
      for (const mt of mani.mesas) {
        await poolReal.query('UPDATE mesas SET estado=\'Disponible\', id_mesero=NULL, fecha_ocupacion=NULL WHERE id_mesa=? AND NOT EXISTS (SELECT 1 FROM pedidos WHERE id_mesa=? AND estado=\'Pendiente\')', [mt.id_mesa, mt.id_mesa]);
      }
      await poolReal.query('DELETE FROM usuarios WHERE correo=?', [CORREO_MESERO]);
      console.log('limpieza chaos ok.');
    } catch (e) { console.log('CLEANUP ERROR:', e.message); process.exitCode = 1; }
    process.exit(0);
  })();
} else {
  main().catch(e => { console.log('FALLO GENERAL:', e.message); process.exit(2); });
}
