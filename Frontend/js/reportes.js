var API_REPORTES = (typeof API_BASE !== 'undefined' && API_BASE ? API_BASE : '');
var repFiltros = { fecha_inicio:'', fecha_fin:'', id_jornada:'', id_mesero:'', id_cajero:'' };
var repAbort=null;
function repError(msg){ try{ if(typeof mostrarAlerta==='function'){ mostrarAlerta('danger',msg); return; } }catch(e){} try{ if(typeof mostrarToast==='function'){ mostrarToast('danger',msg); return; } }catch(e){} alert(msg); }
function repToast(msg){ try{ if(typeof mostrarToast==='function'){ mostrarToast('info',msg); return; } }catch(e){} try{ if(typeof mostrarAlerta==='function'){ mostrarAlerta('info',msg); return; } }catch(e){} }
var repTab='ticket';
var repCache={ general:null, personal:null, inventario:null };
var REP_CATALOG={
 ticket:[
  {id:'reimprimir',titulo:'Reimprimir Factura / Ticket',desc:'Reemisión de ticket térmico por Nº factura o fecha.',icon:'bi-printer',badge:'Ticket',filtros:['fecha','jornada']},
  {id:'ticket_resumido',titulo:'Ventas Formato Ticket Resumido (Turno Activo)',desc:'Resumen del turno/jornada activa en formato ticket 80mm.',icon:'bi-receipt',badge:'Ticket',filtros:['jornada']},
  {id:'ticket_empleado',titulo:'Ventas Formato Ticket x Empleado',desc:'Ticket consolidado por mesero / cajero del turno.',icon:'bi-person-badge',badge:'Ticket',filtros:['mesero','fecha']},
  {id:'ticket_barra',titulo:'Ventas Formato Ticket Detallado x Barra',desc:'Detalle por barra y tiempos de despacho en ticket.',icon:'bi-lightning',badge:'Ticket',filtros:['fecha','jornada']},
  {id:'ticket_anuladas',titulo:'Ventas Eliminadas / Anuladas Formato Ticket',desc:'Listado de ventas anuladas con motivo y usuario.',icon:'bi-trash',badge:'Ticket',filtros:['fecha','mesero']},
  {id:'ticket_minimos',titulo:'Productos Bajo Mínimos Formato Ticket',desc:'Alerta de stock bajo mínimo para reposición.',icon:'bi-exclamation-triangle',badge:'Ticket',filtros:['-']},
  {id:'ticket_cierres',titulo:'Cierres de Caja Formato Ticket',desc:'Cierres por jornada listos para impresión térmica.',icon:'bi-safe',badge:'Ticket',filtros:['jornada','fecha']}
 ],
 folio:[
  {id:'folio_nocturna',titulo:'Ventas Generales x Jornada Nocturna (Corte 06:00 AM)',desc:'Corte nocturno 06:00 AM - cierre operativo.',icon:'bi-moon-stars',badge:'Folio',filtros:['fecha']},
  {id:'folio_pago',titulo:'Ventas x Forma de Pago (Efectivo, Nequi, Tarjetas, Crédito VIP)',desc:'Desglose por método de pago con % y totales.',icon:'bi-credit-card-2-front',badge:'Folio',filtros:['fecha','jornada']},
  {id:'folio_familias',titulo:'Ventas x Familias / Categorías (Licores, Cervezas, Sin Alcohol)',desc:'Agrupado por familia/categoría de producto.',icon:'bi-tags',badge:'Folio',filtros:['fecha']},
  {id:'folio_descuentos',titulo:'Descuentos y Cortesías Realizados en Ventas',desc:'Detalle de descuentos y cortesías aplicadas.',icon:'bi-percent',badge:'Folio',filtros:['fecha','mesero']},
  {id:'folio_zonas',titulo:'Ventas x Zonas (Barra General, VIP, Palcos)',desc:'Productividad por zona/mesa del local.',icon:'bi-geo-alt',badge:'Folio',filtros:['fecha','jornada']},
  {id:'folio_retiros',titulo:'Retiros Parciales / Vaciados de Caja x Empleado',desc:'Trazabilidad de retiros y vaciados por cajero.',icon:'bi-box-arrow-up',badge:'Folio',filtros:['mesero','jornada']},
  {id:'folio_impuestos',titulo:'Ventas Totales x Día Desglose Impuestos (Impoconsumo / IVA)',desc:'Base, impoconsumo 8% e IVA discriminado por día.',icon:'bi-calculator',badge:'Folio',filtros:['fecha']},
  {id:'folio_propinas',titulo:'Relación de Propinas (Mesero / Pozo Común)',desc:'Propinas por mesero y distribución pozo común.',icon:'bi-coin',badge:'Folio',filtros:['fecha','mesero']}
 ],
 auditoria:[
   {id:'aud_turnos',titulo:'Turnos y Horas Trabajadas por Empleado (Facturación por Turno)',desc:'Horas decimales por turno, apertura/cierre, total facturado y comandas. Requiere Caja Abierta para iniciar.',icon:'bi-stopwatch',badge:'Auditoría',filtros:['fecha','mesero']},
   {id:'aud_empleado',titulo:'Resumen y Ventas Detalladas x Empleado',desc:'KPIs, ticket promedio y detalle de ventas por empleado.',icon:'bi-people',badge:'Auditoría',filtros:['mesero','fecha','jornada']},
   {id:'aud_descuentos',titulo:'Auditoría de Descuentos y Cortesías Aplicadas',desc:'Quién, cuánto y por qué se aplicó cada descuento.',icon:'bi-shield-check',badge:'Auditoría',filtros:['fecha','mesero']},
   {id:'aud_cajon',titulo:'Trazabilidad de Aperturas de Cajón Monedero sin Venta',desc:'Aperturas sin venta asociada - control de caja.',icon:'bi-door-open',badge:'Auditoría',filtros:['fecha','mesero']},
   {id:'aud_eliminadas',titulo:'Trazabilidad de Ventas Eliminadas / Modificadas',desc:'Log de ventas anuladas/modificadas con usuario y hora.',icon:'bi-journal-text',badge:'Auditoría',filtros:['fecha','mesero']},
   {id:'aud_horario',titulo:'Control Horario y Asistencia de Personal',desc:'Entradas, salidas y horas trabajadas por empleado.',icon:'bi-clock-history',badge:'Auditoría',filtros:['fecha','mesero']}
  ],
 contable:[
  {id:'cont_facturas',titulo:'Resumen Contable de Facturas',desc:'Consecutivo DIAN, totales, forma de pago y estado.',icon:'bi-journal-check',badge:'Contable',filtros:['fecha','jornada']},
  {id:'cont_impuestos',titulo:'Impuestos Repercutidos (Impoconsumo / IVA)',desc:'Consolidado de impoconsumo e IVA repercutido.',icon:'bi-bank',badge:'Contable',filtros:['fecha']},
  {id:'cont_gastos',titulo:'Gastos Operativos de Caja Chica',desc:'Egresos menores y caja chica por concepto.',icon:'bi-wallet2',badge:'Contable',filtros:['fecha']},
  {id:'cont_stock',titulo:'Valoración de Stock General en Bodega y Barras',desc:'Valorización a costo y precio venta por ubicación.',icon:'bi-boxes',badge:'Contable',filtros:['-']}
 ]
};
function repActivarNav(){ if(typeof activarNav==='function') activarNav('navReportes'); else { document.querySelectorAll('#sidebar .nav-link').forEach(function(a){a.classList.remove('active');}); var el=document.getElementById('navReportes'); if(el) el.classList.add('active'); } }
function iniciarReportes(){
    if(typeof verificarAcceso==='function'&&!verificarAcceso('ver_reportes')){if(typeof verificarAccesoRB==='function'&&!verificarAccesoRB('ver_reportes'))return;return;}
    if(typeof verificarAccesoRB==='function'&&!verificarAccesoRB('ver_reportes'))return;
    repActivarNav();
    var c=document.getElementById('main-content');
    c.innerHTML='<div class="page-header" style="flex-wrap:wrap;gap:12px"><h2><i class="bi bi-bar-chart-line"></i> Inteligencia de Negocios</h2><div style="display:flex;gap:8px"><button class="btn-refresh" onclick="repAplicarFiltros()"><i class="bi bi-funnel"></i> Aplicar filtros</button><button class="btn-refresh" onclick="iniciarReportes()" style="background:#0f172a;color:#fff;border:none"><i class="bi bi-arrow-clockwise"></i></button></div></div>'
        +'<div id="repFiltros" style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:14px 16px;margin-bottom:16px;display:flex;flex-wrap:wrap;gap:10px;align-items:end">'
        +'<div style="flex:1;min-width:140px"><label style="font-size:.7rem;font-weight:800;color:#475569;text-transform:uppercase">Desde</label><input type="date" id="repFi" class="form-control form-control-sm" style="border-radius:8px"></div>'
        +'<div style="flex:1;min-width:140px"><label style="font-size:.7rem;font-weight:800;color:#475569;text-transform:uppercase">Hasta</label><input type="date" id="repFf" class="form-control form-control-sm" style="border-radius:8px"></div>'
        +'<div style="flex:1;min-width:160px"><label style="font-size:.7rem;font-weight:800;color:#475569;text-transform:uppercase">Jornada</label><select id="repJornada" class="form-select form-select-sm" style="border-radius:8px"><option value="">Todas</option></select></div>'
        +'<div style="flex:1;min-width:160px"><label style="font-size:.7rem;font-weight:800;color:#475569;text-transform:uppercase">Mesero (Atendió)</label><select id="repMesero" class="form-select form-select-sm" style="border-radius:8px"><option value="">Todos</option></select></div>'
        +'<div style="flex:1;min-width:160px"><label style="font-size:.7rem;font-weight:800;color:#475569;text-transform:uppercase">Cajero (Cobró)</label><select id="repCajero" class="form-select form-select-sm" style="border-radius:8px"><option value="">Todos</option></select></div>'
        +'<div style="display:flex;gap:6px;align-items:end"><button class="btn btn-sm" style="background:#0f172a;color:#fff;border-radius:8px;padding:7px 14px;font-weight:600" onclick="repAplicarFiltros()"><i class="bi bi-search me-1"></i>Filtrar</button><button class="btn btn-sm btn-outline-secondary" style="border-radius:8px" onclick="repLimpiar()"><i class="bi bi-x-circle"></i></button></div>'
        +'</div>'
        +'<div id="repExportBar" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:8px;flex-wrap:wrap"><div class="rep-tabs" style="display:flex;gap:6px;flex-wrap:wrap"><button class="rep-tab active" data-tab="ticket" onclick="repSwitch(\'ticket\')"><i class="bi bi-receipt"></i> Listados de Ventas Formato Ticket</button><button class="rep-tab" data-tab="folio" onclick="repSwitch(\'folio\')"><i class="bi bi-file-text"></i> Listados de Ventas Formato Folio</button><button class="rep-tab" data-tab="auditoria" onclick="repSwitch(\'auditoria\')"><i class="bi bi-shield-check"></i> Gestión, Control y Auditoría</button><button class="rep-tab" data-tab="contable" onclick="repSwitch(\'contable\')"><i class="bi bi-calculator"></i> Gestión Contable y Financiera</button></div><div class="rep-export" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><select id="repExportTipo" class="form-select form-select-sm" style="width:auto;border-radius:8px"><option value="general">Métodos (CSV)</option><option value="personal">Meseros (CSV)</option><option value="zonas">Zonas (CSV)</option><option value="margen">Margen (CSV)</option><option value="mermas">Mermas (CSV)</option></select><button class="btn btn-sm" style="background:#10b981;color:#fff;border-radius:8px;font-weight:600" onclick="repExportar()"><i class="bi bi-download me-1"></i>Exportar</button><button class="btn btn-sm" style="background:#25D366;color:#fff;border-radius:8px;font-weight:700;display:inline-flex;align-items:center;gap:6px" onclick="repAbrirWhatsAppModal()"><i class="bi bi-whatsapp"></i> Enviar por WhatsApp</button></div></div>'
        +'<div id="repContent"></div>';
    repAddStyles();
    var hoy=new Date(); var ini=new Date(); ini.setDate(hoy.getDate()-30);
    document.getElementById('repFi').value=ini.toISOString().split('T')[0];
    document.getElementById('repFf').value=hoy.toISOString().split('T')[0];
    repFiltros.fecha_inicio=document.getElementById('repFi').value;
    repFiltros.fecha_fin=document.getElementById('repFf').value;
    repCargarOpciones();
    repSwitch('ticket');
}
function repAddStyles(){ if(document.getElementById('repStyles')) return; var s=document.createElement('style'); s.id='repStyles'; s.textContent=".rep-tab{padding:8px 12px;border:1px solid #e2e8f0;background:#fff;border-radius:10px;font-weight:600;font-size:.78rem;color:#334155;cursor:pointer;white-space:nowrap}.rep-tab.active{background:#0f172a;color:#fff;border-color:#0f172a}.rep-card{border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;background:#fff}.rep-card-h{padding:12px 14px;background:#0f172a;color:#f8fafc;font-weight:700;font-size:.82rem;display:flex;justify-content:space-between;align-items:center}.rep-opt-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:6px}@media(max-width:900px){.rep-opt-grid{grid-template-columns:1fr}}.rep-opt{border:1px solid #e2e8f0;border-radius:10px;background:#fff;padding:8px 10px;display:flex;align-items:center;gap:8px;min-height:48px}.rep-num{width:26px;height:26px;border-radius:50%;background:#0f172a;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.72rem;flex-shrink:0}.rep-opt-icon{width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:.85rem;flex-shrink:0}.rep-btn-ver{background:#0f172a;color:#fff;border:none;border-radius:8px;padding:5px 10px;font-size:.72rem;font-weight:700;cursor:pointer}.rep-btn-print{background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:5px 8px;cursor:pointer}"
+".rep-mhead{padding:18px 20px;background:#0f172a;color:#fff;display:flex;justify-content:space-between;align-items:center;gap:10px}"
+".rep-mhead-main{display:flex;gap:12px;align-items:center;min-width:0;flex:1}"
+".rep-mhead-icon{width:40px;height:40px;border-radius:10px;background:rgba(255,255,255,.12);display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0}"
+".rep-mhead-title{font-weight:800;font-size:.92rem;overflow-wrap:anywhere;min-width:0}"
+".rep-mhead-sub{font-size:.72rem;opacity:.7}"
+".rep-mclose{background:rgba(255,255,255,.12);border:none;color:#fff;width:44px;height:44px;min-width:44px;border-radius:10px;font-size:1rem;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center}"
+".rep-mbody{padding:16px 20px;background:#fff}"
+".rep-mfoot{display:flex;gap:8px;margin-top:12px;justify-content:flex-end}"
+".rep-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px}"
+".rep-2col{display:grid;grid-template-columns:1fr 1fr;gap:10px}"
+"@media(max-width:480px){"
+"#repModal{padding:10px}"
+"#repModalBox{border-radius:14px}"
+".rep-mhead{padding:14px}"
+".rep-mhead-icon{width:36px;height:36px;font-size:1rem}"
+".rep-mhead-title{font-size:.85rem}"
+".rep-mbody{padding:12px}"
+".rep-kpis{grid-template-columns:1fr}"
+".rep-2col{grid-template-columns:1fr}"
+".rep-mfoot{flex-direction:column;align-items:stretch}"
+".rep-mfoot .btn{min-height:44px;width:100%}"
+"#repFiltros .btn,#repExportBar .btn{min-height:44px}"
+".rep-btn-ver,.rep-btn-print{min-height:44px;min-width:44px;display:inline-flex;align-items:center;justify-content:center}"
+".rep-card-h{flex-wrap:wrap;gap:6px}"
+".rep-opt-title{overflow-wrap:anywhere}"
+"}"
+"@media(max-width:640px){"
+"#repFiltros{display:grid !important;grid-template-columns:1fr 1fr;gap:8px;padding:12px !important;align-items:end}"
+"#repFiltros>div{min-width:0 !important}"
+"#repFiltros>div:last-child{grid-column:1/-1;display:flex;gap:8px}"
+"#repFiltros>div:last-child .btn{flex:1;min-height:44px}"
+"#repFiltros input,#repFiltros select{min-height:44px;width:100%}"
+"#repExportBar{flex-direction:column;align-items:stretch !important}"
+".rep-tabs{flex-wrap:nowrap !important;overflow-x:auto;max-width:100%;padding-bottom:6px;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none}"
+".rep-tabs::-webkit-scrollbar{display:none}"
+".rep-tabs .rep-tab{flex-shrink:0;scroll-snap-align:start;min-height:44px;display:inline-flex;align-items:center}"
+".rep-export{display:flex;gap:8px;width:100%}"
+".rep-export select{flex:1;min-width:0;min-height:44px}"
+".rep-export .btn{flex-shrink:0;min-height:44px}"
+".rep-opt-grid{grid-template-columns:1fr;gap:10px}"
+".rep-opt{flex-wrap:wrap;min-width:0;max-width:100%;padding:12px;row-gap:10px}"
+".rep-opt-title{white-space:normal !important;overflow:visible !important;text-overflow:clip !important;flex:1 1 50% !important;min-width:0}"
+".rep-opt>span:last-child{flex:1 1 100%;display:flex;gap:8px;min-width:0}"
+".rep-opt>span:last-child .rep-btn-ver{flex:2;min-height:44px;font-size:.8rem}"
+".rep-opt>span:last-child .rep-btn-print{flex:1;min-height:44px}"
+"} details>summary{list-style:none} details>summary::-webkit-details-marker{display:none} details>summary::marker{content:''} @media print{ #repModal{position:static !important; background:#fff !important} #repModalBox{box-shadow:none !important; max-height:none !important; overflow:visible !important} details{open:true} }"; document.head.appendChild(s); }
function repCargarOpciones(){ fetch(API_REPORTES+'/api/reportes/opciones').then(function(r){return r.json();}).then(function(d){ if(!d.success){ repToast('No se pudieron cargar jornadas/meseros'); return; } var sj=document.getElementById('repJornada'); if(sj){ sj.innerHTML='<option value="">Todas</option>'; d.jornadas.forEach(function(j){ var o=document.createElement('option'); o.value=j.id_jornada; o.textContent='#'+j.id_jornada+' '+(j.fecha_apertura||'').toString().substring(0,10)+' '+j.estado; sj.appendChild(o); }); } var sm=document.getElementById('repMesero'); if(sm){ sm.innerHTML='<option value="">Todos</option>'; d.meseros.forEach(function(u){ var o=document.createElement('option'); o.value=u.id_usuario; o.textContent=u.nombre; sm.appendChild(o); }); } var sc=document.getElementById('repCajero'); if(sc){ sc.innerHTML='<option value="">Todos</option>'; d.meseros.forEach(function(u){ var o=document.createElement('option'); o.value=u.id_usuario; o.textContent=u.nombre; sc.appendChild(o); }); } }).catch(function(){ repToast('Sin conexión al cargar filtros de reportes'); }); }
function repAplicarFiltros(){ var fi=document.getElementById('repFi').value||''; var ff=document.getElementById('repFf').value||''; var jj=document.getElementById('repJornada').value||''; var mm=document.getElementById('repMesero').value||''; var cc=document.getElementById('repCajero').value||''; if(fi&&ff&&fi>ff){ repError('Rango invertido: Desde mayor que Hasta'); return; } if(jj&&!/^\d+$/.test(jj)){ repError('Jornada inválida'); return; } if(mm&&!/^\d+$/.test(mm)){ repError('Empleado inválido'); return; } if(cc&&!/^\d+$/.test(cc)){ repError('Cajero inválido'); return; } if(fi&&ff){ var dias=(new Date(ff)-new Date(fi))/86400000; if(dias>366){ repError('Rango máximo 366 días'); return; } } repFiltros.fecha_inicio=fi; repFiltros.fecha_fin=ff; repFiltros.id_jornada=jj; repFiltros.id_mesero=mm; repFiltros.id_cajero=cc; repCache={general:null,personal:null,inventario:null}; repSwitch(repTab); }
function repLimpiar(){ document.getElementById('repFi').value=''; document.getElementById('repFf').value=''; document.getElementById('repJornada').value=''; document.getElementById('repMesero').value=''; document.getElementById('repCajero').value=''; repAplicarFiltros(); }
function repSwitch(t){ repTab=t; document.querySelectorAll('.rep-tab').forEach(function(b){ b.classList.toggle('active', b.dataset.tab===t); }); if(t==='ticket') repRenderTicket(); else if(t==='folio') repRenderFolio(); else if(t==='auditoria') repRenderAuditoria(); else if(t==='contable') repRenderContable(); }
function repQs(){ var sp=new URLSearchParams(); if(repFiltros.fecha_inicio) sp.append('fecha_inicio',repFiltros.fecha_inicio); if(repFiltros.fecha_fin) sp.append('fecha_fin',repFiltros.fecha_fin); if(repFiltros.id_jornada) sp.append('id_jornada',repFiltros.id_jornada); if(repFiltros.id_mesero) sp.append('id_mesero',repFiltros.id_mesero); if(repFiltros.id_cajero) sp.append('id_cajero',repFiltros.id_cajero); var s=sp.toString(); return s? '?'+s : ''; }
function fmt(n){ return Number(n||0).toLocaleString('es-CO'); }
function fmtM(n){ return '$'+fmt(Math.round(n||0)); }
function escH(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function repText(s){ var t=document.createElement('span'); t.textContent=String(s==null?'':s); return t.innerHTML; }
function repEsTest(r){ var s=((r&&r.nombre)||'')+' '+((r&&r.categoria)||''); return s.toUpperCase().indexOf('TEST-BUG')!==-1; }
function repGridHtml(cat){ var arr=REP_CATALOG[cat]||[]; var h='<div class="rep-card"><div class="rep-card-h"><span>'+ ({ticket:'<i class="bi bi-receipt me-1"></i> Listados de Ventas Formato Ticket',folio:'<i class="bi bi-file-text me-1"></i> Listados de Ventas Formato Folio',auditoria:'<i class="bi bi-shield-check me-1"></i> Gestión, Control y Auditoría',contable:'<i class="bi bi-calculator me-1"></i> Gestión Contable y Financiera'}[cat]||cat)+'</span><span style="font-size:.7rem;opacity:.8">'+arr.length+' reportes</span></div><div style="padding:10px"><div class="rep-opt-grid">'; arr.forEach(function(o,i){ var n=i+1; h+='<div class="rep-opt rep-opt-'+cat+'"><span class="rep-num">'+n+'</span><span class="rep-opt-icon"><i class="bi '+o.icon+'"></i></span><span class="rep-opt-title" title="'+o.titulo+'" style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:700;font-size:.82rem">'+o.titulo+'</span><span style="display:flex;gap:4px"><button class="rep-btn-ver" onclick="repEjecutarReporte(\''+cat+'\',\''+o.id+'\')"><i class="bi bi-eye me-1"></i>Ver</button><button class="rep-btn-print" onclick="repEjecutarReporte(\''+cat+'\',\''+o.id+'\',true)"><i class="bi bi-printer"></i></button></span></div>'; }); h+='</div></div></div>'; return h; }
function repRenderTicket(){ var cont=document.getElementById('repContent'); cont.innerHTML=repGridHtml('ticket'); }
function repRenderFolio(){ var cont=document.getElementById('repContent'); cont.innerHTML=repGridHtml('folio'); }
function repRenderAuditoria(){ var cont=document.getElementById('repContent'); cont.innerHTML=repGridHtml('auditoria'); }
function repRenderContable(){ var cont=document.getElementById('repContent'); cont.innerHTML=repGridHtml('contable'); }
function repRenderLive(data, cat, id){
 var d=data.data||data;
 var h='<div style="margin-top:12px">';
 if(cat==='folio' && id==='folio_familias' && d.familias){ h+='<div class="table-responsive"><table class="table table-sm"><thead><tr><th>Familia</th><th class="text-end">Ventas</th><th class="text-end">Unidades</th><th class="text-end">Ingresos</th></tr></thead><tbody>'; d.familias.forEach(function(r){ h+='<tr><td>'+escH(r.familia)+'</td><td class="text-end">'+r.ventas+'</td><td class="text-end">'+r.unidades+'</td><td class="text-end" style="font-weight:700">'+fmtM(r.ingresos)+'</td></tr>'; }); h+='</tbody></table></div>'; }
 else if(cat==='folio' && id==='folio_descuentos' && d.detalle){ h+='<div class="table-responsive"><table class="table table-sm"><thead><tr><th>Pedido</th><th>Mesero</th><th>Mesa</th><th class="text-end">Descuento</th><th class="text-end">Total</th></tr></thead><tbody>'; d.detalle.slice(0,100).forEach(function(r){ h+='<tr><td>#'+r.id_pedido+'</td><td>'+escH(r.mesero)+'</td><td>'+escH(r.mesa)+'</td><td class="text-end" style="color:#d97706">-'+fmtM(r.descuento)+'</td><td class="text-end">'+fmtM(r.total)+'</td></tr>'; }); h+='</tbody></table></div><div style="font-size:.78rem">Total desc: <b>'+fmtM(d.totales.totalDescuento)+'</b> Cortesias: '+fmtM(d.totales.totalCortesias)+'</div>'; }
 else if(cat==='folio' && id==='folio_nocturna' && d.nocturna){ h+='<div class="table-responsive"><table class="table table-sm"><thead><tr><th>Jornada (06:00)</th><th class="text-end">Ventas</th><th class="text-end">Ingresos</th><th class="text-end">Ticket</th></tr></thead><tbody>'; d.nocturna.forEach(function(r){ h+='<tr><td>'+r.jornada+'</td><td class="text-end">'+r.ventas+'</td><td class="text-end" style="font-weight:700">'+fmtM(r.ingresos)+'</td><td class="text-end">'+fmtM(r.ticket)+'</td></tr>'; }); h+='</tbody></table></div>'; }
   else if(cat==='folio' && id==='folio_retiros'){ h+='<div class="rep-2col"><div><h6 style="font-size:.78rem;font-weight:800">Vaciados</h6><div class="table-responsive"><table class="table table-sm"><thead><tr><th>Fecha</th><th>Usuario</th><th class="text-end">Monto</th></tr></thead><tbody>'; (d.vaciados||[]).forEach(function(r){ h+='<tr><td style="font-size:.75rem">'+String(r.fecha).substring(0,16)+'</td><td>'+escH(r.usuario)+'</td><td class="text-end">'+fmtM(r.monto)+'</td></tr>'; }); h+='</tbody></table></div></div><div><h6 style="font-size:.78rem;font-weight:800">Egresos Caja</h6><div class="table-responsive"><table class="table table-sm"><thead><tr><th>Fecha</th><th>Categoria</th><th class="text-end">Monto</th></tr></thead><tbody>'; (d.movimientos||[]).forEach(function(r){ h+='<tr><td style="font-size:.75rem">'+String(r.fecha).substring(0,16)+'</td><td>'+escH(r.categoria)+'</td><td class="text-end">'+fmtM(r.monto)+'</td></tr>'; }); h+='</tbody></table></div></div></div>'; }
 else if((id==='folio_impuestos' || id==='cont_impuestos') && d.impuestos){ h+='<div class="table-responsive"><table class="table table-sm"><thead><tr><th>Fecha</th><th class="text-end">Ventas</th><th class="text-end">Bruto</th><th class="text-end">Base</th><th class="text-end">IVA</th><th class="text-end">ICO</th></tr></thead><tbody>'; d.impuestos.forEach(function(r){ h+='<tr><td>'+r.fecha+'</td><td class="text-end">'+r.ventas+'</td><td class="text-end">'+fmtM(r.bruto)+'</td><td class="text-end">'+fmtM(r.base)+'</td><td class="text-end" style="color:#7c3aed">'+fmtM(r.iva)+'</td><td class="text-end">'+fmtM(r.ico)+'</td></tr>'; }); h+='</tbody></table></div>'; }
 else if(cat==='folio' && id==='folio_propinas' && d.detalle){ h+='<div class="table-responsive"><table class="table table-sm"><thead><tr><th>Mesero</th><th class="text-end">Ventas</th><th class="text-end">Propina</th><th class="text-end">Efectivo</th><th class="text-end">Electronica</th></tr></thead><tbody>'; d.detalle.forEach(function(r){ h+='<tr><td>'+escH(r.mesero)+'</td><td class="text-end">'+r.ventas+'</td><td class="text-end" style="font-weight:700;color:#059669">'+fmtM(r.propina_total)+'</td><td class="text-end">'+fmtM(r.efectivo)+'</td><td class="text-end">'+fmtM(r.electronica)+'</td></tr>'; }); h+='</tbody></table></div><div style="font-size:.78rem">Total: <b>'+fmtM(d.totales.total)+'</b> Pozo 30%: <b>'+fmtM(d.totales.pozo)+'</b></div>'; }
 else if(cat==='folio' && id==='folio_pago' && d.desglose){ h+='<div class="table-responsive"><table class="table table-sm"><thead><tr><th>Metodo</th><th class="text-end">Cant</th><th class="text-end">Total</th><th class="text-end">%</th></tr></thead><tbody>'; d.desglose.forEach(function(r){ h+='<tr><td>'+escH(r.metodo)+'</td><td class="text-end">'+r.cantidad+'</td><td class="text-end" style="font-weight:700">'+fmtM(r.total)+'</td><td class="text-end">'+r.pct+'%</td></tr>'; }); h+='</tbody></table></div>'; }
 else if(cat==='folio' && id==='folio_zonas' && d.zonas){ h+='<div class="table-responsive"><table class="table table-sm"><thead><tr><th>Zona</th><th class="text-end">Ventas</th><th class="text-end">Total</th></tr></thead><tbody>'; d.zonas.forEach(function(r){ h+='<tr><td>'+escH(r.zona)+'</td><td class="text-end">'+r.ventas+'</td><td class="text-end" style="font-weight:700">'+fmtM(r.total)+'</td></tr>'; }); h+='</tbody></table></div>'; }
  else if(id==='aud_turnos'){ var arr=d.reporte||d.turnos||d.data||[]; if(!arr.length && d.filtros) arr=[]; h+='<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:10px 12px;margin-bottom:10px;font-size:.78rem;color:#065f46"><i class="bi bi-stopwatch me-1"></i><b>Turnos y Horas:</b> horas decimales (ej. 5.50 = 5h 30m), filtrado por fecha. Click <b>Ver</b> carga desde <code>/api/reportes/turnos</code>. Si la Caja está cerrada, el sistema bloquea <code>POST /api/turnos/abrir</code> con 403.</div>'; h+='<div class="table-responsive"><table class="table table-sm"><thead><tr><th>Empleado</th><th>Rol</th><th>Fecha</th><th>Apertura</th><th>Cierre</th><th class="text-end">Horas</th><th class="text-end">Total Facturado</th><th class="text-end">Comandas</th><th>Estado</th></tr></thead><tbody>'; if(!arr.length) h+='<tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:16px">Sin turnos en el rango. Abre un turno con Caja Abierta y cierra para calcular horas.</td></tr>'; else arr.slice(0,200).forEach(function(r){ var ap=String(r.fecha_hora_inicio||'').substring(0,19).replace('T',' '); var ci=r.fecha_hora_fin?String(r.fecha_hora_fin).substring(0,19).replace('T',' '):'<span style="color:#d97706">ABIERTO</span>'; var hrs=r.horas_trabajadas!=null?Number(r.horas_trabajadas).toFixed(2):'--'; h+='<tr><td style="font-weight:600">'+escH(r.empleado)+'</td><td><span class="badge" style="background:#e0e7ff;color:#3730a3">'+escH(r.rol)+'</span></td><td>'+String(r.fecha||'').substring(0,10)+'</td><td style="font-size:.75rem">'+ap+'</td><td style="font-size:.75rem">'+ci+'</td><td class="text-end" style="font-weight:800;color:#0f172a">'+hrs+'</td><td class="text-end" style="font-weight:700;color:#059669">'+fmtM(r.total_facturado)+'</td><td class="text-end">'+r.comandas_atendidas+'</td><td><span class="badge '+(r.estado==="CERRADO"?"bg-success":"bg-warning text-dark")+'">'+r.estado+'</span></td></tr>'; }); h+='</tbody></table></div>'; }
  else if(id==='aud_horario' && d.horario){ h+='<div class="table-responsive"><table class="table table-sm"><thead><tr><th>Usuario</th><th>Tipo</th><th>Fecha</th><th>Hora</th></tr></thead><tbody>'; d.horario.slice(0,100).forEach(function(r){ h+='<tr><td>'+escH(r.nombre)+'</td><td><span class="badge bg-secondary">'+r.tipo+'</span></td><td>'+String(r.fecha).substring(0,10)+'</td><td>'+String(r.timestamp).substring(11,16)+'</td></tr>'; }); h+='</tbody></table></div>'; }
 else if(id==='cont_facturas' && d.facturas){ h+='<div class="table-responsive"><table class="table table-sm"><thead><tr><th>ID</th><th>Fecha</th><th>Usuario</th><th>Metodo</th><th class="text-end">Total</th></tr></thead><tbody>'; d.facturas.slice(0,100).forEach(function(r){ h+='<tr><td>#'+r.id_pedido+'</td><td style="font-size:.75rem">'+String(r.fecha).substring(0,16)+'</td><td>'+escH(r.usuario)+'</td><td>'+escH(r.metodo)+'</td><td class="text-end" style="font-weight:700">'+fmtM(r.total)+'</td></tr>'; }); h+='</tbody></table></div>'; }
   else if(id==='cont_gastos' && d.gastos){ h+='<div class="rep-2col"><div><table class="table table-sm"><thead><tr><th>Categoria</th><th class="text-end">Total</th></tr></thead><tbody>'; (d.gastos.porCategoria||[]).forEach(function(r){ h+='<tr><td>'+escH(r.categoria)+'</td><td class="text-end">'+fmtM(r.total)+'</td></tr>'; }); h+='</tbody></table></div><div><table class="table table-sm"><thead><tr><th>Concepto</th><th class="text-end">Monto</th></tr></thead><tbody>'; (d.gastos.detalle||[]).slice(0,50).forEach(function(r){ h+='<tr><td>'+escH(r.concepto||r.categoria)+'</td><td class="text-end">'+fmtM(r.monto)+'</td></tr>'; }); h+='</tbody></table></div></div>'; }
  else if(id==='cont_stock' && d.stock){ var detFil=(d.stock.detalle||[]).filter(function(r){ return !repEsTest(r); }); var tV=detFil.reduce(function(a,r){ return a+(Number(r.valor_venta)||0); },0), tC=detFil.reduce(function(a,r){ return a+(Number(r.valor_costo)||0); },0), tU=tV-tC, mrg=tV>0?((tU/tV)*100).toFixed(1)+'%':'--'; h+='<div class="rep-kpis">' + '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:10px;text-align:center"><div style="font-size:.65rem;font-weight:800;color:#065f46;text-transform:uppercase">Valor venta</div><div style="font-weight:800;font-size:.95rem;color:#0f172a">'+fmtM(tV)+'</div></div>' + '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:10px;text-align:center"><div style="font-size:.65rem;font-weight:800;color:#991b1b;text-transform:uppercase">Valor costo</div><div style="font-weight:800;font-size:.95rem;color:#0f172a">'+fmtM(tC)+'</div></div>' + '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:10px;text-align:center"><div style="font-size:.65rem;font-weight:800;color:#1d4ed8;text-transform:uppercase">Utilidad</div><div style="font-weight:800;font-size:.95rem;color:#059669">'+fmtM(tU)+'</div></div>' + '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px;text-align:center"><div style="font-size:.65rem;font-weight:800;color:#475569;text-transform:uppercase">Margen / Items</div><div style="font-weight:800;font-size:.95rem;color:#0f172a">'+mrg+' · '+detFil.length+'</div></div></div>'; h+='<div class="table-responsive" style="border:1px solid #e2e8f0;border-radius:12px;overflow:auto;max-height:420px"><table class="table table-sm mb-0" style="font-size:.8rem"><thead style="position:sticky;top:0;z-index:2"><tr style="background:#0f172a;color:#fff"><th style="padding:10px 12px;color:#fff;border:none">Producto</th><th style="padding:10px 12px;color:#fff;border:none">Categoría</th><th class="text-end" style="padding:10px 12px;color:#fff;border:none">Stock</th><th class="text-end" style="padding:10px 12px;color:#fff;border:none">Venta Total</th><th class="text-end" style="padding:10px 12px;color:#fff;border:none">Costo Total</th><th class="text-end" style="padding:10px 12px;color:#fff;border:none">Utilidad</th></tr></thead><tbody>'; d.stock.detalle.filter(function(r){ return !repEsTest(r); }).slice(0,100).forEach(function(r,i){ var util=(r.utilidad!=null?r.utilidad:(r.ganancia!=null?r.ganancia:((Number(r.valor_venta)||0)-(Number(r.valor_costo)||0)))); var bg=(i%2===0)?'#fff':'#f8fafc'; var st=Number(r.stock)||0, mn=Number(r.minimo)||0, stC=st<=0?'#dc2626':(st<=mn?'#d97706':'#0f172a'); h+='<tr style="background:'+bg+';border-bottom:1px solid #f1f5f9"><td style="padding:8px 12px;font-weight:600">'+repText(r.nombre)+'</td><td style="padding:8px 12px"><span style="background:#eef2ff;color:#3730a3;font-size:.7rem;font-weight:700;padding:2px 8px;border-radius:20px">'+repText(r.categoria)+'</span></td><td class="text-end" style="padding:8px 12px;font-weight:800;color:'+stC+'">'+st+'</td><td class="text-end" style="padding:8px 12px">'+fmtM(r.valor_venta)+'</td><td class="text-end" style="padding:8px 12px;color:#64748b">'+fmtM(r.valor_costo)+'</td><td class="text-end" style="padding:8px 12px;font-weight:800;color:'+(Number(util)<0?'#dc2626':'#059669')+'">'+fmtM(util)+'</td></tr>'; }); h+='</tbody><tfoot><tr style="background:#0f172a;color:#fff;font-weight:800"><td colspan="3" style="padding:10px 12px;color:#fff">TOTALES</td><td class="text-end" style="padding:10px 12px;color:#fff">'+fmtM(tV)+'</td><td class="text-end" style="padding:10px 12px;color:#fff">'+fmtM(tC)+'</td><td class="text-end" style="padding:10px 12px;color:#4ade80">'+fmtM(tU)+'</td></tr></tfoot></table></div>'; }
  else if(id==='ticket_minimos' && d.bajoMinimos){ var nCrit=0, nBajo=0; d.bajoMinimos=d.bajoMinimos.filter(function(r){ return !repEsTest(r); }); d.bajoMinimos.forEach(function(r){ var s=Number(r.stock)||0; if(s<=0) nCrit++; else nBajo++; }); if(!d.bajoMinimos.length){ h+='<div style="text-align:center;padding:22px;border:1px dashed #bbf7d0;background:#f0fdf4;border-radius:12px;color:#065f46"><i class="bi bi-check-circle" style="font-size:1.4rem"></i><div style="font-weight:800;margin-top:4px">Stock al día</div><div style="font-size:.78rem">Sin productos bajo mínimo</div></div>'; } else { h+='<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:10px 12px;margin-bottom:10px;font-size:.78rem;color:#9a3412"><i class="bi bi-exclamation-triangle me-1"></i><b>'+d.bajoMinimos.length+' productos</b> requieren reposición: <b style="color:#dc2626">'+nCrit+' agotados</b> · <b style="color:#d97706">'+nBajo+' bajos</b></div>'; h+='<div class="table-responsive" style="border:1px solid #e2e8f0;border-radius:12px;overflow:auto;max-height:420px"><table class="table table-sm mb-0" style="font-size:.8rem"><thead style="position:sticky;top:0;z-index:2"><tr style="background:#0f172a;color:#fff"><th style="padding:10px 12px;color:#fff;border:none">Producto</th><th class="text-center" style="padding:10px 12px;color:#fff;border:none">Estado</th><th class="text-end" style="padding:10px 12px;color:#fff;border:none">Stock</th><th class="text-end" style="padding:10px 12px;color:#fff;border:none">Mínimo</th><th class="text-end" style="padding:10px 12px;color:#fff;border:none">Faltan</th></tr></thead><tbody>'; d.bajoMinimos.forEach(function(r,i){ var s=Number(r.stock)||0, m=Number(r.minimo)||0, f=Math.max(m-s,0), agot=s<=0, bg=(i%2===0)?'#fff':'#fff7ed'; h+='<tr style="background:'+bg+';border-bottom:1px solid #f1f5f9"><td style="padding:8px 12px;font-weight:600">'+repText(r.nombre)+'</td><td class="text-center" style="padding:8px 12px"><span style="font-size:.68rem;font-weight:800;padding:3px 10px;border-radius:20px;'+(agot?'background:#fee2e2;color:#991b1b':'background:#fef3c7;color:#92400e')+'">'+(agot?'AGOTADO':'BAJO')+'</span></td><td class="text-end" style="padding:8px 12px;font-weight:800;color:'+(agot?'#dc2626':'#d97706')+'">'+s+'</td><td class="text-end" style="padding:8px 12px;color:#64748b">'+m+'</td><td class="text-end" style="padding:8px 12px;font-weight:700">'+f+'</td></tr>'; }); h+='</tbody></table></div>'; } }
  else if(id==='ticket_resumido' && (d.kpis||d.desglose_metodos)){ var k=d.kpis||{}; var des=d.desglose_metodos||d.desglose||[]; h+='<div style="border:1px dashed #cbd5e1;border-radius:10px;padding:14px;background:#fff;font-family:monospace;font-size:.78rem"><div style="text-align:center;font-weight:800">CLUBMASTER - RESUMEN TURNO<br><small>TICKET 80mm</small></div><div style="border-top:1px dashed #e2e8f0;margin:10px 0"></div>'; h+='<div>Ingresos: <b>'+fmtM(k.ingresos)+'</b> | Ventas: <b>'+(k.num_ventas||0)+'</b> | Ticket: <b>'+fmtM(k.ticket_promedio)+'</b></div>'; h+='<div style="margin-top:8px"><b>Desglose:</b></div>'; des.slice(0,20).forEach(function(r){ h+='<div style="display:flex;justify-content:space-between"><span>'+escH(r.metodo)+' x'+r.cantidad+'</span><span>'+fmtM(r.total)+' ('+r.pct+'%)</span></div>'; }); h+='<div style="border-top:1px dashed #e2e8f0;margin:10px 0"></div><div style="text-align:center"><b>TOTAL '+fmtM(k.ingresos)+'</b></div></div>'; if(!des.length) h+='<div style="text-align:center;color:#94a3b8;padding:8px">Sin ventas en el filtro</div>'; }
   else if(id==='ticket_empleado'){
     var detArr = d.detallePorMesero || null;
     var mesResumen = d.meseros || (d.personal && d.personal.meseros) || [];
     if(detArr && detArr.length){
       var tg = d.totalesGenerales || (function(){ var a={ventas:0,total:0,propinas:0}; mesResumen.forEach(function(r){ a.ventas+=Number(r.ventas||0); a.total+=Number(r.total||0); a.propinas+=Number(r.propinas||r.propina_total||0); }); return a; })();
       h+='<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px"><div style="text-align:center"><div style="font-size:.65rem;font-weight:800;color:#475569;text-transform:uppercase">Ventas totales</div><div style="font-weight:800;font-size:1.1rem;color:#0f172a">'+tg.ventas+'</div></div><div style="text-align:center"><div style="font-size:.65rem;font-weight:800;color:#475569;text-transform:uppercase">Total vendido</div><div style="font-weight:800;font-size:1.1rem;color:#059669">'+fmtM(tg.total)+'</div></div><div style="text-align:center"><div style="font-size:.65rem;font-weight:800;color:#475569;text-transform:uppercase">Propinas</div><div style="font-weight:800;font-size:1.1rem;color:#d97706">'+fmtM(tg.propinas)+'</div></div></div>';
       h+='<div style="font-size:.75rem;color:#64748b;margin-bottom:10px"><i class="bi bi-info-circle me-1"></i>Desglose detallado por mesero — expanda cada sección para ver mesas y productos.</div>';
       detArr.forEach(function(mesero, idx){
         var trs = mesero.transacciones || [];
         var cons = mesero.consolidadoProductos || [];
         h+='<div style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:12px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.06)">'
           +'<div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);color:#fff;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">'
           +'<div style="display:flex;align-items:center;gap:10px"><div style="width:38px;height:38px;border-radius:10px;background:#10b981;display:flex;align-items:center;justify-content:center;font-weight:800">'+escH(String(mesero.nombre||"?").charAt(0).toUpperCase())+'</div><div><div style="font-weight:800;font-size:.92rem">'+escH(mesero.nombre)+'</div><div style="font-size:.72rem;opacity:.7">ID '+mesero.id_usuario+' · '+mesero.ventas+' ventas · Ticket '+fmtM(mesero.ticket_promedio)+'</div></div></div>'
           +'<div style="display:flex;gap:6px;flex-wrap:wrap"><span style="background:rgba(16,185,129,.2);border:1px solid rgba(16,185,129,.4);padding:6px 10px;border-radius:20px;font-size:.78rem;font-weight:700">Total '+fmtM(mesero.total)+'</span><span style="background:rgba(251,191,36,.2);border:1px solid rgba(251,191,36,.4);padding:6px 10px;border-radius:20px;font-size:.78rem;font-weight:700">Propinas '+fmtM(mesero.propinas)+'</span></div>'
           +'</div>';
         // 1. Desglose por transacción / mesa
         h+='<details open style="border-bottom:1px solid #f1f5f9"><summary style="padding:12px 16px;cursor:pointer;font-weight:800;font-size:.82rem;color:#0f172a;list-style:none;display:flex;justify-content:space-between;align-items:center"><span><i class="bi bi-table me-2" style="color:#6366f1"></i>Desglose por transacción / mesa ('+trs.length+')</span><span style="font-size:.70rem;color:#64748b;background:#f1f5f9;padding:4px 8px;border-radius:6px">'+(trs.length? 'Click para colapsar':'Sin ventas')+'</span></summary>';
         if(!trs.length){
           h+='<div style="padding:14px;text-align:center;color:#94a3b8;font-size:.82rem">Sin transacciones en el rango seleccionado</div>';
         } else {
           h+='<div style="padding:0 12px 12px;overflow:auto"><table class="table table-sm mb-0" style="font-size:.78rem;min-width:560px"><thead><tr style="background:#f8fafc"><th style="padding:8px 10px">Mesa</th><th style="padding:8px 10px">Hora</th><th style="padding:8px 10px">Factura / Comanda</th><th class="text-end" style="padding:8px 10px">Productos</th><th class="text-end" style="padding:8px 10px">Total</th><th class="text-end" style="padding:8px 10px">Propina</th></tr></thead><tbody>';
           trs.forEach(function(t){
             var fechaStr = String(t.fecha||'').replace('T',' ').substring(0,19);
             var hora = fechaStr.length>=16 ? fechaStr.substring(11,16) : '--:--';
             var mesaLbl = escH(t.mesa||t.mesa_nombre||'--');
             if(t.mesa_zona && t.mesa_zona!=='Sin zona') mesaLbl+=' <span style="font-size:.65rem;color:#64748b;background:#f1f5f9;padding:2px 6px;border-radius:4px;margin-left:4px">'+escH(t.mesa_zona)+'</span>';
             h+='<tr style="border-bottom:1px solid #f1f5f9"><td style="padding:8px 10px;font-weight:600">'+mesaLbl+'<div style="font-size:.68rem;color:#94a3b8">Mesa ID '+t.id_mesa+'</div></td><td style="padding:8px 10px;white-space:nowrap"><span style="background:#eff6ff;color:#1d4ed8;padding:3px 7px;border-radius:6px;font-weight:600">'+escH(hora)+'</span><div style="font-size:.68rem;color:#94a3b8">'+escH(fechaStr.substring(0,10))+'</div></td><td style="padding:8px 10px"><span style="font-family:monospace;font-weight:700;background:#f8fafc;border:1px solid #e2e8f0;padding:3px 7px;border-radius:6px">#'+t.id_pedido+'</span><div style="font-size:.68rem;color:#64748b">'+escH(t.metodo_pago||'--')+(t.cortesia?' <span style="color:#059669">· Cortesía</span>':'')+'</div></td><td class="text-end" style="padding:8px 10px">'+t.productos.length+' ítems</td><td class="text-end" style="padding:8px 10px;font-weight:700;color:#0f172a">'+fmtM(t.total)+'</td><td class="text-end" style="padding:8px 10px;color:#d97706">'+fmtM(t.propina)+'</td></tr>';
             // detalle productos de esta transacción
             if(t.productos && t.productos.length){
               h+='<tr><td colspan="6" style="padding:0 10px 10px;background:#f8fafc"><div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden"><div style="padding:6px 10px;background:#f1f5f9;font-size:.68rem;font-weight:800;color:#475569;text-transform:uppercase">Detalle productos — Factura #'+t.id_pedido+' · '+mesaLbl+'</div><table class="table table-sm mb-0" style="font-size:.75rem"><thead><tr style="background:#fff"><th style="padding:6px 10px">Producto</th><th class="text-center" style="padding:6px 10px">Cant.</th><th class="text-end" style="padding:6px 10px">Precio unit.</th><th class="text-end" style="padding:6px 10px">Subtotal</th></tr></thead><tbody>';
               t.productos.forEach(function(p){
                 h+='<tr><td style="padding:6px 10px">'+escH(p.nombre)+'</td><td class="text-center" style="padding:6px 10px"><span style="background:#0f172a;color:#fff;padding:2px 7px;border-radius:10px;font-weight:700;font-size:.72rem">'+p.cantidad+'</span></td><td class="text-end" style="padding:6px 10px">'+fmtM(p.precio_unitario)+'</td><td class="text-end" style="padding:6px 10px;font-weight:700">'+fmtM(p.subtotal)+'</td></tr>';
               });
               h+='</tbody></table></div></td></tr>';
             }
           });
           h+='</tbody></table></div>';
         }
         h+='</details>';
         // 2. Consolidado por producto
         h+='<details style="border-bottom:1px solid #f1f5f9"><summary style="padding:12px 16px;cursor:pointer;font-weight:800;font-size:.82rem;color:#0f172a;list-style:none;display:flex;justify-content:space-between;align-items:center"><span><i class="bi bi-box-seam me-2" style="color:#059669"></i>Totales por producto ('+cons.length+' productos)</span><span style="font-size:.70rem;color:#065f46;background:#ecfdf5;padding:4px 8px;border-radius:6px">Agrupado</span></summary>';
         if(!cons.length){
           h+='<div style="padding:14px;text-align:center;color:#94a3b8;font-size:.82rem">Sin productos para consolidar</div>';
         } else {
           h+='<div style="padding:0 12px 12px;overflow:auto"><table class="table table-sm mb-0" style="font-size:.78rem;min-width:420px"><thead><tr style="background:#f0fdf4"><th style="padding:8px 10px">Producto</th><th class="text-center" style="padding:8px 10px">Cantidad total</th><th class="text-end" style="padding:8px 10px">Precio ref.</th><th class="text-end" style="padding:8px 10px">Subtotal acumulado</th></tr></thead><tbody>';
           cons.forEach(function(p){
             h+='<tr style="border-bottom:1px solid #f1f5f9"><td style="padding:8px 10px;font-weight:600">'+escH(p.nombre)+'</td><td class="text-center" style="padding:8px 10px"><span style="background:#059669;color:#fff;padding:3px 8px;border-radius:10px;font-weight:800">'+p.cantidad_total+'</span></td><td class="text-end" style="padding:8px 10px">'+fmtM(p.precio_unitario)+'</td><td class="text-end" style="padding:8px 10px;font-weight:700;color:#059669">'+fmtM(p.subtotal_total)+'</td></tr>';
           });
           h+='</tbody></table></div>';
         }
         h+='</details>';
         // 3. Totales del turno / empleado
         h+='<div style="padding:12px 16px;background:#f8fafc;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;text-align:center">'
           +'<div><div style="font-size:.62rem;font-weight:800;color:#475569;text-transform:uppercase">Ventas</div><div style="font-weight:800;color:#0f172a">'+mesero.ventas+'</div></div>'
           +'<div><div style="font-size:.62rem;font-weight:800;color:#475569;text-transform:uppercase">Total vendido</div><div style="font-weight:800;color:#059669">'+fmtM(mesero.total)+'</div></div>'
           +'<div><div style="font-size:.62rem;font-weight:800;color:#475569;text-transform:uppercase">Propinas</div><div style="font-weight:800;color:#d97706">'+fmtM(mesero.propinas)+'</div></div>'
           +'<div><div style="font-size:.62rem;font-weight:800;color:#475569;text-transform:uppercase">Ticket prom.</div><div style="font-weight:800;color:#0f172a">'+fmtM(mesero.ticket_promedio)+'</div></div>'
           +'</div>';
         h+='</div>';
       });
     } else {
       var mes=mesResumen; h+='<div class="table-responsive"><table class="table table-sm"><thead><tr><th>Mesero</th><th class="text-end">Ventas</th><th class="text-end">Total</th><th class="text-end">Propinas</th><th class="text-end">Ticket</th></tr></thead><tbody>'; mes.forEach(function(r){ h+='<tr><td>'+escH(r.nombre||r.mesero)+'</td><td class="text-end">'+r.ventas+'</td><td class="text-end" style="font-weight:700">'+fmtM(r.total)+'</td><td class="text-end">'+fmtM(r.propinas||r.propina_total)+'</td><td class="text-end">'+fmtM(r.ticket_promedio||r.ticket_prom)+'</td></tr>'; }); h+='</tbody></table></div>'; if(!mes.length) h+='<div style="text-align:center;color:#94a3b8;padding:12px">Sin ventas por empleado en el filtro</div>'; else h+='<div style="margin-top:8px;padding:10px;background:#fef3c7;border:1px solid #fde68a;border-radius:8px;font-size:.78rem;color:#92400e"><i class="bi bi-exclamation-triangle me-1"></i>Detalle por mesa/productos no disponible: verifique que existan registros en <code>detalle_pedido</code> para el rango seleccionado.</div>';
     }
   }
  else if(id==='ticket_barra' && (d.zonas||d.tiempos)){ var zonas=d.zonas||[]; h+='<div class="table-responsive"><table class="table table-sm"><thead><tr><th>Barra / Zona</th><th class="text-end">Ventas</th><th class="text-end">Total</th></tr></thead><tbody>'; zonas.forEach(function(r){ h+='<tr><td>'+escH(r.zona)+'</td><td class="text-end">'+r.ventas+'</td><td class="text-end" style="font-weight:700">'+fmtM(r.total)+'</td></tr>'; }); h+='</tbody></table></div>'; if(d.tiempos && d.tiempos.length){ h+='<div style="margin-top:10px;font-size:.78rem;font-weight:800">Tiempos despacho (min)</div><div class="table-responsive"><table class="table table-sm"><thead><tr><th>Pedido</th><th>Bartender</th><th class="text-end">Tiempo</th></tr></thead><tbody>'; d.tiempos.slice(0,20).forEach(function(r){ h+='<tr><td>#'+r.id_pedido+'</td><td>'+escH(r.bartender||'--')+'</td><td class="text-end">'+(r.tiempo_minutos!=null?r.tiempo_minutos+"m":"--")+'</td></tr>'; }); h+='</tbody></table></div>'; } if(!zonas.length) h+='<div style="text-align:center;color:#94a3b8;padding:12px">Sin ventas por barra</div>'; }
  else if(id==='ticket_anuladas' && (d.anuladas||d.eliminadas)){ var an=d.anuladas||d.eliminadas||[]; h+='<div class="table-responsive"><table class="table table-sm"><thead><tr><th>Fecha</th><th>Tipo</th><th>Usuario</th><th>Motivo</th></tr></thead><tbody>'; an.slice(0,100).forEach(function(r){ h+='<tr><td style="font-size:.75rem">'+String(r.fecha||r.created_at||'').substring(0,16)+'</td><td><span class="badge bg-danger">'+escH(r.tipo)+'</span></td><td>'+escH(r.usuario)+'</td><td>'+escH(r.motivo||r.descripcion||'--')+'</td></tr>'; }); h+='</tbody></table></div>'; if(!an.length) h+='<div style="text-align:center;color:#10b981;padding:12px">Sin ventas anuladas</div>'; }
  else if(id==='ticket_cierres' && d.cierres){ h+='<div class="table-responsive"><table class="table table-sm"><thead><tr><th>Jornada</th><th>Estado</th><th class="text-end">Inicial</th><th class="text-end">Esperado</th><th class="text-end">Real</th><th class="text-end">Dif</th></tr></thead><tbody>'; d.cierres.slice(0,20).forEach(function(r){ h+='<tr><td>#'+r.id_jornada+' '+String(r.fecha_apertura||'').substring(0,16)+'</td><td><span class="badge '+(String(r.estado||'').toUpperCase()==='CERRADA'?"bg-success":"bg-warning")+'">'+escH(r.estado)+'</span></td><td class="text-end">'+fmtM(r.monto_inicial)+'</td><td class="text-end">'+fmtM(r.total_efectivo_esperado)+'</td><td class="text-end">'+fmtM(r.total_efectivo_real)+'</td><td class="text-end" style="color:'+(Number(r.diferencia)<0?"#dc2626":"#059669")+'">'+fmtM(r.diferencia)+'</td></tr>'; }); h+='</tbody></table></div>'; if(!d.cierres.length) h+='<div style="text-align:center;color:#94a3b8;padding:12px">Sin cierres registrados</div>'; }
  else { h+= repReportePreview(cat,id,false); }
 h+='</div>'; return h;
}
function repEjecutarReporte(cat,id,ticket){
 var arr=REP_CATALOG[cat]||[]; var rep=arr.find(function(r){return r.id===id;}); if(!rep) return;
 var filtrosTxt=[]; if(repFiltros.fecha_inicio) filtrosTxt.push('Desde '+repFiltros.fecha_inicio); if(repFiltros.fecha_fin) filtrosTxt.push('Hasta '+repFiltros.fecha_fin); if(repFiltros.id_jornada) filtrosTxt.push('Jornada #'+repFiltros.id_jornada); if(repFiltros.id_mesero) filtrosTxt.push('Empleado #'+repFiltros.id_mesero); if(!filtrosTxt.length) filtrosTxt.push('Sin filtros - rango 30 dias');
 var formato=ticket? 'TICKET 80mm':'FOLIO / PANTALLA';
 var icon=rep.icon;
   var html='<div class="rep-mhead"><div class="rep-mhead-main"><span class="rep-mhead-icon"><i class="bi '+icon+'"></i></span><div style="min-width:0"><div class="rep-mhead-title">'+rep.titulo+'</div><div class="rep-mhead-sub">'+cat.toUpperCase()+' - '+formato+'</div></div></div><button class="rep-mclose" aria-label="Cerrar" onclick="repCerrarModal()"><i class="bi bi-x-lg"></i></button></div>'
    +'<div class="rep-mbody"><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;margin-bottom:12px"><div style="font-size:.7rem;font-weight:800;color:#475569;text-transform:uppercase;margin-bottom:6px"><i class="bi bi-info-circle me-1"></i>'+rep.desc+'</div><div style="font-size:.78rem;color:#334155;overflow-wrap:anywhere"><strong>Filtros:</strong> '+filtrosTxt.join(' - ')+'</div><div style="font-size:.72rem;color:#64748b;margin-top:6px">Formato: <strong>'+formato+'</strong> - Generado: '+new Date().toLocaleString('es-CO')+'</div></div><div id="repLive"><div style="text-align:center;padding:20px"><div class="spinner-border spinner-border-sm text-primary"></div> Cargando datos reales...</div></div><div class="rep-mfoot"><button class="btn btn-sm" style="background:#fff;border:1px solid #e2e8f0;border-radius:8px" onclick="repCerrarModal()">Cerrar</button><button class="btn btn-sm" style="background:#0f172a;color:#fff;border-radius:8px" onclick="repImprimirDetallado()"><i class="bi bi-printer me-1"></i>Imprimir</button></div></div>';
  repAbrirModal(html);
  if(id==='reimprimir'){ document.getElementById('repLive').innerHTML=repReportePreview(cat,id,ticket); return; }
  try{ if(repAbort) repAbort.abort(); }catch(e){}
  repAbort=(typeof AbortController!=='undefined')?new AbortController():null;
  var repSig=repAbort?repAbort.signal:undefined;
  var repBtns=document.querySelectorAll('.rep-btn-ver,.rep-btn-print'); repBtns.forEach(function(b){ b.disabled=true; });
  function repFin(){ repBtns.forEach(function(b){ b.disabled=false; }); if(repAbort&&repAbort.signal===repSig) repAbort=null; }
   if(id==='aud_turnos'){
    fetch(API_REPORTES+'/api/reportes/turnos'+repQs(),{signal:repSig}).then(function(r){return r.json().then(function(d){return {ok:r.ok,d:d};});}).then(function(w){
      var live=document.getElementById('repLive'); if(!live) return;
      if(!w.ok||!w.d.success){ live.innerHTML='<div class="alert alert-danger">'+escH(w.d.mensaje||'Error')+'</div>'; return; }
      if(w.d.aviso) live.innerHTML='<div class="alert alert-warning">'+escH(w.d.aviso)+'</div>';
      else live.innerHTML=repRenderLive(w.d,cat,id);
    }).catch(function(e){ if(e&&e.name==='AbortError') return; var live=document.getElementById('repLive'); if(live) live.innerHTML='<div class="alert alert-danger">No se pudo conectar</div>'; }).then(repFin);
    return;
  }
  fetch(API_REPORTES+'/api/reportes/ejecutar/'+cat+'/'+id+repQs(),{signal:repSig}).then(function(r){return r.json().then(function(d){return {ok:r.ok,d:d};});}).then(function(w){
   var live=document.getElementById('repLive'); if(!live) return;
   if(!w.ok||!w.d.success){ console.error('[reporte] error técnico:', w.d); live.innerHTML='<div class="alert alert-danger" style="border-left:4px solid #dc2626"><strong><i class="bi bi-x-circle-fill me-1"></i>Error al cargar reporte</strong><br><span style="font-size:.82rem">'+escH(w.d.mensaje||'Error')+'</span><br><small style="color:#7f1d1d">Detalle técnico en consola / logs del servidor</small></div>'; return; }
   if(w.d.aviso){ live.innerHTML='<div class="alert alert-warning">'+escH(w.d.aviso)+'</div>'; return; }
   live.innerHTML=repRenderLive(w.d,cat,id);
   // si no hay datos, mostrar mensaje claro (sin placeholder confuso)
   try{ if(!live.innerHTML || live.innerHTML.trim()==='') live.innerHTML='<div style="text-align:center;color:#94a3b8;padding:16px">Sin datos para los filtros seleccionados</div>'; }catch(e){}
  }).catch(function(e){ if(e&&e.name==='AbortError') return; console.error('[reporte] fetch error:', e); var live=document.getElementById('repLive'); if(live) live.innerHTML='<div class="alert alert-danger"><strong>Error de conexión</strong><br><span style="font-size:.82rem">'+escH(e.message||'No se pudo conectar')+'</span></div>'; }).then(repFin);
}
function repReportePreview(cat,id,ticket){ if(cat==='ticket' && id==='reimprimir'){ return '<div style="border:1px dashed #cbd5e1;border-radius:10px;padding:14px;background:#fff;font-family:monospace;font-size:.8rem"><div style="text-align:center;font-weight:800">CLUBMASTER<br><small style="font-weight:400">NIT 900.000.000-1</small></div><div style="border-top:1px dashed #e2e8f0;margin:10px 0"></div><div style="display:flex;gap:6px"><input id="repReimpInput" class="form-control form-control-sm" placeholder="No Factura" style="flex:1"><button class="btn btn-sm" style="background:#0f172a;color:#fff;border-radius:8px" onclick="repReimprimirBuscar()"><i class="bi bi-search"></i></button></div><div id="repReimpResult" style="margin-top:10px;color:#64748b;text-align:center;padding:12px"><i class="bi bi-receipt"></i> Ingrese numero</div></div>'; } return '<div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px;text-align:center;color:#64748b;font-size:.82rem">Vista previa: '+escH(id)+' - datos reales arriba</div>'; }
function repAbrirModal(html){ var m=document.getElementById('repModal'); if(!m){ m=document.createElement('div'); m.id='repModal'; m.style.cssText='position:fixed;inset:0;z-index:1055;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:12px;backdrop-filter:blur(2px)'; m.innerHTML='<div id="repModalBox" style="width:100%;max-width:760px;max-height:90vh;overflow:auto;background:#fff;border-radius:16px;box-shadow:0 25px 60px rgba(0,0,0,.35)"></div>'; m.addEventListener('click',function(e){ if(e.target===m) repCerrarModal(); }); document.body.appendChild(m); } document.getElementById('repModalBox').innerHTML=html; m.style.display='flex'; try{ document.body.style.overflow='hidden'; }catch(e){} if(!m._esc){ m._esc=true; document.addEventListener('keydown',function(e){ if(e.key==='Escape') repCerrarModal(); }); } }
function repImprimirDetallado(){ try{ document.querySelectorAll('#repModalBox details').forEach(function(d){ d.open=true; }); }catch(e){} setTimeout(function(){ window.print(); }, 80); }
function repCerrarModal(){ var m=document.getElementById('repModal'); if(m) m.style.display='none'; try{ document.body.style.overflow=''; }catch(e){} try{ if(repAbort) repAbort.abort(); }catch(e){} }
function repReimprimirBuscar(){ var v=document.getElementById('repReimpInput').value.trim(); if(!v){ repError('Ingrese número de factura'); return; } if(!/^\d+$/.test(v)){ repError('Solo números'); return; } var r=document.getElementById('repReimpResult'); r.innerHTML='<div class="spinner-border spinner-border-sm text-primary"></div> Buscando...'; fetch(API_REPORTES+'/api/facturas/buscar?q='+encodeURIComponent(v)).then(function(res){return res.json().then(function(d){return {ok:res.ok,d:d};});}).then(function(w){ if(w.ok && w.d.success && w.d.factura){ var f=w.d.factura; r.innerHTML='<div style="text-align:left;font-family:monospace;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px"><div style="font-weight:800;text-align:center">FACTURA #'+escH(f.id_factura||f.id_pedido||v)+'<br><small>'+escH(f.fecha||f.timestamp_despacho||'')+'</small></div><div style="margin-top:8px">Total: <strong>'+fmtM(f.total||0)+'</strong><br>Metodo: '+escH(f.metodo_pago||'')+'<br>Estado: '+escH(f.estado||'')+'</div><button class="btn btn-sm w-100 mt-2" style="background:#0f172a;color:#fff;border-radius:8px" onclick="window.print()"><i class="bi bi-printer me-1"></i>Reimprimir</button></div>'; } else r.innerHTML='<div style="color:#dc2626">'+escH(w.d.mensaje||'No encontrada')+'</div>'; }).catch(function(){ r.innerHTML='<div class="alert alert-danger">No se pudo conectar</div>'; }); }
function repExportar(){ var tipo=document.getElementById('repExportTipo').value; var ok=['general','personal','zonas','margen','mermas','familias','nocturna']; if(ok.indexOf(tipo)===-1){ repError('Tipo de exportación inválido'); return; } var qs=repQs(); var url=API_REPORTES+'/api/reportes/export?tipo='+encodeURIComponent(tipo)+(qs.startsWith('?')?'&'+qs.substring(1):''); window.open(url,'_blank'); }
var repRenderLiveBase = repRenderLive;
repRenderLive = function(data, cat, id){
  if(!(id==='cont_stock' && (data.data||data).stock)) return repRenderLiveBase(data, cat, id);
  var d = data.data || data;
  var det = (d.stock.detalle||[]).filter(function(r){ var s=String((r&&r.nombre)||'')+' '+String((r&&r.categoria)||''); return s.toUpperCase().indexOf('TEST-BUG')===-1; }).slice(0,100);
  var tV = det.reduce(function(a,r){ return a+(Number(r.valor_venta)||0); },0);
  var tC = det.reduce(function(a,r){ return a+(Number(r.valor_costo)||0); },0);
  var tU = tV - tC;
  var mrg = tV>0 ? ((tU/tV)*100).toFixed(1)+'%' : '--';
  var wrap = document.createElement('div');
  wrap.style.marginTop = '12px';
  var grid = document.createElement('div');
  grid.className = 'rep-kpis';
  var cards = [['VALOR VENTA', fmtM(tV), '#065f46', '#f0fdf4', '#bbf7d0'], ['VALOR COSTO', fmtM(tC), '#991b1b', '#fef2f2', '#fecaca'], ['UTILIDAD', fmtM(tU), '#1d4ed8', '#eff6ff', '#bfdbfe'], ['MARGEN / ITEMS', mrg+' - '+det.length, '#475569', '#f8fafc', '#e2e8f0']];
  cards.forEach(function(c){
    var k = document.createElement('div');
    k.style.cssText = 'background:'+c[3]+';border:1px solid '+c[4]+';border-radius:10px;padding:10px;text-align:center';
    var l = document.createElement('div');
    l.style.cssText = 'font-size:.65rem;font-weight:800;color:'+c[2]+';text-transform:uppercase';
    l.textContent = c[0];
    var v = document.createElement('div');
    v.style.cssText = 'font-weight:800;font-size:.95rem;color:#0f172a';
    v.textContent = c[1];
    k.appendChild(l); k.appendChild(v); grid.appendChild(k);
  });
  wrap.appendChild(grid);
  if(!det.length){
    var ok = document.createElement('div');
    ok.style.cssText = 'text-align:center;padding:22px;border:1px dashed #bbf7d0;background:#f0fdf4;border-radius:12px;color:#065f46;font-weight:700';
    ok.textContent = 'Sin productos para valorizar (filtro TEST-BUG aplicado)';
    wrap.appendChild(ok);
    return wrap.outerHTML;
  }
  var box = document.createElement('div');
  box.style.cssText = 'border:1px solid #e2e8f0;border-radius:12px;max-height:420px;overflow:auto';
  var table = document.createElement('table');
  table.className = 'table table-sm mb-0';
  table.style.fontSize = '.8rem';
  table.style.width = '100%';
  var thead = document.createElement('thead');
  thead.style.position = 'sticky'; thead.style.top = '0'; thead.style.zIndex = '2';
  var hr = document.createElement('tr');
  ['Producto','Categoría','Cant. Stock','Venta Total','Costo Total','Utilidad'].forEach(function(t, i){
    var th = document.createElement('th');
    th.textContent = t;
    th.style.background = '#0f172a'; th.style.color = '#fff'; th.style.padding = '10px 12px'; th.style.border = 'none';
    if(i>=2) th.style.textAlign = 'right';
    hr.appendChild(th);
  });
  thead.appendChild(hr); table.appendChild(thead);
  var tb = document.createElement('tbody');
  det.forEach(function(r, i){
    var util = (r.utilidad!=null) ? Number(r.utilidad) : ((r.ganancia!=null) ? Number(r.ganancia) : ((Number(r.valor_venta)||0)-(Number(r.valor_costo)||0)));
    var tr = document.createElement('tr');
    tr.style.background = (i%2===0) ? '#fff' : '#f8fafc';
    var c0 = document.createElement('td'); c0.style.cssText = 'padding:8px 12px;font-weight:600'; c0.textContent = String(r.nombre||'');
    var c1 = document.createElement('td'); c1.style.padding = '8px 12px';
    var badge = document.createElement('span');
    badge.style.cssText = 'background:#eef2ff;color:#3730a3;font-size:.7rem;font-weight:700;padding:2px 8px;border-radius:20px';
    badge.textContent = String(r.categoria||'General');
    c1.appendChild(badge);
    var st = Number(r.stock)||0, mn = Number(r.minimo)||0;
    var c2 = document.createElement('td'); c2.style.cssText = 'padding:8px 12px;font-weight:800;text-align:right;color:'+(st<=0?'#dc2626':(st<=mn?'#d97706':'#0f172a')); c2.textContent = String(st);
    var c3 = document.createElement('td'); c3.style.cssText = 'padding:8px 12px;text-align:right'; c3.textContent = fmtM(r.valor_venta);
    var c4 = document.createElement('td'); c4.style.cssText = 'padding:8px 12px;text-align:right;color:#64748b'; c4.textContent = fmtM(r.valor_costo);
    var c5 = document.createElement('td'); c5.style.cssText = 'padding:8px 12px;font-weight:800;text-align:right;color:'+(util<0?'#dc2626':'#059669'); c5.textContent = fmtM(util);
    [c0,c1,c2,c3,c4,c5].forEach(function(c){ tr.appendChild(c); });
    tb.appendChild(tr);
  });
  table.appendChild(tb);
  var tf = document.createElement('tfoot');
  var fr = document.createElement('tr'); fr.style.background = '#0f172a';
  var f0 = document.createElement('td'); f0.colSpan = '3'; f0.style.cssText = 'padding:10px 12px;color:#fff;font-weight:800'; f0.textContent = 'TOTALES ('+det.length+' items)';
  var f1 = document.createElement('td'); f1.style.cssText = 'padding:10px 12px;color:#fff;font-weight:800;text-align:right'; f1.textContent = fmtM(tV);
  var f2 = document.createElement('td'); f2.style.cssText = 'padding:10px 12px;color:#fff;font-weight:800;text-align:right'; f2.textContent = fmtM(tC);
  var f3 = document.createElement('td'); f3.style.cssText = 'padding:10px 12px;color:#4ade80;font-weight:800;text-align:right'; f3.textContent = fmtM(tU);
  [f0,f1,f2,f3].forEach(function(c){ fr.appendChild(c); });
  tf.appendChild(fr); table.appendChild(tf);
  box.appendChild(table); wrap.appendChild(box);
  return wrap.outerHTML;
};
// =========================================================
// WHATSAPP INTEGRATION - ClubMaster
// =========================================================
// WHATSAPP INTEGRATION - ClubMaster (v2: selector + compat)
// ÚNICO botón superior; modal con TIPO DE REPORTE *
// =========================================================
var repCurrentCat = '';
var repCurrentId = '';
var repWAConfig = null;
var repWALoading = false;

function repToastSuccess(msg){
  try{ if(typeof mostrarToast==='function'){ mostrarToast('success', msg); return; } }catch(e){}
  try{ if(typeof mostrarAlerta==='function'){ mostrarAlerta('success', msg); return; } }catch(e){}
  repToast(msg);
}
function repBuildWAUrl(path){
  var base = (typeof API_REPORTES!=='undefined' && API_REPORTES) ? String(API_REPORTES).trim() : '';
  if(!base) return path;
  if(base.endsWith('/')) base = base.slice(0,-1);
  // evitar doble /api si base ya termina en /api
  if(base.endsWith('/api') && path.startsWith('/api')) return base + path.slice(4);
  return base + path;
}
function repFetchWAConfig(cb){
  var url = repBuildWAUrl('/api/whatsapp/config');
  fetch(url, { headers:{'Accept':'application/json'}, credentials:'same-origin' }).then(function(r){
    return r.text().then(function(txt){
      var d; try{ d=JSON.parse(txt); }catch(e){
        // si es HTML <!DOCTYPE, reportar amigable
        if(txt.trim().startsWith('<!DOCTYPE') || txt.trim().startsWith('<html')) d={success:false, mensaje:'Respuesta HTML ('+r.status+'): endpoint no encontrado'};
        else d={success:false, mensaje:'Respuesta no JSON ('+r.status+')'};
      }
      return {ok:r.ok, status:r.status, d:d, txt:txt};
    });
  }).then(function(w){
    if(w.ok && w.d && w.d.success) repWAConfig = w.d;
    if(cb) cb(w.d);
  }).catch(function(){ if(cb) cb(null); });
}
function repBuildWAReportOptions(selectedValue){
  var html = '';
  var groups = {ticket:'— Ticket', folio:'— Folio', auditoria:'— Auditoría', contable:'— Contable'};
  Object.keys(REP_CATALOG).forEach(function(cat){
    var label = groups[cat]||cat;
    html += '<optgroup label="'+escH(label)+'">';
    (REP_CATALOG[cat]||[]).forEach(function(o){
      var val = cat+':'+o.id;
      var sel = (val===selectedValue) ? ' selected' : '';
      html += '<option value="'+escH(val)+'"'+sel+'>'+escH(o.titulo)+' ('+escH(cat)+')</option>';
    });
    html += '</optgroup>';
  });
  return html;
}
function repGetWAInfoFromVal(val){
  if(!val || val.indexOf(':')===-1) return null;
  var parts = val.split(':');
  var cat = parts[0], id = parts.slice(1).join(':');
  var arr = REP_CATALOG[cat]||[];
  var found = arr.find(function(x){return x.id===id;});
  return {cat:cat, id:id, titulo: found?found.titulo:id, desc: found?found.desc:''};
}
function repWAOnReporteChange(){
  var sel = document.getElementById('repWAReporte');
  var val = sel? sel.value : '';
  var info = repGetWAInfoFromVal(val);
  var titleEl = document.getElementById('repWAReporteTitulo');
  var subEl = document.getElementById('repWAReporteSub');
  var msgEl = document.getElementById('repWAMsg');
  if(info){
    if(titleEl) titleEl.textContent = info.titulo;
    if(subEl) subEl.textContent = info.cat.toUpperCase()+' / '+info.id;
    // actualizar mensaje por defecto si el usuario no ha escrito uno custom
    if(msgEl && !msgEl.dataset.userEdited){
      var filtrosRango = (repFiltros.fecha_inicio||repFiltros.fecha_fin) ? (repFiltros.fecha_inicio||'...')+' al '+(repFiltros.fecha_fin||'...') : 'turno actual';
      msgEl.placeholder = 'Hola, adjuntamos el reporte de '+info.titulo+' correspondiente al turno del '+filtrosRango;
    }
  }
}
function repAbrirWhatsAppModal(){
  // determinar valor preseleccionado: contexto previo, tab activo o primer contable relevante
  var preselected = '';
  if(repCurrentCat && repCurrentId) preselected = repCurrentCat+':'+repCurrentId;
  else {
    var tab = repTab || 'contable';
    var arr = REP_CATALOG[tab]||[];
    if(arr.length) preselected = tab+':'+arr[0].id;
    else {
      // fallback: buscar cont_gastos / cont_stock etc
      var fallback = 'contable:cont_gastos';
      preselected = fallback;
    }
  }
  var filtrosTxt = [];
  if(repFiltros.fecha_inicio) filtrosTxt.push('Desde '+repFiltros.fecha_inicio);
  if(repFiltros.fecha_fin) filtrosTxt.push('Hasta '+repFiltros.fecha_fin);
  if(repFiltros.id_jornada) filtrosTxt.push('Jornada #'+repFiltros.id_jornada);
  if(repFiltros.id_mesero) filtrosTxt.push('Empleado #'+repFiltros.id_mesero);
  if(!filtrosTxt.length) filtrosTxt.push('Sin filtros (últimos 30 días)');
  var adminPhoneTxt = (repWAConfig && repWAConfig.adminPhone) ? repWAConfig.adminPhone : '(no configurado)';
  var optionsHtml = repBuildWAReportOptions(preselected);
  var infoInit = repGetWAInfoFromVal(preselected);
  var tituloInit = infoInit? infoInit.titulo : 'Seleccionar reporte';
  var subInit = infoInit? (infoInit.cat.toUpperCase()+' / '+infoInit.id) : '';
  var html = '<div class="rep-mhead" style="background:#128C7E"><div class="rep-mhead-main"><span class="rep-mhead-icon" style="background:rgba(255,255,255,.18)"><i class="bi bi-whatsapp"></i></span><div style="min-width:0"><div class="rep-mhead-title">Enviar por WhatsApp</div><div id="repWAReporteSub" class="rep-mhead-sub">'+escH(subInit)+'</div></div></div><button class="rep-mclose" aria-label="Cerrar" onclick="repCerrarWAModal()" style="background:rgba(255,255,255,.18)"><i class="bi bi-x-lg"></i></button></div>'
    +'<div class="rep-mbody">'
    +'<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:10px 12px;margin-bottom:12px;font-size:.78rem;color:#065f46"><i class="bi bi-info-circle me-1"></i>Se generará dinámicamente el documento (<b>PDF</b> o <b>Excel</b>) con el desglose del turno/jornada y se enviará como adjunto al número indicado.</div>'
    +'<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;margin-bottom:12px"><div style="font-size:.72rem;font-weight:800;color:#475569;text-transform:uppercase;margin-bottom:4px">Filtros activos</div><div style="font-size:.75rem;color:#64748b">'+escH(filtrosTxt.join(' • '))+'</div><div id="repWAReporteTitulo" style="font-weight:700;color:#0f172a;margin-top:6px">'+escH(tituloInit)+'</div></div>'
    +'<div style="display:grid;grid-template-columns:1fr;gap:10px">'
    +'<div><label style="font-size:.72rem;font-weight:800;color:#475569;text-transform:uppercase">TIPO DE REPORTE *</label><select id="repWAReporte" class="form-select" style="border-radius:10px;min-height:44px" onchange="repWAOnReporteChange()">'+optionsHtml+'</select><div style="font-size:.68rem;color:#64748b;margin-top:4px">Seleccione qué reporte generar y enviar. Ej: <b>Gastos Operativos</b>, <b>Resumen Facturas</b>, <b>Valoración Stock</b>, <b>Ventas x Empleado</b>.</div></div>'
    +'<div><label style="font-size:.72rem;font-weight:800;color:#475569;text-transform:uppercase">Número destino *</label><input id="repWATel" type="tel" class="form-control" placeholder="+57 300 123 4567" style="border-radius:10px;min-height:44px"><div style="font-size:.7rem;color:#64748b;margin-top:4px">Formato E.164 con código país. Admin preconfigurado: <b>'+escH(adminPhoneTxt)+'</b> <a href="#" onclick="repWAUsarAdmin();return false;" style="color:#128C7E;font-weight:700">Usar admin</a></div></div>'
    +'<div><label style="font-size:.72rem;font-weight:800;color:#475569;text-transform:uppercase">Formato de envío *</label><div style="display:flex;gap:8px"><label style="flex:1;display:flex;align-items:center;gap:8px;border:1px solid #e2e8f0;border-radius:10px;padding:10px;cursor:pointer;background:#fff"><input type="radio" name="repWAFormato" value="pdf" checked><span style="font-weight:700"><i class="bi bi-file-earmark-pdf me-1" style="color:#dc2626"></i>PDF</span><span style="font-size:.68rem;color:#64748b">pdfkit</span></label><label style="flex:1;display:flex;align-items:center;gap:8px;border:1px solid #e2e8f0;border-radius:10px;padding:10px;cursor:pointer;background:#fff"><input type="radio" name="repWAFormato" value="excel"><span style="font-weight:700"><i class="bi bi-file-earmark-spreadsheet me-1" style="color:#059669"></i>Excel</span><span style="font-size:.68rem;color:#64748b">exceljs</span></label></div></div>'
    +'<div><label style="font-size:.72rem;font-weight:800;color:#475569;text-transform:uppercase">Mensaje (opcional)</label><textarea id="repWAMsg" class="form-control" rows="2" style="border-radius:10px;font-size:.82rem" placeholder="Hola, adjuntamos el reporte de ventas correspondiente al turno del [Fecha/Hora]"></textarea><div style="font-size:.68rem;color:#94a3b8;margin-top:4px">Si lo deja vacío se usará el saludo por defecto con fecha/hora.</div></div>'
    +'</div>'
    +'<div id="repWAStatus" style="margin-top:12px"></div>'
    +'<div class="rep-mfoot" style="margin-top:14px"><button class="btn btn-sm" style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;min-height:44px" onclick="repCerrarWAModal()">Cancelar</button><button id="repWABtnEnviar" class="btn btn-sm" style="background:#25D366;color:#fff;border-radius:8px;font-weight:800;min-height:44px;flex:1" onclick="repEnviarWhatsApp()"><i class="bi bi-whatsapp me-1"></i>Enviar por WhatsApp</button></div>'
    +'</div>';
  repAbrirWAModal(html);
  // listeners
  var msgElInit = document.getElementById('repWAMsg');
  if(msgElInit) msgElInit.addEventListener('input', function(){ this.dataset.userEdited='1'; });
  repWAOnReporteChange();
  if(!repWAConfig) repFetchWAConfig(function(d){
    if(d && d.adminPhone){
      var el=document.getElementById('repWATel');
      if(el && !el.value) el.value = d.adminPhone;
      var adminTxt = document.querySelector('#repWAModalBox');
      // actualizar texto admin si aparece
    }
  });
  else {
    var el2=document.getElementById('repWATel');
    if(el2 && repWAConfig.adminPhone) el2.value = repWAConfig.adminPhone;
  }
}
function repWAUsarAdmin(){
  if(repWAConfig && repWAConfig.adminPhone){
    document.getElementById('repWATel').value = repWAConfig.adminPhone;
  } else {
    repFetchWAConfig(function(d){
      if(d && d.adminPhone) document.getElementById('repWATel').value = d.adminPhone;
      else repError('Número de administrador no configurado. Defina WHATSAPP_ADMIN_PHONE en .env');
    });
  }
}
function repAbrirWAModal(html){
  var m=document.getElementById('repWAModal');
  if(!m){
    m=document.createElement('div'); m.id='repWAModal';
    m.style.cssText='position:fixed;inset:0;z-index:1060;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:12px;backdrop-filter:blur(2px)';
    m.innerHTML='<div id="repWAModalBox" style="width:100%;max-width:560px;max-height:92vh;overflow:auto;background:#fff;border-radius:16px;box-shadow:0 25px 60px rgba(0,0,0,.35)"></div>';
    m.addEventListener('click', function(e){ if(e.target===m) repCerrarWAModal(); });
    document.body.appendChild(m);
    document.addEventListener('keydown', function(e){ if(e.key==='Escape'){ var mm=document.getElementById('repWAModal'); if(mm && mm.style.display!=='none') repCerrarWAModal(); }});
  }
  document.getElementById('repWAModalBox').innerHTML = html;
  m.style.display='flex';
  try{ document.body.style.overflow='hidden'; }catch(e){}
}
function repCerrarWAModal(){
  var m=document.getElementById('repWAModal');
  if(m) m.style.display='none';
  try{ document.body.style.overflow=''; }catch(e){}
}
function repEnviarWhatsApp(){
  if(repWALoading) return;
  var selEl=document.getElementById('repWAReporte');
  var selVal= selEl? selEl.value : '';
  if(!selVal){ repError('Seleccione TIPO DE REPORTE *'); if(selEl) selEl.focus(); return; }
  var info = repGetWAInfoFromVal(selVal);
  if(!info){ repError('Reporte inválido'); return; }
  // actualizar globales para compatibilidad
  repCurrentCat = info.cat; repCurrentId = info.id;
  var telEl=document.getElementById('repWATel');
  var tel=(telEl? telEl.value.trim() : '');
  var fmtEl=document.querySelector('input[name="repWAFormato"]:checked');
  var fmt=fmtEl? fmtEl.value : 'pdf';
  var msgEl=document.getElementById('repWAMsg');
  var msg=msgEl? msgEl.value.trim() : '';
  if(!tel){ repError('Ingrese el número de destino'); if(telEl) telEl.focus(); return; }
  var digits=tel.replace(/\D/g,'');
  if(digits.length < 10){ repError('Número inválido. Ej: +573001234567'); return; }
  var statusEl=document.getElementById('repWAStatus');
  var btn=document.getElementById('repWABtnEnviar');
  repWALoading=true;
  if(btn){ btn.disabled=true; btn.innerHTML='<span class="spinner-border spinner-border-sm me-1"></span> Generando y enviando...'; }
  if(statusEl) statusEl.innerHTML='<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px;text-align:center;color:#1e40af;font-size:.8rem"><span class="spinner-border spinner-border-sm me-2"></span>Generando '+fmt.toUpperCase()+' y enviando por WhatsApp... Esto puede tardar unos segundos.</div>';
  var filtrosPayload = { fecha_inicio: repFiltros.fecha_inicio||'', fecha_fin: repFiltros.fecha_fin||'', id_jornada: repFiltros.id_jornada||'', id_mesero: repFiltros.id_mesero||'' };
  if(!filtrosPayload.fecha_inicio) delete filtrosPayload.fecha_inicio;
  if(!filtrosPayload.fecha_fin) delete filtrosPayload.fecha_fin;
  if(!filtrosPayload.id_jornada) delete filtrosPayload.id_jornada;
  if(!filtrosPayload.id_mesero) delete filtrosPayload.id_mesero;
  // compat payload: soporta {reporte, numero} y {cat,id, telefono}
  var payload = {
    reporte: selVal,            // nuevo formato solicitado: "contable:cont_gastos"
    cat: info.cat, id: info.id, // compat legacy
    formato: fmt,
    numero: tel, telefono: tel, // compat ambos nombres
    mensaje: msg, message: msg,
    filtros: filtrosPayload
  };
  var url = repBuildWAUrl('/api/reportes/enviar-whatsapp');
  fetch(url, { method:'POST', headers:{'Content-Type':'application/json','Accept':'application/json'}, body: JSON.stringify(payload), credentials:'same-origin' })
    .then(function(r){
      return r.text().then(function(txt){
        var d; try{ d=JSON.parse(txt); }catch(e){
          // HTML recibido -> error de ruta (<!DOCTYPE)
          d={success:false, mensaje:'Respuesta no JSON ('+r.status+'): '+txt.slice(0,250)};
        }
        return {ok:r.ok, status:r.status, d:d, txt:txt};
      });
    })
    .then(function(w){
      repWALoading=false;
      if(btn){ btn.disabled=false; btn.innerHTML='<i class="bi bi-whatsapp me-1"></i>Enviar por WhatsApp'; }
      if(w.ok && w.d.success){
        if(w.d.mock || w.d.provider==='mock'){
          if(statusEl) statusEl.innerHTML='<div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:12px;color:#92400e;text-align:center"><div style="font-weight:800"><i class="bi bi-exclamation-triangle-fill me-1"></i> Generado en modo MOCK</div><div style="font-size:.78rem;margin-top:4px">Reporte <b>'+escH(info.id)+'</b> ('+fmt.toUpperCase()+') generado pero <b>NO enviado a WhatsApp real</b>.</div><div style="font-size:.72rem;margin-top:6px">Provider actual: <b>mock</b>. Configure <code>WHATSAPP_PROVIDER</code> a <code>ultramsg</code>/<code>greenapi</code>/<code>twilio</code> y defina <code>WHATSAPP_ADMIN_PHONE</code> en <code>.env</code>. Verifique <code>/api/whatsapp/status</code>.</div><div style="font-size:.70rem;color:#78350f;margin-top:6px">Archivo: '+escH(w.d.archivo||'')+' • '+ (w.d.bytes? (w.d.bytes/1024).toFixed(1)+' KB' : '') +'</div></div>';
          repError('MOCK: reporte generado pero no enviado. Configure proveedor real.');
          // no cerrar modal automáticamente en modo mock
        } else {
          if(statusEl) statusEl.innerHTML='<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px;color:#065f46;text-align:center"><div style="font-weight:800"><i class="bi bi-check-circle-fill me-1"></i> ¡Enviado exitosamente!</div><div style="font-size:.78rem;margin-top:4px">Reporte <b>'+escH(info.id)+'</b> ('+fmt.toUpperCase()+') enviado a <b>'+escH(w.d.telefonoMasked||w.d.telefono||tel)+'</b> vía <b>'+escH(w.d.provider||'whatsapp')+'</b></div><div style="font-size:.70rem;color:#047857;margin-top:6px">Archivo: '+escH(w.d.archivo||'')+' • '+ (w.d.bytes? (w.d.bytes/1024).toFixed(1)+' KB' : '') +'</div></div>';
          repToastSuccess('Reporte enviado por WhatsApp a '+ (w.d.telefonoMasked||w.d.telefono||tel) +' ('+fmt.toUpperCase()+')');
          setTimeout(function(){ repCerrarWAModal(); }, 2200);
        }
      } else {
        var msgErr = (w.d && (w.d.mensaje||w.d.message||w.d.error)) ? (w.d.mensaje||w.d.message||w.d.error) : ('Error '+w.status);
        if(w.txt && w.txt.trim().startsWith('<!DOCTYPE')) msgErr = 'Error de conexión: endpoint no encontrado (404). Verifique que el backend tenga POST /api/reportes/enviar-whatsapp registrado.';
        if(statusEl) statusEl.innerHTML='<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:12px;color:#991b1b"><div style="font-weight:800"><i class="bi bi-x-circle-fill me-1"></i> Error al enviar</div><div style="font-size:.78rem;margin-top:4px;word-break:break-word">'+escH(msgErr)+'</div><div style="font-size:.70rem;color:#7f1d1d;margin-top:6px">Verifique número E.164 (+57...), reporte y conexión con la API de WhatsApp (WHATSAPP_PROVIDER). Revise logs del servidor.</div></div>';
        repError(msgErr);
      }
    })
    .catch(function(e){
      repWALoading=false;
      if(btn){ btn.disabled=false; btn.innerHTML='<i class="bi bi-whatsapp me-1"></i>Enviar por WhatsApp'; }
      if(statusEl) statusEl.innerHTML='<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:12px;color:#991b1b"><div style="font-weight:800">Error de conexión</div><div style="font-size:.78rem">'+escH(e.message||'No se pudo conectar con la API de WhatsApp')+'</div></div>';
      repError('Error de conexión con el servidor de WhatsApp: '+(e.message||'')); 
    });
}
// precargar config al iniciar reportes
try{ repFetchWAConfig(); }catch(e){}
