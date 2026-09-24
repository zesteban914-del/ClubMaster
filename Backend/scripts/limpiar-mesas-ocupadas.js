const path=require('path');require('dotenv').config({path:path.join(__dirname,'..','.env')});const {pool}=require('../config/database');
async function limpiarMesas(){
 const c=await pool.getConnection();
 try{
  console.log('=== LIMPIEZA MESAS OCUPADAS PARA PRUEBAS ===');
  const [mesasOcup]=await c.query("SELECT id_mesa, numero, estado FROM mesas WHERE estado='Ocupada'");
  console.log('Mesas ocupadas encontradas:', mesasOcup.length);
  console.table(mesasOcup);
  if(!mesasOcup.length){ console.log('No hay mesas ocupadas.'); return; }
  const ids=mesasOcup.map(m=>m.id_mesa);
  const [pedidos]=await c.query(`SELECT id_pedido, id_mesa, total FROM pedidos WHERE id_mesa IN (${ids.map(()=>'?').join(',')}) AND estado='Pendiente'`, ids);
  console.log('Pedidos pendientes a eliminar:', pedidos.length);
  if(pedidos.length){
    const pids=pedidos.map(p=>p.id_pedido);
    await c.query(`DELETE FROM detalle_pedido WHERE id_pedido IN (${pids.map(()=>'?').join(',')})`, pids);
    console.log(' - detalle_pedido eliminados');
    await c.query(`DELETE FROM pedidos WHERE id_pedido IN (${pids.map(()=>'?').join(',')})`, pids);
    console.log(' - pedidos eliminados');
    try{ await c.query(`INSERT INTO auditoria_incidencias (id_jornada,tipo,descripcion,id_usuario_autoriza,id_usuario_registra,monto,fecha) VALUES (NULL,'anulacion',?,NULL,NULL,0,NOW())`, [JSON.stringify({motivo:'Limpieza pruebas - vaciado masivo', mesas:ids, pedidos:pids, hora:new Date().toISOString()})]); console.log(' - auditoria registrada'); }catch(e){ console.log('auditoria skip',e.message); }
  }
  await c.query(`UPDATE mesas SET estado='Disponible', id_mesero=NULL, fecha_ocupacion=NULL, id_mesa_maestra=NULL WHERE id_mesa IN (${ids.map(()=>'?').join(',')})`, ids);
  console.log(' - mesas liberadas a Disponible');
  const [verif]=await c.query("SELECT id_mesa, numero, estado FROM mesas WHERE id_mesa IN ("+ids.map(()=>'?').join(',')+")", ids);
  console.table(verif);
  console.log('LISTO: Todas las mesas ocupadas fueron vaciadas. Recarga el dashboard con F5.');
 }catch(e){ console.error('Error:',e.message); console.error(e); }
 finally{ c.release(); process.exit(0); }
}
limpiarMesas();
