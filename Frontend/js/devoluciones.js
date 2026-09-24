// =========================================================
// CONTROLADOR: DEVOLUCIONES A PROVEEDORES
// Registro de devoluciones de mercancia, descuento de stock
// e historial de inventario (kardex)
// =========================================================

var devolucionesLista = [];
var devolucionesProveedores = [];
var devolucionesProductos = [];
var devolucionesPagina = 1;
var devolucionesPorPagina = 10;
var devFiltroProveedor = '';
var devFiltroDesde = '';
var devFiltroHasta = '';
var devFiltroEstado = '';
var modalDevolucionBS = null;
var modalDevolucionDetalleBS = null;
var devolucionSemilla = null;

var DEV_MOTIVOS = ['Dañado', 'Vencido', 'Error de pedido', 'Otro'];
var DEV_ESTADOS = ['Pendiente', 'Aprobada', 'Completada', 'Rechazada'];

function devEsc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function devMoney(n) {
    return '$' + Math.round(Number(n) || 0).toLocaleString('es-CO');
}

function devFecha(s) {
    if (!s) return '-';
    try { return new Date(s).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch (e) { return String(s).slice(0, 10); }
}

function devHora(s) {
    if (!s) return '';
    try { return new Date(s).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return ''; }
}

function badgeEstadoDevolucion(est) {
    var map = {
        'Pendiente': ['#fef3c7', '#92400e'],
        'Aprobada': ['#eff6ff', '#2563eb'],
        'Completada': ['#dcfce7', '#15803d'],
        'Rechazada': ['#f1f5f9', '#64748b']
    };
    var c = map[est] || ['#f1f5f9', '#64748b'];
    return '<span style="background:' + c[0] + ';color:' + c[1] + ';padding:3px 10px;border-radius:8px;font-size:0.75rem;font-weight:700">' + devEsc(est) + '</span>';
}

function badgeMotivoDevolucion(mot) {
    var map = {
        'Dañado': ['#fef2f2', '#b91c1c'],
        'Vencido': ['#fffbeb', '#b45309'],
        'Error de pedido': ['#eff6ff', '#1d4ed8'],
        'Otro': ['#f1f5f9', '#475569']
    };
    var c = map[mot] || ['#f1f5f9', '#475569'];
    return '<span style="background:' + c[0] + ';color:' + c[1] + ';padding:2px 9px;border-radius:8px;font-size:0.72rem;font-weight:700">' + devEsc(mot) + '</span>';
}

// ============ VISTA PRINCIPAL ============
function iniciarDevoluciones() {
    if (typeof verificarAcceso === 'function' && !verificarAcceso('gestionar_proveedores')) {
        if (typeof verificarAccesoRB === 'function' && !verificarAccesoRB('gestionar_proveedores')) return;
        return;
    }
    if (typeof verificarAccesoRB === 'function' && !verificarAccesoRB('gestionar_proveedores')) return;
    activarNav('navDevoluciones');
    var contenedor = document.getElementById('main-content');
    contenedor.innerHTML =
        '<div class="page-header">' +
        '<h2><i class="bi bi-arrow-return-left"></i>Devoluciones a Proveedores</h2>' +
        '<div class="page-header-right">' +
        '<button class="btn-refresh" onclick="iniciarDevoluciones()"><i class="bi bi-arrow-clockwise"></i> Actualizar</button>' +
        '<button class="btn-custom-action btn-pedir" style="padding:8px 18px;width:auto" onclick="abrirModalDevolucion()"><i class="bi bi-plus-lg me-1"></i> Nueva Devolución</button>' +
        '</div></div>' +
        '<div id="contenedorAlertas"></div>' +
        '<div class="row g-4 mb-4" id="filaKPIsDevoluciones"></div>' +
        '<div class="card" style="border:1px solid #e2e8f0;border-radius:14px;overflow:hidden">' +
        '<div style="padding:14px 20px;background:#0f172a;color:#f8fafc;font-weight:700;font-size:0.9rem;display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:space-between">' +
        '<div><i class="bi bi-list-ul"></i> Historial de Devoluciones</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;background:transparent;padding:0">' +
        '<select id="devFiltroProveedorSel" class="form-select form-select-sm" style="width:auto;border-radius:8px;border:1px solid #334155;background:#1e293b;color:#f8fafc;min-width:170px"><option value="">Todos los proveedores</option></select>' +
        '<input type="date" id="devFiltroDesdeInp" class="form-control form-control-sm" style="width:auto;border-radius:8px;border:1px solid #334155;background:#1e293b;color:#f8fafc" title="Desde">' +
        '<input type="date" id="devFiltroHastaInp" class="form-control form-control-sm" style="width:auto;border-radius:8px;border:1px solid #334155;background:#1e293b;color:#f8fafc" title="Hasta">' +
        '<select id="devFiltroEstadoSel" class="form-select form-select-sm" style="width:auto;border-radius:8px;border:1px solid #334155;background:#1e293b;color:#f8fafc"><option value="">Todos los estados</option>' +
        DEV_ESTADOS.map(function(e) { return '<option value="' + e + '">' + e + '</option>'; }).join('') + '</select>' +
        '<button class="btn btn-sm btn-primary" style="border-radius:8px;font-weight:700" onclick="aplicarFiltrosDevoluciones()"><i class="bi bi-funnel me-1"></i>Filtrar</button>' +
        '<button class="btn btn-sm" style="border-radius:8px;font-weight:700;background:#334155;color:#f8fafc;border:1px solid #475569" onclick="limpiarFiltrosDevoluciones()">Limpiar</button>' +
        '</div>' +
        '</div>' +
        '<div class="card-body p-0" style="background:#fff"><div id="contenedorTablaDevoluciones" class="text-center py-4"><div class="spinner-border text-primary"></div></div>' +
        '<div id="devPaginacion" style="padding:12px 16px;border-top:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px"></div></div></div>';
    limpiarBackdrops();
    cargarProveedoresDevoluciones();
    cargarDevoluciones();
}

function cargarProveedoresDevoluciones() {
    fetch(API_BASE + '/api/proveedores')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success) {
                devolucionesProveedores = data.proveedores || [];
                var sel = document.getElementById('devFiltroProveedorSel');
                if (!sel) return;
                var html = '<option value="">Todos los proveedores</option>';
                devolucionesProveedores.forEach(function(p) {
                    html += '<option value="' + p.id_proveedor + '"' + (String(p.id_proveedor) === devFiltroProveedor ? ' selected' : '') + '>' + devEsc(p.nombre) + '</option>';
                });
                sel.innerHTML = html;
            }
        }).catch(function() {});
}

function aplicarFiltrosDevoluciones() {
    devFiltroProveedor = document.getElementById('devFiltroProveedorSel') ? document.getElementById('devFiltroProveedorSel').value : '';
    devFiltroDesde = document.getElementById('devFiltroDesdeInp') ? document.getElementById('devFiltroDesdeInp').value : '';
    devFiltroHasta = document.getElementById('devFiltroHastaInp') ? document.getElementById('devFiltroHastaInp').value : '';
    devFiltroEstado = document.getElementById('devFiltroEstadoSel') ? document.getElementById('devFiltroEstadoSel').value : '';
    devolucionesPagina = 1;
    cargarDevoluciones();
}

function limpiarFiltrosDevoluciones() {
    devFiltroProveedor = ''; devFiltroDesde = ''; devFiltroHasta = ''; devFiltroEstado = '';
    ['devFiltroProveedorSel', 'devFiltroDesdeInp', 'devFiltroHastaInp', 'devFiltroEstadoSel'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.value = '';
    });
    devolucionesPagina = 1;
    cargarDevoluciones();
}

function cargarDevoluciones() {
    var cont = document.getElementById('contenedorTablaDevoluciones');
    if (cont) cont.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>';
    var qs = [];
    if (devFiltroProveedor) qs.push('id_proveedor=' + devFiltroProveedor);
    if (devFiltroDesde) qs.push('desde=' + devFiltroDesde);
    if (devFiltroHasta) qs.push('hasta=' + devFiltroHasta);
    if (devFiltroEstado) qs.push('estado=' + encodeURIComponent(devFiltroEstado));
    var url = API_BASE + '/api/devoluciones' + (qs.length ? '?' + qs.join('&') : '');

    fetch(url)
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success) {
                devolucionesLista = data.devoluciones || [];
                renderizarKPIsDevoluciones(devolucionesLista, data.total_devuelto);
                renderizarTablaDevoluciones(devolucionesLista);
            } else if (cont) {
                cont.innerHTML = '<div style="padding:24px;color:#dc2626"><i class="bi bi-exclamation-triangle me-1"></i> ' + devEsc(data.mensaje || 'Error al cargar devoluciones') + '</div>';
            }
        })
        .catch(function() {
            if (cont) cont.innerHTML = '<div style="padding:24px;color:#dc2626"><i class="bi bi-wifi-off me-1"></i> No se pudo conectar con el servidor</div>';
        });
}

function renderizarKPIsDevoluciones(devoluciones, totalFiltrado) {
    var fila = document.getElementById('filaKPIsDevoluciones');
    if (!fila) return;
    var conteo = { Pendiente: 0, Aprobada: 0, Completada: 0, Rechazada: 0 };
    var totalCant = 0;
    devoluciones.forEach(function(d) {
        if (conteo[d.estado] !== undefined) conteo[d.estado]++;
        totalCant += Number(d.items_cantidad || 0);
    });
    var pendientes = conteo.Pendiente;
    var valorPendiente = devoluciones.filter(function(d) { return d.estado === 'Pendiente' || d.estado === 'Aprobada'; })
        .reduce(function(a, d) { return a + Number(d.total_devuelto || 0); }, 0);

    fila.innerHTML =
        '<div class="col-md-3"><div class="kpi-card" style="border-left:4px solid #ef4444"><div class="kpi-top"><div class="kpi-label">Total Devuelto</div><div class="kpi-icon" style="background:#fef2f2;color:#ef4444"><i class="bi bi-arrow-return-left"></i></div></div><div class="kpi-value" style="color:#dc2626">' + devMoney(totalFiltrado) + '</div><div class="kpi-sub">' + devoluciones.length + ' devolución(es) filtradas</div></div></div>' +
        '<div class="col-md-3"><div class="kpi-card" style="border-left:4px solid #f59e0b"><div class="kpi-top"><div class="kpi-label">Pendientes</div><div class="kpi-icon" style="background:#fffbeb;color:#f59e0b"><i class="bi bi-hourglass-split"></i></div></div><div class="kpi-value" style="color:#d97706">' + pendientes + '</div><div class="kpi-sub">por aprobar / completar</div></div></div>' +
        '<div class="col-md-3"><div class="kpi-card" style="border-left:4px solid #8b5cf6"><div class="kpi-top"><div class="kpi-label">Valor en Aprobación</div><div class="kpi-icon" style="background:#f5f3ff;color:#8b5cf6"><i class="bi bi-cash-coin"></i></div></div><div class="kpi-value">' + devMoney(valorPendiente) + '</div><div class="kpi-sub">pendientes + aprobadas</div></div></div>' +
        '<div class="col-md-3"><div class="kpi-card" style="border-left:4px solid #3b82f6"><div class="kpi-top"><div class="kpi-label">Unidades Devueltas</div><div class="kpi-icon" style="background:#eff6ff;color:#3b82f6"><i class="bi bi-box-seam"></i></div></div><div class="kpi-value">' + totalCant + '</div><div class="kpi-sub">cantidad filtrada</div></div></div>';
}

function renderizarTablaDevoluciones(devoluciones) {
    var cont = document.getElementById('contenedorTablaDevoluciones');
    var pag = document.getElementById('devPaginacion');
    if (!cont) return;

    if (devoluciones.length === 0) {
        cont.innerHTML = '<div style="padding:24px;color:#94a3b8;text-align:center"><i class="bi bi-arrow-return-left" style="font-size:2rem;display:block;margin-bottom:8px"></i>No hay devoluciones registradas con los filtros actuales.</div>';
        if (pag) pag.innerHTML = '';
        return;
    }

    var totalPag = Math.ceil(devoluciones.length / devolucionesPorPagina);
    if (devolucionesPagina > totalPag) devolucionesPagina = totalPag;
    if (devolucionesPagina < 1) devolucionesPagina = 1;
    var inicio = (devolucionesPagina - 1) * devolucionesPorPagina;
    var pagina = devoluciones.slice(inicio, inicio + devolucionesPorPagina);

    var html = '<div class="table-responsive"><table class="table table-hover mb-0 align-middle" style="margin:0">' +
        '<thead style="background:#f8fafc"><tr>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem">N. Devolución</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem">Fecha</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem">Proveedor</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem;text-align:center">Ítems</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem;text-align:center">Cant.</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem;text-align:right">Total Devuelto</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem">Estado</th>' +
        '<th class="text-center" style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem">Acciones</th>' +
        '</tr></thead><tbody>';

    pagina.forEach(function(d) {
        var motivoCorto = d.motivo_general ? '<div style="font-size:0.72rem;color:#94a3b8;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + devEsc(d.motivo_general) + '</div>' : '';
        html += '<tr style="border-color:#f1f5f9">' +
            '<td style="border-color:#f1f5f9;font-weight:700;color:#0f172a">' + devEsc(d.numero_devolucion) + '</td>' +
            '<td style="border-color:#f1f5f9"><div style="color:#334155;font-weight:600;font-size:0.83rem">' + devFecha(d.fecha) + '</div><div style="font-size:0.72rem;color:#94a3b8">' + devHora(d.fecha) + '</div></td>' +
            '<td style="border-color:#f1f5f9"><div style="font-weight:600;color:#0f172a">' + devEsc(d.proveedor_nombre || '-') + '</div>' + motivoCorto + '</td>' +
            '<td style="border-color:#f1f5f9;text-align:center">' + d.items_count + '</td>' +
            '<td style="border-color:#f1f5f9;text-align:center">' + d.items_cantidad + '</td>' +
            '<td style="border-color:#f1f5f9;text-align:right;font-weight:700;color:#dc2626">' + devMoney(d.total_devuelto) + '</td>' +
            '<td style="border-color:#f1f5f9">' + badgeEstadoDevolucion(d.estado) + '</td>' +
            '<td class="text-center" style="border-color:#f1f5f9"><div style="display:inline-flex;gap:4px">' +
            '<button class="btn-custom-action" style="background:#eff6ff;color:#2563eb;padding:5px 10px;font-size:0.75rem;border:1px solid #bfdbfe" title="Ver detalle" onclick="verDetalleDevolucion(' + d.id_devolucion + ')"><i class="bi bi-eye"></i></button>' +
            '<button class="btn-custom-action" style="background:#0f172a;color:#f8fafc;padding:5px 10px;font-size:0.75rem;border:1px solid #0f172a" title="Cambiar estado" onclick="abrirModalCambiarEstadoDevolucion(' + d.id_devolucion + ')"><i class="bi bi-arrow-repeat"></i></button>' +
            '</div></td></tr>';
    });
    html += '</tbody></table></div>';
    cont.innerHTML = html;

    if (pag) {
        if (totalPag > 1) {
            pag.innerHTML = '<span style="color:#64748b;font-size:0.82rem">' + devoluciones.length + ' devolución(es) · Página ' + devolucionesPagina + ' de ' + totalPag + '</span>' +
                '<div style="display:flex;gap:6px">' +
                '<button class="btn btn-sm btn-light" style="border:1px solid #e2e8f0;border-radius:8px" ' + (devolucionesPagina === 1 ? 'disabled' : '') + ' onclick="cambiarPagDevoluciones(-1)"><i class="bi bi-chevron-left"></i> Anterior</button>' +
                '<button class="btn btn-sm btn-light" style="border:1px solid #e2e8f0;border-radius:8px" ' + (devolucionesPagina === totalPag ? 'disabled' : '') + ' onclick="cambiarPagDevoluciones(1)">Siguiente <i class="bi bi-chevron-right"></i></button></div>';
        } else {
            pag.innerHTML = '<span style="color:#64748b;font-size:0.82rem">' + devoluciones.length + ' devolución(es)</span><span></span>';
        }
    }
}

function cambiarPagDevoluciones(dir) {
    devolucionesPagina += dir;
    renderizarTablaDevoluciones(devolucionesLista);
}

// ============ MODAL CREAR / EDITAR DEVOLUCION (compartido) ============
function insertarModalesDevolucion() {
    if (document.getElementById('modalDevolucionCrear')) return;
    var cont = document.createElement('div');
    cont.innerHTML =
        '<div class="modal fade" id="modalDevolucionCrear" tabindex="-1" aria-hidden="true">' +
        '<div class="modal-dialog modal-xl modal-dialog-scrollable">' +
        '<div class="modal-content">' +
        '<div class="modal-header"><h5 class="modal-title"><i class="bi bi-arrow-return-left me-2"></i>Nueva Devolución a Proveedor</h5><button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div>' +
        '<div class="modal-body" style="background:#f8fafc">' +
        '<div id="contenedorAlertasDevolucionCreate"></div>' +
        '<div class="row g-3 mb-3">' +
        '<div class="col-md-4"><label class="form-label" style="font-weight:600;color:#334155;font-size:0.85rem">Proveedor *</label><select id="devSelProveedor" class="form-select" style="border-radius:10px;border:1px solid #e2e8f0" onchange="refrescarProductosModalDevolucion()"></select></div>' +
        '<div class="col-md-3"><label class="form-label" style="font-weight:600;color:#334155;font-size:0.85rem">Fecha</label><input type="date" id="devInputFecha" class="form-control" style="border-radius:10px;border:1px solid #e2e8f0"></div>' +
        '<div class="col-md-5"><label class="form-label" style="font-weight:600;color:#334155;font-size:0.85rem">Motivo general</label><input type="text" id="devInputMotivoGeneral" class="form-control" style="border-radius:10px;border:1px solid #e2e8f0" placeholder="Ej: Mercancía dañada / vencida / pedido incorrecto"></div>' +
        '</div>' +
        '<div class="row g-3 mb-3">' +
        '<div class="col-md-4"><label class="form-label" style="font-weight:600;color:#334155;font-size:0.85rem">Descuento de stock</label><select id="devSelectEstado" class="form-select" style="border-radius:10px;border:1px solid #e2e8f0"><option value="Pendiente">Pendiente — aún no descuenta stock</option><option value="Aprobada">Aprobada — descontar stock al confirmar</option><option value="Completada">Completada — descontar stock al confirmar</option></select><small style="color:#64748b;font-size:0.72rem"><i class="bi bi-info-circle me-1"></i>Aprobada/Completada descuentan el inventario y registran el kardex.</small></div>' +
        '<div class="col-md-8"><label class="form-label" style="font-weight:600;color:#334155;font-size:0.85rem">Notas / Referencia</label><input type="text" id="devInputNotas" class="form-control" style="border-radius:10px;border:1px solid #e2e8f0" placeholder="Nota de crédito, n° de remisión, observaciones..."></div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;flex-wrap:wrap">' +
        '<div style="font-size:0.82rem;font-weight:700;color:#334155"><i class="bi bi-box-seam me-1"></i> Productos devueltos</div>' +
        '<button type="button" class="btn-custom-action" style="background:#eff6ff;color:#2563eb;padding:5px 12px;font-size:0.76rem;border:1px solid #bfdbfe;width:auto" onclick="agregarLineaDevolucion()"><i class="bi bi-plus-lg me-1"></i>Agregar producto</button>' +
        '</div>' +
        '<div id="devLineasProductos"></div>' +
        '<div id="devTotalDevolucion" style="margin-top:14px;padding:14px 16px;background:#0f172a;color:#f8fafc;border-radius:12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px"><span style="font-weight:700">TOTAL DEVUELTO</span><span id="devTotalMonto" style="font-weight:800;font-size:1.4rem;color:#f87171">$0</span></div>' +
        '</div>' +
        '<div class="modal-footer" style="border-top:1px solid #e2e8f0;background:#fff">' +
        '<button type="button" class="btn btn-light" style="border-radius:8px;font-weight:600" data-bs-dismiss="modal">Cancelar</button>' +
        '<button type="button" class="btn-custom-action btn-pedir" style="width:auto;padding:10px 24px" onclick="confirmarCrearDevolucion()"><i class="bi bi-arrow-return-left me-1"></i> Registrar Devolución</button>' +
        '</div>' +
        '</div></div></div>' +

        '<div class="modal fade" id="modalDevolucionDetalle" tabindex="-1" aria-hidden="true">' +
        '<div class="modal-dialog modal-lg modal-dialog-scrollable">' +
        '<div class="modal-content">' +
        '<div class="modal-header"><h5 class="modal-title" id="tituloModalDevolucionDetalle"><i class="bi bi-arrow-return-left me-2"></i>Detalle de Devolución</h5><button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div>' +
        '<div class="modal-body" style="background:#f8fafc"><div id="contenidoDevolucionDetalle" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div></div></div>' +
        '<div class="modal-footer" style="border-top:1px solid #e2e8f0;background:#fff">' +
        '<button type="button" class="btn btn-light" style="border-radius:8px;font-weight:600" data-bs-dismiss="modal">Cerrar</button></div>' +
        '</div></div></div>' +

        '<div class="modal fade" id="modalDevolucionEstado" tabindex="-1" aria-hidden="true">' +
        '<div class="modal-dialog modal-dialog-centered">' +
        '<div class="modal-content">' +
        '<div class="modal-header"><h5 class="modal-title"><i class="bi bi-arrow-repeat me-2"></i>Cambiar Estado de Devolución</h5><button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div>' +
        '<div class="modal-body" style="background:#f8fafc">' +
        '<div style="padding:14px;background:#f1f5f9;border-radius:10px;margin-bottom:16px">' +
        '<div style="font-size:0.82rem;color:#64748b">Devolución <strong id="devEstadoNumero" style="color:#0f172a">-</strong><br><span id="devEstadoInfo" style="color:#64748b"></span></div>' +
        '</div>' +
        '<label class="form-label" style="font-weight:600;color:#334155;font-size:0.85rem">Nuevo estado</label>' +
        '<select id="devSelectNuevoEstado" class="form-select" style="border-radius:10px;border:1px solid #e2e8f0"><option value="Aprobada">Aprobada — descontar stock</option><option value="Completada">Completada — descontar stock</option><option value="Rechazada">Rechazada</option></select>' +
        '<small style="color:#64748b;font-size:0.72rem;display:block;margin-top:6px"><i class="bi bi-info-circle me-1"></i>Al pasar a Aprobada/Completada se descuenta el stock del inventario y se registra el movimiento en el historial.</small>' +
        '<div id="contenedorAlertasDevolucionEstado"></div>' +
        '</div>' +
        '<div class="modal-footer" style="border-top:1px solid #e2e8f0;background:#fff">' +
        '<button type="button" class="btn btn-light" style="border-radius:8px;font-weight:600" data-bs-dismiss="modal">Cancelar</button>' +
        '<button type="button" class="btn-custom-action btn-pedir" style="width:auto;padding:10px 20px" onclick="guardarEstadoDevolucion()"><i class="bi bi-check-lg me-1"></i> Guardar</button>' +
        '</div>' +
        '</div></div></div>';
    document.body.appendChild(cont);
}

var devLineaSeq = 0;
var devEstadoContexto = null;

function fechaHoyYMD() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}

function construirSelectProveedorDevolucion() {
    var selProv = document.getElementById('devSelProveedor');
    if (!selProv) return;
    var proveedores = devolucionesProveedores.length ? devolucionesProveedores : (typeof proveedoresGlobal !== 'undefined' ? proveedoresGlobal : []);
    var html = '<option value="">Seleccionar proveedor...</option>';
    proveedores.forEach(function(p) {
        html += '<option value="' + p.id_proveedor + '">' + devEsc(p.nombre) + '</option>';
    });
    selProv.innerHTML = html;
    var provSeed = devolucionSemilla && devolucionSemilla.id_proveedor;
    if (provSeed) {
        selProv.value = String(provSeed);
        if (!selProv.value) {
            var p = proveedores.find(function(x) { return Number(x.id_proveedor) === Number(provSeed); });
            if (p) { html += '<option value="' + p.id_proveedor + '" selected>' + devEsc(p.nombre) + '</option>'; selProv.innerHTML = html; }
        }
    }
}

function abrirModalDevolucion(semilla) {
    insertarModalesDevolucion();
    devolucionSemilla = semilla || null;
    devLineaSeq = 0;
    document.getElementById('contenedorAlertasDevolucionCreate').innerHTML = '';
    document.getElementById('devInputMotivoGeneral').value = '';
    document.getElementById('devInputNotas').value = '';
    document.getElementById('devInputFecha').value = fechaHoyYMD();
    document.getElementById('devSelectEstado').value = 'Pendiente';

    var proveedoresDisponibles = devolucionesProveedores.length ? devolucionesProveedores : (typeof proveedoresGlobal !== 'undefined' ? proveedoresGlobal : []);
    if (proveedoresDisponibles.length === 0) {
        fetch(API_BASE + '/api/proveedores')
            .then(function(r) { return r.json(); })
            .then(function(dt) {
                if (dt.success) {
                    devolucionesProveedores = dt.proveedores || [];
                    construirSelectProveedorDevolucion();
                }
            })
            .catch(function() {})
            .then(function() {
                if (!document.getElementById('devSelProveedor') || !document.getElementById('devSelProveedor').innerHTML) construirSelectProveedorDevolucion();
            });
    } else {
        construirSelectProveedorDevolucion();
    }

    document.getElementById('devLineasProductos').innerHTML = '';
    var primera = agregarLineaDevolucion(null, semilla ? semilla.id_producto : null);

    if (semilla && semilla.id_producto && primera) {
        setTimeout(function() {
            try {
                if (typeof primera.refrescar === 'function') primera.refrescar();
            } catch (e) {}
        }, 50);
    }

    if (!modalDevolucionBS) modalDevolucionBS = new bootstrap.Modal(document.getElementById('modalDevolucionCrear'));
    modalDevolucionBS.show();
    refrescarProductosModalDevolucion();
    actualizarTotalDevolucion();
}

function cargarProductosParaModalDevolucion() {
    return fetch(API_BASE + '/api/productos/admin')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success) devolucionesProductos = data.productos || [];
            return devolucionesProductos;
        })
        .catch(function() { devolucionesProductos = []; return []; });
}

function refrescarProductosModalDevolucion() {
    var idProv = document.getElementById('devSelProveedor').value;
    if (!idProv) {
        cargarProductosParaModalDevolucion().then(function() { poblarProductosLineasDevolucion(); });
        return;
    }
    // Carga los productos asociados al proveedor para preseleccion y precios
    fetch(API_BASE + '/api/proveedores/' + idProv + '/productos')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success && data.productos.length) {
                var map = {};
                data.productos.forEach(function(rp) { map[Number(rp.id_producto)] = rp; });
                devolucionSemilla = devolucionSemilla || {};
                devolucionSemilla.relaciones = map;
            }
            return null;
        })
        .catch(function() { return null; })
        .then(function() {
            return cargarProductosParaModalDevolucion();
        })
        .then(function() {
            poblarProductosLineasDevolucion();
        });
}

function poblarProductosLineasDevolucion() {
    var selectores = document.querySelectorAll('#devLineasProductos .dev-select-producto');
    if (!selectores.length) return;
    selectores.forEach(function(sel) {
        if (sel.dataset.cargado) return;
        sel.dataset.cargado = '1';
        llenarOpcionesProducto(sel);
    });
}

function llenarOpcionesProducto(sel) {
    var actual = sel.value;
    var html = '<option value="">Seleccionar producto...</option>';
    var relaciones = (devolucionSemilla && devolucionSemilla.relaciones) || {};
    var lista = devolucionesProductos || [];
    lista.forEach(function(p) {
        var rel = relaciones[Number(p.id_producto)];
        var costo = Number(rel ? rel.precio_compra : (p.precio_costo != null ? p.precio_costo : p.costo)) || 0;
        sel.dataset.project = '';
        var label = p.nombre + ' — Stock: ' + (p.stock || 0) + ' · Costo: $' + costo.toLocaleString('es-CO');
        html += '<option value="' + p.id_producto + '" data-costo="' + costo + '"' + (String(p.id_producto) === actual ? ' selected' : '') + '>' + devEsc(label) + '</option>';
    });
    sel.innerHTML = html;
    if (actual) sel.value = actual;
}

function agregarLineaDevolucion(ev, idProducto) {
    if (ev) ev.preventDefault();
    devLineaSeq++;
    var wrap = document.getElementById('devLineasProductos');
    if (!wrap) return null;
    var idLinea = 'devLinea_' + devLineaSeq;

    var tr = document.createElement('div');
    tr.id = idLinea;
    tr.className = 'dev-linea';
    tr.style.cssText = 'display:grid;grid-template-columns:3fr 1fr 1fr 1fr 1fr auto;gap:8px;align-items:end;margin-bottom:10px;padding:12px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;';

    var selOpts = '<option value="">Seleccionar producto...</option>';
    (devolucionesProductos || []).forEach(function(p) {
        var costo = Number(p.precio_costo != null ? p.precio_costo : p.costo) || 0;
        selOpts += '<option value="' + p.id_producto + '" data-costo="' + costo + '">' + devEsc(p.nombre) + ' — Stock: ' + (p.stock || 0) + '</option>';
    });

    tr.innerHTML =
        '<div><label style="font-size:0.68rem;font-weight:700;color:#64748b;text-transform:uppercase">Producto *</label>' +
        '<input type="hidden" id="' + idLinea + '_data"></div>' + // placeholder reemplazado abajo
        '';

    // Construir celdas
    var celProducto = '<div style="min-width:220px"><label style="font-size:0.68rem;font-weight:700;color:#64748b;text-transform:uppercase">Producto *</label><select class="form-select form-select-sm dev-select-producto" style="border-radius:8px;border:1px solid #e2e8f0" onchange="verificarStockLineaDevolucion(\'' + idLinea + '\');actualizarTotalDevolucion()">' + selOpts + '</select></div>';
    var celCant = '<div><label style="font-size:0.68rem;font-weight:700;color:#64748b;text-transform:uppercase">Cantidad *</label><input type="number" class="form-control form-control-sm dev-input-cantidad" id="' + idLinea + '_cant" min="0" step="0.01" value="1" style="border-radius:8px;border:1px solid #e2e8f0" oninput="actualizarTotalDevolucion()"></div>';
    var celCosto = '<div><label style="font-size:0.68rem;font-weight:700;color:#64748b;text-transform:uppercase">Costo unit.</label><input type="number" class="form-control form-control-sm dev-input-costo" id="' + idLinea + '_costo" min="0" step="0.5" style="border-radius:8px;border:1px solid #e2e8f0" oninput="actualizarTotalDevolucion()"></div>';
    var celMotivo = '<div><label style="font-size:0.68rem;font-weight:700;color:#64748b;text-transform:uppercase">Motivo</label><select class="form-select form-select-sm dev-select-motivo" id="' + idLinea + '_motivo" style="border-radius:8px;border:1px solid #e2e8f0">' + DEV_MOTIVOS.map(function(m) { return '<option>' + m + '</option>'; }).join('') + '</select></div>';
    var celNota = '<div><label style="font-size:0.68rem;font-weight:700;color:#64748b;text-transform:uppercase">N. crédito</label><div style="display:flex;align-items:center;justify-content:center;height:31px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc"><input type="checkbox" class="form-check-input dev-check-nota" id="' + idLinea + '_nota" style="margin:0"></div></div>';
    var celSub = '<div><label style="font-size:0.68rem;font-weight:700;color:#64748b;text-transform:uppercase;display:block;text-align:right">Subtotal</label><div id="' + idLinea + '_subtotal" style="text-align:right;font-weight:800;color:#0f172a;height:31px;display:flex;align-items:center;justify-content:flex-end;font-size:0.85rem">$0</div></div>';
    var celBtn = '<div style="text-align:right"><label style="display:block">&nbsp;</label><button type="button" class="btn btn-sm btn-light" style="border:1px solid #e2e8f0;border-radius:8px;color:#dc2626;width:32px" title="Quitar" onclick="quitarLineaDevolucion(\'' + idLinea + '\')"><i class="bi bi-x-lg"></i></button></div>';

    tr.innerHTML = celProducto + celCant + celCosto + celMotivo + celNota + celSub + celBtn;

    // Reaplicar grid responsive via media query en CSS
    wrap.appendChild(tr);

    if (idProducto) {
        var sel = tr.querySelector('.dev-select-producto');
        if (sel) { sel.value = String(idProducto); sel.dataset.cargado = '1'; }
    }

    setLineaCostoDesdeProducto(idLinea);
    actualizarTotalDevolucion();
    return { refrescar: function() { llenarOpcionesProducto(tr.querySelector('.dev-select-producto')); } };
}

function setLineaCostoDesdeProducto(idLinea) {
    var sel = document.getElementById(idLinea) ? document.getElementById(idLinea).querySelector('.dev-select-producto') : null;
    var costoInput = document.getElementById(idLinea + '_costo');
    if (!sel || !costoInput) return;
    var op = sel.selectedOptions && sel.selectedOptions[0];
    var costo = op && op.dataset && op.dataset.costo ? Number(op.dataset.costo) : 0;
    costoInput.value = costo || '';
    verificarStockLineaDevolucion(idLinea);
}

function quitarLineaDevolucion(idLinea) {
    var el = document.getElementById(idLinea);
    if (el) el.remove();
    actualizarTotalDevolucion();
}

function verificarStockLineaDevolucion(idLinea) {
    var el = document.getElementById(idLinea);
    if (!el) return;
    var sel = el.querySelector('.dev-select-producto');
    var cant = el.querySelector('.dev-input-cantidad');
    if (!sel || !cant) return;
    var op = sel.selectedOptions && sel.selectedOptions[0];
    if (op && op.dataset && op.dataset.costo) {
        var costoInp = document.getElementById(idLinea + '_costo');
        if (costoInp) costoInp.value = Number(op.dataset.costo) || '';
    }
    actualizarTotalDevolucion();
}

function actualizarTotalDevolucion() {
    var total = 0;
    var lineas = document.querySelectorAll('#devLineasProductos .dev-linea');
    lineas.forEach(function(ln) {
        var id = ln.id;
        var cant = Number(document.getElementById(id + '_cant') ? document.getElementById(id + '_cant').value : 0) || 0;
        var costo = Number(document.getElementById(id + '_costo') ? document.getElementById(id + '_costo').value : 0) || 0;
        var sub = cant * costo;
        total += sub;
        var elSub = document.getElementById(id + '_subtotal');
        if (elSub) elSub.textContent = devMoney(sub);
    });
    var elTotal = document.getElementById('devTotalMonto');
    if (elTotal) elTotal.textContent = devMoney(total);
}

function recolectarLineasDevolucion() {
    var lineas = [];
    var invalido = false;
    document.querySelectorAll('#devLineasProductos .dev-linea').forEach(function(ln) {
        var id = ln.id;
        var sel = ln.querySelector('.dev-select-producto');
        var cantidad = Number(document.getElementById(id + '_cant') ? document.getElementById(id + '_cant').value : 0) || 0;
        var costo = Number(document.getElementById(id + '_costo') ? document.getElementById(id + '_costo').value : 0) || 0;
        var motivoSel = document.getElementById(id + '_motivo');
        var nota = document.getElementById(id + '_nota');
        if (!sel || !sel.value) {
            invalido = true;
            return;
        }
        if (!cantidad || cantidad <= 0) {
            invalido = true;
            return;
        }
        var relMap = (devolucionSemilla && devolucionSemilla.relaciones) || {};
        var rel = relMap[Number(sel.value)];
        lineas.push({
            id_producto: Number(sel.value),
            cantidad: cantidad,
            costo_unitario: costo || (rel ? Number(rel.precio_compra) : 0),
            motivo: motivoSel ? motivoSel.value : 'Otro',
            genera_nota_credito: nota ? nota.checked : false
        });
    });
    if (invalido) return { ok: false, lineas: [] };
    return { ok: lineas.length > 0, lineas: lineas };
}

function confirmarCrearDevolucion() {
    var idProv = document.getElementById('devSelProveedor').value;
    if (!idProv) { mostrarAlertaDevolucionCreate('warning', 'Seleccione el proveedor.'); return; }
    var rec = recolectarLineasDevolucion();
    if (!rec.ok) { mostrarAlertaDevolucionCreate('warning', 'Agregue al menos un producto con cantidad válida.'); return; }

    var total = 0;
    rec.lineas.forEach(function(l) { total += Number(l.cantidad) * Number(l.costo_unitario); });
    var estado = document.getElementById('devSelectEstado').value;
    var fecha = document.getElementById('devInputFecha').value || fechaHoyYMD();
    var motivoGeneral = document.getElementById('devInputMotivoGeneral').value.trim();
    var notas = document.getElementById('devInputNotas').value.trim();

    var proveedor = (devolucionesProveedores.length ? devolucionesProveedores : (typeof proveedoresGlobal !== 'undefined' ? proveedoresGlobal : []))
        .find(function(p) { return String(p.id_proveedor) === String(idProv); });

    var msg = '¿Confirmar y registrar la devolución a ' + (proveedor ? proveedor.nombre : 'proveedor') + '?\n\n' +
        rec.lineas.length + ' producto(s) · ' + rec.lineas.reduce(function(a, l) { return a + Number(l.cantidad); }, 0) + ' unidad(es)\n' +
        'Valor devuelto: ' + devMoney(total);
    if (estado === 'Aprobada' || estado === 'Completada') {
        msg += '\n\nIMPORTANTE: se descontará esa cantidad del inventario y se registrará el movimiento (Salida por devolución a proveedor).';
    } else {
        msg += '\n\nQuedará como Pendiente; el stock se descontará cuando apruebes la devolución.';
    }
    if (!window.confirm(msg)) return;

    var payload = {
        id_proveedor: Number(idProv),
        id_usuario: typeof usuario !== 'undefined' && usuario ? usuario.id_usuario : null,
        motivo_general: motivoGeneral,
        notas: notas,
        fecha: fecha,
        estado: estado,
        detalles: rec.lineas
    };

    var btn = document.querySelector('#modalDevolucionCrear .btn-pedir');
    var originalBtn = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Registrando...'; }

    fetch(API_BASE + '/api/devoluciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (btn) { btn.disabled = false; btn.innerHTML = originalBtn; }
        if (data.success) {
            if (modalDevolucionBS) { modalDevolucionBS.hide(); limpiarBackdrops(); }
            var proveedorGlobal = typeof proveedoresGlobal !== 'undefined' ? proveedoresGlobal : [];
            if (proveedorGlobal.length === 0) cargarProveedoresDevoluciones();
            actualizarDevolucionesTrasCambio();
            mostrarToastsAlerta('success', data.mensaje);
        } else {
            mostrarAlertaDevolucionCreate('danger', data.mensaje || 'Error al registrar devolución');
        }
    })
    .catch(function() {
        if (btn) { btn.disabled = false; btn.innerHTML = originalBtn; }
        mostrarAlertaDevolucionCreate('danger', 'No se pudo conectar con el servidor');
    });
}

function mostrarAlertaDevolucionCreate(tipo, msg) {
    var c = document.getElementById('contenedorAlertasDevolucionCreate');
    if (!c) return;
    c.innerHTML = '<div class="alert alert-' + tipo + ' alert-dismissible fade show" style="font-size:0.85rem;border-radius:10px">' + msg + '<button type="button" class="btn-close" data-bs-dismiss="alert"></button></div>';
    setTimeout(function() { c.innerHTML = ''; }, 4500);
}

// ============ CAMBIO DE ESTADO ============
function abrirModalCambiarEstadoDevolucion(idDevolucion) {
    insertarModalesDevolucion();
    devEstadoContexto = Number(idDevolucion);
    var dev = devolucionesLista.find(function(d) { return Number(d.id_devolucion) === Number(idDevolucion); });
    document.getElementById('devEstadoNumero').textContent = dev ? dev.numero_devolucion : ('#' + idDevolucion);
    document.getElementById('devEstadoInfo').textContent = dev
        ? ('Proveedor: ' + dev.proveedor_nombre + ' · Total: ' + devMoney(dev.total_devuelto))
        : '';
    var sel = document.getElementById('devSelectNuevoEstado');
    sel.value = 'Aprobada';
    document.getElementById('contenedorAlertasDevolucionEstado').innerHTML = '';
    if (!modalDevolucionDetalleBS) {
        // reutilizamos un modal BS propio
    }
    var m = document.getElementById('modalDevolucionEstado');
    var bs = bootstrap.Modal.getInstance(m) || new bootstrap.Modal(m);
    bs.show();
}

function guardarEstadoDevolucion() {
    if (!devEstadoContexto) return;
    var estado = document.getElementById('devSelectNuevoEstado').value;
    fetch(API_BASE + '/api/devoluciones/' + devEstadoContexto + '/estado', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: estado, id_usuario: typeof usuario !== 'undefined' && usuario ? usuario.id_usuario : null })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.success) {
            var m = document.getElementById('modalDevolucionEstado');
            var bs = bootstrap.Modal.getInstance(m);
            if (bs) bs.hide();
            limpiarBackdrops();
            actualizarDevolucionesTrasCambio();
            if (typeof mostrarAlerta === 'function') mostrarAlerta('success', data.mensaje);
            else mostrarToastsAlerta('success', data.mensaje);
        } else {
            mostrarAlertaDevolucionEstado('danger', data.mensaje || 'Error al cambiar estado');
        }
    })
    .catch(function() { mostrarAlertaDevolucionEstado('danger', 'No se pudo conectar con el servidor'); });
}

function mostrarAlertaDevolucionEstado(tipo, msg) {
    var c = document.getElementById('contenedorAlertasDevolucionEstado');
    if (!c) return;
    c.innerHTML = '<div class="alert alert-' + tipo + ' alert-dismissible fade show" style="font-size:0.85rem;border-radius:10px">' + msg + '<button type="button" class="btn-close" data-bs-dismiss="alert"></button></div>';
    setTimeout(function() { c.innerHTML = ''; }, 4500);
}

// ============ DETALLE DE DEVOLUCION ============
function verDetalleDevolucion(idDevolucion) {
    insertarModalesDevolucion();
    var titulo = document.getElementById('tituloModalDevolucionDetalle');
    var cuerpo = document.getElementById('contenidoDevolucionDetalle');
    if (titulo) titulo.innerHTML = '<i class="bi bi-arrow-return-left me-2"></i>Detalle de Devolución #' + idDevolucion;
    if (cuerpo) cuerpo.innerHTML = '<div class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div></div>';
    if (!modalDevolucionDetalleBS) modalDevolucionDetalleBS = new bootstrap.Modal(document.getElementById('modalDevolucionDetalle'));
    modalDevolucionDetalleBS.show();

    fetch(API_BASE + '/api/devoluciones/' + idDevolucion)
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (cuerpo) cuerpo.innerHTML = data.success ? renderDetalleDevolucion(data.devolucion) : '<div style="padding:20px;color:#dc2626;text-align:center">' + devEsc(data.mensaje || 'Error') + '</div>';
        })
        .catch(function() {
            if (cuerpo) cuerpo.innerHTML = '<div style="padding:20px;color:#dc2626;text-align:center">No se pudo cargar el detalle</div>';
        });
}

function renderDetalleDevolucion(d) {
    var html =
        '<div class="row g-3 mb-3">' +
        '<div class="col-md-4"><div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px"><div style="font-size:0.7rem;font-weight:700;color:#64748b;text-transform:uppercase">Número</div><div style="font-weight:800;color:#0f172a;font-size:1rem">' + devEsc(d.numero_devolucion) + '</div></div></div>' +
        '<div class="col-md-4"><div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px"><div style="font-size:0.7rem;font-weight:700;color:#64748b;text-transform:uppercase">Proveedor</div><div style="font-weight:700;color:#0f172a">' + devEsc(d.proveedor_nombre || '-') + '</div></div></div>' +
        '<div class="col-md-4"><div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px"><div style="font-size:0.7rem;font-weight:700;color:#64748b;text-transform:uppercase">Fecha</div><div style="font-weight:700;color:#0f172a">' + devFecha(d.fecha) + ' <span style="color:#94a3b8;font-weight:400">' + devHora(d.fecha) + '</span></div></div></div>' +
        '</div>' +
        '<div class="mb-3" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
        badgeEstadoDevolucion(d.estado) +
        (d.stock_descontado ? '<span style="background:#dcfce7;color:#15803d;padding:3px 10px;border-radius:8px;font-size:0.75rem;font-weight:600"><i class="bi bi-check-circle me-1"></i>Stock descontado</span>' : '<span style="background:#fef3c7;color:#92400e;padding:3px 10px;border-radius:8px;font-size:0.75rem;font-weight:600"><i class="bi bi-hourglass-split me-1"></i>Sin descuento de stock</span>') +
        (d.motivo_general ? '<span style="background:#f8fafc;color:#475569;padding:3px 10px;border-radius:8px;font-size:0.75rem"><i class="bi bi-pencil me-1"></i>' + devEsc(d.motivo_general) + '</span>' : '') +
        '</div>' +
        (d.notas ? '<div style="background:#eff6ff;color:#1d4ed8;border-radius:10px;padding:10px 14px;font-size:0.83rem;margin-bottom:14px"><i class="bi bi-journal-text me-1"></i>' + devEsc(d.notas) + '</div>' : '') +
        '<div class="table-responsive" style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden"><table class="table table-sm mb-0 align-middle" style="margin:0">' +
        '<thead style="background:#f8fafc"><tr>' +
        '<th style="border-color:#e2e8f0;font-weight:600;font-size:0.78rem">Producto</th>' +
        '<th style="border-color:#e2e8f0;font-weight:600;font-size:0.78rem;text-align:center">Cant.</th>' +
        '<th style="border-color:#e2e8f0;font-weight:600;font-size:0.78rem;text-align:right">Costo Unit.</th>' +
        '<th style="border-color:#e2e8f0;font-weight:600;font-size:0.78rem;text-align:center">Motivo</th>' +
        '<th style="border-color:#e2e8f0;font-weight:600;font-size:0.78rem;text-align:center">N. Crédito</th>' +
        '<th style="border-color:#e2e8f0;font-weight:600;font-size:0.78rem;text-align:right">Subtotal</th>' +
        '</tr></thead><tbody>';
    (d.detalles || []).forEach(function(dt) {
        html += '<tr>' +
            '<td style="border-color:#f1f5f9;font-weight:700;color:#0f172a">' + devEsc(dt.producto_nombre || '-') + '</td>' +
            '<td style="border-color:#f1f5f9;text-align:center">' + dt.cantidad + '</td>' +
            '<td style="border-color:#f1f5f9;text-align:right">' + devMoney(dt.costo_unitario) + '</td>' +
            '<td style="border-color:#f1f5f9;text-align:center">' + badgeMotivoDevolucion(dt.motivo) + '</td>' +
            '<td style="border-color:#f1f5f9;text-align:center">' + (Number(dt.genera_nota_credito) ? '<span style="color:#15803d;font-weight:700">Sí</span>' : '<span style="color:#94a3b8">No</span>') + '</td>' +
            '<td style="border-color:#f1f5f9;text-align:right;font-weight:700;color:#dc2626">' + devMoney(dt.subtotal) + '</td></tr>';
    });
    html += '</tbody><tfoot><tr><td colspan="5" style="text-align:right;font-weight:700;color:#334155">TOTAL DEVUELTO</td><td style="text-align:right;font-weight:800;color:#dc2626;font-size:1rem">' + devMoney(d.total_devuelto) + '</td></tr></tfoot></table></div>';
    if (d.usuario_nombre) html += '<div style="margin-top:10px;font-size:0.78rem;color:#94a3b8"><i class="bi bi-person me-1"></i>Registrada por: ' + devEsc(d.usuario_nombre) + '</div>';
    return html;
}

function actualizarDevolucionesTrasCambio() {
    // Refresca la lista si la vista actual es la del módulo
    if (document.getElementById('contenedorTablaDevoluciones')) {
        cargarDevoluciones();
    }
    // Refresca las listas embebidas en fichas (proveedor / producto)
    if (typeof recargarDevolucionesEnFichas === 'function') recargarDevolucionesEnFichas();
}

function mostrarToastsAlerta(tipo, msg) {
    if (typeof mostrarToast === 'function') mostrarToast(tipo, msg);
    else if (typeof mostrarAlerta === 'function') mostrarAlerta(tipo, msg);
}

// Recalcula el grid de lineas al redimensionar (responsive movil)
if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('DOMContentLoaded', function() {
        var style = document.createElement('style');
        style.textContent =
            '@media (max-width: 992px){.dev-linea{grid-template-columns:1fr 1fr !important}}' +
            '@media (max-width: 640px){.dev-linea{grid-template-columns:1fr !important}}';
        (document.head || document.documentElement).appendChild(style);
    });
}