const path=require('path');require('dotenv').config({path:path.join(__dirname,'..','.env')});const mysql=require('mysql2/promise');const bcrypt=require('bcryptjs');
(async()=>{
  const { buildPoolConfig } = require('../config/database'); const pool=mysql.createPool(buildPoolConfig('REAL'));
  try{
    const [rows]=await pool.query("SELECT id_usuario,nombre,correo,id_rol,activo,IF(contrasena IS NOT NULL AND contrasena!='','SI','NO') as tiene_contrasena, LEFT(contrasena,30) as hash_preview FROM usuarios ORDER BY id_usuario");
    console.log('=== USUARIOS discoteca_db ==='); console.table(rows); console.log(JSON.stringify(rows,null,2));
    for(const u of rows){ const [r]=await pool.query('SELECT contrasena FROM usuarios WHERE id_usuario=?',[u.id_usuario]); const ok=await bcrypt.compare('1234',r[0].contrasena); console.log(`PIN 1234 para ${u.correo}: ${ok?'OK':'NO'}`); }
    const [demo]=await pool.query("SELECT id_usuario,nombre,correo FROM usuarios WHERE correo IN ('admin@clubmaster.com','admin@gmail.com')");
    console.log('Admin encontrados:',JSON.stringify(demo,null,2));
  }catch(e){console.error('ERROR:',e.message);console.error(e.stack);}finally{await pool.end();}
})();
