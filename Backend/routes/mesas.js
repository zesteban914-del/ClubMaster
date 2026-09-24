module.exports = function(app, db) {
    const audit = require('../services/audit-service');
    const zp = require('../helpers/zonas-permiso');
    const { pinLimiter } = require('../middlewares/rateLimiter');
    function esAdminSesion(req) {
        const u = req.session && req.session.usuario;
        if (!u) return false;
        if (Number(u.id_rol) === 1) return true;
        const r = String(u.rol || '').toLowerCase();
        return r === 'administrador' || r === 'admin';
    }
    function bloquearAdminMesas(req, res, next) {
        if (esAdminSesion(req)) {
            return res.status(403).json({ success: false, mensaje: 'Acceso restringido: el rol Administrador no tiene acceso al módulo de Mesas (uso operativo: Mesero/Cajero).' });
        }
        return next();
    }
    function esBartender(req) {
        const u = req.session && req.session.usuario;
        if (!u) return false;
        const r = String(u.rol || '').toLowerCase();
        return r.indexOf('bartender') !== -1 || r.indexOf('barman') !== -1;
    }
    // Guard general de zona (operativa): bartender solo Barra,
    // mesero todo excepto Barra, cajero/admin/gerente todo.
    async function exigirZonaOperativa(req, res, idMesaParam) {
        try {
            const zona = await zp.zonaDeMesa(idMesaParam);
            if (zona === null) {
                res.status(404).json({ success: false, mensaje: 'Mesa no encontrada' });
                return false;
            }
            const u = req.session && req.session.usuario;
            if (await zp.puedeEnZona(u, zona, 'operativa')) return true;
            await zp.negarPorZona(req, res, { accion: 'operar mesa', mesaId: idMesaParam, zona: zona });
            return false;
        } catch (e) { return true; }
    }
    async function exigirZonaBarra(req, res, idMesaParam) {
        return exigirZonaOperativa(req, res, idMesaParam);
    }
    // Guard de estructura: crear/editar/zona/activar. Cajero no tiene
    // estructura (solo opera/cobra); mesero todo excepto Barra.
    async function exigirZonaEstructura(req, res, zona, accion, mesaId) {
        try {
            const u = req.session && req.session.usuario;
            if (await zp.puedeEnZona(u, zona, 'estructura')) return true;
            await zp.negarPorZona(req, res, { accion: accion, mesaId: mesaId, zona: zona });
            return false;
        } catch (e) { return true; }
    }
    // Zonas permitidas del usuario en sesion (el frontend no hardcodea
    // la matriz rol->zonas: la pide aqui). Sin bloquearAdminMesas para
    // que cualquier rol autenticado pueda consultar su propio permiso.
    app.get('/api/mesas/zonas-permitidas', async (req, res) => {
        try {
            const u = req.session && req.session.usuario;
            if (!u) return res.status(401).json({ success: false, mensaje: 'No autenticado. Inicia sesion.' });
            const [estructura, operativa] = await Promise.all([
                zp.zonasPermitidas(u, 'estructura'),
                zp.zonasPermitidas(u, 'operativa')
            ]);
            res.json({ success: true, rol: zp.claveRol(u), estructura: estructura, operativa: operativa });
        } catch (error) {
            res.status(500).json({ success: false, mensaje: 'Error: ' + error.message });
        }
    });

    app.get('/api/mesas', bloquearAdminMesas, async (req, res) => {
        try {
            const todas = req.query.todas === '1';
            const zonas = await db.obtenerZonas();
            let mesas = await db.obtenerMesas(todas);
            // Ocultar por completo las zonas no permitidas (operativa).
            try {
                const u = req.session && req.session.usuario;
                const filtradas = [];
                for (const m of mesas) {
                    // eslint-disable-next-line no-await-in-loop
                    if (await zp.puedeEnZona(u, m.zona, 'operativa')) filtradas.push(m);
                }
                mesas = filtradas;
            } catch (e) {}
            res.json({ success: true, mesas, zonas });
        } catch (error) {
            console.error('Error al obtener mesas:', error.message);
            res.status(500).json({ success: false, mensaje: 'Error al obtener mesas: ' + error.message });
        }
    });

    app.get('/api/catalogos-mesas', bloquearAdminMesas, async (req, res) => {
        try {
            const [zonas, presentaciones, notas] = await Promise.all([
                db.obtenerZonas(),
                db.obtenerPresentaciones(),
                db.obtenerNotasPreparacion()
            ]);
            res.json({ success: true, zonas, presentaciones, notas });
        } catch (error) {
            res.status(500).json({ success: false, mensaje: 'Error: ' + error.message });
        }
    });

    app.get('/api/mesas/activas', async (req, res) => {
        try {
            let mesas = await db.obtenerMesasActivas();
            try {
                const u = req.session && req.session.usuario;
                if (u) {
                    const filtradas = [];
                    for (const m of mesas) {
                        // eslint-disable-next-line no-await-in-loop
                        if (await zp.puedeEnZona(u, m.zona, 'operativa')) filtradas.push(m);
                    }
                    mesas = filtradas;
                }
            } catch (e) {}
            res.json({ success: true, mesas });
        } catch (error) {
            console.error('Error al obtener mesas activas:', error.message);
            res.status(500).json({ success: false, mensaje: 'Error al obtener mesas activas: ' + error.message });
        }
    });

    app.get('/api/mesas/estados', bloquearAdminMesas, async (req, res) => {
        try {
            const raw = String(req.query.ids || '');
            const ids = raw.split(',').map(Number).filter(Boolean).slice(0, 100);
            if (!ids.length) return res.json({ success: true, estados: [] });
            const estados = await db.estadosMesasOcupadas(ids);
            res.json({ success: true, estados });
        } catch (error) {
            res.status(500).json({ success: false, mensaje: 'Error: ' + error.message });
        }
    });

    app.get('/api/mesas/:id/estado', bloquearAdminMesas, async (req, res) => {
        if (!(await exigirZonaBarra(req, res, req.params.id))) return;
        try {
            const estado = await db.estadoMesaOcupada(req.params.id);
            if (!estado) return res.status(404).json({ success: false, mensaje: 'Mesa no encontrada' });
            res.json({ success: true, ...estado });
        } catch (error) {
            res.status(500).json({ success: false, mensaje: 'Error: ' + error.message });
        }
    });

    const NUMERO_MESA_REGEX = /^[A-Za-z0-9\s\-]+$/;
    function validarNumeroMesaReq(numero) {
        const s = String(numero == null ? '' : numero).trim();
        if (!s) return 'El numero de la mesa es obligatorio';
        if (s.length > 20) return 'El numero de la mesa no puede superar 20 caracteres';
        if (!NUMERO_MESA_REGEX.test(s)) return 'Numero de mesa inválido: solo letras, números, espacios y guiones (Ej: 1, Mesa 12, VIP 3, A-5)';
        return null;
    }
    app.post('/api/mesas', bloquearAdminMesas, async (req, res) => {
        const { numero, nombre, capacidad, estado, zona, id_mesero } = req.body;
        const errNum = validarNumeroMesaReq(numero);
        if (errNum) return res.status(400).json({ success: false, mensaje: errNum });
        if (!(await exigirZonaEstructura(req, res, zona || 'VIP', 'crear mesa', null))) return;
        try {
            const r = await db.crearMesa({ numero: String(numero).trim(), nombre, capacidad, estado, zona, id_mesero });
            res.json({ success: true, mensaje: 'Mesa creada correctamente', idMesa: r.id_mesa });
        } catch (error) {
            if (/duplicad|duplicate|uq_|UNIQUE/i.test(error.message)) return res.status(409).json({ success: false, mensaje: 'Ya existe una mesa con ese número' });
            res.status(500).json({ success: false, mensaje: 'Error al crear mesa: ' + error.message });
        }
    });

    app.put('/api/mesas/:id', bloquearAdminMesas, async (req, res) => {
        try {
            if (req.body.numero !== undefined) {
                const errNum = validarNumeroMesaReq(req.body.numero);
                if (errNum) return res.status(400).json({ success: false, mensaje: errNum });
                req.body.numero = String(req.body.numero).trim();
            }
            // Estructura: la zona actual Y la zona destino deben estar permitidas.
            const zonaActual = await zp.zonaDeMesa(req.params.id);
            if (zonaActual === null) return res.status(404).json({ success: false, mensaje: 'Mesa no encontrada' });
            if (!(await exigirZonaEstructura(req, res, zonaActual, 'editar mesa', req.params.id))) return;
            if (req.body.zona !== undefined && String(req.body.zona) !== String(zonaActual)) {
                if (!(await exigirZonaEstructura(req, res, req.body.zona, 'editar mesa', req.params.id))) return;
            }
            await db.actualizarMesa(req.params.id, req.body);
            res.json({ success: true, mensaje: 'Mesa actualizada correctamente' });
        } catch (error) {
            if (/duplicad|duplicate|uq_|UNIQUE/i.test(error.message)) return res.status(409).json({ success: false, mensaje: 'Ya existe una mesa con ese número' });
            res.status(500).json({ success: false, mensaje: 'Error al actualizar mesa: ' + error.message });
        }
    });

    app.put('/api/mesas/:id/zona', bloquearAdminMesas, async (req, res) => {
        const { zona } = req.body;
        if (!zona) return res.status(400).json({ success: false, mensaje: 'La zona es obligatoria' });
        const zonaActual = await zp.zonaDeMesa(req.params.id);
        if (zonaActual === null) return res.status(404).json({ success: false, mensaje: 'Mesa no encontrada' });
        if (!(await exigirZonaEstructura(req, res, zonaActual, 'cambiar zona', req.params.id))) return;
        if (!(await exigirZonaEstructura(req, res, zona, 'cambiar zona', req.params.id))) return;
        try {
            await db.actualizarMesa(req.params.id, { zona });
            res.json({ success: true, mensaje: 'Zona actualizada a ' + zona });
        } catch (error) {
            res.status(500).json({ success: false, mensaje: 'Error: ' + error.message });
        }
    });

    app.put('/api/mesas/:id/estado', bloquearAdminMesas, async (req, res) => {
        if (!(await exigirZonaOperativa(req, res, req.params.id))) return;
        const { estado } = req.body;
        if (!estado) return res.status(400).json({ success: false, mensaje: 'El estado es obligatorio' });
        try {
            await db.cambiarMesaEstado(req.params.id, estado);
            res.json({ success: true, mensaje: 'Estado de mesa cambiado a ' + estado });
        } catch (error) {
            res.status(500).json({ success: false, mensaje: 'Error: ' + error.message });
        }
    });

    app.put('/api/mesas/:id/inhabilitar', bloquearAdminMesas, async (req, res) => {
        const { activo } = req.body;
        const zonaMesa = await zp.zonaDeMesa(req.params.id);
        if (zonaMesa === null) return res.status(404).json({ success: false, mensaje: 'Mesa no encontrada' });
        if (!(await exigirZonaEstructura(req, res, zonaMesa, (activo ? 'habilitar' : 'inhabilitar') + ' mesa', req.params.id))) return;
        try {
            await db.toggleMesa(req.params.id, activo);
            res.json({ success: true, mensaje: activo ? 'Mesa habilitada' : 'Mesa inhabilitada' });
        } catch (error) {
            res.status(500).json({ success: false, mensaje: 'Error: ' + error.message });
        }
    });

    app.post('/api/mesas/unir', bloquearAdminMesas, async (req, res) => {
        const { id_mesa_origen, id_mesa_destino } = req.body;
        if (!id_mesa_origen || !id_mesa_destino) {
            return res.status(400).json({ success: false, mensaje: 'Faltan mesas de origen y destino' });
        }
        if (Number(id_mesa_origen) === Number(id_mesa_destino)) {
            return res.status(400).json({ success: false, mensaje: 'Las mesas de origen y destino deben ser distintas' });
        }
        if (!(await exigirZonaOperativa(req, res, id_mesa_origen))) return;
        if (!(await exigirZonaOperativa(req, res, id_mesa_destino))) return;
        try {
            const r = await db.unirMesas(id_mesa_origen, id_mesa_destino);
            res.json({ success: true, mensaje: 'Mesas unidas', pedidos_transferidos: r.pedidos_transferidos });
        } catch (error) {
            res.status(500).json({ success: false, mensaje: 'Error al unir mesas: ' + error.message });
        }
    });

    app.post('/api/pedidos', bloquearAdminMesas, async (req, res) => {
        const { id_mesa, id_jornada, detalles, clave_cliente, id_mesero: idMeseroBody, id_cajero: idCajeroBody } = req.body;
        const atrib = require('../helpers/atribucion');

        const ses = req.session && req.session.usuario;
        const idUsuarioSesion = ses && (ses.id_usuario || ses.id);
        const rolSesion = ses && (ses.rol || ses.nombre_rol || '');
        const idRolSesion = ses && ses.id_rol;
        const id_usuario = Number(idUsuarioSesion || req.user?.id || idCajeroBody || req.body.id_usuario);
        if (!idUsuarioSesion && !req.user?.id) {
            return res.status(401).json({ success: false, mensaje: 'Sesión inválida: no se pudo identificar al usuario.' });
        }
        let id_mesero;
        const esMesero = atrib.esRolMesero(rolSesion, idRolSesion) || Number(idRolSesion)===3;
        // Zona de la mesa: la atencion sigue la misma regla de zona.
        const zonaMesa = await zp.zonaDeMesa(id_mesa);
        if (zonaMesa === null) {
            return res.status(404).json({ success: false, mensaje: 'Mesa no encontrada' });
        }
        if (!(await zp.puedeEnZona(ses, zonaMesa, 'operativa'))) {
            return zp.negarPorZona(req, res, { accion: 'atender mesa', mesaId: id_mesa, zona: zonaMesa });
        }
        // Punto de cruce mesero/cajero: la zona Barra la atiende personal
        // de barra (bartender), las demas zonas las atienden meseros.
        const atiendeRequerido = zp.rolAtiendeRequerido(zonaMesa); // 'bartender' | 'mesero'
        const etiquetaAtiende = atiendeRequerido === 'bartender' ? 'personal de barra' : 'mesero';
        async function validarAtiende(idCandidato) {
            const [chk] = await db.pool.query(
                "SELECT u.id_usuario, u.id_rol, r.nombre AS rol_nombre FROM usuarios u LEFT JOIN roles r ON u.id_rol=r.id_rol WHERE u.id_usuario=? AND u.activo=1 LIMIT 1",
                [idCandidato]
            );
            if (!chk.length) return { ok: false, mensaje: 'El ' + etiquetaAtiende + ' seleccionado no existe o está inactivo.' };
            if (!zp.esRolAtiendeValido(chk[0].rol_nombre, chk[0].id_rol, atiendeRequerido)) {
                return { ok: false, mensaje: 'La mesa es de zona ' + zonaMesa + ': debe atender ' + etiquetaAtiende + ', no un usuario con otro rol.' };
            }
            return { ok: true };
        }
        if (esMesero) {
            // Rol mesero: mesa/pedido queda a su nombre y no puede cambiarlo
            id_mesero = Number(idUsuarioSesion);
            if (idMeseroBody && Number(idMeseroBody) !== id_mesero) {
                console.warn(`[pedidos] mesero no puede suplantar: body id_mesero=${idMeseroBody} ignorado, sesion ${id_mesero} (mesa ${id_mesa})`);
            }
            if (atiendeRequerido !== 'mesero') {
                return zp.negarPorZona(req, res, { accion: 'atender mesa', mesaId: id_mesa, zona: zonaMesa });
            }
        } else if (zp.claveRol(ses) === 'bartender') {
            // Rol bartender: atiende directamente la barra a su nombre
            id_mesero = Number(idUsuarioSesion);
            if (idMeseroBody && Number(idMeseroBody) !== id_mesero) {
                console.warn(`[pedidos] bartender no puede suplantar: body id_mesero=${idMeseroBody} ignorado, sesion ${id_mesero} (mesa ${id_mesa})`);
            }
        } else {
            // Rol cajero/gerente (admin bloqueado por bloquearAdminMesas):
            // selector de responsable obligatorio segun la zona.
            if (idMeseroBody == null || String(idMeseroBody).trim() === '' || !Number.isFinite(Number(idMeseroBody))) {
                return res.status(400).json({ success: false, mensaje: (atiendeRequerido === 'bartender' ? 'Personal de barra es obligatorio: seleccione quien atiende la mesa de Barra.' : 'Mesero es obligatorio: seleccione el mesero responsable de la mesa.') });
            }
            id_mesero = Number(idMeseroBody);
            // validar que el responsable existe, activo y con el rol de la zona
            try {
                const v = await validarAtiende(id_mesero);
                if (!v.ok) return res.status(400).json({ success: false, mensaje: v.mensaje });
            } catch (e) { return res.status(500).json({ success:false, mensaje:'Error validando responsable: '+e.message }); }
        }
        if (!id_mesero || !Number.isFinite(id_mesero)) {
            return res.status(400).json({ success: false, mensaje: 'No se pudo determinar el mesero.' });
        }

        if (!id_mesa || !id_jornada || !detalles || detalles.length === 0) {
            return res.status(400).json({ success: false, mensaje: 'Faltan datos obligatorios para el pedido' });
        }

        try {
            const jornada = await db.obtenerJornadaActiva();
            if (!jornada || jornada.estado !== 'Abierta') {
                return res.status(403).json({ success: false, mensaje: 'Caja CERRADA — Debe realizar la Apertura de Caja antes de tomar pedidos.' });
            }
            if (Number(id_jornada) !== Number(jornada.id_jornada)) {
                return res.status(403).json({ success: false, mensaje: 'La jornada enviada no coincide con la jornada abierta (#'+jornada.id_jornada+'). Recargue y reintente.' });
            }
            const resultado = await db.crearPedido(id_mesa, id_usuario, id_jornada, detalles, id_mesero, clave_cliente, id_usuario);
            if (resultado.duplicado) return res.json({ success: true, mensaje: 'Pedido ya registrado (duplicado evitado)', idPedido: resultado.idPedido, duplicado: true });
            res.json({ success: true, mensaje: 'Pedido registrado correctamente', idPedido: resultado.idPedido });
        } catch (error) {
            console.error('Error al guardar pedido:', error.message);
            const code = (error.statusCode === 400) ? 400 : 500;
            const prefix = (code === 400) ? '' : 'Error al guardar el pedido: ';
            res.status(code).json({ success: false, mensaje: prefix + error.message });
        }
    });

    app.get('/api/mesas/:id/cuenta', bloquearAdminMesas, async (req, res) => {
        const { id } = req.params;
        if (!(await exigirZonaBarra(req, res, id))) return;
        try {
            const mesaId = Number(id);
            const [mesaCheck]=await db.pool.query('SELECT id_mesa, numero, estado FROM mesas WHERE id_mesa=? OR numero=? LIMIT 1',[mesaId, id]);
            const realId = mesaCheck.length? mesaCheck[0].id_mesa : mesaId;
            const [hasIdDet] = await db.pool.query("SHOW COLUMNS FROM detalle_pedido LIKE 'id_detalle'");
            const idDetSelect = hasIdDet.length ? 'dp.id_detalle, ' : '';
            // Mesero responsable = COALESCE(p.id_mesero, p.id_usuario) -> nombre; cajero = p.id_usuario / p.id_cajero
            const [hasIdMesero] = await db.pool.query("SHOW COLUMNS FROM pedidos LIKE 'id_mesero'");
            const meseroJoin = hasIdMesero.length ? "COALESCE(p.id_mesero, p.id_usuario)" : "p.id_usuario";
            const idMeseroSelect = hasIdMesero.length ? ", p.id_mesero" : "";
            const sql = `
                SELECT p.id_pedido, ${idDetSelect}dp.id_producto, COALESCE(prod.nombre, CONCAT('Producto #', dp.id_producto)) as nombre, dp.cantidad, dp.precio_unitario, COALESCE(dp.subtotal, dp.cantidad * dp.precio_unitario, 0) AS subtotal, p.estado as pedido_estado, p.id_usuario, p.id_usuario AS id_cajero${idMeseroSelect}, COALESCE(u.nombre, '') AS mesero_nombre
                FROM pedidos p
                JOIN detalle_pedido dp ON p.id_pedido = dp.id_pedido
                LEFT JOIN productos prod ON dp.id_producto = prod.id_producto
                LEFT JOIN usuarios u ON ${meseroJoin} = u.id_usuario
                WHERE p.id_mesa = ? AND p.estado IN ('Pendiente','Enviado','En preparación','Pendiente ','pendiente')
            `;
            let [detalles]=await db.pool.query(sql,[realId]);
            if(!detalles.length){
                const [alt]=await db.pool.query(`
                    SELECT p.id_pedido, ${idDetSelect}dp.id_producto, COALESCE(prod.nombre, CONCAT('Producto #', dp.id_producto)) as nombre, dp.cantidad, dp.precio_unitario, COALESCE(dp.subtotal, dp.cantidad * dp.precio_unitario, 0) AS subtotal, p.estado as pedido_estado, p.id_usuario, p.id_usuario AS id_cajero${idMeseroSelect}, COALESCE(u.nombre, '') AS mesero_nombre
                    FROM pedidos p
                    JOIN detalle_pedido dp ON p.id_pedido = dp.id_pedido
                    LEFT JOIN productos prod ON dp.id_producto = prod.id_producto
                    LEFT JOIN usuarios u ON ${meseroJoin} = u.id_usuario
                    WHERE p.id_mesa = ? AND p.estado NOT IN ('Pagado','Anulado','Cancelado','Cerrado')
                `,[realId]);
                detalles=alt;
            }
            detalles = detalles.filter(function(r){ return r.id_producto!=null; });
            detalles.forEach(function(it){ it.id_detalle = it.id_detalle != null ? it.id_detalle : it.id_producto; });
            const total = detalles.reduce((acc, item) => acc + Number(item.subtotal||0), 0);
            const mesero_nombre = detalles.length ? (detalles[0].mesero_nombre || '') : '';
            const id_usuario_creador = detalles.length ? (detalles[0].id_usuario || null) : null;
            res.json({ success: true, detalles, total, mesero_nombre, id_usuario_creador, debug:{mesaId:realId, mesaCheck: mesaCheck[0]||null} });
        } catch (error) {
            console.error('cuenta error',error.message);
            res.status(500).json({ success: false, mensaje: 'Error al obtener la cuenta: ' + error.message });
        }
    });

    async function tienePermisoCanCancel(idUsuario){
        if(!idUsuario) return false;
        try{
            const [u]=await db.pool.query('SELECT id_rol FROM usuarios WHERE id_usuario=?',[idUsuario]);
            if(!u.length) return false;
            const idRol=u[0].id_rol;
            const [perm]=await db.pool.query("SELECT id_permiso FROM permisos WHERE codigo='can_cancel_orders' LIMIT 1");
            if(!perm.length) return false;
            const [rows]=await db.pool.query('SELECT 1 FROM rol_permisos WHERE id_rol=? AND id_permiso=? LIMIT 1',[idRol, perm[0].id_permiso]);
            return rows.length>0;
        }catch(e){ return false; }
    }
    async function verificarPinMaestro(pin){
        if(!pin) return false;
        try{
            const [rows]=await db.pool.query("SELECT valor FROM configuracion_general WHERE clave='pin_maestro' LIMIT 1");
            if(!rows.length || !rows[0].valor) return false;
            return String(pin)===String(rows[0].valor);
        }catch(e){ return false; }
    }
    async function registrarAuditoriaCancel({idJornada, motivo, idSolicita, idAutoriza, items, mesaId, req}){
        try{
            const desc = JSON.stringify({motivo, mesa: mesaId, items: items.map(function(i){return {producto:i.nombre||i.producto||'', cantidad:i.cantidad, id_producto:i.id_producto, id_pedido:i.id_pedido}}), hora: new Date().toISOString()});
            const monto = items.reduce(function(a,i){return a+Number(i.subtotal|| (i.cantidad*i.precio_unitario) ||0)},0);
            await db.pool.query('INSERT INTO auditoria_incidencias (id_jornada,tipo,descripcion,id_usuario_autoriza,id_usuario_registra,monto,fecha) VALUES (?,?,?,?,?,?,NOW())',[idJornada||null,'anulacion',desc,idAutoriza||idSolicita,idSolicita,monto]);
            const tipoEvt = items.length>1 ? 'CANCELACION_PEDIDO' : 'ANULACION_ITEM';
            const legible = items.length>1 ? `Cancelado pedido Mesa ${mesaId}` : `Anulado ${items[0].nombre||'item'} x${items[0].cantidad} en Mesa ${mesaId}`;
            if(req) await audit.auditFromReq(req,{usuario_id:idSolicita, autorizado_por_id:idAutoriza, tipo_evento:tipoEvt, descripcion:`${legible} - ${motivo}`, motivo, mesa_id: mesaId});
        }catch(e){ console.error('auditoria cancel',e.message); }
    }
    async function revertirStockCancel(idProducto, cantidad){
        try{
            const [rows]=await db.pool.query('SELECT stock, factor_conversion FROM productos WHERE id_producto=?',[idProducto]);
            if(!rows.length) return;
            const factor = rows[0].factor_conversion ? Number(rows[0].factor_conversion) : null;
            let revert = Number(cantidad);
            if(factor && Number(factor) > 1){ revert = Math.ceil(Number(cantidad) / Number(factor) * 100)/100; }
            await db.pool.query('UPDATE productos SET stock = stock + ? WHERE id_producto=?',[revert, idProducto]);
        }catch(e){ try{ await db.pool.query('UPDATE productos SET stock = stock + ? WHERE id_producto=?',[Number(cantidad)||0, idProducto]); }catch(e2){} }
    }
    async function crearMermaPorCancel(item, motivo, idUsuario){
        try{
            const mapMotivo = (String(motivo).toLowerCase().indexOf('no disponible')!==-1 || String(motivo).toLowerCase().indexOf('venc')!==-1) ? 'Vencimiento' : (String(motivo).toLowerCase().indexOf('derrame')!==-1 ? 'Derrame' : (String(motivo).toLowerCase().indexOf('rotur')!==-1 ? 'Rotura' : 'Cortesia'));
            const [prodRows]=await db.pool.query('SELECT precio_costo FROM productos WHERE id_producto=?',[item.id_producto]);
            let costo=0; if(prodRows.length) costo=Number(prodRows[0].precio_costo||0);
            await db.pool.query('INSERT INTO mermas (id_producto,cantidad,motivo,observaciones,costo_unitario,valor_perdida,id_usuario) VALUES (?,?,?,?,?,?,?)',[item.id_producto, item.cantidad, mapMotivo, 'Cancelación: '+motivo+' - Mesa '+(item.mesa||item.id_mesa||''), costo, costo*Number(item.cantidad), idUsuario||null]);
        }catch(e){ console.error('merma cancel',e.message); }
    }

    app.post('/api/mesas/:id/cancelar-pedido', bloquearAdminMesas, pinLimiter, async (req,res)=>{
        const idMesa=req.params.id;
        if (!(await exigirZonaBarra(req, res, idMesa))) return;
        const {motivo, pin, id_usuario, motivo_personalizado} = req.body;
        const motivoFinal = (motivo_personalizado && String(motivo_personalizado).trim()) || motivo;
        if(!motivoFinal) return res.status(400).json({success:false,mensaje:'Motivo de anulación obligatorio'});
        const idSolicita = id_usuario || (req.session && req.session.usuario && req.session.usuario.id_usuario) || null;
        try{
            let puede=false;
            if(idSolicita) puede=await tienePermisoCanCancel(idSolicita);
            const isAdminSession = req.session && req.session.usuario && (Number(req.session.usuario.id_rol)===1 || String(req.session.usuario.rol).toLowerCase()==='administrador');
            if(puede || isAdminSession){
            }else{
                const okPin=await verificarPinMaestro(pin);
                if(!okPin){ await audit.auditFromReq(req,{usuario_id:idSolicita, tipo_evento:'PIN_FALLIDO', descripcion:`PIN fallido cancel pedido Mesa ${idMesa}`, motivo: pin||''}); return res.status(403).json({success:false,mensaje:'PIN Maestro inválido. Se requiere autorización de Gerente.'}); }
            }
            const [pedidos]=await db.pool.query("SELECT id_pedido, total, id_jornada FROM pedidos WHERE id_mesa=? AND estado='Pendiente'",[idMesa]);
            if(!pedidos.length) return res.status(404).json({success:false,mensaje:'No hay pedidos pendientes para cancelar en esta mesa'});
            const detallesAll=[];
            for(const ped of pedidos){
                const [det]=await db.pool.query('SELECT dp.*, prod.nombre FROM detalle_pedido dp LEFT JOIN productos prod ON dp.id_producto=prod.id_producto WHERE dp.id_pedido=?',[ped.id_pedido]);
                det.forEach(function(d){ d.id_pedido=ped.id_pedido; detallesAll.push(d); });
            }
            const [jAct]=await db.pool.query("SELECT id_jornada FROM jornadas WHERE estado='Abierta' ORDER BY id_jornada DESC LIMIT 1");
            const idJornada = pedidos[0].id_jornada || (jAct.length? jAct[0].id_jornada: null);
            const idAutoriza = idSolicita;
            await registrarAuditoriaCancel({idJornada, motivo: motivoFinal, idSolicita, idAutoriza, items: detallesAll, mesaId: idMesa, req});
            const motivoLower=String(motivoFinal).toLowerCase();
            const requiereMerma = motivoLower.indexOf('no disponible')!==-1 || motivoLower.indexOf('venc')!==-1 || motivoLower.indexOf('derrame')!==-1 || motivoLower.indexOf('rotur')!==-1 || motivoLower.indexOf('merma')!==-1 || motivoLower.indexOf('prepar')!==-1;
            if(requiereMerma){
                for(const it of detallesAll) await crearMermaPorCancel(it, motivoFinal, idSolicita);
            }else{
                for(const it of detallesAll) await revertirStockCancel(it.id_producto, it.cantidad);
            }
            for(const ped of pedidos){
                await db.pool.query('DELETE FROM detalle_pedido WHERE id_pedido=?',[ped.id_pedido]);
                await db.pool.query('DELETE FROM pedidos WHERE id_pedido=?',[ped.id_pedido]);
            }
            await db.pool.query("UPDATE mesas SET estado='Disponible', id_mesero=NULL, fecha_ocupacion=NULL WHERE id_mesa=?",[idMesa]);
            res.json({success:true,mensaje:'Pedido cancelado y auditado. Mesa liberada.', items: detallesAll.length});
        }catch(e){ console.error('cancelar-pedido',e.message); res.status(500).json({success:false,mensaje:e.message}); }
    });

    app.post('/api/pedidos/detalle/:idDetalle/cancelar', bloquearAdminMesas, pinLimiter, async (req,res)=>{
        const idDetalle=req.params.idDetalle;
        const {motivo, pin, id_usuario, motivo_personalizado, cantidad} = req.body;
        const motivoFinal = (motivo_personalizado && String(motivo_personalizado).trim()) || motivo;
        if(!motivoFinal) return res.status(400).json({success:false,mensaje:'Motivo obligatorio'});
        const idSolicita = id_usuario || (req.session && req.session.usuario && req.session.usuario.id_usuario) || null;
        try{
            let puede=false;
            if(idSolicita) puede=await tienePermisoCanCancel(idSolicita);
            const isAdminSession = req.session && req.session.usuario && (Number(req.session.usuario.id_rol)===1 || String(req.session.usuario.rol).toLowerCase()==='administrador');
            if(!(puede||isAdminSession)){
                const okPin=await verificarPinMaestro(pin);
                if(!okPin){ await audit.auditFromReq(req,{usuario_id:idSolicita, tipo_evento:'PIN_FALLIDO', descripcion:`PIN fallido anular item ${idDetalle}`, motivo: pin||''}); return res.status(403).json({success:false,mensaje:'PIN Maestro inválido'}); }
            }
            let detalle=null; let idPedido=null;
            try{
                const [rows]=await db.pool.query('SELECT dp.*, prod.nombre, p.id_mesa FROM detalle_pedido dp JOIN pedidos p ON dp.id_pedido=p.id_pedido LEFT JOIN productos prod ON dp.id_producto=prod.id_producto WHERE dp.id_detalle=?',[idDetalle]);
                if(rows.length) { detalle=rows[0]; idPedido=rows[0].id_pedido; }
            }catch(e){
                const [rows2]=await db.pool.query('SELECT dp.*, prod.nombre, p.id_mesa FROM detalle_pedido dp JOIN pedidos p ON dp.id_pedido=p.id_pedido LEFT JOIN productos prod ON dp.id_producto=prod.id_producto WHERE dp.id=?',[idDetalle]);
                if(rows2.length){ detalle=rows2[0]; idPedido=rows2[0].id_pedido; }
            }
            if(!detalle){
                const [fallback]=await db.pool.query('SELECT dp.*, prod.nombre, p.id_mesa FROM detalle_pedido dp JOIN pedidos p ON dp.id_pedido=p.id_pedido LEFT JOIN productos prod ON dp.id_producto=prod.id_producto WHERE dp.id_producto=? AND p.estado="Pendiente" LIMIT 1',[idDetalle]);
                if(!fallback.length) return res.status(404).json({success:false,mensaje:'Item no encontrado'});
                detalle=fallback[0]; idPedido=fallback[0].id_pedido;
            }
            if (detalle && detalle.id_mesa != null) {
                const zonaItem = await zp.zonaDeMesa(detalle.id_mesa);
                const uItem = req.session && req.session.usuario;
                if (!(await zp.puedeEnZona(uItem, zonaItem, 'operativa'))) {
                    return zp.negarPorZona(req, res, { accion: 'anular item', mesaId: detalle.id_mesa, zona: zonaItem });
                }
            }
            const cantCancelar = cantidad? Number(cantidad): Number(detalle.cantidad);
            if(cantCancelar<=0) return res.status(400).json({success:false,mensaje:'Cantidad inválida'});
            const [jAct]=await db.pool.query("SELECT id_jornada FROM jornadas WHERE estado='Abierta' ORDER BY id_jornada DESC LIMIT 1");
            const idJornada=jAct.length? jAct[0].id_jornada: null;
            await registrarAuditoriaCancel({idJornada, motivo: motivoFinal, idSolicita, idAutoriza: idSolicita, items: [detalle], mesaId: detalle.id_mesa, req});
            const motivoLower=String(motivoFinal).toLowerCase();
            const requiereMerma = motivoLower.indexOf('no disponible')!==-1 || motivoLower.indexOf('venc')!==-1 || motivoLower.indexOf('derrame')!==-1 || motivoLower.indexOf('rotur')!==-1 || motivoLower.indexOf('merma')!==-1;
            if(requiereMerma) await crearMermaPorCancel(detalle, motivoFinal, idSolicita);
            else await revertirStockCancel(detalle.id_producto, cantCancelar);
            if(cantCancelar >= Number(detalle.cantidad)){
                try{ await db.pool.query('DELETE FROM detalle_pedido WHERE id_detalle=?',[idDetalle]); }catch(e){ await db.pool.query('DELETE FROM detalle_pedido WHERE id=?',[idDetalle]); }
            }else{
                const nuevaCant = Number(detalle.cantidad)-cantCancelar;
                const nuevoSub = nuevaCant * Number(detalle.precio_unitario);
                try{ await db.pool.query('UPDATE detalle_pedido SET cantidad=?, subtotal=? WHERE id_detalle=?',[nuevaCant, nuevoSub, idDetalle]); }catch(e){ await db.pool.query('UPDATE detalle_pedido SET cantidad=?, subtotal=? WHERE id=?',[nuevaCant, nuevoSub, idDetalle]); }
            }
            const [rest]=await db.pool.query('SELECT COUNT(*) as cnt FROM detalle_pedido WHERE id_pedido=?',[idPedido]);
            let mesaLiberada=false;
            if(rest[0].cnt===0){
                await db.pool.query('DELETE FROM pedidos WHERE id_pedido=?',[idPedido]);
                const [otros]=await db.pool.query("SELECT COUNT(*) as cnt FROM pedidos WHERE id_mesa=? AND estado='Pendiente'",[detalle.id_mesa]);
                if(otros[0].cnt===0){ await db.pool.query("UPDATE mesas SET estado='Disponible', id_mesero=NULL, fecha_ocupacion=NULL WHERE id_mesa=?",[detalle.id_mesa]); mesaLiberada=true; }
            }else{
                const [sum]=await db.pool.query('SELECT COALESCE(SUM(cantidad*precio_unitario),0) as tot FROM detalle_pedido WHERE id_pedido=?',[idPedido]);
                await db.pool.query('UPDATE pedidos SET total=? WHERE id_pedido=?',[sum[0].tot, idPedido]);
            }
            res.json({success:true,mensaje:'Item anulado y auditado', mesaLiberada});
        }catch(e){ console.error('cancelar item',e.message); res.status(500).json({success:false,mensaje:e.message}); }
    });

    app.post('/api/mesas/:id/cancelar-item', bloquearAdminMesas, pinLimiter, async (req,res)=>{
        const idMesa=req.params.id;
        if (!(await exigirZonaBarra(req, res, idMesa))) return;
        const {id_detalle, id_pedido, id_producto, motivo, pin, id_usuario, motivo_personalizado, cantidad}=req.body;
        const idDet = id_detalle || id_producto;
        if(!idDet) return res.status(400).json({success:false,mensaje:'id_detalle o id_producto requerido'});
        req.params.idDetalle=idDet;
        req.body.motivo=motivo;
        req.body.motivo_personalizado=motivo_personalizado;
        req.body.pin=pin;
        req.body.id_usuario=id_usuario;
        req.body.cantidad=cantidad;
        const fakeReq={params:{idDetalle:idDet}, body:req.body, session:req.session};
        const fakeRes=res;
        try{
            let puede=false;
            const idSolicita=id_usuario || (req.session&&req.session.usuario&&req.session.usuario.id_usuario)||null;
            if(idSolicita) puede=await tienePermisoCanCancel(idSolicita);
            const isAdminSession = req.session && req.session.usuario && (Number(req.session.usuario.id_rol)===1 || String(req.session.usuario.rol).toLowerCase()==='administrador');
            if(!(puede||isAdminSession)){
                const okPin=await verificarPinMaestro(pin);
                if(!okPin){ await audit.auditFromReq(req,{usuario_id:idSolicita, tipo_evento:'PIN_FALLIDO', descripcion:`PIN fallido cancelar-item Mesa ${idMesa}`, motivo: pin||''}); return res.status(403).json({success:false,mensaje:'PIN Maestro inválido'}); }
            }
            const [jAct]=await db.pool.query("SELECT id_jornada FROM jornadas WHERE estado='Abierta' ORDER BY id_jornada DESC LIMIT 1");
            const idJornada=jAct.length? jAct[0].id_jornada: null;
            let detalle=null;
            try{
                const [rows]=await db.pool.query('SELECT dp.*, prod.nombre, p.id_mesa FROM detalle_pedido dp JOIN pedidos p ON dp.id_pedido=p.id_pedido LEFT JOIN productos prod ON dp.id_producto=prod.id_producto WHERE p.id_mesa=? AND p.estado="Pendiente" AND dp.id_producto=? LIMIT 1',[idMesa, id_producto||idDet]);
                if(rows.length) detalle=rows[0];
            }catch(e){}
            if(!detalle){
                const [rows2]=await db.pool.query('SELECT p.id_pedido, dp.id_producto, prod.nombre, dp.cantidad, dp.precio_unitario FROM pedidos p JOIN detalle_pedido dp ON p.id_pedido=dp.id_pedido LEFT JOIN productos prod ON dp.id_producto=prod.id_producto WHERE p.id_mesa=? AND p.estado="Pendiente" LIMIT 1',[idMesa]);
                if(rows2.length) detalle=rows2[0];
            }
            if(!detalle) return res.status(404).json({success:false,mensaje:'Item no encontrado en mesa'});
            await registrarAuditoriaCancel({idJornada, motivo: motivo||motivo_personalizado||'Anulación', idSolicita: id_usuario, idAutoriza: id_usuario, items:[detalle], mesaId:idMesa, req});
            const ml=String(motivo||'').toLowerCase();
            const requiereMerma3 = ml.indexOf('no disponible')!==-1 || ml.indexOf('merma')!==-1 || ml.indexOf('venc')!==-1 || ml.indexOf('derrame')!==-1 || ml.indexOf('rotur')!==-1;
            if(requiereMerma3) await crearMermaPorCancel(detalle, motivo, id_usuario);
            else await revertirStockCancel(detalle.id_producto, detalle.cantidad);
            try{ await db.pool.query('DELETE FROM detalle_pedido WHERE id_pedido=? AND id_producto=? LIMIT 1',[detalle.id_pedido, detalle.id_producto]); }catch(e){ await db.pool.query('DELETE FROM detalle_pedido WHERE id_pedido=? LIMIT 1',[detalle.id_pedido]); }
            res.json({success:true,mensaje:'Item cancelado'});
        }catch(e){ res.status(500).json({success:false,mensaje:e.message}); }
    });
};
