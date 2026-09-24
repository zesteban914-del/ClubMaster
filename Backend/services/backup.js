const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const BACKUP_DIR = path.join(__dirname, '../../backups');
const RETENCION_DIAS = 7;

function asegurarDirectorio() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function getDbConfig() {
  try {
    const { buildPoolConfig } = require('../config/database');
    const c = buildPoolConfig('REAL');
    return { host: c.host, port: c.port || 3306, user: c.user, password: c.password || '', database: c.database, ssl: c.ssl || undefined };
  } catch (e) {
    return {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'discoteca_db'
    };
  }
}

function getMysqldumpBin() {
  if (process.env.MYSQLDUMP_PATH && fs.existsSync(process.env.MYSQLDUMP_PATH)) return `"${process.env.MYSQLDUMP_PATH}"`;
  if (process.platform === 'win32') {
    const winPath = 'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe';
    if (fs.existsSync(winPath)) return `"${winPath}"`;
  }
  return 'mysqldump';
}

function sslArg(cfg) {
  if (!cfg.ssl) return '';
  if (cfg.ssl.ca && process.env.DB_SSL_CA) return ` --ssl-ca "${String(process.env.DB_SSL_CA).replace(/"/g, '')}"`;
  return ' --ssl-mode=REQUIRED';
}

function nombreArchivo(fecha) {
  const d = fecha || new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `backup-${y}-${m}-${day}.sql`;
}

function limpiarAntiguos() {
  try {
    asegurarDirectorio();
    const ahora = Date.now();
    const limite = RETENCION_DIAS * 24 * 60 * 60 * 1000;
    const files = fs.readdirSync(BACKUP_DIR).filter(f => /^backup-\d{4}-\d{2}-\d{2}\.sql$/.test(f));
    let eliminados = 0;
    for (const f of files) {
      const full = path.join(BACKUP_DIR, f);
      try {
        const stat = fs.statSync(full);
        if (ahora - stat.mtimeMs > limite) {
          fs.unlinkSync(full);
          eliminados++;
        }
      } catch (e) {}
    }
    if (eliminados > 0) console.log(`[backup] Rotación: ${eliminados} backup(s) >${RETENCION_DIAS} días eliminados`);
    return eliminados;
  } catch (e) {
    console.error('[backup] Error en rotación:', e.message);
    return 0;
  }
}

function ejecutarBackup() {
  return new Promise((resolve) => {
    asegurarDirectorio();
    const cfg = getDbConfig();
    const archivo = nombreArchivo();
    const destino = path.join(BACKUP_DIR, archivo);
    const bin = getMysqldumpBin();
    const cmd = `${bin} -h ${cfg.host} -P ${cfg.port} -u ${cfg.user}${sslArg(cfg)} ${cfg.database} > "${destino}"`;
    const env = Object.assign({}, process.env, { MYSQL_PWD: cfg.password });
    exec(cmd, { env, maxBuffer: 500 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        console.error(`[backup] mysqldump falló: ${error.message}${stderr ? ' | ' + String(stderr).slice(0, 300) : ''}`);
        return resolve({ success: false, error: error.message, archivo: null });
      }
      try {
        const stat = fs.statSync(destino);
        if (stat.size === 0) {
          console.error('[backup] Volcado vacío, verifica credenciales DB');
          return resolve({ success: false, error: 'Volcado vacío', archivo: null });
        }
        console.log(`[backup] OK: ${archivo} (${(stat.size / 1024).toFixed(1)} KB)`);
        limpiarAntiguos();
        return resolve({ success: true, archivo: destino });
      } catch (e) {
        console.error('[backup] No se pudo verificar archivo:', e.message);
        return resolve({ success: false, error: e.message, archivo: null });
      }
    });
  });
}

function msHastaProximas4AM() {
  const ahora = new Date();
  const prox = new Date(ahora);
  prox.setHours(4, 0, 0, 0);
  if (prox <= ahora) prox.setDate(prox.getDate() + 1);
  return prox.getTime() - ahora.getTime();
}

let programado = false;

function programarBackupDiario() {
  try {
    let cron = null;
    try { cron = require('node-cron'); } catch (e) { cron = null; }
    if (cron) {
      cron.schedule('0 4 * * *', () => { ejecutarBackup(); });
      console.log('[backup] Programado todos los días 4:00 AM (node-cron)');
      return true;
    }
  } catch (e) {}
  const delay = msHastaProximas4AM();
  const proxima = new Date(Date.now() + delay).toLocaleString('es-CO');
  console.log(`[backup] Programado próximo backup 4:00 AM (${proxima}) con temporizador nativo`);
  setTimeout(() => {
    ejecutarBackup();
    setInterval(() => { ejecutarBackup(); }, 24 * 60 * 60 * 1000);
  }, delay);
  if (typeof setInterval !== 'undefined' && setInterval.unref) {}
  return true;
}

function initAutoBackup() {
  if (programado) return;
  programado = true;
  asegurarDirectorio();
  limpiarAntiguos();
  programarBackupDiario();
}

module.exports = { ejecutarBackup, limpiarAntiguos, programarBackupDiario, initAutoBackup, BACKUP_DIR };
