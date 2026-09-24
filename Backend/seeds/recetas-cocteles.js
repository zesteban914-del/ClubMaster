const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { pool } = require('../config/database');
// Recetas iniciales para 8 cocteles de alta rotacion.
// Cantidades en unidades de stock del insumo (ej. ml, oz convertidas a unidad base).
// Ajusta cantidades segun tu unidad_medida real. Insumos y cocteles se buscan por nombre.
const RECETAS = [
  { coctel: 'Margarita', insumos: [['Tequila', 50], ['Triple Sec', 25], ['Jugo de Limon', 25]] },
  { coctel: 'Mojito', insumos: [['Ron Blanco', 50], ['Azucar', 10], ['Hierbabuena', 5], ['Soda', 100]] },
  { coctel: 'Cuba Libre', insumos: [['Ron', 50], ['Coca-Cola', 150], ['Limon', 10]] },
  { coctel: 'Gin Tonic', insumos: [['Ginebra', 50], ['Tonica', 150]] },
  { coctel: 'Piña Colada', insumos: [['Ron Blanco', 50], ['Crema de Coco', 50], ['Jugo de Piña', 100]] },
  { coctel: 'Caipiriña', insumos: [['Cachaza', 50], ['Azucar', 15], ['Limon', 20]] },
  { coctel: 'Daiquiri', insumos: [['Ron Blanco', 50], ['Jugo de Limon', 25], ['Azucar', 10]] },
  { coctel: 'Tequila Sunrise', insumos: [['Tequila', 50], ['Jugo de Naranja', 100], ['Granadina', 15]] }
];
async function idByNombre(nombre) {
  const [r] = await pool.query('SELECT id_producto FROM productos WHERE nombre LIKE ? LIMIT 1', ['%' + nombre + '%']);
  return r.length ? r[0].id_producto : null;
}
async function seed() {
  const conn = await pool.getConnection();
  try {
    await conn.query(`CREATE TABLE IF NOT EXISTS recetas (
      id_receta INT AUTO_INCREMENT PRIMARY KEY, producto_id INT NOT NULL, insumo_id INT NOT NULL,
      cantidad DECIMAL(12,4) NOT NULL DEFAULT 1.0000, factor_conversion DECIMAL(12,4) NOT NULL DEFAULT 1.0000,
      UNIQUE KEY uq_receta (producto_id, insumo_id))`);
    for (const rec of RECETAS) {
      const idCoctel = await idByNombre(rec.coctel);
      if (!idCoctel) { console.log(' - coctel no encontrado, omitido: ' + rec.coctel); continue; }
      for (const [insumo, cant] of rec.insumos) {
        const idIns = await idByNombre(insumo);
        if (!idIns) { console.log('   - insumo no encontrado: ' + insumo); continue; }
        await conn.query(
          `INSERT INTO recetas (producto_id, insumo_id, cantidad, factor_conversion) VALUES (?,?,?,1)
           ON DUPLICATE KEY UPDATE cantidad=VALUES(cantidad)`, [idCoctel, idIns, cant]);
        console.log(`   + ${rec.coctel} -> ${insumo} x${cant}`);
      }
    }
    console.log('Seed recetas OK. Vender un Margarita ahora descuenta tequila/jugo/etc., no "Margarita".');
  } finally { conn.release(); await pool.end(); }
}
if (require.main === module) seed();
module.exports = { seed, RECETAS };
