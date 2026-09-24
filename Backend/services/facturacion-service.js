const { pool } = require('../config/database');

// =========================================================
// FACTURAS DE MESAS / POS (pedidos pagados)
// =========================================================

async function existeTablaFacturas() {
    try {
        const [rows] = await pool.query("SHOW TABLES LIKE 'facturas'");
        return rows.length > 0;
    } catch (e) { return false; }
}

async function obtenerFacturasMesas(filtros) {
    if (await existeTablaFacturas()) {
        try {
            let sql = `
                SELECT f.id_factura AS id_pedido, f.id_factura, f.id_mesa, f.id_usuario, f.id_jornada, f.total,
                       f.subtotal, f.descuento, f.propina, f.impuestos, f.es_cortesia,
                       f.metodo_pago, f.sub_metodo_pago, f.referencia_pago,
                       f.fecha AS timestamp_despacho, f.fecha AS timestamp_pedido,
                       f.numero_factura,
                       f.id_mesero, f.id_cajero,
                       m.numero AS mesa_numero, m.zona AS mesa_zona,
                       u.nombre AS usuario_nombre,
                       u_mesero.nombre AS mesero_nombre,
                       u_cajero.nombre AS cajero_nombre
                FROM facturas f
                LEFT JOIN mesas m ON f.id_mesa = m.id_mesa
                LEFT JOIN usuarios u ON f.id_usuario = u.id_usuario
                LEFT JOIN usuarios u_mesero ON f.id_mesero = u_mesero.id_usuario
                LEFT JOIN usuarios u_cajero ON f.id_cajero = u_cajero.id_usuario
                WHERE f.estado = 'Pagada'
            `;
            const params = [];
            if (filtros) {
                if (filtros.busqueda) {
                    const term = '%' + filtros.busqueda + '%';
                    sql += ` AND (
                        CAST(f.id_factura AS CHAR) LIKE ? OR
                        f.numero_factura LIKE ? OR
                        CAST(m.numero AS CHAR) LIKE ? OR
                        u.nombre LIKE ? OR
                        u_mesero.nombre LIKE ? OR
                        u_cajero.nombre LIKE ? OR
                        f.metodo_pago LIKE ? OR
                        f.sub_metodo_pago LIKE ? OR
                        f.referencia_pago LIKE ?
                    )`;
                    params.push(term, term, term, term, term, term, term, term, term);
                }
                if (filtros.fecha_inicio) { sql += ' AND f.fecha >= ?'; params.push(filtros.fecha_inicio); }
                if (filtros.fecha_fin) { sql += ' AND f.fecha <= ?'; params.push(filtros.fecha_fin); }
                if (filtros.id_jornada) { sql += ' AND f.id_jornada = ?'; params.push(filtros.id_jornada); }
                if (filtros.metodo_pago) { sql += ' AND f.metodo_pago = ?'; params.push(filtros.metodo_pago); }
                if (filtros.id_mesero) { sql += ' AND COALESCE(f.id_mesero, f.id_usuario) = ?'; params.push(Number(filtros.id_mesero)); }
                if (filtros.id_cajero) { sql += ' AND COALESCE(f.id_cajero, f.id_usuario) = ?'; params.push(Number(filtros.id_cajero)); }
            }
            sql += ' ORDER BY f.fecha DESC';
            if (filtros && filtros.limite) { sql += ' LIMIT ?'; params.push(Number(filtros.limite)); }
            const [rows] = await pool.query(sql, params);
            if (rows.length > 0) {
                const nulos = rows.filter(function(r){ return r.id_cajero == null; });
                if (nulos.length) console.warn('[ALERTA FACTURAS] '+nulos.length+' facturas nuevas con cajero_id NULO (ej: '+nulos.slice(0,3).map(function(x){return x.numero_factura||x.id_factura}).join(',')+') — revisar flujo /api/facturar');
                return rows;
            }
        } catch (e) { /* fallback a pedidos */ }
    }
    let sql = `
        SELECT p.id_pedido, p.id_mesa, p.id_usuario, p.id_jornada, p.total,
               p.metodo_pago, p.sub_metodo_pago, p.referencia_pago,
               p.descuento, p.es_cortesia, p.propina,
               p.timestamp_pedido, p.timestamp_despacho,
               p.id_mesero, p.id_cajero,
               m.numero AS mesa_numero, m.zona AS mesa_zona,
               u.nombre AS usuario_nombre,
               u_mesero.nombre AS mesero_nombre,
               u_cajero.nombre AS cajero_nombre
        FROM pedidos p
        LEFT JOIN mesas m ON p.id_mesa = m.id_mesa
        LEFT JOIN usuarios u ON p.id_usuario = u.id_usuario
        LEFT JOIN usuarios u_mesero ON p.id_mesero = u_mesero.id_usuario
        LEFT JOIN usuarios u_cajero ON p.id_cajero = u_cajero.id_usuario
        WHERE p.estado = 'Pagado'
    `;
    const params = [];

    if (filtros) {
        if (filtros.busqueda) {
            const term = '%' + filtros.busqueda + '%';
            sql += ` AND (
                CAST(p.id_pedido AS CHAR) LIKE ? OR
                CAST(m.numero AS CHAR) LIKE ? OR
                u.nombre LIKE ? OR
                u_mesero.nombre LIKE ? OR
                u_cajero.nombre LIKE ? OR
                p.metodo_pago LIKE ? OR
                p.sub_metodo_pago LIKE ? OR
                p.referencia_pago LIKE ?
            )`;
            params.push(term, term, term, term, term, term, term, term);
        }
        if (filtros.fecha_inicio) {
            sql += ' AND p.timestamp_despacho >= ?';
            params.push(filtros.fecha_inicio);
        }
        if (filtros.fecha_fin) {
            sql += ' AND p.timestamp_despacho <= ?';
            params.push(filtros.fecha_fin);
        }
        if (filtros.id_jornada) {
            sql += ' AND p.id_jornada = ?';
            params.push(filtros.id_jornada);
        }
        if (filtros.metodo_pago) {
            sql += ' AND p.metodo_pago = ?';
            params.push(filtros.metodo_pago);
        }
        if (filtros.id_mesero) { sql += ' AND COALESCE(p.id_mesero, p.id_usuario) = ?'; params.push(Number(filtros.id_mesero)); }
        if (filtros.id_cajero) { sql += ' AND COALESCE(p.id_cajero, p.id_usuario) = ?'; params.push(Number(filtros.id_cajero)); }
    }

    sql += ' ORDER BY p.timestamp_despacho DESC';

    if (filtros && filtros.limite) {
        sql += ' LIMIT ?';
        params.push(Number(filtros.limite));
    }

    const [rows] = await pool.query(sql, params);
    if (rows.length) {
        const nulos = rows.filter(function(r){ return r.id_cajero == null; });
        if (nulos.length) console.warn('[ALERTA PEDIDOS] '+nulos.length+' pedidos pagados con cajero_id NULO (fallback sin facturas)');
    }
    return rows;
}

async function obtenerFacturaMesaDetalle(idPedido) {
    if (await existeTablaFacturas()) {
        try {
            const [facts] = await pool.query(
                `SELECT f.id_factura AS id_pedido, f.id_factura, f.id_mesa, f.id_usuario, f.id_jornada, f.total,
                        f.subtotal, f.descuento, f.es_cortesia, f.propina, f.impuestos,
                        f.metodo_pago, f.sub_metodo_pago, f.referencia_pago,
                        f.fecha AS timestamp_pedido, f.fecha AS timestamp_despacho,
                        f.numero_factura,
                        f.id_mesero, f.id_cajero,
                        m.numero AS mesa_numero, m.zona AS mesa_zona,
                        u.nombre AS usuario_nombre,
                        u_mesero.nombre AS mesero_nombre,
                        u_cajero.nombre AS cajero_nombre
                 FROM facturas f
                 LEFT JOIN mesas m ON f.id_mesa = m.id_mesa
                 LEFT JOIN usuarios u ON f.id_usuario = u.id_usuario
                 LEFT JOIN usuarios u_mesero ON f.id_mesero = u_mesero.id_usuario
                 LEFT JOIN usuarios u_cajero ON f.id_cajero = u_cajero.id_usuario
                 WHERE f.id_factura = ? OR f.numero_factura = ?`,
                [idPedido, String(idPedido).startsWith('F-') ? String(idPedido) : 'F-' + String(idPedido).padStart(6,'0')]
            );
            if (facts.length) {
                const factura = facts[0];
                const [detalles] = await pool.query(
                    `SELECT df.id_detalle, df.id_producto, df.producto_nombre,
                            df.cantidad, df.precio_unitario, df.subtotal,
                            df.presentacion, df.observaciones
                     FROM detalle_factura df WHERE df.id_factura = ?`,
                    [factura.id_factura]
                );
                if (detalles.length) {
                    return { ...factura, detalles, es_factura_unificada: 1 };
                }
            }
        } catch (e) { /* fallback */ }
        try {
            const [byPedido] = await pool.query("SELECT id_factura FROM pedidos WHERE id_pedido = ? AND id_factura IS NOT NULL", [idPedido]);
            if (byPedido.length && byPedido[0].id_factura) {
                const [facts2] = await pool.query(
                    `SELECT f.id_factura AS id_pedido, f.id_factura, f.id_mesa, f.id_usuario, f.id_jornada, f.total,
                            f.subtotal, f.descuento, f.es_cortesia, f.propina, f.impuestos,
                            f.metodo_pago, f.sub_metodo_pago, f.referencia_pago,
                            f.fecha AS timestamp_pedido, f.fecha AS timestamp_despacho,
                            f.numero_factura,
                            f.id_mesero, f.id_cajero,
                            m.numero AS mesa_numero, m.zona AS mesa_zona,
                            u.nombre AS usuario_nombre,
                            u_mesero.nombre AS mesero_nombre,
                            u_cajero.nombre AS cajero_nombre
                     FROM facturas f
                     LEFT JOIN mesas m ON f.id_mesa = m.id_mesa
                     LEFT JOIN usuarios u ON f.id_usuario = u.id_usuario
                     LEFT JOIN usuarios u_mesero ON f.id_mesero = u_mesero.id_usuario
                     LEFT JOIN usuarios u_cajero ON f.id_cajero = u_cajero.id_usuario
                     WHERE f.id_factura = ?`,
                    [byPedido[0].id_factura]
                );
                if (facts2.length) {
                    const factura = facts2[0];
                    const [detalles] = await pool.query("SELECT df.id_detalle, df.id_producto, df.producto_nombre, df.cantidad, df.precio_unitario, df.subtotal, df.presentacion, df.observaciones FROM detalle_factura df WHERE df.id_factura = ?", [factura.id_factura]);
                    return { ...factura, detalles, es_factura_unificada: 1 };
                }
            }
        } catch (e) {}
    }
    const [pedidos] = await pool.query(
        `SELECT p.id_pedido, p.id_mesa, p.id_usuario, p.id_jornada, p.total,
                p.metodo_pago, p.sub_metodo_pago, p.referencia_pago,
                p.descuento, p.es_cortesia, p.propina,
                p.timestamp_pedido, p.timestamp_despacho,
                p.id_mesero, p.id_cajero,
                m.numero AS mesa_numero, m.zona AS mesa_zona,
                u.nombre AS usuario_nombre,
                u_mesero.nombre AS mesero_nombre,
                u_cajero.nombre AS cajero_nombre
         FROM pedidos p
         LEFT JOIN mesas m ON p.id_mesa = m.id_mesa
         LEFT JOIN usuarios u ON p.id_usuario = u.id_usuario
         LEFT JOIN usuarios u_mesero ON p.id_mesero = u_mesero.id_usuario
         LEFT JOIN usuarios u_cajero ON p.id_cajero = u_cajero.id_usuario
         WHERE p.id_pedido = ?`,
        [idPedido]
    );
    if (pedidos.length === 0) return null;
    const pedido = pedidos[0];

    const [detalles] = await pool.query(
        `SELECT dp.id_detalle, dp.id_producto, prod.nombre AS producto_nombre,
                dp.cantidad, dp.precio_unitario, dp.subtotal,
                dp.presentacion, dp.observaciones, dp.estado
         FROM detalle_pedido dp
         LEFT JOIN productos prod ON dp.id_producto = prod.id_producto
         WHERE dp.id_pedido = ?`,
        [idPedido]
    );

    return { ...pedido, detalles };
}

// =========================================================
// FACTURAS DE COMPRAS / PROVEEDORES
// =========================================================

async function obtenerFacturasCompras(filtros) {
    let sql = `
        SELECT c.id_compra, c.id_proveedor, c.id_usuario, c.fecha,
               c.numero_factura, c.total, c.subtotal, c.descuento,
               c.base_gravable, c.iva, c.ico,
               c.observaciones, c.forma_pago, c.metodo_pago,
               c.estado, c.saldo_pendiente,
               c.fecha_factura, c.dias_credito, c.fecha_vencimiento,
               pr.nombre AS proveedor_nombre, pr.nit AS proveedor_nit,
               u.nombre AS usuario_nombre
        FROM compras c
        LEFT JOIN proveedores pr ON c.id_proveedor = pr.id_proveedor
        LEFT JOIN usuarios u ON c.id_usuario = u.id_usuario
        WHERE 1=1
    `;
    const params = [];

    if (filtros) {
        if (filtros.busqueda) {
            const term = '%' + filtros.busqueda + '%';
            sql += ` AND (
                CAST(c.id_compra AS CHAR) LIKE ? OR
                c.numero_factura LIKE ? OR
                pr.nombre LIKE ? OR
                pr.nit LIKE ? OR
                c.metodo_pago LIKE ?
            )`;
            params.push(term, term, term, term, term);
        }
        if (filtros.fecha_inicio) {
            sql += ' AND c.fecha >= ?';
            params.push(filtros.fecha_inicio);
        }
        if (filtros.fecha_fin) {
            sql += ' AND c.fecha <= ?';
            params.push(filtros.fecha_fin);
        }
        if (filtros.estado) {
            sql += ' AND c.estado = ?';
            params.push(filtros.estado);
        }
        if (filtros.id_proveedor) {
            sql += ' AND c.id_proveedor = ?';
            params.push(filtros.id_proveedor);
        }
    }

    sql += ' ORDER BY c.fecha DESC';

    if (filtros && filtros.limite) {
        sql += ' LIMIT ?';
        params.push(Number(filtros.limite));
    }

    const [rows] = await pool.query(sql, params);
    return rows;
}

async function obtenerFacturaCompraDetalle(idCompra) {
    const [compras] = await pool.query(
        `SELECT c.*, pr.nombre AS proveedor_nombre, pr.nit AS proveedor_nit,
                pr.direccion AS proveedor_direccion, pr.telefono AS proveedor_telefono,
                pr.correo AS proveedor_correo,
                u.nombre AS usuario_nombre
         FROM compras c
         LEFT JOIN proveedores pr ON c.id_proveedor = pr.id_proveedor
         LEFT JOIN usuarios u ON c.id_usuario = u.id_usuario
         WHERE c.id_compra = ?`,
        [idCompra]
    );
    if (compras.length === 0) return null;
    const compra = compras[0];

    const [detalles] = await pool.query(
        `SELECT dc.id_detalle, dc.id_producto, prod.nombre AS producto_nombre,
                dc.cantidad, dc.costo_unitario, dc.subtotal,
                dc.descuento, dc.iva_pct, dc.ico_pct, dc.iva, dc.ico, dc.total_linea
         FROM detalle_compras dc
         LEFT JOIN productos prod ON dc.id_producto = prod.id_producto
         WHERE dc.id_compra = ?`,
        [idCompra]
    );

    const [pagos] = await pool.query(
        `SELECT pp.id_pago, pp.monto, pp.metodo_pago, pp.referencia,
                pp.fecha_pago, u.nombre AS usuario_nombre
         FROM pagos_proveedores pp
         LEFT JOIN usuarios u ON pp.id_usuario = u.id_usuario
         WHERE pp.id_compra = ?
         ORDER BY pp.fecha_pago ASC`,
        [idCompra]
    );

    return { ...compra, detalles, pagos };
}

// =========================================================
// CUENTAS POR COBRAR / VALES
// =========================================================

async function obtenerFacturasVales(filtros) {
    let sql = `
        SELECT cp.id_vale, cp.cliente_socio, cp.id_cliente_socio, cp.id_mesa,
               cp.total, cp.saldo_pendiente, cp.estado, cp.fecha,
               cp.fecha_vencimiento, cp.tipo_mora, cp.tasa_mora,
               cp.mora_acumulada, cp.capital_pagado, cp.mora_pagada,
               cp.exonerada_mora, cp.referencia,
               u.nombre AS usuario_nombre,
               m.numero AS mesa_numero,
               cs.telefono AS cliente_telefono,
               cs.documento AS cliente_documento
        FROM cuentas_por_cobrar cp
        LEFT JOIN usuarios u ON cp.id_usuario_autoriza = u.id_usuario
        LEFT JOIN mesas m ON cp.id_mesa = m.id_mesa
        LEFT JOIN clientes_socios cs ON cp.id_cliente_socio = cs.id_cliente
        WHERE 1=1
    `;
    const params = [];

    if (filtros) {
        if (filtros.busqueda) {
            const term = '%' + filtros.busqueda + '%';
            sql += ` AND (
                CAST(cp.id_vale AS CHAR) LIKE ? OR
                cp.cliente_socio LIKE ? OR
                cs.documento LIKE ? OR
                cs.telefono LIKE ? OR
                cp.referencia LIKE ?
            )`;
            params.push(term, term, term, term, term);
        }
        if (filtros.fecha_inicio) {
            sql += ' AND cp.fecha >= ?';
            params.push(filtros.fecha_inicio);
        }
        if (filtros.fecha_fin) {
            sql += ' AND cp.fecha <= ?';
            params.push(filtros.fecha_fin);
        }
        if (filtros.estado) {
            sql += ' AND cp.estado = ?';
            params.push(filtros.estado);
        }
    }

    sql += ' ORDER BY cp.fecha DESC';

    if (filtros && filtros.limite) {
        sql += ' LIMIT ?';
        params.push(Number(filtros.limite));
    }

    const [rows] = await pool.query(sql, params);
    return rows;
}

async function obtenerFacturaValeDetalle(idVale) {
    const [vales] = await pool.query(
        `SELECT cp.*, u.nombre AS usuario_nombre,
                m.numero AS mesa_numero,
                cs.telefono AS cliente_telefono, cs.documento AS cliente_documento,
                cs.correo AS cliente_correo, cs.limite_credito
         FROM cuentas_por_cobrar cp
         LEFT JOIN usuarios u ON cp.id_usuario_autoriza = u.id_usuario
         LEFT JOIN mesas m ON cp.id_mesa = m.id_mesa
         LEFT JOIN clientes_socios cs ON cp.id_cliente_socio = cs.id_cliente
         WHERE cp.id_vale = ?`,
        [idVale]
    );
    if (vales.length === 0) return null;
    const vale = vales[0];

    const [abonos] = await pool.query(
        `SELECT av.id_abono, av.monto_abono, av.monto_capital, av.monto_mora,
                av.metodo_pago, av.sub_metodo_pago, av.referencia,
                av.fecha, u.nombre AS usuario_nombre
         FROM abonos_vales av
         LEFT JOIN usuarios u ON av.id_usuario = u.id_usuario
         WHERE av.id_vale = ?
         ORDER BY av.fecha ASC`,
        [idVale]
    );

    return { ...vale, abonos };
}

module.exports = {
    obtenerFacturasMesas,
    obtenerFacturaMesaDetalle,
    obtenerFacturasCompras,
    obtenerFacturaCompraDetalle,
    obtenerFacturasVales,
    obtenerFacturaValeDetalle
};
