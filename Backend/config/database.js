const mysql = require('mysql2/promise');
const { AsyncLocalStorage } = require('async_hooks');

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

function buildPoolConfig(prefix) {
  const urlVar = prefix === 'DEMO' ? process.env.DATABASE_URL_DEMO : process.env.DATABASE_URL;
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
        ssl: /true|1/i.test(process.env.DB_SSL || '') || /planetscale|aiven|railway|render/i.test(urlVar) ? { rejectUnauthorized: false } : undefined,
      };
    }
  }
  const pfx = prefix === 'DEMO' ? 'DEMO_' : '';
  const hostKey = `DB_${pfx}HOST`;
  const userKey = `DB_${pfx}USER`;
  const passKey = `DB_${pfx}PASSWORD`;
  const nameKey = `DB_${pfx}NAME`;
  const portKey = `DB_${pfx}PORT`;
  const sslEnv = process.env[`DB_${pfx}SSL`] || process.env.DB_SSL || '';
  const host = process.env[hostKey] || process.env.DB_HOST || (prefix === 'DEMO' ? 'localhost' : undefined);
  if (!host && prefix !== 'DEMO') {
    console.warn('[DB] DB_HOST/DATABASE_URL no definido — usando localhost solo para desarrollo');
  }
  const cfg = {
    host: host || 'localhost',
    port: Number(process.env[portKey] || process.env.DB_PORT || 3306),
    user: process.env[userKey] || process.env.DB_USER || 'root',
    password: process.env[passKey] || process.env.DB_PASSWORD || '',
    database: process.env[nameKey] || process.env.DB_NAME || (prefix === 'DEMO' ? 'discoteca_db_demo' : 'discoteca_db'),
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_POOL_LIMIT || (prefix === 'DEMO' ? 5 : 20)),
    queueLimit: Number(process.env.DB_QUEUE_LIMIT || 50),
    connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT || 10000),
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    idleTimeout: 60000,
    maxIdle: Number(process.env.DB_MAX_IDLE || 10),
  };
  if (!cfg.password) console.warn(`[DB] ${passKey}/DB_PASSWORD vacio — verifica tu .env en produccion`);
  if (/true|1/i.test(sslEnv)) cfg.ssl = { rejectUnauthorized: false };
  return cfg;
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
module.exports = { pool, poolReal, poolDemo, demoStorage, isDemoActive, getPool, buildPoolConfig };
