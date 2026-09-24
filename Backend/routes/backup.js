module.exports=function(app, db){
 const pool=db.pool||require('../config/database').pool;
 const { poolReal, isDemoActive } = require('../config/database');
 const { backupLimiter } = require('../middlewares/rateLimiter');
 const fs=require('fs'); const path=require('path'); const crypto=require('crypto'); const { spawn } = require('child_process');
 const BACKUP_DIR=path.join(__dirname,'../backups');
 try{ if(!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR,{recursive:true}); }catch(e){}
 async function generarBackupCierre(id_jornada){
   const usePool = isDemoActive() ? require('../config/database').poolDemo : poolReal;
   const fecha=new Date().toISOString().replace(/[:.]/g,'-');
   const fileBase=`cierre-${id_jornada||'X'}-${fecha}`;
   const sqlFile=path.join(BACKUP_DIR, fileBase+'.sql');
   const jsonFile=path.join(BACKUP_DIR, fileBase+'.json');
    const { buildPoolConfig } = require('../config/database');
    const cfg = buildPoolConfig(isDemoActive() ? 'DEMO' : 'REAL');
    const host=cfg.host; const user=cfg.user; const pass=cfg.password; const dbName=cfg.database;
    let done=false;
    const MYSQLDUMP_BIN = process.env.MYSQLDUMP_PATH || (process.platform === 'win32' ? 'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe' : 'mysqldump');
    try{
      await new Promise((resolve,reject)=>{
        const args=[`-h`,host,`-u`,user];
        if(pass) args.push(`-p${pass}`);
        args.push(dbName);
        const mysqldump=spawn(MYSQLDUMP_BIN, args);
       const out=fs.createWriteStream(sqlFile);
       mysqldump.stdout.pipe(out);
       let err='';
       mysqldump.stderr.on('data',d=>err+=d.toString());
       mysqldump.on('close',code=> code===0 ? resolve() : reject(new Error(err||`mysqldump exit ${code}`)));
       mysqldump.on('error',reject);
       setTimeout(()=>reject(new Error('mysqldump timeout')),15000);
     });
     done=true;
     console.log(`Backup cierre #${id_jornada} generado: ${sqlFile}`);
   }catch(e){
     console.warn(`mysqldump falló (${e.message}), fallback JSON`);
     try{
       const [pedidos]=await usePool.query('SELECT * FROM pedidos WHERE id_jornada=? LIMIT 5000',[id_jornada]);
       const [detalles]=await usePool.query('SELECT dp.* FROM detalle_pedido dp JOIN pedidos p ON dp.id_pedido=p.id_pedido WHERE p.id_jornada=? LIMIT 5000',[id_jornada]);
       const [movs]=await usePool.query('SELECT * FROM movimientos_caja WHERE id_jornada=?',[id_jornada]);
       const [arqueos]=await usePool.query('SELECT * FROM arqueos_detalle WHERE id_jornada=?',[id_jornada]);
       const [jornada]=await usePool.query('SELECT * FROM jornadas WHERE id_jornada=?',[id_jornada]);
       const data={fecha:new Date().toISOString(), jornada:jornada[0]||null, pedidos, detalles, movimientos:movs, arqueos};
       fs.writeFileSync(jsonFile, JSON.stringify(data,null,2));
       done=true;
       console.log(`Backup JSON cierre #${id_jornada} generado: ${jsonFile}`);
     }catch(e2){ console.error('Backup JSON fallback error',e2.message); }
   }
   try{
     const files=fs.readdirSync(BACKUP_DIR).filter(f=>f.startsWith('cierre-')||f.startsWith('auto-')).sort().reverse();
     files.slice(30).forEach(f=>{ try{ fs.unlinkSync(path.join(BACKUP_DIR,f)); }catch(e){} });
   }catch(e){}
   return {success:done, sqlFile: done&&fs.existsSync(sqlFile)?sqlFile:null, jsonFile: done&&fs.existsSync(jsonFile)?jsonFile:null};
 }
 // exponer para jornadas.js
 app.generarBackupCierre = generarBackupCierre;
 try{ global.generarBackupCierre=generarBackupCierre; }catch(e){}
 function encrypt(text, key){
  const iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv('aes-256-gcm', crypto.createHash('sha256').update(String(key)).digest(), iv);
  const enc=Buffer.concat([cipher.update(text,'utf8'), cipher.final()]);
  const tag=cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
 }
 setInterval(async()=>{
  try{
   const [pedidos]=await pool.query('SELECT * FROM pedidos ORDER BY id_pedido DESC LIMIT 1000');
   const data=JSON.stringify({fecha:new Date().toISOString(), pedidos});
   const key=process.env.SESSION_SECRET||'clubmaster-key';
   const enc=encrypt(data, key);
   const file=path.join(BACKUP_DIR, 'auto-'+new Date().toISOString().slice(0,10)+'.enc');
   fs.writeFileSync(file, enc);
   const files=fs.readdirSync(BACKUP_DIR).sort().reverse();
   files.slice(7).forEach(f=>{ try{ fs.unlinkSync(path.join(BACKUP_DIR,f)); }catch(e){} });
  }catch(e){ console.error('backup auto',e.message); }
 }, 24*60*60*1000);
 app.get('/api/backup/export', backupLimiter, async(req,res)=>{
  try{
   const [pedidos]=await pool.query('SELECT * FROM pedidos ORDER BY id_pedido DESC LIMIT 500');
   const [detalles]=await pool.query('SELECT * FROM detalle_pedido LIMIT 1000');
   const [productos]=await pool.query('SELECT id_producto,nombre,stock,stock_minimo,precio FROM productos');
   const [jornadas]=await pool.query('SELECT * FROM jornadas ORDER BY id_jornada DESC LIMIT 20');
   const data={fecha:new Date().toISOString(), pedidos, detalles, productos, jornadas};
   res.setHeader('Content-Type','application/json');
   res.setHeader('Content-Disposition','attachment; filename="backup-clubmaster-'+new Date().toISOString().slice(0,10)+'.json"');
   res.send(JSON.stringify(data,null,2));
  }catch(e){ res.status(500).json({success:false,mensaje:e.message}); }
 });
 app.get('/api/auditoria/reciente', async(req,res)=>{
  try{
   const [logs]=await pool.query('SELECT a.*, COALESCE(u.nombre,"Sistema") as usuario FROM audit_logs a LEFT JOIN usuarios u ON a.usuario_id=u.id_usuario ORDER BY a.created_at DESC LIMIT 50');
   res.json({success:true, logs});
  }catch(e){ res.json({success:true, logs:[]}); }
 });
 app.get('/api/reportes/health', async(req,res)=>{
  try{
   const [p]=await pool.query("SELECT COUNT(*) as total, SUM(CASE WHEN estado='Pagado' THEN 1 ELSE 0 END) as pagados, SUM(CASE WHEN estado='Pendiente' THEN 1 ELSE 0 END) as pendientes FROM pedidos");
   const [s]=await pool.query('SELECT COUNT(*) as productos, SUM(CASE WHEN stock<=stock_minimo AND stock_minimo>0 THEN 1 ELSE 0 END) as bajo FROM productos WHERE activo=1');
   res.json({success:true, pedidos:p[0], stock:s[0]});
  }catch(e){ res.status(500).json({success:false,mensaje:e.message}); }
 });
};