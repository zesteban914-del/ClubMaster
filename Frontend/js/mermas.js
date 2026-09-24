var productosInventarioMermas = [];
var mermasCache=[];
var mermasPaginaActual=1;
var mermasPorPagina=8;
var mermasFiltroTexto='';
function iniciarMermas() {
    if(typeof verificarAcceso==='function'&&!verificarAcceso('registrar_mermas')){if(typeof verificarAccesoRB==='function'&&!verificarAccesoRB('registrar_mermas'))return;return;}
    if(typeof verificarAccesoRB==='function'&&!verificarAccesoRB('registrar_mermas'))return;
    activarNav('navMermas');
    if(typeof setFabVisible==='function') setFabVisible(false);
    var contenedor = document.getElementById('main-content');
    contenedor.innerHTML = ''
        +'<div class="merma-hero">'
        +'<div><h2><i class="bi bi-exclamation-triangle"></i> Mermas y Desperdicios</h2><p>Control operativo y ejecutivo de pérdidas</p></div>'
        +'<button class="btn-refresh" data-action="mermas-refresh"><i class="bi bi-arrow-clockwise"></i> Actualizar</button></div>'
        +'<div id="contenedorAlertas"></div>'
        +'<div class="merma-kpis">'
        +'<div class="merma-kpi merma-kpi-red"><div class="kpi-top"><div><div class="kpi-label">Pérdida del Mes</div><div class="kpi-value" id="kpiPerdidaMes">$0</div><div class="kpi-sub">Costo total acumulado</div></div><div class="kpi-icon" style="background:rgba(239,68,68,.15);color:#f87171"><i class="bi bi-currency-dollar"></i></div></div></div>'
        +'<div class="merma-kpi merma-kpi-amber"><div class="kpi-top"><div><div class="kpi-label">Mermas Registradas</div><div class="kpi-value" id="kpiTotalMermas">0</div><div class="kpi-sub">registros filtrados</div></div><div class="kpi-icon" style="background:rgba(245,158,11,.15);color:#fbbf24"><i class="bi bi-archive"></i></div></div></div>'
        +'<div class="merma-kpi merma-kpi-purple"><div class="kpi-top"><div><div class="kpi-label">Motivo Más Frecuente</div><div class="kpi-value" id="kpiMotivoFrecuente" style="font-size:1.15rem">-</div><div class="kpi-sub">mayor causa de pérdida</div></div><div class="kpi-icon" style="background:rgba(139,92,246,.15);color:#a78bfa"><i class="bi bi-pie-chart"></i></div></div></div>'
        +'</div>'
        +'<div class="merma-card">'
        +'<div class="merma-card-head"><span><i class="bi bi-plus-circle"></i> Registrar Nueva Merma</span><span class="merma-head-hint">Descuenta stock automáticamente</span></div>'
        +'<div class="merma-card-body">'
        +'<form id="formNuevaMerma">'
        +'<div class="merma-form-grid">'
        +'<div class="merma-field"><label>Producto *</label><select id="selectProductoMerma" required><option value="">Seleccionar producto...</option></select></div>'
        +'<div class="merma-field"><label>Cantidad *</label><input type="number" id="inputCantidadMerma" min="1" value="1" required></div>'
        +'<div class="merma-field"><label>Motivo *</label><select id="selectMotivoMerma" required><option value="Rotura">Rotura</option><option value="Derrame">Derrame</option><option value="Vencimiento">Vencimiento</option><option value="Cortesia">Cortesía</option><option value="Consumo Interno">Consumo Interno</option></select></div>'
        +'<div class="merma-field"><label>Área de origen</label><select id="selectAreaMerma"><option value="Barra Principal">Barra Principal</option><option value="Cocina">Cocina</option><option value="VIP">VIP</option><option value="Bodega">Bodega</option></select></div>'
        +'</div>'
        +'<div class="merma-feedback-row">'
        +'<div class="merma-stock-card"><div class="merma-stock-label"><i class="bi bi-box-seam"></i> Stock Actual</div><div id="stockActualMerma" class="merma-stock-value">-</div><div id="stockActualHint" class="merma-stock-hint">Seleccione un producto</div></div>'
        +'<div class="merma-costo-card"><div class="merma-costo-label"><i class="bi bi-cash-stack"></i> Costo estimado</div><div id="costoEstimadoMerma" class="merma-costo-badge"><span class="merma-costo-num">$0</span><span class="merma-costo-detail">0 × $0</span></div><div id="costoAlerta" class="merma-costo-alert" style="display:none"><i class="bi bi-exclamation-triangle"></i> Cantidad supera stock disponible</div></div>'
        +'</div>'
        +'<div class="merma-field" style="margin-top:14px"><label>Observaciones / Justificación <span id="obsReqMark" style="color:#f87171;display:none">* requerido</span><span id="obsOptMark" style="color:#64748b;font-weight:400;text-transform:none;letter-spacing:0">(opcional)</span></label><textarea id="inputObsMerma" rows="2" placeholder="Ej: Se quebró botella en barra..."></textarea></div>'
        +'<div class="merma-field" id="pinMermaWrap" style="display:none;margin-top:10px"><label><i class="bi bi-lock"></i> PIN admin</label><input type="password" id="inputPinMerma" placeholder="PIN si configuración lo exige"></div>'
        +'<button type="submit" class="merma-btn-submit"><i class="bi bi-exclamation-triangle"></i> Registrar merma</button>'
        +'</form></div></div>'
        +'<div class="merma-card">'
        +'<div class="merma-hist-head"><span><i class="bi bi-clock-history"></i> Historial</span><div class="merma-filtros"><input type="date" id="filtroDesdeMerma"><span class="merma-a">a</span><input type="date" id="filtroHastaMerma"><select id="filtroMotivoMerma"><option value="">Todos motivos</option><option value="Rotura">Rotura</option><option value="Derrame">Derrame</option><option value="Vencimiento">Vencimiento</option><option value="Cortesia">Cortesía</option><option value="Consumo Interno">Consumo Interno</option></select><button class="merma-btn-search" data-action="mermas-buscar"><i class="bi bi-search"></i> Buscar</button><button class="merma-btn-clear" data-action="mermas-limpiar"><i class="bi bi-x-lg"></i></button></div></div>'
        +'<div id="contenedorTablaMermas" class="merma-table-wrap"><div class="merma-loading"><div class="spinner-border spinner-border-sm"></div> Cargando...</div></div>'
        +'<div id="mermaPaginacion" class="merma-pagination" style="display:none"></div>'
        +'</div>'
        +'<div id="mermaDetalleModal" class="merma-modal-overlay" style="display:none"><div class="merma-modal"><div class="merma-modal-head"><h4><i class="bi bi-file-text"></i> Detalle de Merma</h4><button data-action="mermas-cerrar-detalle"><i class="bi bi-x-lg"></i></button></div><div id="mermaDetalleBody" class="merma-modal-body"></div></div></div>';
    var esc = (typeof escapeHTML !== 'undefined' ? escapeHTML : function(s){ return String(s == null ? '' : s); });
    window._mermasEsc = esc;
    if (typeof delegateAction !== 'undefined') delegateAction(document.getElementById('main-content'), { 'mermas-refresh': function(){ iniciarMermas(); }, 'mermas-buscar': function(){ filtrarMermas(); }, 'mermas-limpiar': function(){ limpiarFiltrosMermas(); }, 'mermas-cerrar-detalle': function(){ cerrarDetalleMerma(); }, 'mermas-ver-detalle': function(el){ verDetalleMerma(Number(el.getAttribute('data-idx'))); }, 'mermas-pag': function(el){ mermasCambiarPag(Number(el.getAttribute('data-dir'))); } });
    document.getElementById('formNuevaMerma').addEventListener('submit', function(e) { e.preventDefault(); registrarMerma(); });
    document.getElementById('selectProductoMerma').addEventListener('change', actualizarCostoEstimado);
    document.getElementById('inputCantidadMerma').addEventListener('input', actualizarCostoEstimado);
    document.getElementById('selectMotivoMerma').addEventListener('change', actualizarObsRequerido);
    actualizarObsRequerido();
    verificarPinRequerido();
    cargarProductosParaMermas();
    cargarMermasFiltradas();
}
function verificarPinRequerido(){
    fetch(API_BASE + '/api/configuracion').then(function(r){return r.json();}).then(function(d){
        if(!d.success) return;
        var cfg=d.config||{}; if(Array.isArray(d.configuracion)) (d.configuracion||[]).forEach(function(x){ cfg[x.clave]=x.valor; }); else Object.assign(cfg,d.config||{});
        if(cfg.mermas_pin_requerido==='1' || cfg.mermas_solo_admin==='1'){
            document.getElementById('pinMermaWrap').style.display='block';
        }
    }).catch(function(){});
}
function actualizarObsRequerido(){
    var mot=document.getElementById('selectMotivoMerma').value;
    var req = (mot==='Cortesia' || mot==='Vencimiento' || mot==='Consumo Interno');
    document.getElementById('obsReqMark').style.display = req ? 'inline' : 'none';
    document.getElementById('obsOptMark').style.display = req ? 'none' : 'inline';
    var ta=document.getElementById('inputObsMerma');
    if(req) ta.setAttribute('required','required'); else ta.removeAttribute('required');
    if(req) ta.placeholder='Obligatorio para '+mot+' - justifique';
    else ta.placeholder='Opcional - detalle la causa';
}
function actualizarCostoEstimado(){
    var id=document.getElementById('selectProductoMerma').value;
    var cant=Number(document.getElementById('inputCantidadMerma').value)||0;
    var prod = productosInventarioMermas.find(function(p){ return String(p.id_producto)===String(id); });
    var stockEl=document.getElementById('stockActualMerma');
    var stockHint=document.getElementById('stockActualHint');
    var costoBox=document.getElementById('costoEstimadoMerma');
    var alerta=document.getElementById('costoAlerta');
    if(!prod){ stockEl.textContent='-'; stockEl.className='merma-stock-value'; stockHint.textContent='Seleccione un producto'; costoBox.innerHTML='<span class="merma-costo-num">$0</span><span class="merma-costo-detail">0 × $0</span>'; costoBox.className='merma-costo-badge'; alerta.style.display='none'; return; }
    var stockNum=Number(prod.stock||0);
    var unidad=prod.unidad_medida||'uds';
    stockEl.textContent=stockNum+' '+unidad;
    stockEl.classList.remove('anim-pop'); void stockEl.offsetWidth; stockEl.classList.add('anim-pop');
    if(cant>stockNum){ stockEl.className='merma-stock-value stock-danger'; stockHint.textContent='¡Stock insuficiente!'; stockHint.style.color='#f87171'; }
    else if(stockNum===0){ stockEl.className='merma-stock-value stock-danger'; stockHint.textContent='Producto agotado'; stockHint.style.color='#f87171'; }
    else if(stockNum<=5){ stockEl.className='merma-stock-value stock-warn'; stockHint.textContent='Stock bajo'; stockHint.style.color='#fbbf24'; }
    else { stockEl.className='merma-stock-value stock-ok'; stockHint.textContent='Disponible para merma'; stockHint.style.color='#34d399'; }
    var costo = Number(prod.precio_costo!=null? prod.precio_costo : prod.costo) || Number(prod.precio_costo) || 0;
    if(!costo && prod.costo!=null) costo=Number(prod.costo);
    var total = costo * cant;
    costoBox.classList.remove('anim-pop'); void costoBox.offsetWidth; costoBox.classList.add('anim-pop');
    var totalFmt='$'+ total.toLocaleString('es-CO');
    var detail=cant+' × $'+costo.toLocaleString('es-CO');
    if(cant>stockNum){ costoBox.className='merma-costo-badge costo-danger anim-pop'; alerta.style.display='flex'; }
    else { costoBox.className='merma-costo-badge costo-ok anim-pop'; alerta.style.display='none'; }
    costoBox.innerHTML='<span class="merma-costo-num">'+totalFmt+'</span><span class="merma-costo-detail">'+detail+'</span>';
}
function cargarProductosParaMermas() {
    fetch(API_BASE + '/api/productos/admin')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success) {
                productosInventarioMermas = data.productos;
                var select = document.getElementById('selectProductoMerma');
                if (!select) return;
                select.innerHTML='<option value="">Seleccionar producto...</option>';
                data.productos.forEach(function(p) {
                    var opt = document.createElement('option');
                    opt.value = p.id_producto;
                    var costo = p.precio_costo!=null? p.precio_costo : (p.costo||0);
                    opt.textContent = p.nombre + ' — Stock: '+(p.stock||0)+' · Costo: $'+Number(costo).toLocaleString('es-CO');
                    opt.dataset.costo=costo;
                    select.appendChild(opt);
                });
                actualizarCostoEstimado();
            }
        }).catch(function() {});
}
function registrarMerma() {
    var idProducto = document.getElementById('selectProductoMerma').value;
    var cantidad = document.getElementById('inputCantidadMerma').value;
    var motivo = document.getElementById('selectMotivoMerma').value;
    var area = document.getElementById('selectAreaMerma') ? document.getElementById('selectAreaMerma').value : '';
    var obs = document.getElementById('inputObsMerma').value.trim();
    var pin = document.getElementById('inputPinMerma') ? document.getElementById('inputPinMerma').value : '';
    if (!idProducto || !cantidad || !motivo) { mostrarAlerta('warning', 'Seleccione producto, cantidad y motivo.'); return; }
    if ((motivo==='Cortesia' || motivo==='Vencimiento' || motivo==='Consumo Interno') && !obs) { mostrarAlerta('warning', motivo+' requiere Observaciones / Justificación'); return; }
    var prod = productosInventarioMermas.find(function(p){ return String(p.id_producto)===String(idProducto); });
    var costo_unitario = prod ? (Number(prod.precio_costo!=null? prod.precio_costo: prod.costo)||0) : 0;
    var btn=document.querySelector('.merma-btn-submit'); if(btn){ btn.disabled=true; btn.innerHTML='<span class="spinner-border spinner-border-sm"></span> Registrando...'; }
    fetch(API_BASE + '/api/mermas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_producto: Number(idProducto), cantidad: Number(cantidad), motivo: motivo, observaciones: obs, costo_unitario: costo_unitario, area_origen: area, pin_admin: pin, id_usuario: typeof usuario!=='undefined' && usuario ? usuario.id_usuario : null })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if(btn){ btn.disabled=false; btn.innerHTML='<i class="bi bi-exclamation-triangle"></i> Registrar merma'; }
        if (data.success) {
            mostrarAlerta('success', data.mensaje);
            document.getElementById('formNuevaMerma').reset();
            document.getElementById('inputObsMerma').value='';
            if(document.getElementById('inputPinMerma')) document.getElementById('inputPinMerma').value='';
            if(document.getElementById('selectAreaMerma')) document.getElementById('selectAreaMerma').value='Barra Principal';
            document.getElementById('inputCantidadMerma').value=1;
            actualizarCostoEstimado(); actualizarObsRequerido();
            cargarMermasFiltradas();
            cargarProductosParaMermas();
        } else { mostrarAlerta('danger', data.mensaje || 'Error al registrar merma'); }
    }).catch(function() { if(btn){ btn.disabled=false; btn.innerHTML='<i class="bi bi-exclamation-triangle"></i> Registrar merma'; } mostrarAlerta('danger', 'No se pudo conectar con el servidor'); });
}
function filtrarMermas(){ mermasPaginaActual=1; cargarMermasFiltradas(); }
function limpiarFiltrosMermas(){ document.getElementById('filtroDesdeMerma').value=''; document.getElementById('filtroHastaMerma').value=''; document.getElementById('filtroMotivoMerma').value=''; mermasPaginaActual=1; cargarMermasFiltradas(); }
function cargarMermasFiltradas() {
    var cont = document.getElementById('contenedorTablaMermas');
    if (!cont) return;
    cont.innerHTML = '<div class="merma-loading"><div class="spinner-border spinner-border-sm"></div> Cargando historial...</div>';
    var desde=document.getElementById('filtroDesdeMerma')? document.getElementById('filtroDesdeMerma').value : '';
    var hasta=document.getElementById('filtroHastaMerma')? document.getElementById('filtroHastaMerma').value : '';
    var motivo=document.getElementById('filtroMotivoMerma')? document.getElementById('filtroMotivoMerma').value : '';
    var qs=[]; if(desde) qs.push('desde='+desde); if(hasta) qs.push('hasta='+hasta); if(motivo) qs.push('motivo='+encodeURIComponent(motivo));
    var url=API_BASE + '/api/mermas' + (qs.length? '?'+qs.join('&'):'');
    fetch(url)
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success) {
                mermasCache=data.mermas||[];
                if(data.mermas && data.total_valor==null){
                    var tv=mermasCache.reduce(function(a,m){return a+Number(m.valor_total||m.valor_perdida||0);},0);
                    data.total_valor=tv; data.total_registros=mermasCache.length;
                }
                renderizarTablaMermas(mermasCache, data.total_valor);
            } else {
                cont.innerHTML = '<div class="merma-empty"><i class="bi bi-exclamation-circle"></i>'+(data.mensaje||'Error')+'</div>';
            }
        }).catch(function() { cont.innerHTML = '<div class="merma-empty"><i class="bi bi-wifi-off"></i>No se pudo conectar</div>'; });
}
function renderizarTablaMermas(mermas, totalValor) {
    var esc = window._mermasEsc || (typeof escapeHTML !== 'undefined' ? escapeHTML : function(s){ return String(s == null ? '' : s); });
    var cont = document.getElementById('contenedorTablaMermas');
    var pag = document.getElementById('mermaPaginacion');
    document.getElementById('kpiPerdidaMes').textContent = '$' + Number(totalValor||0).toLocaleString('es-CO');
    document.getElementById('kpiTotalMermas').textContent = (mermas? mermas.length:0);
    if (mermas && mermas.length > 0) {
        var conteoMotivos = {};
        mermas.forEach(function(m) { conteoMotivos[m.motivo] = (conteoMotivos[m.motivo] || 0) + 1; });
        var maxMotivo = ''; var maxCount = 0;
        Object.keys(conteoMotivos).forEach(function(k) { if (conteoMotivos[k] > maxCount) { maxCount = conteoMotivos[k]; maxMotivo = k; }});
        document.getElementById('kpiMotivoFrecuente').textContent = maxMotivo || '-';
    } else {
        document.getElementById('kpiMotivoFrecuente').textContent='-';
    }
    if (!mermas || mermas.length === 0) {
        cont.innerHTML = '<div class="merma-empty"><i class="bi bi-inbox"></i><p>Sin resultados</p><span>No hay mermas con los filtros actuales.</span></div>';
        if(pag) pag.style.display='none';
        return;
    }
    var totalPag=Math.ceil(mermas.length/mermasPorPagina);
    if(mermasPaginaActual>totalPag) mermasPaginaActual=totalPag;
    if(mermasPaginaActual<1) mermasPaginaActual=1;
    var inicio=(mermasPaginaActual-1)*mermasPorPagina;
    var pagina=mermas.slice(inicio,inicio+mermasPorPagina);
    var motivoEstilo = { 'Rotura': 'mot-rotura', 'Derrame': 'mot-derrame', 'Vencimiento': 'mot-vencimiento', 'Cortesia': 'mot-cortesia', 'Cortesía': 'mot-cortesia', 'Consumo Interno': 'mot-consumo', 'Consumo interno': 'mot-consumo' };
    var html = '<div class="merma-table-scroll"><table class="merma-table"><thead><tr><th>Fecha / Hora</th><th>Producto</th><th style="text-align:center">Cant.</th><th style="text-align:right">Costo Perdido</th><th>Motivo</th><th>Registrado por</th><th style="text-align:center">Acción</th></tr></thead><tbody>';
    pagina.forEach(function(m,idx){
        var realIdx=inicio+idx;
        var cls = motivoEstilo[m.motivo] || 'mot-default';
        var fechaFmt = new Date(m.fecha).toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' });
        var horaFmt = new Date(m.fecha).toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' });
        var valor = Number(m.valor_total!=null? m.valor_total : (m.valor_perdida!=null? m.valor_perdida : (Number(m.costo_unitario||0)*Number(m.cantidad))));
        var areaTxt = m.area_origen ? '<span class="merma-area"><i class="bi bi-geo-alt"></i> '+esc(m.area_origen)+'</span>' : '';
        html += '<tr>'
            +'<td><div class="merma-fecha">'+fechaFmt+'</div><div class="merma-hora">'+horaFmt+'</div></td>'
            +'<td><div class="merma-prod">'+esc(m.producto_nombre||'-')+'</div><div class="merma-prod-sub">$'+Number(m.costo_unitario||0).toLocaleString('es-CO')+' c/u '+areaTxt+'</div></td>'
            +'<td style="text-align:center"><span class="merma-cant">'+m.cantidad+'</span></td>'
            +'<td style="text-align:right"><span class="merma-perdida">$'+Number(valor).toLocaleString('es-CO')+'</span></td>'
            +'<td><span class="merma-badge '+cls+'">'+esc(m.motivo)+'</span></td>'
            +'<td><span class="merma-user"><i class="bi bi-person"></i> '+esc(m.usuario_nombre||'-')+'</span></td>'
            +'<td style="text-align:center"><button class="merma-btn-detalle" data-action="mermas-ver-detalle" data-idx="'+realIdx+'"><i class="bi bi-eye"></i></button></td></tr>';
    });
    html += '</tbody><tfoot><tr><td colspan="3" style="font-weight:700;letter-spacing:.02em">TOTAL PÉRDIDA FILTRADA</td><td style="text-align:right;color:#f87171;font-weight:800;font-size:1rem">$'+Number(totalValor||0).toLocaleString('es-CO')+'</td><td colspan="3"></td></tr></tfoot></table></div>';
    cont.innerHTML = html;
    if(pag){
        if(totalPag>1){
            pag.style.display='flex';
            pag.innerHTML='<button class="merma-pag-btn" '+(mermasPaginaActual===1?'disabled':'')+' data-action="mermas-pag" data-dir="-1"><i class="bi bi-chevron-left"></i></button><span class="merma-pag-info">Página '+mermasPaginaActual+' de '+totalPag+' · '+mermas.length+' registros</span><button class="merma-pag-btn" '+(mermasPaginaActual===totalPag?'disabled':'')+' data-action="mermas-pag" data-dir="1"><i class="bi bi-chevron-right"></i></button>';
        } else { pag.style.display='flex'; pag.innerHTML='<span class="merma-pag-info">'+mermas.length+' registro(s) · $'+Number(totalValor||0).toLocaleString('es-CO')+' acumulado</span>'; }
    }
}
function mermasCambiarPag(dir){ mermasPaginaActual+=dir; var tv=mermasCache.reduce(function(a,m){return a+Number(m.valor_total||m.valor_perdida||0);},0); renderizarTablaMermas(mermasCache,tv); document.getElementById('contenedorTablaMermas').scrollIntoView({behavior:'smooth',block:'nearest'}); }
function verDetalleMerma(idx){
    var m=mermasCache[idx]; if(!m) return;
    var esc = window._mermasEsc || (typeof escapeHTML !== 'undefined' ? escapeHTML : function(s){ return String(s == null ? '' : s); });
    var valor=Number(m.valor_total!=null? m.valor_total : (m.valor_perdida!=null? m.valor_perdida:0));
    var fecha=new Date(m.fecha).toLocaleString('es-CO',{dateStyle:'full',timeStyle:'short'});
    var html='<div class="merma-det-grid">'
        +'<div class="merma-det-item"><span>Producto</span><strong>'+esc(m.producto_nombre||'-')+'</strong><small>Stock actual: '+esc(m.stock_actual!=null? m.stock_actual:'-')+'</small></div>'
        +'<div class="merma-det-item"><span>Cantidad</span><strong>'+Number(m.cantidad)+' uds</strong><small>Costo unit: $'+Number(m.costo_unitario||0).toLocaleString('es-CO')+'</small></div>'
        +'<div class="merma-det-item highlight"><span>Costo perdido</span><strong style="color:#f87171">$'+Number(valor).toLocaleString('es-CO')+'</strong><small>'+Number(m.cantidad)+' × $'+Number(m.costo_unitario||0).toLocaleString('es-CO')+'</small></div>'
        +'<div class="merma-det-item"><span>Motivo</span><span class="merma-badge '+(m.motivo==='Rotura'?'mot-rotura':m.motivo==='Vencimiento'?'mot-vencimiento':m.motivo==='Consumo Interno'?'mot-consumo':m.motivo==='Cortesia'?'mot-cortesia':'mot-derrame')+'">'+esc(m.motivo)+'</span></div>'
        +'<div class="merma-det-item"><span>Área origen</span><strong>'+esc(m.area_origen||'No registrada')+'</strong></div>'
        +'<div class="merma-det-item"><span>Registrado por</span><strong>'+esc(m.usuario_nombre||'-')+'</strong><small>'+esc(fecha)+'</small></div>'
        +'</div>'
        +'<div class="merma-det-obs"><span>Observaciones</span><p>'+(m.observaciones? esc(m.observaciones) : '<em style="color:#64748b">Sin observaciones</em>')+'</p></div>';
    document.getElementById('mermaDetalleBody').innerHTML=html;
    document.getElementById('mermaDetalleModal').style.display='flex';
}
function cerrarDetalleMerma(){ document.getElementById('mermaDetalleModal').style.display='none'; }
function cargarMermasMes(){ cargarMermasFiltradas(); }
document.addEventListener('click',function(e){ var ov=document.getElementById('mermaDetalleModal'); if(ov && e.target===ov) cerrarDetalleMerma(); });

