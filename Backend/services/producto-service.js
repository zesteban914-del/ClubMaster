const { pool } = require('../config/database');
const { redondear } = require('../helpers/db-helpers');
const { obtenerColumnasProductos } = require('../helpers/column-detection');
const { mapearCategoria, valorPorDefectoObligatorio, colsEnSets } = require('../helpers/db-helpers');

async function obtenerProductosAdmin(filtro) {
    const c = obtenerColumnasProductos();
    const extra = ['id_producto', 'nombre', 'activo', 'stock', 'stock_minimo',
                   'unidad', 'unidad_medida', 'factor_conversion', 'codigo_barras'];
    const usaIdCat = c.lista.indexOf('id_categoria') !== -1;
    const cols = [];
    if (c.venta) cols.push('p.' + c.venta + ' AS precio');
    extra.forEach(function(col) {
        if (c.lista.indexOf(col) !== -1) cols.push('p.' + col);
    });
    if (c.costo && c.lista.indexOf(c.costo) !== -1) cols.push('p.' + c.costo + ' AS precio_costo');
    if (c.descripcion && c.lista.indexOf(c.descripcion) !== -1) cols.push('p.' + c.descripcion);
    if (c.imagen && c.lista.indexOf(c.imagen) !== -1) cols.push('p.' + c.imagen);
    let sql = 'SELECT ' + cols.join(', ');
    if (usaIdCat) {
        sql += ', cat.nombre AS categoria, p.id_categoria';
    } else if (c.lista.indexOf('categoria') !== -1) {
        sql += ', p.categoria';
    }
    if (usaIdCat) {
        sql += ' FROM productos p LEFT JOIN categorias cat ON p.id_categoria = cat.id_categoria';
    } else {
        sql += ' FROM productos p';
    }
    if (filtro === 'inactivos') sql += ' WHERE p.activo = 0';
    else if (filtro === 'todos') sql += '';
    else sql += ' WHERE p.activo = 1';
    sql += ' ORDER BY p.id_producto ASC';
    const [rows] = await pool.query(sql);
    return rows;
}

async function obtenerProductoPorId(id) {
    const c = obtenerColumnasProductos();
    const extra = ['id_producto', 'nombre', 'activo', 'stock', 'stock_minimo',
                   'unidad', 'unidad_medida', 'factor_conversion', 'codigo_barras'];
    const usaIdCat = c.lista.indexOf('id_categoria') !== -1;
    const cols = [];
    if (c.venta) cols.push('p.' + c.venta + ' AS precio');
    extra.forEach(function(col) {
        if (c.lista.indexOf(col) !== -1) cols.push('p.' + col);
    });
    if (c.costo && c.lista.indexOf(c.costo) !== -1) cols.push('p.' + c.costo + ' AS precio_costo');
    if (c.descripcion && c.lista.indexOf(c.descripcion) !== -1) cols.push('p.' + c.descripcion);
    if (c.imagen && c.lista.indexOf(c.imagen) !== -1) cols.push('p.' + c.imagen);
    let sql = 'SELECT ' + cols.join(', ');
    if (usaIdCat) {
        sql += ', cat.nombre AS categoria, p.id_categoria';
    } else if (c.lista.indexOf('categoria') !== -1) {
        sql += ', p.categoria';
    }
    if (usaIdCat) {
        sql += ' FROM productos p LEFT JOIN categorias cat ON p.id_categoria = cat.id_categoria WHERE p.id_producto = ?';
    } else {
        sql += ' FROM productos p WHERE p.id_producto = ?';
    }
    const [rows] = await pool.query(sql, [id]);
    return rows[0] || null;
}

async function obtenerProductosActivos() {
    const c = obtenerColumnasProductos();
    const usaIdCat = c.lista.indexOf('id_categoria') !== -1;
    const cols = ['p.id_producto', 'p.nombre'];
    if (c.venta) cols.push('p.' + c.venta + ' AS precio');
    let sql = 'SELECT ' + cols.join(', ');
    if (usaIdCat) {
        sql += ', cat.nombre AS categoria';
        sql += ' FROM productos p LEFT JOIN categorias cat ON p.id_categoria = cat.id_categoria WHERE p.activo = 1';
    } else {
        if (c.lista.indexOf('categoria') !== -1) sql += ', p.categoria';
        sql += ' FROM productos p WHERE p.activo = 1';
    }
    const [rows] = await pool.query(sql);
    return rows;
}

async function insertarProducto(datos) {
    const c = obtenerColumnasProductos();
    const columnas = [];
    const valores = [];

    const anadir = function(nombre, valor) {
        if (columnas.indexOf(nombre) !== -1) return;
        if (c.lista.indexOf(nombre) !== -1) {
            columnas.push(nombre);
            valores.push(valor);
        }
    };

    anadir('nombre', datos.nombre);
    if (c.venta) anadir(c.venta, Number(datos.precio) || 0);
    anadir('categoria', datos.categoria || 'General');
    anadir('stock', 0);
    anadir('stock_minimo', Number(datos.stock_minimo) || 5);
    anadir('activo', 1);
    anadir('factor_conversion', (datos.factor_conversion && Number(datos.factor_conversion) > 0) ? Number(datos.factor_conversion) : null);
    anadir('codigo_barras', (datos.codigo_barras || '').trim() || null);
    anadir('iva_pct', (datos.iva_pct !== undefined && datos.iva_pct !== null && datos.iva_pct !== '') ? Number(datos.iva_pct) : null);
    anadir('ico_pct', (datos.ico_pct !== undefined && datos.ico_pct !== null && datos.ico_pct !== '') ? Number(datos.ico_pct) : null);
    if (c.costo) anadir(c.costo, 0);
    if (c.descripcion) anadir(c.descripcion, datos.descripcion || null);
    if (c.imagen) anadir(c.imagen, datos.imagen || null);

    if (c.lista.indexOf('id_categoria') !== -1) {
        const idCat = await mapearCategoria(pool, datos.categoria || 'General');
        anadir('id_categoria', idCat);
    }

    (c.obligatorias || []).forEach(function(col) {
        if (col === 'id_categoria') return;
        if (col === 'id_producto') return;
        if (c.costo && col === c.costo) return;
        if (columnas.indexOf(col) === -1) {
            columnas.push(col);
            valores.push(valorPorDefectoObligatorio(col, datos, c.info[col] ? c.info[col].Type : ''));
        }
    });

    const placeholders = columnas.map(function() { return '?'; }).join(', ');
    const [resultado] = await pool.query(
        'INSERT INTO productos (' + columnas.join(', ') + ') VALUES (' + placeholders + ')',
        valores
    );
    return resultado.insertId;
}

async function actualizarProducto(id, datos) {
    const c = obtenerColumnasProductos();
    const sets = [];
    const valores = [];

    const anadir = function(nombre, valor) {
        if (sets.indexOf(nombre + ' = ?') !== -1) return;
        if (c.lista.indexOf(nombre) !== -1) {
            sets.push(nombre + ' = ?');
            valores.push(valor);
        }
    };

    if (c.venta) anadir(c.venta, Number(datos.precio) || 0);
    anadir('categoria', datos.categoria || 'General');
    anadir('stock_minimo', Number(datos.stock_minimo) || 5);
    anadir('factor_conversion', (datos.factor_conversion && Number(datos.factor_conversion) > 0) ? Number(datos.factor_conversion) : null);
    anadir('codigo_barras', (datos.codigo_barras || '').trim() || null);
    if (datos.iva_pct !== undefined) anadir('iva_pct', (datos.iva_pct === '' || datos.iva_pct === null) ? null : Number(datos.iva_pct));
    if (datos.ico_pct !== undefined) anadir('ico_pct', (datos.ico_pct === '' || datos.ico_pct === null) ? null : Number(datos.ico_pct));
    if (c.descripcion) anadir(c.descripcion, datos.descripcion || null);
    if (c.imagen) anadir(c.imagen, datos.imagen || null);

    anadir('nombre', datos.nombre);

    if (c.lista.indexOf('id_categoria') !== -1) {
        const idCat = await mapearCategoria(pool, datos.categoria || 'General');
        anadir('id_categoria', idCat);
    }

    (c.obligatorias || []).forEach(function(col) {
        if (col === 'id_categoria') return;
        if (col === 'id_producto') return;
        if (c.costo && col === c.costo) return;
        if (colsEnSets(sets, col)) return;
        anadir(col, valorPorDefectoObligatorio(col, datos, c.info[col] ? c.info[col].Type : ''));
    });

    valores.push(id);
    await pool.query('UPDATE productos SET ' + sets.join(', ') + ' WHERE id_producto = ?', valores);
}

async function eliminarProducto(id) {
    const [res] = await pool.query('UPDATE productos SET activo = 0 WHERE id_producto = ?', [id]);
    return { affectedRows: res.affectedRows, desactivado: true };
}

async function actualizarStock(idProducto, stock, stockMinimo, unidadMedida, factorConversion) {
    if (stockMinimo !== undefined && stockMinimo !== null && stockMinimo !== '' && Number(stockMinimo) < 0) { const e = new Error('El stock minimo no puede ser negativo (recibido: ' + stockMinimo + ')'); e.statusCode = 400; throw e; }
    const c = obtenerColumnasProductos();
    const sets = ['stock = ?'];
    const valores = [stock];
    if (c.lista.indexOf('stock_minimo') !== -1) { sets.push('stock_minimo = ?'); valores.push(stockMinimo); }
    if (c.lista.indexOf('unidad_medida') !== -1) { sets.push('unidad_medida = ?'); valores.push(unidadMedida); }
    if (c.lista.indexOf('unidad') !== -1) { sets.push('unidad = ?'); valores.push(unidadMedida || 'Unidad'); }
    if (c.lista.indexOf('factor_conversion') !== -1) { sets.push('factor_conversion = ?'); valores.push(factorConversion || null); }
    valores.push(idProducto);
    await pool.query(
        'UPDATE productos SET ' + sets.join(', ') + ' WHERE id_producto = ?',
        valores
    );
}

async function descontarStockConConversion(idProducto, cantidadVendida, conexion, idBodega) {
    const db0 = conexion || pool;
    try {
        const [r] = await db0.query('SELECT producto_id, insumo_id, cantidad, factor_conversion FROM recetas WHERE producto_id=?', [idProducto]);
        if (r.length) {
            const detalle = [];
            for (const rec of r) {
                const cantInsumo = Number(cantidadVendida) * Number(rec.cantidad) * (Number(rec.factor_conversion) > 0 ? Number(rec.factor_conversion) : 1);
                const [ir] = await db0.query('SELECT stock FROM productos WHERE id_producto=? FOR UPDATE', [rec.insumo_id]);
                if (!ir.length) continue;
                await db0.query('UPDATE productos SET stock = stock - ? WHERE id_producto = ?', [cantInsumo, rec.insumo_id]);
                const [nr] = await db0.query('SELECT stock FROM productos WHERE id_producto=?', [rec.insumo_id]);
                const nuevo = nr.length ? Number(nr[0].stock) : Number(ir[0].stock) - cantInsumo;
                if (idBodega) {
                    try { await db0.query('INSERT INTO stock_bodegas (id_producto, id_bodega, stock) VALUES (?,?,?) ON DUPLICATE KEY UPDATE stock = stock - VALUES(stock)', [rec.insumo_id, idBodega, cantInsumo]); } catch (e) {}
                }
                detalle.push({ insumo: rec.insumo_id, descuento: cantInsumo, nuevo });
            }
            return { porReceta: true, detalle };
        }
    } catch (e) { /* tabla recetas no existe aun -> fallback */ }
    const c = obtenerColumnasProductos();
    const colsSelect = ['stock', 'usa_stock_bodega'];
    const tieneFactor = c.lista.indexOf('factor_conversion') !== -1;
    if (tieneFactor) colsSelect.push('factor_conversion');
    const [rows] = await (conexion || pool).query(
        'SELECT ' + colsSelect.join(', ') + ' FROM productos WHERE id_producto = ?',
        [idProducto]
    );
    if (rows.length === 0) return;
    const producto = rows[0];
    const factor = tieneFactor ? producto.factor_conversion : null;
    let descuento;
    if (factor && Number(factor) > 1) {
        descuento = Math.ceil(cantidadVendida / Number(factor) * 100) / 100;
    } else {
        descuento = cantidadVendida;
    }
    const db = conexion || pool;
    try {
        const [cfg] = await db.query("SELECT valor FROM configuracion_general WHERE clave='usa_stock_bodega' LIMIT 1");
        const usaBodega = cfg.length && cfg[0].valor === '1' && producto.usa_stock_bodega === 1 && idBodega;
        if (usaBodega) {
            const [sb] = await db.query('SELECT stock FROM stock_bodegas WHERE id_producto=? AND id_bodega=? FOR UPDATE', [idProducto, idBodega]);
            const stockB = sb.length ? Number(sb[0].stock) : 0;
            const nuevoB = stockB - descuento;
            await db.query('INSERT INTO stock_bodegas (id_producto, id_bodega, stock) VALUES (?,?,?) ON DUPLICATE KEY UPDATE stock=VALUES(stock)', [idProducto, idBodega, nuevoB]);
            const [sum] = await db.query('SELECT COALESCE(SUM(stock),0) AS tot FROM stock_bodegas WHERE id_producto=?', [idProducto]);
            await db.query('UPDATE productos SET stock=? WHERE id_producto=?', [sum[0].tot, idProducto]);
            return { stockAnterior: stockB, stockNuevo: nuevoB, descuento, bodega: idBodega };
        }
    } catch (e) {}
    const stockAnterior = Number(producto.stock) || 0;
    await (conexion || pool).query(
        'UPDATE productos SET stock = stock - ? WHERE id_producto = ?',
        [descuento, idProducto]
    );
    const nuevoStock = stockAnterior - descuento;
    return { stockAnterior, stockNuevo: nuevoStock, descuento };
}

async function actualizarStockYCPP(idProducto, cantidad, costoNuevo, conexion, idBodega) {
    const c = obtenerColumnasProductos();
    const tieneCosto = c.costo && c.lista.indexOf(c.costo) !== -1;
    const colCosto = tieneCosto ? c.costo : 'precio_costo';
    const seleccion = ['stock', 'usa_stock_bodega'];
    if (tieneCosto) seleccion.push(colCosto);

    const [filas] = await conexion.query(
        'SELECT ' + seleccion.join(', ') + ' FROM productos WHERE id_producto = ? FOR UPDATE',
        [idProducto]
    );
    if (filas.length === 0) throw new Error('Producto no encontrado (id=' + idProducto + ')');

    const producto = filas[0];
    const stockAnterior = Number(producto.stock) || 0;
    const costoAnterior = tieneCosto ? Number(producto[colCosto]) || 0 : 0;
    const stockNuevo = stockAnterior + cantidad;

    const costoMedio = stockAnterior <= 0
        ? costoNuevo
        : (stockNuevo > 0
            ? (stockAnterior * costoAnterior + cantidad * costoNuevo) / stockNuevo
            : costoNuevo);
    const costoMedioFinal = redondear(costoMedio);

    const sets = ['stock = ?'];
    const valores = [stockNuevo];
    if (tieneCosto) {
        sets.push(colCosto + ' = ?');
        valores.push(costoMedioFinal);
    }
    valores.push(idProducto);
    await conexion.query(
        'UPDATE productos SET ' + sets.join(', ') + ' WHERE id_producto = ?',
        valores
    );
    try {
        const [cfg] = await conexion.query("SELECT valor FROM configuracion_general WHERE clave='usa_stock_bodega' LIMIT 1");
        const usaBodega = cfg.length && cfg[0].valor === '1';
        if (usaBodega && idBodega) {
            await conexion.query('UPDATE productos SET usa_stock_bodega=1 WHERE id_producto=?', [idProducto]);
            await conexion.query(
                `INSERT INTO stock_bodegas (id_producto, id_bodega, stock) VALUES (?,?,?)
                 ON DUPLICATE KEY UPDATE stock = stock + VALUES(stock)`,
                [idProducto, idBodega, cantidad]
            );
        } else if (usaBodega && producto.usa_stock_bodega === 1) {
            const [b] = await conexion.query('SELECT id_bodega FROM bodegas WHERE nombre="Bodega Central" LIMIT 1');
            if (b.length) {
                await conexion.query(
                    `INSERT INTO stock_bodegas (id_producto, id_bodega, stock) VALUES (?,?,?)
                     ON DUPLICATE KEY UPDATE stock = stock + VALUES(stock)`,
                    [idProducto, b[0].id_bodega, cantidad]
                );
            }
        }
    } catch (e) {}

    return {
        stockAnterior: stockAnterior,
        stockNuevo: stockNuevo,
        costoAnterior: costoAnterior,
        costoMedio: costoMedioFinal,
        bodega: idBodega || null
    };
}

async function facturarDividido(idMesa, pagos, idJornada, idUsuario) {
    const conexion = await pool.getConnection();
    try {
        await conexion.beginTransaction();
        // asegurar columnas mesero/cajero en pedidos
        try { const [cM]=await conexion.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='pedidos' AND COLUMN_NAME='id_mesero'"); if(cM.length===0) await conexion.query("ALTER TABLE pedidos ADD COLUMN id_mesero INT NULL"); } catch(e){}
        try { const [cC]=await conexion.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='pedidos' AND COLUMN_NAME='id_cajero'"); if(cC.length===0) await conexion.query("ALTER TABLE pedidos ADD COLUMN id_cajero INT NULL"); } catch(e){}
        const [pedidos] = await conexion.query(
            "SELECT id_pedido, total, id_mesero, id_cajero FROM pedidos WHERE id_mesa = ? AND estado = 'Pendiente' FOR UPDATE",
            [idMesa]
        );
        // titular de la cuenta para propina/venta atribucion, nunca sobrescribir con cajero
        let meseroTitular=null;
        try { const [mr]=await conexion.query("SELECT id_mesero FROM mesas WHERE id_mesa=?", [idMesa]); if(mr.length) meseroTitular=mr[0].id_mesero; } catch(e){}
        if (!meseroTitular && pedidos.length) meseroTitular = pedidos.find(p=>p.id_mesero)?.id_mesero || null;
        const pedidosDisponibles = [...pedidos];

        for (const pago of pagos) {
            const cubre = Number(pago.cubre !== undefined && pago.cubre !== null
                ? pago.cubre
                : (Number(pago.monto || 0) + Number(pago.descuento || 0)));
            let porCubrir = Math.max(0, cubre);
            const esCortesia = !!(pago.es_cortesia);
            const propina = Number(pago.propina || 0);
            const subMetodo = pago.sub_metodo || null;
            const referencia = pago.referencia || null;
            const metodoEfectivo = esCortesia ? 'Cortesia' : (pago.metodo_pago || 'Efectivo');
            const descuentoTotal = esCortesia ? 0 : (Number(pago.descuento || 0));
            let descuentoRestante = descuentoTotal;

            const pedidosOrden = [...pedidosDisponibles];
            let propinaAplicada = !(propina > 0);
            for (const pedido of pedidosOrden) {
                if (porCubrir <= 0) break;
                const pedidoTotal = Number(pedido.total);
                const aplicar = Math.min(pedidoTotal, porCubrir);

                let desc = 0;
                if (!esCortesia && descuentoRestante > 0) {
                    desc = Math.min(descuentoRestante, pedidoTotal, aplicar);
                    descuentoRestante -= desc;
                }

                const propinaLinea = propinaAplicada ? 0 : propina;
                propinaAplicada = true;

                // cajero = idUsuario (sesion), mesero = titular existente (no se sobrescribe). Ventas/propina -> mesero, caja -> cajero
                try {
                    await conexion.query(
                        `UPDATE pedidos
                         SET estado = 'Pagado',
                             metodo_pago = ?,
                             sub_metodo_pago = ?,
                             referencia_pago = ?,
                             descuento = COALESCE(descuento, 0) + ?,
                             es_cortesia = ?,
                             propina = COALESCE(propina, 0) + ?,
                             id_jornada = COALESCE(?, id_jornada),
                             id_usuario = COALESCE(?, id_usuario),
                             id_cajero = COALESCE(?, id_cajero, id_usuario),
                             id_mesero = COALESCE(id_mesero, ?),
                             timestamp_despacho = NOW()
                         WHERE id_pedido = ?`,
                        [metodoEfectivo, subMetodo, referencia, desc, esCortesia ? 1 : 0, propinaLinea,
                         idJornada || null, idUsuario || null, idUsuario || null, meseroTitular, pedido.id_pedido]
                    );
                } catch(e){
                    if (e.code==='ER_BAD_FIELD_ERROR') {
                        await conexion.query(
                            `UPDATE pedidos SET estado='Pagado', metodo_pago=?, sub_metodo_pago=?, referencia_pago=?, descuento=COALESCE(descuento,0)+?, es_cortesia=?, propina=COALESCE(propina,0)+?, id_jornada=COALESCE(?,id_jornada), id_usuario=COALESCE(?,id_usuario), timestamp_despacho=NOW() WHERE id_pedido=?`,
                            [metodoEfectivo, subMetodo, referencia, desc, esCortesia?1:0, propinaLinea, idJornada||null, idUsuario||null, pedido.id_pedido]
                        );
                    } else throw e;
                }

                const [detalles] = await conexion.query(
                    'SELECT id_producto, cantidad FROM detalle_pedido WHERE id_pedido = ?',
                    [pedido.id_pedido]
                );
                for (const det of detalles) {
                    try {
                        await descontarStockConConversion(det.id_producto, det.cantidad, conexion);
                    } catch (e) {
                        console.error(`[facturarDividido] fallo stock pedido ${pedido.id_pedido} producto ${det.id_producto} cant ${det.cantidad}: ${e.message}`);
                        const err = new Error(`Stock no descontado (pedido ${pedido.id_pedido}, producto ${det.id_producto}): ${e.message}`);
                        err.statusCode = e.statusCode || 409;
                        throw err;
                    }
                }

                porCubrir -= aplicar;
                pedidosDisponibles.splice(pedidosDisponibles.indexOf(pedido), 1);
            }
        }

        const [restantes] = await conexion.query(
            "SELECT COUNT(*) AS cnt FROM pedidos WHERE id_mesa = ? AND estado = 'Pendiente'",
            [idMesa]
        );

        if (restantes[0].cnt === 0) {
            await conexion.query(
                "UPDATE mesas SET estado = 'Disponible', id_mesero = NULL, fecha_ocupacion = NULL WHERE id_mesa = ?",
                [idMesa]
            );
        }

        await conexion.commit();
        return { success: true, mesaLiberada: restantes[0].cnt === 0 };
    } catch (error) {
        await conexion.rollback();
        throw error;
    } finally {
        conexion.release();
    }
}

async function obtenerFacturaPorId(idPedido) {
    const [pedidos] = await pool.query(
        `SELECT p.id_pedido, p.id_mesa, p.id_usuario, p.id_jornada, p.total,
                p.metodo_pago, p.sub_metodo_pago, p.referencia_pago,
                p.descuento, p.es_cortesia, p.propina,
                p.timestamp_pedido, p.timestamp_despacho,
                m.numero AS mesa_numero, m.zona AS mesa_zona,
                u.nombre AS usuario_nombre
         FROM pedidos p
         LEFT JOIN mesas m ON p.id_mesa = m.id_mesa
         LEFT JOIN usuarios u ON p.id_usuario = u.id_usuario
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

async function obtenerFacturasJornada(idJornada, filtros) {
    let sql = `
        SELECT p.id_pedido, p.id_mesa, p.total,
               p.metodo_pago, p.sub_metodo_pago, p.referencia_pago,
               p.descuento, p.es_cortesia, p.propina,
               p.timestamp_pedido, p.timestamp_despacho,
               m.numero AS mesa_numero,
               u.nombre AS usuario_nombre
        FROM pedidos p
        LEFT JOIN mesas m ON p.id_mesa = m.id_mesa
        LEFT JOIN usuarios u ON p.id_usuario = u.id_usuario
        WHERE p.estado = 'Pagado'
    `;
    const params = [];

    if (idJornada) {
        sql += ' AND p.id_jornada = ?';
        params.push(idJornada);
    }
    if (filtros && filtros.fecha_inicio) {
        sql += ' AND p.timestamp_despacho >= ?';
        params.push(filtros.fecha_inicio);
    }
    if (filtros && filtros.fecha_fin) {
        sql += ' AND p.timestamp_despacho <= ?';
        params.push(filtros.fecha_fin);
    }
    if (filtros && filtros.metodo_pago) {
        sql += ' AND p.metodo_pago = ?';
        params.push(filtros.metodo_pago);
    }

    sql += ' ORDER BY p.timestamp_despacho DESC';

    if (filtros && filtros.limite) {
        sql += ' LIMIT ?';
        params.push(Number(filtros.limite));
    }

    const [rows] = await pool.query(sql, params);
    return rows;
}

module.exports = {
    obtenerProductosAdmin,
    obtenerProductoPorId,
    obtenerProductosActivos,
    insertarProducto,
    actualizarProducto,
    eliminarProducto,
    actualizarStock,
    descontarStockConConversion,
    actualizarStockYCPP,
    facturarDividido,
    obtenerFacturaPorId,
    obtenerFacturasJornada
};
