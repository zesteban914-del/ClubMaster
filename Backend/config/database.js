const mysql = require('mysql2/promise');
const fs = require('fs');
const { AsyncLocalStorage } = require('async_hooks');
const { exigirConexionReal } = require('./env');

function parseDatabaseUrl(url) {
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: u.port ? Number(u.port) : 3306,
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: u.pathname.replace(/^\//, '').split('?')[0],
    };
  } catch (e) { return null; }
}

// Lee el certificado CA desde DB_SSL_CA (path o contenido PEM) para
// proveedores como Aiven que exigen verificar la cadena de certificados.
function readCaCert(prefix) {
  const pfx = prefix === 'DEMO' ? 'DEMO_' : '';
  const raw = process.env[`DB_${pfx}SSL_CA`] || process.env.DB_SSL_CA;
  if (!raw) return null;
  const content = raw.trim().startsWith('-----BEGIN') ? raw : (function () {
    try { return fs.readFileSync(raw, 'utf8'); } catch (e) { console.warn(`[DB] No se pudo leer DB_SSL_CA "${raw}": ${e.message}`); return null; }
  })();
  return content;
}

// Normaliza cómo habilitar SSL/TSL hacia la BD (muy común en nubes:
// Railway, Clever Cloud, Aiven, PlanetScale, Render, etc.).
function sslConfigFor(urlVar, prefix) {
  const pfx = prefix === 'DEMO' ? 'DEMO_' : '';
  const sslEnv = String(process.env[`DB_${pfx}SSL`] || process.env.DB_SSL || '').toLowerCase();
  let sslModeUrl = '';
  try { sslModeUrl = String(new URL(urlVar || '').searchParams.get('ssl-mode') || '').toLowerCase(); } catch (e) {}
  const hostsConSSL = /planetscale|aiven|railway|rlwy|render|clever|freesqldatabase/i.test(urlVar || '');
  const enabled = /^(true|1|required|verify-ca|verify-identity)$/.test(sslEnv) ||
                  hostsConSSL ||
                  ['required', 'verify-ca', 'verify-identity'].indexOf(sslModeUrl) !== -1;
  if (!enabled) return undefined;
  const ca = readCaCert(prefix);
  if (ca) return { ca };
  return { rejectUnauthorized: false };
}

// Pool REAL: la resolucion de la conexion esta centralizada en
// config/env.js (DATABASE_URL -> MYSQL_URL -> DB_* / MYSQL*).
// Si no hay ninguna configuracion, exigirConexionReal() termina el
// proceso con un mensaje en español indicando que variable falta.
function buildPoolRealConfig() {
  const c = exigirConexionReal();
  const cfg = {
    host: c.host,
    port: c.port || 3306,
    user: c.user,
    password: c.password,
    database: c.database,
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_POOL_LIMIT || 20),
    queueLimit: Number(process.env.DB_QUEUE_LIMIT || 50),
    connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT || 10000),
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    idleTimeout: 60000,
    maxIdle: Number(process.env.DB_MAX_IDLE || 10),
  };
  const ssl = sslConfigFor(c.url || c.host, 'REAL');
  if (ssl) cfg.ssl = ssl;
  if (!cfg.password) console.warn('[DB] La contrasena de BD esta vacia (DB_PASSWORD / MYSQLPASSWORD o la URL) — revisa tu .env en produccion. La clave nunca se imprime en logs.');
  return cfg;
}

// Pool DEMO: comportamiento actual (DATABASE_URL_DEMO / DB_DEMO_* / localhost).
function buildPoolDemoConfig() {
  const urlVar = process.env.DATABASE_URL_DEMO;
  if (urlVar) {
    const parsed = parseDatabaseUrl(urlVar);
    if (parsed) {
      return {
        host: parsed.host,
        port: parsed.port,
        user: parsed.user,
        password: parsed.password,
        database: parsed.database,
        waitForConnections: true,
        connectionLimit: Number(process.env.DB_POOL_LIMIT || 20),
        queueLimit: Number(process.env.DB_QUEUE_LIMIT || 50),
        connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT || 10000),
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
        idleTimeout: 60000,
        maxIdle: Number(process.env.DB_MAX_IDLE || 10),
        ssl: sslConfigFor(urlVar, 'DEMO'),
      };
    }
  }
  const cfg = {
    host: process.env.DB_DEMO_HOST || process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_DEMO_PORT || process.env.DB_PORT || 3306),
    user: process.env.DB_DEMO_USER || process.env.DB_USER || 'root',
    password: process.env.DB_DEMO_PASSWORD || process.env.DB_PASSWORD || '',
    database: process.env.DB_DEMO_NAME || process.env.DB_NAME || 'discoteca_db_demo',
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_POOL_LIMIT || 5),
    queueLimit: Number(process.env.DB_QUEUE_LIMIT || 50),
    connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT || 10000),
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    idleTimeout: 60000,
    maxIdle: Number(process.env.DB_MAX_IDLE || 10),
  };
  const ssl = sslConfigFor('', 'DEMO');
  if (ssl) cfg.ssl = ssl;
  return cfg;
}

function buildPoolConfig(prefix) {
  return prefix === 'DEMO' ? buildPoolDemoConfig() : buildPoolRealConfig();
}

const poolReal = mysql.createPool(buildPoolConfig('REAL'));
const poolDemo = mysql.createPool(buildPoolConfig('DEMO'));
for (const p of [poolReal, poolDemo]) {
  p.on('error', function(err) { console.error('[DB pool error]', err && err.message ? err.message : err); });
}

const demoStorage = new AsyncLocalStorage();
function isDemoActive(){
  if(process.env.DEMO_MODE==='true') return true;
  try{ const s=demoStorage.getStore(); return !!(s && s.isDemo); }catch(e){ return false; }
}
function getPool(){ return isDemoActive() ? poolDemo : poolReal; }
const pool = new Proxy(poolReal, {
  get(target, prop){
    if(prop==='isDemoActive' || prop==='demoStorage' || prop==='getPool') return target[prop];
    const active = isDemoActive();
    const targetPool = active ? poolDemo : poolReal;
    const val = targetPool[prop];
    if(typeof val==='function') return val.bind(targetPool);
    return val;
  }
});
module.exports = { pool, poolReal, poolDemo, demoStorage, isDemoActive, getPool, buildPoolConfig, sslConfigFor };
