const path=require('path');require('dotenv').config({path:path.join(__dirname,'..','.env')});const {pool}=require('../config/database');
async function limpiar(){
 const c=await pool.getConnection();
 try{
  console.log('Limpiando datos de prueba...');
  await c.query('SET FOREIGN_KEY_CHECKS=0');
  const [admin]=await c.query("SELECT id_usuario FROM usuarios WHERE correo='admin@gmail.com' LIMIT 1");
  let idAdmin=admin.length?admin[0].id_usuario:1;
  const [allAdmins]=await c.query("SELECT id_usuario FROM usuarios WHERE id_rol=1");
  const idsAdmin=allAdmins.map(r=>r.id_usuario);
  if(!idsAdmin.includes(idAdmin)) idsAdmin.push(idAdmin);
  console.log('Admins a conservar:',idsAdmin);
  await c.query('DELETE FROM asistencias WHERE 1');
  console.log(' - asistencias eliminadas');
  console.log(' - auditoria_incidencias preservada (append-only)');
  console.log(' - audit_logs preservada (append-only)');
  await c.query('DELETE FROM vaciados_efectivo WHERE 1');
  try{await c.query('DELETE FROM abonos_vales WHERE 1')}catch(e){}
  try{await c.query('DELETE FROM cuentas_por_cobrar WHERE cliente_socio LIKE ?',['%Test%'])}catch(e){}
  try{await c.query('DELETE FROM pedidos WHERE id_usuario NOT IN (?)',[idsAdmin])}catch(e){ console.log('pedidos skip',e.message)}
  try{await c.query('DELETE FROM detalle_pedido WHERE id_pedido NOT IN (SELECT id_pedido FROM pedidos)')}catch(e){}
  try{await c.query('DELETE FROM mermas WHERE id_usuario NOT IN (?)',[idsAdmin])}catch(e){}
  try{await c.query('DELETE FROM password_reset_tokens WHERE id_usuario NOT IN (?)',[idsAdmin])}catch(e){}
  if(idsAdmin.length){
   await c.query(`DELETE FROM usuarios WHERE id_usuario NOT IN (${idsAdmin.map(()=>'?').join(',')})`, idsAdmin);
   console.log(' - usuarios de prueba eliminados, quedan:',idsAdmin.length);
  } else {
   await c.query("DELETE FROM usuarios WHERE correo!='admin@gmail.com'");
  }
  await c.query(`UPDATE usuarios SET estado_actual=NULL, ultimo_fichaje=NULL WHERE id_usuario IN (${idsAdmin.map(()=>'?').join(',')})`, idsAdmin);
  await c.query('SET FOREIGN_KEY_CHECKS=1');
  const [u]=await c.query('SELECT u.id_usuario,u.nombre,u.correo,r.nombre AS rol_nombre FROM usuarios u LEFT JOIN roles r ON u.id_rol=r.id_rol');
  console.table(u);
  const [a]=await c.query('SELECT COUNT(*) as c FROM asistencias');
  console.log('Asistencias restantes:',a[0].c);
  console.log('Limpieza OK. Solo queda administrador.');
 }catch(e){ console.error(e); await c.query('SET FOREIGN_KEY_CHECKS=1');}
 finally{ c.release(); process.exit(0);}
}
limpiar();
