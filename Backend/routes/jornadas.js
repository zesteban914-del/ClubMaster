module.exports = function(app, db) {
    const audit = require('../services/audit-service');
    const mailer = require('../config/mailer');
    const { requireTotpForHighRisk } = require('../middlewares/totp');
    const { soloCajaOperativa } = require('../middlewares/authMiddleware');
    const totpHighRisk = requireTotpForHighRisk(db.pool);
    app.get('/api/jornada/activa', async (req, res) => {
        try {
            const jornada = await db.obtenerJornadaActiva();
            if (!jornada) {
                return res.json({ success: true, jornada: null, resumen: null });
            }
            const resumen = await db.obtenerResumenJornadaCompleto(db.pool, jornada.id_jornada);

            const [nombres] = await db.pool.query(
                'SELECT u.nombre AS usuario_apertura FROM usuarios u WHERE u.id_usuario = ?',
                [jornada.id_usuario]
            );
            jornada.usuario_apertura = nombres.length > 0 ? nombres[0].usuario_apertura : '';
            try { const [c] = await db.pool.query("SHOW COLUMNS FROM jornadas LIKE 'barra_asignada'"); if(c.length===0) await db.pool.query("ALTER TABLE jornadas ADD COLUMN barra_asignada VARCHAR(80) NULL DEFAULT 'Caja Principal'"); } catch(e) {}

            res.json({ success: true, jornada, resumen });
        } catch (error) {
            console.error('Error al consultar jornada activa:', error.message);
            res.status(500).json({ success: false, mensaje: 'Error al consultar jornada: ' + error.message });
        }
    });

    app.post('/api/jornada/abrir', soloCajaOperativa, totpHighRisk, async (req, res) => {
        const { monto_inicial, monto_base, id_usuario, id_caja, incluir_propina_caja, arqueo_ciego, barra_asignada } = req.body;
        const montoVal = (monto_inicial != null ? monto_inicial : monto_base);
        if (montoVal == null || !id_usuario) {
            return res.status(400).json({ success: false, mensaje: 'Faltan parametros obligatorios: monto_base (monto_inicial), id_usuario, id_caja/barra_asignada' });
        }

        try {
            const existe = await db.obtenerJornadaActiva();
            if (existe) {
                return res.status(400).json({ success: false, mensaje: 'Ya existe una jornada abierta. Cierre la jornada actual antes de abrir una nueva.' });
            }
            const idCajaVal = id_caja || barra_asignada || 'Caja Principal';
            const resultado = await db.abrirJornada(Number(montoVal), id_usuario, incluir_propina_caja, arqueo_ciego, idCajaVal);
            await audit.auditFromReq(req,{usuario_id:id_usuario, tipo_evento:'APERTURA_CAJA', descripcion:`Apertura jornada ${resultado.id_jornada} barra ${idCajaVal||'Caja Principal'} monto ${montoVal}`, motivo:'apertura caja'});
            res.json({ success: true, mensaje: 'Jornada abierta correctamente', id_jornada: resultado.id_jornada });
        } catch (error) {
            console.error('Error al abrir jornada:', error.message);
            res.status(500).json({ success: false, mensaje: 'Error al abrir jornada: ' + error.message });
        }
    });

    app.post('/api/jornada/revisar-arqueo', soloCajaOperativa, async (req, res) => {
        const { id_jornada, arqueo, incluir_propina_caja } = req.body;
        if (!id_jornada || !Array.isArray(arqueo)) {
            return res.status(400).json({ success: false, mensaje: 'Faltan datos: id_jornada y desglose del arqueo son obligatorios' });
        }
        try {
            const reporte = await db.calcularYGuardarArqueo(id_jornada, arqueo, incluir_propina_caja, null, true);
            res.json({ success: true, ...reporte });
        } catch (error) {
            console.error('Error al revisar arqueo:', error.message);
            res.status(500).json({ success: false, mensaje: 'Error al revisar arqueo: ' + error.message });
        }
    });

    app.post('/api/jornada/cerrar', soloCajaOperativa, totpHighRisk, async (req, res) => {
        const { id_jornada, arqueo, incluir_propina_caja, id_usuario_cierre } = req.body;

        if (!id_jornada || !Array.isArray(arqueo)) {
            return res.status(400).json({ success: false, mensaje: 'Faltan datos: id_jornada y desglose monetario del arqueo son obligatorios' });
        }

        try {
            const conteoFisico = arqueo.reduce(function(acc, l) {
                return acc + (Number(l.cantidad) || 0) * (Number(l.valor || l.denominacion) || 0);
            }, 0);
            if (conteoFisico < 0) {
                return res.status(400).json({ success: false, mensaje: 'El conteo fisico no puede ser negativo' });
            }
            const reporte = await db.calcularYGuardarArqueo(id_jornada, arqueo, incluir_propina_caja, id_usuario_cierre, false);
            await audit.auditFromReq(req,{usuario_id:id_usuario_cierre, tipo_evento:'CIERRE_CAJA', descripcion:`Cierre jornada ${id_jornada} diferencia ${reporte.diferencia||0}`, motivo:'cierre caja'});
            // Backup automático + Email resumen (no bloquea respuesta)
            setImmediate(async()=>{
              try{
                const generar = app.generarBackupCierre || global.generarBackupCierre;
                if(generar) await generar(id_jornada);
                else {
                  const poolBackup = db.pool || require('../config/database').pool;
                  console.log(`Backup cierre #${id_jornada} solicitado (sin generador)`);
                }
              }catch(e){ console.error('Backup cierre error',e.message); }
              try{
                let dest=null;
                try{
                  const [admins]=await db.pool.query(`SELECT correo FROM usuarios WHERE id_rol=1 AND activo=1 AND correo IS NOT NULL AND correo!='' LIMIT 1`);
                  dest = admins[0]?.correo || null;
                }catch(e){}
                dest = dest || process.env.ADMIN_EMAIL || process.env.EMAIL_USER || process.env.SMTP_USER;
                if(dest){
                  const rpt = await db.obtenerReporteJornada(id_jornada);
                  const finalRpt = rpt || reporte;
                  await mailer.enviarReporteCierre(dest, finalRpt);
                  console.log(`Reporte cierre #${id_jornada} enviado a ${dest}`);
                } else {
                  console.warn('Sin destinatario para reporte cierre');
                }
              }catch(e){ console.error('Email reporte cierre error',e.message); }
            });
            res.json({ success: true, ...reporte, mensaje: 'Jornada cerrada correctamente. Backup y reporte en proceso.' });
        } catch (error) {
            console.error('Error al cerrar jornada:', error.message);
            res.status(500).json({ success: false, mensaje: 'Error al cerrar jornada: ' + error.message });
        }
    });

    app.get('/api/jornadas/cerradas', async (req, res) => {
        const limite = parseInt(req.query.limite) || 50;
        const offset = parseInt(req.query.offset) || 0;
        try {
            const [jornadas] = await db.pool.query(`
                SELECT j.*,
                       COALESCE(ua.nombre, '') AS usuario_apertura,
                       COALESCE(uc.nombre, '') AS usuario_cierre
                FROM jornadas j
                LEFT JOIN usuarios ua ON j.id_usuario = ua.id_usuario
                LEFT JOIN usuarios uc ON j.id_usuario_cierre = uc.id_usuario
                WHERE j.estado = 'Cerrada'
                ORDER BY j.fecha_cierre DESC
                LIMIT ? OFFSET ?
            `, [limite, offset]);
            const [totalRows] = await db.pool.query(
                "SELECT COUNT(*) AS total FROM jornadas WHERE estado = 'Cerrada'"
            );
            res.json({ success: true, jornadas, total: totalRows[0].total });
        } catch (error) {
            console.error('Error al obtener historial de jornadas:', error.message);
            res.status(500).json({ success: false, mensaje: 'Error al obtener historial: ' + error.message });
        }
    });

    app.get('/api/jornada/:id/reporte', async (req, res) => {
        try {
            const reporte = await db.obtenerReporteJornada(req.params.id);
            if (!reporte) {
                return res.status(404).json({ success: false, mensaje: 'Jornada no encontrada' });
            }
            res.json({ success: true, ...reporte });
        } catch (error) {
            console.error('Error al obtener reporte de jornada:', error.message);
            res.status(500).json({ success: false, mensaje: 'Error al obtener reporte: ' + error.message });
        }
    });

    app.get('/api/movimientos-caja', async (req, res) => {
        const { id_jornada } = req.query;
        if (!id_jornada) {
            return res.status(400).json({ success: false, mensaje: 'El id de la jornada es obligatorio' });
        }
        try {
            const movimientos = await db.obtenerMovimientosCaja(db.pool, id_jornada);
            const totalIngresos = movimientos.filter(function(m) { return m.tipo === 'Ingreso'; })
                .reduce(function(acc, m) { return acc + Number(m.monto || 0); }, 0);
            const totalEgresos = movimientos.filter(function(m) { return m.tipo === 'Egreso'; })
                .reduce(function(acc, m) { return acc + Number(m.monto || 0); }, 0);
            res.json({ success: true, movimientos, total_ingresos: totalIngresos, total_egresos: totalEgresos });
        } catch (error) {
            console.error('Error al obtener movimientos de caja:', error.message);
            res.status(500).json({ success: false, mensaje: 'Error al obtener movimientos: ' + error.message });
        }
    });

    app.post('/api/movimientos-caja', soloCajaOperativa, async (req, res) => {
        const { id_jornada, tipo, categoria, concepto, monto, comprobante, justificacion, id_usuario } = req.body;
        if (!id_jornada || !tipo || !monto || Number(monto) < 0) {
            return res.status(400).json({ success: false, mensaje: 'Faltan datos: jornada, tipo y monto valido son obligatorios' });
        }
        if (['Ingreso', 'Egreso'].indexOf(tipo) === -1) {
            return res.status(400).json({ success: false, mensaje: 'Tipo invalido. Use Ingreso o Egreso' });
        }
        try {
            const resultado = await db.crearMovimientoCaja({
                id_jornada, tipo, categoria: categoria || 'General', concepto,
                monto: Number(monto), numero_comprobante: comprobante, justificacion, id_usuario
            });
            const tipoEvt = tipo==='Ingreso' ? 'INGRESO_CAJA' : 'RETIRO_CAJA';
            await audit.auditFromReq(req,{usuario_id:id_usuario, tipo_evento:tipoEvt, descripcion:`${tipo} caja ${monto} cat ${categoria} concepto ${concepto||''} jornada ${id_jornada}`, motivo: justificacion||concepto||'', mesa_id:null});
            res.json({ success: true, mensaje: 'Movimiento registrado correctamente', idMovimiento: resultado.id_movimiento });
        } catch (error) {
            console.error('Error al registrar movimiento de caja:', error.message);
            res.status(500).json({ success: false, mensaje: 'Error al registrar movimiento: ' + error.message });
        }
    });

    app.get('/api/metodos-pago', async (req, res) => {
        try {
            const metodos = await db.obtenerMetodosPagoCatalogo();
            res.json({ success: true, metodos });
        } catch (error) {
            console.error('Error al obtener metodos de pago:', error.message);
            res.status(500).json({ success: false, mensaje: 'Error al obtener metodos: ' + error.message });
        }
    });
};
