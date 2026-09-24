var AUDI={page:0, limit:50};
function esAdminAud(){ try{ var u=typeof usuario!=='undefined'?usuario:null; if(!u) u=JSON.parse(localStorage.getItem('usuario')||'{}'); return Number(u.id_rol)===1 || String(u.rol||'').toLowerCase()==='administrador' || String(u.rol||'').toLowerCase()==='admin'; }catch(e){return false;} }
function iniciarAuditoria(){
 if(!esAdminAud()){ if(typeof mostrarAccesoRestringido==='function') mostrarAccesoRestringido(); return; }
 if(typeof activarNav==='function') activarNav('navAuditoria'); else document.querySelectorAll('#sidebar .nav-link').forEach(function(a){a.classList.remove('active');}); var el=document.getElementById('navAuditoria'); if(el) el.classList.add('active');
 var c=document.getElementById('main-content');
  c.innerHTML='<div class="page-header"><h2><i class="bi bi-shield-lock"></i> Bitácora de Auditoría <span style="font-size:.7rem;background:#0f172a;color:#fbbf24;padding:4px 8px;border-radius:6px;margin-left:8px">Solo Admin</span></h2><div style="display:flex;gap:8px"><button class="btn-refresh" data-action="aud-refresh"><i class="bi bi-arrow-clockwise"></i> Actualizar</button><button class="btn-refresh" style="background:#0f172a;color:#fff;border:none" data-action="aud-reportes"><i class="bi bi-bar-chart-line"></i> Reportes</button></div></div>'
 +'<div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:14px;margin-bottom:12px;display:flex;flex-wrap:wrap;gap:10px;align-items:end">'
 +'<div style="flex:1;min-width:140px"><label style="font-size:.7rem;font-weight:800;color:#475569;text-transform:uppercase">Desde</label><input type="date" id="audFi" class="form-control form-control-sm" style="border-radius:8px"></div>'
 +'<div style="flex:1;min-width:140px"><label style="font-size:.7rem;font-weight:800;color:#475569;text-transform:uppercase">Hasta</label><input type="date" id="audFf" class="form-control form-control-sm" style="border-radius:8px"></div>'
 +'<div style="flex:1;min-width:160px"><label style="font-size:.7rem;font-weight:800;color:#475569;text-transform:uppercase">Tipo evento</label><select id="audTipo" class="form-select form-select-sm" style="border-radius:8px"><option value="">Todos</option><option value="CANCELACION_PEDIDO">CANCELACION_PEDIDO</option><option value="ANULACION_ITEM">ANULACION_ITEM</option><option value="DESCUENTO_APLICADO">DESCUENTO_APLICADO</option><option value="INGRESO_CAJA">INGRESO_CAJA</option><option value="RETIRO_CAJA">RETIRO_CAJA</option><option value="VACIADO_CAJA">VACIADO_CAJA</option><option value="CAMBIO_PRECIO">CAMBIO_PRECIO</option><option value="LOGIN_FALLIDO">LOGIN_FALLIDO</option><option value="PIN_FALLIDO">PIN_FALLIDO</option><option value="APERTURA_CAJA">APERTURA_CAJA</option><option value="CIERRE_CAJA">CIERRE_CAJA</option></select></div>'
 +'<div style="flex:1;min-width:120px"><label style="font-size:.7rem;font-weight:800;color:#475569;text-transform:uppercase">Usuario ID</label><input type="number" id="audUsuario" class="form-control form-control-sm" placeholder="ID" style="border-radius:8px"></div>'
 +'<div style="flex:1;min-width:120px"><label style="font-size:.7rem;font-weight:800;color:#475569;text-transform:uppercase">Mesa</label><input type="text" id="audMesa" class="form-control form-control-sm" placeholder="Nº mesa" style="border-radius:8px"></div>'
  +'<div style="display:flex;gap:6px;align-items:end"><button class="btn btn-sm" style="background:#0f172a;color:#fff;border-radius:8px;padding:7px 14px;font-weight:600" data-action="aud-buscar"><i class="bi bi-search me-1"></i>Filtrar</button><button class="btn btn-sm btn-outline-secondary" style="border-radius:8px" data-action="aud-limpiar"><i class="bi bi-x-circle"></i></button></div>'
 +'</div>'
 +'<div id="audStats" style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap"></div>'
  +'<div class="card" style="border:1px solid #e2e8f0;border-radius:14px;overflow:hidden"><div style="padding:12px 14px;background:#0f172a;color:#f8fafc;font-weight:700;font-size:.82rem;display:flex;justify-content:space-between;align-items:center"><span><i class="bi bi-journal-text me-1"></i> Registros inmutables</span><span id="audTotal" style="background:#1e293b;color:#94a3b8;padding:4px 10px;border-radius:20px;font-size:.72rem">0 registros</span></div><div class="table-responsive"><table class="table table-hover mb-0" style="font-size:.82rem"><thead style="background:#f8fafc"><tr><th>Fecha</th><th>Tipo</th><th>Usuario</th><th>Autorizado por</th><th>Descripción</th><th>Motivo</th><th>Mesa</th><th>IP</th></tr></thead><tbody id="audBody"><tr><td colspan="8" style="text-align:center;padding:20px;color:#94a3b8"><div class="spinner-border spinner-border-sm text-primary"></div> Cargando...</td></tr></tbody></table></div><div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#f8fafc;border-top:1px solid #e2e8f0"><button class="btn btn-sm btn-outline-secondary" data-action="aud-prev"><i class="bi bi-chevron-left"></i> Anterior</button><span id="audPage" style="font-size:.8rem;color:#64748b">Página 1</span><button class="btn btn-sm btn-outline-secondary" data-action="aud-next">Siguiente <i class="bi bi-chevron-right"></i></button></div></div>'
 +'<div style="margin-top:10px;background:#0b1220;border:1px solid #1e293b;border-left:3px solid #f59e0b;border-radius:10px;padding:12px 14px;font-size:.78rem;color:#cbd5e1"><i class="bi bi-info-circle" style="color:#fbbf24"></i> Bitácora inmutable: los registros no pueden editarse ni eliminarse. Filtra por fecha, usuario, tipo o mesa.</div>';
 var hoy=new Date(); var ini=new Date(); ini.setDate(hoy.getDate()-7);
 document.getElementById('audFi').value=ini.toISOString().split('T')[0];
 document.getElementById('audFf').value=hoy.toISOString().split('T')[0];
 audCargar();
}
function audQS(){
 var p=[];
 var fi=document.getElementById('audFi').value, ff=document.getElementById('audFf').value, tp=document.getElementById('audTipo').value, uid=document.getElementById('audUsuario').value, mesa=document.getElementById('audMesa').value;
 if(fi) p.push('fecha_inicio='+fi);
 if(ff) p.push('fecha_fin='+ff);
 if(tp) p.push('tipo_evento='+encodeURIComponent(tp));
 if(uid) p.push('usuario_id='+encodeURIComponent(uid));
 if(mesa) p.push('mesa_id='+encodeURIComponent(mesa));
 p.push('limite='+AUDI.limit); p.push('offset='+(AUDI.page*AUDI.limit));
 return p.length?'?'+p.join('&'):'';
}
function audCargar(){
 var tb=document.getElementById('audBody');
 if(tb) tb.innerHTML='<tr><td colspan="8" style="text-align:center;padding:20px;color:#94a3b8"><div class="spinner-border spinner-border-sm text-primary"></div> Cargando...</td></tr>';
 fetch((typeof API_BASE!=='undefined'?API_BASE:'')+'/api/audit-logs'+audQS(),{credentials:'include'}).then(function(r){return r.json().then(function(d){return {ok:r.ok, d:d};});}).then(function(w){
   if(!w.ok || !w.d.success){ tb.innerHTML='<tr><td colspan="8" style="text-align:center;padding:20px;color:#dc2626">'+(w.d.mensaje||'No autorizado - solo Administrador')+'</td></tr>'; return; }
   var logs=w.d.logs||[];
   document.getElementById('audTotal').textContent=w.d.total+' registros';
   document.getElementById('audPage').textContent='Página '+(AUDI.page+1)+' · '+logs.length+' en página';
   if(!logs.length){ tb.innerHTML='<tr><td colspan="8" style="text-align:center;padding:20px;color:#94a3b8">Sin registros para el filtro</td></tr>'; return; }
   var badge=function(t){ var m={CANCELACION_PEDIDO:['#dc2626','#fef2f2'],ANULACION_ITEM:['#dc2626','#fef2f2'],DESCUENTO_APLICADO:['#d97706','#fffbeb'],INGRESO_CAJA:['#059669','#ecfdf5'],RETIRO_CAJA:['#7f1d1d','#fef2f2'],VACIADO_CAJA:['#7f1d1d','#fef2f2'],CAMBIO_PRECIO:['#2563eb','#eff6ff'],LOGIN_FALLIDO:['#991b1b','#fef2f2'],PIN_FALLIDO:['#991b1b','#fef2f2'],APERTURA_CAJA:['#1e3a8a','#eff6ff'],CIERRE_CAJA:['#0f172a','#f1f5f9']}; var c=m[t]||['#64748b','#f1f5f9']; return '<span style="background:'+c[1]+';color:'+c[0]+';border:1px solid '+c[0]+'20;padding:3px 8px;border-radius:12px;font-weight:700;font-size:.7rem;white-space:nowrap">'+t+'</span>'; };
    var esc = typeof escapeHTML !== 'undefined' ? escapeHTML : function(s){ return String(s == null ? '' : s); };
    tb.innerHTML=logs.map(function(r){
      var fecha=''; try{ fecha=new Date(r.created_at).toLocaleString('es-CO'); }catch(e){ fecha=r.created_at; }
      return '<tr><td style="white-space:nowrap;font-size:.78rem;color:#475569">'+esc(fecha)+'</td><td>'+badge(esc(r.tipo_evento))+'</td><td style="font-weight:600">'+esc(r.usuario_nombre||r.usuario_id||'--')+'<br><small style="color:#64748b">#'+esc(r.usuario_id||'--')+'</small></td><td style="color:#64748b">'+esc(r.autorizado_nombre||r.autorizado_por_id||'--')+'</td><td style="max-width:240px;white-space:normal;word-break:break-word">'+esc((r.descripcion||'').substring(0,120))+'</td><td style="max-width:160px;white-space:normal;color:#334155">'+esc((r.motivo||'').substring(0,80))+'</td><td style="text-align:center">'+esc(r.mesa_id||'--')+'</td><td style="font-size:.72rem;color:#94a3b8">'+esc(r.ip_address||'--')+'</td></tr>';
    }).join('');
 }).catch(function(){ tb.innerHTML='<tr><td colspan="8" style="text-align:center;padding:12px;color:#dc2626">Error de conexión</td></tr>'; });
}
function audBuscar(){ AUDI.page=0; audCargar(); }
function audLimpiar(){ document.getElementById('audFi').value=''; document.getElementById('audFf').value=''; document.getElementById('audTipo').value=''; document.getElementById('audUsuario').value=''; document.getElementById('audMesa').value=''; AUDI.page=0; audCargar(); }
function audPrev(){ if(AUDI.page>0){ AUDI.page--; audCargar(); } }
function audNext(){ AUDI.page++; audCargar(); }
function inyectarNavAuditoria(){
 if(document.getElementById('navAuditoria')) return;
 var nav=document.querySelector('#sidebar .nav');
 if(!nav) return;
 var li=document.createElement('li'); li.className='nav-item';
  li.innerHTML='<a href="#" class="nav-link" data-action="aud-open" id="navAuditoria"><i class="bi bi-shield-lock"></i> <span>Bitácora</span> <span style="font-size:.6rem;background:#fbbf24;color:#0f172a;padding:2px 6px;border-radius:6px;margin-left:6px;font-weight:800">ADMIN</span></a>';
  li.querySelector('[data-action="aud-open"]').addEventListener('click', function(e){ e.preventDefault(); iniciarAuditoria(); });
 var ref=document.getElementById('navReportes');
 if(ref && ref.closest('li')) ref.closest('li').after(li); else nav.appendChild(li);
  function toggleVis(){ if(document.hidden) return; var show=esAdminAud(); li.style.display= show?'':'none'; }
  toggleVis();
  var visTimer=setInterval(toggleVis,2000);
  window.addEventListener('pagehide', function(){ clearInterval(visTimer); });
  window.addEventListener('beforeunload', function(){ clearInterval(visTimer); });
}
function inyectarTabAuditoriaEnReportes(){
 try{
   var tryInject=setInterval(function(){
     var bar=document.getElementById('repExportBar');
     if(!bar || document.getElementById('btnBitacoraTab')) return;
     if(!esAdminAud()) return;
     var btn=document.createElement('button');
     btn.id='btnBitacoraTab';
     btn.className='btn btn-sm';
     btn.style.cssText='background:#0f172a;color:#fbbf24;border:1px solid #1e293b;border-radius:8px;font-weight:700';
     btn.innerHTML='<i class="bi bi-shield-lock me-1"></i>Bitácora de Auditoría';
     btn.onclick=iniciarAuditoria;
     bar.appendChild(btn);
     clearInterval(tryInject);
   },800);
   setTimeout(function(){ clearInterval(tryInject); }, 15000);
 }catch(e){}
}
document.addEventListener('DOMContentLoaded', function(){ setTimeout(function(){ inyectarNavAuditoria(); inyectarTabAuditoriaEnReportes(); },800); });
if (typeof delegateAction !== 'undefined') delegateAction(document, { 'aud-refresh': function(){ audCargar(); }, 'aud-reportes': function(){ iniciarReportes(); }, 'aud-buscar': function(){ audBuscar(); }, 'aud-limpiar': function(){ audLimpiar(); }, 'aud-prev': function(){ audPrev(); }, 'aud-next': function(){ audNext(); }, 'aud-open': function(){ iniciarAuditoria(); } });
