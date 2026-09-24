let columnasProductos = null;
let columnasPedidosCache = null;

function obtenerColumnasProductos() {
    return columnasProductos || {
        venta: 'precio', costo: 'precio_costo', imagen: 'imagen', descripcion: 'descripcion',
        info: {}, lista: ['id_producto', 'nombre', 'precio', 'categoria'], obligatorias: []
    };
}

async function detectarColumnasProductos(pool) {
    const [colReales] = await pool.query('SHOW COLUMNS FROM productos');
    const nombresCol = colReales.map(function(c) { return c.Field; });
    const infoCol = {};
    colReales.forEach(function(c) { infoCol[c.Field] = c; });
    const existeCol = function(n) { return nombresCol.indexOf(n) !== -1; };
    const obligatorias = colReales.filter(function(c) {
        return c.Null === 'NO'
            && (c.Default === null || c.Default === undefined)
            && c.Extra !== 'auto_increment';
    }).map(function(c) { return c.Field; });

    columnasProductos = {
        venta: existeCol('precio_venta') ? 'precio_venta' : (existeCol('precio') ? 'precio' : null),
        costo: existeCol('precio_costo') ? 'precio_costo' : (existeCol('precio_costos') ? 'precio_costos' : (existeCol('costo') ? 'costo' : null)),
        imagen: existeCol('imagen') ? 'imagen' : null,
        descripcion: existeCol('descripcion') ? 'descripcion' : null,
        info: infoCol,
        lista: nombresCol,
        obligatorias: obligatorias
    };
    console.log('Columnas de productos detectadas:', JSON.stringify({
        venta: columnasProductos.venta,
        costo: columnasProductos.costo,
        obligatorias: obligatorias
    }));
    return columnasProductos;
}

async function obtenerColumnasPedidos(pool) {
    if (!columnasPedidosCache) {
        const [cols] = await pool.query('SHOW COLUMNS FROM pedidos');
        const nombres = cols.map(function(c) { return c.Field; });
        columnasPedidosCache = {
            timestamp: nombres.indexOf('timestamp_pedido') !== -1 ? 'timestamp_pedido'
                : (nombres.indexOf('fecha_pedido') !== -1 ? 'fecha_pedido' : null),
            fecha: nombres.indexOf('fecha_pedido') !== -1 ? 'fecha_pedido' : null
        };
    }
    return columnasPedidosCache;
}

module.exports = {
    obtenerColumnasProductos,
    detectarColumnasProductos,
    obtenerColumnasPedidos
};
