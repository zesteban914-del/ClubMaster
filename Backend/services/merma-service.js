const { pool } = require('../config/database');
const { descontarStockConConversion } = require('./producto-service');
const { obtenerColumnasProductos } = require('../helpers/column-detection');

async function getCostoCol() {
    const c = obtenerColumnasProductos();
    return c.costo || 'precio_costo';
}

async function crearMerma(idProducto, cantidad, motivo, idUsuario, observaciones, costoUnitOverride, areaOrigen) {
    const cant = Math.max(1, parseInt(cantidad) || 0);
    if (!cant) throw new Error('Cantidad invalida');
    if (!idProducto) throw new Error('Producto requerido');
    const motivoNorm = String(motivo || '').trim();
    const permitidos = ['Rotura','Derrame','Vencimiento','Cortesia','Consumo Interno','Consumo interno'];
    if (!permitidos.includes(motivoNorm)) throw new Error('Motivo no valido');
    const motivoFinal = motivoNorm.toLowerCase()==='consumo interno' ? 'Consumo Interno' : motivoNorm;

    const obs = (observaciones || '').toString().trim().slice(0,500);
    const area = (areaOrigen||'').toString().trim().slice(0,60) || null;
    const cCol = await getCostoCol();

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [prodRows] = await connection.query(`SELECT id_producto, stock, ${cCol} AS costo FROM productos WHERE id_producto=? FOR UPDATE`, [idProducto]);
        if (prodRows.length === 0) throw new Error('Producto no encontrado');
        const prod = prodRows[0];
        const costoUnit = costoUnitOverride != null ? Number(costoUnitOverride) : Number(prod.costo) || 0;
        const valorPerdida = Math.round(costoUnit * cant * 100) / 100;

        if (Number(prod.stock) < cant) throw new Error(`Stock insuficiente. Disponible: ${prod.stock}`);

        try { await connection.query(`ALTER TABLE mermas ADD COLUMN area_origen VARCHAR(60) NULL`); } catch(e) {}
        let hasAreaCol=true;
        try { await connection.query(`SELECT area_origen FROM mermas LIMIT 0`); } catch(e){ hasAreaCol=false; }
        let resMerma;
        if(hasAreaCol){
            const [r] = await connection.query(
                'INSERT INTO mermas (id_producto, cantidad, motivo, observaciones, costo_unitario, valor_perdida, id_usuario, area_origen) VALUES (?,?,?,?,?,?,?,?)',
                [idProducto, cant, motivoFinal, obs || null, costoUnit, valorPerdida, idUsuario || null, area]
            ); resMerma=r;
        } else {
            const [r] = await connection.query(
                'INSERT INTO mermas (id_producto, cantidad, motivo, observaciones, costo_unitario, valor_perdida, id_usuario) VALUES (?,?,?,?,?,?,?)',
                [idProducto, cant, motivoFinal, obs || null, costoUnit, valorPerdida, idUsuario || null]
            ); resMerma=r;
        }

        await descontarStockConConversion(idProducto, cant, connection);

        await connection.commit();
        return { id_merma: resMerma.insertId, costo_unitario: costoUnit, valor_perdida: valorPerdida };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

async function obtenerMermasMes() {
    const cCol = await getCostoCol();
    let hasArea=false;
    try{ const [c]=await pool.query(`SHOW COLUMNS FROM mermas LIKE 'area_origen'`); hasArea=c.length>0; }catch(e){}
    const areaSel = hasArea ? 'm.area_origen,' : 'NULL AS area_origen,';
    const [rows] = await pool.query(`
        SELECT m.*, ${areaSel} p.nombre AS producto_nombre, p.stock AS stock_actual,
               m.costo_unitario AS costo_unitario,
               m.valor_perdida AS valor_total,
               COALESCE(u.nombre,'') AS usuario_nombre
        FROM mermas m
        LEFT JOIN productos p ON m.id_producto = p.id_producto
        LEFT JOIN usuarios u ON m.id_usuario = u.id_usuario
        WHERE MONTH(m.fecha)=MONTH(NOW()) AND YEAR(m.fecha)=YEAR(NOW())
        ORDER BY m.fecha DESC`);
    return rows.map(function(r){
        if(!r.costo_unitario && r.costo_unitario!==0){
            const c = obtenerColumnasProductos();
            r.costo_unitario = 0;
        }
        if(r.valor_total==null) r.valor_total = (Number(r.costo_unitario)||0)*Number(r.cantidad);
        return r;
    });
}

async function obtenerMermasFiltradas({desde,hasta,motivo}){
    const cCol = await getCostoCol();
    const params=[]; let where='1=1';
    if(desde){ where+=' AND DATE(m.fecha) >= ?'; params.push(desde); }
    if(hasta){ where+=' AND DATE(m.fecha) <= ?'; params.push(hasta); }
    if(motivo && ['Rotura','Derrame','Vencimiento','Cortesia','Consumo Interno'].includes(motivo)){ where+=' AND m.motivo = ?'; params.push(motivo); }
    let hasArea=false;
    try{ const [c]=await pool.query(`SHOW COLUMNS FROM mermas LIKE 'area_origen'`); hasArea=c.length>0; }catch(e){}
    const areaSel = hasArea ? 'm.area_origen,' : 'NULL AS area_origen,';
    const [rows]=await pool.query(`
        SELECT m.*, ${areaSel} p.nombre AS producto_nombre, p.stock AS stock_actual,
               m.costo_unitario, m.valor_perdida AS valor_total,
               m.observaciones, COALESCE(u.nombre,'') AS usuario_nombre
        FROM mermas m
        LEFT JOIN productos p ON m.id_producto=p.id_producto
        LEFT JOIN usuarios u ON m.id_usuario=u.id_usuario
        WHERE ${where}
        ORDER BY m.fecha DESC LIMIT 500`, params);
    return rows;
}

async function obtenerKPIsMermas(filtros){
    filtros=filtros||{};
    const rows = await obtenerMermasFiltradas(filtros);
    const totalValor = rows.reduce(function(a,m){return a+Number(m.valor_total||0);},0);
    const conteo={};
    rows.forEach(function(m){ conteo[m.motivo]=(conteo[m.motivo]||0)+1; });
    let frec='-'; let max=0; Object.keys(conteo).forEach(function(k){ if(conteo[k]>max){max=conteo[k]; frec=k;}});
    return { mermas: rows, total_valor: totalValor, total_registros: rows.length, motivo_frecuente: frec, conteo };
}

module.exports = { crearMerma, obtenerMermasMes, obtenerMermasFiltradas, obtenerKPIsMermas, getCostoCol };
