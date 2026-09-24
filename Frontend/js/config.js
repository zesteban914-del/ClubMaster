var API_BASE = (function(){
  if(typeof window!=='undefined' && window.API_BASE) return window.API_BASE;
  if(typeof location!=='undefined' && location.origin && location.origin.indexOf('http')===0 && location.hostname!=='localhost' && location.hostname!=='127.0.0.1') return location.origin;
  return '';
})();
