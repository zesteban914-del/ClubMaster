const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
function genHex(n) { return crypto.randomBytes(n).toString('hex'); }
function genPass(n) { return crypto.randomBytes(n).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, n); }
const secrets = {
  DB_PASSWORD: genPass(24),
  SESSION_SECRET: genHex(32),
  SMTP_PASS: genPass(20),
  EMAIL_PASS: null
};
secrets.EMAIL_PASS = secrets.SMTP_PASS;
console.log('=== Nuevos secretos generados (NO commitear) ===');
console.log('DB_PASSWORD=' + secrets.DB_PASSWORD);
console.log('SESSION_SECRET=' + secrets.SESSION_SECRET);
console.log('SMTP_PASS=' + secrets.SMTP_PASS);
console.log('EMAIL_PASS=' + secrets.SMTP_PASS);
console.log('');
console.log('Pasos obligatorios:');
console.log('1. Cambia la contrasena en el proveedor MySQL (ALTER USER o panel) y en todos los .env donde corre el backend.');
console.log('2. Reemplaza SESSION_SECRET en todos los entornos y reinicia el servicio (invalida sesiones).');
console.log('3. Genera una nueva App Password en el proveedor SMTP (Gmail: Cuenta > Seguridad > Contrasenas de aplicaciones), actualiza SMTP_PASS/EMAIL_PASS y REVOCA la anterior.');
console.log('4. Reinicia el backend y verifica: login, consulta DB, envio de correo de prueba.');
console.log('5. Confirma que las credenciales viejas ya no autentican (intento de conexion debe fallar).');
if (process.argv.includes('--apply')) {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) { console.error('.env no encontrado en ' + envPath); process.exit(1); }
  let content = fs.readFileSync(envPath, 'utf8');
  const set = (k, v) => {
    const re = new RegExp('^' + k + '=.*$', 'm');
    if (re.test(content)) content = content.replace(re, k + '=' + v);
    else content += '\n' + k + '=' + v + '\n';
  };
  set('DB_PASSWORD', secrets.DB_PASSWORD);
  set('SESSION_SECRET', secrets.SESSION_SECRET);
  set('SMTP_PASS', secrets.SMTP_PASS);
  set('EMAIL_PASS', secrets.SMTP_PASS);
  fs.writeFileSync(envPath + '.bak-' + Date.now(), fs.readFileSync(envPath));
  fs.writeFileSync(envPath, content);
  console.log('Backend/.env actualizado (backup .bak creado). Falta: cambiar en proveedor MySQL/SMTP, revocar viejas y reiniciar.');
} else {
  console.log('');
  console.log('Para escribir en Backend/.env (con backup) corre: node Backend/scripts/rotate-secrets.js --apply');
}
