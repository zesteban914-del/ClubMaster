// =========================================================
// CONTROLADOR: COMPRAS / FACTURAS DE PROVEEDOR
// =========================================================

var listaProveedoresCompra = [];
var listaProductosCompra = [];
var detallesCompra = [];
var comprasHistorialGlobal = [];
var filtroComprasDesde = '';
var filtroComprasHasta = '';
function fechaYMDCompra(v){try{var s=String(v==null?'':v);if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.slice(0,10);var d=new Date(s);if(isNaN(d.getTime()))return '';return fechaISOCompra(d);}catch(e){return '';}}
var soporteCompraBase64 = null;
var ivaGlobalCompra = 0;
var icoGlobalCompra = 0;
var tipoDescuentoCompra = 'ninguno';
var descuentoGlobalCompra = 0;

function redondearCompra(v) { return Math.round((Number(v) || 0) * 100) / 100; }
function fmtCompra(v) { return Number(v || 0).toLocaleString('es-CO', { maximumFractionDigits: 2 }); }
function escCompra(t) { if (typeof escapeHTML !== 'undefined') return escapeHTML(t); return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function normCompra(s) { return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/['"`]/g,''); }
function fechaHoyCompra() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
function fechaISOCompra(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
function esCreditoCompra(metodo) { return /credito|factura a pagar/i.test(metodo || ''); }

function limpiarBackdropsCompra() {
    document.querySelectorAll('.modal-backdrop').forEach(function(b) { b.remove(); });
    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('overflow');
    document.body.style.removeProperty('padding-right');
}
function asegurarModalesCompra() {
    if (!document.getElementById('modalCompra')) {
        var tmp = document.createElement('div');
        tmp.innerHTML = htmlModalCompra();
        while (tmp.firstChild) document.body.appendChild(tmp.firstChild);
        var mc = document.getElementById('modalCompra');
        if (mc) mc.addEventListener('hidden.bs.modal', function() { limpiarBackdropsCompra(); });
    }
    if (!document.getElementById('modalDetalleCompra')) {
        var tmp2 = document.createElement('div');
        tmp2.innerHTML = htmlModalDetalleCompra();
        while (tmp2.firstChild) document.body.appendChild(tmp2.firstChild);
        var md = document.getElementById('modalDetalleCompra');
        if (md) md.addEventListener('hidden.bs.modal', function() { limpiarBackdropsCompra(); });
    }
}
function iniciarCompras() {
    if(typeof verificarAcceso==='function'&&!verificarAcceso('gestionar_proveedores')){if(typeof verificarAccesoRB==='function'&&!verificarAccesoRB('gestionar_proveedores'))return;return;}
    if(typeof verificarAccesoRB==='function'&&!verificarAccesoRB('gestionar_proveedores'))return;
    if (typeof activarNav === 'function') activarNav('navCompras');
    limpiarBackdropsCompra();
    asegurarModalesCompra();
    var contenedor = document.getElementById('main-content');
    contenedor.innerHTML =
        '<div class="page-header">' +
        '<h2><i class="bi bi-bag-check"></i>Compras</h2>' +
        '<div class="page-header-right">' +
        '<button class="btn-refresh" data-action="compras-actualizar"><i class="bi bi-arrow-clockwise"></i> Actualizar</button>' +
        '<button class="btn-custom-action btn-pedir" style="padding:8px 18px;width:auto" data-action="compras-nueva"><i class="bi bi-plus-lg me-1"></i> Nueva Compra</button>' +
        '</div></div>' +
        '<div id="contenedorAlertas"></div>' +
        '<div class="card" style="border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;margin-bottom:24px">' +
        '<div style="padding:16px 20px;background:#0f172a;color:#f8fafc;font-weight:700;font-size:0.9rem;display:flex;align-items:center;gap:8px"><i class="bi bi-clock-history"></i> Historial de Compras</div>' +
        '<div style="padding:14px 20px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:flex;gap:8px;flex-wrap:wrap;align-items:end">' +
        '<div><label style="font-size:.7rem;font-weight:700;color:#64748b;text-transform:uppercase">Desde</label><input type="date" id="fCompraDesde" class="form-control form-control-sm" style="border-radius:8px;border:1px solid #e2e8f0"></div>' +
        '<div><label style="font-size:.7rem;font-weight:700;color:#64748b;text-transform:uppercase">Hasta</label><input type="date" id="fCompraHasta" class="form-control form-control-sm" style="border-radius:8px;border:1px solid #e2e8f0"></div>' +
        '<button class="btn btn-sm btn-primary" style="border-radius:8px;font-weight:700" onclick="aplicarFiltroFechasCompras()"><i class="bi bi-funnel me-1"></i>Filtrar</button>' +
        '<button class="btn btn-sm btn-light" style="border-radius:8px;font-weight:700;border:1px solid #e2e8f0" onclick="limpiarFiltroFechasCompras()">Limpiar</button>' +
        '<span id="resumenFiltroCompras" style="font-size:.78rem;color:#64748b;margin-left:auto"></span></div>' +
        '<div class="card-body p-0" style="background:#fff"><div id="contenedorTablaCompras" class="text-center py-4"><div class="spinner-border text-primary"></div></div></div></div>';
    cargarHistorialCompras();
}
function aplicarFiltroFechasCompras(){
    var d=document.getElementById('fCompraDesde'),h=document.getElementById('fCompraHasta');
    filtroComprasDesde=d&&d.value?d.value:'';filtroComprasHasta=h&&h.value?h.value:'';
    renderizarTablaCompras(comprasFiltradasPorFecha());
}
function limpiarFiltroFechasCompras(){
    filtroComprasDesde='';filtroComprasHasta='';
    var d=document.getElementById('fCompraDesde'),h=document.getElementById('fCompraHasta');
    if(d)d.value='';if(h)h.value='';
    renderizarTablaCompras(comprasHistorialGlobal);
}
function comprasFiltradasPorFecha(){
    if(!filtroComprasDesde&&!filtroComprasHasta)return comprasHistorialGlobal;
    return comprasHistorialGlobal.filter(function(c){
        var f=fechaYMDCompra(c.fecha);
        if(!f)return false;
        if(filtroComprasDesde&&f<filtroComprasDesde)return false;
        if(filtroComprasHasta&&f>filtroComprasHasta)return false;
        return true;
    });
}

var HTML_SECCION_PROVEEDOR_COMPRA =
    '<div class="row g-3 mb-4">' +
    '<div class="col-md-4"><label class="form-label" style="font-weight:600;color:#334155;font-size:0.85rem">Proveedor *</label><select id="selectProveedorCompra" class="form-select" style="border-radius:10px;border:1px solid #e2e8f0"><option value="">Seleccionar proveedor...</option></select></div>' +
    '<div class="col-md-3"><label class="form-label" style="font-weight:600;color:#334155;font-size:0.85rem">N. Factura</label><input type="text" class="form-control" style="border-radius:10px;border:1px solid #e2e8f0" id="inputNumFactura" placeholder="Ej: F-001"></div>' +
    '<div class="col-md-2"><label class="form-label" style="font-weight:600;color:#334155;font-size:0.85rem">Fecha Factura</label><input type="date" class="form-control" style="border-radius:10px;border:1px solid #e2e8f0" id="inputFechaFacturaCompra"></div>' +
    '<div class="col-md-3"><label class="form-label" style="font-weight:600;color:#334155;font-size:0.85rem">Observaciones</label><input type="text" class="form-control" style="border-radius:10px;border:1px solid #e2e8f0" id="inputObsCompra" placeholder="Notas adicionales..."></div>' +
    '</div>';

var HTML_SECCION_PAGO_COMPRA =
    '<div class="card mb-3" style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">' +
    '<div style="padding:10px 16px;background:#f1f5f9;color:#0f172a;font-weight:700;font-size:0.82rem"><i class="bi bi-credit-card me-1"></i> M\u00e9todo de Pago y Condiciones</div>' +
    '<div class="card-body" style="background:#fff">' +
    '<div class="row g-2 align-items-center">' +
    '<div class="col-md-5"><label class="form-label" style="font-weight:600;font-size:0.82rem">M\u00e9todo de Pago *</label>' +
    '<select id="selectMetodoPagoCompra" class="form-select" style="border-radius:10px;border:1px solid #e2e8f0;font-size:0.85rem" data-change="compras-metodo-pago">' +
    '<option value="contado_efectivo" selected>Contado - Efectivo (Caja)</option>' +
    '<option value="contado_banco">Contado - Transferencia / Banco</option>' +
    '<option value="credito">A Cr\u00e9dito (Factura a Pagar)</option>' +
    '</select></div>' +
    '<div class="col-md-3" id="colVencimientoCompra" style="display:none"><label class="form-label" style="font-weight:600;font-size:0.82rem">Fecha de Vencimiento</label><input type="date" class="form-control" style="border-radius:10px;border:1px solid #e2e8f0;font-size:0.85rem" id="inputVencimientoCompra"></div>' +
    '<div class="col-md-4"><div id="avisoCondicionPagoCompra" class="form-text" style="margin-top:0;font-size:0.78rem;color:#475569"></div></div>' +
    '</div></div></div>';

var HTML_SECCION_SOPORTE_COMPRA =
    '<div class="card mb-3" style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">' +
    '<div style="padding:10px 16px;background:#f1f5f9;color:#0f172a;font-weight:700;font-size:0.82rem"><i class="bi bi-paperclip me-1"></i> Soporte / Adjunto</div>' +
    '<div class="card-body" style="background:#fff">' +
    '<div class="row g-2 align-items-center">' +
    '<div class="col-md-6"><input type="file" id="inputSoporteCompra" class="form-control" style="border-radius:10px;border:1px solid #e2e8f0;font-size:0.85rem" accept="image/png,image/jpeg,image/webp,application/pdf" data-change="compras-soporte"></div>' +
    '<div class="col-md-6"><div id="previewSoporteCompra" class="d-flex align-items-center gap-2"></div></div>' +
    '</div></div></div>';

var HTML_SECCION_IMPUESTOS_COMPRA =
    '<div class="card mb-3" style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">' +
    '<div style="padding:10px 16px;background:#f1f5f9;color:#0f172a;font-weight:700;font-size:0.82rem"><i class="bi bi-percent me-1"></i> Impuestos y Descuento General</div>' +
    '<div class="card-body" style="background:#fff">' +
    '<div class="row g-2 align-items-end">' +
    '<div class="col-md-2"><label class="form-label" style="font-weight:600;font-size:0.82rem">IVA %</label><input type="number" class="form-control" style="border-radius:10px;border:1px solid #e2e8f0;font-size:0.85rem" id="inputIvaGlobalCompra" min="0" step="0.01" value="0" data-input="compras-impuestos"></div>' +
    '<div class="col-md-2"><label class="form-label" style="font-weight:600;font-size:0.82rem">ICO %</label><input type="number" class="form-control" style="border-radius:10px;border:1px solid #e2e8f0;font-size:0.85rem" id="inputIcoGlobalCompra" min="0" step="0.01" value="0" data-input="compras-impuestos"></div>' +
    '<div class="col-md-3"><button type="button" class="btn btn-sm btn-outline-primary" style="border-radius:8px;font-size:0.75rem;margin-bottom:2px" data-action="compras-set-impuesto" data-iva="19" data-ico="0">IVA 19%</button> ' +
    '<button type="button" class="btn btn-sm btn-outline-primary" style="border-radius:8px;font-size:0.75rem;margin-bottom:2px" data-action="compras-set-impuesto" data-iva="19" data-ico="10">IVA 19% + ICO 10%</button> ' +
    '<button type="button" class="btn btn-sm btn-outline-secondary" style="border-radius:8px;font-size:0.75rem;margin-bottom:2px" data-action="compras-set-impuesto" data-iva="0" data-ico="0">Sin impuestos</button></div>' +
    '<div class="col-md-2"><label class="form-label" style="font-weight:600;font-size:0.82rem">Descuento</label><select id="selectTipoDescuentoCompra" class="form-select" style="border-radius:10px;border:1px solid #e2e8f0;font-size:0.85rem" data-change="compras-tipo-descuento"><option value="ninguno" selected>Sin descuento</option><option value="porcentaje">Porcentaje (%)</option><option value="monto">Monto fijo ($)</option></select></div>' +
    '<div class="col-md-3"><label class="form-label" style="font-weight:600;font-size:0.82rem">Valor Descuento</label><div class="input-group"><span class="input-group-text" id="prefijoDescuentoCompra" style="font-size:0.85rem">%</span><input type="number" class="form-control" style="border-radius:0 10px 10px 0;border:1px solid #e2e8f0;font-size:0.85rem" id="inputDescuentoCompra" min="0" step="0.01" value="0" disabled data-input="compras-descuento"></div></div>' +
    '</div>' +
    '<div class="form-text mt-2" style="font-size:0.75rem">Los impuestos y/o descuento se aplican a las l\u00edneas que conserven el valor global. Puede ajustarlos por producto al agregarlo.</div>' +
    '</div></div>';

var HTML_SECCION_PRODUCTOS_COMPRA =
    '<div class="card mb-3" style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">' +
    '<div style="padding:10px 16px;background:#f1f5f9;color:#0f172a;font-weight:700;font-size:0.82rem"><i class="bi bi-plus-circle me-1"></i> Agregar Producto</div>' +
    '<div class="card-body" style="background:#fff">' +
    '<div class="row g-2 mb-2"><div class="col-md-12"><input type="text" class="form-control" style="border-radius:10px;border:1px solid #e2e8f0;font-size:0.85rem" id="inputBuscarProductoCompra" placeholder="Buscar por nombre o c\u00f3digo de barras..." data-input="compras-filtrar"></div></div>' +
    '<div class="row g-2 align-items-end">' +
    '<div class="col-md-4"><label class="form-label" style="font-weight:600;font-size:0.82rem">Producto</label><select id="selectProductoCompra" class="form-select" style="border-radius:10px;border:1px solid #e2e8f0;font-size:0.85rem" data-change="compras-autocompletar"></select></div>' +
    '<div class="col-md-1"><label class="form-label" style="font-weight:600;font-size:0.82rem">Cant.</label><input type="number" class="form-control" style="border-radius:10px;border:1px solid #e2e8f0;font-size:0.85rem" id="inputCantCompra" min="1" value="1"></div>' +
    '<div class="col-md-2"><label class="form-label" style="font-weight:600;font-size:0.82rem">Costo Unit.</label><input type="number" class="form-control" style="border-radius:10px;border:1px solid #e2e8f0;font-size:0.85rem" id="inputCostoCompra" min="0" step="100" data-input="compras-validar-costo"></div>' +
    '<div class="col-md-1"><label class="form-label" style="font-weight:600;font-size:0.82rem">IVA %</label><input type="number" class="form-control" style="border-radius:10px;border:1px solid #e2e8f0;font-size:0.85rem" id="inputIvaItemCompra" min="0" step="0.01"></div>' +
    '<div class="col-md-1"><label class="form-label" style="font-weight:600;font-size:0.82rem">ICO %</label><input type="number" class="form-control" style="border-radius:10px;border:1px solid #e2e8f0;font-size:0.85rem" id="inputIcoItemCompra" min="0" step="0.01"></div>' +
    '<div class="col-md-1"><label class="form-label" style="font-weight:600;font-size:0.82rem">Dscto %</label><input type="number" class="form-control" style="border-radius:10px;border:1px solid #e2e8f0;font-size:0.85rem" id="inputDescItemCompra" min="0" step="0.01"></div>' +
    '<div class="col-md-2"><button type="button" class="btn-custom-action btn-pedir" style="padding:8px;font-size:0.82rem;width:100%" data-action="compras-agregar-item"><i class="bi bi-plus-lg me-1"></i> Agregar</button></div>' +
    '</div>' +
    '<div class="row g-2 mt-2 align-items-end">' +
    '<div class="col-md-6"><div id="alertaCostoCompra" style="font-size:0.82rem;min-height:22px"></div><div id="infoPrecioVentaActual" style="font-size:0.72rem;color:#64748b"></div></div>' +
    '<div class="col-md-3"><label class="form-label" style="font-weight:600;font-size:0.82rem"><i class="bi bi-tag me-1"></i>Nuevo Precio Venta</label><input type="number" class="form-control" style="border-radius:10px;border:1px solid #e2e8f0;font-size:0.85rem" id="inputNuevoPrecioCompra" min="0" step="100" placeholder="Opcional (ej: 25000)"><small style="font-size:0.68rem;color:#64748b;display:block;margin-top:2px">Si el costo subio, actualiza el PV aqui</small></div>' +
    '<div class="col-md-3"><button type="button" class="btn btn-outline-success btn-sm" style="border-radius:8px;font-weight:700;width:100%;height:38px;font-size:0.78rem;margin-top:4px" data-action="compras-sugerir-precio"><i class="bi bi-lightbulb me-1"></i>Sugerir +30%</button></div>' +
    '</div><div id="alertaCompraModal" style="margin-top:10px"></div></div></div>';

var HTML_RESUMEN_COMPRA =
    '<div id="contenedorDetalleCompra" class="mb-3"></div>' +
    '<div class="card mb-0" style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">' +
    '<div class="card-body" style="background:#fff;padding:12px 16px">' +
    '<div class="d-flex justify-content-between py-1"><span style="color:#64748b;font-size:0.85rem">Subtotal</span><span id="txtSubtotalCompra" style="font-weight:600;font-size:0.85rem">$0</span></div>' +
    '<div class="d-flex justify-content-between py-1"><span style="color:#64748b;font-size:0.85rem">Descuento</span><span id="txtDescuentoCompra" style="font-weight:600;font-size:0.85rem;color:#dc2626">-$0</span></div>' +
    '<div class="d-flex justify-content-between py-1"><span style="color:#64748b;font-size:0.85rem">Base Gravable</span><span id="txtBaseCompra" style="font-weight:600;font-size:0.85rem">$0</span></div>' +
    '<div class="d-flex justify-content-between py-1"><span style="color:#64748b;font-size:0.85rem">IVA</span><span id="txtIvaCompra" style="font-weight:600;font-size:0.85rem">$0</span></div>' +
    '<div class="d-flex justify-content-between py-1"><span style="color:#64748b;font-size:0.85rem">ICO</span><span id="txtIcoCompra" style="font-weight:600;font-size:0.85rem">$0</span></div>' +
    '</div></div>';

function htmlModalCompra() {
    return '<div class="modal fade" id="modalCompra" tabindex="-1" aria-hidden="true">' +
        '<div class="modal-dialog modal-xl modal-dialog-scrollable">' +
        '<div class="modal-content">' +
        '<div class="modal-header" style="background:#0f172a"><h5 class="modal-title"><i class="bi bi-bag-plus me-2"></i>Nueva Compra / Entrada de Stock</h5><button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div>' +
        '<div class="modal-body" style="background:#f8fafc">' +
        HTML_SECCION_PROVEEDOR_COMPRA +
        HTML_SECCION_PAGO_COMPRA +
        HTML_SECCION_SOPORTE_COMPRA +
        HTML_SECCION_IMPUESTOS_COMPRA +
        HTML_SECCION_PRODUCTOS_COMPRA +
        HTML_RESUMEN_COMPRA +
        '</div>' +
        '<div class="modal-footer" style="border-top:1px solid #e2e8f0;background:#fff">' +
        '<div class="me-auto" style="font-size:0.95rem;font-weight:800;color:#0f172a">Total: <span id="txtTotalCompra" style="color:#10b981">$0</span></div>' +
        '<button type="button" class="btn btn-light" style="border-radius:8px;font-weight:600" data-bs-dismiss="modal">Cancelar</button>' +
        '<button type="button" class="btn-custom-action btn-cobrar" style="width:auto;padding:10px 24px" id="btnRegistrarCompra" data-action="compras-confirmar"><i class="bi bi-check-lg me-1"></i> Registrar Compra</button>' +
        '</div></div></div></div>';
}

function htmlModalDetalleCompra() {
    return '<div class="modal fade" id="modalDetalleCompra" tabindex="-1" aria-hidden="true">' +
        '<div class="modal-dialog modal-lg modal-dialog-scrollable">' +
        '<div class="modal-content">' +
        '<div class="modal-header" style="background:#0f172a"><h5 class="modal-title"><i class="bi bi-receipt me-2"></i>Detalle de Compra</h5><button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div>' +
        '<div class="modal-body" style="background:#f8fafc" id="contenidoDetalleCompra"></div>' +
        '</div></div></div>';
}

var modalCompraBS = null;

function cargarHistorialCompras() {
    var cont = document.getElementById('contenedorTablaCompras');
    cont.innerHTML = '<div class="spinner-border spinner-border-sm text-primary"></div>';

    fetch(API_BASE + '/api/compras')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success) {
                comprasHistorialGlobal = data.compras || [];
                renderizarTablaCompras(comprasFiltradasPorFecha());
            } else {
                cont.innerHTML = '<div style="padding:20px;color:#dc2626"><i class="bi bi-exclamation-triangle me-1"></i> Error al cargar compras</div>';
            }
        })
        .catch(function() {
            cont.innerHTML = '<div style="padding:20px;color:#dc2626"><i class="bi bi-exclamation-triangle me-1"></i> No se pudo conectar con el servidor</div>';
        });
}

function renderizarTablaCompras(compras) {
    var cont = document.getElementById('contenedorTablaCompras');
    var rs = document.getElementById('resumenFiltroCompras');
    var filtrando = !!(filtroComprasDesde || filtroComprasHasta);
    var total = (compras || []).reduce(function(a, c) { return a + Number(c.total || 0); }, 0);
    if (rs) rs.textContent = filtrando ? (compras.length + ' compra(s) · Total $' + fmtCompra(total) + ' (' + (filtroComprasDesde || '...') + ' a ' + (filtroComprasHasta || '...') + ')') : (compras.length + ' compra(s) · Total $' + fmtCompra(total));
    if (compras.length === 0) {
        cont.innerHTML = '<div style="padding:24px;color:#94a3b8;text-align:center"><i class="bi bi-bag" style="font-size:2rem;display:block;margin-bottom:8px"></i>' + (filtrando ? 'No hay compras en el rango de fechas.' : 'No hay compras registradas.') + '</div>';
        return;
    }
    var tabla = '<div class="table-responsive"><table class="table table-hover mb-0 align-middle" style="margin:0">' +
        '<thead style="background:#f8fafc"><tr>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.85rem">ID</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.85rem">Fecha</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.85rem">F. Factura</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.85rem">Proveedor</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.85rem">N. Factura</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.85rem">M\u00e9todo</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.85rem">Estado</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.85rem">Total</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.85rem">Saldo</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.85rem">Soporte</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.85rem">Registrado por</th>' +
        '<th class="text-center" style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.85rem">Detalle</th></tr></thead><tbody>';

    compras.forEach(function(c) {
        var fecha = new Date(c.fecha).toLocaleString('es-CO');
        var fechaFac = c.fecha_factura ? String(c.fecha_factura).slice(0, 10) : '-';
        var metodo = c.metodo_pago || (c.forma_pago || 'Contado');
        var metodoLabel = esCreditoCompra(metodo) ? 'Cr\u00e9dito' : (/transferencia|banco/i.test(metodo) ? 'Banco' : 'Efectivo');
        if (esCreditoCompra(metodo) && c.dias_credito) metodoLabel += ' (' + c.dias_credito + ' d\u00edas)';
        var estado = c.estado || 'Pagada';
        var badgeEstado = '';
        if (estado === 'Pendiente') badgeEstado = '<span style="background:#fef3c7;color:#92400e;padding:3px 10px;border-radius:20px;font-size:0.72rem;font-weight:700;white-space:nowrap">Pendiente</span>';
        else if (estado === 'Parcial') badgeEstado = '<span style="background:#fff7ed;color:#c2410c;padding:3px 10px;border-radius:20px;font-size:0.72rem;font-weight:700;white-space:nowrap">Parcial</span>';
        else if (estado === 'Anulada') badgeEstado = '<span style="background:#fee2e2;color:#b91c1c;padding:3px 10px;border-radius:20px;font-size:0.72rem;font-weight:700;white-space:nowrap">Anulada</span>';
        else badgeEstado = '<span style="background:#d1fae5;color:#047857;padding:3px 10px;border-radius:20px;font-size:0.72rem;font-weight:700;white-space:nowrap">Pagada</span>';
        var saldo = (estado === 'Pagada' || estado === 'Anulada') ? 0 : (Number(c.saldo_pendiente) || Number(c.total) || 0);
        var soporteIcono = c.soporte ? '<i class="bi bi-paperclip" title="Tiene soporte adjunto" style="color:#2563eb;font-size:1rem"></i>' : '-';
        tabla += '<tr style="border-color:#f1f5f9">' +
            '<td style="border-color:#f1f5f9;font-weight:700;color:#0f172a">#' + Number(c.id_compra) + '</td>' +
            '<td style="border-color:#f1f5f9;color:#64748b">' + escCompra(fecha) + '</td>' +
            '<td style="border-color:#f1f5f9;color:#64748b">' + escCompra(fechaFac) + '</td>' +
            '<td style="border-color:#f1f5f9;color:#334155;font-weight:600">' + escCompra(c.proveedor_nombre || '-') + '</td>' +
            '<td style="border-color:#f1f5f9;color:#64748b">' + escCompra(c.numero_factura || '-') + '</td>' +
            '<td style="border-color:#f1f5f9;color:#64748b">' + escCompra(metodoLabel) + '</td>' +
            '<td style="border-color:#f1f5f9">' + badgeEstado + '</td>' +
            '<td style="border-color:#f1f5f9;color:#10b981;font-weight:700">$' + fmtCompra(c.total) + '</td>' +
            '<td style="border-color:#f1f5f9;font-weight:700;color:' + (saldo > 0 ? '#dc2626' : '#94a3b8') + '">$' + fmtCompra(saldo) + '</td>' +
            '<td style="border-color:#f1f5f9;text-align:center">' + soporteIcono + '</td>' +
            '<td style="border-color:#f1f5f9;color:#64748b">' + escCompra(c.usuario_nombre || '-') + '</td>' +
            '<td class="text-center" style="border-color:#f1f5f9"><button class="btn-custom-action" style="background:#eff6ff;color:#2563eb;padding:4px 10px;font-size:0.75rem;border:1px solid #bfdbfe" data-action="compras-ver-detalle" data-id="' + Number(c.id_compra) + '"><i class="bi bi-eye me-1"></i>Ver</button></td></tr>';
    });
    tabla += '</tbody></table></div>';
    cont.innerHTML = tabla;
}

function modalNuevaCompra() {
    asegurarModalesCompra();
    limpiarBackdropsCompra();
    detallesCompra = [];
    soporteCompraBase64 = null;
    var _setVal = function(id, v) { var el = document.getElementById(id); if (el) el.value = v; };
    var _setHtml = function(id, h) { var el = document.getElementById(id); if (el) el.innerHTML = h; };
    _setVal('selectProveedorCompra', '');
    _setVal('inputNumFactura', '');
    _setVal('inputObsCompra', '');
    _setVal('inputFechaFacturaCompra', fechaHoyCompra());
    _setVal('selectMetodoPagoCompra', 'contado_efectivo');
    _setVal('inputVencimientoCompra', '');
    var colVen = document.getElementById('colVencimientoCompra');
    if (colVen) colVen.style.display = 'none';
    _setVal('inputSoporteCompra', '');
    _setHtml('previewSoporteCompra', '');
    _setVal('inputIvaGlobalCompra', '0');
    _setVal('inputIcoGlobalCompra', '0');
    ivaGlobalCompra = 0;
    icoGlobalCompra = 0;
    _setVal('selectTipoDescuentoCompra', 'ninguno');
    _setVal('inputDescuentoCompra', '0');
    var inpDesc = document.getElementById('inputDescuentoCompra');
    if (inpDesc) inpDesc.disabled = true;
    var pref = document.getElementById('prefijoDescuentoCompra');
    if (pref) pref.textContent = '%';
    tipoDescuentoCompra = 'ninguno';
    descuentoGlobalCompra = 0;
    _setVal('inputBuscarProductoCompra', '');
    _setVal('inputCantCompra', '1');
    _setVal('inputCostoCompra', '');
    _setVal('inputIvaItemCompra', '');
    _setVal('inputIcoItemCompra', '');
    _setVal('inputDescItemCompra', '');
    _setVal('inputNuevoPrecioCompra', '');
    _setHtml('alertaCostoCompra', '');
    _setHtml('infoPrecioVentaActual', '');
    var cC = document.getElementById('inputCostoCompra'); if(cC){cC.style.borderColor='#e2e8f0'; cC.style.background='#fff'; cC.style.boxShadow='none';}
    var cPV = document.getElementById('inputNuevoPrecioCompra'); if(cPV){cPV.style.borderColor='#e2e8f0'; cPV.style.background='#fff';}
    try { cambiarMetodoPagoCompra(); } catch(e) {}
    try { renderizarDetalleCompra(); } catch(e) {}

    var elModal = document.getElementById('modalCompra');
    if (!elModal) return;
    try {
        modalCompraBS = bootstrap.Modal.getOrCreateInstance(elModal);
        modalCompraBS.show();
    } catch(e) {
        modalCompraBS = new bootstrap.Modal(elModal);
        modalCompraBS.show();
    }
    cargarOpcionesCompra();
}

function cargarOpcionesCompra() {
    Promise.all([
        fetch(API_BASE + '/api/proveedores').then(function(r) { return r.json(); }).catch(function() { return { proveedores: [] }; }),
        fetch(API_BASE + '/api/productos/admin').then(function(r) { return r.json(); }).catch(function() { return { productos: [] }; }),
        fetch(API_BASE + '/api/config-inventario').then(function(r) { return r.json(); }).catch(function() { return { config: {} }; })
    ]).then(function(results) {
        listaProveedoresCompra = (results[0] && results[0].proveedores) || [];
        listaProductosCompra = (results[1] && results[1].productos) || [];
        if (listaProductosCompra.length === 0 && results[1] && results[1].mensaje) {
            console.warn('Productos/admin:', results[1].mensaje);
        }

        var config = (results[2] && results[2].config) || {};
        var ivaDef = Number(config.iva_global) || 0;
        var icoDef = Number(config.ico_global) || 0;
        if (ivaDef || icoDef) setImpuestoGlobalCompra(ivaDef, icoDef);

        var selProv = document.getElementById('selectProveedorCompra');
        if (selProv) {
            var optsProv = '<option value="">Seleccionar proveedor...</option>';
            listaProveedoresCompra.filter(function(p) { return p.activo; }).forEach(function(p) {
                optsProv += '<option value="' + p.id_proveedor + '">' + escCompra(p.nombre) + '</option>';
            });
            if (listaProveedoresCompra.length === 0) optsProv = '<option value="">Sin proveedores (crea uno en Proveedores)</option>';
            selProv.innerHTML = optsProv;
        }

        var selProd = document.getElementById('selectProductoCompra');
        if (selProd && listaProductosCompra.length === 0) {
            selProd.innerHTML = '<option value="">Sin productos (crea uno en Inventario)</option>';
            if (typeof mostrarAlerta === 'function') mostrarAlerta('warning', 'No hay productos cargados. Verifica Inventario o la API /api/productos/admin');
        } else {
            if (esCreditoCompra(document.getElementById('selectMetodoPagoCompra').value)) calcularVencimientoCreditoCompra();
            filtrarProductosCompra();
        }
    }).catch(function(err) {
        console.error('cargarOpcionesCompra', err);
        if (typeof mostrarAlerta === 'function') mostrarAlerta('danger', 'No se pudieron cargar proveedores/productos. Revisa consola (F12)');
    });
}

function cambiarMetodoPagoCompra() {
    var metodo = document.getElementById('selectMetodoPagoCompra').value;
    var colVen = document.getElementById('colVencimientoCompra');
    var aviso = document.getElementById('avisoCondicionPagoCompra');
    var esCredito = esCreditoCompra(metodo);
    colVen.style.display = esCredito ? '' : 'none';
    if (esCredito) {
        if (!document.getElementById('inputVencimientoCompra').value) calcularVencimientoCreditoCompra();
        aviso.innerHTML = '<i class="bi bi-info-circle me-1 text-warning"></i>Se genera una <b>cuenta por pagar</b>. El stock entra de inmediato y el pago se hace luego desde <b>Proveedores</b>.';
    } else if (/transferencia|banco/i.test(metodo)) {
        aviso.innerHTML = '<i class="bi bi-bank me-1 text-primary"></i>Pago de contado por <b>Transferencia / Banco</b>: se registrar\u00e1 un egreso en Caja.';
    } else {
        aviso.innerHTML = '<i class="bi bi-cash-coin me-1 text-success"></i>Pago de contado en <b>Efectivo (Caja)</b>: se registrar\u00e1 un egreso en Caja.';
    }
}

function calcularVencimientoCreditoCompra() {
    var prov = listaProveedoresCompra.find(function(p) {
        return String(p.id_proveedor) === String(document.getElementById('selectProveedorCompra').value);
    });
    var dias = prov && prov.dias_credito ? Number(prov.dias_credito) : 0;
    var fechaFactura = document.getElementById('inputFechaFacturaCompra').value || fechaHoyCompra();
    var base = new Date(String(fechaFactura).replace(/-/g, '/'));
    if (isNaN(base.getTime())) base = new Date();
    base.setDate(base.getDate() + dias);
    document.getElementById('inputVencimientoCompra').value = fechaISOCompra(base);
}

function procesarSoporteCompra(el) {
    var input = (el && el.files) ? el : ((el && el.target) ? el.target : el);
    var file = input && input.files && input.files[0];
    var pre = document.getElementById('previewSoporteCompra');
    if (!file) {
        soporteCompraBase64 = null;
        pre.innerHTML = '';
        return;
    }
    if (file.size > 3 * 1024 * 1024) {
        mostrarAlerta('warning', 'El soporte supera 3 MB y se guardar\u00e1 sin previsualizaci\u00f3n.');
    }
    var reader = new FileReader();
    reader.onload = function() {
        soporteCompraBase64 = reader.result;
        var tipo = (file.type || '').toLowerCase();
        if (tipo.indexOf('image/') === 0) {
            pre.innerHTML = '<img src="' + reader.result + '" alt="soporte" style="height:56px;border-radius:8px;border:1px solid #e2e8f0"> <span style="font-size:0.8rem;color:#64748b">' + escCompra(file.name) + '</span> <i class="bi bi-check-circle-fill text-success"></i>';
        } else {
            pre.innerHTML = '<i class="bi bi-file-earmark-pdf text-danger fs-4"></i> <span style="font-size:0.8rem;color:#64748b">' + escCompra(file.name) + '</span> <i class="bi bi-check-circle-fill text-success"></i>';
        }
    };
    reader.readAsDataURL(file);
}

// =========================================================
// VALIDACION COSTO vs PRECIO VENTA (REQ 1 y 2)
// =========================================================
function obtenerProductoCompraPorId(idProducto) {
    return listaProductosCompra.find(function(p) { return Number(p.id_producto) === Number(idProducto); }) || null;
}
function obtenerPrecioVentaProducto(idProducto) {
    var p = obtenerProductoCompraPorId(idProducto);
    if (!p) return 0;
    // prioridad: precio (alias venta) -> precio_venta -> precioVenta
    var v = p.precio;
    if (v == null || v === '') v = p.precio_venta;
    if (v == null || v === '') v = p.precioVenta;
    if (v == null || v === '') v = p.precio_venta_actual;
    return Number(v) || 0;
}
function validarCostoVsPrecioVenta(costo, precioVenta) {
    var c = Number(String(costo).replace(',','.')) || 0;
    var pv = Number(precioVenta) || 0;
    return { costo: c, precioVenta: pv, excede: pv > 0 && c > pv, diferencia: c - pv };
}
function actualizarInfoPrecioVentaActual() {
    var sel = document.getElementById('selectProductoCompra');
    var info = document.getElementById('infoPrecioVentaActual');
    if (!sel || !info) return;
    if (!sel.value) { info.textContent = ''; return; }
    var pv = obtenerPrecioVentaProducto(sel.value);
    var p = obtenerProductoCompraPorId(sel.value);
    if (pv > 0) info.textContent = 'Precio venta actual: $' + fmtCompra(pv) + (p ? ' · ' + escCompra(p.nombre) : '');
    else info.textContent = 'Precio venta actual: no registrado';
}
function validarCostoInputTiempoReal(mostrarToast) {
    var sel = document.getElementById('selectProductoCompra');
    var campoCosto = document.getElementById('inputCostoCompra');
    var alerta = document.getElementById('alertaCostoCompra');
    var campoNuevoPV = document.getElementById('inputNuevoPrecioCompra');
    if (!sel || !campoCosto || !alerta) return null;
    actualizarInfoPrecioVentaActual();
    var idProd = sel.value;
    if (!idProd) {
        alerta.innerHTML = '';
        campoCosto.style.borderColor = '#e2e8f0';
        campoCosto.style.background = '#fff';
        return null;
    }
    var costo = Number(String(campoCosto.value).replace(',','.')) || 0;
    if (!costo || costo <= 0) {
        alerta.innerHTML = '';
        campoCosto.style.borderColor = '#e2e8f0';
        campoCosto.style.background = '#fff';
        return null;
    }
    var pv = obtenerPrecioVentaProducto(idProd);
    var res = validarCostoVsPrecioVenta(costo, pv);
    if (res.excede) {
        campoCosto.style.borderColor = '#ef4444';
        campoCosto.style.background = '#fef2f2';
        campoCosto.style.boxShadow = '0 0 0 3px rgba(239,68,68,0.15)';
        var sugerido = Math.ceil(costo * 1.3 / 100) * 100;
        alerta.innerHTML = '<span style="color:#dc2626;font-weight:700"><i class="bi bi-exclamation-triangle-fill me-1"></i>¡Atención! El costo ($' + fmtCompra(costo) + ') es mayor al precio de venta actual ($' + fmtCompra(pv) + ') — pérdida potencial $' + fmtCompra(res.diferencia) + ' por unidad.</span>' +
            ' <span style="color:#64748b">Sugerido PV: $' + fmtCompra(sugerido) + ' (+30%)</span>';
        // auto-rellenar nuevo precio si esta vacio
        if (campoNuevoPV && !campoNuevoPV.value) {
            campoNuevoPV.placeholder = 'Sugerido $' + fmtCompra(sugerido);
        }
        if (mostrarToast === true) {
            var msgToast = '⚠️ Costo $' + fmtCompra(costo) + ' > PV $' + fmtCompra(pv) + ' — revisa el margen';
            if (typeof mostrarAlerta === 'function') mostrarAlerta('warning', msgToast);
            else if (typeof mostrarToast === 'function') mostrarToast('warning', msgToast);
        }
    } else {
        campoCosto.style.borderColor = pv > 0 && costo > 0 ? '#10b981' : '#e2e8f0';
        campoCosto.style.background = pv > 0 && costo > 0 ? '#f0fdf4' : '#fff';
        campoCosto.style.boxShadow = 'none';
        if (pv > 0) {
            var margen = pv - costo;
            var pct = costo > 0 ? Math.round(margen / costo * 100) : 0;
            alerta.innerHTML = '<span style="color:#059669"><i class="bi bi-check-circle-fill me-1"></i>Margen OK: PV $' + fmtCompra(pv) + ' — costo $' + fmtCompra(costo) + ' · ganancia $' + fmtCompra(margen) + ' (' + pct + '%)</span>';
        } else {
            alerta.innerHTML = '';
        }
    }
    return res;
}
function sugerirNuevoPrecioVenta() {
    var sel = document.getElementById('selectProductoCompra');
    var campoCosto = document.getElementById('inputCostoCompra');
    var campoPV = document.getElementById('inputNuevoPrecioCompra');
    if (!sel || !sel.value) { mostrarAlertaCompra('warning','Selecciona un producto primero'); return; }
    var costo = Number(String(campoCosto.value).replace(',','.')) || 0;
    if (!costo || costo <= 0) { mostrarAlertaCompra('warning','Ingresa el costo unitario primero'); return; }
    var sugerido = Math.ceil(costo * 1.30 / 100) * 100;
    // regla alterna: si PV actual existe, max entre sugerido y PV actual
    var pvActual = obtenerPrecioVentaProducto(sel.value);
    if (pvActual > sugerido) sugerido = pvActual;
    // si costo ya supera PV, sugerir costo*1.3 aunque sea menor que PV? ya cubierto
    if (costo > pvActual) sugerido = Math.ceil(costo * 1.30 / 100) * 100;
    if (campoPV) { campoPV.value = sugerido; campoPV.style.borderColor = '#10b981'; campoPV.style.background='#f0fdf4'; }
    validarCostoInputTiempoReal(false);
    if (typeof mostrarAlerta === 'function') mostrarAlerta('info','Precio sugerido $' + fmtCompra(sugerido) + ' aplicado. Ajustalo si es necesario antes de Agregar.');
}

function autocompletarCostoCompra() {
    var sel = document.getElementById('selectProductoCompra');
    if (!sel || !sel.value) { actualizarInfoPrecioVentaActual(); validarCostoInputTiempoReal(false); return; }
    var opt = sel.options[sel.selectedIndex];
    var costo = opt ? Number(opt.getAttribute('data-costo')) : 0;
    var campo = document.getElementById('inputCostoCompra');
    if (!campo) return;
    if (opt && (!campo.value || Number(String(campo.value).replace(',','.')) <= 0)) campo.value = costo > 0 ? costo : '';
    actualizarInfoPrecioVentaActual();
    validarCostoInputTiempoReal(false);
}

function filtrarProductosCompra() {
    var sel = document.getElementById('selectProductoCompra');
    var previo = sel ? sel.value : '';
    var qRaw = (document.getElementById('inputBuscarProductoCompra').value || '').trim();
    var q = normCompra(qRaw);
    var filtrados = listaProductosCompra.filter(function(p) {
        if (Number(p.activo) === 0) return false;
        if (!q) return true;
        var n = normCompra(p.nombre);
        var c = normCompra(p.codigo_barras);
        return n.indexOf(q) !== -1 || c.indexOf(q) !== -1;
    });
    var html = '<option value="">Seleccionar producto...</option>';
    filtrados.forEach(function(p) {
        var costoRef = Number(p.precio_costo) || Number(p.precio) || 0;
        var label = p.nombre + (p.codigo_barras ? ' (' + p.codigo_barras + ')' : '');
        var selAttr = (String(p.id_producto) === String(previo)) ? ' selected' : '';
        html += '<option value="' + p.id_producto + '" data-costo="' + costoRef + '"' + selAttr + '>' + escCompra(label) + '</option>';
    });
    if (sel) sel.innerHTML = html;
    if (filtrados.length === 1 && !previo) {
        sel.value = String(filtrados[0].id_producto);
    }
    if (filtrados.length === 0) {
        var contAlert = document.getElementById('contenedorAlertas');
        if (q && listaProductosCompra.length > 0 && typeof mostrarAlerta === 'function') {
            mostrarAlerta('warning', 'Ning\u00fan producto coincide con "' + escCompra(q) + '"');
        }
    }
    autocompletarCostoCompra();
}

function setImpuestoGlobalCompra(iva, ico) {
    document.getElementById('inputIvaGlobalCompra').value = iva;
    document.getElementById('inputIcoGlobalCompra').value = ico;
    aplicarImpuestosGlobalCompra();
}

function aplicarImpuestosGlobalCompra() {
    var nuevoIva = Number(document.getElementById('inputIvaGlobalCompra').value) || 0;
    var nuevoIco = Number(document.getElementById('inputIcoGlobalCompra').value) || 0;
    detallesCompra.forEach(function(d) {
        if (d.iva_pct === ivaGlobalCompra) d.iva_pct = nuevoIva;
        if (d.ico_pct === icoGlobalCompra) d.ico_pct = nuevoIco;
    });
    ivaGlobalCompra = nuevoIva;
    icoGlobalCompra = nuevoIco;
    renderizarDetalleCompra();
}

function cambiarTipoDescuentoCompra() {
    var tipo = document.getElementById('selectTipoDescuentoCompra').value;
    var inp = document.getElementById('inputDescuentoCompra');
    var pref = document.getElementById('prefijoDescuentoCompra');
    tipoDescuentoCompra = tipo;
    if (tipo === 'ninguno') {
        inp.disabled = true;
        inp.value = '0';
    } else {
        inp.disabled = false;
        inp.value = '0';
    }
    pref.textContent = (tipo === 'monto') ? '$' : '%';
    aplicarDescuentoCompra();
}

function aplicarDescuentoCompra() {
    var val = Number(document.getElementById('inputDescuentoCompra').value) || 0;
    descuentoGlobalCompra = val;
    if (tipoDescuentoCompra === 'ninguno') {
        detallesCompra.forEach(function(d) { d.descuento = 0; });
    } else if (tipoDescuentoCompra === 'porcentaje') {
        detallesCompra.forEach(function(d) {
            var sub = d.cantidad * d.costo_unitario;
            d.descuento = redondearCompra(sub * Math.min(val, 100) / 100);
        });
    } else {
        var totSub = 0;
        var i;
        for (i = 0; i < detallesCompra.length; i++) totSub += detallesCompra[i].cantidad * detallesCompra[i].costo_unitario;
        if (totSub <= 0) {
            detallesCompra.forEach(function(d) { d.descuento = 0; });
        } else {
            var restante = redondearCompra(val);
            for (i = 0; i < detallesCompra.length; i++) {
                var subLinea = detallesCompra[i].cantidad * detallesCompra[i].costo_unitario;
                var share;
                if (i === detallesCompra.length - 1) {
                    share = redondearCompra(Math.max(0, restante));
                } else {
                    share = redondearCompra(subLinea * val / totSub);
                }
                var aplicado = Math.min(share, subLinea);
                detallesCompra[i].descuento = redondearCompra(aplicado);
                restante -= aplicado;
            }
        }
    }
    renderizarDetalleCompra();
}

function mostrarAlertaCompra(tipo, msg) {
    var cModal = document.getElementById('alertaCompraModal');
    if (cModal) {
        cModal.innerHTML = '<div class="alert alert-' + tipo + ' alert-dismissible fade show" style="font-size:0.85rem">' + msg + '<button type="button" class="btn-close" data-bs-dismiss="alert"></button></div>';
        setTimeout(function(){ if(cModal) cModal.innerHTML=''; }, 4000);
    }
    if (typeof mostrarAlerta === 'function') try{ mostrarAlerta(tipo, msg); }catch(e){}
    else if (tipo==='warning' || tipo==='danger') alert(msg);
}
function agregarItemCompra() {
    var selProd = document.getElementById('selectProductoCompra');
    var inpCant = document.getElementById('inputCantCompra');
    var inpCosto = document.getElementById('inputCostoCompra');
    var buscarEl = document.getElementById('inputBuscarProductoCompra');
    var rawProd = selProd ? selProd.value : '';
    var rawCant = inpCant ? inpCant.value : '';
    var rawCosto = inpCosto ? inpCosto.value : '';
    var rawBuscar = buscarEl ? buscarEl.value : '';
    var idProducto = Number(String(rawProd).trim());
    var cantidad = Number(String(rawCant).replace(',', '.').trim());
    var costo = Number(String(rawCosto).replace(',', '.').trim());
    if ((!rawProd || !idProducto || isNaN(idProducto) || idProducto <= 0) && rawBuscar) {
        var qNorm = normCompra(rawBuscar);
        var candidatos = listaProductosCompra.filter(function(p){
            if (Number(p.activo)===0) return false;
            return normCompra(p.nombre).indexOf(qNorm)!==-1 || normCompra(p.codigo_barras).indexOf(qNorm)!==-1;
        });
        if (candidatos.length === 1) {
            idProducto = Number(candidatos[0].id_producto);
            rawProd = String(idProducto);
            if (selProd) selProd.value = rawProd;
            autocompletarCostoCompra();
            rawCosto = document.getElementById('inputCostoCompra').value;
            costo = Number(String(rawCosto).replace(',','.').trim());
            mostrarAlertaCompra('info', 'Auto-seleccionado: ' + escCompra(candidatos[0].nombre));
        } else if (candidatos.length > 1) {
            mostrarAlertaCompra('warning', 'Hay ' + candidatos.length + ' productos que coinciden con "' + escCompra(rawBuscar) + '". Seleccione uno en la lista.');
            return;
        }
    }

    if (!rawProd || !idProducto || isNaN(idProducto) || idProducto <= 0) {
        mostrarAlertaCompra('warning', 'Seleccione un producto. ' + (listaProductosCompra.length === 0 ? 'No hay productos cargados.' : 'Valor actual: "' + escCompra(rawProd) + '" - elija de la lista. Opciones: ' + (selProd ? selProd.options.length : 0) + (rawBuscar ? ' | Buscar: "'+escCompra(rawBuscar)+'"' : '')));
        return;
    }
    if (rawCant === '' || isNaN(cantidad) || cantidad <= 0) {
        mostrarAlertaCompra('warning', 'Ingrese una cantidad v\u00e1lida (>0). Valor actual: "' + escCompra(rawCant) + '"');
        return;
    }
    if (rawCosto === '' || isNaN(costo) || costo <= 0) {
        mostrarAlertaCompra('warning', 'Ingrese un costo unitario v\u00e1lido (>0). Valor actual: "' + escCompra(rawCosto) + '"');
        return;
    }

    var prod = listaProductosCompra.find(function(p) { return Number(p.id_producto) === idProducto; });
    var ivaItem = document.getElementById('inputIvaItemCompra').value;
    var icoItem = document.getElementById('inputIcoItemCompra').value;
    var descItem = document.getElementById('inputDescItemCompra').value;
    var effIva = (ivaItem !== '' && ivaItem !== null && ivaItem !== undefined) ? Number(ivaItem) : ivaGlobalCompra;
    var effIco = (icoItem !== '' && icoItem !== null && icoItem !== undefined) ? Number(icoItem) : icoGlobalCompra;
    var effDescPct = (descItem !== '' && descItem !== null && descItem !== undefined) ? Number(descItem) : 0;
    var nuevoPrecioRaw = document.getElementById('inputNuevoPrecioCompra') ? document.getElementById('inputNuevoPrecioCompra').value : '';
    var nuevoPrecioVenta = nuevoPrecioRaw !== '' && nuevoPrecioRaw != null ? Number(String(nuevoPrecioRaw).replace(',','.')) : null;
    if (nuevoPrecioVenta != null && (isNaN(nuevoPrecioVenta) || nuevoPrecioVenta <= 0)) nuevoPrecioVenta = null;
    var precioVentaActual = obtenerPrecioVentaProducto(idProducto);
    var validacion = validarCostoVsPrecioVenta(costo, precioVentaActual);
    // Si costo > precio y no hay nuevo PV que lo supere, avisar pero permitir agregar (alerta)
    if (validacion.excede) {
        var necesitaNuevoPV = !nuevoPrecioVenta || nuevoPrecioVenta <= costo;
        var msgAlerta = '⚠️ ¡Atención! El costo $' + fmtCompra(costo) + ' es mayor al precio de venta actual $' + fmtCompra(precioVentaActual) + ' (' + escCompra(prod ? prod.nombre : 'Producto') + ')';
        if (necesitaNuevoPV) {
            msgAlerta += '. Sugiere un Nuevo Precio de Venta mayor al costo.';
            // toast advertencia inmediata
            if (typeof mostrarAlerta === 'function') mostrarAlerta('warning', msgAlerta);
            mostrarAlertaCompra('warning', msgAlerta + ' <button class="btn btn-sm btn-warning ms-2" onclick="document.getElementById(\'inputNuevoPrecioCompra\').focus()" style="padding:2px 8px;font-size:0.72rem">Corregir PV</button>');
        } else {
            msgAlerta += '. Se actualizará PV a $' + fmtCompra(nuevoPrecioVenta);
            if (typeof mostrarAlerta === 'function') mostrarAlerta('info', msgAlerta);
        }
        // resaltar borde rojo momentáneo
        var campoCostoAlert = document.getElementById('inputCostoCompra');
        if (campoCostoAlert) { campoCostoAlert.style.borderColor='#ef4444'; campoCostoAlert.style.background='#fef2f2'; }
    }
    var existente = detallesCompra.find(function(d) { return Number(d.id_producto) === idProducto; });

    if (existente) {
        existente.cantidad += cantidad;
        existente.costo_unitario = costo;
        existente.iva_pct = effIva;
        existente.ico_pct = effIco;
        existente.precio_venta_actual = precioVentaActual;
        if (nuevoPrecioVenta != null && nuevoPrecioVenta > 0) existente.nuevo_precio_venta = nuevoPrecioVenta;
        if (effDescPct > 0) {
            existente.descuento = redondearCompra(existente.cantidad * existente.costo_unitario * Math.min(effDescPct, 100) / 100);
        }
    } else {
        var sub = cantidad * costo;
        var desc = effDescPct > 0 ? redondearCompra(sub * Math.min(effDescPct, 100) / 100) : 0;
        detallesCompra.push({
            id_producto: idProducto,
            nombre: prod ? prod.nombre : 'Producto',
            cantidad: cantidad,
            costo_unitario: costo,
            precio_venta_actual: precioVentaActual,
            nuevo_precio_venta: nuevoPrecioVenta,
            iva_pct: effIva,
            ico_pct: effIco,
            descuento: desc
        });
    }

    document.getElementById('inputCantCompra').value = 1;
    document.getElementById('inputCostoCompra').value = '';
    document.getElementById('inputIvaItemCompra').value = '';
    document.getElementById('inputIcoItemCompra').value = '';
    document.getElementById('inputDescItemCompra').value = '';
    if (document.getElementById('inputNuevoPrecioCompra')) {
        document.getElementById('inputNuevoPrecioCompra').value = '';
        document.getElementById('inputNuevoPrecioCompra').placeholder = 'Opcional (ej: 25000)';
        document.getElementById('inputNuevoPrecioCompra').style.borderColor='#e2e8f0';
        document.getElementById('inputNuevoPrecioCompra').style.background='#fff';
    }
    var alertaC = document.getElementById('alertaCostoCompra');
    if (alertaC) alertaC.innerHTML = '';
    var infoPV = document.getElementById('infoPrecioVentaActual');
    if (infoPV) infoPV.textContent = '';
    var cCosto = document.getElementById('inputCostoCompra');
    if (cCosto) { cCosto.style.borderColor='#e2e8f0'; cCosto.style.background='#fff'; cCosto.style.boxShadow='none'; }
    if (tipoDescuentoCompra === 'ninguno') {
        renderizarDetalleCompra();
    } else {
        aplicarDescuentoCompra();
    }
}

function quitarItemCompra(index) {
    detallesCompra.splice(index, 1);
    aplicarDescuentoCompra();
}

function setResumenCompra(sub, desc, base, iva, ico, total) {
    document.getElementById('txtSubtotalCompra').textContent = '$' + fmtCompra(sub);
    document.getElementById('txtDescuentoCompra').textContent = '-$' + fmtCompra(desc);
    document.getElementById('txtBaseCompra').textContent = '$' + fmtCompra(base);
    document.getElementById('txtIvaCompra').textContent = '$' + fmtCompra(iva);
    document.getElementById('txtIcoCompra').textContent = '$' + fmtCompra(ico);
    document.getElementById('txtTotalCompra').textContent = '$' + fmtCompra(total);
}

function actualizarCostoItemCompra(index, valor) {
    var item = detallesCompra[index];
    if (!item) return;
    var nuevo = Number(String(valor).replace(',','.')) || 0;
    if (nuevo <= 0) { if(typeof mostrarAlerta==='function') mostrarAlerta('warning','Costo debe ser > 0'); return; }
    item.costo_unitario = nuevo;
    // validar vs precio actual
    var pv = item.precio_venta_actual != null ? Number(item.precio_venta_actual) : obtenerPrecioVentaProducto(item.id_producto);
    item.precio_venta_actual = pv;
    var res = validarCostoVsPrecioVenta(nuevo, pv);
    if (res.excede) {
        if (typeof mostrarAlerta === 'function') mostrarAlerta('warning','⚠️ '+ escCompra(item.nombre) + ': costo $'+fmtCompra(nuevo)+' > PV actual $'+fmtCompra(pv)+' — ajusta el Nuevo PV');
    }
    renderizarDetalleCompra();
}
function actualizarNuevoPrecioItemCompra(index, valor) {
    var item = detallesCompra[index];
    if (!item) return;
    var v = String(valor).trim();
    if (v === '') { item.nuevo_precio_venta = null; renderizarDetalleCompra(); return; }
    var nuevo = Number(v.replace(',','.')) || 0;
    if (nuevo <= 0) { if(typeof mostrarAlerta==='function') mostrarAlerta('warning','Nuevo precio debe ser > 0'); return; }
    if (nuevo <= Number(item.costo_unitario)) {
        if (typeof mostrarAlerta === 'function') mostrarAlerta('warning','⚠️ El nuevo PV $'+fmtCompra(nuevo)+' debe ser mayor al costo $'+fmtCompra(item.costo_unitario));
        // no bloquear, pero avisar
    }
    item.nuevo_precio_venta = nuevo;
    renderizarDetalleCompra();
    if (typeof mostrarAlerta === 'function') mostrarAlerta('info','Nuevo PV $'+fmtCompra(nuevo)+' guardado para '+escCompra(item.nombre) + ' (se aplicará al guardar la compra)');
}

function renderizarDetalleCompra() {
    var cont = document.getElementById('contenedorDetalleCompra');
    if (detallesCompra.length === 0) {
        cont.innerHTML = '<div style="padding:16px;color:#94a3b8;text-align:center;border:1px dashed #e2e8f0;border-radius:10px">No hay items agregados</div>';
        setResumenCompra(0, 0, 0, 0, 0, 0);
        return;
    }

    var tsub = 0, tdesc = 0, tiva = 0, tico = 0, ttot = 0;
    // alerta resumen global si hay costos > PV
    var conflictosGlobal = detallesCompra.filter(function(d){
        var pv = d.precio_venta_actual != null ? Number(d.precio_venta_actual) : obtenerPrecioVentaProducto(d.id_producto);
        var excede = pv > 0 && Number(d.costo_unitario) > pv;
        var corregido = d.nuevo_precio_venta != null && Number(d.nuevo_precio_venta) > Number(d.costo_unitario);
        return excede && !corregido;
    });
    var htmlAlertaGlobal = '';
    if (conflictosGlobal.length > 0) {
        htmlAlertaGlobal = '<div style="background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;border-radius:10px;padding:10px 14px;margin-bottom:12px;font-size:0.82rem;display:flex;align-items:center;gap:8px"><i class="bi bi-exclamation-triangle-fill" style="font-size:1rem"></i><div><b>⚠️ Hay '+conflictosGlobal.length+' producto(s) con costo mayor al precio de venta.</b> Corrige el costo o indica un Nuevo PV en la tabla. Al guardar se pedirá confirmación.</div></div>';
    }
    var html = htmlAlertaGlobal + '<div class="table-responsive"><table class="table table-sm mb-0" style="margin:0">' +
        '<thead style="background:#f1f5f9"><tr>' +
        '<th style="font-weight:600;font-size:0.78rem;border-color:#e2e8f0">Producto</th>' +
        '<th style="font-weight:600;font-size:0.78rem;border-color:#e2e8f0;text-align:center">Cant.</th>' +
        '<th style="font-weight:600;font-size:0.78rem;border-color:#e2e8f0;text-align:right">Costo<br><small style="font-weight:400">editable</small></th>' +
        '<th style="font-weight:600;font-size:0.78rem;border-color:#e2e8f0;text-align:right">PV Actual</th>' +
        '<th style="font-weight:600;font-size:0.78rem;border-color:#e2e8f0;text-align:right">Nuevo PV<br><small style="font-weight:400">editable</small></th>' +
        '<th style="font-weight:600;font-size:0.78rem;border-color:#e2e8f0;text-align:right">Dscto</th>' +
        '<th style="font-weight:600;font-size:0.78rem;border-color:#e2e8f0;text-align:right">Total</th>' +
        '<th style="font-weight:600;font-size:0.78rem;border-color:#e2e8f0;text-align:center"></th></tr></thead><tbody>';

    detallesCompra.forEach(function(item, i) {
        var sub = item.cantidad * item.costo_unitario;
        var desc = redondearCompra(Math.min(item.descuento || 0, sub));
        var base = redondearCompra(sub - desc);
        var iva = redondearCompra(base * (Number(item.iva_pct) || 0) / 100);
        var ico = redondearCompra(base * (Number(item.ico_pct) || 0) / 100);
        var t = redondearCompra(base + iva + ico);
        tsub += sub; tdesc += desc; tiva += iva; tico += ico; ttot += t;
        var pvActual = item.precio_venta_actual != null ? Number(item.precio_venta_actual) : obtenerPrecioVentaProducto(item.id_producto);
        var nuevoPV = item.nuevo_precio_venta != null ? Number(item.nuevo_precio_venta) : null;
        var excede = pvActual > 0 && Number(item.costo_unitario) > pvActual;
        var corregido = nuevoPV != null && nuevoPV > Number(item.costo_unitario);
        var rowStyle = excede && !corregido ? 'background:#fef2f2;border-left:3px solid #ef4444' : (excede && corregido ? 'background:#f0fdf4;border-left:3px solid #10b981' : '');
        var costoStyle = excede && !corregido ? 'border-color:#ef4444;background:#fff1f2;color:#dc2626;font-weight:700' : '';
        var alertaCell = '';
        if (excede && !corregido) alertaCell = '<div style="color:#dc2626;font-size:0.68rem;margin-top:3px"><i class="bi bi-exclamation-triangle-fill me-1"></i>Costo &gt; PV $'+fmtCompra(pvActual)+'</div>';
        else if (excede && corregido) alertaCell = '<div style="color:#059669;font-size:0.68rem;margin-top:3px"><i class="bi bi-check-circle-fill me-1"></i>PV actualizado $'+fmtCompra(nuevoPV)+'</div>';
        else if (pvActual > 0) alertaCell = '<div style="color:#64748b;font-size:0.68rem;margin-top:3px">PV $'+fmtCompra(pvActual)+' · margen $'+fmtCompra(pvActual - Number(item.costo_unitario))+'</div>';
        html += '<tr style="'+rowStyle+'">' +
            '<td style="font-weight:600;border-color:#f1f5f9;font-size:0.82rem">' + escCompra(item.nombre) + alertaCell + '</td>' +
            '<td style="text-align:center;border-color:#f1f5f9;font-size:0.82rem">' + Number(item.cantidad) + '</td>' +
            '<td style="text-align:right;border-color:#f1f5f9;font-size:0.82rem"><input type="number" value="'+Number(item.costo_unitario)+'" min="0" step="100" style="width:92px;border-radius:8px;border:1px solid #e2e8f0;padding:4px 6px;text-align:right;font-size:0.82rem;'+costoStyle+'" data-role="costo-item" data-index="'+i+'" data-input="compras-costo-item"></td>' +
            '<td style="text-align:right;border-color:#f1f5f9;font-size:0.82rem;color:#475569">$' + fmtCompra(pvActual) + '</td>' +
            '<td style="text-align:right;border-color:#f1f5f9;font-size:0.82rem"><input type="number" value="'+(nuevoPV!=null?nuevoPV:'')+'" min="0" step="100" placeholder="—" style="width:92px;border-radius:8px;border:1px solid #e2e8f0;padding:4px 6px;text-align:right;font-size:0.82rem;'+(nuevoPV!=null?'border-color:#10b981;background:#f0fdf4':'')+'" data-role="nuevo-pv-item" data-index="'+i+'" data-input="compras-nuevo-pv-item"></td>' +
            '<td style="text-align:right;border-color:#f1f5f9;font-size:0.82rem">' + (desc > 0 ? '-$' + fmtCompra(desc) : '$0') + '</td>' +
            '<td style="text-align:right;border-color:#f1f5f9;font-weight:700;color:#10b981;font-size:0.82rem">$' + fmtCompra(t) + '</td>' +
            '<td style="text-align:center;border-color:#f1f5f9"><button class="btn btn-sm btn-outline-danger" data-action="compras-quitar-item" data-index="' + Number(i) + '" style="font-size:0.7rem;padding:2px 6px"><i class="bi bi-trash"></i></button></td></tr>';
    });

    html += '</tbody></table></div>';
    cont.innerHTML = html;
    setResumenCompra(redondearCompra(tsub), redondearCompra(tdesc), redondearCompra(tsub - tdesc), redondearCompra(tiva), redondearCompra(tico), redondearCompra(ttot));
}

function confirmarCompra() {
    if (detallesCompra.length === 0) {
        mostrarAlerta('warning', 'Agregue al menos un producto a la compra.');
        return;
    }
    var idProveedor = document.getElementById('selectProveedorCompra').value;
    if (!idProveedor) {
        mostrarAlerta('warning', 'Seleccione un proveedor.');
        return;
    }

    var metodoPago = document.getElementById('selectMetodoPagoCompra').value;
    var fechaVencimiento = document.getElementById('inputVencimientoCompra').value || null;
    var numeroFactura = document.getElementById('inputNumFactura').value.trim();
    var observaciones = document.getElementById('inputObsCompra').value.trim();

    aplicarDescuentoCompra();
    // REQ 3: Validar conflictos costo > PV antes de guardar
    var conflictos = detallesCompra.filter(function(d){
        var pv = d.precio_venta_actual != null ? Number(d.precio_venta_actual) : obtenerPrecioVentaProducto(d.id_producto);
        var excede = pv > 0 && Number(d.costo_unitario) > pv;
        var corregido = d.nuevo_precio_venta != null && Number(d.nuevo_precio_venta) > Number(d.costo_unitario);
        return excede && !corregido;
    });
    if (conflictos.length > 0) {
        var detalleConf = conflictos.map(function(c){
            var pv = c.precio_venta_actual != null ? Number(c.precio_venta_actual) : obtenerPrecioVentaProducto(c.id_producto);
            return '• ' + c.nombre + ': costo $' + fmtCompra(c.costo_unitario) + ' > PV $' + fmtCompra(pv);
        }).join('\n');
        var mensajeConfirm = '⚠️ Hay productos cuyo costo de compra supera el precio de venta actual:\n\n' + detalleConf + '\n\n¿Deseas guardar la compra de todas formas?\n\n[OK] Guardar igualmente  —  [Cancelar] Corregir valores';
        var confirmado = false;
        try { confirmado = window.confirm(mensajeConfirm); } catch(e) { confirmado = confirm(mensajeConfirm); }
        if (!confirmado) {
            // resaltar filas conflictivas
            renderizarDetalleCompra();
            try { mostrarAlerta('warning','Corrige los costos o indica un Nuevo Precio de Venta mayor al costo antes de guardar.'); } catch(e) {}
            // hacer scroll al detalle
            var contDet = document.getElementById('contenedorDetalleCompra');
            if (contDet) contDet.scrollIntoView({behavior:'smooth', block:'center'});
            return;
        }
    }
    var detallesEnvio = detallesCompra.map(function(d) {
        return {
            id_producto: d.id_producto,
            cantidad: d.cantidad,
            costo_unitario: d.costo_unitario,
            precio_venta_actual: d.precio_venta_actual != null ? Number(d.precio_venta_actual) : obtenerPrecioVentaProducto(d.id_producto),
            nuevo_precio_venta: d.nuevo_precio_venta != null ? Number(d.nuevo_precio_venta) : null,
            descuento: redondearCompra(Math.min(d.descuento || 0, d.cantidad * d.costo_unitario)),
            iva_pct: Number(d.iva_pct) || 0,
            ico_pct: Number(d.ico_pct) || 0
        };
    });

    var payload = {
        id_proveedor: Number(idProveedor),
        id_usuario: usuario ? usuario.id_usuario : 1,
        numero_factura: numeroFactura,
        observaciones: observaciones,
        metodo_pago: metodoPago,
        forma_pago: esCreditoCompra(metodoPago) ? 'Credito' : 'Contado',
        fecha_factura: document.getElementById('inputFechaFacturaCompra').value || null,
        fecha_vencimiento: fechaVencimiento,
        soporte: soporteCompraBase64,
        iva_pct: Number(document.getElementById('inputIvaGlobalCompra').value) || 0,
        ico_pct: Number(document.getElementById('inputIcoGlobalCompra').value) || 0,
        detalles: detallesEnvio,
        confirmar_costo_mayor_pv: conflictos.length > 0 // backend: flag confirmacion usuario
    };

    var btn = document.getElementById('btnRegistrarCompra');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Registrando...';
    }

    fetch(API_BASE + '/api/compras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-check-lg me-1"></i> Registrar Compra';
        }
        if (data.success) {
            if (modalCompraBS) modalCompraBS.hide();
            detallesCompra.forEach(function(d){
                var p = listaProductosCompra.find(function(x){ return Number(x.id_producto)===Number(d.id_producto); });
                if(p) {
                    p.stock = (Number(p.stock)||0) + Number(d.cantidad);
                    // actualizar PV local si backend lo cambió
                    if (d.nuevo_precio_venta != null && Number(d.nuevo_precio_venta) > 0) {
                        p.precio = Number(d.nuevo_precio_venta);
                        p.precio_venta = Number(d.nuevo_precio_venta);
                    }
                }
                if(typeof inventarioProductos !== 'undefined' && inventarioProductos){
                    var ip = inventarioProductos.find(function(x){ return Number(x.id_producto)===Number(d.id_producto); });
                    if(ip) {
                        ip.stock = (Number(ip.stock)||0) + Number(d.cantidad);
                        if (d.nuevo_precio_venta != null && Number(d.nuevo_precio_venta) > 0) { ip.precio = Number(d.nuevo_precio_venta); ip.precio_venta = Number(d.nuevo_precio_venta); }
                    }
                }
            });
            var msj = 'Compra #' + data.idCompra + ' registrada. Stock y costo medio actualizados.';
            if (data.caja_egreso) msj += ' Egreso registrado en Caja.';
            else if (data.forma_pago === 'Credito') msj += ' Se gener\u00f3 una cuenta por pagar de $' + fmtCompra(data.saldo_pendiente) + '.';
            if (data.precios_actualizados && data.precios_actualizados.length) msj += ' Precios de venta actualizados: ' + data.precios_actualizados.map(function(x){return x.nombre + ' → $'+fmtCompra(x.nuevo_precio)}).join(', ') + '.';
            if (data.advertencias && data.advertencias.length) msj += ' Advertencias: ' + data.advertencias.join(' | ');
            if (typeof mostrarAlerta === 'function') mostrarAlerta('success', msj);
            else mostrarAlertaCompra('success', msj);
            // toast adicional si hubo PV actualizados
            if (data.precios_actualizados && data.precios_actualizados.length && typeof mostrarAlerta==='function') {
                mostrarAlerta('info','🔄 Precio(s) de venta actualizado(s) desde la compra: ' + data.precios_actualizados.map(function(x){return x.nombre+' $'+fmtCompra(x.nuevo_precio)}).join(', '));
            }
            cargarHistorialCompras();
            if (typeof cargarProductosInventario === 'function') try{ cargarProductosInventario(); }catch(e){}
        } else {
            if (typeof mostrarAlerta === 'function') mostrarAlerta('danger', data.mensaje || 'Error al registrar compra');
            else mostrarAlertaCompra('danger', data.mensaje || 'Error');
        }
    })
    .catch(function() {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-check-lg me-1"></i> Registrar Compra';
        }
        mostrarAlerta('danger', 'No se pudo conectar con el servidor');
    });
}

var modalDetalleCompraBS = null;

function verDetalleCompra(idCompra) {
    asegurarModalesCompra();
    fetch(API_BASE + '/api/compras/' + idCompra + '/detalle')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (!data.success) {
                if (typeof mostrarAlerta === 'function') mostrarAlerta('danger', data.mensaje || 'Error al cargar detalle');
                else alert(data.mensaje || 'Error');
                return;
            }
            var cont = document.getElementById('contenidoDetalleCompra');
            var html = '<div style="font-size:0.8rem;color:#475569;margin-bottom:12px"><b>Detalle de Compra #' + Number(idCompra) + '</b></div>' +
                '<div class="table-responsive"><table class="table table-sm mb-0" style="margin:0">' +
                '<thead style="background:#f1f5f9"><tr>' +
                '<th style="font-weight:600;font-size:0.8rem;border-color:#e2e8f0">Producto</th>' +
                '<th style="font-weight:600;font-size:0.8rem;border-color:#e2e8f0;text-align:center">Cant.</th>' +
                '<th style="font-weight:600;font-size:0.8rem;border-color:#e2e8f0;text-align:right">Costo</th>' +
                '<th style="font-weight:600;font-size:0.8rem;border-color:#e2e8f0;text-align:right">Dscto</th>' +
                '<th style="font-weight:600;font-size:0.8rem;border-color:#e2e8f0;text-align:right">IVA</th>' +
                '<th style="font-weight:600;font-size:0.8rem;border-color:#e2e8f0;text-align:right">ICO</th>' +
                '<th style="font-weight:600;font-size:0.8rem;border-color:#e2e8f0;text-align:right">Total</th></tr></thead><tbody>';
            var total = 0;
            data.detalles.forEach(function(d) {
                var linea = Number(d.total_linea) || 0;
                total += linea;
                html += '<tr>' +
                    '<td style="font-size:0.82rem;border-color:#f1f5f9;font-weight:600">' + escCompra(d.producto_nombre) + '</td>' +
                    '<td style="text-align:center;font-size:0.82rem;border-color:#f1f5f9">' + Number(d.cantidad) + '</td>' +
                    '<td style="text-align:right;font-size:0.82rem;border-color:#f1f5f9">$' + fmtCompra(d.costo_unitario) + '</td>' +
                    '<td style="text-align:right;font-size:0.82rem;border-color:#f1f5f9">' + (Number(d.descuento) > 0 ? '-$' + fmtCompra(d.descuento) : '$0') + '</td>' +
                    '<td style="text-align:right;font-size:0.82rem;border-color:#f1f5f9">$' + fmtCompra(d.iva) + '</td>' +
                    '<td style="text-align:right;font-size:0.82rem;border-color:#f1f5f9">$' + fmtCompra(d.ico) + '</td>' +
                    '<td style="text-align:right;font-size:0.82rem;border-color:#f1f5f9;font-weight:700;color:#10b981">$' + fmtCompra(linea) + '</td></tr>';
            });
            html += '</tbody></table></div>' +
                '<div class="d-flex justify-content-between" style="margin-top:12px;padding:12px 16px;background:#0f172a;color:#f8fafc;border-radius:10px"><span style="font-weight:700">Total Compra</span><span style="font-weight:800;font-size:1.1rem">$' + fmtCompra(redondearCompra(total)) + '</span></div>';
            if (cont) cont.innerHTML = html;
            var elModalDet = document.getElementById('modalDetalleCompra');
            if (!elModalDet) return;
            try {
                modalDetalleCompraBS = bootstrap.Modal.getOrCreateInstance(elModalDet);
                modalDetalleCompraBS.show();
            } catch(e) {
                modalDetalleCompraBS = new bootstrap.Modal(elModalDet);
                modalDetalleCompraBS.show();
            }
        })
        .catch(function() {
            if (typeof mostrarAlerta === 'function') mostrarAlerta('danger', 'No se pudo cargar el detalle');
        });
}
if (typeof delegateAction !== 'undefined') delegateAction(document, { 'compras-actualizar': function() { iniciarCompras(); }, 'compras-nueva': function() { modalNuevaCompra(); }, 'compras-set-impuesto': function(el) { setImpuestoGlobalCompra(Number(el.getAttribute('data-iva')), Number(el.getAttribute('data-ico'))); }, 'compras-agregar-item': function() { agregarItemCompra(); }, 'compras-confirmar': function() { confirmarCompra(); }, 'compras-ver-detalle': function(el) { verDetalleCompra(Number(el.getAttribute('data-id'))); }, 'compras-quitar-item': function(el) { quitarItemCompra(Number(el.getAttribute('data-index'))); }, 'compras-sugerir-precio': function() { sugerirNuevoPrecioVenta(); } });
if (typeof document !== 'undefined') {
document.addEventListener('change', function(e) {
var el = e.target && e.target.closest ? e.target.closest('[data-change]') : null;
if (!el || !document.contains(el)) return;
var a = el.getAttribute('data-change');
if (a === 'compras-metodo-pago') cambiarMetodoPagoCompra();
else if (a === 'compras-soporte') procesarSoporteCompra(el);
else if (a === 'compras-tipo-descuento') cambiarTipoDescuentoCompra();
else if (a === 'compras-autocompletar') { autocompletarCostoCompra(); validarCostoInputTiempoReal(false); }
});
document.addEventListener('input', function(e) {
var target = e.target;
if (!target) return;
// inputs inline en tabla detalle: costo / nuevo PV
if (target.getAttribute && target.getAttribute('data-input') === 'compras-costo-item') {
    var idxC = Number(target.getAttribute('data-index'));
    var valC = target.value;
    // debounce ligero: actualizar al escribir
    if (target._tCompra) clearTimeout(target._tCompra);
    target._tCompra = setTimeout(function(){ actualizarCostoItemCompra(idxC, valC); }, 600);
    return;
}
if (target.getAttribute && target.getAttribute('data-input') === 'compras-nuevo-pv-item') {
    var idxP = Number(target.getAttribute('data-index'));
    var valP = target.value;
    if (target._tCompraPV) clearTimeout(target._tCompraPV);
    target._tCompraPV = setTimeout(function(){ actualizarNuevoPrecioItemCompra(idxP, valP); }, 600);
    return;
}
var el = target.closest ? target.closest('[data-input]') : null;
if (!el || !document.contains(el)) return;
var a = el.getAttribute('data-input');
if (a === 'compras-impuestos') aplicarImpuestosGlobalCompra();
else if (a === 'compras-descuento') aplicarDescuentoCompra();
else if (a === 'compras-filtrar') filtrarProductosCompra();
else if (a === 'compras-validar-costo') validarCostoInputTiempoReal(true);
});
// Evento directo sobre inputCostoCompra para tiempo real (keyup/input)
document.addEventListener('DOMContentLoaded', function(){
    var cCosto = document.getElementById('inputCostoCompra');
    if (cCosto) {
        cCosto.addEventListener('input', function(){ validarCostoInputTiempoReal(true); });
        cCosto.addEventListener('change', function(){ validarCostoInputTiempoReal(true); });
    }
});
}
