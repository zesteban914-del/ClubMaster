const { pool } = require('../config/database');

const AUDIT_TIPOS = ['CANCELACION_PEDIDO','DESCUENTO_APLICADO','INGRESO_CAJA','RETIRO_CAJA','CAMBIO_PRECIO','LOGIN_FALLIDO','ANULACION_ITEM','VACIADO_CAJA','APERTURA_CAJA','CIERRE_CAJA','MERMAS','PIN_FALLIDO','REIMPRESION','VALE_CREADO','VALE_ABONADO','VALE_LIQUIDADO','VALE_EXONERADO','DEVOLUCION'];
async function ensureAuditTable(){
  await pool.query(`CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NULL,
    autorizado_por_id INT NULL,
    tipo_evento ENUM('CANCELACION_PEDIDO','DESCUENTO_APLICADO','INGRESO_CAJA','RETIRO_CAJA','CAMBIO_PRECIO','LOGIN_FALLIDO','ANULACION_ITEM','VACIADO_CAJA','APERTURA_CAJA','CIERRE_CAJA','MERMAS','PIN_FALLIDO','REIMPRESION','VALE_CREADO','VALE_ABONADO','VALE_LIQUIDADO','VALE_EXONERADO','DEVOLUCION') NOT NULL,
    descripcion TEXT,
    motivo TEXT,
    ip_address VARCHAR(45) NULL,
    dispositivo VARCHAR(255) NULL,
    mesa_id VARCHAR(20) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_audit_tipo (tipo_evento),
    KEY idx_audit_usuario (usuario_id),
    KEY idx_audit_fecha (created_at),
    KEY idx_audit_mesa (mesa_id)
  )`);
  try{
    const [cols]=await pool.query(`SHOW COLUMNS FROM audit_logs LIKE 'tipo_evento'`);
    if(cols.length && cols[0].Type && cols[0].Type.indexOf('DEVOLUCION')===-1){
      await pool.query(`ALTER TABLE audit_logs MODIFY COLUMN tipo_evento ENUM('CANCELACION_PEDIDO','DESCUENTO_APLICADO','INGRESO_CAJA','RETIRO_CAJA','CAMBIO_PRECIO','LOGIN_FALLIDO','ANULACION_ITEM','VACIADO_CAJA','APERTURA_CAJA','CIERRE_CAJA','MERMAS','PIN_FALLIDO','REIMPRESION','VALE_CREADO','VALE_ABONADO','VALE_LIQUIDADO','VALE_EXONERADO','DEVOLUCION') NOT NULL`);
    }
  }catch(e){}
}
ensureAuditTable().catch(()=>{});

function getIp(req){
  const f=(req.headers['x-forwarded-for']||'').split(',')[0].trim();
  return f || req.ip || (req.socket && req.socket.remoteAddress) || null;
}
function getDispositivo(req){
  return (req.headers['user-agent']||'').substring(0,255);
}

async function registrarAudit({usuario_id, autorizado_por_id, tipo_evento, descripcion, motivo, ip_address, dispositivo, mesa_id}){
  try{
    await ensureAuditTable();
    await pool.query(`INSERT INTO audit_logs (usuario_id, autorizado_por_id, tipo_evento, descripcion, motivo, ip_address, dispositivo, mesa_id) VALUES (?,?,?,?,?,?,?,?)`,
      [usuario_id||null, autorizado_por_id||null, tipo_evento, descripcion||'', motivo||'', ip_address||null, dispositivo||null, mesa_id?String(mesa_id):null]);
  }catch(e){ console.error('audit log error',e.message); }
}
function auditFromReq(req, data){
  return registrarAudit({
    usuario_id: data.usuario_id || (req.session&&req.session.usuario&&req.session.usuario.id_usuario)||null,
    autorizado_por_id: data.autorizado_por_id||null,
    tipo_evento: data.tipo_evento,
    descripcion: data.descripcion,
    motivo: data.motivo,
    ip_address: getIp(req),
    dispositivo: getDispositivo(req),
    mesa_id: data.mesa_id||null
  });
}

async function listarAudit({tipo, usuario_id, mesa_id, fecha_inicio, fecha_fin, limit=100, offset=0}){
  await ensureAuditTable();
  let where='1=1'; const params=[];
  if(tipo){ where+=' AND tipo_evento=?'; params.push(tipo); }
  if(usuario_id){ where+=' AND usuario_id=?'; params.push(usuario_id); }
  if(mesa_id){ where+=' AND mesa_id=?'; params.push(String(mesa_id)); }
  if(fecha_inicio){ where+=' AND DATE(created_at)>=?'; params.push(fecha_inicio); }
  if(fecha_fin){ where+=' AND DATE(created_at)<=?'; params.push(fecha_fin); }
  const [rows]=await pool.query(`SELECT a.*, COALESCE(u.nombre,'Sistema') as usuario_nombre, COALESCE(ua.nombre,'--') as autorizado_nombre FROM audit_logs a LEFT JOIN usuarios u ON a.usuario_id=u.id_usuario LEFT JOIN usuarios ua ON a.autorizado_por_id=ua.id_usuario WHERE ${where} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`, [...params, Number(limit), Number(offset)]);
  const [cnt]=await pool.query(`SELECT COUNT(*) as total FROM audit_logs WHERE ${where}`, params);
  return {logs:rows, total:cnt[0].total};
}

module.exports={ ensureAuditTable, registrarAudit, auditFromReq, listarAudit, getIp, getDispositivo, AUDIT_TIPOS };
