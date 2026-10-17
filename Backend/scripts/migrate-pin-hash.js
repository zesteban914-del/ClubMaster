// Migracion idempotente: PIN maestro de configuracion_general en texto
// plano -> hash bcrypt. No cambia el PIN ni deja la aplicacion sin el:
// solo endurece el almacenamiento. Se puede correr tantas veces como se
// quiera; los valores que ya son hash se ignoran. Ademas, la verificacion
// diaria (pin-maestro-service) re-hashea cualquier legado restante al
// primer uso correcto, por lo que esta migracion es el paso explicito.
const path=require('path');
require('dotenv').config({path:path.join(__dirname,'..','.env')});
const {pool}=require('../config/database');
const bcrypt=require('bcryptjs');
const RE_BCRYPT=/^\$2[aby]\$\d{2}\$/;

async function migratePinHash(){
  const c=await pool.getConnection();
  try{
    console.log('=== MIGRATE PIN MAESTRO -> HASH ===');
    const [rows]=await c.query("SELECT clave, valor FROM configuracion_general WHERE clave='pin_maestro' LIMIT 1");
    if(!rows.length || !String(rows[0].valor||'').trim()){
      console.log('PIN maestro sin configurar: nada que migrar.');
      return {migrados:0, yaHash:0};
    }
    const actual=String(rows[0].valor);
    if(RE_BCRYPT.test(actual)){
      console.log('PIN maestro ya guardado como hash bcrypt: sin cambios.');
      return {migrados:0, yaHash:1};
    }
    const hash=await bcrypt.hash(actual,10);
    await c.query("UPDATE configuracion_general SET valor=?, descripcion='PIN maestro gerente (4-6 digitos, hash bcrypt)' WHERE clave='pin_maestro'",[hash]);
    console.log('PIN maestro migrado a hash bcrypt (el valor del PIN no cambia).');
    return {migrados:1, yaHash:0};
  }finally{
    c.release();
    await pool.end();
  }
}
if(require.main===module){
  migratePinHash().then(()=>process.exit(0)).catch((e)=>{console.error('Error:',e.message);process.exit(1);});
}
module.exports={migratePinHash};
