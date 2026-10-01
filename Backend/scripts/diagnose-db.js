// =========================================================
// Diagnostico de conexion a MySQL.
// NO imprime contrasenas ni URLs completas.
//
// Uso:
//   node Backend/scripts/diagnose-db.js            solo prueba la conexion
//   node Backend/scripts/diagnose-db.js --migrate  prueba + ejecuta migrate
//
// Que muestra, en orden:
//   1) Si el shell trae variables de BD (ganan sobre .env)
//   2) Que fuente de configuracion gana: DATABASE_URL > MYSQL_URL > DB_*
//   3) El pool exacto que se le pasa a mysql2 (incluido el bloque ssl)
//   4) La prueba real de conexion + tablas y conteos
//   5) migrate, si se pidio con --migrate
// =========================================================
const path = require('path');
const mysql = require('mysql2/promise');

// --- 1. Detectar override del shell ANTES de cargar dotenv ---
// dotenv NO sobreescribe: si exportaste DATABASE_URL en PowerShell,
// esa gana sobre Backend/.env en silencio y el 1045 no se explica.
const shellOverride = [];
['DATABASE_URL', 'MYSQL_URL', 'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'DB_PORT']
  .forEach(function (k) { if (process.env[k]) shellOverride.push(k); });

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const { resolverConexionReal, EN_RAILWAY } = require('../config/env');
const { buildPoolConfig } = require('../config/database');

function formaLarga(s) {
  if (!s) return '(vacia)';
  return s.length <= 4 ? '****' : '**** (' + s.length + ' caracteres)';
}

function contarTablas(conn) {
  return conn.query(
    'SELECT TABLE_NAME AS n FROM information_schema.TABLES ' +
    'WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME'
  ).then(function (r) {
    if (!r[0].length) return Promise.resolve([]);
    return r[0].reduce(function (cadena, fila) {
      return cadena.then(function (acc) {
        return conn.query('SELECT COUNT(*) AS c FROM `' + fila.n + '`').then(function (n) {
          acc.push([fila.n, n[0].c]);
          return acc;
        });
      });
    }, Promise.resolve([]));
  });
}

(async function () {
  console.log('=== 1. Variables de entorno ===');
  if (shellOverride.length) {
    console.log('AVISO: el shell ya traia ' + shellOverride.join(', '));
    console.log('       dotenv NO las sobreescribe: ganan sobre Backend/.env.');
    console.log('       Cierra esta terminal y abre otra, o ejecuta:');
    console.log('       Remove-Item Env:\\DATABASE_URL');
  } else {
    console.log('OK: ninguna variable de BD viene del shell (solo de .env).');
  }

  const c = resolverConexionReal();
  if (!c) {
    console.error('\nFATAL: no hay ninguna variable de BD configurada.');
    process.exit(1);
  }

  console.log('\n=== 2. Fuente de configuracion que GANA ===');
  console.log('origen : ' + c.origen);
  console.log('host   : ' + c.host);
  console.log('puerto : ' + c.port);
  console.log('usuario: ' + c.user);
  console.log('base   : ' + c.database);
  console.log('clave  : ' + formaLarga(c.password));
  if (c.origen.indexOf('DATABASE_URL') === 0) {
    console.log('');
    console.log('AVISO: gana DATABASE_URL, asi que DB_USER / DB_PASSWORD / DB_NAME');
    console.log('       NO se usan. Si cambias la clave en el panel de Railway y');
    console.log('       solo editas DB_PASSWORD, el error 1045 se mantiene igual.');
  }

  const cfg = buildPoolConfig('REAL');
  console.log('\n=== 3. Pool que construira mysql2 ===');
  console.log('ssl    : ' + (cfg.ssl ? JSON.stringify(cfg.ssl) : 'DESHABILITADO (fallara en Railway)'));
  console.log('Railway en el entorno: ' + (EN_RAILWAY ? 'si' : 'no'));
  if (!cfg.ssl) {
    console.log('AVISO: sin SSL. En Railway define DB_SSL=true.');
  }

  console.log('\n=== 4. Prueba de conexion ===');
  const conn = await mysql.createConnection({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    ssl: cfg.ssl,
    connectTimeout: 10000
  });
  const [v] = await conn.query('SELECT VERSION() AS v, DATABASE() AS db, CURRENT_USER() AS u');
  console.log('CONEXION OK');
  console.log('  servidor: ' + v[0].v);
  console.log('  base    : ' + v[0].db);
  console.log('  usuario : ' + v[0].u);

  const tablas = await contarTablas(conn);
  console.log('  tablas  : ' + tablas.length);
  if (!tablas.length) {
    console.log('  (base vacia: el esquema nunca se creo)');
  } else {
    tablas.forEach(function (t) {
      console.log('    ' + String(t[0]).padEnd(30) + t[1]);
    });
  }
  await conn.end();

  if (process.argv.indexOf('--migrate') === -1) {
    console.log('\nPara probar + migrar: node Backend/scripts/diagnose-db.js --migrate');
    process.exit(0);
  }

  console.log('\n=== 5. Ejecutando migrate ===');
  const { migrate } = require('./migrate');
  await migrate();
  console.log('MIGRACION OK');
  process.exit(0);
})().catch(function (e) {
  console.error('\n=== FALLO ===');
  console.error('codigo : ' + (e.code || e.errno || '(sin codigo)'));
  console.error('mensaje: ' + e.message);
  if (e.config) {
    console.error('  usuario: ' + e.config.user);
    console.error('  host   : ' + e.config.host + ':' + e.config.port);
    console.error('  base   : ' + e.config.database);
  }
  if (e.code === 'ER_ACCESS_DENIED_ERROR' || e.errno === 1045) {
    console.error('');
    console.error('DIAGNOSTICO: la CONTRASENA es incorrecta. No es SSL ni red.');
    console.error('  Revisa en Railway -> servicio MySQL -> Connect o Variables.');
    console.error('  Compara host, puerto y clave con los de la seccion 2.');
  } else if (e.code === 'ECONNREFUSED' || e.code === 'ETIMEDOUT' || e.code === 'ENOTFOUND') {
    console.error('');
    console.error('DIAGNOSTICO: no hay respuesta de red. Revisa host/puerto y');
    console.error('  que Public Proxying este Enabled en el servicio MySQL.');
  }
  process.exit(1);
});
