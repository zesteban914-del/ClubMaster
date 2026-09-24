module.exports = function(app, db){
const pool = db.pool || require('../config/database').pool;
const { soloCajaOperativa, bloquearAdmin } = require('../middlewares/authMiddleware');
const security = require('../middlewares/security');
const audit = require('../services/audit-service');
const { pinLimiter } = require('../middlewares/rateLimiter');
async function ensureTables(){
 try{
  await pool.query(`CREATE TABLE IF NOT EXISTS asistencias (
   id_asistencia INT AUTO_INCREMENT PRIMARY KEY,
   id_usuario INT NOT NULL,
   tipo ENUM('entrada','salida','inicio_turno') NOT NULL,
   fecha DATE NOT NULL,
   timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
   id_jornada INT NULL,
   FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE
  )`);
  try{
   const [cols]=await pool.query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='usuarios' AND COLUMN_NAME='estado_actual'`);
   if(cols.length===0) await pool.query(`ALTER TABLE usuarios ADD COLUMN estado_actual VARCHAR(20) DEFAULT NULL`);
   const [cols2]=await pool.query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='usuarios' AND COLUMN_NAME='ultimo_fichaje'`);
   if(cols2.length===0) await pool.query(`ALTER TABLE usuarios ADD COLUMN ultimo_fichaje DATETIME DEFAULT NULL`);
  }catch(e){}
  await pool.query(`CREATE TABLE IF NOT EXISTS vaciados_efectivo (
   id_vaciado INT AUTO_INCREMENT PRIMARY KEY,
   id_jornada INT NOT NULL,
   monto DECIMAL(12,2) NOT NULL,
   motivo VARCHAR(255) NOT NULL,
   id_usuario INT NULL,
   fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
   FOREIGN KEY (id_jornada) REFERENCES jornadas(id_jornada) ON DELETE CASCADE
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS auditoria_incidencias (
   id_incidencia INT AUTO_INCREMENT PRIMARY KEY,
   id_jornada INT NULL,
   tipo ENUM('anulacion','apertura_sin_venta','descuento','cortesia') NOT NULL,
   descripcion TEXT,
   id_usuario_autoriza INT NULL,
   id_usuario_registra INT NULL,
   monto DECIMAL(12,2) DEFAULT 0,
   fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
 }catch(e){ console.error('ensure operativa tables',e.message); }
}
ensureTables();
function fNum(v){ var n=Number(v); return isFinite(n)?n:0; }
app.post('/api/asistencia/fichar', pinLimiter, async(req,res)=>{
  const {id_usuario,tipo,id_jornada,pin,contrasena,password} = req.body;
  const pinIngresado = pin || contrasena || password || '';
  if(!id_usuario || ['entrada','salida','inicio_turno'].indexOf(tipo)===-1) return res.status(400).json({success:false,mensaje:'id_usuario y tipo (entrada/salida/inicio_turno) obligatorios'});
  if(!pinIngresado) return res.status(400).json({success:false,mensaje:'PIN requerido'});
  try{
   await ensureTables();
   if (tipo==='inicio_turno') {
     let caja=null; try{ caja=await db.obtenerJornadaActiva(); }catch(e){ caja=null; }
     if(!caja){
       return res.status(403).json({success:false,mensaje:'Imposible iniciar turno: La Caja Principal se encuentra cerrada.'});
     }
     const turnosSvc=require('../services/turnos-service');
     const cajaActiva=await turnosSvc.getCajaActiva();
     if(!cajaActiva) return res.status(403).json({success:false,mensaje:'Imposible iniciar turno: La Caja Principal se encuentra cerrada.'});
   }
   const [uRows]=await pool.query('SELECT id_usuario, contrasena, estado_actual FROM usuarios WHERE id_usuario=?',[id_usuario]);
   if(!uRows.length) return res.status(404).json({success:false,mensaje:'Usuario no encontrado'});
   const u=uRows[0];
   let pinOk=false;
   if(u.contrasena && security.esHashBCrypt(u.contrasena)) pinOk=await security.verificarContrasena(String(pinIngresado), u.contrasena);
   else pinOk=String(pinIngresado)===String(u.contrasena);
   if(!pinOk){
     await audit.auditFromReq(req,{usuario_id:id_usuario, tipo_evento:'PIN_FALLIDO', descripcion:`Fichaje PIN fallido tipo ${tipo} usuario ${id_usuario}`, motivo:'pin incorrecto'});
     return res.status(401).json({success:false,mensaje:'PIN invalido'});
   }
   if(u.estado_actual && u.estado_actual===tipo) return res.status(409).json({success:false,mensaje:'Ya estas en estado '+tipo+' - boton redundante deshabilitado'});
   if (tipo==='inicio_turno') {
     try{
       const turnosSvc=require('../services/turnos-service');
       const r=await turnosSvc.abrirTurno(id_usuario);
       return res.json({success:true,mensaje:'Turno ABIERTO registrado', estado_actual:tipo, id_turno:r.id_turno, id_caja:r.id_caja});
     }catch(eTurno){
       if (eTurno.status===403) return res.status(403).json({success:false,mensaje:eTurno.message});
       if (eTurno.status===400) return res.status(400).json({success:false,mensaje:eTurno.message});
       throw eTurno;
     }
   }
   var jId = id_jornada || null;
   if(!jId){ try{ const j=await db.obtenerJornadaActiva(); if(j) jId=j.id_jornada; }catch(e){} }
   await pool.query('INSERT INTO asistencias (id_usuario,tipo,fecha,timestamp,id_jornada) VALUES (?,?,CURDATE(),NOW(),?)',[id_usuario,tipo,jId]);
   await pool.query('UPDATE usuarios SET estado_actual=?, ultimo_fichaje=NOW() WHERE id_usuario=?',[tipo, id_usuario]);
   if (tipo==='salida') {
     try{ const turnosSvc=require('../services/turnos-service'); await turnosSvc.cerrarTurno(id_usuario); }catch(_){}
   }
   res.json({success:true,mensaje:'Marcaje registrado: '+tipo, estado_actual:tipo});
  }catch(e){ res.status(500).json({success:false,mensaje:e.message}); }
});
app.get('/api/asistencia/estados', async(req,res)=>{
 try{
  await ensureTables();
  const [rows]=await pool.query(`SELECT id_usuario, estado_actual, ultimo_fichaje FROM usuarios WHERE activo=1`);
  const map={}; rows.forEach(r=>{ map[r.id_usuario]=r.estado_actual||null; });
  res.json({success:true, estados:map, detalle:rows});
 }catch(e){ res.status(500).json({success:false,mensaje:e.message}); }
});
app.get('/api/asistencia/hoy', async(req,res)=>{
 try{
  await ensureTables();
  const [rows]=await pool.query(`SELECT a.*,u.nombre,COALESCE(r.nombre,'') as rol FROM asistencias a JOIN usuarios u ON a.id_usuario=u.id_usuario LEFT JOIN roles r ON u.id_rol=r.id_rol WHERE a.fecha=CURDATE() ORDER BY a.timestamp DESC LIMIT 100`);
  res.json({success:true,asistencias:rows});
 }catch(e){ res.status(500).json({success:false,mensaje:e.message}); }
});
app.get('/api/asistencia/resumen', async(req,res)=>{
 try{
  await ensureTables();
  const fecha=req.query.fecha||null;
  let where='a.fecha=CURDATE()'; let params=[];
  if(fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha)){ where='a.fecha=?'; params=[fecha]; }
  const [rows]=await pool.query(`SELECT a.id_usuario,u.nombre,COALESCE(r.nombre,'') as rol,
   MAX(CASE WHEN a.tipo='entrada' THEN a.timestamp END) as entrada,
   MAX(CASE WHEN a.tipo='inicio_turno' THEN a.timestamp END) as inicio_turno,
   MAX(CASE WHEN a.tipo='salida' THEN a.timestamp END) as salida,
   COUNT(*) as fichajes
   FROM asistencias a JOIN usuarios u ON a.id_usuario=u.id_usuario LEFT JOIN roles r ON u.id_rol=r.id_rol WHERE ${where} GROUP BY a.id_usuario ORDER BY u.nombre`,params);
  res.json({success:true,resumen:rows});
 }catch(e){ res.status(500).json({success:false,mensaje:e.message}); }
});
app.get('/api/propinas/reporte', async(req,res)=>{
 try{
  const fecha_inicio=req.query.fecha_inicio||null;
  const fecha_fin=req.query.fecha_fin||null;
  const id_jornada=req.query.id_jornada?parseInt(req.query.id_jornada):null;
  let where="ped.estado='Pagado'"; let params=[];
  if(id_jornada){ where+=" AND ped.id_jornada=?"; params.push(id_jornada); }
  else{
   if(fecha_inicio){ where+=" AND DATE(ped.timestamp_pedido)>=?"; params.push(fecha_inicio); }
   if(fecha_fin){ where+=" AND DATE(ped.timestamp_pedido)<=?"; params.push(fecha_fin); }
   if(!fecha_inicio && !fecha_fin && !id_jornada){ where+=" AND DATE(ped.timestamp_pedido)=CURDATE()"; }
  }
  let colTs='timestamp_pedido';
  try{ const [cols]=await pool.query("SHOW COLUMNS FROM pedidos LIKE 'timestamp_pedido'"); if(cols.length===0){ const [c2]=await pool.query("SHOW COLUMNS FROM pedidos LIKE 'fecha_pedido'"); if(c2.length>0) colTs='fecha_pedido'; } }catch(e){}
  const [rows]=await pool.query(`SELECT ped.id_usuario,COALESCE(u.nombre,'Sin asignar') as mesero,COALESCE(r.nombre,'') as rol,
   COUNT(*) as ventas,COALESCE(SUM(ped.propina),0) as propina_total,
   COALESCE(SUM(CASE WHEN LOWER(ped.metodo_pago)='efectivo' THEN ped.propina ELSE 0 END),0) as propina_efectivo,
   COALESCE(SUM(CASE WHEN LOWER(ped.metodo_pago)!='efectivo' THEN ped.propina ELSE 0 END),0) as propina_tarjeta
   FROM pedidos ped LEFT JOIN usuarios u ON ped.id_usuario=u.id_usuario LEFT JOIN roles r ON u.id_rol=r.id_rol WHERE ${where} GROUP BY ped.id_usuario ORDER BY propina_total DESC`,params);
  const totalPropina=rows.reduce((a,r)=>a+fNum(r.propina_total),0);
  const pozoBarra=Math.round(totalPropina*0.3);
  const detalle=rows.map(r=>({id_usuario:r.id_usuario,mesero:r.mesero,rol:r.rol,ventas:Number(r.ventas),propina_total:fNum(r.propina_total),propina_efectivo:fNum(r.propina_efectivo),propina_tarjeta:fNum(r.propina_tarjeta),pozo_asignado:Math.round(fNum(r.propina_total)*0.3)}));
  res.json({success:true,total_propina:totalPropina,pozo_barra:pozoBarra,detalle});
 }catch(e){ console.error('propinas',e.message); res.status(500).json({success:false,mensaje:e.message}); }
});
app.post('/api/caja/vaciados', soloCajaOperativa, async(req,res)=>{
 const {id_jornada,monto,motivo,id_usuario}=req.body;
 if(!id_jornada || !monto || fNum(monto)<=0) return res.status(400).json({success:false,mensaje:'id_jornada y monto >0 obligatorios'});
 try{
  await ensureTables();
  await pool.query('INSERT INTO vaciados_efectivo (id_jornada,monto,motivo,id_usuario,fecha) VALUES (?,?,?, ?,NOW())',[id_jornada,fNum(monto),motivo||'Vaciado parcial',id_usuario||null]);
  try{ await pool.query('INSERT INTO movimientos_caja (id_jornada,id_usuario,tipo,categoria,concepto,monto,numero_comprobante,justificacion) VALUES (?,?,?,?,?,?,?,?)',[id_jornada,id_usuario||null,'Egreso','Vaciado a caja fuerte',motivo||'Vaciado parcial',fNum(monto),'','Vaciado de efectivo durante la noche']); }catch(e){}
  await audit.auditFromReq(req,{usuario_id:id_usuario, tipo_evento:'VACIADO_CAJA', descripcion:`Vaciado ${fNum(monto)} jornada ${id_jornada}: ${motivo||''}`, motivo:motivo||'', mesa_id:null});
  await audit.auditFromReq(req,{usuario_id:id_usuario, tipo_evento:'RETIRO_CAJA', descripcion:`Retiro caja ${fNum(monto)} jornada ${id_jornada}`, motivo:motivo||''});
  res.json({success:true,mensaje:'Vaciado registrado'});
 }catch(e){ res.status(500).json({success:false,mensaje:e.message}); }
});
app.get('/api/caja/vaciados', async(req,res)=>{
 const id=req.query.id_jornada;
 if(!id) return res.status(400).json({success:false,mensaje:'id_jornada requerido'});
 try{
  await ensureTables();
  const [rows]=await pool.query(`SELECT v.*,COALESCE(u.nombre,'Sistema') as usuario_nombre FROM vaciados_efectivo v LEFT JOIN usuarios u ON v.id_usuario=u.id_usuario WHERE v.id_jornada=? ORDER BY v.fecha ASC`,[id]);
  const total=rows.reduce((a,r)=>a+fNum(r.monto),0);
  res.json({success:true,vaciados:rows,total});
 }catch(e){ res.status(500).json({success:false,mensaje:e.message}); }
});
app.post('/api/caja/auditoria', bloquearAdmin, async(req,res)=>{
 const {id_jornada,tipo,descripcion,id_usuario_autoriza,id_usuario_registra,monto}=req.body;
 if(['anulacion','apertura_sin_venta','descuento','cortesia'].indexOf(tipo)===-1) return res.status(400).json({success:false,mensaje:'tipo invalido'});
 try{
  await ensureTables();
  var jId=id_jornada||null;
  if(!jId){ try{ const j=await db.obtenerJornadaActiva(); if(j) jId=j.id_jornada; }catch(e){} }
  await pool.query('INSERT INTO auditoria_incidencias (id_jornada,tipo,descripcion,id_usuario_autoriza,id_usuario_registra,monto,fecha) VALUES (?,?,?,?,?,?,NOW())',[jId,tipo,descripcion||'',id_usuario_autoriza||null,id_usuario_registra||null,fNum(monto)]);
  const mapTipo={anulacion:'ANULACION_ITEM', descuento:'DESCUENTO_APLICADO', cortesia:'DESCUENTO_APLICADO', apertura_sin_venta:'RETIRO_CAJA'};
  await audit.auditFromReq(req,{usuario_id:id_usuario_registra, autorizado_por_id:id_usuario_autoriza, tipo_evento: mapTipo[tipo]||'ANULACION_ITEM', descripcion: descripcion||tipo, motivo: descripcion||'', mesa_id:null});
  res.json({success:true,mensaje:'Incidencia registrada'});
 }catch(e){ res.status(500).json({success:false,mensaje:e.message}); }
});
app.get('/api/caja/auditoria', async(req,res)=>{
 try{
  await ensureTables();
  let where='1=1'; let params=[];
  if(req.query.id_jornada){ where+=' AND a.id_jornada=?'; params.push(req.query.id_jornada); }
  if(req.query.tipo && ['anulacion','apertura_sin_venta','descuento','cortesia'].indexOf(req.query.tipo)!==-1){ where+=' AND a.tipo=?'; params.push(req.query.tipo); }
  const [rows]=await pool.query(`SELECT a.*,COALESCE(ua.nombre,'--') as autoriza_nombre,COALESCE(ur.nombre,'--') as registra_nombre FROM auditoria_incidencias a LEFT JOIN usuarios ua ON a.id_usuario_autoriza=ua.id_usuario LEFT JOIN usuarios ur ON a.id_usuario_registra=ur.id_usuario WHERE ${where} ORDER BY a.fecha DESC LIMIT 200`,params);
  res.json({success:true,incidencias:rows});
 }catch(e){ res.status(500).json({success:false,mensaje:e.message}); }
});
app.get('/api/metricas/pico-horario', async(req,res)=>{
 try{
  const dias=req.query.dias?parseInt(req.query.dias):30;
  let colTs='timestamp_pedido';
  try{ const [c]=await pool.query("SHOW COLUMNS FROM pedidos LIKE 'timestamp_pedido'"); if(!c.length){ const [c2]=await pool.query("SHOW COLUMNS FROM pedidos LIKE 'fecha_pedido'"); if(c2.length) colTs='fecha_pedido'; } }catch(e){}
  const [rows]=await pool.query(`SELECT HOUR(${colTs}) as hora,COUNT(*) as ventas,COALESCE(SUM(total),0) as ingresos,COALESCE(AVG(total),0) as ticket FROM pedidos WHERE estado='Pagado' AND ${colTs} >= DATE_SUB(NOW(),INTERVAL ? DAY) GROUP BY HOUR(${colTs}) ORDER BY hora`,[dias]);
  let map={}; rows.forEach(r=>{ map[Number(r.hora)]=r; });
  let full=[];
  for(let h=0;h<24;h++){ if(map[h]) full.push({hora:h,ventas:Number(map[h].ventas),ingresos:Number(map[h].ingresos),ticket:Number(map[h].ticket)}); else full.push({hora:h,ventas:0,ingresos:0,ticket:0}); }
  let noche=full.filter(r=>r.hora>=22||r.hora<=5);
  let maxV=Math.max(...full.map(r=>r.ventas))||1;
  let maxI=Math.max(...full.map(r=>r.ingresos))||1;
  res.json({success:true,horas:full,noche:noche,max_ventas:maxV,max_ingresos:maxI});
 }catch(e){ res.status(500).json({success:false,mensaje:e.message}); }
});
app.get('/api/metricas/comparativo-eventos', async(req,res)=>{
 try{
  let colTs='timestamp_pedido';
  try{ const [c]=await pool.query("SHOW COLUMNS FROM pedidos LIKE 'timestamp_pedido'"); if(!c.length){ const [c2]=await pool.query("SHOW COLUMNS FROM pedidos LIKE 'fecha_pedido'"); if(c2.length) colTs='fecha_pedido'; } }catch(e){}
  const [dias]=await pool.query(`SELECT DAYNAME(${colTs}) as dia_en,DAYOFWEEK(${colTs}) as dow,COUNT(*) as ventas,COALESCE(SUM(total),0) as ingresos,COALESCE(AVG(total),0) as ticket FROM pedidos WHERE estado='Pagado' AND ${colTs} >= DATE_SUB(NOW(),INTERVAL 90 DAY) GROUP BY DAYNAME(${colTs}),DAYOFWEEK(${colTs}) ORDER BY dow`);
  const mapEn={Monday:'Lunes',Tuesday:'Martes',Wednesday:'Miércoles',Thursday:'Jueves',Friday:'Viernes',Saturday:'Sábado',Sunday:'Domingo'};
  let fmt=dias.map(r=>({dia:mapEn[r.dia_en]||r.dia_en,dia_en:r.dia_en,ventas:Number(r.ventas),ingresos:Number(r.ingresos),ticket:Number(r.ticket)}));
  const [eventos]=await pool.query(`SELECT DATE(${colTs}) as fecha,COUNT(*) as ventas,COALESCE(SUM(total),0) as ingresos FROM pedidos WHERE estado='Pagado' GROUP BY DATE(${colTs}) ORDER BY ingresos DESC LIMIT 10`);
  res.json({success:true,por_dia:fmt,top_fechas:eventos.map(e=>({fecha:e.fecha,ventas:Number(e.ventas),ingresos:Number(e.ingresos)}))});
 }catch(e){ res.status(500).json({success:false,mensaje:e.message}); }
});
app.get('/api/metricas/ticket-zona', async(req,res)=>{
 try{
  let colTs='timestamp_pedido';
  try{ const [c]=await pool.query("SHOW COLUMNS FROM pedidos LIKE 'timestamp_pedido'"); if(!c.length){ const [c2]=await pool.query("SHOW COLUMNS FROM pedidos LIKE 'fecha_pedido'"); if(c2.length) colTs='fecha_pedido'; } }catch(e){}
  const [rows]=await pool.query(`SELECT COALESCE(m.zona,'General') as zona,COUNT(*) as ventas,COALESCE(SUM(ped.total),0) as ingresos,COALESCE(AVG(ped.total),0) as ticket_promedio,COALESCE(SUM(ped.total)/NULLIF(COUNT(DISTINCT ped.id_mesa),0),0) as por_mesa FROM pedidos ped LEFT JOIN mesas m ON ped.id_mesa=m.id_mesa WHERE ped.estado='Pagado' AND ped.${colTs} >= DATE_SUB(NOW(),INTERVAL 30 DAY) GROUP BY m.zona ORDER BY ingresos DESC`);
  let fmt=rows.map(r=>({zona:r.zona,ventas:Number(r.ventas),ingresos:Number(r.ingresos),ticket_promedio:Math.round(Number(r.ticket_promedio)),por_mesa:Math.round(Number(r.por_mesa))}));
  if(!fmt.length){ 
   const [fb]=await pool.query(`SELECT 'General' as zona,COUNT(*) as ventas,COALESCE(SUM(total),0) as ingresos,COALESCE(AVG(total),0) as ticket_promedio FROM pedidos WHERE estado='Pagado'`);
   fmt=[{zona:'General',ventas:Number(fb[0].ventas),ingresos:Number(fb[0].ingresos),ticket_promedio:Math.round(Number(fb[0].ticket_promedio)),por_mesa:Math.round(Number(fb[0].ticket_promedio))}];
  }
  res.json({success:true,zonas:fmt});
 }catch(e){ res.status(500).json({success:false,mensaje:e.message}); }
});
};
