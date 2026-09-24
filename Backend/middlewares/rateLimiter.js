let rateLimit, ipKeyGenerator;
try { const rl = require('express-rate-limit'); rateLimit = rl.rateLimit || rl; ipKeyGenerator = rl.ipKeyGenerator || ((req)=> req.ip); } catch(e) { rateLimit = null; ipKeyGenerator = (req)=> req.ip || 'unk'; }

function obtenerIp(req){
  const fwd = (req.headers['x-forwarded-for']||'').split(',')[0].trim();
  if(fwd) return fwd;
  return req.ip || (req.socket && req.socket.remoteAddress) || 'unk';
}

function esIpLocal(ip){
  ip = String(ip || '').trim();
  const extras = String(process.env.RATE_WHITELIST || '').split(',').map(function(s){ return s.trim(); }).filter(Boolean);
  for(const pref of extras){ if(pref && ip.indexOf(pref) === 0) return true; }
  if(ip === '::1' || ip === '::ffff:127.0.0.1' || ip === 'localhost') return true;
  if(ip.indexOf('127.') === 0 || ip.indexOf('10.') === 0 || ip.indexOf('192.168.') === 0) return true;
  const m172 = ip.match(/^172\.(\d+)\./);
  if(m172 && Number(m172[1]) >= 16 && Number(m172[1]) <= 31) return true;
  return false;
}

function fallbackLimiter(opts){
  const store = new Map();
  const windowMs = opts.windowMs || 15*60*1000;
  const max = opts.max || 5;
  return (req,res,next)=>{
    if(opts.omitirLocal && esIpLocal(obtenerIp(req))) return next();
    const key = obtenerIp(req) + ':' + (opts.key || '');
    const now = Date.now();
    let rec = store.get(key);
    if(!rec || now - rec.start > windowMs) rec = {count:0,start:now};
    rec.count++;
    store.set(key,rec);
    if(rec.count > max){
      return res.status(429).json({ success:false, exito:false, mensaje: opts.message?.mensaje || opts.message || 'Demasiados intentos. Intenta en 15 minutos.' });
    }
    next();
  };
}

function createLimiter(envMax, defecto, msg, omitirLocal){
  const max = Number(process.env[envMax] || defecto);
  const opts = {
    windowMs: 15*60*1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success:false, exito:false, mensaje: msg },
    keyGenerator: (req)=> obtenerIp(req) || ipKeyGenerator(req)
  };
  if(omitirLocal) opts.skip = (req)=> esIpLocal(obtenerIp(req));
  if(rateLimit) return rateLimit(opts);
  return fallbackLimiter({windowMs:opts.windowMs,max, message:opts.message, key:envMax, omitirLocal});
}

const loginLimiter = createLimiter('RATE_LOGIN_MAX', 100, 'Demasiados intentos de login. Intenta de nuevo en 15 minutos.');
const recuperarLimiter = createLimiter('RATE_RECUPERAR_MAX', 20, 'Demasiadas solicitudes de recuperación. Intenta en 15 minutos.');
const pinLimiter = createLimiter('RATE_PIN_MAX', 30, 'Demasiados intentos de PIN. Bloqueado 15 minutos.');
const cobrarLimiter = createLimiter('RATE_COBRAR_MAX', 200, 'Demasiados cobros seguidos. Espera un momento y reintenta.', true);
const backupLimiter = createLimiter('RATE_BACKUP_MAX', 20, 'Demasiadas descargas de backup. Intenta en 15 minutos.', true);

module.exports = { loginLimiter, recuperarLimiter, pinLimiter, cobrarLimiter, backupLimiter, esIpLocal, obtenerIp };
