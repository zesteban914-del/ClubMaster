// =========================================================
// Prueba de autenticacion contra MySQL sin tocar .env.
//
//Motivo: cuando la clave falla repetidamente no se puede distinguir
// entre "la clave esta mal" y "el .env la guardo con caracteres de mas".
// Aqui la clave se tipea en el momento, oculta, y se usa tal cual.
//
// Uso:
//   node Backend/scripts/test-db-password.js
//
// Toma host, puerto, usuario y base de DATABASE_URL / DB_* del .env
// (lo mismo que usaria el backend) y solo reemplaza la clave por la
// que ingreses. No escribe nada en disco.
// =========================================================
const path = require('path');
const readline = require('readline');
const mysql = require('mysql2/promise');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const { resolverConexionReal } = require('../config/env');
const { buildPoolConfig } = require('../config/database');

// Pregunta sin eco: lo que se escribe no se ve en pantalla ni queda
// en el historial de la terminal.
function preguntarOculto(rotulo) {
  return new Promise(function (resolver) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true
    });
    const escribirOriginal = rl._writeToOutput;
    rl._writeToOutput = function () { /* no eco */ };
    rl.question(rotulo, function (respuesta) {
      rl._writeToOutput = escribirOriginal;
      rl.output.write('\n');
      rl.close();
      resolver(respuesta);
    });
  });
}

(async function () {
  const c = resolverConexionReal();
  if (!c) {
    console.error('No hay variables de BD en Backend/.env.');
    process.exit(1);
  }
  const cfg = buildPoolConfig('REAL');

  console.log('Configuracion que se va a probar (del .env):');
  console.log('  host   : ' + c.host);
  console.log('  puerto : ' + c.port);
  console.log('  usuario: ' + c.user);
  console.log('  base   : ' + c.database);
  console.log('  ssl    : ' + (cfg.ssl ? 'si' : 'NO (fallara en Railway)'));
  console.log('');
  console.log('Copia la clave desde Railway -> servicio MySQL -> Connect');
  console.log('(o -> Variables, MYSQL_ROOT_PASSWORD). No se muestra al escribir.');

  const clave = await preguntarOculto('Clave de ' + c.user + ': ');
  if (!clave) {
    console.error('Clave vacia: cancelado.');
    process.exit(1);
  }

  console.log('');
  console.log('Clave tipeada: ' + clave.length + ' caracteres.');
  const enUrl = c.password || '';
  if (enUrl && enUrl === clave) {
    console.log('Coincide con la del .env: la clave es correcta, el problema');
    console.log('esta en otro lado (host, base o permiso del usuario).');
  } else if (enUrl) {
    console.log('DIFIERE de la del .env (' + enUrl.length + ' caracteres).');
    console.log('Si esta funciona, el .env tiene la clave vieja o un caracter extra.');
  }

  console.log('');
  console.log('Conectando...');
  let conn;
  try {
    conn = await mysql.createConnection({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: clave,
      database: cfg.database,
      ssl: cfg.ssl,
      connectTimeout: 10000
    });
  } catch (e) {
    console.error('');
    console.error('FALLO: ' + (e.code || e.errno) + ' - ' + e.message);
    if (e.code === 'ER_ACCESS_DENIED_ERROR' || e.errno === 1045) {
      console.error('');
      console.error('La clave ingresada tambien fue rechazada. Entonces el problema');
      console.error('NO es el archivo .env: la clave de root de ese servicio MySQL');
      console.error('es otra, o el host/puerto no corresponde a ese servicio.');
      console.error('');
      console.error('Siguiente paso: crear el servicio backend en Railway con');
      console.error('DATABASE_URL=${{MySQL.MYSQL_URL}} y probar desde su Shell,');
      console.error('donde no se tipea ninguna clave.');
    }
    process.exit(1);
  }

  const [v] = await conn.query('SELECT VERSION() AS v, DATABASE() AS db, CURRENT_USER() AS u');
  console.log('');
  console.log('CONEXION OK');
  console.log('  servidor: ' + v[0].v);
  console.log('  base    : ' + v[0].db);
  console.log('  usuario : ' + v[0].u);

  const [t] = await conn.query(
    'SELECT COUNT(*) AS c FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()'
  );
  console.log('  tablas  : ' + t[0].c);
  if (t[0].c === 0) console.log('  (base vacia: falta correr migrate)');
  await conn.end();
  process.exit(0);
})();
