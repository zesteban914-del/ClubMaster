const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('express-async-errors');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const env = require('./config/env');

// ---------------------------------------------------------
// Validaciones de arranque (centralizadas en config/env.js):
// - produccion exige SESSION_SECRET y JWT_SECRET (>=32 chars,
//   distinto del valor de ejemplo de .env.example)
// - CORS_ORIGINS nunca puede contener "*" y en produccion no
//   puede venir vacio
// - PORT es obligatorio en produccion (Railway lo inyecta);
//   el default 3000 aplica solo en desarrollo
// La conexion a MySQL se exige al crear el pool en
// config/database.js (DATABASE_URL -> MYSQL_URL -> DB_*/MYSQL*).
// ---------------------------------------------------------
env.validarSessionSecretAlArrancar();
env.validarJwtAlArrancar();
const corsOrigins = env.validarCorsAlArrancar();
const PUERTO = env.puerto();

const db = require('./database');
const mailer = require('./config/mailer');
const {
    crearSesion,
    middlewareRateLimitLogin,
    registrarIntentoFallido,
    registrarIntentoExitoso,
    requiereAutenticacion,
    requireRole
} = require('./middlewares/authMiddleware');

const app = express();
// Railway/Heroku/etc. terminan TLS en un proxy y reenvian la peticion por
// HTTP: sin 'trust proxy' Express cree que la conexion no es segura y la
// cookie de sesion (secure:true en produccion) nunca se envia. Debe quedar
// ANTES del middleware de sesion y definirse UNA sola vez.
if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

const corsOptions = {
  origin: function(origin, cb){
    // Sin cabecera Origin (curl, health checks, same-origin): permitir.
    if(!origin) return cb(null, true);
    const normalizado = String(origin).trim().replace(/\/+$/, '');
    if(corsOrigins.indexOf(normalizado)!==-1) return cb(null, true);
    if(process.env.NODE_ENV!=='production') return cb(null, true);
    return cb(new Error('CORS bloqueado para origen: '+origin));
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','PATCH','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Demo','X-Requested-With'],
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '25mb' }));
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
      scriptSrcAttr: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://fonts.googleapis.com'],
      styleSrcAttr: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'", 'https://cdn.jsdelivr.net', 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"]
    }
  },
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// ---------------------------------------------------------
// Health check: 200 {"ok":true} sin consultar la base de datos.
// Registrado antes del resto de middlewares para responder
// aunque la BD no este disponible.
// ---------------------------------------------------------
app.get('/health', function(req,res){ res.status(200).json({ ok: true }); });
app.get('/api/health', function(req,res){ res.status(200).json({ ok: true }); });

app.use((req,res,next)=>{
 if(req.path==='/health' || req.path==='/api/health') return next();
 if(process.env.NODE_ENV==='production' && !req.secure && req.headers['x-forwarded-proto']!=='https'){
  const host=req.headers.host;
  if(host) return res.redirect('https://'+host+req.url);
 }
 next();
});

const { demoStorage } = require('./config/database');
app.use((req,res,next)=>{
  const isDemo = req.headers['x-demo']==='1' || req.query.demo==='1' || process.env.DEMO_MODE==='true';
  demoStorage.run({isDemo}, ()=> next());
});
// Sin fallback fijo: config/env.js exige SESSION_SECRET en produccion
// y genera uno aleatorio en desarrollo.
app.use(crearSesion(env.secretSesion()));

const RUTAS_API_PUBLICAS = [
    '/auth/login', '/auth/pin-login', '/auth/logout',
    '/registro', '/recuperar-contrasena', '/auth/recuperar-password', '/reiniciar-contrasena',
    '/sesion',
    '/2fa/setup', '/2fa/enable', '/2fa/disable', '/2fa/status'
];
app.use('/api', function(req, res, next) {
    if (req.method === 'GET' || req.method === 'OPTIONS' || req.method === 'HEAD') return next();
    if (RUTAS_API_PUBLICAS.indexOf(req.path) !== -1) return next();
    return require('./middlewares/authMiddleware').requiereAutenticacion(req, res, next);
});

const { detectarColumnasProductos } = require('./helpers/column-detection');
detectarColumnasProductos(db.pool).catch(function(err) {
    console.error('Aviso: no se pudieron detectar columnas de productos:', err.message);
});

const security = require('./middlewares/security');
require('./routes/index')(app, db, security, mailer, {
    crearSesion,
    middlewareRateLimitLogin,
    registrarIntentoFallido,
    registrarIntentoExitoso,
    requiereAutenticacion,
    requireRole
});

// 404 JSON para cualquier /api no registrada (evita HTML <!DOCTYPE y error Unexpected token '<')
app.use('/api', function(req, res){
    // Si ya se envió respuesta, no hacer nada
    if (res.headersSent) return;
    res.status(404).json({ success:false, mensaje:'Endpoint no encontrado: '+req.method+' '+req.originalUrl });
});

// Vercel serverless: dentro de la funcion, la ruta de Frontend se resuelve
// distinto segun como el builder empaqueta el proyecto; probamos varias raices.
const candidatasFrontend = [
  path.join(__dirname, '../Frontend'),
  path.join(process.cwd(), 'Frontend'),
  path.join(process.cwd(), '../Frontend'),
  path.join(__dirname, '../../Frontend')
];
const rutaFrontend = candidatasFrontend.find(function(r) {
  try { return require('fs').statSync(r).isDirectory(); } catch (e) { return false; }
}) || path.join(__dirname, '../Frontend');
app.use(express.static(rutaFrontend));

app.use((err, req, res, next) => {
    console.error('Error no manejado:', err);
    if(err.message && err.message.indexOf('CORS bloqueado')!==-1) return res.status(403).json({ success:false, mensaje: err.message });
    res.status(500).json({ success: false, mensaje: 'Error interno del servidor' });
});

// Serverless (Vercel): los timers de backup mantienen vivo el worker; se omiten.
if (!process.env.VERCEL) {
    try {
        require('./services/backup').initAutoBackup();
    } catch (e) {
        console.error('Aviso: no se pudo iniciar backups automáticos:', e.message);
    }
}

// Local/Railway: node Backend/server.js escucha en 0.0.0.0:PORT.
// En Vercel (@vercel/node) el handler importa esta app; no debe
// llamar listen (require.main !== module).
if (require.main === module) {
    app.listen(PUERTO, '0.0.0.0', function() {
        console.log('Servidor iniciado en puerto '+PUERTO+' env='+(process.env.NODE_ENV||'development'));
    });
}

module.exports = app;
