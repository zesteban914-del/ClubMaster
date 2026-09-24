// =========================================================
// CONTROLADOR: CAJA / JORNADA / ARQUEO DE JORNADA
// Sistema financiero POS: turnos, arqueos ciegos y
// conciliacion bancaria. UI en modo oscuro.
// =========================================================

// =========================================================
// 1. CONFIGURACION Y UTILIDADES
// =========================================================

var DENOMINACIONES = {
    Billetes: [100000, 50000, 20000, 10000, 5000, 2000],
    Monedas: [1000, 500, 200, 100, 50]
};

var CATEGORIAS_EGRESO = ['Pago a proveedor', 'Compra de emergencia', 'Transporte', 'Insumos / Reposicion', 'Servicios', 'Otro'];
var CATEGORIAS_INGRESO = ['Inyeccion de base', 'Reintegro de caja', 'Venta de activos', 'Otro'];

var CAJA_ESTADO = {
    tabActual: 'resumen',
    modulo: null
};
var arqueoRevelado = null;
var ultimoReporte = null;
var modoBlindado = false;
var arqueoCiegoUI = false;
var conteoLineas = [];
var listaUsuarios = [];
var historialCerradas = [];
var historialTotal = 0;
function esCajeroActual(){ try{ var u=typeof usuario!=='undefined'?usuario:null; if(!u) try{u=JSON.parse(localStorage.getItem('usuario')||'{}');}catch(e){} if(!u) return false; var r=(u.rol||'').toLowerCase(); var idRol=Number(u.id_rol); return r.indexOf('cajer')!==-1 || r==='administrador' || r==='admin' || r.indexOf('admin')!==-1 || idRol===1; }catch(e){return false;} }
function puedeAbrirCaja(){ return esCajeroActual(); }

function fNum(v) {
    var n = Number(v);
    return (isFinite(n)) ? n : 0;
}

function fM(v) {
    return '$' + Math.round(fNum(v)).toLocaleString('es-CO');
}

function fFecha(v) {
    if (v === null || v === undefined || v === '') return '--';
    var d = new Date(String(v).replace(/-/g, '/'));
    if (isNaN(d.getTime())) {
        d = new Date(v);
    }
    return isNaN(d.getTime()) ? String(v) : d.toLocaleString('es-CO');
}

function escHTML(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function etiquetaMetodo(metodo, sub) {
    var m = String(metodo || '');
    var s = String(sub || '');
    if (s && m !== 'Efectivo') return m + ' - ' + s;
    return m || 'Sin metodo';
}

// =========================================================
// 2. CSS DEL MODULO (MODO OSCURO)
// =========================================================

function inyectarCSSCaja() {
    if (document.getElementById('cssModuloCaja')) return;
    var style = document.createElement('style');
    style.id = 'cssModuloCaja';
    style.textContent = [
        '.caj-wrap{color:#e2e8f0}',
        '.caj-header{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:18px}',
        '.caj-title{font-size:1.35rem;font-weight:800;color:#f8fafc;letter-spacing:-0.02em;display:flex;align-items:center;gap:10px}',
        '.caj-title i{color:#60a5fa}',
        '.caj-sub{color:#94a3b8;font-size:0.8rem;font-weight:500;margin-top:2px}',
        '.caj-btn{border:none;border-radius:10px;padding:9px 16px;font-weight:600;font-size:0.82rem;cursor:pointer;display:inline-flex;align-items:center;gap:7px;font-family:inherit;transition:all .18s ease;color:#e2e8f0;background:#1e293b;border:1px solid #334155}',
        '.caj-btn:hover{background:#334155;color:#fff;transform:translateY(-1px)}',
        '.caj-btn:disabled{opacity:.55;cursor:not-allowed;transform:none}',
        '.caj-btn-primary{background:linear-gradient(135deg,#2563eb,#3b82f6);border:none;box-shadow:0 4px 14px rgba(37,99,235,.35)}',
        '.caj-btn-primary:hover{background:linear-gradient(135deg,#1d4ed8,#2563eb)}',
        '.caj-btn-success{background:linear-gradient(135deg,#059669,#10b981);border:none;box-shadow:0 4px 14px rgba(16,185,129,.3)}',
        '.caj-btn-danger{background:linear-gradient(135deg,#dc2626,#ef4444);border:none;box-shadow:0 4px 14px rgba(220,38,38,.3)}',
        '.caj-btn-warn{background:linear-gradient(135deg,#d97706,#f59e0b);border:none;box-shadow:0 4px 14px rgba(245,158,11,.3)}',
        '.caj-btn-ghost{background:transparent;border:1px solid #334155;color:#94a3b8}',
        '.caj-btn-block{width:100%;justify-content:center;padding:12px;font-size:0.9rem}',
        '.caj-card{background:#0f172a;border:1px solid #1e293b;border-radius:14px;overflow:hidden}',
        '.caj-card-head{padding:13px 18px;background:#16213a;color:#e2e8f0;font-weight:700;font-size:0.85rem;display:flex;align-items:center;gap:8px;border-bottom:1px solid #1e293b}',
        '.caj-card-head i{color:#60a5fa}',
        '.caj-card-body{padding:18px}',
        '.caj-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:18px;background:#0b1220;padding:6px;border-radius:12px;border:1px solid #1e293b}',
        '.caj-tab-btn{border:none;background:transparent;color:#94a3b8;padding:9px 16px;border-radius:9px;font-weight:600;font-size:0.82rem;cursor:pointer;display:flex;align-items:center;gap:7px;font-family:inherit;transition:all .15s ease}',
        '.caj-tab-btn:hover{color:#e2e8f0;background:#16213a}',
        '.caj-tab-btn.active{background:linear-gradient(135deg,#2563eb,#3b82f6);color:#fff;box-shadow:0 3px 10px rgba(37,99,235,.3)}',
        '.caj-kpi-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px;margin-bottom:16px}',
        '.caj-kpi{background:#0f172a;border:1px solid #1e293b;border-radius:13px;padding:14px 16px;position:relative;overflow:hidden}',
        '.caj-kpi::before{content:"";position:absolute;top:0;left:0;right:0;height:3px}',
        '.caj-kpi.k-blue::before{background:linear-gradient(90deg,#3b82f6,#60a5fa)}',
        '.caj-kpi.k-green::before{background:linear-gradient(90deg,#10b981,#34d399)}',
        '.caj-kpi.k-red::before{background:linear-gradient(90deg,#ef4444,#f87171)}',
        '.caj-kpi.k-amber::before{background:linear-gradient(90deg,#f59e0b,#fbbf24)}',
        '.caj-kpi.k-purple::before{background:linear-gradient(90deg,#8b5cf6,#a78bfa)}',
        '.caj-kpi-label{font-size:.68rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;display:flex;justify-content:space-between;align-items:center}',
        '.caj-kpi-val{font-size:1.35rem;font-weight:800;color:#f8fafc;margin-top:6px;letter-spacing:-0.02em;word-break:break-word}',
        '.caj-kpi-sub{font-size:.7rem;color:#94a3b8;margin-top:3px}',
        '.caj-table{width:100%;border-collapse:collapse;min-width:560px}',
        '.caj-table th{background:#16213a;color:#94a3b8;text-align:left;font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:10px 14px;border-bottom:1px solid #1e293b}',
        '.caj-table td{padding:10px 14px;border-bottom:1px solid #16213a;font-size:.85rem;color:#e2e8f0;vertical-align:middle}',
        '.caj-table tbody tr:hover td{background:#16213a}',
        '.caj-table .right{text-align:right}',
        '.caj-table .center{text-align:center}',
        '.caj-table tfoot td{background:#16213a;font-weight:800;color:#f8fafc;font-size:.9rem}',
        '.caj-scroll{overflow-x:auto;border-radius:0 0 14px 14px}',
        '.caj-cat-row td{background:#0b1220;color:#60a5fa;font-weight:800;font-size:.78rem;text-transform:uppercase;letter-spacing:.05em}',
        '.caj-input,.caj-select{width:100%;background:#1e293b;border:1px solid #334155;color:#f1f5f9;border-radius:10px;padding:10px 12px;font-size:.88rem;font-family:inherit;transition:all .15s ease}',
        '.caj-input:focus,.caj-select:focus{outline:none;border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.15)}',
        '.caj-input::placeholder{color:#475569}',
        '.caj-label{display:block;font-size:.72rem;font-weight:600;color:#94a3b8;margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em}',
        '.caj-field{margin-bottom:14px}',
        '.caj-badge{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-size:.72rem;font-weight:700}',
        '.caj-badge-green{background:#064e3b;color:#34d399}',
        '.caj-badge-red{background:#7f1d1d;color:#fca5a5}',
        '.caj-badge-amber{background:#713f12;color:#fbbf24}',
        '.caj-badge-blue{background:#1e3a8a;color:#93c5fd}',
        '.caj-badge-purple{background:#4c1d95;color:#c4b5fd}',
        '.caj-badge-gray{background:#1e293b;color:#94a3b8}',
        '.caj-status{display:flex;align-items:center;gap:8px;font-weight:700;font-size:.85rem;padding:8px 14px;border-radius:10px;margin-bottom:14px}',
        '.caj-status .dot{width:9px;height:9px;border-radius:50%;background:#22c55e;animation:cajPulse 2s ease-in-out infinite}',
        '@keyframes cajPulse{0%,100%{box-shadow:0 0 0 3px rgba(34,197,94,.2)}50%{box-shadow:0 0 0 6px rgba(34,197,94,.08)}}',
        '.caj-diff{border-radius:12px;padding:16px;text-align:center;font-weight:800;font-size:1.3rem}',
        '.caj-diff small{display:block;font-weight:600;font-size:.72rem;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px}',
        '.caj-diff.ok{background:#052e16;border:1px solid #166534;color:#4ade80}',
        '.caj-diff.falta{background:#450a0a;border:1px solid #991b1b;color:#f87171}',
        '.caj-diff.sobra{background:#451a03;border:1px solid #92400e;color:#fbbf24}',
        '.caj-move{display:flex;align-items:flex-start;gap:12px;padding:12px 14px;border-bottom:1px solid #16213a}',
        '.caj-move:last-child{border-bottom:none}',
        '.caj-move-icon{width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:.95rem}',
        '.caj-move-in{background:#064e3b;color:#34d399}',
        '.caj-move-out{background:#7f1d1d;color:#fca5a5}',
        '.caj-rastro input{height:46px;font-size:1.05rem;font-weight:800;text-align:center}',
        '.caj-note{background:#0b1220;border:1px solid #1e293b;border-left:3px solid #f59e0b;border-radius:10px;padding:12px 14px;font-size:.8rem;color:#cbd5e1;margin-bottom:14px;line-height:1.5}',
        '.caj-note i{color:#fbbf24;margin-right:6px}',
        '.caj-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:16px}',
        '@media(max-width:900px){.caj-grid-2{grid-template-columns:1fr}}',
        '.caj-centrado{min-height:280px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:12px;padding:40px;color:#64748b}',
        '.caj-centrado i{font-size:2.6rem;color:#334155}',
        '.caj-switch{position:relative;display:inline-block;width:46px;height:25px;flex-shrink:0}',
        '.caj-switch input{opacity:0;width:0;height:0}',
        '.caj-switch .sl{position:absolute;cursor:pointer;inset:0;background:#334155;border-radius:25px;transition:.2s}',
        '.caj-switch .sl:before{content:"";position:absolute;height:19px;width:19px;left:3px;top:3px;background:#e2e8f0;border-radius:50%;transition:.2s}',
        '.caj-switch input:checked+.sl{background:#3b82f6}',
        '.caj-switch input:checked+.sl:before{transform:translateX(21px);background:#fff}',
        '.caj-row-toggle{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;background:#16213a;border:1px solid #1e293b;border-radius:10px;margin-bottom:10px}',
        '.caj-row-toggle .t{font-size:.85rem;font-weight:600;color:#e2e8f0}',
        '.caj-row-toggle .s{font-size:.72rem;color:#94a3b8}',
        '.caj-total-big{font-size:1.7rem;font-weight:800;color:#f8fafc;text-align:center;padding:14px;background:#16213a;border:1px solid #1e293b;border-radius:12px}',
        '.caj-total-big span{color:#60a5fa}',
        '.caj-ticket{background:#fff;color:#000;font-family:monospace;padding:10px;border-radius:0}',
        '.caj-lista{max-height:340px;overflow-y:auto}',
        '.caj-wrap{padding-bottom:48px}',
        '.caj-btn-w-100{width:100%;justify-content:center}',
        '.caj-estado-badge{display:inline-flex;align-items:center;gap:8px;padding:7px 14px;border-radius:20px;font-weight:800;font-size:.78rem;letter-spacing:.02em;border:1px solid;cursor:pointer;transition:all .2s}',
        '.caj-estado-badge.abierta{background:#052e16;color:#4ade80;border-color:#166534;box-shadow:0 2px 10px rgba(34,197,94,.25)}',
        '.caj-estado-badge.cerrada{background:#450a0a;color:#fca5a5;border-color:#7f1d1d;box-shadow:0 2px 10px rgba(239,68,68,.2)}',
        '.caj-estado-badge .dot{width:9px;height:9px;border-radius:50%}',
        '.caj-estado-badge.abierta .dot{background:#22c55e;box-shadow:0 0 6px #22c55e;animation:cajPulse 2s infinite}',
        '.caj-estado-badge.cerrada .dot{background:#ef4444;box-shadow:0 0 6px #ef4444}',
        '.caj-apertura-card{max-width:560px;margin:0 auto}',
        '.caj-apertura-head{background:linear-gradient(135deg,#0f172a,#1e293b);padding:20px;text-align:center;border-bottom:1px solid #1e293b}',
        '.caj-apertura-icon{width:64px;height:64px;border-radius:16px;background:linear-gradient(135deg,#059669,#10b981);display:inline-flex;align-items:center;justify-content:center;font-size:1.8rem;color:#fff;box-shadow:0 6px 20px rgba(16,185,129,.35);margin-bottom:12px}',
        '.caj-btn-apertura{background:linear-gradient(135deg,#059669,#10b981);border:none;padding:14px 28px;font-size:.95rem;font-weight:800;letter-spacing:.02em;box-shadow:0 6px 20px rgba(16,185,129,.35);width:100%;justify-content:center;border-radius:12px;color:#fff;cursor:pointer;display:inline-flex;align-items:center;gap:8px;transition:all .2s}',
        '.caj-btn-apertura:hover{transform:translateY(-2px);box-shadow:0 10px 28px rgba(16,185,129,.45)}',
        '.caj-nota-base{background:#0b1220;border:1px solid #1e293b;border-left:3px solid #3b82f6;border-radius:10px;padding:12px 14px;font-size:.78rem;color:#94a3b8;margin-bottom:14px;line-height:1.5}',
        '.caj-nota-base strong{color:#e2e8f0}',
        '.caj-nota-inyeccion{background:linear-gradient(135deg,rgba(59,130,246,.08),rgba(16,185,129,.06));border:1px solid #1e293b;border-left:3px solid #f59e0b;border-radius:10px;padding:12px 14px;font-size:.78rem;color:#cbd5e1;margin-bottom:16px;line-height:1.6}'
    ].join('');
    document.head.appendChild(style);
}

// =========================================================
// 3. INICIALIZACION DEL MODULO
// =========================================================

function badgeEstadoHTML(estado, interactivo) {
    var abierta = estado === 'ABIERTA';
    var cls = abierta ? 'abierta' : 'cerrada';
    var txt = abierta ? '🟢 ABIERTA' : '🔴 CERRADA';
    var accion = interactivo ? (abierta ? ' data-action="caja-tab" data-tab="arqueo"' : ' data-action="caja-iniciar"') : '';
    var hint = abierta ? 'Ver arqueo y cierre' : 'Abrir turno';
    return '<span class="caj-estado-badge ' + cls + '"' + accion + ' title="' + hint + '"><span class="dot"></span>' + txt + '</span>';
}
function actualizarBadgeGlobal(abierta) {
    var g = document.getElementById('jornadaBadge');
    if (g) {
        g.className = 'jornada-badge ' + (abierta ? 'jornada-abierta' : 'jornada-cerrada');
        g.innerHTML = '<span class="jd-dot"></span> ' + (abierta ? 'ABIERTA' : 'CERRADA');
        g.style.cursor = 'pointer';
        g.addEventListener('click', function() {
            if(!abierta && typeof esCajeroActual==='function' && !esCajeroActual()){
                var _rr=(function(){ try{ var u=typeof usuario!=='undefined'?usuario:null; if(!u) u=JSON.parse(localStorage.getItem('usuario')||'{}'); return (u&&u.rol)||'Usuario'; }catch(e){ return 'Usuario'; } })();
                try{ if(typeof mostrarToast==='function') mostrarToast('danger','\uD83D\uDEAB Solo Cajero puede abrir caja. Tu rol: '+_rr); }catch(e){}
                try{ if(typeof mostrarAlerta==='function') mostrarAlerta('danger','\uD83D\uDEAB Acceso restringido: Solo <b>Cajero</b> puede abrir caja.'); }catch(e){}
                return;
            }
            iniciarCaja(); if(abierta) setTimeout(function(){ cajaTab("arqueo"); },150);
        });
        g.title = abierta ? 'Caja abierta — clic para ir a Arqueo y Cierre' : 'Caja cerrada — clic para abrir turno (solo Cajero)';
    }
}
var catalogoZonasCaja = [];
function cargarZonasCaja() {
    return fetch(API_BASE + '/api/zonas').then(function(r){return r.json();}).then(function(d){
        if(d.success) catalogoZonasCaja = d.zonas || [];
    }).catch(function(){});
}
function opcionesBarraHTML(selected) {
    var sel = selected || 'Caja Principal';
    var opts = '<option value="Caja Principal"' + (sel==='Caja Principal'?' selected':'') + '>🏦 Caja Principal</option>';
    opts += '<option value="Barra Principal"' + (sel==='Barra Principal'?' selected':'') + '>🍺 Barra Principal</option>';
    catalogoZonasCaja.forEach(function(z){
        var n = z.nombre;
        if(n==='Caja Principal' || n==='Barra Principal') return;
        opts += '<option value="' + escHTML(n) + '"' + (sel===n?' selected':'') + '>' + escHTML(n) + '</option>';
    });
    opts += '<option value="VIP"' + (sel==='VIP'?' selected':'') + '>⭐ VIP</option>';
    opts += '<option value="Terraza"' + (sel==='Terraza'?' selected':'') + '>🌴 Terraza</option>';
    return opts;
}
function iniciarCaja() {
    try {
        var __esAdminCaja = false;
        if (typeof esAdminRB === 'function') __esAdminCaja = esAdminRB();
        else if (typeof esAdmin === 'function') __esAdminCaja = esAdmin();
        if (__esAdminCaja) {
            try { if (typeof mostrarToast === 'function') mostrarToast('danger', 'El Administrador no opera la caja. Usa tu Panel Financiero.'); } catch (e) {}
            try { if (typeof cargarPanelFinanzas === 'function') { cargarPanelFinanzas(); return; } } catch (e) {}
            return;
        }
    } catch (e) {}
    if(typeof verificarAcceso==='function'&&!verificarAcceso('ver_caja')){if(typeof verificarAccesoRB==='function'&&!verificarAccesoRB('ver_caja'))return;return;}
    if(typeof verificarAccesoRB==='function'&&!verificarAccesoRB('ver_caja'))return;
    inyectarCSSCaja();
    activarNavCaja();
    modoBlindado = false;
    arqueoRevelado = null;
    ultimoReporte = null;

    var contenedor = document.getElementById('main-content');
    contenedor.innerHTML =
        '<div class="page-header" style="margin-bottom:0">' +
        '<div>' +
        '<h2 style="color:#0f172a"><i class="bi bi-cash-register" style="color:#3b82f6"></i>Caja / Turno</h2>' +
        '<p style="color:#64748b;font-size:.78rem;margin:4px 0 0;font-weight:500">Gestión de apertura, movimientos y cierre de caja</p>' +
        '</div>' +
        '<div class="page-header-right" style="display:flex;align-items:center;gap:10px">' +
        '<span id="badgeEstadoCajaHeader"></span>' +
        '<button class="btn-refresh" data-action="caja-iniciar"><i class="bi bi-arrow-clockwise"></i> Actualizar</button>' +
        '</div>' +
        '</div>' +
        '<div id="contenedorAlertas" style="margin-bottom:12px"></div>' +
        '<div id="contenedorCaja" class="caj-wrap"><div class="text-center py-5"><div class="spinner-border text-primary"></div></div></div>';

    Promise.all([fetch(API_BASE + '/api/jornada/activa').then(function(r){return r.json();}).catch(function(){return {success:false}}), cargarZonasCaja()])
        .then(function(all){
            var data = all[0];
            if (data.success) {
                jornadaActiva = data.jornada;
                resumenJornada = data.resumen || null;
            } else {
                jornadaActiva = null;
                resumenJornada = null;
            }
            if (jornadaActiva) {
                arqueoCiegoUI = jornadaActiva.arqueo_ciego === 1 || jornadaActiva.arqueo_ciego === true;
            }
            actualizarBadgeGlobal(!!jornadaActiva);
            var bh = document.getElementById('badgeEstadoCajaHeader');
            if(bh) bh.innerHTML = badgeEstadoHTML(jornadaActiva ? 'ABIERTA' : 'CERRADA', true);
            renderVistaCaja();
        })
        .catch(function() {
            document.getElementById('contenedorCaja').innerHTML =
                '<div class="caj-card" style="border-color:#7f1d1d;padding:24px;text-align:center;color:#fca5a5;background:#450a0a">' +
                '<i class="bi bi-exclamation-triangle" style="font-size:2rem;display:block;margin-bottom:8px"></i>No se pudo conectar con el servidor.</div>';
        });
}

function renderVistaCaja() {
    var cont = document.getElementById('contenedorCaja');
    if (!cont) return;
    var bh = document.getElementById('badgeEstadoCajaHeader');
    if(bh) bh.innerHTML = badgeEstadoHTML(jornadaActiva ? 'ABIERTA' : 'CERRADA', true);
    actualizarBadgeGlobal(!!jornadaActiva);
    if (ultimoReporte) {
        cont.innerHTML = renderVistaCierre();
        return;
    }
    if (!jornadaActiva) {
        if(!esCajeroActual()){
            var _rolTxt2=(function(){ try{ var u=typeof usuario!=='undefined'?usuario:null; if(!u) u=JSON.parse(localStorage.getItem('usuario')||'{}'); return (u.rol||'Usuario'); }catch(e){ return 'Usuario'; } })();
            cont.innerHTML = '<div class="caj-card" style="border-color:#7f1d1d;background:#450a0a;padding:32px;text-align:center;color:#fca5a5"><div style="width:64px;height:64px;border-radius:16px;background:#7f1d1d;display:inline-flex;align-items:center;justify-content:center;font-size:1.8rem;margin-bottom:12px"><i class="bi bi-shield-lock"></i></div><div style="font-weight:800;font-size:1.1rem;color:#fecaca">\uD83D\uDEAB Acceso restringido</div><div style="font-size:.85rem;margin-top:6px">Solo el rol <b>Cajero</b> (o Administrador) puede realizar la apertura de caja.</div><div style="font-size:.78rem;margin-top:4px;color:#f87171">Tu rol actual: <b>'+escapeHTML(_rolTxt2)+'</b> — solicita a un Cajero que inicie el turno.</div><div style="margin-top:14px"><button class="caj-btn caj-btn-ghost" data-action="caja-mesas"><i class="bi bi-grid-3x3-gap me-1"></i> Volver a Mesas</button></div></div>';
            try{ if(typeof mostrarToast==='function') mostrarToast('danger','\uD83D\uDEAB Solo Cajero puede abrir caja. Rol actual: '+escapeHTML(_rolTxt2)); }catch(e){}
            return;
        }
        cont.innerHTML = renderVistaAbrirWrapper();
        cargarUsuariosParaCaja();
        setTimeout(cargarZonasParaApertura, 80);
        return;
    }
    cont.innerHTML = renderNavJornada();
    renderTabActual();
}
function renderVistaAbrirWrapper(){
    var html = '<div style="display:flex;justify-content:center;margin-bottom:14px">' + badgeEstadoHTML('CERRADA', false) + '</div>';
    try { if (typeof puedeVerFinanzasExternas === 'function' && puedeVerFinanzasExternas()) html += '<div style="display:flex;justify-content:center;margin-bottom:14px"><button class="caj-btn caj-btn-primary" data-action="caja-fin-modal"><i class="bi bi-bank me-1"></i> Finanzas Externas — Proveedores</button></div>'; } catch (e) {}
    html += renderVistaAbrir();
    html += '<div class="caj-nota-base" style="max-width:560px;margin:14px auto 0"><i class="bi bi-info-circle"></i> <strong>¿Qué es la Base Inicial?</strong> Es el efectivo con el que abre la caja para dar vueltas y sencillo. Una vez abierto el turno, use <strong>Registrar Entrada → Inyección de base</strong> para añadir más cambio sin cerrar el turno.</div>';
    return html;
}
function cargarZonasParaApertura(){
    var sel = document.getElementById('selectBarraCaja');
    if(!sel) return;
    sel.innerHTML = opcionesBarraHTML(sel.value || 'Caja Principal');
}

function activarNavCaja() {
    var target = 'navCaja';
    var navIds = ['navMesas', 'navInventario', 'navCaja', 'navFinanzas', 'navProveedores', 'navCompras', 'navUsuarios', 'navReportes', 'navFacturacion', 'navMermas', 'navSpeedBar', 'navVales'];
    navIds.forEach(function(id) {
        var el = document.getElementById(id);
        if (el) {
            if (id === target) el.classList.add('active');
            else el.classList.remove('active');
        }
    });
    if (typeof setFabVisible === 'function') setFabVisible(false);
}

// =========================================================
// 4. VISTA: ABRIR NUEVA JORNADA
// =========================================================

function renderVistaAbrir() {
    var nombre = usuario ? (usuario.nombre || 'Usuario') : (jornadaActiva ? (jornadaActiva.usuario_apertura || 'Usuario') : 'Usuario');
    var idUsuarioSel = usuario ? (usuario.id_usuario || '') : '';
    var esActualCajeroRender = (function(){ try{ var rr=(usuario&&usuario.rol?String(usuario.rol):'').toLowerCase(); return rr.indexOf('cajer')!==-1||rr.indexOf('admin')!==-1||Number(usuario&&usuario.id_rol)===1; }catch(e){return false;} })();
    var listaFiltrada = (typeof filtrarSoloCajeros==='function' && listaUsuarios.length) ? filtrarSoloCajeros(listaUsuarios) : listaUsuarios;
    if(!listaFiltrada.length && listaUsuarios.length) listaFiltrada = listaUsuarios;
    var opcionesUsuarios = '';
    if (listaFiltrada.length > 0) {
        listaFiltrada.forEach(function(u) {
            var sel = String(u.id_usuario) === String(idUsuarioSel) && esActualCajeroRender ? ' selected' : '';
            var rolTxt = u.rol_nombre||u.rol||'Usuario';
            opcionesUsuarios += '<option value="' + u.id_usuario + '"' + sel + '>' + escHTML(u.nombre) + ' (' + escHTML(rolTxt) + ')</option>';
        });
        if(!esActualCajeroRender){
            opcionesUsuarios = '<option value="" disabled selected>Seleccione Cajero/Administrador...</option>' + opcionesUsuarios;
        }
    } else {
        if(esActualCajeroRender){
            opcionesUsuarios = '<option value="' + idUsuarioSel + '" selected>' + escHTML(nombre) + ' (' + escHTML((usuario&&usuario.rol)||'Cajero') + ')</option>';
        } else {
            opcionesUsuarios = '<option value="" disabled selected>No hay Cajeros — contacte Administrador</option>';
        }
    }

    return '<div class="caj-apertura-card"><div class="caj-card" style="border:1px solid #1e293b;overflow:hidden">' +
        '<div class="caj-apertura-head">' +
        '<div class="caj-apertura-icon"><i class="bi bi-unlock"></i></div>' +
        '<div style="font-size:1.15rem;font-weight:800;color:#f8fafc">Apertura de Turno / Jornada</div>' +
        '<div style="font-size:.78rem;color:#94a3b8;margin-top:4px">Configure la base inicial y el responsable para iniciar la caja</div>' +
        '<div style="margin-top:10px">' + badgeEstadoHTML('CERRADA', false) + '</div>' +
        '</div>' +
        '<div class="caj-card-body" style="padding:24px;background:#0b1220">' +
        '<div class="caj-field">' +
        '<label class="caj-label"><i class="bi bi-person-badge me-1"></i>Cajero / Administrador responsable *</label>' +
        '<select class="caj-select" id="selectResponsable" data-change="caja-cajero">' + opcionesUsuarios + '</select>' +
        '</div>' +
        '<div class="caj-field" style="background:#16213a;border:1px solid #1e293b;border-radius:10px;padding:12px 14px;margin-top:-4px">' +
        '<div style="display:flex;align-items:center;gap:10px"><div style="width:34px;height:34px;border-radius:9px;background:#1e293b;color:#60a5fa;display:flex;align-items:center;justify-content:center"><i class="bi bi-person-check-fill"></i></div>' +
        '<div><div style="font-weight:700;color:#e2e8f0;font-size:.85rem"><span id="cajeroSeleccionado">' + escHTML(nombre) + '</span></div><div style="font-size:.72rem;color:#64748b">Responsable del turno</div></div></div>' +
        '</div>' +
        '<div class="caj-field">' +
        '<label class="caj-label"><i class="bi bi-cash-coin me-1"></i>Monto de Base Inicial en Efectivo ($) *</label>' +
        '<input type="number" class="caj-input" id="inputMontoInicial" min="0" step="1000" value="0" style="font-size:1.2rem;font-weight:800;text-align:center;letter-spacing:.02em" placeholder="Ej: 200.000">' +
        '<div style="font-size:.7rem;color:#64748b;margin-top:5px;text-align:center">Efectivo para sencillo y vueltas al iniciar</div>' +
        '</div>' +
        '<div class="caj-field">' +
        '<label class="caj-label"><i class="bi bi-shop me-1"></i>Barra / Caja asignada *</label>' +
        '<select class="caj-select" id="selectBarraCaja">' + opcionesBarraHTML('Caja Principal') + '</select>' +
        '<div style="font-size:.7rem;color:#64748b;margin-top:5px">Seleccione dónde operará este turno</div>' +
        '</div>' +
        '<div class="caj-row-toggle">' +
        '<div><div class="t">Arqueo ciego de seguridad</div><div class="s">Oculta el efectivo esperado hasta que ingreses el conteo físico.</div></div>' +
        '<label class="caj-switch"><input type="checkbox" id="chkArqueoCiegoAbrir" ><span class="sl"></span></label>' +
        '</div>' +
        '<div class="caj-row-toggle">' +
        '<div><div class="t">Incluir propina en el cuadre</div><div class="s">Suma la propina en efectivo al total esperado de caja.</div></div>' +
        '<label class="caj-switch"><input type="checkbox" id="chkPropinaCuadreAbrir" checked><span class="sl"></span></label>' +
        '</div>' +
        '<button class="caj-btn-apertura" data-action="caja-abrir"><i class="bi bi-unlock-fill"></i> 🔓 Abrir Caja e Iniciar Turno</button>' +
        '<div style="text-align:center;margin-top:10px"><button class="caj-btn caj-btn-ghost" style="font-size:.78rem;padding:7px 14px" data-action="caja-ver-historial"><i class="bi bi-clock-history me-1"></i>Ver Historial de Jornadas</button></div>' +
        '</div></div></div>';
}
function renderAperturaEnArqueo(){
    var html = '<div style="text-align:center;margin-bottom:16px"><span class="caj-badge caj-badge-red" style="font-size:.8rem;padding:6px 14px"><span style="width:8px;height:8px;background:#ef4444;border-radius:50%;display:inline-block;margin-right:6px"></span>🔴 Caja CERRADA — Debe abrir un turno</span></div>';
    html += renderVistaAbrir();
    html += '<div class="caj-nota-base" style="max-width:560px;margin:14px auto 0"><i class="bi bi-lightbulb" style="color:#fbbf24"></i> Al abrir el turno se registra la <strong>base inicial</strong> de la caja.</div>';
    return html;
}

function filtrarSoloCajeros(lista){
    if(!Array.isArray(lista)) return [];
    return lista.filter(function(u){
        var r=(u.rol_nombre||u.rol||u.nombre_rol||'').toString().toLowerCase();
        var idRol=Number(u.id_rol);
        return r.indexOf('cajer')!==-1 || r.indexOf('admin')!==-1 || idRol===1;
    });
}
function cargarUsuariosParaCaja() {
    return fetch(API_BASE + '/api/usuarios')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success) {
                var soloCajeros = filtrarSoloCajeros(data.usuarios);
                listaUsuarios = soloCajeros.length ? soloCajeros : data.usuarios;
                if(!soloCajeros.length){
                    console.warn('No hay usuarios Cajero/Administrador para apertura');
                }
            }
            var sel = document.getElementById('selectResponsable');
            if (sel && listaUsuarios.length > 0) {
                var idActual = usuario ? (usuario.id_usuario || '') : '';
                var esActualCajero = (function(){ try{ var rr=(usuario&&usuario.rol?String(usuario.rol):'').toLowerCase(); return rr.indexOf('cajer')!==-1||rr.indexOf('admin')!==-1||Number(usuario&&usuario.id_rol)===1; }catch(e){return false;} })();
                var html = '';
                var match = false;
                listaUsuarios.forEach(function(u) {
                    var s = String(u.id_usuario) === String(idActual) && esActualCajero ? ' selected' : '';
                    if (String(u.id_usuario) === String(idActual) && esActualCajero) match = true;
                    var rolTxt = u.rol_nombre||u.rol||'Usuario';
                    html += '<option value="' + u.id_usuario + '"' + s + '>' + escHTML(u.nombre) + ' (' + escHTML(rolTxt) + ')</option>';
                });
                if(!esActualCajero && listaUsuarios.length){
                    html = '<option value="" disabled selected>Seleccione Cajero/Administrador...</option>' + html;
                }
                if(!html) html='<option value="" disabled selected>No hay Cajeros registrados — cree uno en Usuarios</option>';
                sel.innerHTML = html;
                var isSelCajero = listaUsuarios.some(function(u){ return String(u.id_usuario)===String(sel.value) && ((u.rol_nombre||u.rol||'').toLowerCase().indexOf('cajer')!==-1 || (u.rol_nombre||u.rol||'').toLowerCase().indexOf('admin')!==-1); });
                if(!isSelCajero && sel.options.length) sel.selectedIndex = 0;
                if (match && document.getElementById('cajeroSeleccionado')) {
                    document.getElementById('cajeroSeleccionado').textContent = (usuario && usuario.nombre) || '';
                } else if(document.getElementById('cajeroSeleccionado') && listaUsuarios[0]){
                    document.getElementById('cajeroSeleccionado').textContent = listaUsuarios[0].nombre;
                }
            } else if(sel){
                sel.innerHTML='<option value="" disabled selected>No hay Cajeros/Administradores disponibles</option>';
            }
        })
        .catch(function() {});
}

function actualizarCajeroSeleccionado() {
    var sel = document.getElementById('selectResponsable');
    if (!sel) return;
    var id = sel.value;
    var match = listaUsuarios.filter(function(u) { return String(u.id_usuario) === String(id); });
    var el = document.getElementById('cajeroSeleccionado');
    if (el) el.textContent = match.length > 0 ? match[0].nombre : 'Usuario';
}

function parseMonto(v){
    if(v==null) return 0;
    var s=String(v).trim();
    s=s.replace(/\s/g,'').replace(/\$/g,'');
    if(s.indexOf(',')!==-1 && s.indexOf('.')!==-1){
        s=s.replace(/\./g,'').replace(',','.');
    } else if(s.indexOf(',')!==-1){
        s=s.replace(/\./g,'').replace(',','.');
    } else {
        s=s.replace(/\./g,'');
        s=s.replace(/[^0-9\-]/g,'');
    }
    var n=Number(s);
    return isFinite(n)?n:0;
}
function abrirJornadaCaja() {
    if(!esCajeroActual()){
        var _rr=(function(){ try{ var u=typeof usuario!=='undefined'?usuario:null; if(!u) u=JSON.parse(localStorage.getItem('usuario')||'{}'); return (u&&u.rol)||'Usuario'; }catch(e){ return 'Usuario'; } })();
        try{ mostrarAlerta('danger','\uD83D\uDEAB Acceso restringido: Solo el rol <b>Cajero</b> (o Administrador) puede abrir caja. Tu rol: <b>'+escapeHTML(_rr)+'</b>'); }catch(e){}
        try{ if(typeof mostrarToast==='function') mostrarToast('danger','\uD83D\uDEAB Solo Cajero puede abrir caja'); }catch(e){}
        var _b=document.querySelector('.caj-btn-apertura'); if(_b){ _b.disabled=false; _b.innerHTML='🔓 Abrir Caja e Iniciar Turno'; }
        return;
    }
    var raw=document.getElementById('inputMontoInicial').value;
    var monto = parseMonto(raw);
    if(!raw || String(raw).trim()==='') monto=0;
    if (monto < 0) {
        mostrarAlerta('warning', 'Ingrese un monto inicial valido.');
        return;
    }
    var barraSel = document.getElementById('selectBarraCaja');
    var barra = barraSel ? barraSel.value : 'Caja Principal';
    if (!barra || !barra.trim()) { mostrarAlerta('warning','Seleccione la Barra / Caja asignada.'); return; }
    var arqueoCiego = document.getElementById('chkArqueoCiegoAbrir') ? document.getElementById('chkArqueoCiegoAbrir').checked : false;
    var incluirPropina = document.getElementById('chkPropinaCuadreAbrir') ? document.getElementById('chkPropinaCuadreAbrir').checked : true;
    var idUsuario = usuario ? (usuario.id_usuario || 1) : 1;
    var selResp = document.getElementById('selectResponsable');
    if (selResp && selResp.value) idUsuario = selResp.value;

    var btn = document.querySelector('.caj-btn-apertura');
    if(btn){ btn.disabled=true; btn.innerHTML='<span class="spinner-border spinner-border-sm me-1"></span>Abriendo caja...'; }
    fetch(API_BASE + '/api/jornada/abrir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monto_inicial: monto, id_usuario: idUsuario, incluir_propina_caja: incluirPropina, arqueo_ciego: arqueoCiego, barra_asignada: barra })
    })
    .then(function(r){ return r.text().then(function(t){ var j; try{ j=JSON.parse(t);}catch(e){ j={success:false,mensaje:t.substring(0,300)};} return {ok:r.ok, data:j}; }); })
    .then(function(wrap){
        var data=wrap.data;
        if (wrap.ok && data.success) {
            mostrarAlerta('success', '✅ Jornada #' + data.id_jornada + ' abierta en ' + escHTML(barra) + '. Base: ' + fM(monto));
            setTimeout(function(){ iniciarCaja(); }, 250);
        } else {
            var b2 = document.querySelector('.caj-btn-apertura'); if(b2){ b2.disabled=false; b2.innerHTML='🔓 Abrir Caja e Iniciar Turno'; }
            mostrarAlerta('danger', (data && data.mensaje) || 'Error al abrir la jornada');
            console.error('abrir jornada error', data);
        }
    })
    .catch(function(err) {
        var b3 = document.querySelector('.caj-btn-apertura'); if(b3){ b3.disabled=false; b3.innerHTML='🔓 Abrir Caja e Iniciar Turno'; }
        mostrarAlerta('danger', 'No se pudo conectar con el servidor' + (err && err.message ? ': '+err.message : ''));
        console.error(err);
    });
}

// =========================================================
// 5. NAVEGACION POR TABS
// =========================================================

function renderNavJornada() {
    var nombreCajero = jornadaActiva.usuario_apertura || (usuario ? usuario.nombre : '') || 'Cajero';
    var barraTxt = jornadaActiva.barra_asignada || 'Caja Principal';
    var tabs = [
        ['resumen', 'bi-speedometer2', 'Resumen'],
        ['ingresos', 'bi-graph-up-arrow', 'Desglose Ingresos'],
        ['vaciados', 'bi-safe', 'Vaciados / Retiros'],
        ['auditoria', 'bi-shield-exclamation', 'Auditoría'],
        ['facturas', 'bi-receipt', 'Facturas del Turno'],
        ['arqueo', 'bi-search', 'Arqueo y Cierre'],
        ['historial', 'bi-clock-history', 'Historial de Jornadas']
    ];
    var html = '<div class="caj-card" style="margin-bottom:16px">' +
        '<div class="caj-card-body" style="background:#0b1220;padding:16px 18px;display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap">' +
        '<div>' +
        '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
        badgeEstadoHTML('ABIERTA', false) +
        '<strong style="color:#f8fafc;font-size:.95rem">Jornada #' + jornadaActiva.id_jornada + '</strong>' +
        '<span class="caj-badge caj-badge-blue"><i class="bi bi-shop"></i> ' + escHTML(barraTxt) + '</span>' +
        '</div>' +
        '<div class="caj-sub" style="margin-top:6px"><i class="bi bi-clock me-1"></i>' + fFecha(jornadaActiva.fecha_apertura) + ' &nbsp;|&nbsp; <i class="bi bi-person me-1"></i>' + escHTML(nombreCajero) + '</div>' +
        '</div>' +
        '<div style="text-align:right;display:flex;align-items:center;gap:10px">' +
        '<div><div class="caj-sub">Base de caja</div>' +
        '<div style="font-size:1.15rem;font-weight:800;color:#f8fafc">' + fM(jornadaActiva.monto_inicial) + '</div></div>' +
        '<button class="caj-btn caj-btn-danger" style="padding:8px 14px;font-size:.78rem" data-action="caja-tab" data-tab="arqueo" title="Ir a cerrar turno"><i class="bi bi-lock-fill me-1"></i>Cerrar Turno</button>' +
        '</div>' +
        '</div></div>';

    html += '<div class="caj-tabs">';
    tabs.forEach(function(t) {
        html += '<button class="caj-tab-btn' + (CAJA_ESTADO.tabActual === t[0] ? ' active' : '') + '" data-action="caja-tab" data-tab="' + t[0] + '"><i class="bi ' + t[1] + '"></i>' + t[2] + '</button>';
    });
    html += '</div>';
    html += '<div id="cajaTabContent"></div>';
    return html;
}

function cajaTab(tab) {
    CAJA_ESTADO.tabActual = tab;
    renderTabActual();
}

function renderTabActual() {
    var cont = document.getElementById('cajaTabContent');
    if (!cont) return;
    switch (CAJA_ESTADO.tabActual) {
        case 'ingresos': cont.innerHTML = renderTabIngresos(); break;
        case 'vaciados': cont.innerHTML = renderTabVaciados(); cargarVaciados(); break;
        case 'auditoria': cont.innerHTML = renderTabAuditoria(); cargarAuditoria(); break;
        case 'facturas': cont.innerHTML = renderTabFacturas(); cargarFacturasTurno(); break;
        case 'arqueo': cont.innerHTML = renderTabArqueo(); break;
        case 'historial': cont.innerHTML = renderTabHistorial(); cargarHistorialCerradas(); break;
        default: cont.innerHTML = renderTabResumen(); break;
    }
}

// =========================================================
// 6. TAB RESUMEN
// =========================================================

function renderTabResumen() {
    var r = resumenJornada || {};
    var j = jornadaActiva || {};
    var totalPropinas = fNum(r.propina_efectivo) + fNum(r.propina_tarjeta);
    var totalIngresos = fNum(r.total_ingresos) || (fNum(r.ventas_netas) + fNum(r.ingresos_extra) + totalPropinas);
    var html = '<div class="caj-kpi-grid">' +
        kpiCard('k-blue', 'bi-receipt', 'Ventas Brutas (Mesas)', fM(r.ventas_brutas), 'total mesas facturadas') +
        kpiCard('k-red', 'bi-tag', 'Descuentos', fM(r.descuentos), 'descuentos aplicados') +
        kpiCard('k-purple', 'bi-gift', 'Cortesias', fM(r.cortesias), 'obsequios / mermas por cortesia') +
        kpiCard('k-green', 'bi-check2-circle', 'Ventas Netas (Mesas)', fM(r.ventas_netas), 'ingreso neto del bar (sin propinas)') +
        kpiCard('k-amber', 'bi-currency-dollar', 'Total Propinas Recaudadas', fM(totalPropinas), 'efectivo: ' + fM(r.propina_efectivo) + ' | tarjeta: ' + fM(r.propina_tarjeta)) +
        kpiCard('k-green', 'bi-box-arrow-down', 'Ingresos Extra', fM(r.ingresos_extra), 'inyecciones base / reintegros') +
        kpiCard('k-blue', 'bi-graph-up-arrow', 'TOTAL INGRESOS (c/ propinas)', fM(totalIngresos), 'ventas netas + propinas + ingresos extra') +
        kpiCard('k-red', 'bi-box-arrow-up', 'Gastos Caja Chica', fM(r.gastos_efectivo), 'egresos del turno') +
        '</div>';

    var ocultarEsperado = arqueoCiegoUI;
    html += '<div class="caj-nota-base" style="margin-bottom:12px"><i class="bi bi-info-circle" style="color:#60a5fa"></i> <strong>Separación obligatoria:</strong> <span style="color:#059669">Ventas Netas (bar) = ' + fM(r.ventas_netas) + '</span> | <span style="color:#d97706">Propinas (personal) = ' + fM(totalPropinas) + '</span>. Las propinas NO son ingreso del bar, son para liquidación del personal.</div>';
    html += '<div class="caj-grid-2">';
    html += '<div class="caj-card">' +
        '<div class="caj-card-head"><i class="bi bi-shield-check"></i> Conciliacion de Caja (Efectivo Físico)</div>' +
        '<div class="caj-card-body">' +
        filaConciliacion('Base Inicial', fM(j.monto_inicial)) +
        filaConciliacion('Ventas Mesas en Efectivo', fM(efectivoEnCaja()), ocultarEsperado) +
        filaConciliacion('Propina en Efectivo (mesas)', fM(r.propina_efectivo), ocultarEsperado ? !incluyePropinaCuadre() : false) +
        filaConciliacion('Ingresos Extra (efectivo)', fM(r.ingresos_extra)) +
        filaConciliacion('Gastos en Efectivo', '-' + fM(r.gastos_efectivo)) +
        filaTotal('Efectivo Esperado en Cajón', fM(esperadoCliente()), ocultarEsperado) +
        filaConciliacion('TOTAL INGRESOS (todos los métodos)', fM(totalIngresos)) +
        '</div></div>';

    html += '<div class="caj-card">' +
        '<div class="caj-card-head"><i class="bi bi-flag"></i> Metodos de Pago</div>' +
        '<div class="caj-card-body" style="padding:0">' +
        resumenMetodosMini() +
        '</div></div>';
    html += '</div>';

    if (ocultarEsperado) {
        html += '<div class="caj-note" style="margin-top:16px"><i class="bi bi-eye-slash"></i><strong>Arqueo ciego activo:</strong> el efectivo esperado se mantiene oculto hasta que se ingrese y confirme el conteo fisico en la pestana <em>Arqueo y Cierre</em>.</div>';
    }
    try { if (typeof puedeVerFinanzasExternas === 'function' && puedeVerFinanzasExternas()) html += '<div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap"><button class="caj-btn caj-btn-primary" data-action="caja-fin-modal"><i class="bi bi-bank me-1"></i> Finanzas Externas — Proveedores</button></div>'; } catch (e) {}
    return html;
}

function kpiCard(cls, icon, label, val, sub) {
    return '<div class="caj-kpi ' + cls + '">' +
        '<div class="caj-kpi-label">' + label + ' <i class="bi ' + icon + '"></i></div>' +
        '<div class="caj-kpi-val">' + val + '</div>' +
        '<div class="caj-kpi-sub">' + sub + '</div>' +
        '</div>';
}

function filaConciliacion(label, valor, ocultar) {
    if (ocultar) valor = '<span class="caj-badge caj-badge-gray" style="font-size:.68rem"><i class="bi bi-eye-slash"></i> OCULTO</span>';
    return '<div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #16213a;font-size:.85rem">' +
        '<span style="color:#94a3b8">' + label + '</span><span style="color:#e2e8f0;font-weight:600">' + valor + '</span></div>';
}

function filaTotal(label, valor, ocultar) {
    if (ocultar) valor = '<span class="caj-badge caj-badge-gray" style="font-size:.68rem"><i class="bi bi-eye-slash"></i> OCULTO</span>';
    return '<div style="display:flex;justify-content:space-between;padding:12px 0 4px;font-size:.95rem">' +
        '<span style="color:#f8fafc;font-weight:800">' + label + '</span><span style="color:#60a5fa;font-weight:800">' + valor + '</span></div>';
}

function efectivoEnCaja() {
    var r = resumenJornada || {};
    if (!r.desglose) return 0;
    return r.desglose.filter(function(x) { return String(x.metodo_pago).toLowerCase() === 'efectivo'; })
        .reduce(function(acc, x) { return acc + fNum(x.subtotal); }, 0);
}

function incluyePropinaCuadre() {
    if (resumenJornada && resumenJornada.incluir_propina) return true;
    if (jornadaActiva) return jornadaActiva.incluir_propina_caja === 1 || jornadaActiva.incluir_propina_caja === true;
    return true;
}

function esperadoCliente() {
    var r = resumenJornada || {};
    var j = jornadaActiva || {};
    var base = fNum(j.monto_inicial);
    var ef = efectivoEnCaja();
    var prop = incluyePropinaCuadre() ? fNum(r.propina_efectivo) : 0;
    return base + ef + prop + fNum(r.ingresos_extra) - fNum(r.gastos_efectivo);
}

function resumenMetodosMini() {
    var r = resumenJornada || {};
    var grupos = agruparPorCategoria(r.desglose || []);
    var html = '';
    ordenCategorias.forEach(function(cat) {
        if (grupos[cat] && grupos[cat].length) html += miniCatRow(cat, grupos[cat]);
    });
    if (!html) html = '<div style="padding:18px;text-align:center;color:#64748b;font-size:.82rem">Sin ventas pagadas en este turno.</div>';
    return html;
}

// =========================================================
// 7. TAB DESGLOSE DE INGRESOS
// =========================================================

var ordenCategorias = ['Efectivo', 'Wallet', 'Tarjeta', 'Credito', 'Cortesia'];

function simboloCategoria(cat) {
    switch (cat) {
        case 'Efectivo': return ['bi-cash', '#10b981'];
        case 'Wallet': return ['bi-phone', '#3b82f6'];
        case 'Tarjeta': return ['bi-credit-card', '#a855f7'];
        case 'Credito': return ['bi-wallet2', '#f59e0b'];
        case 'Cortesia': return ['bi-gift', '#ec4899'];
        default: return ['bi-circle', '#94a3b8'];
    }
}

function etiquetaCategoria(cat) {
    switch (cat) {
        case 'Efectivo': return 'Efectivo';
        case 'Wallet': return 'Transferencias / Wallets';
        case 'Tarjeta': return 'Tarjetas (Datáfono / Franquicia)';
        case 'Credito': return 'Credito de la casa / Vales';
        case 'Cortesia': return 'Cortesias / Obsequios';
        default: return 'Otros';
    }
}

function categoriaMetodoCliente(metodo) {
    var m = String(metodo || '').toLowerCase();
    if (m === 'efectivo') return 'Efectivo';
    if (['nequi', 'daviplata', 'breb', 'breb_qr', 'qr', 'pse'].indexOf(m) !== -1) return 'Wallet';
    if (['debito', 'credito', 'tarjeta', 'visa', 'mastercard', 'amex'].indexOf(m) !== -1) return 'Tarjeta';
    if (m === 'cortesia') return 'Cortesia';
    return 'Credito';
}

function agruparPorCategoria(desglose) {
    var g = {};
    desglose.forEach(function(row) {
        var cat = categoriaMetodoCliente(row.metodo_pago);
        if (!g[cat]) g[cat] = [];
        g[cat].push(row);
    });
    return g;
}

function miniCatRow(cat, filas) {
    var sim = simboloCategoria(cat);
    var total = filas.reduce(function(acc, f) { return acc + fNum(f.subtotal); }, 0);
    var count = filas.reduce(function(acc, f) { return acc + fNum(f.cantidad); }, 0);
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid #16213a">' +
        '<div style="display:flex;align-items:center;gap:10px">' +
        '<span style="width:30px;height:30px;border-radius:8px;background:#1e293b;color:' + sim[1] + ';display:flex;align-items:center;justify-content:center"><i class="bi ' + sim[0] + '"></i></span>' +
        '<div><div style="font-size:.82rem;font-weight:700;color:#e2e8f0">' + etiquetaCategoria(cat) + '</div>' +
        '<div style="font-size:.7rem;color:#64748b">' + count + ' ventas</div></div>' +
        '</div><strong style="color:#f8fafc">' + fM(total) + '</strong></div>';
}

function renderTabIngresos() {
    var r = resumenJornada || {};
    var grupos = agruparPorCategoria(r.desglose || []);

    var html = '<div class="caj-card"><div class="caj-card-head"><i class="bi bi-graph-up-arrow"></i> Desglose de Ingresos por Metodo de Pago</div>' +
        '<div class="caj-scroll"><table class="caj-table">' +
        '<thead><tr><th>Metodo</th><th>Detalle</th><th class="center">#</th><th class="right">Subtotal</th><th class="right">Desc.</th><th class="right">Propina</th></tr></thead><tbody>';

    var totalSub = 0, totalDesc = 0, totalProp = 0;
    ordenCategorias.forEach(function(cat) {
        if (!grupos[cat] || !grupos[cat].length) return;
        var sim = simboloCategoria(cat);
        html += '<tr class="caj-cat-row"><td colspan="6"><i class="bi ' + sim[0] + '" style="margin-right:7px;color:' + sim[1] + '"></i>' + etiquetaCategoria(cat) + '</td></tr>';
        grupos[cat].forEach(function(row) {
            var detalle = row.sub_metodo ? escHTML(row.sub_metodo) : '<span style="color:#475569">-</span>';
            if (row.referencia) detalle += ' <span style="color:#334155;font-size:.75rem">(' + escHTML(row.referencia) + ')</span>';
            var icon = row.metodo_pago === 'Cortesia'
                ? '<span style="color:#ec4899"><i class="bi bi-gift"></i> Cortesia</span>'
                : '<span style="color:#e2e8f0">' + escHTML(etiquetaMetodo(row.metodo_pago, '')) + '</span>';
            totalSub += fNum(row.subtotal);
            totalDesc += fNum(row.descuento);
            totalProp += fNum(row.propina);
            html += '<tr>' +
                '<td>' + icon + '</td>' +
                '<td style="color:#94a3b8">' + detalle + '</td>' +
                '<td class="center" style="color:#94a3b8">' + fNum(row.cantidad) + '</td>' +
                '<td class="right" style="color:#f8fafc;font-weight:600">' + fM(row.subtotal) + '</td>' +
                '<td class="right" style="color:#fbbf24">' + fM(row.descuento) + '</td>' +
                '<td class="right" style="color:#c4b5fd">' + fM(row.propina) + '</td>' +
                '</tr>';
        });
    });
    html += '</tbody><tfoot><tr>' +
        '<td colspan="3" class="right">TOTAL</td>' +
        '<td class="right">' + fM(totalSub) + '</td>' +
        '<td class="right">' + fM(totalDesc) + '</td>' +
        '<td class="right">' + fM(totalProp) + '</td>' +
        '</tr></tfoot></table></div></div>';

    // Separacion de propina (no mezclar con las ventas)
    html += '<div class="caj-grid-2" style="margin-top:16px">' +
        '<div class="caj-card"><div class="caj-card-head"><i class="bi bi-currency-dollar"></i> Propina Voluntaria (no hace parte de las ventas)</div>' +
        '<div class="caj-card-body">' +
        filaConciliacion('Propina en Efectivo', fM(r.propina_efectivo)) +
        filaConciliacion('Propina con Tarjeta / Electronico', fM(r.propina_tarjeta)) +
        '<div style="border-top:1px solid #1e293b;margin-top:8px;padding-top:8px;display:flex;justify-content:space-between;font-weight:800;font-size:.95rem">' +
        '<span style="color:#f8fafc">Total Propina</span><span style="color:#c4b5fd">' + fM(fNum(r.propina_efectivo) + fNum(r.propina_tarjeta)) + '</span></div>' +
        '</div></div>' +
        '<div class="caj-card"><div class="caj-card-head"><i class="bi bi-receipt"></i> Ventas Netas del Negocio</div>' +
        '<div class="caj-card-body">' +
        filaConciliacion('Ventas Brutas', fM(r.ventas_brutas)) +
        filaConciliacion('Descuentos', '-' + fM(r.descuentos)) +
        filaConciliacion('Cortesias', '-' + fM(r.cortesias)) +
        filaTotal('Ventas Netas', fM(r.ventas_netas)) +
        '</div></div></div>';

    return html;
}

// =========================================================
// 8. TAB CAJA CHICA (MOVIMIENTOS)
// =========================================================

function renderTabCajaChica() {
    var mov = (resumenJornada && resumenJornada.movimientos) || [];
    var totalIn = 0, totalOut = 0;
    mov.forEach(function(m) {
        if (m.tipo === 'Ingreso') totalIn += fNum(m.monto);
        else totalOut += fNum(m.monto);
    });

    var catOptions = [];
    CATEGORIAS_EGRESO.forEach(function(c) { catOptions.push('<option value="' + c + '">' + c + '</option>'); });

    var html = '<div class="caj-grid-2">';

    // Formulario
    html += '<div class="caj-card"><div class="caj-card-head"><i class="bi bi-plus-circle"></i> Registrar Entrada / Salida de Caja</div>' +
        '<div class="caj-card-body">' +
        '<div class="caj-nota-inyeccion"><i class="bi bi-lightbulb" style="color:#f59e0b"></i> <strong>Inyección de base</strong> = añadir cambio/sencillo a un turno <strong>YA abierto</strong> (ej: traer $50.000 en monedas).<br><span style="color:#94a3b8">Para la apertura inicial use la pestaña <strong>Arqueo y Cierre</strong> → <strong>🔓 Abrir Caja e Iniciar Turno</strong>.</span></div>' +
        '<div class="row g-3">' +
        '<div class="col-6"><div class="caj-field"><label class="caj-label">Tipo de movimiento</label>' +
        '<select class="caj-select" id="movTipo" data-change="caja-tipo-mov">' +
        '<option value="Ingreso" style="color:#34d399">Ingreso — Inyección de base (turno ya abierto)</option>' +
        '<option value="Egreso" selected style="color:#f87171">Egreso (salida de dinero)</option>' +
        '</select></div></div>' +
        '<div class="col-6"><div class="caj-field"><label class="caj-label">Categoria</label>' +
        '<select class="caj-select" id="movCategoria">' + catOptions.join('') + '</select></div></div>' +
        '<div class="col-12"><div class="caj-field"><label class="caj-label">Concepto</label>' +
        '<input type="text" class="caj-input" id="movConcepto" placeholder="Ej: pago de agua, transporte de personal..."></div></div>' +
        '<div class="col-6"><div class="caj-field"><label class="caj-label">Monto ($)</label>' +
        '<input type="number" class="caj-input" id="movMonto" min="0" value="" placeholder="0"></div></div>' +
        '<div class="col-6"><div class="caj-field"><label class="caj-label">Comprobante / Factura</label>' +
        '<input type="text" class="caj-input" id="movComprobante" placeholder="Ej: F-000123"></div></div>' +
        '<div class="col-12"><div class="caj-field"><label class="caj-label">Justificacion</label>' +
        '<textarea class="caj-input" id="movJustificacion" rows="2" placeholder="Motivo y respaldo del movimiento"></textarea></div></div>' +
        '<div class="col-12">' +
        '<button class="caj-btn caj-btn-primary caj-btn-block" data-action="caja-registrar-mov"><i class="bi bi-check2-circle me-1"></i> Registrar Movimiento</button>' +
        '</div></div>' +
        '</div></div>';

    // Listado y totales
    html += '<div class="caj-card"><div class="caj-card-head"><i class="bi bi-list-ul"></i> Movimientos del Turno</div>';
    html += '<div class="caj-card-body" style="padding-bottom:0">' +
        '<div class="caj-kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:0">' +
        '<div class="caj-kpi k-green"><div class="caj-kpi-label">Ingresos</div><div class="caj-kpi-val" style="font-size:1.05rem;color:#34d399">' + fM(totalIn) + '</div></div>' +
        '<div class="caj-kpi k-red"><div class="caj-kpi-label">Egresos</div><div class="caj-kpi-val" style="font-size:1.05rem;color:#f87171">' + fM(totalOut) + '</div></div>' +
        '<div class="caj-kpi k-blue"><div class="caj-kpi-label">Saldo Neto</div><div class="caj-kpi-val" style="font-size:1.05rem;color:#60a5fa">' + fM(totalIn - totalOut) + '</div></div>' +
        '</div></div>' +
        '<div class="caj-lista" style="border-top:1px solid #1e293b">';

    if (mov.length === 0) {
        html += '<div class="caj-centrado" style="min-height:120px;padding:24px"><i class="bi bi-inbox"></i>Sin movimientos registrados</div>';
    } else {
        mov.forEach(function(m) {
            var esIn = m.tipo === 'Ingreso';
            html += '<div class="caj-move">' +
                '<span class="caj-move-icon ' + (esIn ? 'caj-move-in' : 'caj-move-out') + '"><i class="bi ' + (esIn ? 'bi-box-arrow-down' : 'bi-box-arrow-up') + '"></i></span>' +
                '<div style="flex:1;min-width:0">' +
                '<div style="display:flex;justify-content:space-between;gap:8px"><strong style="color:#e2e8f0;font-size:.85rem">' + escHTML(m.categoria) + '</strong>' +
                '<strong style="color:' + (esIn ? '#34d399' : '#f87171') + '">' + (esIn ? '+' : '-') + fM(m.monto) + '</strong></div>' +
                '<div style="font-size:.78rem;color:#94a3b8">' + escHTML(m.concepto) + '</div>' +
                '<div style="font-size:.7rem;color:#475569;margin-top:3px"><i class="bi bi-person me-1"></i>' + escHTML(m.usuario_nombre || 'Sistema') +
                ' &nbsp;<i class="bi bi-clock me-1"></i>' + fFecha(m.fecha) +
                (m.numero_comprobante ? ' &nbsp;<i class="bi bi-file-text me-1"></i>' + escHTML(m.numero_comprobante) : '') + '</div>' +
                (m.justificacion ? '<div style="font-size:.72rem;color:#64748b;margin-top:3px;font-style:italic">' + escHTML(m.justificacion) + '</div>' : '') +
                '</div></div>';
        });
    }
    html += '</div></div></div>';
    return html;
}

function cambiarTipoMovimiento() {
    var tipo = document.getElementById('movTipo').value;
    var sel = [];
    (tipo === 'Ingreso' ? CATEGORIAS_INGRESO : CATEGORIAS_EGRESO).forEach(function(c) { sel.push('<option value="' + c + '">' + c + '</option>'); });
    if (document.getElementById('movCategoria')) document.getElementById('movCategoria').innerHTML = sel.join('');
}

// =========================================================
// 8b. TAB FACTURAS DEL TURNO
// =========================================================

function renderTabFacturas() {
    return '<div class="caj-card"><div class="caj-card-head"><i class="bi bi-receipt"></i> Facturas del Turno Actual</div>' +
        '<div class="caj-card-body" style="padding-bottom:0">' +
        '<div id="facturasTurnoStats" class="caj-kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:0"></div>' +
        '</div>' +
        '<div id="facturasTurnoListado" class="caj-lista" style="border-top:1px solid #1e293b">' +
        '<div class="caj-centrado" style="min-height:120px;padding:24px"><div class="spinner-border spinner-border-sm text-primary"></div> Cargando facturas...</div>' +
        '</div></div>';
}

function cargarFacturasTurno() {
    if (!jornadaActiva) {
        document.getElementById('facturasTurnoListado').innerHTML =
            '<div class="caj-centrado" style="min-height:120px;padding:24px"><i class="bi bi-clock-history"></i>No hay jornada activa.</div>';
        return;
    }
    fetch(API_BASE + '/api/facturas?id_jornada=' + jornadaActiva.id_jornada)
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success) {
                renderFacturasTurnoListado(data.facturas || []);
            } else {
                document.getElementById('facturasTurnoListado').innerHTML =
                    '<div class="caj-centrado" style="min-height:120px;padding:24px;color:#f87171"><i class="bi bi-exclamation-triangle"></i>Error al cargar facturas</div>';
            }
        })
        .catch(function() {
            document.getElementById('facturasTurnoListado').innerHTML =
                '<div class="caj-centrado" style="min-height:120px;padding:24px;color:#f87171"><i class="bi bi-wifi-off"></i>No se pudo conectar con el servidor</div>';
        });
}

function renderFacturasTurnoListado(facturas) {
    var statsEl = document.getElementById('facturasTurnoStats');
    var listEl = document.getElementById('facturasTurnoListado');

    var totalVentas = 0;
    var totalDescuentos = 0;
    var totalPropina = 0;
    facturas.forEach(function(f) {
        totalVentas += fNum(f.total);
        totalDescuentos += fNum(f.descuento);
        totalPropina += fNum(f.propina);
    });

    statsEl.innerHTML =
        kpiCard('k-blue', 'bi-receipt', 'Total Facturas', String(facturas.length), 'ventas cerradas en el turno') +
        kpiCard('k-green', 'bi-currency-dollar', 'Ventas Totales', fM(totalVentas), 'ingresos por facturacion') +
        kpiCard('k-red', 'bi-tag', 'Descuentos', fM(totalDescuentos), 'descuentos aplicados') +
        kpiCard('k-purple', 'bi-currency-dollar', 'Propinas', fM(totalPropina), 'propinas recibidas');

    if (facturas.length === 0) {
        listEl.innerHTML = '<div class="caj-centrado" style="min-height:160px;padding:30px"><i class="bi bi-inbox"></i><p>Sin facturas registradas en este turno</p></div>';
        return;
    }

    var html = '<table class="caj-table"><thead><tr>' +
        '<th>Factura</th><th>Mesa</th><th>Fecha/Hora</th><th>Metodo</th><th class="right">Descuento</th><th class="right">Propina</th><th class="right">Total</th><th class="center">Acciones</th>' +
        '</tr></thead><tbody>';

    facturas.forEach(function(f) {
        var fechaHora = fFecha(f.timestamp_despacho);
        var metodo = escHTML(f.metodo_pago || '');
        if (f.sub_metodo_pago) metodo += ' <span style="color:#64748b;font-size:.72rem">(' + escHTML(f.sub_metodo_pago) + ')</span>';
        var numFact = 'F-' + String(f.id_pedido).padStart(6, '0');

        html += '<tr>' +
            '<td><span style="font-weight:700;color:#60a5fa;font-size:.82rem">' + numFact + '</span></td>' +
            '<td style="font-weight:600">' + escapeHTML(f.mesa_numero || '--') + '</td>' +
            '<td style="color:#94a3b8;font-size:.8rem">' + fechaHora + '</td>' +
            '<td>' + metodo + '</td>' +
            '<td class="right" style="color:#fbbf24">' + fM(f.descuento) + '</td>' +
            '<td class="right" style="color:#c4b5fd">' + fM(f.propina) + '</td>' +
            '<td class="right" style="font-weight:800;color:#f8fafc">' + fM(f.total) + '</td>' +
            '<td class="center">' +
            '<button class="caj-btn caj-btn-ghost" style="padding:4px 8px;font-size:.72rem" data-action="caja-ver-factura" data-id="' + f.id_pedido + '" title="Ver detalle"><i class="bi bi-eye"></i></button> ' +
            '<button class="caj-btn caj-btn-ghost" style="padding:4px 8px;font-size:.72rem" data-action="caja-reimprimir-factura" data-id="' + f.id_pedido + '" title="Reimprimir"><i class="bi bi-printer"></i></button>' +
            '</td></tr>';
    });

    html += '</tbody><tfoot><tr>' +
        '<td colspan="4" class="right" style="color:#94a3b8;font-size:.82rem">' + facturas.length + ' factura(s)</td>' +
        '<td class="right">' + fM(totalDescuentos) + '</td>' +
        '<td class="right">' + fM(totalPropina) + '</td>' +
        '<td class="right">' + fM(totalVentas) + '</td>' +
        '<td></td></tr></tfoot></table>';

    listEl.innerHTML = html;
}

function verDetalleFacturaCaja(idPedido) {
    fetch(API_BASE + '/api/facturas/pedidos/' + idPedido)
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success && data.factura) {
                ultimaFacturaData = data.factura;
                renderFacturaConfirmacion(data.factura);
            } else {
                mostrarAlerta('warning', 'No se pudo cargar la factura.');
            }
        })
        .catch(function() {
            mostrarAlerta('danger', 'No se pudo conectar con el servidor.');
        });
}

function reimprimirFacturaCaja(idPedido) {
    fetch(API_BASE + '/api/facturas/pedidos/' + idPedido)
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success && data.factura) {
                ultimaFacturaData = data.factura;
                renderFacturaConfirmacion(data.factura);
            }
        })
        .catch(function() {});
}

function registrarMovimientoCaja() {
    if (!jornadaActiva) return;
    var tipo = document.getElementById('movTipo').value;
    var categoria = document.getElementById('movCategoria').value;
    var concepto = document.getElementById('movConcepto').value;
    var monto = fNum(document.getElementById('movMonto').value);
    var comprobante = document.getElementById('movComprobante').value;
    var justificacion = document.getElementById('movJustificacion').value;

    if (monto <= 0) {
        mostrarAlerta('warning', 'Ingrese un monto mayor a 0.');
        return;
    }
    if (tipo === 'Egreso' && !justificacion.trim()) {
        if (!confirm('El egreso no tiene justificacion. Registrar de todos modos?')) return;
    }

    fetch(API_BASE + '/api/movimientos-caja', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            id_jornada: jornadaActiva.id_jornada,
            tipo: tipo,
            categoria: categoria,
            concepto: concepto,
            monto: monto,
            comprobante: comprobante,
            justificacion: justificacion,
            id_usuario: usuario ? (usuario.id_usuario || 1) : 1
        })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.success) {
            mostrarAlerta('success', 'Movimiento registrado: ' + tipo + ' ' + fM(monto));
            recargarDatosJornada('cajachica');
        } else {
            mostrarAlerta('danger', data.mensaje || 'Error al registrar el movimiento');
        }
    })
    .catch(function() {
        mostrarAlerta('danger', 'No se pudo conectar con el servidor');
    });
}

// =========================================================
// 9. TAB ARQUEO Y CIERRE
// =========================================================

function renderTabArqueo() {
    if (!jornadaActiva) {
        return renderAperturaEnArqueo();
    }
    var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' + badgeEstadoHTML('ABIERTA', false) + '<span style="font-size:.75rem;color:#94a3b8"><i class="bi bi-shop me-1"></i>' + escHTML(jornadaActiva.barra_asignada || 'Caja Principal') + ' · Jornada #' + jornadaActiva.id_jornada + '</span></div>';
    html += '<div class="caj-nota-inyeccion"><i class="bi bi-info-circle me-1" style="color:#f59e0b"></i> <strong>Arqueo ciego y cierre:</strong> Ingrese el conteo físico real. El <strong>efectivo esperado</strong> se revela solo al calcular, para un cuadre honesto.</div>';
    html += '<div class="caj-row-toggle">' +
        '<div><div class="t"><i class="bi bi-shield-lock me-1" style="color:#fbbf24"></i>Arqueo ciego de seguridad</div>' +
        '<div class="s">Mientras este activo, el "Efectivo Esperado" queda oculto hasta confirmar el conteo fisico. Evita que el cajero ajuste numeros.</div></div>' +
        '<label class="caj-switch"><input type="checkbox" id="chkArqueoCIego" ' + (arqueoCiegoUI ? 'checked' : '') + ' data-change="caja-arqueo-ciego"><span class="sl"></span></label>' +
        '</div>';

    html += '<div class="caj-row-toggle">' +
        '<div><div class="t"><i class="bi bi-incognito me-1"></i>Blindaje total (avanzado)</div>' +
        '<div class="s">Ademas oculta las ventas en efectivo y la propina en el resumen y el desglose.</div></div>' +
        '<label class="caj-switch"><input type="checkbox" id="chkBlindaje" ' + (modoBlindado ? 'checked' : '') + ' data-change="caja-blindado"><span class="sl"></span></label>' +
        '</div>';

    // Cantidades de billetes y monedas
    html += '<div class="caj-card"><div class="caj-card-head"><i class="bi bi-cash-stack"></i> Conteo Fisico - Billetes y Monedas</div>' +
        '<div class="caj-card-body">' +
        '<div class="row g-3">';

    var firstId = null;
    var idx = 0;
    DENOMINACIONES.Billetes.forEach(function(d) {
        var id = 'con_' + d;
        if (idx === 0) firstId = id;
        html += '<div class="col-6 col-md-4 col-lg-3 col-xl-2"><div class="caj-field">' +
            '<label class="caj-label">Billete ' + fM(d) + '</label>' +
            '<input type="number" min="0" class="caj-input caj-rastro-in' + (idx === 0 ? ' caj-primer-input' : '') + '" id="' + id + '" data-denom="' + d + '" data-tipo="Billete" value="' + conteoValor(d) + '" placeholder="0" data-input="caja-conteo">' +
            '</div></div>';
        idx++;
    });
    html += '<div class="col-12"><div style="height:1px;background:#1e293b;margin:6px 0 16px"></div></div>';
    DENOMINACIONES.Monedas.forEach(function(d) {
        var id = 'con_' + d;
        html += '<div class="col-6 col-md-4 col-lg-3 col-xl-2"><div class="caj-field">' +
            '<label class="caj-label">Moneda ' + fM(d) + '</label>' +
            '<input type="number" min="0" class="caj-input" id="' + id + '" data-denom="' + d + '" data-tipo="Moneda" value="' + conteoValor(d) + '" placeholder="0" data-input="caja-conteo">' +
            '</div></div>';
    });

    html += '</div>' +
        '<div class="caj-total-big" style="margin-top:8px">Total Contado: <span id="txtContadoArqueo">$0</span></div>' +
        '</div></div>';

    // Panel de resultado
    html += '<div class="caj-card" style="margin-top:16px"><div class="caj-card-head"><i class="bi bi-calculator"></i> Resultado del Arqueo</div>' +
        '<div class="caj-card-body">';

    if (!arqueoRevelado) {
        var oculto = arqueoCiegoUI;
        html += '<div class="caj-grid-2">' +
            '<div>' + filaConciliacion('Efectivo Esperado', oculto ? '<span class="caj-badge caj-badge-gray">OCULTO <i class="bi bi-eye-slash"></i></span>' : fM(esperadoCliente())) +
            filaConciliacion('Conteo Fisico', '<span id="txtEsperadoArqueo">$0</span>') +
            '</div><div style="display:flex;flex-direction:column;justify-content:center;gap:10px">' +
            '<button class="caj-btn caj-btn-primary caj-btn-block" data-action="caja-revelar" id="btnRevelar"><i class="bi bi-eye me-1"></i>' + (oculto ? 'Revelar resultado del arqueo' : 'Calcular diferencia (arqueo)') + '</button>' +
            '<button class="caj-btn caj-btn-danger caj-btn-block" data-action="caja-cerrar" id="btnCerrarJornada"><i class="bi bi-lock-fill me-1"></i>Confirmar y Cerrar Jornada</button>' +
            '</div></div>';
    } else {
        var rep = arqueoRevelado.resumen || {};
        html += renderResultadoArqueo(reportData(arqueoRevelado), arqueoRevelado.jornada);
    }
    html += '</div></div>';
    return html;
}

function reportData(r) {
    return r && r.resumen ? r.resumen : (r || {});
}

function cambiarArqueoCiegoUI(val) {
    arqueoCiegoUI = val;
    renderTabActual();
}

function obtenerArqueoLineas() {
    var lineas = [];
    document.querySelectorAll('#cajaTabContent input[data-denom]').forEach(function(input) {
        var denom = Number(input.getAttribute('data-denom'));
        var tipo = input.getAttribute('data-tipo');
        var cant = parseInt(input.value, 10);
        if (isNaN(cant)) cant = 0;
        lineas.push({ tipo: tipo, denominacion: denom, valor: denom, cantidad: Math.max(0, cant) });
    });
    return lineas;
}

function conteoValor(d) {
    for (var i = 0; i < conteoLineas.length; i++) {
        if (Number(conteoLineas[i].denominacion) === Number(d)) return conteoLineas[i].cantidad;
    }
    return '';
}

function actualizarConteoArqueo() {
    var lineas = [];
    var total = 0;
    document.querySelectorAll('#cajaTabContent input[data-denom]').forEach(function(input) {
        var denom = Number(input.getAttribute('data-denom'));
        var cant = parseInt(input.value, 10);
        if (isNaN(cant)) cant = 0;
        cant = Math.max(0, cant);
        lineas.push({ tipo: input.getAttribute('data-tipo'), denominacion: denom, valor: denom, cantidad: cant });
        total += cant * denom;
    });
    conteoLineas = lineas;
    document.getElementById('txtContadoArqueo').textContent = fM(total);
    var el = document.getElementById('txtEsperadoArqueo');
    if (el) el.textContent = fM(total);
}

function revelarArqueo() {
    if (!jornadaActiva) return;
    var lineas = obtenerArqueoLineas();
    var btn = document.getElementById('btnRevelar');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Calculando...'; }

    fetch(API_BASE + '/api/jornada/revisar-arqueo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            id_jornada: jornadaActiva.id_jornada,
            arqueo: lineas,
            incluir_propina_caja: incluyePropinaCuadre()
        })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (btn) { btn.disabled = false; btn.innerHTML = 'Revelar resultado del arqueo'; }
        if (data.success) {
            arqueoRevelado = data;
            mostrarAlerta('info', 'Arqueo revisado. Revise la diferencia antes de cerrar.');
            renderTabActual();
        } else {
            mostrarAlerta('danger', data.mensaje || 'Error al revisar el arqueo');
        }
    })
    .catch(function() {
        if (btn) { btn.disabled = false; btn.innerHTML = 'Revelar resultado del arqueo'; }
        mostrarAlerta('danger', 'No se pudo conectar con el servidor');
    });
}

function cerrarJornadaPos() {
    try {
        if (!jornadaActiva) { mostrarAlerta('warning','No hay jornada activa para cerrar.'); return; }
        var lineas = obtenerArqueoLineas();
        if (!lineas || !lineas.length) {
            var tmp = []; var totalTmp = 0;
            document.querySelectorAll('input[data-denom]').forEach(function(input){
                var denom = Number(input.getAttribute('data-denom'));
                var cant = parseInt(input.value,10); if(isNaN(cant)) cant=0;
                tmp.push({tipo:input.getAttribute('data-tipo'), denominacion:denom, valor:denom, cantidad:Math.max(0,cant)});
                totalTmp+= Math.max(0,cant)*denom;
            });
            if(tmp.length) lineas = tmp;
        }
        if (!contestadoArqueo()) return;
        var diffInfo = arqueoRevelado ? (arqueoRevelado.resumen || {}) : null;
        var diff = diffInfo ? fNum(diffInfo.diferencia) : 0;
        if (!arqueoRevelado) {
            var conteoTmp = lineas.reduce(function(a,l){return a + (Number(l.cantidad)||0)*(Number(l.valor||l.denominacion)||0);},0);
            var esperadoTmp = esperadoCliente();
            diff = conteoTmp - esperadoTmp;
        }
        var msg = 'Cerrar la jornada #' + Number(jornadaActiva.id_jornada) + '?\n\nEsta accion genera el reporte final (X/Z) y no se puede deshacer.\n\nDiferencia del arqueo: ' + fM(diff) + ' (' + tipoDiferencia(diff) + ')';
        if (!confirm(msg)) return;
        var btn = document.getElementById('btnCerrarJornada');
        if (!btn) {
            var btns = document.querySelectorAll('button[data-action="caja-cerrar"]');
            if(btns.length) btn = btns[0];
        }
        if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Cerrando...'; }
        fetch(API_BASE + '/api/jornada/cerrar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_jornada: jornadaActiva.id_jornada,
                arqueo: lineas,
                incluir_propina_caja: incluyePropinaCuadre(),
                id_usuario_cierre: usuario ? (usuario.id_usuario || 1) : 1
            })
        })
        .then(function(r){ return r.text().then(function(t){ var j; try{ j=JSON.parse(t);}catch(e){ j={success:false,mensaje:t.substring(0,300)};} return {ok:r.ok, data:j}; }); })
        .then(function(wrap) {
            var data = wrap.data;
            if (wrap.ok && data.success) {
                ultimoReporte = data;
                jornadaActiva = null;
                resumenJornada = null;
                conteoLineas = [];
                arqueoRevelado = null;
                actualizarBadgeGlobal(false);
                var bh=document.getElementById('badgeEstadoCajaHeader'); if(bh) bh.innerHTML=badgeEstadoHTML('CERRADA',true);
                mostrarAlerta('success', 'Jornada #' + Number(data.jornada.id_jornada) + ' cerrada. ' + tipoDiferencia(fNum(data.resumen.diferencia)) + ' ' + fM(data.resumen.diferencia));
                renderVistaCaja();
            } else {
                if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-lock-fill me-1"></i>Confirmar y Cerrar Jornada'; }
                mostrarAlerta('danger', (data && data.mensaje) || 'Error al cerrar la jornada');
                console.error('cerrar jornada error:', data);
            }
        })
        .catch(function(err) {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-lock-fill me-1"></i>Confirmar y Cerrar Jornada'; }
            mostrarAlerta('danger', 'No se pudo conectar con el servidor: ' + (err && err.message ? err.message : ''));
            console.error(err);
        });
    } catch(e) {
        console.error('cerrarJornadaPos exception', e);
        mostrarAlerta('danger','Error interno: ' + e.message);
    }
}

function contestadoArqueo() {
    var total = 0;
    document.querySelectorAll('#cajaTabContent input[data-denom]').forEach(function(input) {
        var denom = Number(input.getAttribute('data-denom'));
        var cant = parseInt(input.value, 10);
        if (!isNaN(cant)) total += Math.max(0, cant) * denom;
    });
    if (total === 0 && !confirm('El conteo fisico esta en $0. Si la caja no tiene efectivo, confirme. Continuar?')) {
        return false;
    }
    return true;
}

function tipoDiferencia(dif) {
    if (dif === 0) return 'CUADRE PERFECTO';
    if (dif > 0) return 'SOBRANTE';
    return 'FALTANTE';
}

function renderResultadoArqueo(rep, jornada) {
    var diff = fNum(rep.diferencia);
    var cls, etiq, icon;
    if (diff === 0) { cls = 'ok'; etiq = 'CUADRE PERFECTO'; icon = 'bi-check-circle-fill'; }
    else if (diff > 0) { cls = 'sobra'; etiq = 'SOBRANTE'; icon = 'bi-arrow-up-circle-fill'; }
    else { cls = 'falta'; etiq = 'FALTANTE'; icon = 'bi-arrow-down-circle-fill'; }

    var totalPropinas = fNum(rep.propina_efectivo) + fNum(rep.propina_tarjeta);
    var ventasNetas = fNum(rep.ventas_netas) || (fNum(rep.total_ingresos) - totalPropinas - fNum(rep.ingresos_extra));

    return '<div style="margin-bottom:14px">' +
        '<div class="caj-diff ' + cls + '"><small><i class="bi ' + icon + '"></i> ' + etiq + '</small>' + (diff > 0 ? '+' : '') + fM(diff) + '</div>' +
        '<div class="caj-nota-base" style="margin-top:8px;background:#fef3c7;border-color:#fde68a"><i class="bi bi-info-circle" style="color:#d97706"></i> <strong>Separación obligatoria para liquidación:</strong> <span style="color:#059669">Ventas Netas (bar): ' + fM(ventasNetas) + '</span> | <span style="color:#d97706">Total Propinas (personal): ' + fM(totalPropinas) + '</span> (Efectivo: ' + fM(rep.propina_efectivo) + ' | Tarjeta: ' + fM(rep.propina_tarjeta) + ')</div>' +
        '</div>' +
        '<div class="caj-grid-2">' +
        '<div>' +
        filaConciliacion('Base de caja', fM(jornada.monto_inicial)) +
        filaConciliacion('Ventas Netas en Efectivo (bar)', fM(rep_efectivoVentas(rep))) +
        filaConciliacion('Propina en Efectivo (personal)', fM(rep.propina_efectivo)) +
        filaConciliacion('Ingresos Extra', fM(rep.ingresos_extra)) +
        filaConciliacion('Gastos Caja Chica', '-' + fM(rep.gastos_efectivo)) +
        filaTotal('Efectivo Esperado en Cajón', fM(rep.esperado)) +
        '</div><div>' +
        filaConciliacion('Cajero apertura', escHTML(jornada.usuario_apertura || '--')) +
        filaConciliacion('Cajero cierre', escHTML(jornada.usuario_cierre || usuario && usuario.nombre || '--')) +
        filaConciliacion('Incluye propina en cuadre', (jornada.incluir_propina_caja ? 'Si' : 'No')) +
        filaConciliacion('Fecha apertura', fFecha(jornada.fecha_apertura)) +
        '</div></div>' +
        '<div style="display:flex;gap:10px;margin-top:16px">' +
        '<button class="caj-btn caj-btn-danger" style="flex:1;justify-content:center" data-action="caja-cerrar"><i class="bi bi-lock-fill me-1"></i>Confirmar y Cerrar Jornada</button>' +
        '<button class="caj-btn caj-btn-ghost" data-action="caja-recontar"><i class="bi bi-arrow-counterclockwise me-1"></i>Recontar</button>' +
        '</div>';
}

function rep_efectivoVentas(rep) {
    if (!rep.desglose) return 0;
    return rep.desglose.filter(function(r) { return String(r.metodo_pago).toLowerCase() === 'efectivo'; })
        .reduce(function(acc, r) { return acc + fNum(r.subtotal); }, 0);
}

// =========================================================
// 9B. TAB HISTORIAL DE JORNADAS (AUDITORIA)
// =========================================================

function renderTabHistorial() {
    var html = '<div class="caj-card"><div class="caj-card-head"><i class="bi bi-clock-history"></i> Historial de Jornadas Cerradas</div>' +
        '<div class="caj-card-body" style="padding:14px 18px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">' +
        '<div style="color:#94a3b8;font-size:.82rem"><i class="bi bi-shield-check me-1" style="color:#34d399"></i>Auditoria de cierres con descuadres, responsable y fecha.</div>' +
        '<div style="display:flex;gap:8px">' +
        '<button class="caj-btn" data-action="caja-exp-hist"><i class="bi bi-file-earmark-excel me-1" style="color:#34d399"></i>Exportar a Excel</button>' +
        '<button class="caj-btn" data-action="caja-cargar-hist"><i class="bi bi-arrow-clockwise me-1"></i>Actualizar</button>' +
        '</div></div>' +
        '<div class="caj-scroll"><table class="caj-table">' +
        '<thead><tr>' +
        '<th># Jornada</th><th>Fecha Cierre</th><th>Cajero Apertura</th><th>Cajero Cierre</th>' +
        '<th class="right">Base Ini.</th><th class="right">Ventas Netas</th><th class="right">Esperado</th>' +
        '<th class="right">Contado</th><th class="right">Diferencia</th><th class="center">Acciones</th>' +
        '</tr></thead><tbody id="cuerpoHistorial">' +
        '<tr><td colspan="10" class="center" style="color:#64748b"><div class="spinner-border spinner-border-sm text-primary me-2"></div>Cargando historial...</td></tr>' +
        '</tbody></table></div>' +
        '<div class="caj-card-body" style="padding:10px 16px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #1e293b;flex-wrap:wrap;gap:8px">' +
        '<div style="color:#94a3b8;font-size:.75rem"><span id="txtTotalHistorial">0</span> jornadas cerradas</div>' +
        '<div style="display:flex;gap:8px;align-items:center">' +
        '<button class="caj-btn caj-btn-ghost" id="btnHistPrev" style="padding:6px 12px" data-action="caja-hist-pag" data-dir="-1"><i class="bi bi-chevron-left"></i></button>' +
        '<span style="color:#94a3b8;font-size:.8rem" id="txtHistPagina">Pagina 1</span>' +
        '<button class="caj-btn caj-btn-ghost" id="btnHistNext" style="padding:6px 12px" data-action="caja-hist-pag" data-dir="1"><i class="bi bi-chevron-right"></i></button>' +
        '</div></div></div>';
    return html;
}

var historialPaginaActual = 0;
var historialTamPagina = 20;

function volverAFormularioApertura(){
    ultimoReporte=null;
    CAJA_ESTADO.tabActual='resumen';
    var cont=document.getElementById('contenedorCaja');
    if(!cont) return iniciarCaja();
    cont.innerHTML=renderVistaAbrirWrapper();
    cargarUsuariosParaCaja();
    setTimeout(cargarZonasParaApertura,80);
}
function verHistorialSolo() {
    historialPaginaActual = 0;
    var cont = document.getElementById('contenedorCaja');
    if (!cont) return;
    cont.innerHTML = '<div class="caj-card" style="margin-bottom:14px">' +
        '<div class="caj-card-body" style="background:#0b1220;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">' +
        '<div style="display:flex;align-items:center;gap:10px"><i class="bi bi-clock-history" style="color:#60a5fa;font-size:1.2rem"></i>' +
        '<strong style="color:#f8fafc;font-size:.95rem">Historial de Jornadas Cerradas</strong></div>' +
        '<button class="caj-btn caj-btn-ghost" data-action="caja-volver-apertura"><i class="bi bi-arrow-left me-1"></i>← Volver</button>' +
        '</div></div>' +
        '<div id="cajaTabContent" style="display:block"></div>';
    CAJA_ESTADO.tabActual = 'historial';
    document.getElementById('cajaTabContent').innerHTML = renderTabHistorial();
    cargarHistorialCerradas();
}

function cargarHistorialCerradas() {
    var cuerpo = document.getElementById('cuerpoHistorial');
    var btnPrev = document.getElementById('btnHistPrev');
    var btnNext = document.getElementById('btnHistNext');
    var txtPag = document.getElementById('txtHistPagina');
    var txtTotal = document.getElementById('txtTotalHistorial');
    if (cuerpo) {
        cuerpo.innerHTML = '<tr><td colspan="10" class="center" style="color:#64748b"><div class="spinner-border spinner-border-sm text-primary me-2"></div>Cargando historial...</td></tr>';
    }
    fetch(API_BASE + '/api/jornadas/cerradas?limite=' + historialTamPagina + '&offset=' + (historialPaginaActual * historialTamPagina))
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success) {
                historialCerradas = data.jornadas || [];
                historialTotal = data.total || 0;
                renderHistorialFilas();
                if (txtTotal) txtTotal.textContent = historialTotal;
                if (txtPag) txtPag.textContent = 'Pagina ' + (historialPaginaActual + 1) + ' de ' + Math.max(1, Math.ceil(historialTotal / historialTamPagina));
                if (btnPrev) btnPrev.disabled = historialPaginaActual <= 0;
                if (btnNext) btnNext.disabled = (historialPaginaActual + 1) * historialTamPagina >= historialTotal;
            } else {
                if (cuerpo) cuerpo.innerHTML = '<tr><td colspan="10" class="center" style="color:#f87171">Error al cargar el historial.</td></tr>';
            }
        })
        .catch(function() {
            if (cuerpo) cuerpo.innerHTML = '<tr><td colspan="10" class="center" style="color:#f87171">No se pudo conectar con el servidor.</td></tr>';
        });
}

function historialPagina(dir) {
    historialPaginaActual += dir;
    if (historialPaginaActual < 0) historialPaginaActual = 0;
    cargarHistorialCerradas();
}

function renderHistorialFilas() {
    var cuerpo = document.getElementById('cuerpoHistorial');
    if (!cuerpo) return;
    if (historialCerradas.length === 0) {
        cuerpo.innerHTML = '<tr><td colspan="10" class="center" style="color:#64748b"><i class="bi bi-inbox" style="font-size:1.6rem;display:block;margin-bottom:6px"></i>Aun no hay jornadas cerradas.</td></tr>';
        return;
    }
    var html = '';
    historialCerradas.forEach(function(j) {
        var diff = fNum(j.diferencia);
        var cls = diff === 0 ? 'caj-badge-green' : (diff > 0 ? 'caj-badge-amber' : 'caj-badge-red');
        html += '<tr>' +
            '<td style="font-weight:700;color:#f8fafc">#' + j.id_jornada + '</td>' +
            '<td style="color:#94a3b8">' + fFecha(j.fecha_cierre) + '</td>' +
            '<td>' + escHTML(j.usuario_apertura || '--') + '</td>' +
            '<td>' + escHTML(j.usuario_cierre || '--') + '</td>' +
            '<td class="right">' + fM(j.monto_inicial) + '</td>' +
            '<td class="right">' + fM(j.ventas_netas) + '</td>' +
            '<td class="right">' + fM(j.total_efectivo_esperado) + '</td>' +
            '<td class="right">' + fM(j.conteo_fisico) + '</td>' +
            '<td class="right"><span class="caj-badge ' + cls + '">' + (diff > 0 ? 'Sobra' : diff < 0 ? 'Falta' : 'Cuadre') + ' ' + (diff > 0 ? '+' : '') + fM(diff) + '</span></td>' +
            '<td class="center">' +
            '<button class="caj-btn caj-btn-ghost" style="padding:6px 10px;font-size:.72rem" data-action="caja-reimprimir-reporte" data-id="' + j.id_jornada + '" title="Ver / Reimprimir Reporte Z"><i class="bi bi-printer me-1"></i>Reporte Z</button>' +
            '</td></tr>';
    });
    cuerpo.innerHTML = html;
}

function reimprimirReporte(idJornada) {
    fetch(API_BASE + '/api/jornada/' + idJornada + '/reporte')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success) {
                ultimoReporte = data;
                var cont = document.getElementById('contenedorCaja');
                if (cont) {
                    cont.innerHTML = renderVistaCierre();
                    scrollToTopCaja();
                }
            } else {
                mostrarAlerta('danger', data.mensaje || 'Error al obtener el reporte');
            }
        })
        .catch(function() {
            mostrarAlerta('danger', 'No se pudo conectar con el servidor');
        });
}

function scrollToTopCaja() {
    var main = document.getElementById('main-content');
    if (main) main.scrollTop = 0;
}

function exportarHistorialExcel() {
    if (historialCerradas.length === 0) {
        mostrarAlerta('warning', 'No hay datos para exportar. Cargue el historial primero.');
        return;
    }
    var filas = [['Jornada', 'Fecha Cierre', 'Cajero Apertura', 'Cajero Cierre', 'Base Inicial',
        'Ventas Brutas', 'Descuentos', 'Cortesias', 'Ventas Netas', 'Propina Efectivo', 'Propina Tarjeta',
        'Ingresos Extra', 'Gastos Caja Chica', 'Efectivo Esperado', 'Contado Fisico', 'Diferencia', 'Estado']];
    historialCerradas.forEach(function(j) {
        filas.push([j.id_jornada, j.fecha_cierre || '', j.usuario_apertura || '', j.usuario_cierre || '',
            j.monto_inicial, j.ventas_brutas, j.descuentos, j.cortesias, j.ventas_netas,
            j.propina_efectivo, j.propina_tarjeta, j.ingresos_extra, j.gastos_efectivo,
            j.total_efectivo_esperado, j.conteo_fisico, j.diferencia, j.estado]);
    });
    var csv = filas.map(function(f) {
        return f.map(function(c) {
            var s = String(c == null ? '' : c);
            if (/[",\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
            return s;
        }).join(',');
    }).join('\r\n');
    var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'historial_jornadas_clubmaster.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    mostrarAlerta('success', 'Historial exportado correctamente (se abre el archivo CSV compatible con Excel).');
}

// =========================================================
// 10. VISTA CIERRE / REPORTE FINAL + IMPRESION
// =========================================================

function renderVistaCierre() {
    var r = ultimoReporte;
    var j = r.jornada || {};
    var rep = r.resumen || {};
    var diff = fNum(rep.diferencia);
    var cls, etiq, icon;
    if (diff === 0) { cls = 'ok'; etiq = 'CUADRE PERFECTO'; icon = 'bi-check-circle-fill'; }
    else if (diff > 0) { cls = 'sobra'; etiq = 'SOBRANTE'; icon = 'bi-arrow-up-circle-fill'; }
    else { cls = 'falta'; etiq = 'FALTANTE'; icon = 'bi-arrow-down-circle-fill'; }

    var html = '<div class="caj-card" style="border:1px solid #1e293b;margin-bottom:14px">' +
        '<div class="caj-card-head" style="justify-content:center;font-size:.95rem"><i class="bi bi-check-circle" style="color:#34d399"></i> Jornada #' + j.id_jornada + ' Cerrada</div>' +
        '<div class="caj-card-body" style="background:#0b1220">' +
        '<div class="caj-diff ' + cls + '" style="margin-bottom:16px"><small><i class="bi ' + icon + '"></i> ' + etiq + '</small>' + (diff > 0 ? '+' : '') + fM(diff) + '</div>' +
        '<div class="caj-grid-2">' +
        '<div>' +
        filaConciliacion('Cajero apertura', escHTML(j.usuario_apertura || '--')) +
        filaConciliacion('Cajero cierre', escHTML(j.usuario_cierre || '--')) +
        filaConciliacion('Apertura', fFecha(j.fecha_apertura)) +
        filaConciliacion('Cierre', fFecha(j.fecha_cierre)) +
        '</div><div>' +
        filaConciliacion('Ventas Brutas', fM(rep.ventas_brutas)) +
        filaConciliacion('Descuentos', '-' + fM(rep.descuentos)) +
        filaConciliacion('Cortesias', '-' + fM(rep.cortesias)) +
        filaTotal('Ventas Netas', fM(rep.ventas_netas)) +
        '</div>' +
        '<div>' +
        filaConciliacion('Base Inicial', fM(j.monto_inicial)) +
        filaConciliacion('Ventas en Efectivo', fM(rep.efectivo_ventas || rep_efectivoVentas(rep))) +
        filaConciliacion('Propina Efectivo', fM(rep.propina_efectivo)) +
        filaConciliacion('Ingresos Extra', fM(rep.ingresos_extra)) +
        filaConciliacion('Gastos Caja Chica', '-' + fM(rep.gastos_efectivo)) +
        filaTotal('Total Esperado en Caja', fM(rep.esperado)) +
        filaConciliacion('Efectivo Contado (fisico)', fM(rep.total_en_caja)) +
        filaTotal('Diferencia Final', (diff > 0 ? '+' : '') + fM(diff)) +
        '</div><div>' +
        filaConciliacion('Propina Efectivo', fM(rep.propina_efectivo)) +
        filaConciliacion('Propina Tarjeta', fM(rep.propina_tarjeta)) +
        filaConciliacion('Total Propina', fM(fNum(rep.propina_efectivo) + fNum(rep.propina_tarjeta))) +
        filaConciliacion('Movimientos', rep.movimientos ? rep.movimientos.length : 0) +
        '</div>' +
        '</div></div></div>';

    // Desglose resumido
    html += '<div class="caj-card" style="margin-bottom:14px"><div class="caj-card-head"><i class="bi bi-graph-up-arrow"></i> Desglose por Metodo de Pago</div>' +
        '<div class="caj-scroll"><table class="caj-table"><thead><tr><th>Metodo</th><th>Detalle</th><th class="center">#</th><th class="right">Subtotal</th><th class="right">Propina</th></tr></thead><tbody>';
    (rep.desglose || []).forEach(function(row) {
        var sim = simboloCategoria(categoriaMetodoCliente(row.metodo_pago));
        html += '<tr><td><i class="bi ' + sim[0] + '" style="margin-right:6px;color:' + sim[1] + '"></i>' + escHTML(etiquetaMetodo(row.metodo_pago, '')) + '</td>' +
            '<td style="color:#94a3b8">' + (row.sub_metodo ? escHTML(row.sub_metodo) : '-') + '</td>' +
            '<td class="center">' + fNum(row.cantidad) + '</td>' +
            '<td class="right" style="font-weight:600">' + fM(row.subtotal) + '</td>' +
            '<td class="right" style="color:#c4b5fd">' + fM(row.propina) + '</td></tr>';
    });
    html += '</tbody></table></div></div>';

    html += '<div style="display:flex;gap:12px;flex-wrap:wrap">' +
        '<button class="caj-btn caj-btn-primary" data-action="caja-ticket" data-formato="terminal" style="padding:12px 22px"><i class="bi bi-printer-fill me-1"></i>Imprimir Ticket Z (80mm)</button>' +
        '<button class="caj-btn caj-btn-success" data-action="caja-ticket" data-formato="pdf" style="padding:12px 22px"><i class="bi bi-file-earmark-pdf-fill me-1"></i>Exportar PDF</button>' +
        '<button class="caj-btn" data-action="caja-exp-cierre" style="padding:12px 22px;background:linear-gradient(135deg,#0f766e,#14b8a6);border:none"><i class="bi bi-file-earmark-excel me-1"></i>Exportar Excel</button>' +
        '<button class="caj-btn caj-btn-ghost" data-action="caja-iniciar"><i class="bi bi-cash-register me-1"></i> Nueva Jornada</button>' +
        '</div>';

    return html;
}

function exportarCierreExcel() {
    var r = ultimoReporte;
    if (!r) return;
    var j = r.jornada || {};
    var rep = r.resumen || {};
    var filas = [
        ['REPORTE Z - CIERRE DE JORNADA'],
        ['Jornada', j.id_jornada],
        ['Cajero Apertura', j.usuario_apertura || ''],
        ['Cajero Cierre', j.usuario_cierre || ''],
        ['Fecha Apertura', j.fecha_apertura || ''],
        ['Fecha Cierre', j.fecha_cierre || ''],
        [],
        ['Base Inicial', j.monto_inicial],
        ['Ventas Brutas', rep.ventas_brutas],
        ['Descuentos', rep.descuentos],
        ['Cortesias', rep.cortesias],
        ['Ventas Netas', rep.ventas_netas],
        ['Propina Efectivo', rep.propina_efectivo],
        ['Propina Tarjeta', rep.propina_tarjeta],
        ['Ingresos Extra', rep.ingresos_extra],
        ['Gastos Caja Chica', rep.gastos_efectivo],
        ['Efectivo Esperado', rep.esperado],
        ['Conteo Fisico', rep.total_en_caja],
        ['Diferencia', rep.diferencia],
        [],
        ['METODO DE PAGO', 'DETALLE', 'CANTIDAD', 'SUBTOTAL', 'PROPINA']
    ];
    (rep.desglose || []).forEach(function(row) {
        filas.push([etiquetaMetodo(row.metodo_pago, ''), row.sub_metodo || '', row.cantidad, row.subtotal, row.propina]);
    });
    filas.push([]);
    filas.push(['MOVIMIENTOS DE CAJA', 'TIPO', 'CATEGORIA', 'CONCEPTO', 'MONTO']);
    (rep.movimientos || []).forEach(function(m) {
        filas.push([(m.usuario_nombre || ''), m.tipo, m.categoria, m.concepto, m.monto]);
    });
    var csv = filas.map(function(f) {
        return f.map(function(c) {
            var s = String(c == null ? '' : c);
            if (/[",\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
            return s;
        }).join(',');
    }).join('\r\n');
    var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'reporte_z_jornada_' + j.id_jornada + '.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    mostrarAlerta('success', 'Reporte Z exportado (archivo CSV compatible con Excel).');
}

function imprimirTicketCierre(formato) {
    var r = ultimoReporte;
    if (!r) return;
    var j = r.jornada || {};
    var rep = r.resumen || {};
    var diff = fNum(rep.diferencia);
    var tipo = tipoDiferencia(diff);

    var L = function(txt) { return escapeHTML(String(txt)); };
    var g = function(ref) {
        return '<div style="display:flex;justify-content:space-between"><span>' + ref.split('|')[0] + '</span><span>' + ref.split('|').slice(1).join('|') + '</span></div>';
    };
    var fechaHora = function(v) {
        if (v === null || v === undefined || v === '') return '--';
        var d = new Date(String(v).replace(/-/g, '/'));
        if (isNaN(d.getTime())) return String(v);
        return d.toLocaleDateString('es-CO') + ' ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    };

    var lineas = [];
    lineas.push('<div style="text-align:center;font-size:18px;font-weight:800;letter-spacing:1px">CLUBMASTER</div>');
    lineas.push('<div style="text-align:center;font-size:11px;margin-top:2px">*** REPORTE Z - CIERRE DE JORNADA ***</div>');
    lineas.push('<div style="text-align:center;font-size:10px">Jornada #' + j.id_jornada + ' | ' + (tipo === 'CUADRE PERFECTO' ? '[CUADRE]' : '') + '</div>');
    lineas.push('<hr style="border-top:1px dashed #000">');

    lineas.push(g('Apertura|' + fechaHora(j.fecha_apertura)));
    lineas.push(g('Cierre|' + fechaHora(j.fecha_cierre)));
    lineas.push(g('Cajero apertura|' + escapeHTML(j.usuario_apertura || '--')));
    lineas.push(g('Cajero cierre|' + escapeHTML(j.usuario_cierre || '--')));
    lineas.push('<hr style="border-top:1px dashed #000">');

    lineas.push(g('Ventas Brutas|' + fM(rep.ventas_brutas)));
    lineas.push(g('Descuentos|- ' + fM(rep.descuentos)));
    lineas.push(g('Cortesias|- ' + fM(rep.cortesias)));
    lineas.push('<div style="font-weight:800">' + g('VENTAS NETAS|' + fM(rep.ventas_netas)) + '</div>');
    lineas.push('<hr style="border-top:1px dashed #000">');

    lineas.push('<div style="font-weight:800;text-align:center;font-size:10px">VENTAS POR METODO DE PAGO</div>');
    (rep.desglose || []).forEach(function(row) {
        lineas.push(g(etiquetaMetodo(row.metodo_pago, row.sub_metodo) + '|' + fM(row.subtotal)));
    });
    if (!rep.desglose || rep.desglose.length === 0) {
        lineas.push(g('Sin ventas|$0'));
    }
    lineas.push('<hr style="border-top:1px dashed #000">');

    lineas.push(g('Base Inicial|' + fM(j.monto_inicial)));
    lineas.push(g('Ventas Efectivo|' + fM(rep_efectivoVentas(rep))));
    lineas.push(g('Propina Efectivo|' + fM(rep.propina_efectivo)));
    if (rep.movimientos && rep.movimientos.length > 0) {
        var gastos = rep.movimientos.filter(function(m) { return m.tipo === 'Egreso'; });
        lineas.push(g('Ingresos Extra|' + fM(rep.ingresos_extra)));
        lineas.push(g('Gastos Caja Chica|- ' + fM(rep.gastos_efectivo)));
        if (gastos.length > 0) {
            lineas.push('<div style="font-size:9px;font-weight:800;margin-top:2px">Descripcion de gastos:</div>');
            gastos.forEach(function(m) {
                lineas.push('<div style="font-size:9px;display:flex;justify-content:space-between"><span>  - ' + L(m.categoria || 'Gasto') + '</span><span>' + fM(m.monto) + '</span></div>');
            });
        }
    } else {
        lineas.push(g('Ingresos Extra|' + fM(rep.ingresos_extra)));
        lineas.push(g('Gastos Caja Chica|- ' + fM(rep.gastos_efectivo)));
    }
    lineas.push('<div style="font-weight:800">' + g('ESPERADO EN CAJA|' + fM(rep.esperado)) + '</div>');
    lineas.push(g('Conteo Fisico|' + fM(rep.total_en_caja)));
    lineas.push('<div style="font-weight:800">' + g('DIFERENCIA [' + tipo + ']|' + (diff > 0 ? '+' : '') + fM(diff)) + '</div>');
    lineas.push('<hr style="border-top:1px dashed #000">');

    lineas.push(g('Propina Efectivo|' + fM(rep.propina_efectivo)));
    lineas.push(g('Propina Tarjeta|' + fM(rep.propina_tarjeta)));
    lineas.push('<div style="font-weight:800">' + g('TOTAL PROPINA|' + fM(fNum(rep.propina_efectivo) + fNum(rep.propina_tarjeta))) + '</div>');
    lineas.push('<hr style="border-top:1px dashed #000">');

    lineas.push('<div style="text-align:center;font-size:10px;margin-top:6px">Gracias por su visita</div>');
    lineas.push('<div style="text-align:center;font-size:9px;margin-top:2px">Sistema ClubMaster - POS Financiero</div>');
    lineas.push('<div style="text-align:center;font-size:9px;margin-top:6px">Firma del cajero: ______________________</div>');

    var ancho = '80mm';
    var body = '<html><head><meta charset="UTF-8"><title>Reporte Z - Jornada #' + j.id_jornada + '</title>' +
        '<style>@media print{@page{size:' + ancho + ' auto;margin:0}}body{font-family:"Courier New",monospace;font-size:12px;width:' + ancho + ';margin:0 auto;padding:6px;color:#000}</style></head>' +
        '<body>' + lineas.join('') +
        '<script>window.onload=function(){setTimeout(function(){window.print();},250);};<\/script></body></html>';

    var w = window.open('', '_blank', 'width=400,height=640');
    if (!w) {
        mostrarAlerta('warning', 'Permita la apertura de ventanas emergentes para imprimir.');
        return;
    }
    w.document.write(body);
    w.document.close();
    w.focus();
    if (formato === 'pdf') {
        mostrarAlerta('info', 'En el dialogo de impresion, elija "Guardar como PDF" como destino.');
    }
}

// =========================================================
// 11. RECARGAR DATOS
// =========================================================

function recargarDatosJornada(tab) {
    fetch(API_BASE + '/api/jornada/activa')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success) {
                jornadaActiva = data.jornada;
                resumenJornada = data.resumen || null;
            }
            if (tab) CAJA_ESTADO.tabActual = tab;
            if (jornadaActiva) {
                arqueoCiegoUI = jornadaActiva.arqueo_ciego === 1 || jornadaActiva.arqueo_ciego === true;
            }
            renderVistaCaja();
        })
        .catch(function() {
            mostrarAlerta('danger', 'No se pudo actualizar la jornada');
        });
}

function renderTabVaciados(){
 var html='<div class="caj-grid-2">';
 html+='<div class="caj-card"><div class="caj-card-head"><i class="bi bi-safe"></i> Registrar Vaciado de Efectivo <span style="margin-left:auto;font-size:.7rem;color:#94a3b8">Retiro parcial a caja fuerte</span></div><div class="caj-card-body">';
 html+='<div class="caj-field"><label class="caj-label">Monto a retirar ($)</label><input type="number" class="caj-input" id="vacMonto" min="1000" step="1000" placeholder="Ej: 500000" style="font-size:1.1rem;font-weight:700;text-align:center"></div>';
 html+='<div class="caj-field"><label class="caj-label">Motivo / Destino</label><select class="caj-select" id="vacMotivo"><option value="Vaciado parcial a caja fuerte">Vaciado parcial a caja fuerte</option><option value="Retiro para pago a proveedor">Retiro para pago a proveedor</option><option value="Retiro de seguridad - cajón lleno">Retiro de seguridad - cajón lleno</option><option value="Cambio de turno">Cambio de turno</option><option value="Otro">Otro</option></select></div>';
 html+='<div class="caj-field" id="vacMotivoOtroWrap" style="display:none"><input type="text" class="caj-input" id="vacMotivoOtro" placeholder="Especifique motivo"></div>';
 html+='<button class="caj-btn caj-btn-warn caj-btn-block" data-action="caja-reg-vaciado" style="margin-top:8px"><i class="bi bi-box-arrow-down me-1"></i> Registrar Vaciado</button>';
 html+='<div class="caj-note" style="margin-top:12px"><i class="bi bi-info-circle"></i> El vaciado se descuenta del efectivo esperado y queda registrado en el histórico para auditoría.</div>';
 html+='</div></div>';
 html+='<div class="caj-card"><div class="caj-card-head"><i class="bi bi-clock-history"></i> Histórico de Vaciados <span id="vacTotalBadge" class="caj-badge caj-badge-amber" style="margin-left:auto">Total $0</span></div><div id="vacListado" class="caj-lista" style="border-top:1px solid #1e293b"><div class="caj-centrado" style="min-height:120px;padding:24px"><div class="spinner-border spinner-border-sm text-primary"></div> Cargando...</div></div></div>';
 html+='</div>';
 setTimeout(function(){ var s=document.getElementById('vacMotivo'); if(s) s.addEventListener('change',function(){ var w=document.getElementById('vacMotivoOtroWrap'); if(w) w.style.display=this.value==='Otro'?'block':'none';}); },80);
 return html;
}
function cargarVaciados(){
 if(!jornadaActiva) return;
 var cont=document.getElementById('vacListado'), badge=document.getElementById('vacTotalBadge');
 fetch(API_BASE+'/api/caja/vaciados?id_jornada='+jornadaActiva.id_jornada).then(function(r){return r.json();}).then(function(d){
  if(!d.success){ if(cont) cont.innerHTML='<div class="caj-centrado" style="padding:24px;color:#f87171">Error al cargar</div>'; return; }
  if(badge) badge.textContent='Total '+fM(d.total||0)+' · '+d.vaciados.length+' retiros';
  if(!d.vaciados.length){ cont.innerHTML='<div class="caj-centrado" style="min-height:120px;padding:24px"><i class="bi bi-inbox"></i>Sin vaciados en esta jornada</div>'; return; }
  var h=''; d.vaciados.forEach(function(v){
   h+='<div class="caj-move"><span class="caj-move-icon" style="background:#713f12;color:#fbbf24"><i class="bi bi-safe"></i></span><div style="flex:1"><div style="display:flex;justify-content:space-between;gap:8px"><strong style="color:#e2e8f0;font-size:.85rem">'+escHTML(v.motivo)+'</strong><strong style="color:#fbbf24">'+fM(v.monto)+'</strong></div><div style="font-size:.72rem;color:#94a3b8"><i class="bi bi-person me-1"></i>'+escHTML(v.usuario_nombre||'Sistema')+' &nbsp;<i class="bi bi-clock me-1"></i>'+fFecha(v.fecha)+'</div></div></div>';
  });
  cont.innerHTML=h;
 }).catch(function(){ if(cont) cont.innerHTML='<div class="caj-centrado" style="padding:24px;color:#f87171">Sin conexión</div>'; });
}
function registrarVaciado(){
 if(!jornadaActiva){ mostrarAlerta('warning','No hay jornada activa'); return; }
 var monto=fNum(document.getElementById('vacMonto').value);
 var motivo=document.getElementById('vacMotivo').value;
 if(motivo==='Otro'){ var otro=(document.getElementById('vacMotivoOtro').value||'').trim(); if(otro) motivo=otro; }
 if(monto<=0){ mostrarAlerta('warning','Ingrese un monto válido'); return; }
 if(!confirm('Registrar vaciado de '+fM(monto)+' por: '+motivo+' ?')) return;
 fetch(API_BASE+'/api/caja/vaciados',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id_jornada:jornadaActiva.id_jornada,monto:monto,motivo:motivo,id_usuario:usuario?(usuario.id_usuario||1):1})}).then(function(r){return r.json();}).then(function(d){
  if(d.success){ mostrarAlerta('success',d.mensaje); document.getElementById('vacMonto').value=''; recargarDatosJornada('vaciados'); } else mostrarAlerta('danger',d.mensaje||'Error');
 }).catch(function(){ mostrarAlerta('danger','No se pudo conectar'); });
}
function renderTabAuditoria(){
 var html='<div class="caj-card"><div class="caj-card-head"><i class="bi bi-shield-exclamation"></i> Auditoría de Incidencias <span style="margin-left:auto;font-size:.7rem;color:#94a3b8">Solo administrador</span></div>';
 html+='<div class="caj-card-body" style="display:flex;gap:10px;flex-wrap:wrap;align-items:end">';
 html+='<div style="flex:1;min-width:160px"><label class="caj-label">Tipo de incidencia</label><select class="caj-select" id="audTipo"><option value="anulacion">Anulación de ítem / comanda tras envío a barra</option><option value="apertura_sin_venta">Apertura de cajón sin venta</option><option value="descuento">Descuento aplicado</option><option value="cortesia">Cortesía aplicada</option></select></div>';
 html+='<div style="flex:1;min-width:160px"><label class="caj-label">Descripción / Ítem</label><input type="text" class="caj-input" id="audDesc" placeholder="Ej: Anulación Ron 2x - mesa 5"></div>';
 html+='<div style="width:130px"><label class="caj-label">Monto ($)</label><input type="number" class="caj-input" id="audMonto" min="0" placeholder="0"></div>';
 html+='<div style="width:140px"><label class="caj-label">Autorizó (ID usuario)</label><input type="number" class="caj-input" id="audAutoriza" placeholder="ID admin"></div>';
 html+='<button class="caj-btn caj-btn-danger" data-action="caja-reg-auditoria" style="height:42px"><i class="bi bi-plus-circle me-1"></i> Registrar</button>';
 html+='</div>';
 html+='<div style="padding:10px 18px;display:flex;gap:6px;flex-wrap:wrap;border-top:1px solid #1e293b;background:#0b1220">';
 html+='<button class="caj-btn caj-btn-ghost" style="padding:6px 12px;font-size:.75rem" data-action="caja-filtrar-aud" data-tipo=""><i class="bi bi-list"></i> Todas</button>';
 html+='<button class="caj-btn caj-btn-ghost" style="padding:6px 12px;font-size:.75rem" data-action="caja-filtrar-aud" data-tipo="anulacion"><i class="bi bi-x-circle" style="color:#f87171"></i> Anulaciones</button>';
 html+='<button class="caj-btn caj-btn-ghost" style="padding:6px 12px;font-size:.75rem" data-action="caja-filtrar-aud" data-tipo="apertura_sin_venta"><i class="bi bi-safe" style="color:#fbbf24"></i> Aperturas cajón</button>';
 html+='<button class="caj-btn caj-btn-ghost" style="padding:6px 12px;font-size:.75rem" data-action="caja-filtrar-aud" data-tipo="descuento"><i class="bi bi-tag" style="color:#60a5fa"></i> Descuentos</button>';
 html+='<button class="caj-btn caj-btn-ghost" style="padding:6px 12px;font-size:.75rem" data-action="caja-filtrar-aud" data-tipo="cortesia"><i class="bi bi-gift" style="color:#c4b5fd"></i> Cortesías</button>';
 html+='<button class="caj-btn" style="margin-left:auto;padding:6px 12px;font-size:.75rem" data-action="caja-cargar-auditoria"><i class="bi bi-arrow-clockwise"></i> Actualizar</button>';
 html+='</div>';
 html+='<div class="caj-scroll"><table class="caj-table"><thead><tr><th>Fecha / Hora</th><th>Tipo</th><th>Descripción</th><th>Autorizó</th><th>Registró</th><th class="right">Monto</th></tr></thead><tbody id="audBody"><tr><td colspan="6" class="center" style="color:#64748b"><div class="spinner-border spinner-border-sm text-primary me-2"></div>Cargando...</td></tr></tbody></table></div></div>';
 return html;
}
var audFiltro='';
function filtrarAuditoria(t){ audFiltro=t; cargarAuditoria(); }
function cargarAuditoria(){
 var tb=document.getElementById('audBody');
 var q='';
 if(jornadaActiva) q+='?id_jornada='+jornadaActiva.id_jornada;
 if(audFiltro){ q+= (q?'&':'?')+'tipo='+audFiltro; }
 fetch(API_BASE+'/api/caja/auditoria'+q).then(function(r){return r.json();}).then(function(d){
  if(!d.success){ if(tb) tb.innerHTML='<tr><td colspan="6" class="center" style="color:#f87171">Error</td></tr>'; return; }
  if(!d.incidencias.length){ if(tb) tb.innerHTML='<tr><td colspan="6" class="center" style="color:#64748b;padding:20px"><i class="bi bi-shield-check" style="font-size:1.4rem;display:block;margin-bottom:6px"></i>Sin incidencias registradas</td></tr>'; return; }
  var map={anulacion:['Anulación','caj-badge-red','bi-x-circle'],apertura_sin_venta:['Apertura cajón','caj-badge-amber','bi-safe'],descuento:['Descuento','caj-badge-blue','bi-tag'],cortesia:['Cortesía','caj-badge-purple','bi-gift']};
  var h='';
  d.incidencias.forEach(function(a){
   var m=map[a.tipo]||[a.tipo,'caj-badge-gray','bi-flag'];
   h+='<tr><td style="color:#94a3b8;font-size:.8rem">'+fFecha(a.fecha)+'</td><td><span class="caj-badge '+m[1]+'"><i class="bi '+m[2]+'"></i> '+escapeHTML(m[0])+'</span></td><td style="max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="'+escHTML(a.descripcion)+'">'+escHTML(a.descripcion||'--')+'</td><td>'+escHTML(a.autoriza_nombre)+'</td><td>'+escHTML(a.registra_nombre)+'</td><td class="right" style="font-weight:700">'+(fNum(a.monto)?fM(a.monto):'--')+'</td></tr>';
  });
  tb.innerHTML=h;
 }).catch(function(){ if(tb) tb.innerHTML='<tr><td colspan="6" class="center" style="color:#f87171">Sin conexión</td></tr>'; });
}
function registrarAuditoria(){
 var tipo=document.getElementById('audTipo').value;
 var desc=document.getElementById('audDesc').value.trim();
 var monto=fNum(document.getElementById('audMonto').value);
 var autoriza=document.getElementById('audAutoriza').value||null;
 if(!desc){ mostrarAlerta('warning','Describa la incidencia'); return; }
 fetch(API_BASE+'/api/caja/auditoria',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id_jornada:jornadaActiva?jornadaActiva.id_jornada:null,tipo:tipo,descripcion:desc,id_usuario_autoriza:autoriza,id_usuario_registra:usuario?(usuario.id_usuario||1):1,monto:monto})}).then(function(r){return r.json();}).then(function(d){
  if(d.success){ mostrarAlerta('success',d.mensaje); document.getElementById('audDesc').value=''; document.getElementById('audMonto').value=''; cargarAuditoria(); } else mostrarAlerta('danger',d.mensaje||'Error');
 }).catch(function(){ mostrarAlerta('danger','No se pudo conectar'); });
}
function puedeVerFinanzasExternas(){try{var u=typeof usuario!=='undefined'?usuario:null;if(!u)try{u=JSON.parse(localStorage.getItem('usuario')||'{}');}catch(e){}if(!u)return false;if(Number(u.id_rol)===1)return true;var r=String(u.rol||'').toLowerCase();return r==='administrador'||r==='admin'||r.indexOf('cajer')!==-1;}catch(e){return false;}}
function abrirModalFinanzasExternas(){
 if(!puedeVerFinanzasExternas()){try{mostrarToast('danger','Solo Administrador o Cajero principal.');}catch(e){}return;}
 var old=document.getElementById('modalFinanzasExt');if(old)old.remove();
 var div=document.createElement('div');div.id='modalFinanzasExt';
 div.style.cssText='position:fixed;inset:0;background:rgba(2,6,23,.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
 div.innerHTML='<div style="background:#0f172a;border:1px solid #334155;border-radius:14px;max-width:900px;width:100%;max-height:88vh;overflow:auto">'
 +'<div style="padding:14px 18px;border-bottom:1px solid #1e293b;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><strong style="color:#f8fafc"><i class="bi bi-bank me-2"></i>Finanzas Externas — Compras y Proveedores <span class="caj-badge caj-badge-amber" style="margin-left:8px">No afecta caja diaria</span></strong><button class="caj-btn caj-btn-ghost" onclick="document.getElementById(\'modalFinanzasExt\').remove()">Cerrar</button></div>'
 +'<div style="padding:18px"><div class="caj-note" style="margin-bottom:12px"><i class="bi bi-info-circle"></i> La <b>caja diaria</b> excluye Compras/Proveedores (solo ventas, vales y gastos menores). Aquí se ve la plata que salió a proveedores.</div>'
 +'<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap"><input type="date" class="caj-input" id="finMFi" style="max-width:170px"><input type="date" class="caj-input" id="finMFf" style="max-width:170px"><button class="caj-btn caj-btn-primary" onclick="cargarFinanzasModal()"><i class="bi bi-search"></i> Consultar</button></div>'
 +'<div id="finMResumen" class="caj-kpi-grid"></div>'
 +'<div class="caj-scroll"><table class="caj-table"><thead><tr><th>Fecha</th><th>Tipo</th><th>Detalle</th><th>Proveedor</th><th class="right">Monto</th></tr></thead><tbody id="finMTabla"><tr><td colspan="5" class="center" style="color:#64748b;padding:20px">Seleccione rango y consulte</td></tr></tbody></table></div></div></div>';
 document.body.appendChild(div);
 div.addEventListener('click',function(e){if(e.target===div)div.remove();});
 cargarFinanzasModal();
}
function cargarFinanzasModal(){
 var fi=document.getElementById('finMFi'),ff=document.getElementById('finMFf');
 var tb=document.getElementById('finMTabla'),rs=document.getElementById('finMResumen');
 var q=[];if(fi&&fi.value)q.push('fecha_inicio='+fi.value);if(ff&&ff.value)q.push('fecha_fin='+ff.value);
 if(tb)tb.innerHTML='<tr><td colspan="5" class="center" style="padding:20px"><div class="spinner-border spinner-border-sm text-primary"></div> Cargando...</td></tr>';
 fetch((typeof API_BASE!=='undefined'?API_BASE:'')+'/api/finanzas/compras'+(q.length?'?'+q.join('&'):'') ,{credentials:'include'}).then(function(r){return r.json().then(function(d){return{ok:r.ok,d:d};});}).then(function(w){
  var d=w.d||{};
  if(!w.ok||!d.success){if(tb)tb.innerHTML='<tr><td colspan="5" class="center" style="color:#f87171">'+escHTML((d&&d.mensaje)||'Sin permiso')+'</td></tr>';return;}
  if(rs)rs.innerHTML=kpiCard('k-red','bi-bag-check','Compras inventario',fM(d.total_compras),'facturas de compra')+kpiCard('k-amber','bi-truck','Pagos a proveedores',fM(d.total_pagos),'abonos/pagos')+kpiCard('k-purple','bi-box-arrow-up','Salida total externa',fM(d.total_salida),'compras + pagos');
  var h='';
  (d.compras||[]).slice(0,100).forEach(function(c){h+='<tr><td style="color:#94a3b8">'+fFecha(c.fecha)+'</td><td><span class="caj-badge caj-badge-red">Compra</span></td><td>#'+c.id_compra+' '+(c.numero_factura?escHTML(c.numero_factura):'')+'</td><td>'+escHTML(c.proveedor_nombre||'')+'</td><td class="right" style="font-weight:700">'+fM(c.total)+'</td></tr>';});
  (d.pagos||[]).slice(0,100).forEach(function(p){h+='<tr><td style="color:#94a3b8">'+fFecha(p.fecha_pago)+'</td><td><span class="caj-badge caj-badge-amber">Pago</span></td><td>Factura #'+(p.id_compra||'--')+'</td><td>'+escHTML(p.proveedor_nombre||'')+'</td><td class="right" style="font-weight:700">'+fM(p.monto)+'</td></tr>';});
  if(!h)h='<tr><td colspan="5" class="center" style="color:#64748b;padding:20px">Sin movimientos externos en el rango</td></tr>';
  if(tb)tb.innerHTML=h;
 }).catch(function(){if(tb)tb.innerHTML='<tr><td colspan="5" class="center" style="color:#f87171">Sin conexion</td></tr>';});
}
// Compatibilidad con llamadas antiguas
function renderizarVistaCaja() { renderVistaCaja(); }
function calcularDiferenciaCaja() {}
if (typeof delegateAction !== 'undefined') delegateAction(document, { 'caja-tab': function(el){ cajaTab(String(el.getAttribute('data-tab'))); }, 'caja-iniciar': function(){ iniciarCaja(); }, 'caja-mesas': function(){ cargarMesas(); }, 'caja-abrir': function(){ abrirJornadaCaja(); }, 'caja-ver-historial': function(){ verHistorialSolo(); }, 'caja-registrar-mov': function(){ registrarMovimientoCaja(); }, 'caja-ver-factura': function(el){ verDetalleFacturaCaja(Number(el.getAttribute('data-id'))); }, 'caja-reimprimir-factura': function(el){ reimprimirFacturaCaja(Number(el.getAttribute('data-id'))); }, 'caja-revelar': function(){ revelarArqueo(); }, 'caja-cerrar': function(){ cerrarJornadaPos(); }, 'caja-recontar': function(){ arqueoRevelado=null;renderTabActual(); }, 'caja-exp-hist': function(){ exportarHistorialExcel(); }, 'caja-cargar-hist': function(){ cargarHistorialCerradas(); }, 'caja-hist-pag': function(el){ historialPagina(Number(el.getAttribute('data-dir'))); }, 'caja-volver-apertura': function(){ volverAFormularioApertura(); }, 'caja-reimprimir-reporte': function(el){ reimprimirReporte(Number(el.getAttribute('data-id'))); }, 'caja-ticket': function(el){ imprimirTicketCierre(String(el.getAttribute('data-formato'))); }, 'caja-exp-cierre': function(){ exportarCierreExcel(); }, 'caja-reg-vaciado': function(){ registrarVaciado(); }, 'caja-reg-auditoria': function(){ registrarAuditoria(); }, 'caja-filtrar-aud': function(el){ filtrarAuditoria(String(el.getAttribute('data-tipo'))); }, 'caja-cargar-auditoria': function(){ cargarAuditoria(); }, 'caja-fin-modal': function(){ abrirModalFinanzasExternas(); } });
if (typeof document !== 'undefined') {
document.addEventListener('change', function(e) {
  var el = e.target && e.target.closest ? e.target.closest('[data-change]') : null;
  if (!el || !document.contains(el)) return;
  var a = el.getAttribute('data-change');
  if (a === 'caja-cajero') actualizarCajeroSeleccionado();
  else if (a === 'caja-tipo-mov') cambiarTipoMovimiento();
  else if (a === 'caja-arqueo-ciego') cambiarArqueoCiegoUI(!!el.checked);
  else if (a === 'caja-blindado') { modoBlindado = !!el.checked; renderTabActual(); }
});
document.addEventListener('input', function(e) {
  var el = e.target && e.target.closest ? e.target.closest('[data-input]') : null;
  if (!el || !document.contains(el)) return;
  if (el.getAttribute('data-input') === 'caja-conteo') actualizarConteoArqueo();
});
}
