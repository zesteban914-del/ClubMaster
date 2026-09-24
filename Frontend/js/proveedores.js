// =========================================================
// CONTROLADOR: PROVEEDORES / DISTRIBUIDORES
// Gestion comercial y compras con trazabilidad financiera y fiscal
// =========================================================

var proveedoresGlobal = [];
var fichaDatos = null;
var fichaTabActual = 'info';
var abonoContexto = null;
var alertaFichaPendiente = null;
var modalProveedorBS = null;

var CATEGORIAS_PROVEEDOR = [
    'Licores & Bebidas',
    'Insumos de Barra',
    'Alimentos & Snacks',
    'Logística / Servicios',
    'Mantenimiento',
    'Otros'
];

var DIAS_CREDITO_OPCIONES = [
    { valor: 0, etiqueta: 'Contado' },
    { valor: 8, etiqueta: '8 días' },
    { valor: 15, etiqueta: '15 días' },
    { valor: 30, etiqueta: '30 días' }
];

var TIPOS_CUENTA = ['Ahorros', 'Corriente', 'Otro'];

var METODOS_PAGO_PROVEEDOR = [
    'Efectivo',
    'Transferencia bancaria',
    'Nequi',
    'Daviplata',
    'Tarjeta débito / crédito',
    'Cheque',
    'Otro'
];

// ============ HELPERS ============
function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmtMoney(n) {
    return '$' + Math.round(Number(n) || 0).toLocaleString('es-CO');
}

function fmtFecha(s) {
    if (!s) return '-';
    try { return new Date(s).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch (e) { return s; }
}

var fichaFiltroDesde = '';
var fichaFiltroHasta = '';
function fechaYMDProv(v) {
    try {
        var s = String(v == null ? '' : v);
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
        var d = new Date(s);
        if (isNaN(d.getTime())) return '';
        return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    } catch (e) { return ''; }
}
function enRangoProv(v) {
    if (!fichaFiltroDesde && !fichaFiltroHasta) return true;
    var f = fechaYMDProv(v);
    if (!f) return false;
    if (fichaFiltroDesde && f < fichaFiltroDesde) return false;
    if (fichaFiltroHasta && f > fichaFiltroHasta) return false;
    return true;
}
function htmlFiltroFechasFicha() {
    return '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-bottom:12px;padding:12px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px">' +
        '<div><label style="font-size:.68rem;font-weight:700;color:#64748b;text-transform:uppercase">Desde</label><input type="date" id="fFichaDesde" class="form-control form-control-sm" style="border-radius:8px;border:1px solid #e2e8f0" value="' + esc(fichaFiltroDesde) + '"></div>' +
        '<div><label style="font-size:.68rem;font-weight:700;color:#64748b;text-transform:uppercase">Hasta</label><input type="date" id="fFichaHasta" class="form-control form-control-sm" style="border-radius:8px;border:1px solid #e2e8f0" value="' + esc(fichaFiltroHasta) + '"></div>' +
        '<button class="btn btn-sm btn-primary" style="border-radius:8px;font-weight:700" onclick="aplicarFiltroFechasFicha()"><i class="bi bi-funnel me-1"></i>Filtrar</button>' +
        '<button class="btn btn-sm btn-light" style="border-radius:8px;font-weight:700;border:1px solid #e2e8f0" onclick="limpiarFiltroFechasFicha()">Limpiar</button></div>';
}
function aplicarFiltroFechasFicha() {
    var d = document.getElementById('fFichaDesde'), h = document.getElementById('fFichaHasta');
    fichaFiltroDesde = d && d.value ? d.value : '';
    fichaFiltroHasta = h && h.value ? h.value : '';
    mostrarTabFicha(fichaTabActual);
}
function limpiarFiltroFechasFicha() {
    fichaFiltroDesde = '';
    fichaFiltroHasta = '';
    mostrarTabFicha(fichaTabActual);
}

function limpiarBackdrops() {
    document.querySelectorAll('.modal-backdrop').forEach(function(b) { b.remove(); });
    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('overflow');
}

function obtenerProveedorPorId(id) {
    var idNum = Number(id);
    if (proveedoresGlobal) {
        var p = proveedoresGlobal.find(function(x) { return Number(x.id_proveedor) === idNum; });
        if (p) return p;
    }
    if (fichaDatos && fichaDatos.proveedor && Number(fichaDatos.proveedor.id_proveedor) === idNum) {
        return fichaDatos.proveedor;
    }
    return null;
}

function badgeProveedorEstado(activo) {
    return activo
        ? '<span class="status-indicator status-disponible" style="font-size:0.75rem;padding:3px 10px"><span class="status-dot"></span>Activo</span>'
        : '<span class="status-indicator status-default" style="font-size:0.75rem;padding:3px 10px"><span class="status-dot"></span>Inactivo</span>';
}

function badgeCategoria(cat) {
    var c = cat || 'General';
    return '<span class="inv-cat" style="display:inline-block;padding:4px 10px;border-radius:8px;background:#eff6ff;color:#2563eb;font-size:0.72rem;font-weight:700">' + esc(c) + '</span>';
}

function badgeEstadoCompra(estado, saldo) {
    saldo = Number(saldo) || 0;
    if (estado === 'Pagada') return '<span style="background:#dcfce7;color:#15803d;padding:3px 10px;border-radius:8px;font-size:0.75rem;font-weight:600">Pagada</span>';
    if (estado === 'Parcial') return '<span style="background:#eff6ff;color:#2563eb;padding:3px 10px;border-radius:8px;font-size:0.75rem;font-weight:600">Parcial</span>';
    if (estado === 'Anulada') return '<span style="background:#f1f5f9;color:#64748b;padding:3px 10px;border-radius:8px;font-size:0.75rem;font-weight:600">Anulada</span>';
    if (saldo > 0) return '<span style="background:#fef3c7;color:#92400e;padding:3px 10px;border-radius:8px;font-size:0.75rem;font-weight:600">Pendiente</span>';
    return '<span style="background:#dcfce7;color:#15803d;padding:3px 10px;border-radius:8px;font-size:0.75rem;font-weight:600">Pagada</span>';
}

function badgeDiasVencimiento(compra) {
    if (compra.estado === 'Pagada' || compra.estado === 'Anulada') {
        return '<span style="color:#64748b;font-size:0.82rem">' + fmtFecha(compra.fecha_vencimiento) + '</span>';
    }
    var dias = Number(compra.dias_vencimiento);
    if (dias < 0) {
        return '<span style="color:#dc2626;font-size:0.82rem;font-weight:700"><i class="bi bi-exclamation-triangle me-1"></i>' + fmtFecha(compra.fecha_vencimiento) + '</span>';
    }
    return '<span style="color:#64748b;font-size:0.82rem">' + fmtFecha(compra.fecha_vencimiento) + '</span>';
}

// ============ VISTA PRINCIPAL ============
function iniciarProveedores() {
    if(typeof verificarAcceso==='function'&&!verificarAcceso('gestionar_proveedores')){if(typeof verificarAccesoRB==='function'&&!verificarAccesoRB('gestionar_proveedores'))return;return;}
    if(typeof verificarAccesoRB==='function'&&!verificarAccesoRB('gestionar_proveedores'))return;
    activarNav('navProveedores');
    fichaDatos = null;
    modalProveedorBS = null;
    var contenedor = document.getElementById('main-content');
    contenedor.innerHTML =
        '<div class="page-header">' +
        '<h2><i class="bi bi-truck"></i>Proveedores y Distribuidores</h2>' +
        '<div class="page-header-right">' +
        '<button class="btn-refresh" onclick="iniciarProveedores()"><i class="bi bi-arrow-clockwise"></i> Actualizar</button>' +
        '<button class="btn-custom-action btn-pedir" style="padding:8px 18px;width:auto" onclick="modalNuevoProveedor()"><i class="bi bi-plus-lg me-1"></i> Nuevo Proveedor</button>' +
        '</div></div>' +
        '<div id="contenedorAlertas"></div>' +
        '<div class="row g-4 mb-4" id="filaKPIsProveedores"></div>' +
        '<div class="card" style="border:1px solid #e2e8f0;border-radius:14px;overflow:hidden">' +
        '<div style="padding:16px 20px;background:#0f172a;color:#f8fafc;font-weight:700;font-size:0.9rem;display:flex;align-items:center;gap:8px"><i class="bi bi-list-ul"></i> Distribuidores Registrados</div>' +
        '<div class="card-body p-0" style="background:#fff"><div id="contenedorTablaProveedores" class="text-center py-4"><div class="spinner-border text-primary"></div></div></div></div>' +
        htmlModalProveedor();
    limpiarBackdrops();
    cargarProveedores();
}

function cargarProveedores() {
    var cont = document.getElementById('contenedorTablaProveedores');
    if (cont) cont.innerHTML = '<div class="spinner-border spinner-border-sm text-primary"></div>';

    fetch(API_BASE + '/api/proveedores')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success) {
                proveedoresGlobal = data.proveedores || [];
                renderizarKPIsProveedores(proveedoresGlobal);
                renderizarTablaProveedores(proveedoresGlobal);
            } else if (cont) {
                cont.innerHTML = '<div style="padding:20px;color:#dc2626"><i class="bi bi-exclamation-triangle me-1"></i> ' + esc(data.mensaje || 'Error al cargar proveedores') + '</div>';
            }
        })
        .catch(function() {
            if (cont) cont.innerHTML = '<div style="padding:20px;color:#dc2626"><i class="bi bi-exclamation-triangle me-1"></i> No se pudo conectar con el servidor</div>';
        });
}

function renderizarKPIsProveedores(proveedores) {
    var fila = document.getElementById('filaKPIsProveedores');
    if (!fila) return;
    var totalProv = proveedores.length;
    var categorias = {};
    proveedores.forEach(function(p) { categorias[p.categoria || 'General'] = true; });
    var totalPorPagar = proveedores.reduce(function(a, p) { return a + Number(p.saldo_pendiente || 0); }, 0);
    var conDeuda = proveedores.filter(function(p) { return Number(p.saldo_pendiente) > 0; }).length;

    fila.innerHTML =
        '<div class="col-md-4"><div class="kpi-card" style="border-left:4px solid #3b82f6"><div class="kpi-top"><div class="kpi-label">Proveedores</div><div class="kpi-icon" style="background:#eff6ff;color:#3b82f6"><i class="bi bi-truck"></i></div></div><div class="kpi-value" id="kpiProvTotal">' + totalProv + '</div><div class="kpi-sub">distribuidores registrados</div></div></div>' +
        '<div class="col-md-4"><div class="kpi-card" style="border-left:4px solid #8b5cf6"><div class="kpi-top"><div class="kpi-label">Categorías</div><div class="kpi-icon" style="background:#f5f3ff;color:#8b5cf6"><i class="bi bi-grid"></i></div></div><div class="kpi-value" id="kpiProvCategorias">' + Object.keys(categorias).length + '</div><div class="kpi-sub">tipos de insumo que proveen</div></div></div>' +
        '<div class="col-md-4"><div class="kpi-card" style="border-left:4px solid #ef4444"><div class="kpi-top"><div class="kpi-label">Total por Pagar</div><div class="kpi-icon" style="background:#fef2f2;color:#ef4444"><i class="bi bi-exclamation-circle"></i></div></div><div class="kpi-value" style="color:' + (totalPorPagar > 0 ? '#dc2626' : '#10b981') + '" id="kpiProvPagar">' + fmtMoney(totalPorPagar) + '</div><div class="kpi-sub">' + conDeuda + ' proveedor(es) con saldo pendiente</div></div></div>';
}

function renderizarTablaProveedores(proveedores) {
    var cont = document.getElementById('contenedorTablaProveedores');
    if (!cont) return;

    if (proveedores.length === 0) {
        cont.innerHTML = '<div style="padding:24px;color:#94a3b8;text-align:center"><i class="bi bi-truck" style="font-size:2rem;display:block;margin-bottom:8px"></i>No hay proveedores registrados.</div>';
        return;
    }

    var tabla = '<div class="table-responsive"><table class="table table-hover mb-0 align-middle" style="margin:0;cursor:pointer">' +
        '<thead style="background:#f8fafc"><tr>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.85rem">Proveedor</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.85rem">Categoría</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.85rem">Contacto / Teléfono</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.85rem;text-align:right">Saldo Pendiente</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.85rem">Estado</th>' +
        '<th class="text-center" style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.85rem;cursor:default">Acciones</th></tr></thead><tbody>';

    proveedores.forEach(function(p) {
        var saldo = Number(p.saldo_pendiente) || 0;
        var strNombre = esc(p.nombre || '');
        var strRazon = (p.razon_social && p.razon_social !== p.nombre) ? p.razon_social : '';
        var saldoHtml = saldo > 0
            ? '<span style="color:#dc2626;font-weight:700">' + fmtMoney(saldo) + '</span>'
            : '<span style="color:#94a3b8">$0</span>';

        var btnAccion =
            '<div style="display:inline-flex;gap:4px">' +
            '<button class="btn-custom-action" style="background:#f0fdf4;color:#15803d;padding:5px 10px;font-size:0.78rem;border:1px solid #bbf7d0" title="Ver historial de compras / estado de cuenta" onclick="event.stopPropagation();verFichaProveedor(' + p.id_proveedor + ')"><i class="bi bi-journal-text"></i></button>' +
            '<button class="btn-custom-action" style="background:#eff6ff;color:#2563eb;padding:5px 10px;font-size:0.78rem;border:1px solid #bfdbfe" title="Editar" onclick="event.stopPropagation();editarProveedor(' + p.id_proveedor + ')"><i class="bi bi-pencil"></i></button>' +
            (p.activo
                ? '<button class="btn-custom-action" style="background:#fef2f2;color:#b91c1c;padding:5px 10px;font-size:0.78rem;border:1px solid #fecaca" title="Inactivar" onclick="event.stopPropagation();toggleProveedorEstado(' + p.id_proveedor + ', 0)"><i class="bi bi-x-lg"></i></button>'
                : '<button class="btn-custom-action" style="background:#ecfdf5;color:#15803d;padding:5px 10px;font-size:0.78rem;border:1px solid #bbf7d0" title="Activar" onclick="event.stopPropagation();toggleProveedorEstado(' + p.id_proveedor + ', 1)"><i class="bi bi-check-lg"></i></button>') +
            '</div>';

        tabla += '<tr style="border-color:#f1f5f9" onclick="verFichaProveedor(' + p.id_proveedor + ')">' +
            '<td style="border-color:#f1f5f9"><div style="font-weight:700;color:#0f172a">' + strNombre + '</div><div style="font-size:0.75rem;color:#64748b">' + (strRazon ? ('Razón social: ' + esc(strRazon)) : '') + '</div></td>' +
            '<td style="border-color:#f1f5f9">' + badgeCategoria(p.categoria) + '</td>' +
            '<td style="border-color:#f1f5f9"><div style="color:#334155;font-weight:600">' + esc(p.contacto || '-') + '</div><div style="font-size:0.78rem;color:#64748b">' + esc(p.telefono || '') + '</div></td>' +
            '<td style="border-color:#f1f5f9;text-align:right">' + saldoHtml + '</td>' +
            '<td style="border-color:#f1f5f9">' + badgeProveedorEstado(p.activo) + '</td>' +
            '<td class="text-center" style="border-color:#f1f5f9;cursor:default">' + btnAccion + '</td></tr>';
    });
    tabla += '</tbody></table></div>';
    cont.innerHTML = tabla;
}

// ============ MODAL NUEVO / EDITAR PROVEEDOR ============
function htmlOptionsCategoria(actual) {
    var html = '';
    CATEGORIAS_PROVEEDOR.forEach(function(c) {
        html += '<option value="' + esc(c) + '"' + (c === actual ? ' selected' : '') + '>' + esc(c) + '</option>';
    });
    return html;
}

function htmlOptionsDiasCredito(actual) {
    var html = '<option value="0"' + (Number(actual) === 0 ? ' selected' : '') + '>Contado</option>';
    DIAS_CREDITO_OPCIONES.forEach(function(o) {
        if (o.valor === 0) return;
        html += '<option value="' + o.valor + '"' + (Number(actual) === o.valor ? ' selected' : '') + '>' + esc(o.etiqueta) + '</option>';
    });
    return html;
}

function htmlOptionsTipoCuenta(actual) {
    var html = '<option value="">Seleccionar...</option>';
    TIPOS_CUENTA.forEach(function(t) {
        html += '<option value="' + esc(t) + '"' + (t === actual ? ' selected' : '') + '>' + esc(t) + '</option>';
    });
    return html;
}

function htmlModalProveedor() {
    return '<div class="modal fade" id="modalProveedor" tabindex="-1" aria-hidden="true">' +
        '<div class="modal-dialog modal-xl modal-dialog-scrollable">' +
        '<div class="modal-content">' +
        '<div class="modal-header"><h5 class="modal-title" id="tituloModalProveedor"><i class="bi bi-truck me-2"></i>Nuevo Proveedor</h5><button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div>' +
        '<div class="modal-body" style="background:#f8fafc">' +
        '<form id="formProveedor">' +
        '<div class="row g-3 mb-3">' +
        '<div class="col-md-6"><label class="form-label" style="font-weight:600;color:#334155;font-size:0.85rem">Nombre Comercial *</label><input type="text" class="form-control" style="border-radius:10px;border:1px solid #e2e8f0" id="inputProvNombre" required></div>' +
        '<div class="col-md-6"><label class="form-label" style="font-weight:600;color:#334155;font-size:0.85rem">Razón Social</label><input type="text" class="form-control" style="border-radius:10px;border:1px solid #e2e8f0" id="inputProvRazonSocial" placeholder="Nombre legal (si difiere)"></div>' +
        '</div>' +
        '<div class="row g-3 mb-3">' +
        '<div class="col-md-4"><label class="form-label" style="font-weight:600;color:#334155;font-size:0.85rem">NIT / RUC / Identificación Tributaria</label><input type="text" class="form-control" style="border-radius:10px;border:1px solid #e2e8f0" id="inputProvNit"></div>' +
        '<div class="col-md-4"><label class="form-label" style="font-weight:600;color:#334155;font-size:0.85rem">Categoría</label><select class="form-select" style="border-radius:10px;border:1px solid #e2e8f0" id="selectProvCategoria">' + htmlOptionsCategoria() + '</select></div>' +
        '<div class="col-md-4"><label class="form-label" style="font-weight:600;color:#334155;font-size:0.85rem">Teléfono</label><input type="text" class="form-control" style="border-radius:10px;border:1px solid #e2e8f0" id="inputProvTelefono"></div>' +
        '</div>' +
        '<div class="row g-3 mb-3">' +
        '<div class="col-md-6"><label class="form-label" style="font-weight:600;color:#334155;font-size:0.85rem">Persona de Contacto</label><input type="text" class="form-control" style="border-radius:10px;border:1px solid #e2e8f0" id="inputProvContacto"></div>' +
        '<div class="col-md-6"><label class="form-label" style="font-weight:600;color:#334155;font-size:0.85rem">Correo</label><input type="email" class="form-control" style="border-radius:10px;border:1px solid #e2e8f0" id="inputProvCorreo"></div>' +
        '</div>' +
        '<div class="mb-3"><label class="form-label" style="font-weight:600;color:#334155;font-size:0.85rem">Dirección</label><input type="text" class="form-control" style="border-radius:10px;border:1px solid #e2e8f0" id="inputProvDireccion"></div>' +
        '<div class="row g-3 mb-3">' +
        '<div class="col-md-4"><label class="form-label" style="font-weight:600;color:#334155;font-size:0.85rem">Términos de Pago / Crédito</label><select class="form-select" style="border-radius:10px;border:1px solid #e2e8f0" id="selectProvDiasCredito">' + htmlOptionsDiasCredito() + '</select></div>' +
        '<div class="col-md-4"><label class="form-label" style="font-weight:600;color:#334155;font-size:0.85rem">Límite de Crédito ($)</label><input type="number" class="form-control" style="border-radius:10px;border:1px solid #e2e8f0" id="inputProvLimiteCredito" min="0" step="10000" placeholder="0"></div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:#eff6ff;color:#1d4ed8;border-radius:10px;font-weight:700;font-size:0.8rem;margin-bottom:14px"><i class="bi bi-bank"></i> Datos de Facturación / Transferencias</div>' +
        '<div class="row g-3">' +
        '<div class="col-md-4"><label class="form-label" style="font-weight:600;color:#334155;font-size:0.85rem">Banco</label><input type="text" class="form-control" style="border-radius:10px;border:1px solid #e2e8f0" id="inputProvBanco" placeholder="Ej: Bancolombia"></div>' +
        '<div class="col-md-3"><label class="form-label" style="font-weight:600;color:#334155;font-size:0.85rem">Tipo de Cuenta</label><select class="form-select" style="border-radius:10px;border:1px solid #e2e8f0" id="selectProvTipoCuenta">' + htmlOptionsTipoCuenta() + '</select></div>' +
        '<div class="col-md-5"><label class="form-label" style="font-weight:600;color:#334155;font-size:0.85rem">Número de Cuenta</label><input type="text" class="form-control" style="border-radius:10px;border:1px solid #e2e8f0" id="inputProvNumeroCuenta"></div>' +
        '</div>' +
        '<input type="hidden" id="inputProvId">' +
        '</form></div>' +
        '<div class="modal-footer" style="border-top:1px solid #e2e8f0;background:#fff">' +
        '<button type="button" class="btn btn-light" style="border-radius:8px;font-weight:600" data-bs-dismiss="modal">Cancelar</button>' +
        '<button type="button" class="btn-custom-action btn-pedir" style="width:auto;padding:10px 24px" onclick="guardarProveedor()"><i class="bi bi-check-lg me-1"></i> Guardar</button>' +
        '</div></div></div></div>';
}

function modalNuevoProveedor() {
    document.getElementById('tituloModalProveedor').innerHTML = '<i class="bi bi-truck me-2"></i>Nuevo Proveedor';
    document.getElementById('formProveedor').reset();
    document.getElementById('inputProvId').value = '';
    document.getElementById('selectProvCategoria').innerHTML = htmlOptionsCategoria();
    document.getElementById('selectProvDiasCredito').innerHTML = htmlOptionsDiasCredito();
    document.getElementById('selectProvTipoCuenta').innerHTML = htmlOptionsTipoCuenta();
    if (!modalProveedorBS) modalProveedorBS = new bootstrap.Modal(document.getElementById('modalProveedor'));
    modalProveedorBS.show();
}

function editarProveedor(id) {
    var p = obtenerProveedorPorId(id);
    if (!p) {
        mostrarAlerta('warning', 'No se encontró el proveedor.');
        return;
    }
    document.getElementById('tituloModalProveedor').innerHTML = '<i class="bi bi-truck me-2"></i>Editar Proveedor';
    document.getElementById('inputProvId').value = p.id_proveedor;
    document.getElementById('inputProvNombre').value = p.nombre || '';
    document.getElementById('inputProvRazonSocial').value = p.razon_social || '';
    document.getElementById('inputProvNit').value = p.nit || '';
    document.getElementById('selectProvCategoria').innerHTML = htmlOptionsCategoria(p.categoria);
    document.getElementById('inputProvTelefono').value = p.telefono || '';
    document.getElementById('inputProvContacto').value = p.contacto || '';
    document.getElementById('inputProvCorreo').value = p.correo || '';
    document.getElementById('inputProvDireccion').value = p.direccion || '';
    document.getElementById('selectProvDiasCredito').innerHTML = htmlOptionsDiasCredito(p.dias_credito);
    document.getElementById('inputProvLimiteCredito').value = p.limite_credito || '';
    document.getElementById('inputProvBanco').value = p.banco || '';
    document.getElementById('selectProvTipoCuenta').innerHTML = htmlOptionsTipoCuenta(p.tipo_cuenta);
    document.getElementById('inputProvNumeroCuenta').value = p.numero_cuenta || '';
    if (!modalProveedorBS) modalProveedorBS = new bootstrap.Modal(document.getElementById('modalProveedor'));
    modalProveedorBS.show();
}

function guardarProveedor() {
    var id = document.getElementById('inputProvId').value;
    var nombre = document.getElementById('inputProvNombre').value.trim();
    if (!nombre) { mostrarAlerta('warning', 'El nombre comercial es obligatorio.'); return; }

    var payload = {
        nombre: nombre,
        razon_social: document.getElementById('inputProvRazonSocial').value.trim(),
        nit: document.getElementById('inputProvNit').value.trim(),
        categoria: document.getElementById('selectProvCategoria').value,
        telefono: document.getElementById('inputProvTelefono').value.trim(),
        contacto: document.getElementById('inputProvContacto').value.trim(),
        correo: document.getElementById('inputProvCorreo').value.trim(),
        direccion: document.getElementById('inputProvDireccion').value.trim(),
        dias_credito: Number(document.getElementById('selectProvDiasCredito').value) || 0,
        limite_credito: Number(document.getElementById('inputProvLimiteCredito').value) || 0,
        banco: document.getElementById('inputProvBanco').value.trim(),
        tipo_cuenta: document.getElementById('selectProvTipoCuenta').value,
        numero_cuenta: document.getElementById('inputProvNumeroCuenta').value.trim()
    };

    var url = id ? API_BASE + '/api/proveedores/' + id : API_BASE + '/api/proveedores';
    var method = id ? 'PUT' : 'POST';

    fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.success) {
            if (modalProveedorBS) {
                modalProveedorBS.hide();
                limpiarBackdrops();
            }
            iniciarProveedores();
            mostrarAlerta('success', data.mensaje);
        } else {
            mostrarAlerta('danger', data.mensaje || 'Error al guardar proveedor');
        }
    })
    .catch(function() {
        mostrarAlerta('danger', 'No se pudo conectar con el servidor');
    });
}

function toggleProveedorEstado(id, activo) {
    fetch(API_BASE + '/api/proveedores/' + id + '/estado', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: activo })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.success) {
            mostrarAlerta('success', data.mensaje);
            cargarProveedores();
        } else {
            mostrarAlerta('danger', data.mensaje || 'Error al actualizar proveedor');
        }
    })
    .catch(function() {
        mostrarAlerta('danger', 'No se pudo conectar con el servidor');
    });
}

// ============ FICHA DEL PROVEEDOR (3 PESTAÑAS) ============
function verFichaProveedor(id) {
    fichaFiltroDesde = '';
    fichaFiltroHasta = '';
    activarNav('navProveedores');
    var contenedor = document.getElementById('main-content');
    contenedor.innerHTML =
        '<div class="page-header">' +
        '<h2><i class="bi bi-person-lines-fill"></i><span id="fichaTitulo">Ficha del Proveedor</span></h2>' +
        '<div class="page-header-right">' +
        '<button class="btn-refresh" onclick="verFichaProveedor(' + id + ')"><i class="bi bi-arrow-clockwise"></i> Actualizar</button>' +
        '<button class="btn-custom-action btn-pedir" style="padding:8px 18px;width:auto" onclick="editarProveedor(' + id + ')"><i class="bi bi-pencil me-1"></i> Editar</button>' +
        '<button class="btn-custom-action" style="background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;width:auto;padding:8px 18px" onclick="abrirModalDevolucion({id_proveedor: ' + id + '})"><i class="bi bi-arrow-return-left me-1"></i> Devolver producto</button>' +
        '<button class="btn-custom-action" style="background:#fff;color:#475569;border:1px solid #e2e8f0;width:auto;padding:8px 18px" onclick="iniciarProveedores()"><i class="bi bi-arrow-left me-1"></i> Volver</button>' +
        '</div></div>' +
        '<div id="contenedorAlertas"></div>' +
        '<div class="row g-4 mb-4" id="fichaKPIs"></div>' +
        '<div id="fichaDetalle"></div>' +
        htmlModalProveedor() + htmlModalFacturaDetalle() + htmlModalAbono() + htmlModalRelacionProductoProveedor();
    limpiarBackdrops();
    fetchFichaProveedor(id);
}

function fetchFichaProveedor(id) {
    var det = document.getElementById('fichaDetalle');
    if (det) det.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>';

    fetch(API_BASE + '/api/proveedores/' + id + '/ficha')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success) {
                fichaDatos = data;
                renderizarFicha(data);
                if (alertaFichaPendiente) {
                    var a = alertaFichaPendiente;
                    alertaFichaPendiente = null;
                    mostrarAlerta(a.tipo, a.msg);
                }
            } else if (det) {
                det.innerHTML = '<div class="text-center py-5" style="color:#dc2626"><i class="bi bi-exclamation-triangle" style="font-size:2rem;display:block;margin-bottom:8px"></i>' + esc(data.mensaje || 'Error al cargar la ficha') + '</div>';
            }
        })
        .catch(function() {
            if (det) det.innerHTML = '<div class="text-center py-5" style="color:#dc2626"><i class="bi bi-wifi-off" style="font-size:2rem;display:block;margin-bottom:8px"></i>No se pudo conectar con el servidor</div>';
        });
}

function renderizarFicha(data) {
    var p = data.proveedor;
    document.getElementById('fichaTitulo').textContent = 'Ficha: ' + (p.nombre || 'Proveedor');

    var kpis = document.getElementById('fichaKPIs');
    kpis.innerHTML =
        '<div class="col-md-4"><div class="kpi-card" style="border-left:4px solid #3b82f6"><div class="kpi-top"><div class="kpi-label">Total Comprado</div><div class="kpi-icon" style="background:#eff6ff;color:#3b82f6"><i class="bi bi-bag-check"></i></div></div><div class="kpi-value">' + fmtMoney(data.total_comprado) + '</div><div class="kpi-sub">' + data.compras.length + ' factura(s) registrada(s)</div></div></div>' +
        '<div class="col-md-4"><div class="kpi-card" style="border-left:4px solid #10b981"><div class="kpi-top"><div class="kpi-label">Total Abonado</div><div class="kpi-icon" style="background:#ecfdf5;color:#10b981"><i class="bi bi-cash-stack"></i></div></div><div class="kpi-value">' + fmtMoney(data.total_abonado) + '</div><div class="kpi-sub">' + data.pagos.length + ' pago(s) registrado(s)</div></div></div>' +
        '<div class="col-md-4"><div class="kpi-card" style="border-left:4px solid #ef4444"><div class="kpi-top"><div class="kpi-label">Saldo por Pagar</div><div class="kpi-icon" style="background:#fef2f2;color:#ef4444"><i class="bi bi-exclamation-circle"></i></div></div><div class="kpi-value" style="color:' + (data.total_pendiente > 0 ? '#dc2626' : '#10b981') + '">' + fmtMoney(data.total_pendiente) + '</div><div class="kpi-sub">deuda actual con el proveedor</div></div></div>';

    var tabs = '<div class="card" style="border:1px solid #e2e8f0;border-radius:14px;overflow:hidden">' +
        '<div style="padding:16px 20px;background:#0f172a;color:#f8fafc;font-weight:700;font-size:0.9rem;display:flex;align-items:center;gap:8px"><i class="bi bi-grid-1x2"></i> Detalle del Proveedor</div>' +
        '<div class="card-body" style="background:#fff;padding-top:16px">' +
        '<ul class="nav nav-pills mb-3" id="fichaTabs" style="gap:6px">' +
        '<li class="nav-item"><a class="nav-link active" href="#" data-tab="info" style="border-radius:9px;font-weight:600;font-size:0.85rem" onclick="mostrarTabFicha(\'info\', event)"><i class="bi bi-info-circle me-1"></i>Información General</a></li>' +
        '<li class="nav-item"><a class="nav-link" href="#" data-tab="facturas" style="border-radius:9px;font-weight:600;font-size:0.85rem;color:#475569" onclick="mostrarTabFicha(\'facturas\', event)"><i class="bi bi-receipt me-1"></i>Historial de Facturas</a></li>' +
        '<li class="nav-item"><a class="nav-link" href="#" data-tab="cuenta" style="border-radius:9px;font-weight:600;font-size:0.85rem;color:#475569" onclick="mostrarTabFicha(\'cuenta\', event)"><i class="bi bi-wallet2 me-1"></i>Estado de Cuenta / Pagos</a></li>' +
        '<li class="nav-item"><a class="nav-link" href="#" data-tab="productos" style="border-radius:9px;font-weight:600;font-size:0.85rem;color:#475569" onclick="mostrarTabFicha(\'productos\', event)"><i class="bi bi-box-seam me-1"></i>Productos</a></li>' +
        '<li class="nav-item"><a class="nav-link" href="#" data-tab="devoluciones" style="border-radius:9px;font-weight:600;font-size:0.85rem;color:#475569" onclick="mostrarTabFicha(\'devoluciones\', event)"><i class="bi bi-arrow-return-left me-1"></i>Devoluciones</a></li>' +
        '</ul>' +
        '<div id="fichaTabContent"></div>' +
        '</div></div>';

    document.getElementById('fichaDetalle').innerHTML = tabs;
    fichaTabActual = 'info';
    mostrarTabFicha('info');
}

function mostrarTabFicha(tab, e) {
    if (e && e.preventDefault) e.preventDefault();
    fichaTabActual = tab;

    var links = document.querySelectorAll('#fichaTabs .nav-link');
    links.forEach(function(l) {
        if (l.getAttribute('data-tab') === tab) {
            l.classList.add('active');
            l.style.color = '#fff';
        } else {
            l.classList.remove('active');
            l.style.color = '#475569';
        }
    });

    var cont = document.getElementById('fichaTabContent');
    if (!cont) return;

    if (tab === 'info') cont.innerHTML = htmlTabInformacion();
    else if (tab === 'facturas') cont.innerHTML = htmlTabFacturas();
    else if (tab === 'cuenta') cont.innerHTML = htmlTabCuenta();
    else if (tab === 'productos') {
        cont.innerHTML = '<div class="text-center py-5" style="color:#94a3b8"><div class="spinner-border spinner-border-sm me-2" role="status"></div>Cargando productos...</div>';
        cargarProductosTabProveedor();
    }
    else if (tab === 'devoluciones') {
        cont.innerHTML = '<div class="text-center py-5" style="color:#94a3b8"><div class="spinner-border spinner-border-sm me-2" role="status"></div>Cargando devoluciones...</div>';
        cargarDevolucionesTabProveedor();
    }
}

// ============ PESTAÑA PRODUCTOS ASOCIADOS ============
var productosProveedorTab = [];

function cargarProductosTabProveedor() {
    var cont = document.getElementById('fichaTabContent');
    if (!cont || !fichaDatos || !fichaDatos.proveedor) return;
    var idProv = fichaDatos.proveedor.id_proveedor;
    fetch(API_BASE + '/api/proveedores/' + idProv + '/productos')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            var cH = document.getElementById('fichaTabContent');
            if (!cH) return;
            if (!data.success) {
                cH.innerHTML = '<div class="alert alert-danger">' + esc(data.mensaje || 'Error al cargar productos') + '</div>';
                return;
            }
            productosProveedorTab = data.productos || [];
            var prods = productosProveedorTab;
            var pref = prods.filter(function(r) { return Number(r.es_preferido) === 1; });
            cH.innerHTML =
                '<div class="row g-3 mb-3">' +
                '<div class="col-md-4"><div class="kpi-card" style="border-left:4px solid #3b82f6"><div class="kpi-top"><div class="kpi-label">Productos Asociados</div><div class="kpi-icon" style="background:#eff6ff;color:#3b82f6"><i class="bi bi-box-seam"></i></div></div><div class="kpi-value">' + prods.length + '</div><div class="kpi-sub">relaciones registradas</div></div></div>' +
                '<div class="col-md-4"><div class="kpi-card" style="border-left:4px solid #f59e0b"><div class="kpi-top"><div class="kpi-label">Proveedor Preferido</div><div class="kpi-icon" style="background:#fffbeb;color:#f59e0b"><i class="bi bi-star"></i></div></div><div class="kpi-value" style="font-size:1.05rem">' + (pref.length ? pref.length + ' producto(s)' : 'Ninguno') + '</div><div class="kpi-sub">marcado como preferido</div></div></div>' +
                '</div>' +
                '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px">' +
                '<div style="font-weight:700;color:#0f172a"><i class="bi bi-box-seam me-2" style="color:#3b82f6"></i>Productos que surte este proveedor</div>' +
                '<button class="btn-custom-action btn-pedir" style="padding:8px 16px;width:auto;font-size:0.82rem" onclick="abrirModalRelacionProductoProveedor({id_proveedor:' + idProv + '})"><i class="bi bi-plus-lg me-1"></i> Asociar producto</button>' +
                '</div>' +
                (prods.length ? tablaProductosProveedor(prods) : '<div style="padding:30px;text-align:center;color:#94a3b8;border:1px dashed #e2e8f0;border-radius:12px"><i class="bi bi-box" style="font-size:2rem;display:block;margin-bottom:8px"></i>Aún no has asociado productos a este proveedor.</div>');
        })
        .catch(function() {
            var cH2 = document.getElementById('fichaTabContent');
            if (cH2) cH2.innerHTML = '<div class="alert alert-danger">Error al cargar los productos del proveedor.</div>';
        });
}

function tablaProductosProveedor(prods) {
    var html = '<div class="table-responsive"><table class="table table-hover mb-0 align-middle" style="margin:0">' +
        '<thead style="background:#f8fafc"><tr>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem">Producto</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem;text-align:center">Stock</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem;text-align:right">Precio Compra</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem">Referencia</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem;text-align:center">Tiempo</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem;text-align:center">Pref.</th>' +
        '<th class="text-center" style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem">Acciones</th>' +
        '</tr></thead><tbody>';
    prods.forEach(function(r) {
        var preferido = Number(r.es_preferido) === 1;
        var costoAct = Number(r.costo_actual) || 0;
        html += '<tr style="border-color:#f1f5f9">' +
            '<td style="border-color:#f1f5f9"><div style="font-weight:700;color:#0f172a">' + esc(r.producto_nombre || 'Producto #' + r.id_producto) + '</div><div style="font-size:0.72rem;color:#94a3b8">Costo actual: ' + fmtMoney(costoAct) + '</div></td>' +
            '<td style="border-color:#f1f5f9;text-align:center">' + (Number(r.stock_actual) || 0) + '</td>' +
            '<td style="border-color:#f1f5f9;text-align:right;font-weight:700;color:#0f172a">' + fmtMoney(r.precio_compra) + '</td>' +
            '<td style="border-color:#f1f5f9;color:#64748b;font-size:0.82rem">' + esc(r.referencia_proveedor || '-') + '</td>' +
            '<td style="border-color:#f1f5f9;text-align:center">' + (r.tiempo_entrega != null ? r.tiempo_entrega + ' d' : '-') + '</td>' +
            '<td style="border-color:#f1f5f9;text-align:center">' + (preferido ? '<span style="color:#b45309;font-size:0.9rem"><i class="bi bi-star-fill"></i></span>' : '<span style="color:#cbd5e1"><i class="bi bi-star"></i></span>') + '</td>' +
            '<td class="text-center" style="border-color:#f1f5f9"><div style="display:inline-flex;gap:4px">' +
            '<button class="btn-custom-action" style="background:#eff6ff;color:#2563eb;padding:5px 9px;font-size:0.75rem;border:1px solid #bfdbfe" title="Ver producto" onclick="verFichaProducto(' + r.id_producto + ')"><i class="bi bi-box-seam"></i></button>' +
            '<button class="btn-custom-action" style="background:#fffbeb;color:#b45309;padding:5px 9px;font-size:0.75rem;border:1px solid #fde68a" title="Editar relación" onclick="abrirModalRelacionProductoProveedor({id_relacion:' + r.id_relacion + '})"><i class="bi bi-pencil"></i></button>' +
            '<button class="btn-custom-action" style="background:#fef2f2;color:#dc2626;padding:5px 9px;font-size:0.75rem;border:1px solid #fecaca" title="Quitar relación" onclick="quitarRelacionProductoProveedor(' + r.id_relacion + ')"><i class="bi bi-x-lg"></i></button>' +
            '</div></td></tr>';
    });
    html += '</tbody></table></div>';
    return html;
}

// ============ PESTAÑA DEVOLUCIONES DEL PROVEEDOR ============
function cargarDevolucionesTabProveedor() {
    var cont = document.getElementById('fichaTabContent');
    if (!cont || !fichaDatos || !fichaDatos.proveedor) return;
    var idProv = fichaDatos.proveedor.id_proveedor;
    fetch(API_BASE + '/api/proveedores/' + idProv + '/devoluciones')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            var cH = document.getElementById('fichaTabContent');
            if (!cH) return;
            if (!data.success) {
                cH.innerHTML = '<div class="alert alert-danger">' + esc(data.mensaje || 'Error al cargar devoluciones') + '</div>';
                return;
            }
            var devs = data.devoluciones || [];
            var pend = devs.filter(function(d) { return d.estado === 'Pendiente'; });
            var aprob = devs.filter(function(d) { return d.estado === 'Aprobada' || d.estado === 'Completada'; });
            var totalCant = devs.reduce(function(a, d) { return a + Number(d.items_cantidad || 0); }, 0);
            cH.innerHTML =
                '<div class="row g-3 mb-3">' +
                '<div class="col-md-4"><div class="kpi-card" style="border-left:4px solid #ef4444"><div class="kpi-top"><div class="kpi-label">Total Devuelto</div><div class="kpi-icon" style="background:#fef2f2;color:#ef4444"><i class="bi bi-arrow-return-left"></i></div></div><div class="kpi-value" style="color:#dc2626">' + fmtMoney(data.total_devuelto) + '</div><div class="kpi-sub">' + devs.length + ' devolución(es)</div></div></div>' +
                '<div class="col-md-4"><div class="kpi-card" style="border-left:4px solid #f59e0b"><div class="kpi-top"><div class="kpi-label">Pendientes</div><div class="kpi-icon" style="background:#fffbeb;color:#f59e0b"><i class="bi bi-hourglass-split"></i></div></div><div class="kpi-value" style="color:#d97706">' + pend.length + '</div><div class="kpi-sub">sin descuento de stock</div></div></div>' +
                '<div class="col-md-4"><div class="kpi-card" style="border-left:4px solid #3b82f6"><div class="kpi-top"><div class="kpi-label">Otras / Procesadas</div><div class="kpi-icon" style="background:#eff6ff;color:#3b82f6"><i class="bi bi-check2-circle"></i></div></div><div class="kpi-value">' + aprob.length + '</div><div class="kpi-sub">' + totalCant + ' unidad(es) devueltas</div></div></div>' +
                '</div>' +
                '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px">' +
                '<div style="font-weight:700;color:#0f172a"><i class="bi bi-arrow-return-left me-2" style="color:#dc2626"></i>Historial de devoluciones a este proveedor</div>' +
                '<button class="btn-custom-action btn-pedir" style="padding:8px 16px;width:auto;font-size:0.82rem" onclick="abrirModalDevolucion({id_proveedor:' + idProv + '})"><i class="bi bi-plus-lg me-1"></i> Registrar devolución</button>' +
                '</div>' +
                (devs.length ? tablaDevolucionesProveedor(devs) : '<div style="padding:30px;text-align:center;color:#94a3b8;border:1px dashed #e2e8f0;border-radius:12px"><i class="bi bi-arrow-return-left" style="font-size:2rem;display:block;margin-bottom:8px"></i>No hay devoluciones registradas con este proveedor.</div>');
        })
        .catch(function() {
            var cH2 = document.getElementById('fichaTabContent');
            if (cH2) cH2.innerHTML = '<div class="alert alert-danger">Error al cargar las devoluciones del proveedor.</div>';
        });
}

function tablaDevolucionesProveedor(devs) {
    var html = '<div class="table-responsive"><table class="table table-hover mb-0 align-middle" style="margin:0">' +
        '<thead style="background:#f8fafc"><tr>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem">N. Devolución</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem">Fecha</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem;text-align:center">Ítems</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem;text-align:center">Cant.</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem;text-align:right">Total Devuelto</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem">Estado</th>' +
        '<th class="text-center" style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem">Acciones</th>' +
        '</tr></thead><tbody>';
    devs.forEach(function(d) {
        html += '<tr style="border-color:#f1f5f9">' +
            '<td style="border-color:#f1f5f9;font-weight:700;color:#0f172a">' + esc(d.numero_devolucion) + '</td>' +
            '<td style="border-color:#f1f5f9"><div style="color:#334155;font-weight:600;font-size:0.83rem">' + devFecha(d.fecha) + '</div><div style="font-size:0.72rem;color:#94a3b8">' + devHora(d.fecha) + '</div></td>' +
            '<td style="border-color:#f1f5f9;text-align:center">' + (d.items_count || 0) + '</td>' +
            '<td style="border-color:#f1f5f9;text-align:center">' + (Number(d.items_cantidad) || 0) + '</td>' +
            '<td style="border-color:#f1f5f9;text-align:right;font-weight:700;color:#dc2626">' + devMoney(d.total_devuelto) + '</td>' +
            '<td style="border-color:#f1f5f9">' + badgeEstadoDevolucion(d.estado) + '</td>' +
            '<td class="text-center" style="border-color:#f1f5f9"><div style="display:inline-flex;gap:4px">' +
            '<button class="btn-custom-action" style="background:#eff6ff;color:#2563eb;padding:5px 10px;font-size:0.75rem;border:1px solid #bfdbfe" title="Ver detalle" onclick="verDetalleDevolucion(' + d.id_devolucion + ')"><i class="bi bi-eye"></i></button>' +
            '<button class="btn-custom-action" style="background:#0f172a;color:#f8fafc;padding:5px 10px;font-size:0.75rem;border:1px solid #0f172a" title="Cambiar estado" onclick="abrirModalCambiarEstadoDevolucion(' + d.id_devolucion + ')"><i class="bi bi-arrow-repeat"></i></button>' +
            '</div></td></tr>';
    });
    html += '</tbody></table></div>';
    return html;
}

// ============ MODAL RELACIÓN PRODUCTO-PROVEEDOR (compartido) ============
var relacionProveedorContexto = null;
var modalRelacionBS = null;

function htmlModalRelacionProductoProveedor() {
    return '<div class="modal fade" id="modalRelacionProveedorProducto" tabindex="-1" aria-hidden="true">' +
        '<div class="modal-dialog modal-dialog-centered">' +
        '<div class="modal-content">' +
        '<div class="modal-header"><h5 class="modal-title"><i class="bi bi-link-45deg me-2"></i>Asociar Producto a Proveedor</h5><button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div>' +
        '<div class="modal-body" style="background:#f8fafc">' +
        '<div id="contenedorAlertasRelacion"></div>' +
        '<input type="hidden" id="relInputId">' +
        '<div class="row g-3 mb-3">' +
        '<div class="col-md-6"><div id="relGrupoProveedor"><label class="form-label" style="font-weight:600;color:#334155;font-size:0.85rem">Proveedor *</label><select id="relSelectProveedor" class="form-select" style="border-radius:10px;border:1px solid #e2e8f0"></select></div></div>' +
        '<div class="col-md-6"><div id="relGrupoProducto"><label class="form-label" style="font-weight:600;color:#334155;font-size:0.85rem">Producto *</label><select id="relSelectProducto" class="form-select" style="border-radius:10px;border:1px solid #e2e8f0"></select></div></div>' +
        '</div>' +
        '<div class="row g-3 mb-3">' +
        '<div class="col-md-4"><label class="form-label" style="font-weight:600;color:#334155;font-size:0.85rem">Precio de Compra ($)</label><input type="number" class="form-control" style="border-radius:10px;border:1px solid #e2e8f0" id="relInputPrecio" min="0" step="50"></div>' +
        '<div class="col-md-4"><label class="form-label" style="font-weight:600;color:#334155;font-size:0.85rem">Referencia / Código</label><input type="text" class="form-control" style="border-radius:10px;border:1px solid #e2e8f0" id="relInputReferencia" placeholder="Código del proveedor"></div>' +
        '<div class="col-md-4"><label class="form-label" style="font-weight:600;color:#334155;font-size:0.85rem">Tiempo de Entrega (días)</label><input type="number" class="form-control" style="border-radius:10px;border:1px solid #e2e8f0" id="relInputTiempo" min="0"></div>' +
        '</div>' +
        '<div class="mb-3" style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px">' +
        '<input type="checkbox" class="form-check-input" id="relCheckPreferido" style="width:1.2em;height:1.2em">' +
        '<label for="relCheckPreferido" style="font-weight:600;color:#92400e;font-size:0.85rem;margin:0">Proveedor preferido para este producto</label>' +
        '</div>' +
        '</div>' +
        '<div class="modal-footer" style="border-top:1px solid #e2e8f0;background:#fff">' +
        '<button type="button" class="btn btn-light" style="border-radius:8px;font-weight:600" data-bs-dismiss="modal">Cancelar</button>' +
        '<button type="button" class="btn-custom-action btn-pedir" style="width:auto;padding:10px 22px" onclick="guardarRelacionProductoProveedor()"><i class="bi bi-check-lg me-1"></i> Guardar</button>' +
        '</div>' +
        '</div></div></div>';
}

function abrirModalRelacionProductoProveedor(opts) {
    if (!htmlModalRelacionProductoProveedor) return;
    if (!document.getElementById('modalRelacionProveedorProducto')) {
        var tmp = document.createElement('div');
        tmp.innerHTML = htmlModalRelacionProductoProveedor();
        document.body.appendChild(tmp);
    }
    opts = opts || {};
    relacionProveedorContexto = { modo: opts.id_relacion ? 'editar' : 'crear', id_relacion: opts.id_relacion ? Number(opts.id_relacion) : null, fijar_producto: !!opts.fijar_producto };
    document.getElementById('contenedorAlertasRelacion').innerHTML = '';
    document.getElementById('relInputId').value = opts.id_relacion || '';
    document.getElementById('relInputPrecio').value = '';
    document.getElementById('relInputReferencia').value = '';
    document.getElementById('relInputTiempo').value = '';
    document.getElementById('relCheckPreferido').checked = false;

    // Rellena proveedores (para el modo "desde producto" sobre todo)
    var selProv = document.getElementById('relSelectProveedor');
    var provs = (typeof proveedoresGlobal !== 'undefined' && proveedoresGlobal.length) ? proveedoresGlobal : [];
    var htmlProv = '<option value="">Seleccionar proveedor...</option>';
    provs.forEach(function(p) {
        htmlProv += '<option value="' + p.id_proveedor + '">' + esc(p.nombre) + '</option>';
    });
    selProv.innerHTML = htmlProv;
    if (opts.id_proveedor) selProv.value = String(opts.id_proveedor);
    if (!selProv.value) {
        fetch(API_BASE + '/api/proveedores')
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (data.success && data.proveedores) {
                    proveedoresGlobal = data.proveedores;
                    var h = '<option value="">Seleccionar proveedor...</option>';
                    data.proveedores.forEach(function(p) { h += '<option value="' + p.id_proveedor + '">' + esc(p.nombre) + '</option>'; });
                    var s = document.getElementById('relSelectProveedor');
                    if (s) { s.innerHTML = h; if (opts.id_proveedor) s.value = String(opts.id_proveedor); }
                }
            }).catch(function() {});
    }

    var grupoProv = document.getElementById('relGrupoProveedor');
    var grupoProd = document.getElementById('relGrupoProducto');
    if (relacionProveedorContexto.modo === 'editar') {
        grupoProd.style.display = 'none';
        var fila = findRelacionEnTabla(opts.id_relacion);
        if (fila) {
            document.getElementById('relInputPrecio').value = fila.precio_compra;
            document.getElementById('relInputReferencia').value = fila.referencia_proveedor || '';
            document.getElementById('relInputTiempo').value = (fila.tiempo_entrega != null ? fila.tiempo_entrega : '');
            document.getElementById('relCheckPreferido').checked = Number(fila.es_preferido) === 1;
            if (!relacionProveedorContexto.id_proveedor) relacionProveedorContexto.id_proveedor = fila.id_proveedor;
        }
        abrirModalRelacionMostrar();
        return;
    }

    // Modo crear
    grupoProd.style.display = '';
    if (opts.id_proveedor && !selProv.value) {
        // esperar el fetch que ya corre
    }
    cargarRelacionProductosDisponibles(opts);
    if (opts.id_producto) relacionProveedorContexto.id_producto = Number(opts.id_producto);
    abrirModalRelacionMostrar();
}

function findRelacionEnTabla(idRelacion) {
    var arr = (typeof proveedoresProductoTab !== 'undefined' && proveedoresProductoTab && proveedoresProductoTab.length)
        ? proveedoresProductoTab : productosProveedorTab;
    return arr.find(function(r) { return Number(r.id_relacion) === Number(idRelacion); });
}

function abrirModalRelacionMostrar() {
    if (!modalRelacionBS) modalRelacionBS = new bootstrap.Modal(document.getElementById('modalRelacionProveedorProducto'));
    modalRelacionBS.show();
}

function cargarRelacionProductosDisponibles(opts) {
    var sel = document.getElementById('relSelectProducto');
    if (!sel) return;
    sel.innerHTML = '<option value="">Cargando productos...</option>';
    var idProv = opts.id_proveedor;
    var stockTodos = [];
    fetch(API_BASE + '/api/productos/admin')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            stockTodos = (data.success && data.productos) ? data.productos : [];
            if (idProv) return fetch(API_BASE + '/api/proveedores/' + idProv + '/productos/disponibles').then(function(r) { return r.json(); });
            return null;
        })
        .catch(function() { stockTodos = []; return null; })
        .then(function(dataDisponibles) {
            if (!document.getElementById('relSelectProducto')) return;
            var html = '<option value="">Seleccionar producto...</option>';
            if (dataDisponibles && dataDisponibles.success) {
                (dataDisponibles.productos || []).forEach(function(p) {
                    var costo = Number(p.costo_actual) || 0;
                    html += '<option value="' + p.id_producto + '" data-costo="' + costo + '">' + esc(p.nombre) + ' — Stock: ' + (Number(p.stock_actual) || 0) + '</option>';
                });
            } else {
                stockTodos.forEach(function(p) {
                    var costo = Number(p.precio_costo != null ? p.precio_costo : p.costo) || 0;
                    html += '<option value="' + p.id_producto + '" data-costo="' + costo + '">' + esc(p.nombre) + ' — Stock: ' + (Number(p.stock) || 0) + '</option>';
                });
            }
            var s = document.getElementById('relSelectProducto');
            s.innerHTML = html;
            if (opts && opts.id_producto) {
                s.value = String(opts.id_producto);
                var op = s.selectedOptions && s.selectedOptions[0];
                if (op && op.dataset && op.dataset.costo) document.getElementById('relInputPrecio').value = op.dataset.costo;
                if (opts.fijar_producto) s.disabled = true;
            } else {
                s.disabled = false;
            }
        });
}

function guardarRelacionProductoProveedor() {
    if (!relacionProveedorContexto) return;
    var idRelacion = relacionProveedorContexto.id_relacion;
    var idProv = document.getElementById('relSelectProveedor') ? document.getElementById('relSelectProveedor').value : '';
    var idProd = document.getElementById('relSelectProducto') ? document.getElementById('relSelectProducto').value : '';

    if (!idRelacion && !idProv) { mostrarAlertaRelacion('warning', 'Seleccione el proveedor.'); return; }
    if (!idRelacion && !idProd) { mostrarAlertaRelacion('warning', 'Seleccione el producto.'); return; }

    var payload = {
        precio_compra: document.getElementById('relInputPrecio').value,
        referencia_proveedor: document.getElementById('relInputReferencia').value,
        tiempo_entrega: document.getElementById('relInputTiempo').value,
        es_preferido: document.getElementById('relCheckPreferido').checked
    };

    var url, method;
    if (idRelacion) { url = API_BASE + '/api/productos-proveedores/' + idRelacion; method = 'PUT'; }
    else { url = API_BASE + '/api/proveedores/' + idProv + '/productos'; method = 'POST'; payload.id_producto = Number(idProd); }

    fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.success) {
            if (modalRelacionBS) { modalRelacionBS.hide(); limpiarBackdrops(); }
            relacionProveedorContexto = null;
            recargarRelacionesEnFichas();
            if (typeof mostrarToast === 'function') mostrarToast('success', data.mensaje);
            else if (typeof mostrarAlerta === 'function') mostrarAlerta('success', data.mensaje);
        } else {
            mostrarAlertaRelacion('danger', data.mensaje || 'Error al guardar la relación');
        }
    })
    .catch(function() { mostrarAlertaRelacion('danger', 'No se pudo conectar con el servidor'); });
}

function quitarRelacionProductoProveedor(idRelacion) {
    var fila = findRelacionEnTabla(idRelacion);
    var nombre = fila ? (fila.producto_nombre || 'producto') : 'este producto';
    if (!window.confirm('¿Quitar "' + nombre + '" del proveedor?\n\nLa relación se eliminará (no afecta inventario ni historial).')) return;
    fetch(API_BASE + '/api/productos-proveedores/' + idRelacion, { method: 'DELETE' })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success) {
                recargarRelacionesEnFichas();
                if (typeof mostrarToast === 'function') mostrarToast('success', data.mensaje);
                else if (typeof mostrarAlerta === 'function') mostrarAlerta('success', data.mensaje);
            } else if (typeof mostrarAlerta === 'function') mostrarAlerta('danger', data.mensaje || 'Error al quitar la relación');
        })
        .catch(function() { if (typeof mostrarAlerta === 'function') mostrarAlerta('danger', 'No se pudo conectar con el servidor'); });
}

function mostrarAlertaRelacion(tipo, msg) {
    var c = document.getElementById('contenedorAlertasRelacion');
    if (!c) return;
    c.innerHTML = '<div class="alert alert-' + tipo + ' alert-dismissible fade show" style="font-size:0.85rem;border-radius:10px">' + msg + '<button type="button" class="btn-close" data-bs-dismiss="alert"></button></div>';
    setTimeout(function() { c.innerHTML = ''; }, 4500);
}

// ============ REFRESCO CRUZADO DE FICHAS ============
function recargarRelacionesEnFichas() {
    try {
        if (typeof fichaTabActual !== 'undefined' && fichaTabActual === 'productos' && fichaDatos) cargarProductosTabProveedor();
    } catch (e) {}
    try {
        if (typeof recargarProveedoresTabProducto === 'function') recargarProveedoresTabProducto();
    } catch (e) {}
}
window.recargarRelacionesEnFichas = recargarRelacionesEnFichas;

window.recargarDevolucionesEnFichas = function() {
    try {
        if (typeof fichaTabActual !== 'undefined' && fichaTabActual === 'devoluciones' && fichaDatos) cargarDevolucionesTabProveedor();
    } catch (e) {}
    try {
        if (typeof recargarDevolucionesTabProducto === 'function') recargarDevolucionesTabProducto();
    } catch (e) {}
};

function htmlTabInformacion() {
    var p = fichaDatos.proveedor;
    var etiquetaDias = p.dias_credito > 0 ? (p.dias_credito + ' días') : 'Contado';

    return '<div class="row g-4 mb-4">' +
        '<div class="col-md-6"><div style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">' +
        '<div style="padding:12px 16px;background:#eff6ff;color:#1d4ed8;font-weight:700;font-size:0.82rem;display:flex;align-items:center;gap:8px"><i class="bi bi-person-badge"></i> Datos Comerciales y Fiscales</div>' +
        '<div style="padding:16px 18px;background:#fff">' +
        itemInfo('Nombre comercial', p.nombre) +
        itemInfo('Razón social', (p.razon_social || p.nombre)) +
        itemInfo('NIT / RUC', p.nit || 'No registrado') +
        itemInfo('Categoría', badgeCategoria(p.categoria)) +
        itemInfo('Estado', badgeProveedorEstado(p.activo)) +
        '</div></div></div>' +
        '<div class="col-md-6"><div style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">' +
        '<div style="padding:12px 16px;background:#eff6ff;color:#1d4ed8;font-weight:700;font-size:0.82rem;display:flex;align-items:center;gap:8px"><i class="bi bi-telephone"></i> Datos de Contacto</div>' +
        '<div style="padding:16px 18px;background:#fff">' +
        itemInfo('Persona de contacto', p.contacto || 'No registrado') +
        itemInfo('Teléfono', p.telefono || 'No registrado') +
        itemInfo('Correo', p.correo || 'No registrado') +
        itemInfo('Dirección', p.direccion || 'No registrada') +
        '</div></div></div>' +
        '<div class="col-md-6"><div style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">' +
        '<div style="padding:12px 16px;background:#fffbeb;color:#92400e;font-weight:700;font-size:0.82rem;display:flex;align-items:center;gap:8px"><i class="bi bi-clock-history"></i> Condiciones Comerciales</div>' +
        '<div style="padding:16px 18px;background:#fff">' +
        itemInfo('Términos de pago', etiquetaDias) +
        itemInfo('Límite de crédito', p.limite_credito > 0 ? fmtMoney(p.limite_credito) : 'No definido') +
        itemInfo('Saldo pendiente', '<span style="color:#dc2626;font-weight:700">' + fmtMoney(fichaDatos.total_pendiente) + '</span>') +
        '</div></div></div>' +
        '<div class="col-md-6"><div style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">' +
        '<div style="padding:12px 16px;background:#ecfdf5;color:#15803d;font-weight:700;font-size:0.82rem;display:flex;align-items:center;gap:8px"><i class="bi bi-bank"></i> Datos de Facturación / Pagos</div>' +
        '<div style="padding:16px 18px;background:#fff">' +
        itemInfo('Banco', p.banco || 'No registrado') +
        itemInfo('Tipo de cuenta', p.tipo_cuenta || 'No registrado') +
        itemInfo('Número de cuenta', p.numero_cuenta || 'No registrado') +
        '</div></div></div>' +
        '</div>';
}

function itemInfo(label, valorHtml) {
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px dashed #f1f5f9">' +
        '<span style="color:#64748b;font-size:0.82rem;font-weight:600">' + esc(label) + '</span>' +
        '<span style="color:#0f172a;font-weight:600;font-size:0.85rem;text-align:right;max-width:60%">' + valorHtml + '</span>' +
        '</div>';
}

function htmlTabFacturas() {
    var todas = fichaDatos.compras || [];
    var compras = todas.filter(function(c) { return enRangoProv(c.fecha); });
    var filtrando = !!(fichaFiltroDesde || fichaFiltroHasta);
    if (compras.length === 0) {
        return htmlFiltroFechasFicha() + '<div class="text-center py-5" style="color:#94a3b8"><i class="bi bi-receipt" style="font-size:2rem;display:block;margin-bottom:8px"></i>' + (filtrando ? 'No hay facturas en el rango de fechas.' : 'No hay facturas de compra registradas para este proveedor.') + '</div>';
    }

    var html = htmlFiltroFechasFicha() +
        '<div style="font-size:.78rem;color:#64748b;margin-bottom:8px">' + compras.length + ' factura(s)' + (filtrando ? ' en el rango' : '') + '</div>' +
        '<div class="table-responsive"><table class="table table-hover mb-0 align-middle" style="margin:0">' +
        '<thead style="background:#f8fafc"><tr>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem">Factura</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem">Fecha</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem">N. Factura</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem;text-align:center">Forma Pago</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem;text-align:right">Total</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem;text-align:right">Saldo</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem">Vencimiento</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem">Estado</th>' +
        '<th class="text-center" style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem">Detalle</th></tr></thead><tbody>';

    compras.forEach(function(c) {
        var venc = c.fecha_vencimiento || c.fecha;
        var badgeForma = c.forma_pago === 'Credito'
            ? '<span style="background:#fef3c7;color:#92400e;padding:3px 10px;border-radius:8px;font-size:0.72rem;font-weight:700">Crédito</span>'
            : '<span style="background:#ecfdf5;color:#15803d;padding:3px 10px;border-radius:8px;font-size:0.72rem;font-weight:700">Contado</span>';
        html += '<tr style="border-color:#f1f5f9">' +
            '<td style="border-color:#f1f5f9;font-weight:700;color:#0f172a">#' + c.id_compra + '</td>' +
            '<td style="border-color:#f1f5f9;color:#64748b;font-size:0.82rem">' + fmtFecha(c.fecha) + '</td>' +
            '<td style="border-color:#f1f5f9;color:#334155;font-weight:600">' + esc(c.numero_factura || '-') + '</td>' +
            '<td style="border-color:#f1f5f9;text-align:center">' + badgeForma + '</td>' +
            '<td style="border-color:#f1f5f9;text-align:right;font-weight:700;color:#10b981">' + fmtMoney(c.total) + '</td>' +
            '<td style="border-color:#f1f5f9;text-align:right;font-weight:700;color:' + (Number(c.saldo_pendiente) > 0 ? '#dc2626' : '#94a3b8') + '">' + fmtMoney(c.saldo_pendiente) + '</td>' +
            '<td style="border-color:#f1f5f9">' + badgeDiasVencimiento(c) + '</td>' +
            '<td style="border-color:#f1f5f9">' + badgeEstadoCompra(c.estado, c.saldo_pendiente) + '</td>' +
            '<td class="text-center" style="border-color:#f1f5f9"><button class="btn-custom-action" style="background:#eff6ff;color:#2563eb;padding:5px 10px;font-size:0.75rem;border:1px solid #bfdbfe" onclick="verFacturaDetalle(' + c.id_compra + ')"><i class="bi bi-eye me-1"></i>Ver</button></td></tr>';
    });
    html += '</tbody></table></div>';
    return html;
}

function htmlTabCuenta() {
    var pendientes = (fichaDatos.compras || []).filter(function(c) {
        return Number(c.saldo_pendiente) > 0 && c.estado !== 'Anulada' && enRangoProv(c.fecha);
    });
    var pagos = (fichaDatos.pagos || []).filter(function(p) { return enRangoProv(p.fecha_pago); });
    var idProv = fichaDatos.proveedor.id_proveedor;

    var html = htmlFiltroFechasFicha();

    // Cuentas por pagar
    html += '<div style="font-size:0.85rem;font-weight:700;color:#334155;margin-bottom:10px;display:flex;align-items:center;gap:8px"><i class="bi bi-exclamation-circle" style="color:#dc2626"></i> Cuentas por Pagar (Facturas Pendientes)</div>';
    if (pendientes.length === 0) {
        html += '<div style="padding:18px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;color:#15803d;font-weight:600;margin-bottom:24px"><i class="bi bi-check-circle me-1"></i> No hay facturas pendientes por pagar. El proveedor está al día.</div>';
    } else {
        html += '<div class="table-responsive" style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:24px"><table class="table table-hover mb-0 align-middle" style="margin:0">' +
            '<thead style="background:#fef2f2"><tr>' +
            '<th style="border-color:#fecaca;color:#991b1b;font-weight:600;font-size:0.82rem">Factura</th>' +
            '<th style="border-color:#fecaca;color:#991b1b;font-weight:600;font-size:0.82rem">N. Factura</th>' +
            '<th style="border-color:#fecaca;color:#991b1b;font-weight:600;font-size:0.82rem">F. Vencimiento</th>' +
            '<th style="border-color:#fecaca;color:#991b1b;font-weight:600;font-size:0.82rem;text-align:right">Total</th>' +
            '<th style="border-color:#fecaca;color:#991b1b;font-weight:600;font-size:0.82rem;text-align:right">Saldo</th>' +
            '<th class="text-center" style="border-color:#fecaca;color:#991b1b;font-weight:600;font-size:0.82rem">Acción</th></tr></thead><tbody>';
        pendientes.forEach(function(c) {
            html += '<tr>' +
                '<td style="border-color:#fee2e2;font-weight:700;color:#0f172a">#' + c.id_compra + '</td>' +
                '<td style="border-color:#fee2e2;color:#334155;font-weight:600">' + esc(c.numero_factura || '-') + '</td>' +
                '<td style="border-color:#fee2e2">' + badgeDiasVencimiento(c) + '</td>' +
                '<td style="border-color:#fee2e2;text-align:right;font-weight:700">' + fmtMoney(c.total) + '</td>' +
                '<td style="border-color:#fee2e2;text-align:right;font-weight:700;color:#dc2626">' + fmtMoney(c.saldo_pendiente) + '</td>' +
                '<td class="text-center" style="border-color:#fee2e2">' +
                '<div style="display:inline-flex;gap:4px">' +
                '<button class="btn-custom-action btn-pedir" style="width:auto;padding:5px 12px;font-size:0.76rem" onclick="abrirModalAbono(' + c.id_compra + ')"><i class="bi bi-cash me-1"></i>Abonar</button>' +
                '<button class="btn-custom-action" style="width:auto;padding:5px 12px;font-size:0.76rem;background:#ecfdf5;color:#15803d;border:1px solid #bbf7d0" onclick="pagarFacturaCompleta(' + c.id_compra + ')"><i class="bi bi-check-all me-1"></i>Pagar Todo</button>' +
                '</div></td></tr>';
        });
        html += '</tbody></table></div>';
    }

    // Historial de abonos
    html += '<div style="font-size:0.85rem;font-weight:700;color:#334155;margin-bottom:10px;display:flex;align-items:center;gap:8px"><i class="bi bi-clock-history" style="color:#10b981"></i> Historial de Abonos / Pagos</div>';
    if (pagos.length === 0) {
        html += '<div class="text-center py-4" style="color:#94a3b8;border:1px dashed #e2e8f0;border-radius:10px"><i class="bi bi-cash" style="font-size:1.4rem;display:block;margin-bottom:6px"></i>No se han registrado pagos a este proveedor.</div>';
    } else {
        html += '<div class="table-responsive" style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden"><table class="table table-hover mb-0 align-middle" style="margin:0">' +
            '<thead style="background:#f8fafc"><tr>' +
            '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem">Fecha</th>' +
            '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem">Factura</th>' +
            '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem;text-align:right">Monto</th>' +
            '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem">Método</th>' +
            '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem">Referencia</th>' +
            '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem">Registró</th></tr></thead><tbody>';
        pagos.forEach(function(pg) {
            html += '<tr>' +
                '<td style="border-color:#f1f5f9;color:#64748b;font-size:0.82rem">' + fmtFecha(pg.fecha_pago) + '</td>' +
                '<td style="border-color:#f1f5f9;font-weight:600;color:#0f172a">' + (pg.numero_factura ? esc(pg.numero_factura) : '#C' + pg.id_compra) + '</td>' +
                '<td style="border-color:#f1f5f9;text-align:right;font-weight:700;color:#10b981">' + fmtMoney(pg.monto) + '</td>' +
                '<td style="border-color:#f1f5f9;color:#334155">' + esc(pg.metodo_pago || '-') + '</td>' +
                '<td style="border-color:#f1f5f9;color:#64748b;font-size:0.82rem">' + esc(pg.referencia || '-') + '</td>' +
                '<td style="border-color:#f1f5f9;color:#64748b;font-size:0.82rem">' + esc(pg.usuario_nombre || '-') + '</td></tr>';
        });
        html += '</tbody></table></div>';
    }
    return html;
}

// ============ MODAL DETALLE DE FACTURA ============
function htmlModalFacturaDetalle() {
    return '<div class="modal fade" id="modalFacturaDetalle" tabindex="-1" aria-hidden="true">' +
        '<div class="modal-dialog modal-lg modal-dialog-scrollable">' +
        '<div class="modal-content">' +
        '<div class="modal-header"><h5 class="modal-title" id="tituloModalFacturaDetalle"><i class="bi bi-receipt me-2"></i>Detalle de Compra</h5><button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div>' +
        '<div class="modal-body" style="background:#f8fafc"><div id="contenidoFacturaDetalle" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div></div></div>' +
        '<div class="modal-footer" style="border-top:1px solid #e2e8f0;background:#fff">' +
        '<button type="button" class="btn btn-light" style="border-radius:8px;font-weight:600" data-bs-dismiss="modal">Cerrar</button></div>' +
        '</div></div></div>';
}

var modalFacturaDetalleBS = null;

function verFacturaDetalle(idCompra) {
    var titulo = document.getElementById('tituloModalFacturaDetalle');
    var cuerpo = document.getElementById('contenidoFacturaDetalle');
    if (titulo) titulo.innerHTML = '<i class="bi bi-receipt me-2"></i>Detalle de Compra #' + idCompra;
    if (cuerpo) cuerpo.innerHTML = '<div class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div></div>';
    if (!modalFacturaDetalleBS) modalFacturaDetalleBS = new bootstrap.Modal(document.getElementById('modalFacturaDetalle'));
    modalFacturaDetalleBS.show();

    fetch(API_BASE + '/api/compras/' + idCompra + '/detalle')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (cuerpo) cuerpo.innerHTML = renderDetalleCompraTabla(data.detalles || []);
        })
        .catch(function() {
            if (cuerpo) cuerpo.innerHTML = '<div style="padding:20px;color:#dc2626;text-align:center">No se pudo cargar el detalle</div>';
        });
}

function renderDetalleCompraTabla(detalles) {
    if (detalles.length === 0) {
        return '<div style="padding:20px;color:#94a3b8;text-align:center">Sin items en esta compra.</div>';
    }
    var html = '<div class="table-responsive"><table class="table table-sm mb-0" style="margin:0">' +
        '<thead style="background:#f1f5f9"><tr>' +
        '<th style="font-weight:600;font-size:0.82rem;border-color:#e2e8f0">Producto</th>' +
        '<th style="font-weight:600;font-size:0.82rem;border-color:#e2e8f0;text-align:center">Cant.</th>' +
        '<th style="font-weight:600;font-size:0.82rem;border-color:#e2e8f0;text-align:right">Costo Unit.</th>' +
        '<th style="font-weight:600;font-size:0.82rem;border-color:#e2e8f0;text-align:right">Subtotal</th></tr></thead><tbody>';
    detalles.forEach(function(d) {
        html += '<tr>' +
            '<td style="font-weight:600;border-color:#f1f5f9">' + esc(d.producto_nombre) + '</td>' +
            '<td style="text-align:center;border-color:#f1f5f9">' + d.cantidad + '</td>' +
            '<td style="text-align:right;border-color:#f1f5f9">' + fmtMoney(d.costo_unitario) + '</td>' +
            '<td style="text-align:right;border-color:#f1f5f9;font-weight:700;color:#10b981">' + fmtMoney(d.subtotal) + '</td></tr>';
    });
    html += '</tbody></table></div>';
    return html;
}

// ============ MODAL ABONO A PROVEEDOR ============
function htmlOptionsMetodoPago(actual) {
    var html = '<option value="">Seleccionar...</option>';
    METODOS_PAGO_PROVEEDOR.forEach(function(m) {
        html += '<option value="' + esc(m) + '"' + (m === actual ? ' selected' : '') + '>' + esc(m) + '</option>';
    });
    return html;
}

function htmlModalAbono() {
    return '<div class="modal fade" id="modalAbonoProveedor" tabindex="-1" aria-hidden="true">' +
        '<div class="modal-dialog modal-dialog-centered">' +
        '<div class="modal-content">' +
        '<div class="modal-header"><h5 class="modal-title"><i class="bi bi-cash-stack me-2"></i>Abonar a Proveedor</h5><button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div>' +
        '<div class="modal-body" style="background:#f8fafc">' +
        '<div style="padding:14px;background:#f1f5f9;border-radius:10px;margin-bottom:16px">' +
        '<div style="font-size:0.82rem;color:#64748b;margin-bottom:4px">Pago a <strong id="nombreProveedorAbono" style="color:#0f172a">-</strong> <span id="facturaAbonoEtiqueta" style="color:#64748b"></span></div>' +
        '<div style="font-size:1.5rem;font-weight:800;color:#ef4444" id="saldoAbonoProveedor">$0</div>' +
        '</div>' +
        '<div class="row g-3 mb-3">' +
        '<div class="col-6"><label class="form-label" style="font-weight:600;color:#334155;font-size:0.85rem">Monto a Abonar ($)</label><input type="number" class="form-control" style="border-radius:10px;border:1px solid #e2e8f0" id="inputMontoAbono" min="1" step="100"></div>' +
        '<div class="col-6"><label class="form-label" style="font-weight:600;color:#334155;font-size:0.85rem">Método de Pago</label><select class="form-select" style="border-radius:10px;border:1px solid #e2e8f0" id="selectMetodoPagoAbono"></select></div>' +
        '</div>' +
        '<div class="mb-3"><label class="form-label" style="font-weight:600;color:#334155;font-size:0.85rem">Referencia / Comprobante</label><input type="text" class="form-control" style="border-radius:10px;border:1px solid #e2e8f0" id="inputReferenciaAbono" placeholder="Nro. transferencia, cheque, etc."></div>' +
        '<div class="mb-3"><label class="form-label" style="font-weight:600;color:#334155;font-size:0.85rem">Observaciones</label><input type="text" class="form-control" style="border-radius:10px;border:1px solid #e2e8f0" id="inputObsAbono"></div>' +
        '<div id="contenedorAlertasAbono"></div>' +
        '</div>' +
        '<div class="modal-footer" style="border-top:1px solid #e2e8f0;background:#fff">' +
        '<button type="button" class="btn btn-light" style="border-radius:8px;font-weight:600" data-bs-dismiss="modal">Cancelar</button>' +
        '<button type="button" class="btn btn-sm me-2" style="background:#ecfdf5;color:#15803d;border:1px solid #bbf7d0;border-radius:8px;font-weight:600;padding:8px 14px" onclick="pagarFacturaCompleta()"><i class="bi bi-check-all me-1"></i> Liquidar Todo</button>' +
        '<button type="button" class="btn-custom-action btn-pedir" onclick="procesarAbonoProveedor()"><i class="bi bi-cash me-1"></i> Abonar</button>' +
        '</div></div></div></div>';
}

var modalAbonoProveedorBS = null;

function abrirModalAbono(idCompra) {
    if (!fichaDatos) return;
    idCompra = Number(idCompra);
    var compra = (fichaDatos.compras || []).find(function(c) { return Number(c.id_compra) === idCompra; });
    if (!compra) {
        mostrarAlertaFicha('danger', 'Factura no encontrada.');
        return;
    }
    abonoContexto = {
        id_compra: idCompra,
        factura: compra.numero_factura || ('#' + compra.id_compra),
        saldo: Number(compra.saldo_pendiente)
    };

    var prov = fichaDatos.proveedor || {};
    if (!prov.nombre) return;
    document.getElementById('nombreProveedorAbono').textContent = prov.nombre;
    document.getElementById('facturaAbonoEtiqueta').textContent = abonoContexto.factura ? ('- Factura ' + abonoContexto.factura) : '';
    document.getElementById('saldoAbonoProveedor').textContent = fmtMoney(abonoContexto.saldo);
    document.getElementById('inputMontoAbono').value = '';
    document.getElementById('inputMontoAbono').max = abonoContexto.saldo;
    document.getElementById('inputReferenciaAbono').value = '';
    document.getElementById('inputObsAbono').value = '';
    document.getElementById('selectMetodoPagoAbono').innerHTML = htmlOptionsMetodoPago();
    document.getElementById('contenedorAlertasAbono').innerHTML = '';

    if (!modalAbonoProveedorBS) modalAbonoProveedorBS = new bootstrap.Modal(document.getElementById('modalAbonoProveedor'));
    modalAbonoProveedorBS.show();
}

function pagarFacturaCompleta(idCompra) {
    if (idCompra !== undefined) {
        abrirModalAbono(idCompra);
        if (!abonoContexto) return;
        document.getElementById('inputMontoAbono').value = abonoContexto.saldo;
        procesarAbonoProveedor();
        return;
    }
    if (!abonoContexto) return;
    document.getElementById('inputMontoAbono').value = abonoContexto.saldo;
    procesarAbonoProveedor();
}

function procesarAbonoProveedor() {
    if (!abonoContexto || !fichaDatos) return;
    var monto = document.getElementById('inputMontoAbono').value;
    if (!monto || Number(monto) <= 0) {
        mostrarAlertaModalAbono('warning', 'Ingrese un monto válido.');
        return;
    }
    if (Number(monto) > Number(abonoContexto.saldo)) {
        mostrarAlertaModalAbono('warning', 'El abono no puede superar el saldo pendiente (' + fmtMoney(abonoContexto.saldo) + ').');
        return;
    }

    var prov = fichaDatos.proveedor;
    var payload = {
        id_compra: abonoContexto.id_compra,
        monto: Number(monto),
        metodo_pago: document.getElementById('selectMetodoPagoAbono').value,
        referencia: document.getElementById('inputReferenciaAbono').value.trim(),
        observaciones: document.getElementById('inputObsAbono').value.trim(),
        id_usuario: usuario ? usuario.id_usuario : null
    };

    fetch(API_BASE + '/api/proveedores/' + prov.id_proveedor + '/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.success) {
            if (modalAbonoProveedorBS) {
                modalAbonoProveedorBS.hide();
                limpiarBackdrops();
            }
            mostrarAlertaFicha('success', 'Pago de ' + fmtMoney(monto) + ' registrado a ' + esc(prov.nombre) + '.');
            var id = prov.id_proveedor;
            abonoContexto = null;
            verFichaProveedor(id);
        } else {
            mostrarAlertaModalAbono('danger', data.mensaje || 'Error al registrar el pago');
        }
    })
    .catch(function() {
        mostrarAlertaModalAbono('danger', 'No se pudo conectar con el servidor');
    });
}

function mostrarAlertaModalAbono(tipo, msg) {
    var c = document.getElementById('contenedorAlertasAbono');
    if (!c) return;
    c.innerHTML = '<div class="alert alert-' + tipo + ' alert-dismissible fade show" style="font-size:0.85rem;border-radius:10px">' + msg + '<button type="button" class="btn-close" data-bs-dismiss="alert"></button></div>';
    setTimeout(function() { c.innerHTML = ''; }, 4000);
}

function mostrarAlertaFicha(tipo, msg) {
    alertaFichaPendiente = { tipo: tipo, msg: msg };
}