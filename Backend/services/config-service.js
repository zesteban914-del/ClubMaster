const { pool } = require('../config/database');

async function obtenerConfiguracionInventario() {
    const [rows] = await pool.query('SELECT clave, valor, descripcion FROM configuracion_inventario');
    const config = {};
    rows.forEach(function(r) { config[r.clave] = r.valor; });
    try{
        const [gRows]=await pool.query("SELECT clave, valor FROM configuracion_general WHERE clave IN ('iva_global','ico_global','analisis_dias_muertos','requiere_admin_ajuste_precios','requiere_admin_config','requiere_admin_mermas')");
        gRows.forEach(function(r){ if(config[r.clave]==null) config[r.clave]=r.valor; });
    }catch(e){}
    return config;
}

async function guardarConfiguracionInventario(datos) {
    if (!datos || typeof datos !== 'object') return { guardadas: 0 };
    const claves = Object.keys(datos);
    const globales=['iva_global','ico_global','analisis_dias_muertos','requiere_admin_ajuste_precios','requiere_admin_config','requiere_admin_mermas'];
    for (var i = 0; i < claves.length; i++) {
        const clave = claves[i];
        const valor = String(datos[clave] == null ? '' : datos[clave]);
        await pool.query(
            'INSERT INTO configuracion_inventario (clave, valor) VALUES (?, ?)' +
            ' ON DUPLICATE KEY UPDATE valor = VALUES(valor)',
            [clave, valor]
        );
        if(globales.indexOf(clave)!==-1){
            try{ await pool.query('INSERT INTO configuracion_general (clave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)', [clave, valor]); }catch(e){}
        }
    }
    return { guardadas: claves.length };
}

async function obtenerUnidadesMedida() {
    const [rows] = await pool.query('SELECT * FROM unidades_medida ORDER BY nombre ASC');
    return rows;
}

async function crearUnidadMedida(datos) {
    const [result] = await pool.query(
        'INSERT INTO unidades_medida (nombre, abreviacion, tipo) VALUES (?, ?, ?)',
        [(datos.nombre || '').trim(), (datos.abreviacion || '').trim(), datos.tipo || 'Unidad']
    );
    return { id_unidad: result.insertId };
}

async function actualizarUnidadMedida(id, datos) {
    await pool.query(
        'UPDATE unidades_medida SET nombre = ?, abreviacion = ?, tipo = ? WHERE id_unidad = ?',
        [(datos.nombre || '').trim(), (datos.abreviacion || '').trim(), datos.tipo || 'Unidad', id]
    );
}

async function eliminarUnidadMedida(id) {
    await pool.query('DELETE FROM unidades_medida WHERE id_unidad = ?', [id]);
}

async function obtenerConversiones() {
    const [rows] = await pool.query(
        'SELECT * FROM conversiones ORDER BY unidad_origen ASC, unidad_destino ASC'
    );
    return rows;
}

async function guardarConversiones(lista) {
    const items = Array.isArray(lista) ? lista : [];
    const conexion = await pool.getConnection();
    try {
        await conexion.beginTransaction();
        await conexion.query('DELETE FROM conversiones');
        for (var i = 0; i < items.length; i++) {
            const c = items[i];
            const origen = (c.unidad_origen || '').trim();
            const destino = (c.unidad_destino || '').trim();
            if (!origen || !destino || !(Number(c.factor) > 0)) continue;
            await conexion.query(
                'INSERT INTO conversiones (unidad_origen, unidad_destino, factor) VALUES (?, ?, ?)',
                [origen, destino, Number(c.factor)]
            );
        }
        await conexion.commit();
        return { guardadas: items.length };
    } catch (error) {
        await conexion.rollback();
        throw error;
    } finally {
        conexion.release();
    }
}

async function ajustarPreciosMasivo(datos) {
    const { obtenerColumnasProductos } = require('../helpers/column-detection');
    const { mapearCategoria } = require('../helpers/db-helpers');

    const c = obtenerColumnasProductos();
    if (!c.venta) throw new Error('No se detecto la columna de precio de venta');
    const colVenta = c.venta;
    const colCosto = c.costo || 'precio_costo';
    const objetivo = ['venta', 'costo', 'ambos'].indexOf(datos.objetivo) !== -1 ? datos.objetivo : 'ambos';
    const operacion = datos.operacion === 'monto' ? 'monto' : 'porcentaje';
    const valor = Number(datos.valor);
    if (!isFinite(valor) || valor === 0) throw new Error('El valor del ajuste debe ser un numero distinto de 0');
    const redondeo = Math.max(0, parseInt(datos.redondeo) || 0);

    const where = ['activo = 1'];
    const params = [];
    if (datos.alcance === 'categoria' && datos.categoria) {
        if (c.lista.indexOf('id_categoria') !== -1) {
            const idCat = await mapearCategoria(pool, String(datos.categoria));
            where.push('id_categoria = ?');
            params.push(idCat);
        } else {
            where.push('categoria = ?');
            params.push(datos.categoria);
        }
    } else if (datos.alcance === 'ids' && Array.isArray(datos.ids)) {
        const ids = datos.ids.map(function(i) { return Number(i); }).filter(function(i) { return i > 0; });
        if (ids.length === 0) throw new Error('No se recibieron ids de productos validos');
        where.push('id_producto IN (' + ids.map(function() { return '?'; }).join(', ') + ')');
        for (var k = 0; k < ids.length; k++) params.push(ids[k]);
    }

    const calculo = function(col) {
        var e = '(' + col + ' * ' + (operacion === 'porcentaje' ? (1 + valor / 100) : 1) +
            (operacion === 'monto' ? ' + ' + valor : '') + ')';
        if (redondeo > 0) e = 'ROUND(' + e + ' / ' + redondeo + ', 0) * ' + redondeo;
        return 'GREATEST(' + e + ', 0)';
    };

    const whereSql = where.join(' AND ');
    const conexion = await pool.getConnection();
    try {
        await conexion.beginTransaction();

        const [antes] = await conexion.query(
            'SELECT COALESCE(SUM(p.stock * p.' + colVenta + '),0) AS total_venta,' +
            ' COALESCE(SUM(p.stock * p.' + colCosto + '),0) AS total_costo,' +
            ' COUNT(*) AS productos' +
            ' FROM productos p WHERE ' + whereSql,
            params
        );

        const sets = [];
        if (objetivo === 'venta' || objetivo === 'ambos') sets.push(colVenta + ' = ' + calculo(colVenta));
        if (objetivo === 'costo' || objetivo === 'ambos') sets.push(colCosto + ' = ' + calculo(colCosto));
        if (sets.length === 0) throw new Error('Seleccione al menos un objetivo de precio');

        await conexion.query(
            'UPDATE productos SET ' + sets.join(', ') + ' WHERE ' + whereSql,
            params
        );

        const [despues] = await conexion.query(
            'SELECT COALESCE(SUM(p.stock * p.' + colVenta + '),0) AS total_venta,' +
            ' COALESCE(SUM(p.stock * p.' + colCosto + '),0) AS total_costo,' +
            ' COUNT(*) AS productos' +
            ' FROM productos p WHERE ' + whereSql,
            params
        );

        await conexion.commit();
        return {
            productos_afectados: Number(despues[0].productos) || 0,
            total_venta_antes: Number(antes[0].total_venta) || 0,
            total_venta_despues: Number(despues[0].total_venta) || 0,
            total_costo_antes: Number(antes[0].total_costo) || 0,
            total_costo_despues: Number(despues[0].total_costo) || 0
        };
    } catch (error) {
        await conexion.rollback();
        throw error;
    } finally {
        conexion.release();
    }
}

async function aplicarImpuestosGlobales(iva, ico) {
    const ivaVal = (iva === '' || iva === null || iva === undefined) ? null : Number(iva);
    const icoVal = (ico === '' || ico === null || ico === undefined) ? null : Number(ico);
    const conexion = await pool.getConnection();
    try {
        await conexion.beginTransaction();
        const [antes] = await conexion.query('SELECT COUNT(*) AS total FROM productos WHERE activo = 1');
        await conexion.query('UPDATE productos SET iva_pct = ?, ico_pct = ? WHERE activo = 1', [ivaVal, icoVal]);
        await conexion.query(
            "UPDATE configuracion_inventario SET valor = ? WHERE clave = 'iva_global'",
            [ivaVal == null ? '0' : String(ivaVal)]
        );
        await conexion.query(
            "UPDATE configuracion_inventario SET valor = ? WHERE clave = 'ico_global'",
            [icoVal == null ? '0' : String(icoVal)]
        );
        await conexion.commit();
        return { productos_actualizados: Number(antes[0].total) || 0 };
    } catch (error) {
        await conexion.rollback();
        throw error;
    } finally {
        conexion.release();
    }
}

module.exports = {
    obtenerConfiguracionInventario,
    guardarConfiguracionInventario,
    obtenerUnidadesMedida,
    crearUnidadMedida,
    actualizarUnidadMedida,
    eliminarUnidadMedida,
    obtenerConversiones,
    guardarConversiones,
    ajustarPreciosMasivo,
    aplicarImpuestosGlobales
};
