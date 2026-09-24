function redondear(valor) {
    return Math.round((Number(valor) || 0) * 100) / 100;
}

function valorPorDefectoObligatorio(nombreCol, datos, tipo) {
    const t = String(tipo || '').toLowerCase();
    const esNumerico = t.indexOf('int') !== -1 || t.indexOf('decimal') !== -1 || t.indexOf('double') !== -1 || t.indexOf('float') !== -1;
    const n = nombreCol.toLowerCase();

    if (n.indexOf('nombre') !== -1) return datos.nombre || '';
    if (n === 'precio_venta' || n === 'precio' || n === 'precio_costo' || n === 'costos') {
        if (n.indexOf('costo') !== -1 || n === 'costos') return Number(datos.precio_costo) || 0;
        return Number(datos.precio) || 0;
    }
    if (n === 'unidad' || n === 'unidad_medida' || n === 'medida') return 'Unidad';
    if (n === 'id_categoria') return 1;
    if (n.indexOf('categoria') !== -1) return datos.categoria || 'General';
    if (n === 'stock') return Number(datos.stock) || 0;
    if (n === 'stock_minimo') return Number(datos.stock_minimo) || 5;
    if (n === 'activo') return 1;
    if (n === 'factor_conversion') return null;

    if (esNumerico) return 0;
    return '';
}

async function mapearCategoria(pool, nombre) {
    var cat = (nombre || 'General').toString().trim() || 'General';
    const [filas] = await pool.query('SELECT id_categoria FROM categorias WHERE nombre = ?', [cat]);
    if (filas.length > 0) return filas[0].id_categoria;
    const [ins] = await pool.query('INSERT INTO categorias (nombre) VALUES (?)', [cat]);
    return ins.insertId;
}

function categoriaMetodoPago(codigo) {
    const c = String(codigo || '').toLowerCase();
    if (c === 'efectivo') return 'Efectivo';
    if (['nequi', 'daviplata', 'breb', 'breb_qr', 'qr', 'pse', 'otrowallet'].indexOf(c) !== -1) return 'Wallet';
    if (['debito', 'credito', 'tarjeta', 'visa', 'mastercard', 'amex', 'datáfono', 'datáfonos', 'datosfono'].indexOf(c) !== -1) return 'Tarjeta';
    if (c === 'cortesia') return 'Cortesia';
    if (['vale', 'fiado', 'credito'].indexOf(c) !== -1) return 'Credito';
    return 'Otros';
}

async function ejecutarQuery(db, sql, params) {
    return db.query(sql, params || []);
}

function colsEnSets(sets, col) {
    return sets.some(function(s) { return s.indexOf(col + ' = ?') === 0; });
}

module.exports = {
    redondear,
    redondearDinero: redondear,
    valorPorDefectoObligatorio,
    mapearCategoria,
    categoriaMetodoPago,
    ejecutarQuery,
    colsEnSets
};
