const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');

async function getCols(conn, tabla) {
  try { const [c] = await conn.query(`SHOW COLUMNS FROM \`${tabla}\``); return c.map(x => x.Field); }
  catch (e) { return []; }
}

async function seedTestBugs() {
  const conn = await pool.getConnection();
  const ids = {};
  try {
    console.log('=== SEED TEST-BUGS (casos edge, idempotente) ===');
    const colProd = await getCols(conn, 'productos');
    const colJor = await getCols(conn, 'jornadas');
    const colUsr = await getCols(conn, 'usuarios');
    const colCli = await getCols(conn, 'clientes_socios');
    const colProv = await getCols(conn, 'proveedores');
    const colVale = await getCols(conn, 'cuentas_por_cobrar');
    const precioVentaCol = colProd.includes('precio_venta') ? 'precio_venta' : (colProd.includes('precio') ? 'precio' : null);
    const costoCol = colProd.includes('precio_costo') ? 'precio_costo' : (colProd.includes('costo') ? 'costo' : null);

    // ---------- 0. Limpieza idempotente de marcadores TEST-BUG ----------
    try { await conn.query("DELETE FROM productos WHERE nombre LIKE '%TEST-BUG%' OR nombre LIKE '%XSS%'"); } catch (e) {}
    try { await conn.query("DELETE FROM clientes_socios WHERE documento LIKE 'TEST-BUG%' OR nombre LIKE '%XSS%'"); } catch (e) {}
    try { await conn.query("DELETE FROM proveedores WHERE nit LIKE 'TEST-BUG%' OR nombre LIKE '%XSS%'"); } catch (e) {}
    try { await conn.query("DELETE FROM usuarios WHERE correo LIKE 'test-bug-%@clubmaster.test'"); } catch (e) {}
    try { await conn.query("DELETE FROM abonos_vales WHERE referencia LIKE 'TEST-BUG%'"); } catch (e) {}
    try { await conn.query("DELETE FROM cuentas_por_cobrar WHERE referencia LIKE 'TEST-BUG%'"); } catch (e) {}
    console.log('Limpieza de marcadores previa OK.');

    // ---------- 1. MULTIPLES JORNADAS (2 cerradas + 1 abierta, id != 1) ----------
    // Garantizar AUTO_INCREMENT alto para que ningun id sea 1
    try {
      const [mx] = await conn.query('SELECT COALESCE(MAX(id_jornada),0) AS m FROM jornadas');
      if (Number(mx[0].m) < 10) await conn.query('ALTER TABLE jornadas AUTO_INCREMENT = 10');
    } catch (e) { console.log('auto_inc aviso:', e.message); }
    async function crearJornada(fechaAp, fechaCi, estado, monto, uid, barra) {
      const cols = [], vals = [], ph = [];
      const add = (c, v) => { if (colJor.includes(c)) { cols.push(c); vals.push(v); ph.push('?'); } };
      add('fecha_apertura', fechaAp);
      if (colJor.includes('fecha')) add('fecha', fechaAp);
      if (fechaCi) add('fecha_cierre', fechaCi);
      add('monto_inicial', monto);
      add('estado', estado);
      add('id_usuario', uid);
      if (colJor.includes('barra_asignada')) add('barra_asignada', barra);
      if (estado === 'Cerrada') {
        if (colJor.includes('total_efectivo_esperado')) add('total_efectivo_esperado', monto + 500000);
        if (colJor.includes('total_efectivo_real')) add('total_efectivo_real', monto + 495000);
        if (colJor.includes('diferencia')) add('diferencia', -5000);
        if (colJor.includes('id_usuario_cierre')) add('id_usuario_cierre', uid);
      }
      const [res] = await conn.query(`INSERT INTO jornadas (${cols.join(',')}) VALUES (${ph.join(',')})`, vals);
      return res.insertId;
    }
    const [admRows] = await conn.query("SELECT id_usuario FROM usuarios WHERE correo='admin@clubmaster.com' LIMIT 1");
    const uidAdmin = admRows.length ? admRows[0].id_usuario : 20;
    const now = new Date();
    const ap1 = new Date(now); ap1.setDate(now.getDate() - 10); ap1.setHours(18, 0, 0, 0);
    const ci1 = new Date(ap1); ci1.setDate(ci1.getDate() + 1); ci1.setHours(2, 0, 0, 0);
    const ap2 = new Date(now); ap2.setDate(now.getDate() - 5); ap2.setHours(18, 0, 0, 0);
    const ci2 = new Date(ap2); ci2.setDate(ci2.getDate() + 1); ci2.setHours(2, 30, 0, 0);
    const ap3 = new Date(now); ap3.setHours(18, 0, 0, 0);
    ids.jornadaCerrada1 = await crearJornada(ap1, ci1, 'Cerrada', 200000, uidAdmin, 'Caja Principal');
    ids.jornadaCerrada2 = await crearJornada(ap2, ci2, 'Cerrada', 250000, uidAdmin, 'Barra Principal');
    ids.jornadaAbierta = await crearJornada(ap3, null, 'Abierta', 300000, uidAdmin, 'Caja Principal');
    console.log(`Jornadas TEST-BUG: cerradas #${ids.jornadaCerrada1}, #${ids.jornadaCerrada2} | abierta #${ids.jornadaAbierta}`);

    // ---------- 2. XSS (solo datos, NO ejecutar) ----------
    const [catRows] = await conn.query('SELECT id_categoria FROM categorias ORDER BY id_categoria LIMIT 1');
    const idCat = catRows.length ? catRows[0].id_categoria : 9;
    async function insertProducto(nombre, stock, min) {
      const cols = [], vals = [], ph = [];
      const add = (c, v) => { if (colProd.includes(c)) { cols.push(c); vals.push(v); ph.push('?'); } };
      add('nombre', nombre);
      if (precioVentaCol) add(precioVentaCol, 10000);
      if (precioVentaCol !== 'precio' && colProd.includes('precio')) add('precio', 10000);
      if (costoCol) add(costoCol, 4000);
      if (colProd.includes('categoria')) add('categoria', 'Cervezas');
      if (colProd.includes('id_categoria')) add('id_categoria', idCat);
      add('stock', stock); add('stock_minimo', min);
      if (colProd.includes('unidad')) add('unidad', 'Unidad');
      if (colProd.includes('unidad_medida')) add('unidad_medida', 'Unidad');
      if (colProd.includes('codigo_barras')) add('codigo_barras', 'TEST-BUG-' + Date.now());
      if (colProd.includes('activo')) add('activo', 1);
      const [res] = await conn.query(`INSERT INTO productos (${cols.join(',')}) VALUES (${ph.join(',')})`, vals);
      return res.insertId;
    }
    ids.prodXSS = await insertProducto("<img src=x onerror=alert('XSS-producto')>", 10, 5);
    console.log(`Producto XSS id ${ids.prodXSS}`);
    const cliCols = [], cliVals = [], cliPh = [];
    const addC = (c, v) => { if (colCli.includes(c)) { cliCols.push(c); cliVals.push(v); cliPh.push('?'); } };
    addC('nombre', "<script>alert('XSS-cliente')</script>"); addC('telefono', '3000000001');
    addC('documento', 'TEST-BUG-XSS-CLI'); addC('tipo_documento', 'CC'); addC('correo', 'xss-cli@test-bug.local');
    addC('limite_credito', 100000); addC('es_vip', 0); addC('activo', 1); addC('observaciones', 'TEST-BUG XSS');
    const [cliRes] = await conn.query(`INSERT INTO clientes_socios (${cliCols.join(',')}) VALUES (${cliPh.join(',')})`, cliVals);
    ids.cliXSS = cliRes.insertId;
    console.log(`Cliente XSS id ${ids.cliXSS}`);
    const pvCols = [], pvVals = [], pvPh = [];
    const addP = (c, v) => { if (colProv.includes(c)) { pvCols.push(c); pvVals.push(v); pvPh.push('?'); } };
    addP('nombre', '"><svg onload=alert(\'XSS-proveedor\')>'); addP('nit', 'TEST-BUG-XSS-PROV');
    addP('contacto', 'TEST-BUG'); addP('telefono', '3000000002'); addP('correo', 'xss-prov@test-bug.local'); addP('activo', 1);
    const [pvRes] = await conn.query(`INSERT INTO proveedores (${pvCols.join(',')}) VALUES (${pvPh.join(',')})`, pvVals);
    ids.provXSS = pvRes.insertId;
    console.log(`Proveedor XSS id ${ids.provXSS}`);

    // ---------- 3. ESTADOS LIMITE DE INVENTARIO ----------
    ids.prodStock0 = await insertProducto('TEST-BUG stock cero', 0, 5);
    ids.prodStockNeg = await insertProducto('TEST-BUG stock negativo', -5, 5);
    ids.prodStockMin = await insertProducto('TEST-BUG stock en minimo', 10, 10);
    console.log(`Stock limite: 0->#${ids.prodStock0}, -5->#${ids.prodStockNeg}, 10/10->#${ids.prodStockMin}`);

    // ---------- 4. USUARIOS DE CADA ROL (PIN = contrasena hasheada) ----------
    const [roles] = await conn.query('SELECT id_rol, nombre FROM roles ORDER BY id_rol');
    const pinPorRol = { administrador: '1010', gerente: '4040', mesero: '2020', cajero: '3030', bartender: '5050' };
    ids.usuarios = {};
    for (const r of roles) {
      const key = String(r.nombre || '').toLowerCase();
      const pin = pinPorRol[key] || '6060';
      const correo = `test-bug-${key}@clubmaster.test`;
      const hash = await bcrypt.hash(pin, 10);
      const cols = [], vals = [], ph = [];
      const add = (c, v) => { if (colUsr.includes(c)) { cols.push(c); vals.push(v); ph.push('?'); } };
      add('nombre', `TEST-BUG ${r.nombre}`); add('correo', correo); add('contrasena', hash);
      add('id_rol', r.id_rol); add('activo', 1);
      const [res] = await conn.query(`INSERT INTO usuarios (${cols.join(',')}) VALUES (${ph.join(',')})`, vals);
      ids.usuarios[r.nombre] = { id: res.insertId, correo, pin };
      console.log(`Usuario ${r.nombre} id ${res.insertId} correo ${correo} PIN ${pin}`);
    }

    // ---------- 5. MESAS EN CADA ESTADO (zonas distintas) ----------
    await conn.query("UPDATE mesas SET estado='Disponible', zona='Pista Principal' WHERE numero=5");
    await conn.query("UPDATE mesas SET estado='Ocupada', zona='Barra', id_mesero=? WHERE numero=6", [uidAdmin]);
    await conn.query("UPDATE mesas SET estado='Reservada', zona='VIP' WHERE numero=8");
    const [mesas] = await conn.query('SELECT id_mesa, numero, estado, zona FROM mesas WHERE numero IN (5,6,8) ORDER BY numero');
    ids.mesas = mesas;
    console.log('Mesas:', JSON.stringify(mesas));

    // ---------- 6. VALES EN ESTADOS VARIADOS ----------
    const [cliRef] = await conn.query("SELECT id_cliente, nombre FROM clientes_socios WHERE documento='1037678456' LIMIT 1");
    const idCliRef = cliRef.length ? cliRef[0].id_cliente : cliRes.insertId;
    const nomCliRef = cliRef.length ? cliRef[0].nombre : 'TEST-BUG XSS';
    async function insertVale({ total, saldo, estado, vence, ref, capital }) {
      const cols = [], vals = [], ph = [];
      const add = (c, v) => { if (colVale.includes(c)) { cols.push(c); vals.push(v); ph.push('?'); } };
      add('cliente_socio', nomCliRef);
      if (colVale.includes('id_cliente_socio')) add('id_cliente_socio', idCliRef);
      add('total', total); add('saldo_pendiente', saldo); add('estado', estado);
      if (colVale.includes('fecha')) add('fecha', new Date());
      if (colVale.includes('id_usuario_autoriza')) add('id_usuario_autoriza', uidAdmin);
      if (colVale.includes('fecha_vencimiento')) add('fecha_vencimiento', vence);
      if (colVale.includes('tipo_mora')) add('tipo_mora', 'diario');
      if (colVale.includes('tasa_mora')) add('tasa_mora', 0.5);
      if (colVale.includes('referencia')) add('referencia', ref);
      if (colVale.includes('capital_pagado')) add('capital_pagado', capital);
      if (colVale.includes('mora_acumulada')) add('mora_acumulada', 0);
      if (colVale.includes('mora_pagada')) add('mora_pagada', 0);
      const [res] = await conn.query(`INSERT INTO cuentas_por_cobrar (${cols.join(',')}) VALUES (${ph.join(',')})`, vals);
      return res.insertId;
    }
    const alDia = new Date(); alDia.setDate(alDia.getDate() + 15);
    const vencido = new Date(); vencido.setDate(vencido.getDate() - 30);
    const liqFecha = new Date(); liqFecha.setDate(liqFecha.getDate() - 2);
    ids.valeAlDia = await insertVale({ total: 150000, saldo: 150000, estado: 'Pendiente', vence: alDia, ref: 'TEST-BUG-VALE-AL-DIA', capital: 0 });
    ids.valeVencido = await insertVale({ total: 200000, saldo: 200000, estado: 'Pendiente', vence: vencido, ref: 'TEST-BUG-VALE-VENCIDO', capital: 0 });
    ids.valeLiquidado = await insertVale({ total: 120000, saldo: 0, estado: 'Liquidado', vence: liqFecha, ref: 'TEST-BUG-VALE-LIQUIDADO', capital: 120000 });
    try {
      await conn.query(
        'INSERT INTO abonos_vales (id_vale,monto_abono,monto_capital,monto_mora,metodo_pago,referencia,id_usuario,id_jornada) VALUES (?,?,?,?,?,?,?,?)',
        [ids.valeLiquidado, 120000, 120000, 0, 'Efectivo', 'TEST-BUG-ABONO-LIQ', uidAdmin, ids.jornadaCerrada2]
      );
    } catch (e) { console.log('abono liq aviso:', e.message); }
    console.log(`Vales: al dia #${ids.valeAlDia}, vencido #${ids.valeVencido}, liquidado #${ids.valeLiquidado}`);

    // ---------- 7. PIN MAESTRO (solo lectura, NO cambiar) ----------
    const [pinRows] = await conn.query("SELECT clave, valor FROM configuracion_general WHERE clave='pin_maestro' LIMIT 1");
    ids.pinMaestro = pinRows.length ? pinRows[0].valor : null;
    console.log('pin_maestro actual:', pinRows.length ? JSON.stringify(pinRows[0]) : '(NO EXISTE FILA)');

    console.log('=== SEED TEST-BUGS OK ===');
    console.log(JSON.stringify(ids, null, 2));
    return ids;
  } finally {
    conn.release();
  }
}

if (require.main === module) {
  seedTestBugs().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}
module.exports = { seedTestBugs };
