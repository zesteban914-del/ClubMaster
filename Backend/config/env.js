// =========================================================
// env.js
// Carga los .env y centraliza la lectura de variables de
// entorno: conexion MySQL, CORS, puerto y validaciones de
// arranque. Ningun otro archivo debe leer process.env.DB_* /
// MYSQL* directamente.
//
// ORDEN DE LECTURA DE LA CONEXION A MYSQL (el primero gana):
//   1) DATABASE_URL
//   2) MYSQL_URL
//   3) Variables sueltas: DB_HOST / DB_PORT / DB_USER /
//      DB_PASSWORD / DB_NAME   o   MYSQLHOST / MYSQLPORT /
//      MYSQLUSER / MYSQLPASSWORD / MYSQLDATABASE
//
// IMPORTANTE (Railway): el servicio MySQL NO crea DATABASE_URL.
// Expone MYSQL_URL (red interna), MYSQL_PUBLIC_URL (proxy
// publico, para scripts desde tu PC) y las variables sueltas
// MYSQLHOST, MYSQLPORT, MYSQLUSER, MYSQLPASSWORD, MYSQLDATABASE.
//
// Las claves NUNCA se imprimen en los logs.
// =========================================================
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

// Estamos corriendo dentro de Railway? (para distinguir la URL
// interna *.railway.internal, que solo resuelve alli).
const EN_RAILWAY = Boolean(
    process.env.RAILWAY_ENVIRONMENT ||
    process.env.RAILWAY_PROJECT_ID ||
    process.env.RAILWAY_SERVICE_ID
);

// Valor de ejemplo de .env.example; si sigue igual en produccion, no arranca.
const JWT_SECRET_EJEMPLO = 'cambia_esto_por_un_jwt_largo_64_chars_min';
const SESSION_SECRET_EJEMPLO = 'cambia_esto_por_un_hash_largo_64_chars_min';

function esProduccion() {
    return process.env.NODE_ENV === 'production';
}

// Termina el proceso con un mensaje en español. Nunca recibe claves.
function fallar(mensaje) {
    console.error('FATAL: ' + mensaje);
    process.exit(1);
}

function parseUrlMySQL(url) {
    try {
        const u = new URL(url);
        if (!u.hostname) return null;
        return {
            host: u.hostname,
            port: u.port ? Number(u.port) : 3306,
            user: decodeURIComponent(u.username || ''),
            password: decodeURIComponent(u.password || ''),
            database: (u.pathname || '').replace(/^\//, '').split('?')[0]
        };
    } catch (e) {
        return null;
    }
}

function desdeUrl(etiqueta, url) {
    const p = parseUrlMySQL(url);
    if (!p || !p.database) {
        fallar(etiqueta + ' no es una URL MySQL valida (formato mysql://usuario:clave@host:puerto/base). Corrigela; la clave no se imprimira.');
    }
    return { origen: etiqueta, url: url, host: p.host, port: p.port, user: p.user, password: p.password, database: p.database };
}

function desdeVariablesSueltas() {
    const host = process.env.DB_HOST || process.env.MYSQLHOST || '';
    if (!host) return null;
    return {
        origen: 'variables sueltas (DB_* / MYSQL*)',
        url: '',
        host: host,
        port: Number(process.env.DB_PORT || process.env.MYSQLPORT || 3306),
        user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
        password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
        database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'discoteca_db'
    };
}

// Devuelve la conexion REAL resuelta o null si no hay ninguna configuracion.
function resolverConexionReal() {
    const url = String(process.env.DATABASE_URL || '').trim();
    if (url) return desdeUrl('DATABASE_URL', url);
    const mysqlUrl = String(process.env.MYSQL_URL || '').trim();
    if (mysqlUrl) return desdeUrl('MYSQL_URL', mysqlUrl);
    return desdeVariablesSueltas();
}

// Como resolverConexionReal, pero si no hay nada termina el proceso
// indicando en español que variable falta. (Usado por el pool REAL.)
function exigirConexionReal() {
    const c = resolverConexionReal();
    if (!c) {
        fallar(
            'Falta la configuracion de MySQL. Define una de estas opciones:\n' +
            '  1) DATABASE_URL = mysql://usuario:clave@host:puerto/base  (desde tu PC usa MYSQL_PUBLIC_URL del servicio MySQL de Railway)\n' +
            '  2) MYSQL_URL    = referencia ${{MySQL.MYSQL_URL}} del servicio MySQL en Railway\n' +
            '  3) DB_HOST + DB_PORT + DB_USER + DB_PASSWORD + DB_NAME  (o MYSQLHOST + MYSQLPORT + MYSQLUSER + MYSQLPASSWORD + MYSQLDATABASE)'
        );
    }
    return c;
}

function nombreBaseDatosReal() {
    const c = resolverConexionReal();
    if (c) return c.database;
    return process.env.DB_NAME || process.env.MYSQLDATABASE || 'discoteca_db';
}

function hostEsLocal(host) {
    return !host || host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

// La URL interna de Railway (*.railway.internal) solo resuelve dentro de
// Railway. Si un script corre fuera (tu PC) con esa URL, se detiene.
function verificarNoUrlInternaRailway() {
    const c = resolverConexionReal();
    const host = c ? String(c.host) : '';
    if (host && /\.railway\.internal$/i.test(host) && !EN_RAILWAY) {
        fallar('Usaste la URL interna. Desde tu PC usa MYSQL_PUBLIC_URL del servicio MySQL en Railway.');
    }
}

// CORS_ORIGINS: lista separada por comas; quita espacios y "/" final.
function origenesCorsPermitidos() {
    return String(process.env.CORS_ORIGINS || '')
        .split(',')
        .map(function(s){ return s.trim().replace(/\/+$/, ''); })
        .filter(Boolean);
}

// Valida CORS al arrancar: nunca "*", y en produccion no puede venir vacio.
function validarCorsAlArrancar() {
    const lista = origenesCorsPermitidos();
    if (lista.indexOf('*') !== -1) {
        fallar('CORS_ORIGINS no puede contener "*". Define origenes explicitos separados por coma (ej: https://club-master-git-main-esteban-90eb.vercel.app).');
    }
    if (esProduccion() && lista.length === 0) {
        fallar('Falta CORS_ORIGINS en produccion. Define la URL del frontend separada por comas, sin "/" final (ej: https://club-master-git-main-esteban-90eb.vercel.app).');
    }
    return lista;
}

// En produccion JWT_SECRET es obligatorio, >=32 chars y distinto del ejemplo.
function validarJwtAlArrancar() {
    if (!esProduccion()) return;
    const v = process.env.JWT_SECRET || '';
    if (!v) fallar('Falta JWT_SECRET en produccion (minimo 32 caracteres). Genera uno con: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    if (v.length < 32) fallar('JWT_SECRET debe tener al menos 32 caracteres en produccion.');
    if (v === JWT_SECRET_EJEMPLO) fallar('JWT_SECRET sigue con el valor de ejemplo de .env.example; genera uno nuevo.');
}

function validarSessionSecretAlArrancar() {
    if (!esProduccion()) return;
    const v = process.env.SESSION_SECRET || '';
    if (!v || v === SESSION_SECRET_EJEMPLO) fallar('Falta SESSION_SECRET en produccion (minimo 32 caracteres). Genera uno con: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    if (v.length < 32) fallar('SESSION_SECRET debe tener al menos 32 caracteres en produccion.');
}

// Secreto de la cookie de sesion.
// En produccion es obligatorio: validarSessionSecretAlArrancar() ya
// termina el proceso si falta, es corto o sigue con el valor de ejemplo,
// asi que aqui nunca se devuelve un valor de relleno.
// En desarrollo, si no hay SESSION_SECRET, se genera uno aleatorio SOLO
// para este proceso (evita el fallback fijo compartido, que permitiria
// falsificar cookies; reiniciar el servidor invalida las sesiones de
// desarrollo, sin impacto en datos).
function secretSesion() {
    const v = process.env.SESSION_SECRET || '';
    if (v) return v;
    if (esProduccion()) {
        fallar('Falta SESSION_SECRET en produccion (minimo 32 caracteres).');
    }
    return require('crypto').randomBytes(32).toString('hex');
}

// Puerto: process.env.PORT siempre manda. El valor por defecto (3000)
// aplica SOLO en desarrollo; en produccion PORT es obligatorio
// (Railway lo inyecta automaticamente si no lo fijas).
function puerto() {
    const crudo = process.env.PORT;
    if (crudo !== undefined && crudo !== '') {
        const n = Number(crudo);
        if (!Number.isInteger(n) || n <= 0 || n > 65535) {
            fallar('PORT debe ser un numero de puerto valido (1-65535). Valor recibido: ' + crudo);
        }
        return n;
    }
    if (esProduccion()) {
        fallar('Falta PORT en produccion. Railway inyecta PORT automaticamente; si lo desactivaste, define PORT=3000.');
    }
    return 3000;
}

module.exports = {
    EN_RAILWAY,
    esProduccion,
    fallar,
    parseUrlMySQL,
    resolverConexionReal,
    exigirConexionReal,
    nombreBaseDatosReal,
    hostEsLocal,
    verificarNoUrlInternaRailway,
    origenesCorsPermitidos,
    validarCorsAlArrancar,
    validarJwtAlArrancar,
    validarSessionSecretAlArrancar,
    secretSesion,
    puerto
};
