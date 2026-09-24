// =========================================================
// CONTROLADOR: ANALISIS DE INVENTARIO
// KPIs, rotacion por categoria, stock muerto y proyeccion
// de reposicion. Reutiliza el lenguaje visual del modulo
// de inventario (tarjetas oscuras .ana-* definidas en dashboard).
// =========================================================

function iniciarAnalisisInventario() {
    if(typeof verificarAcceso==='function'&&!verificarAcceso('can_access_inventory_analytics')){if(typeof verificarAccesoRB==='function'&&!verificarAccesoRB('can_access_inventory_analytics'))return;return;}
    if(typeof verificarAccesoRB==='function'&&!verificarAccesoRB('can_access_inventory_analytics'))return;
    if (typeof activarNav === 'function') activarNav('navAnalisisInventario');
    var contenedor = document.getElementById('main-content');
    contenedor.innerHTML =
        '<div class="page-header">' +
        '<h2><i class="bi bi-graph-up-arrow"></i>Análisis de Inventario</h2>' +
        '<div class="page-header-right">' +
        '<div class="inv-filter-wrap" style="gap:8px">' +
        '<label class="inv-filter-label"><i class="bi bi-calendar-range"></i></label>' +
        '<select id="anaDiasMuertos" class="inv-select" onchange="recargarAnalisis()">' +
        '<option value="15">15+ días sin venta</option>' +
        '<option value="30" selected>30+ días sin venta</option>' +
        '<option value="45">45+ días sin venta</option>' +
        '<option value="60">60+ días sin venta</option>' +
        '<option value="90">90+ días sin venta</option>' +
        '</select>' +
        '</div>' +
        '<button class="btn-inv-refresh" onclick="iniciarAnalisisInventario()" title="Actualizar"><i class="bi bi-arrow-clockwise"></i> Actualizar</button>' +
        '</div>' +
        '</div>' +
        '<div id="contenedorAlertas"></div>' +
        '<div id="anaContenido" class="inv-loading"><div class="spinner-border text-primary" role="status"></div></div>';

    cargarAnalisis();
}

function recargarAnalisis() {
    cargarAnalisis();
}

function cargarAnalisis() {
    var cont = document.getElementById('anaContenido');
    if (cont) cont.innerHTML = '<div class="spinner-border text-primary" role="status"></div>';

    var dias = (document.getElementById('anaDiasMuertos') ? document.getElementById('anaDiasMuertos').value : null) || 30;

    fetch(API_BASE + '/api/inventario/analisis?dias=' + encodeURIComponent(dias))
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success) {
                renderizarAnalisis(data);
            } else {
                cont.innerHTML = '<div class="inv-error"><i class="bi bi-exclamation-triangle me-1"></i> ' + (data.mensaje || 'Error al cargar el análisis') + '</div>';
            }
        })
        .catch(function() {
            cont.innerHTML = '<div class="inv-error"><i class="bi bi-wifi-off me-1"></i> No se pudo conectar con el servidor</div>';
        });
}

function fmtAnalisis(v) {
    return Number(v || 0).toLocaleString('es-CO');
}

function fmtAnalisisDinero(v) {
    return '$' + fmtAnalisis(v);
}

function renderizarAnalisis(data) {
    var cont = document.getElementById('anaContenido');
    if (!cont) return;

    var k = data.kpis || {};
    var rotacion = data.rotacion || [];
    var stockMuerto = data.stock_muerto || [];
    var reposicion = data.reposicion || [];
    var top = data.top_vendedor;
    var margen = data.mejor_margen;

    // ---- KPIs ----
    var htmlKpi =
        '<div class="kpi-row" style="margin-bottom:20px">' +
        kpiCard('kpi-inv-costo', 'Valor del Inventario', 'bi-piggy-bank', fmtAnalisisDinero(k.valor_inventario_costo), 'a precio de costo', 'costo') +
        kpiCard('kpi-inv-venta', 'Valor a Precio Venta', 'bi-graph-up', fmtAnalisisDinero(k.valor_inventario_venta), k.unidades_totales + ' unidades totales', 'venta') +
        kpiCard('kpi-inv-reponer', 'Reposición Sugerida', 'bi-cart-plus', fmtAnalisisDinero(k.costo_reposicion_total), k.faltan_total + ' unidades por pedir · ' + k.productos_reponer + ' productos', 'reponer') +
        kpiCard('kpi-inv-merma', 'Mermas del Mes', 'bi-trash3', fmtAnalisisDinero(k.valor_mermas_mes), k.total_mermas_mes + ' registros · tasa ' + (k.tasa_mermas || 0) + '%', 'merma') +
        kpiCard('kpi-inv-top', 'Top Vendedor', 'bi-trophy', top ? top.nombre : 'Sin ventas', top ? (fmtAnalisis(top.unidades) + ' uds · ' + fmtAnalisisDinero(top.ingresos)) : 'Aún no hay ventas registradas', 'top') +
        kpiCard('kpi-inv-margen', 'Mejor Margen', 'bi-percent', margen ? (margen.margen_pct + '%') : '—', margen ? (margen.nombre + ' · ' + fmtAnalisisDinero(margen.ganancia)) : 'Sin datos de margen', 'margen') +
        '</div>';

    // ---- Rotacion por categoria ----
    var maxVendido = 0;
    rotacion.forEach(function(r) { if (r.unidades_vendidas > maxVendido) maxVendido = r.unidades_vendidas; });
    var htmlRotacion =
        '<div class="ana-card">' +
        '<div class="ana-card-header"><span><i class="bi bi-arrow-repeat"></i>Rotación por Categoría</span>' +
        '<span class="cfg-note">Últimos ' + (data.dias_analizados || 30) + ' días · vendido vs. stock actual</span></div>' +
        '<div class="ana-card-body">';
    if (rotacion.length === 0) {
        htmlRotacion += '<div class="cfg-empty"><i class="bi bi-inbox" style="font-size:1.6rem;display:block;margin-bottom:6px"></i>No hay categorías con movimientos en el período.</div>';
    } else {
        htmlRotacion += '<div class="table-responsive"><table class="ana-table">' +
            '<thead><tr><th>Categoría</th><th style="width:38%">Vendido vs. Stock</th><th class="text-end">Unidades vendidas</th><th class="text-end">Stock actual</th><th class="text-end">Ingresos</th></tr></thead><tbody>';
        rotacion.forEach(function(r) {
            var pct = maxVendido > 0 ? Math.round((r.unidades_vendidas / maxVendido) * 100) : 0;
            var color = r.rotacion >= 1 ? 'verde' : (r.rotacion > 0 ? 'ambar' : 'rojo');
            htmlRotacion += '<tr>' +
                '<td><span class="ana-chip ana-chip-blue">' + (r.categoria || 'General') + '</span></td>' +
                '<td><div style="display:flex;align-items:center;gap:8px"><div class="ana-bar-track"><div class="ana-bar-fill ' + color + '" style="width:' + (r.unidades_vendidas > 0 ? Math.max(3, pct) : 0) + '%"></div></div>' +
                '<span class="cfg-note" style="white-space:nowrap">rotación ' + r.rotacion + 'x</span></div></td>' +
                '<td class="text-end">' + fmtAnalisis(r.unidades_vendidas) + '</td>' +
                '<td class="text-end">' + fmtAnalisis(r.stock_actual) + '</td>' +
                '<td class="text-end" style="color:#34d399;font-weight:700">' + fmtAnalisisDinero(r.ingresos) + '</td>' +
                '</tr>';
        });
        htmlRotacion += '</tbody></table></div>';
    }
    htmlRotacion += '</div></div>';

    // ---- Proyeccion de reposicion ----
    var htmlReponer =
        '<div class="ana-card">' +
        '<div class="ana-card-header"><span><i class="bi bi-cart3"></i>Proyección de Reposición</span>' +
        '<span class="cfg-note">Productos con stock por debajo del mínimo</span></div>' +
        '<div class="ana-card-body">';
    if (reposicion.length === 0) {
        htmlReponer += '<div class="cfg-empty"><i class="bi bi-check2-circle" style="font-size:1.6rem;display:block;margin-bottom:6px;color:#34d399"></i>Ningún producto está por debajo de su stock mínimo.</div>';
    } else {
        htmlReponer += '<div class="table-responsive"><table class="ana-table">' +
            '<thead><tr><th>Producto</th><th>Categoría</th><th class="text-end">Stock actual</th><th class="text-end">Stock mín.</th><th class="text-end">Faltan</th><th class="text-end">Costo unit.</th><th class="text-end">Costo reposición</th></tr></thead><tbody>';
        reposicion.forEach(function(r) {
            var badge = r.stock === 0
                ? '<span class="ana-chip ana-chip-red">Agotado</span>'
                : '<span class="ana-chip ana-chip-amber">Bajo</span>';
            htmlReponer += '<tr>' +
                '<td><div style="display:flex;align-items:center;gap:8px"><span style="font-weight:600">' + (r.nombre || '') + '</span>' + badge + '</div></td>' +
                '<td><span class="ana-chip ana-chip-blue">' + (r.categoria || 'General') + '</span></td>' +
                '<td class="text-end">' + fmtAnalisis(r.stock) + '</td>' +
                '<td class="text-end">' + fmtAnalisis(r.stock_minimo) + '</td>' +
                '<td class="text-end" style="color:#fbbf24;font-weight:700">' + fmtAnalisis(r.faltan) + '</td>' +
                '<td class="text-end">' + fmtAnalisisDinero(r.costo) + '</td>' +
                '<td class="text-end" style="color:#34d399;font-weight:700">' + fmtAnalisisDinero(r.costo_reposicion) + '</td>' +
                '</tr>';
        });
        htmlReponer += '</tbody><tfoot><tr>' +
            '<td colspan="4">TOTAL SUGERIDO</td>' +
            '<td class="text-end">' + fmtAnalisis(k.faltan_total) + '</td>' +
            '<td></td>' +
            '<td class="text-end" style="color:#34d399">' + fmtAnalisisDinero(k.costo_reposicion_total) + '</td>' +
            '</tr></tfoot></table></div>';
    }
    htmlReponer += '</div></div>';

    // ---- Stock muerto ----
    var htmlMuerto =
        '<div class="ana-card">' +
        '<div class="ana-card-header"><span><i class="bi bi-hourglass-split"></i>Stock Muerto / Sin Rotación</span>' +
        '<span class="cfg-note">Sin ventas en más de ' + (data.dias_analizados || 30) + ' días</span></div>' +
        '<div class="ana-card-body">';
    if (stockMuerto.length === 0) {
        htmlMuerto += '<div class="cfg-empty"><i class="bi bi-patch-check" style="font-size:1.6rem;display:block;margin-bottom:6px;color:#34d399"></i>No hay productos sin rotación en el período seleccionado.</div>';
    } else {
        htmlMuerto += '<div class="table-responsive"><table class="ana-table">' +
            '<thead><tr><th>Producto</th><th>Categoría</th><th class="text-end">Stock</th><th class="text-end">Días sin venta</th><th class="text-end">Valor en stock (costo)</th></tr></thead><tbody>';
        stockMuerto.forEach(function(p) {
            var diasTxt = p.dias_sin_venta === null ? 'Nunca vendido' : (p.dias_sin_venta + ' días');
            htmlMuerto += '<tr>' +
                '<td style="font-weight:600">' + (p.nombre || '') + '</td>' +
                '<td><span class="ana-chip ana-chip-blue">' + (p.categoria || 'General') + '</span></td>' +
                '<td class="text-end">' + fmtAnalisis(p.stock) + '</td>' +
                '<td class="text-end"><span class="ana-chip ' + (p.dias_sin_venta === null || p.dias_sin_venta >= 60 ? 'ana-chip-red' : 'ana-chip-amber') + '">' + diasTxt + '</span></td>' +
                '<td class="text-end" style="color:#f87171;font-weight:700">' + fmtAnalisisDinero(p.valor_stock) + '</td>' +
                '</tr>';
        });
        htmlMuerto += '</tbody></table></div>';
    }
    htmlMuerto += '</div></div>';

    cont.innerHTML = htmlKpi + htmlRotacion + htmlReponer + htmlMuerto +
        '<div id="secMetricasEventos" style="margin-top:8px"><div class="inv-loading"><div class="spinner-border spinner-border-sm text-primary me-2"></div>Cargando métricas nocturnas...</div></div>';
    cargarMetricasEventos();
}
function cargarMetricasEventos(){
    var cont=document.getElementById('secMetricasEventos');
    if(!cont) return;
    Promise.all([
        fetch(API_BASE+'/api/metricas/pico-horario').then(function(r){return r.json();}).catch(function(){return {success:false}}),
        fetch(API_BASE+'/api/metricas/comparativo-eventos').then(function(r){return r.json();}).catch(function(){return {success:false}}),
        fetch(API_BASE+'/api/metricas/ticket-zona').then(function(r){return r.json();}).catch(function(){return {success:false}})
    ]).then(function(res){
        var pico=res[0], comp=res[1], ticket=res[2];
        var html='';
        html+=renderPicoHorario(pico);
        html+=renderComparativoEventos(comp);
        html+=renderTicketZona(ticket);
        cont.innerHTML=html;
    });
}
function renderPicoHorario(d){
    if(!d || !d.success){ return '<div class="ana-card"><div class="ana-card-header"><span><i class="bi bi-clock"></i> Ventas por Pico Horario (22:00 - 05:00)</span></div><div class="ana-card-body"><div style="color:#94a3b8;text-align:center;padding:20px">Sin datos de pico horario</div></div></div>'; }
    var horas=d.horas||[], maxV=d.max_ventas||1, maxI=d.max_ingresos||1;
    var nocheH=[22,23,0,1,2,3,4,5];
    var html='<div class="ana-card"><div class="ana-card-header"><span><i class="bi bi-fire"></i> Ventas por Pico Horario — Mapa de calor nocturno</span><span class="cfg-note">10:00 PM a 05:00 AM · últimos 30 días</span></div><div class="ana-card-body">';
    html+='<div class="ana-heatmap" style="display:grid;grid-template-columns:repeat(8,1fr);gap:6px;margin-bottom:16px">';
    nocheH.forEach(function(h){
        var r=horas.find(function(x){return x.hora===h;})||{ventas:0,ingresos:0};
        var intensidad=r.ventas/maxV;
        var bg=intensidad>0.7?'linear-gradient(135deg,#dc2626,#ef4444)':intensidad>0.4?'linear-gradient(135deg,#f59e0b,#fbbf24)':intensidad>0.15?'linear-gradient(135deg,#3b82f6,#60a5fa)':'#1e293b';
        var col=intensidad>0.15?'#fff':'#64748b';
        var label=(h<10?'0':'')+h+':00';
        html+='<div style="background:'+bg+';border-radius:10px;padding:10px 6px;text-align:center;color:'+col+';border:1px solid #1e293b;min-width:0;overflow-wrap:anywhere"><div style="font-size:.7rem;font-weight:700;opacity:.9">'+label+'</div><div style="font-size:1.05rem;font-weight:800">'+r.ventas+'</div><div style="font-size:.65rem;opacity:.8">'+fmtAnalisisDinero(r.ingresos)+'</div></div>';
    });
    html+='</div>';
    html+='<div style="display:flex;gap:6px;align-items:center;margin-bottom:12px"><span style="font-size:.7rem;color:#64748b">Frío</span><div style="flex:1;height:8px;border-radius:4px;background:linear-gradient(90deg,#1e293b,#3b82f6,#fbbf24,#ef4444)"></div><span style="font-size:.7rem;color:#64748b">Pico</span></div>';
    html+='<div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px">';
    horas.forEach(function(r){
        var h=(r.hora<10?'0':'')+r.hora+':00';
        var w=Math.round(r.ventas/maxV*100);
        html+='<div style="min-width:56px;text-align:center"><div style="height:70px;background:#0b1220;border-radius:8px;display:flex;align-items:end;justify-content:center;padding:4px;border:1px solid #1e293b"><div style="width:22px;height:'+Math.max(4,w)+'%;background:linear-gradient(180deg,#3b82f6,#8b5cf6);border-radius:6px"></div></div><div style="font-size:.68rem;color:#94a3b8;margin-top:4px;font-weight:600">'+h+'</div><div style="font-size:.65rem;color:#64748b">'+r.ventas+'</div></div>';
    });
    html+='</div>';
    var picoMax=horas.slice().sort(function(a,b){return b.ingresos-a.ingresos;})[0];
    if(picoMax) html+='<div style="margin-top:12px;padding:10px 14px;background:#0b1220;border:1px solid #1e293b;border-left:3px solid #f59e0b;border-radius:8px;font-size:.82rem;color:#cbd5e1"><i class="bi bi-lightning" style="color:#fbbf24"></i> Pico máximo a las <b style="color:#f8fafc">'+(picoMax.hora<10?'0':'')+picoMax.hora+':00</b> con <b style="color:#34d399">'+fmtAnalisisDinero(picoMax.ingresos)+'</b> y '+picoMax.ventas+' ventas.</div>';
    html+='</div></div>';
    return html;
}
function renderComparativoEventos(d){
    if(!d || !d.success){ return '<div class="ana-card"><div class="ana-card-header"><span><i class="bi bi-calendar-week"></i> Comparativo de Eventos / Días</span></div><div class="ana-card-body"><div style="color:#94a3b8;text-align:center;padding:20px">Sin datos comparativos</div></div></div>'; }
    var dias=d.por_dia||[], top=d.top_fechas||[];
    var maxI=Math.max.apply(null,dias.map(function(x){return x.ingresos;}))||1;
    var html='<div class="ana-card"><div class="ana-card-header"><span><i class="bi bi-calendar-week"></i> Comparativo de Eventos / Días</span><span class="cfg-note">Viernes vs Sábado vs Día especial · 90 días</span></div><div class="ana-card-body">';
    html+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:14px">';
    dias.forEach(function(r){
        var esDestacado=r.dia==='Viernes'||r.dia==='Sábado';
        var pct=Math.round(r.ingresos/maxI*100);
        html+='<div style="background:'+(esDestacado?'linear-gradient(135deg,#1e293b,#16213a)':'#0b1220')+';border:1px solid '+(esDestacado?'#334155':'#1e293b')+';border-radius:12px;padding:12px;text-align:center;min-width:0;overflow-wrap:anywhere"><div style="font-size:.72rem;font-weight:700;color:'+(esDestacado?'#fbbf24':'#94a3b8')+';text-transform:uppercase;letter-spacing:.05em">'+r.dia+'</div><div style="font-size:1.15rem;font-weight:800;color:#f8fafc;margin-top:4px">'+fmtAnalisisDinero(r.ingresos)+'</div><div style="font-size:.72rem;color:#64748b">'+r.ventas+' ventas · ticket '+fmtAnalisisDinero(r.ticket)+'</div><div style="height:6px;background:#1e293b;border-radius:4px;overflow:hidden;margin-top:8px"><div style="height:100%;width:'+pct+'%;background:'+(r.dia==='Sábado'?'linear-gradient(90deg,#f59e0b,#ef4444)':r.dia==='Viernes'?'linear-gradient(90deg,#8b5cf6,#3b82f6)':'linear-gradient(90deg,#334155,#475569)')+';border-radius:4px"></div></div></div>';
    });
    html+='</div>';
    if(top.length){
        html+='<div style="padding:10px 14px;background:#0b1220;border:1px solid #1e293b;border-radius:10px"><div style="font-size:.75rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px"><i class="bi bi-trophy" style="color:#fbbf24"></i> Top fechas con mayor ingreso</div>';
        top.slice(0,5).forEach(function(f,i){
            var medal=i===0?'#fbbf24':i===1?'#94a3b8':i===2?'#a78bfa':'#334155';
            html+='<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #16213a;gap:8px"><span style="display:flex;align-items:center;gap:8px"><span style="width:22px;height:22px;border-radius:50%;background:'+medal+';color:#0f172a;display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:800">'+(i+1)+'</span><span style="color:#e2e8f0;font-weight:600">'+String(f.fecha).substring(0,10)+'</span></span><span style="color:#34d399;font-weight:700">'+fmtAnalisisDinero(f.ingresos)+'<span style="color:#64748b;font-weight:400;font-size:.75rem"> · '+f.ventas+' ventas</span></span></div>';
        });
        html+='</div>';
    }
    html+='</div></div>';
    return html;
}
function renderTicketZona(d){
    if(!d || !d.success){ return '<div class="ana-card"><div class="ana-card-header"><span><i class="bi bi-geo-alt"></i> Ticket Promedio por Zona</span></div><div class="ana-card-body"><div style="color:#94a3b8;text-align:center;padding:20px">Sin datos por zona</div></div></div>'; }
    var zonas=d.zonas||[], maxT=Math.max.apply(null,zonas.map(function(x){return x.ticket_promedio;}))||1;
    var html='<div class="ana-card"><div class="ana-card-header"><span><i class="bi bi-geo-alt"></i> Ticket Promedio por Zona — General vs VIP</span><span class="cfg-note">Últimos 30 días</span></div><div class="ana-card-body">';
    html+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">';
    zonas.forEach(function(z){
        var isVip=(z.zona||'').toLowerCase().indexOf('vip')!==-1;
        var col=isVip?'#a78bfa':'#60a5fa';
        var bg=isVip?'linear-gradient(135deg,rgba(139,92,246,.15),rgba(59,130,246,.08))':'linear-gradient(135deg,rgba(59,130,246,.1),rgba(16,185,129,.06))';
        var pct=Math.round(z.ticket_promedio/maxT*100);
        html+='<div style="background:'+bg+';border:1px solid #1e293b;border-radius:12px;padding:14px"><div style="display:flex;justify-content:space-between;align-items:center"><span style="font-weight:700;color:#f8fafc"><i class="bi '+(isVip?'bi-star-fill':'bi-people')+'" style="color:'+col+'"></i> '+z.zona+'</span><span style="background:'+col+';color:#fff;padding:3px 8px;border-radius:20px;font-size:.72rem;font-weight:700">'+fmtAnalisisDinero(z.ticket_promedio)+' ticket</span></div><div style="font-size:.72rem;color:#94a3b8;margin-top:6px">'+z.ventas+' ventas · '+fmtAnalisisDinero(z.ingresos)+' ingresos</div><div style="margin-top:10px"><div style="display:flex;justify-content:space-between;font-size:.68rem;color:#64748b;margin-bottom:3px"><span>Ticket promedio</span><span>'+pct+'%</span></div><div style="height:8px;background:#0b1220;border-radius:4px;overflow:hidden;border:1px solid #1e293b"><div style="height:100%;width:'+pct+'%;background:linear-gradient(90deg,'+col+',#34d399);border-radius:4px"></div></div><div style="font-size:.68rem;color:#64748b;margin-top:4px">Por mesa: '+fmtAnalisisDinero(z.por_mesa)+'</div></div></div>';
    });
    html+='</div></div></div>';
    return html;
}

function kpiCard(cls, label, icono, valor, sub, sufijo) {
    var suf = (sufijo && sufijo === 'costo') ? ' costo' : '';
    return '<div class="kpi-card ' + cls + '">' +
        '<div class="kpi-top">' +
        '<div class="kpi-label">' + label + '</div>' +
        '<div class="kpi-icon"><i class="bi ' + icono + '"></i></div>' +
        '</div>' +
        '<div class="kpi-value">' + valor + '</div>' +
        '<div class="kpi-sub">' + sub + '</div>' +
        '</div>';
}