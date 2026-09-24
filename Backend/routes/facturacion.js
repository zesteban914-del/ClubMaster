module.exports = function(app, db) {

    // =========================================================
    // FACTURAS DE MESAS / POS
    // =========================================================
    app.get('/api/facturas/mesas', async (req, res) => {
        try {
            const { busqueda, fecha_inicio, fecha_fin, id_jornada, metodo_pago, id_mesero, id_cajero, limite } = req.query;
            const facturas = await db.obtenerFacturasMesas({
                busqueda, fecha_inicio, fecha_fin, id_jornada, metodo_pago, id_mesero, id_cajero, limite: limite || 200
            });
            res.json({ success: true, facturas });
        } catch (error) {
            console.error('Error al obtener facturas de mesas:', error.message);
            res.status(500).json({ success: false, mensaje: 'Error al obtener facturas: ' + error.message });
        }
    });

    app.get('/api/facturas/mesas/:id', async (req, res) => {
        try {
            const factura = await db.obtenerFacturaMesaDetalle(req.params.id);
            if (!factura) {
                return res.status(404).json({ success: false, mensaje: 'Factura no encontrada' });
            }
            res.json({ success: true, factura });
        } catch (error) {
            console.error('Error al obtener detalle de factura:', error.message);
            res.status(500).json({ success: false, mensaje: 'Error al obtener factura: ' + error.message });
        }
    });

    // =========================================================
    // FACTURAS DE COMPRAS / PROVEEDORES
    // =========================================================
    app.get('/api/facturas/compras', async (req, res) => {
        try {
            const { busqueda, fecha_inicio, fecha_fin, estado, id_proveedor, limite } = req.query;
            const facturas = await db.obtenerFacturasCompras({
                busqueda, fecha_inicio, fecha_fin, estado, id_proveedor, limite: limite || 200
            });
            res.json({ success: true, facturas });
        } catch (error) {
            console.error('Error al obtener facturas de compras:', error.message);
            res.status(500).json({ success: false, mensaje: 'Error al obtener compras: ' + error.message });
        }
    });

    app.get('/api/facturas/compras/:id', async (req, res) => {
        try {
            const factura = await db.obtenerFacturaCompraDetalle(req.params.id);
            if (!factura) {
                return res.status(404).json({ success: false, mensaje: 'Compra no encontrada' });
            }
            res.json({ success: true, factura });
        } catch (error) {
            console.error('Error al obtener detalle de compra:', error.message);
            res.status(500).json({ success: false, mensaje: 'Error al obtener compra: ' + error.message });
        }
    });

    // =========================================================
    // CUENTAS POR COBRAR / VALES
    // =========================================================
    app.get('/api/facturas/vales', async (req, res) => {
        try {
            const { busqueda, fecha_inicio, fecha_fin, estado, limite } = req.query;
            const facturas = await db.obtenerFacturasVales({
                busqueda, fecha_inicio, fecha_fin, estado, limite: limite || 200
            });
            res.json({ success: true, facturas });
        } catch (error) {
            console.error('Error al obtener vales:', error.message);
            res.status(500).json({ success: false, mensaje: 'Error al obtener vales: ' + error.message });
        }
    });

    app.get('/api/facturas/vales/:id', async (req, res) => {
        try {
            const factura = await db.obtenerFacturaValeDetalle(req.params.id);
            if (!factura) {
                return res.status(404).json({ success: false, mensaje: 'Vale no encontrado' });
            }
            res.json({ success: true, factura });
        } catch (error) {
            console.error('Error al obtener detalle de vale:', error.message);
            res.status(500).json({ success: false, mensaje: 'Error al obtener vale: ' + error.message });
        }
    });
    app.get('/api/facturas/pedidos/:id', async (req, res) => {
        try {
            const factura = await db.obtenerFacturaPorId(req.params.id);
            if (!factura) return res.status(404).json({ success: false, mensaje: 'Factura no encontrada' });
            res.json({ success: true, factura });
        } catch (e) { res.status(500).json({ success: false, mensaje: e.message }); }
    });
    app.get('/api/facturas/:id', async (req, res) => {
        try {
            if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ success: false, mensaje: 'ID invalido' });
            const factura = await db.obtenerFacturaPorId(req.params.id);
            if (!factura) return res.status(404).json({ success: false, mensaje: 'Factura no encontrada' });
            res.json({ success: true, factura });
        } catch (e) { res.status(500).json({ success: false, mensaje: e.message }); }
    });

    // =========================================================
    // CORRECCIÓN DE ATRIBUCIÓN MESERO/CAJERO (solo admin) - Auditoría
    // =========================================================
    async function ensureCorreccionesTable() {
        await db.pool.query(`CREATE TABLE IF NOT EXISTS factura_correcciones (
            id_correccion INT AUTO_INCREMENT PRIMARY KEY,
            id_factura INT NOT NULL,
            numero_factura VARCHAR(30) NULL,
            id_mesero_anterior INT NULL,
            id_cajero_anterior INT NULL,
            id_mesero_nuevo INT NULL,
            id_cajero_nuevo INT NULL,
            mesero_anterior_nombre VARCHAR(100) NULL,
            cajero_anterior_nombre VARCHAR(100) NULL,
            mesero_nuevo_nombre VARCHAR(100) NULL,
            cajero_nuevo_nombre VARCHAR(100) NULL,
            motivo TEXT NOT NULL,
            id_usuario_corrige INT NULL,
            usuario_corrige_nombre VARCHAR(100) NULL,
            fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_corr_factura (id_factura),
            KEY idx_corr_fecha (fecha)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    }

    app.get('/api/facturas/mesas/:id/correcciones', async (req, res) => {
        try {
            await ensureCorreccionesTable();
            const [rows] = await db.pool.query('SELECT * FROM factura_correcciones WHERE id_factura = ? ORDER BY fecha DESC', [req.params.id]);
            res.json({ success: true, correcciones: rows });
        } catch (e) { res.status(500).json({ success: false, mensaje: e.message }); }
    });

    app.put('/api/facturas/mesas/:id/atribucion', async (req, res) => {
        // Solo administrador
        const ses = req.session && req.session.usuario;
        const isAdmin = ses && (Number(ses.id_rol)===1 || String(ses.rol||'').toLowerCase()==='administrador' || String(ses.rol||'').toLowerCase()==='admin');
        if (!isAdmin) return res.status(403).json({ success: false, mensaje: 'Solo Administrador puede corregir atribución mesero/cajero' });
        const idFactura = Number(req.params.id);
        let { id_mesero, id_cajero, motivo } = req.body;
        motivo = String(motivo||'').trim();
        if (!motivo) return res.status(400).json({ success: false, mensaje: 'Motivo obligatorio para auditoría' });
        if (motivo.length < 5) return res.status(400).json({ success: false, mensaje: 'Motivo debe tener al menos 5 caracteres' });
        if (id_mesero === undefined && id_cajero === undefined) return res.status(400).json({ success: false, mensaje: 'Debe indicar al menos nuevo mesero o nuevo cajero' });
        // validar usuarios
        if (id_mesero != null && id_mesero !== '') {
            const [chk] = await db.pool.query('SELECT u.id_usuario, u.nombre, u.id_rol, r.nombre as rol_nombre FROM usuarios u LEFT JOIN roles r ON u.id_rol=r.id_rol WHERE u.id_usuario=? AND u.activo=1', [Number(id_mesero)]);
            if (!chk.length) return res.status(400).json({ success: false, mensaje: 'Mesero no existe o inactivo' });
            const rm = String(chk[0].rol_nombre||'').toLowerCase();
            if (rm.indexOf('mesero')===-1 && rm.indexOf('mesera')===-1 && Number(chk[0].id_rol)!==3) return res.status(400).json({ success: false, mensaje: 'El usuario seleccionado no tiene rol mesero' });
            id_mesero = Number(id_mesero);
        } else id_mesero = null;
        if (id_cajero != null && id_cajero !== '') {
            const [chk2] = await db.pool.query('SELECT id_usuario FROM usuarios WHERE id_usuario=? AND activo=1', [Number(id_cajero)]);
            if (!chk2.length) return res.status(400).json({ success: false, mensaje: 'Cajero no existe o inactivo' });
            id_cajero = Number(id_cajero);
        } else id_cajero = null;

        const conn = await db.pool.getConnection();
        try {
            await ensureCorreccionesTable();
            await conn.beginTransaction();
            const [facts] = await conn.query('SELECT id_factura, numero_factura, id_mesero, id_cajero FROM facturas WHERE id_factura=? FOR UPDATE', [idFactura]);
            if (!facts.length) { await conn.rollback(); return res.status(404).json({ success: false, mensaje: 'Factura no encontrada' }); }
            const prev = facts[0];
            // resolver nombres
            const [prevMes] = prev.id_mesero ? await conn.query('SELECT nombre FROM usuarios WHERE id_usuario=?', [prev.id_mesero]) : [[{nombre:null}]];
            const [prevCaj] = prev.id_cajero ? await conn.query('SELECT nombre FROM usuarios WHERE id_usuario=?', [prev.id_cajero]) : [[{nombre:null}]];
            let nuevoMesero = id_mesero !== null ? id_mesero : prev.id_mesero;
            let nuevoCajero = id_cajero !== null ? id_cajero : prev.id_cajero;
            const [newMes] = nuevoMesero ? await conn.query('SELECT nombre FROM usuarios WHERE id_usuario=?', [nuevoMesero]) : [[{nombre:null}]];
            const [newCaj] = nuevoCajero ? await conn.query('SELECT nombre FROM usuarios WHERE id_usuario=?', [nuevoCajero]) : [[{nombre:null}]];
            // actualizar factura
            await conn.query('UPDATE facturas SET id_mesero=?, id_cajero=? WHERE id_factura=?', [nuevoMesero, nuevoCajero, idFactura]);
            // también actualizar pedidos vinculados (propagar corrección)
            try { await conn.query('UPDATE pedidos SET id_mesero=?, id_cajero=? WHERE id_factura=?', [nuevoMesero, nuevoCajero, idFactura]); } catch(e){}
            // auditoría
            await conn.query('INSERT INTO factura_correcciones (id_factura, numero_factura, id_mesero_anterior, id_cajero_anterior, id_mesero_nuevo, id_cajero_nuevo, mesero_anterior_nombre, cajero_anterior_nombre, mesero_nuevo_nombre, cajero_nuevo_nombre, motivo, id_usuario_corrige, usuario_corrige_nombre) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
                [idFactura, prev.numero_factura, prev.id_mesero, prev.id_cajero, nuevoMesero, nuevoCajero, (prevMes[0]&&prevMes[0].nombre)||null, (prevCaj[0]&&prevCaj[0].nombre)||null, (newMes[0]&&newMes[0].nombre)||null, (newCaj[0]&&newCaj[0].nombre)||null, motivo, ses.id_usuario, ses.nombre]);
            // audit_logs
            try {
                const audit = require('../services/audit-service');
                await audit.registrarAudit({ usuario_id: ses.id_usuario, tipo_evento: 'ANULACION_ITEM', descripcion: `Corrección atribución factura ${prev.numero_factura}: mesero ${prev.id_mesero||'NULL'}->${nuevoMesero||'NULL'}, cajero ${prev.id_cajero||'NULL'}->${nuevoCajero||'NULL'} motivo: ${motivo}`, motivo, mesa_id: null });
            } catch(e){}
            await conn.commit();
            res.json({ success: true, mensaje: `Factura ${prev.numero_factura} corregida`, factura: { id_factura: idFactura, numero_factura: prev.numero_factura, id_mesero_anterior: prev.id_mesero, id_cajero_anterior: prev.id_cajero, id_mesero_nuevo: nuevoMesero, id_cajero_nuevo: nuevoCajero } });
        } catch(e) {
            try{ await conn.rollback(); }catch(_){}
            res.status(500).json({ success: false, mensaje: e.message });
        } finally { conn.release(); }
    });
};
