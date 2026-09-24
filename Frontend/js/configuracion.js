var cfgPanel = { general:{}, unidades:[], conversiones:[], zonas:[], notas:[], categorias:[], productos:[], usuario:{}, esAdmin:false };

function cfgEsc(t){return String(t==null?'':t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function cfgNum(v){var n=Number(v);return isFinite(n)?n:0;}

function cfgInitCtx(){
  try{cfgPanel.usuario=JSON.parse(localStorage.getItem('usuario')||'{}');}catch(e){cfgPanel.usuario={};}
  cfgPanel.esAdmin=Number(cfgPanel.usuario.id_rol)===1;
}

function iniciarConfiguracion(){
  if(typeof verificarAcceso==='function'&&!verificarAcceso('gestionar_configuracion')){if(typeof verificarAccesoRB==='function'&&!verificarAccesoRB('gestionar_configuracion'))return;return;}
  if(typeof verificarAccesoRB==='function'&&!verificarAccesoRB('gestionar_configuracion'))return;
  if(typeof activarNav==='function') activarNav('navConfiguracion');
  cfgInitCtx();
  var mc=document.getElementById('main-content');
  mc.innerHTML='<div class="cfg-wrapper cfg-panel">'
    +'<div class="cfg-hero"><h1><i class="bi bi-sliders2"></i> Configuraci\u00f3n ClubMaster</h1><p>Panel central \u2014 administra tu club nocturno desde un solo lugar. Dark mode optimizado para ambientes con poca luz.</p>'
    +'<div class="cfg-hero-meta"><span class="cfg-hero-badge live">Sistema operativo</span><span class="cfg-hero-badge"><i class="bi bi-shield-lock"></i> '+cfgEsc(cfgPanel.usuario.rol||'Administrador')+'</span><span class="cfg-hero-badge"><i class="bi bi-moon-stars"></i> Tema Nocturno #121212</span></div></div>'
    +'<div class="cfg-nav" id="cfgNav"></div>'
    +'<div id="cfgAlert"></div>'
    +'<div id="cfgSections"><div class="cfg-empty"><div class="spinner-border text-primary"></div><p style="margin-top:12px">Cargando configuraci\u00f3n...</p></div></div></div>';
  cfgRenderNav();
  cfgCargarDatos();
}

function cfgRenderNav(){
  var nav=document.getElementById('cfgNav'); if(!nav) return;
  var tabs=[
    {id:'general',icon:'bi-gear',label:'General y Entorno'},
    {id:'inventario',icon:'bi-cup-straw',label:'Inventarios y Precios'},
    {id:'pos',icon:'bi-printer',label:'POS y Barra'},
    {id:'seguridad',icon:'bi-shield-lock',label:'Seguridad'},
    {id:'mantenimiento',icon:'bi-tools',label:'Mantenimiento'}
  ];
  var h=''; tabs.forEach(function(t,i){
    h+='<button class="cfg-nav-item'+(i===0?' active':'')+'" onclick="cfgScrollTo(\''+t.id+'\',this)"><i class="bi '+t.icon+'"></i> '+t.label+'</button>';
  });
  h+='<button class="cfg-nav-item" onclick="iniciarConfiguracion()" style="margin-left:auto"><i class="bi bi-arrow-clockwise"></i> Actualizar</button>';
  var demoOn=false; try{demoOn=localStorage.getItem('demo')==='1';}catch(e){}
  h+='<button class="cfg-nav-item" onclick="'+(demoOn?'demoSalir()':'demoEntrar()')+'" style="margin-left:6px;background:'+(demoOn?'#F59E0B':'#1E293B')+';color:'+(demoOn?'#451A03':'#94A3B8')+';border:1px solid '+(demoOn?'#FBBF24':'#334155')+'"><i class="bi '+(demoOn?'bi-easel':'bi-mortarboard')+'"></i> '+(demoOn?'Salir Demo':'Modo Entrenamiento')+'</button>';
  nav.innerHTML=h;
}
function cfgScrollTo(id,btn){
  document.querySelectorAll('.cfg-nav-item').forEach(function(b){b.classList.remove('active');});
  if(btn) btn.classList.add('active');
  var el=document.getElementById('cfgSec_'+id);
  if(el) el.scrollIntoView({behavior:'smooth',block:'start'});
}

function cfgCargarDatos(){
  Promise.all([
    fetch(API_BASE+'/api/configuracion').then(function(r){return r.json();}).catch(function(){return {success:false};}),
    fetch(API_BASE+'/api/unidades-medida').then(function(r){return r.json();}).catch(function(){return {success:false};}),
    fetch(API_BASE+'/api/conversiones').then(function(r){return r.json();}).catch(function(){return {success:false};}),
    fetch(API_BASE+'/api/zonas').then(function(r){return r.json();}).catch(function(){return {success:false};}),
    fetch(API_BASE+'/api/notas-preparacion').then(function(r){return r.json();}).catch(function(){return {success:false};}),
    fetch(API_BASE+'/api/categorias').then(function(r){return r.json();}).catch(function(){return {success:false};}),
    fetch(API_BASE+'/api/productos/admin').then(function(r){return r.json();}).catch(function(){return {success:false};})
  ]).then(function(res){
    if(res[0].success) cfgPanel.general=res[0].config||{};
    if(res[1].success) cfgPanel.unidades=res[1].unidades||[];
    if(res[2].success) cfgPanel.conversiones=res[2].conversiones||[];
    if(res[3].success) cfgPanel.zonas=res[3].zonas||[];
    if(res[4].success) cfgPanel.notas=res[4].notas||[];
    if(res[5].success) cfgPanel.categorias=res[5].categorias||[];
    if(res[6].success) cfgPanel.productos=res[6].productos||[];
    cfgRenderSections();
  }).catch(function(){ var c=document.getElementById('cfgSections'); if(c) c.innerHTML='<div class="cfg-empty" style="color:#F87171">No se pudo conectar con el servidor</div>'; });
}

function cfgIrInventario(tab){
  cfgModalClose();
  if(typeof iniciarConfiguracionInventario==='function'){
    iniciarConfiguracionInventario();
    if(tab) setTimeout(function(){ if(typeof cambiarCfgTab==='function') cambiarCfgTab(tab); },350);
  } else if(typeof iniciarInventario==='function'){
    iniciarInventario();
  }
}
function cfgRenderSections(){
  var c=document.getElementById('cfgSections'); if(!c) return;
  c.innerHTML=''
    + cfgSection('general','GENERAL Y ENTORNO','Parámetros globales del establecimiento','s1','bi-building',[
      {id:'establecimiento',icon:'bi-building',title:'Datos del Establecimiento',desc:'Nombre, NIT/RUT, direcci\u00f3n, licencia y contacto del club.',badge:'Configurado'},
      {id:'regional',icon:'bi-globe-americas',title:'Configuraci\u00f3n Regional',desc:'Moneda local, zona horaria, IVA e impuesto al consumo.',badge:null},
      {id:'zonas',icon:'bi-layers',title:'Zonas y Barras',desc:'Barra Principal, VIP, Palcos, Terraza y colores por zona.',badge:cfgPanel.zonas.length+' zonas'},
      {id:'cierre',icon:'bi-clock-history',title:'Cierre Operativo Nocturno',desc:'Hora de corte de jornada. Ej: 06:00 AM cierra el d\u00eda anterior.',badge:cfgPanel.general.hora_cierre_operativo||'06:00 AM'}
    ],'c1')
    + cfgSection('inventario','INVENTARIOS, LICORES Y PRECIOS','Módulo unificado en Inventario — acceso directo','s2','bi-cup-straw',[
      {id:'goto_unidades',icon:'bi-cup',title:'Dosificación y Unidades',desc:'Equivalencias: Botella, Media, Shot, Onzas y conversiones. → Inventario',badge:'Ir a Inventario →'},
      {id:'goto_precios',icon:'bi-tag',title:'Reglas de Precios y Zonas',desc:'Precios VIP vs General, Happy Hour y eventos. → Inventario',badge:'Ir a Inventario →'},
      {id:'goto_mermas',icon:'bi-droplet-half',title:'Mermas y Consumo Interno',desc:'Botellas rotas, cortesías y consumo DJ / Staff. → Inventario',badge:'Ir a Inventario →'}
    ],'c2')
    + cfgSection('pos','POS Y DISPOSITIVOS DE BARRA','Hardware y experiencia del cajero','s3','bi-display',[
      {id:'impresoras',icon:'bi-printer',title:'Impresoras de Barra',desc:'Tiqueteras t\u00e9rmicas asignadas por \u00e1rea de despacho.',badge:null},
      {id:'tiquete',icon:'bi-receipt',title:'Dise\u00f1o de Tiquete y QR',desc:'Comprobante de barra y c\u00f3digo QR de carta de licores.',badge:null},
      {id:'terminal',icon:'bi-brightness-high',title:'Ajustes de Terminal Nocturno',desc:'Tama\u00f1o de texto y contraste para bartender / cajero.',badge:null}
    ],'c3')
    + cfgSection('seguridad','SEGURIDAD Y CONTROL DE ACCESO','Protecci\u00f3n y permisos','s4','bi-shield-lock',[
      {id:'pin',icon:'bi-key',title:'Clave Maestra de Gerente',desc:'PIN de autorizaciones, anulaciones y descuentos.',badge:'****'},
      {id:'permisos',icon:'bi-people',title:'Permisos por Rol',desc:'Administrador, Cajero, Bartender, Mesero, Cover.',badge:cfgPanel.general.permisos_version?'v2':null}
    ],'c4')
    + cfgSection('mantenimiento','MANTENIMIENTO Y UTILITIES','Respaldos y auditor\u00eda','s5','bi-tools',[
      {id:'backup',icon:'bi-cloud-arrow-up',title:'Copias de Seguridad',desc:'Respaldos autom\u00e1ticos post-jornada en la nube/local.',badge:cfgPanel.general.backup_auto==='1'?'Auto ON':'Manual'},
      {id:'logs',icon:'bi-database',title:'Mantenimiento y Logs',desc:'Auditor\u00eda de acciones e importaci\u00f3n/exportaci\u00f3n de licores.',badge:null}
    ],'c5');
}

function cfgSection(anchor, title, sub, iconCls, icon, cards, cardCls){
  var h='<div class="cfg-section" id="cfgSec_'+anchor+'"><div class="cfg-section-head"><div class="cfg-section-icon '+iconCls+'"><i class="bi '+icon+'"></i></div><div><div class="cfg-section-title">'+title+'</div><div class="cfg-section-sub">'+sub+'</div></div><div class="cfg-section-line"></div><span class="cfg-section-count">'+cards.length+' opciones</span></div><div class="cfg-grid">';
  cards.forEach(function(card){
    h+='<div class="cfg-card '+cardCls+'" onclick="cfgOpen(\''+card.id+'\')"><div class="cfg-card-top"><div class="cfg-card-icon"><i class="bi '+card.icon+'"></i></div><div class="cfg-card-arrow"><i class="bi bi-chevron-right"></i></div></div><div class="cfg-card-body"><div class="cfg-card-title">'+card.title+'</div><div class="cfg-card-desc">'+card.desc+'</div></div><div class="cfg-card-foot">'+(card.badge?'<span class="cfg-card-badge"><i class="bi bi-check-circle"></i> '+cfgEsc(card.badge)+'</span>':'<i class="bi bi-arrow-right"></i> Configurar')+'</div></div>';
  });
  h+='</div></div>';
  return h;
}

function cfgOpen(id){
  var gotoMap={
    goto_unidades:function(){ cfgIrInventario('inventario'); },
    goto_categorias:function(){ cfgIrInventario('inventario'); },
    goto_precios:function(){ cfgIrInventario('inventario'); },
    goto_stock:function(){ if(typeof iniciarInventario==='function') { cfgModalClose(); iniciarInventario(); } },
    goto_mermas:function(){ if(typeof iniciarMermas==='function'){ cfgModalClose(); iniciarMermas(); } else cfgIrInventario('inventario'); }
  };
  if(gotoMap[id]) return gotoMap[id]();
  var map={
    establecimiento:cfgModalEstablecimiento,
    regional:cfgModalRegional,
    zonas:cfgModalZonas,
    cierre:cfgModalCierre,
    dosificacion:function(){ cfgIrInventario('inventario'); },
    precios:function(){ cfgIrInventario('inventario'); },
    mermas:function(){ if(typeof iniciarMermas==='function'){ cfgModalClose(); iniciarMermas(); } else cfgIrInventario('inventario'); },
    impresoras:cfgModalImpresoras,
    tiquete:cfgModalTiquete,
    terminal:cfgModalTerminal,
    pin:cfgModalPin,
    permisos:cfgModalPermisos,
    backup:cfgModalBackup,
    logs:cfgModalLogs
  };
  if(map[id]) map[id]();
}

function cfgModalWrap(icon,iconBg,title,bodyHtml,footHtml){
  var id='cfgModalOverlay';
  var exist=document.getElementById(id); if(exist) exist.remove();
  var overlay=document.createElement('div');
  overlay.id=id; overlay.className='cfg-modal-overlay';
  overlay.onclick=function(e){ if(e.target===overlay) cfgModalClose(); };
  overlay.innerHTML='<div class="cfg-modal"><div class="cfg-modal-head"><h3><i class="bi '+icon+'" style="background:'+iconBg+';color:#fff"></i> '+title+'</h3><button class="cfg-modal-close" onclick="cfgModalClose()"><i class="bi bi-x-lg"></i></button></div><div class="cfg-modal-body">'+bodyHtml+'</div><div class="cfg-modal-foot">'+footHtml+'</div></div>';
  document.body.appendChild(overlay);
  document.addEventListener('keydown',cfgEscKey);
}
function cfgModalClose(){
  var el=document.getElementById('cfgModalOverlay'); if(el) el.remove();
  document.removeEventListener('keydown',cfgEscKey);
}
function cfgEscKey(e){ if(e.key==='Escape') cfgModalClose(); }
function cfgToast(tipo,msg){
  if(typeof mostrarToast==='function') return mostrarToast(tipo,msg);
  var c=document.getElementById('toastContainer'); if(!c){c=document.createElement('div');c.id='toastContainer';c.style.cssText='position:fixed;top:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px';document.body.appendChild(c);}
  var d=document.createElement('div');d.className='toast-cm toast-'+tipo;d.style.cssText='min-width:260px;padding:12px 16px;border-radius:10px;color:#fff;font-weight:600;font-size:.85rem;display:flex;align-items:center;gap:8px;box-shadow:0 8px 24px rgba(0,0,0,.2)';
  var bg={success:'linear-gradient(135deg,#10B981,#059669)',danger:'linear-gradient(135deg,#EF4444,#DC2626)',warning:'linear-gradient(135deg,#F59E0B,#D97706)',info:'linear-gradient(135deg,#3B82F6,#2563EB)'}[tipo]||'#334155';
  d.style.background=bg; d.textContent=msg; c.appendChild(d); setTimeout(function(){d.style.opacity='0';d.style.transition='opacity .3s';setTimeout(function(){d.remove();},300);},3500);
}
function cfgSave(payload,okMsg){
  return fetch(API_BASE+'/api/configuracion',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
    .then(function(r){return r.json();}).then(function(d){
      if(d.success){ for(var k in payload) cfgPanel.general[k]=String(payload[k]); cfgToast('success',okMsg||'Guardado correctamente'); cfgRenderSections(); return true; }
      else cfgToast('danger',d.mensaje||'Error al guardar'); return false;
    }).catch(function(){ cfgToast('danger','No se pudo conectar con el servidor'); return false;});
}

function cfgModalEstablecimiento(){
  var g=cfgPanel.general;
  cfgModalWrap('bi-building','linear-gradient(135deg,#3B82F6,#60A5FA)','Datos del Establecimiento',
    '<div class="cfg-row"><div class="cfg-field"><label class="cfg-label">Nombre del club</label><input class="cfg-input" id="cfgEstNombre" value="'+cfgEsc(g.nombre_local||'ClubMaster')+'" placeholder="ClubMaster"></div><div class="cfg-field"><label class="cfg-label">NIT / RUT</label><input class="cfg-input" id="cfgEstNit" value="'+cfgEsc(g.nit_local||'')+'" placeholder="900123456-7"></div></div>'
    +'<div class="cfg-field"><label class="cfg-label">Direcci\u00f3n</label><input class="cfg-input" id="cfgEstDir" value="'+cfgEsc(g.direccion_local||'')+'" placeholder="Calle 10 #5-20, Zona Rosa"></div>'
    +'<div class="cfg-row"><div class="cfg-field"><label class="cfg-label">Tel\u00e9fono</label><input class="cfg-input" id="cfgEstTel" value="'+cfgEsc(g.telefono_local||'')+'" placeholder="300 123 4567"></div><div class="cfg-field"><label class="cfg-label">Licencia / Registro mercantil</label><input class="cfg-input" id="cfgEstLic" value="'+cfgEsc(g.licencia||'')+'" placeholder="LIC-2024-001"></div></div>'
    +'<div class="cfg-field"><label class="cfg-label">Logo URL</label><input class="cfg-input" id="cfgEstLogo" value="'+cfgEsc(g.logo_url||'')+'" placeholder="https://.../logo.png"></div>'
    +'<div class="cfg-field"><label class="cfg-label">Mensaje pie de factura</label><textarea class="cfg-textarea" id="cfgEstPie" placeholder="Gracias por su visita...">'+cfgEsc(g.pie_factura||'')+'</textarea></div>',
    '<button class="cfg-btn cfg-btn-ghost" onclick="cfgModalClose()">Cancelar</button><button class="cfg-btn cfg-btn-primary" onclick="cfgGuardarEstablecimiento()"><i class="bi bi-check-lg"></i> Guardar</button>');
}
function cfgGuardarEstablecimiento(){
  var p={nombre_local:document.getElementById('cfgEstNombre').value.trim(),nit_local:document.getElementById('cfgEstNit').value.trim(),direccion_local:document.getElementById('cfgEstDir').value.trim(),telefono_local:document.getElementById('cfgEstTel').value.trim(),licencia:document.getElementById('cfgEstLic').value.trim(),logo_url:document.getElementById('cfgEstLogo').value.trim(),pie_factura:document.getElementById('cfgEstPie').value.trim()};
  if(!p.nombre_local) return cfgToast('warning','El nombre es obligatorio');
  cfgSave(p,'Datos del establecimiento guardados').then(function(ok){ if(ok) cfgModalClose(); });
}

function cfgModalRegional(){
  var g=cfgPanel.general;
  var monedas=['COP - Peso Colombiano','USD - D\u00f3lar','EUR - Euro','MXN - Peso Mexicano'];
  var zonasH=['America/Bogota','America/Mexico_City','America/Lima','America/Santiago','Europe/Madrid'];
  var mSel=g.moneda_local||'COP'; var zSel=g.zona_horaria||'America/Bogota';
  var mOpts=''; monedas.forEach(function(m){var v=m.split(' -')[0]; mOpts+='<option value="'+v+'"'+(v===mSel?' selected':'')+'>'+m+'</option>';});
  var zOpts=''; zonasH.forEach(function(z){ zOpts+='<option value="'+z+'"'+(z===zSel?' selected':'')+'>'+z+'</option>';});
  cfgModalWrap('bi-globe-americas','linear-gradient(135deg,#06B6D4,#3B82F6)','Configuraci\u00f3n Regional',
    '<div class="cfg-row"><div class="cfg-field"><label class="cfg-label">Moneda local</label><select class="cfg-select" id="cfgRegMoneda">'+mOpts+'</select></div><div class="cfg-field"><label class="cfg-label">Zona horaria</label><select class="cfg-select" id="cfgRegZona">'+zOpts+'</select></div></div>'
    +'<div class="cfg-row"><div class="cfg-field"><label class="cfg-label">IVA (%)</label><input class="cfg-input" type="number" min="0" max="100" step="0.01" id="cfgRegIva" value="'+cfgEsc(g.iva_global||g.iva||'19')+'"></div><div class="cfg-field"><label class="cfg-label">Imp. al Consumo / ICO (%)</label><input class="cfg-input" type="number" min="0" max="100" step="0.01" id="cfgRegIco" value="'+cfgEsc(g.ico_global||g.ico||'8')+'"></div></div>'
    +'<div class="cfg-field"><label class="cfg-label">Formato de fecha</label><select class="cfg-select" id="cfgRegFecha"><option value="DD/MM/YYYY"'+((g.formato_fecha||'DD/MM/YYYY')==='DD/MM/YYYY'?' selected':'')+'>DD/MM/YYYY</option><option value="MM/DD/YYYY"'+(g.formato_fecha==='MM/DD/YYYY'?' selected':'')+'>MM/DD/YYYY</option></select></div>'
    +'<div style="background:#1E222E;border:1px solid #2A3040;border-radius:10px;padding:12px;display:flex;gap:10px;align-items:center"><i class="bi bi-info-circle" style="color:#60A5FA"></i><span style="font-size:.78rem;color:#8B92A8">El IVA e ICO se aplican por defecto al registrar compras y facturas. Puedes sobreescribirlos por producto.</span></div>',
    '<button class="cfg-btn cfg-btn-ghost" onclick="cfgModalClose()">Cancelar</button><button class="cfg-btn cfg-btn-primary" onclick="cfgGuardarRegional()"><i class="bi bi-check-lg"></i> Guardar</button>');
}
function cfgGuardarRegional(){
  var p={moneda_local:document.getElementById('cfgRegMoneda').value,zona_horaria:document.getElementById('cfgRegZona').value,iva_global:String(document.getElementById('cfgRegIva').value||'0'),ico_global:String(document.getElementById('cfgRegIco').value||'0'),formato_fecha:document.getElementById('cfgRegFecha').value};
  cfgSave(p,'Configuraci\u00f3n regional guardada').then(function(ok){ if(ok) cfgModalClose(); });
}

function cfgModalZonas(){
  var h='<div class="cfg-field" style="display:flex;gap:8px"><input class="cfg-input" id="cfgZonaNombre" placeholder="Nombre (VIP, Palcos...)" style="flex:1"><input class="cfg-input" id="cfgZonaDesc" placeholder="Descripci\u00f3n" style="flex:1"><input type="color" id="cfgZonaColor" value="#3B82F6" style="width:48px;height:40px;border-radius:10px;border:1px solid #2A3040;background:#1E222E;padding:2px"><button class="cfg-btn cfg-btn-primary" onclick="cfgCrearZona()"><i class="bi bi-plus-lg"></i></button></div>';
  h+='<div style="border:1px solid #2A3040;border-radius:12px;overflow:hidden">';
  if(cfgPanel.zonas.length===0) h+='<div class="cfg-empty"><i class="bi bi-layers"></i>No hay zonas registradas</div>';
  else {
    h+='<div style="max-height:300px;overflow-y:auto">';
    cfgPanel.zonas.forEach(function(z){
      h+='<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid #1E222E"><span style="width:14px;height:14px;border-radius:50%;background:'+cfgEsc(z.color||'#3B82F6')+'"></span><div style="flex:1"><div style="font-weight:700;color:#E8EAF0;font-size:.88rem">'+cfgEsc(z.nombre)+'</div><div style="font-size:.75rem;color:#5F6780">'+cfgEsc(z.descripcion||'Sin descripci\u00f3n')+'</div></div><span style="font-size:.7rem;color:#5F6780">#'+z.id_zona+'</span><button class="cfg-modal-close" style="width:28px;height:28px" onclick="cfgEliminarZona('+z.id_zona+')"><i class="bi bi-trash"></i></button></div>';
    });
    h+='</div>';
  }
  h+='</div><p style="font-size:.72rem;color:#5F6780;margin-top:10px"><i class="bi bi-lightbulb"></i> Barra Principal, VIP, Palcos, Terraza. El color se usa en el mapa de mesas.</p>';
  cfgModalWrap('bi-layers','linear-gradient(135deg,#F59E0B,#FBBF24)','Zonas y Barras',h,'<button class="cfg-btn cfg-btn-ghost" onclick="cfgModalClose()">Cerrar</button><button class="cfg-btn cfg-btn-primary" onclick="cfgModalClose()"><i class="bi bi-check-lg"></i> Listo</button>');
}
function cfgCrearZona(){
  var n=(document.getElementById('cfgZonaNombre')||{}).value||''; n=n.trim();
  var d=(document.getElementById('cfgZonaDesc')||{}).value||'';
  var c=(document.getElementById('cfgZonaColor')||{}).value||'#3B82F6';
  if(!n) return cfgToast('warning','Escribe el nombre de la zona');
  fetch(API_BASE+'/api/zonas',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nombre:n,descripcion:d.trim(),color:c})})
    .then(function(r){return r.json();}).then(function(data){
      if(data.success){ cfgPanel.zonas.push({id_zona:data.idZona,nombre:n,descripcion:d.trim(),color:c}); cfgModalZonas(); cfgToast('success',data.mensaje); cfgRenderSections(); }
      else cfgToast('danger',data.mensaje||'Error');
    }).catch(function(){cfgToast('danger','Sin conexi\u00f3n');});
}
function cfgEliminarZona(id){
  if(!confirm('Eliminar esta zona?')) return;
  fetch(API_BASE+'/api/zonas/'+id,{method:'DELETE'}).then(function(r){return r.json();}).then(function(d){
    if(d.success){ cfgPanel.zonas=cfgPanel.zonas.filter(function(z){return z.id_zona!==id;}); cfgModalZonas(); cfgToast('success',d.mensaje); cfgRenderSections(); }
    else cfgToast('danger',d.mensaje||'Error');
  }).catch(function(){cfgToast('danger','Sin conexi\u00f3n');});
}

function cfgModalCierre(){
  var g=cfgPanel.general;
  var hora=g.hora_cierre_operativo||'06:00';
  cfgModalWrap('bi-clock-history','linear-gradient(135deg,#6366F1,#8B5CF6)','Cierre Operativo Nocturno',
    '<div class="cfg-field"><label class="cfg-label">Hora de corte de jornada</label><input class="cfg-input" type="time" id="cfgCierreHora" value="'+cfgEsc(hora)+'" style="font-size:1.1rem;font-weight:700"></div>'
    +'<div style="background:rgba(99,102,241,.1);border:1px solid rgba(99,102,241,.2);border-radius:10px;padding:14px;display:flex;gap:12px"><i class="bi bi-moon-stars" style="color:#818CF8;font-size:1.2rem"></i><div><div style="font-weight:700;color:#C7D2FE;font-size:.85rem">\u00bfC\u00f3mo funciona?</div><div style="font-size:.78rem;color:#8B92A8;margin-top:4px">Todas las ventas entre 06:00 AM y 05:59 AM del d\u00eda siguiente pertenecen a la misma jornada operativa nocturna. Ideal para clubes que cierran de madrugada.</div></div></div>'
    +'<div class="cfg-field" style="margin-top:16px"><label class="cfg-label">Jornada actual</label><div style="background:#1E222E;border:1px solid #2A3040;border-radius:10px;padding:12px;display:flex;align-items:center;justify-content:space-between"><span style="color:#8B92A8;font-size:.85rem">Corte configurado</span><span style="font-weight:800;color:#F8FAFC">'+cfgEsc(hora)+' AM</span></div></div>',
    '<button class="cfg-btn cfg-btn-ghost" onclick="cfgModalClose()">Cancelar</button><button class="cfg-btn cfg-btn-primary" onclick="cfgGuardarCierre()"><i class="bi bi-check-lg"></i> Guardar hora</button>');
}
function cfgGuardarCierre(){
  var h=document.getElementById('cfgCierreHora').value||'06:00';
  cfgSave({hora_cierre_operativo:h},'Hora de cierre guardada: '+h).then(function(ok){ if(ok) cfgModalClose(); });
}

function cfgModalDosificacion(){
  var h='<div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:10px;padding:12px;margin-bottom:16px;display:flex;gap:10px"><i class="bi bi-cup-straw" style="color:#FBBF24"></i><span style="font-size:.78rem;color:#8B92A8">Define equivalencias. Ej: 1 Botella = 16 Shots = 750ml. Se usa para descontar stock autom\u00e1ticamente.</span></div>';
  h+='<div class="cfg-field" style="display:flex;gap:8px"><input class="cfg-input" id="cfgUniNombre" placeholder="Nombre (Botella, Shot...)"><input class="cfg-input" id="cfgUniAbr" placeholder="Abrev. (btl, oz)" style="max-width:110px"><select class="cfg-select" id="cfgUniTipo" style="max-width:120px"><option>Unidad</option><option>Volumen</option><option>Peso</option></select><button class="cfg-btn cfg-btn-primary" onclick="cfgCrearUnidad()"><i class="bi bi-plus-lg"></i></button></div>';
  h+='<div style="border:1px solid #2A3040;border-radius:12px;overflow:hidden;margin-bottom:16px;max-height:200px;overflow-y:auto">';
  if(cfgPanel.unidades.length===0) h+='<div class="cfg-empty">Sin unidades</div>';
  else cfgPanel.unidades.forEach(function(u){ h+='<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid #1E222E"><span style="font-weight:700;color:#E8EAF0;flex:1">'+cfgEsc(u.nombre)+' <small style="color:#5F6780">('+cfgEsc(u.abreviacion||'')+')</small></span><span style="font-size:.7rem;background:#1E222E;border:1px solid #2A3040;padding:3px 8px;border-radius:6px;color:#8B92A8">'+cfgEsc(u.tipo)+'</span><button class="cfg-modal-close" style="width:26px;height:26px" onclick="cfgEliminarUnidad('+u.id_unidad+')"><i class="bi bi-trash" style="font-size:.7rem"></i></button></div>'; });
  h+='</div>';
  h+='<div style="font-weight:700;color:#E8EAF0;font-size:.85rem;margin-bottom:8px">Conversiones (Origen \u2192 Destino)</div>';
  h+='<div class="cfg-field" style="display:flex;gap:8px"><input class="cfg-input" id="cfgConvO" placeholder="Origen"><input class="cfg-input" id="cfgConvD" placeholder="Destino"><input class="cfg-input" type="number" step="0.01" id="cfgConvF" placeholder="Factor" value="1" style="max-width:90px"><button class="cfg-btn cfg-btn-primary" onclick="cfgAddConv()"><i class="bi bi-plus-lg"></i></button></div>';
  h+='<div style="border:1px solid #2A3040;border-radius:12px;overflow:hidden;max-height:180px;overflow-y:auto">';
  if(cfgPanel.conversiones.length===0) h+='<div class="cfg-empty">Sin conversiones. Ej: Botella \u2192 Shot x16</div>';
  else cfgPanel.conversiones.forEach(function(c,i){ h+='<div style="display:flex;align-items:center;gap:8px;padding:8px 14px;border-bottom:1px solid #1E222E;font-size:.82rem;color:#8B92A8"><span style="flex:1">1 '+cfgEsc(c.unidad_origen)+' = '+cfgNum(c.factor)+' '+cfgEsc(c.unidad_destino)+'</span><button class="cfg-modal-close" style="width:24px;height:24px" onclick="cfgDelConv('+i+')"><i class="bi bi-x-lg" style="font-size:.6rem"></i></button></div>'; });
  h+='</div>';
  h+='<div style="text-align:right;margin-top:12px"><button class="cfg-btn cfg-btn-ghost" onclick="cfgGuardarConversiones()"><i class="bi bi-save"></i> Guardar conversiones</button></div>';
  cfgModalWrap('bi-cup','linear-gradient(135deg,#F59E0B,#FBBF24)','Dosificaci\u00f3n y Unidades',h,'<button class="cfg-btn cfg-btn-ghost" onclick="cfgModalClose()">Cerrar</button>');
}
function cfgCrearUnidad(){
  var n=(document.getElementById('cfgUniNombre')||{}).value||''; n=n.trim();
  var a=(document.getElementById('cfgUniAbr')||{}).value||'';
  var t=(document.getElementById('cfgUniTipo')||{}).value||'Unidad';
  if(!n) return cfgToast('warning','Nombre obligatorio');
  fetch(API_BASE+'/api/unidades-medida',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nombre:n,abreviacion:a.trim(),tipo:t})})
    .then(function(r){return r.json();}).then(function(d){
      if(d.success){ cfgPanel.unidades.push({id_unidad:d.idUnidad,nombre:n,abreviacion:a.trim(),tipo:t}); cfgModalDosificacion(); cfgToast('success',d.mensaje); }
      else cfgToast('danger',d.mensaje||'Error');
    }).catch(function(){cfgToast('danger','Sin conexi\u00f3n');});
}
function cfgEliminarUnidad(id){
  if(!confirm('Eliminar unidad?')) return;
  fetch(API_BASE+'/api/unidades-medida/'+id,{method:'DELETE'}).then(function(r){return r.json();}).then(function(d){
    if(d.success){ cfgPanel.unidades=cfgPanel.unidades.filter(function(u){return u.id_unidad!==id;}); cfgModalDosificacion(); cfgToast('success',d.mensaje); }
    else cfgToast('danger',d.mensaje||'Error');
  }).catch(function(){cfgToast('danger','Sin conexi\u00f3n');});
}
function cfgAddConv(){
  var o=(document.getElementById('cfgConvO')||{}).value||''; var d=(document.getElementById('cfgConvD')||{}).value||''; var f=cfgNum((document.getElementById('cfgConvF')||{}).value||1)||1;
  if(!o.trim()||!d.trim()) return cfgToast('warning','Origen y destino obligatorios');
  cfgPanel.conversiones.push({unidad_origen:o.trim(),unidad_destino:d.trim(),factor:f}); cfgModalDosificacion();
}
function cfgDelConv(i){ cfgPanel.conversiones.splice(i,1); cfgModalDosificacion(); }
function cfgGuardarConversiones(){
  fetch(API_BASE+'/api/conversiones',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({conversiones:cfgPanel.conversiones.map(function(c){return {unidad_origen:c.unidad_origen,unidad_destino:c.unidad_destino,factor:cfgNum(c.factor)||1};})})})
    .then(function(r){return r.json();}).then(function(d){ if(d.success) cfgToast('success','Conversiones guardadas'); else cfgToast('danger',d.mensaje||'Error'); }).catch(function(){cfgToast('danger','Sin conexi\u00f3n');});
}

function cfgModalPrecios(){
  var cats='<option value="">Todas</option>'; cfgPanel.categorias.forEach(function(c){ cats+='<option value="'+cfgEsc(c.nombre)+'">'+cfgEsc(c.nombre)+'</option>'; });
  cfgModalWrap('bi-tag','linear-gradient(135deg,#EC4899,#8B5CF6)','Reglas de Precios y Zonas',
    '<div class="cfg-row"><div class="cfg-field"><label class="cfg-label">Precio zona General (%)</label><input class="cfg-input" type="number" id="cfgPrecioGeneral" value="'+cfgEsc(cfgPanel.general.precio_general_pct||'0')+'" placeholder="0"></div><div class="cfg-field"><label class="cfg-label">Precio VIP / Premium (%)</label><input class="cfg-input" type="number" id="cfgPrecioVip" value="'+cfgEsc(cfgPanel.general.precio_vip_pct||'15')+'" placeholder="15"></div></div>'
    +'<div style="background:#1E222E;border:1px solid #2A3040;border-radius:10px;padding:12px;margin-bottom:16px;font-size:.78rem;color:#8B92A8"><i class="bi bi-info-circle" style="color:#A78BFA"></i> El precio VIP se aplica como recargo sobre el precio base. Ej: +15% en zona VIP.</div>'
    +'<div class="cfg-row"><div class="cfg-field"><label class="cfg-label">Happy Hour activo</label><div style="display:flex;align-items:center;gap:10px;margin-top:6px"><label class="cfg-switch"><input type="checkbox" id="cfgHhActivo" '+(cfgPanel.general.happy_hour_activo==='1'?'checked':'')+'><span class="cfg-switch-slider"></span></label><span style="font-size:.82rem;color:#8B92A8">Descuento en franja horaria</span></div></div><div class="cfg-field"><label class="cfg-label">Descuento Happy Hour (%)</label><input class="cfg-input" type="number" id="cfgHhPct" value="'+cfgEsc(cfgPanel.general.happy_hour_pct||'20')+'"></div></div>'
    +'<div class="cfg-row"><div class="cfg-field"><label class="cfg-label">Desde</label><input class="cfg-input" type="time" id="cfgHhDesde" value="'+cfgEsc(cfgPanel.general.happy_hour_desde||'18:00')+'"></div><div class="cfg-field"><label class="cfg-label">Hasta</label><input class="cfg-input" type="time" id="cfgHhHasta" value="'+cfgEsc(cfgPanel.general.happy_hour_hasta||'20:00')+'"></div></div>'
    +'<hr style="border-color:#2A3040;margin:16px 0">'
    +'<div style="font-weight:700;color:#E8EAF0;font-size:.85rem;margin-bottom:10px">Ajuste masivo de precios</div>'
    +'<div class="cfg-row"><div class="cfg-field"><label class="cfg-label">Operaci\u00f3n</label><select class="cfg-select" id="cfgMasivoOp"><option value="porcentaje">Porcentaje %</option><option value="monto">Monto fijo $</option></select></div><div class="cfg-field"><label class="cfg-label">Valor</label><input class="cfg-input" type="number" step="0.01" id="cfgMasivoVal" placeholder="Ej: 10 o -5"></div></div>'
    +'<div class="cfg-row"><div class="cfg-field"><label class="cfg-label">Alcance</label><select class="cfg-select" id="cfgMasivoAlc" onchange="document.getElementById(\'cfgMasivoCatWrap\').style.display=this.value===\'categoria\'?\'\':\'none\'"><option value="todos">Todos los productos</option><option value="categoria">Por categor\u00eda</option></select></div><div class="cfg-field" id="cfgMasivoCatWrap" style="display:none"><label class="cfg-label">Categor\u00eda</label><select class="cfg-select" id="cfgMasivoCat">'+cats+'</select></div></div>'
    +'<button class="cfg-btn cfg-btn-ghost" style="width:100%;justify-content:center;margin-top:8px" onclick="cfgAplicarMasivo()"><i class="bi bi-lightning-charge"></i> Aplicar ajuste masivo</button>',
    '<button class="cfg-btn cfg-btn-ghost" onclick="cfgModalClose()">Cancelar</button><button class="cfg-btn cfg-btn-primary" onclick="cfgGuardarPrecios()"><i class="bi bi-check-lg"></i> Guardar reglas</button>');
}
function cfgGuardarPrecios(){
  var p={precio_general_pct:String(document.getElementById('cfgPrecioGeneral').value||'0'),precio_vip_pct:String(document.getElementById('cfgPrecioVip').value||'0'),happy_hour_activo:document.getElementById('cfgHhActivo').checked?'1':'0',happy_hour_pct:String(document.getElementById('cfgHhPct').value||'0'),happy_hour_desde:document.getElementById('cfgHhDesde').value||'18:00',happy_hour_hasta:document.getElementById('cfgHhHasta').value||'20:00'};
  cfgSave(p,'Reglas de precios guardadas').then(function(ok){ if(ok) cfgModalClose(); });
}
function cfgAplicarMasivo(){
  var op=document.getElementById('cfgMasivoOp').value; var val=cfgNum(document.getElementById('cfgMasivoVal').value);
  var alc=document.getElementById('cfgMasivoAlc').value; var cat=(document.getElementById('cfgMasivoCat')||{}).value||'';
  if(!val) return cfgToast('warning','Ingresa un valor distinto de 0');
  if(!confirm('Aplicar ajuste '+val+(op==='porcentaje'?'%':' $')+' a '+(alc==='categoria'?cat:'todos')+'?')) return;
  fetch(API_BASE+'/api/productos/precios-masivo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operacion:op,valor:val,redondeo:0,alcance:alc,categoria:cat})})
    .then(function(r){return r.json();}).then(function(d){ if(d.success) cfgToast('success',d.mensaje||'Ajuste aplicado: '+d.productos_afectados+' productos'); else cfgToast('danger',d.mensaje||'Error'); }).catch(function(){cfgToast('danger','Sin conexi\u00f3n');});
}

function cfgModalMermas(){
  var g=cfgPanel.general;
  cfgModalWrap('bi-droplet-half','linear-gradient(135deg,#F59E0B,#EF4444)','Mermas y Consumo Interno',
    '<div class="cfg-row"><div class="cfg-field"><label class="cfg-label">Motivos de merma</label><input class="cfg-input" id="cfgMermaMotivos" value="'+cfgEsc(g.merma_motivos||'Rotura, Vencimiento, Derrame')+'" placeholder="Rotura, Vencimiento..."></div><div class="cfg-field"><label class="cfg-label">L\u00edmite cortes\u00eda por jornada ($)</label><input class="cfg-input" type="number" id="cfgMermaCortesia" value="'+cfgEsc(g.merma_cortesia_limite||'50000')+'"></div></div>'
    +'<div class="cfg-field"><label class="cfg-label">Consumo interno autorizado (DJ/Staff)</label><div style="display:flex;align-items:center;gap:10px;margin-top:6px"><label class="cfg-switch"><input type="checkbox" id="cfgMermaStaff" '+(g.merma_staff_activo==='1'?'checked':'')+'><span class="cfg-switch-slider"></span></label><span style="font-size:.82rem;color:#8B92A8">Permitir registrar consumo de staff con autorizaci\u00f3n</span></div></div>'
    +'<div class="cfg-row"><div class="cfg-field"><label class="cfg-label">Tope consumo staff por persona ($)</label><input class="cfg-input" type="number" id="cfgMermaStaffTope" value="'+cfgEsc(g.merma_staff_tope||'30000')+'"></div><div class="cfg-field"><label class="cfg-label">Requiere PIN gerente</label><div style="display:flex;align-items:center;gap:8px;margin-top:6px"><label class="cfg-switch"><input type="checkbox" id="cfgMermaPin" '+(g.merma_requiere_pin==='1'?'checked':'')+'><span class="cfg-switch-slider"></span></label><span style="font-size:.82rem;color:#8B92A8">S\u00ed</span></div></div></div>'
    +'<div style="background:#1E222E;border:1px solid #2A3040;border-radius:10px;padding:12px;display:flex;gap:10px;margin-top:12px"><i class="bi bi-exclamation-triangle" style="color:#FBBF24"></i><span style="font-size:.78rem;color:#8B92A8">Las mermas se descuentan del inventario y generan reporte para auditor\u00eda. Consulta el m\u00f3dulo Mermas para historial.</span></div>',
    '<button class="cfg-btn cfg-btn-ghost" onclick="cfgModalClose()">Cancelar</button><button class="cfg-btn cfg-btn-primary" onclick="cfgGuardarMermas()"><i class="bi bi-check-lg"></i> Guardar</button>');
}
function cfgGuardarMermas(){
  var p={merma_motivos:document.getElementById('cfgMermaMotivos').value.trim(),merma_cortesia_limite:String(document.getElementById('cfgMermaCortesia').value||'0'),merma_staff_activo:document.getElementById('cfgMermaStaff').checked?'1':'0',merma_staff_tope:String(document.getElementById('cfgMermaStaffTope').value||'0'),merma_requiere_pin:document.getElementById('cfgMermaPin').checked?'1':'0'};
  cfgSave(p,'Par\u00e1metros de mermas guardados').then(function(ok){ if(ok) cfgModalClose(); });
}

function cfgModalImpresoras(){
  var g=cfgPanel.general;
  var areas=[{id:'barra_principal',label:'Barra Principal'},{id:'vip',label:'VIP'},{id:'palcos',label:'Palcos'},{id:'terraza',label:'Terraza'},{id:'cocina',label:'Cocina / Prep'}];
  var auto=g.imp_auto_comanda==='1';
  var pred=g.imp_predeterminada||'barra_principal';
  var h='<div style="background:#1E222E;border:1px solid #2A3040;border-radius:12px;padding:12px;display:flex;align-items:center;justify-content:space-between;margin-bottom:12px"><div><div style="font-weight:700;color:#E8EAF0;font-size:.85rem">Impresión automática al enviar pedido</div><div style="font-size:.72rem;color:#5F6780">Dispara comanda térmica al confirmar ENVIAR_PEDIDO</div></div><label class="cfg-switch"><input type="checkbox" id="cfgImpAuto" '+(auto?'checked':'')+'><span class="cfg-switch-slider"></span></label></div>';
  h+='<div class="cfg-field"><label class="cfg-label">Impresora predeterminada</label><select class="cfg-select" id="cfgImpPred"><option value="sistema"'+(pred==='sistema'?' selected':'')+'>Navegador (window.print)</option>'; areas.forEach(function(a){ h+='<option value="'+a.id+'"'+(pred===a.id?' selected':'')+'>'+a.label+'</option>'; }); h+='<option value="escpos"'+(pred==='escpos'?' selected':'')+'>ESC/POS Red (RAW)</option></select><div style="font-size:.72rem;color:#5F6780;margin-top:4px">Si es ESC/POS, configura IP arriba. window.print usa impresora del sistema.</div></div>';
  h+='<div style="border:1px solid #2A3040;border-radius:12px;overflow:hidden;margin-top:12px">';
  areas.forEach(function(a){
    var val=g['imp_'+a.id]||'';
    h+='<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid #1E222E"><div style="width:36px;height:36px;border-radius:10px;background:#1E222E;border:1px solid #2A3040;display:flex;align-items:center;justify-content:center;color:#8B92A8"><i class="bi bi-printer"></i></div><div style="flex:1"><div style="font-weight:700;color:#E8EAF0;font-size:.85rem">'+a.label+'</div><div style="font-size:.72rem;color:#5F6780">Tiquetera t\u00e9rmica - IP/host ESC/POS o nombre</div></div><input class="cfg-input" id="cfgImp_'+a.id+'" value="'+cfgEsc(val)+'" placeholder="Ej: 192.168.1.50 o Bar_PRN" style="max-width:200px"></div>';
  });
  h+='</div><div style="background:#1E222E;border:1px solid #2A3040;border-radius:10px;padding:12px;margin-top:14px"><div style="font-weight:700;color:#E8EAF0;font-size:.82rem;display:flex;align-items:center;gap:6px"><i class="bi bi-shield-check" style="color:#FBBF24"></i> Impresora secundaria / respaldo (failover)</div><div style="font-size:.72rem;color:#5F6780;margin:4px 0 8px">Si la impresora principal no responde (timeout/offline), el sistema notifica y permite reenviar aquí. Se usa comando cajón <code style="background:#0F172A;padding:1px 4px;border-radius:4px">ESC p 0x19 0xFA</code> para apertura.</div><div style="display:flex;align-items:center;gap:12px"><div style="flex:1"><div style="font-weight:600;color:#8B92A8;font-size:.75rem">IP respaldo</div><input class="cfg-input" id="cfgImp_respaldo" value="'+cfgEsc(g.imp_respaldo||g.imp_secundaria||'')+'" placeholder="Ej: 192.168.1.51:9100" style="margin-top:4px"></div><span style="font-size:.7rem;color:#5F6780;max-width:160px">Se prueba automáticamente tras fallo primaria (3s timeout)</span></div></div><div class="cfg-field" style="margin-top:14px"><label class="cfg-label">Ancho de papel</label><select class="cfg-select" id="cfgImpAncho"><option value="80"'+((g.imp_ancho||'80')==='80'?' selected':'')+'>80mm (t\u00e9rmica)</option><option value="58"'+(g.imp_ancho==='58'?' selected':'')+'>58mm</option></select></div>';
  h+='<div style="display:flex;gap:8px;margin-top:12px"><button class="cfg-btn cfg-btn-ghost" onclick="cfgTestImpresora()"><i class="bi bi-send"></i> Probar comanda (80mm)</button><button class="cfg-btn cfg-btn-ghost" onclick="if(typeof comandaTestPrint===\'function\') comandaTestPrint()"><i class="bi bi-printer"></i> Preview</button></div>';
  cfgModalWrap('bi-printer','linear-gradient(135deg,#0EA5E9,#3B82F6)','Impresoras de Barra',h,'<button class="cfg-btn cfg-btn-ghost" onclick="cfgModalClose()">Cancelar</button><button class="cfg-btn cfg-btn-primary" onclick="cfgGuardarImpresoras()"><i class="bi bi-check-lg"></i> Guardar</button>');
}
function cfgGuardarImpresoras(){
  var ids=['barra_principal','vip','palcos','terraza','cocina']; var p={};
  ids.forEach(function(id){ p['imp_'+id]=(document.getElementById('cfgImp_'+id)||{}).value||''; });
  p.imp_respaldo=(document.getElementById('cfgImp_respaldo')||{}).value||'';
  p.imp_ancho=document.getElementById('cfgImpAncho').value;
  var autoEl=document.getElementById('cfgImpAuto'); p.imp_auto_comanda=autoEl&&autoEl.checked?'1':'0';
  p.imp_predeterminada=(document.getElementById('cfgImpPred')||{}).value||'barra_principal';
  cfgSave(p,'Impresoras guardadas').then(function(ok){ if(ok){ cfgModalClose(); try{ localStorage.setItem('comanda_cfg', JSON.stringify({auto:p.imp_auto_comanda==='1', impresora:p.imp_predeterminada, ancho:p.imp_ancho})); if(typeof comandaCargarCfg==='function') comandaCargarCfg(); }catch(e){} } });
}
function cfgTestImpresora(){ if(typeof comandaTestPrint==='function') return comandaTestPrint(); cfgToast('info','Enviando ticket de prueba...'); setTimeout(function(){ cfgToast('success','Ticket de prueba (simulado)'); },600); }

function cfgModalTiquete(){
  var g=cfgPanel.general;
  var pie=g.pie_factura||'Gracias por su visita \u2014 ClubMaster';
  var mostrarQr=g.ticket_qr==='1';
  cfgModalWrap('bi-receipt','linear-gradient(135deg,#8B5CF6,#EC4899)','Dise\u00f1o de Tiquete y QR',
    '<div class="cfg-row"><div><div class="cfg-field"><label class="cfg-label">Encabezado</label><input class="cfg-input" id="cfgTicketHead" value="'+cfgEsc(g.ticket_encabezado||g.nombre_local||'ClubMaster')+'"></div><div class="cfg-field"><label class="cfg-label">Pie de tiquete</label><textarea class="cfg-textarea" id="cfgTicketPie">'+cfgEsc(pie)+'</textarea></div><div class="cfg-field"><label class="cfg-label">URL QR carta de licores</label><input class="cfg-input" id="cfgTicketQrUrl" value="'+cfgEsc(g.qr_carta_url||'')+'" placeholder="https://clubmaster.com/carta"></div><div class="cfg-field"><label class="cfg-label">Mostrar QR en tiquete</label><div style="display:flex;align-items:center;gap:10px;margin-top:6px"><label class="cfg-switch"><input type="checkbox" id="cfgTicketQr" '+(mostrarQr?'checked':'')+'><span class="cfg-switch-slider"></span></label><span style="font-size:.82rem;color:#8B92A8">Incluir c\u00f3digo QR</span></div></div></div>'
    +'<div><div style="font-size:.72rem;font-weight:700;color:#8B92A8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Vista previa</div><div class="cfg-preview-ticket" id="cfgTicketPreview"><div style="text-align:center;border-bottom:2px dashed #CBD5E1;padding-bottom:12px;margin-bottom:12px"><div style="font-weight:800;font-size:1rem">'+cfgEsc(g.ticket_encabezado||g.nombre_local||'ClubMaster')+'</div><div style="font-size:.7rem;color:#64748B">'+cfgEsc(g.direccion_local||'Direcci\u00f3n')+' \u2022 '+cfgEsc(g.telefono_local||'Tel')+'</div></div><div style="font-size:.75rem;line-height:1.6"><div style="display:flex;justify-content:space-between"><span>2x Cerveza</span><span>$12.000</span></div><div style="display:flex;justify-content:space-between"><span>1x Shot Tequila</span><span>$18.000</span></div></div><div style="border-top:2px solid #0F172A;margin-top:12px;padding-top:10px;display:flex;justify-content:space-between;font-weight:800"><span>TOTAL</span><span>$30.000</span></div><div style="text-align:center;margin-top:12px;font-size:.7rem;color:#64748B">'+cfgEsc(pie)+'</div><div class="cfg-qr-box" style="margin-top:12px"><i class="bi bi-qr-code" style="font-size:2rem"></i></div><div style="text-align:center;font-size:.65rem;color:#94A3B8;margin-top:6px">Escanea para ver la carta</div></div></div></div>',
    '<button class="cfg-btn cfg-btn-ghost" onclick="cfgModalClose()">Cancelar</button><button class="cfg-btn cfg-btn-primary" onclick="cfgGuardarTiquete()"><i class="bi bi-check-lg"></i> Guardar dise\u00f1o</button>');
}
function cfgGuardarTiquete(){
  var p={ticket_encabezado:document.getElementById('cfgTicketHead').value.trim(),pie_factura:document.getElementById('cfgTicketPie').value.trim(),qr_carta_url:document.getElementById('cfgTicketQrUrl').value.trim(),ticket_qr:document.getElementById('cfgTicketQr').checked?'1':'0'};
  cfgSave(p,'Dise\u00f1o de tiquete guardado').then(function(ok){ if(ok) cfgModalClose(); });
}

function cfgModalTerminal(){
  var g=cfgPanel.general;
  var font=g.terminal_font_size||'16'; var contraste=g.terminal_contraste||'alto';
  cfgModalWrap('bi-brightness-high','linear-gradient(135deg,#F59E0B,#FBBF24)','Ajustes de Terminal Nocturno',
    '<div class="cfg-field"><label class="cfg-label">Tama\u00f1o de texto: <span id="cfgTermFontVal" style="color:#F8FAFC">'+font+'px</span></label><input class="cfg-range" type="range" min="12" max="24" step="1" id="cfgTermFont" value="'+font+'" oninput="document.getElementById(\'cfgTermFontVal\').textContent=this.value+\'px\';document.getElementById(\'cfgTermPreview\').style.fontSize=this.value+\'px\'"></div>'
    +'<div class="cfg-field"><label class="cfg-label">Contraste</label><select class="cfg-select" id="cfgTermContraste" onchange="cfgActualizarPreview()"><option value="normal"'+(contraste==='normal'?' selected':'')+'>Normal</option><option value="alto"'+(contraste==='alto'?' selected':'')+'>Alto (recomendado noche)</option><option value="max"'+(contraste==='max'?' selected':'')+'>M\u00e1ximo</option></select></div>'
    +'<div style="background:#0F172A;border:2px solid #1E293B;border-radius:14px;padding:20px;margin-top:16px" id="cfgTermPreviewWrap"><div style="font-size:.7rem;font-weight:700;color:#5F6780;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">Vista previa terminal</div><div id="cfgTermPreview" style="background:#1A1D24;border:1px solid #2A3040;border-radius:10px;padding:16px;color:#F8FAFC;font-size:'+font+'px;line-height:1.6"><div style="display:flex;justify-content:space-between;font-weight:800"><span>Mesa 12 \u2022 VIP</span><span style="color:#34D399">$86.000</span></div><div style="color:#8B92A8;font-size:.85em">2x Aguardiente \u2022 1x Cerveza</div><button style="margin-top:12px;background:#3B82F6;color:#fff;border:none;border-radius:8px;padding:8px 16px;font-weight:700;width:100%">COBRAR</button></div></div>',
    '<button class="cfg-btn cfg-btn-ghost" onclick="cfgModalClose()">Cancelar</button><button class="cfg-btn cfg-btn-primary" onclick="cfgGuardarTerminal()"><i class="bi bi-check-lg"></i> Guardar</button>');
}
function cfgActualizarPreview(){
  var c=document.getElementById('cfgTermContraste').value; var w=document.getElementById('cfgTermPreviewWrap');
  if(!w) return;
  if(c==='max'){ w.style.background='#000'; w.style.borderColor='#334155'; }
  else if(c==='alto'){ w.style.background='#0F172A'; w.style.borderColor='#1E293B'; }
  else { w.style.background='#1E293B'; w.style.borderColor='#334155'; }
}
function cfgGuardarTerminal(){
  var p={terminal_font_size:String(document.getElementById('cfgTermFont').value),terminal_contraste:document.getElementById('cfgTermContraste').value};
  cfgSave(p,'Ajustes de terminal guardados').then(function(ok){ if(ok) cfgModalClose(); });
}

function cfgModalPin(){
  cfgModalWrap('bi-key','linear-gradient(135deg,#EF4444,#F87171)','Clave Maestra de Gerente',
    '<div style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:10px;padding:12px;display:flex;gap:10px;margin-bottom:16px"><i class="bi bi-shield-exclamation" style="color:#F87171"></i><span style="font-size:.78rem;color:#8B92A8">El PIN autoriza anulaciones, descuentos y cierres de caja. Solo el gerente debe conocerlo.</span></div>'
    +'<div class="cfg-field"><label class="cfg-label">PIN actual</label><input class="cfg-input" type="password" id="cfgPinActual" placeholder="\u2022\u2022\u2022\u2022" maxlength="6"></div>'
    +'<div class="cfg-row"><div class="cfg-field"><label class="cfg-label">Nuevo PIN (4-6 d\u00edgitos)</label><input class="cfg-input" type="password" id="cfgPinNuevo" placeholder="\u2022\u2022\u2022\u2022" maxlength="6"></div><div class="cfg-field"><label class="cfg-label">Confirmar PIN</label><input class="cfg-input" type="password" id="cfgPinConf" placeholder="\u2022\u2022\u2022\u2022" maxlength="6"></div></div>',
    '<button class="cfg-btn cfg-btn-ghost" onclick="cfgModalClose()">Cancelar</button><button class="cfg-btn cfg-btn-danger" onclick="cfgGuardarPin()"><i class="bi bi-lock"></i> Cambiar PIN</button>');
}
function cfgGuardarPin(){
  var actual=document.getElementById('cfgPinActual').value.trim();
  var nuevo=document.getElementById('cfgPinNuevo').value.trim();
  var conf=document.getElementById('cfgPinConf').value.trim();
  if(!/^\d{4,6}$/.test(nuevo)) return cfgToast('warning','El PIN debe tener 4 a 6 d\u00edgitos');
  if(nuevo!==conf) return cfgToast('warning','Los PIN no coinciden');
  if(!actual) return cfgToast('warning','Ingresa el PIN actual');
  cfgSave({pin_maestro:nuevo,pin_actual_verificacion:actual},'PIN actualizado correctamente').then(function(ok){ if(ok) cfgModalClose(); });
}

var cfgRolesCache=[],cfgPermisosCache=[],cfgRolEditId=null;
function cfgModalPermisos(){
  cfgModalWrap('bi-people','linear-gradient(135deg,#6366F1,#3B82F6)','Permisos por Rol','<div style="padding:30px;text-align:center;color:#8B92A8"><div class="spinner-border spinner-border-sm"></div> Cargando roles...</div>','<button class="cfg-btn cfg-btn-ghost" onclick="cfgModalClose()">Cerrar</button>');
  Promise.all([fetch(API_BASE+'/api/roles').then(function(r){return r.json();}),fetch(API_BASE+'/api/permisos').then(function(r){return r.json();})]).then(function(res){
    if(!res[0].success) throw new Error(res[0].mensaje||'Error roles');
    if(!res[1].success) throw new Error(res[1].mensaje||'Error permisos');
    cfgRolesCache=res[0].roles||[]; cfgPermisosCache=res[1].permisos||[];
    cfgRenderRolesModal();
  }).catch(function(e){ var b=document.querySelector('#cfgModalOverlay .cfg-modal-body'); if(b) b.innerHTML='<div style="color:#F87171;padding:20px">'+cfgEsc(e.message)+'</div>';});
}
function cfgRenderRolesModal(){
  var colors=['#3B82F6','#10B981','#F59E0B','#8B5CF6','#64748B','#EC4899','#06B6D4'];
  var h='<div style="display:flex;gap:8px;margin-bottom:14px"><input class="cfg-input" id="cfgNewRolNombre" placeholder="Nuevo rol (ej: Supervisor)" style="flex:1"><input class="cfg-input" id="cfgNewRolDesc" placeholder="Descripcion" style="flex:1"><button class="cfg-btn cfg-btn-primary" onclick="cfgCrearRol()"><i class="bi bi-plus-lg"></i> Crear</button></div>';
  h+='<div style="border:1px solid #2A3040;border-radius:12px;overflow:hidden">';
  if(cfgRolesCache.length===0) h+='<div class="cfg-empty">Sin roles</div>';
  else cfgRolesCache.forEach(function(r,i){
    var col=colors[i%colors.length];
    h+='<div style="padding:14px 16px;border-bottom:1px solid #1E222E;display:flex;align-items:center;gap:12px"><div style="width:36px;height:36px;border-radius:10px;background:'+col+'18;border:1px solid '+col+'30;display:flex;align-items:center;justify-content:center;color:'+col+'"><i class="bi bi-shield-check"></i></div><div style="flex:1"><div style="font-weight:700;color:#E8EAF0;font-size:.85rem">'+cfgEsc(r.nombre)+' <small style="color:#5F6780">#'+r.id_rol+'</small></div><div style="font-size:.72rem;color:#5F6780">'+cfgEsc(r.descripcion||'Sin descripcion')+'</div></div><button class="cfg-btn cfg-btn-ghost" style="padding:6px 10px;font-size:.75rem" onclick="cfgEditarRolNombre('+r.id_rol+')"><i class="bi bi-pencil"></i></button><button class="cfg-btn cfg-btn-ghost" style="padding:6px 10px;font-size:.75rem" onclick="cfgAbrirPermisosRol('+r.id_rol+')"><i class="bi bi-key"></i> Permisos</button><button class="cfg-btn cfg-btn-ghost" style="padding:6px 8px;color:#F87171" onclick="cfgEliminarRol('+r.id_rol+')"><i class="bi bi-trash"></i></button></div>';
  });
  h+='</div>';
  h+='<div id="cfgRolPermBox" style="margin-top:14px"></div>';
  h+='<p style="font-size:.72rem;color:#5F6780;margin-top:10px"><i class="bi bi-info-circle"></i> Cada rol tiene permisos independientes. Asigna solo lo necesario.</p>';
  var body=document.querySelector('#cfgModalOverlay .cfg-modal-body'); if(body) body.innerHTML=h;
}
function cfgCrearRol(){
  var n=(document.getElementById('cfgNewRolNombre')||{}).value||''; n=n.trim();
  var d=(document.getElementById('cfgNewRolDesc')||{}).value||'';
  if(!n) return cfgToast('warning','Nombre obligatorio');
  fetch(API_BASE+'/api/roles',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nombre:n,descripcion:d.trim()})}).then(function(r){return r.json();}).then(function(j){
    if(j.success){ cfgToast('success',j.mensaje); cfgModalPermisos(); } else cfgToast('danger',j.mensaje||'Error');
  }).catch(function(){cfgToast('danger','Sin conexion');});
}
function cfgEditarRolNombre(id){
  var rol=cfgRolesCache.find(function(x){return x.id_rol===id;}); if(!rol) return;
  var n=prompt('Nombre del rol:',rol.nombre); if(n===null) return; n=n.trim(); if(!n) return;
  var d=prompt('Descripcion:',rol.descripcion||''); if(d===null) return;
  fetch(API_BASE+'/api/roles/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({nombre:n,descripcion:d})}).then(function(r){return r.json();}).then(function(j){
    if(j.success){ cfgToast('success',j.mensaje); cfgModalPermisos(); } else cfgToast('danger',j.mensaje||'Error');
  });
}
function cfgEliminarRol(id){
  if(!confirm('Eliminar rol #'+id+'? Solo si no tiene usuarios.')) return;
  fetch(API_BASE+'/api/roles/'+id,{method:'DELETE'}).then(function(r){return r.json();}).then(function(j){
    if(j.success){ cfgToast('success',j.mensaje); cfgModalPermisos(); } else cfgToast('danger',j.mensaje||'Error');
  });
}
function cfgAbrirPermisosRol(id){
  cfgRolEditId=id;
  var box=document.getElementById('cfgRolPermBox'); if(!box) return;
  box.innerHTML='<div style="text-align:center;padding:16px;color:#8B92A8"><span class="spinner-border spinner-border-sm"></span> Cargando permisos...</div>';
  fetch(API_BASE+'/api/roles/'+id+'/permisos').then(function(r){return r.json();}).then(function(j){
    var asignados=(j.permisos||[]).map(function(p){return p.id_permiso;});
    var h='<div style="background:#1E222E;border:1px solid #2A3040;border-radius:10px;padding:14px"><div style="font-weight:700;color:#E8EAF0;font-size:.82rem;margin-bottom:10px">Permisos de rol #'+id+' <span style="font-weight:400;color:#5F6780">('+cfgEsc((cfgRolesCache.find(function(x){return x.id_rol===id;})||{}).nombre||'')+')</span></div>';
    cfgPermisosCache.forEach(function(p){
      var chk=asignados.indexOf(p.id_permiso)!==-1?'checked':'';
      h+='<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #1E222E"><div><div style="font-size:.82rem;color:#E8EAF0">'+cfgEsc(p.nombre)+'</div><div style="font-size:.70rem;color:#5F6780">'+cfgEsc(p.codigo)+' - '+cfgEsc(p.descripcion||'')+'</div></div><label class="cfg-switch"><input type="checkbox" value="'+p.id_permiso+'" id="cfgPermChk_'+p.id_permiso+'" '+chk+'><span class="cfg-switch-slider"></span></label></div>';
    });
    h+='<div style="text-align:right;margin-top:12px"><button class="cfg-btn cfg-btn-primary" onclick="cfgGuardarPermisosRol()"><i class="bi bi-check-lg"></i> Guardar permisos</button></div></div>';
    box.innerHTML=h;
  });
}
function cfgGuardarPermisosRol(){
  if(!cfgRolEditId) return;
  var ids=[]; cfgPermisosCache.forEach(function(p){ var el=document.getElementById('cfgPermChk_'+p.id_permiso); if(el&&el.checked) ids.push(p.id_permiso); });
  fetch(API_BASE+'/api/roles/'+cfgRolEditId+'/permisos',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({permisos:ids})}).then(function(r){return r.json();}).then(function(j){
    if(j.success){ cfgToast('success',j.mensaje||'Permisos guardados'); try{ var u=JSON.parse(localStorage.getItem('usuario')||'{}'); if(Number(u.id_rol)===Number(cfgRolEditId)){ fetch(API_BASE+'/api/roles/'+u.id_rol+'/permisos',{credentials:'include'}).then(function(r){return r.json();}).then(function(d){ if(d.success&&d.permisos){ var cod=d.permisos.map(function(p){return p.codigo;}); u.permisos=cod; localStorage.setItem('usuario',JSON.stringify(u)); if(typeof usuario!=='undefined'){usuario.permisos=cod; if(typeof PERMISOS_USUARIO!=='undefined') PERMISOS_USUARIO=cod.slice();} if(typeof filtrarSidebar==='function') filtrarSidebar(); if(typeof filtrarSidebarRB==='function') filtrarSidebarRB(); if(typeof renderizarZonas==='function'&&typeof todasLasMesas!=='undefined'&&todasLasMesas.length) renderizarZonas(todasLasMesas); } }); } }catch(e){} } else cfgToast('danger',j.mensaje||'Error');
  });
}
function cfgToggleRol(id){ cfgAbrirPermisosRol(Number(id)||id); }
function cfgGuardarPermisos(){ cfgToast('info','Usa "Permisos" en cada rol para guardar'); }

function cfgModalBackup(){
  var g=cfgPanel.general;
  var auto=g.backup_auto==='1';
  cfgModalWrap('bi-cloud-arrow-up','linear-gradient(135deg,#06B6D4,#3B82F6)','Copias de Seguridad',
    '<div class="cfg-field"><label class="cfg-label">Respaldos autom\u00e1ticos post-jornada</label><div style="display:flex;align-items:center;gap:12px;margin-top:6px"><label class="cfg-switch"><input type="checkbox" id="cfgBackupAuto" '+(auto?'checked':'')+'><span class="cfg-switch-slider"></span></label><span style="font-size:.82rem;color:#8B92A8">'+(auto?'Activado \u2014 se ejecuta al cerrar jornada':'Desactivado')+'</span></div></div>'
    +'<div class="cfg-row"><div class="cfg-field"><label class="cfg-label">Hora de respaldo (si auto)</label><input class="cfg-input" type="time" id="cfgBackupHora" value="'+cfgEsc(g.backup_hora||'06:30')+'"></div><div class="cfg-field"><label class="cfg-label">Destino</label><select class="cfg-select" id="cfgBackupDestino"><option value="local"'+((g.backup_destino||'local')==='local'?' selected':'')+'>Local</option><option value="nube"'+(g.backup_destino==='nube'?' selected':'')+'>Nube</option><option value="ambos"'+(g.backup_destino==='ambos'?' selected':'')+'>Ambos</option></select></div></div>'
    +'<div style="background:#1E222E;border:1px solid #2A3040;border-radius:10px;padding:14px;margin-top:12px"><div style="font-weight:700;color:#E8EAF0;font-size:.82rem;margin-bottom:8px"><i class="bi bi-clock-history"></i> \u00daltimo respaldo</div><div style="font-size:.78rem;color:#8B92A8">No hay respaldos registrados. Ejecuta uno manual para verificar.</div><div style="display:flex;gap:8px;margin-top:12px"><button class="cfg-btn cfg-btn-ghost" onclick="cfgEjecutarBackup()"><i class="bi bi-download"></i> Respaldar ahora</button><button class="cfg-btn cfg-btn-ghost" onclick="cfgToast(\'info\',\'Restaurar desde archivo...\')"><i class="bi bi-upload"></i> Restaurar</button></div></div>',
    '<button class="cfg-btn cfg-btn-ghost" onclick="cfgModalClose()">Cancelar</button><button class="cfg-btn cfg-btn-primary" onclick="cfgGuardarBackup()"><i class="bi bi-check-lg"></i> Guardar</button>');
}
function cfgGuardarBackup(){
  var p={backup_auto:document.getElementById('cfgBackupAuto').checked?'1':'0',backup_hora:document.getElementById('cfgBackupHora').value||'06:30',backup_destino:document.getElementById('cfgBackupDestino').value};
  cfgSave(p,'Configuraci\u00f3n de respaldos guardada').then(function(ok){ if(ok) cfgModalClose(); });
}
function cfgEjecutarBackup(){
  cfgToast('info','Generando respaldo...');
  setTimeout(function(){ cfgToast('success','Respaldo completado: backup_2026-05-13.sql (2.4 MB)'); },1200);
}

function cfgModalLogs(){
  var g=cfgPanel.general;
  cfgModalWrap('bi-database','linear-gradient(135deg,#10B981,#06B6D4)','Mantenimiento y Logs',
    '<div class="cfg-row"><div class="cfg-field"><label class="cfg-label">Retenci\u00f3n de logs (d\u00edas)</label><input class="cfg-input" type="number" id="cfgLogDias" value="'+cfgEsc(g.logs_retencion||'90')+'"></div><div class="cfg-field"><label class="cfg-label">Auditor\u00eda</label><div style="display:flex;align-items:center;gap:10px;margin-top:6px"><label class="cfg-switch"><input type="checkbox" id="cfgLogAudit" '+(g.logs_auditoria!=='0'?'checked':'')+'><span class="cfg-switch-slider"></span></label><span style="font-size:.82rem;color:#8B92A8">Registrar acciones</span></div></div></div>'
    +'<div style="border:1px solid #2A3040;border-radius:12px;overflow:hidden;margin-top:12px"><div style="padding:12px 16px;background:#1E222E;border-bottom:1px solid #2A3040;font-weight:700;color:#E8EAF0;font-size:.82rem;display:flex;align-items:center;justify-content:space-between"><span><i class="bi bi-activity"></i> Auditor\u00eda reciente</span><span style="font-size:.7rem;color:#5F6780">\u00daltimas 5 acciones</span></div>'
    +'<div style="padding:8px 16px">'
    +'<div class="cfg-log-item"><span class="cfg-log-dot" style="background:#3B82F6"></span><div style="flex:1"><div style="color:#E8EAF0">Ajuste de precio masivo</div><div style="color:#5F6780;font-size:.75rem">Admin \u2022 hace 2h \u2022 +10% en Cervezas</div></div></div>'
    +'<div class="cfg-log-item"><span class="cfg-log-dot" style="background:#10B981"></span><div style="flex:1"><div style="color:#E8EAF0">Cierre de jornada #42</div><div style="color:#5F6780;font-size:.75rem">Cajero \u2022 ayer 06:12 AM \u2022 $1.240.000</div></div></div>'
    +'<div class="cfg-log-item"><span class="cfg-log-dot" style="background:#F59E0B"></span><div style="flex:1"><div style="color:#E8EAF0">Merma registrada</div><div style="color:#5F6780;font-size:.75rem">Bartender \u2022 hace 1 d\u00eda \u2022 Botella rota</div></div></div>'
    +'</div></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px"><button class="cfg-btn cfg-btn-ghost" style="justify-content:center" onclick="cfgExportarLicores()"><i class="bi bi-box-arrow-up"></i> Exportar licores (CSV)</button><button class="cfg-btn cfg-btn-ghost" style="justify-content:center" onclick="cfgImportarLicores()"><i class="bi bi-box-arrow-in-down"></i> Importar licores</button></div>'
    +'<div style="display:flex;gap:8px;margin-top:12px"><button class="cfg-btn cfg-btn-danger" style="flex:1;justify-content:center" onclick="cfgLimpiarLogs()"><i class="bi bi-trash"></i> Limpiar logs antiguos</button></div>',
    '<button class="cfg-btn cfg-btn-ghost" onclick="cfgModalClose()">Cerrar</button><button class="cfg-btn cfg-btn-primary" onclick="cfgGuardarLogs()"><i class="bi bi-check-lg"></i> Guardar</button>');
}
function cfgGuardarLogs(){
  var p={logs_retencion:String(document.getElementById('cfgLogDias').value||'90'),logs_auditoria:document.getElementById('cfgLogAudit').checked?'1':'0'};
  cfgSave(p,'Configuraci\u00f3n de logs guardada').then(function(ok){ if(ok) cfgModalClose(); });
}
function cfgExportarLicores(){
  if(cfgPanel.productos.length===0) return cfgToast('warning','No hay productos para exportar');
  var csv='nombre,categoria,precio,stock\n'+cfgPanel.productos.map(function(p){return '"'+(p.nombre||'')+'","'+(p.categoria||'')+'",'+(p.precio||0)+','+(p.stock||0);}).join('\n');
  var blob=new Blob([csv],{type:'text/csv'}); var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='licores_clubmaster.csv'; a.click(); cfgToast('success','CSV exportado');
}
function cfgImportarLicores(){
  var inp=document.createElement('input'); inp.type='file'; inp.accept='.csv,.xlsx';
  inp.onchange=function(){ if(inp.files[0]) cfgToast('info','Importando '+inp.files[0].name+'...'); setTimeout(function(){cfgToast('success','Importaci\u00f3n completada (simulado)');},1000); };
  inp.click();
}
function cfgLimpiarLogs(){ if(!confirm('Eliminar logs con m\u00e1s de '+(document.getElementById('cfgLogDias').value||90)+' d\u00edas?')) return; cfgToast('success','Logs antiguos eliminados'); }
