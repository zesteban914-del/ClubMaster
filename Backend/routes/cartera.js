module.exports = function(app, db) {
    const audit = require('../services/audit-service');
    const { requierePermiso } = require('../middlewares/authMiddleware');
    const cobrar = requierePermiso('cobrar_cuentas');
    app.get('/api/socios', async (req, res) => {
        try {
            const socios = await db.obtenerClientesSocios();
            res.json({ success: true, socios });
        } catch (error) {
            res.status(500).json({ success: false, mensaje: 'Error al obtener socios: ' + error.message });
        }
    });

    app.post('/api/socios', async (req, res) => {
        const { nombre } = req.body;
        if (!nombre) return res.status(400).json({ success: false, mensaje: 'El nombre es obligatorio' });
        try {
            const r = await db.crearClienteSocio(req.body);
            res.json({ success: true, mensaje: 'Socio creado correctamente', idCliente: r.id_cliente });
        } catch (error) {
            res.status(500).json({ success: false, mensaje: 'Error al crear socio: ' + error.message });
        }
    });

    app.put('/api/socios/:id', async (req, res) => {
        const { nombre } = req.body;
        if (!nombre) return res.status(400).json({ success: false, mensaje: 'El nombre es obligatorio' });
        try {
            await db.actualizarClienteSocio(req.params.id, req.body);
            res.json({ success: true, mensaje: 'Socio actualizado correctamente' });
        } catch (error) {
            res.status(500).json({ success: false, mensaje: 'Error al actualizar socio: ' + error.message });
        }
    });

    app.put('/api/socios/:id/estado', async (req, res) => {
        const { activo } = req.body;
        try {
            await db.toggleClienteSocio(req.params.id, activo);
            res.json({ success: true, mensaje: activo ? 'Socio activado' : 'Socio desactivado' });
        } catch (error) {
            res.status(500).json({ success: false, mensaje: 'Error: ' + error.message });
        }
    });

    app.get('/api/cartera/resumen', async (req, res) => {
        try {
            const resumen = await db.resumenCartera();
            res.json({ success: true, ...resumen });
        } catch (error) {
            res.status(500).json({ success: false, mensaje: 'Error al obtener cartera: ' + error.message });
        }
    });

    app.post('/api/vales/crear', cobrar, async (req, res) => {
        const { cliente_socio, id_mesa, total, id_usuario, id_cajero, id_usuario_registra, id_mesero, id_cliente_socio, fecha_vencimiento, tipo_mora, tasa_mora, referencia } = req.body;
        if ((!cliente_socio && !id_cliente_socio) || !total) {
            return res.status(400).json({ success: false, mensaje: 'Faltan datos: cliente/socio y total son obligatorios' });
        }
        // Cajero = quien procesa la venta (no se confía el body, se toma de la sesión)
        const ses = req.session && req.session.usuario;
        const cajeroId = Number(ses?.id_usuario || req.user?.id || id_cajero || id_usuario_registra || id_usuario);
        if (!cajeroId) return res.status(401).json({ success: false, mensaje: 'No se pudo identificar al cajero (sesión).' });
        const meseroId = id_mesero != null && String(id_mesero).trim() !== '' ? Number(id_mesero) : null;
        if (!meseroId) return res.status(400).json({ success: false, mensaje: 'Debe seleccionar un mesero responsable (id_mesero).' });
        try {
            const [meseroCheck] = await db.pool.query(
                "SELECT u.id_usuario FROM usuarios u LEFT JOIN roles r ON u.id_rol=r.id_rol WHERE u.id_usuario=? AND u.activo=1 AND (LOWER(r.nombre) LIKE '%meser%' OR u.id_rol=3) LIMIT 1",
                [meseroId]
            );
            if (!meseroCheck.length) return res.status(400).json({ success: false, mensaje: 'El mesero seleccionado no existe o no tiene rol mesero.' });
        } catch (e) { console.warn('[vales/crear] validación mesero omitida:', e.message); }
        if (id_cliente_socio) {
            try {
                const [socio] = await db.pool.query('SELECT limite_credito FROM clientes_socios WHERE id_cliente = ?', [id_cliente_socio]);
                if (socio.length > 0) {
                    const [deuda] = await db.pool.query(
                        'SELECT COALESCE(SUM(saldo_pendiente),0) AS s FROM cuentas_por_cobrar WHERE id_cliente_socio = ? AND saldo_pendiente > 0',
                        [id_cliente_socio]
                    );
                    const limite = Number(socio[0].limite_credito) || 0;
                    if (limite > 0 && (Number(deuda[0].s) + Number(total)) > limite) {
                        return res.status(400).json({ success: false, mensaje: 'Supera el limite de credito del socio ($' + limite.toLocaleString() + ')' });
                    }
                }
            } catch (e) {}
        }
        try {
            const resultado = await db.crearVale(cliente_socio, id_mesa, total, cajeroId, {
                id_cliente_socio, fecha_vencimiento, tipo_mora, tasa_mora, referencia,
                id_mesero: meseroId, id_cajero: cajeroId, id_usuario_registra: cajeroId
            });
            await audit.auditFromReq(req, { usuario_id: cajeroId, tipo_evento: 'VALE_CREADO', descripcion: `Vale ${resultado.id_vale} creado cliente ${cliente_socio || id_cliente_socio} total ${total} mesero ${meseroId} cajero ${cajeroId}`, motivo: `monto ${total} referencia ${referencia || ''}`, mesa_id: id_mesa || null });
            res.json({ success: true, mensaje: 'Vale registrado correctamente', idVale: resultado.id_vale });
        } catch (error) {
            res.status(500).json({ success: false, mensaje: 'Error al crear vale: ' + error.message });
        }
    });

    app.get('/api/vales/pendientes', async (req, res) => {
        try {
            const vales = await db.valesPendientes();
            const totalPendiente = vales.reduce((acc, v) => acc + Number(v.saldo_pendiente), 0);
            res.json({ success: true, vales, total_pendiente: totalPendiente });
        } catch (error) {
            res.status(500).json({ success: false, mensaje: 'Error al obtener vales: ' + error.message });
        }
    });

    app.post('/api/vales/:id/abonar', cobrar, async (req, res) => {
        const { id } = req.params;
        const { monto, metodo_pago, sub_metodo_pago, referencia, id_usuario, id_jornada } = req.body;
        if (!monto || Number(monto) <= 0) {
            return res.status(400).json({ success: false, mensaje: 'El monto del abono debe ser mayor a 0' });
        }
        try {
            const resultado = await db.abonarVale(id, monto, {
                metodo_pago, sub_metodo_pago, referencia, id_usuario, id_jornada
            });
            const jornada = id_jornada || (await db.obtenerJornadaActiva() || {}).id_jornada;
            if (jornada && (resultado.monto_capital > 0 || resultado.monto_mora > 0)) {
                await db.registrarIngresoAbonoCaja(jornada, id, resultado.monto_capital, resultado.monto_mora, id_usuario, metodo_pago);
            }
            await audit.auditFromReq(req, { usuario_id: id_usuario, tipo_evento: 'VALE_ABONADO', descripcion: `Abono vale ${id} monto ${monto} metodo ${metodo_pago || ''}`, motivo: `referencia ${referencia || ''} jornada ${jornada || ''}`, mesa_id: null });
            res.json({ success: true, mensaje: 'Abono registrado correctamente', ...resultado });
        } catch (error) {
            const m = error.message || '';
            if (/supera el total pendiente|ya esta liquidado/i.test(m)) return res.status(400).json({ success: false, mensaje: m });
            if (/no encontrado/i.test(m)) return res.status(404).json({ success: false, mensaje: m });
            res.status(500).json({ success: false, mensaje: 'Error al abonar vale: ' + m });
        }
    });

    app.post('/api/vales/:id/liquidar', cobrar, async (req, res) => {
        const { id } = req.params;
        const { metodo_pago, sub_metodo_pago, referencia, id_usuario, id_jornada } = req.body;
        try {
            const resultado = await db.liquidarVale(id, {
                metodo_pago, sub_metodo_pago, referencia, id_usuario, id_jornada
            });
            const jornada = id_jornada || (await db.obtenerJornadaActiva() || {}).id_jornada;
            if (jornada && (resultado.monto_capital > 0 || resultado.monto_mora > 0)) {
                await db.registrarIngresoAbonoCaja(jornada, id, resultado.monto_capital, resultado.monto_mora, id_usuario, metodo_pago);
            }
            await audit.auditFromReq(req, { usuario_id: id_usuario, tipo_evento: 'VALE_LIQUIDADO', descripcion: `Vale ${id} liquidado total ${resultado.monto_total} metodo ${metodo_pago || ''}`, motivo: `referencia ${referencia || ''} jornada ${jornada || ''}`, mesa_id: null });
            res.json({ success: true, mensaje: 'Vale liquidado correctamente', ...resultado });
        } catch (error) {
            res.status(500).json({ success: false, mensaje: 'Error al liquidar vale: ' + error.message });
        }
    });

    app.post('/api/vales/:id/exonerar-mora', cobrar, async (req, res) => {
        const { id } = req.params;
        const { exonerar, id_usuario } = req.body;
        try {
            const totp = require('../middlewares/totp');
            const idU = id_usuario || (req.session && req.session.usuario && req.session.usuario.id_usuario) || null;
            if (!idU) return res.status(401).json({ success: false, mensaje: 'id_usuario requerido para exonerar vales' });
            if (!await totp.isTotpEnabledForUser(db.pool, idU)) return res.status(403).json({ success: false, needEnroll: true, mensaje: 'Exonerar vales exige 2FA activo: enrole con POST /api/2fa/setup + /api/2fa/enable y reintente con totp_code' });
            const v = await totp.verifyCodeForUser(db.pool, idU, totp.getCode(req));
            if (!v.ok) return res.status(403).json({ success: false, mensaje: 'Se requiere codigo TOTP valido para exonerar vales' });
            const r = await db.exonerarMoraVale(id, exonerar, id_usuario);
            await audit.auditFromReq(req, { usuario_id: id_usuario, tipo_evento: 'VALE_EXONERADO', descripcion: `Vale ${id} ${exonerar ? 'mora exonerada' : 'mora re-activada'} por usuario ${id_usuario || ''}`, motivo: `exonerar=${!!exonerar}`, mesa_id: null });
            res.json({ success: true, mensaje: exonerar ? 'Mora exonerada para este vale' : 'Mora re-activada', ...r });
        } catch (error) {
            res.status(500).json({ success: false, mensaje: 'Error: ' + error.message });
        }
    });

    app.get('/api/vales/:id/abonos', async (req, res) => {
        try {
            const abonos = await db.obtenerAbonosVale(req.params.id);
            res.json({ success: true, abonos });
        } catch (error) {
            res.status(500).json({ success: false, mensaje: 'Error: ' + error.message });
        }
    });

    app.get('/api/vales/:id/pagare', async (req, res) => {
        try {
            const id = req.params.id;
            const [vale] = await db.pool.query('SELECT * FROM cuentas_por_cobrar WHERE id_vale = ?', [id]);
            if (vale.length === 0) return res.status(404).json({ success: false, mensaje: 'Vale no encontrado' });
            const v = vale[0];
            const moraCalc = await db.calcularMoraVale(v, null);
            const abonos = await db.obtenerAbonosVale(id);
            res.json({
                success: true,
                pagare: {
                    id_vale: v.id_vale,
                    cliente_socio: v.cliente_socio,
                    documento: null,
                    total: Number(v.total),
                    saldo_pendiente: Number(v.saldo_pendiente),
                    mora_pendiente: moraCalc.mora,
                    dias_mora: moraCalc.dias_mora,
                    capital_pagado: Number(v.capital_pagado || 0),
                    mora_pagada: Number(v.mora_pagada || 0),
                    fecha: v.fecha,
                    fecha_vencimiento: v.fecha_vencimiento,
                    estado: v.estado,
                    referencia: v.referencia,
                    abonos: abonos
                }
            });
        } catch (error) {
            res.status(500).json({ success: false, mensaje: 'Error al generar pagare: ' + error.message });
        }
    });
};
