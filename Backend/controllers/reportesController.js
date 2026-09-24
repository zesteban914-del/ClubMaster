// =========================================================
// reportesController.js - Controlador para envío por WhatsApp
// Implementa: router.post('/reportes/enviar-whatsapp', reportesController.enviarWhatsApp)
// Montado bajo /api => POST /api/reportes/enviar-whatsapp
// =========================================================
const fs = require('fs');
const path = require('path');
const whatsappService = require('../services/whatsapp-service');
const reportGen = require('../utils/report-generator');
const db = require('../database');

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

async function cargarDatosReporte(cat, id, filtros){
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

// Mapa inverso de títulos humanos -> cat:id (para tipoReporte con texto largo)
const TITULO_A_ID = {
    'gastos operativos de caja chica': 'contable:cont_gastos',
    'resumen contable de facturas': 'contable:cont_facturas',
    'valoración de stock': 'contable:cont_stock',
    'valoracion de stock': 'contable:cont_stock',
    'valoración de stock general en bodega y barras': 'contable:cont_stock',
    'ventas x empleado': 'ticket:ticket_empleado',
    'ventas formato ticket x empleado': 'ticket:ticket_empleado',
    'ventas x forma de pago': 'folio:folio_pago',
    'ventas x familias / categorías': 'folio:folio_familias',
    'ventas x zonas': 'folio:folio_zonas',
    'cierres de caja': 'ticket:ticket_cierres',
    'cierre de caja': 'ticket:ticket_cierres',
    'productos bajo mínimos': 'ticket:ticket_minimos',
    'ventas totales x día desglose impuestos': 'folio:folio_impuestos',
    'relación de propinas': 'folio:folio_propinas',
    'retiros parciales / vaciados de caja': 'folio:folio_retiros',
    'descuentos y cortesías': 'folio:folio_descuentos',
    'ventas generales x jornada nocturna': 'folio:folio_nocturna',
    'impuestos repercutidos': 'contable:cont_impuestos',
    'gastos operativos': 'contable:cont_gastos',
};

function resolverTipoReporte(tipoReporte){
    if(!tipoReporte) return null;
    let raw = String(tipoReporte).trim();
    if(!raw) return null;
    // Si ya viene como cat:id
    if(raw.includes(':')){
        let parts = raw.split(':');
        let cat = parts[0].toLowerCase().trim();
        let id = parts.slice(1).join(':').trim();
        if(cat && id) return {cat, id};
    }
    if(raw.includes('/')){
        let parts = raw.split('/');
        let cat = parts[0].toLowerCase().trim();
        let id = parts.slice(1).join('/').trim();
        if(cat && id) return {cat, id};
    }
    // Si es un id directo conocido (cont_gastos, folio_pago, etc.)
    const directId = raw.toLowerCase().trim();
    if(/^([a-z]+_)?[a-z_]+$/.test(directId)){
        // intentar inferir cat por prefijo
        if(directId.startsWith('cont_')) return {cat:'contable', id:directId};
        if(directId.startsWith('folio_')) return {cat:'folio', id:directId};
        if(directId.startsWith('ticket_') || directId==='reimprimir') return {cat:'ticket', id:directId};
        if(directId.startsWith('aud_')) return {cat:'auditoria', id:directId};
        // si es exactamente un id conocido, buscar en map
        // fallback: buscar si existe como id en alguna categoria
        const knownIds = ['cont_gastos','cont_facturas','cont_stock','cont_impuestos','folio_pago','folio_familias','folio_zonas','folio_impuestos','folio_retiros','folio_descuentos','folio_nocturna','folio_propinas','ticket_empleado','ticket_cierres','ticket_minimos','ticket_resumido','ticket_barra','ticket_anuladas','aud_turnos','aud_empleado','aud_descuentos','aud_cajon','aud_eliminadas','aud_horario'];
        if(knownIds.includes(directId)){
            if(directId.startsWith('cont_')) return {cat:'contable', id:directId};
            if(directId.startsWith('folio_')) return {cat:'folio', id:directId};
            if(directId.startsWith('ticket_')) return {cat:'ticket', id:directId};
            if(directId.startsWith('aud_')) return {cat:'auditoria', id:directId};
        }
    }
    // Si es título humano largo, buscar en mapa inverso (case-insensitive)
    let lower = raw.toLowerCase().trim();
    if(TITULO_A_ID[lower]){
        let mapped = TITULO_A_ID[lower];
        let parts = mapped.split(':');
        return {cat: parts[0], id: parts[1]};
    }
    // Búsqueda parcial por contiene
    for(let k in TITULO_A_ID){
        if(lower.includes(k) || k.includes(lower)){
            let mapped = TITULO_A_ID[k];
            let parts = mapped.split(':');
            return {cat: parts[0], id: parts[1]};
        }
    }
    // Último intento: si no se pudo resolver, devolver null
    return null;
}

/**
 * POST /api/reportes/enviar-whatsapp
 * Body esperado (según spec): { numero, formato, mensaje, tipoReporte, fechaInicio, fechaFin }
 * También soporta compatibilidad legacy:
 *   { numero|telefono, formato, mensaje|message, tipoReporte|reporte|cat:id, fechaInicio|fecha_inicio, fechaFin|fecha_fin, filtros, cat, id }
 */
async function enviarWhatsApp(req, res){
    // Asegurar siempre JSON (evitar 404 HTML => Unexpected token '<')
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
        const body = req.body || {};

        // Extraer campos con múltiples aliases (compatibilidad frontend v1 y spec v2)
        let numero = body.numero || body.telefono || body.phone || body.destino || body.whatsapp || body.tel || body.numeroDestino || '';
        let formato = body.formato || body.format || body.tipo || 'pdf';
        let mensaje = body.mensaje || body.message || body.texto || '';
        let tipoReporte = body.tipoReporte || body.tipo_reporte || body.reporte || body.tipo || body.id || body.report || '';
        let fechaInicio = body.fechaInicio || body.fecha_inicio || body.fecha_inicio || body.filtros?.fecha_inicio || body.filtros?.fechaInicio || body.startDate || '';
        let fechaFin = body.fechaFin || body.fecha_fin || body.fecha_fin || body.filtros?.fecha_fin || body.filtros?.fechaFin || body.endDate || '';

        // Si el frontend envió cat/id separados (legacy modal), componer tipoReporte
        if(!tipoReporte && (body.cat && body.id)){
            tipoReporte = body.cat + ':' + body.id;
        }
        if(!tipoReporte && body.reporte){
            tipoReporte = body.reporte;
        }
        // Si filtros vienen como objeto, extraer fechas de ahí también
        if(!fechaInicio && body.filtros && body.filtros.fecha_inicio) fechaInicio = body.filtros.fecha_inicio;
        if(!fechaFin && body.filtros && body.filtros.fecha_fin) fechaFin = body.filtros.fecha_fin;

        // Normalizar formato
        formato = String(formato||'pdf').toLowerCase().trim();
        if(formato==='xlsx') formato='excel';
        if(['pdf','excel'].indexOf(formato)===-1){
            return res.status(400).json({ success: false, message: 'Formato inválido. Use pdf o excel', mensaje: 'Formato inválido. Use pdf o excel' });
        }

        // Validaciones solicitadas por spec
        if(!numero || String(numero).trim()===''){
            return res.status(400).json({ success: false, message: 'Número de destino requerido', mensaje: 'Número de destino requerido' });
        }
        if(!tipoReporte || String(tipoReporte).trim()===''){
            return res.status(400).json({ success: false, message: 'Tipo de reporte requerido', mensaje: 'Tipo de reporte requerido' });
        }

        // Resolver tipoReporte -> cat/id
        let resolved = resolverTipoReporte(tipoReporte);
        // Si no se pudo resolver y tipoReporte parece ser "cat:id" con espacios, intentar split
        if(!resolved && String(tipoReporte).includes(':')){
            let p = String(tipoReporte).split(':');
            resolved = {cat: p[0].toLowerCase().trim(), id: p.slice(1).join(':').trim()};
        }
        if(!resolved){
            // intentar como id directo con inferencia
            let rawId = String(tipoReporte).trim().toLowerCase();
            if(rawId.startsWith('cont_')) resolved={cat:'contable', id:rawId};
            else if(rawId.startsWith('folio_')) resolved={cat:'folio', id:rawId};
            else if(rawId.startsWith('ticket_')) resolved={cat:'ticket', id:rawId};
            else if(rawId.startsWith('aud_')) resolved={cat:'auditoria', id:rawId};
        }
        if(!resolved || !resolved.cat || !resolved.id){
            return res.status(400).json({ success: false, message: 'Tipo de reporte inválido: ' + tipoReporte, mensaje: 'Tipo de reporte inválido: ' + tipoReporte });
        }
        let cat = resolved.cat.toLowerCase().trim();
        let id = resolved.id.trim();

        // Validar teléfono con servicio (E.164)
        let telefonoNorm;
        try {
            telefonoNorm = whatsappService.validarTelefonoOrThrow(numero);
        } catch(ve){
            return res.status(400).json({ success: false, message: ve.message, mensaje: ve.message });
        }

        // Construir filtros a partir de fechaInicio/fechaFin y posibles filtros extra
        let filtrosInput = {};
        if(fechaInicio) filtrosInput.fecha_inicio = String(fechaInicio).trim();
        if(fechaFin) filtrosInput.fecha_fin = String(fechaFin).trim();
        // también aceptar filtros completos si vienen
        if(body.filtros && typeof body.filtros==='object'){
            if(body.filtros.id_jornada) filtrosInput.id_jornada = body.filtros.id_jornada;
            if(body.filtros.id_mesero) filtrosInput.id_mesero = body.filtros.id_mesero;
            if(!filtrosInput.fecha_inicio && body.filtros.fecha_inicio) filtrosInput.fecha_inicio = body.filtros.fecha_inicio;
            if(!filtrosInput.fecha_fin && body.filtros.fecha_fin) filtrosInput.fecha_fin = body.filtros.fecha_fin;
        }
        if(body.id_jornada) filtrosInput.id_jornada = body.id_jornada;
        if(body.id_mesero) filtrosInput.id_mesero = body.id_mesero;
        // fallback a query si body vacío
        if(!filtrosInput.fecha_inicio && req.query.fecha_inicio) filtrosInput.fecha_inicio = req.query.fecha_inicio;
        if(!filtrosInput.fecha_fin && req.query.fecha_fin) filtrosInput.fecha_fin = req.query.fecha_fin;

        const parsed = parseFiltros(filtrosInput);
        if(parsed.error){
            return res.status(400).json({ success: false, message: parsed.error, mensaje: parsed.error });
        }
        let filtros = parsed.filtros;

        // Cargar datos del reporte
        let reportData;
        try {
            const data = await cargarDatosReporte(cat, id, filtros);
            reportData = { filtros, cat, id, data };
        } catch(e){
            console.error('enviarWhatsApp cargarDatos:', e.message);
            return res.status(500).json({ success: false, message: 'Error al obtener datos del reporte: ' + e.message, mensaje: 'Error al obtener datos del reporte: ' + e.message });
        }

        // Generar archivo según formato elegido
        let file;
        try {
            if(formato==='pdf'){
                file = await reportGen.generarPDF({ cat, id, filtros, reportData });
            } else {
                file = await reportGen.generarExcel({ cat, id, filtros, reportData });
            }
        } catch(ge){
            console.error('enviarWhatsApp generar archivo:', ge.message);
            return res.status(500).json({ success: false, message: 'Error al procesar el envío', mensaje: 'Error al procesar el envío: ' + ge.message });
        }

        // 4. MANEJO DE ADJUNTOS: verificar que PDF/Excel realmente se generó y guardar en ruta accesible
        let filePath = null;
        try {
            const tempDir = path.join(__dirname, '..', 'temp', 'whatsapp');
            if(!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive:true });
            filePath = path.join(tempDir, file.fileName);
            fs.writeFileSync(filePath, file.buffer);
            const stat = fs.statSync(filePath);
            console.log('[WhatsApp][ADJUNTO] Generado y guardado:', { fileName: file.fileName, filePath, mimeType: file.mimeType, sizeBuffer: file.buffer.length, sizeOnDisk: stat.size, exists: fs.existsSync(filePath) });
            if(!fs.existsSync(filePath)) throw new Error('Archivo no accesible en ruta: ' + filePath);
            if(stat.size === 0) throw new Error('Archivo generado vacío (0 bytes): ' + filePath);
            if(file.buffer.length === 0) throw new Error('Buffer del adjunto vacío');
        } catch(adjErr){
            console.error('[WhatsApp][ADJUNTO ERROR]', adjErr.message);
            return res.status(500).json({ success: false, message: 'Error al procesar el envío', mensaje: 'Error al generar adjunto: ' + adjErr.message });
        }

        // Mensaje por defecto si no viene
        let texto = String(mensaje||'').trim();
        if(!texto){
            texto = reportGen.mensajeWhatsApp({ cat, id, filtros, formato });
        }

        // Llamar al proveedor/servicio de WhatsApp - Manejo estricto, esperar confirmación
        let sendResult;
        try {
            sendResult = await whatsappService.enviarWhatsApp({
                telefono: telefonoNorm,
                mensaje: texto,
                fileBuffer: file.buffer,
                fileName: file.fileName,
                mimeType: file.mimeType,
                filePath: filePath
            });
            // 1. DEBUGGING: log crudo y verificación de confirmación del proveedor
            console.log('[WhatsApp][CONTROLLER][RAW RESPONSE]', JSON.stringify(sendResult, null, 2));
            // No devolver success:true solo por intentar: verificar confirmación real del proveedor
            if(!sendResult || !sendResult.success){
                throw new Error('Proveedor no confirmó envío: ' + JSON.stringify(sendResult));
            }
            // Para proveedores reales, raw debe contener sid/idMessage/etc
            if(sendResult.provider !== 'mock' && !sendResult.raw){
                throw new Error('Respuesta del proveedor sin confirmación (raw vacío)');
            }
            if(sendResult.provider === 'mock'){
                console.warn('[WhatsApp][ADVERTENCIA] PROVIDER=MOCK - El frontend mostrará success:true pero el mensaje NO llega al celular. Configure WHATSAPP_PROVIDER=ultramsg|greenapi|twilio y verifique /api/whatsapp/status');
            }
        } catch(se){
            console.error('[WhatsApp][CONTROLLER][PROVIDER ERROR RAW]', se.message);
            console.error(se.stack);
            return res.status(500).json({ success: false, message: 'Error al procesar el envío', mensaje: 'Error al procesar el envío: ' + se.message });
        }

        // Limpieza de temporal (no bloquea respuesta) — borra tras 5 min
        setTimeout(()=>{ try{ if(filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath); }catch(e){} }, 5*60*1000);
        // Respuesta solo después de confirmación del proveedor
        // Si es mock, advertir que no es envío real (no inventamos credenciales)
        const isMock = sendResult.provider === 'mock';
        return res.status(200).json({
            success: true,
            mock: isMock,
            warning: isMock ? 'PROVIDER MOCK: no llega al celular real. Configure WHATSAPP_PROVIDER a ultramsg/greenapi/twilio y verifique /api/whatsapp/status' : undefined,
            message: isMock ? 'Reporte generado (MOCK - no enviado a WhatsApp real)' : 'Reporte enviado con éxito por WhatsApp',
            mensaje: isMock ? 'Reporte generado (MOCK - configure proveedor real para envío)' : 'Reporte enviado con éxito por WhatsApp',
            telefono: telefonoNorm,
            numero: telefonoNorm,
            telefonoMasked: telefonoNorm.slice(0,3)+'******'+telefonoNorm.slice(-4),
            formato: formato,
            tipoReporte: tipoReporte,
            cat, id,
            archivo: file.fileName,
            filePath: filePath,
            bytes: file.buffer.length,
            provider: sendResult.provider,
            raw: sendResult.raw
        });

    } catch (e) {
        console.error('enviarWhatsApp error no controlado:', e);
        return res.status(500).json({ success: false, message: 'Error al procesar el envío', mensaje: 'Error al procesar el envío: ' + e.message });
    }
}

module.exports = { enviarWhatsApp, resolverTipoReporte, parseFiltros, cargarDatosReporte };
