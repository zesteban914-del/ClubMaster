// Detecta facturas divididas: misma mesa, mismo instante/cuenta, mismo mesero y método
// Uso: node Backend/scripts/detectar-facturas-divididas.js [--fix]  (por defecto dry-run)
// No borra ni modifica facturas ya emitidas sin --fix y confirmación.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { pool } = require('../config/database');

async function detectar() {
  const dryRun = !process.argv.includes('--fix');
  console.log('=== Detección de facturas divididas (dry-run=' + dryRun + ') ===');

  // Buscar en facturas (si existe) agrupadas por mesa + ventana 2 min + mesero + método
  const tieneFacturas = await pool.query("SHOW TABLES LIKE 'facturas'").then(r=>r[0].length>0).catch(()=>false);
  if (!tieneFacturas) {
    console.log('Tabla facturas no existe — analizando pedidos Pagado como proxy');
    const [rows] = await pool.query(`
      SELECT id_mesa, DATE_FORMAT(timestamp_despacho,'%Y-%m-%d %H:%i') as minuto, id_usuario, metodo_pago, COUNT(*) as cnt, GROUP_CONCAT(id_pedido) as ids, SUM(total) as suma
      FROM pedidos WHERE estado='Pagado' AND timestamp_despacho IS NOT NULL
      GROUP BY id_mesa, minuto, id_usuario, metodo_pago HAVING cnt>1 ORDER BY minuto DESC LIMIT 50
    `);
    if (!rows.length) console.log('Sin grupos sospechosos (pedidos).');
    else {
      console.table(rows);
      console.log('\nPropuesta fusión (informativa): estos ' + rows.length + ' grupos deberían ser 1 factura cada uno con total = suma.');
    }
    return;
  }

  // Con facturas
  const [cols] = await pool.query("SHOW COLUMNS FROM facturas LIKE 'id_mesero'");
  const meseroExpr = cols.length ? 'COALESCE(id_mesero,id_usuario)' : 'id_usuario';
  const [grupos] = await pool.query(`
    SELECT id_mesa, DATE_FORMAT(fecha,'%Y-%m-%d %H:%i') as minuto, ${meseroExpr} as mesero, metodo_pago, COUNT(*) as cnt, GROUP_CONCAT(id_factura) as ids, GROUP_CONCAT(numero_factura) as nums, SUM(total) as suma
    FROM facturas WHERE estado='Pagada' AND fecha IS NOT NULL
    GROUP BY id_mesa, minuto, mesero, metodo_pago HAVING cnt>1 ORDER BY minuto DESC LIMIT 50
  `);
  if (!grupos.length) {
    console.log('Sin facturas divididas detectadas (misma mesa, mismo minuto, mismo mesero/método).');
    return;
  }
  console.log(`Se detectaron ${grupos.length} grupos con posibles facturas partidas:`);
  for (const g of grupos) {
    console.log(`- Mesa ${g.id_mesa} | ${g.minuto} | mesero ${g.mesero} | ${g.metodo_pago} | ${g.cnt} facturas [${g.nums}] total combinado ${Number(g.suma).toLocaleString('es-CO')} (ids: ${g.ids})`);
    if (!dryRun) {
      console.log('  [DRY-RUN] Con --fix se propondría fusionar en 1 factura preservando el consecutivo más antiguo; requiere confirmación manual y no aplica si hay facturación electrónica.');
    }
  }
  console.log('\nNOTA: Datos históricos NO se modifican automáticamente. Si confirma fusión, ejecute con --fix y respalde antes (mysqldump). Con facturación electrónica, corregir solo hacia adelante.');
}

detectar().then(()=>pool.end()).catch(e=>{console.error(e); pool.end(); process.exit(1);});
