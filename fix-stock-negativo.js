require('dotenv').config();
require('dotenv').config({ path: 'Backend/.env' });
const { poolReal } = require('./Backend/config/database');
(async () => {
  try {
    const [neg] = await poolReal.query('SELECT id_producto, nombre, stock FROM productos WHERE stock < 0');
    console.log('Negativos encontrados:', neg);
    const [r] = await poolReal.query('UPDATE productos SET stock = 0 WHERE stock < 0');
    console.log('Productos corregidos:', r.affectedRows);
    try {
      const [b] = await poolReal.query('UPDATE stock_bodegas SET stock = GREATEST(0, stock) WHERE stock < 0');
      console.log('Bodegas corregidas:', b.affectedRows);
    } catch (e) { console.log('Bodegas: ' + e.message); }
    await poolReal.end();
  } catch (e) { console.error('ERROR: ' + e.message); process.exit(1); }
})();
