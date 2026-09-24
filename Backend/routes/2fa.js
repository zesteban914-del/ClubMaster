module.exports = function(app, db) {
  const totp = require('../middlewares/totp');
  let speakeasy = null, QRCode = null;
  try { speakeasy = require('speakeasy'); } catch (e) {}
  try { QRCode = require('qrcode'); } catch (e) {}
  function uid(req) {
    return (req.body && (req.body.id_usuario || req.body.id_usuario_cierre)) || (req.session && req.session.usuario && req.session.usuario.id_usuario) || null;
  }
  app.post('/api/2fa/setup', async (req, res) => {
    try {
      if (!speakeasy) return res.status(503).json({ success: false, mensaje: 'Instala dependencias: npm i speakeasy qrcode' });
      const id = uid(req) || req.body.id_usuario;
      if (!id) return res.status(400).json({ success: false, mensaje: 'id_usuario requerido' });
      await totp.ensureTotpColumns(db.pool);
      const secret = speakeasy.generateSecret({ name: 'ClubMaster:' + id, length: 20 });
      await db.pool.query('UPDATE usuarios SET totp_secret=? WHERE id_usuario=?', [secret.base32, id]);
      let qr = null;
      if (QRCode) { try { qr = await QRCode.toDataURL(secret.otpauth_url); } catch (e) {} }
      res.json({ success: true, secret: secret.base32, otpauth_url: secret.otpauth_url, qr });
    } catch (e) { res.status(500).json({ success: false, mensaje: e.message }); }
  });
  app.post('/api/2fa/enable', async (req, res) => {
    try {
      const id = uid(req); const code = totp.getCode(req);
      if (!id || !code) return res.status(400).json({ success: false, mensaje: 'id_usuario y totp_code requeridos' });
      const v = await totp.verifyCodeForUser(db.pool, id, code);
      if (!v.ok) return res.status(403).json({ success: false, mensaje: 'Codigo invalido' });
      await db.pool.query('UPDATE usuarios SET totp_enabled=1 WHERE id_usuario=?', [id]);
      res.json({ success: true, mensaje: '2FA activado' });
    } catch (e) { res.status(500).json({ success: false, mensaje: e.message }); }
  });
  app.post('/api/2fa/disable', async (req, res) => {
    try {
      const id = uid(req); const code = totp.getCode(req);
      if (!id) return res.status(400).json({ success: false, mensaje: 'id_usuario requerido' });
      const enabled = await totp.isTotpEnabledForUser(db.pool, id);
      if (enabled) {
        const v = await totp.verifyCodeForUser(db.pool, id, code);
        if (!v.ok) return res.status(403).json({ success: false, mensaje: 'Codigo invalido' });
      }
      await db.pool.query('UPDATE usuarios SET totp_enabled=0, totp_secret=NULL WHERE id_usuario=?', [id]);
      res.json({ success: true, mensaje: '2FA desactivado' });
    } catch (e) { res.status(500).json({ success: false, mensaje: e.message }); }
  });
  app.get('/api/2fa/status', async (req, res) => {
    try {
      const id = req.query.id_usuario || uid(req);
      if (!id) return res.status(400).json({ success: false, mensaje: 'id_usuario requerido' });
      const enabled = await totp.isTotpEnabledForUser(db.pool, id);
      res.json({ success: true, enabled });
    } catch (e) { res.status(500).json({ success: false, mensaje: e.message }); }
  });
};
