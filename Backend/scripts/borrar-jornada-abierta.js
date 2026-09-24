const path=require('path');require('dotenv').config({path:path.join(__dirname,'..','.env')});const {pool}=require('../config/database');
async function borrar(){
 const c=await pool.getConnection();
 try{
  const [abiertas]=await c.query("SELECT id_jornada, estado, fecha_apertura, monto_inicial, barra_asignada FROM jornadas WHERE estado='Abierta' ORDER BY id_jornada DESC");
  console.log('Jornadas abiertas:',abiertas.length);
  console.table(abiertas);
  if(!abiertas.length){ console.log('No hay jornadas abiertas para borrar.'); return; }
  const id=abiertas[0].id_jornada;
  console.log('Borrando jornada abierta #'+id+' ...');
  await c.query("DELETE FROM arqueos_detalle WHERE id_jornada=?",[id]);
  await c.query("DELETE FROM movimientos_caja WHERE id_jornada=?",[id]);
  await c.query("DELETE FROM vaciados_efectivo WHERE id_jornada=?",[id]);
  await c.query("DELETE FROM jornadas WHERE id_jornada=?",[id]);
  console.log('Jornada #'+id+' eliminada. Caja queda CERRADA.');
  const [verif]=await c.query("SELECT id_jornada, estado FROM jornadas WHERE estado='Abierta' LIMIT 1");
  console.log('Abiertas restantes:',verif.length);
 }catch(e){ console.error(e.message); }
 finally{ c.release(); process.exit(0); }
}
borrar();
