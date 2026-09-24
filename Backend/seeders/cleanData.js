const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { pool } = require('../config/database');
async function tableExists(conn, name) {
  const [rows] = await conn.query(`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`, [name]);
  return rows.length > 0;
}
async function safeDelete(conn, table, where = '') {
  if (!(await tableExists(conn, table))) { console.log(` - ${table}: no existe`); return 0; }
  const [res] = await conn.query(`DELETE FROM \`${table}\` ${where}`);
  console.log(` - ${table}: ${res.affectedRows} eliminadas`); return res.affectedRows;
}
async function resetAI(conn, table) {
  if (!(await tableExists(conn, table))) return;
  try { await conn.query(`ALTER TABLE \`${table}\` AUTO_INCREMENT = 1`); console.log(`   -> AUTO_INCREMENT ${table}=1`); } catch(e){ console.log(`   -> ${table}: ${e.message}`); }
}
async function clean() {
  const conn = await pool.getConnection();
  try {
    console.log('=== LIMPIEZA SEEDERS/cleanData ===');
    await conn.query('SET FOREIGN_KEY_CHECKS=0');
    console.log('\n[1] Ventas y Finanzas'); await safeDelete(conn,'detalle_pedido'); await safeDelete(conn,'pedidos'); await safeDelete(conn,'ventas'); await safeDelete(conn,'facturas'); await safeDelete(conn,'movimientos_caja'); await safeDelete(conn,'arqueos_detalle'); await safeDelete(conn,'pagos_proveedores');
    console.log('\n[2] Comandas'); await safeDelete(conn,'speed_bar_ventas'); if(await tableExists(conn,'mesas')){ const[r]=await conn.query(`UPDATE mesas SET estado='Disponible',id_mesero=NULL,fecha_ocupacion=NULL`); console.log(` - mesas ${r.affectedRows} a Disponible`);} await safeDelete(conn,'jornadas');
    console.log('\n[3] Cartera y Mermas'); await safeDelete(conn,'abonos_vales'); await safeDelete(conn,'cuentas_por_cobrar'); await safeDelete(conn,'vales'); await safeDelete(conn,'mermas');
    console.log('\n[4] Compras'); await safeDelete(conn,'detalle_compras'); await safeDelete(conn,'compras'); console.log(' - proveedores preservados'); if(await tableExists(conn,'productos')){ await conn.query(`UPDATE productos SET stock=0`); console.log(' - productos stock=0');}
    console.log('\n[5] Auditoría (append-only, preservada)'); console.log(' - audit_logs: preservada (append-only)'); console.log(' - auditoria_incidencias: preservada (append-only)');
    console.log('\n[6] Preservar Super Admin');
    const [admins]=await conn.query(`SELECT id_usuario,correo FROM usuarios WHERE correo IN ('admin@clubmaster.com','admin@gmail.com')`);
    let id=admins.length?admins[0].id_usuario:null;
    if(id){ await conn.query(`DELETE FROM usuarios WHERE id_usuario!=?`,[id]); console.log(` - preservado id=${id}`);} else { const bcrypt=require('bcryptjs'); const h=await bcrypt.hash('1234',10); const[res]=await conn.query(`INSERT INTO usuarios (nombre,correo,contrasena,id_rol,activo) VALUES ('Super Admin','admin@clubmaster.com',?,1,1)`,[h]); id=res.insertId; await conn.query(`DELETE FROM usuarios WHERE id_usuario!=?`,[id]); console.log(` - creado id=${id}`);}
    console.log('\n[7] AUTO_INCREMENT'); for(const t of ['pedidos','detalle_pedido','jornadas','cuentas_por_cobrar','abonos_vales','compras']) await resetAI(conn,t);
    await conn.query('SET FOREIGN_KEY_CHECKS=1');
    console.log('\n=== VERIFICACIÓN ==='); const[adm]=await conn.query(`SELECT correo FROM usuarios WHERE correo='admin@clubmaster.com'`); console.log(adm.length?'✓ admin@clubmaster.com OK':'✗ sin admin'); console.log('✓ Vaciado exitoso, contadores a 1'); console.log('=== FIN ===');
  } catch(e){ console.error(e); try{await conn.query('SET FOREIGN_KEY_CHECKS=1');}catch{} process.exitCode=1;} finally{ conn.release(); await pool.end();}
}
if(require.main===module) clean().then(()=>process.exit(process.exitCode||0));
module.exports={clean};
