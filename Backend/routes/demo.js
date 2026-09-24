module.exports = function(app, db){
  const { poolDemo, poolReal } = require('../config/database');
  app.get('/api/demo/status', async(req,res)=>{
    const isDemo = req.headers['x-demo']==='1' || req.query.demo==='1';
    let demoExists=false;
    try{ const [r]=await poolDemo.query('SELECT 1'); demoExists=true; }catch(e){ demoExists=false; }
    res.json({success:true, demoActivo: !!isDemo, demoExists, dbDemo: process.env.DB_NAME_DEMO||'discoteca_db_demo', dbReal: process.env.DB_NAME||'discoteca_db'});
  });
  app.post('/api/demo/clone', async(req,res)=>{
    const { poolReal: pr, poolDemo: pd } = require('../config/database');
    try{
      await pd.query('SELECT 1');
    }catch(e){
      try{ await pr.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME_DEMO||'discoteca_db_demo'}\``); }catch(e2){}
    }
    try{
      const dbReal = process.env.DB_NAME||'discoteca_db';
      const dbDemo = process.env.DB_NAME_DEMO||'discoteca_db_demo';
      const [tables]=await pr.query(`SELECT table_name FROM information_schema.tables WHERE table_schema=?`,[dbReal]);
      for(const t of tables){
        const tn=t.table_name||t.TABLE_NAME;
        await pd.query(`DROP TABLE IF EXISTS \`${tn}\``);
        const [create]=await pr.query(`SHOW CREATE TABLE \`${dbReal}\`.\`${tn}\``);
        let sql=create[0]['Create Table'];
        sql=sql.replace(`CREATE TABLE \`${tn}\``, `CREATE TABLE \`${dbDemo}\`.\`${tn}\``);
        await pd.query(sql);
        const [rows]=await pr.query(`SELECT * FROM \`${dbReal}\`.\`${tn}\``);
        if(rows.length){
          const cols=Object.keys(rows[0]);
          for(const row of rows){
            const vals=cols.map(c=>row[c]);
            const ph=cols.map(()=>'?').join(',');
            await pd.query(`INSERT INTO \`${dbDemo}\`.\`${tn}\` (\`${cols.join('`,`')}\`) VALUES (${ph})`, vals);
          }
        }
      }
      res.json({success:true, mensaje:`Clonado ${dbReal} -> ${dbDemo}`});
    }catch(e){ res.status(500).json({success:false, mensaje:e.message}); }
  });
  app.post('/api/demo/reset', async(req,res)=>{
    const isDemo = req.headers['x-demo']==='1' || req.query.demo==='1' || req.body.force;
    if(!isDemo && process.env.DEMO_MODE!=='true') return res.status(403).json({success:false, mensaje:'Solo en modo demo'});
    const { poolDemo } = require('../config/database');
    try{
      await poolDemo.query('SET FOREIGN_KEY_CHECKS=0');
      const tables=['pedidos','detalle_pedido','movimientos_caja','arqueos_detalle','vaciados_efectivo','asistencias','mermas','cuentas_por_cobrar','abonos_vales'];
      for(const t of tables){ try{ await poolDemo.query(`TRUNCATE TABLE \`${t}\``); }catch(e){ try{ await poolDemo.query(`DELETE FROM \`${t}\``);}catch(e2){} } }
      try{ await poolDemo.query(`UPDATE mesas SET estado='Disponible', id_mesero=NULL, fecha_ocupacion=NULL`); }catch(e){}
      await poolDemo.query('SET FOREIGN_KEY_CHECKS=1');
      res.json({success:true, mensaje:'Demo reseteado - listo para capacitar'});
    }catch(e){ res.status(500).json({success:false, mensaje:e.message}); }
  });
  app.post('/api/demo/seed', async(req,res)=>{
    try{
      const { seedVentas } = require('../scripts/seed-ventas');
      await seedVentas();
      res.json({success:true, mensaje:'Ventas demo sembradas'});
    }catch(e){ res.status(500).json({success:false, mensaje:e.message}); }
  });
};
