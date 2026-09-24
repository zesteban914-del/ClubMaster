const { pool } = require('../config/database');
const { ejecutarQuery, categoriaMetodoPago, redondear: redondearDinero } = require('../helpers/db-helpers');

async function crearPedido(idMesa, idUsuario, idJornada, detalles, idMesero, claveCliente, idUsuarioAgrega) {
    if (!Array.isArray(detalles) || detalles.length === 0) {
        const e = new Error('Detalle invalido: se requiere al menos un item'); e.statusCode = 400; throw e;
    }
    const clave = (claveCliente || '').toString().trim().substring(0, 64) || null;
    const items = detalles.map(function(item) {
        const cant = Number(item.cantidad) || 0;
        if (!item.id_producto || cant <= 0) { const e = new Error('Detalle invalido: producto y cantidad mayor a 0 son obligatorios'); e.statusCode = 400; throw e; }
        return {
            id_producto: Number(item.id_producto),
            cantidad: cant,
            precio_unitario: 0,
            subtotal: 0,
            observaciones: item.observaciones || '',
            presentacion: item.presentacion || 'Trago / Copa',
            id_nota_preparacion: item.id_nota_preparacion || null,
            id_bodega: item.id_bodega || null
        };
    });
    const ids = Array.from(new Set(items.map(function(i) { return i.id_producto; })));
    const connection = await pool.getConnection();
    try {
        await connection.query("SET SESSION innodb_lock_wait_timeout = 5");
        await connection.beginTransaction();
        const placeholders = ids.map(function() { return '?'; }).join(',');
        const [prodRows] = await connection.query(
            'SELECT id_producto, nombre, stock, precio_venta FROM productos WHERE id_producto IN (' + placeholders + ') AND activo = 1 FOR UPDATE',
            ids
        );
        const prodMap = new Map(prodRows.map(function(r) { return [Number(r.id_producto), r]; }));
        for (const it of items) {
            const p = prodMap.get(Number(it.id_producto));
            if (!p) { const e = new Error('Producto no encontrado o inactivo (id=' + it.id_producto + ')'); e.statusCode = 400; throw e; }
            const precioDB = Number(p.precio_venta);
            if (!Number.isFinite(precioDB) || precioDB < 0) { const e = new Error('Precio no configurado para "' + p.nombre + '"'); e.statusCode = 400; throw e; }
            it.precio_unitario = precioDB;
            it.subtotal = Number(it.cantidad) * precioDB;
        }
        let idBodegaDefault = null;
        const needsBodega = items.some(function(i) { return !i.id_bodega; });
        if (needsBodega) {
            const [cfg] = await connection.query("SELECT valor FROM configuracion_general WHERE clave='usa_stock_bodega' LIMIT 1");
            if (cfg.length && cfg[0].valor === '1') {
                const [mesaRow] = await connection.query('SELECT zona FROM mesas WHERE id_mesa=?', [idMesa]);
                const zona = mesaRow.length ? String(mesaRow[0].zona || '').toLowerCase() : '';
                let nombreBodega = 'Bodega Central';
                if (zona.indexOf('vip') !== -1) nombreBodega = 'Barra VIP';
                else if (zona.indexOf('barra') !== -1 || zona.indexOf('pista') !== -1) nombreBodega = 'Barra Principal';
                const [b] = await connection.query('SELECT id_bodega FROM bodegas WHERE nombre=? LIMIT 1', [nombreBodega]);
                if (b.length) idBodegaDefault = b[0].id_bodega;
                else {
                    const [b2] = await connection.query("SELECT id_bodega FROM bodegas WHERE nombre='Bodega Central' LIMIT 1");
                    if (b2.length) idBodegaDefault = b2[0].id_bodega;
                }
            }
        }
        const total = items.reduce(function(acc, item) { return acc + item.subtotal; }, 0);
        if (clave) {
            try {
                const [dup] = await connection.query('SELECT id_pedido FROM pedidos WHERE clave_cliente = ? LIMIT 1', [clave]);
                if (dup.length) { await connection.rollback(); return { success: true, idPedido: dup[0].id_pedido, duplicado: true }; }
            } catch (_) {}
        }
        // Asegurar columnas para separación cajero/mesero (id_mesero en pedidos)
        try {
            const [colMesero] = await connection.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='pedidos' AND COLUMN_NAME='id_mesero'");
            if (colMesero.length === 0) {
                try { await connection.query("ALTER TABLE pedidos ADD COLUMN id_mesero INT NULL, ADD INDEX idx_pedidos_mesero (id_mesero)"); } catch (e) {}
            }
            const [colCajero] = await connection.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='pedidos' AND COLUMN_NAME='id_cajero'");
            if (colCajero.length === 0) {
                try { await connection.query("ALTER TABLE pedidos ADD COLUMN id_cajero INT NULL, ADD INDEX idx_pedidos_cajero (id_cajero)"); } catch (e) {}
            }
        } catch (e) {}

        let idPedido;
        // idUsuario = cajero (req.user.id / sesión), idMesero = mesero titular (validado segun rol), idUsuarioAgrega = quien agrego la linea (auditoria)
        const cajeroId = Number(idUsuario) || null;
        const meseroId = Number(idMesero) || null;
        const usuarioAgregaId = Number(idUsuarioAgrega || idUsuario) || null;
        try {
            // Intento con id_mesero + id_cajero si existen las columnas
            const [resPedido] = await connection.query(
                'INSERT INTO pedidos (id_mesa, id_usuario, id_mesero, id_cajero, id_jornada, estado, total, timestamp_pedido, clave_cliente) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)',
                [idMesa, cajeroId, meseroId, cajeroId, idJornada, 'Pendiente', total, clave]
            );
            idPedido = resPedido.insertId;
        } catch (e) {
            if (e.code === 'ER_BAD_FIELD_ERROR') {
                // Fallback: solo id_mesero, sin id_cajero
                try {
                    const [resPedido] = await connection.query(
                        'INSERT INTO pedidos (id_mesa, id_usuario, id_mesero, id_jornada, estado, total, timestamp_pedido, clave_cliente) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)',
                        [idMesa, cajeroId, meseroId, idJornada, 'Pendiente', total, clave]
                    );
                    idPedido = resPedido.insertId;
                } catch (e2) {
                    if (e2.code === 'ER_BAD_FIELD_ERROR') {
                        const [resPedido] = await connection.query(
                            'INSERT INTO pedidos (id_mesa, id_usuario, id_jornada, estado, total, timestamp_pedido, clave_cliente) VALUES (?, ?, ?, ?, ?, NOW(), ?)',
                            [idMesa, cajeroId, idJornada, 'Pendiente', total, clave]
                        );
                        idPedido = resPedido.insertId;
                    } else {
                        if (clave && (e2.code === 'ER_DUP_ENTRY' || String(e2.message).indexOf('uq_pedidos_clave_cliente') !== -1)) {
                            const [dup2] = await connection.query('SELECT id_pedido FROM pedidos WHERE clave_cliente = ? LIMIT 1', [clave]);
                            if (dup2.length) { try { await connection.rollback(); } catch (_) {} return { success: true, idPedido: dup2[0].id_pedido, duplicado: true }; }
                        }
                        throw e2;
                    }
                }
            } else {
                if (clave && (e.code === 'ER_DUP_ENTRY' || String(e.message).indexOf('uq_pedidos_clave_cliente') !== -1)) {
                    const [dup2] = await connection.query('SELECT id_pedido FROM pedidos WHERE clave_cliente = ? LIMIT 1', [clave]);
                    if (dup2.length) { try { await connection.rollback(); } catch (_) {} return { success: true, idPedido: dup2[0].id_pedido, duplicado: true }; }
                }
                throw e;
            }
        }
        // asegurar columna id_usuario_agrega para auditoria por linea
        try { const [cAg]=await connection.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='detalle_pedido' AND COLUMN_NAME='id_usuario_agrega'"); if(cAg.length===0) await connection.query("ALTER TABLE detalle_pedido ADD COLUMN id_usuario_agrega INT NULL, ADD INDEX idx_detalle_usuario_agrega (id_usuario_agrega)"); } catch(e){}
        const valuesSql = items.map(function() { return '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'; }).join(',');
        const flat = [];
        for (const it of items) {
            flat.push(idPedido, it.id_producto, it.cantidad, it.precio_unitario, it.subtotal,
                it.observaciones, it.presentacion, it.id_nota_preparacion, 'Pendiente', it.id_bodega || idBodegaDefault, usuarioAgregaId);
        }
        try {
            await connection.query(
                'INSERT INTO detalle_pedido (id_pedido, id_producto, cantidad, precio_unitario, subtotal, observaciones, presentacion, id_nota_preparacion, estado, id_bodega, id_usuario_agrega) VALUES ' + valuesSql,
                flat
            );
        } catch(e) {
            if (e.code==='ER_BAD_FIELD_ERROR') {
                const valuesSql2 = items.map(function() { return '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'; }).join(',');
                const flat2=[];
                for (const it of items) flat2.push(idPedido, it.id_producto, it.cantidad, it.precio_unitario, it.subtotal, it.observaciones, it.presentacion, it.id_nota_preparacion, 'Pendiente', it.id_bodega || idBodegaDefault);
                await connection.query('INSERT INTO detalle_pedido (id_pedido, id_producto, cantidad, precio_unitario, subtotal, observaciones, presentacion, id_nota_preparacion, estado, id_bodega) VALUES ' + valuesSql2, flat2);
            } else throw e;
        }
        await connection.query(
            "UPDATE mesas SET estado = 'Ocupada', id_mesero = COALESCE(?, id_mesero), fecha_ocupacion = COALESCE(fecha_ocupacion, NOW()) WHERE id_mesa = ?",
            [idMesero || null, idMesa]
        );
        await connection.commit();
        return { success: true, idPedido };
    } catch (error) {
        try { await connection.rollback(); } catch (e) {}
        throw error;
    } finally {
        connection.release();
    }
}

async function obtenerJornadaActiva() {
    const [rows] = await pool.query(
        "SELECT * FROM jornadas WHERE estado = 'Abierta' ORDER BY id_jornada DESC LIMIT 1"
    );
    return rows.length > 0 ? rows[0] : null;
}

async function abrirJornada(montoInicial, idUsuario, incluirPropinaCaja, arqueoCiego, barraAsignada) {
    const barra = (barraAsignada || 'Caja Principal').toString().trim().substring(0,80) || 'Caja Principal';
    await asegurarColumnasJornadas(pool);
    const [result] = await pool.query(
        'INSERT INTO jornadas (monto_inicial, id_usuario, incluir_propina_caja, arqueo_ciego, barra_asignada, estado) VALUES (?, ?, ?, ?, ?, ?)',
        [montoInicial, idUsuario, incluirPropinaCaja === false || incluirPropinaCaja === 0 ? 0 : 1,
         arqueoCiego === true || arqueoCiego === 1 ? 1 : 0, barra, 'Abierta']
    );
    return { id_jornada: result.insertId };
}

async function obtenerDesglosePagos(db, idJornada) {
    const [rows] = await ejecutarQuery(db, `
        SELECT metodo_pago,
               COALESCE(sub_metodo_pago, '') AS sub_metodo,
               COALESCE(referencia_pago, '') AS referencia,
               COUNT(*) AS cantidad,
               COALESCE(SUM(total), 0) AS subtotal,
               COALESCE(SUM(descuento), 0) AS descuento,
               COALESCE(SUM(propina), 0) AS propina,
               SUM(CASE WHEN es_cortesia = 1 THEN total ELSE 0 END) AS cortesias
        FROM pedidos
        WHERE id_jornada = ? AND estado = 'Pagado'
        GROUP BY metodo_pago, sub_metodo_pago, referencia_pago
        ORDER BY metodo_pago, sub_metodo_pago`, [idJornada]);
    return rows;
}

async function obtenerMovimientosCaja(db, idJornada) {
    return (await ejecutarQuery(db,
        `SELECT mv.*, COALESCE(u.nombre, '') AS usuario_nombre
         FROM movimientos_caja mv
         LEFT JOIN usuarios u ON mv.id_usuario = u.id_usuario
         WHERE mv.id_jornada = ?
         ORDER BY mv.fecha ASC, mv.id_movimiento ASC`, [idJornada]))[0];
}

async function obtenerMetodosPagoCatalogo() {
    const [rows] = await pool.query(
        'SELECT id_metodo, codigo, nombre, categoria, icono, color, activo FROM metodos_pago WHERE activo = 1 ORDER BY FIELD(categoria,"Efectivo","Wallet","Tarjeta","Credito"), nombre'
    );
    return rows;
}

async function obtenerResumenJornadaCompleto(db, idJornada) {
    const desglose = await obtenerDesglosePagos(db, idJornada);
    const movimientos = await obtenerMovimientosCaja(db, idJornada);

    let ventas = 0, descuentos = 0, cortesias = 0;
    let propinaEfectivo = 0, propinaElectronica = 0;

    desglose.forEach(function(r) {
        const sub = Number(r.subtotal) || 0;
        ventas += sub;
        descuentos += Number(r.descuento) || 0;
        cortesias += Number(r.cortesias) || 0;
        const propina = Number(r.propina) || 0;
        if (categoriaMetodoPago(r.metodo_pago) === 'Efectivo') propinaEfectivo += propina;
        else if (categoriaMetodoPago(r.metodo_pago) === 'Tarjeta') propinaElectronica += propina;
    });

    function esEgresoExterno(m) {
        const txt = String((m.categoria || '') + ' ' + (m.concepto || '') + ' ' + (m.justificacion || '')).toLowerCase();
        return txt.indexOf('proveedor') !== -1 || txt.indexOf('compra') !== -1;
    }
    const ingresosExtra = movimientos
        .filter(function(m) { return m.tipo === 'Ingreso'; })
        .reduce(function(acc, m) { return acc + Number(m.monto || 0); }, 0);
    const gastosExternos = movimientos
        .filter(function(m) { return m.tipo === 'Egreso' && esEgresoExterno(m); })
        .reduce(function(acc, m) { return acc + Number(m.monto || 0); }, 0);
    const gastosEfectivo = movimientos
        .filter(function(m) { return m.tipo === 'Egreso' && !esEgresoExterno(m); })
        .reduce(function(acc, m) { return acc + Number(m.monto || 0); }, 0);

    var ventasNetas = ventas - descuentos - cortesias;
    var totalPropina = propinaEfectivo + propinaElectronica;
    var totalIngresos = ventasNetas + ingresosExtra + totalPropina;
    return {
        desglose: desglose,
        movimientos: movimientos,
        total_general: ventas,
        ventas_brutas: ventas,
        descuentos: descuentos,
        cortesias: cortesias,
        ventas_netas: ventasNetas,
        propina_efectivo: propinaEfectivo,
        propina_tarjeta: propinaElectronica,
        total_propina: totalPropina,
        ingresos_extra: ingresosExtra,
        total_ingresos: totalIngresos,
        gastos_efectivo: gastosEfectivo,
        gastos_externos_excluidos: gastosExternos
    };
}

function calcularEfectivoEsperado(jornada, resumen, incluirPropina) {
    const efectivoVentas = (resumen.desglose || [])
        .filter(function(r) { return categoriaMetodoPago(r.metodo_pago) === 'Efectivo'; })
        .reduce(function(acc, r) { return acc + Number(r.subtotal || 0); }, 0);

    const propina = incluirPropina ? (Number(resumen.propina_efectivo) || 0) : 0;

    return Number(jornada.monto_inicial || 0)
        + efectivoVentas
        + propina
        + (Number(resumen.ingresos_extra) || 0)
        - (Number(resumen.gastos_efectivo) || 0);
}

function calcularConteoFisico(arqueo) {
    if (!Array.isArray(arqueo)) return 0;
    return arqueo.reduce(function(acc, linea) {
        return acc + (Number(linea.cantidad) || 0) * (Number(linea.valor || linea.denominacion) || 0);
    }, 0);
}

async function obtenerUsuariosJornada(db, jornada) {
    const [nombres] = await ejecutarQuery(db, `
        SELECT ua.nombre AS usuario_apertura, uc.nombre AS usuario_cierre
        FROM (SELECT ? AS id_apertura, ? AS id_cierre) ids
        LEFT JOIN usuarios ua ON ua.id_usuario = ids.id_apertura
        LEFT JOIN usuarios uc ON uc.id_usuario = ids.id_cierre`, [jornada.id_usuario, jornada.id_usuario_cierre]);
    return nombres[0] || {};
}

function construirReporteJornada(jornada, resumen, usuarios, conteo, esperado, diferencia, detalleArqueo) {
    return {
        jornada: {
            id_jornada: jornada.id_jornada,
            fecha_apertura: jornada.fecha_apertura,
            fecha_cierre: jornada.fecha_cierre,
            monto_inicial: Number(jornada.monto_inicial || 0),
            estado: jornada.estado,
            incluir_propina_caja: jornada.incluir_propina_caja === 1 || jornada.incluir_propina_caja === true,
            arqueo_ciego: jornada.arqueo_ciego === 1 || jornada.arqueo_ciego === true,
            barra_asignada: jornada.barra_asignada || 'Caja Principal',
            usuario_apertura: (usuarios && usuarios.usuario_apertura) || '',
            usuario_cierre: (usuarios && usuarios.usuario_cierre) || ''
        },
        resumen: {
            ventas_brutas: Number(resumen.ventas_brutas || 0),
            descuentos: Number(resumen.descuentos || 0),
            cortesias: Number(resumen.cortesias || 0),
            ventas_netas: Number(resumen.ventas_netas || 0),
            propina_efectivo: Number(resumen.propina_efectivo || 0),
            propina_tarjeta: Number(resumen.propina_tarjeta || 0),
            ingresos_extra: Number(resumen.ingresos_extra || 0),
            gastos_efectivo: Number(resumen.gastos_efectivo || 0),
            gastos_externos_excluidos: Number(resumen.gastos_externos_excluidos || 0),
            total_en_caja: conteo,
            esperado: Number(esperado || 0),
            diferencia: Number(diferencia || 0),
            desglose: resumen.desglose || [],
            movimientos: resumen.movimientos || []
        },
        arqueo: detalleArqueo || []
    };
}

async function asegurarColumnasJornadas(db){
    const cols = ['fecha DATETIME NULL DEFAULT CURRENT_TIMESTAMP','fecha_apertura DATETIME NULL DEFAULT CURRENT_TIMESTAMP','fecha_cierre DATETIME NULL','hora_inicio DATETIME NULL DEFAULT CURRENT_TIMESTAMP','hora_cierre DATETIME NULL','hora_apertura DATETIME NULL DEFAULT CURRENT_TIMESTAMP','fecha_inicio DATETIME NULL DEFAULT CURRENT_TIMESTAMP','monto_inicial DECIMAL(10,2) NOT NULL DEFAULT 0.00','monto DECIMAL(10,2) DEFAULT 0.00','base_inicial DECIMAL(10,2) DEFAULT 0.00','id_usuario INT NULL','total_efectivo_esperado DECIMAL(10,2) DEFAULT 0.00','total_efectivo_real DECIMAL(10,2) DEFAULT 0.00','diferencia DECIMAL(10,2) DEFAULT 0.00','conteo_fisico DECIMAL(10,2) DEFAULT 0.00','ventas_brutas DECIMAL(10,2) DEFAULT 0.00','descuentos DECIMAL(10,2) DEFAULT 0.00','cortesias DECIMAL(10,2) DEFAULT 0.00','ventas_netas DECIMAL(10,2) DEFAULT 0.00','propina_efectivo DECIMAL(10,2) DEFAULT 0.00','propina_tarjeta DECIMAL(10,2) DEFAULT 0.00','ingresos_extra DECIMAL(10,2) DEFAULT 0.00','gastos_efectivo DECIMAL(10,2) DEFAULT 0.00','incluir_propina_caja TINYINT(1) DEFAULT 1','arqueo_ciego TINYINT(1) DEFAULT 0','barra_asignada VARCHAR(80) NULL',"estado ENUM('Abierta','Cerrada') DEFAULT 'Abierta'"];
    for(const c of ['fecha','fecha_apertura','fecha_cierre','hora_inicio','hora_cierre','hora_apertura','fecha_inicio']){
        try{ await ejecutarQuery(db, "ALTER TABLE jornadas MODIFY COLUMN "+c+" DATETIME NULL DEFAULT CURRENT_TIMESTAMP"); }catch(e){}
        try{ await ejecutarQuery(db, "ALTER TABLE jornadas MODIFY COLUMN "+c+" DATETIME NULL"); }catch(e){}
    }
    for(const def of cols){
        const col = def.split(' ')[0];
        try{
            const [ex]=await ejecutarQuery(db, "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='jornadas' AND COLUMN_NAME=?", [col]);
            if(!ex.length) await ejecutarQuery(db, "ALTER TABLE jornadas ADD COLUMN "+def);
        }catch(e){}
    }
}
async function calcularYGuardarArqueo(idJornada, arqueo, incluirPropinaCaja, idUsuarioCierre, soloCalculo) {
    const db = soloCalculo ? pool : await pool.getConnection();
    try {
        if (!soloCalculo) await db.beginTransaction();
        await asegurarColumnasJornadas(db);

        const [filas] = await ejecutarQuery(db, 'SELECT * FROM jornadas WHERE id_jornada = ?', [idJornada]);
        if (filas.length === 0) throw new Error('Jornada no encontrada');
        const jornada = filas[0];

        const resumen = await obtenerResumenJornadaCompleto(db, idJornada);
        const usuarios = await obtenerUsuariosJornada(db, { id_usuario: jornada.id_usuario, id_usuario_cierre: idUsuarioCierre || null });

        const incluirPropina = incluirPropinaCaja !== undefined && incluirPropinaCaja !== null
            ? !!incluirPropinaCaja
            : (jornada.incluir_propina_caja === 1 || jornada.incluir_propina_caja === true);

        const conteo = calcularConteoFisico(arqueo);
        const esperado = calcularEfectivoEsperado(jornada, resumen, incluirPropina);
        const diferencia = conteo - esperado;

        let detalleArqueo = (arqueo || []).map(function(l) {
            return {
                denominacion: Number(l.valor || l.denominacion || 0),
                tipo: l.tipo === 'Moneda' ? 'Moneda' : 'Billete',
                cantidad: Number(l.cantidad) || 0,
                valor: ((Number(l.cantidad) || 0) * (Number(l.valor || l.denominacion) || 0))
            };
        });

        if (!soloCalculo) {
            await ejecutarQuery(db, 'DELETE FROM arqueos_detalle WHERE id_jornada = ?', [idJornada]);
            for (const linea of detalleArqueo) {
                await ejecutarQuery(db,
                    'INSERT INTO arqueos_detalle (id_jornada, denominacion, tipo, cantidad, valor) VALUES (?, ?, ?, ?, ?)',
                    [idJornada, linea.denominacion, linea.tipo, linea.cantidad, linea.valor]);
            }
            await ejecutarQuery(db, `
                UPDATE jornadas
                SET fecha_cierre = NOW(),
                    total_efectivo_esperado = ?,
                    total_efectivo_real = ?,
                    conteo_fisico = ?,
                    diferencia = ?,
                    ventas_brutas = ?,
                    descuentos = ?,
                    cortesias = ?,
                    ventas_netas = ?,
                    propina_efectivo = ?,
                    propina_tarjeta = ?,
                    ingresos_extra = ?,
                    gastos_efectivo = ?,
                    incluir_propina_caja = ?,
                    id_usuario_cierre = ?,
                    estado = 'Cerrada'
                WHERE id_jornada = ?`,
                [esperado, conteo, conteo, diferencia,
                 resumen.ventas_brutas, resumen.descuentos, resumen.cortesias, resumen.ventas_netas,
                 resumen.propina_efectivo, resumen.propina_tarjeta,
                 resumen.ingresos_extra, resumen.gastos_efectivo,
                 incluirPropina ? 1 : 0, idUsuarioCierre || null, idJornada]);

            const [cerrado] = await ejecutarQuery(db, 'SELECT * FROM jornadas WHERE id_jornada = ?', [idJornada]);
            await db.commit();
            return construirReporteJornada(cerrado[0] ? cerrado[0] : jornada, resumen, usuarios, conteo, esperado, diferencia, detalleArqueo);
        }

        return construirReporteJornada(jornada, resumen, usuarios, conteo, esperado, diferencia, detalleArqueo);
    } catch (error) {
        if (!soloCalculo) await db.rollback();
        throw error;
    } finally {
        if (!soloCalculo) db.release();
    }
}

async function obtenerReporteJornada(idJornada) {
    const [filas] = await pool.query('SELECT * FROM jornadas WHERE id_jornada = ?', [idJornada]);
    if (filas.length === 0) return null;
    const jornada = filas[0];
    const resumen = await obtenerResumenJornadaCompleto(pool, idJornada);
    const usuarios = await obtenerUsuariosJornada(pool, jornada);
    const [arqueo] = await pool.query(
        'SELECT denominacion, tipo, cantidad, valor FROM arqueos_detalle WHERE id_jornada = ? ORDER BY tipo, denominacion DESC',
        [idJornada]);
    const conteo = arqueo.reduce(function(acc, l) { return acc + Number(l.valor || 0); }, 0);
    return construirReporteJornada(jornada, resumen, usuarios,
        conteo || Number(jornada.conteo_fisico || 0),
        Number(jornada.total_efectivo_esperado || 0),
        Number(jornada.diferencia || 0),
        arqueo);
}

async function crearMovimientoCaja(datos) {
    const [result] = await pool.query(
        `INSERT INTO movimientos_caja (id_jornada, id_usuario, tipo, categoria, concepto, monto, numero_comprobante, justificacion)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [datos.id_jornada, datos.id_usuario || null, datos.tipo === 'Egreso' ? 'Egreso' : 'Ingreso',
         datos.categoria || 'General', datos.concepto || '', Number(datos.monto) || 0,
         datos.numero_comprobante || '', datos.justificacion || '']
    );
    return { id_movimiento: result.insertId };
}

async function cerrarJornada(idJornada, totalEfectivoReal, arqueo, incluirPropinaCaja, idUsuarioCierre) {
    return calcularYGuardarArqueo(idJornada, arqueo || [{ cantidad: 0, valor: Number(totalEfectivoReal), tipo: 'Billete' }], incluirPropinaCaja, idUsuarioCierre, false);
}

async function obtenerResumenJornada(idJornada) {
    const r = await obtenerResumenJornadaCompleto(pool, idJornada);
    return { desglose: r.desglose, total_general: r.total_general };
}

module.exports = {
    crearPedido,
    obtenerJornadaActiva,
    abrirJornada,
    cerrarJornada,
    obtenerResumenJornada,
    obtenerResumenJornadaCompleto,
    obtenerMovimientosCaja,
    crearMovimientoCaja,
    calcularYGuardarArqueo,
    obtenerReporteJornada,
    obtenerMetodosPagoCatalogo,
    calcularEfectivoEsperado,
    calcularConteoFisico,
    obtenerDesglosePagos,
    construirReporteJornada
};
