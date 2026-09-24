// =========================================================
// whatsapp.js - Rutas para envio de reportes por WhatsApp
// POST /api/reportes/enviar-whatsapp
// GET  /api/whatsapp/config
// PUT  /api/whatsapp/config
// GET  /api/whatsapp/logs
// GET  /api/whatsapp/status
// =========================================================
const whatsappService = require('../services/whatsapp-service');
const reportGen = require('../utils/report-generator');

function parseFiltros(q){
    const f={};
    const re=/^\d{4}-\d{2}-\d{2}$/;
    if(q.fecha_inicio){ if(!re.test(q.fecha_inicio)) return {error:'fecha_inicio inválida, use YYYY-MM-DD'}; f.fecha_inicio=q.fecha_inicio; }
    if(q.fecha_fin){ if(!re.test(q.fecha_fin)) return {error:'fecha_fin inválida, use YYYY-MM-DD'}; f.fecha_fin=q.fecha_fin; }
    if(f.fecha_inicio && f.fecha_fin && f.fecha_inicio>f.fecha_fin) return {error:'Rango invertido: fecha_inicio mayor que fecha_fin'};
    if(f.fecha_inicio && f.fecha_fin){ var dias=(new Date(f.fecha_fin)-new Date(f.fecha_inicio))/86400000; if(dias>366) return {error:'Rango máximo permitido: 366 días, refine los filtros'}; }
    if(q.id_jornada!==undefined && q.id_jornada!=='' && q.id_jornada!==null){ if(!/^\d+$/.test(String(q.id_jornada))||parseInt(q.id_jornada,10)<=0) return {error:'id_jornada debe ser entero positivo sin decimales'}; f.id_jornada=parseInt(q.id_jornada,10); }
    if(q.id_mesero!==undefined && q.id_mesero!=='' && q.id_mesero!==null){ if(!/^\d+$/.test(String(q.id_mesero))||parseInt(q.id_mesero,10)<=0) return {error:'id_mesero debe ser entero positivo sin decimales'}; f.id_mesero=parseInt(q.id_mesero,10); }
    if(!f.fecha_inicio && !f.fecha_fin){ var hoy=new Date(); var ini=new Date(); ini.setDate(hoy.getDate()-30); f.fecha_inicio=ini.toISOString().split('T')[0]; f.fecha_fin=hoy.toISOString().split('T')[0]; f._defecto=true; }
    return {filtros:f};
}

async function cargarDatosReporte(db, cat, id, filtros){
    let data={};
    if(cat==='folio' && id==='folio_familias') data.familias=await db.reporteFamilias(filtros);
    else if(cat==='folio' && id==='folio_descuentos') data=await db.reporteDescuentos(filtros);
    else if(cat==='folio' && id==='folio_nocturna') data.nocturna=await db.reporteNocturna(filtros);
    else if(cat==='folio' && id==='folio_retiros') data=await db.reporteRetiros(filtros);
    else if(cat==='folio' && id==='folio_impuestos') data.impuestos=await db.reporteImpuestos(filtros);
    else if(cat==='folio' && id==='folio_propinas') data=await db.reportePropinas(filtros);
    else if(cat==='folio' && id==='folio_pago'){ const g=await db.reporteVentasGeneral(filtros); data={desglose:g.desglose_metodos, kpis:g.kpis}; }
    else if(cat==='folio' && id==='folio_zonas'){ const pz=await db.reportePersonalZonas(filtros); data={zonas:pz.zonas}; }
    else if(cat==='ticket' && id==='ticket_minimos'){ const inv=await db.reporteStock(); data.bajoMinimos=inv.detalle.filter(p=> p.stock<=p.minimo && p.minimo>0); }
    else if(cat==='ticket' && id==='ticket_resumido'){ data=await db.reporteVentasGeneral(filtros); }
    else if(cat==='ticket' && id==='ticket_empleado'){ const det=await db.reporteTicketEmpleadoDetallado(filtros); data={meseros:det.meseros, zonas:det.zonas, detallePorMesero:det.detallePorMesero, totalesGenerales:det.totalesGenerales}; }
    else if(cat==='ticket' && id==='ticket_barra'){ const pz=await db.reportePersonalZonas(filtros); let tiempos=[]; try{ tiempos=await db.tiemposBarra(); }catch(e){ tiempos=[]; } data={zonas:pz.zonas, tiempos:tiempos.slice(0,50)}; }
    else if(cat==='ticket' && id==='ticket_anuladas'){ const aud=await db.reporteAuditoria(filtros); data.anuladas=aud.logs.filter(l=> l.tipo==='CANCELACION_PEDIDO'||l.tipo==='ANULACION_ITEM'); }
    else if(cat==='ticket' && id==='ticket_cierres'){ let j=[]; try{ const [rows]=await db.pool.query(`SELECT id_jornada, COALESCE(fecha_apertura, fecha, NOW()) AS fecha_apertura, fecha_cierre, estado, COALESCE(monto_inicial,0) AS monto_inicial, COALESCE(total_efectivo_esperado,0) AS total_efectivo_esperado, COALESCE(total_efectivo_real,0) AS total_efectivo_real, COALESCE(diferencia,0) AS diferencia FROM jornadas ORDER BY id_jornada DESC LIMIT 20`); j=rows; }catch(e){ try{ const [rows2]=await db.pool.query(`SELECT id_jornada, fecha_apertura, estado, monto_inicial FROM jornadas ORDER BY id_jornada DESC LIMIT 20`); j=rows2.map(r=>({id_jornada:r.id_jornada, fecha_apertura:r.fecha_apertura, fecha_cierre:null, estado:r.estado, monto_inicial:r.monto_inicial, total_efectivo_esperado:0, total_efectivo_real:0, diferencia:0})); }catch(e2){ j=[]; }} data.cierres=j; }
    else if(cat==='ticket' && id==='reimprimir'){ data=await db.reporteContableFacturas(filtros); }
    else if(cat==='auditoria' && id==='aud_descuentos') data=await db.reporteDescuentos(filtros);
    else if(cat==='auditoria' && id==='aud_cajon') data.cajon=await db.reporteCajon(filtros);
    else if(cat==='auditoria' && id==='aud_eliminadas'){ const aud=await db.reporteAuditoria(filtros); data.eliminadas=aud.logs.filter(l=>['CANCELACION_PEDIDO','ANULACION_ITEM'].includes(l.tipo)); }
    else if(cat==='auditoria' && id==='aud_turnos'){ const turnos=require('../services/turnos-service'); const rep=await turnos.reporteHorasPorEmpleado({fecha_inicio:filtros.fecha_inicio, fecha_fin:filtros.fecha_fin, id_usuario:filtros.id_mesero}); data={reporte:rep}; }
    else if(cat==='auditoria' && id==='aud_horario') data.horario=await db.reporteHorario(filtros);
    else if(cat==='auditoria' && id==='aud_empleado'){ data.personal=await db.reportePersonalZonas(filtros); data.auditoria=await db.reporteAuditoria(filtros); }
    else if(cat==='contable' && id==='cont_facturas') data.facturas=await db.reporteContableFacturas(filtros);
    else if(cat==='contable' && id==='cont_impuestos') data.impuestos=await db.reporteImpuestos(filtros);
    else if(cat==='contable' && id==='cont_gastos') data.gastos=await db.reporteContableGastos(filtros);
    else if(cat==='contable' && id==='cont_stock') data.stock=await db.reporteStock();
    else data=await db.reporteVentasGeneral(filtros);
    return data;
}

module.exports = function(app, db){
    // 3. VALIDACIÓN DE SESIÓN / CREDENCIALES - ruta para verificar si cliente está conectado o requiere QR
    // GET /api/whatsapp/status -> verifica instanceId/token y estado de sesión
    app.get('/api/whatsapp/status', async (req,res)=>{
        try{
            // getStatusDetailed verifica en vivo contra API del proveedor y loguea RAW
            let detailed;
            try{
                detailed = await whatsappService.getStatusDetailed();
            } catch(e){
                console.error('[WhatsApp][status] getStatusDetailed fallo, fallback a getStatus:', e.message);
                detailed = whatsappService.getStatus();
            }
            // Log detallado para debugging
            console.log('[WhatsApp][STATUS]', JSON.stringify(detailed, null, 2));
            res.json({ success:true, ...detailed });
        }catch(e){
            console.error('[WhatsApp][status] error:', e);
            res.status(500).json({ success:false, mensaje:e.message, message:e.message });
        }
    });

    app.get('/api/whatsapp/config', async (req,res)=>{
        try{
            const cfg = whatsappService.getConfig();
            const status = whatsappService.getStatus();
            // No exponer tokens - solo mostrar si están configurados
            res.json({ success:true, provider: cfg.provider, adminPhone: cfg.adminPhone || '', configured: status.configured });
        }catch(e){ res.status(500).json({ success:false, mensaje:e.message }); }
    });

    // Ruta específica para Baileys/whatsapp-web.js: verificar QR y sesión
    app.get('/api/whatsapp/qr', async (req,res)=>{
        try{
            const detailed = await whatsappService.getStatusDetailed();
            res.json({
                success:true,
                provider: detailed.provider,
                connected: detailed.session?.connected || false,
                needsQr: detailed.session?.needsQr || false,
                qrAvailable: detailed.session?.details?.qrExists || false,
                error: detailed.session?.error || null,
                details: detailed.session?.details || null,
                message: detailed.session?.connected ? 'Cliente conectado' : (detailed.session?.needsQr ? 'Requiere escanear QR' : 'Desconectado')
            });
        }catch(e){ res.status(500).json({ success:false, mensaje:e.message }); }
    });

    // Ruta de diagnóstico completo (útil para debugging silencioso)
    app.get('/api/whatsapp/diagnose', async (req,res)=>{
        try{
            const cfg = whatsappService.getConfig();
            const detailed = await whatsappService.getStatusDetailed();
            const logs = whatsappService.obtenerLogs(5);
            res.json({
                success:true,
                config: { provider: cfg.provider, hasAdminPhone: !!cfg.adminPhone, defaultCountryCode: cfg.defaultCountryCode, ultramsgInstance: cfg.ultramsgInstance ? '***'+cfg.ultramsgInstance.slice(-4) : null, greenInstance: cfg.greenInstance ? '***'+cfg.greenInstance.slice(-4) : null, twilioSid: cfg.twilioSid ? '***'+cfg.twilioSid.slice(-4) : null },
                status: detailed,
                recentLogs: logs,
                tempCheck: (()=>{ try{ const p=require('path'); const fs=require('fs'); const tempDir=p.join(__dirname,'..','temp','whatsapp'); return { tempDir, exists: fs.existsSync(tempDir), files: fs.existsSync(tempDir) ? fs.readdirSync(tempDir).slice(0,5) : [] }; }catch(e){ return {error:e.message}; }})()
            });
        }catch(e){ res.status(500).json({ success:false, mensaje:e.message }); }
    });

    // Solo admin puede guardar config admin phone (opcional: persistir en env no es persistente, pero mostramos)
    app.put('/api/whatsapp/config', async (req,res)=>{
        try{
            const { adminPhone } = req.body || {};
            if (adminPhone){
                const norm = whatsappService.normalizarTelefono(adminPhone, whatsappService.getConfig().defaultCountryCode);
                if (!norm) return res.status(400).json({ success:false, mensaje:'Número admin inválido' });
                process.env.WHATSAPP_ADMIN_PHONE = norm;
            }
            res.json({ success:true, adminPhone: process.env.WHATSAPP_ADMIN_PHONE || '', mensaje:'Configuración actualizada en memoria (defina WHATSAPP_ADMIN_PHONE en .env para persistir)' });
        }catch(e){ res.status(500).json({ success:false, mensaje:e.message }); }
    });

    app.get('/api/whatsapp/logs', async (req,res)=>{
        try{
            const lim = Math.min(100, parseInt(req.query.limit||'20')||20);
            const logs = whatsappService.obtenerLogs(lim);
            res.json({ success:true, logs });
        }catch(e){ res.status(500).json({ success:false, mensaje:e.message }); }
    });

    // Endpoint principal POST /api/reportes/enviar-whatsapp registrado en routes/reportes.js
    // via router.post('/reportes/enviar-whatsapp', reportesController.enviarWhatsApp) montado bajo /api.
    // Se mantiene referencia para compatibilidad pero sin duplicar registro (evita handler duplicado).
    // Si se requiere alias adicional, descomentar:
    // const reportesController = require('../controllers/reportesController');
    // app.post('/api/reportes/enviar-whatsapp', reportesController.enviarWhatsApp);

    // Endpoint de descarga directa (opcional, para vista previa sin WhatsApp)
    app.get('/api/reportes/descargar', async (req,res)=>{
        try{
            const cat = req.query.cat, id = req.query.id;
            if(!cat || !id) return res.status(400).json({success:false,mensaje:'cat e id requeridos'});
            const fmt = String(req.query.formato||'pdf').toLowerCase();
            if(['pdf','excel','xlsx'].indexOf(fmt)===-1) return res.status(400).json({success:false,mensaje:'formato pdf o excel'});
            const formatoNorm = fmt==='xlsx'?'excel':fmt;
            const r = parseFiltros(req.query);
            if(r.error) return res.status(400).json({success:false,mensaje:r.error});
            const f = r.filtros;
            const data = await cargarDatosReporte(db, cat, id, f);
            const reportData = { filtros:f, cat, id, data };
            let file;
            if(formatoNorm==='pdf') file= await reportGen.generarPDF({cat,id,filtros:f,reportData});
            else file= await reportGen.generarExcel({cat,id,filtros:f,reportData});
            res.setHeader('Content-Type', file.mimeType);
            res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
            res.send(file.buffer);
        }catch(e){ console.error('descargar error',e.message); res.status(500).json({success:false,mensaje:e.message}); }
    });
};
