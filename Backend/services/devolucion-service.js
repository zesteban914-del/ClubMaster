const { pool } = require('../config/database');
const { redondear } = require('../helpers/db-helpers');
const { obtenerColumnasProductos } = require('../helpers/column-detection');

const MOTIVOS_DEVOLUCION = ['Dañado', 'Vencido', 'Error de pedido', 'Otro'];

async function ensureTables() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS productos_proveedores (
            id_relacion INT AUTO_INCREMENT PRIMARY KEY,
            id_producto INT NOT NULL,
            id_proveedor INT NOT NULL,
            precio_compra DECIMAL(12,2) NOT NULL DEFAULT 0.00,
            referencia_proveedor VARCHAR(80) NULL,
            tiempo_entrega INT NULL,
            es_preferido TINYINT(1) NOT NULL DEFAULT 0,
            UNIQUE KEY uq_prod_prov (id_producto, id_proveedor),
            KEY idx_pp_proveedor (id_proveedor),
            KEY idx_pp_producto (id_producto),
            CONSTRAINT fk_pp_producto FOREIGN KEY (id_producto) REFERENCES productos(id_producto) ON DELETE CASCADE,
            CONSTRAINT fk_pp_proveedor FOREIGN KEY (id_proveedor) REFERENCES proveedores(id_proveedor) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS devoluciones (
            id_devolucion INT AUTO_INCREMENT PRIMARY KEY,
            numero_devolucion VARCHAR(20) NOT NULL UNIQUE,
            id_proveedor INT NOT NULL,
            id_usuario INT NULL,
            fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            motivo_general VARCHAR(255) DEFAULT '',
            estado ENUM('Pendiente','Aprobada','Completada','Rechazada') NOT NULL DEFAULT 'Pendiente',
            total_devuelto DECIMAL(12,2) NOT NULL DEFAULT 0.00,
            notas TEXT NULL,
            stock_descontado TINYINT(1) NOT NULL DEFAULT 0,
            id_jornada INT NULL,
            KEY idx_dev_proveedor (id_proveedor),
            KEY idx_dev_fecha (fecha),
            KEY idx_dev_estado (estado),
            CONSTRAINT fk_dev_proveedor FOREIGN KEY (id_proveedor) REFERENCES proveedores(id_proveedor)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS detalle_devoluciones (
            id_detalle INT AUTO_INCREMENT PRIMARY KEY,
            id_devolucion INT NOT NULL,
            id_producto INT NOT NULL,
            cantidad DECIMAL(12,2) NOT NULL DEFAULT 0.00,
            costo_unitario DECIMAL(12,2) NOT NULL DEFAULT 0.00,
            motivo ENUM('Dañado','Vencido','Error de pedido','Otro') NOT NULL DEFAULT 'Otro',
            genera_nota_credito TINYINT(1) NOT NULL DEFAULT 0,
            subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
            KEY idx_ddev_devolucion (id_devolucion),
            KEY idx_ddev_producto (id_producto),
            CONSTRAINT fk_ddev_devolucion FOREIGN KEY (id_devolucion) REFERENCES devoluciones(id_devolucion) ON DELETE CASCADE,
            CONSTRAINT fk_ddev_producto FOREIGN KEY (id_producto) REFERENCES productos(id_producto)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS kardex (
            id_kardex INT AUTO_INCREMENT PRIMARY KEY,
            id_producto INT NOT NULL,
            fecha_hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            tipo_movimiento VARCHAR(80) NOT NULL,
            cantidad DECIMAL(12,2) NOT NULL,
            costo_unitario DECIMAL(12,2) NOT NULL DEFAULT 0.00,
            saldo_cantidad DECIMAL(12,2) NOT NULL DEFAULT 0.00,
            costo_promedio DECIMAL(12,2) NOT NULL DEFAULT 0.00,
            referencia VARCHAR(150) NULL,
            KEY idx_kardex_producto (id_producto),
            CONSTRAINT fk_kardex_producto FOREIGN KEY (id_producto) REFERENCES productos(id_producto)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    try { await pool.query('ALTER TABLE kardex MODIFY COLUMN tipo_movimiento VARCHAR(80) NOT NULL'); } catch (e) {}
    try { await pool.query('ALTER TABLE kardex MODIFY COLUMN referencia VARCHAR(150) NULL'); } catch (e) {}
}

function getCostoCol() {
    const c = obtenerColumnasProductos();
    return c.costo || 'precio_costo';
}

async function obtenerProductosPorProveedor(idProveedor) {
    const c = obtenerColumnasProductos();
    const colCosto = c.costo || 'precio_costo';
    const selectCosto = c.costo ? ('p.' + c.costo + ' AS costo_actual') : 'p.precio_costo AS costo_actual';
    const [rows] = await pool.query(`
        SELECT pp.id_relacion, pp.id_producto AS id_producto, pp.id_proveedor,
               pp.precio_compra, pp.referencia_proveedor, pp.tiempo_entrega, pp.es_preferido,
               p.nombre AS producto_nombre, p.activo,
               p.stock AS stock_actual, ${selectCosto},
               p.unidad_medida AS unidad
        FROM productos_proveedores pp
        LEFT JOIN productos p ON pp.id_producto = p.id_producto
        WHERE pp.id_proveedor = ?
        ORDER BY pp.es_preferido DESC, p.nombre ASC
    `, [idProveedor]);
    return rows;
}

async function obtenerProductosActivosDisponiblesParaAsociar(idProveedor) {
    const c = obtenerColumnasProductos();
    const selectCosto = c.costo ? ('p.' + c.costo + ' AS costo_actual') : 'p.precio_costo AS costo_actual';
    const [rows] = await pool.query(`
        SELECT p.id_producto, p.nombre, p.stock AS stock_actual, ${selectCosto},
               pp.id_relacion
        FROM productos p
        LEFT JOIN productos_proveedores pp ON pp.id_producto = p.id_producto AND pp.id_proveedor = ?
        WHERE p.activo = 1
        ORDER BY p.nombre ASC
    `, [idProveedor]);
    return rows;
}

async function asociarProductoProveedor(idProveedor, idProducto, datos) {
    datos = datos || {};
    const precioCompra = redondear(Number(datos.precio_compra) || 0);
    const preferido = datos.es_preferido ? 1 : 0;
    const tiempoEntrega = (datos.tiempo_entrega === '' || datos.tiempo_entrega === undefined || datos.tiempo_entrega === null)
        ? null : Math.max(0, Number(datos.tiempo_entrega) || 0);
    const [existentes] = await pool.query(
        'SELECT id_relacion FROM productos_proveedores WHERE id_producto = ? AND id_proveedor = ?',
        [idProducto, idProveedor]
    );
    let idRelacion;
    if (existentes.length > 0) {
        idRelacion = existentes[0].id_relacion;
        await pool.query(
            `UPDATE productos_proveedores
             SET precio_compra = ?, referencia_proveedor = ?, tiempo_entrega = ?, es_preferido = ?
             WHERE id_relacion = ?`,
            [precioCompra, (datos.referencia_proveedor || '').trim() || null,
             tiempoEntrega, preferido, idRelacion]
        );
    } else {
        const [res] = await pool.query(
            `INSERT INTO productos_proveedores
               (id_producto, id_proveedor, precio_compra, referencia_proveedor, tiempo_entrega, es_preferido)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [idProducto, idProveedor, precioCompra, (datos.referencia_proveedor || '').trim() || null,
             tiempoEntrega, preferido]
        );
        idRelacion = res.insertId;
    }
    if (preferido) {
        await pool.query(
            'UPDATE productos_proveedores SET es_preferido = 0 WHERE id_producto = ? AND id_relacion != ?',
            [idProducto, idRelacion]
        );
    }
    return { id_relacion: idRelacion };
}

async function actualizarRelacionProductoProveedor(idRelacion, datos) {
    datos = datos || {};
    const sets = [];
    const valores = [];
    if (datos.precio_compra !== undefined) {
        sets.push('precio_compra = ?');
        valores.push(redondear(Number(datos.precio_compra) || 0));
    }
    if (datos.referencia_proveedor !== undefined) {
        sets.push('referencia_proveedor = ?');
        valores.push((datos.referencia_proveedor || '').trim() || null);
    }
    if (datos.tiempo_entrega !== undefined) {
        const te = (datos.tiempo_entrega === '' || datos.tiempo_entrega === null)
            ? null : Math.max(0, Number(datos.tiempo_entrega) || 0);
        sets.push('tiempo_entrega = ?');
        valores.push(te);
    }
    if (datos.es_preferido !== undefined) {
        sets.push('es_preferido = ?');
        valores.push(datos.es_preferido ? 1 : 0);
    }
    if (sets.length === 0) throw new Error('No hay campos para actualizar');
    valores.push(idRelacion);
    await pool.query('UPDATE productos_proveedores SET ' + sets.join(', ') + ' WHERE id_relacion = ?', valores);
    if (datos.es_preferido) {
        const [filas] = await pool.query(
            'SELECT id_producto FROM productos_proveedores WHERE id_relacion = ?', [idRelacion]
        );
        if (filas.length) {
            await pool.query(
                'UPDATE productos_proveedores SET es_preferido = 0 WHERE id_producto = ? AND id_relacion != ?',
                [filas[0].id_producto, idRelacion]
            );
        }
    }
    return { id_relacion: idRelacion };
}

async function eliminarRelacionProductoProveedor(idRelacion) {
    const [res] = await pool.query('DELETE FROM productos_proveedores WHERE id_relacion = ?', [idRelacion]);
    return res.affectedRows;
}

async function obtenerProveedoresPorProducto(idProducto) {
    const [rows] = await pool.query(`
        SELECT pp.id_relacion, pp.id_producto, pp.id_proveedor,
               pp.precio_compra, pp.referencia_proveedor, pp.tiempo_entrega, pp.es_preferido,
               pr.nombre AS proveedor_nombre, pr.categoria, pr.telefono, pr.activo AS proveedor_activo
        FROM productos_proveedores pp
        LEFT JOIN proveedores pr ON pp.id_proveedor = pr.id_proveedor
        WHERE pp.id_producto = ?
        ORDER BY pp.es_preferido DESC, pr.nombre ASC
    `, [idProducto]);
    return rows;
}

// ============================================================
// DEVOLUCIONES
// ============================================================

function generarNumeroDevolucion(seq) {
    return 'DEV-' + String(seq).padStart(6, '0');
}

async function descontarStockDevolucion(connection, idProducto, cantidad, idBodega) {
    const [filas] = await connection.query(
        'SELECT stock, usa_stock_bodega FROM productos WHERE id_producto = ? FOR UPDATE',
        [idProducto]
    );
    if (filas.length === 0) throw new Error('Producto no encontrado (id=' + idProducto + ')');
    const producto = filas[0];
    const stockAnterior = Number(producto.stock) || 0;
    if (stockAnterior < cantidad) {
        const err = new Error('Stock insuficiente para devolución. Disponible: ' + stockAnterior);
        err.statusCode = 409;
        throw err;
    }
    const stockNuevo = redondear(stockAnterior - cantidad);
    await connection.query('UPDATE productos SET stock = ? WHERE id_producto = ?', [stockNuevo, idProducto]);
    try {
        const [cfg] = await connection.query(
            "SELECT valor FROM configuracion_general WHERE clave='usa_stock_bodega' LIMIT 1"
        );
        const usaBodega = cfg.length && cfg[0].valor === '1' && Number(producto.usa_stock_bodega) === 1;
        if (usaBodega) {
            let idBodegaEfectiva = idBodega;
            if (!idBodegaEfectiva) {
                const [b] = await connection.query(
                    'SELECT id_bodega FROM bodegas WHERE nombre="Bodega Central" LIMIT 1'
                );
                if (b.length) idBodegaEfectiva = b[0].id_bodega;
            }
            if (idBodegaEfectiva) {
                await connection.query(
                    `INSERT INTO stock_bodegas (id_producto, id_bodega, stock) VALUES (?,?,?)
                     ON DUPLICATE KEY UPDATE stock = stock - VALUES(stock)`,
                    [idProducto, idBodegaEfectiva, cantidad]
                );
            }
        }
    } catch (e) {}
    return { stockAnterior, stockNuevo, cantidad, bodega: idBodega || null };
}

async function registrarKardex(connection, idProducto, tipoMovimiento, cantidad, costoUnitario, saldoCantidad, costoPromedio, referencia) {
    await connection.query(
        `INSERT INTO kardex
           (id_producto, fecha_hora, tipo_movimiento, cantidad, costo_unitario,
            saldo_cantidad, costo_promedio, referencia)
         VALUES (?, NOW(), ?, ?, ?, ?, ?, ?)`,
        [idProducto, tipoMovimiento, cantidad, costoUnitario, saldoCantidad, costoPromedio, referencia || null]
    );
}

async function crearDevolucion(idProveedor, idUsuario, motivoGeneral, notas, detalles, datos) {
    await ensureTables();
    datos = datos || {};
    const estado = ['Aprobada', 'Completada'].indexOf(datos.estado) !== -1 ? datos.estado
        : (datos.estado === 'Rechazada' ? 'Rechazada' : 'Pendiente');
    const idBodega = datos.id_bodega || null;

    if (!detalles || detalles.length === 0) throw new Error('La devolución debe incluir al menos un producto.');
    const [prov] = await pool.query('SELECT id_proveedor FROM proveedores WHERE id_proveedor = ?', [idProveedor]);
    if (prov.length === 0) throw new Error('Proveedor no encontrado');

    const colCosto = getCostoCol();
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [seqRows] = await connection.query('SELECT COALESCE(MAX(id_devolucion), 0) + 1 AS seq FROM devoluciones FOR UPDATE');
        const numero = generarNumeroDevolucion(Number(seqRows[0].seq));

        const lineas = [];
        let totalDevuelto = 0;
        for (const item of detalles) {
            const idProducto = Number(item.id_producto);
            const cantidad = Number(item.cantidad);
            if (!idProducto) throw new Error('Producto requerido en cada línea de la devolución');
            if (!cantidad || cantidad <= 0) throw new Error('La cantidad de cada producto debe ser mayor a 0');

            const motivo = MOTIVOS_DEVOLUCION.indexOf(item.motivo) !== -1 ? item.motivo : 'Otro';
            const [prodRows] = await connection.query(
                'SELECT stock, ' + colCosto + ' AS costo FROM productos WHERE id_producto = ? FOR UPDATE',
                [idProducto]
            );
            if (prodRows.length === 0) throw new Error('Producto no encontrado (id=' + idProducto + ')');
            const costoProducto = Number(prodRows[0].costo) || 0;
            const costoUnitario = (item.costo_unitario !== undefined && item.costo_unitario !== null && item.costo_unitario !== '')
                ? Number(item.costo_unitario) : costoProducto;

            const subtotal = redondear(cantidad * costoUnitario);
            totalDevuelto += subtotal;
            lineas.push({
                id_producto: idProducto,
                cantidad: cantidad,
                costo_unitario: costoUnitario,
                motivo: motivo,
                genera_nota_credito: item.genera_nota_credito ? 1 : 0,
                subtotal: subtotal
            });
        }
        totalDevuelto = redondear(totalDevuelto);

        await connection.query(
            `INSERT INTO devoluciones
               (numero_devolucion, id_proveedor, id_usuario, fecha, motivo_general, notas,
                estado, total_devuelto, stock_descontado, id_jornada)
             VALUES (?, ?, ?, NOW(), ?, ?, ?, ?, 0, ?)`,
            [numero, idProveedor, idUsuario || null, (motivoGeneral || '').trim() || '', notas || null,
             estado, totalDevuelto, datos.id_jornada || null]
        );
        const idDevolucion = connection.lastInsertId;

        for (const linea of lineas) {
            await connection.query(
                `INSERT INTO detalle_devoluciones
                   (id_devolucion, id_producto, cantidad, costo_unitario, motivo, genera_nota_credito, subtotal)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [idDevolucion, linea.id_producto, linea.cantidad, linea.costo_unitario,
                 linea.motivo, linea.genera_nota_credito, linea.subtotal]
            );
        }

        let stockAplicado = [];
        if (estado === 'Aprobada' || estado === 'Completada') {
            for (const linea of lineas) {
                const detalleStock = await descontarStockDevolucion(connection, linea.id_producto, linea.cantidad, idBodega);
                const [prodRows] = await connection.query(
                    'SELECT stock, ' + colCosto + ' AS costo FROM productos WHERE id_producto = ?',
                    [linea.id_producto]
                );
                const costoPromedio = prodRows.length ? (Number(prodRows[0].costo) || 0) : linea.costo_unitario;
                await registrarKardex(
                    connection, linea.id_producto,
                    'Salida por devolucion a proveedor',
                    -linea.cantidad, linea.costo_unitario,
                    detalleStock.stockNuevo, costoPromedio,
                    'Devolucion ' + numero + ' - Proveedor #' + idProveedor
                );
                stockAplicado.push(detalleStock);
            }
            await connection.query(
                'UPDATE devoluciones SET stock_descontado = 1 WHERE id_devolucion = ?',
                [idDevolucion]
            );
        }

        await connection.commit();
        return {
            id_devolucion: idDevolucion,
            numero_devolucion: numero,
            estado: estado,
            total_devuelto: totalDevuelto,
            stock_aplicado: stockAplicado.length > 0,
            stock_detalle: stockAplicado
        };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

async function cambiarEstadoDevolucion(idDevolucion, nuevoEstado, idUsuario) {
    await ensureTables();
    const estados = ['Pendiente', 'Aprobada', 'Completada', 'Rechazada'];
    if (estados.indexOf(nuevoEstado) === -1) throw new Error('Estado de devolución no válido');

    const colCosto = getCostoCol();
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [devoluciones] = await connection.query(
            'SELECT * FROM devoluciones WHERE id_devolucion = ? FOR UPDATE',
            [idDevolucion]
        );
        if (devoluciones.length === 0) throw new Error('Devolución no encontrada');
        const devolucion = devoluciones[0];

        if (devolucion.estado === 'Rechazada') throw new Error('Una devolución rechazada no se puede modificar');
        if (nuevoEstado === 'Pendiente' && devolucion.estado !== 'Pendiente') throw new Error('No se puede volver a Pendiente desde ' + devolucion.estado);

        const descuentaAnterior = devolucion.stock_descontado === 1;
        const descuentaNuevo = (nuevoEstado === 'Aprobada' || nuevoEstado === 'Completada');
        const diferenciaStock = descuentaNuevo && !descuentaAnterior;

        await connection.query(
            'UPDATE devoluciones SET estado = ?, id_usuario = COALESCE(?, id_usuario) WHERE id_devolucion = ?',
            [nuevoEstado, idUsuario || null, idDevolucion]
        );

        if (diferenciaStock) {
            const [detalles] = await connection.query(
                'SELECT * FROM detalle_devoluciones WHERE id_devolucion = ?', [idDevolucion]
            );
            for (const det of detalles) {
                await descontarStockDevolucion(connection, det.id_producto, Number(det.cantidad), null);
                const [prodRows] = await connection.query(
                    'SELECT stock, ' + colCosto + ' AS costo FROM productos WHERE id_producto = ?',
                    [det.id_producto]
                );
                const costoPromedio = prodRows.length ? (Number(prodRows[0].costo) || 0) : Number(det.costo_unitario);
                await registrarKardex(
                    connection, det.id_producto,
                    'Salida por devolucion a proveedor',
                    -Number(det.cantidad), Number(det.costo_unitario),
                    (prodRows.length ? Number(prodRows[0].stock) : 0), costoPromedio,
                    'Devolucion ' + devolucion.numero_devolucion + ' - Proveedor #' + devolucion.id_proveedor
                );
            }
            await connection.query(
                'UPDATE devoluciones SET stock_descontado = 1 WHERE id_devolucion = ?',
                [idDevolucion]
            );
        }

        await connection.commit();
        return {
            id_devolucion: idDevolucion,
            estado: nuevoEstado,
            stock_ajustado: !!diferenciaStock
        };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

async function obtenerDevoluciones(filtros) {
    await ensureTables();
    filtros = filtros || {};
    let where = '1=1';
    const params = [];
    if (filtros.id_proveedor) {
        where += ' AND d.id_proveedor = ?';
        params.push(filtros.id_proveedor);
    }
    if (filtros.id_producto) {
        where += ' AND EXISTS (SELECT 1 FROM detalle_devoluciones dd WHERE dd.id_devolucion = d.id_devolucion AND dd.id_producto = ?)';
        params.push(filtros.id_producto);
    }
    if (filtros.desde) {
        where += ' AND DATE(d.fecha) >= ?';
        params.push(filtros.desde);
    }
    if (filtros.hasta) {
        where += ' AND DATE(d.fecha) <= ?';
        params.push(filtros.hasta);
    }
    if (filtros.estado && ['Pendiente', 'Aprobada', 'Completada', 'Rechazada'].indexOf(filtros.estado) !== -1) {
        where += ' AND d.estado = ?';
        params.push(filtros.estado);
    }
    params.push(Number(filtros.limite) || 300);

    const [rows] = await pool.query(`
        SELECT d.*, pr.nombre AS proveedor_nombre, pr.categoria,
               (SELECT COUNT(*) FROM detalle_devoluciones dd WHERE dd.id_devolucion = d.id_devolucion) AS items_count,
               (SELECT COALESCE(SUM(dd.cantidad),0) FROM detalle_devoluciones dd WHERE dd.id_devolucion = d.id_devolucion) AS items_cantidad,
               COALESCE(u.nombre, '') AS usuario_nombre
        FROM devoluciones d
        LEFT JOIN proveedores pr ON d.id_proveedor = pr.id_proveedor
        LEFT JOIN usuarios u ON d.id_usuario = u.id_usuario
        WHERE ${where}
        ORDER BY d.fecha DESC
        LIMIT ?
    `, params);

    const totalDevuelto = rows.reduce(function(a, r) { return a + Number(r.total_devuelto || 0); }, 0);
    const totalCantidad = rows.reduce(function(a, r) { return a + Number(r.items_cantidad || 0); }, 0);
    return { devoluciones: rows, total_devuelto: totalDevuelto, total_cantidad: totalCantidad };
}

async function obtenerDevolucionDetalle(idDevolucion) {
    await ensureTables();
    const [devoluciones] = await pool.query(`
        SELECT d.*, pr.nombre AS proveedor_nombre, pr.categoria,
               COALESCE(u.nombre, '') AS usuario_nombre
        FROM devoluciones d
        LEFT JOIN proveedores pr ON d.id_proveedor = pr.id_proveedor
        LEFT JOIN usuarios u ON d.id_usuario = u.id_usuario
        WHERE d.id_devolucion = ?
    `, [idDevolucion]);
    if (devoluciones.length === 0) return null;
    const devolucion = devoluciones[0];

    const [detalles] = await pool.query(`
        SELECT dd.*, p.nombre AS producto_nombre, p.stock AS stock_actual, p.activo AS producto_activo
        FROM detalle_devoluciones dd
        LEFT JOIN productos p ON dd.id_producto = p.id_producto
        WHERE dd.id_devolucion = ?
        ORDER BY dd.id_detalle ASC
    `, [idDevolucion]);
    devolucion.detalles = detalles;
    return devolucion;
}

async function obtenerDevolucionesPorProveedor(idProveedor) {
    const filtradas = await obtenerDevoluciones({ id_proveedor: idProveedor, limite: 200 });
    return filtradas.devoluciones;
}

async function obtenerDevolucionesPorProducto(idProducto) {
    const filtradas = await obtenerDevoluciones({ id_producto: idProducto, limite: 200 });
    return filtradas.devoluciones;
}

module.exports = {
    ensureTables,
    obtenerProductosPorProveedor,
    obtenerProductosActivosDisponiblesParaAsociar,
    asociarProductoProveedor,
    actualizarRelacionProductoProveedor,
    eliminarRelacionProductoProveedor,
    obtenerProveedoresPorProducto,
    crearDevolucion,
    cambiarEstadoDevolucion,
    obtenerDevoluciones,
    obtenerDevolucionDetalle,
    obtenerDevolucionesPorProveedor,
    obtenerDevolucionesPorProducto
};