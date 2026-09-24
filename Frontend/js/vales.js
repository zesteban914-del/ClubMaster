// =========================================================
// CONTROLADOR: CARTERA / CUENTAS POR COBRAR / VALES VIP / MORA
// + DIRECTORIO DE CLIENTES / SOCIOS VIP  (DARK THEME)
// =========================================================

var valeSeleccionado = null;
var socioSeleccionado = null;
var catalogoSocios = [];
var catalogoMetodosPago = null;
var sociosCache = [];
function valesEsc(s) { return typeof escapeHTML !== 'undefined' ? escapeHTML(s) : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

// =========================================================
// SOCIOS VIP - DIRECTORIO
// =========================================================
function iniciarSocios() {
    if(typeof verificarAcceso==='function'&&!verificarAcceso('ver_caja')){if(typeof verificarAccesoRB==='function'&&!verificarAccesoRB('ver_caja'))return;return;}
    if(typeof verificarAccesoRB==='function'&&!verificarAccesoRB('ver_caja'))return;
    activarNav('navSocios');
    var contenedor = document.getElementById('main-content');
    contenedor.innerHTML =
        '<div class="dk-page-header">' +
        '<h2><i class="bi bi-person-vcard"></i>Clientes / Socios VIP</h2>' +
        '<div class="page-header-right">' +
        '<button class="btn-refresh" style="background:#1e293b;border:1px solid #334155;color:#cbd5e1" data-action="vales-socios-refresh"><i class="bi bi-arrow-clockwise"></i> Actualizar</button>' +
        '<button class="dk-btn dk-btn-blue" style="width:auto;padding:8px 18px" data-action="vales-socio-nuevo"><i class="bi bi-plus-circle me-1"></i> Nuevo Socio</button>' +
        '</div></div>' +
        '<div id="contenedorAlertas"></div>' +

        '<div class="row g-4 mb-4">' +
        '<div class="col-md-4"><div class="dk-kpi-card dk-kpi-blue"><div class="dk-kpi-top"><div class="dk-kpi-label">Socios VIP</div><div class="dk-kpi-icon dk-icon-blue"><i class="bi bi-person-vcard"></i></div></div><div class="dk-kpi-value" id="kpiTotalSocios">0</div><div class="dk-kpi-sub">clientes registrados</div></div></div>' +
        '<div class="col-md-4"><div class="dk-kpi-card dk-kpi-green"><div class="dk-kpi-top"><div class="dk-kpi-label">Con Deuda</div><div class="dk-kpi-icon dk-icon-green"><i class="bi bi-wallet2"></i></div></div><div class="dk-kpi-value" id="kpiSociosDeuda2">0</div><div class="dk-kpi-sub">con vales activos</div></div></div>' +
        '<div class="col-md-4"><div class="dk-kpi-card dk-kpi-amber"><div class="dk-kpi-top"><div class="dk-kpi-label">Deuda Total</div><div class="dk-kpi-icon dk-icon-amber"><i class="bi bi-currency-dollar"></i></div></div><div class="dk-kpi-value" id="kpiDeudaTotal">$0</div><div class="dk-kpi-sub">capital pendiente</div></div></div>' +
        '</div>' +

        '<div class="dk-card"><div class="dk-card-header"><i class="bi bi-list-check"></i> Directorio de Socios</div><div class="dk-card-body"><div id="contenedorTablaSocios" class="text-center py-4"><div class="spinner-border text-primary"></div></div></div></div>' +

        // Modal socio
        '<div class="modal fade" id="modalSocio" tabindex="-1" aria-hidden="true">' +
        '<div class="modal-dialog modal-dialog-centered modal-lg"><div class="modal-content inv-modal-content">' +
        '<div class="inv-modal-header"><h5 class="inv-modal-title"><i class="bi bi-person-vcard"></i><span id="tituloModalSocio">Nuevo Socio</span></h5><button type="button" class="inv-modal-close" data-bs-dismiss="modal">×</button></div>' +
        '<div class="inv-modal-body"><form id="formSocio">' +
        '<div class="row g-3">' +
        '<div class="col-md-6"><div class="inv-field"><label class="inv-field-label">Nombre completo *</label><input class="inv-input" id="sNombre" required></div></div>' +
        '<div class="col-md-6"><div class="inv-field"><label class="inv-field-label">Teléfono</label><input class="inv-input" id="sTelefono"></div></div>' +
        '<div class="col-md-4"><div class="inv-field"><label class="inv-field-label">Tipo documento</label><select class="inv-input" id="sTipoDoc"><option>CC</option><option>CE</option><option>Pasaporte</option><option>NIT</option></select></div></div>' +
        '<div class="col-md-4"><div class="inv-field"><label class="inv-field-label">N° documento</label><input class="inv-input" id="sDocumento"></div></div>' +
        '<div class="col-md-4"><div class="inv-field"><label class="inv-field-label">Límite de crédito ($)</label><input type="number" class="inv-input" id="sLimite" min="0" step="1000"></div></div>' +
        '<div class="col-md-6"><div class="inv-field"><label class="inv-field-label">Correo</label><input class="inv-input" id="sCorreo"></div></div>' +
        '<div class="col-md-6"><div class="inv-field"><label class="inv-field-label">Cliente VIP</label><select class="inv-input" id="sEsVip"><option value="1">Sí</option><option value="0">No</option></select></div></div>' +
        '<div class="col-12"><div class="inv-field"><label class="inv-field-label">Observaciones</label><input class="inv-input" id="sObservaciones"></div></div>' +
        '</div></form></div>' +
        '<div class="inv-modal-footer"><button class="inv-btn-cancelar" data-bs-dismiss="modal">Cancelar</button><button class="inv-btn-guardar" data-action="vales-socio-guardar"><i class="bi bi-check-lg me-1"></i> Guardar</button></div>' +
        '</div></div></div>';
    cargarSocios();
}

function abrirModalSocio() {
    socioSeleccionado = null;
    document.getElementById('tituloModalSocio').textContent = 'Nuevo Socio';
    document.getElementById('formSocio').reset();
    document.getElementById('sLimite').value = 0;
    document.getElementById('sEsVip').value = '1';
    new bootstrap.Modal(document.getElementById('modalSocio')).show();
}

function abrirModalEditarSocio(s) {
    if (typeof s === 'number' || (typeof s === 'string' && s !== '' && !isNaN(Number(s)))) {
        var _id = Number(s);
        var _f = (sociosCache || []).filter(function(x) { return Number(x.id_cliente) === _id; });
        if (_f.length) s = _f[0];
        else { var _f2 = (catalogoSocios || []).filter(function(x) { return Number(x.id_cliente) === _id; }); if (_f2.length) s = _f2[0]; else return; }
    }
    socioSeleccionado = s;
    document.getElementById('tituloModalSocio').textContent = 'Editar Socio';
    document.getElementById('sNombre').value = s.nombre;
    document.getElementById('sTelefono').value = s.telefono || '';
    document.getElementById('sTipoDoc').value = s.tipo_documento || 'CC';
    document.getElementById('sDocumento').value = s.documento || '';
    document.getElementById('sLimite').value = s.limite_credito || 0;
    document.getElementById('sCorreo').value = s.correo || '';
    document.getElementById('sEsVip').value = s.es_vip ? '1' : '0';
    document.getElementById('sObservaciones').value = s.observaciones || '';
    new bootstrap.Modal(document.getElementById('modalSocio')).show();
}

function guardarSocio() {
    var nombre = document.getElementById('sNombre').value.trim();
    if (!nombre) { mostrarAlerta('warning', 'El nombre es obligatorio.'); return; }
    var payload = {
        nombre: nombre,
        telefono: document.getElementById('sTelefono').value.trim(),
        tipo_documento: document.getElementById('sTipoDoc').value,
        documento: document.getElementById('sDocumento').value.trim(),
        limite_credito: Number(document.getElementById('sLimite').value) || 0,
        correo: document.getElementById('sCorreo').value.trim(),
        es_vip: document.getElementById('sEsVip').value === '1',
        observaciones: document.getElementById('sObservaciones').value.trim()
    };
    var url = API_BASE + (socioSeleccionado ? '/api/socios/' + socioSeleccionado.id_cliente : '/api/socios');
    var metodo = socioSeleccionado ? 'PUT' : 'POST';
    fetch(url, { method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.success) {
            bootstrap.Modal.getInstance(document.getElementById('modalSocio')).hide();
            mostrarAlerta('success', data.mensaje);
            cargarSocios();
            cargarSociosCatalogo();
        } else mostrarAlerta('danger', data.mensaje || 'Error');
    })
    .catch(function() { mostrarAlerta('danger', 'No se pudo conectar con el servidor'); });
}

function toggleSocio(id, activo, btn) {
    id = Number(id);
    activo = (activo === true || activo === '1' || activo === 1);
    fetch(API_BASE + '/api/socios/' + id + '/estado', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activo: activo })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.success) { mostrarAlerta('success', data.mensaje); cargarSocios(); cargarSociosCatalogo(); }
        else mostrarAlerta('danger', data.mensaje);
    });
}

function cargarSociosCatalogo() {
    fetch(API_BASE + '/api/socios')
        .then(function(r) { return r.json(); })
        .then(function(data) { if (data.success) catalogoSocios = data.socios.filter(function(s) { return s.activo; }); })
        .catch(function() {});
}

function cargarSocios() {
    var cont = document.getElementById('contenedorTablaSocios');
    if (!cont) return;
    cont.innerHTML = '<div class="spinner-border spinner-border-sm text-primary"></div>';
    fetch(API_BASE + '/api/socios')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success) {
                renderizarTablaSocios(data.socios);
                catalogoSocios = data.socios.filter(function(s) { return s.activo; });
            } else cont.innerHTML = '<div style="padding:20px;color:#f87171">' + valesEsc(data.mensaje || 'Error') + '</div>';
        })
        .catch(function() { cont.innerHTML = '<div style="padding:20px;color:#f87171">No se pudo conectar con el servidor</div>'; });
}

function renderizarTablaSocios(socios) {
    sociosCache = socios || [];
    var cont = document.getElementById('contenedorTablaSocios');
    document.getElementById('kpiTotalSocios').textContent = socios.length;
    var conDeuda = socios.filter(function(s) { return Number(s.deuda_actual) > 0; });
    document.getElementById('kpiSociosDeuda2').textContent = conDeuda.length;
    document.getElementById('kpiDeudaTotal').textContent = '$' + conDeuda.reduce(function(a, s) { return a + Number(s.deuda_actual); }, 0).toLocaleString();

    if (socios.length === 0) {
        cont.innerHTML = '<div style="padding:24px;color:#64748b;text-align:center"><i class="bi bi-person-x" style="font-size:2rem;display:block;margin-bottom:8px"></i>No hay socios registrados.</div>';
        return;
    }
    var html = '<div class="table-responsive"><table class="dk-table mb-0"><thead><tr>' +
        '<th>ID</th><th>Nombre</th><th>Teléfono</th><th>Documento</th><th>Crédito</th><th>Deuda</th><th>Vales</th><th>Estado</th><th class="t-center">Acciones</th>' +
        '</tr></thead><tbody>';
    socios.forEach(function(s) {
        var vipBadge = s.es_vip ? '<span class="dk-badge dk-badge-blue">VIP</span>' : '<span class="dk-badge dk-badge-gray">Regular</span>';
        var actBadge = s.activo ? '<span class="dk-badge dk-badge-green">Activo</span>' : '<span class="dk-badge dk-badge-red">Inactivo</span>';
        html += '<tr>' +
            '<td class="t-num">#' + Number(s.id_cliente) + '</td>' +
            '<td><div class="t-strong">' + valesEsc(s.nombre || '') + '</div>' + vipBadge + '</td>' +
            '<td class="t-muted">' + valesEsc(s.telefono || '-') + '</td>' +
            '<td class="t-muted">' + (s.documento ? (valesEsc(s.tipo_documento) + ' ' + valesEsc(s.documento)) : '-') + '</td>' +
            '<td class="t-muted">$' + Number(s.limite_credito || 0).toLocaleString() + '</td>' +
            '<td class="t-money-red">$' + Number(s.deuda_actual || 0).toLocaleString() + '</td>' +
            '<td class="t-center">' + Number(s.vales_activos || 0) + '</td>' +
            '<td>' + actBadge + '</td>' +
            '<td class="t-center"><div style="display:flex;gap:4px;justify-content:center">' +
            '<button class="dk-btn dk-btn-ghost" style="padding:5px 8px" data-action="vales-socio-editar" data-id="' + Number(s.id_cliente) + '"><i class="bi bi-pencil"></i></button>' +
            (s.activo
                ? '<button class="dk-btn dk-btn-red" style="padding:5px 8px" data-action="vales-socio-toggle" data-id="' + Number(s.id_cliente) + '" data-activo="0"><i class="bi bi-person-x"></i></button>'
                : '<button class="dk-btn dk-btn-green" style="padding:5px 8px" data-action="vales-socio-toggle" data-id="' + Number(s.id_cliente) + '" data-activo="1"><i class="bi bi-person-check"></i></button>') +
            '</div></td></tr>';
    });
    html += '</tbody></table></div>';
    cont.innerHTML = html;
}

// =========================================================
// CARTERA / CUENTAS POR COBRAR - DASHBOARD (DARK)
// =========================================================
function iniciarVales() {
    if(typeof verificarAcceso==='function'&&!verificarAcceso('ver_caja')){if(typeof verificarAccesoRB==='function'&&!verificarAccesoRB('ver_caja'))return;return;}
    if(typeof verificarAccesoRB==='function'&&!verificarAccesoRB('ver_caja'))return;
    activarNav('navVales');
    var contenedor = document.getElementById('main-content');
    contenedor.innerHTML =
        '<div class="dk-page-header">' +
        '<h2><i class="bi bi-wallet2"></i>Cartera / Cuentas por Cobrar</h2>' +
        '<div class="page-header-right">' +
        '<button class="btn-refresh" style="background:#1e293b;border:1px solid #334155;color:#cbd5e1" data-action="vales-refresh"><i class="bi bi-arrow-clockwise"></i> Actualizar</button>' +
        '<button class="dk-btn dk-btn-blue" style="width:auto;padding:8px 18px" data-action="vales-nuevo"><i class="bi bi-plus-circle me-1"></i> Nuevo Vale</button>' +
        '</div></div>' +
        '<div id="contenedorAlertas"></div>' +

        '<div class="row g-4 mb-4">' +
        '<div class="col-md-3"><div class="dk-kpi-card dk-kpi-red"><div class="dk-kpi-top"><div class="dk-kpi-label">Total Pendiente</div><div class="dk-kpi-icon dk-icon-red"><i class="bi bi-exclamation-circle"></i></div></div><div class="dk-kpi-value" id="kpiTotalPendiente">$0</div><div class="dk-kpi-sub">capital + mora</div></div></div>' +
        '<div class="col-md-3"><div class="dk-kpi-card dk-kpi-amber"><div class="dk-kpi-top"><div class="dk-kpi-label">Vales Vencidos</div><div class="dk-kpi-icon dk-icon-amber"><i class="bi bi-clock-history"></i></div></div><div class="dk-kpi-value" id="kpiValesVencidos">0</div><div class="dk-kpi-sub">cuentas en mora</div></div></div>' +
        '<div class="col-md-3"><div class="dk-kpi-card dk-kpi-blue"><div class="dk-kpi-top"><div class="dk-kpi-label">Vales Activos</div><div class="dk-kpi-icon dk-icon-blue"><i class="bi bi-file-earmark-text"></i></div></div><div class="dk-kpi-value" id="kpiValesActivos">0</div><div class="dk-kpi-sub">cuentas abiertas</div></div></div>' +
        '<div class="col-md-3"><div class="dk-kpi-card dk-kpi-green"><div class="dk-kpi-top"><div class="dk-kpi-label">Mora Pendiente</div><div class="dk-kpi-icon dk-icon-green"><i class="bi bi-percent"></i></div></div><div class="dk-kpi-value" id="kpiMoraPendiente">$0</div><div class="dk-kpi-sub">intereses por vencer</div></div></div>' +
        '</div>' +

        '<div class="dk-card"><div class="dk-card-header"><i class="bi bi-list-check"></i> Vales Pendientes</div>' +
        '<div class="dk-card-body"><div id="contenedorTablaVales" class="text-center py-4"><div class="spinner-border text-primary"></div></div></div></div>' +

        // Modal nuevo vale
        '<div class="modal fade" id="modalNuevoVale" tabindex="-1" aria-hidden="true">' +
        '<div class="modal-dialog modal-dialog-centered modal-lg"><div class="modal-content inv-modal-content">' +
        '<div class="inv-modal-header"><h5 class="inv-modal-title"><i class="bi bi-wallet2"></i>Nuevo Vale / Crédito</h5><button type="button" class="inv-modal-close" data-bs-dismiss="modal">×</button></div>' +
        '<div class="inv-modal-body"><form id="formNuevoVale">' +
        '<div class="mb-3"><label class="inv-field-label">Socio / Cliente *</label>' +
        '<div class="d-flex gap-2"><select class="inv-input" id="selectSocioVale" data-change="vales-cambio-socio"></select>' +
        '<button type="button" class="dk-btn dk-btn-ghost" data-action="vales-ir-socios" style="white-space:nowrap"><i class="bi bi-person-plus"></i></button></div>' +
        '<small class="dk-field-label" style="margin-top:4px" id="socioInfoVale">Escriba un nombre nuevo si no es un socio registrado</small>' +
        '<input class="inv-input" id="inputClienteVale" data-input="vales-cambio-socio" placeholder="Nombre del cliente / socio" style="margin-top:6px">' +
        '</div>' +
        '<div class="row g-3">' +
        '<div class="col-md-6"><div class="inv-field"><label class="inv-field-label">Monto Total ($)</label><input type="number" class="inv-input" id="inputMontoVale" min="1" step="500" required></div></div>' +
        '<div class="col-md-6"><div class="inv-field"><label class="inv-field-label">Mesero responsable *</label><select class="inv-input" id="selectMeseroVale" required><option value="">-- Seleccionar mesero --</option></select><small style="color:#94a3b8;font-size:0.70rem;display:block;margin-top:4px">Solo usuarios con rol mesero</small></div></div>' +
        '<div class="col-md-6"><div class="inv-field"><label class="inv-field-label">Mesa (solo mesas abiertas con consumo pendiente)</label><select class="inv-input" id="inputMesaVale"><option value="">-- Sin mesa / Consumo general --</option></select><small id="mesaValeHelp" style="color:#94a3b8;font-size:0.72rem;display:block;margin-top:4px">Solo se listan mesas ocupadas con comandas pendientes.</small></div></div>' +
        '<div class="col-md-6"><div class="inv-field"><label class="inv-field-label">Fecha de vencimiento</label><input type="date" class="inv-input" id="inputVencVale"></div></div>' +
        '<div class="col-md-6"><div class="inv-field"><label class="inv-field-label">Referencia</label><input class="inv-input" id="inputReferenciaVale" placeholder="Factura / contrato"></div></div>' +
        '<div class="col-md-6"><div class="inv-field"><label class="inv-field-label">Tipo de mora</label><select class="inv-input" id="selectTipoMora"><option value="diario">Diario (%)</option><option value="mensual">Mensual (%)</option><option value="fijo">Recargo fijo ($)</option></select></div></div>' +
        '<div class="col-md-6"><div class="inv-field"><label class="inv-field-label">Tasa de mora</label><input type="number" step="0.001" min="0" class="inv-input" id="inputTasaMora" value="0" placeholder="0.000"></div></div>' +
        '</div></form></div>' +
        '<div class="inv-modal-footer"><button class="inv-btn-cancelar" data-bs-dismiss="modal">Cancelar</button><button class="inv-btn-guardar" data-action="vales-crear"><i class="bi bi-check-lg me-1"></i> Registrar Vale</button></div>' +
        '</div></div></div>' +

        // Modal abono
        '<div class="modal fade" id="modalAbonarVale" tabindex="-1" aria-hidden="true">' +
        '<div class="modal-dialog modal-dialog-centered"><div class="modal-content inv-modal-content">' +
        '<div class="inv-modal-header"><h5 class="inv-modal-title"><i class="bi bi-cash-stack"></i>Abonar / Liquidar Vale</h5><button type="button" class="inv-modal-close" data-bs-dismiss="modal">×</button></div>' +
        '<div class="inv-modal-body">' +
        '<div class="dk-socio-info">' +
        '<div style="font-size:0.82rem;color:#94a3b8">Saldo total de <strong id="nombreClienteAbono" style="color:#f8fafc">-</strong></div>' +
        '<div style="display:flex;gap:20px;margin-top:6px">' +
        '<div><div style="font-size:0.7rem;color:#94a3b8">Capital</div><div style="font-size:1.2rem;font-weight:800;color:#f8fafc" id="saldoCapitalAbono">$0</div></div>' +
        '<div><div style="font-size:0.7rem;color:#94a3b8">Mora</div><div style="font-size:1.2rem;font-weight:800;color:#f87171" id="saldoMoraAbono">$0</div></div>' +
        '<div><div style="font-size:0.7rem;color:#94a3b8">Total</div><div style="font-size:1.2rem;font-weight:800;color:#fbbf24" id="saldoTotalAbono">$0</div></div>' +
        '</div></div>' +
        '<div class="inv-field"><label class="inv-field-label">Monto a pagar ($)</label><input type="number" class="inv-input" id="inputMontoAbono" min="1" step="100" placeholder="0"></div>' +
        '<div class="row g-3">' +
        '<div class="col-md-6"><div class="inv-field"><label class="inv-field-label">Método de pago</label><select class="inv-input" id="selectMetodoAbono"></select></div></div>' +
        '<div class="col-md-6"><div class="inv-field"><label class="inv-field-label">Sub-método</label><input class="inv-input" id="inputSubMetodoAbono" placeholder="Nequi, Visa..."></div></div>' +
        '<div class="col-12"><div class="inv-field"><label class="inv-field-label">Referencia</label><input class="inv-input" id="inputReferenciaAbono"></div></div>' +
        '</div>' +
        '<div id="contenedorAlertasAbono"></div>' +
        '</div>' +
        '<div class="inv-modal-footer">' +
        '<button class="dk-btn dk-btn-red" data-action="vales-exonerar" id="btnExonerar"><i class="bi bi-shield-check me-1"></i><span id="txtExonerar">Exonerar Mora</span></button>' +
        '<button class="dk-btn dk-btn-ghost" data-bs-dismiss="modal">Cancelar</button>' +
        '<button class="dk-btn dk-btn-green" data-action="vales-liquidar"><i class="bi bi-check-all me-1"></i> Liquidar Todo</button>' +
        '<button class="dk-btn dk-btn-blue" data-action="vales-abonar"><i class="bi bi-cash me-1"></i> Abonar</button>' +
        '</div></div></div></div>' +

        // Modal pagare / recibo
        '<div class="modal fade" id="modalPagare" tabindex="-1" aria-hidden="true">' +
        '<div class="modal-dialog modal-dialog-centered"><div class="modal-content inv-modal-content">' +
        '<div class="inv-modal-header"><h5 class="inv-modal-title"><i class="bi bi-file-earmark-pdf"></i>Pagaré / Recibo</h5><button type="button" class="inv-modal-close" data-bs-dismiss="modal">×</button></div>' +
        '<div class="inv-modal-body"><div id="contenidoPagare"></div></div>' +
        '<div class="inv-modal-footer"><button class="inv-btn-cancelar" data-bs-dismiss="modal">Cerrar</button><button class="inv-btn-guardar" data-action="vales-imprimir"><i class="bi bi-printer me-1"></i> Imprimir</button></div>' +
        '</div></div></div>' +

        // Contenedor de impresion oculto
        '<div id="printPagare" style="display:none"></div>';

    cargarSociosCatalogo();
    poblarSelectSocios();
    poblarMetodosAbono();
    document.getElementById('formNuevoVale').addEventListener('submit', function(e) { e.preventDefault(); crearNuevoVale(); });
    cargarCartera();
}

function poblarSelectSocios() {
    var sel = document.getElementById('selectSocioVale');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Seleccionar socio registrado --</option>';
    (catalogoSocios || []).forEach(function(s) {
        var opt = document.createElement('option');
        opt.value = s.id_cliente;
        opt.textContent = s.nombre + (s.documento ? ' (' + s.documento + ')' : '');
        sel.appendChild(opt);
    });
}

function onCambioSocioVale() {
    var sel = document.getElementById('selectSocioVale');
    var info = document.getElementById('socioInfoVale');
    var nombreInput = document.getElementById('inputClienteVale');
    if (sel && sel.value) {
        var s = (catalogoSocios || []).find(function(x) { return x.id_cliente == sel.value; });
        if (s) {
            info.textContent = 'Tel: ' + (s.telefono || '-') + ' | Doc: ' + (s.documento || '-') + ' | Límite: $' + Number(s.limite_credito).toLocaleString();
            info.style.color = '#34d399';
            nombreInput.value = s.nombre;
        }
    } else {
        info.textContent = 'Escriba un nombre nuevo si no es un socio registrado';
        info.style.color = '#94a3b8';
    }
}

function poblarMetodosAbono() {
    var sel = document.getElementById('selectMetodoAbono');
    if (!sel) return;
    if (!catalogoMetodosPago) {
        fetch(API_BASE + '/api/metodos-pago')
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (data.success) { catalogoMetodosPago = data.metodos; llenarSelectMetodos(sel); }
            });
    } else llenarSelectMetodos(sel);
}

function llenarSelectMetodos(sel) {
    sel.innerHTML = '';
    (catalogoMetodosPago || []).forEach(function(m) {
        var opt = document.createElement('option');
        opt.value = m.codigo;
        opt.textContent = m.nombre;
        sel.appendChild(opt);
    });
}

function cargarMesasActivasParaVale() {
    var sel = document.getElementById('inputMesaVale');
    if (!sel) return;
    sel.innerHTML = '<option value="">Cargando mesas activas...</option>';
    fetch(API_BASE + '/api/mesas/activas')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (!data.success) throw new Error(data.mensaje || 'Error');
            var mesas = data.mesas || [];
            if (mesas.length === 0) {
                sel.innerHTML = '<option value="">-- Sin mesa / Consumo general --</option><option value="" disabled>No hay mesas ocupadas con consumo pendiente</option>';
                var help = document.getElementById('mesaValeHelp');
                if (help) help.textContent = 'No hay mesas ocupadas con consumo pendiente en este momento.';
                return;
            }
            var html = '<option value="">-- Sin mesa / Consumo general --</option>';
            mesas.forEach(function(m) {
                var label = 'Mesa ' + valesEsc(m.numero) + (m.zona ? ' (' + valesEsc(m.zona) + ')' : '') + ' - ' + Number(m.total_pendiente || 0).toLocaleString('es-CO', {style:'currency', currency:'COP', maximumFractionDigits:0}) + ' (' + (m.num_pedidos || 0) + ' pedido(s))' + (m.mesero_nombre ? ' - ' + valesEsc(m.mesero_nombre) : '');
                html += '<option value="' + Number(m.id_mesa) + '">' + label + '</option>';
            });
            sel.innerHTML = html;
        })
        .catch(function() {
            sel.innerHTML = '<option value="">-- Sin mesa / Consumo general --</option><option value="" disabled>Error al cargar mesas activas</option>';
        });
}
var meserosValeCache = [];
function cargarMeserosParaVale() {
    var sel = document.getElementById('selectMeseroVale');
    if (!sel) return;
    sel.innerHTML = '<option value="">Cargando meseros...</option>';
    fetch(API_BASE + '/api/usuarios')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (!data.success) throw new Error(data.mensaje || 'Error');
            var todos = data.usuarios || [];
            var meseros = todos.filter(function(u) {
                var rol = String(u.rol_nombre || u.rol || '').toLowerCase();
                var idRol = Number(u.id_rol);
                if (!u.activo) return false;
                if (rol.indexOf('meser') !== -1) return true;
                if (idRol === 3) return true;
                return false;
            });
            meserosValeCache = meseros;
            if (meseros.length === 0) {
                sel.innerHTML = '<option value="">-- No hay meseros registrados --</option>';
                return;
            }
            var html = '<option value="">-- Seleccionar mesero --</option>';
            meseros.forEach(function(m) {
                html += '<option value="' + Number(m.id_usuario) + '">' + valesEsc(m.nombre || m.usuario || ('Mesero #' + m.id_usuario)) + '</option>';
            });
            sel.innerHTML = html;
        })
        .catch(function() {
            sel.innerHTML = '<option value="">-- Error al cargar meseros --</option>';
        });
}
function abrirModalNuevoVale() {
    document.getElementById('formNuevoVale').reset();
    document.getElementById('selectSocioVale').value = '';
    document.getElementById('inputTasaMora').value = 0;
    document.getElementById('inputClienteVale').value = '';
    onCambioSocioVale();
    cargarMesasActivasParaVale();
    cargarMeserosParaVale();
    new bootstrap.Modal(document.getElementById('modalNuevoVale')).show();
}

function crearNuevoVale() {
    var idSocio = document.getElementById('selectSocioVale').value;
    var cliente = document.getElementById('inputClienteVale').value.trim();
    var monto = document.getElementById('inputMontoVale').value;
    if ((!cliente && !idSocio) || !monto) { mostrarAlerta('warning', 'Seleccione un socio o escriba el cliente y el monto.'); return; }
    var selMesero = document.getElementById('selectMeseroVale');
    var idMeseroVale = selMesero && selMesero.value ? Number(selMesero.value) : null;
    if (!idMeseroVale) { mostrarAlerta('warning', 'Seleccione un mesero responsable para el vale.'); return; }
    var idCajeroVale = usuario ? usuario.id_usuario : null;
    var payload = {
        cliente_socio: cliente || undefined,
        id_cliente_socio: idSocio ? Number(idSocio) : null,
        total: Number(monto),
        id_usuario: idCajeroVale,
        id_cajero: idCajeroVale,
        id_usuario_registra: idCajeroVale,
        id_mesero: idMeseroVale,
        fecha_vencimiento: document.getElementById('inputVencVale').value || null,
        tipo_mora: document.getElementById('selectTipoMora').value,
        tasa_mora: Number(document.getElementById('inputTasaMora').value) || 0,
        referencia: document.getElementById('inputReferenciaVale').value || ''
    };
    var mesa = document.getElementById('inputMesaVale').value;
    if (mesa) payload.id_mesa = Number(mesa);
    fetch(API_BASE + '/api/vales/crear', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.success) {
            bootstrap.Modal.getInstance(document.getElementById('modalNuevoVale')).hide();
            mostrarAlerta('success', 'Vale #' + data.idVale + ' registrado por $' + Number(monto).toLocaleString());
            cargarCartera();
        } else mostrarAlerta('danger', data.mensaje || 'Error al crear vale');
    })
    .catch(function() { mostrarAlerta('danger', 'No se pudo conectar con el servidor'); });
}

// =========================================================
// CARTERA - KPIs y tabla
// =========================================================
function cargarCartera() {
    var cont = document.getElementById('contenedorTablaVales');
    if (!cont) return;
    cont.innerHTML = '<div class="spinner-border spinner-border-sm text-primary"></div>';
    fetch(API_BASE + '/api/cartera/resumen')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success) renderizarCartera(data);
            else cont.innerHTML = '<div style="padding:20px;color:#f87171"><i class="bi bi-exclamation-triangle me-1"></i> ' + valesEsc(data.mensaje || 'Error') + '</div>';
        })
        .catch(function() { cont.innerHTML = '<div style="padding:20px;color:#f87171">No se pudo conectar con el servidor</div>'; });
}

function renderizarCartera(data) {
    var cont = document.getElementById('contenedorTablaVales');
    var k = data.kpis || {};
    document.getElementById('kpiTotalPendiente').textContent = '$' + Number(k.total_pendiente || 0).toLocaleString();
    document.getElementById('kpiValesVencidos').textContent = k.vales_vencidos || 0;
    document.getElementById('kpiValesActivos').textContent = k.vales_activos || 0;
    document.getElementById('kpiMoraPendiente').textContent = '$' + Number(k.total_mora_pendiente || 0).toLocaleString();

    var vales = data.vales || [];
    if (vales.length === 0) {
        cont.innerHTML = '<div style="padding:24px;color:#64748b;text-align:center"><i class="bi bi-inbox" style="font-size:2rem;display:block;margin-bottom:8px"></i>No hay vales pendientes por cobrar.</div>';
        return;
    }

    var html = '<div class="table-responsive"><table class="dk-table mb-0"><thead><tr>' +
        '<th>ID</th><th>Socio / Cliente</th><th class="t-right">Capital</th><th class="t-right">Mora</th><th class="t-right">Total</th><th>Venc.</th><th>Mora</th><th>Estado</th><th class="t-center">Acciones</th>' +
        '</tr></thead><tbody>';

    vales.forEach(function(v) {
        var dias = Number(v.dias_mora) || 0;
        var moraBadge;
        if (v.exonerada_mora) moraBadge = '<span class="dk-badge dk-badge-blue">Exonerado</span>';
        else if (dias > 0) moraBadge = '<span class="dk-badge dk-badge-red">' + dias + ' días</span>';
        else moraBadge = '<span class="dk-badge dk-badge-green">Al día</span>';

        var vencBadge = v.vencido
            ? '<span class="dk-badge dk-badge-red">Vencido</span>'
            : (v.fecha_vencimiento ? '<span class="dk-badge dk-badge-amber">Vigente</span>' : '<span class="dk-badge dk-badge-gray">—</span>');

        var estadoBadge = v.estado === 'Liquidado'
            ? '<span class="dk-badge dk-badge-green">Liquidado</span>'
            : (v.estado === 'Parcial' ? '<span class="dk-badge dk-badge-blue">Parcial</span>' : '<span class="dk-badge dk-badge-amber">Pendiente</span>');

        var fechaVenc = v.fecha_vencimiento ? new Date(String(v.fecha_vencimiento).replace(/-/g, '/')).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

        html += '<tr>' +
            '<td class="t-num">#' + Number(v.id_vale) + '</td>' +
            '<td class="t-strong">' + valesEsc(v.cliente_socio || '') + '</td>' +
            '<td class="t-right t-money">$' + Number(v.saldo_pendiente).toLocaleString() + '</td>' +
            '<td class="t-right t-money-red">$' + Number(v.mora_pendiente).toLocaleString() + '</td>' +
            '<td class="t-right t-strong">$' + Number(v.total_pendiente_efectivo).toLocaleString() + '</td>' +
            '<td><span style="font-size:0.78rem;color:#94a3b8">' + valesEsc(fechaVenc) + '</span>' + vencBadge + '</td>' +
            '<td>' + moraBadge + '</td>' +
            '<td>' + estadoBadge + '</td>' +
            '<td class="t-center"><div style="display:flex;gap:4px;justify-content:center">' +
            '<button class="dk-btn dk-btn-green" style="padding:5px 8px" data-action="vales-abono-abrir" data-id="' + Number(v.id_vale) + '"><i class="bi bi-cash"></i></button>' +
            '<button class="dk-btn dk-btn-ghost" style="padding:5px 8px" data-action="vales-pagare-ver" data-id="' + Number(v.id_vale) + '"><i class="bi bi-file-earmark-pdf"></i></button>' +
            '</div></td></tr>';
    });
    html += '</tbody></table></div>';
    cont.innerHTML = html;
}

// =========================================================
// ABONOS / LIQUIDACION / MORA / EXENCION
// =========================================================
function abrirModalAbono(idVale) {
    idVale = Number(idVale);
    fetch(API_BASE + '/api/cartera/resumen')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            var v = (data.vales || []).find(function(x) { return Number(x.id_vale) === idVale; });
            if (!v) { mostrarAlerta('danger', 'Vale no encontrado'); return; }
            valeSeleccionado = v;
            document.getElementById('nombreClienteAbono').textContent = v.cliente_socio;
            document.getElementById('saldoCapitalAbono').textContent = '$' + Number(v.saldo_pendiente).toLocaleString();
            document.getElementById('saldoMoraAbono').textContent = '$' + Number(v.mora_pendiente).toLocaleString();
            document.getElementById('saldoTotalAbono').textContent = '$' + Number(v.total_pendiente_efectivo).toLocaleString();
            var inputAbono = document.getElementById('inputMontoAbono');
            inputAbono.value = '';
            inputAbono.placeholder = 'Ej: 50000';
            inputAbono.max = v.total_pendiente_efectivo;
            inputAbono.focus();
            document.getElementById('inputReferenciaAbono').value = '';
            document.getElementById('inputSubMetodoAbono').value = '';
            document.getElementById('contenedorAlertasAbono').innerHTML = '';
            var btnEx = document.getElementById('btnExonerar');
            var txtEx = document.getElementById('txtExonerar');
            if (v.exonerada_mora) { btnEx.style.display = ''; txtEx.textContent = 'Re-activar Mora'; }
            else { btnEx.style.display = ''; txtEx.textContent = 'Exonerar Mora'; }
            new bootstrap.Modal(document.getElementById('modalAbonarVale')).show();
            poblarMetodosAbono();
        })
        .catch(function() { mostrarAlerta('danger', 'Error al cargar el vale'); });
}

function procesarAbonoVale() {
    if (!valeSeleccionado) return;
    var monto = document.getElementById('inputMontoAbono').value;
    if (!monto || Number(monto) <= 0) { mostrarAlertaModalAbono('warning', 'Ingrese un monto válido mayor a $0.'); return; }
    if (Number(monto) > Number(valeSeleccionado.total_pendiente_efectivo)) {
        mostrarAlertaModalAbono('danger', 'El abono no puede superar el saldo pendiente ($' + Number(valeSeleccionado.total_pendiente_efectivo).toLocaleString() + ')');
        return;
    }
    fetch(API_BASE + '/api/vales/' + valeSeleccionado.id_vale + '/abonar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            monto: Number(monto),
            metodo_pago: document.getElementById('selectMetodoAbono').value || 'Efectivo',
            sub_metodo_pago: document.getElementById('inputSubMetodoAbono').value || null,
            referencia: document.getElementById('inputReferenciaAbono').value || null,
            id_usuario: usuario ? usuario.id_usuario : null
        })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.success) {
            bootstrap.Modal.getInstance(document.getElementById('modalAbonarVale')).hide();
            var msg = 'Abono de $' + Number(monto).toLocaleString() + ' (capital $' + Number(data.monto_capital).toLocaleString() + ' + mora $' + Number(data.monto_mora).toLocaleString() + ')';
            if (data.estado === 'Liquidado') msg = 'Vale #' + valeSeleccionado.id_vale + ' liquidado completamente.';
            mostrarAlerta('success', msg);
            valeSeleccionado = null;
            cargarCartera();
        } else mostrarAlertaModalAbono('danger', data.mensaje || 'Error al procesar abono');
    })
    .catch(function() { mostrarAlertaModalAbono('danger', 'No se pudo conectar con el servidor'); });
}

function liquidarValeCompleto() {
    if (!valeSeleccionado) return;
    var total = Number(valeSeleccionado.total_pendiente_efectivo);
    var inputAbono = document.getElementById('inputMontoAbono');
    if (inputAbono) inputAbono.value = total;
    fetch(API_BASE + '/api/vales/' + valeSeleccionado.id_vale + '/liquidar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            metodo_pago: document.getElementById('selectMetodoAbono').value || 'Efectivo',
            sub_metodo_pago: document.getElementById('inputSubMetodoAbono').value || null,
            referencia: document.getElementById('inputReferenciaAbono').value || null,
            id_usuario: usuario ? usuario.id_usuario : null
        })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.success) {
            bootstrap.Modal.getInstance(document.getElementById('modalAbonarVale')).hide();
            mostrarAlerta('success', 'Vale #' + valeSeleccionado.id_vale + ' liquidado por $' + total.toLocaleString() + ' (mora $' + Number(data.monto_mora).toLocaleString() + ')');
            valeSeleccionado = null;
            cargarCartera();
        } else mostrarAlertaModalAbono('danger', data.mensaje || 'Error al liquidar');
    })
    .catch(function() { mostrarAlertaModalAbono('danger', 'No se pudo conectar con el servidor'); });
}

function exonerarMoraVale() {
    if (!valeSeleccionado) return;
    var exonerar = !valeSeleccionado.exonerada_mora;
    if (!confirm(exonerar ? '¿Exonerar la mora de este vale? (solo administradores)' : '¿Re-activar la mora de este vale?')) return;
    fetch(API_BASE + '/api/vales/' + valeSeleccionado.id_vale + '/exonerar-mora', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exonerar: exonerar, id_usuario: usuario ? usuario.id_usuario : null })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.success) {
            mostrarAlerta('success', data.mensaje);
            valeSeleccionado = null;
            bootstrap.Modal.getInstance(document.getElementById('modalAbonarVale')).hide();
            cargarCartera();
        } else mostrarAlertaModalAbono('danger', data.mensaje);
    })
    .catch(function() { mostrarAlertaModalAbono('danger', 'Error'); });
}

// =========================================================
// PAGARES / RECIBOS
// =========================================================
function verPagare(idVale) {
    idVale = Number(idVale);
    var contenido = document.getElementById('contenidoPagare');
    contenido.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>';
    new bootstrap.Modal(document.getElementById('modalPagare')).show();
    fetch(API_BASE + '/api/vales/' + idVale + '/pagare')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success) contenido.innerHTML = renderPagareHTML(data.pagare);
            else contenido.innerHTML = '<div style="color:#f87171;text-align:center">' + valesEsc(data.mensaje || 'Error') + '</div>';
        })
        .catch(function() { contenido.innerHTML = '<div style="color:#f87171;text-align:center">No se pudo generar el pagaré</div>'; });
}

function renderPagareHTML(p) {
    var totalCap = Number(p.capital_pagado || 0), totalMora = Number(p.mora_pagada || 0);
    var html = '<div class="dk-pagare">';
    html += '<div style="text-align:center;margin-bottom:14px"><div style="font-weight:800;font-size:1.2rem">ClubMaster</div><small>PAGARÉ No. ' + Number(p.id_vale) + '</small></div>';
    html += '<div style="font-size:0.85rem;line-height:1.8;margin-bottom:12px">' +
        'Yo, <strong>' + valesEsc(p.cliente_socio) + '</strong>, prometo pagar incondicionalmente a la orden en la ciudad de destino, la suma de <strong>$' + Number(p.total).toLocaleString() + '</strong>, valor recibido en mercancía/consumo.' +
        '</div>';
    html += '<table style="width:100%;border-collapse:collapse;font-size:0.8rem;margin-bottom:12px">' +
        '<tr><td style="padding:4px 0">Fecha emisión:</td><td style="text-align:right">' + valesEsc(new Date(p.fecha).toLocaleDateString('es-CO')) + '</td></tr>' +
        '<tr><td style="padding:4px 0">Vencimiento:</td><td style="text-align:right">' + (p.fecha_vencimiento ? valesEsc(new Date(p.fecha_vencimiento).toLocaleDateString('es-CO')) : '—') + '</td></tr>' +
        '<tr><td style="padding:4px 0">Saldo capital:</td><td style="text-align:right">$' + Number(p.saldo_pendiente).toLocaleString() + '</td></tr>' +
        '<tr><td style="padding:4px 0">Mora pendiente:</td><td style="text-align:right">$' + Number(p.mora_pendiente).toLocaleString() + '</td></tr>' +
        '</table>';
    if (p.abonos && p.abonos.length > 0) {
        html += '<div style="font-weight:700;font-size:0.8rem;margin-bottom:6px">Historial de abonos:</div><table style="width:100%;border-collapse:collapse;font-size:0.75rem;margin-bottom:10px">' +
            '<tr style="border-bottom:1px solid #cbd5e1"><th style="text-align:left">Fecha</th><th>Capital</th><th>Mora</th><th>Método</th></tr>';
        p.abonos.forEach(function(a) {
            html += '<tr style="border-bottom:1px solid #e2e8f0"><td>' + valesEsc(new Date(a.fecha).toLocaleDateString('es-CO')) + '</td><td style="text-align:right">$' + Number(a.monto_capital).toLocaleString() + '</td><td style="text-align:right">$' + Number(a.monto_mora).toLocaleString() + '</td><td style="text-align:right">' + valesEsc(a.metodo_pago || '') + '</td></tr>';
        });
        html += '</table>';
    }
    html += '<div style="border-top:1px dashed #0f172a;padding-top:10px;text-align:right;font-weight:800">TOTAL PENDIENTE: $' + (Number(p.saldo_pendiente) + Number(p.mora_pendiente)).toLocaleString() + '</div>';
    html += '<div style="text-align:center;margin-top:20px;color:#64748b;font-size:0.75rem">Firma del deudor: ______________________</div>';
    html += '</div>';
    return html;
}

function imprimirPagare() {
    var contenido = document.getElementById('contenidoPagare');
    var printer = document.getElementById('printPagare');
    printer.innerHTML = contenido.innerHTML;
    printer.style.display = 'block';
    window.print();
    setTimeout(function() { printer.style.display = 'none'; printer.innerHTML = ''; }, 300);
}

// =========================================================
// ALERTAS
// =========================================================
function mostrarAlerta(tipo, msg) {
    var c = document.getElementById('contenedorAlertas');
    if (!c) return;
    c.innerHTML = '<div class="alert alert-' + valesEsc(tipo) + ' alert-dismissible fade show">' + valesEsc(msg) + '<button type="button" class="btn-close" data-bs-dismiss="alert"></button></div>';
    setTimeout(function() { c.innerHTML = ''; }, 4500);
}

function mostrarAlertaModalAbono(tipo, msg) {
    var c = document.getElementById('contenedorAlertasAbono');
    if (!c) return;
    c.innerHTML = '<div class="alert alert-' + valesEsc(tipo) + ' alert-dismissible fade show" style="font-size:0.85rem">' + valesEsc(msg) + '<button type="button" class="btn-close" data-bs-dismiss="alert"></button></div>';
    setTimeout(function() { c.innerHTML = ''; }, 4000);
}
if (typeof delegateAction !== 'undefined') delegateAction(document, { 'vales-socios-refresh': function() { iniciarSocios(); }, 'vales-socio-nuevo': function() { abrirModalSocio(); }, 'vales-socio-guardar': function() { guardarSocio(); }, 'vales-socio-editar': function(el) { abrirModalEditarSocio(Number(el.getAttribute('data-id'))); }, 'vales-socio-toggle': function(el) { toggleSocio(Number(el.getAttribute('data-id')), el.getAttribute('data-activo')); }, 'vales-refresh': function() { iniciarVales(); }, 'vales-nuevo': function() { abrirModalNuevoVale(); }, 'vales-ir-socios': function() { iniciarSocios(); }, 'vales-crear': function() { crearNuevoVale(); }, 'vales-exonerar': function() { exonerarMoraVale(); }, 'vales-liquidar': function() { liquidarValeCompleto(); }, 'vales-abonar': function() { procesarAbonoVale(); }, 'vales-imprimir': function() { imprimirPagare(); }, 'vales-abono-abrir': function(el) { abrirModalAbono(Number(el.getAttribute('data-id'))); }, 'vales-pagare-ver': function(el) { verPagare(Number(el.getAttribute('data-id'))); } });
if (typeof document !== 'undefined') {
document.addEventListener('change', function(e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-change]') : null;
    if (!el || !document.contains(el)) return;
    if (el.getAttribute('data-change') === 'vales-cambio-socio') onCambioSocioVale();
});
document.addEventListener('input', function(e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-input]') : null;
    if (!el || !document.contains(el)) return;
    if (el.getAttribute('data-input') === 'vales-cambio-socio') onCambioSocioVale();
});
}
