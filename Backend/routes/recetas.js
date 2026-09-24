module.exports = function(app, db) {
  app.get('/api/recetas/:productoId', async (req, res) => {
    try {
      const [rows] = await db.pool.query(
        `SELECT r.*, p.nombre AS insumo_nombre FROM recetas r LEFT JOIN productos p ON r.insumo_id=p.id_producto WHERE r.producto_id=?`,
        [req.params.productoId]
      );
      res.json({ success: true, recetas: rows });
    } catch (e) { res.status(500).json({ success: false, mensaje: e.message }); }
  });
  app.post('/api/recetas', async (req, res) => {
    const { producto_id, insumo_id, cantidad, factor_conversion } = req.body;
    if (!producto_id || !insumo_id || !cantidad || Number(cantidad) <= 0)
      return res.status(400).json({ success: false, mensaje: 'producto_id, insumo_id y cantidad>0 requeridos' });
    try {
      await db.pool.query(
        `INSERT INTO recetas (producto_id, insumo_id, cantidad, factor_conversion) VALUES (?,?,?,?)
         ON DUPLICATE KEY UPDATE cantidad=VALUES(cantidad), factor_conversion=VALUES(factor_conversion)`,
        [producto_id, insumo_id, Number(cantidad), Number(factor_conversion) > 0 ? Number(factor_conversion) : 1]
      );
      res.json({ success: true, mensaje: 'Receta guardada' });
    } catch (e) { res.status(500).json({ success: false, mensaje: e.message }); }
  });
  app.delete('/api/recetas/:productoId/:insumoId', async (req, res) => {
    try {
      await db.pool.query('DELETE FROM recetas WHERE producto_id=? AND insumo_id=?', [req.params.productoId, req.params.insumoId]);
      res.json({ success: true, mensaje: 'Insumo eliminado de la receta' });
    } catch (e) { res.status(500).json({ success: false, mensaje: e.message }); }
  });
};
