// =========================================================
// CONTROLADOR: CONFIGURACION GENERAL DEL SISTEMA
// Panel por pestanas: General, POS/Mesas, Inventario e
// Impuestos, Metodos de Pago, Zonas y Notas.
// =========================================================

var cfgGeneral = {};
var cfgUsuario = {};
var cfgEsAdmin = false;
var cfgConfig = {};
var cfgCategorias = [];
var cfgUnidades = [];
var cfgConversiones = [];
var cfgProductos = [];
var cfgCatEditando = null;
var cfgUniEditando = null;
var cfgZonas = [];
var cfgNotas = [];
var cfgTabActual = 'general';

function cfgInitUsuario() {
    cfgUsuario = {};
    try { cfgUsuario = JSON.parse(localStorage.getItem('usuario') || '{}'); } catch (e) { cfgUsuario = {}; }
    cfgEsAdmin = Number(cfgUsuario.id_rol) === 1;
}

function cfgEsc(t) {
    return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// =========================================================
// ENTRY POINT
// =========================================================
function iniciarConfiguracionInventario() {
    if(typeof verificarAcceso==='function'&&!verificarAcceso('gestionar_configuracion')){if(typeof verificarAccesoRB==='function'&&!verificarAccesoRB('gestionar_configuracion'))return;return;}
    if(typeof verificarAccesoRB==='function'&&!verificarAccesoRB('gestionar_configuracion'))return;
    if (typeof activarNav === 'function') activarNav('navConfigInventario');
    cfgInitUsuario();
    var contenedor = document.getElementById('main-content');
    contenedor.innerHTML =
        '<div class="page-header">' +
        '<h2><i class="bi bi-sliders2"></i>Configuracion del Sistema</h2>' +
        '<div class="page-header-right">' +
        '<span class="cfg-role-badge' + (cfgEsAdmin ? '' : ' no') + '"><i class="bi bi-shield-lock"></i> ' + cfgEsc(cfgUsuario.rol || 'Usuario') + '</span>' +
        '<button class="btn-inv-refresh" onclick="iniciarConfiguracionInventario()" title="Actualizar"><i class="bi bi-arrow-clockwise"></i> Actualizar</button>' +
        '</div></div>' +
        '<div id="contenedorAlertas"></div>' +
        '<div id="cfgTabs" class="cfg-tabs"></div>' +
        '<div id="cfgContenido" class="inv-loading"><div class="spinner-border text-primary" role="status"></div></div>';

    cargarDatosConfiguracion();
}

function cambiarCfgTab(tab) {
    if(['general','pos','pagos','zonas'].indexOf(tab)!==-1){
        cfgIrGeneral(tab==='general'?'general': tab==='pos'?'pos': tab==='pagos'?'seguridad':'general');
        return;
    }
    cfgTabActual = 'inventario';
    document.querySelectorAll('.cfg-tab-btn').forEach(function(b) { b.classList.remove('active'); });
    var btn = document.getElementById('cfgTabBtn_inventario');
    if (btn) btn.classList.add('active');
    renderizarCfgTab();
}

// =========================================================
// CARGA DE DATOS
// =========================================================
function cargarDatosConfiguracion() {
    Promise.all([
        fetch(API_BASE + '/api/configuracion').then(function(r) { return r.json(); }).catch(function() { return { success: false }; }),
        fetch(API_BASE + '/api/config-inventario').then(function(r) { return r.json(); }).catch(function() { return { success: false }; }),
        fetch(API_BASE + '/api/categorias').then(function(r) { return r.json(); }).catch(function() { return { success: false }; }),
        fetch(API_BASE + '/api/unidades-medida').then(function(r) { return r.json(); }).catch(function() { return { success: false }; }),
        fetch(API_BASE + '/api/conversiones').then(function(r) { return r.json(); }).catch(function() { return { success: false }; }),
        fetch(API_BASE + '/api/productos/admin').then(function(r) { return r.json(); }).catch(function() { return { success: false }; }),
        fetch(API_BASE + '/api/zonas').then(function(r) { return r.json(); }).catch(function() { return { success: false }; }),
        fetch(API_BASE + '/api/notas-preparacion').then(function(r) { return r.json(); }).catch(function() { return { success: false }; })
    ]).then(function(results) {
        if (results[0].success) cfgGeneral = results[0].config || {};
        if (results[1].success) cfgConfig = results[1].config || {};
        if (results[2].success) cfgCategorias = results[2].categorias || [];
        if (results[3].success) cfgUnidades = results[3].unidades || [];
        if (results[4].success) cfgConversiones = results[4].conversiones || [];
        if (results[5].success) cfgProductos = results[5].productos || [];
        if (results[6].success) cfgZonas = results[6].zonas || [];
        if (results[7].success) cfgNotas = results[7].notas || [];

        renderizarCfgTabs();
        renderizarCfgTab();
        var fallaron = results.filter(function(r) { return !r.success || r.success === undefined; }).length;
        if (fallaron > 0) {
            mostrarAlerta('warning', 'Algunos modulos no cargaron (' + fallaron + '/8). Verifica el servidor.');
        }
    }).catch(function() {
        var cont = document.getElementById('cfgContenido');
        if (cont) cont.innerHTML = '<div class="inv-error"><i class="bi bi-wifi-off me-1"></i> No se pudo conectar con el servidor</div>';
    });
}

// =========================================================
// RENDERIZADO DE PESTANAS
// =========================================================
function cfgIrGeneral(seccion){
  if(typeof iniciarConfiguracion==='function'){
    iniciarConfiguracion();
    if(seccion) setTimeout(function(){
      var el=document.getElementById('cfgSec_'+seccion);
      if(el) el.scrollIntoView({behavior:'smooth'});
      else if(typeof cfgScrollTo==='function') cfgScrollTo(seccion, null);
    },400);
  }
}
function renderizarCfgTabs() {
    var tabsEl = document.getElementById('cfgTabs');
    if (!tabsEl) return;
    var tabs = [
        { id: 'general', icon: 'building', label: 'General' },
        { id: 'pos', icon: 'grid-3x3-gap', label: 'POS / Mesas' },
        { id: 'inventario', icon: 'box-seam', label: 'Inventario e Impuestos' },
        { id: 'pagos', icon: 'credit-card', label: 'Metodos de Pago' },
        { id: 'zonas', icon: 'geo-alt', label: 'Zonas y Notas' }
    ];
    var html = '';
    tabs.forEach(function(t) {
        html += '<button class="cfg-tab-btn' + (cfgTabActual === t.id ? ' active' : '') +
            '" id="cfgTabBtn_' + t.id + '" onclick="cambiarCfgTab(\'' + t.id + '\')">' +
            '<i class="bi bi-' + t.icon + '"></i> ' + t.label + '</button>';
    });
    tabsEl.innerHTML = html;
}

function renderizarCfgTab() {
    var cont = document.getElementById('cfgContenido');
    if (!cont) return;
    if(['general','pos','pagos','zonas'].indexOf(cfgTabActual)!==-1){
        var mapTitle={general:'Datos del Local',pos:'POS / Mesas',pagos:'Métodos de Pago',zonas:'Zonas y Notas'};
        var mapSec={general:'general',pos:'pos',pagos:'seguridad',zonas:'general'};
        cont.innerHTML='<div style="margin-bottom:14px;background:#1e293b;border:1px solid #334155;border-left:3px solid #3b82f6;border-radius:10px;padding:14px;display:flex;align-items:center;gap:12px"><div style="width:36px;height:36px;border-radius:10px;background:#2563eb;display:flex;align-items:center;justify-content:center;color:#fff"><i class="bi bi-box-arrow-up-right"></i></div><div style="flex:1"><div style="font-weight:700;color:#f8fafc">'+(mapTitle[cfgTabActual]||cfgTabActual)+' → Configuración General</div><div style="font-size:.78rem;color:#94a3b8">Este apartado ahora se gestiona en <b style="color:#e2e8f0">Configuración General</b> como único punto de verdad. Usa el acceso directo.</div></div><button class="cfg-btn" onclick="cfgIrGeneral(\''+mapSec[cfgTabActual]+'\')"><i class="bi bi-arrow-right"></i> Ir ahora</button></div>';
        return;
    }
    renderCfgInventario(cont);
}

// =========================================================
// PESTANA: GENERAL (datos del local)
// =========================================================
function renderCfgGeneral(cont) {
    cont.innerHTML =
        '<div class="cfg-card">' +
        '<div class="cfg-card-header"><span><i class="bi bi-building"></i> Datos del Local</span></div>' +
        '<div class="cfg-card-body">' +
        '<div class="row g-3 mb-3">' +
        '<div class="col-md-6"><label class="cfg-label">Nombre del Local</label>' +
        '<input type="text" class="cfg-input" id="cfgNombreLocal" value="' + cfgEsc(cfgGeneral['nombre_local'] || '') + '" placeholder="Ej: ClubMaster"></div>' +
        '<div class="col-md-6"><label class="cfg-label">NIT</label>' +
        '<input type="text" class="cfg-input" id="cfgNitLocal" value="' + cfgEsc(cfgGeneral['nit_local'] || '') + '" placeholder="Ej: 900123456-7"></div>' +
        '</div>' +
        '<div class="row g-3 mb-3">' +
        '<div class="col-md-6"><label class="cfg-label">Direccion</label>' +
        '<input type="text" class="cfg-input" id="cfgDirLocal" value="' + cfgEsc(cfgGeneral['direccion_local'] || '') + '" placeholder="Ej: Calle 10 #5-20"></div>' +
        '<div class="col-md-6"><label class="cfg-label">Telefono</label>' +
        '<input type="text" class="cfg-input" id="cfgTelLocal" value="' + cfgEsc(cfgGeneral['telefono_local'] || '') + '" placeholder="Ej: 3001234567"></div>' +
        '</div>' +
        '<div class="row g-3 mb-3">' +
        '<div class="col-md-6"><label class="cfg-label">URL / Ruta del Logo</label>' +
        '<input type="text" class="cfg-input" id="cfgLogoLocal" value="' + cfgEsc(cfgGeneral['logo_url'] || '') + '" placeholder="Ruta del logo (dejar vacio si no aplica)"></div>' +
        '</div>' +
        '<div class="row g-3 mb-3">' +
        '<div class="col-md-12"><label class="cfg-label">Mensaje al Pie de Factura</label>' +
        '<textarea class="cfg-input" id="cfgPieFactura" rows="2" placeholder="Ej: Gracias por su compra">' + cfgEsc(cfgGeneral['pie_factura'] || '') + '</textarea></div>' +
        '</div>' +
        '<button type="button" class="cfg-btn" onclick="cfgGuardarGeneral()"><i class="bi bi-check-lg me-1"></i> Guardar Datos del Local</button>' +
        '</div></div>';
}

function cfgGuardarGeneral() {
    var payload = {
        nombre_local: document.getElementById('cfgNombreLocal').value.trim(),
        nit_local: document.getElementById('cfgNitLocal').value.trim(),
        direccion_local: document.getElementById('cfgDirLocal').value.trim(),
        telefono_local: document.getElementById('cfgTelLocal').value.trim(),
        logo_url: document.getElementById('cfgLogoLocal').value.trim(),
        pie_factura: document.getElementById('cfgPieFactura').value.trim()
    };
    fetch(API_BASE + '/api/configuracion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.success) {
            for (var k in payload) cfgGeneral[k] = payload[k];
            mostrarAlerta('success', 'Datos del local guardados correctamente.');
        } else {
            mostrarAlerta('danger', data.mensaje || 'Error al guardar');
        }
    }).catch(function() { mostrarAlerta('danger', 'No se pudo conectar con el servidor'); });
}

// =========================================================
// PESTANA: POS / MESAS
// =========================================================
function renderCfgPOS(cont) {
    cont.innerHTML =
        '<div class="cfg-card">' +
        '<div class="cfg-card-header"><span><i class="bi bi-grid-3x3-gap"></i> Configuracion POS / Mesas</span></div>' +
        '<div class="cfg-card-body">' +
        '<div class="row g-3 mb-3">' +
        '<div class="col-md-4"><label class="cfg-label">Propina por Defecto (%)</label>' +
        '<input type="number" min="0" max="100" step="1" class="cfg-input" id="cfgPropinaDefault" value="' + cfgEsc(cfgGeneral['propina_default'] || '10') + '"></div>' +
        '<div class="col-md-4"><label class="cfg-label">Tiempo Limite Inactividad (min)</label>' +
        '<input type="number" min="5" max="180" class="cfg-input" id="cfgInactividadMesa" value="' + cfgEsc(cfgGeneral['inactividad_mesa_minutos'] || '30') + '"></div>' +
        '<div class="col-md-4"><label class="cfg-label">Edicion de Comandas</label>' +
        '<div class="cfg-toggle-wrap">' +
        '<input type="checkbox" class="cfg-toggle" id="cfgEditarComandas" ' + (cfgGeneral['editar_comandas'] === '1' ? 'checked' : '') + '>' +
        '<label for="cfgEditarComandas">Permitir editar comandas activas</label></div></div>' +
        '</div>' +
        '<button type="button" class="cfg-btn" onclick="cfgGuardarPOS()"><i class="bi bi-check-lg me-1"></i> Guardar Configuracion POS</button>' +
        '</div></div>';
}

function cfgGuardarPOS() {
    var payload = {
        propina_default: String(document.getElementById('cfgPropinaDefault').value || '10'),
        inactividad_mesa_minutos: String(document.getElementById('cfgInactividadMesa').value || '30'),
        editar_comandas: document.getElementById('cfgEditarComandas').checked ? '1' : '0'
    };
    fetch(API_BASE + '/api/configuracion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.success) {
            for (var k in payload) cfgGeneral[k] = payload[k];
            mostrarAlerta('success', 'Configuracion POS guardada correctamente.');
        } else {
            mostrarAlerta('danger', data.mensaje || 'Error al guardar');
        }
    }).catch(function() { mostrarAlerta('danger', 'No se pudo conectar con el servidor'); });
}

// =========================================================
// PESTANA: INVENTARIO E IMPUESTOS (existente)
// =========================================================
function renderCfgInventario(cont) {
    if (!cfgEsAdmin) {
        mostrarAlerta('warning', 'Modo lectura: solo un Administrador puede modificar la configuracion del inventario.');
    }
    cont.innerHTML =
        cfgCard('shield-lock', 'Parametros de Seguridad y Analisis', 'cfgBodySeguridad', function() {
            return '<div class="row g-3 mb-3">' +
                '<div class="col-md-4"><label class="cfg-label">Dias para stock muerto</label>' +
                '<input type="number" min="1" max="365" class="cfg-input" id="cfgDiasMuertos" value="' + cfgEsc(cfgConfig['analisis_dias_muertos'] || 30) + '" ' + cfgRo() + '></div></div>' +
                '<div class="row g-3 mb-3">' +
                '<div class="col-md-4"><input type="checkbox" class="cfg-toggle" id="cfgRestringirAjuste" ' + cfgChecked(cfgConfig['requiere_admin_ajuste_precios']) + ' ' + cfgRo() + '>' +
                '<label for="cfgRestringirAjuste">Solo admin ajusta precios</label></div>' +
                '<div class="col-md-4"><input type="checkbox" class="cfg-toggle" id="cfgRestringirConfig" ' + cfgChecked(cfgConfig['requiere_admin_config']) + ' ' + cfgRo() + '>' +
                '<label for="cfgRestringirConfig">Solo admin configura</label></div>' +
                '<div class="col-md-4"><input type="checkbox" class="cfg-toggle" id="cfgRestringirMermas" ' + cfgChecked(cfgConfig['requiere_admin_mermas']) + ' ' + cfgRo() + '>' +
                '<label for="cfgRestringirMermas">Solo admin registra mermas</label></div></div>' +
                '<button type="button" class="cfg-btn" onclick="cfgGuardarSeguridad()" ' + cfgRo() + '><i class="bi bi-check-lg me-1"></i> Guardar parametros</button>';
        }) +
        cfgCard('percent', 'Impuestos por Defecto (Compras)', 'cfgBodyImpuestos', function() {
            return '<div class="row g-3 mb-3">' +
                '<div class="col-md-4"><label class="cfg-label">IVA por defecto (%)</label>' +
                '<input type="number" min="0" max="100" step="0.01" class="cfg-input" id="cfgIvaGlobal" value="' + cfgEsc(cfgConfig['iva_global'] || 0) + '" ' + cfgRo() + '></div>' +
                '<div class="col-md-4"><label class="cfg-label">ICO por defecto (%)</label>' +
                '<input type="number" min="0" max="100" step="0.01" class="cfg-input" id="cfgIcoGlobal" value="' + cfgEsc(cfgConfig['ico_global'] || 0) + '" ' + cfgRo() + '></div></div>' +
                '<p class="cfg-note mb-3"><i class="bi bi-info-circle me-1"></i>Se aplican por defecto al registrar compras.</p>' +
                '<button type="button" class="cfg-btn" onclick="cfgGuardarImpuestos()" ' + cfgRo() + '><i class="bi bi-save me-1"></i> Guardar impuestos</button> ' +
                '<button type="button" class="cfg-btn danger" onclick="cfgAplicarImpuestosProductos()" ' + cfgRo() + '><i class="bi bi-download me-1"></i> Aplicar a todos los productos</button>';
        }) +
        cfgCard('tags', 'Categorias', 'cfgBodyCategorias', function() { return cfgHtmlCategorias(); }) +
        cfgCard('rulers', 'Unidades de Medida', 'cfgBodyUnidades', function() { return cfgHtmlUnidades(); }) +
        cfgCard('arrow-left-right', 'Conversiones entre Unidades', 'cfgBodyConversiones', function() { return cfgHtmlConversiones(); }) +
        cfgCard('percent', 'Ajuste Masivo de Precios', 'cfgBodyPrecios', function() { return cfgHtmlPrecios(); });
}

function cfgCard(icono, titulo, bodyId, bodyHtmlFn) {
    return '<div class="cfg-card">' +
        '<div class="cfg-card-header"><span><i class="bi bi-' + icono + '"></i>' + titulo + '</span></div>' +
        '<div class="cfg-card-body"><div id="' + bodyId + '">' + bodyHtmlFn() + '</div></div></div>';
}

function cfgRo() { return cfgEsAdmin ? '' : 'disabled'; }
function cfgChecked(valor) { return String(valor) === '1' || String(valor).toLowerCase() === 'true' ? 'checked' : ''; }

// =========================================================
// PESTANA: METODOS DE PAGO
// =========================================================
function renderCfgPagos(cont) {
    cont.innerHTML =
        '<div class="cfg-card">' +
        '<div class="cfg-card-header"><span><i class="bi bi-credit-card"></i> Metodos de Pago Activos</span></div>' +
        '<div class="cfg-card-body">' +
        '<p class="cfg-note mb-3"><i class="bi bi-info-circle me-1"></i>Activa o desactiva los metodos de pago disponibles en el POS.</p>' +
        '<div class="row g-3 mb-3">' +
        cfgMetodoToggle('Nequi', 'metodo_nequi', 'bi-phone', 'Pago por Nequi') +
        cfgMetodoToggle('Daviplata', 'metodo_daviplata', 'bi-phone', 'Pago por Daviplata') +
        cfgMetodoToggle('Tarjeta Debito', 'metodo_tarjeta_debito', 'bi-credit-card', 'Tarjeta debito') +
        cfgMetodoToggle('Tarjeta Credito', 'metodo_tarjeta_credito', 'bi-credit-card-2-front', 'Tarjeta credito') +
        cfgMetodoToggle('Vales', 'metodo_vales', 'bi-wallet2', 'Vales / Cuentas por cobrar') +
        '</div>' +
        '<div class="row g-3 mb-3">' +
        '<div class="col-md-12"><hr style="border-color:#e2e8f0"></div>' +
        '<div class="col-md-6"><label class="cfg-label">Arqueo Ciego</label>' +
        '<div class="cfg-toggle-wrap">' +
        '<input type="checkbox" class="cfg-toggle" id="cfgArqueoCiego" ' + (cfgGeneral['arqueo_ciego'] === '1' ? 'checked' : '') + '>' +
        '<label for="cfgArqueoCiego">El Cajero no ve el monto esperado al cerrar jornada</label></div>' +
        '<p class="cfg-note mt-1">Si esta activo, el sistema no muestra el total esperado durante el arqueo.</p></div>' +
        '</div>' +
        '<button type="button" class="cfg-btn" onclick="cfgGuardarPagos()"><i class="bi bi-check-lg me-1"></i> Guardar Metodos de Pago</button>' +
        '</div></div>';
}

function cfgMetodoToggle(nombre, clave, icono, desc) {
    var activo = cfgGeneral[clave] === '1';
    return '<div class="col-md-4">' +
        '<div class="cfg-metodo-item">' +
        '<div class="cfg-metodo-info"><i class="bi ' + icono + '"></i><div><strong>' + nombre + '</strong><br><span style="color:#94a3b8;font-size:.72rem">' + desc + '</span></div></div>' +
        '<label class="cfg-switch"><input type="checkbox" id="cfgMetodo_' + clave + '"' + (activo ? ' checked' : '') + '><span class="cfg-slider"></span></label>' +
        '</div></div>';
}

function cfgGuardarPagos() {
    var payload = {
        metodo_nequi: document.getElementById('cfgMetodo_nequi').checked ? '1' : '0',
        metodo_daviplata: document.getElementById('cfgMetodo_daviplata').checked ? '1' : '0',
        metodo_tarjeta_debito: document.getElementById('cfgMetodo_tarjeta_debito').checked ? '1' : '0',
        metodo_tarjeta_credito: document.getElementById('cfgMetodo_tarjeta_credito').checked ? '1' : '0',
        metodo_vales: document.getElementById('cfgMetodo_vales').checked ? '1' : '0',
        arqueo_ciego: document.getElementById('cfgArqueoCiego').checked ? '1' : '0'
    };
    fetch(API_BASE + '/api/configuracion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.success) {
            for (var k in payload) cfgGeneral[k] = payload[k];
            mostrarAlerta('success', 'Metodos de pago guardados correctamente.');
        } else {
            mostrarAlerta('danger', data.mensaje || 'Error al guardar');
        }
    }).catch(function() { mostrarAlerta('danger', 'No se pudo conectar con el servidor'); });
}

// =========================================================
// PESTANA: ZONAS Y NOTAS
// =========================================================
function renderCfgZonas(cont) {
    cont.innerHTML =
        cfgCard('geo-alt', 'Zonas del Establecimiento', 'cfgBodyZonas', function() { return cfgHtmlZonas(); }) +
        cfgCard('sticky', 'Notas de Preparacion', 'cfgBodyNotas', function() { return cfgHtmlNotas(); });
}

function cfgHtmlZonas() {
    var html =
        (cfgEsAdmin ? '<div class="row g-2 mb-3">' +
            '<div class="col-md-4"><input type="text" class="cfg-input" id="cfgNuevaZonaNombre" placeholder="Nombre de zona"></div>' +
            '<div class="col-md-3"><input type="text" class="cfg-input" id="cfgNuevaZonaDesc" placeholder="Descripcion"></div>' +
            '<div class="col-md-2"><input type="color" class="cfg-input cfg-color-input" id="cfgNuevaZonaColor" value="#3b82f6" title="Color"></div>' +
            '<div class="col-md-3"><button type="button" class="cfg-btn" style="width:100%" onclick="cfgCrearZona()"><i class="bi bi-plus-lg me-1"></i> Agregar Zona</button></div>' +
            '</div>' : '') +
        '<div class="table-responsive"><table class="ana-table"><thead>' +
        '<tr><th>Zona</th><th>Descripcion</th><th>Color</th><th class="text-center">Acciones</th></tr></thead><tbody>';
    if (cfgZonas.length === 0) {
        html += '<tr><td colspan="4"><div class="cfg-empty">No hay zonas registradas.</div></td></tr>';
    } else {
        cfgZonas.forEach(function(z) {
            html += '<tr>' +
                '<td style="font-weight:600">' + cfgEsc(z.nombre) + '</td>' +
                '<td>' + cfgEsc(z.descripcion || '--') + '</td>' +
                '<td><span style="display:inline-block;width:20px;height:20px;border-radius:50%;background:' + cfgEsc(z.color || '#3b82f6') + ';vertical-align:middle"></span></td>' +
                '<td class="text-center">' +
                '<button class="cfg-icon-btn eliminar" title="Eliminar" onclick="cfgEliminarZona(' + z.id_zona + ')" ' + cfgRo() + '><i class="bi bi-trash"></i></button>' +
                '</td></tr>';
        });
    }
    html += '</tbody></table></div>';
    return html;
}

function cfgCrearZona() {
    var nombre = (document.getElementById('cfgNuevaZonaNombre') || {}).value || '';
    var desc = (document.getElementById('cfgNuevaZonaDesc') || {}).value || '';
    var color = (document.getElementById('cfgNuevaZonaColor') || {}).value || '#3b82f6';
    nombre = nombre.trim();
    if (!nombre) { mostrarAlerta('warning', 'Escriba el nombre de la zona.'); return; }
    fetch(API_BASE + '/api/zonas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombre, descripcion: desc.trim(), color: color })
    }).then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.success) {
            cfgZonas.push({ id_zona: data.idZona, nombre: nombre, descripcion: desc.trim(), color: color });
            renderizarCfgTab();
            mostrarAlerta('success', data.mensaje);
        } else {
            mostrarAlerta('danger', data.mensaje || 'Error al crear zona');
        }
    }).catch(function() { mostrarAlerta('danger', 'No se pudo conectar con el servidor'); });
}

function cfgEliminarZona(id) {
    if (!confirm('Eliminar esta zona?')) return;
    fetch(API_BASE + '/api/zonas/' + id, { method: 'DELETE' })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success) {
                cfgZonas = cfgZonas.filter(function(z) { return z.id_zona !== id; });
                renderizarCfgTab();
                mostrarAlerta('success', data.mensaje);
            } else {
                mostrarAlerta('danger', data.mensaje || 'Error al eliminar zona');
            }
        }).catch(function() { mostrarAlerta('danger', 'No se pudo conectar con el servidor'); });
}

function cfgHtmlNotas() {
    var html =
        (cfgEsAdmin ? '<div class="row g-2 mb-3">' +
            '<div class="col-md-10"><input type="text" class="cfg-input" id="cfgNuevaNotaTexto" placeholder="Texto de la nota de preparacion" onkeydown="if(event.key===\'Enter\'){cfgCrearNota();}"></div>' +
            '<div class="col-md-2"><button type="button" class="cfg-btn" style="width:100%" onclick="cfgCrearNota()"><i class="bi bi-plus-lg me-1"></i> Agregar</button></div>' +
            '</div>' : '') +
        '<div class="table-responsive"><table class="ana-table"><thead>' +
        '<tr><th>Texto</th><th class="text-center">Estado</th><th class="text-center">Acciones</th></tr></thead><tbody>';
    if (cfgNotas.length === 0) {
        html += '<tr><td colspan="3"><div class="cfg-empty">No hay notas de preparacion.</div></td></tr>';
    } else {
        cfgNotas.forEach(function(n) {
            html += '<tr>' +
                '<td style="font-weight:500">' + cfgEsc(n.texto) + '</td>' +
                '<td class="text-center"><span class="ana-chip ' + (n.activa ? 'ana-chip-green' : 'ana-chip-gray') + '">' + (n.activa ? 'Activa' : 'Inactiva') + '</span></td>' +
                '<td class="text-center">' +
                '<button class="cfg-icon-btn" title="Toggle activa/inactiva" onclick="cfgToggleNota(' + n.id_nota + ',' + (n.activa ? 0 : 1) + ')" ' + cfgRo() + '><i class="bi bi-' + (n.activa ? 'pause-circle' : 'play-circle') + '"></i></button> ' +
                '<button class="cfg-icon-btn eliminar" title="Eliminar" onclick="cfgEliminarNota(' + n.id_nota + ')" ' + cfgRo() + '><i class="bi bi-trash"></i></button>' +
                '</td></tr>';
        });
    }
    html += '</tbody></table></div>';
    return html;
}

function cfgCrearNota() {
    var input = document.getElementById('cfgNuevaNotaTexto');
    var texto = input ? input.value.trim() : '';
    if (!texto) { mostrarAlerta('warning', 'Escriba el texto de la nota.'); return; }
    fetch(API_BASE + '/api/notas-preparacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: texto })
    }).then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.success) {
            cfgNotas.push({ id_nota: data.idNota, texto: texto, activa: 1 });
            renderizarCfgTab();
            mostrarAlerta('success', data.mensaje);
        } else {
            mostrarAlerta('danger', data.mensaje || 'Error al crear nota');
        }
    }).catch(function() { mostrarAlerta('danger', 'No se pudo conectar con el servidor'); });
}

function cfgToggleNota(id, nuevaActiva) {
    fetch(API_BASE + '/api/notas-preparacion/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activa: nuevaActiva })
    }).then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.success) {
            cfgNotas.forEach(function(n) { if (n.id_nota === id) n.activa = nuevaActiva; });
            renderizarCfgTab();
            mostrarAlerta('success', data.mensaje);
        } else {
            mostrarAlerta('danger', data.mensaje || 'Error al actualizar nota');
        }
    }).catch(function() { mostrarAlerta('danger', 'No se pudo conectar con el servidor'); });
}

function cfgEliminarNota(id) {
    if (!confirm('Eliminar esta nota de preparacion?')) return;
    fetch(API_BASE + '/api/notas-preparacion/' + id, { method: 'DELETE' })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success) {
                cfgNotas = cfgNotas.filter(function(n) { return n.id_nota !== id; });
                renderizarCfgTab();
                mostrarAlerta('success', data.mensaje);
            } else {
                mostrarAlerta('danger', data.mensaje || 'Error al eliminar nota');
            }
        }).catch(function() { mostrarAlerta('danger', 'No se pudo conectar con el servidor'); });
}

// =========================================================
// FUNCIONES COMPARTIDAS (Seguridad, Impuestos, Categorias, Unidades, Conversiones, Precios)
// =========================================================

// --- Seguridad ---
function cfgGuardarSeguridad() {
    var payload = {
        analisis_dias_muertos: String(document.getElementById('cfgDiasMuertos').value || 30),
        requiere_admin_ajuste_precios: document.getElementById('cfgRestringirAjuste').checked ? '1' : '0',
        requiere_admin_config: document.getElementById('cfgRestringirConfig').checked ? '1' : '0',
        requiere_admin_mermas: document.getElementById('cfgRestringirMermas').checked ? '1' : '0'
    };
    fetch(API_BASE + '/api/config-inventario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.success) { for (var k in payload) cfgConfig[k] = payload[k]; mostrarAlerta('success', 'Parametros de seguridad guardados.'); }
        else mostrarAlerta('danger', data.mensaje || 'Error al guardar');
    }).catch(function() { mostrarAlerta('danger', 'No se pudo conectar con el servidor'); });
}

// --- Impuestos ---
function cfgGuardarImpuestos() {
    var iva = String(document.getElementById('cfgIvaGlobal').value || 0);
    var ico = String(document.getElementById('cfgIcoGlobal').value || 0);
    fetch(API_BASE + '/api/config-inventario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ iva_global: iva, ico_global: ico })
    }).then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.success) { cfgConfig['iva_global'] = iva; cfgConfig['ico_global'] = ico; mostrarAlerta('success', 'Impuestos guardados.'); }
        else mostrarAlerta('danger', data.mensaje || 'Error al guardar');
    }).catch(function() { mostrarAlerta('danger', 'No se pudo conectar con el servidor'); });
}

function cfgAplicarImpuestosProductos() {
    var iva = document.getElementById('cfgIvaGlobal').value;
    var ico = document.getElementById('cfgIcoGlobal').value;
    if (!confirm('Aplicar IVA (' + (iva || 0) + '%) e ICO (' + (ico || 0) + '%) a TODOS los productos activos?')) return;
    fetch(API_BASE + '/api/productos/aplicar-impuestos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ iva: iva, ico: ico })
    }).then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.success) { cfgConfig['iva_global'] = String(iva || 0); cfgConfig['ico_global'] = String(ico || 0); renderCfgInventario(document.getElementById('cfgContenido')); mostrarAlerta('success', data.mensaje + ' (' + (data.productos_actualizados || 0) + ' productos).'); }
        else mostrarAlerta('danger', data.mensaje || 'Error al aplicar impuestos');
    }).catch(function() { mostrarAlerta('danger', 'No se pudo conectar con el servidor'); });
}

// --- Categorias ---
function cfgHtmlCategorias() {
    var html =
        (cfgEsAdmin ? '<div class="row g-2 mb-3">' +
            '<div class="col-md-8"><input type="text" class="cfg-input" id="cfgInputNuevaCategoria" placeholder="Nombre de la nueva categoria..." onkeydown="if(event.key === \'Enter\'){cfgCrearCategoria();}"></div>' +
            '<div class="col-md-4"><button type="button" class="cfg-btn" style="width:100%" onclick="cfgCrearCategoria()"><i class="bi bi-plus-lg me-1"></i> Agregar categoria</button></div></div>' : '') +
        '<div class="table-responsive"><table class="ana-table"><thead>' +
        '<tr><th>Categoria</th><th class="text-end">Productos</th><th class="text-center">Acciones</th></tr></thead><tbody>';
    if (cfgCategorias.length === 0) {
        html += '<tr><td colspan="3"><div class="cfg-empty">No hay categorias registradas.</div></td></tr>';
    } else {
        cfgCategorias.forEach(function(c) {
            var esGeneral = (c.nombre === 'General');
            if (cfgCatEditando === c.id_categoria && cfgEsAdmin) {
                html += '<tr><td><input type="text" class="cfg-input" id="cfgInputEditCat" value="' + cfgEsc(c.nombre) + '" onkeydown="if(event.key === \'Enter\'){cfgGuardarEdicionCategoria(' + c.id_category + ');}"></td>' +
                    '<td class="text-end">' + (Number(c.num_productos) || 0) + '</td>' +
                    '<td class="text-center"><button class="cfg-btn sec" style="padding:5px 12px;font-size:.72rem" onclick="cfgGuardarEdicionCategoria(' + c.id_categoria + ')"><i class="bi bi-check-lg"></i></button> ' +
                    '<button class="cfg-icon-btn eliminar" style="width:auto;padding:5px 10px;font-size:.72rem" onclick="cfgCancelarEdicionCategoria()">Cancelar</button></td></tr>';
            } else {
                html += '<tr><td style="font-weight:600">' + cfgEsc(c.nombre) + (esGeneral ? ' <span class="ana-chip ana-chip-blue">default</span>' : '') + '</td>' +
                    '<td class="text-end">' + (Number(c.num_productos) || 0) + '</td>' +
                    '<td class="text-center">' +
                    '<button class="cfg-icon-btn" title="Renombrar" onclick="cfgEditarCategoria(' + c.id_categoria + ')" ' + cfgRo() + '><i class="bi bi-pencil"></i></button> ' +
                    (esGeneral ? '<span class="cfg-note">---</span>' : '<button class="cfg-icon-btn eliminar" title="Eliminar" onclick="cfgEliminarCategoria(' + c.id_categoria + ')" ' + cfgRo() + '><i class="bi bi-trash"></i></button>') +
                    '</td></tr>';
            }
        });
    }
    html += '</tbody></table></div>';
    return html;
}

function cfgCrearCategoria() {
    var input = document.getElementById('cfgInputNuevaCategoria');
    var nombre = input ? input.value.trim() : '';
    if (!nombre) { mostrarAlerta('warning', 'Escriba el nombre de la categoria.'); return; }
    fetch(API_BASE + '/api/categorias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombre })
    }).then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.success) { cfgCategorias.push({ id_categoria: data.idCategoria, nombre: nombre, num_productos: 0 }); cfgCatEditando = null; renderCfgInventario(document.getElementById('cfgContenido')); mostrarAlerta('success', data.mensaje); }
        else mostrarAlerta('danger', data.mensaje || 'Error al crear categoria');
    }).catch(function() { mostrarAlerta('danger', 'No se pudo conectar con el servidor'); });
}

function cfgEditarCategoria(id) { cfgCatEditando = id; renderCfgInventario(document.getElementById('cfgContenido')); }
function cfgCancelarEdicionCategoria() { cfgCatEditando = null; renderCfgInventario(document.getElementById('cfgContenido')); }

function cfgGuardarEdicionCategoria(id) {
    var input = document.getElementById('cfgInputEditCat');
    var nombre = input ? input.value.trim() : '';
    if (!nombre) { mostrarAlerta('warning', 'El nombre no puede estar vacio.'); return; }
    fetch(API_BASE + '/api/categorias/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombre })
    }).then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.success) { cfgCategorias.forEach(function(c) { if (c.id_categoria === id) c.nombre = nombre; }); cfgCatEditando = null; renderCfgInventario(document.getElementById('cfgContenido')); mostrarAlerta('success', data.mensaje); }
        else mostrarAlerta('danger', data.mensaje || 'Error al renombrar');
    }).catch(function() { mostrarAlerta('danger', 'No se pudo conectar con el servidor'); });
}

function cfgEliminarCategoria(id) {
    var cat = cfgCategorias.find(function(c) { return c.id_categoria === id; });
    var nombre = cat ? cat.nombre : 'esta categoria';
    if (!confirm('Eliminar la categoria "' + nombre + '"? Sus productos seran reasignados a "General".')) return;
    fetch(API_BASE + '/api/categorias/' + id, { method: 'DELETE' })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success) { cfgCategorias = cfgCategorias.filter(function(c) { return c.id_categoria !== id; }); renderCfgInventario(document.getElementById('cfgContenido')); mostrarAlerta('success', data.mensaje); }
            else mostrarAlerta('danger', data.mensaje || 'Error al eliminar categoria');
        }).catch(function() { mostrarAlerta('danger', 'No se pudo conectar con el servidor'); });
}

// --- Unidades de Medida ---
function cfgHtmlUnidades() {
    var html =
        (cfgEsAdmin ? '<div class="row g-2 mb-3">' +
            '<div class="col-md-4"><input type="text" class="cfg-input" id="cfgNuevaUnidad" placeholder="Nombre (Ej: Litro)"></div>' +
            '<div class="col-md-2"><input type="text" class="cfg-input" id="cfgNuevaUnidadAbr" placeholder="Abr. (Ej: L)"></div>' +
            '<div class="col-md-3"><select class="cfg-select" id="cfgNuevaUnidadTipo">' +
            '<option value="Unidad">Unidad</option><option value="Volumen">Volumen</option><option value="Peso">Peso</option></select></div>' +
            '<div class="col-md-3"><button type="button" class="cfg-btn" style="width:100%" onclick="cfgCrearUnidad()"><i class="bi bi-plus-lg me-1"></i> Agregar</button></div></div>' : '') +
        '<div class="table-responsive"><table class="ana-table"><thead>' +
        '<tr><th>Unidad</th><th>Abreviacion</th><th>Tipo</th><th class="text-center">Acciones</th></tr></thead><tbody>';
    if (cfgUnidades.length === 0) {
        html += '<tr><td colspan="4"><div class="cfg-empty">No hay unidades registradas.</div></td></tr>';
    } else {
        cfgUnidades.forEach(function(u) {
            if (cfgUniEditando === u.id_unidad && cfgEsAdmin) {
                html += '<tr><td><input type="text" class="cfg-input" id="cfgUniEditNombre" value="' + cfgEsc(u.nombre) + '"></td>' +
                    '<td><input type="text" class="cfg-input" id="cfgUniEditAbr" value="' + cfgEsc(u.abreviacion) + '"></td>' +
                    '<td><select class="cfg-select" id="cfgUniEditTipo">' + cfgSelectTipos(u.tipo) + '</select></td>' +
                    '<td class="text-center"><button class="cfg-btn sec" style="padding:5px 12px;font-size:.72rem" onclick="cfgGuardarUnidad(' + u.id_unidad + ')"><i class="bi bi-check-lg"></i></button> ' +
                    '<button class="cfg-icon-btn eliminar" style="width:auto;padding:5px 10px;font-size:.72rem" onclick="cfgCancelarUnidad()">Cancelar</button></td></tr>';
            } else {
                html += '<tr><td style="font-weight:600">' + cfgEsc(u.nombre) + '</td><td>' + cfgEsc(u.abreviacion) + '</td>' +
                    '<td><span class="ana-chip ana-chip-blue">' + cfgEsc(u.tipo) + '</span></td>' +
                    '<td class="text-center"><button class="cfg-icon-btn" title="Editar" onclick="cfgEditarUnidad(' + u.id_unidad + ')" ' + cfgRo() + '><i class="bi bi-pencil"></i></button> ' +
                    '<button class="cfg-icon-btn eliminar" title="Eliminar" onclick="cfgEliminarUnidad(' + u.id_unidad + ')" ' + cfgRo() + '><i class="bi bi-trash"></i></button></td></tr>';
            }
        });
    }
    html += '</tbody></table></div>';
    return html;
}

function cfgSelectTipos(actual) {
    return ['Unidad', 'Volumen', 'Peso'].map(function(t) {
        return '<option value="' + t + '"' + (t === actual ? ' selected' : '') + '>' + t + '</option>';
    }).join('');
}

function cfgCrearUnidad() {
    var nombre = (document.getElementById('cfgNuevaUnidad') || {}).value || '';
    var abr = (document.getElementById('cfgNuevaUnidadAbr') || {}).value || '';
    var tipo = (document.getElementById('cfgNuevaUnidadTipo') || {}).value || 'Unidad';
    nombre = nombre.trim();
    if (!nombre) { mostrarAlerta('warning', 'El nombre de la unidad es obligatorio.'); return; }
    fetch(API_BASE + '/api/unidades-medida', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombre, abreviacion: abr.trim(), tipo: tipo })
    }).then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.success) { cfgUnidades.push({ id_unidad: data.idUnidad, nombre: nombre, abreviacion: abr.trim(), tipo: tipo }); cfgUniEditando = null; renderCfgInventario(document.getElementById('cfgContenido')); mostrarAlerta('success', data.mensaje); }
        else mostrarAlerta('danger', data.mensaje || 'Error al crear unidad');
    }).catch(function() { mostrarAlerta('danger', 'No se pudo conectar con el servidor'); });
}

function cfgEditarUnidad(id) { cfgUniEditando = id; renderCfgInventario(document.getElementById('cfgContenido')); }
function cfgCancelarUnidad() { cfgUniEditando = null; renderCfgInventario(document.getElementById('cfgContenido')); }

function cfgGuardarUnidad(id) {
    var nombre = document.getElementById('cfgUniEditNombre').value.trim();
    var abr = document.getElementById('cfgUniEditAbr').value.trim();
    var tipo = document.getElementById('cfgUniEditTipo').value;
    if (!nombre) { mostrarAlerta('warning', 'El nombre de la unidad es obligatorio.'); return; }
    fetch(API_BASE + '/api/unidades-medida/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombre, abreviacion: abr, tipo: tipo })
    }).then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.success) { cfgUnidades.forEach(function(u) { if (u.id_unidad === id) { u.nombre = nombre; u.abreviacion = abr; u.tipo = tipo; } }); cfgUniEditando = null; renderCfgInventario(document.getElementById('cfgContenido')); mostrarAlerta('success', data.mensaje); }
        else mostrarAlerta('danger', data.mensaje || 'Error al actualizar unidad');
    }).catch(function() { mostrarAlerta('danger', 'No se pudo conectar con el servidor'); });
}

function cfgEliminarUnidad(id) {
    var uni = cfgUnidades.find(function(u) { return u.id_unidad === id; });
    var nombre = uni ? uni.nombre : 'esta unidad';
    if (!confirm('Eliminar la unidad de medida "' + nombre + '"?')) return;
    fetch(API_BASE + '/api/unidades-medida/' + id, { method: 'DELETE' })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success) { cfgUnidades = cfgUnidades.filter(function(u) { return u.id_unidad !== id; }); renderCfgInventario(document.getElementById('cfgContenido')); mostrarAlerta('success', data.mensaje); }
            else mostrarAlerta('danger', data.mensaje || 'Error al eliminar unidad');
        }).catch(function() { mostrarAlerta('danger', 'No se pudo conectar con el servidor'); });
}

// --- Conversiones ---
function cfgHtmlConversiones() {
    var html =
        '<p class="cfg-note mb-3"><i class="bi bi-info-circle me-1"></i>Define cuantas unidades destino equivalen a 1 unidad origen. Ej: 1 Botella = 16 Tragos.</p>' +
        (cfgEsAdmin ? '<div class="row g-2 mb-3">' +
            '<div class="col-md-4"><input type="text" class="cfg-input" id="cfgConvOrigen" placeholder="Origen (Ej: Botella)"></div>' +
            '<div class="col-md-4"><input type="text" class="cfg-input" id="cfgConvDestino" placeholder="Destino (Ej: Trago)"></div>' +
            '<div class="col-md-2"><input type="number" min="0.0001" step="0.0001" class="cfg-input" id="cfgConvFactor" placeholder="Factor" value="1"></div>' +
            '<div class="col-md-2"><button type="button" class="cfg-btn sec" style="width:100%" onclick="cfgAgregarConversion()"><i class="bi bi-plus-lg me-1"></i></button></div></div>' : '') +
        '<div class="table-responsive"><table class="ana-table"><thead>' +
        '<tr><th>Origen</th><th>Destino</th><th class="text-end">Factor</th><th class="text-center">Quitar</th></tr></thead><tbody>';
    if (cfgConversiones.length === 0) {
        html += '<tr><td colspan="4"><div class="cfg-empty">No hay conversiones definidas.</div></td></tr>';
    } else {
        cfgConversiones.forEach(function(c, i) {
            html += '<tr><td><input type="text" class="cfg-input" value="' + cfgEsc(c.unidad_origen) + '" oninput="cfgConversiones[' + i + '].unidad_origen = this.value"></td>' +
                '<td><input type="text" class="cfg-input" value="' + cfgEsc(c.unidad_destino) + '" oninput="cfgConversiones[' + i + '].unidad_destino = this.value"></td>' +
                '<td><input type="number" min="0.0001" step="0.0001" class="cfg-input" style="text-align:right" value="' + Number(c.factor) + '" oninput="cfgConversiones[' + i + '].factor = Number(this.value) || 1"></td>' +
                '<td class="text-center"><button class="cfg-icon-btn eliminar" title="Quitar" onclick="cfgQuitarConversion(' + i + ')" ' + cfgRo() + '><i class="bi bi-trash"></i></button></td></tr>';
        });
    }
    html += '</tbody></table></div>';
    if (cfgEsAdmin) html += '<div class="text-end mt-3"><button type="button" class="cfg-btn" onclick="cfgGuardarConversiones()"><i class="bi bi-save me-1"></i> Guardar matriz de conversiones</button></div>';
    return html;
}

function cfgAgregarConversion() {
    var origen = (document.getElementById('cfgConvOrigen') || {}).value || '';
    var destino = (document.getElementById('cfgConvDestino') || {}).value || '';
    var factor = Number((document.getElementById('cfgConvFactor') || {}).value || 1) || 1;
    if (!origen.trim() || !destino.trim()) { mostrarAlerta('warning', 'Origen y destino son obligatorios.'); return; }
    cfgConversiones.push({ unidad_origen: origen.trim(), unidad_destino: destino.trim(), factor: factor });
    renderCfgInventario(document.getElementById('cfgContenido'));
}

function cfgQuitarConversion(i) {
    if (!confirm('Quitar esta conversion?')) return;
    cfgConversiones.splice(i, 1);
    renderCfgInventario(document.getElementById('cfgContenido'));
}

function cfgGuardarConversiones() {
    var lista = cfgConversiones.map(function(c) {
        return { unidad_origen: c.unidad_origen, unidad_destino: c.unidad_destino, factor: Number(c.factor) || 1 };
    });
    fetch(API_BASE + '/api/conversiones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversiones: lista })
    }).then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.success) mostrarAlerta('success', 'Matriz de conversiones guardada.');
        else mostrarAlerta('danger', data.mensaje || 'Error al guardar');
    }).catch(function() { mostrarAlerta('danger', 'No se pudo conectar con el servidor'); });
}

// --- Ajuste Masivo de Precios ---
function cfgHtmlPrecios() {
    var opcionesCat = '<option value="">Todas las categorias</option>';
    cfgCategorias.forEach(function(c) { opcionesCat += '<option value="' + cfgEsc(c.nombre) + '">' + cfgEsc(c.nombre) + '</option>'; });
    return (cfgEsAdmin ? '' : '<div class="alert alert-warning py-2" style="font-size:.8rem"><i class="bi bi-shield-lock me-1"></i>Requiere Administrador.</div>') +
        '<div class="row g-3 mb-3">' +
        '<div class="col-md-3"><label class="cfg-label">Precio a ajustar</label><select class="cfg-select" id="cfgPrecioObjetivo"><option value="ambos">Venta y costo</option><option value="venta">Venta</option><option value="costo">Costo</option></select></div>' +
        '<div class="col-md-3"><label class="cfg-label">Operacion</label><select class="cfg-select" id="cfgPrecioOperacion" onchange="cfgToggleOperacion()"><option value="porcentaje">Porcentaje (%)</option><option value="monto">Valor fijo ($)</option></select></div>' +
        '<div class="col-md-3"><label class="cfg-label">Valor</label><input type="number" step="0.01" class="cfg-input" id="cfgPrecioValor" placeholder="Ej: 10 o -5"><div class="cfg-note" id="cfgPrecioValorAyuda">+10 = +10%, -10 = -10%</div></div>' +
        '<div class="col-md-3"><label class="cfg-label">Redondear a</label><select class="cfg-select" id="cfgPrecioRedondeo"><option value="0">Sin redondeo</option><option value="100">$100</option><option value="500">$500</option><option value="1000">$1.000</option></select></div></div>' +
        '<div class="row g-3 mb-3">' +
        '<div class="col-md-4"><label class="cfg-label">Alcance</label><select class="cfg-select" id="cfgPrecioAlcance" onchange="cfgToggleAlcance()"><option value="todos">Todos los activos</option><option value="categoria">Por categoria</option><option value="ids">Productos especificos</option></select></div>' +
        '<div class="col-md-4" id="cfgAlcanceCategoriaWrap" style="display:none"><label class="cfg-label">Categoria</label><select class="cfg-select" id="cfgPrecioCategoria">' + opcionesCat + '</select></div>' +
        '<div class="col-md-4" id="cfgAlcanceIdsWrap" style="display:none"><label class="cfg-label">IDs (separados por coma)</label><input type="text" class="cfg-input" id="cfgPrecioIds" placeholder="Ej: 1, 5, 12"></div></div>' +
        '<div class="d-flex gap-2 flex-wrap">' +
        '<button type="button" class="cfg-btn sec" onclick="cfgPrevisualizarPrecios()"><i class="bi bi-search me-1"></i> Previsualizar</button>' +
        '<button type="button" class="cfg-btn danger" onclick="cfgAplicarPrecios()" ' + cfgRo() + '><i class="bi bi-lightning-charge me-1"></i> Aplicar ajuste</button>' +
        '<span class="cfg-note align-self-center" id="cfgPrecioPreview"></span></div>';
}

function cfgToggleOperacion() {
    var op = document.getElementById('cfgPrecioOperacion').value;
    var ayuda = document.getElementById('cfgPrecioValorAyuda');
    if (ayuda) ayuda.innerHTML = op === 'porcentaje' ? '+10 = +10%, -10 = -10%' : '+1000 = +$1.000 por unidad';
}

function cfgToggleAlcance() {
    var alc = document.getElementById('cfgPrecioAlcance').value;
    document.getElementById('cfgAlcanceCategoriaWrap').style.display = alc === 'categoria' ? '' : 'none';
    document.getElementById('cfgAlcanceIdsWrap').style.display = alc === 'ids' ? '' : 'none';
}

function cfgSeleccionPrecios() {
    var alc = document.getElementById('cfgPrecioAlcance').value;
    var categoria = (document.getElementById('cfgPrecioCategoria') || {}).value || '';
    var idsTxt = (document.getElementById('cfgPrecioIds') || {}).value || '';
    var seleccion = { alcance: alc, categoria: categoria, ids: null };
    if (alc === 'ids') {
        seleccion.ids = idsTxt.split(',').map(function(s) { return Number(s.trim()); }).filter(function(n) { return n > 0; });
    }
    return seleccion;
}

function cfgProductosSeleccionados() {
    var s = cfgSeleccionPrecios();
    var lista = cfgProductos.filter(function(p) { return Number(p.activo) === 1; });
    if (s.alcance === 'categoria' && s.categoria) {
        lista = lista.filter(function(p) { return (p.categoria || '') === s.categoria; });
    } else if (s.alcance === 'ids' && s.ids && s.ids.length > 0) {
        lista = lista.filter(function(p) { return s.ids.indexOf(Number(p.id_producto)) !== -1; });
    }
    return lista;
}

function cfgPrevisualizarPrecios() {
    var lista = cfgProductosSeleccionados();
    var preview = document.getElementById('cfgPrecioPreview');
    if (preview) preview.innerHTML = '<i class="bi bi-box-seam me-1"></i>' + lista.length + ' producto(s) seran afectados.';
}

function cfgAplicarPrecios() {
    var s = cfgSeleccionPrecios();
    var lista = cfgProductosSeleccionados();
    if (lista.length === 0) { mostrarAlerta('warning', 'No hay productos que cumplan el alcance.'); return; }
    if (s.alcance === 'categoria' && !s.categoria) { mostrarAlerta('warning', 'Seleccione una categoria.'); return; }
    if (s.alcance === 'ids' && (!s.ids || s.ids.length === 0)) { mostrarAlerta('warning', 'Escriba al menos un ID valido.'); return; }
    var valor = Number(document.getElementById('cfgPrecioValor').value);
    if (!isFinite(valor) || valor === 0) { mostrarAlerta('warning', 'El valor del ajuste debe ser distinto de 0.'); return; }
    if (!confirm('Aplicar el ajuste a ' + lista.length + ' producto(s)?')) return;
    var payload = {
        alcance: s.alcance, categoria: s.alcance === 'categoria' ? s.categoria : null,
        ids: s.alcance === 'ids' ? s.ids : null, objetivo: document.getElementById('cfgPrecioObjetivo').value,
        operacion: document.getElementById('cfgPrecioOperacion').value, valor: valor,
        redondeo: document.getElementById('cfgPrecioRedondeo').value
    };
    fetch(API_BASE + '/api/productos/precios-masivo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.success) {
            mostrarAlerta('success', 'Ajuste aplicado a ' + (data.productos_afectados || 0) +
                ' producto(s). Venta: $' + Number(data.total_venta_antes || 0).toLocaleString('es-CO') +
                ' -> $' + Number(data.total_venta_despues || 0).toLocaleString('es-CO') + '.');
            cargarDatosConfiguracion();
        } else {
            mostrarAlerta('danger', data.mensaje || 'Error al aplicar ajuste');
        }
    }).catch(function() { mostrarAlerta('danger', 'No se pudo conectar con el servidor'); });
}
