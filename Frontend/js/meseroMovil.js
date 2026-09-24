var CLAVE_PEDIDOS_PENDIENTES = 'clubmaster_pedidos_pendientes';
var MAX_INTENTOS = 50;
var RETRY_MS = 5000;
var retryTimer=null;

function obtenerPedidosPendientes(){
 try{ var d=localStorage.getItem(CLAVE_PEDIDOS_PENDIENTES); return d? JSON.parse(d):[]; }catch(e){ return []; }
}
function guardarPedidosPendientes(lista){
 try{ localStorage.setItem(CLAVE_PEDIDOS_PENDIENTES, JSON.stringify(lista)); }catch(e){ console.error('localStorage',e); }
}
function hashPayload(p){
 try{
  var d=(p.detalles||[]).map(function(x){return x.id_producto+'x'+x.cantidad;}).sort().join(',');
  return p.id_mesa+'|'+p.id_jornada+'|'+d;
 }catch(e){return '';}
}
function guardarPedidoOffline(payload){
 if(!payload.clave_cliente) payload.clave_cliente='c'+Date.now()+'_'+Math.random().toString(36).substr(2,9);
 var cola=obtenerPedidosPendientes();
 var h=hashPayload(payload);
 var ahora=Date.now();
 var dup=cola.some(function(q){
  try{
   if(q.payload && q.payload.clave_cliente && q.payload.clave_cliente===payload.clave_cliente) return true;
   if((q.estado==='PENDIENTE_ENVIO'||q.estado==='pendiente') && hashPayload(q.payload)===h && (ahora-new Date(q.timestamp).getTime())<120000) return true;
  }catch(e){}
  return false;
 });
 if(dup) return true;
 cola.push({id:'offline_'+Date.now()+'_'+Math.random().toString(36).substr(2,5), payload: payload, timestamp: new Date().toISOString(), intentos:0, estado:'PENDIENTE_ENVIO'});
 guardarPedidosPendientes(cola);
 actualizarBadgeOffline();
 mostrarIndicadorOffline(true);
 return true;
}
function fetchConTimeout(url, options, timeoutMs){
 var controller=new AbortController();
 var tid=setTimeout(function(){ controller.abort(); }, timeoutMs||5000);
 var opts=Object.assign({}, options, {signal: controller.signal});
 return fetch(url, opts).finally(function(){ clearTimeout(tid); });
}
var _enviandoCola=false;
function enviarPedidosPendientes(){
 if(_enviandoCola) return;
 var cola=obtenerPedidosPendientes();
 if(!cola.length) return;
 var pendientes=cola.filter(function(p){ return (p.estado==='PENDIENTE_ENVIO' || p.estado==='pendiente') && !p._enviando; });
 if(!pendientes.length) return;
  var API=(typeof API_BASE!=='undefined'&&API_BASE)?API_BASE:'';
 _enviandoCola=true;
 pendientes.forEach(function(pedido){
  pedido.intentos=(pedido.intentos||0)+1;
  pedido._enviando=true;
  var payload=pedido.payload;
  if(!payload.clave_cliente) payload.clave_cliente=pedido.id;
  fetchConTimeout(API+'/api/pedidos',{method:'POST',headers:{'Content-Type':'application/json'},body: JSON.stringify(payload)},12000)
  .then(function(r){ return r.json().then(function(d){ return {ok:r.ok,status:r.status,d:d}; }); })
   .then(function(w){
   delete pedido._enviando;
   if(w.ok && w.d && w.d.success){
    pedido.estado='ENVIADO_OK';
    setTimeout(function(){ limpiarColaEnviada(); },800);
    try{ if(typeof mostrarToast==='function') mostrarToast('success','Comanda pendiente enviada (#'+(w.d.idPedido||'')+(w.d.duplicado?', duplicado evitado':'')+')'); }catch(e){}
    try{ var io=window.Realtime; }catch(e){}
   } else if(w.status===429){
     pedido.estado='PENDIENTE_ENVIO';
     pausaLimiteHasta=Date.now()+60000;
     try{ if(typeof mostrarToast==='function') mostrarToast('warning', typeof MENSAJE_LIMITE!=='undefined'?MENSAJE_LIMITE:'Límite de peticiones alcanzado. Por favor, espera unos segundos.'); }catch(e){}
    } else {
     pedido.estado= pedido.intentos>=MAX_INTENTOS? 'ERROR_ENVIO':'PENDIENTE_ENVIO';
    }
   guardarPedidosPendientes(cola);
   actualizarBadgeOffline();
   actualizarIndicadorGlobal();
   _enviandoCola=false;
  })
  .catch(function(){
   delete pedido._enviando;
   pedido.estado= pedido.intentos>=MAX_INTENTOS? 'ERROR_ENVIO':'PENDIENTE_ENVIO';
   guardarPedidosPendientes(cola);
   actualizarBadgeOffline();
   actualizarIndicadorGlobal();
   _enviandoCola=false;
  });
 });
}
function limpiarColaEnviada(){
 var cola=obtenerPedidosPendientes();
 var activos=cola.filter(function(p){ return p.estado!=='ENVIADO_OK' && p.estado!=='enviado'; });
 guardarPedidosPendientes(activos);
 actualizarBadgeOffline();
 actualizarIndicadorGlobal();
}
function contarPendientes(){
 var cola=obtenerPedidosPendientes();
 return cola.filter(function(p){ return p.estado==='PENDIENTE_ENVIO' || p.estado==='pendiente'; }).length;
}
function contarErrores(){
 var cola=obtenerPedidosPendientes();
 return cola.filter(function(p){ return p.estado==='ERROR_ENVIO' || p.estado==='error'; }).length;
}
function actualizarBadgeOffline(){
 var pendientes=contarPendientes();
 var errores=contarErrores();
 var badge=document.getElementById('badgeOffline');
 var count=document.getElementById('countOffline');
 if(badge && count){
  if(pendientes>0){
   badge.style.display='inline-flex';
   badge.style.background='#fef3c7';
   badge.style.color='#92400e';
   badge.style.border='1px solid #fde68a';
   badge.innerHTML='<i class="bi bi-wifi-off me-1"></i> ⚠️ '+pendientes+' pendiente(s) — Comanda guardada localmente (Sin red)';
   count.textContent=pendientes;
  } else if(errores>0){
   badge.style.display='inline-flex';
   badge.style.background='#fee2e2';
   badge.style.color='#b91c1c';
   badge.style.border='1px solid #fecaca';
   badge.innerHTML='<i class="bi bi-exclamation-triangle me-1"></i> '+errores+' error(es)';
   count.textContent=errores+'!';
  } else {
   badge.style.display='none';
  }
 }
 actualizarIndicadorGlobal();
}
function mostrarIndicadorOffline(show){
 var el=document.getElementById('offlineIndicator');
 if(!el){
  el=document.createElement('div');
  el.id='offlineIndicator';
  el.style.cssText='position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:#451a03;color:#fbbf24;border:1px solid #92400e;padding:10px 18px;border-radius:12px;font-weight:700;font-size:.85rem;z-index:9999;display:none;box-shadow:0 8px 24px rgba(0,0,0,.25);align-items:center;gap:8px';
  el.innerHTML='⚠️ Comanda guardada localmente (Sin red)';
  document.body.appendChild(el);
 }
 el.style.display= show && contarPendientes()>0 ? 'inline-flex':'none';
 if(show && contarPendientes()>0){
  try{ if(typeof mostrarToast==='function') mostrarToast('warning','⚠️ Comanda guardada localmente (Sin red) — reintentando cada 5s'); }catch(e){}
 }
}
function actualizarIndicadorGlobal(){
 var pendientes=contarPendientes();
 var el=document.getElementById('offlineIndicator');
 if(el) el.style.display= pendientes>0 ? 'inline-flex':'none';
 var statusEl=document.getElementById('statusConexion');
 if(statusEl){
  if(!navigator.onLine || pendientes>0){ statusEl.textContent='⚠️ Sin red — '+pendientes+' pendiente(s)'; statusEl.style.color='#dc2626'; }
  else { statusEl.textContent='En línea'; statusEl.style.color='#15803d'; }
 }
}
var pausaLimiteHasta=0;
function iniciarRetryLoop(){
 if(retryTimer) clearInterval(retryTimer);
 retryTimer=setInterval(function(){
  if(document.hidden) return;
  if(Date.now()<pausaLimiteHasta) return;
  if(contarPendientes()>0) enviarPedidosPendientes();
 }, RETRY_MS);
}
window.addEventListener('pagehide', function(){ if(retryTimer) clearInterval(retryTimer); });
window.addEventListener('beforeunload', function(){ if(retryTimer) clearInterval(retryTimer); });
window.addEventListener('online', function(){
 enviarPedidosPendientes();
 actualizarIndicadorGlobal();
 var ind=document.getElementById('statusConexion');
 if(ind){ ind.textContent='En línea'; ind.style.color='#15803d'; }
});
window.addEventListener('offline', function(){
 actualizarIndicadorGlobal();
 var ind=document.getElementById('statusConexion');
 if(ind){ ind.textContent='⚠️ Sin conexión'; ind.style.color='#dc2626'; }
 mostrarIndicadorOffline(true);
});
document.addEventListener('DOMContentLoaded', function(){
 actualizarBadgeOffline();
 actualizarIndicadorGlobal();
 iniciarRetryLoop();
 if(navigator.onLine) enviarPedidosPendientes();
 else mostrarIndicadorOffline(true);
});
if(typeof window!=='undefined'){ window.guardarPedidoOffline=guardarPedidoOffline; window.enviarPedidosPendientes=enviarPedidosPendientes; window.mostrarIndicadorOffline=mostrarIndicadorOffline; }
