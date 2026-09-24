// =========================================================
// CONTROLADOR: USUARIOS Y ROLES
// =========================================================

var listaRoles = [];

function esAdminUsuarios(){try{if(typeof esAdminRB==='function'&&esAdminRB())return true;if(typeof esAdmin==='function'&&esAdmin())return true;var u=null;try{u=typeof usuario!=='undefined'?usuario:JSON.parse(localStorage.getItem('usuario')||'{}');}catch(e){try{u=JSON.parse(localStorage.getItem('usuario')||'{}');}catch(e2){}}if(!u)return false;if(Number(u.id_rol)===1)return true;var r=String(u.rol||'').toLowerCase();return r==='administrador'||r==='admin';}catch(e){return false;}}

function inyectarCSSUsuarioPremium(){
 if(document.getElementById('cssUsuarioPremium'))return;
 var s=document.createElement('style');s.id='cssUsuarioPremium';
 s.textContent='.uprem-head{background:linear-gradient(135deg,#0f172a,#1e3a8a);color:#fff;border:none;padding:20px 22px;display:flex;align-items:center;gap:14px}'
 +'.uprem-head .modal-title{color:#fff;font-weight:800;font-size:1.05rem;letter-spacing:-.01em}'
 +'.uprem-sub{color:#93c5fd;font-size:.75rem;font-weight:500}'
 +'.uprem-avatar{width:52px;height:52px;border-radius:50%;flex-shrink:0;background:linear-gradient(135deg,#3b82f6,#8b5cf6);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:1.25rem;border:2px solid rgba(255,255,255,.35);box-shadow:0 4px 14px rgba(59,130,246,.4)}'
 +'.uprem-label{font-weight:700;color:#334155;font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px}'
 +'.uprem-group .input-group-text{background:#eef2ff;border:1px solid #e2e8f0;color:#6366f1;border-radius:12px 0 0 12px;padding:10px 14px}'
 +'.uprem-group .form-control,.uprem-group .form-select{background:#fff;border:1px solid #e2e8f0;border-left:none;border-radius:0 12px 12px 0;padding:11px 14px;font-size:.9rem;color:#0f172a;transition:border-color .15s,box-shadow .15s}'
 +'.uprem-group .form-control:focus,.uprem-group .form-select:focus{border-color:#818cf8;box-shadow:0 0 0 3px rgba(99,102,241,.15);outline:none}'
 +'.uprem-group .form-control::placeholder{color:#b6c2d2}'
 +'.uprem-switch-row{display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;margin-top:4px}'
 +'.uprem-switch-title{font-weight:700;color:#334155;font-size:.82rem}'
 +'.uprem-switch-sub{font-size:.72rem;color:#94a3b8}'
 +'.uprem-switch{position:relative;display:inline-block;width:48px;height:26px;flex-shrink:0;margin:0 0 0 auto;cursor:pointer}'
 +'.uprem-switch input{opacity:0;width:0;height:0}'
 +'.uprem-slider{position:absolute;inset:0;background:#cbd5e1;border-radius:26px;transition:.2s}'
 +'.uprem-slider:before{content:"";position:absolute;height:20px;width:20px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.2s;box-shadow:0 1px 4px rgba(0,0,0,.25)}'
 +'.uprem-switch input:checked+.uprem-slider{background:linear-gradient(135deg,#059669,#10b981)}'
 +'.uprem-switch input:checked+.uprem-slider:before{transform:translateX(22px)}'
 +'.uprem-estado{font-size:.75rem;font-weight:800;padding:4px 12px;border-radius:20px;min-width:74px;text-align:center}'
 +'.uprem-on{background:#dcfce7;color:#15803d}'
 +'.uprem-off{background:#fee2e2;color:#b91c1c}';
 document.head.appendChild(s);
}
function inicialesDe(nombre){try{var p=String(nombre||'?').trim().split(/\s+/);var i=(p[0]?p[0].charAt(0):'?')+(p.length>1?p[p.length-1].charAt(0):'');return i.toUpperCase();}catch(e){return '?';}}
function pintarAvatarUsuario(nombre){var a=document.getElementById('avatarUsuario');if(a)a.textContent=inicialesDe(nombre);}
function pintarSwitchEstado(){var sw=document.getElementById('switchUsActivo');var tx=document.getElementById('estadoUsTexto');if(!sw||!tx)return;var on=sw.checked;tx.textContent=on?'Activo':'Inactivo';tx.className='uprem-estado '+(on?'uprem-on':'uprem-off');}
function iniciarUsuarios() {
    var _isOp=false;try{var _ru=(typeof usuario!=='undefined'?usuario:{}).rol||'';_isOp=_ru.toLowerCase().indexOf('mesero')!==-1||_ru.toLowerCase().indexOf('bartender')!==-1;}catch(e){}
    if(!_isOp){if(typeof verificarAcceso==='function'&&!verificarAcceso('crear_usuarios')){if(typeof verificarAccesoRB==='function'&&!verificarAccesoRB('crear_usuarios'))return;return;} if(typeof verificarAccesoRB==='function'&&!verificarAccesoRB('crear_usuarios'))return;}
    if (typeof activarNav === 'function') activarNav('navUsuarios');
    inyectarCSSUsuarioPremium();
    var contenedor = document.getElementById('main-content');
    var btnNuevo = esAdminUsuarios() ? '<button class="btn-custom-action btn-pedir" style="padding:8px 18px;width:auto" onclick="modalNuevoUsuario()"><i class="bi bi-plus-lg me-1"></i> Nuevo Usuario</button>' : '';
    contenedor.innerHTML = '<div class="page-header">' +
        '<h2><i class="bi bi-people"></i>Usuarios y Roles</h2>' +
        '<div class="page-header-right">' +
        '<button class="btn-refresh" onclick="iniciarUsuarios()"><i class="bi bi-arrow-clockwise"></i> Actualizar</button>' +
        btnNuevo +
        '</div></div>' +
        '<div id="contenedorAlertas"></div>' +
        '<div class="card" style="border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;margin-bottom:24px">' +
        '<div style="padding:16px 20px;background:#0f172a;color:#f8fafc;font-weight:700;font-size:0.9rem;display:flex;align-items:center;gap:8px"><i class="bi bi-shield-lock"></i> Roles del Sistema</div>' +
        '<div class="card-body p-3" style="background:#fff"><div id="contenedorRoles" class="d-flex flex-wrap gap-2"></div></div></div>' +
        '<div class="card" style="border:1px solid #e2e8f0;border-radius:14px;overflow:hidden">' +
        '<div style="padding:16px 20px;background:#0f172a;color:#f8fafc;font-weight:700;font-size:0.9rem;display:flex;align-items:center;gap:8px"><i class="bi bi-list-ul"></i> Personal Registrado</div>' +
        '<div class="card-body p-0" style="background:#fff"><div id="contenedorTablaUsuarios" class="text-center py-4"><div class="spinner-border text-primary"></div></div></div></div>' +
        '<div class="modal fade" id="modalUsuario" tabindex="-1" aria-hidden="true">' +
        '<div class="modal-dialog modal-dialog-centered">' +
        '<div class="modal-content" style="border:none;border-radius:18px;overflow:hidden;box-shadow:0 24px 70px rgba(2,6,23,.35)">' +
        '<div class="modal-header uprem-head"><div class="uprem-avatar" id="avatarUsuario">?</div>' +
        '<div style="flex:1;min-width:0"><h5 class="modal-title" id="tituloModalUsuario">Nuevo Usuario</h5><div class="uprem-sub" id="subTituloModalUsuario">Gestión de personal</div></div>' +
        '<button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div>' +
        '<div class="modal-body" style="background:#f8fafc;padding:22px">' +
        '<form id="formUsuario">' +
        '<div class="mb-3"><label class="form-label uprem-label">Nombre *</label><div class="input-group uprem-group"><span class="input-group-text"><i class="bi bi-person-fill"></i></span><input type="text" class="form-control" id="inputUsNombre" placeholder="Nombre completo" oninput="pintarAvatarUsuario(this.value)" required></div></div>' +
        '<div class="mb-3"><label class="form-label uprem-label">Correo *</label><div class="input-group uprem-group"><span class="input-group-text"><i class="bi bi-envelope-fill"></i></span><input type="email" class="form-control" id="inputUsCorreo" placeholder="usuario@empresa.com" required></div></div>' +
        '<div class="mb-3"><label class="form-label uprem-label" id="labelContrasena">Contraseña *</label><div class="input-group uprem-group"><span class="input-group-text"><i class="bi bi-lock-fill"></i></span><input type="password" class="form-control" id="inputUsContrasena" placeholder="••••••••"></div><small id="hintContrasena" class="form-text" style="color:#94a3b8;font-size:.75rem">Mínimo 4 caracteres.</small></div>' +
        '<div class="mb-3"><label class="form-label uprem-label">Rol *</label><div class="input-group uprem-group"><span class="input-group-text"><i class="bi bi-shield-lock-fill"></i></span><select id="inputUsRol" class="form-select"><option value="">Seleccionar rol...</option></select></div></div>' +
        '<div class="uprem-switch-row"><div><div class="uprem-switch-title">Estado del Usuario</div><div class="uprem-switch-sub">Inactivo bloquea el acceso al sistema</div></div>' +
        '<label class="uprem-switch"><input type="checkbox" id="switchUsActivo" checked onchange="pintarSwitchEstado()"><span class="uprem-slider"></span></label>' +
        '<span class="uprem-estado uprem-on" id="estadoUsTexto">Activo</span></div>' +
        '<input type="hidden" id="inputUsId">' +
        '</form></div>' +
        '<div class="modal-footer" style="border-top:1px solid #e2e8f0;background:#fff;padding:14px 22px">' +
        '<button type="button" class="btn btn-light" style="border-radius:10px;font-weight:600;padding:10px 20px" data-bs-dismiss="modal">Cancelar</button>' +
        '<button type="button" class="btn-custom-action btn-pedir" style="width:auto;padding:10px 28px;border-radius:10px" onclick="guardarUsuario()"><i class="bi bi-check-lg me-1"></i> Guardar</button>' +
        '</div></div></div></div>';

    cargarRoles();
    cargarUsuarios();
    setTimeout(function(){
        inyectarSeccionesOperativas();
        cargarAsistenciasHoy();
        cargarReportePropinas();
    },400);
}
var usuarioSubTab='asistencia';
function inyectarSeccionesOperativas(){
    if(document.getElementById('secOperativaUsuarios')) return;
    var main=document.getElementById('main-content');
    if(!main) return;
    var modal=document.getElementById('modalUsuario');
    var html='<div id="secOperativaUsuarios" style="margin-top:20px">'+
    '<style>.op-card{background:#0f172a;border:1px solid #1e293b;border-radius:14px;overflow:hidden;margin-bottom:18px}.op-head{padding:13px 18px;background:#16213a;color:#e2e8f0;font-weight:700;font-size:.85rem;display:flex;align-items:center;gap:8px;border-bottom:1px solid #1e293b}.op-head i{color:#60a5fa}.op-body{padding:16px}.op-tabs{display:flex;gap:6px;background:#0b1220;padding:6px;border-radius:12px;border:1px solid #1e293b;margin-bottom:14px}.op-tab{border:none;background:transparent;color:#94a3b8;padding:9px 16px;border-radius:9px;font-weight:600;font-size:.82rem;cursor:pointer;display:flex;align-items:center;gap:7px;transition:all .15s}.op-tab.active{background:linear-gradient(135deg,#2563eb,#3b82f6);color:#fff;box-shadow:0 3px 10px rgba(37,99,235,.3)}.op-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}.op-person{background:#1e293b;border:1px solid #2d3a4f;border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:10px}.op-person-top{display:flex;align-items:center;gap:10px}.op-av{width:38px;height:38px;border-radius:10px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800}.op-btns{display:flex;gap:6px}.op-btn{flex:1;border:none;border-radius:8px;padding:7px 6px;font-weight:700;font-size:.72rem;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;transition:all .15s}.op-btn-e{background:#064e3b;color:#34d399;border:1px solid #065f46}.op-btn-e:hover{background:#065f46}.op-btn-s{background:#7f1d1d;color:#fca5a5;border:1px solid #991b1b}.op-btn-s:hover{background:#991b1b}.op-btn-t{background:#1e3a8a;color:#93c5fd;border:1px solid #1e40af}.op-btn-t:hover{background:#1e40af;color:#fff}.op-table{width:100%;border-collapse:collapse;min-width:560px}.op-table th{background:#16213a;color:#94a3b8;text-align:left;font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:10px 14px;border-bottom:1px solid #1e293b}.op-table td{padding:10px 14px;border-bottom:1px solid #16213a;font-size:.85rem;color:#e2e8f0}.op-scroll{overflow-x:auto}.op-kpi{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px}.op-kpi-item{flex:1;min-width:140px;background:#0b1220;border:1px solid #1e293b;border-radius:10px;padding:12px;text-align:center}.op-kpi-item b{color:#f8fafc;font-size:1.15rem;display:block}.op-kpi-item span{color:#94a3b8;font-size:.7rem;text-transform:uppercase;font-weight:700;letter-spacing:.04em}</style>'+
    '<div class="op-tabs"><button id="opTabAsist" class="op-tab active" onclick="switchUsuarioSubTab(\'asistencia\')"><i class="bi bi-clock-history"></i> Control de Asistencia / Turnos</button><button id="opTabProp" class="op-tab" onclick="switchUsuarioSubTab(\'propinas\')"><i class="bi bi-cash-coin"></i> Propinas y Comisiones</button></div>'+
    '<div id="opContAsistencia">'+
    '<div class="op-card"><div class="op-head"><i class="bi bi-fingerprint"></i> Fichaje Rápido — Meseros · Cajeros · Bartenders · Seguridad</div><div class="op-body"><div id="opAsistGrid" class="op-grid"><div style="color:#64748b;padding:20px"><div class="spinner-border spinner-border-sm text-primary me-2"></div>Cargando personal...</div></div></div></div>'+
    '<div class="op-card"><div class="op-head"><i class="bi bi-list-check"></i> Asistencias de Hoy <span id="opAsistCount" style="margin-left:auto;background:#1e293b;color:#94a3b8;padding:4px 10px;border-radius:20px;font-size:.72rem">0 registros</span></div><div class="op-body" style="padding:0"><div class="op-scroll"><table class="op-table"><thead><tr><th>Hora</th><th>Usuario</th><th>Rol</th><th>Tipo</th><th>Jornada</th></tr></thead><tbody id="opAsistHoy"><tr><td colspan="5" style="text-align:center;color:#64748b;padding:18px">Sin fichajes hoy</td></tr></tbody></table></div></div></div>'+
    '</div>'+
    '<div id="opContPropinas" style="display:none">'+
    '<div class="op-card"><div class="op-head"><i class="bi bi-piggy-bank"></i> Reporte de Propina Voluntaria por Mesero <span style="margin-left:auto;font-size:.72rem;color:#94a3b8">Pozo barra 30%</span></div><div class="op-body"><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;align-items:end"><div style="flex:1;min-width:140px"><label style="font-size:.7rem;font-weight:700;color:#94a3b8;text-transform:uppercase">Jornada</label><input id="opPropJornada" type="number" placeholder="ID jornada (vacío = hoy)" style="width:100%;background:#1e293b;border:1px solid #334155;color:#f1f5f9;border-radius:8px;padding:8px 10px"></div><button class="op-btn" style="background:linear-gradient(135deg,#2563eb,#3b82f6);color:#fff;border:none;padding:9px 16px;border-radius:8px;font-weight:700" onclick="cargarReportePropinas()"><i class="bi bi-search"></i> Consultar</button></div><div id="opPropKpis" class="op-kpi"><div class="op-kpi-item"><span>Total propina</span><b id="opPropTotal">$0</b></div><div class="op-kpi-item"><span>Pozo común barra (30%)</span><b id="opPozoBarra" style="color:#fbbf24">$0</b></div><div class="op-kpi-item"><span>Meseros con propina</span><b id="opPropCount">0</b></div></div><div class="op-scroll"><table class="op-table"><thead><tr><th>Mesero</th><th>Rol</th><th style="text-align:center">Ventas</th><th style="text-align:right">Propina total</th><th style="text-align:right">Efectivo</th><th style="text-align:right">Tarjeta</th><th style="text-align:right">Pozo barra</th></tr></thead><tbody id="opPropBody"><tr><td colspan="7" style="text-align:center;color:#64748b;padding:18px">Sin datos</td></tr></tbody></table></div></div></div>'+
    '</div>'+
    '</div>';
    if(modal && modal.parentNode===main){ main.insertBefore(document.createRange().createContextualFragment(html), modal); } else { main.insertAdjacentHTML('beforeend', html); }
}
function switchUsuarioSubTab(t){
    usuarioSubTab=t;
    var a=document.getElementById('opTabAsist'), b=document.getElementById('opTabProp');
    var ca=document.getElementById('opContAsistencia'), cb=document.getElementById('opContPropinas');
    if(a) a.classList.toggle('active', t==='asistencia');
    if(b) b.classList.toggle('active', t==='propinas');
    if(ca) ca.style.display=t==='asistencia'?'block':'none';
    if(cb) cb.style.display=t==='propinas'?'block':'none';
}
var _listaUsuariosCache=[], _estadosCache={}, _cajaAbierta=false, _cajaVerificada=false;
function actualizarEstadoCajaTurno(){
    fetch(API_BASE+'/api/caja/estado').then(r=>r.json()).then(d=>{
        _cajaAbierta=!!(d.caja_abierta||d.caja);
        if(d.caja && d.caja.estado==='Abierta') _cajaAbierta=true;
        _cajaVerificada=true;
        if(_listaUsuariosCache.length) renderFichajeGrid(_listaUsuariosCache);
    }).catch(function(){
        fetch(API_BASE+'/api/jornada/activa').then(r=>r.json()).then(d=>{
            _cajaAbierta=!!d.jornada;
            _cajaVerificada=true;
            if(_listaUsuariosCache.length) renderFichajeGrid(_listaUsuariosCache);
        }).catch(function(){ _cajaAbierta=false; _cajaVerificada=true; });
    });
}
function cargarAsistenciasHoy(){
    if(typeof listaRoles==='undefined') return;
    actualizarEstadoCajaTurno();
    fetch(API_BASE+'/api/asistencia/estados').then(r=>r.json()).then(d=>{ if(d.success){ _estadosCache=d.estados||{}; if(_listaUsuariosCache.length) renderFichajeGrid(_listaUsuariosCache); }}).catch(()=>{});
    fetch(API_BASE+'/api/usuarios').then(r=>r.json()).then(d=>{
        if(d.success){ _listaUsuariosCache=d.usuarios||[]; renderFichajeGrid(_listaUsuariosCache); }
    }).catch(()=>{});
    fetch(API_BASE+'/api/asistencia/hoy').then(r=>r.json()).then(d=>{
        if(d.success) renderAsistenciasHoy(d.asistencias||[]);
    }).catch(()=>{});
}
function renderFichajeGrid(usuarios){
    var cont=document.getElementById('opAsistGrid');
    if(!cont) return;
    var rolesPermitidos=['mesero','cajero','bartender','seguridad','barman','barra'];
    var filtrados=usuarios.filter(function(u){ if(!u.activo) return false; var rn=(u.rol_nombre||'').toLowerCase(); if(rolesPermitidos.some(function(k){return rn.indexOf(k)!==-1;})) return true; return ['mesero','cajero'].indexOf(rn)!==-1 || u.id_rol===3 || u.id_rol===4; });
    if(filtrados.length===0) filtrados=usuarios.filter(function(u){return u.activo;}).slice(0,8);
    if(filtrados.length===0){ cont.innerHTML='<div style="color:#64748b;padding:16px">No hay personal activo para fichar</div>'; return; }
    var avisoCaja=!_cajaAbierta && _cajaVerificada ? '<div style="grid-column:1/-1;background:#450a0a;border:1px solid #7f1d1d;color:#fca5a5;border-radius:10px;padding:12px 14px;font-size:.82rem;display:flex;gap:8px;align-items:center"><i class="bi bi-exclamation-octagon" style="color:#f87171"></i><span><b>Imposible iniciar turno: La Caja Principal se encuentra cerrada.</b> Solicita al Cajero abrir la caja antes de iniciar turnos.</span></div>' : '';
    var html=avisoCaja;
    filtrados.forEach(function(u){
        var ini=(u.nombre||'?').trim().charAt(0).toUpperCase();
        var est=_estadosCache[u.id_usuario]||null;
        var badgeEst=est?'<span style="font-size:.65rem;padding:2px 6px;border-radius:6px;background:#1e293b;color:#38bdf8;border:1px solid #334155;margin-left:6px">'+escHtml(est)+'</span>':'';
        var disE=est==='entrada'?' disabled style="opacity:.4;cursor:not-allowed;filter:grayscale(1)" title="Ya en Entrada"':'';
        var cajaBloqueo=!_cajaAbierta && _cajaVerificada;
        var disT=cajaBloqueo ? ' disabled style="opacity:.4;cursor:not-allowed;filter:grayscale(1)" title="Imposible iniciar turno: La Caja Principal se encuentra cerrada."' : (est==='inicio_turno'?' disabled style="opacity:.4;cursor:not-allowed;filter:grayscale(1)" title="Ya en Turno"':'');
        var disS=est==='salida'?' disabled style="opacity:.4;cursor:not-allowed;filter:grayscale(1)" title="Ya en Salida"':'';
        html+='<div class="op-person"><div class="op-person-top"><div class="op-av">'+ini+'</div><div style="flex:1;min-width:0"><div style="font-weight:700;color:#f8fafc;font-size:.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+escHtml(u.nombre)+badgeEst+'</div><div style="font-size:.72rem;color:#94a3b8">'+escHtml(u.rol_nombre||'')+' · #'+u.id_usuario+'</div></div></div><div class="op-btns"><button class="op-btn op-btn-e"'+disE+' onclick="ficharSolicitarPin('+u.id_usuario+',\'entrada\')"><i class="bi bi-box-arrow-in-right"></i> Entrada</button><button class="op-btn op-btn-t"'+disT+' onclick="ficharSolicitarPin('+u.id_usuario+',\'inicio_turno\')"><i class="bi bi-play-circle"></i> Turno</button><button class="op-btn op-btn-s"'+disS+' onclick="ficharSolicitarPin('+u.id_usuario+',\'salida\')"><i class="bi bi-box-arrow-right"></i> Salida</button></div></div>';
    });
    cont.innerHTML=html;
}
function escHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function ficharSolicitarPin(idUsuario,tipo){
    if(tipo==='inicio_turno' && !_cajaAbierta && _cajaVerificada){
        mostrarAlerta('danger','Imposible iniciar turno: La Caja Principal se encuentra cerrada.');
        return;
    }
    var est=_estadosCache[idUsuario];
    if(est && est===tipo){ mostrarAlerta('warning','Ya estas en estado '+tipo+' — boton deshabilitado'); return; }
    var overlay=document.createElement('div');
    overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:99999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)';
    overlay.id='pinFichajeOverlay';
    overlay.innerHTML='<div style="background:#0f172a;border:1px solid #334155;border-radius:16px;padding:22px;width:92%;max-width:360px;box-shadow:0 20px 60px rgba(0,0,0,.5)"><div style="font-weight:800;color:#f8fafc;margin-bottom:6px"><i class="bi bi-key"></i> Ingresa tu PIN</div><div style="font-size:.78rem;color:#94a3b8;margin-bottom:14px">Usuario #'+idUsuario+' · '+escHtml(tipo)+'</div><input id="pinFichajeInput" type="password" maxlength="20" placeholder="PIN / Contrasena" style="width:100%;background:#1e293b;border:1px solid #334155;color:#f8fafc;border-radius:10px;padding:12px;font-size:1rem;text-align:center;letter-spacing:.15em" autocomplete="off"><div style="display:flex;gap:8px;margin-top:14px"><button onclick="document.getElementById(\'pinFichajeOverlay\').remove()" style="flex:1;background:#1e293b;color:#94a3b8;border:1px solid #334155;border-radius:10px;padding:10px;font-weight:700">Cancelar</button><button id="pinFichajeOk" style="flex:1;background:linear-gradient(135deg,#2563eb,#3b82f6);color:#fff;border:none;border-radius:10px;padding:10px;font-weight:800">Validar</button></div><div id="pinFichajeMsg" style="font-size:.75rem;color:#fca5a5;margin-top:8px;min-height:14px"></div></div>';
    document.body.appendChild(overlay);
    var inp=document.getElementById('pinFichajeInput'); inp.focus();
    inp.addEventListener('keydown',function(e){ if(e.key==='Enter') doFichar(); });
    document.getElementById('pinFichajeOk').onclick=doFichar;
    overlay.addEventListener('click',function(e){ if(e.target===overlay) overlay.remove(); });
    function doFichar(){
        var pin=inp.value.trim(); if(!pin){ document.getElementById('pinFichajeMsg').textContent='Ingresa tu PIN'; return; }
        document.getElementById('pinFichajeOk').disabled=true; document.getElementById('pinFichajeOk').textContent='...';
        fichar(idUsuario,tipo,pin);
    }
}
function fichar(idUsuario,tipo,pin){
    if(!pin){ return ficharSolicitarPin(idUsuario,tipo); }
    var jId=null; try{ if(typeof jornadaActiva!=='undefined' && jornadaActiva) jId=jornadaActiva.id_jornada; }catch(e){}
    fetch(API_BASE+'/api/asistencia/fichar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id_usuario:idUsuario,tipo:tipo,id_jornada:jId,pin:pin})}).then(r=>r.json().then(function(d){ return {status:r.status, body:d};})).then(function(w){
        var d=w.body;
        var ov=document.getElementById('pinFichajeOverlay'); if(ov) ov.remove();
        if(d.success){ _estadosCache[idUsuario]=d.estado_actual||tipo; mostrarAlerta('success',d.mensaje+' — estado: '+d.estado_actual); renderFichajeGrid(_listaUsuariosCache); cargarAsistenciasHoy(); } else mostrarAlerta('danger',d.mensaje||'Error fichaje');
    }).catch(function(){ var ov=document.getElementById('pinFichajeOverlay'); if(ov) ov.remove(); mostrarAlerta('danger','No se pudo conectar');});
}
function renderAsistenciasHoy(list){
    var tb=document.getElementById('opAsistHoy'), cnt=document.getElementById('opAsistCount');
    if(cnt) cnt.textContent=list.length+' registros';
    if(!tb) return;
    if(!list.length){ tb.innerHTML='<tr><td colspan="5" style="text-align:center;color:#64748b;padding:18px">Sin fichajes hoy</td></tr>'; return; }
    var html='';
    list.forEach(function(a){
        var tipoBadge=a.tipo==='entrada'?'<span style="background:#064e3b;color:#34d399;padding:3px 8px;border-radius:12px;font-size:.72rem;font-weight:700">Entrada</span>':a.tipo==='salida'?'<span style="background:#7f1d1d;color:#fca5a5;padding:3px 8px;border-radius:12px;font-size:.72rem;font-weight:700">Salida</span>':'<span style="background:#1e3a8a;color:#93c5fd;padding:3px 8px;border-radius:12px;font-size:.72rem;font-weight:700">Inicio Turno</span>';
        var hora=''; try{ hora=new Date(a.timestamp).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'});}catch(e){ hora=a.timestamp; }
        html+='<tr><td style="color:#94a3b8">'+hora+'</td><td style="font-weight:600">'+escHtml(a.nombre)+'</td><td style="color:#64748b">'+escHtml(a.rol)+'</td><td>'+tipoBadge+'</td><td style="color:#64748b">'+(a.id_jornada||'--')+'</td></tr>';
    });
    tb.innerHTML=html;
}
function cargarReportePropinas(){
    var j=document.getElementById('opPropJornada');
    var q=j && j.value ? '?id_jornada='+encodeURIComponent(j.value) : '';
    fetch(API_BASE+'/api/propinas/reporte'+q).then(r=>r.json()).then(d=>{
        if(!d.success) return;
        var totEl=document.getElementById('opPropTotal'), pozoEl=document.getElementById('opPozoBarra'), cntEl=document.getElementById('opPropCount');
        if(totEl) totEl.textContent='$'+Number(d.total_propina||0).toLocaleString('es-CO');
        if(pozoEl) pozoEl.textContent='$'+Number(d.pozo_barra||0).toLocaleString('es-CO');
        if(cntEl) cntEl.textContent=(d.detalle||[]).length;
        var tb=document.getElementById('opPropBody');
        if(!tb) return;
        if(!d.detalle || !d.detalle.length){ tb.innerHTML='<tr><td colspan="7" style="text-align:center;color:#64748b;padding:18px">Sin propinas en el filtro</td></tr>'; return; }
        tb.innerHTML=d.detalle.map(function(r){
            return '<tr><td style="font-weight:600">'+escHtml(r.mesero)+'</td><td><span style="background:#1e293b;color:#94a3b8;padding:3px 8px;border-radius:8px;font-size:.72rem">'+escHtml(r.rol)+'</span></td><td style="text-align:center">'+r.ventas+'</td><td style="text-align:right;color:#34d399;font-weight:700">$'+Number(r.propina_total).toLocaleString('es-CO')+'</td><td style="text-align:right;color:#94a3b8">$'+Number(r.propina_efectivo).toLocaleString('es-CO')+'</td><td style="text-align:right;color:#c4b5fd">$'+Number(r.propina_tarjeta).toLocaleString('es-CO')+'</td><td style="text-align:right;color:#fbbf24;font-weight:700">$'+Number(r.pozo_asignado).toLocaleString('es-CO')+'</td></tr>';
        }).join('');
    }).catch(()=>{});
}

var modalUsuarioBS = null;

function cargarRoles() {
    fetch(API_BASE + '/api/roles')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success) {
                listaRoles = data.roles;
                renderizarRoles(data.roles);
            }
        })
        .catch(function() {});
}

function renderizarRoles(roles) {
    var cont = document.getElementById('contenedorRoles');
    if (roles.length === 0) {
        cont.innerHTML = '<span style="color:#94a3b8;font-size:0.85rem">No hay roles definidos</span>';
        return;
    }
    cont.innerHTML = '';
    roles.forEach(function(r) {
        var colorMap = { 1: '#3b82f6', 2: '#8b5cf6', 3: '#10b981', 4: '#f59e0b' };
        var color = colorMap[r.id_rol] || '#64748b';
        var badge = document.createElement('span');
        badge.style.cssText = 'display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:20px;font-weight:600;font-size:0.82rem;background:' + color + '15;color:' + color + ';border:1px solid ' + color + '30';
        badge.innerHTML = '<i class="bi bi-shield-check"></i> ' + r.nombre;
        cont.appendChild(badge);
    });
}

function cargarUsuarios() {
    var cont = document.getElementById('contenedorTablaUsuarios');
    cont.innerHTML = '<div class="spinner-border spinner-border-sm text-primary"></div>';

    fetch(API_BASE + '/api/usuarios')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success) {
                renderizarTablaUsuarios(data.usuarios);
            } else {
                cont.innerHTML = '<div style="padding:20px;color:#dc2626"><i class="bi bi-exclamation-triangle me-1"></i> Error al cargar usuarios</div>';
            }
        })
        .catch(function() {
            cont.innerHTML = '<div style="padding:20px;color:#dc2626"><i class="bi bi-exclamation-triangle me-1"></i> No se pudo conectar con el servidor</div>';
        });
}

function renderizarTablaUsuarios(usuarios) {
    var cont = document.getElementById('contenedorTablaUsuarios');
    if (usuarios.length === 0) {
        cont.innerHTML = '<div style="padding:24px;color:#94a3b8;text-align:center"><i class="bi bi-people" style="font-size:2rem;display:block;margin-bottom:8px"></i>No hay usuarios registrados.</div>';
        return;
    }

    var rolColorMap = { 'Administrador': '#3b82f6', 'Gerente': '#8b5cf6', 'Mesero': '#10b981', 'Cajero': '#f59e0b' };

    var tabla = '<div class="table-responsive"><table class="table table-hover mb-0 align-middle" style="margin:0">' +
        '<thead style="background:#f8fafc"><tr>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.85rem">ID</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.85rem">Nombre</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.85rem">Correo</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.85rem">Rol</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.85rem">Estado</th>' +
        '<th class="text-center" style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.85rem">Accion</th></tr></thead><tbody>';

    var puedeGestionar = esAdminUsuarios();
    usuarios.forEach(function(u) {
        var rolColor = rolColorMap[u.rol_nombre] || '#64748b';
        var rolBadge = '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:12px;font-size:0.78rem;font-weight:600;background:' + rolColor + '15;color:' + rolColor + '">' + (u.rol_nombre || 'Sin rol') + '</span>';
        var estadoBadge = u.activo ? '<span class="status-indicator status-disponible" style="font-size:0.75rem;padding:3px 10px"><span class="status-dot"></span>Activo</span>' : '<span class="status-indicator status-default" style="font-size:0.75rem;padding:3px 10px"><span class="status-dot"></span>Inactivo</span>';

        var btnAccion = '<span style="color:#cbd5e1;font-size:.8rem" title="Solo Administrador">—</span>';
        if (puedeGestionar) {
            btnAccion = u.activo ?
                '<button class="btn-custom-action" style="background:#fef2f2;color:#b91c1c;padding:5px 10px;font-size:0.78rem;border:1px solid #fecaca;margin-right:4px" onclick="toggleUsuarioEstado(' + u.id_usuario + ', 0)"><i class="bi bi-x-lg"></i></button>' +
                '<button class="btn-custom-action" style="background:#eff6ff;color:#2563eb;padding:5px 10px;font-size:0.78rem;border:1px solid #bfdbfe" onclick="editarUsuario(' + u.id_usuario + ',\'' + (u.nombre||'').replace(/'/g, "\\'") + '\',\'' + (u.correo||'') + '\',' + (u.id_rol||1) + ',' + (u.activo ? 1 : 0) + ')"><i class="bi bi-pencil"></i></button>'
                : '<button class="btn-custom-action" style="background:#ecfdf5;color:#15803d;padding:5px 10px;font-size:0.78rem;border:1px solid #bbf7d0" onclick="toggleUsuarioEstado(' + u.id_usuario + ', 1)"><i class="bi bi-check-lg"></i></button>';
        }

        tabla += '<tr style="border-color:#f1f5f9">' +
            '<td style="border-color:#f1f5f9;font-weight:700;color:#0f172a">' + u.id_usuario + '</td>' +
            '<td style="border-color:#f1f5f9;color:#334155;font-weight:600">' + (u.nombre || '') + '</td>' +
            '<td style="border-color:#f1f5f9;color:#64748b">' + (u.correo || '-') + '</td>' +
            '<td style="border-color:#f1f5f9">' + rolBadge + '</td>' +
            '<td style="border-color:#f1f5f9">' + estadoBadge + '</td>' +
            '<td class="text-center" style="border-color:#f1f5f9">' + btnAccion + '</td></tr>';
    });
    tabla += '</tbody></table></div>';
    cont.innerHTML = tabla;
}

function modalNuevoUsuario() {
    if (!esAdminUsuarios()) { if (typeof mostrarToast === 'function') mostrarToast('danger', 'Solo el Administrador puede crear usuarios.'); return; }
    document.getElementById('tituloModalUsuario').innerHTML = '<i class="bi bi-person-plus me-2"></i>Nuevo Usuario';
    document.getElementById('subTituloModalUsuario').textContent = 'Alta de personal';
    pintarAvatarUsuario('?');
    document.getElementById('formUsuario').reset();
    document.getElementById('inputUsId').value = '';
    document.getElementById('labelContrasena').textContent = 'Contraseña *';
    document.getElementById('hintContrasena').textContent = 'Mínimo 4 caracteres.';
    document.getElementById('inputUsContrasena').required = true;
    document.getElementById('switchUsActivo').checked = true;
    pintarSwitchEstado();

    var selectRol = document.getElementById('inputUsRol');
    selectRol.innerHTML = '<option value="">Seleccionar rol...</option>';
    listaRoles.forEach(function(r) {
        selectRol.innerHTML += '<option value="' + r.id_rol + '">' + r.nombre + '</option>';
    });

    if (!modalUsuarioBS) modalUsuarioBS = new bootstrap.Modal(document.getElementById('modalUsuario'));
    modalUsuarioBS.show();
}

function editarUsuario(id, nombre, correo, idRol, activo) {
    if (!esAdminUsuarios()) { if (typeof mostrarToast === 'function') mostrarToast('danger', 'Solo el Administrador puede modificar usuarios.'); return; }
    document.getElementById('tituloModalUsuario').innerHTML = '<i class="bi bi-pencil me-2"></i>Editar Usuario';
    document.getElementById('subTituloModalUsuario').textContent = correo || 'Edición de personal';
    pintarAvatarUsuario(nombre);
    document.getElementById('inputUsId').value = id;
    document.getElementById('inputUsNombre').value = nombre;
    document.getElementById('inputUsCorreo').value = correo;
    document.getElementById('inputUsContrasena').value = '';
    document.getElementById('inputUsContrasena').required = false;
    document.getElementById('labelContrasena').textContent = 'Contraseña';
    document.getElementById('hintContrasena').textContent = 'Dejar vacío para mantener la actual.';
    document.getElementById('switchUsActivo').checked = Number(activo) !== 0;
    pintarSwitchEstado();

    var selectRol = document.getElementById('inputUsRol');
    selectRol.innerHTML = '<option value="">Seleccionar rol...</option>';
    listaRoles.forEach(function(r) {
        selectRol.innerHTML += '<option value="' + r.id_rol + '"' + (r.id_rol === idRol ? ' selected' : '') + '>' + r.nombre + '</option>';
    });

    if (!modalUsuarioBS) modalUsuarioBS = new bootstrap.Modal(document.getElementById('modalUsuario'));
    modalUsuarioBS.show();
}

function guardarUsuario() {
    if (!esAdminUsuarios()) { if (typeof mostrarAlerta === 'function') mostrarAlerta('danger', 'Solo el Administrador puede guardar usuarios.'); return; }
    var id = document.getElementById('inputUsId').value;
    var nombre = document.getElementById('inputUsNombre').value.trim();
    var correo = document.getElementById('inputUsCorreo').value.trim();
    var contrasena = document.getElementById('inputUsContrasena').value;
    var idRol = document.getElementById('inputUsRol').value;

    if (!nombre || !correo || !idRol) {
        mostrarAlerta('warning', 'Nombre, correo y rol son obligatorios.');
        return;
    }

    if (!id && !contrasena) {
        mostrarAlerta('warning', 'La contrasena es obligatoria para nuevos usuarios.');
        return;
    }

    var url = id ? API_BASE + '/api/usuarios/' + id : API_BASE + '/api/usuarios';
    var method = id ? 'PUT' : 'POST';

    var swActivo = document.getElementById('switchUsActivo');
    var payload = { nombre: nombre, correo: correo, id_rol: Number(idRol) };
    if (contrasena) payload.contrasena = contrasena;
    if (id && swActivo) payload.activo = swActivo.checked ? 1 : 0;

    fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.success) {
            if (modalUsuarioBS) modalUsuarioBS.hide();
            mostrarAlerta('success', data.mensaje);
            cargarUsuarios();
        } else {
            mostrarAlerta('danger', data.mensaje || 'Error al guardar usuario');
        }
    })
    .catch(function() {
        mostrarAlerta('danger', 'No se pudo conectar con el servidor');
    });
}

function toggleUsuarioEstado(id, activo) {
    if (!esAdminUsuarios()) { if (typeof mostrarToast === 'function') mostrarToast('danger', 'Solo el Administrador puede activar/desactivar usuarios.'); return; }
    fetch(API_BASE + '/api/usuarios/' + id + '/estado', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: activo })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.success) {
            mostrarAlerta('success', data.mensaje);
            cargarUsuarios();
        } else {
            mostrarAlerta('danger', data.mensaje || 'Error al actualizar usuario');
        }
    })
    .catch(function() {
        mostrarAlerta('danger', 'No se pudo conectar con el servidor');
    });
}
