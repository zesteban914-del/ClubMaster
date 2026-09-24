function parseFiltros(q){
    const f={};
    const re=/^\d{4}-\d{2}-\d{2}$/;
    if(q.fecha_inicio){ if(!re.test(q.fecha_inicio)) return {error:'fecha_inicio inválida, use YYYY-MM-DD'}; f.fecha_inicio=q.fecha_inicio; }
    if(q.fecha_fin){ if(!re.test(q.fecha_fin)) return {error:'fecha_fin inválida, use YYYY-MM-DD'}; f.fecha_fin=q.fecha_fin; }
    if(f.fecha_inicio && f.fecha_fin && f.fecha_inicio>f.fecha_fin) return {error:'Rango invertido: fecha_inicio mayor que fecha_fin'};
    if(f.fecha_inicio && f.fecha_fin){ var dias=(new Date(f.fecha_fin)-new Date(f.fecha_inicio))/86400000; if(dias>366) return {error:'Rango máximo permitido: 366 días, refine los filtros'}; }
    if(q.id_jornada!==undefined && q.id_jornada!=='' && q.id_jornada!==null){ if(!/^\d+$/.test(String(q.id_jornada))||parseInt(q.id_jornada,10)<=0) return {error:'id_jornada debe ser entero positivo sin decimales'}; f.id_jornada=parseInt(q.id_jornada,10); }
    if(q.id_mesero!==undefined && q.id_mesero!=='' && q.id_mesero!==null){ if(!/^\d+$/.test(String(q.id_mesero))||parseInt(q.id_mesero,10)<=0) return {error:'id_mesero debe ser entero positivo sin decimales'}; f.id_mesero=parseInt(q.id_mesero,10); }
    if(q.id_cajero!==undefined && q.id_cajero!=='' && q.id_cajero!==null){ if(!/^\d+$/.test(String(q.id_cajero))||parseInt(q.id_cajero,10)<=0) return {error:'id_cajero debe ser entero positivo sin decimales'}; f.id_cajero=parseInt(q.id_cajero,10); }
    if(!f.fecha_inicio && !f.fecha_fin){ var hoy=new Date(); var ini=new Date(); ini.setDate(hoy.getDate()-30); f.fecha_inicio=ini.toISOString().split('T')[0]; f.fecha_fin=hoy.toISOString().split('T')[0]; f._defecto=true; }
    return {filtros:f};
}
async function verificarIds(db, f){
    if(f.id_jornada){ try{ const [r]=await db.pool.query('SELECT 1 FROM jornadas WHERE id_jornada=? LIMIT 1',[f.id_jornada]); if(!r.length) return 'Sin datos para ese filtro: jornada inexistente'; }catch(e){} }
    if(f.id_mesero){ try{ const [r]=await db.pool.query('SELECT 1 FROM usuarios WHERE id_usuario=? AND activo=1 LIMIT 1',[f.id_mesero]); if(!r.length) return 'Sin datos para ese filtro: empleado inexistente o inactivo'; }catch(e){} }
    if(f.id_cajero){ try{ const [r]=await db.pool.query('SELECT 1 FROM usuarios WHERE id_usuario=? AND activo=1 LIMIT 1',[f.id_cajero]); if(!r.length) return 'Sin datos para ese filtro: cajero inexistente o inactivo'; }catch(e){} }
    return null;
}
function toCsv(rows, cols){
    const esc=function(v){ if(v==null) return ''; const s=String(v).replace(/"/g,'""'); return /[",\n;]/.test(s)? '"'+s+'"': s; };
    let out = cols.map(function(c){return esc(c.label);}).join(',')+'\n';
    rows.forEach(function(r){ out+=cols.map(function(c){return esc(r[c.key]);}).join(',')+'\n'; });
    return out;
}
const express = require('express');
const reportesController = require('../controllers/reportesController');
// REGISTRAR LA RUTA EN EXPRESS - Spec: router.post('/reportes/enviar-whatsapp', reportesController.enviarWhatsApp)
const router = express.Router();
router.post('/reportes/enviar-whatsapp', reportesController.enviarWhatsApp);

module.exports = function(app, db) {
    // Montar router bajo prefijo /api para que URL completa sea POST /api/reportes/enviar-whatsapp
    app.use('/api', router);
    app.get('/api/reportes/top-productos', async (req, res) => {
        let limite = parseInt(req.query.limite);
        if (!Number.isFinite(limite) || limite <= 0) limite = 10;
        limite = Math.min(limite, 100);
        try { const productos = await db.topProductos(limite); res.json({ success: true, productos }); }
        catch (error) { console.error('top-productos:', error.message); res.status(500).json({ success: false, mensaje: 'Error al obtener reporte: ' + error.message }); }
    });
    app.get('/api/reportes/ingresos-historico', async (req, res) => {
        let { fecha_inicio, fecha_fin } = req.query;
        const re = /^\d{4}-\d{2}-\d{2}$/;
        if (fecha_inicio && !re.test(fecha_inicio)) fecha_inicio = null;
        if (fecha_fin && !re.test(fecha_fin)) fecha_fin = null;
        try { const ingresos = await db.historicoIngresos(fecha_inicio, fecha_fin); res.json({ success: true, ingresos }); }
        catch (error) { console.error('ingresos-historico:', error.message); res.status(500).json({ success: false, mensaje: 'Error al obtener historico: ' + error.message }); }
    });
    app.get('/api/reportes/tiempos-barra', async (req, res) => {
        try {
            const registros = await db.tiemposBarra();
            const completados = registros.filter(r => r.tiempo_minutos !== null && r.estado === 'Pagado');
            const promedioGeneral = completados.length > 0 ? Math.round(completados.reduce((acc, r) => acc + Number(r.tiempo_minutos), 0) / completados.length) : 0;
            const porBartender = {};
            completados.forEach(r => { const nombre = r.bartender || 'Sin asignar'; if (!porBartender[nombre]) porBartender[nombre] = { total: 0, count: 0 }; porBartender[nombre].total += Number(r.tiempo_minutos); porBartender[nombre].count++; });
            const promedioBartender = Object.keys(porBartender).map(nombre => ({ nombre, promedio: Math.round(porBartender[nombre].total / porBartender[nombre].count), total_despachos: porBartender[nombre].count }));
            const alertas = registros.filter(r => r.tiempo_minutos !== null && Number(r.tiempo_minutos) > 8);
            res.json({ success: true, promedio_general: promedioGeneral, total_despachos: completados.length, promedio_bartender: promedioBartender, alertas, registros });
        } catch (error) { console.error('tiempos-barra:', error.message); res.status(500).json({ success: false, mensaje: 'Error al obtener tiempos de barra: ' + error.message }); }
    });
    app.get('/api/reportes/analisis', async (req, res) => {
        try { const resultado = await db.analisisInventario(req.query.dias); res.json({ success: true, ...resultado }); }
        catch (error) { console.error('reportes/analisis:', error.message); res.status(500).json({ success: false, mensaje: 'Error en analisis: ' + error.message }); }
    });
    app.get('/api/reportes/general', async (req,res)=>{
        try{ const r=parseFiltros(req.query); if(r.error) return res.status(400).json({success:false,mensaje:r.error}); const f=r.filtros; const msg=await verificarIds(db,f); const data=await db.reporteVentasGeneral(f); res.json({success:true, filtros:f, ...data, aviso:msg||undefined}); }
        catch(e){ console.error('reportes/general',e.message); res.status(500).json({success:false,mensaje:e.message}); }
    });
    app.get('/api/reportes/personal-zonas', async (req,res)=>{
        try{ const r=parseFiltros(req.query); if(r.error) return res.status(400).json({success:false,mensaje:r.error}); const f=r.filtros; const msg=await verificarIds(db,f); const data=await db.reportePersonalZonas(f); res.json({success:true, filtros:f, ...data, aviso:msg||undefined}); }
        catch(e){ console.error('reportes/personal-zonas',e.message); res.status(500).json({success:false,mensaje:e.message}); }
    });
    app.get('/api/reportes/ticket-empleado-detallado', async (req,res)=>{
        try{ const r=parseFiltros(req.query); if(r.error) return res.status(400).json({success:false,mensaje:r.error}); const f=r.filtros; const msg=await verificarIds(db,f); const data=await db.reporteTicketEmpleadoDetallado(f); res.json({success:true, filtros:f, ...data, aviso:msg||undefined}); }
        catch(e){ console.error('reportes/ticket-empleado-detallado',e.message); res.status(500).json({success:false,mensaje:e.message}); }
    });
    app.get('/api/reportes/inventario-costos', async (req,res)=>{
        try{ const r=parseFiltros(req.query); if(r.error) return res.status(400).json({success:false,mensaje:r.error}); const f=r.filtros; const data=await db.reporteInventarioCostos(f); res.json({success:true, filtros:f, ...data}); }
        catch(e){ console.error('reportes/inventario-costos',e.message); res.status(500).json({success:false,mensaje:e.message}); }
    });
    app.get('/api/reportes/opciones', async (req,res)=>{
        try{ const data=await db.obtenerOpcionesFiltros(); res.json({success:true, ...data}); }
        catch(e){ res.status(500).json({success:false,mensaje:e.message}); }
    });
    app.get('/api/reportes/ejecutar/:cat/:id', async (req,res)=>{
        try{
            const r=parseFiltros(req.query);
            if(r.error) return res.status(400).json({success:false,mensaje:r.error});
            const f=r.filtros;
            const msg=await verificarIds(db,f);
            if(msg) return res.json({success:true, filtros:f, cat:req.params.cat, id:req.params.id, data:{}, aviso:msg});
            const cat=req.params.cat, id=req.params.id;
            let data={};
            if(cat==='folio' && id==='folio_familias') data.familias=await db.reporteFamilias(f);
            else if(cat==='folio' && id==='folio_descuentos') data=await db.reporteDescuentos(f);
            else if(cat==='folio' && id==='folio_nocturna') data.nocturna=await db.reporteNocturna(f);
            else if(cat==='folio' && id==='folio_retiros') data=await db.reporteRetiros(f);
            else if(cat==='folio' && id==='folio_impuestos') data.impuestos=await db.reporteImpuestos(f);
            else if(cat==='folio' && id==='folio_propinas') data=await db.reportePropinas(f);
            else if(cat==='folio' && id==='folio_pago'){ const g=await db.reporteVentasGeneral(f); data={desglose:g.desglose_metodos, kpis:g.kpis}; }
            else if(cat==='folio' && id==='folio_zonas'){ const pz=await db.reportePersonalZonas(f); data={zonas:pz.zonas}; }
            else if(cat==='ticket' && id==='ticket_minimos'){ const inv=await db.reporteStock(); data.bajoMinimos=inv.detalle.filter(p=> p.stock<=p.minimo && p.minimo>0); }
            else if(cat==='ticket' && id==='ticket_resumido'){ data=await db.reporteVentasGeneral(f); }
            else if(cat==='ticket' && id==='ticket_empleado'){ const det=await db.reporteTicketEmpleadoDetallado(f); data={meseros:det.meseros, zonas:det.zonas, detallePorMesero:det.detallePorMesero, totalesGenerales:det.totalesGenerales}; }
            else if(cat==='ticket' && id==='ticket_barra'){ const pz=await db.reportePersonalZonas(f); let tiempos=[]; try{ tiempos=await db.tiemposBarra(); }catch(e){ tiempos=[]; } data={zonas:pz.zonas, tiempos:tiempos.slice(0,50)}; }
            else if(cat==='ticket' && id==='ticket_anuladas'){ const aud=await db.reporteAuditoria(f); data.anuladas=aud.logs.filter(l=> l.tipo==='CANCELACION_PEDIDO'||l.tipo==='ANULACION_ITEM'); }
            else if(cat==='ticket' && id==='ticket_cierres'){ let j=[]; try{ const [rows]=await db.pool.query(`SELECT id_jornada, COALESCE(fecha_apertura, fecha, NOW()) AS fecha_apertura, fecha_cierre, estado, COALESCE(monto_inicial,0) AS monto_inicial, COALESCE(total_efectivo_esperado,0) AS total_efectivo_esperado, COALESCE(total_efectivo_real,0) AS total_efectivo_real, COALESCE(diferencia,0) AS diferencia FROM jornadas ORDER BY id_jornada DESC LIMIT 20`); j=rows; }catch(e){ try{ const [rows2]=await db.pool.query(`SELECT id_jornada, fecha_apertura, estado, monto_inicial FROM jornadas ORDER BY id_jornada DESC LIMIT 20`); j=rows2.map(r=>({id_jornada:r.id_jornada, fecha_apertura:r.fecha_apertura, fecha_cierre:null, estado:r.estado, monto_inicial:r.monto_inicial, total_efectivo_esperado:0, total_efectivo_real:0, diferencia:0})); }catch(e2){ j=[]; }} data.cierres=j; }
            else if(cat==='ticket' && id==='reimprimir'){ data=await db.reporteContableFacturas(f); }
            else if(cat==='auditoria' && id==='aud_descuentos') data=await db.reporteDescuentos(f);
            else if(cat==='auditoria' && id==='aud_cajon') data.cajon=await db.reporteCajon(f);
            else if(cat==='auditoria' && id==='aud_eliminadas'){ const aud=await db.reporteAuditoria(f); data.eliminadas=aud.logs.filter(l=>['CANCELACION_PEDIDO','ANULACION_ITEM'].includes(l.tipo)); }
            else if(cat==='auditoria' && id==='aud_turnos'){ const turnos=require('../services/turnos-service'); const rep=await turnos.reporteHorasPorEmpleado({fecha_inicio:f.fecha_inicio, fecha_fin:f.fecha_fin, id_usuario:f.id_mesero}); data={reporte:rep}; }
            else if(cat==='auditoria' && id==='aud_horario') data.horario=await db.reporteHorario(f);
            else if(cat==='auditoria' && id==='aud_empleado'){ data.personal=await db.reportePersonalZonas(f); data.auditoria=await db.reporteAuditoria(f); }
            else if(cat==='contable' && id==='cont_facturas') data.facturas=await db.reporteContableFacturas(f);
            else if(cat==='contable' && id==='cont_impuestos') data.impuestos=await db.reporteImpuestos(f);
            else if(cat==='contable' && id==='cont_gastos') data.gastos=await db.reporteContableGastos(f);
            else if(cat==='contable' && id==='cont_stock') data.stock=await db.reporteStock();
            else data=await db.reporteVentasGeneral(f);
            res.json({success:true, filtros:f, cat, id, data});
        }catch(e){ console.error('ejecutar',e.message); res.status(500).json({success:false,mensaje:e.message}); }
    });
    app.get('/api/facturas/buscar', async (req,res)=>{
        try{
            const q=String(req.query.q||'').trim();
            if(!q) return res.status(400).json({success:false,mensaje:'Parámetro q requerido'});
            if(!/^\d+$/.test(q)) return res.status(400).json({success:false,mensaje:'ID inválido, solo números'});
            const factura=await db.obtenerFacturaPorId(q);
            if(!factura) return res.status(404).json({success:false,mensaje:'Factura no encontrada'});
            res.json({success:true, factura});
        }catch(e){ res.status(500).json({success:false,mensaje:e.message}); }
    });
    app.get('/api/reportes/export', async (req,res)=>{
        try{
            const r=parseFiltros(req.query);
            if(r.error) return res.status(400).json({success:false,mensaje:r.error});
            const f=r.filtros;
            const tipo=(req.query.tipo||'general').toLowerCase();
            const permitidos=['general','personal','zonas','margen','mermas','familias','nocturna'];
            if(permitidos.indexOf(tipo)===-1) return res.status(400).json({success:false,mensaje:'Tipo inválido. Permitidos: '+permitidos.join(', ')});
            let rows=[], cols=[], filename='reporte.csv';
            if(tipo==='general'){
                const d=await db.reporteVentasGeneral(f);
                rows=d.desglose_metodos.map(function(r){return {metodo:r.metodo,cantidad:r.cantidad,total:r.total,pct:r.pct};});
                cols=[{key:'metodo',label:'Metodo'},{key:'cantidad',label:'Cantidad'},{key:'total',label:'Total'},{key:'pct',label:'%'}];
                filename='reporte_general.csv';
            }             else if(tipo==='personal'){
                const d=await db.reporteTicketEmpleadoDetallado(f);
                // CSV detallado: una fila por producto consolidado por mesero, manteniendo totales generales
                if(d.detallePorMesero && d.detallePorMesero.length && d.detallePorMesero.some(function(m){return m.consolidadoProductos && m.consolidadoProductos.length;})){
                    d.detallePorMesero.forEach(function(m){
                        if(m.consolidadoProductos && m.consolidadoProductos.length){
                            m.consolidadoProductos.forEach(function(p){ rows.push({mesero:m.nombre, producto:p.nombre, cantidad:p.cantidad_total, subtotal:p.subtotal_total, precio:p.precio_unitario, ventas:m.ventas, total_mesero:m.total, propinas:m.propinas, ticket:m.ticket_promedio}); });
                        } else {
                            rows.push({mesero:m.nombre, producto:'(sin detalle)', cantidad:0, subtotal:0, precio:0, ventas:m.ventas, total_mesero:m.total, propinas:m.propinas, ticket:m.ticket_promedio});
                        }
                    });
                    cols=[{key:'mesero',label:'Mesero'},{key:'producto',label:'Producto'},{key:'cantidad',label:'Cantidad'},{key:'precio',label:'Precio Unit'},{key:'subtotal',label:'Subtotal'},{key:'ventas',label:'Ventas'},{key:'total_mesero',label:'Total Mesero'},{key:'propinas',label:'Propinas'},{key:'ticket',label:'Ticket Prom'}];
                } else {
                    rows=d.meseros.map(function(r){return {nombre:r.nombre, ventas:r.ventas, total:r.total, propinas:r.propinas, ticket:r.ticket_promedio};});
                    cols=[{key:'nombre',label:'Mesero'},{key:'ventas',label:'Ventas'},{key:'total',label:'Total'},{key:'propinas',label:'Propinas'},{key:'ticket',label:'Ticket Prom'}];
                }
                filename='reporte_personal.csv';
            } else if(tipo==='zonas'){
                const d=await db.reportePersonalZonas(f);
                rows=d.zonas.map(function(r){return {zona:r.zona, ventas:r.ventas, total:r.total};});
                cols=[{key:'zona',label:'Zona'},{key:'ventas',label:'Ventas'},{key:'total',label:'Total'}];
                filename='reporte_zonas.csv';
            } else if(tipo==='margen'){
                const d=await db.reporteInventarioCostos(f);
                rows=d.ranking_margen.map(function(r){return {nombre:r.nombre,categoria:r.categoria,precio:r.precio,costo:r.costo,margen_pct:r.margen_pct,ganancia:r.ganancia,unidades:r.unidades_vendidas,ingresos:r.ingresos};});
                cols=[{key:'nombre',label:'Producto'},{key:'categoria',label:'Categoria'},{key:'precio',label:'Precio'},{key:'costo',label:'Costo'},{key:'margen_pct',label:'Margen%'},{key:'ganancia',label:'Ganancia'},{key:'unidades',label:'Unidades'},{key:'ingresos',label:'Ingresos'}];
                filename='reporte_margen.csv';
            } else if(tipo==='mermas'){
                const d=await db.reporteInventarioCostos(f);
                rows=d.mermas.map(function(r){return {producto:r.producto,cantidad:r.cantidad,motivo:r.motivo,fecha:r.fecha,valor_costo:r.valor_costo,valor_venta:r.valor_venta};});
                cols=[{key:'producto',label:'Producto'},{key:'cantidad',label:'Cantidad'},{key:'motivo',label:'Motivo'},{key:'fecha',label:'Fecha'},{key:'valor_costo',label:'Costo'},{key:'valor_venta',label:'Venta'}];
                filename='reporte_mermas.csv';
            } else if(tipo==='familias'){
                const fam=await db.reporteFamilias(f);
                rows=fam.map(r=>({familia:r.familia, ventas:r.ventas, unidades:r.unidades, ingresos:r.ingresos}));
                cols=[{key:'familia',label:'Familia'},{key:'ventas',label:'Ventas'},{key:'unidades',label:'Unidades'},{key:'ingresos',label:'Ingresos'}];
                filename='reporte_familias.csv';
            } else if(tipo==='nocturna'){
                const noc=await db.reporteNocturna(f);
                rows=noc.map(r=>({jornada:r.jornada, ventas:r.ventas, ingresos:r.ingresos, ticket:r.ticket}));
                cols=[{key:'jornada',label:'Jornada'},{key:'ventas',label:'Ventas'},{key:'ingresos',label:'Ingresos'},{key:'ticket',label:'Ticket'}];
                filename='reporte_nocturna.csv';
            }
            const csv=toCsv(rows, cols);
            res.setHeader('Content-Type','text/csv; charset=utf-8');
            res.setHeader('Content-Disposition','attachment; filename="'+filename+'"');
            res.send('\uFEFF'+csv);
        } catch(e){ console.error('export',e.message); res.status(500).json({success:false,mensaje:e.message}); }
    });

    // =========================================================
    // DRY-RUN ENDPOINT: Verificación retrocompatibilidad histórica
    // GET /api/reportes/dry-run-compatibilidad
    // =========================================================
    app.get('/api/reportes/dry-run-compatibilidad', async (req, res) => {
        try {
            const pool = db.pool;
            const resultado = {
                timestamp: new Date().toISOString(),
                checks: {}
            };

            // 1. Verificar columnas en facturas
            try {
                const [colsFacturas] = await pool.query("SHOW COLUMNS FROM facturas");
                const colNamesFacturas = colsFacturas.map(c => c.Field);
                resultado.checks.facturas = {
                    tiene_id_mesero: colNamesFacturas.includes('id_mesero'),
                    tiene_id_cajero: colNamesFacturas.includes('id_cajero'),
                    columnas: colNamesFacturas
                };
            } catch (e) {
                resultado.checks.facturas = { error: e.message };
            }

            // 2. Verificar columnas en pedidos
            try {
                const [colsPedidos] = await pool.query("SHOW COLUMNS FROM pedidos");
                const colNamesPedidos = colsPedidos.map(c => c.Field);
                resultado.checks.pedidos = {
                    tiene_id_mesero: colNamesPedidos.includes('id_mesero'),
                    tiene_id_cajero: colNamesPedidos.includes('id_cajero'),
                    columnas: colNamesPedidos
                };
            } catch (e) {
                resultado.checks.pedidos = { error: e.message };
            }

            // 3. Verificar datos históricos en facturas (NULL vs asignado)
            try {
                const [facturasStats] = await pool.query(`
                    SELECT
                        COUNT(*) AS total,
                        SUM(CASE WHEN id_mesero IS NULL THEN 1 ELSE 0 END) AS mesero_null,
                        SUM(CASE WHEN id_mesero IS NOT NULL THEN 1 ELSE 0 END) AS mesero_asignado,
                        SUM(CASE WHEN id_cajero IS NULL THEN 1 ELSE 0 END) AS cajero_null,
                        SUM(CASE WHEN id_cajero IS NOT NULL THEN 1 ELSE 0 END) AS cajero_asignado
                    FROM facturas
                `);
                resultado.checks.facturas_historico = facturasStats[0];
            } catch (e) {
                resultado.checks.facturas_historico = { error: e.message };
            }

            // 4. Verificar datos históricos en pedidos (NULL vs asignado)
            try {
                const [pedidosStats] = await pool.query(`
                    SELECT
                        COUNT(*) AS total,
                        SUM(CASE WHEN id_mesero IS NULL THEN 1 ELSE 0 END) AS mesero_null,
                        SUM(CASE WHEN id_mesero IS NOT NULL THEN 1 ELSE 0 END) AS mesero_asignado,
                        SUM(CASE WHEN id_cajero IS NULL THEN 1 ELSE 0 END) AS cajero_null,
                        SUM(CASE WHEN id_cajero IS NOT NULL THEN 1 ELSE 0 END) AS cajero_asignado
                    FROM pedidos
                `);
                resultado.checks.pedidos_historico = pedidosStats[0];
            } catch (e) {
                resultado.checks.pedidos_historico = { error: e.message };
            }

            // 5. Test query con LEFT JOIN (simula listado facturas)
            try {
                const [testListado] = await pool.query(`
                    SELECT
                        f.id_factura,
                        f.id_mesero,
                        f.id_cajero,
                        u_mesero.nombre AS mesero_nombre,
                        u_cajero.nombre AS cajero_nombre
                    FROM facturas f
                    LEFT JOIN usuarios u_mesero ON f.id_mesero = u_mesero.id_usuario
                    LEFT JOIN usuarios u_cajero ON f.id_cajero = u_cajero.id_usuario
                    WHERE f.estado = 'Pagada'
                    ORDER BY f.fecha DESC
                    LIMIT 10
                `);
                resultado.checks.test_left_join = {
                    success: true,
                    muestra: testListado.map(r => ({
                        id_factura: r.id_factura,
                        id_mesero: r.id_mesero,
                        id_cajero: r.id_cajero,
                        mesero_nombre: r.mesero_nombre || 'No asignado',
                        cajero_nombre: r.cajero_nombre || 'No asignado'
                    }))
                };
            } catch (e) {
                resultado.checks.test_left_join = { error: e.message };
            }

            // 6. Test GROUP BY mesero vs cajero (simula reporte personal-zonas)
            try {
                const [testGroupBy] = await pool.query(`
                    SELECT
                        COALESCE(f.id_mesero, f.id_usuario) AS id_mesero,
                        COALESCE(u2.nombre, u.nombre, 'Sin mesero') AS mesero_nombre,
                        COUNT(*) AS ventas,
                        SUM(f.total) AS total,
                        SUM(f.propina) AS propinas
                    FROM facturas f
                    LEFT JOIN usuarios u ON f.id_usuario = u.id_usuario
                    LEFT JOIN usuarios u2 ON f.id_mesero = u2.id_usuario
                    WHERE f.estado = 'Pagada'
                    GROUP BY COALESCE(f.id_mesero, f.id_usuario), COALESCE(u2.nombre, u.nombre)
                    ORDER BY total DESC
                    LIMIT 5
                `);
                resultado.checks.test_group_by_mesero = { success: true, data: testGroupBy };

                const [testGroupByCajero] = await pool.query(`
                    SELECT
                        COALESCE(f.id_cajero, f.id_usuario) AS id_cajero,
                        COALESCE(u3.nombre, u.nombre, 'Sin cajero') AS cajero_nombre,
                        COUNT(*) AS ventas,
                        SUM(f.total) AS total,
                        SUM(f.propina) AS propinas
                    FROM facturas f
                    LEFT JOIN usuarios u ON f.id_usuario = u.id_usuario
                    LEFT JOIN usuarios u3 ON f.id_cajero = u3.id_usuario
                    WHERE f.estado = 'Pagada'
                    GROUP BY COALESCE(f.id_cajero, f.id_usuario), COALESCE(u3.nombre, u.nombre)
                    ORDER BY total DESC
                    LIMIT 5
                `);
                resultado.checks.test_group_by_cajero = { success: true, data: testGroupByCajero };
            } catch (e) {
                resultado.checks.test_group_by = { error: e.message };
            }

            // 7. Verificar que los reportes no fallan con COALESCE
            try {
                const [testReporte] = await pool.query(`
                    SELECT
                        COALESCE(p.id_mesero, p.id_usuario) AS id_mesero,
                        COALESCE(u2.nombre, u.nombre, 'Sin asignar') AS nombre,
                        COUNT(*) AS ventas,
                        COALESCE(SUM(p.total),0) AS total,
                        COALESCE(SUM(p.propina),0) AS propinas
                    FROM pedidos p
                    LEFT JOIN usuarios u ON p.id_usuario = u.id_usuario
                    LEFT JOIN usuarios u2 ON p.id_mesero = u2.id_usuario
                    WHERE p.estado = 'Pagado'
                    GROUP BY COALESCE(p.id_mesero, p.id_usuario), COALESCE(u2.nombre, u.nombre)
                    ORDER BY total DESC
                    LIMIT 5
                `);
                resultado.checks.test_pedidos_group_by = { success: true, data: testReporte };
            } catch (e) {
                resultado.checks.test_pedidos_group_by = { error: e.message };
            }

            res.json({ success: true, data: resultado });
        } catch (e) {
            console.error('dry-run-compatibilidad:', e.message);
            res.status(500).json({ success: false, mensaje: e.message });
        }
    });
};
