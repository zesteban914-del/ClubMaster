const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { pool } = require('../config/database');

const TARGETS = [
  { tabla: 'zonas', id: 'id_zona', col: 'nombre', idx: 'uq_zonas_nombre' },
  { tabla: 'unidades_medida', id: 'id_unidad', col: 'nombre', idx: 'uq_unidades_nombre' },
];

async function limpiar(tb) {
  const conn = await pool.getConnection();
  try {
    const [[tot]] = await conn.query(`SELECT COUNT(*) AS c FROM \`${tb.tabla}\``);
    const [[dis]] = await conn.query(`SELECT COUNT(DISTINCT TRIM(\`${tb.col}\`)) AS c FROM \`${tb.tabla}\``);
    console.log(`[${tb.tabla}] total=${tot.c} distintos=${dis.c}`);
    if (tot.c === dis.c) { console.log(`[${tb.tabla}] sin duplicados.`); }
    else {
      const [fks] = await conn.query(
        `SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME = ? AND TABLE_NAME <> ?`,
        [tb.tabla, tb.tabla]
      );
      if (fks.length) {
        console.log(`[${tb.tabla}] FKs externas detectadas, NO se borra: ` + JSON.stringify(fks));
        return { tabla: tb.tabla, omitida: true };
      }
      const [res] = await conn.query(
        `DELETE t FROM \`${tb.tabla}\` t LEFT JOIN
           (SELECT MIN(\`${tb.id}\`) AS keepId FROM \`${tb.tabla}\` GROUP BY TRIM(\`${tb.col}\`)) k
           ON t.\`${tb.id}\` = k.keepId WHERE k.keepId IS NULL`
      );
      console.log(`[${tb.tabla}] duplicados eliminados: ${res.affectedRows} (se conserva MIN(id) por nombre)`);
    }
    const [ex] = await conn.query(
      `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
      [tb.tabla, tb.idx]
    );
    if (!ex[0].c) {
      await conn.query(`ALTER TABLE \`${tb.tabla}\` ADD UNIQUE INDEX \`${tb.idx}\` (\`${tb.col}\`)`);
    }
    console.log(`[${tb.tabla}] UNIQUE ${tb.idx} OK`);
    const [[fin]] = await conn.query(`SELECT COUNT(*) AS c FROM \`${tb.tabla}\``);
    return { tabla: tb.tabla, antes: tot.c, despues: fin.c };
  } finally {
    conn.release();
  }
}

async function main() {
  console.log('=== LIMPIEZA DUPLICADOS zonas / unidades_medida ===');
  for (const tb of TARGETS) await limpiar(tb);
  console.log('=== FIN ===');
  await pool.end();
}
if (require.main === module) main().then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });
module.exports = { main };
