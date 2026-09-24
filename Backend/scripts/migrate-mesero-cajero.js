const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { pool } = require('../config/database');

async function agregarColumna(conn, tabla, columna, definicion) {
  try {
    const [cols] = await conn.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
      [tabla, columna]
    );
    if (cols.length === 0) {
      await conn.query(`ALTER TABLE \`${tabla}\` ADD COLUMN ${definicion}`);
      console.log(`Columna ${columna} agregada a ${tabla}`);
      return true;
    } else {
      console.log(`Columna ${columna} ya existe en ${tabla}`);
      return false;
    }
  } catch (e) { console.log(`Aviso ${tabla}.${columna}: ${e.message}`); return false; }
}
async function agregarIndice(conn, tabla, indice, columnas) {
  try {
    const [ex] = await conn.query(
      "SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?",
      [tabla, indice]
    );
    if (ex[0].c === 0) {
      await conn.query(`ALTER TABLE \`${tabla}\` ADD INDEX \`${indice}\` (${columnas})`);
      console.log(`Indice ${indice} creado en ${tabla}`);
    }
  } catch(e){ console.log(`Aviso indice ${indice}: ${e.message}`); }
}

async function migrate(dryRun=false) {
  const conn = await pool.getConnection();
  try {
    console.log(dryRun ? '=== DRY-RUN migracion mesero/cajero ===' : '=== Aplicando migracion mesero/cajero ===');
    const exec = async (sql, params) => {
      if (dryRun) { console.log('[DRY]', sql, params||''); return; }
      await conn.query(sql, params);
    };

    // 1. pedidos ya tiene id_mesero/id_cajero (verificado), asegurar indices
    if (!dryRun) {
      await agregarColumna(conn, 'pedidos', 'id_mesero', 'id_mesero INT NULL, ADD INDEX idx_pedidos_mesero (id_mesero)');
    } else {
      console.log('[DRY] verificar pedidos.id_mesero/id_cajero');
    }
    await agregarIndice(conn, 'pedidos', 'idx_pedidos_mesero', 'id_mesero');
    await agregarIndice(conn, 'pedidos', 'idx_pedidos_cajero', 'id_cajero');

    // 2. facturas ya tiene id_mesero/id_cajero/id_usuario_registra (verificado)
    await agregarIndice(conn, 'facturas', 'idx_facturas_mesero', 'id_mesero');
    await agregarIndice(conn, 'facturas', 'idx_facturas_cajero', 'id_cajero');

    // 3. detalle_pedido: quien agrego cada linea
    const addedDetalle = await agregarColumna(conn, 'detalle_pedido', 'id_usuario_agrega', 'id_usuario_agrega INT NULL');
    // si dryRun y columna no existia, el helper ya logueo; si existe, no hacer nada
    if (!dryRun && addedDetalle) {
      // backfill: id_usuario_agrega = ped.id_mesero o ped.id_usuario
      try { await conn.query("UPDATE detalle_pedido dp JOIN pedidos p ON dp.id_pedido=p.id_pedido SET dp.id_usuario_agrega=COALESCE(p.id_mesero,p.id_usuario) WHERE dp.id_usuario_agrega IS NULL"); console.log('Backfill detalle_pedido.id_usuario_agrega'); } catch(e){ console.log(e.message); }
    }
    await agregarIndice(conn, 'detalle_pedido', 'idx_detalle_usuario_agrega', 'id_usuario_agrega');

    // 4. historial de transferencias de mesa
    if (dryRun) {
      console.log('[DRY] crear tabla mesa_transferencias si no existe');
    } else {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS mesa_transferencias (
          id_transferencia INT AUTO_INCREMENT PRIMARY KEY,
          id_mesa INT NOT NULL,
          id_mesero_anterior INT NULL,
          id_mesero_nuevo INT NOT NULL,
          id_usuario_ejecuta INT NULL,
          motivo VARCHAR(255) NOT NULL DEFAULT '',
          fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          id_jornada INT NULL,
          KEY idx_mesa_trans_mesa (id_mesa),
          KEY idx_mesa_trans_fecha (fecha)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      console.log('Tabla mesa_transferencias verificada');
    }

    // 5. config futura reparto propinas (solo insert)
    if (!dryRun) {
      await conn.query("INSERT IGNORE INTO configuracion_general (clave, valor, descripcion) VALUES ('propina_modo_reparto','titular','Modo reparto propinas: titular | bolsa_comun') ");
      await conn.query("INSERT IGNORE INTO configuracion_general (clave, valor, descripcion) VALUES ('propina_observacion','100% al mesero titular. Sin descuento a casa.','Regla dura propinas') ");
      console.log('Config propinas extension verificada');
    }

    // 6. DRY-RUN historicos
    const [facturas] = await conn.query("SELECT id_factura, numero_factura, id_mesa, id_usuario, id_mesero, id_cajero FROM facturas ORDER BY id_factura DESC LIMIT 20");
    console.log('--- dry-run facturas mesero/cajero ---');
    for (const f of facturas) {
      let fuente = 'factura.id_mesero';
      let confianza = 'alta';
      let propuesto = f.id_mesero;
      if (f.id_mesero == null) {
        // intentar reconstruir desde pedidos originales via id_factura
        try {
          const [peds] = await conn.query("SELECT id_mesero, id_usuario, id_cajero FROM pedidos WHERE id_factura=? LIMIT 1", [f.id_factura]);
          if (peds.length && peds[0].id_mesero) { propuesto = peds[0].id_mesero; fuente = 'pedidos.id_mesero'; confianza='media'; }
          else if (peds.length && peds[0].id_usuario) { fuente='pedidos.id_usuario (cajero) - NO USAR'; confianza='baja - dejar nulo'; propuesto = null; }
          else { fuente='sin dato - dejar nulo'; confianza='baja'; propuesto=null; }
        } catch(e){ fuente='error'; confianza='baja'; propuesto=null; }
      }
      console.log(`F ${f.numero_factura} id=${f.id_factura} cajero_actual=${f.id_usuario} -> mesero_propuesto=${propuesto} fuente=${fuente} confianza=${confianza} estado=${f.id_mesero==null?'RELLENAR NULO -> Sin mesero registrado':'OK'}`);
    }
    const [pedidos] = await conn.query("SELECT id_pedido, id_mesa, id_usuario, id_mesero, id_cajero, estado FROM pedidos WHERE estado='Pagado' AND id_mesero IS NULL LIMIT 20");
    if (pedidos.length) {
      console.log('--- pedidos Pagados sin mesero (historicos) ---');
      for (const p of pedidos) {
        // intentar via mesas.id_mesero historico? no fiable, dejar nulo
        console.log(`Pedido ${p.id_pedido} mesa ${p.id_mesa} cajero=${p.id_usuario} mesero=NULL -> dejar "Sin mesero registrado", NO rellenar con cajero`);
      }
    } else {
      console.log('No hay pedidos Pagados sin mesero (o todos migrados)');
    }

    console.log(dryRun ? '=== DRY-RUN completo ===' : '=== Migracion completa ===');
    console.log('Revertir: DROP TABLE mesa_transferencias; ALTER TABLE detalle_pedido DROP COLUMN id_usuario_agrega; DELETE FROM configuracion_general WHERE clave IN (\"propina_modo_reparto\",\"propina_observacion\"); -- NO borrar id_mesero/id_cajero historicos sin backup');

  } finally { conn.release(); }
}

if (require.main === module) {
  const dry = process.argv.includes('--dry-run') || process.argv.includes('dry');
  migrate(dry).then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
}
module.exports = { migrate };
