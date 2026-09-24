const API_BASE = (typeof window.API_BASE_CFG!=='undefined'?window.API_BASE_CFG:(location.origin.indexOf('http')===0 && location.hostname!=='localhost' && location.hostname!=='127.0.0.1'?location.origin:''));
function isDemoMode(){ try{ return localStorage.getItem('demo')==='1' || new URLSearchParams(location.search).get('demo')==='1'; }catch(e){return false;} }
function demoActualizarBanner(){ var b=document.getElementById('demoBanner'); if(!b) return; var on=isDemoMode(); b.style.display=on?'flex':'none'; try{ document.body.classList.toggle('demo-active', on); }catch(e){} }
function demoEntrar(){ localStorage.setItem('demo','1'); location.href=location.pathname+'?demo=1'; }
function demoSalir(){ localStorage.removeItem('demo'); location.href=location.pathname; }
function demoReset(){ if(!confirm('¿Reiniciar datos de entrenamiento? Se borrarán pedidos de prueba.')) return; fetch(API_BASE+'/api/demo/reset',{method:'POST',headers:{'Content-Type':'application/json','X-Demo':'1'}}).then(r=>r.json()).then(j=>{ alert(j.mensaje||'Demo reseteado'); location.reload(); }); }
(function(){ const _fetch=window.fetch; window.fetch=function(url,opts){ opts=opts||{}; opts.headers=opts.headers||{}; if(isDemoMode()){ if(opts.headers instanceof Headers) opts.headers.set('X-Demo','1'); else opts.headers['X-Demo']='1'; if(typeof url==='string' && url.indexOf('/api/')!==-1 && url.indexOf('demo=')===-1) url+=(url.indexOf('?')===-1?'?':'&')+'demo=1'; } return _fetch(url,opts); }; })();
document.addEventListener('DOMContentLoaded', function(){ demoActualizarBanner(); if(new URLSearchParams(location.search).get('demo')==='1') localStorage.setItem('demo','1'); });
let modalComandero = null;
let mesaSeleccionada = null;
let productos = [];
let carrito = [];
let usuario = null;
let jornadaActiva = null;
let resumenJornada = null;

let todasLasMesas = [];
let filtroActual = 'Todas';
let busquedaActual = '';

var catalogoPresentaciones = [];
var catalogoNotas = [];
var categoriaRapidaActual = '';
var meserosComanda = [];

const ZONA_ICONOS = { 'VIP': 'bi-star-fill', 'Pista Principal': 'bi-music-note-beamed', 'Barra': 'bi-cup-straw', 'Terraza': 'bi-sun' };
var PERMISOS_USUARIO=[];
var NAV_PERMISOS_RB={navMesas:null,navInventario:'gestionar_inventario',navAnalisisInventario:'can_access_inventory_analytics',navConfiguracion:'gestionar_configuracion',navConfigInventario:'gestionar_configuracion',navCaja:'ver_caja',navFinanzas:'__SOLO_ADMIN__',navProveedores:'gestionar_proveedores',navCompras:'gestionar_proveedores',navUsuarios:'crear_usuarios',navReportes:'ver_reportes',navFacturacion:'ver_caja',navMermas:'registrar_mermas',navDevoluciones:'gestionar_proveedores',navSpeedBar:'gestionar_inventario',navSocios:'ver_caja',navVales:'ver_caja'};
function esAdminRB(){try{var u=usuario||JSON.parse(localStorage.getItem('usuario')||'{}');if(!u)return false;if(Number(u.id_rol)===1)return true;var r=(u.rol||'').toLowerCase();return r==='administrador'||r==='admin';}catch(e){return false;}}
function tienePermisoRB(c){if(!c)return true;if(esAdminRB())return true;var p=PERMISOS_USUARIO;if(!p.length&&usuario&&Array.isArray(usuario.permisos))p=usuario.permisos;return p.indexOf(c)!==-1;}
function mostrarOcultarNav(id,ver){try{var el=document.getElementById(id);if(!el)return;var li=el.closest('li');if(li)li.style.display=ver?'':'none';else el.style.display=ver?'':'none';}catch(e){}}
function esBartenderRB(){try{var u=typeof usuario!=='undefined'?usuario:null;if(!u)try{u=JSON.parse(localStorage.getItem('usuario')||'{}');}catch(e){}if(!u)return false;var r=String(u.rol||'').toLowerCase();return r.indexOf('bartender')!==-1||r.indexOf('barman')!==-1;}catch(e){return false;}}
function esZonaBarra(z){return String(z||'').toLowerCase().indexOf('barra')!==-1;}
function mesaZonaPorId(idMesa){try{var m=(typeof todasLasMesas!=='undefined'?todasLasMesas:[]).find(function(x){return Number(x.id_mesa)===Number(idMesa);});return m?m.zona||'':'';}catch(e){return '';}}
function bloqueoZonaBartender(idMesa){if(!esBartenderRB())return false;if(!esZonaBarra(mesaZonaPorId(idMesa))){try{if(typeof mostrarToast==='function')mostrarToast('danger','Solo puedes operar mesas de la zona Barra.');}catch(e){}return true;}return false;}
function esMeseroRB(){try{var u=typeof usuario!=='undefined'?usuario:null;if(!u)try{u=JSON.parse(localStorage.getItem('usuario')||'{}');}catch(e){}if(!u)return false;if(Number(u.id_rol)===3)return true;var r=String(u.rol||'').toLowerCase();return r.indexOf('meser')!==-1;}catch(e){return false;}}
function esGerenteRB(){try{var u=typeof usuario!=='undefined'?usuario:null;if(!u)try{u=JSON.parse(localStorage.getItem('usuario')||'{}');}catch(e){}if(!u)return false;if(Number(u.id_rol)===9)return true;var r=String(u.rol||'').toLowerCase();return r.indexOf('gerente')!==-1||r.indexOf('supervisor')!==-1;}catch(e){return false;}}
function bloqueoZonaMesero(idMesa){if(!esMeseroRB())return false;if(esZonaBarra(mesaZonaPorId(idMesa))){try{if(typeof mostrarToast==='function')mostrarToast('danger','No tienes permiso sobre la zona Barra.');}catch(e){}return true;}return false;}
// Permisos por zona (los define el backend: GET /api/mesas/zonas-permitidas).
var ZONAS_PERMITIDAS={estructura:[],operativa:[],cargadas:false};
function cargarZonasPermitidas(){
    return fetch(API_BASE+'/api/mesas/zonas-permitidas',{credentials:'include'})
        .then(function(r){return r.json();})
        .then(function(d){
            if(d&&d.success){
                if(d.estructura==='todas'||d.operativa==='todas'){
                    ZONAS_PERMITIDAS={estructura:'todas',operativa:'todas',cargadas:true};
                }else{
                    ZONAS_PERMITIDAS={estructura:d.estructura||[],operativa:d.operativa||[],cargadas:true};
                }
            }
        })
        .catch(function(){});
}
function listaZonasPerm(tipo){
    if(!ZONAS_PERMITIDAS.cargadas) return null; // aun sin cargar: no filtrar
    if(esAdminRB()||esGerenteRB()) return null; // sin restriccion
    var l=ZONAS_PERMITIDAS[tipo];
    if(l==='todas') return null;
    return l||[];
}
function puedeZonaOperativa(z){var l=listaZonasPerm('operativa');if(!l)return true;return l.indexOf(z)!==-1;}
function puedeZonaEstructura(z){var l=listaZonasPerm('estructura');if(!l)return true;return l.indexOf(z)!==-1;}
function filtrarSidebarRB(){try{var u=usuario||JSON.parse(localStorage.getItem('usuario')||'{}');var rl=(u.rol||'').toLowerCase();var isOp=rl.indexOf('meser')!==-1||rl.indexOf('bartender')!==-1||rl.indexOf('barman')!==-1;var isAdmin=esAdminRB();for(var id in NAV_PERMISOS_RB){var el=document.getElementById(id);if(!el)continue;if(id==='navMesas'&&isAdmin){mostrarOcultarNav('navMesas',false);continue;}if(id==='navFinanzas'){mostrarOcultarNav('navFinanzas',isAdmin);continue;}if(id==='navCaja'&&isAdmin){mostrarOcultarNav('navCaja',false);continue;}var req=NAV_PERMISOS_RB[id];var vis=tienePermisoRB(req);if(id==='navUsuarios'&&isOp&&!vis){vis=true;var sp=el.querySelector('span');if(sp)sp.textContent='Fichaje';}var li=el.closest('li');if(li)li.style.display=vis?'':'none';else el.style.display=vis?'':'none';}var puedeAnalisis=tienePermisoRB('can_access_inventory_analytics');if(!puedeAnalisis){var an=document.getElementById('navAnalisisInventario');if(an){var al=an.closest('li');if(al)al.style.display='none';else an.style.display='none';}}if(isAdmin){mostrarOcultarNav('navMesas',false);mostrarOcultarNav('navFinanzas',true);mostrarOcultarNav('navCaja',false);}else{mostrarOcultarNav('navFinanzas',false);}
try{
 if(!isAdmin&&esBartenderRB()){
  ['navInventario','navAnalisisInventario','navConfiguracion','navConfigInventario','navCaja','navProveedores','navCompras','navReportes','navFacturacion','navMermas','navDevoluciones','navSpeedBar','navSocios','navVales'].forEach(function(n){mostrarOcultarNav(n,false);});
  mostrarOcultarNav('navMesas',true);mostrarOcultarNav('navUsuarios',true);
  var _nu=document.getElementById('navUsuarios');if(_nu){var _sp=_nu.querySelector('span');if(_sp)_sp.textContent='Fichaje';}
 }
}catch(e){}
if(isOp){var m=document.getElementById('navMesas');if(m){var ml=m.closest('li');if(ml)ml.style.display='';}var nu=document.getElementById('navUsuarios');if(nu){var nl=nu.closest('li');if(nl)nl.style.display='';}} }catch(e){console.error('filtrarSidebarRB',e);}}
function esCajeroActualRB(){ try{ var u=typeof usuario!=='undefined'?usuario:null; if(!u) try{u=JSON.parse(localStorage.getItem('usuario')||'{}');}catch(e){} if(!u) return false; var r=(u.rol||'').toLowerCase(); var idRol=Number(u.id_rol); return r.indexOf('cajer')!==-1 || r==='administrador' || r==='admin' || r.indexOf('admin')!==-1 || idRol===1; }catch(e){return false;} }
function puedeCrearPedidosRB(){if(typeof cajaEstaAbierta==='function'&&!cajaEstaAbierta())return false;try{if(esAdminRB())return true;if(tienePermisoRB('can_create_orders'))return true;if(typeof tienePermiso==='function'&&tienePermiso('can_create_orders'))return true;return false;}catch(e){return false;}}
function puedeCobrarRB(){ try{ if(esAdminRB()) return true; if(typeof esCajeroActualRB==='function'&&esCajeroActualRB()) return true; if(tienePermisoRB('cobrar_cuentas')) return true; if(typeof tienePermiso==='function'&&tienePermiso('cobrar_cuentas')) return true; return false; }catch(e){ return false; } }
function mostrarAccesoRestringidoRB(){try{var __ahora=Date.now();if(window.__ultimoAvisoAcceso&&__ahora-window.__ultimoAvisoAcceso<5000)return;window.__ultimoAvisoAcceso=__ahora;}catch(__e){}try{if(typeof mostrarToast==='function')mostrarToast('danger','\uD83D\uDEAB Acceso Restringido — No tienes permisos suficientes para acceder a este m\u00f3dulo.');}catch(e){}try{var c=document.getElementById('contenedorAlertas');if(c)c.innerHTML='<div class="alert alert-danger alert-dismissible fade show" style="border-radius:12px"><strong>\uD83D\uDEAB Acceso Restringido</strong><br>No tienes permisos suficientes para acceder a este m\u00f3dulo.<button type="button" class="btn-close" data-bs-dismiss="alert"></button></div>';}catch(e){}void 0;}
function verificarAccesoRB(c){if(tienePermisoRB(c))return true;mostrarAccesoRestringidoRB();return false;}

document.addEventListener('DOMContentLoaded', function() {
    var guardado = localStorage.getItem('usuario');
    if (guardado) {
        usuario = JSON.parse(guardado);
        document.getElementById('nombreUsuario').textContent = usuario.nombre || 'Usuario';
    } else {
        usuario = { id_usuario: null, nombre: 'Usuario' };
    }

    var modalEl = document.getElementById('modalComandero');
    if (modalEl) {
        modalComandero = new bootstrap.Modal(modalEl);
    }

    cargarSesionYSusDatos();
});

function cargarPanelFinanzas() {
    try { if (typeof esAdminRB === 'function' && !esAdminRB()) { mostrarAccesoRestringidoRB(); return; } } catch (e) {}
    renderVistaMonitorAdmin();
}
function abrirFinanzasExternasAdmin() {
    try {
        if (typeof abrirModalFinanzasExternas === 'function') { abrirModalFinanzasExternas(); return; }
    } catch (e) {}
    try { if (typeof mostrarToast === 'function') mostrarToast('danger', 'Módulo de finanzas no disponible. Recarga la página.'); } catch (e) {}
}
function cargarMesas() {
    try { if (typeof esAdminRB === 'function' && esAdminRB()) { renderVistaMonitorAdmin(); return; } } catch (e) {}
    activarNav('navMesas');

    var btnRefresh = document.getElementById('btnRefresh');
    if (btnRefresh) {
        btnRefresh.classList.add('spinning');
        setTimeout(function() { btnRefresh.classList.remove('spinning'); }, 800);
    }

    var contenedor = document.getElementById('contenedorZonas');
    if (!contenedor) {
        reconstruirDOMMesas();
        contenedor = document.getElementById('contenedorZonas');
    }
    contenedor.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>';

    fetch(API_BASE + '/api/jornada/activa')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success) {
                jornadaActiva = data.jornada;
                resumenJornada = data.resumen;
            } else {
                jornadaActiva = null;
                resumenJornada = null;
            }
        })
        .catch(function() {})
        .then(function() {
            actualizarBadgeJornada();
            return fetch(API_BASE + '/api/mesas');
        })
        .then(function(r) {
            if (!r.ok) throw new Error('Error ' + r.status);
            return r.json();
        })
        .then(function(data) {
            if (data.success) {
                todasLasMesas = data.mesas;
                actualizarKPIs(data.mesas);
                actualizarFiltrosCount(data.mesas);
                renderizarZonas(data.mesas);
            } else {
                mostrarAlerta('danger', data.mensaje || 'Error al obtener mesas');
            }
        })
        .catch(function(err) {
            console.error('Error:', err);
            mostrarAlerta('danger', 'No se pudo conectar con el servidor');
        });
}

function reconstruirDOMMesas() {
    var main = document.getElementById('main-content');
    main.innerHTML =
        '<div class="page-header"><h2><i class="bi bi-speedometer2"></i>Centro de Control</h2>' +
        '<div class="page-header-right">' +
        '<span class="jornada-badge jornada-cerrada" id="jornadaBadge"><span class="jd-dot"></span> CERRADA</span>' +
        '<button class="btn-refresh" onclick="cargarMesas()" id="btnRefresh"><i class="bi bi-arrow-clockwise"></i> Actualizar</button>' +
        '</div></div>' +
        '<div id="contenedorAlertas"></div>' +
        '<div class="kpi-row" id="contenedorKPI">' +
        '<div class="kpi-card kpi-ocupacion"><div class="kpi-top"><div class="kpi-label">Ocupacion</div><div class="kpi-icon"><i class="bi bi-pie-chart"></i></div></div><div class="kpi-value" id="kpiOcupacion">0 / 0</div><div class="kpi-sub">mesas ocupadas / total</div><div class="kpi-progress"><div class="kpi-progress-bar"><div class="kpi-progress-fill fill-blue" id="kpiOcupacionBar" style="width:0%"></div></div><div class="kpi-progress-label"><span id="kpiOcupacionPct">0%</span><span id="kpiOcupacionDisp">0 disponibles</span></div></div></div>' +
        '<div class="kpi-card kpi-clientes"><div class="kpi-top"><div class="kpi-label">Clientes Ahora</div><div class="kpi-icon"><i class="bi bi-people-fill"></i></div></div><div class="kpi-value" id="kpiClientes">0</div><div class="kpi-sub">aforo actual en el local</div></div>' +
        '<div class="kpi-card kpi-comandas"><div class="kpi-top"><div class="kpi-label">Comandas Activas</div><div class="kpi-icon"><i class="bi bi-receipt"></i></div></div><div class="kpi-value" id="kpiComandas">0</div><div class="kpi-sub">pedidos en curso</div></div>' +
        '<div class="kpi-card kpi-consumo"><div class="kpi-top"><div class="kpi-label">Consumo Noche</div><div class="kpi-icon"><i class="bi bi-currency-dollar"></i></div></div><div class="kpi-value" id="kpiConsumo">$0</div><div class="kpi-sub">total facturado hoy</div></div>' +
        '</div>' +
        '<div class="toolbar-row">' +
        '<div class="search-box"><i class="bi bi-search"></i><input type="text" id="buscadorMesas" placeholder="Buscar mesa por numero..." oninput="filtrarMesas()"></div>' +
        '<button class="btn-admin-mesas" onclick="abrirModalMesaAdmin()" style="background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:#fff;border:none;padding:9px 16px;border-radius:10px;font-weight:600;display:inline-flex;align-items:center;gap:8px;cursor:pointer;white-space:nowrap"><i class="bi bi-gear-fill"></i>Gestionar Mesas</button>' +
        '<div class="filter-pills" id="filterPills">' +
        '<button class="filter-pill active" data-filter="Todas" onclick="aplicarFiltro(\'Todas\', this)">Todas <span class="pill-count" id="countTodas">0</span></button>' +
        '<button class="filter-pill" data-filter="Disponible" onclick="aplicarFiltro(\'Disponible\', this)"><i class="bi bi-check-circle-fill" style="color:#22c55e"></i> Disponibles <span class="pill-count" id="countDisponibles">0</span></button>' +
        '<button class="filter-pill" data-filter="Ocupada" onclick="aplicarFiltro(\'Ocupada\', this)"><i class="bi bi-person-fill" style="color:#ef4444"></i> Ocupadas <span class="pill-count" id="countOcupadas">0</span></button>' +
        '</div></div>' +
        '<div id="contenedorZonas"></div>';
    try { var kr = document.getElementById('contenedorKPI'); if (kr && esMeseroOBartenderRB()) kr.style.display = 'none'; } catch (e) {}
}

// ===== MONITOR JORNADA ACTUAL (solo Admin: sin mapa operativo) =====
function fmtCOP(v) { var n = Number(v) || 0; return '$' + Math.round(n).toLocaleString('es-CO'); }
function renderVistaMonitorAdmin() {
    try { if (typeof inyectarCSSCaja === 'function') inyectarCSSCaja(); } catch (e) {}
    try { if (typeof activarNav === 'function') activarNav('navFinanzas'); } catch (e) {}
    try { mostrarOcultarNav('navMesas', false); mostrarOcultarNav('navFinanzas', true); } catch (e) {}
    var main = document.getElementById('main-content');
    if (!main) return;
    var badge = document.getElementById('jornadaBadge');
    var demo = document.getElementById('demoBanner');
    main.innerHTML =
        '<div class="page-header"><h2><i class="bi bi-bank"></i>Panel Financiero</h2>'
        + '<div class="page-header-right"><span class="jornada-badge jornada-cerrada" id="jornadaBadge"><span class="jd-dot"></span> ...</span>'
        + '<button class="btn-refresh" onclick="cargarMonitorJornada()"><i class="bi bi-arrow-clockwise"></i> Actualizar</button></div></div>'
        + '<div id="contenedorAlertas"></div>'
        + '<div class="caj-card" style="background:#0f172a;border:1px solid #1e293b;border-radius:14px;margin-bottom:16px">'
        + '<div style="padding:22px;text-align:center"><div style="font-size:1.1rem;font-weight:800;color:#f8fafc">Monitor de Jornada en Vivo</div>'
        + '<div style="font-size:.8rem;color:#94a3b8;margin:6px 0 14px">Supervisión en tiempo real. El mapa operativo de mesas está oculto para este rol.</div>'
        + '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button class="btn btn-primary" onclick="abrirModalMonitorJornada()"><i class="bi bi-display me-1"></i> Abrir Monitor de Jornada Actual</button>'
        + '<button class="btn btn-outline-light" onclick="cargarMonitorJornada()"><i class="bi bi-arrow-clockwise me-1"></i> Actualizar</button></div>'
        + '<div id="monitorJornadaHora" style="font-size:.72rem;color:#64748b;margin-top:10px"></div></div></div>'
        + '<div class="caj-kpi-grid" id="monitorCards" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px"></div>'
        + '<div class="caj-card" style="background:#0f172a;border:1px solid #1e293b;border-radius:14px;margin-top:16px">'
        + '<div style="padding:26px;text-align:center"><div style="font-size:.72rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:12px">Contabilidad externa</div>'
        + '<button class="btn btn-lg" style="background:linear-gradient(135deg,#059669,#10b981);color:#fff;font-weight:800;padding:14px 34px;border-radius:12px;border:none;box-shadow:0 6px 20px rgba(16,185,129,.35)" onclick="abrirFinanzasExternasAdmin()"><i class="bi bi-truck me-2"></i>Gestionar Compras y Proveedores</button>'
        + '<div style="font-size:.75rem;color:#64748b;margin-top:10px">Plata que salió a proveedores · no afecta la caja diaria</div></div></div>'
        + '<div id="contenedorZonas" style="display:none"></div><div id="contenedorKPI" style="display:none"></div><div class="toolbar-row" style="display:none"></div>';
    if (demo) { try { main.insertBefore(demo, main.firstChild); } catch (e) {} }
    if (badge) { try { var nb = document.getElementById('jornadaBadge'); if (nb && badge.innerHTML) nb.innerHTML = badge.innerHTML; } catch (e) {} }
    cargarMonitorJornada();
}
function monitorCardHTML(label, val, sub, color) {
    return '<div class="caj-kpi" style="background:#0f172a;border:1px solid #1e293b;border-radius:13px;padding:14px 16px;border-top:3px solid ' + color + '">'
        + '<div style="font-size:.68rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em">' + label + '</div>'
        + '<div style="font-size:1.5rem;font-weight:800;color:#f8fafc;margin-top:6px">' + val + '</div>'
        + '<div style="font-size:.7rem;color:#94a3b8;margin-top:3px">' + sub + '</div></div>';
}
function cargarMonitorJornada() {
    var box = document.getElementById('monitorCards');
    var hora = document.getElementById('monitorJornadaHora');
    if (box) box.innerHTML = '<div class="text-center py-4" style="color:#94a3b8;grid-column:1/-1"><div class="spinner-border text-primary"></div><div style="margin-top:8px;font-size:.82rem">Cargando jornada en vivo...</div></div>';
    fetch(API_BASE + '/api/finanzas/jornada-en-vivo', { credentials: 'include' })
        .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d: d }; }); })
        .then(function(w) {
            var d = w.d || {};
            if (!w.ok || !d.success) { if (box) box.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#f87171;padding:20px">' + escapeHTML(d.mensaje || 'Sin acceso') + '</div>'; return; }
            if (!d.abierta) { if (box) box.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#94a3b8;padding:24px">No hay jornada abierta actualmente.</div>'; if (hora) hora.textContent = ''; return; }
            if (hora) hora.textContent = 'Jornada #' + d.id_jornada + ' · actualizado ' + new Date().toLocaleTimeString('es-CO');
            var html = monitorCardHTML('Total Ingresado', fmtCOP(d.total_ingresado), 'jornada #' + d.id_jornada + ' · vendido ' + fmtCOP(d.total_vendido), '#3b82f6')
                + monitorCardHTML('Pagos en Efectivo', fmtCOP(d.efectivo), 'billetes y monedas', '#10b981')
                + monitorCardHTML('Pagos por Transferencia', fmtCOP(d.transferencia), 'Nequi · Daviplata · PSE · QR', '#8b5cf6')
                + monitorCardHTML('Pagos con Tarjeta', fmtCOP(d.tarjeta), 'débito · crédito', '#f59e0b')
                + monitorCardHTML('Total en Vales', fmtCOP(d.vales), 'crédito de la casa', '#ec4899')
                + monitorCardHTML('Cuentas por Cobrar (Mesas Abiertas)', fmtCOP(d.cuentas_por_cobrar), (d.num_mesas_abiertas || 0) + ' mesas · ' + (d.num_pedidos_abiertos || 0) + ' pedidos flotantes', '#ef4444');
            if (box) box.innerHTML = html;
            try {
                var mb = document.getElementById('monitorModalCards');
                if (mb && document.getElementById('modalMonitorJornada')) mb.innerHTML = html;
                var mh = document.getElementById('monitorModalHora');
                if (mh) mh.textContent = 'Jornada #' + d.id_jornada + ' · actualizado ' + new Date().toLocaleTimeString('es-CO');
            } catch (e) {}
        })
        .catch(function() { if (box) box.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#f87171;padding:20px">Sin conexión con el servidor</div>'; });
}
function abrirModalMonitorJornada() {
    var old = document.getElementById('modalMonitorJornada'); if (old) old.remove();
    var d = document.createElement('div');
    d.id = 'modalMonitorJornada';
    d.style.cssText = 'position:fixed;inset:0;background:rgba(2,6,23,.75);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px';
    d.innerHTML = '<div style="background:#0b1220;border:1px solid #334155;border-radius:16px;max-width:860px;width:100%;max-height:88vh;overflow:auto">'
        + '<div style="padding:14px 18px;border-bottom:1px solid #1e293b;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><strong style="color:#f8fafc"><i class="bi bi-display me-2"></i>Monitor de Jornada Actual</strong>'
        + '<div style="display:flex;gap:8px"><button class="btn btn-sm btn-primary" onclick="cargarMonitorJornada()"><i class="bi bi-arrow-clockwise"></i> Actualizar</button><button class="btn btn-sm btn-outline-light" onclick="document.getElementById(\'modalMonitorJornada\').remove()">Cerrar</button></div></div>'
        + '<div style="padding:18px"><div id="monitorModalHora" style="font-size:.72rem;color:#64748b;margin-bottom:10px"></div><div class="caj-kpi-grid" id="monitorModalCards" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px"><div class="text-center py-4" style="color:#94a3b8;grid-column:1/-1"><div class="spinner-border text-primary"></div></div></div></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function(e) { if (e.target === d) d.remove(); });
    fetch(API_BASE + '/api/finanzas/jornada-en-vivo', { credentials: 'include' })
        .then(function(r) { return r.json(); })
        .then(function(dd) {
            var mb = document.getElementById('monitorModalCards'); if (!mb) return;
            if (!dd.success || !dd.abierta) { mb.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#94a3b8;padding:20px">No hay jornada abierta.</div>'; return; }
            document.getElementById('monitorModalHora').textContent = 'Jornada #' + dd.id_jornada + ' · actualizado ' + new Date().toLocaleTimeString('es-CO');
            mb.innerHTML = monitorCardHTML('Total Ingresado', fmtCOP(dd.total_ingresado), 'vendido ' + fmtCOP(dd.total_vendido), '#3b82f6')
                + monitorCardHTML('Pagos en Efectivo', fmtCOP(dd.efectivo), 'billetes y monedas', '#10b981')
                + monitorCardHTML('Pagos por Transferencia', fmtCOP(dd.transferencia), 'Nequi · Daviplata · PSE · QR', '#8b5cf6')
                + monitorCardHTML('Pagos con Tarjeta', fmtCOP(dd.tarjeta), 'débito · crédito', '#f59e0b')
                + monitorCardHTML('Total en Vales', fmtCOP(dd.vales), 'crédito de la casa', '#ec4899')
                + monitorCardHTML('Cuentas por Cobrar (Mesas Abiertas)', fmtCOP(dd.cuentas_por_cobrar), (dd.num_mesas_abiertas || 0) + ' mesas flotantes', '#ef4444');
        })
        .catch(function() {});
}

// ===== KPIs =====
function esMeseroOBartenderRB(){try{var u=typeof usuario!=='undefined'?usuario:null;if(!u)try{u=JSON.parse(localStorage.getItem('usuario')||'{}');}catch(e){}if(!u)return false;var r=String(u.rol||'').toLowerCase();return r.indexOf('meser')!==-1||r.indexOf('bartender')!==-1||r.indexOf('barman')!==-1;}catch(e){return false;}}
function actualizarKPIs(mesas) {
    try {
        var kpiRow = document.getElementById('contenedorKPI');
        if (kpiRow) kpiRow.style.display = esMeseroOBartenderRB() ? 'none' : '';
    } catch (e) {}
    if (esMeseroOBartenderRB()) return;
    var total = mesas.length;
    var ocupadas = mesas.filter(function(m) { return m.estado === 'Ocupada'; }).length;
    var disponibles = mesas.filter(function(m) { return m.estado === 'Disponible'; }).length;
    var clientes = mesas.filter(function(m) { return m.estado === 'Ocupada'; }).reduce(function(sum, m) { return sum + (m.capacidad || 0); }, 0);
    var comandas = ocupadas;

    var elOcupacion = document.getElementById('kpiOcupacion');
    var elOcupacionBar = document.getElementById('kpiOcupacionBar');
    var elOcupacionPct = document.getElementById('kpiOcupacionPct');
    var elOcupacionDisp = document.getElementById('kpiOcupacionDisp');
    var elClientes = document.getElementById('kpiClientes');
    var elComandas = document.getElementById('kpiComandas');
    var elConsumo = document.getElementById('kpiConsumo');

    if (elOcupacion) elOcupacion.textContent = ocupadas + ' / ' + total;
    var pct = total > 0 ? Math.round((ocupadas / total) * 100) : 0;
    if (elOcupacionBar) elOcupacionBar.style.width = pct + '%';
    if (elOcupacionPct) elOcupacionPct.textContent = pct + '%';
    if (elOcupacionDisp) elOcupacionDisp.textContent = disponibles + ' disponibles';
    if (elClientes) elClientes.textContent = clientes;
    if (elComandas) elComandas.textContent = comandas;

    if (elConsumo && resumenJornada && resumenJornada.total_general) {
        elConsumo.textContent = '$' + Number(resumenJornada.total_general).toLocaleString();
    } else if (elConsumo) {
        elConsumo.textContent = '$0';
    }
}

// ===== JORNADA BADGE + VALIDACION CAJA =====
function cajaEstaAbierta(){ return !!jornadaActiva; }
function exigirCajaAbierta(){
    if(jornadaActiva) return true;
    var msg='<i class="bi bi-lock-fill me-1"></i> <strong>Caja CERRADA</strong> — Debe realizar la <strong>Apertura de Caja</strong> en <strong>Caja / Turno</strong> antes de tomar pedidos o agregar productos. <button class="btn btn-sm ms-2" style="background:#0f172a;color:#fff;border-radius:6px" onclick="iniciarCaja()">Ir a Caja</button>';
    if(typeof mostrarToast==='function') mostrarToast('danger','\uD83D\uDD12 Caja CERRADA — Debe realizar la Apertura de Caja antes de tomar pedidos.');
    if(typeof mostrarAlerta==='function') mostrarAlerta('danger',msg);
    return false;
}
function actualizarBadgeJornada() {
    var badge = document.getElementById('jornadaBadge');
    if (!badge) return;
    if (jornadaActiva) {
        badge.className = 'jornada-badge jornada-abierta';
        badge.innerHTML = '<span class="jd-dot"></span> ABIERTA';
        badge.title='Caja abierta — pedidos habilitados';
        badge.onclick=function(){};
    } else {
        badge.className = 'jornada-badge jornada-cerrada';
        badge.innerHTML = '<span class="jd-dot"></span> CERRADA';
        badge.title='Caja cerrada — clic para abrir (solo Cajero)';
        badge.style.cursor='pointer';
        badge.onclick=function(){
            if(typeof esCajeroActualRB==='function' && !esCajeroActualRB()){
                var _rr=(function(){ try{ var u=typeof usuario!=='undefined'?usuario:null; if(!u) u=JSON.parse(localStorage.getItem('usuario')||'{}'); return (u&&u.rol)||'Usuario'; }catch(e){ return 'Usuario'; } })();
                try{ if(typeof mostrarToast==='function') mostrarToast('danger','\uD83D\uDEAB Solo Cajero puede abrir caja. Tu rol: '+_rr); }catch(e){}
                try{ mostrarAlerta('danger','\uD83D\uDEAB Acceso restringido: Solo <b>Cajero</b> puede abrir caja.'); }catch(e){}
                return;
            }
            if(typeof iniciarCaja==='function') iniciarCaja();
        };
    }
}

// ===== FILTROS =====
function actualizarFiltrosCount(mesas) {
    var total = mesas.length;
    var disp = mesas.filter(function(m) { return m.estado === 'Disponible'; }).length;
    var ocu = mesas.filter(function(m) { return m.estado === 'Ocupada'; }).length;

    var elT = document.getElementById('countTodas');
    var elD = document.getElementById('countDisponibles');
    var elO = document.getElementById('countOcupadas');
    if (elT) elT.textContent = total;
    if (elD) elD.textContent = disp;
    if (elO) elO.textContent = ocu;
}

function aplicarFiltro(filtro, btn) {
    filtroActual = filtro;
    document.querySelectorAll('.filter-pill').forEach(function(p) { p.classList.remove('active'); });
    if (btn) btn.classList.add('active');
    renderizarZonas(todasLasMesas);
}

function filtrarMesas() {
    busquedaActual = document.getElementById('buscadorMesas').value.toLowerCase().trim();
    renderizarZonas(todasLasMesas);
}

function escNumJS(v) { return String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
function obtenerMesasFiltradas(mesas) {
    var soloBarra = false;
    try { soloBarra = esBartenderRB(); } catch (e) {}
    var soloNoBarra = false;
    try { soloNoBarra = esMeseroRB(); } catch (e) {}
    return mesas.filter(function(m) {
        if (soloBarra && !esZonaBarra(m.zona)) return false;
        if (soloNoBarra && esZonaBarra(m.zona)) return false;
        var pasaFiltro = filtroActual === 'Todas' || m.estado === filtroActual;
        var pasaBusqueda = !busquedaActual || String(m.numero).toLowerCase().indexOf(busquedaActual) !== -1 || String(m.nombre || '').toLowerCase().indexOf(busquedaActual) !== -1;
        return pasaFiltro && pasaBusqueda;
    });
}

// ===== ZONAS =====
var catalogoZonas = [];
var zonaOrden = {};

function cargarSesionYSusDatos() {
    fetch(API_BASE + '/api/sesion', { credentials: 'include' })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.autenticado && data.usuario) {
                usuario = data.usuario;
                localStorage.setItem('usuario', JSON.stringify(usuario));
                document.getElementById('nombreUsuario').textContent = usuario.nombre || 'Usuario';
                try{var rr=document.querySelector('.user-role');if(rr)rr.textContent=usuario.rol||'Usuario';}catch(e){}
                if(Array.isArray(usuario.permisos)) PERMISOS_USUARIO=usuario.permisos.slice();
            } else if (!usuario || !usuario.id_usuario) {
                window.location.href = '/';
                return;
            }
        })
        .catch(function() {
            if (!usuario || !usuario.id_usuario) {
                window.location.href = '/';
                return;
            }
        })
        .then(function() {
            if(!PERMISOS_USUARIO.length && usuario && usuario.id_rol){
                return fetch(API_BASE+'/api/roles/'+usuario.id_rol+'/permisos',{credentials:'include'}).then(function(r){return r.json();}).then(function(d){if(d.success&&d.permisos){PERMISOS_USUARIO=d.permisos.map(function(p){return p.codigo;});usuario.permisos=PERMISOS_USUARIO.slice();localStorage.setItem('usuario',JSON.stringify(usuario));} filtrarSidebarRB();}).catch(function(){filtrarSidebarRB();});
            } else { filtrarSidebarRB(); }
        })
        .then(function() {
            cargarCatalogoZonas();
            try { if (typeof cargarZonasPermitidas === 'function') cargarZonasPermitidas(); } catch (e) {}
            cargarMesas();
            cargarJornadaActiva();
            iniciarPollingMesas();
        });
}

function cargarCatalogoZonas() {
    return fetch(API_BASE + '/api/catalogos-mesas')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success) {
                catalogoZonas = data.zonas || [];
                zonaOrden = {};
                catalogoZonas.forEach(function(z, i) { zonaOrden[z.nombre] = z.color || ''; });
            }
        })
        .catch(function() {});
}

function renderizarZonas(mesas) {
    var contenedor = document.getElementById('contenedorZonas');
    contenedor.innerHTML = '';

    var filtradas = obtenerMesasFiltradas(mesas);

    if (filtradas.length === 0) {
        contenedor.innerHTML = '<div class="text-center py-5" style="color:#94a3b8"><i class="bi bi-inbox" style="font-size:3rem;display:block;margin-bottom:12px"></i>No se encontraron mesas con los filtros aplicados.</div>';
        return;
    }

    // Agrupar mesas por zona (DB). Fallback: zona 'VIP' si no tienen campo zona.
    var agrupadas = {};
    filtradas.forEach(function(m) {
        var z = m.zona || 'VIP';
        if (!agrupadas[z]) agrupadas[z] = [];
        agrupadas[z].push(m);
    });
    var nombresZona = Object.keys(agrupadas).sort(function(a, b) {
        var ia = (catalogoZonas.find(function(z) { return z.nombre === a; }) || {}).orden || 99;
        var ib = (catalogoZonas.find(function(z) { return z.nombre === b; }) || {}).orden || 99;
        return ia - ib;
    });

    nombresZona.forEach(function(zona) {
        var mesasZona = agrupadas[zona];
        var color = zonaOrden[zona] || '#3b82f6';
        var icono = ZONA_ICONOS[zona] || 'bi-grid-3x3-gap';

        var section = document.createElement('div');
        section.className = 'zone-section';

        var headerHTML = '<div class="zone-header">' +
            '<div class="zone-icon" style="background:' + color + ';color:#fff"><i class="bi ' + icono + '"></i></div>' +
            '<div class="zone-name">' + escapeHTML(zona) + '</div>' +
            '<div class="zone-count">' + mesasZona.length + ' mesa' + (mesasZona.length > 1 ? 's' : '') + '</div>' +
            '</div>';

        var gridHTML = '<div class="zone-grid">';
        mesasZona.forEach(function(mesa) {
            gridHTML += construirTarjetaMesa(mesa);
        });
        gridHTML += '</div>';

        section.innerHTML = headerHTML + gridHTML;
        contenedor.appendChild(section);
    });
}

function construirTarjetaMesa(mesa) {
    var clase = '', statusClass = '', statusLabel = '';
    if (mesa.estado === 'Disponible') { clase = 'mesa-disponible'; statusClass = 'status-disponible'; statusLabel = 'Disponible'; }
    else if (mesa.estado === 'Ocupada') { clase = 'mesa-ocupada'; statusClass = 'status-ocupada'; statusLabel = 'Ocupada'; }
    else { clase = ''; statusClass = 'status-default'; statusLabel = escapeHTML(mesa.estado); }

    // Informacion adicional: zona, mesero
    var meseroHTML = mesa.mesero_nombre
        ? '<div class="mesa-capacity" style="justify-content:center"><i class="bi bi-person-fill"></i> ' + escapeHTML(mesa.mesero_nombre) + '</div>'
        : '';

    var extraInfo = '';
    // Mesas ocupadas: mostrar tiempo transcurrido y monto consumido (se actualiza con fetch)
    if (mesa.estado === 'Ocupada') {
        extraInfo = '<div class="mesa-consumo-wrap" id="mesaInfo_' + mesa.id_mesa + '">' +
            '<div class="tiempo-widget"><i class="bi bi-hourglass-split"></i><span id="tiempo_' + mesa.id_mesa + '">--:--</span></div>' +
            '<div class="mesa-capacity" style="justify-content:center;margin-top:6px;font-weight:700;color:#34d399"><i class="bi bi-currency-dollar"></i> <span id="consumo_' + mesa.id_mesa + '">$0</span></div>' +
            '</div>';
    }

    var cajaCerrada = !jornadaActiva;
    var numQ = "'" + escNumJS(mesa.numero) + "'";
    var puedePedido = (function(){ try{ if(typeof puedeCrearPedidosRB==='function') return puedeCrearPedidosRB(); if(typeof puedeCrearPedidos==='function') return puedeCrearPedidos(); var hasPerm=true; if(typeof tienePermisoRB==='function') hasPerm=tienePermisoRB('can_create_orders'); else if(typeof tienePermiso==='function') hasPerm=tienePermiso('can_create_orders'); return !cajaCerrada && hasPerm; }catch(e){ return !cajaCerrada; }})();
    var puedeCobrar = (function(){ try{ return typeof puedeCobrarRB==='function' ? puedeCobrarRB() : true; }catch(e){ return false; } })();
    var accionMesa = '';
    if (cajaCerrada) {
        accionMesa = '<button class="btn-custom-action btn-sin-jornada" disabled title="Caja CERRADA — Debe realizar Apertura de Caja" style="opacity:.65;cursor:not-allowed"><i class="bi bi-lock-fill me-1"></i>Caja Cerrada</button><div style="font-size:.68rem;color:#f87171;margin-top:4px;text-align:center"><i class="bi bi-exclamation-circle"></i> Apertura requerida</div>';
    } else if (mesa.estado === 'Ocupada') {
        var btnPedir = puedePedido ? '<button class="mesa-boton mb-pedir" onclick="event.stopPropagation();seleccionarMesa(' + mesa.id_mesa + ',' + numQ + ',\'' + mesa.estado + '\')"><i class="bi bi-pencil"></i>Pedir</button>' : '<button class="mesa-boton" disabled title="Sin permiso can_create_orders" style="opacity:.55;cursor:not-allowed;background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;font-size:.72rem"><i class="bi bi-shield-lock me-1"></i>Sin permiso</button>';
        var btnCobrar = puedeCobrar ? '<button class="mesa-boton mb-cobrar" onclick="event.stopPropagation();abrirFacturacion(' + mesa.id_mesa + ',' + numQ + ')"><i class="bi bi-cash-stack"></i>Cobrar</button>' : '<button class="mesa-boton" disabled title="Se requiere permiso cobrar_cuentas" style="opacity:.55;cursor:not-allowed;background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;font-size:.72rem"><i class="bi bi-shield-lock me-1"></i>Sin permiso cobro</button>';
        accionMesa = '<div class="mesa-botones">' + btnPedir + btnCobrar +
            '<button class="mesa-boton mb-mover" onclick="event.stopPropagation();abrirModalMoverMesa(' + mesa.id_mesa + ',' + numQ + ')"><i class="bi bi-arrows-move"></i>Mover/Unir</button>' +
            '</div>';
    } else if (!puedePedido) {
        accionMesa = '<button class="btn-custom-action btn-sin-jornada" disabled title="Sin permiso: Permitir tomar y enviar pedidos desactivado" style="opacity:.65;cursor:not-allowed;background:#fef2f2;color:#b91c1c;border:1px solid #fecaca"><i class="bi bi-shield-lock me-1"></i>Sin permiso</button><div style="font-size:.68rem;color:#f87171;margin-top:4px;text-align:center"><i class="bi bi-exclamation-circle"></i> No autorizado para comandas</div>';
    } else {
        accionMesa = '<button class="btn-custom-action btn-pedir" onclick="event.stopPropagation();seleccionarMesa(' + mesa.id_mesa + ',' + numQ + ',\'' + mesa.estado + '\')"><i class="bi bi-pencil me-1"></i>Pedir</button>';
    }

    var quickActions = '';
    if (mesa.estado === 'Ocupada') {
        quickActions = '<div class="mesa-quick-actions">' +
            '<button class="mesa-quick-btn btn-precuenta" onclick="event.stopPropagation();verPreCuenta(' + mesa.id_mesa + ',' + numQ + ')" title="Pre-cuenta"><i class="bi bi-printer"></i></button>' +
            '<button class="mesa-quick-btn btn-call" onclick="event.stopPropagation();llamarMesero(' + numQ + ')" title="Llamar mesero"><i class="bi bi-bell"></i></button>' +
            '</div>';
    }

    return '<div class="card-mesa ' + clase + '" onclick="accionClickMesa(' + mesa.id_mesa + ',' + numQ + ',\'' + mesa.estado + '\')">' +
        '<div class="mesa-top-bar"></div>' +
        '<div class="card-body">' +
        '<div class="mesa-numero">' + escapeHTML(String(mesa.numero)) + '</div>' +
        '<div class="mesa-label">Mesa</div>' +
        '<div class="mesa-capacity" style="justify-content:center"><i class="bi bi-people-fill"></i> ' + mesa.capacidad + ' personas</div>' +
        meseroHTML +
        extraInfo +
        '<div class="status-indicator ' + statusClass + '"><span class="status-dot"></span>' + statusLabel + '</div>' +
        '<div class="mesa-actions">' + accionMesa + '</div>' +
        quickActions +
        '</div></div>';
}

var MESAS_POLL_TIMER = null;
var MESAS_POLL_RUNNING = false;
function iniciarPollingMesas() {
    detenerPollingMesas();
    MESAS_POLL_TIMER = setInterval(function() {
        if (document.hidden) return;
        if (!document.getElementById('contenedorZonas')) return;
        cargarEstadosMesasOcupadas();
    }, 30000);
}
function detenerPollingMesas() {
    if (MESAS_POLL_TIMER) { clearInterval(MESAS_POLL_TIMER); MESAS_POLL_TIMER = null; }
    MESAS_POLL_RUNNING = false;
}
if (typeof window !== 'undefined') {
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden && document.getElementById('contenedorZonas')) cargarEstadosMesasOcupadas();
    });
    window.addEventListener('pagehide', detenerPollingMesas);
    window.addEventListener('beforeunload', detenerPollingMesas);
}
function cargarEstadosMesasOcupadas() {
    if (MESAS_POLL_RUNNING) return;
    if (document.hidden) return;
    if (!document.getElementById('contenedorZonas')) return;
    var ocupadas = todasLasMesas.filter(function(m) { return m.estado === 'Ocupada'; });
    if (ocupadas.length === 0) return;
    MESAS_POLL_RUNNING = true;
    var ctrl = new AbortController();
    var tid = setTimeout(function() { try { ctrl.abort(); } catch (e) {} }, 8000);
    var ids = ocupadas.map(function(m) { return m.id_mesa; }).join(',');
    fetch(API_BASE + '/api/mesas/estados?ids=' + encodeURIComponent(ids), { signal: ctrl.signal })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            var arr = data.estados || (data.success && data.estado ? [data.estado] : []);
            arr.forEach(function(est) {
                var elT = document.getElementById('tiempo_' + est.id_mesa);
                if (elT) elT.textContent = formatearTiempo(est.minutos_transcurridos);
                var elC = document.getElementById('consumo_' + est.id_mesa);
                if (elC) elC.textContent = '$' + Number(est.total_consumido).toLocaleString();
            });
        })
        .catch(function() {})
        .then(function() { clearTimeout(tid); MESAS_POLL_RUNNING = false; });
}

function formatearTiempo(min) {
    var h = Math.floor(min / 60), m = min % 60;
    return (h > 0 ? h + 'h ' : '') + (m < 10 ? '0' : '') + m + 'm';
}

// ===== CLICK EN MESA =====
function accionClickMesa(idMesa, numero, estado) {
    if(!cajaEstaAbierta()){ exigirCajaAbierta(); return; }
    if (bloqueoZonaBartender(idMesa)) return;
    if (bloqueoZonaMesero(idMesa)) return;
    seleccionarMesa(idMesa, numero, estado);
}

// ===== COMANDERO / PEDIDOS =====
function seleccionarMesa(idMesa, numero, estado) {
    if(!cajaEstaAbierta()){ exigirCajaAbierta(); return; }
    if (bloqueoZonaBartender(idMesa)) return;
    if (bloqueoZonaMesero(idMesa)) return;
    if (estado === 'Ocupada') {
        mostrarAlerta('warning', 'Mesa ocupada. Verifique el pedido actual antes de crear uno nuevo.');
    }
    mesaSeleccionada = { id: idMesa, numero: numero, id_mesero: (todasLasMesas.find(function(m) { return m.id_mesa === idMesa; }) || {}).id_mesero, zona: mesaZonaPorId(idMesa) };
    carrito = [];
    categoriaRapidaActual = '';
    document.getElementById('tituloMesaModal').textContent = 'Tomar Pedido - Mesa ' + numero;
    document.getElementById('listaCarritoModal').innerHTML = '<li class="list-group-item text-center text-muted py-3">Sin productos en la comanda</li>';
    document.getElementById('txtTotalModal').textContent = '$0';
    document.getElementById('buscadorModal').value = '';

    var btnEnviar = document.getElementById('btnEnviarPedido');
    if (btnEnviar) btnEnviar.disabled = true;

    // Cargar selector de meseros (solo rol mesero) - mantiene selección si mesa ya tiene mesero
    if (typeof cargarMeserosComanda === 'function') cargarMeserosComanda();
    else if (typeof cargarCatalogosComanda === 'function') cargarCatalogosComanda();

    renderizarCategoriasRapidas();

    if (productos.length === 0) {
        cargarProductos();
    } else {
        renderizarProductos(productos);
    }
    if (modalComandero) modalComandero.show();
    setTimeout(function(){ if(typeof cargarPedidosActivos==='function') cargarPedidosActivos(); },300);
}
var cancelPendiente={tipo:null, mesaId:null, detalleId:null, item:null};
function tienePermisoCancel(){ try{ if(typeof tienePermiso==='function'&&tienePermiso('can_cancel_orders')) return true; if(typeof tienePermisoRB==='function'&&tienePermisoRB('can_cancel_orders')) return true; if(typeof esAdmin==='function'&&esAdmin()) return true; if(typeof esAdminRB==='function'&&esAdminRB()) return true; return false; }catch(e){ return false; } }
function cargarPedidosActivos(){
    var cont=document.getElementById('contenedorPedidosActivos');
    var lista=document.getElementById('listaPedidosActivos');
    var badge=document.getElementById('badgePedidosActivos');
    var btnCancel=document.getElementById('btnCancelarPedido');
    if(!cont||!lista){ console.warn('contenedorPedidosActivos no encontrado'); return; }
    var _mid = (typeof mesaSeleccionada!=='undefined' && mesaSeleccionada && mesaSeleccionada.id) ? mesaSeleccionada.id : null;
    if(!_mid){ lista.innerHTML='<div style="padding:10px;color:#f59e0b;font-size:.82rem">Mesa no seleccionada</div>'; cont.style.display='block'; return; }
    lista.innerHTML='<div style="padding:12px;text-align:center;color:#94a3b8"><div class="spinner-border spinner-border-sm text-primary"></div> Cargando pedidos activos...</div>';
    cont.style.display='block';
    if(badge) badge.textContent='…';
    if(btnCancel) btnCancel.style.display='none';
    var url = API_BASE+'/api/mesas/'+_mid+'/cuenta?t='+Date.now();
    fetch(url, {credentials:'include'}).then(function(r){ return r.json().then(function(d){ return {ok:r.ok, status:r.status, d:d}; }); }).then(function(w){
        var d=w.d;
        if(!w.ok || !d.success){
            lista.innerHTML='<div style="padding:10px;color:#dc2626;font-size:.78rem"><i class="bi bi-exclamation-triangle"></i> Error: '+escapeHTML(d.mensaje||('HTTP '+w.status))+'<br><small>Mesa id='+Number(_mid)+' — revisa consola</small></div>';
            if(badge) badge.textContent='0';
            return;
        }
        if(!d.detalles || !d.detalles.length){
            var dbg = d.debug? '<br><small style="color:#94a3b8">debug mesaId='+ (d.debug.mesaId||'')+' estado='+(d.debug.mesaCheck?d.debug.mesaCheck.estado:'?')+' — sin detalles Pendiente</small>' : '';
            lista.innerHTML='<div style="padding:12px;text-align:center;color:#64748b;font-size:.82rem"><i class="bi bi-inbox" style="font-size:1.4rem;display:block;margin-bottom:4px"></i>Sin pedidos activos en esta mesa'+dbg+'</div>';
            if(badge) badge.textContent='0';
            if(btnCancel) btnCancel.style.display='none';
            return;
        }
        if(badge) badge.textContent=d.detalles.length;
        if(btnCancel) btnCancel.style.display='block';
        var html='';
        var meseroCab = d.mesero_nombre || (d.detalles[0] && d.detalles[0].mesero_nombre) || '';
        if (meseroCab) html += '<div style="padding:8px 10px;background:#eff6ff;border-bottom:1px solid #dbeafe;font-size:.8rem;color:#1e40af;font-weight:700"><i class="bi bi-person-fill me-1"></i>Mesero responsable: ' + escapeHTML(meseroCab) + '</div>';
        d.detalles.forEach(function(it){
            var idDet=it.id_detalle||it.id||it.id_producto;
            var est = it.pedido_estado||it.estado||'';
            var nombreSeguro = escapeHTML(it.nombre||('Producto #'+it.id_producto));
            var comandadoPor = escapeHTML(it.mesero_nombre || d.mesero_nombre || 'Sin asignar');
            html+='<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid #f1f5f9">'
                +'<div style="flex:1"><div style="font-weight:700;color:#0f172a;font-size:.85rem">'+nombreSeguro+' <small style="color:#94a3b8;font-weight:400">['+escapeHTML(est)+']</small></div><div style="font-size:.72rem;color:#64748b">'+Number(it.cantidad)+' x $'+Number(it.precio_unitario).toLocaleString()+' = <b>$'+Number(it.subtotal).toLocaleString()+'</b></div><small style="display:block;color:#6c757d;font-size:.85em"><i class="bi bi-person-badge"></i> Comandado por: '+comandadoPor+'</small></div>'
                +'<button class="btn btn-sm" style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:8px;padding:4px 8px;font-weight:700;font-size:.72rem" data-detalle="'+escapeHTML(String(idDet))+'" data-nombre="'+escapeHTML(it.nombre||'')+'" data-cantidad="'+Number(it.cantidad)+'" data-producto="'+Number(it.id_producto)+'" data-pedido="'+Number(it.id_pedido)+'" onclick="solicitarCancelacionItem(this.dataset.detalle,this.dataset.nombre,Number(this.dataset.cantidad),Number(this.dataset.producto),Number(this.dataset.pedido))"><i class="bi bi-trash me-1"></i>Eliminar</button>'
                +'</div>';
        });
        lista.innerHTML=html;
    }).catch(function(err){
        console.error('[PedidosActivos] fetch error', err);
        lista.innerHTML='<div style="padding:10px;color:#dc2626;font-size:.78rem"><i class="bi bi-wifi-off"></i> No se pudo conectar a '+url+'<br><small>'+String(err)+'</small></div>';
        if(badge) badge.textContent='!';
    });
}
function solicitarCancelacionMesa(){
    if(!mesaSeleccionada) return;
    cancelPendiente={tipo:'pedido', mesaId:mesaSeleccionada.id, detalleId:null, item:null};
    var info=document.getElementById('cancelAuthInfo');
    if(info) info.innerHTML='<strong>Mesa '+escapeHTML(String(mesaSeleccionada.numero))+'</strong> — se cancelará <strong>todo el pedido pendiente</strong> ('+ escapeHTML(document.getElementById('badgePedidosActivos')?document.getElementById('badgePedidosActivos').textContent:'?') +' items). Esta acción se auditará.';
    prepararModalCancel();
}
function solicitarCancelacionItem(idDet, nombre, cantidad, idProd, idPed){
    cancelPendiente={tipo:'item', mesaId: (mesaSeleccionada?mesaSeleccionada.id:null), detalleId:idDet, item:{nombre:nombre,cantidad:cantidad, id_producto:idProd, id_pedido:idPed}};
    var info=document.getElementById('cancelAuthInfo');
    if(info) info.innerHTML='<strong>'+escapeHTML(nombre)+'</strong> x'+Number(cantidad)+' — se eliminará este artículo del pedido. Requiere motivo y autorización.';
    prepararModalCancel();
}
function prepararModalCancel(){
    var sel=document.getElementById('cancelMotivo');
    var otro=document.getElementById('cancelMotivoOtro');
    var pinG=document.getElementById('cancelPinGroup');
    var pinI=document.getElementById('cancelPin');
    var permInfo=document.getElementById('cancelPermInfo');
    if(sel) sel.value='';
    if(otro){ otro.value=''; otro.style.display='none'; }
    if(pinI) pinI.value='';
    var tiene=tienePermisoCancel();
    if(permInfo) permInfo.style.display=tiene?'block':'none';
    if(pinG) pinG.style.display=tiene?'none':'block';
    if(sel) sel.onchange=function(){ if(otro) otro.style.display=this.value==='Otro'?'block':'none'; };
    var modalEl=document.getElementById('modalCancelarAuth');
    if(modalEl){ var m=new bootstrap.Modal(modalEl); m.show(); }
    setTimeout(function(){
        var pinI2=document.getElementById('cancelPin');
        if(pinI2 && window.Numpad){
            pinI2.setAttribute('readonly','true');pinI2.setAttribute('inputmode','none');pinI2.style.caretColor='transparent';
            pinI2.onclick=function(e){e.preventDefault();Numpad.open(pinI2,{title:'PIN Gerente',allowDecimal:false,maxLength:6});};
            pinI2.addEventListener('focus',function(e){e.preventDefault();pinI2.blur();});
        }
    },200);
}
function confirmarCancelacionAuth(){
    var motivoEl=document.getElementById('cancelMotivo');
    var otroEl=document.getElementById('cancelMotivoOtro');
    var pinEl=document.getElementById('cancelPin');
    var motivo=motivoEl?motivoEl.value:'';
    if(motivo==='Otro' && otroEl) motivo=otroEl.value.trim();
    if(!motivo) { mostrarToast('warning','Seleccione un motivo de anulación'); return; }
    var pin=pinEl?pinEl.value.trim():'';
    var tiene=tienePermisoCancel();
    if(!tiene && !pin){ mostrarToast('warning','Ingrese el PIN Maestro del Gerente'); return; }
    var payload={motivo:motivo, pin:pin, id_usuario: (usuario&&usuario.id_usuario)||null};
    var url, body;
    if(cancelPendiente.tipo==='pedido'){
        url=API_BASE+'/api/mesas/'+cancelPendiente.mesaId+'/cancelar-pedido';
        body=payload;
    }else if(cancelPendiente.tipo==='item'){
        if(cancelPendiente.detalleId && !isNaN(Number(cancelPendiente.detalleId))){
            url=API_BASE+'/api/pedidos/detalle/'+cancelPendiente.detalleId+'/cancelar';
            body=payload;
            if(cancelPendiente.item) body.cantidad=cancelPendiente.item.cantidad;
        }else{
            url=API_BASE+'/api/mesas/'+cancelPendiente.mesaId+'/cancelar-item';
            body={id_detalle:cancelPendiente.detalleId, id_producto: cancelPendiente.item?cancelPendiente.item.id_producto:null, id_pedido: cancelPendiente.item?cancelPendiente.item.id_pedido:null, motivo:motivo, pin:pin, id_usuario: payload.id_usuario};
        }
    }else return;
    var btn=document.querySelector('#modalCancelarAuth .btn-danger');
    if(btn){ btn.disabled=true; btn.innerHTML='<span class="spinner-border spinner-border-sm"></span> Procesando...'; }
    fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include', body:JSON.stringify(body)}).then(function(r){return r.json().then(function(d){return {ok:r.ok, d:d}})}).then(function(w){
        if(btn){ btn.disabled=false; btn.innerHTML='<i class="bi bi-x-circle me-1"></i> Confirmar Anulación'; }
        if(w.ok && w.d.success){
            var m=bootstrap.Modal.getInstance(document.getElementById('modalCancelarAuth')); if(m) m.hide();
            if(modalComandero){ try{ modalComandero.hide(); }catch(e){} }
            mostrarToast('success', w.d.mensaje||'Anulación registrada y auditada');
            cargarMesas();
            if(cancelPendiente.mesaId) setTimeout(function(){ if(typeof cargarPedidosActivos==='function') cargarPedidosActivos(); },600);
        }else{
            mostrarToast('danger', (w.d&&w.d.mensaje)||'Error al anular');
        }
    }).catch(function(){ if(btn){ btn.disabled=false; btn.innerHTML='<i class="bi bi-x-circle me-1"></i> Confirmar Anulación'; } mostrarToast('danger','No se pudo conectar'); });
}

// Cargar presentaciones + notas + meseros para la comanda
function cargarCatalogosComanda() {
    if (catalogoPresentaciones.length === 0 || catalogoNotas.length === 0) {
        fetch(API_BASE + '/api/catalogos-mesas')
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (data.success) {
                    catalogoPresentaciones = data.presentaciones || [];
                    catalogoNotas = data.notas || [];
                    llenarSelectsComanda();
                }
            })
            .catch(function() {});
    } else {
        llenarSelectsComanda();
    }
    if (meserosComanda.length === 0) {
        cargarMeserosComanda();
    }
}

function llenarSelectsComanda() {
    var presSel = document.getElementById('presComandaModal');
    if (presSel) {
        presSel.innerHTML = '<option value="">Por defecto</option>';
        catalogoPresentaciones.forEach(function(p) {
            var op = document.createElement('option');
            op.value = p.id_presentacion;
            op.textContent = p.nombre + ' (' + (p.multiplicador !== undefined ? Number(p.multiplicador) : (p.factor || '')) + ')';
            presSel.appendChild(op);
        });
    }
    var notaSel = document.getElementById('notaComandaModal');
    if (notaSel) {
        notaSel.innerHTML = '<option value="">Sin nota</option>';
        catalogoNotas.forEach(function(n) {
            var op = document.createElement('option');
            op.value = n.id_nota;
            op.textContent = n.nombre;
            notaSel.appendChild(op);
        });
    }
}

// Helper: obtiene el ID del mesero autenticado desde la sesión (usuario global / localStorage / JWT)
function obtenerIdMeseroSesion() {
    try {
        if (usuario && usuario.id_usuario) return Number(usuario.id_usuario);
        var g = localStorage.getItem('usuario');
        if (g) { var u = JSON.parse(g); if (u && u.id_usuario) return Number(u.id_usuario); }
        var s = sessionStorage.getItem('usuario');
        if (s) { var u2 = JSON.parse(s); if (u2 && u2.id_usuario) return Number(u2.id_usuario); }
        // Intentar decodificar JWT si existe (localStorage token)
        var token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (token && token.split('.').length === 3) {
            try { var payload = JSON.parse(atob(token.split('.')[1])); if (payload.id || payload.id_usuario || payload.sub) return Number(payload.id || payload.id_usuario || payload.sub); } catch (e) {}
        }
    } catch (e) {}
    return null;
}
function esMeseroSesionActual() {
    try {
        var u = usuario || JSON.parse(localStorage.getItem('usuario')||'{}');
        var r = String(u.rol || u.nombre_rol || '').toLowerCase();
        var idRol = Number(u.id_rol);
        return r.indexOf('meser') !== -1 || idRol === 3;
    } catch(e){ return false; }
}
function actualizarMeseroAutoInfo() {
    var el = document.getElementById('meseroAutoNombre');
    if (!el) return;
    var nombre = (usuario && usuario.nombre) ? usuario.nombre : '';
    if (!nombre) { try { var g = localStorage.getItem('usuario'); if (g) nombre = JSON.parse(g).nombre || ''; } catch (e) {} }
    el.textContent = nombre || 'Usuario autenticado';
    var cont = document.getElementById('meseroAutoInfo');
    if (cont) cont.title = 'Pedido se registrará a nombre de: ' + (nombre || 'sesión actual');
}
function cargarMeserosComanda() {
    var isMesero = esMeseroSesionActual();
    var isBartender = false;
    try { isBartender = esBartenderRB(); } catch (e) {}
    var cont = document.getElementById('meseroAutoInfo');
    var selWrap = document.getElementById('meseroSelectorWrap');
    // Crear wrap si no existe
    if (!selWrap) {
        var ref = document.getElementById('meseroAutoInfo');
        if (ref && ref.parentNode) {
            selWrap = document.createElement('div');
            selWrap.id = 'meseroSelectorWrap';
            selWrap.style.cssText = 'background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:8px 10px;display:none;flex-direction:column;gap:6px;margin-bottom:8px';
            selWrap.innerHTML = '<label style="font-size:.70rem;font-weight:700;color:#92400e;text-transform:uppercase;display:flex;align-items:center;gap:6px"><i class="bi bi-person-badge"></i> Mesero responsable * <span style="color:#dc2626">*</span></label><select id=\"meseroSelectorComanda\" class=\"form-select\" style=\"border-radius:8px;border:1px solid #fdba74\"><option value=\"\">-- Seleccione mesero --</option></select><small style=\"font-size:.68rem;color:#9a3412\">Obligatorio cuando quien digita es Cajero/Administrador</small>';
            ref.parentNode.insertBefore(selWrap, ref.nextSibling);
        }
    }
    if (isMesero || isBartender) {
        if (selWrap) selWrap.style.display = 'none';
        if (cont) cont.style.display = 'flex';
        actualizarMeseroAutoInfo();
    } else {
        if (cont) cont.style.display = 'none';
        if (selWrap) selWrap.style.display = 'flex';
        // La zona de la mesa decide el rol del selector: Barra -> bartender, resto -> mesero.
        var zonaSel = (typeof mesaSeleccionada !== 'undefined' && mesaSeleccionada && mesaSeleccionada.zona) ? mesaSeleccionada.zona : mesaZonaPorId(mesaSeleccionada && mesaSeleccionada.id);
        var quiereBarra = esZonaBarra(zonaSel);
        var lbl = selWrap ? selWrap.querySelector('label') : null;
        if (lbl) lbl.innerHTML = '<i class="bi bi-person-badge"></i> ' + (quiereBarra ? 'Personal de barra responsable *' : 'Mesero responsable *') + ' <span style="color:#dc2626">*</span>';
        // Si mesa ya tiene responsable asignado, preseleccionar
        var preselect = mesaSeleccionada && mesaSeleccionada.id_mesero ? Number(mesaSeleccionada.id_mesero) : null;
        // Cargar lista de responsables activos segun la zona
        var sel = document.getElementById('meseroSelectorComanda');
        if (!sel) return;
        sel.innerHTML = '<option value="">-- Seleccione ' + (quiereBarra ? 'personal de barra' : 'mesero') + ' --</option>';
        fetch(API_BASE + '/api/usuarios')
            .then(function(r){ return r.json(); })
            .then(function(data){
                if (!data.success) return;
                var meseros = (data.usuarios||[]).filter(function(u){
                    var rr = String(u.rol_nombre || u.rol || '').toLowerCase();
                    var idr = Number(u.id_rol);
                    if (quiereBarra) return rr.indexOf('bartender')!==-1 || rr.indexOf('barman')!==-1 || idr===7;
                    return rr.indexOf('mesero')!==-1 || rr.indexOf('mesera')!==-1 || idr===3;
                });
                if (!meseros.length) {
                    sel.innerHTML = '<option value="">' + (quiereBarra ? 'No hay personal de barra activo' : 'No hay meseros activos') + '</option>';
                    return;
                }
                meseros.forEach(function(m){
                    var op = document.createElement('option');
                    op.value = m.id_usuario;
                    op.textContent = m.nombre;
                    if (preselect && Number(m.id_usuario)===preselect) op.selected = true;
                    sel.appendChild(op);
                });
                // Si no hay preselect y solo uno, auto-seleccionar? No, forzar elección explícita
            })
            .catch(function(){});
    }
}

// Categorias de acceso rapido
function renderizarCategoriasRapidas() {
    var cont = document.getElementById('catQuickContainer');
    if (!cont) return;
    var categorias = [];
    productos.forEach(function(p) { if (p.categoria && categorias.indexOf(p.categoria) === -1) categorias.push(p.categoria); });
    if (categorias.length === 0) { cont.innerHTML = ''; return; }
    var html = '<button class="cat-quick-btn ' + (categoriaRapidaActual === '' ? 'active' : '') + '" onclick="filtrarCategoriaRapida(\'\',this)"><i class="bi bi-grid"></i><span>Todos</span></button>';
    categorias.forEach(function(c) {
        html += '<button class="cat-quick-btn ' + (categoriaRapidaActual === c ? 'active' : '') + '" onclick="filtrarCategoriaRapida(\'' + c.replace(/'/g, "\\'") + '\',this)"><i class="bi bi-tag"></i><span>' + c + '</span></button>';
    });
    cont.innerHTML = html;
}

function filtrarCategoriaRapida(categoria, btn) {
    categoriaRapidaActual = categoria;
    var cont = document.getElementById('catQuickContainer');
    if (cont) {
        var btns = cont.querySelectorAll('.cat-quick-btn');
        btns.forEach(function(b) { b.classList.remove('active'); });
        if (btn) btn.classList.add('active');
    }
    aplicarRapidaBusqueda();
}

function aplicarRapidaBusqueda() {
    var term = document.getElementById('buscadorModal').value.toLowerCase();
    var filtrados = productos.filter(function(p) {
        var pasaCat = !categoriaRapidaActual || p.categoria === categoriaRapidaActual;
        var pasaBus = !term || p.nombre.toLowerCase().indexOf(term) !== -1 || (p.categoria && p.categoria.toLowerCase().indexOf(term) !== -1);
        return pasaCat && pasaBus;
    });
    renderizarProductos(filtrados);
}

function aplicarPresentacionSeleccion() {
    actualizarCarrito();
}

function cargarProductos() {
    var cont = document.getElementById('contenedorProductosModal');
    cont.innerHTML = '<div class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div></div>';
    fetch(API_BASE + '/api/productos')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success) {
                productos = data.productos;
                renderizarProductos(productos);
                renderizarCategoriasRapidas();
            }
        })
        .catch(function() {
            cont.innerHTML = '<div style="padding:20px;color:#dc2626;text-align:center"><i class="bi bi-exclamation-triangle me-1"></i> Error al cargar productos</div>';
        });
}

function renderizarProductos(lista) {
    var cont = document.getElementById('contenedorProductosModal');
    cont.innerHTML = '';
    if (lista.length === 0) {
        cont.innerHTML = '<div style="padding:20px;color:#94a3b8;text-align:center"><i class="bi bi-search" style="font-size:1.5rem;display:block;margin-bottom:6px"></i>No se encontraron productos.</div>';
        return;
    }
    lista.forEach(function(p) {
        var itemEnCarrito = carrito.find(function(c) { return c.id_producto === p.id_producto; });
        var qtyBadge = '';
        if (itemEnCarrito && itemEnCarrito.cantidad > 0) {
            qtyBadge = '<div class="product-qty-badge">' + itemEnCarrito.cantidad + '</div>';
        }

        var col = document.createElement('div');
        col.className = 'col-6 col-md-4';
        col.innerHTML = '<div class="card-mesa product-card-wrap" style="cursor:pointer" onclick="agregarAlCarrito(' + p.id_producto + ')">' +
            '<div class="mesa-top-bar" style="background:linear-gradient(90deg,#3b82f6,#60a5fa)"></div>' +
            qtyBadge +
            '<div class="card-body" style="padding:14px 12px">' +
            '<h6 style="font-weight:700;color:#0f172a;margin-bottom:4px;font-size:0.88rem">' + escapeHTML(p.nombre) + '</h6>' +
            '<p style="color:#94a3b8;font-size:0.75rem;margin-bottom:6px">' + escapeHTML(p.categoria || '') + '</p>' +
            '<span style="color:#10b981;font-weight:700;font-size:0.95rem">$' + Number(p.precio).toLocaleString() + '</span></div></div>';
        cont.appendChild(col);
    });
}

function filtrarProductos() {
    aplicarRapidaBusqueda();
}

function agregarAlCarrito(idProducto) {
    if(!cajaEstaAbierta()){ exigirCajaAbierta(); return; }
    var _puedeAdd=true; try{ if(typeof puedeCrearPedidosRB==='function') _puedeAdd=puedeCrearPedidosRB(); else if(typeof puedeCrearPedidos==='function') _puedeAdd=puedeCrearPedidos(); }catch(e){} if(!_puedeAdd){ try{if(typeof mostrarToast==='function') mostrarToast('danger','\uD83D\uDEAB Sin permiso para tomar pedidos.');}catch(e){} return; }
    var prod = productos.find(function(p) { return p.id_producto === idProducto; });
    if (!prod) return;
    var existente = carrito.find(function(item) { return item.id_producto === idProducto; });
    if (existente) existente.cantidad++; else carrito.push({ id_producto: prod.id_producto, nombre: prod.nombre, precio_unitario: Number(prod.precio), cantidad: 1, observaciones: '' });
    actualizarCarrito();
}

function cambiarCantidadCarrito(index, delta) {
    if(!cajaEstaAbierta()){ exigirCajaAbierta(); return; }
    if (index < 0 || index >= carrito.length) return;
    carrito[index].cantidad += delta;
    if (carrito[index].cantidad <= 0) {
        carrito.splice(index, 1);
    }
    actualizarCarrito();
}

function quitarDelCarrito(idProducto) {
    var idx = carrito.findIndex(function(item) { return item.id_producto === idProducto; });
    if (idx !== -1) {
        if (carrito[idx].cantidad > 1) carrito[idx].cantidad--;
        else carrito.splice(idx, 1);
    }
    actualizarCarrito();
}

function limpiarBorrador(){
    if(carrito.length===0){
        if(modalComandero) try{ modalComandero.hide(); }catch(e){}
        return;
    }
    carrito=[];
    actualizarCarrito();
    mostrarToast('info','Borrador limpiado');
}
function actualizarCarrito() {
    var lista = document.getElementById('listaCarritoModal');
    var txtTotal = document.getElementById('txtTotalModal');
    var btnEnviar = document.getElementById('btnEnviarPedido');
    var btnLimpiar = document.getElementById('btnLimpiarBorrador');

    if (carrito.length === 0) {
        lista.innerHTML = '<li class="list-group-item text-center text-muted py-3">Sin productos en la comanda — Borrador vacío</li>';
        txtTotal.textContent = '$0';
        if (btnEnviar) btnEnviar.disabled = true;
        if (btnLimpiar){
            btnLimpiar.disabled = false;
            btnLimpiar.style.opacity='1';
            btnLimpiar.innerHTML='<i class="bi bi-box-arrow-left me-1"></i> Limpiar / Salir';
            btnLimpiar.title='Borrador vacío — Salir del comandero';
            btnLimpiar.style.background='#fff';
            btnLimpiar.style.color='#64748b';
        }
        renderizarProductos(productos);
        return;
    }

    var total = 0;
    lista.innerHTML = '';

    carrito.forEach(function(item, index) {
        var sub = item.cantidad * item.precio_unitario;
        total += sub;

        var li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center px-2 py-2';
        li.innerHTML =
            '<div style="flex:1;min-width:0">' +
                '<strong style="color:#0f172a;font-size:0.88rem;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escapeHTML(item.nombre) + '</strong>' +
                '<small style="color:#64748b;font-size:0.76rem">$' + Number(item.precio_unitario).toLocaleString() + ' c/u</small>' +
            '</div>' +
            '<div class="d-flex align-items-center gap-1">' +
                '<button class="btn btn-sm" style="background:#fee2e2;color:#dc2626;border:none;width:28px;height:28px;border-radius:8px;font-weight:700;padding:0;display:flex;align-items:center;justify-content:center" onclick="cambiarCantidadCarrito(' + index + ', -1)">-</button>' +
                '<span style="min-width:24px;text-align:center;font-weight:700;font-size:0.9rem;color:#0f172a">' + item.cantidad + '</span>' +
                '<button class="btn btn-sm" style="background:#dcfce7;color:#16a34a;border:none;width:28px;height:28px;border-radius:8px;font-weight:700;padding:0;display:flex;align-items:center;justify-content:center" onclick="cambiarCantidadCarrito(' + index + ', 1)">+</button>' +
                '<span style="min-width:70px;text-align:right;font-weight:700;font-size:0.85rem;color:#0f172a;margin-left:6px">$' + sub.toLocaleString() + '</span>' +
                '<button class="btn btn-sm" style="background:#fff;color:#ef4444;border:1px solid #fecaca;width:26px;height:26px;border-radius:6px;padding:0;display:flex;align-items:center;justify-content:center" onclick="eliminarItemCarrito(' + index + ')" title="Eliminar artículo"><i class="bi bi-trash" style="font-size:.72rem"></i></button>' +
            '</div>';
        lista.appendChild(li);
    });

    txtTotal.textContent = '$' + total.toLocaleString();
    if (btnEnviar){
        var _puedeEnviar=true; try{ if(typeof puedeCrearPedidosRB==='function') _puedeEnviar=puedeCrearPedidosRB(); else if(typeof puedeCrearPedidos==='function') _puedeEnviar=puedeCrearPedidos(); }catch(e){}
        btnEnviar.disabled = !_puedeEnviar;
        if(!_puedeEnviar){ btnEnviar.title='Sin permiso can_create_orders — solo Mesero'; btnEnviar.style.opacity='.55'; } else { btnEnviar.title=''; btnEnviar.style.opacity='1'; }
    }
    if (btnLimpiar){
        btnLimpiar.disabled = false;
        btnLimpiar.style.opacity='1';
        btnLimpiar.innerHTML='<i class="bi bi-eraser me-1"></i> Limpiar Borrador';
        btnLimpiar.title='Vaciar borrador actual';
        btnLimpiar.style.background='#fff';
        btnLimpiar.style.color='#dc2626';
    }
    renderizarProductos(productos);
}
function eliminarItemCarrito(index){
    if(index<0||index>=carrito.length) return;
    carrito.splice(index,1);
    actualizarCarrito();
}

var _enviandoPedido = false;
function confirmarPedido() {
    if (_enviandoPedido) return;
    if(!cajaEstaAbierta()){ exigirCajaAbierta(); return; }
    var _puedeConf=true; try{ if(typeof puedeCrearPedidosRB==='function') _puedeConf=puedeCrearPedidosRB(); else if(typeof puedeCrearPedidos==='function') _puedeConf=puedeCrearPedidos(); }catch(e){} if(!_puedeConf){ try{if(typeof mostrarToast==='function') mostrarToast('danger','\uD83D\uDEAB Sin permiso para enviar pedidos a cocina/barra.');}catch(e){} return; }
    if (carrito.length === 0) { mostrarToast('warning', 'Agrega al menos un producto al pedido.'); return; }
    if (!mesaSeleccionada) return;

    var totalPedido = carrito.reduce(function(acc, item) { return acc + (item.cantidad * item.precio_unitario); }, 0);
    if (totalPedido <= 0) { mostrarToast('warning', 'El total del pedido es $0. Verifica los productos.'); return; }

    var btnEnviar = document.getElementById('btnEnviarPedido');
    _enviandoPedido = true;
    if (btnEnviar) { btnEnviar.disabled = true; btnEnviar.innerHTML = '<i class="bi bi-hourglass-split me-1"></i> Enviando...'; }
    function liberarBtn() { _enviandoPedido = false; if (btnEnviar) { btnEnviar.disabled = false; btnEnviar.innerHTML = '<i class="bi bi-send-fill me-1"></i> Enviar Pedido'; } }

    var carritoPrintSnapshot = carrito.map(function(it){
        var prod = productos.find(function(p){return p.id_producto===it.id_producto;});
        return { id_producto: it.id_producto, nombre: it.nombre, cantidad: it.cantidad, precio_unitario: it.precio_unitario, observaciones: it.observaciones||'', categoria: prod?prod.categoria:'', presentacion: it.presentacion||'' };
    });
    var mesaPrintNumero = mesaSeleccionada.numero;
    var claveCliente = 'c' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    try { window._ultimaClavePedido = claveCliente; } catch (e) {}
    var sesionId = obtenerIdMeseroSesion();
    if (!sesionId) {
        mostrarToast('warning', 'Sesión no válida: no se pudo identificar al usuario autenticado. Inicia sesión nuevamente.');
        liberarBtn();
        return;
    }
    var isMesero = esMeseroSesionActual();
    var idMeseroSel;
    if (isMesero) {
        idMeseroSel = sesionId;
    } else {
        var selEl = document.getElementById('meseroSelectorComanda');
        var val = selEl ? String(selEl.value||'').trim() : '';
        if (!val || !Number(val)) {
            mostrarToast('warning', 'Seleccione el mesero responsable de la mesa (obligatorio para Cajero/Administrador).');
            if (selEl) { selEl.style.borderColor='#dc2626'; selEl.focus(); }
            liberarBtn();
            return;
        }
        idMeseroSel = Number(val);
    }
    var payload = {
        id_mesa: mesaSeleccionada.id,
        id_usuario: sesionId,
        id_cajero: sesionId,
        id_jornada: jornadaActiva ? jornadaActiva.id_jornada : null,
        id_mesero: idMeseroSel,
        clave_cliente: claveCliente,
        detalles: carrito.map(function(item) {
            return {
                id_producto: item.id_producto,
                cantidad: item.cantidad,
                precio_unitario: item.precio_unitario,
                observaciones: item.observaciones
            };
        })
    };

    if(navigator.onLine===false){
        guardarPedidoOffline(payload);
        if(typeof mostrarIndicadorOffline==='function') mostrarIndicadorOffline(true);
        mostrarToast('warning', 'Sin red — comanda en cola, se enviará al recuperar conexión. No se duplicará por clave única.');
        liberarBtn();
        return;
    }
    var ctrl=new AbortController(); var tid=setTimeout(function(){ ctrl.abort(); }, 15000);
    fetch(API_BASE + '/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
        credentials: 'include'
    })
    .then(function(r) { clearTimeout(tid); return r.json().then(function(d){ return {ok:r.ok,status:r.status,d:d}; }); })
    .then(function(w) {
        if (w.ok && w.d.success) {
            var _pid = w.d.idPedido;
            var meseroNombrePrint = (function(){ try{ if(usuario && usuario.nombre) return usuario.nombre; var g=localStorage.getItem('usuario'); if(g) return JSON.parse(g).nombre||''; }catch(e){} return ''; })();
            try{ if(typeof comandaAutoDesdePedido==='function') comandaAutoDesdePedido(_pid, mesaPrintNumero, carritoPrintSnapshot); else if(typeof imprimirComanda==='function') imprimirComanda({mesa:mesaPrintNumero, carrito:carritoPrintSnapshot, mesero:meseroNombrePrint, fecha:new Date(), pedidoId:_pid, establecimiento:(typeof cfgPanel!=='undefined'?cfgPanel.general:{})}); }catch(e){}
            if (modalComandero) modalComandero.hide();
            carrito = []; actualizarCarrito();
            mostrarToast('success', (w.d.duplicado ? 'Pedido ya registrado (#' + w.d.idPedido + ', duplicado evitado). ' : 'Pedido #' + w.d.idPedido + ' enviado correctamente. ') + 'Mesa ' + mesaSeleccionada.numero + ' actualizada.');
            cargarMesas();
            liberarBtn();
        } else {
            var eLim = new Error((w.d&&w.d.mensaje)||'Error servidor');
            eLim.status = w.status;
            throw eLim;
        }
    })
    .catch(function(err) {
        clearTimeout(tid);
        if (typeof esErrorLimite === 'function' && esErrorLimite(err)) {
            mostrarToast('warning', MENSAJE_LIMITE);
            liberarBtn();
            return;
        }
        var esTimeout = err && err.name === 'AbortError';
        var sinRed = navigator.onLine === false || (err instanceof TypeError);
        if (esTimeout && navigator.onLine !== false) {
            mostrarToast('warning', 'No se confirmó el envío (timeout). Verifique en Pedidos activos antes de reintentar para no duplicar.');
            try { if (typeof cargarPedidosActivos === 'function') cargarPedidosActivos(); } catch (e) {}
            liberarBtn();
            return;
        }
        if (sinRed) {
            guardarPedidoOffline(payload);
            if(typeof mostrarIndicadorOffline==='function') mostrarIndicadorOffline(true);
            mostrarToast('warning', 'Sin conexión — comanda en cola con clave única, no se duplicará al reintentar.');
            liberarBtn();
            return;
        }
        mostrarToast('danger', 'Error al enviar: ' + ((err && err.message) || 'servidor'));
        liberarBtn();
    });
}

function mostrarAlerta(tipo, msg) {
    var c = document.getElementById('contenedorAlertas');
    if (!c) return;
    c.innerHTML = '<div class="alert alert-' + tipo + ' alert-dismissible fade show">' + msg + '<button type="button" class="btn-close" data-bs-dismiss="alert"></button></div>';
    setTimeout(function() { c.innerHTML = ''; }, 4000);
}

function mostrarToast(tipo, msg) {
    var container = document.getElementById('toastContainer');
    if (!container) return;
    try{var __txt=String(msg||'');var __items=container.querySelectorAll('.toast-cm');for(var __i=0;__i<__items.length;__i++){if(__items[__i].textContent===__txt)return;}while(container.children.length>=3){container.removeChild(container.firstChild);}}catch(__e){}
    var toast = document.createElement('div');
    toast.className = 'toast-cm toast-' + tipo;
    var icon = tipo === 'success' ? 'bi-check-circle-fill' : (tipo === 'danger' ? 'bi-exclamation-circle-fill' : (tipo === 'warning' ? 'bi-exclamation-triangle-fill' : 'bi-info-circle-fill'));
    toast.innerHTML = '<i class="bi ' + icon + '"></i> ' + msg;
    container.appendChild(toast);
    toast.onclick = function() { toast.remove(); };
    setTimeout(function() {
        toast.style.transition = 'opacity 0.3s ease';
        toast.style.opacity = '0';
        setTimeout(function() { toast.remove(); }, 300);
    }, 3500);
}

function mostrarAlertaModal(tipo, msg) {
    var c = document.getElementById('contenedorProductosModal');
    if (!c) return;
    var a = document.createElement('div');
    a.className = 'alert alert-' + tipo + ' alert-dismissible fade show';
    a.innerHTML = msg + '<button type="button" class="btn-close" data-bs-dismiss="alert"></button>';
    c.prepend(a);
    setTimeout(function() { a.remove(); }, 4000);
}

function cerrarSesion() {
    // Destruye la sesion en el servidor (invalida la cookie) y limpia el cliente.
    fetch(API_BASE + '/logout', {
        method: 'POST',
        credentials: 'include'
    }).catch(function() {});
    localStorage.removeItem('usuario');
    window.location.href = (typeof API_BASE!=='undefined'&&API_BASE?API_BASE:'')+'/';
}

// =========================================================
// QUICK ACTIONS: Llamado Mesero
// =========================================================
function llamarMesero(numeroMesa) {
    mostrarAlerta('info', 'Llamado de mesero enviado para Mesa ' + numeroMesa + '. Un mesero sera asignado.');
}

// =========================================================
// QUICK ACTIONS: Pre-Cuenta
// =========================================================
function verPreCuenta(idMesa, numero, isReprint) {
    var contenido = document.getElementById('contenidoPreCuenta');
    contenido.innerHTML = '<div class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary"></div> Cargando cuenta...</div>';
    isReprint = !!isReprint;
    var usuarioActual=(typeof usuario!=='undefined'&&usuario&&usuario.nombre)?usuario.nombre:(JSON.parse(localStorage.getItem('usuario')||'{}').nombre||'Sistema');
    var fechaReimp=new Date().toLocaleString('es-CO');
    var modalPC = new bootstrap.Modal(document.getElementById('modalPreCuenta'));
    modalPC.show();

    fetch(API_BASE + '/api/mesas/' + idMesa + '/cuenta')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success && data.detalles.length > 0) {
                var watermark = isReprint ? '<div style="border:2px solid #000;padding:6px;text-align:center;font-weight:800;font-size:12px;letter-spacing:1px;margin-bottom:10px;background:#fff;color:#000">*** REIMPRESI\u00d3N / DUPLICADO ***<br><small style="font-weight:400;font-size:8px">Reimpreso: '+fechaReimp+' por '+usuarioActual+'</small></div>' : '';
                var html = '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;font-family:monospace">';
                html += watermark;
                html += '<div style="text-align:center;margin-bottom:16px"><strong style="font-size:1.1rem">ClubMaster</strong><br><small style="color:#64748b">Pre-Cuenta - Mesa ' + numero + '</small></div>';
                html += '<table style="width:100%;border-collapse:collapse;margin-bottom:12px">';
                data.detalles.forEach(function(item) {
                    html += '<tr style="border-bottom:1px solid #f1f5f9"><td style="padding:6px 0">' + item.cantidad + 'x ' + escapeHTML(item.nombre) + '</td><td style="text-align:right;padding:6px 0">$' + Number(item.subtotal).toLocaleString() + '</td></tr>';
                });
                html += '</table>';
                html += '<div style="border-top:2px solid #0f172a;padding-top:10px;text-align:right;font-weight:800;font-size:1.1rem">TOTAL: $' + Number(data.total).toLocaleString() + '</div>';
                html += '<div style="text-align:center;margin-top:14px;color:#94a3b8;font-size:0.75rem">Gracias por su visita</div>';
                html += '<div style="text-align:center;margin-top:12px;display:flex;gap:8px;justify-content:center" class="no-print"><button class="btn btn-sm" style="background:#0f172a;color:#fff;border-radius:8px" onclick="imprimirPreCuenta('+idMesa+','+numero+','+isReprint+')"><i class="bi bi-printer"></i> '+(isReprint?'Reimprimir':'Imprimir')+'</button></div>';
                html += '</div>';
                contenido.innerHTML = html;
                if(isReprint){
                    try{ fetch(API_BASE+'/api/print/precuenta',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id_mesa:idMesa, html:html, isReprint:true, usuario:usuarioActual, area:'barra_principal'})}); }catch(e){}
                }
            } else {
                contenido.innerHTML = '<div class="text-center py-3 text-muted">No hay consumos pendientes para esta mesa.</div>';
            }
        })
        .catch(function() {
            contenido.innerHTML = '<div class="text-center py-3" style="color:#dc2626">No se pudo cargar la cuenta.</div>';
        });
}
function imprimirPreCuenta(idMesa, numero, isReprint){
    var contenido=document.getElementById('contenidoPreCuenta');
    if(!contenido) return;
    var html=contenido.innerHTML;
    var isReprintFlag = !!isReprint || html.indexOf('REIMPRESI')!==-1;
    var usuarioActual=(typeof usuario!=='undefined'&&usuario&&usuario.nombre)?usuario.nombre:(JSON.parse(localStorage.getItem('usuario')||'{}').nombre||'Sistema');
    var w=window.open('','_blank','width=360,height=600');
    if(w){ w.document.write('<html><head><title>Pre-Cuenta Mesa '+numero+'</title><style>body{font-family:monospace;padding:10px} @media print{.no-print{display:none}}</style></head><body>'+html+'</body></html>'); w.document.close(); setTimeout(function(){w.print();},300); }
    var apiBase=(typeof API_BASE!=='undefined'?API_BASE:'');
    fetch(apiBase+'/api/print/precuenta',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id_mesa:idMesa, html:html, isReprint:isReprintFlag, usuario:usuarioActual, area:'barra_principal'})})
      .then(function(r){return r.json().then(function(j){return {ok:r.ok, body:j}})}).then(function(res){
        if(!res.ok || !res.body.success){
          var msg=res.body.mensaje||'timeout/offline';
          if(typeof mostrarToast==='function') mostrarToast('danger','⚠️ Pre-cuenta impresora no responde: '+msg);
          if(typeof mostrarAlerta==='function') mostrarAlerta('danger','<div style="display:flex;gap:10px;align-items:center"><i class="bi bi-printer" style="color:#F87171"></i><div><b>Impresora pre-cuenta offline</b><br><small>'+msg+'</small></div></div><div style="margin-top:10px"><button class="btn btn-sm" style="background:#0F172A;color:#fff;border-radius:8px" onclick="reenviarPreCuentaSecundaria('+idMesa+')"><i class="bi bi-arrow-repeat"></i> Reenviar a secundaria</button></div>');
        }
      }).catch(function(){});
}
function reenviarPreCuentaSecundaria(idMesa){
  var contenido=document.getElementById('contenidoPreCuenta');
  var html=contenido?contenido.innerHTML:'';
  var apiBase=(typeof API_BASE!=='undefined'?API_BASE:'');
  fetch(apiBase+'/api/print/reenviar-secundaria',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({area:'barra_principal', html:html, id_mesa:idMesa, tipo:'precuenta'})})
    .then(function(r){return r.json()}).then(function(j){ if(j.success){ if(typeof mostrarToast==='function') mostrarToast('success','Pre-cuenta reenviada a secundaria'); } else { if(typeof mostrarToast==='function') mostrarToast('danger','Secundaria falló: '+(j.mensaje||'')); } }).catch(function(){});
}
function reimprimirPreCuenta(idMesa, numero){ verPreCuenta(idMesa, numero, true); }

function accionPreCuenta() {
    toggleFab();
    var mesasOcupadas = todasLasMesas.filter(function(m) { return m.estado === 'Ocupada'; });
    if (mesasOcupadas.length === 0) {
        mostrarAlerta('warning', 'No hay mesas ocupadas para generar pre-cuenta.');
        return;
    }
    if (mesasOcupadas.length === 1) {
        verPreCuenta(mesasOcupadas[0].id_mesa, mesasOcupadas[0].numero);
    } else {
        var msg = 'Mesas ocupadas: ';
        mesasOcupadas.forEach(function(m, i) {
            msg += '<strong>Mesa ' + m.numero + '</strong>';
            if (i < mesasOcupadas.length - 1) msg += ', ';
        });
        msg += '. Seleccione una mesa ocupada en el mapa para ver su pre-cuenta.';
        mostrarAlerta('info', msg);
    }
}

function accionLlamadoMesero() {
    toggleFab();
    var mesasOcupadas = todasLasMesas.filter(function(m) { return m.estado === 'Ocupada'; });
    if (mesasOcupadas.length === 0) {
        mostrarAlerta('warning', 'No hay mesas ocupadas para llamar mesero.');
        return;
    }
    var nums = mesasOcupadas.map(function(m) { return m.numero; }).join(', ');
    mostrarAlerta('info', 'Llamado general enviado. Mesas activas: ' + nums);
}

// =========================================================
// FLOATING ACTION BAR
// =========================================================
function toggleFab() {
    var menu = document.getElementById('fabMenu');
    var toggle = document.getElementById('fabToggle');
    menu.classList.toggle('show');
    toggle.classList.toggle('active');
}

document.addEventListener('click', function(e) {
    var container = document.getElementById('fabContainer');
    if (container && !container.contains(e.target)) {
        var menu = document.getElementById('fabMenu');
        var toggle = document.getElementById('fabToggle');
        if (menu) menu.classList.remove('show');
        if (toggle) toggle.classList.remove('active');
    }
});

// =========================================================
// MODULO: CIERRE DE MESA / FACTURACION DIVIDIDA
// =========================================================
var modalFacturacion = null;
var mesaFacturar = null;
var detallesFactura = [];
var totalFacturaMesa = 0;
var gruposPago = [];
var catalogoMetodos = null;
var metodosFallback = {
    Efectivo: [{ codigo: 'Efectivo', nombre: 'Efectivo' }],
    Wallet: [{ codigo: 'Nequi', nombre: 'Nequi' }, { codigo: 'Daviplata', nombre: 'Daviplata' }, { codigo: 'BreB', nombre: 'Bre-B / QR' }],
    Tarjeta: [{ codigo: 'Debito', nombre: 'Tarjeta Debito' }, { codigo: 'Credito', nombre: 'Tarjeta Credito' }],
    Credito: [{ codigo: 'Vale', nombre: 'Vale / Credito de la casa' }, { codigo: 'Cortesia', nombre: 'Cortesia / Obsequio' }]
};

var modalConfirmacionFactura = null;
var ultimaFacturaData = null;
var _facturando = false;
var mesaFacturarMeseroId = null;
var claveFacturaActual = null;

function abrirFacturacion(idMesa, numero) {
    if(typeof puedeCobrarRB==='function' && !puedeCobrarRB()){ if(typeof mostrarToast==='function') mostrarToast('danger','\uD83D\uDEAB Se requiere permiso cobrar_cuentas'); if(typeof mostrarAlerta==='function') mostrarAlerta('danger','Solo Cajero/Admin puede cobrar'); return; }
    mesaFacturar = { id: idMesa, numero: numero };
    gruposPago = [];
    detallesFactura = [];
    totalFacturaMesa = 0;
    document.getElementById('tituloFacturaModal').innerHTML = '<i class="bi bi-receipt me-2"></i>Cuenta Mesa ' + numero;
    document.getElementById('listaPagosFactura').innerHTML = '';
    document.getElementById('resumenFacturacion').style.display = 'none';
    document.getElementById('btnConfirmarCobro').disabled = false;
    document.getElementById('btnConfirmarCobro').innerHTML = '<i class="bi bi-check-lg me-1"></i> Confirmar Pago';

    var modalEl = document.getElementById('modalFacturacion');
    if (!modalFacturacion) {
        modalFacturacion = new bootstrap.Modal(modalEl);
    }
    modalFacturacion.show();

    cargarCatalogoMetodos().then(function() {
        if (gruposPago.length > 0) renderizarPagos();
    });

    var contItems = document.getElementById('listaItemsFactura');
    contItems.innerHTML = '<div style="padding:16px;text-align:center;color:#94a3b8"><div class="spinner-border spinner-border-sm text-primary"></div> Cargando cuenta...</div>';

    mesaFacturarMeseroId = null;
    claveFacturaActual = 'f' + Date.now() + '_' + Math.random().toString(36).substr(2,9);
    fetch(API_BASE + '/api/mesas/' + idMesa + '/cuenta')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success) {
                try { if (data.detalles && data.detalles.length && data.detalles[0].id_mesero) mesaFacturarMeseroId = data.detalles[0].id_mesero; else if (data.id_usuario_creador) mesaFacturarMeseroId = data.id_usuario_creador; } catch(e) {}
                renderizarCuentaFactura(data.detalles, data.total);
            } else {
                contItems.innerHTML = '<div style="padding:16px;color:#dc2626;text-align:center">' + (data.mensaje || 'Error al cargar la cuenta') + '</div>';
            }
        })
        .catch(function() {
            contItems.innerHTML = '<div style="padding:16px;color:#dc2626;text-align:center">No se pudo conectar con el servidor</div>';
        });
}

function renderizarCuentaFactura(detalles, total) {
    var cont = document.getElementById('listaItemsFactura');
    cont.innerHTML = '';
    totalFacturaMesa = Number(total);
    detallesFactura = detalles;

    if (detalles.length === 0) {
        cont.innerHTML = '<div style="padding:20px;color:#94a3b8;text-align:center"><i class="bi bi-inbox" style="font-size:1.5rem;display:block;margin-bottom:6px"></i>No hay consumos pendientes.</div>';
        document.getElementById('txtTotalFactura').textContent = '$0';
        return;
    }

    detalles.forEach(function(item, idx) {
        var div = document.createElement('div');
        div.style.cssText = 'display:flex;align-items:center;padding:10px 14px;border-bottom:1px solid #f1f5f9;background:#fff';
        div.innerHTML =
            '<input type="checkbox" class="form-check-input item-factura-check" data-idx="' + idx + '" data-subtotal="' + item.subtotal + '" ' +
            'style="width:18px;height:18px;margin-right:12px;cursor:pointer;accent-color:#3b82f6" onchange="cambioSeleccionItems()">' +
            '<div style="flex:1">' +
            '<strong style="color:#334155;font-size:0.88rem">' + escapeHTML(item.nombre) + '</strong>' +
            '<br><small style="color:#94a3b8">' + item.cantidad + ' x $' + Number(item.precio_unitario).toLocaleString() + '</small>' +
            '</div>' +
            '<span style="font-weight:700;color:#10b981;font-size:0.9rem">$' + Number(item.subtotal).toLocaleString() + '</span>';
        cont.appendChild(div);
    });

    document.getElementById('txtTotalFactura').textContent = '$' + totalFacturaMesa.toLocaleString();
    try {
        var checks = cont.querySelectorAll('.item-factura-check');
        checks.forEach(function(c) { c.checked = true; });
        if (gruposPago.length === 0 && totalFacturaMesa > 0) {
            var sel = 0;
            try { sel = calcularMontoSeleccionado(); } catch (e) { sel = totalFacturaMesa; }
            gruposPago.push({ metodo: 'Efectivo', sub_metodo: '', referencia: '', monto: sel || totalFacturaMesa, descuento: 0, propina: 0 });
            renderizarPagos();
        }
    } catch (e) {}
    actualizarResumenFacturacion();
}

function seleccionarTodosItems() {
    var checks = document.querySelectorAll('.item-factura-check');
    checks.forEach(function(c) { c.checked = true; });
    recalcularGruposPago();
}

function limpiarSeleccionItems() {
    var checks = document.querySelectorAll('.item-factura-check');
    checks.forEach(function(c) { c.checked = false; });
    recalcularGruposPago();
}

function obtenerItemsSeleccionados() {
    var checks = document.querySelectorAll('.item-factura-check:checked');
    var seleccionados = [];
    checks.forEach(function(c) {
        var idx = parseInt(c.getAttribute('data-idx'));
        seleccionados.push(detallesFactura[idx]);
    });
    return seleccionados;
}

function calcularMontoSeleccionado() {
    return obtenerItemsSeleccionados().reduce(function(acc, item) { return acc + Number(item.subtotal); }, 0);
}

function recalcularGruposPago() {
    actualizarResumenFacturacion();
}

function cambioSeleccionItems() {
    try {
        if (gruposPago.length === 1) {
            var sel = calcularMontoSeleccionado();
            gruposPago[0].monto = sel;
            renderizarPagos();
        }
    } catch (e) {}
    actualizarResumenFacturacion();
}

function facNum(v) {
    var n = Number(v);
    return (isFinite(n)) ? n : 0;
}

function facMoney(v) {
    return '$' + Math.round(facNum(v)).toLocaleString('es-CO');
}

function escPHP(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function cargarCatalogoMetodos() {
    if (catalogoMetodos && catalogoMetodos.length > 0) return Promise.resolve(catalogoMetodos);
    return fetch(API_BASE + '/api/metodos-pago')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success && data.metodos) catalogoMetodos = data.metodos;
            return catalogoMetodos;
        })
        .catch(function() { return catalogoMetodos; });
}

function esMetodoCredito(metodo) {
    return metodo === 'Cortesia' || metodo === 'Vale';
}

function cubreGrupo(g) {
    if (esMetodoCredito(g.metodo)) return facNum(g.monto);
    return facNum(g.monto) + facNum(g.descuento);
}

function opcionesMetodoGrupo(actual) {
    var lista = (catalogoMetodos && catalogoMetodos.length > 0) ? catalogoMetodos : null;
    var cats = [
        ['Efectivo', 'Efectivo'],
        ['Wallet', 'Transferencias / Wallets'],
        ['Tarjeta', 'Tarjetas (Datáfono)'],
        ['Credito', 'Credito de la casa / Vales']
    ];
    var html = '';
    cats.forEach(function(cat) {
        var items = lista ? lista.filter(function(m) { return m.categoria === cat[0]; }) : (metodosFallback[cat[0]] || []);
        if (!items.length) return;
        html += '<optgroup label="' + cat[1] + '">';
        items.forEach(function(m) {
            html += '<option value="' + escPHP(m.codigo) + '"' + (actual === m.codigo ? ' selected' : '') + '>' + escPHP(m.nombre) + '</option>';
        });
        html += '</optgroup>';
    });
    return html;
}

function agregarGrupoPago() {
    var montoSel = calcularMontoSeleccionado();
    if (montoSel <= 0) {
        mostrarAlerta('warning', 'Seleccione al menos un item del consumo para cobrar.');
        return;
    }
    var cubierto = gruposPago.reduce(function(acc, g) { return acc + cubreGrupo(g); }, 0);
    var pendiente = Math.max(0, totalFacturaMesa - cubierto);
    var base = Math.min(montoSel, pendiente);
    if (base <= 0) base = pendiente;
    gruposPago.push({
        metodo: 'Efectivo',
        sub_metodo: '',
        referencia: '',
        monto: base,
        descuento: 0,
        propina: 0
    });
    renderizarPagos();
    actualizarResumenFacturacion();
}

function eliminarGrupoPago(idx) {
    gruposPago.splice(idx, 1);
    renderizarPagos();
    actualizarResumenFacturacion();
}

function cambiarMetodoGrupo(idx, metodo) {
    gruposPago[idx].metodo = metodo;
    if (esMetodoCredito(metodo)) {
        gruposPago[idx].descuento = 0;
        gruposPago[idx].propina = 0;
    }
    renderizarPagos();
    actualizarResumenFacturacion();
}

function cambiarMontoGrupo(idx, val) {
    gruposPago[idx].monto = facNum(val);
    actualizarResumenFacturacion();
}

function cambiarDescuentoGrupo(idx, val) {
    gruposPago[idx].descuento = facNum(val);
    actualizarResumenFacturacion();
}

function cambiarPropinaGrupo(idx, val) {
    gruposPago[idx].propina = facNum(val);
    actualizarResumenFacturacion();
}

function cambiarSubMetodoGrupo(idx, val) {
    gruposPago[idx].sub_metodo = val;
}

function cambiarReferenciaGrupo(idx, val) {
    gruposPago[idx].referencia = val;
}

function renderizarPagos() {
    var cont = document.getElementById('listaPagosFactura');
    cont.innerHTML = '';
    if (gruposPago.length === 0) {
        cont.innerHTML = '<div style="padding:14px;color:#94a3b8;text-align:center;font-size:0.82rem;font-style:italic">Sin metodos de pago agregados</div>';
        return;
    }
    gruposPago.forEach(function(grupo, idx) {
        var esCortesia = grupo.metodo === 'Cortesia';
        var esVale = grupo.metodo === 'Vale';
        var esCredito = esCortesia || esVale;

        var div = document.createElement('div');
        div.style.cssText = 'border-bottom:1px solid #f1f5f9;background:#fff;padding:10px 14px';

        var filaTop = document.createElement('div');
        filaTop.style.cssText = 'display:flex;align-items:center;gap:10px;flex-wrap:wrap';
        var etiquetaMonto = esCortesia ? 'Valor obsequiado ($)' : (esVale ? 'Valor a cargar ($)' : 'Valor recibido ($)');
        filaTop.innerHTML =
            '<select class="form-select form-select-sm" style="width:180px;border-radius:8px;border:1px solid #e2e8f0;font-size:0.82rem;font-weight:600" onchange="cambiarMetodoGrupo(' + idx + ', this.value)">' +
            opcionesMetodoGrupo(grupo.metodo) +
            '</select>' +
            '<div style="flex:1;min-width:130px">' +
            '<small style="display:block;color:#64748b;font-size:0.66rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px">' + etiquetaMonto + '</small>' +
            '<input type="number" min="0" step="500" class="form-control form-control-sm" value="' + facNum(grupo.monto) + '" ' +
            'style="border-radius:8px;border:1px solid #e2e8f0;font-weight:700;text-align:right" ' +
            'oninput="cambiarMontoGrupo(' + idx + ', this.value)"></div>' +
            '<span class="badge" style="background:#eff6ff;color:#2563eb;font-size:0.7rem">Cubre ' + facMoney(cubreGrupo(grupo)) + '</span>' +
            '<button class="btn btn-sm" style="color:#dc2626;border:none;padding:4px 8px" onclick="eliminarGrupoPago(' + idx + ')" title="Eliminar"><i class="bi bi-trash"></i></button>';

        var filaDet = document.createElement('div');
        filaDet.style.cssText = 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:8px;padding-top:8px;border-top:1px dashed #f1f5f9';
        if (!esCredito) {
            filaDet.innerHTML +=
                '<div style="width:95px">' +
                '<small style="display:block;color:#64748b;font-size:0.66rem;font-weight:700;text-transform:uppercase;margin-bottom:2px">Descuento ($)</small>' +
                '<input type="number" min="0" class="form-control form-control-sm" value="' + facNum(grupo.descuento) + '" ' +
                'style="border-radius:8px;border:1px solid #e2e8f0;font-weight:700;text-align:right" ' +
                'oninput="cambiarDescuentoGrupo(' + idx + ', this.value)"></div>' +
                '<div style="width:95px">' +
                '<small style="display:block;color:#64748b;font-size:0.66rem;font-weight:700;text-transform:uppercase;margin-bottom:2px">Propina ($)</small>' +
                '<input type="number" min="0" class="form-control form-control-sm" value="' + facNum(grupo.propina) + '" ' +
                'style="border-radius:8px;border:1px solid #e2e8f0;font-weight:700;text-align:right" ' +
                'oninput="cambiarPropinaGrupo(' + idx + ', this.value)"></div>';
        }
        filaDet.innerHTML +=
            '<div style="width:125px">' +
            '<small style="display:block;color:#64748b;font-size:0.66rem;font-weight:700;text-transform:uppercase;margin-bottom:2px">Sub-metodo</small>' +
            '<input type="text" class="form-control form-control-sm" value="' + escPHP(grupo.sub_metodo) + '" placeholder="Nequi, Visa..." ' +
            'style="border-radius:8px;border:1px solid #e2e8f0" ' +
            'oninput="cambiarSubMetodoGrupo(' + idx + ', this.value)"></div>' +
            '<div style="flex:1;min-width:150px">' +
            '<small style="display:block;color:#64748b;font-size:0.66rem;font-weight:700;text-transform:uppercase;margin-bottom:2px">Referencia</small>' +
            '<input type="text" class="form-control form-control-sm" value="' + escPHP(grupo.referencia) + '" placeholder="Nro. transaccion / autorizacion..." ' +
            'style="border-radius:8px;border:1px solid #e2e8f0" ' +
            'oninput="cambiarReferenciaGrupo(' + idx + ', this.value)"></div>';

        div.appendChild(filaTop);
        div.appendChild(filaDet);
        cont.appendChild(div);
    });
}

function actualizarResumenFacturacion() {
    var totalCubierto = gruposPago.reduce(function(acc, g) { return acc + cubreGrupo(g); }, 0);
    var totalDescuentos = gruposPago.reduce(function(acc, g) { return acc + (esMetodoCredito(g.metodo) ? 0 : facNum(g.descuento)); }, 0);
    var totalPropina = gruposPago.reduce(function(acc, g) { return acc + (esMetodoCredito(g.metodo) ? 0 : facNum(g.propina)); }, 0);
    var pendiente = totalFacturaMesa - totalCubierto;

    if (gruposPago.length > 0) {
        document.getElementById('resumenFacturacion').style.display = 'block';
        document.getElementById('resumenTotal').textContent = facMoney(totalFacturaMesa);
        document.getElementById('resumenPagado').textContent = facMoney(totalCubierto);
        document.getElementById('resumenPendiente').textContent = facMoney(pendiente);
        var resDesc = document.getElementById('resumenDescuentos');
        if (resDesc) resDesc.textContent = facMoney(totalDescuentos);
        var resProp = document.getElementById('resumenPropina');
        if (resProp) resProp.textContent = facMoney(totalPropina);
        var pendEl = document.getElementById('resumenPendiente');
        pendEl.style.color = pendiente < 0 ? '#f87171' : (pendiente === 0 ? '#34d399' : '#fbbf24');
    } else {
        document.getElementById('resumenFacturacion').style.display = 'none';
    }

    var restanteEl = document.getElementById('txtRestante');
    if (restanteEl) {
        restanteEl.textContent = 'Por cobrar: ' + facMoney(pendiente);
        restanteEl.style.color = pendiente <= 0 ? '#34d399' : '#fbbf24';
    }

    var btnConfirmar = document.getElementById('btnConfirmarCobro');
    if (btnConfirmar) btnConfirmar.disabled = gruposPago.length === 0;
}

function procesarCobroDividido() {
    if (_facturando) return;
    if(typeof puedeCobrarRB==='function' && !puedeCobrarRB()){ mostrarToast('danger','Sin permiso cobrar_cuentas'); mostrarAlerta('danger','Solo Cajero/Admin puede cobrar'); return; }
    if (!mesaFacturar) { mostrarAlerta('warning', 'No hay mesa seleccionada para cobrar.'); return; }
    if (gruposPago.length === 0) {
        if (totalFacturaMesa > 0) { agregarGrupoPago(); if (gruposPago.length === 0) return; }
        else { mostrarAlerta('warning', 'Seleccione items y pulse "Agregar Metodo de Pago" antes de confirmar.'); return; }
    }

    var totalCubierto = gruposPago.reduce(function(acc, g) { return acc + cubreGrupo(g); }, 0);
    var montoSel = 0;
    try { montoSel = calcularMontoSeleccionado(); } catch (e) { montoSel = totalFacturaMesa; }

    if (montoSel <= 0) { mostrarAlerta('warning', 'Seleccione al menos un item para cobrar.'); return; }
    if (totalCubierto <= 0) {
        mostrarAlerta('warning', 'El total cubierto de los pagos debe ser mayor a 0.');
        return;
    }

    if (Math.abs(totalCubierto - montoSel) > 1) {
        mostrarAlerta('warning', 'El pago (' + facMoney(totalCubierto) + ') no coincide con lo seleccionado (' + facMoney(montoSel) + '). Se ajustó al valor seleccionado, revise y confirme de nuevo.');
        try {
            if (gruposPago.length === 1) { gruposPago[0].monto = montoSel; gruposPago[0].descuento = 0; renderizarPagos(); actualizarResumenFacturacion(); }
        } catch (e) {}
        return;
    }

    if (Math.abs(totalCubierto - totalFacturaMesa) > 1) {
        var msg = totalCubierto < totalFacturaMesa
            ? 'Cobro parcial: seleccionado (' + facMoney(totalCubierto) + ') de total (' + facMoney(totalFacturaMesa) + '). La mesa quedará con saldo. Continuar?'
            : 'El total cubierto (' + facMoney(totalCubierto) + ') sobrepasa el total de la cuenta (' + facMoney(totalFacturaMesa) + '). Continuar?';
        if (!confirm(msg)) return;
    }

    var btnConfirmar = document.getElementById('btnConfirmarCobro');
    _facturando = true;
    btnConfirmar.disabled = true;
    btnConfirmar.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Procesando...';

    // Si es UN solo método que cubre TODO el total → factura unificada (1 sola factura, 1 consecutivo)
    var esUnificado = (gruposPago.length === 1 && Math.abs(totalCubierto - totalFacturaMesa) <= 1 && Math.abs(montoSel - totalFacturaMesa) <= 1 && gruposPago[0].metodo !== 'Vale');
    if (esUnificado) {
        var g = gruposPago[0];
        // Si es cortesía, no hay descuento/propina adicional
        var esCort = g.metodo === 'Cortesia';
        var payloadUni = {
            id_mesa: mesaFacturar.id,
            metodo_pago: esCort ? 'Cortesia' : g.metodo,
            total: totalFacturaMesa,
            descuento: esCort ? 0 : facNum(g.descuento),
            propina: esCort ? 0 : facNum(g.propina),
            es_cortesia: esCort ? 1 : 0,
            sub_metodo: g.sub_metodo || null,
            referencia: g.referencia || null,
            id_jornada: (typeof jornadaActiva !== 'undefined' && jornadaActiva && jornadaActiva.id_jornada) ? jornadaActiva.id_jornada : null,
            id_mesero: mesaFacturarMeseroId || null,
            clave_factura: claveFacturaActual
        };
        try { payloadUni.id_usuario = (typeof usuario !== 'undefined' && usuario && usuario.id_usuario) || JSON.parse(localStorage.getItem('usuario')||'{}').id_usuario || null; } catch(e) {}
        fetch(API_BASE + '/api/facturar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payloadUni)
        }).then(function(r){ return r.json().then(function(d){ return {ok:r.ok, status:r.status, d:d}; }); }).then(function(w){
            _facturando = false;
            btnConfirmar.disabled = false;
            btnConfirmar.innerHTML = '<i class="bi bi-check-lg me-1"></i> Confirmar Pago';
            if (w.ok && w.d.success) {
                if (w.d.duplicado) { mostrarToast('info','Factura ya registrada (doble clic evitado): '+w.d.numero_factura); }
                if (modalFacturacion) modalFacturacion.hide();
                var num = w.d.numero_factura || ('F-'+String(w.d.id_factura||'').padStart(6,'0'));
                mostrarAlerta('success', 'Venta registrada — Factura unificada ' + num + ' con ' + (w.d.detalles||'') + ' ítems. Mesa ' + mesaFacturar.numero + ' liberada.');
                var idFact = w.d.id_factura || w.d.id_pedido;
                mesaFacturar = null; claveFacturaActual = null; mesaFacturarMeseroId = null;
                cargarMesas();
                if (idFact) cargarYMostrarFactura(idFact, [{metodo_pago:g.metodo, monto:totalFacturaMesa}], []);
            } else {
                mostrarAlerta('danger', (w.d.mensaje||'Error al procesar el cobro'));
            }
        }).catch(function(){
            _facturando = false;
            btnConfirmar.disabled = false;
            btnConfirmar.innerHTML = '<i class="bi bi-check-lg me-1"></i> Confirmar Pago';
            mostrarAlerta('danger', 'No se pudo conectar con el servidor');
        });
        return;
    }

    var pagosNormales = [];
    var valesNuevos = [];
    gruposPago.forEach(function(g) {
        if (g.metodo === 'Vale') {
            valesNuevos.push(g);
            pagosNormales.push({ metodo_pago: 'Vale', monto: 0, cubre: facNum(g.monto) });
        } else if (g.metodo === 'Cortesia') {
            pagosNormales.push({
                metodo_pago: 'Cortesia',
                monto: 0,
                cubre: facNum(g.monto),
                es_cortesia: true,
                sub_metodo: g.sub_metodo || null,
                referencia: g.referencia || null
            });
        } else {
            pagosNormales.push({
                metodo_pago: g.metodo,
                monto: facNum(g.monto),
                cubre: facNum(g.monto) + facNum(g.descuento),
                descuento: facNum(g.descuento),
                propina: facNum(g.propina),
                sub_metodo: g.sub_metodo || null,
                referencia: g.referencia || null
            });
        }
    });

    var promesas = [];

    var idUsuarioCobro = null;
    try { idUsuarioCobro = (typeof usuario !== 'undefined' && usuario && usuario.id_usuario) || JSON.parse(localStorage.getItem('usuario') || '{}').id_usuario || null; } catch (e) {}
    var idJornadaCobro = (typeof jornadaActiva !== 'undefined' && jornadaActiva && jornadaActiva.id_jornada) ? jornadaActiva.id_jornada : null;
    valesNuevos.forEach(function(g) {
        promesas.push(
            fetch(API_BASE + '/api/vales/crear', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    cliente_socio: 'Mesa ' + mesaFacturar.numero,
                    id_mesa: mesaFacturar.id,
                    total: facNum(g.monto),
                    id_usuario: idUsuarioCobro
                })
            }).then(function(r) { return r.json().then(function(d) { return { ok: r.ok, status: r.status, success: d.success, mensaje: d.mensaje, id_pedido: d.id_pedido }; }); })
        );
    });

    if (pagosNormales.length > 0) {
        promesas.push(
            fetch(API_BASE + '/api/facturar-dividido', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ id_mesa: mesaFacturar.id, pagos: pagosNormales, id_usuario: idUsuarioCobro, id_jornada: idJornadaCobro })
            }).then(function(r) { return r.json().then(function(d) { return { ok: r.ok, status: r.status, success: d.success, mensaje: d.mensaje, id_pedido: d.id_pedido, mesaLiberada: d.mesaLiberada }; }); })
        );
    }

    Promise.all(promesas)
    .then(function(results) {
        _facturando = false;
        btnConfirmar.disabled = false;
        btnConfirmar.innerHTML = '<i class="bi bi-check-lg me-1"></i> Confirmar Pago';
        var todoOk = results.every(function(r) { return r.success; });
        if (todoOk) {
            if (modalFacturacion) modalFacturacion.hide();
            var msg = 'Pago registrado';
            if (valesNuevos.length > 0) msg += ' (' + valesNuevos.length + ' vale(s) creado(s))';
            if (pagosNormales.length > 0) msg += ' (' + pagosNormales.length + ' pago(s) en caja)';

            var idPedidoFactura = null;
            for (var i = 0; i < results.length; i++) {
                if (results[i].id_pedido) { idPedidoFactura = results[i].id_pedido; break; }
            }

            mostrarAlerta('success', msg + '. Mesa ' + mesaFacturar.numero + '.');
            mesaFacturar = null; claveFacturaActual = null; mesaFacturarMeseroId = null;
            cargarMesas();

            if (idPedidoFactura) {
                cargarYMostrarFactura(idPedidoFactura, pagosNormales, valesNuevos);
            }
        } else {
            var fallos = results.filter(function(r) { return !r.success; });
            var limite = fallos.some(function(r) { return (typeof esErrorLimite === 'function') && esErrorLimite(r); });
            if (limite) { mostrarAlerta('warning', MENSAJE_LIMITE); return; }
            var errores = fallos.map(function(r) { return r.mensaje; }).join('; ');
            mostrarAlerta('danger', errores || 'Error al procesar el cobro');
        }
    })
    .catch(function() {
        _facturando = false;
        btnConfirmar.disabled = false;
        btnConfirmar.innerHTML = '<i class="bi bi-check-lg me-1"></i> Confirmar Pago';
        mostrarAlerta('danger', 'No se pudo conectar con el servidor');
    });
}

// =========================================================
// NAV HELPER: Marcar activo el item del sidebar
// =========================================================
function setFabVisible(visible) {
    var fab = document.getElementById('fabContainer');
    if (fab) {
        fab.style.display = visible ? '' : 'none';
    }
}

function activarNav(navId) {
    var navIds = ['navMesas', 'navInventario', 'navAnalisisInventario', 'navConfiguracion', 'navConfigInventario', 'navCaja', 'navFinanzas', 'navProveedores', 'navCompras', 'navUsuarios', 'navReportes', 'navFacturacion', 'navMermas', 'navDevoluciones', 'navSpeedBar', 'navSocios', 'navVales'];
    navIds.forEach(function(id) {
        var el = document.getElementById(id);
        if (el) {
            if (id === navId) el.classList.add('active');
            else el.classList.remove('active');
        }
    });
    setFabVisible(navId === 'navMesas');
}

// =========================================================
// MODULO: INVENTARIO / GESTION DE PRODUCTOS
// =========================================================

// La vista de inventario se encuentra en controladores/inventario.js
// Esta funcion se mantiene por compatibilidad
function cargarVistaInventario() { iniciarInventario(); }

// =========================================================
// MODULO: CAJA / JORNADA / ARQUEO DE CAJA
// =========================================================

// La vista de caja se encuentra en controladores/caja.js
// Estas funciones se mantienen por compatibilidad

function cargarJornadaActiva() {
    fetch(API_BASE + '/api/jornada/activa')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success) {
                jornadaActiva = data.jornada;
                resumenJornada = data.resumen;
            } else { jornadaActiva=null; resumenJornada=null; }
            actualizarBadgeJornada();
            if(todasLasMesas && todasLasMesas.length && document.getElementById('contenedorZonas')) renderizarZonas(todasLasMesas);
        })
        .catch(function(err) {
            console.error('Error al cargar jornada activa:', err);
        });
}

function cargarVistaCaja() { iniciarCaja(); }

// =========================================================
// MODULO: ADMINISTRACION DE MESAS (CRUD + ZONAS + UNIR/MOVER)
// =========================================================
var modalMesaAdmin = null;
var todasLasAdminMesas = [];
var adminMesasFiltro = '';
var adminMesasBusqueda = '';

function abrirModalMesaAdmin() {
    var cont = document.getElementById('modalMesaAdminBody');
    if (!cont) {
        crearModalMesaAdmin();
        cont = document.getElementById('modalMesaAdminBody');
    }
    cont.innerHTML = adminMesasSkeleton();
    if (!modalMesaAdmin) modalMesaAdmin = new bootstrap.Modal(document.getElementById('modalMesaAdmin'));
    modalMesaAdmin.show();

    fetch(API_BASE + '/api/mesas?todas=1')
        .then(function(r) { return r.json().then(function(d){ return {ok:r.ok, status:r.status, d:d}; }); })
        .then(function(w) {
            var data = w.d || {};
            if (!w.ok || !data.success) { cont.innerHTML = '<div class="ams-empty"><i class="bi bi-exclamation-triangle"></i><p>' + escAms(data.mensaje || 'Error al cargar mesas') + '</p></div>'; return; }
            // Ocultar por completo las zonas no permitidas (el backend ya
            // filtra, esto es segunda capa por si la lista viene completa).
            todasLasAdminMesas = (data.mesas || []).filter(function(t) { return puedeZonaOperativa(t.zona || 'VIP'); });
            var zonas = data.zonas || catalogoZonas;
            adminMesasFiltro = '';
            adminMesasBusqueda = '';
            renderAdminMesas(cont, zonas);
        })
        .catch(function() {
            cont.innerHTML = '<div class="ams-empty"><i class="bi bi-wifi-off"></i><p>No se pudo conectar con el servidor</p></div>';
        });
}

function adminMesasSkeleton() {
    var h = '<div class="ams-stats">';
    for (var i = 0; i < 4; i++) h += '<div class="ams-stat-skeleton"><div class="ams-skel-line"></div><div class="ams-skel-line short"></div></div>';
    h += '</div><div class="ams-toolbar"><div class="ams-skel-line" style="width:220px;height:36px;border-radius:10px"></div></div>';
    h += '<div class="ams-grid">';
    for (var j = 0; j < 6; j++) h += '<div class="ams-card-skeleton"><div class="ams-skel-line" style="width:60%;height:28px;margin:0 auto 8px"></div><div class="ams-skel-line" style="width:40%;height:14px;margin:0 auto"></div></div>';
    h += '</div>';
    return h;
}

function renderAdminMesas(cont, zonas) {
    var m = todasLasAdminMesas;
    var busqueda = adminMesasBusqueda.toLowerCase().trim();
    var filtro = adminMesasFiltro;

    var filtradas = m.filter(function(t) {
        if (filtro && t.zona !== filtro) return false;
        if (busqueda) {
            var searchable = ('Mesa ' + t.numero + ' ' + (t.nombre || '') + ' ' + (t.mesero_nombre || '') + ' ' + (t.zona || '')).toLowerCase();
            return searchable.indexOf(busqueda) !== -1;
        }
        return true;
    });

    var total = m.length;
    var disp = m.filter(function(t) { return t.estado === 'Disponible' && (t.activo !== 0); }).length;
    var ocup = m.filter(function(t) { return t.estado === 'Ocupada'; }).length;
    var inac = m.filter(function(t) { return t.activo === 0; }).length;

    var html = '';

    html += '<div class="ams-stats">' +
        adminStatCard('bi-grid-3x3-gap', total, 'Total', 'ams-stat-total') +
        adminStatCard('bi-check-circle', disp, 'Disponibles', 'ams-stat-ok') +
        adminStatCard('bi-person-fill', ocup, 'Ocupadas', 'ams-stat-ocup') +
        '</div>';

    html += '<div class="ams-toolbar">' +
        '<div class="ams-search"><i class="bi bi-search"></i><input type="text" placeholder="Buscar mesa, nombre, mesero..." id="amsBusqueda" value="' + escAms(adminMesasBusqueda) + '" oninput="adminMesasOnSearch(this.value)"></div>' +
        '<div class="ams-zone-pills" id="amsZonePills">' +
        '<button class="ams-pill' + (!filtro ? ' active' : '') + '" onclick="adminMesasFiltrarZona(\'\')">Todas <span class="ams-pill-count">' + total + '</span></button>';

    var zonasUnicas = [];
    zonas.forEach(function(z) {
        if (zonasUnicas.indexOf(z.nombre) === -1 && puedeZonaOperativa(z.nombre)) zonasUnicas.push(z.nombre);
    });
    m.forEach(function(t) { if (zonasUnicas.indexOf(t.zona || 'VIP') === -1) zonasUnicas.push(t.zona || 'VIP'); });
    zonasUnicas.forEach(function(z) {
        var cnt = m.filter(function(t) { return (t.zona || 'VIP') === z; }).length;
        html += '<button class="ams-pill' + (filtro === z ? ' active' : '') + '" onclick="adminMesasFiltrarZona(\'' + escAms(z) + '\')">' + escAms(z) + ' <span class="ams-pill-count">' + cnt + '</span></button>';
    });
    // "+ Nueva Mesa" solo si el rol tiene al menos una zona de estructura.
    var puedeCrearMesa = (catalogoZonas.length ? catalogoZonas : zonas).some(function(z) { return puedeZonaEstructura(z.nombre); });
    html += '</div>' +
        (puedeCrearMesa
            ? '<button class="ams-btn-primary" onclick="abrirNuevaMesa()"><i class="bi bi-plus-lg"></i> Nueva Mesa</button>'
            : '<button class="ams-btn-primary" disabled title="Tu rol no tiene permiso de estructura en ninguna zona" style="opacity:.5;cursor:not-allowed"><i class="bi bi-shield-lock"></i> Nueva Mesa</button>') +
        '</div>';

    if (filtradas.length === 0) {
        html += '<div class="ams-empty"><i class="bi bi-inbox"></i><p>No se encontraron mesas</p>' + (busqueda || filtro ? '<p class="sub">Prueba con otros filtros</p>' : '') + '</div>';
    } else {
        html += '<div class="ams-grid">';
        filtradas.forEach(function(t) {
            html += adminMesaCard(t);
        });
        html += '</div>';
    }

    html += '<div class="ams-footer-info">' +
        '<span class="ams-foot-item"><i class="bi bi-pin-map"></i> ' + zonasUnicas.length + ' zona(s)</span>' +
        (inac > 0 ? '<span class="ams-foot-item ams-foot-warn"><i class="bi bi-eye-slash"></i> ' + inac + ' inhabilitada(s)</span>' : '') +
        '</div>';

    cont.innerHTML = html;
    var b = document.getElementById('amsBusqueda');
    if (b) b.focus();
}

function adminStatCard(icon, valor, label, cls) {
    return '<div class="ams-stat ' + cls + '">' +
        '<div class="ams-stat-icon"><i class="bi bi-' + icon + '"></i></div>' +
        '<div class="ams-stat-info"><div class="ams-stat-val">' + valor + '</div><div class="ams-stat-label">' + label + '</div></div>' +
        '</div>';
}

function adminMesaCard(t) {
    var bc = t.activo === 0 ? 'bar-inhabilitada' : (t.estado === 'Ocupada' ? 'bar-ocupada' : 'bar-disponible');
    var estadoBadge = t.activo === 0
        ? '<span class="ams-badge ams-badge-gray">Inhabilitada</span>'
        : (t.estado === 'Ocupada' ? '<span class="ams-badge ams-badge-red">Ocupada</span>'
        : '<span class="ams-badge ams-badge-green">Disponible</span>');

    var meseroHtml = t.mesero_nombre
        ? '<div class="ams-card-mesero"><i class="bi bi-person-fill"></i> ' + escAms(t.mesero_nombre) + '</div>'
        : '';

    // Sin permiso de estructura en esta zona: iconos deshabilitados con tooltip.
    var puedeEst = puedeZonaEstructura(t.zona || 'VIP');
    var disAttrs = puedeEst ? '' : ' disabled title="No tienes permiso sobre esta zona" style="opacity:.4;cursor:not-allowed"';
    var btnEdit = puedeEst
        ? '<button class="ams-act-btn ams-act-edit" title="Editar" onclick="abrirEditarMesa(' + t.id_mesa + ')"><i class="bi bi-pencil-square"></i></button>'
        : '<button class="ams-act-btn ams-act-edit"' + disAttrs + '><i class="bi bi-pencil-square"></i></button>';
    var btnZona = puedeEst
        ? '<button class="ams-act-btn ams-act-zone" title="Cambiar zona" onclick="adminCambiarZona(' + t.id_mesa + ', \'' + escAms(t.zona || 'VIP') + '\')"><i class="bi bi-pin-map"></i></button>'
        : '<button class="ams-act-btn ams-act-zone"' + disAttrs + '><i class="bi bi-pin-map"></i></button>';
    var btnPower = puedeEst
        ? '<button class="ams-act-btn ' + (t.activo === 0 ? 'ams-act-enable' : 'ams-act-toggle') + '" title="' + (t.activo === 0 ? 'Habilitar' : 'Inhabilitar') + '" onclick="adminToggleMesa(' + t.id_mesa + ', ' + (t.activo === 0 ? 1 : 0) + ', \'' + escAms(String(t.numero)) + '\')"><i class="bi bi-power"></i></button>'
        : '<button class="ams-act-btn ' + (t.activo === 0 ? 'ams-act-enable' : 'ams-act-toggle') + '"' + disAttrs + '><i class="bi bi-power"></i></button>';

    return '<div class="ams-mesa-card">' +
        '<div class="ams-card-bar ' + bc + '"></div>' +
        '<div class="ams-card-body">' +
        '<div class="ams-card-num">' + escAms(String(t.numero)) + '</div>' +
        '<div class="ams-card-zona"><i class="bi bi-pin-map-fill"></i> ' + escAms(t.zona || 'VIP') + '</div>' +
        '<div class="ams-card-cap"><i class="bi bi-people-fill"></i> ' + t.capacidad + '</div>' +
        meseroHtml +
        '<div class="ams-card-estado">' + estadoBadge + '</div>' +
        '<div class="ams-card-actions">' +
        btnEdit + btnZona + btnPower +
        '</div>' +
        '</div></div>';
}

function adminMesasOnSearch(val) {
    adminMesasBusqueda = val;
    var cont = document.getElementById('modalMesaAdminBody');
    if (cont) {
        var zonas = catalogoZonas.length ? catalogoZonas : [];
        todasLasAdminMesas.forEach(function(t) {
            var zn = t.zona || 'VIP';
            var exists = zonas.some(function(z) { return z.nombre === zn; });
            if (!exists) zonas.push({ nombre: zn });
        });
        renderAdminMesas(cont, zonas);
    }
}

function adminMesasFiltrarZona(zona) {
    adminMesasFiltro = zona;
    var cont = document.getElementById('modalMesaAdminBody');
    if (cont) {
        var zonas = catalogoZonas.length ? catalogoZonas : [];
        todasLasAdminMesas.forEach(function(t) {
            var zn = t.zona || 'VIP';
            var exists = zonas.some(function(z) { return z.nombre === zn; });
            if (!exists) zonas.push({ nombre: zn });
        });
        renderAdminMesas(cont, zonas);
    }
}

function escAms(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function adminCambiarZona(idMesa, zonaActual) {
    if (!puedeZonaEstructura(zonaActual)) { mostrarAlerta('danger', 'No tienes permiso sobre la zona "' + zonaActual + '".'); return; }
    var m = todasLasAdminMesas.find(function(t) { return t.id_mesa === idMesa; });
    var numero = m ? m.numero : '?';
    var zonas = [];
    (catalogoZonas.length ? catalogoZonas : []).forEach(function(z) { if (puedeZonaEstructura(z.nombre)) zonas.push(z.nombre); });
    todasLasAdminMesas.forEach(function(t) {
        var zn = t.zona || 'VIP';
        if (zonas.indexOf(zn) === -1) zonas.push(zn);
    });

    var html = '<div class="ams-confirm-overlay" onclick="adminCloseConfirm()">' +
        '<div class="ams-confirm-dialog" onclick="event.stopPropagation()">' +
        '<div class="ams-confirm-header"><i class="bi bi-pin-map-fill"></i> Cambiar Zona - Mesa ' + escAms(String(numero)) + '</div>' +
        '<div class="ams-confirm-body"><p style="margin:0 0 12px;color:#94a3b8;font-size:.85rem">Zona actual: <strong style="color:#e2e8f0">' + escAms(zonaActual) + '</strong></p>' +
        '<div class="ams-zona-options">';

    zonas.forEach(function(z) {
        html += '<button class="ams-zona-opt' + (z === zonaActual ? ' selected' : '') + '" onclick="adminDoCambiarZona(' + idMesa + ', \'' + escAms(z) + '\')">' +
            '<i class="bi bi-pin-map-fill"></i> ' + escAms(z) + '</button>';
    });
    html += '</div></div>' +
        '<div class="ams-confirm-footer"><button class="ams-btn-cancel" onclick="adminCloseConfirm()">Cancelar</button></div>' +
        '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
}

function adminDoCambiarZona(idMesa, nuevaZona) {
    adminCloseConfirm();
    fetch(API_BASE + '/api/mesas/' + idMesa + '/zona', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zona: nuevaZona })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.success) { abrirModalMesaAdmin(); cargarMesas(); mostrarAlerta('success', 'Zona actualizada a ' + nuevaZona); }
        else mostrarAlerta('danger', data.mensaje || 'Error al cambiar zona');
    })
    .catch(function() { mostrarAlerta('danger', 'No se pudo conectar con el servidor'); });
}

function adminToggleMesa(idMesa, activo, numero) {
    var mt = todasLasAdminMesas.find(function(t) { return t.id_mesa === idMesa; });
    if (mt && !puedeZonaEstructura(mt.zona || 'VIP')) { mostrarAlerta('danger', 'No tienes permiso sobre la zona "' + (mt.zona || 'VIP') + '".'); return; }
    var accion = activo ? 'habilitar' : 'inhabilitar';
    var html = '<div class="ams-confirm-overlay" onclick="adminCloseConfirm()">' +
        '<div class="ams-confirm-dialog" onclick="event.stopPropagation()">' +
        '<div class="ams-confirm-header"><i class="bi bi-exclamation-triangle-fill"></i> ' + (activo ? 'Habilitar' : 'Inhabilitar') + ' Mesa ' + escAms(numero) + '</div>' +
        '<div class="ams-confirm-body"><p style="margin:0;color:#94a3b8;font-size:.85rem">¿Deseas ' + accion + ' la mesa <strong style="color:#e2e8f0">Mesa ' + escAms(numero) + '</strong>?</p></div>' +
        '<div class="ams-confirm-footer">' +
        '<button class="ams-btn-cancel" onclick="adminCloseConfirm()">Cancelar</button>' +
        '<button class="ams-btn-danger" onclick="adminDoToggle(' + idMesa + ', ' + activo + ')">' + (activo ? 'Habilitar' : 'Inhabilitar') + '</button>' +
        '</div></div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
}

function adminDoToggle(idMesa, activo) {
    adminCloseConfirm();
    fetch(API_BASE + '/api/mesas/' + idMesa + '/inhabilitar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: activo })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.success) { abrirModalMesaAdmin(); cargarMesas(); mostrarAlerta('success', activo ? 'Mesa habilitada' : 'Mesa inhabilitada'); }
        else mostrarAlerta('danger', data.mensaje || 'Error al actualizar mesa');
    })
    .catch(function() { mostrarAlerta('danger', 'No se pudo conectar con el servidor'); });
}

function adminCloseConfirm() {
    var el = document.querySelector('.ams-confirm-overlay');
    if (el) el.remove();
}

function crearModalMesaAdmin() {
    var d = document.createElement('div');
    d.className = 'modal fade';
    d.id = 'modalMesaAdmin';
    d.tabIndex = '-1';
    d.innerHTML = '<div class="modal-dialog modal-xl modal-dialog-scrollable"><div class="modal-content ams-modal">' +
        '<div class="modal-header ams-header">' +
        '<h5 class="modal-title"><i class="bi bi-grid-3x3-gap-fill"></i> Administracion de Mesas</h5>' +
        '<button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div>' +
        '<div class="modal-body ams-body" id="modalMesaAdminBody"></div>' +
        '<div class="modal-footer ams-footer"><button type="button" class="ams-btn-cancel" data-bs-dismiss="modal">Cerrar</button></div>' +
        '</div></div>';
    document.body.appendChild(d);
}

// Zonas ofrecidas en el formulario: solo las de estructura permitidas.
function zonasEstructuraDisponibles() {
    var base = catalogoZonas.length ? catalogoZonas : [{ nombre: 'VIP' }, { nombre: 'Pista Principal' }, { nombre: 'Barra' }, { nombre: 'Terraza' }];
    return base.filter(function(z) { return puedeZonaEstructura(z.nombre); });
}
function refrescarSelectZonaMesa() {
    var selZona = document.getElementById('mesaZona');
    if (!selZona) return;
    selZona.innerHTML = '';
    zonasEstructuraDisponibles().forEach(function(z) {
        var op = document.createElement('option');
        op.value = z.nombre;
        op.textContent = z.nombre;
        selZona.appendChild(op);
    });
}

function abrirNuevaMesa() {
    crearModalMesaForm();
    refrescarSelectZonaMesa();
    if (!zonasEstructuraDisponibles().length) { mostrarAlerta('danger', 'No tienes permiso sobre ninguna zona para crear mesas.'); return; }
    document.getElementById('mesaFormTitulo').textContent = 'Nueva Mesa';
    document.getElementById('mesaId').value = '';
    document.getElementById('mesaNumero').value = '';
    document.getElementById('mesaCapacidad').value = '4';
    document.getElementById('mesaNombre').value = '';
    document.getElementById('mesaZona').value = zonasEstructuraDisponibles()[0].nombre;
    llenarSelectMeseros(null, document.getElementById('mesaZona').value);
    var mf = new bootstrap.Modal(document.getElementById('modalMesaForm'));
    mf.show();
}

function abrirEditarMesa(idMesa) {
    var mesa = todasLasAdminMesas.find(function(m) { return m.id_mesa === idMesa; }) || todasLasMesas.find(function(m) { return m.id_mesa === idMesa; });
    if (!mesa) return;
    if (!puedeZonaEstructura(mesa.zona || 'VIP')) { mostrarAlerta('danger', 'No tienes permiso sobre la zona "' + (mesa.zona || 'VIP') + '".'); return; }
    crearModalMesaForm();
    refrescarSelectZonaMesa();
    document.getElementById('mesaFormTitulo').textContent = 'Editar Mesa ' + mesa.numero;
    document.getElementById('mesaId').value = mesa.id_mesa;
    document.getElementById('mesaNumero').value = mesa.numero;
    document.getElementById('mesaCapacidad').value = mesa.capacidad;
    document.getElementById('mesaZona').value = mesa.zona || 'VIP';
    document.getElementById('mesaNombre').value = mesa.nombre || '';
    llenarSelectMeseros(mesa.id_mesero, mesa.zona || 'VIP');
    var mf = new bootstrap.Modal(document.getElementById('modalMesaForm'));
    mf.show();
}

function crearModalMesaForm() {
    if (document.getElementById('modalMesaForm')) return;
    var d = document.createElement('div');
    d.className = 'modal fade';
    d.id = 'modalMesaForm';
    d.tabIndex = '-1';
    d.innerHTML = '<div class="modal-dialog"><div class="modal-content ams-modal">' +
        '<div class="modal-header ams-header"><h5 class="modal-title" id="mesaFormTitulo">Mesa</h5>' +
        '<button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div>' +
        '<div class="modal-body ams-body">' +
        '<div class="ams-form-group"><label class="ams-form-label">Numero de mesa</label><input type="text" class="ams-form-input" id="mesaNumero" placeholder="Ej: 1, Mesa 12, VIP 3, A-5" maxlength="20" pattern="[A-Za-z0-9\\s\\-]+" title="Solo letras, números, espacios y guiones"></div>' +
        '<div class="ams-form-group"><label class="ams-form-label">Nombre <span style="color:#64748b;font-weight:400;text-transform:none">(opcional)</span></label><input type="text" class="ams-form-input" id="mesaNombre" placeholder="Ej: Terraza 1"></div>' +
        '<div class="ams-form-row">' +
        '<div class="ams-form-group ams-form-half"><label class="ams-form-label">Capacidad</label><input type="number" class="ams-form-input" id="mesaCapacidad" min="1" value="4"></div>' +
        '<div class="ams-form-group ams-form-half"><label class="ams-form-label">Zona</label><select class="ams-form-input" id="mesaZona"></select></div>' +
        '</div>' +
        '<div class="ams-form-group"><label class="ams-form-label">Mesero asignado <span style="color:#64748b;font-weight:400;text-transform:none">(opcional)</span></label><select class="ams-form-input" id="mesaMesero"><option value="">Sin mesero</option></select></div>' +
        '<input type="hidden" id="mesaId">' +
        '</div>' +
        '<div class="modal-footer ams-footer">' +
        '<button type="button" class="ams-btn-cancel" data-bs-dismiss="modal">Cancelar</button>' +
        '<button type="button" class="ams-btn-primary" onclick="guardarMesa()"><i class="bi bi-check-lg"></i> Guardar</button>' +
        '</div></div></div>';
    document.body.appendChild(d);
    var selZona = document.getElementById('mesaZona');
    (catalogoZonas.length ? catalogoZonas : [{ nombre: 'VIP' }, { nombre: 'Pista Principal' }, { nombre: 'Barra' }, { nombre: 'Terraza' }]).forEach(function(z) {
        var op = document.createElement('option');
        op.value = z.nombre;
        op.textContent = z.nombre;
        selZona.appendChild(op);
    });
    var selMesero = document.getElementById('mesaMesero');
    selMesero.innerHTML = '<option value="">Sin mesero</option>';
}

function llenarSelectMeseros(seleccionado, zonaMesa) {
    var sel = document.getElementById('mesaMesero');
    if (!sel) return;
    sel.innerHTML = '<option value="">Sin mesero</option>';
    // Segun la zona: Barra -> personal de barra, resto -> meseros.
    var quiereBarra = esZonaBarra(zonaMesa || document.getElementById('mesaZona').value);
    var lbl = document.querySelector('#modalMesaForm label.ams-form-label');
    fetch(API_BASE + '/api/usuarios')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success && data.usuarios) {
                data.usuarios.forEach(function(u) {
                    var rr = String(u.rol_nombre || u.rol || '').toLowerCase();
                    var idr = Number(u.id_rol);
                    var esValido = quiereBarra
                        ? (rr.indexOf('bartender') !== -1 || rr.indexOf('barman') !== -1 || idr === 7)
                        : (rr.indexOf('mesero') !== -1 || rr.indexOf('mesera') !== -1 || idr === 3);
                    if (!esValido) return;
                    var op = document.createElement('option');
                    op.value = u.id_usuario;
                    op.textContent = u.nombre || u.usuario || '';
                    if (seleccionado && Number(u.id_usuario) === Number(seleccionado)) op.selected = true;
                    sel.appendChild(op);
                });
            }
        })
        .catch(function() {});
}
// Al cambiar la zona en el formulario, recargar responsables acordes.
document.addEventListener('change', function(e) {
    if (e && e.target && e.target.id === 'mesaZona') {
        try {
            var selId = document.getElementById('mesaId').value || null;
            llenarSelectMeseros(selId ? ((todasLasAdminMesas.find(function(m){ return String(m.id_mesa)===String(selId); }) || {}).id_mesero || null) : null, e.target.value);
        } catch (err) {}
    }
});

function guardarMesa() {
    var id = document.getElementById('mesaId').value;
    var numero = document.getElementById('mesaNumero').value.trim();
    var capacidad = document.getElementById('mesaCapacidad').value;
    var zona = document.getElementById('mesaZona').value;
    var nombre = document.getElementById('mesaNombre').value.trim();
    var mesero = document.getElementById('mesaMesero').value;
    if (!numero) { mostrarAlerta('warning', 'El numero de mesa es obligatorio.'); return; }
    if (!/^[A-Za-z0-9\s\-]+$/.test(numero)) { mostrarAlerta('warning', 'Numero inválido: solo letras, números, espacios y guiones (Ej: 1, Mesa 12, VIP 3, A-5).'); return; }
    if (numero.length > 20) { mostrarAlerta('warning', 'El numero no puede superar 20 caracteres.'); return; }
    if (!capacidad || Number(capacidad) < 1) { mostrarAlerta('warning', 'La capacidad debe ser al menos 1.'); return; }

    var metodo = id ? 'PUT' : 'POST';
    var url = id ? API_BASE + '/api/mesas/' + id : API_BASE + '/api/mesas';
    var body = { numero: numero, capacidad: capacidad, zona: zona, nombre: nombre, id_mesero: mesero || null };
    if (!id) body.estado = 'Disponible';

    fetch(url, {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.success) {
            var m = bootstrap.Modal.getInstance(document.getElementById('modalMesaForm'));
            if (m) m.hide();
            abrirModalMesaAdmin();
            cargarMesas();
            mostrarAlerta('success', id ? 'Mesa ' + numero + ' actualizada' : 'Mesa ' + numero + ' creada');
        } else {
            mostrarAlerta('danger', data.mensaje || 'Error al guardar mesa');
        }
    })
    .catch(function() { mostrarAlerta('danger', 'No se pudo conectar con el servidor'); });
}

function abrirCambioZona(idMesa, zonaActual) {
    adminCambiarZona(idMesa, zonaActual);
}

function toggleMesaActivo(idMesa, activo) {
    var m = todasLasAdminMesas.find(function(t) { return t.id_mesa === idMesa; }) || todasLasMesas.find(function(t) { return t.id_mesa === idMesa; });
    var numero = m ? String(m.numero) : '?';
    adminToggleMesa(idMesa, activo, numero);
}

// =========================================================
// MOVER / UNIR MESAS (mesas ocupadas)
// =========================================================
function abrirModalMoverMesa(idMesa, numero) {
    if (!document.getElementById('modalMoverMesa')) {
        var d = document.createElement('div');
        d.className = 'modal fade';
        d.id = 'modalMoverMesa';
        d.tabIndex = '-1';
        d.innerHTML = '<div class="modal-dialog"><div class="modal-content" style="background:#0f172a;color:#e2e8f0;border:1px solid #1e293b">' +
            '<div class="modal-header" style="border-bottom:1px solid #1e293b"><h5 class="modal-title" id="moverTitulo">Mover / Unir Mesa</h5>' +
            '<button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div>' +
            '<div class="modal-body" id="moverBody">' +
            '<p class="text-muted">Seleccione la mesa de origen (cuenta a mover) y la mesa destino (se uniran las comandas).</p>' +
            '<div class="mb-3"><label class="form-label">Mesa de origen (cuenta)</label><select class="form-select bg-dark text-light" id="moverOrigen"></select></div>' +
            '<div class="mb-3"><label class="form-label">Mesa destino (recibe)</label><select class="form-select bg-dark text-light" id="moverDestino"></select></div>' +
            "<div class='alert alert-info'>Unir consolidara los pedidos pendientes de la mesa origen en la mesa destino.</div>" +
            '</div>' +
            '<div class="modal-footer" style="border-top:1px solid #1e293b">' +
            '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>' +
            '<button type="button" class="btn btn-warning" onclick="moverMesaUnir()"><i class="bi bi-arrows-move me-1"></i>Mover / Unir</button>' +
            '</div></div></div>';
        document.body.appendChild(d);
    }
    document.getElementById('moverTitulo').textContent = 'Mover / Unir - Mesa ' + numero;
    var selOrigen = document.getElementById('moverOrigen');
    var selDestino = document.getElementById('moverDestino');
    selOrigen.innerHTML = '';
    selDestino.innerHTML = '';
    var ocupadas=todasLasMesas.filter(function(m){ return m.estado==='Ocupada'; });
    ocupadas.forEach(function(m){
        var op=document.createElement('option');
        op.value=m.id_mesa;
        op.textContent='Mesa '+m.numero+' (ocupada)';
        if(m.id_mesa===idMesa) op.selected=true;
        selOrigen.appendChild(op);
    });
    if(!selOrigen.options.length){
        var o=document.createElement('option'); o.value=idMesa; o.textContent='Mesa '+numero+' (ocupada)'; o.selected=true; selOrigen.appendChild(o);
    }
    var destinos=todasLasMesas.filter(function(m){ return m.id_mesa!==idMesa; });
    if(!destinos.length){
        var od=document.createElement('option'); od.value=''; od.textContent='No hay otra mesa disponible'; od.disabled=true; od.selected=true; selDestino.appendChild(od);
    } else {
        destinos.forEach(function(m){
            var op=document.createElement('option');
            op.value=m.id_mesa;
            var est=(m.estado||'Disponible').toLowerCase();
            op.textContent='Mesa '+m.numero+' ('+est+')';
            selDestino.appendChild(op);
        });
        var firstValid=-1;
        for(var i=0;i<selDestino.options.length;i++){ if(selDestino.options[i].value && Number(selDestino.options[i].value)!==Number(selOrigen.value)){ firstValid=i; break; } }
        if(firstValid!==-1) selDestino.selectedIndex=firstValid;
    }
    selOrigen.onchange=function(){
        for(var i=0;i<selDestino.options.length;i++){
            var v=Number(selDestino.options[i].value);
            selDestino.options[i].disabled = v===Number(selOrigen.value);
        }
        if(Number(selDestino.value)===Number(selOrigen.value)){
            for(var j=0;j<selDestino.options.length;j++){ if(!selDestino.options[j].disabled && selDestino.options[j].value){ selDestino.selectedIndex=j; break; } }
        }
    };
    selDestino.onchange=function(){
        if(Number(selDestino.value)===Number(selOrigen.value)){
            alert('Seleccione mesas distintas.');
            for(var k=0;k<selDestino.options.length;k++){ if(!selDestino.options[k].disabled && selDestino.options[k].value){ selDestino.selectedIndex=k; break; } }
        }
    };
    var modal = new bootstrap.Modal(document.getElementById('modalMoverMesa'));
    modal.show();
}

function moverMesaUnir() {
    var origen = Number(document.getElementById('moverOrigen').value);
    var destino = Number(document.getElementById('moverDestino').value);
    if (!origen || !destino || origen === destino) { alert('Seleccione mesas distintas.'); return; }
    fetch(API_BASE + '/api/mesas/unir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_mesa_origen: origen, id_mesa_destino: destino })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.success) {
            var m = bootstrap.Modal.getInstance(document.getElementById('modalMoverMesa'));
            if (m) m.hide();
            mostrarAlerta('success', 'Mesas unidas correctamente. Los pedidos pendientes de la mesa de origen fueron transferidos.');
            cargarMesas();
        } else {
            alert(data.mensaje || 'Error al unir mesas');
        }
    })
    .catch(function() { alert('No se pudo conectar con el servidor'); });
}

// =========================================================
// MODAL CONFIRMACION / FACTURA DE VENTA
// =========================================================

function cargarYMostrarFactura(idPedido, pagosNormales, valesNuevos) {
    fetch(API_BASE + '/api/facturas/pedidos/' + idPedido)
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success && data.factura) {
                ultimaFacturaData = data.factura;
                ultimaFacturaData._pagosExtra = pagosNormales || [];
                ultimaFacturaData._vales = valesNuevos || [];
                renderFacturaConfirmacion(data.factura);
            } else {
                mostrarToast('warning', 'No se pudo cargar el detalle de la factura.');
            }
        })
        .catch(function() {
            mostrarToast('warning', 'No se pudo conectar para cargar la factura.');
        });
}

function renderFacturaConfirmacion(factura) {
    var cont = document.getElementById('contenidoFacturaTicket');
    if (!cont) return;

    var now = new Date();
    var fechaStr = now.toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' });
    var horaStr = now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    var numeroFactura = 'F-' + String(factura.id_pedido).padStart(6, '0');

    var subtotalBruto = 0;
    var totalDescuentos = Number(factura.descuento) || 0;
    var totalPropina = Number(factura.propina) || 0;
    var totalNeto = Number(factura.total) || 0;

    var itemsHTML = '';
    if (factura.detalles && factura.detalles.length > 0) {
        factura.detalles.forEach(function(item) {
            var sub = Number(item.subtotal) || (Number(item.cantidad) * Number(item.precio_unitario));
            subtotalBruto += sub;
            itemsHTML += '<tr style="border-bottom:1px dashed #e5e7eb">' +
                '<td style="padding:6px 0;font-size:.8rem;color:#374151">' +
                    '<div style="font-weight:600">' + escPHP(item.producto_nombre || item.nombre || 'Producto') + '</div>' +
                    '<div style="color:#9ca3af;font-size:.72rem">' + item.cantidad + ' x $' + Number(item.precio_unitario).toLocaleString() + '</div>' +
                '</td>' +
                '<td style="padding:6px 0;text-align:right;font-weight:700;font-size:.82rem;color:#111827">$' + sub.toLocaleString() + '</td>' +
                '</tr>';
        });
    }

    var metodosPagoHTML = '';
    if (factura.metodo_pago) {
        metodosPagoHTML += '<tr style="border-bottom:1px dashed #e5e7eb">' +
            '<td style="padding:5px 0;font-size:.78rem;color:#6b7280">' + escPHP(factura.metodo_pago) +
            (factura.sub_metodo_pago ? ' - ' + escPHP(factura.sub_metodo_pago) : '') + '</td>' +
            '<td style="padding:5px 0;text-align:right;font-size:.78rem;font-weight:600;color:#111827">$' + totalNeto.toLocaleString() + '</td></tr>';
    }

    var vales = factura._vales || [];
    vales.forEach(function(v) {
        metodosPagoHTML += '<tr style="border-bottom:1px dashed #e5e7eb">' +
            '<td style="padding:5px 0;font-size:.78rem;color:#6b7280">Vale / Credito</td>' +
            '<td style="padding:5px 0;text-align:right;font-size:.78rem;font-weight:600;color:#9333ea">$' + Number(v.monto || 0).toLocaleString() + '</td></tr>';
    });

    var html = '<div style="padding:20px;font-family:monospace;font-size:.82rem;color:#111827">' +
        '<div style="text-align:center;margin-bottom:16px;border-bottom:2px solid #111827;padding-bottom:12px">' +
            '<div style="font-size:1.1rem;font-weight:800;letter-spacing:.05em">CLUBMASTER</div>' +
            '<div style="color:#6b7280;font-size:.72rem;margin-top:2px">Factura de Venta</div>' +
            '<div style="font-weight:800;font-size:.9rem;margin-top:6px">' + numeroFactura + '</div>' +
        '</div>' +
        '<div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:.75rem;color:#6b7280">' +
            '<span>Fecha: ' + fechaStr + '</span><span>Hora: ' + horaStr + '</span>' +
        '</div>' +
        '<div style="margin-bottom:12px;font-size:.78rem;color:#374151">' +
            '<div><strong>Mesa:</strong> ' + (factura.mesa_numero || '--') + (factura.mesa_zona ? ' (' + escPHP(factura.mesa_zona) + ')' : '') + '</div>' +
            (factura.usuario_nombre ? '<div><strong>Cajero:</strong> ' + escPHP(factura.usuario_nombre) + '</div>' : '') +
        '</div>';

    html += '<div style="font-weight:700;font-size:.72rem;text-transform:uppercase;color:#6b7280;margin-bottom:6px;letter-spacing:.04em">Detalle de Consumo</div>';
    html += '<table style="width:100%;border-collapse:collapse;margin-bottom:12px">' + itemsHTML + '</table>';

    html += '<div style="border-top:2px solid #111827;padding-top:10px;margin-bottom:10px">';
    html += '<div style="display:flex;justify-content:space-between;font-size:.78rem;color:#6b7280;margin-bottom:4px"><span>Subtotal:</span><span>$' + subtotalBruto.toLocaleString() + '</span></div>';
    if (totalDescuentos > 0) {
        html += '<div style="display:flex;justify-content:space-between;font-size:.78rem;color:#dc2626;margin-bottom:4px"><span>Descuento:</span><span>-$' + totalDescuentos.toLocaleString() + '</span></div>';
    }
    if (totalPropina > 0) {
        html += '<div style="display:flex;justify-content:space-between;font-size:.78rem;color:#7c3aed;margin-bottom:4px"><span>Propina:</span><span>+$' + totalPropina.toLocaleString() + '</span></div>';
    }
    html += '<div style="display:flex;justify-content:space-between;font-size:1rem;font-weight:800;color:#111827;border-top:2px solid #111827;padding-top:8px;margin-top:4px"><span>TOTAL:</span><span>$' + totalNeto.toLocaleString() + '</span></div>';
    html += '</div>';

    if (metodosPagoHTML) {
        html += '<div style="font-weight:700;font-size:.72rem;text-transform:uppercase;color:#6b7280;margin-bottom:6px;letter-spacing:.04em">Metodo de Pago</div>';
        html += '<table style="width:100%;border-collapse:collapse;margin-bottom:12px">' + metodosPagoHTML + '</table>';
    }

    if (factura.referencia_pago) {
        html += '<div style="font-size:.72rem;color:#6b7280;margin-bottom:8px"><strong>Ref:</strong> ' + escPHP(factura.referencia_pago) + '</div>';
    }

    html += '<div style="text-align:center;margin-top:16px;padding-top:12px;border-top:1px dashed #d1d5db;color:#9ca3af;font-size:.7rem">' +
        '<div>Gracias por su visita</div>' +
        '<div style="margin-top:2px">ClubMaster POS</div></div>';
    html += '</div>';

    cont.innerHTML = html;

    if (!modalConfirmacionFactura) {
        modalConfirmacionFactura = new bootstrap.Modal(document.getElementById('modalConfirmacionFactura'));
    }
    modalConfirmacionFactura.show();
}

function imprimirFactura() {
    var ticket = document.getElementById('contenidoFacturaTicket');
    if (!ticket) return;

    var printWindow = window.open('', '_blank', 'width=360,height=600');
    printWindow.document.write(
        '<!DOCTYPE html><html><head><title>Factura</title>' +
        '<style>' +
        'body{font-family:monospace;font-size:12px;color:#000;margin:0;padding:10px;max-width:300px}' +
        'table{width:100%;border-collapse:collapse}' +
        'tr{border-bottom:1px dashed #ccc}' +
        'td{padding:4px 0}' +
        '.text-center{text-align:center}' +
        '.text-right{text-align:right}' +
        '.bold{font-weight:800}' +
        '.total{font-size:14px;border-top:2px solid #000;padding-top:6px;margin-top:6px}' +
        '@media print{body{margin:0;padding:5px}}' +
        '</style></head><body>' +
        ticket.innerHTML +
        '</body></html>'
    );
    printWindow.document.close();
    setTimeout(function() {
        printWindow.print();
        printWindow.close();
    }, 500);
}

function descargarFactura() {
    var ticket = document.getElementById('contenidoFacturaTicket');
    if (!ticket) return;

    var contenido = ticket.innerText;
    var blob = new Blob([contenido], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    var numFactura = ultimaFacturaData ? 'F-' + String(ultimaFacturaData.id_pedido).padStart(6, '0') : 'factura';
    a.download = numFactura + '.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function cerrarConfirmacionFactura() {
    ultimaFacturaData = null;
    cargarMesas();
}
