module.exports = function(app, db) {
    app.get('/api/kds/pendientes', async (req, res) => {
        try {
            const [rows] = await db.pool.query(
                "SELECT p.id_pedido, p.id_mesa, m.numero AS mesa_numero, m.zona, p.timestamp_pedido, " +
                "TIMESTAMPDIFF(MINUTE, p.timestamp_pedido, NOW()) AS minutos, " +
                "p.id_usuario, COALESCE(u.nombre, '') AS mesero_nombre, " +
                "dp.id_detalle, dp.cantidad, dp.observaciones, dp.presentacion, dp.estado AS detalle_estado, " +
                "prod.nombre AS producto_nombre, prod.categoria AS categoria " +
                "FROM pedidos p JOIN mesas m ON p.id_mesa = m.id_mesa " +
                "JOIN detalle_pedido dp ON dp.id_pedido = p.id_pedido " +
                "LEFT JOIN productos prod ON dp.id_producto = prod.id_producto " +
                "LEFT JOIN usuarios u ON p.id_usuario = u.id_usuario " +
                "WHERE p.estado = 'Pendiente' AND (dp.estado IS NULL OR dp.estado IN ('Pendiente','En preparacion','En preparación')) " +
                "ORDER BY p.timestamp_pedido ASC LIMIT 200"
            );
            res.json({ success: true, items: rows });
        } catch (e) { res.status(500).json({ success: false, mensaje: e.message }); }
    });

    app.post('/api/kds/detalle/:id/listo', async (req, res) => {
        try {
            const [r] = await db.pool.query("UPDATE detalle_pedido SET estado='Listo' WHERE id_detalle=?", [req.params.id]);
            if (!r.affectedRows) return res.status(404).json({ success: false, mensaje: 'Detalle no encontrado' });
            res.json({ success: true, mensaje: 'Marcado como listo' });
        } catch (e) { res.status(500).json({ success: false, mensaje: e.message }); }
    });
};
