const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');
const { sslConfigFor } = require('../config/database');
async function apply() {
  const adminCfg = {
    host: process.env.DB_ADMIN_HOST || process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_ADMIN_PORT || process.env.DB_PORT || 3306),
    user: process.env.DB_ADMIN_USER,
    password: process.env.DB_ADMIN_PASSWORD,
    database: process.env.DB_NAME || 'discoteca_db'
  };
  const ssl = sslConfigFor(adminCfg.host, 'REAL');
  if (ssl) adminCfg.ssl = ssl;
  const appUser = process.env.DB_USER || 'root';
  const appHost = process.env.DB_APP_HOST || '%';
  if (!adminCfg.user || !adminCfg.password) {
    console.error('Define DB_ADMIN_USER y DB_ADMIN_PASSWORD (usuario root/admin) para aplicar REVOKE.');
    console.error('Ver Backend/scripts/audit-append-only.sql para el SQL manual.');
    process.exit(1);
  }
  const conn = await mysql.createConnection(adminCfg);
  try {
    const db = adminCfg.database.replace(/`/g, '');
    for (const t of ['audit_logs', 'auditoria_incidencias']) {
      const sql = `REVOKE UPDATE, DELETE ON \`${db}\`.\`${t}\` FROM \`${appUser}\`@\`${appHost}\``;
      try { await conn.query(sql); console.log('OK ' + sql); }
      catch (e) { console.log('Aviso ' + t + ': ' + e.message); }
    }
    await conn.query('FLUSH PRIVILEGES');
    console.log('Privilegios aplicados. Verifica con la conexion de la app que DELETE/UPDATE fallen con ERROR 1142.');
  } finally { await conn.end(); }
}
if (require.main === module) apply();
module.exports = { apply };
