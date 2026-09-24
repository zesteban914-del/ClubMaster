const path=require('path');
require('dotenv').config({path:path.join(__dirname,'..','.env')});
const {pool}=require('../config/database');
const bcrypt=require('bcryptjs');
async function fix(){
  const c=await pool.getConnection();
  try{
    console.log('=== FIX ADMIN LOGIN ===');
    const hash=await bcrypt.hash('1234',10);
    const [rows]=await c.query(`SELECT id_usuario,correo,activo FROM usuarios WHERE correo IN ('admin@clubmaster.com','admin@gmail.com')`);
    console.table(rows);
    for(const correo of ['admin@clubmaster.com','admin@gmail.com']){
      const exists=rows.find(r=>r.correo===correo);
      if(!exists){
        await c.query(`INSERT INTO usuarios (nombre,correo,contrasena,id_rol,activo) VALUES ('Super Admin',?, ?,1,1)`,[correo,hash]);
        console.log(`✓ creado ${correo} / 1234`);
      }else{
        await c.query(`UPDATE usuarios SET contrasena=?,activo=1,id_rol=1,nombre='Super Admin' WHERE correo=?`,[hash,correo]);
        console.log(`✓ actualizado ${correo} / 1234 activo=1`);
      }
    }
    const [all]=await c.query(`SELECT id_usuario,nombre,correo,id_rol,activo FROM usuarios WHERE correo IN ('admin@clubmaster.com','admin@gmail.com')`);
    console.table(all);
    console.log('\n✓ Usa cualquiera de estos para entrar:');
    console.log('  admin@clubmaster.com  / 1234');
    console.log('  admin@gmail.com       / 1234');
  }catch(e){console.error(e);}finally{c.release();await pool.end();}
}
if(require.main===module) fix().then(()=>process.exit(0));
module.exports={fix};
