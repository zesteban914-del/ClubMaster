var StockAlerts=(function(){
 function check(){
  fetch((typeof API_BASE!=='undefined'?API_BASE:'')+'/api/productos/admin?estado=todos').then(function(r){return r.json();}).then(function(d){
   if(!d.success) return;
   var bajos=d.productos.filter(function(p){ return p.activo==1 && p.stock_minimo>0 && Number(p.stock) <= Number(p.stock_minimo); });
   var badge=document.getElementById('badgeStockAlert');
   if(!badge){
    var hdr=document.querySelector('.page-header-right');
    if(hdr){
     badge=document.createElement('span');
     badge.id='badgeStockAlert';
     badge.style.cssText='padding:6px 10px;border-radius:20px;font-weight:700;font-size:.75rem;display:none;align-items:center;gap:6px;cursor:pointer';
     badge.onclick=function(){ if(typeof iniciarInventario==='function') iniciarInventario(); };
     hdr.prepend(badge);
    }
   }
   if(badge){
    if(bajos.length){
     badge.style.display='inline-flex';
     badge.style.background='#fee2e2'; badge.style.color='#991b1b'; badge.style.border='1px solid #fecaca';
     badge.innerHTML='<i class="bi bi-exclamation-triangle"></i> '+bajos.length+' stock bajo';
     badge.title=bajos.map(function(p){return p.nombre+': '+p.stock+'/'+p.stock_minimo;}).join('\n');
     if(window.mostrarToast && !sessionStorage.getItem('stockAlertShown')){
      mostrarToast('warning','⚠️ '+bajos.length+' producto(s) bajo mínimo: '+bajos.slice(0,3).map(function(p){return p.nombre;}).join(', '));
      sessionStorage.setItem('stockAlertShown','1');
     }
    } else badge.style.display='none';
   }
  }).catch(function(){});
 }
  var timer=null;
  function init(){
    check();
    if(timer) clearInterval(timer);
    timer=setInterval(function(){ if(!document.hidden) check(); }, 60000);
    document.addEventListener('visibilitychange', function(){ if(!document.hidden) check(); });
    window.addEventListener('pagehide', function(){ if(timer) clearInterval(timer); });
    window.addEventListener('beforeunload', function(){ if(timer) clearInterval(timer); });
  }
 if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
 return {check:check};
})();
