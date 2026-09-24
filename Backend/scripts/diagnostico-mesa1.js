const path=require('path');require('dotenv').config({path:path.join(__dirname,'..','.env')});const {pool}=require('../config/database');
async function diag(){
 const c=await pool.getConnection();
 try{
  console.log('=== DIAGNOSTICO MESA 1 ===');
  const [mesas]=await c.query("SELECT id_mesa, numero, estado, zona FROM mesas WHERE numero=1 OR id_mesa=1 LIMIT 5");
  console.table(mesas);
  for(const m of mesas){
    console.log(`\n--- Mesa id_mesa=${m.id_mesa} numero=${m.numero} estado=${m.estado} ---`);
    const [pedidos]=await c.query("SELECT id_pedido, id_mesa, id_usuario, estado, total, timestamp_pedido FROM pedidos WHERE id_mesa=? ORDER BY id_pedido DESC LIMIT 10",[m.id_mesa]);
    console.log('Pedidos:', pedidos.length);
    console.table(pedidos);
    for(const p of pedidos){
      const [det]=await c.query("SELECT dp.*, prod.nombre FROM detalle_pedido dp LEFT JOIN productos prod ON dp.id_producto=prod.id_producto WHERE dp.id_pedido=?",[p.id_pedido]);
      console.log(` Detalle pedido ${p.id_pedido} (${p.estado}):`, det.length);
      console.table(det);
    }
    const [cuenta]=await c.query("SELECT p.id_pedido, dp.id_producto, prod.nombre, dp.cantidad, dp.precio_unitario FROM pedidos p INNER JOIN detalle_pedido dp ON p.id_pedido=dp.id_pedido INNER JOIN productos prod ON dp.id_producto=prod.id_producto WHERE p.id_mesa=? AND p.estado='Pendiente'",[m.id_mesa]);
    console.log('Cuenta INNER JOIN Pendiente:', cuenta.length, cuenta);
    const [cuenta2]=await c.query("SELECT p.id_pedido, dp.id_producto, prod.nombre, dp.cantidad FROM pedidos p LEFT JOIN detalle_pedido dp ON p.id_pedido=dp.id_pedido LEFT JOIN productos prod ON dp.id_producto=prod.id_producto WHERE p.id_mesa=? AND p.estado!='Pagado'",[m.id_mesa]);
    console.log('Cuenta LEFT JOIN !=Pagado:', cuenta2.length, cuenta2);
  }
  const [allPend]=await c.query("SELECT p.id_mesa, m.numero, p.id_pedido, p.estado, dp.cantidad, prod.nombre FROM pedidos p JOIN mesas m ON p.id_mesa=m.id_mesa JOIN detalle_pedido dp ON p.id_pedido=dp.id_pedido LEFT JOIN productos prod ON dp.id_producto=prod.id_producto WHERE p.estado='Pendiente' LIMIT 20");
  console.log('\nTodos los pendientes:'); console.table(allPend);
 }catch(e){ console.error(e); } finally{ c.release(); process.exit(0); }
}
diag();
