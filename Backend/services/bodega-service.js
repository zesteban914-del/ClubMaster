const { pool } = require('../config/database');

async function obtenerBodegas() {
  const [rows] = await pool.query('SELECT * FROM bodegas ORDER BY orden ASC, nombre ASC');
  return rows;
}

async function obtenerStockBodegas(idBodega) {
  if (idBodega) {
    const [rows] = await pool.query(
      `SELECT sb.*, p.nombre, p.categoria, p.activo FROM stock_bodegas sb JOIN productos p ON p.id_producto=sb.id_producto WHERE sb.id_bodega=? ORDER BY p.nombre`,
      [idBodega]
    );
    return rows;
  }
  const [rows] = await pool.query(
    `SELECT sb.*, p.nombre, b.nombre AS bodega_nombre FROM stock_bodegas sb JOIN productos p ON p.id_producto=sb.id_producto JOIN bodegas b ON b.id_bodega=sb.id_bodega ORDER BY b.orden, p.nombre`
  );
  return rows;
}

async function asignarStockBodega(idProducto, idBodega, stock, stockMinimo) {
  await pool.query(
    `INSERT INTO stock_bodegas (id_producto, id_bodega, stock, stock_minimo) VALUES (?,?,?,?)
     ON DUPLICATE KEY UPDATE stock=VALUES(stock), stock_minimo=VALUES(stock_minimo)`,
    [idProducto, idBodega, stock, stockMinimo != null ? stockMinimo : 5]
  );
  await pool.query('UPDATE productos SET usa_stock_bodega=1 WHERE id_producto=?', [idProducto]);
}

async function mapearZonaABodega(zona) {
  const z = String(zona || '').toLowerCase();
  if (z.includes('vip')) {
    const [r] = await pool.query("SELECT id_bodega FROM bodegas WHERE nombre='Barra VIP' LIMIT 1");
    if (r.length) return r[0].id_bodega;
  }
  if (z.includes('barra') || z.includes('pista')) {
    const [r] = await pool.query("SELECT id_bodega FROM bodegas WHERE nombre='Barra Principal' LIMIT 1");
    if (r.length) return r[0].id_bodega;
  }
  const [r] = await pool.query("SELECT id_bodega FROM bodegas WHERE nombre='Bodega Central' LIMIT 1");
  return r.length ? r[0].id_bodega : null;
}

async function moverStock(idProducto, deBodega, aBodega, cantidad) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('UPDATE stock_bodegas SET stock = GREATEST(0, stock - ?) WHERE id_producto=? AND id_bodega=?', [cantidad, idProducto, deBodega]);
    await conn.query(
      `INSERT INTO stock_bodegas (id_producto, id_bodega, stock) VALUES (?,?,?)
       ON DUPLICATE KEY UPDATE stock = stock + VALUES(stock)`,
      [idProducto, aBodega, cantidad]
    );
    const [sum] = await conn.query('SELECT COALESCE(SUM(stock),0) AS tot FROM stock_bodegas WHERE id_producto=?', [idProducto]);
    await conn.query('UPDATE productos SET stock=? WHERE id_producto=?', [sum[0].tot, idProducto]);
    await conn.commit();
    return { total: Number(sum[0].tot) };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

module.exports = { obtenerBodegas, obtenerStockBodegas, asignarStockBodega, mapearZonaABodega, moverStock };
