module.exports = function(app, db) {
    const audit = require('../services/audit-service');
    const { requierePermiso } = require('../middlewares/authMiddleware');
    const gestionarInventario = requierePermiso('gestionar_inventario');
    const { cobrarLimiter } = require('../middlewares/rateLimiter');
    const { requireTotpForHighRisk } = require('../middlewares/totp');
    const totpHighRisk = requireTotpForHighRisk(db.pool);
    app.get('/api/productos', async (req, res) => {
        try {
            const productos = await db.obtenerProductosActivos();
            res.json({ success: true, productos });
        } catch (error) {
            console.error('Error al obtener productos:', error.message);
            res.status(500).json({ success: false, mensaje: 'Error al obtener productos: ' + error.message });
        }
    });

    app.get('/api/productos/admin', async (req, res) => {
        try {
            const filtro = req.query.estado === 'inactivos' ? 'inactivos' : req.query.estado === 'todos' ? 'todos' : 'activos';
            const productos = await db.obtenerProductosAdmin(filtro);
            res.json({ success: true, productos });
        } catch (error) {
            console.error('Error al obtener productos (admin):', error.message);
            res.status(500).json({ success: false, mensaje: 'Error al obtener productos: ' + error.message });
        }
    });

    app.get('/api/productos/:id', async (req, res) => {
        const { id } = req.params;
        try {
            const producto = await db.obtenerProductoPorId(id);
            if (!producto) {
                return res.status(404).json({ success: false, mensaje: 'Producto no encontrado' });
            }
            res.json({ success: true, producto });
        } catch (error) {
            console.error('Error al obtener producto:', error.message);
            res.status(500).json({ success: false, mensaje: 'Error al obtener producto: ' + error.message });
        }
    });

    app.post('/api/productos', gestionarInventario, async (req, res) => {
        const { nombre, precio, categoria, descripcion, imagen, stock_minimo, factor_conversion, codigo_barras, iva_pct, ico_pct } = req.body;

        if (!nombre || precio == null) {
            return res.status(400).json({ success: false, mensaje: 'Nombre y precio de venta son obligatorios' });
        }

        try {
            const idProducto = await db.insertarProducto({ nombre, precio, categoria, descripcion, imagen, stock: 0, stock_minimo, factor_conversion, codigo_barras, iva_pct, ico_pct });
            res.json({ success: true, mensaje: 'Producto creado correctamente. Stock inicial 0 - se incrementara via Compras', idProducto });
        } catch (error) {
            console.error('Error al crear producto:', error.message);
            res.status(500).json({ success: false, mensaje: 'Error al crear producto: ' + error.message });
        }
    });

    app.put('/api/productos/:id', gestionarInventario, async (req, res) => {
        const { id } = req.params;
        const { nombre, precio, categoria, descripcion, imagen, stock_minimo, factor_conversion, codigo_barras, iva_pct, ico_pct } = req.body;

        if (!nombre || precio == null) {
            return res.status(400).json({ success: false, mensaje: 'Nombre y precio de venta son obligatorios' });
        }

        try {
            const [old]=await db.pool.query('SELECT precio FROM productos WHERE id_producto=?',[id]);
            const cambiaPrecio = old.length && Number(old[0].precio) !== Number(precio);
            if (cambiaPrecio) {
                const totp = require('../middlewares/totp');
                const idU = req.body.id_usuario || (req.session && req.session.usuario && req.session.usuario.id_usuario) || null;
                if (!idU) return res.status(401).json({ success: false, mensaje: 'id_usuario requerido para cambio de precio' });
                if (await totp.isTotpEnabledForUser(db.pool, idU)) {
                    const code = totp.getCode(req);
                    if (!code) return res.status(403).json({ success: false, needTotp: true, mensaje: 'Este usuario tiene 2FA activo: ingresa tu codigo de autenticacion para confirmar el cambio de precio' });
                    const v = await totp.verifyCodeForUser(db.pool, idU, code);
                    if (!v.ok) return res.status(403).json({ success: false, needTotp: true, mensaje: 'Codigo de autenticacion invalido o vencido' });
                }
            }
            await db.actualizarProducto(id, { nombre, precio, categoria, descripcion, imagen, stock_minimo, factor_conversion, codigo_barras, iva_pct, ico_pct });
            if(old.length && Number(old[0].precio)!==Number(precio)) await audit.auditFromReq(req,{tipo_evento:'CAMBIO_PRECIO', descripcion:`Cambio precio ${nombre} de ${old[0].precio} a ${precio} id ${id}`, motivo:'actualización producto', mesa_id:null});
            res.json({ success: true, mensaje: 'Producto actualizado correctamente' });
        } catch (error) {
            console.error('Error al actualizar producto:', error.message);
            res.status(500).json({ success: false, mensaje: 'Error al actualizar producto: ' + error.message });
        }
    });

    app.delete('/api/productos/:id', gestionarInventario, async (req, res) => {
        const { id } = req.params;
        try {
            const r = await db.eliminarProducto(id);
            if (!r.affectedRows) return res.status(404).json({ success: false, mensaje: 'Producto no encontrado' });
            res.json({ success: true, desactivado: true, mensaje: 'Producto desactivado correctamente (eliminacion logica). Stock y historial conservados.' });
        } catch (error) {
            console.error('Error al desactivar producto:', error.message);
            res.status(500).json({ success: false, mensaje: 'Error al desactivar producto: ' + error.message });
        }
    });

    app.put('/api/productos/:id/estado', gestionarInventario, async (req, res) => {
        const { id } = req.params;
        const { activo } = req.body;

        if (activo === undefined) {
            return res.status(400).json({ success: false, mensaje: 'El campo activo es obligatorio' });
        }

        try {
            await db.pool.query(
                'UPDATE productos SET activo = ? WHERE id_producto = ?',
                [activo, id]
            );
            res.json({ success: true, mensaje: activo ? 'Producto activado' : 'Producto desactivado' });
        } catch (error) {
            console.error('Error al actualizar producto:', error.message);
            res.status(500).json({ success: false, mensaje: 'Error al actualizar producto: ' + error.message });
        }
    });

    app.put('/api/productos/:id/stock', gestionarInventario, async (req, res) => {
        const { id } = req.params;
        const { stock, stock_minimo, unidad_medida, factor_conversion } = req.body;
        try {
            await db.actualizarStock(id, stock, stock_minimo, unidad_medida, factor_conversion);
            res.json({ success: true, mensaje: 'Stock actualizado correctamente' });
        } catch (error) {
            const code = (error.statusCode === 400) ? 400 : 500;
            const prefix = (code === 400) ? '' : 'Error al actualizar stock: ';
            res.status(code).json({ success: false, mensaje: prefix + error.message });
        }
    });

    async function tienePermisoCobrar(req, idUsuario){
        try{
            var sessRol = req.session && req.session.usuario ? String(req.session.usuario.rol || '').toLowerCase() : '';
            if(req.session && req.session.usuario && (Number(req.session.usuario.id_rol)===1 || sessRol==='administrador' || sessRol==='admin' || sessRol.indexOf('admin')!==-1 || sessRol.indexOf('cajer')!==-1)) return true;
            var idRol=null;
            var rolNombre='';
            if(req.session && req.session.usuario && req.session.usuario.id_rol) { idRol=req.session.usuario.id_rol; rolNombre=sessRol; }
            else if(idUsuario){
                var [u]=await db.pool.query('SELECT u.id_rol, LOWER(r.nombre) AS rol FROM usuarios u LEFT JOIN roles r ON r.id_rol=u.id_rol WHERE u.id_usuario=?',[idUsuario]);
                if(u.length) { idRol=u[0].id_rol; rolNombre=String(u[0].rol || ''); }
            }
            if(!idRol) return false;
            if(rolNombre==='administrador' || rolNombre==='admin' || rolNombre.indexOf('admin')!==-1 || rolNombre.indexOf('cajer')!==-1) return true;
            var [perm]=await db.pool.query("SELECT id_permiso FROM permisos WHERE codigo='cobrar_cuentas' LIMIT 1");
            if(!perm.length) return true;
            var [rows]=await db.pool.query('SELECT 1 FROM rol_permisos WHERE id_rol=? AND id_permiso=? LIMIT 1',[idRol, perm[0].id_permiso]);
            return rows.length>0;
        }catch(e){ return false; }
    }
    async function ensureFacturasTables(conn) {
        await conn.query("CREATE TABLE IF NOT EXISTS facturas (" +
            "id_factura INT AUTO_INCREMENT PRIMARY KEY," +
            "id_mesa INT NOT NULL," +
            "numero_factura VARCHAR(30) NULL," +
            "fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP," +
            "id_usuario INT NULL," +
            "id_jornada INT NULL," +
            "subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00," +
            "descuento DECIMAL(12,2) NOT NULL DEFAULT 0.00," +
            "propina DECIMAL(12,2) NOT NULL DEFAULT 0.00," +
            "impuestos DECIMAL(12,2) NOT NULL DEFAULT 0.00," +
            "total DECIMAL(12,2) NOT NULL DEFAULT 0.00," +
            "metodo_pago VARCHAR(50) NULL," +
            "sub_metodo_pago VARCHAR(50) NULL," +
            "referencia_pago VARCHAR(100) NULL," +
            "es_cortesia TINYINT(1) NOT NULL DEFAULT 0," +
            "estado VARCHAR(20) NOT NULL DEFAULT 'Pagada'," +
            "KEY idx_facturas_mesa (id_mesa)," +
            "KEY idx_facturas_fecha (fecha)," +
            "KEY idx_facturas_jornada (id_jornada)" +
            ")");
        await conn.query("CREATE TABLE IF NOT EXISTS detalle_factura (" +
            "id_detalle INT AUTO_INCREMENT PRIMARY KEY," +
            "id_factura INT NOT NULL," +
            "id_producto INT NOT NULL," +
            "producto_nombre VARCHAR(150) NOT NULL DEFAULT ''," +
            "cantidad DECIMAL(12,2) NOT NULL DEFAULT 0," +
            "precio_unitario DECIMAL(12,2) NOT NULL DEFAULT 0," +
            "subtotal DECIMAL(12,2) NOT NULL DEFAULT 0," +
            "presentacion VARCHAR(40) NULL," +
            "observaciones TEXT NULL," +
            "KEY idx_det_factura (id_factura)," +
            "CONSTRAINT fk_det_factura FOREIGN KEY (id_factura) REFERENCES facturas(id_factura) ON DELETE CASCADE" +
            ")");
        try {
            const [cols] = await conn.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='pedidos' AND COLUMN_NAME='id_factura'");
            if (cols.length === 0) await conn.query("ALTER TABLE pedidos ADD COLUMN id_factura INT NULL");
        } catch (e) {}
        // Asegurar columnas de separación cajero/mesero en facturas
        try {
            const [cM] = await conn.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='facturas' AND COLUMN_NAME='id_mesero'");
            if (cM.length === 0) { try { await conn.query("ALTER TABLE facturas ADD COLUMN id_mesero INT NULL, ADD INDEX idx_facturas_mesero (id_mesero)"); } catch (e) {} }
            const [cC] = await conn.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='facturas' AND COLUMN_NAME='id_cajero'");
            if (cC.length === 0) { try { await conn.query("ALTER TABLE facturas ADD COLUMN id_cajero INT NULL"); } catch (e) {} }
            const [cR] = await conn.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='facturas' AND COLUMN_NAME='id_usuario_registra'");
            if (cR.length === 0) { try { await conn.query("ALTER TABLE facturas ADD COLUMN id_usuario_registra INT NULL"); } catch (e) {} }
            const [cClave] = await conn.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='facturas' AND COLUMN_NAME='clave_factura'");
            if (cClave.length === 0) { try { await conn.query("ALTER TABLE facturas ADD COLUMN clave_factura VARCHAR(64) NULL, ADD UNIQUE INDEX uq_facturas_clave (clave_factura)"); } catch (e) {} }
        } catch (e) {}
    }
    app.post('/api/facturar', cobrarLimiter, async (req, res) => {
        const { id_mesa, metodo_pago, total, descuento, propina, es_cortesia, sub_metodo, referencia, id_jornada, id_usuario, id_mesero, id_cajero, id_usuario_registra, clave_factura } = req.body;

        if (!id_mesa || !metodo_pago) {
            return res.status(400).json({ success: false, mensaje: 'Faltan datos de pago' });
        }
        // Cajero = quien cobra (sesión), Mesero = titular de la cuenta (copiado de pedidos/mesa), nunca del body en facturación
        const ses = req.session && req.session.usuario;
        const cajeroId = Number(ses?.id_usuario || req.user?.id || id_cajero || id_usuario_registra || id_usuario);
        if (!cajeroId) return res.status(401).json({ success: false, mensaje: 'No se pudo identificar al cajero (sesión).' });
        if(!await tienePermisoCobrar(req, cajeroId)) return res.status(403).json({ success:false, mensaje:'Acceso denegado: se requiere permiso cobrar_cuentas' });

        const conexion = await db.pool.getConnection();
        try {
            await conexion.beginTransaction();
            await ensureFacturasTables(conexion);

            // Idempotencia por clave_factura (evita duplicados por doble clic)
            if (clave_factura) {
                try {
                    const [dup] = await conexion.query("SELECT id_factura, numero_factura, total FROM facturas WHERE clave_factura = ? LIMIT 1", [String(clave_factura).substring(0,64)]);
                    if (dup.length) {
                        await conexion.rollback();
                        return res.json({ success: true, mensaje: 'Factura ya registrada (idempotencia) ' + dup[0].numero_factura, id_pedido: dup[0].id_factura, id_factura: dup[0].id_factura, numero_factura: dup[0].numero_factura, total: dup[0].total, duplicado: true });
                    }
                } catch (e) {}
            }

            // CORRECCIÓN FACTURACIÓN: bloqueo + obtener mesero titular de la cuenta (copiado a factura)
            const [pedidos] = await conexion.query(
                "SELECT id_pedido, total, id_mesero, id_usuario, id_cajero FROM pedidos WHERE id_mesa = ? AND estado = 'Pendiente' FOR UPDATE",
                [id_mesa]
            );
            if (pedidos.length === 0) {
                await conexion.rollback();
                return res.status(404).json({ success: false, mensaje: 'No hay pedidos pendientes para esta mesa' });
            }
            // mesero titular = COALESCE(mesas.id_mesero, pedidos.id_mesero, pedidos.id_usuario) — titular único, nunca el cajero
            let meseroId = null;
            try {
                const [mesaRow]=await conexion.query("SELECT id_mesero FROM mesas WHERE id_mesa=?", [id_mesa]);
                const mesaMesero = mesaRow.length ? mesaRow[0].id_mesero : null;
                const pedMesero = pedidos[0].id_mesero || pedidos.find(p=>p.id_mesero)?.id_mesero || null;
                meseroId = mesaMesero || pedMesero || null;
                // venta mostrador sin mesa: si id_mesa nulo y body traia mesero, usarlo (fallback)
                if (!meseroId && id_mesero) meseroId = Number(id_mesero);
                // si aun nulo (historico sin dato), dejar NULL -> "Sin mesero registrado", NUNCA rellenar con cajero
                if (meseroId) {
                    const [chkM]=await conexion.query("SELECT 1 FROM usuarios WHERE id_usuario=? AND activo=1 LIMIT 1", [meseroId]);
                    if (!chkM.length) meseroId = null;
                }
            } catch(e){ meseroId = pedidos[0].id_mesero || null; }

            const [detallesConsolidados] = await conexion.query(
                "SELECT dp.id_producto, COALESCE(prod.nombre, CONCAT('Producto #', dp.id_producto)) AS producto_nombre, dp.cantidad, dp.precio_unitario, COALESCE(dp.subtotal, dp.cantidad * dp.precio_unitario, 0) AS subtotal, dp.presentacion, dp.observaciones, p.id_pedido " +
                "FROM pedidos p JOIN detalle_pedido dp ON p.id_pedido = dp.id_pedido LEFT JOIN productos prod ON dp.id_producto = prod.id_producto " +
                "WHERE p.id_mesa = ? AND p.estado = 'Pendiente'",
                [id_mesa]
            );
            if (detallesConsolidados.length === 0) {
                await conexion.rollback();
                return res.status(400).json({ success: false, mensaje: 'La mesa no tiene productos para facturar' });
            }

            let subtotalBruto = 0;
            detallesConsolidados.forEach(function(d) { subtotalBruto += Number(d.subtotal) || (Number(d.cantidad) * Number(d.precio_unitario)); });
            subtotalBruto = Math.round(subtotalBruto * 100) / 100;

            let impuestos = 0;
            try {
                const [cfg] = await conexion.query("SELECT valor FROM configuracion_general WHERE clave IN ('iva_global','iva') ORDER BY clave DESC LIMIT 1");
                if (cfg.length) {
                    const ivaPct = Number(cfg[0].valor) || 0;
                    if (ivaPct > 0) impuestos = Math.round(subtotalBruto * ivaPct / 100 * 100) / 100;
                }
            } catch (e) {}

            const descuentoNum = Number(descuento) || 0;
            const propinaNum = Number(propina) || 0;
            const totalCalc = Math.max(0, Math.round((subtotalBruto + impuestos - descuentoNum + propinaNum) * 100) / 100);
            const totalFinal = (total !== undefined && total !== null && Number(total) > 0) ? Number(total) : totalCalc;

            let idFactura;
            let numeroFactura;
            const claveNorm = clave_factura ? String(clave_factura).substring(0,64) : null;
            try {
                const [rFact] = await conexion.query(
                    "INSERT INTO facturas (id_mesa, numero_factura, fecha, id_usuario, id_cajero, id_usuario_registra, id_mesero, id_jornada, subtotal, descuento, propina, impuestos, total, metodo_pago, sub_metodo_pago, referencia_pago, es_cortesia, estado, clave_factura) VALUES (?, NULL, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pagada', ?)",
                    [id_mesa, cajeroId, cajeroId, cajeroId, meseroId, id_jornada || null, subtotalBruto, descuentoNum, propinaNum, impuestos, totalFinal, metodo_pago, sub_metodo || null, referencia || null, es_cortesia ? 1 : 0, claveNorm]
                );
                idFactura = rFact.insertId;
            } catch (e) {
                if (e.code === 'ER_BAD_FIELD_ERROR' || (e.message && e.message.indexOf('clave_factura') !== -1)) {
                    try {
                        const [rFact2] = await conexion.query(
                            "INSERT INTO facturas (id_mesa, numero_factura, fecha, id_usuario, id_mesero, id_jornada, subtotal, descuento, propina, impuestos, total, metodo_pago, sub_metodo_pago, referencia_pago, es_cortesia, estado) VALUES (?, NULL, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pagada')",
                            [id_mesa, cajeroId, meseroId, id_jornada || null, subtotalBruto, descuentoNum, propinaNum, impuestos, totalFinal, metodo_pago, sub_metodo || null, referencia || null, es_cortesia ? 1 : 0]
                        );
                        idFactura = rFact2.insertId;
                    } catch (e2) {
                        if (e2.code === 'ER_DUP_ENTRY' && claveNorm) {
                            const [dup2] = await conexion.query("SELECT id_factura, numero_factura, total FROM facturas WHERE clave_factura = ? LIMIT 1", [claveNorm]);
                            if (dup2.length) { await conexion.rollback(); return res.json({ success: true, mensaje: 'Factura ya registrada (idempotencia) ' + dup2[0].numero_factura, id_pedido: dup2[0].id_factura, id_factura: dup2[0].id_factura, numero_factura: dup2[0].numero_factura, total: dup2[0].total, duplicado: true }); }
                        }
                        const [rFact3] = await conexion.query(
                            "INSERT INTO facturas (id_mesa, numero_factura, fecha, id_usuario, id_jornada, subtotal, descuento, propina, impuestos, total, metodo_pago, sub_metodo_pago, referencia_pago, es_cortesia, estado) VALUES (?, NULL, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pagada')",
                            [id_mesa, cajeroId, id_jornada || null, subtotalBruto, descuentoNum, propinaNum, impuestos, totalFinal, metodo_pago, sub_metodo || null, referencia || null, es_cortesia ? 1 : 0]
                        );
                        idFactura = rFact3.insertId;
                    }
                } else if (e.code === 'ER_DUP_ENTRY' && claveNorm) {
                    const [dup] = await conexion.query("SELECT id_factura, numero_factura, total FROM facturas WHERE clave_factura = ? LIMIT 1", [claveNorm]);
                    if (dup.length) { await conexion.rollback(); return res.json({ success: true, mensaje: 'Factura ya registrada (idempotencia) ' + dup[0].numero_factura, id_pedido: dup[0].id_factura, id_factura: dup[0].id_factura, numero_factura: dup[0].numero_factura, total: dup[0].total, duplicado: true }); }
                    throw e;
                } else throw e;
            }
            numeroFactura = 'F-' + String(idFactura).padStart(6, '0');
            await conexion.query("UPDATE facturas SET numero_factura = ? WHERE id_factura = ?", [numeroFactura, idFactura]);
            if (claveNorm) { try { await conexion.query("UPDATE facturas SET clave_factura = ? WHERE id_factura = ? AND (clave_factura IS NULL OR clave_factura='')", [claveNorm, idFactura]); } catch (e) {} }

            for (const det of detallesConsolidados) {
                await conexion.query(
                    "INSERT INTO detalle_factura (id_factura, id_producto, producto_nombre, cantidad, precio_unitario, subtotal, presentacion, observaciones) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    [idFactura, det.id_producto, det.producto_nombre || '', det.cantidad, det.precio_unitario, det.subtotal, det.presentacion || null, det.observaciones || null]
                );
            }

            for (const det of detallesConsolidados) {
                try {
                    await db.descontarStockConConversion(det.id_producto, det.cantidad, conexion);
                } catch (e) {
                    console.error("[facturar-unificada] fallo stock producto " + det.id_producto + " cant " + det.cantidad + ": " + e.message);
                    throw e;
                }
            }

            const idsPedido = pedidos.map(function(p) { return p.id_pedido; });
            const ph = idsPedido.map(function() { return '?'; }).join(',');
            // id_usuario / id_cajero = cajero (sesión), no se sobrescribe el mesero original del pedido
            await conexion.query(
                "UPDATE pedidos SET estado = 'Pagado', metodo_pago = ?, sub_metodo_pago = ?, referencia_pago = ?, descuento = COALESCE(descuento,0) + ?, es_cortesia = ?, propina = COALESCE(propina,0) + ?, id_jornada = COALESCE(?, id_jornada), id_usuario = COALESCE(?, id_usuario), id_cajero = COALESCE(?, id_cajero), timestamp_despacho = NOW(), id_factura = ? WHERE id_pedido IN (" + ph + ")",
                [metodo_pago, sub_metodo || null, referencia || null, descuentoNum, es_cortesia ? 1 : 0, propinaNum, id_jornada || null, cajeroId, cajeroId, idFactura].concat(idsPedido)
            ).catch(async function(e) {
                if (e.code === 'ER_BAD_FIELD_ERROR') {
                    await conexion.query(
                        "UPDATE pedidos SET estado = 'Pagado', metodo_pago = ?, sub_metodo_pago = ?, referencia_pago = ?, descuento = COALESCE(descuento,0) + ?, es_cortesia = ?, propina = COALESCE(propina,0) + ?, id_jornada = COALESCE(?, id_jornada), id_usuario = COALESCE(?, id_usuario), timestamp_despacho = NOW(), id_factura = ? WHERE id_pedido IN (" + ph + ")",
                        [metodo_pago, sub_metodo || null, referencia || null, descuentoNum, es_cortesia ? 1 : 0, propinaNum, id_jornada || null, cajeroId, idFactura].concat(idsPedido)
                    );
                } else throw e;
            });

            await conexion.query(
                "UPDATE mesas SET estado = 'Disponible', id_mesero = NULL, fecha_ocupacion = NULL WHERE id_mesa = ?",
                [id_mesa]
            );

            await conexion.commit();

            if (!cajeroId) console.warn('[ALERTA FACTURACION] factura '+numeroFactura+' creada con cajero_id NULO (mesa '+id_mesa+') — revisar sesion');
            if (!meseroId) console.warn('[ALERTA FACTURACION] factura '+numeroFactura+' creada sin mesero (mesa '+id_mesa+') — se guardó como "Sin mesero registrado" (NULO) — validar si pedido original tenía titular');
            if(Number(descuentoNum)>0) await audit.auditFromReq(req,{usuario_id:cajeroId, tipo_evento:'DESCUENTO_APLICADO', descripcion:"Descuento $"+descuentoNum+" mesa "+id_mesa+" metodo "+metodo_pago+" (factura unificada "+numeroFactura+" mesero "+(meseroId|| '-')+")", motivo:"descuento "+descuentoNum+" propina "+propinaNum, mesa_id:id_mesa});
            res.json({ success: true, mensaje: 'Venta registrada y mesa liberada correctamente - Factura unificada ' + numeroFactura + ' con ' + detallesConsolidados.length + ' item(s)', id_pedido: idFactura, id_factura: idFactura, numero_factura: numeroFactura, subtotal: subtotalBruto, impuestos: impuestos, total: totalFinal, detalles: detallesConsolidados.length });
        } catch (error) {
            try { await conexion.rollback(); } catch (e) {}
            res.status(500).json({ success: false, mensaje: 'Error al procesar el cobro: ' + error.message });
        } finally {
            conexion.release();
        }
    });

    app.get('/api/facturas', async (req, res) => {
        try {
            const { id_jornada, fecha_inicio, fecha_fin, metodo_pago, limite } = req.query;
            const facturas = await db.obtenerFacturasJornada(id_jornada || null, {
                fecha_inicio, fecha_fin, metodo_pago, limite: limite || 100
            });
            res.json({ success: true, facturas });
        } catch (error) {
            res.status(500).json({ success: false, mensaje: 'Error al obtener facturas: ' + error.message });
        }
    });

    app.post('/api/facturar-dividido', cobrarLimiter, async (req, res) => {
        const { id_mesa, pagos, id_jornada, id_usuario, id_mesero, id_cajero, id_usuario_registra } = req.body;

        if (!id_mesa || !pagos || !Array.isArray(pagos) || pagos.length === 0) {
            return res.status(400).json({ success: false, mensaje: 'Faltan datos: id_mesa y al menos un pago son obligatorios' });
        }
        const sesDiv = req.session && req.session.usuario;
        const cajeroIdDiv = Number(sesDiv?.id_usuario || req.user?.id || id_cajero || id_usuario_registra || id_usuario);
        if (!cajeroIdDiv) return res.status(401).json({ success: false, mensaje: 'No se pudo identificar al cajero (sesión).' });
        if(!await tienePermisoCobrar(req, cajeroIdDiv)) return res.status(403).json({ success:false, mensaje:'Acceso denegado: se requiere permiso cobrar_cuentas' });

        try {
            const resultado = await db.facturarDividido(id_mesa, pagos, id_jornada, cajeroIdDiv);

            const [pedidosPagados] = await db.pool.query(
                "SELECT id_pedido FROM pedidos WHERE id_mesa = ? AND estado = 'Pagado' AND timestamp_despacho >= DATE_SUB(NOW(), INTERVAL 2 MINUTE) ORDER BY id_pedido DESC",
                [id_mesa]
            );
            const idPedido = pedidosPagados.length > 0 ? pedidosPagados[0].id_pedido : null;

            const metodos = pagos.map(function(p) { return p.metodo_pago + ' $' + Number(p.monto).toLocaleString(); }).join(' + ');
            const totalDesc = pagos.reduce((a,p)=>a+Number(p.descuento||0),0);
            if(totalDesc>0) await audit.auditFromReq(req,{usuario_id:cajeroIdDiv, tipo_evento:'DESCUENTO_APLICADO', descripcion:`Descuento $${totalDesc} mesa ${id_mesa} dividido`, motivo: JSON.stringify(pagos), mesa_id:id_mesa});
            res.json({
                success: true,
                mensaje: 'Pago registrado (' + metodos + ')' + (resultado.mesaLiberada ? ' - Mesa liberada' : ' - Pago parcial'),
                mesaLiberada: resultado.mesaLiberada,
                id_pedido: idPedido
            });
        } catch (error) {
            console.error('Error al procesar pago dividido:', error.message);
            res.status(500).json({ success: false, mensaje: 'Error al procesar el pago: ' + error.message });
        }
    });
};
