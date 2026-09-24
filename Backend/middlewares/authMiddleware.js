// =========================================================
// authMiddleware.js
// Middlewares de sesion segura, rate limiting por intentos
// fallidos y control de acceso por rol (RBAC).
// =========================================================
const session = require('express-session');

let MySQLStore = null;
try { MySQLStore = require('express-mysql-session')(session); } catch (e) { MySQLStore = null; }

const SEGUNDOS_BLOQUEO = 15 * 60; // 15 minutos de bloqueo tras exceder intentos
const MAX_INTENTOS_FALLIDOS = 5;  // maximo de intentos fallidos por IP

let _sessionStore = null;
let _storeInitTried = false;
function getSessionStore() {
    if (_storeInitTried) return _sessionStore;
    _storeInitTried = true;
    if (!MySQLStore) { console.warn('[session] express-mysql-session no instalado, usando MemoryStore'); return null; }
    try {
        let opts = null;
        if (process.env.DATABASE_URL) {
            try {
                const u = new URL(process.env.DATABASE_URL);
                opts = { host: u.hostname, port: u.port ? Number(u.port) : 3306, user: decodeURIComponent(u.username), password: decodeURIComponent(u.password), database: u.pathname.replace(/^\//, '').split('?')[0] };
            } catch (e) { opts = null; }
        }
        if (!opts) {
            opts = { host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '', database: process.env.DB_NAME || 'discoteca_db' };
        }
        const storeOpts = Object.assign({}, opts, { createDatabaseTable: true, schema: { tableName: 'sessions', columnNames: { session_id: 'session_id', expires: 'expires', data: 'data' } }, expiration: 1000 * 60 * 60 * 8, checkExpirationInterval: 15 * 60 * 1000 });
        _sessionStore = new MySQLStore(storeOpts);
        _sessionStore.on('error', function (e) { console.error('[session-store]', e.message); });
        return _sessionStore;
    } catch (e) { console.error('[session] no se pudo crear MySQLStore, fallback MemoryStore:', e.message); return null; }
}

// ------------------------------------------------------------------
// Sesion segura: cookie HttpOnly + Secure + SameSite=Strict
// ------------------------------------------------------------------
// 'secure' se activa en produccion (requiere HTTPS). En desarrollo
// local (http://localhost) queda en false para que la cookie funcione.
function crearSesion(secreto) {
    const store = getSessionStore();
    return session({
        name: 'clubmaster.sid',
        secret: secreto,
        resave: false,
        saveUninitialized: false,
        store: store || undefined,
        cookie: {
            httpOnly: true,                       // no accesible desde JavaScript
            secure: process.env.NODE_ENV === 'production', // solo HTTPS en prod
            sameSite: 'strict',                   // mitiga CSRF
            maxAge: 1000 * 60 * 60 * 8            // 8 horas
        }
    });
}

// ------------------------------------------------------------------
// Rate limiting por IP: cuenta SOLO intentos fallidos de login.
// - middlewareRateLimitLogin: comprueba el bloqueo antes de cada request.
// - registrarIntentoFallido(): suma 1 y bloquea al llegar a 5.
// - registrarIntentoExitoso(): reinicia el contador de la IP.
// ------------------------------------------------------------------
const intentosIP = new Map(); // ip -> { contador, bloqueadoHasta, ultimoAcceso }

function obtenerIp(req) {
    const forward = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    return forward || req.ip || req.socket.remoteAddress || 'desconocida';
}

// Middleware: rechaza con 429 si la IP esta temporalmente bloqueada.
function middlewareRateLimitLogin(req, res, next) {
    const ip = obtenerIp(req);
    const registro = intentosIP.get(ip);
    if (registro && registro.bloqueadoHasta && registro.bloqueadoHasta > Date.now()) {
        return res.status(429).json({
            exito: false,
            mensaje: 'Demasiados intentos fallidos. Intenta de nuevo en unos minutos.'
        });
    }
    next();
}

// Suma 1 intento fallido. Al alcanzar el maximo bloquea la IP (15 min).
function registrarIntentoFallido(req) {
    const ip = obtenerIp(req);
    const ahora = Date.now();
    const registro = intentosIP.get(ip) || { contador: 0, bloqueadoHasta: null, ultimoAcceso: ahora };

    // Si un bloqueo previo ya expiro, reinicia el contador.
    if (registro.bloqueadoHasta && registro.bloqueadoHasta <= ahora) {
        registro.contador = 0;
        registro.bloqueadoHasta = null;
    }

    registro.contador += 1;
    registro.ultimoAcceso = ahora;

    if (registro.contador >= MAX_INTENTOS_FALLIDOS) {
        registro.bloqueadoHasta = ahora + SEGUNDOS_BLOQUEO * 1000;
    }
    intentosIP.set(ip, registro);
}

// Reinicia el contador de una IP ante un inicio de sesion exitoso.
function registrarIntentoExitoso(req) {
    intentosIP.delete(obtenerIp(req));
}

// Limpieza periodica de registros antiguos (evita fuga de memoria).
setInterval(() => {
    const ahora = Date.now();
    for (const [ip, reg] of intentosIP.entries()) {
        const bloqueoExpirado = reg.bloqueadoHasta && reg.bloqueadoHasta <= ahora;
        const inactivo = (ahora - reg.ultimoAcceso) > 60 * 60 * 1000;
        if (bloqueoExpirado || inactivo) intentosIP.delete(ip);
    }
}, 60 * 1000);

// ------------------------------------------------------------------
// Autenticacion: solo usuarios con sesion valida
// ------------------------------------------------------------------
function requiereAutenticacion(req, res, next) {
    if (req.session && req.session.usuario) {
        return next();
    }
    return res.status(401).json({ exito: false, mensaje: 'No autenticado. Inicia sesion.' });
}

// ------------------------------------------------------------------
// RBAC: solo permite pasar si el rol esta en la lista permitida
// Uso: app.post('/ruta', requireRole('Administrador', 'Gerente'), handler)
// ------------------------------------------------------------------
function requireRole(...rolesPermitidos) {
    return (req, res, next) => {
        const rol = req.session && req.session.usuario && req.session.usuario.rol;
        if (!rol) {
            return res.status(401).json({ exito: false, mensaje: 'No autenticado.' });
        }
        if (rolesPermitidos.includes(rol)) {
            return next();
        }
        return res.status(403).json({ exito: false, mensaje: 'Sin permisos de acceso.' });
    };
}

function esAdminSesion(req) {
    const u = req.session && req.session.usuario;
    if (!u) return false;
    if (Number(u.id_rol) === 1) return true;
    const r = String(u.rol || '').toLowerCase();
    return r === 'administrador' || r === 'admin';
}

function esRolCaja(req) {
    const u = req.session && req.session.usuario;
    if (!u) return false;
    const r = String(u.rol || '').toLowerCase();
    return r.indexOf('cajer') !== -1;
}

function esBartenderSesion(req) {
    const u = req.session && req.session.usuario;
    if (!u) return false;
    const r = String(u.rol || '').toLowerCase();
    return r.indexOf('bartender') !== -1 || r.indexOf('barman') !== -1;
}

// Bloquea al Admin en operaciones de caja: solo Cajero.
function soloCajaOperativa(req, res, next) {
    const u = req.session && req.session.usuario;
    if (!u) {
        return res.status(401).json({ exito: false, success: false, mensaje: 'No autenticado. Inicia sesion.' });
    }
    if (esAdminSesion(req)) {
        return res.status(403).json({ exito: false, success: false, mensaje: 'Prohibido: el rol Administrador no puede operar la caja registradora (solo lectura).' });
    }
    if (esRolCaja(req)) return next();
    return res.status(403).json({ exito: false, success: false, mensaje: 'Solo el rol Cajero puede operar la caja.' });
}

// Bloquea al Admin pero permite al resto de roles operativos.
function bloquearAdmin(req, res, next) {
    const u = req.session && req.session.usuario;
    if (!u) {
        return res.status(401).json({ exito: false, success: false, mensaje: 'No autenticado. Inicia sesion.' });
    }
    if (esAdminSesion(req)) {
        return res.status(403).json({ exito: false, success: false, mensaje: 'Prohibido para el rol Administrador.' });
    }
    return next();
}

function soloAdmin(req, res, next) {
    const u = req.session && req.session.usuario;
    if (!u) {
        return res.status(401).json({ exito: false, success: false, mensaje: 'No autenticado. Inicia sesion.' });
    }
    if (esAdminSesion(req)) return next();
    return res.status(403).json({ exito: false, success: false, mensaje: 'Solo el rol Administrador puede realizar esta accion.' });
}

function requierePermiso(codigo) {
    return async (req, res, next) => {
        try {
            const u = req.session && req.session.usuario;
            if (!u) {
                return res.status(401).json({ exito: false, success: false, mensaje: 'No autenticado. Inicia sesion.' });
            }
            if (Number(u.id_rol) === 1) return next();
            const rol = String(u.rol || '').toLowerCase();
            if (rol === 'administrador' || rol === 'admin') return next();
            if (Array.isArray(u.permisos) && u.permisos.indexOf(codigo) !== -1) return next();
            if (u.id_rol) {
                try {
                    const { poolReal } = require('../config/database');
                    const pr = await poolReal.query('SELECT id_permiso FROM permisos WHERE codigo = ? LIMIT 1', [codigo]);
                    if (pr[0].length) {
                        const rows = await poolReal.query('SELECT 1 AS ok FROM rol_permisos WHERE id_rol = ? AND id_permiso = ? LIMIT 1', [u.id_rol, pr[0][0].id_permiso]);
                        if (rows[0].length) return next();
                    }
                } catch (e) {}
            }
            return res.status(403).json({ exito: false, success: false, mensaje: 'Sin permiso: se requiere ' + codigo });
        } catch (e) {
            return res.status(403).json({ exito: false, success: false, mensaje: 'Sin permiso.' });
        }
    };
}

module.exports = {
    SEGUNDOS_BLOQUEO,
    MAX_INTENTOS_FALLIDOS,
    crearSesion,
    middlewareRateLimitLogin,
    registrarIntentoFallido,
    registrarIntentoExitoso,
    requiereAutenticacion,
    requireRole,
    requierePermiso,
    soloCajaOperativa,
    bloquearAdmin,
    soloAdmin,
    esAdminSesion,
    esRolCaja,
    esBartenderSesion
};
