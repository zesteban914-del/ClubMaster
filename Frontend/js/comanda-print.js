var COMANDA_CFG={auto:false, impresora:'', ancho:'80', areas:{}};
function comandaCargarCfg(){
 try{ var g=null; try{ if(typeof cfgPanel!=='undefined' && cfgPanel.general) g=cfgPanel.general; }catch(e){} if(!g) g=JSON.parse(localStorage.getItem('comanda_cfg')||'null'); if(g){ COMANDA_CFG.auto = g.imp_auto_comanda==='1' || g.imp_auto_comanda===true; COMANDA_CFG.impresora=g.imp_predeterminada||g.imp_barra_principal||''; COMANDA_CFG.ancho=g.imp_ancho||'80'; COMANDA_CFG.areas={barra_principal:g.imp_barra_principal||'', vip:g.imp_vip||'', palcos:g.imp_palcos||'', terraza:g.imp_terraza||'', cocina:g.imp_cocina||''}; } var ls=JSON.parse(localStorage.getItem('comanda_cfg')||'{}'); if(ls.auto!=null) COMANDA_CFG.auto=!!ls.auto; if(ls.impresora) COMANDA_CFG.impresora=ls.impresora; if(ls.ancho) COMANDA_CFG.ancho=ls.ancho;
 }catch(e){}
 fetch((typeof API_BASE!=='undefined'&&API_BASE?API_BASE:'')+'/api/configuracion').then(function(r){return r.json();}).then(function(j){ if(j.success && j.config){ var g=j.config; COMANDA_CFG.auto=g.imp_auto_comanda==='1'; COMANDA_CFG.impresora=g.imp_predeterminada||g.imp_barra_principal||COMANDA_CFG.impresora; COMANDA_CFG.ancho=g.imp_ancho||COMANDA_CFG.ancho; COMANDA_CFG.areas={barra_principal:g.imp_barra_principal||'', vip:g.imp_vip||'', palcos:g.imp_palcos||'', terraza:g.imp_terraza||'', cocina:g.imp_cocina||''}; localStorage.setItem('comanda_cfg', JSON.stringify({auto:COMANDA_CFG.auto, impresora:COMANDA_CFG.impresora, ancho:COMANDA_CFG.ancho})); } }).catch(function(){});
}
document.addEventListener('DOMContentLoaded', function(){ setTimeout(comandaCargarCfg, 900); });
function comandaClasificar(p){
 var cat=(p.categoria||'').toLowerCase(); var nom=(p.nombre||'').toLowerCase();
 var cocinaKeys=['cocina','comida','plato','alimento','entrada','hamburg','pizza','ensalada','postre','snack','picada','comida'];
 for(var i=0;i<cocinaKeys.length;i++){ if(cat.indexOf(cocinaKeys[i])!==-1 || nom.indexOf(cocinaKeys[i])!==-1) return 'COCINA'; }
 return 'BARRA';
}
function comandaAgrupar(carrito){
 var g={BARRA:[], COCINA:[]};
 carrito.forEach(function(it){ var d=comandaClasificar(it); g[d].push(it); });
 return g;
}
function comandaGenerarHTML(opts){
 var mesa=opts.mesa, carrito=opts.carrito||[], mesero=opts.mesero||'', fecha=opts.fecha||new Date(), pedidoId=opts.pedidoId||'', establecimiento=opts.establecimiento||{};
 var isReprint=!!opts.isReprint; var reprintUsuario=opts.reprintUsuario||mesero||''; var reprintFecha=opts.reprintFecha||new Date();
 var nombreLocal=establecimiento.nombre_local||establecimiento.ticket_encabezado||'ClubMaster';
 var nit=establecimiento.nit_local||''; var dir=establecimiento.direccion_local||''; var tel=establecimiento.telefono_local||'';
 var fechaStr=fecha instanceof Date ? fecha.toLocaleString('es-CO') : String(fecha);
 var grupos=comandaAgrupar(carrito);
 var anchoCss = COMANDA_CFG.ancho==='58' ? '52mm' : '72mm';
 var html='<html><head><meta charset="utf-8"><title>Comanda Mesa '+mesa+'</title><style>@page{size:'+COMANDA_CFG.ancho+'mm auto;margin:0} *{margin:0;padding:0;box-sizing:border-box} body{width:'+anchoCss+';margin:0 auto;background:#fff;color:#000;font-family:monospace,monospace;font-size:11px;line-height:1.35;padding:6px} .center{text-align:center} .bold{font-weight:800} .sep{border-top:1px dashed #000;margin:6px 0} .sep2{border-top:2px solid #000;margin:6px 0} .row{display:flex;justify-content:space-between} .item{margin:4px 0} .obs{font-size:9px;font-style:italic;color:#333;margin-left:8px} .dest{margin-top:8px;padding:4px 6px;background:#000;color:#fff;text-align:center;font-weight:800;font-size:12px;letter-spacing:1px} .head{font-size:13px;font-weight:800} .sub{font-size:9px;color:#222} .foot{font-size:8px;text-align:center;color:#444;margin-top:8px} .watermark{border:2px solid #000;padding:6px;text-align:center;font-weight:800;font-size:12px;letter-spacing:1px;margin-bottom:6px;background:#fff;color:#000} .watermark small{display:block;font-weight:400;font-size:8px;margin-top:2px} @media print{body{padding:0} .no-print{display:none}}</style></head><body>';
 if(isReprint){ var rFecha=reprintFecha instanceof Date?reprintFecha.toLocaleString('es-CO'):String(reprintFecha); html+='<div class="watermark">*** REIMPRESI\u00d3N / DUPLICADO ***<small>Reimpreso: '+escComanda(rFecha)+' por '+escComanda(reprintUsuario)+'</small></div>'; }
 html+='<div class="center"><div class="head">'+escComanda(nombreLocal)+'</div>'+(nit?'<div class="sub">NIT '+escComanda(nit)+'</div>':'')+(dir?'<div class="sub">'+escComanda(dir)+'</div>':'')+(tel?'<div class="sub">Tel '+escComanda(tel)+'</div>':'')+'</div>';
 html+='<div class="sep2"></div>';
 html+='<div class="row"><span>MESA: <b>'+escComanda(mesa)+'</b></span><span>#'+escComanda(pedidoId)+'</span></div>';
 html+='<div class="row"><span>Mesero: '+escComanda(mesero)+'</span></div>';
 html+='<div class="row"><span>Fecha: '+escComanda(fechaStr)+'</span></div>';
 html+='<div class="sep"></div>';
 ['BARRA','COCINA'].forEach(function(dest){
  if(!grupos[dest].length) return;
  html+='<div class="dest">*** '+dest+' ***</div>';
  grupos[dest].forEach(function(it){
   html+='<div class="item"><div class="row"><span><b>'+it.cantidad+'x</b> '+escComanda(it.nombre)+'</span></div>';
   if(it.presentacion && it.presentacion!=='Trago / Copa') html+='<div class="obs">Pres: '+escComanda(it.presentacion)+'</div>';
   if(it.observaciones) html+='<div class="obs">Obs: '+escComanda(it.observaciones)+'</div>';
   if(it.nota) html+='<div class="obs">Nota: '+escComanda(it.nota)+'</div>';
   html+='</div>';
  });
 });
 html+='<div class="sep"></div>';
 html+='<div class="row"><span>Total items:</span><span class="bold">'+carrito.reduce(function(a,i){return a+i.cantidad;},0)+'</span></div>';
 html+='<div class="foot">'+escComanda(establecimiento.pie_factura||'Cocina/Barra - Preparar de inmediato')+'<br>COMANDA NO VALIDA COMO FACTURA</div>';
 html+='<div class="no-print" style="text-align:center;margin-top:10px"><button onclick="window.print()" style="padding:8px 16px;background:#000;color:#fff;border:none;border-radius:6px;font-weight:700">Imprimir</button></div>';
 html+='</body></html>';
 return html;
}
function escComanda(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
var _lastPrintHtml='', _lastPrintOpts=null;
function comandaImprimirHTML(html, opts){
 opts=opts||{};
 _lastPrintHtml=html; _lastPrintOpts=opts;
 var area=opts.area||'barra_principal'; var isReprint=!!opts.isReprint; var idMesa=opts.idMesa||''; var idPedido=opts.idPedido||'';
 var usuarioActual=(typeof usuario!=='undefined'&&usuario&&usuario.nombre)?usuario.nombre:(JSON.parse(localStorage.getItem('usuario')||'{}').nombre||'');
 var w=window.open('','_blank','width=320,height=600');
 if(!w){ var iframe=document.createElement('iframe'); iframe.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(iframe); var doc=iframe.contentDocument||iframe.contentWindow.document; doc.open(); doc.write(html); doc.close(); setTimeout(function(){ try{ iframe.contentWindow.focus(); iframe.contentWindow.print(); }catch(e){} setTimeout(function(){ iframe.remove(); }, 1000); }, 300);
 } else { w.document.open(); w.document.write(html); w.document.close(); setTimeout(function(){ try{ w.focus(); w.print(); }catch(e){} }, 300); }
  var apiBase=(typeof API_BASE!=='undefined'&&API_BASE?API_BASE:'');
  var payload={area:area, html:html, text: html.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').substring(0,4000), isReprint:isReprint, id_mesa:idMesa, id_pedido:idPedido, usuario:usuarioActual, tipo: opts.tipo||'comanda', abrirCajon: !!opts.abrirCajon};
 var endpoint = '/api/print/comanda';
 fetch(apiBase+endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
  .then(function(r){ return r.json().then(function(j){ return {ok:r.ok, status:r.status, body:j};}); })
  .then(function(res){
    if(!res.ok || !res.body.success){
      var msg = (res.body && res.body.mensaje) || 'Error de conexión con impresora';
      if(typeof mostrarToast==='function') mostrarToast('danger','⚠️ Impresora '+area+' no responde: '+msg);
      try{
        var cAlerta=document.getElementById('contenedorAlertas');
        if(cAlerta){
          cAlerta.innerHTML='<div class="alert alert-danger alert-dismissible fade show"><div style="display:flex;gap:10px;align-items:center"><i class="bi bi-printer" style="color:#F87171;font-size:1.2rem"></i><div><div style="font-weight:800">Impresora '+escComanda(area)+' offline</div><div style="font-size:.78rem">'+escComanda(msg)+' (timeout/offline)</div></div></div><div style="margin-top:10px;display:flex;gap:8px"><button class="btn btn-sm" style="background:#0F172A;color:#fff;border-radius:8px" onclick="reenviarComandaSecundaria(\''+area+'\',\''+idMesa+'\',\''+idPedido+'\')"><i class="bi bi-arrow-repeat"></i> Reenviar a secundaria</button><button class="btn btn-sm btn-light" style="border-radius:8px" onclick="window.print()">Reintentar ventana</button></div><button type="button" class="btn-close" data-bs-dismiss="alert"></button></div>';
          setTimeout(function(){ try{ cAlerta.innerHTML=''; }catch(e){} }, 8000);
        }
        else if(typeof mostrarAlerta==='function') mostrarAlerta('danger','Impresora '+area+' no responde: '+msg);
        else alert('Impresora '+area+' offline: '+msg+'\nPuede reenviar a secundaria.');
      }catch(e){ if(typeof mostrarAlerta==='function') mostrarAlerta('danger','Impresora '+area+' no responde: '+msg); }
    } else {
      if(isReprint && typeof mostrarToast==='function') mostrarToast('info','Reimpresión enviada a '+area);
    }
  }).catch(function(){});
}
function reenviarComandaSecundaria(area, idMesa, idPedido){
  var html=_lastPrintHtml || document.documentElement.outerHTML.substring(0,4000);
  var opts=_lastPrintOpts||{area:area};
  var apiBase=(typeof API_BASE!=='undefined'?API_BASE:'');
  var usuarioActual=(typeof usuario!=='undefined'&&usuario&&usuario.nombre)?usuario.nombre:'';
  fetch(apiBase+'/api/print/reenviar-secundaria',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({area:area, html: html.substring(0,6000), text:'Reenvio secundaria '+area, id_mesa:idMesa||opts.idMesa, id_pedido:idPedido||opts.idPedido, tipo:'comanda', usuario:usuarioActual})})
    .then(function(r){return r.json()}).then(function(j){
      if(j.success){ if(typeof mostrarToast==='function') mostrarToast('success','Reenviado a impresora secundaria: '+j.impresora); if(typeof mostrarAlerta==='function') mostrarAlerta('success','✅ Reenviado a secundaria: '+j.impresora); }
      else { if(typeof mostrarToast==='function') mostrarToast('danger','Secundaria también falló: '+(j.mensaje||'')); }
    }).catch(function(){ if(typeof mostrarToast==='function') mostrarToast('danger','Error al reenviar a secundaria'); });
}
function imprimirComanda(opts){
 if(!opts || !opts.carrito || !opts.carrito.length) return;
 opts.isReprint = !!opts.isReprint;
 if(!opts.reprintUsuario && opts.isReprint) opts.reprintUsuario=(typeof usuario!=='undefined'&&usuario&&usuario.nombre)?usuario.nombre:'';
 if(!opts.reprintFecha && opts.isReprint) opts.reprintFecha=new Date();
 if(typeof COMANDA_CFG!=='undefined' && COMANDA_CFG.auto===false && !opts.isReprint){
  var htmlNoAuto=comandaGenerarHTML(opts);
  comandaImprimirHTML(htmlNoAuto, {area: (opts.area||comandaClasificar(opts.carrito[0])==='COCINA'?'cocina':'barra_principal'), isReprint: opts.isReprint, idMesa: opts.mesa, idPedido: opts.pedidoId, tipo:'comanda'});
  return;
 }
 var html=comandaGenerarHTML(opts);
 var areaDetect = opts.area || (opts.carrito.length? (comandaClasificar(opts.carrito[0])==='COCINA'?'cocina':'barra_principal') : 'barra_principal');
 comandaImprimirHTML(html, {area: areaDetect, isReprint: opts.isReprint, idMesa: opts.mesa, idPedido: opts.pedidoId, tipo:'comanda'});
}
function reimprimirComanda(mesaId, mesaNumero){
  var usuarioActual=(typeof usuario!=='undefined'&&usuario&&usuario.nombre)?usuario.nombre:(JSON.parse(localStorage.getItem('usuario')||'{}').nombre||'');
  var fechaNow=new Date();
  fetch((typeof API_BASE!=='undefined'?API_BASE:'')+'/api/mesas/'+mesaId+'/cuenta')
    .then(function(r){return r.json()}).then(function(data){
      if(!data.success || !data.detalles || !data.detalles.length){ if(typeof mostrarToast==='function') mostrarToast('warning','No hay comanda para reimprimir'); return; }
      var carrito=data.detalles.map(function(d){ return {nombre:d.nombre, cantidad:d.cantidad, categoria:'', precio_unitario:d.precio_unitario, subtotal:d.subtotal, observaciones:d.observaciones||'', presentacion:d.presentacion||''}; });
      imprimirComanda({mesa:mesaNumero||mesaId, carrito:carrito, mesero: usuarioActual, fecha: new Date(), pedidoId: data.detalles[0].id_pedido||mesaId, establecimiento:(typeof cfgPanel!=='undefined'?cfgPanel.general:{}), isReprint:true, reprintUsuario: usuarioActual, reprintFecha: fechaNow});
      if(typeof mostrarToast==='function') mostrarToast('info','*** REIMPRESIÓN enviada ***');
    }).catch(function(){ if(typeof mostrarToast==='function') mostrarToast('danger','No se pudo cargar comanda para reimpresión'); });
}
function comandaAutoDesdePedido(pedidoId, mesaNumero, carritoSnapshot){
 if(!COMANDA_CFG.auto){
  if(confirm('Impresion automatica desactivada. ¿Imprimir comanda Mesa '+mesaNumero+' ahora?')) imprimirComanda({mesa:mesaNumero, carrito:carritoSnapshot, mesero:(typeof usuario!=='undefined'?usuario.nombre:''), fecha:new Date(), pedidoId:pedidoId, establecimiento:(typeof cfgPanel!=='undefined'?cfgPanel.general:{})});
  return;
 }
 var grupos=comandaAgrupar(carritoSnapshot);
 var destinos=Object.keys(grupos).filter(function(k){return grupos[k].length>0;});
 if(destinos.length===2){
  destinos.forEach(function(dest){
   var html=comandaGenerarHTML({mesa:mesaNumero, carrito:grupos[dest], mesero:(typeof usuario!=='undefined'?usuario.nombre:''), fecha:new Date(), pedidoId:pedidoId+(dest==='COCINA'?' - COCINA':' - BARRA'), establecimiento:(typeof cfgPanel!=='undefined'?cfgPanel.general:{})});
   setTimeout(function(){ comandaImprimirHTML(html); }, dest==='BARRA'?0:600);
  });
 } else {
  imprimirComanda({mesa:mesaNumero, carrito:carritoSnapshot, mesero:(typeof usuario!=='undefined'?usuario.nombre:''), fecha:new Date(), pedidoId:pedidoId, establecimiento:(typeof cfgPanel!=='undefined'?cfgPanel.general:{})});
 }
}
function comandaTestPrint(){
 var demo=[{nombre:'Cerveza Aguila', cantidad:2, categoria:'Cervezas', observaciones:'Bien fria', presentacion:'Botella'}, {nombre:'Plato Mixto', cantidad:1, categoria:'Cocina', observaciones:'Sin picante'}];
 imprimirComanda({mesa:'1', carrito:demo, mesero:'Test', fecha:new Date(), pedidoId:'TEST', establecimiento:(typeof cfgPanel!=='undefined'?cfgPanel.general:{nombre_local:'ClubMaster'})});
}
