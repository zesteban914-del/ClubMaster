let speakeasy = null;
try { speakeasy = require('speakeasy'); } catch (e) { speakeasy = null; }
async function ensureTotpColumns(pool) {
  try { await pool.query(`SELECT totp_secret FROM usuarios LIMIT 0`); }
  catch (e) {
    try { await pool.query(`ALTER TABLE usuarios ADD COLUMN totp_secret VARCHAR(64) NULL`); } catch (e2) {}
    try { await pool.query(`ALTER TABLE usuarios ADD COLUMN totp_enabled TINYINT(1) NOT NULL DEFAULT 0`); } catch (e2) {}
  }
  try { await pool.query(`SELECT totp_enabled FROM usuarios LIMIT 0`); }
  catch (e) { try { await pool.query(`ALTER TABLE usuarios ADD COLUMN totp_enabled TINYINT(1) NOT NULL DEFAULT 0`); } catch (e2) {} }
}
function getCode(req) {
  if (!req) return '';
  const b = req.body || {};
  const h = req.headers || {};
  return String(b.totp_code || b.totp || b.codigo_totp || b.otp || h['x-totp-code'] || h['x-totp'] || '').trim();
}
async function isTotpEnabledForUser(pool, idUsuario) {
  if (!idUsuario) return false;
  try {
    await ensureTotpColumns(pool);
    const [rows] = await pool.query('SELECT totp_secret, totp_enabled FROM usuarios WHERE id_usuario=?', [idUsuario]);
    if (!rows.length) return false;
    return Number(rows[0].totp_enabled) === 1 && !!rows[0].totp_secret;
  } catch (e) { return false; }
}
async function verifyCodeForUser(pool, idUsuario, code) {
  if (!speakeasy) return { ok: false, error: 'speakeasy no instalado (npm i speakeasy qrcode)' };
  await ensureTotpColumns(pool);
  const [rows] = await pool.query('SELECT totp_secret FROM usuarios WHERE id_usuario=?', [idUsuario]);
  if (!rows.length || !rows[0].totp_secret) return { ok: false, error: '2FA no configurado' };
  const ok = speakeasy.totp.verify({ secret: rows[0].totp_secret, encoding: 'base32', token: String(code || '').trim(), window: 1 });
  return { ok: !!ok };
}
function requireTotpForHighRisk(pool) {
  return async function (req, res, next) {
    try {
      const body = req.body || {};
      const idUsuario = body.id_usuario || body.id_usuario_cierre || (req.session && req.session.usuario && req.session.usuario.id_usuario) || null;
      if (!idUsuario) return res.status(401).json({ success: false, mensaje: 'Sesion o id_usuario requerido para accion de alto riesgo' });
      const enabled = await isTotpEnabledForUser(pool, idUsuario);
      if (!enabled) return next();
      const code = getCode(req);
      if (!code) return res.status(403).json({ success: false, mensaje: 'Se requiere codigo TOTP para esta accion de alto riesgo' });
      const v = await verifyCodeForUser(pool, idUsuario, code);
      if (!v.ok) return res.status(403).json({ success: false, mensaje: 'Codigo TOTP invalido' });
      return next();
    } catch (e) { return res.status(500).json({ success: false, mensaje: 'Error 2FA: ' + e.message }); }
  };
}
module.exports = { ensureTotpColumns, getCode, isTotpEnabledForUser, verifyCodeForUser, requireTotpForHighRisk };
