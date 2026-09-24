module.exports = function(app, db) {
    const pool = (db && db.pool) || require('../config/database').pool;
    function soloAdminOCajero(req, res, next) {
        const u = req.session && req.session.usuario;
        if (!u) return res.status(401).json({ success: false, mensaje: 'No autenticado.' });
        if (Number(u.id_rol) === 1) return next();
        const r = String(u.rol || '').toLowerCase();
        if (r === 'administrador' || r === 'admin' || r.indexOf('cajer') !== -1) return next();
        return res.status(403).json({ success: false, mensaje: 'Solo Administrador o Cajero principal.' });
    }
    function soloFinanciero(req, res, next) {
        const u = req.session && req.session.usuario;
        if (!u) return res.status(401).json({ success: false, mensaje: 'No autenticado.' });
        if (Number(u.id_rol) === 1) return next();
        const r = String(u.rol || '').toLowerCase();
        if (r === 'administrador' || r === 'admin') return next();
        if (Array.isArray(u.permisos) && (u.permisos.indexOf('ver_caja') !== -1 || u.permisos.indexOf('ver_reportes') !== -1)) return next();
        if (!u.permisos || !u.permisos.length) {
            return pool.query('SELECT 1 AS ok FROM rol_permisos rp JOIN permisos p ON rp.id_permiso = p.id_permiso WHERE rp.id_rol = ? AND p.codigo IN (?, ?) LIMIT 1', [u.id_rol, 'ver_caja', 'ver_reportes'])
                .then(function(rows) {
                    if (rows[0] && rows[0].length) return next();
                    return res.status(403).json({ success: false, mensaje: 'Sin permisos financieros.' });
                })
                .catch(function() { return res.status(403).json({ success: false, mensaje: 'Sin permisos financieros.' }); });
        }
        return res.status(403).json({ success: false, mensaje: 'Sin permisos financieros.' });
    }
    app.get('/api/finanzas/jornada-en-vivo', soloFinanciero, async (req, res) => {
        try {
            const jornadaSvc = require('../services/jornada-service');
            const { categoriaMetodoPago } = require('../helpers/db-helpers');
            const jornada = await jornadaSvc.obtenerJornadaActiva();
            if (!jornada || jornada.estado !== 'Abierta') {
                return res.json({ success: true, abierta: false, mensaje: 'No hay jornada abierta actualmente.' });
            }
            const idJ = jornada.id_jornada;
            const resumen = await jornadaSvc.obtenerResumenJornadaCompleto(pool, idJ);
            let efectivo = 0, tarjeta = 0, transferencia = 0, vales = 0, otros = 0;
            (resumen.desglose || []).forEach(function(row) {
                const cat = categoriaMetodoPago(row.metodo_pago);
                const sub = Number(row.subtotal) || 0;
                if (cat === 'Efectivo') efectivo += sub;
                else if (cat === 'Tarjeta') tarjeta += sub;
                else if (cat === 'Wallet') transferencia += sub;
                else if (cat === 'Credito') vales += sub;
                else otros += sub;
            });
            let flotante = { total: 0, num_pedidos: 0, num_mesas: 0 };
            try {
                const [fl] = await pool.query(
                    "SELECT COALESCE(SUM(dp.cantidad * dp.precio_unitario), 0) AS total, COUNT(DISTINCT p.id_pedido) AS num_pedidos, COUNT(DISTINCT p.id_mesa) AS num_mesas FROM pedidos p JOIN detalle_pedido dp ON p.id_pedido = dp.id_pedido WHERE p.id_jornada = ? AND p.estado = 'Pendiente'",
                    [idJ]
                );
                if (fl.length) flotante = { total: Number(fl[0].total) || 0, num_pedidos: Number(fl[0].num_pedidos) || 0, num_mesas: Number(fl[0].num_mesas) || 0 };
            } catch (e) {
                const [fl2] = await pool.query(
                    "SELECT COALESCE(SUM(dp.cantidad * dp.precio_unitario), 0) AS total, COUNT(DISTINCT p.id_pedido) AS num_pedidos, COUNT(DISTINCT p.id_mesa) AS num_mesas FROM pedidos p JOIN detalle_pedido dp ON p.id_pedido = dp.id_pedido WHERE p.id_jornada = ? AND p.estado NOT IN ('Pagado','Anulado','Cancelado','Cerrado')",
                    [idJ]
                );
                if (fl2.length) flotante = { total: Number(fl2[0].total) || 0, num_pedidos: Number(fl2[0].num_pedidos) || 0, num_mesas: Number(fl2[0].num_mesas) || 0 };
            }
            res.json({
                success: true,
                abierta: true,
                id_jornada: idJ,
                fecha_apertura: jornada.fecha_apertura || jornada.hora_apertura || jornada.fecha || null,
                total_vendido: Number(resumen.ventas_netas) || 0,
                total_ingresado: Number(resumen.total_ingresos) || 0,
                efectivo: efectivo,
                tarjeta: tarjeta,
                transferencia: transferencia,
                vales: vales,
                otros: otros,
                cuentas_por_cobrar: flotante.total,
                num_mesas_abiertas: flotante.num_mesas,
                num_pedidos_abiertos: flotante.num_pedidos,
                propina: Number(resumen.total_propina) || 0,
                descuentos: Number(resumen.descuentos) || 0,
                cortesias: Number(resumen.cortesias) || 0
            });
        } catch (e) {
            res.status(500).json({ success: false, mensaje: e.message });
        }
    });
    app.get('/api/finanzas/compras', soloAdminOCajero, async (req, res) => {
        try {
            const fecha_inicio = req.query.fecha_inicio || null;
            const fecha_fin = req.query.fecha_fin || null;
            const id_jornada = req.query.id_jornada ? Number(req.query.id_jornada) : null;
            const params = [];
            let whereC = 'c.estado IS NULL OR c.estado != \'Anulada\'';
            if (fecha_inicio) { whereC += ' AND DATE(c.fecha) >= ?'; params.push(fecha_inicio); }
            if (fecha_fin) { whereC += ' AND DATE(c.fecha) <= ?'; params.push(fecha_fin); }
            const [compras] = await pool.query(
                'SELECT c.id_compra, c.numero_factura, c.fecha, c.total, c.estado, c.forma_pago, c.metodo_pago, COALESCE(p.nombre, \'\') AS proveedor_nombre, COALESCE(u.nombre, \'\') AS usuario_nombre FROM compras c LEFT JOIN proveedores p ON c.id_proveedor = p.id_proveedor LEFT JOIN usuarios u ON c.id_usuario = u.id_usuario WHERE ' + whereC + ' ORDER BY c.fecha DESC LIMIT 500',
                params
            );
            const p2 = [];
            let whereP = '1=1';
            if (fecha_inicio) { whereP += ' AND DATE(pp.fecha_pago) >= ?'; p2.push(fecha_inicio); }
            if (fecha_fin) { whereP += ' AND DATE(pp.fecha_pago) <= ?'; p2.push(fecha_fin); }
            const [pagos] = await pool.query(
                'SELECT pp.id_pago, pp.id_compra, pp.monto, pp.metodo_pago, pp.fecha_pago, COALESCE(pr.nombre, \'\') AS proveedor_nombre, COALESCE(u.nombre, \'\') AS usuario_nombre FROM pagos_proveedores pp LEFT JOIN proveedores pr ON pp.id_proveedor = pr.id_proveedor LEFT JOIN usuarios u ON pp.id_usuario = u.id_usuario WHERE ' + whereP + ' ORDER BY pp.fecha_pago DESC LIMIT 500',
                p2
            );
            let movs = [];
            try {
                const pm = [];
                let whereM = "(LOWER(m.categoria) LIKE '%proveedor%' OR LOWER(m.categoria) LIKE '%compra%' OR LOWER(m.concepto) LIKE '%proveedor%' OR LOWER(m.concepto) LIKE '%compra%')";
                if (id_jornada) { whereM += ' AND m.id_jornada = ?'; pm.push(id_jornada); }
                else {
                    if (fecha_inicio) { whereM += ' AND DATE(m.fecha) >= ?'; pm.push(fecha_inicio); }
                    if (fecha_fin) { whereM += ' AND DATE(m.fecha) <= ?'; pm.push(fecha_fin); }
                }
                const [rows] = await pool.query(
                    'SELECT m.*, COALESCE(u.nombre, \'\') AS usuario_nombre FROM movimientos_caja m LEFT JOIN usuarios u ON m.id_usuario = u.id_usuario WHERE ' + whereM + ' ORDER BY m.fecha DESC LIMIT 500',
                    pm
                );
                movs = rows;
            } catch (e) { movs = []; }
            const total_compras = compras.reduce(function(a, c) { return a + Number(c.total || 0); }, 0);
            const total_pagos = pagos.reduce(function(a, p) { return a + Number(p.monto || 0); }, 0);
            const total_movimientos = movs.reduce(function(a, m) { return a + Number(m.monto || 0); }, 0);
            res.json({ success: true, total_compras, total_pagos, total_movimientos_caja: total_movimientos, total_salida: total_compras + total_pagos, compras, pagos, movimientos: movs });
        } catch (e) {
            res.status(500).json({ success: false, mensaje: e.message });
        }
    });
};
