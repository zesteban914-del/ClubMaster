const { pool } = require('../config/database');
const { redondear } = require('../helpers/db-helpers');

async function obtenerProveedores() {
    const [rows] = await pool.query(`
        SELECT p.*,
               (SELECT COALESCE(SUM(c.saldo_pendiente), 0)
                FROM compras c
                WHERE c.id_proveedor = p.id_proveedor
                  AND c.estado != 'Anulada'
                  AND c.estado IS NOT NULL) AS saldo_pendiente
        FROM proveedores p
        ORDER BY p.nombre ASC
    `);
    return rows;
}

async function crearProveedor(datos) {
    const [result] = await pool.query(
        `INSERT INTO proveedores
            (nombre, razon_social, nit, categoria, contacto, telefono, correo, direccion,
             dias_credito, limite_credito, banco, tipo_cuenta, numero_cuenta, activo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [datos.nombre, datos.razon_social || '', datos.nit || '', datos.categoria || 'General',
         datos.contacto || '', datos.telefono || '', datos.correo || '', datos.direccion || '',
         Number(datos.dias_credito) || 0, Number(datos.limite_credito) || 0,
         datos.banco || '', datos.tipo_cuenta || '', datos.numero_cuenta || '']
    );
    return { id_proveedor: result.insertId };
}

async function actualizarProveedor(id, datos) {
    await pool.query(
        `UPDATE proveedores SET nombre = ?, razon_social = ?, nit = ?, categoria = ?,
            contacto = ?, telefono = ?, correo = ?, direccion = ?,
            dias_credito = ?, limite_credito = ?, banco = ?, tipo_cuenta = ?, numero_cuenta = ?
         WHERE id_proveedor = ?`,
        [datos.nombre, datos.razon_social || '', datos.nit || '', datos.categoria || 'General',
         datos.contacto || '', datos.telefono || '', datos.correo || '', datos.direccion || '',
         Number(datos.dias_credito) || 0, Number(datos.limite_credito) || 0,
         datos.banco || '', datos.tipo_cuenta || '', datos.numero_cuenta || '', id]
    );
}

async function toggleProveedor(id, activo) {
    await pool.query('UPDATE proveedores SET activo = ? WHERE id_proveedor = ?', [activo, id]);
}

async function obtenerComprasPorProveedor(idProveedor) {
    const [rows] = await pool.query(`
        SELECT c.*, u.nombre AS usuario_nombre,
               (SELECT COUNT(*) FROM detalle_compras dc WHERE dc.id_compra = c.id_compra) AS items_count,
               DATEDIFF(COALESCE(c.fecha_vencimiento, CURDATE()), CURDATE()) AS dias_vencimiento
        FROM compras c
        LEFT JOIN usuarios u ON c.id_usuario = u.id_usuario
        WHERE c.id_proveedor = ?
        ORDER BY c.fecha DESC
    `, [idProveedor]);
    return rows;
}

async function obtenerPagosPorProveedor(idProveedor) {
    const [rows] = await pool.query(`
        SELECT pp.*, u.nombre AS usuario_nombre, c.numero_factura
        FROM pagos_proveedores pp
        LEFT JOIN usuarios u ON pp.id_usuario = u.id_usuario
        LEFT JOIN compras c ON pp.id_compra = c.id_compra
        WHERE pp.id_proveedor = ?
        ORDER BY pp.fecha_pago DESC
    `, [idProveedor]);
    return rows;
}

async function obtenerFichaProveedor(idProveedor) {
    const [prov] = await pool.query('SELECT * FROM proveedores WHERE id_proveedor = ?', [idProveedor]);
    if (prov.length === 0) return null;

    const proveedor = prov[0];
    const compras = await obtenerComprasPorProveedor(idProveedor);
    const pagos = await obtenerPagosPorProveedor(idProveedor);

    const totalComprado = compras.reduce(function(a, c) { return a + Number(c.total || 0); }, 0);
    const totalPendiente = compras
        .filter(function(c) { return c.estado !== 'Anulada'; })
        .reduce(function(a, c) { return a + Number(c.saldo_pendiente || 0); }, 0);
    const totalAbonado = pagos.reduce(function(a, p) { return a + Number(p.monto || 0); }, 0);
    proveedor.saldo_pendiente = totalPendiente;

    return {
        proveedor: proveedor,
        compras: compras,
        pagos: pagos,
        total_comprado: totalComprado,
        total_pendiente: totalPendiente,
        total_abonado: totalAbonado
    };
}

async function crearPagoProveedor(idProveedor, idCompra, monto, metodoPago, referencia, idUsuario, observaciones) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [res] = await connection.query(
            `INSERT INTO pagos_proveedores (id_proveedor, id_compra, id_usuario, monto, metodo_pago, referencia, observaciones)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [idProveedor, idCompra || null, idUsuario || null, monto, metodoPago || '', referencia || '', observaciones || '']
        );

        if (idCompra) {
            const [rows] = await connection.query(
                'SELECT saldo_pendiente FROM compras WHERE id_compra = ? AND id_proveedor = ?',
                [idCompra, idProveedor]
            );
            if (rows.length === 0) {
                throw new Error('La factura no pertenece a este proveedor');
            }
            const saldoActual = Number(rows[0].saldo_pendiente);
            if (Number(monto) > saldoActual) {
                throw new Error('El abono supera el saldo pendiente de la factura ($' + saldoActual.toFixed(2) + ')');
            }
            const nuevoSaldo = Math.max(0, saldoActual - Number(monto));
            const nuevoEstado = nuevoSaldo <= 0 ? 'Pagada' : 'Parcial';
            await connection.query(
                'UPDATE compras SET saldo_pendiente = ?, estado = ? WHERE id_compra = ?',
                [nuevoSaldo, nuevoEstado, idCompra]
            );
        }

        await connection.commit();
        return { id_pago: res.insertId };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

async function obtenerCompras() {
    const [rows] = await pool.query(`
        SELECT c.*, p.nombre AS proveedor_nombre, u.nombre AS usuario_nombre
        FROM compras c
        LEFT JOIN proveedores p ON c.id_proveedor = p.id_proveedor
        LEFT JOIN usuarios u ON c.id_usuario = u.id_usuario
        ORDER BY c.fecha DESC
    `);
    return rows;
}

async function crearCompra(idProveedor, idUsuario, numeroFactura, total, observaciones, detalles, datos) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        if (!detalles || detalles.length === 0) throw new Error('La compra debe incluir al menos un producto.');

        datos = datos || {};
        const metodoPago = (datos.metodo_pago || '').trim();
        const esCredito = datos.forma_pago === 'Credito' || /credito|factura a pagar/i.test(metodoPago);
        const formaPago = esCredito ? 'Credito' : 'Contado';
        let diasCredito = Number(datos.dias_credito) || 0;
        const estado = esCredito ? 'Pendiente' : 'Pagada';
        const fechaFactura = datos.fecha_factura || null;

        const ivaPctDef = Number(datos.iva_pct) || 0;
        const icoPctDef = Number(datos.ico_pct) || 0;

        let subtotal = 0, totalDescuento = 0, totalIva = 0, totalIco = 0;
        const lineas = [];
        for (const item of detalles) {
            const cantidad = Number(item.cantidad) || 0;
            const costo = Number(item.costo_unitario) || 0;
            if (cantidad <= 0) throw new Error('La cantidad de cada producto debe ser mayor a 0.');
            if (costo <= 0) throw new Error('El costo unitario de cada producto debe ser mayor a 0 (producto ' + (item.id_producto || '?') + ').');

            const sub = redondear(cantidad * costo);
            const desc = redondear(Math.min(Number(item.descuento) || 0, sub));
            const base = redondear(sub - desc);
            const ivaPct = (item.iva_pct !== undefined && item.iva_pct !== null && item.iva_pct !== '') ? Number(item.iva_pct) : ivaPctDef;
            const icoPct = (item.ico_pct !== undefined && item.ico_pct !== null && item.ico_pct !== '') ? Number(item.ico_pct) : icoPctDef;
            const iva = redondear(base * ivaPct / 100);
            const ico = redondear(base * icoPct / 100);
            const totalLinea = redondear(base + iva + ico);

            subtotal += sub;
            totalDescuento += desc;
            totalIva += iva;
            totalIco += ico;
            lineas.push({ item, cantidad, costo, sub, desc, base, ivaPct, icoPct, iva, ico, totalLinea });
        }
        subtotal = redondear(subtotal);
        totalDescuento = redondear(totalDescuento);
        totalIva = redondear(totalIva);
        totalIco = redondear(totalIco);
        const baseGravable = redondear(subtotal - totalDescuento);
        const totalCompra = redondear(baseGravable + totalIva + totalIco);

        let fechaVencimiento = datos.fecha_vencimiento || null;
        if (esCredito) {
            const baseFecha = fechaFactura ? new Date(String(fechaFactura).replace(/-/g, '/')) : new Date();
            if (!fechaVencimiento && diasCredito > 0) {
                const venc = new Date(baseFecha.getTime() + diasCredito * 86400000);
                fechaVencimiento = venc.toISOString().slice(0, 10);
            } else if (fechaVencimiento && diasCredito === 0) {
                const fin = new Date(String(fechaVencimiento).replace(/-/g, '/'));
                diasCredito = Math.max(0, Math.round((fin - baseFecha) / 86400000));
            }
        }
        const saldoPendiente = esCredito ? totalCompra : 0;

        const [resCompra] = await connection.query(
            `INSERT INTO compras
                (id_proveedor, id_usuario, numero_factura, fecha, fecha_factura,
                 total, subtotal, descuento, base_gravable, iva, ico, observaciones,
                 forma_pago, dias_credito, fecha_vencimiento, metodo_pago, estado,
                 saldo_pendiente, soporte)
             VALUES (?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [idProveedor, idUsuario, numeroFactura, fechaFactura,
             totalCompra, subtotal, totalDescuento, baseGravable, totalIva, totalIco, observaciones,
             formaPago, diasCredito, fechaVencimiento, metodoPago, estado,
             saldoPendiente, datos.soporte || null]
        );
        const idCompra = resCompra.insertId;

        const actualizacionesStock = [];
        const preciosActualizados = [];
        const advertenciasBackend = [];
        // Para resolver columna de precio venta dinámicamente
        let colVenta = null;
        try {
            const { obtenerColumnasProductos } = require('../helpers/column-detection');
            const c = obtenerColumnasProductos();
            colVenta = c.venta || 'precio';
        } catch(e) { colVenta = 'precio'; }
        for (const linea of lineas) {
            const item = linea.item;
            const idBodegaLinea = item.id_bodega || datos.id_bodega || null;
            await connection.query(
                `INSERT INTO detalle_compras
                    (id_compra, id_producto, cantidad, costo_unitario, subtotal,
                     descuento, iva_pct, ico_pct, iva, ico, total_linea, id_bodega)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [idCompra, item.id_producto, linea.cantidad, linea.costo, linea.sub,
                 linea.desc, linea.ivaPct, linea.icoPct, linea.iva, linea.ico, linea.totalLinea, idBodegaLinea]
            );
            const { actualizarStockYCPP } = require('./producto-service');
            const upd = await actualizarStockYCPP(item.id_producto, linea.cantidad, linea.costo, connection, idBodegaLinea);
            console.log(`[compras] stock actualizado id=${item.id_producto} ${upd.stockAnterior} -> ${upd.stockNuevo} ( +${linea.cantidad}) costo ${upd.costoAnterior} -> ${upd.costoMedio} bodega=${idBodegaLinea||'central'}`);
            actualizacionesStock.push(upd);
            // REQ 4: chequeo backend costo vs precio_venta + actualización nuevo_precio_venta si viene
            try {
                const nuevoPv = item.nuevo_precio_venta != null ? Number(item.nuevo_precio_venta) : (item.nuevoPrecioVenta != null ? Number(item.nuevoPrecioVenta) : null);
                // obtener PV actual para advertencia
                const [rowsPv] = await connection.query('SELECT * FROM productos WHERE id_producto = ? LIMIT 1', [item.id_producto]);
                let pvActual = 0;
                let nombreProd = 'Producto #' + item.id_producto;
                if (rowsPv.length) {
                    const r = rowsPv[0];
                    nombreProd = r.nombre || nombreProd;
                    pvActual = r[colVenta] != null ? Number(r[colVenta]) : (r.precio_venta != null ? Number(r.precio_venta) : Number(r.precio)||0);
                }
                if (pvActual > 0 && linea.costo > pvActual) {
                    if (nuevoPv != null && nuevoPv > linea.costo) {
                        // ok, se corrige con nuevo PV - se actualizará abajo
                        advertenciasBackend.push(nombreProd + ': costo $'+linea.costo+' > PV $'+pvActual+' corregido a $'+nuevoPv);
                    } else {
                        advertenciasBackend.push(nombreProd + ': costo $'+linea.costo+' > PV $'+pvActual+' (revisar margen)');
                    }
                }
                if (nuevoPv != null && nuevoPv > 0) {
                    if (nuevoPv <= linea.costo) {
                        console.warn('[compras] nuevo PV $'+nuevoPv+' <= costo $'+linea.costo+' para id '+item.id_producto+' — se registra advertencia');
                    }
                    // actualizar precio venta en productos
                    try {
                        await connection.query('UPDATE productos SET ' + colVenta + ' = ? WHERE id_producto = ?', [nuevoPv, item.id_producto]);
                    } catch(eUpd) {
                        // fallback si colVenta no existe, probar columnas alternas
                        try { await connection.query('UPDATE productos SET precio = ? WHERE id_producto = ?', [nuevoPv, item.id_producto]); } catch(e2) {}
                        try { await connection.query('UPDATE productos SET precio_venta = ? WHERE id_producto = ?', [nuevoPv, item.id_producto]); } catch(e3) {}
                    }
                    preciosActualizados.push({ id_producto: item.id_producto, nombre: nombreProd, precio_anterior: pvActual, nuevo_precio: nuevoPv });
                    console.log('[compras] precio venta actualizado id='+item.id_producto+' '+pvActual+' -> '+nuevoPv);
                }
            } catch(ePv) {
                console.warn('[compras] no se pudo validar/actualizar PV para id '+item.id_producto+': '+ePv.message);
            }
        }

        let cajaEgreso = false;
        if (!esCredito) {
            const [jornadas] = await connection.query(
                "SELECT id_jornada FROM jornadas WHERE estado = 'Abierta' ORDER BY id_jornada DESC LIMIT 1"
            );
            if (jornadas.length > 0) {
                const esEfectivoCaja = /efectivo|caja/i.test(metodoPago);
                const categoriaEgreso = esEfectivoCaja ? 'Pago a proveedor' : 'Transferencia a proveedor';
                const conceptoEgreso = 'Compra #' + idCompra + (numeroFactura ? ' - Factura ' + numeroFactura : '') + ' (' + (metodoPago || formaPago) + ')';
                await connection.query(
                    `INSERT INTO movimientos_caja (id_jornada, id_usuario, tipo, categoria, concepto, monto, numero_comprobante, justificacion)
                     VALUES (?, ?, 'Egreso', ?, ?, ?, ?, ?)`,
                    [jornadas[0].id_jornada, idUsuario || null, categoriaEgreso,
                     conceptoEgreso, totalCompra, numeroFactura || '', observaciones || '']
                );
                cajaEgreso = true;
            }
        }

        await connection.commit();
        return {
            id_compra: idCompra,
            forma_pago: formaPago,
            estado: estado,
            total: totalCompra,
            subtotal: subtotal,
            descuento: totalDescuento,
            base_gravable: baseGravable,
            iva: totalIva,
            ico: totalIco,
            caja_egreso: cajaEgreso,
            saldo_pendiente: saldoPendiente,
            costo_medio_actualizado: actualizacionesStock,
            precios_actualizados: preciosActualizados,
            advertencias: advertenciasBackend
        };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

async function obtenerDetalleCompra(idCompra) {
    const [rows] = await pool.query(`
        SELECT dc.*, p.nombre AS producto_nombre
        FROM detalle_compras dc
        LEFT JOIN productos p ON dc.id_producto = p.id_producto
        WHERE dc.id_compra = ?
    `, [idCompra]);
    return rows;
}

module.exports = {
    obtenerProveedores,
    crearProveedor,
    actualizarProveedor,
    toggleProveedor,
    obtenerFichaProveedor,
    obtenerComprasPorProveedor,
    obtenerPagosPorProveedor,
    crearPagoProveedor,
    obtenerCompras,
    crearCompra,
    obtenerDetalleCompra
};
