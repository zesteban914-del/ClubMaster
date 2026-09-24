const { pool } = require('../config/database');
const { obtenerColumnasProductos, obtenerColumnasPedidos } = require('../helpers/column-detection');
const { exprMeseroId, exprCajeroId, exprMeseroNombre, exprCajeroNombre } = require('../helpers/atribucion');

async function topProductos(limite) {
    const c = obtenerColumnasProductos();
    const usaIdCat = c.lista.indexOf('id_categoria') !== -1;
    let categoriaSelect = 'p.categoria';
    let joinCat = '';
    if (usaIdCat) {
        categoriaSelect = "COALESCE(cat.nombre, 'General') AS categoria";
        joinCat = ' LEFT JOIN categorias cat ON p.id_categoria = cat.id_categoria';
    }
    const lim = Math.max(1, Math.min(100, parseInt(limite) || 10));
    const [rows] = await pool.query(
        'SELECT p.id_producto, p.nombre, ' + categoriaSelect + ', SUM(dp.cantidad) AS total_vendido,' +
        ' SUM(dp.subtotal) AS total_ingresos' +
        ' FROM detalle_pedido dp' +
        ' INNER JOIN productos p ON dp.id_producto = p.id_producto' +
        ' INNER JOIN pedidos ped ON dp.id_pedido = ped.id_pedido' +
        joinCat +
        " WHERE ped.estado = 'Pagado'" +
        ' GROUP BY p.id_producto, p.nombre' +
        ' ORDER BY total_vendido DESC LIMIT ' + lim
    );
    return rows;
}

async function historicoIngresos(fechaInicio, fechaFin) {
    const ped = await obtenerColumnasPedidos(pool);
    const colFecha = ped.timestamp || ped.fecha || 'fecha_pedido';
    const params = [];
    let where = " WHERE ped.estado = 'Pagado'";
    if (fechaInicio) { where += ' AND ped.' + colFecha + ' >= ?'; params.push(fechaInicio); }
    if (fechaFin) { where += ' AND ped.' + colFecha + ' <= ?'; params.push(fechaFin + ' 23:59:59'); }
    const sql = `SELECT DATE(ped.${colFecha}) AS fecha, COALESCE(SUM(ped.total),0) AS total_ingresos, COUNT(ped.id_pedido) AS cantidad_ventas, COALESCE(ped.metodo_pago,'Sin metodo') AS metodo_pago FROM pedidos ped ${where} GROUP BY DATE(ped.${colFecha}), ped.metodo_pago ORDER BY fecha DESC, ped.metodo_pago`;
    const [rows] = await pool.query(sql, params);
    return rows;
}

async function tiemposBarra() {
    const ped = await obtenerColumnasPedidos(pool);
    const colTs = ped.timestamp || ped.fecha || 'timestamp_pedido';
    const colDesp = 'timestamp_despacho';
    let hasDesp = false;
    try { const [cols] = await pool.query('SHOW COLUMNS FROM pedidos LIKE ?', [colDesp]); hasDesp = cols.length > 0; } catch (e) { hasDesp = false; }
    const tiempoExpr = hasDesp ? 'TIMESTAMPDIFF(MINUTE, p.' + colTs + ', p.' + colDesp + ') AS tiempo_minutos, p.' + colDesp + ' AS timestamp_despacho' : 'NULL AS tiempo_minutos, NULL AS timestamp_despacho';
    const sql = `SELECT p.id_pedido, p.total, p.${colTs} AS timestamp_pedido, ${tiempoExpr}, p.estado, m.numero AS mesa_numero, u.nombre AS bartender FROM pedidos p LEFT JOIN mesas m ON p.id_mesa = m.id_mesa LEFT JOIN usuarios u ON p.id_usuario = u.id_usuario WHERE DATE(p.${colTs}) = CURDATE() ORDER BY p.${colTs} DESC`;
    try { const [rows] = await pool.query(sql); return rows; } catch (e) {
        const [fallback] = await pool.query(`SELECT p.id_pedido, p.total, p.estado, m.numero AS mesa_numero, u.nombre AS bartender, NULL AS tiempo_minutos, NULL AS timestamp_pedido, NULL AS timestamp_despacho FROM pedidos p LEFT JOIN mesas m ON p.id_mesa = m.id_mesa LEFT JOIN usuarios u ON p.id_usuario = u.id_usuario WHERE p.estado='Pagado' AND DATE(p.${colTs})=CURDATE() ORDER BY p.id_pedido DESC`);
        return fallback;
    }
}

function buildWhereFiltros(f, colTs) {
    const params = [];
    let where = " ped.estado='Pagado'";
    if (f.fecha_inicio) { where += ' AND ped.' + colTs + ' >= ?'; params.push(f.fecha_inicio); }
    if (f.fecha_fin) { where += ' AND ped.' + colTs + ' <= ?'; params.push(f.fecha_fin + ' 23:59:59'); }
    if (f.id_jornada) { where += ' AND ped.id_jornada = ?'; params.push(parseInt(f.id_jornada)); }
    if (f.id_mesero) { where += ' AND COALESCE(ped.id_mesero, ped.id_usuario) = ?'; params.push(parseInt(f.id_mesero)); }
    if (f.id_cajero) { where += ' AND COALESCE(ped.id_cajero, ped.id_usuario) = ?'; params.push(parseInt(f.id_cajero)); }
    return { where, params };
}

async function reporteVentasGeneral(filtros) {
    filtros = filtros || {};
    const c = obtenerColumnasProductos();
    const colCosto = c.costo || 'precio_costo';
    const ped = await obtenerColumnasPedidos(pool);
    const colTs = ped.timestamp || ped.fecha || 'timestamp_pedido';
    const { where, params } = buildWhereFiltros(filtros, colTs);
    const [kpiRows] = await pool.query(`SELECT COALESCE(SUM(ped.total),0) AS ingresos, COALESCE(SUM(ped.propina),0) AS propinas, COALESCE(SUM(ped.descuento),0) AS descuentos, COUNT(*) AS num_ventas, COALESCE(AVG(ped.total),0) AS ticket_promedio FROM pedidos ped WHERE ${where}`, params);
    const kpi = kpiRows[0] || {};
    let utilidad = 0;
    try {
        const sqlUtil = `SELECT COALESCE(SUM((dp.precio_unitario - COALESCE(p.${colCosto},0)) * dp.cantidad),0) AS utilidad, COALESCE(SUM(dp.subtotal),0) AS ventas FROM detalle_pedido dp INNER JOIN pedidos ped ON dp.id_pedido=ped.id_pedido LEFT JOIN productos p ON dp.id_producto=p.id_producto WHERE ${where}`;
        const [uRows] = await pool.query(sqlUtil, params);
        utilidad = Number(uRows[0].utilidad) || 0;
        if (!Number(kpi.ingresos)) kpi.ingresos = Number(uRows[0].ventas) || 0;
    } catch (e) { utilidad = 0; }
    const ingresos = Number(kpi.ingresos) || 0;
    const propinas = Number(kpi.propinas) || 0;
    const descuentos = Number(kpi.descuentos) || 0;
    const ventasNetas = ingresos - propinas; // Ventas netas sin propinas
    const numVentas = Number(kpi.num_ventas) || 0;
    const ticketProm = numVentas ? Math.round(ingresos / numVentas) : 0;
    const [metodos] = await pool.query(`SELECT COALESCE(ped.metodo_pago,'Sin metodo') AS metodo, COUNT(*) AS cantidad, COALESCE(SUM(ped.total),0) AS total FROM pedidos ped WHERE ${where} GROUP BY ped.metodo_pago ORDER BY total DESC`, params);
    const metodosFmt = metodos.map(function(r){ return { metodo: r.metodo, cantidad: Number(r.cantidad), total: Number(r.total), pct: ingresos? Math.round(Number(r.total)/ingresos*1000)/10:0 }; });
    let horas = [];
    try {
        const [hRows] = await pool.query(`SELECT HOUR(ped.${colTs}) AS hora, COUNT(*) AS cantidad, COALESCE(SUM(ped.total),0) AS total FROM pedidos ped WHERE ${where} GROUP BY HOUR(ped.${colTs}) ORDER BY hora`, params);
        horas = hRows.map(function(r){ return { hora: Number(r.hora), cantidad: Number(r.cantidad), total: Number(r.total) }; });
        for(let h=0;h<24;h++){ if(!horas.find(function(x){return x.hora===h;})) horas.push({hora:h,cantidad:0,total:0}); }
        horas.sort(function(a,b){return a.hora-b.hora;});
    } catch(e){ horas = []; }
    let historico = [];
    try {
        const [h2] = await pool.query(`SELECT DATE(ped.${colTs}) AS fecha, COALESCE(SUM(ped.total),0) AS total, COUNT(*) AS cantidad FROM pedidos ped WHERE ${where} GROUP BY DATE(ped.${colTs}) ORDER BY fecha DESC LIMIT 30`, params);
        historico = h2.map(function(r){ return { fecha: r.fecha, total: Number(r.total), cantidad: Number(r.cantidad)}; });
    } catch(e){ historico=[]; }
    return { kpis: { ingresos, ventas_netas: ventasNetas, utilidad, ticket_promedio: ticketProm, propinas, descuentos, num_ventas: numVentas }, desglose_metodos: metodosFmt, horas_pico: horas, historico };
}

async function reportePersonalZonas(filtros) {
    filtros = filtros || {};
    const ped = await obtenerColumnasPedidos(pool);
    const colTs = ped.timestamp || ped.fecha || 'timestamp_pedido';
    const { where, params } = buildWhereFiltros(filtros, colTs);
    let meserosFmt=[];
    let cajerosFmt=[];
    try{
        const [meseros] = await pool.query(`SELECT ${exprMeseroId('ped')} AS id_usuario, ${exprMeseroNombre('u2', 'u')} AS nombre, COUNT(*) AS ventas, COALESCE(SUM(ped.total),0) AS total, COALESCE(SUM(ped.propina),0) AS propinas, COALESCE(AVG(ped.total),0) AS ticket_prom FROM pedidos ped LEFT JOIN usuarios u ON ped.id_usuario=u.id_usuario LEFT JOIN usuarios u2 ON ped.id_mesero=u2.id_usuario WHERE ${where} GROUP BY ${exprMeseroId('ped')}, ${exprMeseroNombre('u2', 'u')} ORDER BY total DESC`, params);
        meserosFmt = meseros.map(function(r){ return { id_usuario: r.id_usuario, nombre: r.nombre, ventas: Number(r.ventas), total: Number(r.total), propinas: Number(r.propinas), ticket_promedio: Math.round(Number(r.ticket_prom)||0)}; });
        const [cajeros] = await pool.query(`SELECT ${exprCajeroId('ped')} AS id_usuario, ${exprCajeroNombre('u3', 'u')} AS nombre, COUNT(*) AS ventas, COALESCE(SUM(ped.total),0) AS total, COALESCE(SUM(ped.propina),0) AS propinas, COALESCE(AVG(ped.total),0) AS ticket_prom FROM pedidos ped LEFT JOIN usuarios u ON ped.id_usuario=u.id_usuario LEFT JOIN usuarios u3 ON ped.id_cajero=u3.id_usuario WHERE ${where} GROUP BY ${exprCajeroId('ped')}, ${exprCajeroNombre('u3', 'u')} ORDER BY total DESC`, params);
        cajerosFmt = cajeros.map(function(r){ return { id_usuario: r.id_usuario, nombre: r.nombre, ventas: Number(r.ventas), total: Number(r.total), propinas: Number(r.propinas), ticket_promedio: Math.round(Number(r.ticket_prom)||0)}; });
    }catch(e){ meserosFmt=[]; cajerosFmt=[]; try{ const [m2]=await pool.query(`SELECT ped.id_usuario, COUNT(*) AS ventas, COALESCE(SUM(ped.total),0) AS total FROM pedidos ped WHERE ${where} GROUP BY ped.id_usuario`, params); meserosFmt=m2.map(function(r){return {id_usuario:r.id_usuario, nombre:'Usuario #'+r.id_usuario, ventas:Number(r.ventas), total:Number(r.total), propinas:0, ticket_promedio:0};}); }catch(e2){} }
    let zonas = [];
    try {
        const [zRows] = await pool.query(`SELECT COALESCE(m.zona,'Sin zona') AS zona, COUNT(*) AS ventas, COALESCE(SUM(ped.total),0) AS total, COALESCE(SUM(ped.propina),0) AS propinas FROM pedidos ped LEFT JOIN mesas m ON ped.id_mesa=m.id_mesa WHERE ${where} GROUP BY m.zona ORDER BY total DESC`, params);
        zonas = zRows.map(function(r){ return { zona: r.zona, ventas: Number(r.ventas), total: Number(r.total), propinas: Number(r.propinas)}; });
    } catch(e){
        const [z2] = await pool.query(`SELECT 'General' AS zona, COUNT(*) AS ventas, COALESCE(SUM(ped.total),0) AS total FROM pedidos ped WHERE ${where}`, params);
        zonas = [{ zona:'General', ventas: Number(z2[0].ventas), total: Number(z2[0].total), propinas:0 }];
    }
    return { meseros: meserosFmt, cajeros: cajerosFmt, zonas };
}

async function reporteTicketEmpleadoDetallado(filtros) {
    filtros = filtros || {};
    // =========================================================
    // CORRECCIÓN: Priorizar facturas/detalle_factura (ventas cobradas)
    // Spec: facturas f INNER JOIN detalle_factura df ON f.id_factura=df.id_factura
    //       INNER JOIN productos p ON df.id_producto=p.id_producto
    //       LEFT JOIN mesas m ON f.id_mesa=m.id_mesa
    // Filtra por id_mesero y rango fechas, agrupa y renderiza lista detallada
    // =========================================================
    let usaFacturas = false;
    let hasDetalleFactura = false;
    try { const [r] = await pool.query("SHOW TABLES LIKE 'facturas'"); usaFacturas = r.length > 0; } catch(e){ usaFacturas=false; }
    try { const [r] = await pool.query("SHOW TABLES LIKE 'detalle_factura'"); hasDetalleFactura = r.length > 0; } catch(e){ hasDetalleFactura=false; }
    if (usaFacturas && hasDetalleFactura) {
        try {
            let hasMeseroFact = false;
            let hasCajeroFact = false;
            try { const [c]=await pool.query("SHOW COLUMNS FROM facturas LIKE 'id_mesero'"); hasMeseroFact=c.length>0; } catch(e){}
            try { const [c]=await pool.query("SHOW COLUMNS FROM facturas LIKE 'id_cajero'"); hasCajeroFact=c.length>0; } catch(e){}
            let colFechaFact = 'fecha';
            try {
                const [c]=await pool.query("SHOW COLUMNS FROM facturas LIKE 'fecha'");
                if(!c.length){
                    const [c2]=await pool.query("SHOW COLUMNS FROM facturas LIKE 'created_at'");
                    if(c2.length) colFechaFact='created_at';
                    else {
                        const [c3]=await pool.query("SHOW COLUMNS FROM facturas LIKE 'fecha_factura'");
                        if(c3.length) colFechaFact='fecha_factura';
                    }
                }
            } catch(e){}
            const params=[];
            let where=" f.estado='Pagada'";
            if (filtros.fecha_inicio) { where += ` AND f.${colFechaFact} >= ?`; params.push(filtros.fecha_inicio); }
            if (filtros.fecha_fin) { where += ` AND f.${colFechaFact} <= ?`; params.push(filtros.fecha_fin + ' 23:59:59'); }
            if (filtros.id_jornada) { where += ' AND f.id_jornada = ?'; params.push(parseInt(filtros.id_jornada)); }
            if (filtros.id_mesero) {
                if (hasMeseroFact) where += ' AND COALESCE(f.id_mesero, f.id_usuario) = ?';
                else where += ' AND f.id_usuario = ?';
                params.push(parseInt(filtros.id_mesero));
            }
            if (filtros.id_cajero) {
                if (hasCajeroFact) where += ' AND COALESCE(f.id_cajero, f.id_usuario) = ?';
                else where += ' AND f.id_usuario = ?';
                params.push(parseInt(filtros.id_cajero));
            }
            const meseroIdExpr = hasMeseroFact ? 'COALESCE(f.id_mesero, f.id_usuario)' : 'f.id_usuario';
            const meseroNombreExpr = hasMeseroFact ? "COALESCE(u2.nombre, u.nombre, 'Sin asignar')" : "COALESCE(u.nombre,'Sin asignar')";
            const cajeroIdExpr = hasCajeroFact ? 'COALESCE(f.id_cajero, f.id_usuario)' : 'f.id_usuario';
            const cajeroNombreExpr = hasCajeroFact ? "COALESCE(u3.nombre, u.nombre, 'Sin asignar')" : "COALESCE(u.nombre,'Sin asignar')";
            const joinMesero2 = hasMeseroFact ? 'LEFT JOIN usuarios u2 ON f.id_mesero = u2.id_usuario' : '';
            const joinCajero2 = hasCajeroFact ? 'LEFT JOIN usuarios u3 ON f.id_cajero = u3.id_usuario' : '';
            let meserosFmt=[];
            let cajerosFmt=[];
            try{
                const sqlMes=`SELECT ${meseroIdExpr} AS id_usuario, ${meseroNombreExpr} AS nombre, COUNT(*) AS ventas, COALESCE(SUM(f.total),0) AS total, COALESCE(SUM(f.propina),0) AS propinas, COALESCE(AVG(f.total),0) AS ticket_prom FROM facturas f LEFT JOIN usuarios u ON f.id_usuario=u.id_usuario ${joinMesero2} WHERE ${where} GROUP BY ${meseroIdExpr}, ${meseroNombreExpr} ORDER BY total DESC`;
                const [meseros]=await pool.query(sqlMes, params);
                meserosFmt=meseros.map(function(r){ return { id_usuario: r.id_usuario, nombre: r.nombre, ventas: Number(r.ventas), total: Number(r.total), propinas: Number(r.propinas), ticket_promedio: Math.round(Number(r.ticket_prom)||0)}; });
                const sqlCaj=`SELECT ${cajeroIdExpr} AS id_usuario, ${cajeroNombreExpr} AS nombre, COUNT(*) AS ventas, COALESCE(SUM(f.total),0) AS total, COALESCE(SUM(f.propina),0) AS propinas, COALESCE(AVG(f.total),0) AS ticket_prom FROM facturas f LEFT JOIN usuarios u ON f.id_usuario=u.id_usuario ${joinCajero2} WHERE ${where} GROUP BY ${cajeroIdExpr}, ${cajeroNombreExpr} ORDER BY total DESC`;
                const [cajeros]=await pool.query(sqlCaj, params);
                cajerosFmt=cajeros.map(function(r){ return { id_usuario: r.id_usuario, nombre: r.nombre, ventas: Number(r.ventas), total: Number(r.total), propinas: Number(r.propinas), ticket_promedio: Math.round(Number(r.ticket_prom)||0)}; });
            }catch(e){ console.error('reporteTicketEmpleadoDetallado facturas meseros/cajeros error:', e.message); meserosFmt=[]; cajerosFmt=[]; }
            let zonas=[];
            try{
                const [zRows]=await pool.query(`SELECT COALESCE(m.zona,'Sin zona') AS zona, COUNT(*) AS ventas, COALESCE(SUM(f.total),0) AS total, COALESCE(SUM(f.propina),0) AS propinas FROM facturas f LEFT JOIN mesas m ON f.id_mesa=m.id_mesa WHERE ${where} GROUP BY m.zona ORDER BY total DESC`, params);
                zonas=zRows.map(function(r){ return { zona: r.zona, ventas: Number(r.ventas), total: Number(r.total), propinas: Number(r.propinas)}; });
            }catch(e){ zonas=[]; }
            // Detalle por mesa/productos desde facturas + detalle_factura
            let detallePorMesero=[];
            try{
                const sqlDet=`SELECT ${meseroIdExpr} AS id_mesero_real, ${meseroNombreExpr} AS mesero_nombre, f.id_factura AS id_pedido, f.id_mesa, COALESCE(CAST(m.numero AS CHAR), m.nombre, CONCAT('Mesa #', f.id_mesa)) AS mesa_identificador, m.nombre AS mesa_nombre, m.zona AS mesa_zona, f.${colFechaFact} AS fecha_venta, f.total AS pedido_total, f.propina AS pedido_propina, f.metodo_pago, f.descuento, f.es_cortesia, df.id_producto, COALESCE(p.nombre, df.producto_nombre, CONCAT('Producto #', df.id_producto)) AS producto_nombre, df.cantidad, df.precio_unitario, COALESCE(df.subtotal, df.cantidad*df.precio_unitario,0) AS subtotal_linea FROM facturas f LEFT JOIN usuarios u ON f.id_usuario=u.id_usuario ${joinMesero2} LEFT JOIN mesas m ON f.id_mesa=m.id_mesa INNER JOIN detalle_factura df ON df.id_factura=f.id_factura LEFT JOIN productos p ON df.id_producto=p.id_producto WHERE ${where} ORDER BY ${meseroIdExpr}, f.${colFechaFact} ASC, f.id_factura, df.id_detalle LIMIT 5000`;
                const [rows]=await pool.query(sqlDet, params);
                if(rows.length>0){
                    const meseroMap=new Map();
                    meserosFmt.forEach(function(m){ meseroMap.set(String(m.id_usuario), { id_usuario:m.id_usuario, nombre:m.nombre, ventas:m.ventas, total:m.total, propinas:m.propinas, ticket_promedio:m.ticket_promedio, transaccionesMap:new Map(), consolidadoMap:new Map(), totales:{ventas:m.ventas, total:m.total, propinas:m.propinas, ticket_promedio:m.ticket_promedio} }); });
                    rows.forEach(function(r){
                        const keyMesero=String(r.id_mesero_real);
                        if(!meseroMap.has(keyMesero)){
                            meseroMap.set(keyMesero, { id_usuario:Number(r.id_mesero_real), nombre:r.mesero_nombre, ventas:0, total:0, propinas:0, ticket_promedio:0, transaccionesMap:new Map(), consolidadoMap:new Map(), totales:{ventas:0,total:0,propinas:0,ticket_promedio:0} });
                        }
                        const mes=meseroMap.get(keyMesero);
                        const pedidoKey=String(r.id_pedido);
                        if(!mes.transaccionesMap.has(pedidoKey)){
                            mes.transaccionesMap.set(pedidoKey, { id_pedido:r.id_pedido, id_mesa:r.id_mesa, mesa:r.mesa_identificador, mesa_nombre:r.mesa_nombre||r.mesa_identificador, mesa_zona:r.mesa_zona||'Sin zona', fecha:r.fecha_venta, total:Number(r.pedido_total), propina:Number(r.pedido_propina), metodo_pago:r.metodo_pago, descuento:Number(r.descuento), cortesia:r.es_cortesia==1, productos:[] });
                        }
                        const trans=mes.transaccionesMap.get(pedidoKey);
                        trans.productos.push({ id_producto:r.id_producto, nombre:r.producto_nombre, cantidad:Number(r.cantidad), precio_unitario:Number(r.precio_unitario), subtotal:Number(r.subtotal_linea) });
                        const prodKey=String(r.id_producto);
                        if(!mes.consolidadoMap.has(prodKey)){
                            mes.consolidadoMap.set(prodKey, { id_producto:r.id_producto, nombre:r.producto_nombre, cantidad_total:0, subtotal_total:0, precio_unitario:Number(r.precio_unitario) });
                        }
                        const cons=mes.consolidadoMap.get(prodKey);
                        cons.cantidad_total+=Number(r.cantidad);
                        cons.subtotal_total+=Number(r.subtotal_linea);
                    });
                    detallePorMesero=Array.from(meseroMap.values()).map(function(m){
                        const transacciones=Array.from(m.transaccionesMap.values());
                        const consolidado=Array.from(m.consolidadoMap.values()).sort(function(a,b){ return b.cantidad_total - a.cantidad_total; });
                        return { id_usuario:m.id_usuario, nombre:m.nombre, ventas:m.ventas||transacciones.length, total:m.total, propinas:m.propinas, ticket_promedio:m.ticket_promedio, transacciones:transacciones, consolidadoProductos:consolidado, totales:m.totales };
                    }).sort(function(a,b){ return b.total - a.total; });
                    const totalesGenerales=meserosFmt.reduce(function(a,m){ return {ventas:a.ventas+m.ventas, total:a.total+m.total, propinas:a.propinas+m.propinas}; }, {ventas:0,total:0,propinas:0});
                    // Si hay detalle desde facturas, retornarlo directamente (corrige el aviso de detalle_pedido)
                    if(detallePorMesero.some(function(m){ return m.transacciones.length>0; }) || meserosFmt.length>0){
                        // si detalle tiene datos, retornar; si no, caerá a fallback si no hay filas
                        if(rows.length>0) return { meseros:meserosFmt, zonas, detallePorMesero, totalesGenerales };
                    }
                }
                // Si no hay filas en facturas para el filtro, fallback a pedidos (no retornar aún)
                if(meserosFmt.length===0){
                    // sin facturas en rango, probar fallback pedidos para no devolver vacío
                    throw new Error('sin_facturas_en_rango_fallback_pedidos');
                }
                if(rows.length===0 && meserosFmt.length>0){
                    // facturas sin detalle (caso anómalo) -> construir detallePorMesero vacío pero con meseros para evitar warning interminable
                    detallePorMesero=meserosFmt.map(function(m){ return {id_usuario:m.id_usuario, nombre:m.nombre, ventas:m.ventas, total:m.total, propinas:m.propinas, ticket_promedio:m.ticket_promedio, transacciones:[], consolidadoProductos:[], totales:{ventas:m.ventas,total:m.total,propinas:m.propinas,ticket_promedio:m.ticket_promedio}}; });
                    const totalesGenerales=meserosFmt.reduce(function(a,m){ return {ventas:a.ventas+m.ventas, total:a.total+m.total, propinas:a.propinas+m.propinas}; }, {ventas:0,total:0,propinas:0});
                    return { meseros:meserosFmt, zonas, detallePorMesero, totalesGenerales };
                }
            }catch(e){
                if(e.message==='sin_facturas_en_rango_fallback_pedidos') throw e;
                console.error('reporteTicketEmpleadoDetallado facturas detalle error:', e.message);
            }
            // Si llegamos aquí sin retornar y había facturas pero falló, intentar fallback
            if(meserosFmt.length>0){
                // si facturas tenía datos pero detalle falló, ya se retornó arriba; si no, continuar a fallback
            }
        }catch(e){
            if(e.message!=='sin_facturas_en_rango_fallback_pedidos'){
                console.error('reporteTicketEmpleadoDetallado facturas path error:', e.message);
            }
            // continuar a fallback pedidos
        }
    }
    // Fallback: pedidos + detalle_pedido (compatibilidad cuando no hay facturas)
    const pedMeta = await obtenerColumnasPedidos(pool);
    let colTs = pedMeta.timestamp || pedMeta.fecha || 'timestamp_pedido';
    let hasMeseroCol = false;
    try { const [c] = await pool.query("SHOW COLUMNS FROM pedidos LIKE 'id_mesero'"); hasMeseroCol = c.length > 0; } catch (e) { hasMeseroCol = false; }
    const params = [];
    let where = " ped.estado='Pagado'";
    if (filtros.fecha_inicio) { where += ' AND ped.' + colTs + ' >= ?'; params.push(filtros.fecha_inicio); }
    if (filtros.fecha_fin) { where += ' AND ped.' + colTs + ' <= ?'; params.push(filtros.fecha_fin + ' 23:59:59'); }
    if (filtros.id_jornada) { where += ' AND ped.id_jornada = ?'; params.push(parseInt(filtros.id_jornada)); }
    if (filtros.id_mesero) {
        if (hasMeseroCol) where += ' AND COALESCE(ped.id_mesero, ped.id_usuario) = ?';
        else where += ' AND ped.id_usuario = ?';
        params.push(parseInt(filtros.id_mesero));
    }
    let meserosFmt = [];
    try {
        let sqlMeseros;
        if (hasMeseroCol) {
            sqlMeseros = `SELECT COALESCE(ped.id_mesero, ped.id_usuario) AS id_usuario, COALESCE(u2.nombre, u.nombre, 'Sin asignar') AS nombre, COUNT(*) AS ventas, COALESCE(SUM(ped.total),0) AS total, COALESCE(SUM(ped.propina),0) AS propinas, COALESCE(AVG(ped.total),0) AS ticket_prom FROM pedidos ped LEFT JOIN usuarios u ON ped.id_usuario=u.id_usuario LEFT JOIN usuarios u2 ON ped.id_mesero=u2.id_usuario WHERE ${where} GROUP BY COALESCE(ped.id_mesero, ped.id_usuario), COALESCE(u2.nombre, u.nombre) ORDER BY total DESC`;
        } else {
            sqlMeseros = `SELECT ped.id_usuario AS id_usuario, COALESCE(u.nombre,'Sin asignar') AS nombre, COUNT(*) AS ventas, COALESCE(SUM(ped.total),0) AS total, COALESCE(SUM(ped.propina),0) AS propinas, COALESCE(AVG(ped.total),0) AS ticket_prom FROM pedidos ped LEFT JOIN usuarios u ON ped.id_usuario=u.id_usuario WHERE ${where} GROUP BY ped.id_usuario, u.nombre ORDER BY total DESC`;
        }
        const [meseros] = await pool.query(sqlMeseros, params);
        meserosFmt = meseros.map(function(r){ return { id_usuario: r.id_usuario, nombre: r.nombre, ventas: Number(r.ventas), total: Number(r.total), propinas: Number(r.propinas), ticket_promedio: Math.round(Number(r.ticket_prom)||0)}; });
    } catch(e){ meserosFmt=[]; }
    let zonas = [];
    try {
        const [zRows] = await pool.query(`SELECT COALESCE(m.zona,'Sin zona') AS zona, COUNT(*) AS ventas, COALESCE(SUM(ped.total),0) AS total, COALESCE(SUM(ped.propina),0) AS propinas FROM pedidos ped LEFT JOIN mesas m ON ped.id_mesa=m.id_mesa WHERE ${where} GROUP BY m.zona ORDER BY total DESC`, params);
        zonas = zRows.map(function(r){ return { zona: r.zona, ventas: Number(r.ventas), total: Number(r.total), propinas: Number(r.propinas)}; });
    } catch(e){ zonas=[]; }
    let detallePorMesero = [];
    try {
        const meseroIdExpr = hasMeseroCol ? 'COALESCE(ped.id_mesero, ped.id_usuario)' : 'ped.id_usuario';
        const meseroNombreExpr = hasMeseroCol ? "COALESCE(u2.nombre, u.nombre, 'Sin asignar')" : "COALESCE(u.nombre,'Sin asignar')";
        const fechaSelect = `COALESCE(ped.${colTs}, ped.fecha_hora, ped.timestamp_pedido)`;
        const joinMesero2 = hasMeseroCol ? 'LEFT JOIN usuarios u2 ON ped.id_mesero = u2.id_usuario' : '';
        const sqlDet = `SELECT ${meseroIdExpr} AS id_mesero_real, ${meseroNombreExpr} AS mesero_nombre, ped.id_pedido, ped.id_mesa, COALESCE(CAST(m.numero AS CHAR), m.nombre, CONCAT('Mesa #', ped.id_mesa)) AS mesa_identificador, m.nombre AS mesa_nombre, m.zona AS mesa_zona, ${fechaSelect} AS fecha_venta, ped.total AS pedido_total, ped.propina AS pedido_propina, ped.metodo_pago, ped.descuento, ped.es_cortesia, dp.id_producto, COALESCE(p.nombre, CONCAT('Producto #', dp.id_producto)) AS producto_nombre, dp.cantidad, dp.precio_unitario, COALESCE(dp.subtotal, dp.cantidad * dp.precio_unitario, 0) AS subtotal_linea FROM pedidos ped LEFT JOIN usuarios u ON ped.id_usuario = u.id_usuario ${joinMesero2} LEFT JOIN mesas m ON ped.id_mesa = m.id_mesa INNER JOIN detalle_pedido dp ON dp.id_pedido = ped.id_pedido LEFT JOIN productos p ON dp.id_producto = p.id_producto WHERE ${where} ORDER BY ${meseroIdExpr}, ${fechaSelect} ASC, ped.id_pedido, dp.id_detalle LIMIT 5000`;
        let rows = [];
        try {
            const [r] = await pool.query(sqlDet, params);
            rows = r;
        } catch (eq) {
            const altWhere = where.replace(new RegExp('ped\\.' + colTs, 'g'), 'ped.fecha_hora');
            const sqlDet2 = `SELECT ${meseroIdExpr} AS id_mesero_real, ${meseroNombreExpr} AS mesero_nombre, ped.id_pedido, ped.id_mesa, COALESCE(CAST(m.numero AS CHAR), m.nombre, CONCAT('Mesa #', ped.id_mesa)) AS mesa_identificador, m.nombre AS mesa_nombre, m.zona AS mesa_zona, COALESCE(ped.fecha_hora, ped.timestamp_pedido) AS fecha_venta, ped.total AS pedido_total, ped.propina AS pedido_propina, ped.metodo_pago, ped.descuento, ped.es_cortesia, dp.id_producto, COALESCE(p.nombre, CONCAT('Producto #', dp.id_producto)) AS producto_nombre, dp.cantidad, dp.precio_unitario, COALESCE(dp.subtotal, dp.cantidad * dp.precio_unitario, 0) AS subtotal_linea FROM pedidos ped LEFT JOIN usuarios u ON ped.id_usuario = u.id_usuario ${joinMesero2} LEFT JOIN mesas m ON ped.id_mesa = m.id_mesa INNER JOIN detalle_pedido dp ON dp.id_pedido = ped.id_pedido LEFT JOIN productos p ON dp.id_producto = p.id_producto WHERE ${altWhere} ORDER BY ${meseroIdExpr}, COALESCE(ped.fecha_hora, ped.timestamp_pedido) DESC, ped.id_pedido, dp.id_detalle LIMIT 5000`;
            const [r2] = await pool.query(sqlDet2, params);
            rows = r2;
        }
        const meseroMap = new Map();
        meserosFmt.forEach(function(m){ meseroMap.set(String(m.id_usuario), { id_usuario:m.id_usuario, nombre:m.nombre, ventas:m.ventas, total:m.total, propinas:m.propinas, ticket_promedio:m.ticket_promedio, transaccionesMap: new Map(), consolidadoMap: new Map(), totales:{ventas:m.ventas, total:m.total, propinas:m.propinas, ticket_promedio:m.ticket_promedio} }); });
        rows.forEach(function(r){
            const keyMesero = String(r.id_mesero_real);
            if(!meseroMap.has(keyMesero)){
                meseroMap.set(keyMesero, { id_usuario: Number(r.id_mesero_real), nombre: r.mesero_nombre, ventas:0, total:0, propinas:0, ticket_promedio:0, transaccionesMap:new Map(), consolidadoMap:new Map(), totales:{ventas:0,total:0,propinas:0,ticket_promedio:0} });
            }
            const mes = meseroMap.get(keyMesero);
            const pedidoKey = String(r.id_pedido);
            if(!mes.transaccionesMap.has(pedidoKey)){
                mes.transaccionesMap.set(pedidoKey, { id_pedido:r.id_pedido, id_mesa:r.id_mesa, mesa: r.mesa_identificador, mesa_nombre: r.mesa_nombre||r.mesa_identificador, mesa_zona: r.mesa_zona||'Sin zona', fecha: r.fecha_venta, total: Number(r.pedido_total), propina: Number(r.pedido_propina), metodo_pago: r.metodo_pago, descuento:Number(r.descuento), cortesia: r.es_cortesia==1, productos: [] });
            }
            const trans = mes.transaccionesMap.get(pedidoKey);
            trans.productos.push({ id_producto:r.id_producto, nombre: r.producto_nombre, cantidad: Number(r.cantidad), precio_unitario: Number(r.precio_unitario), subtotal: Number(r.subtotal_linea) });
            const prodKey = String(r.id_producto);
            if(!mes.consolidadoMap.has(prodKey)){
                mes.consolidadoMap.set(prodKey, { id_producto:r.id_producto, nombre:r.producto_nombre, cantidad_total:0, subtotal_total:0, precio_unitario: Number(r.precio_unitario) });
            }
            const cons = mes.consolidadoMap.get(prodKey);
            cons.cantidad_total += Number(r.cantidad);
            cons.subtotal_total += Number(r.subtotal_linea);
        });
        detallePorMesero = Array.from(meseroMap.values()).map(function(m){
            const transacciones = Array.from(m.transaccionesMap.values());
            const consolidado = Array.from(m.consolidadoMap.values()).sort(function(a,b){ return b.cantidad_total - a.cantidad_total; });
            return { id_usuario: m.id_usuario, nombre: m.nombre, ventas: m.ventas || transacciones.length, total: m.total, propinas: m.propinas, ticket_promedio: m.ticket_promedio, transacciones: transacciones, consolidadoProductos: consolidado, totales: m.totales };
        }).sort(function(a,b){ return b.total - a.total; });
        if(!rows.length && meserosFmt.length){
            detallePorMesero = meserosFmt.map(function(m){ return {id_usuario:m.id_usuario, nombre:m.nombre, ventas:m.ventas, total:m.total, propinas:m.propinas, ticket_promedio:m.ticket_promedio, transacciones:[], consolidadoProductos:[], totales:{ventas:m.ventas,total:m.total,propinas:m.propinas,ticket_promedio:m.ticket_promedio}}; });
        }
    } catch(e){
        console.error('reporteTicketEmpleadoDetallado detalle error:', e.message);
        detallePorMesero = meserosFmt.map(function(m){ return {id_usuario:m.id_usuario, nombre:m.nombre, ventas:m.ventas, total:m.total, propinas:m.propinas, ticket_promedio:m.ticket_promedio, transacciones:[], consolidadoProductos:[], totales:{ventas:m.ventas,total:m.total,propinas:m.propinas,ticket_promedio:m.ticket_promedio}}; });
    }
    const totalesGenerales = meserosFmt.reduce(function(a,m){ return {ventas:a.ventas+m.ventas, total:a.total+m.total, propinas:a.propinas+m.propinas}; }, {ventas:0,total:0,propinas:0});
    return { meseros: meserosFmt, cajeros: cajerosFmt, zonas, detallePorMesero, totalesGenerales };
}

async function reporteInventarioCostos(filtros) {
    filtros = filtros || {};
    const c = obtenerColumnasProductos();
    const colVenta = c.venta || 'precio';
    const colCosto = c.costo || 'precio_costo';
    const usaIdCat = c.lista.indexOf('id_categoria') !== -1;
    const colCat = usaIdCat ? 'cat.nombre' : 'p.categoria';
    const joinCat = usaIdCat ? ' LEFT JOIN categorias cat ON p.id_categoria=cat.id_categoria' : '';
    const ped = await obtenerColumnasPedidos(pool);
    const colTs = ped.timestamp || ped.fecha || 'timestamp_pedido';
    let wherePed = " ped.estado='Pagado'";
    const pParams = [];
    if (filtros.fecha_inicio) { wherePed += ' AND ped.'+colTs+' >= ?'; pParams.push(filtros.fecha_inicio); }
    if (filtros.fecha_fin) { wherePed += ' AND ped.'+colTs+' <= ?'; pParams.push(filtros.fecha_fin+' 23:59:59'); }
    if (filtros.id_jornada) { wherePed += ' AND ped.id_jornada = ?'; pParams.push(parseInt(filtros.id_jornada)); }
    if (filtros.id_mesero) { wherePed += ' AND COALESCE(ped.id_mesero, ped.id_usuario) = ?'; pParams.push(parseInt(filtros.id_mesero)); }
    if (filtros.id_cajero) { wherePed += ' AND COALESCE(ped.id_cajero, ped.id_usuario) = ?'; pParams.push(parseInt(filtros.id_cajero)); }
    let ranking = [];
    try {
        const [rows] = await pool.query(`SELECT p.id_producto, p.nombre, ${colCat} AS categoria, p.${colVenta} AS precio, p.${colCosto} AS costo, ROUND(((p.${colVenta} - p.${colCosto})/NULLIF(p.${colVenta},0))*100,1) AS margen_pct, (p.${colVenta} - p.${colCosto}) AS ganancia, COALESCE(SUM(dp.cantidad),0) AS unidades_vendidas, COALESCE(SUM(dp.subtotal),0) AS ingresos FROM productos p ${joinCat} LEFT JOIN detalle_pedido dp ON dp.id_producto=p.id_producto LEFT JOIN pedidos ped ON dp.id_pedido=ped.id_pedido AND ${wherePed} WHERE p.activo=1 GROUP BY p.id_producto, p.nombre, ${colCat}, p.${colVenta}, p.${colCosto} ORDER BY margen_pct DESC LIMIT 50`, pParams);
        ranking = rows.map(function(r){ return { id_producto:r.id_producto, nombre:r.nombre, categoria:(r.categoria||'General'), precio:Number(r.precio)||0, costo:Number(r.costo)||0, margen_pct:Number(r.margen_pct)||0, ganancia:Number(r.ganancia)||0, unidades_vendidas:Number(r.unidades_vendidas)||0, ingresos:Number(r.ingresos)||0 }; });
    } catch(e){ ranking=[]; }
    let mermas = [];
    let resumenMermas = { total_costo:0, total_venta:0, total_registros:0 };
    try {
        let whereM = '1=1'; const mPar=[];
        if (filtros.fecha_inicio) { whereM+=' AND m.fecha >= ?'; mPar.push(filtros.fecha_inicio); }
        if (filtros.fecha_fin) { whereM+=' AND m.fecha <= ?'; mPar.push(filtros.fecha_fin+' 23:59:59'); }
        if (filtros.id_mesero) { whereM+=' AND m.id_usuario = ?'; mPar.push(parseInt(filtros.id_mesero)); }
        if (filtros.id_cajero) { whereM+=' AND m.id_usuario = ?'; mPar.push(parseInt(filtros.id_cajero)); }
        const [mRows] = await pool.query(`SELECT m.id_merma, m.cantidad, m.motivo, m.fecha, p.nombre AS producto, m.id_producto, COALESCE(p.${colCosto},0) AS costo, COALESCE(p.${colVenta},0) AS precio, (m.cantidad*COALESCE(p.${colCosto},0)) AS valor_costo, (m.cantidad*COALESCE(p.${colVenta},0)) AS valor_venta, COALESCE(u.nombre,'') AS usuario FROM mermas m LEFT JOIN productos p ON m.id_producto=p.id_producto LEFT JOIN usuarios u ON m.id_usuario=u.id_usuario WHERE ${whereM} ORDER BY m.fecha DESC LIMIT 100`, mPar);
        mermas = mRows.map(function(r){ return { id_merma:r.id_merma, producto:r.producto||'#'+r.id_producto, cantidad:Number(r.cantidad), motivo:r.motivo, fecha:r.fecha, valor_costo:Number(r.valor_costo), valor_venta:Number(r.valor_venta), usuario:r.usuario }; });
        resumenMermas.total_costo = mermas.reduce(function(a,r){return a+r.valor_costo;},0);
        resumenMermas.total_venta = mermas.reduce(function(a,r){return a+r.valor_venta;},0);
        resumenMermas.total_registros = mermas.length;
        if(!filtros.fecha_inicio && !filtros.fecha_fin){
            const [agg] = await pool.query(`SELECT COALESCE(SUM(m.cantidad*COALESCE(p.${colCosto},0)),0) AS tc, COALESCE(SUM(m.cantidad*COALESCE(p.${colVenta},0)),0) AS tv, COUNT(*) AS cnt FROM mermas m LEFT JOIN productos p ON m.id_producto=p.id_producto WHERE MONTH(m.fecha)=MONTH(NOW()) AND YEAR(m.fecha)=YEAR(NOW())`);
            if(mermas.length===0){ resumenMermas.total_costo=Number(agg[0].tc)||0; resumenMermas.total_venta=Number(agg[0].tv)||0; resumenMermas.total_registros=Number(agg[0].cnt)||0; }
        }
    } catch(e){ }
    return { ranking_margen: ranking, mermas, resumen_mermas: resumenMermas };
}

async function obtenerOpcionesFiltros() {
    let jornadas=[]; let meseros=[];
    try { const [j]=await pool.query(`SELECT id_jornada, fecha_apertura, fecha_cierre, estado FROM jornadas ORDER BY id_jornada DESC LIMIT 50`); jornadas=j; } catch(e){ jornadas=[]; }
    try { const [u]=await pool.query(`SELECT id_usuario, nombre FROM usuarios WHERE activo=1 ORDER BY nombre`); meseros=u; } catch(e){ meseros=[]; }
    return { jornadas, meseros };
}

async function analisisInventario(diasMuertos) {
    const c = obtenerColumnasProductos();
    if (!c.venta) throw new Error('No se detecto la columna de precio de venta');
    const colVenta = c.venta;
    const colCosto = c.costo || 'precio_costo';
    const dias = Math.max(1, Math.min(365, parseInt(diasMuertos) || 30));
    const usaIdCat = c.lista.indexOf('id_categoria') !== -1;
    const ped = await obtenerColumnasPedidos(pool);
    const tss = ped.timestamp || ped.fecha;
    const colCat = usaIdCat ? 'cat.nombre' : 'p.categoria';
    const joinCat = usaIdCat ? ' LEFT JOIN categorias cat ON p.id_categoria = cat.id_categoria' : '';
    const [totales] = await pool.query('SELECT COALESCE(SUM(p.stock * p.' + colVenta + '),0) AS valor_venta,' + ' COALESCE(SUM(p.stock * p.' + colCosto + '),0) AS valor_costo,' + ' COUNT(*) AS num_productos,' + ' COALESCE(SUM(CASE WHEN p.stock = 0 THEN 1 ELSE 0 END),0) AS agotados,' + ' COALESCE(SUM(CASE WHEN p.stock > 0 AND p.stock <= p.stock_minimo THEN 1 ELSE 0 END),0) AS stock_bajo,' + ' COALESCE(SUM(CASE WHEN p.stock < p.stock_minimo THEN 1 ELSE 0 END),0) AS productos_reponer,' + ' COALESCE(SUM(p.stock),0) AS unidades_totales' + ' FROM productos p WHERE p.activo = 1');
    let topVendedor = null;
    try { const [top] = await pool.query('SELECT dp.id_producto, p.nombre AS nombre, SUM(dp.cantidad) AS unidades, SUM(dp.subtotal) AS ingresos FROM detalle_pedido dp INNER JOIN productos p ON dp.id_producto = p.id_producto INNER JOIN pedidos ped ON dp.id_pedido = ped.id_pedido WHERE ped.estado = \'Pagado\' GROUP BY dp.id_producto, p.nombre ORDER BY unidades DESC LIMIT 1'); if (top.length > 0) topVendedor = top[0]; } catch (e) { topVendedor = null; }
    let mejorMargen = null;
    try { const [mej] = await pool.query('SELECT p.id_producto, p.nombre, p.' + colVenta + ' AS precio, p.' + colCosto + ' AS costo,' + ' ROUND(((p.' + colVenta + ' - p.' + colCosto + ') / NULLIF(p.' + colVenta + ',0)) * 100, 1) AS margen_pct,' + ' (p.' + colVenta + ' - p.' + colCosto + ') AS ganancia' + ' FROM productos p' + ' WHERE p.activo = 1 AND p.stock > 0 AND p.' + colVenta + ' > 0' + ' ORDER BY margen_pct DESC, ganancia DESC LIMIT 1'); if (mej.length > 0) mejorMargen = mej[0]; } catch (e) { mejorMargen = null; }
    let mermasMes = { valor_costo: 0, valor_venta: 0, total_mermas: 0 };
    try { const [mermas] = await pool.query('SELECT COALESCE(SUM(m.cantidad * p.' + colCosto + '),0) AS valor_costo,' + ' COALESCE(SUM(m.cantidad * p.' + colVenta + '),0) AS valor_venta,' + ' COUNT(*) AS total_mermas' + ' FROM mermas m' + ' LEFT JOIN productos p ON m.id_producto = p.id_producto' + ' WHERE MONTH(m.fecha) = MONTH(NOW()) AND YEAR(m.fecha) = YEAR(NOW())'); if (mermas.length > 0) mermasMes = mermas[0]; } catch (e) { }
    const rotacionMap = {};
    if (tss) { try { const [ventas] = await pool.query('SELECT ' + colCat + ' AS categoria,' + ' COALESCE(SUM(dp.cantidad),0) AS unidades_vendidas,' + ' COALESCE(SUM(dp.subtotal),0) AS ingresos' + ' FROM detalle_pedido dp' + ' INNER JOIN pedidos ped ON dp.id_pedido = ped.id_pedido' + ' INNER JOIN productos p ON dp.id_producto = p.id_producto' + joinCat + " WHERE ped.estado = 'Pagado' AND ped." + tss + ' >= DATE_SUB(NOW(), INTERVAL ? DAY)' + ' GROUP BY ' + colCat, [dias]); ventas.forEach(function(r) { var nom = (r.categoria || 'General').trim() || 'General'; rotacionMap[nom] = { categoria: nom, unidades_vendidas: Number(r.unidades_vendidas) || 0, ingresos: Number(r.ingresos) || 0, stock_actual: 0, valor_stock_costo: 0 }; }); } catch (e) { } }
    const [stockCat] = await pool.query('SELECT ' + colCat + ' AS categoria,' + ' COALESCE(SUM(p.stock),0) AS stock_actual,' + ' COALESCE(SUM(p.stock * p.' + colCosto + '),0) AS valor_stock_costo' + ' FROM productos p' + joinCat + ' WHERE p.activo = 1' + ' GROUP BY ' + colCat);
    stockCat.forEach(function(r) { var nom = (r.categoria || 'General').trim() || 'General'; if (!rotacionMap[nom]) rotacionMap[nom] = { categoria: nom, unidades_vendidas: 0, ingresos: 0 }; rotacionMap[nom].stock_actual = Number(r.stock_actual) || 0; rotacionMap[nom].valor_stock_costo = Number(r.valor_stock_costo) || 0; });
    var rotacion = Object.keys(rotacionMap).map(function(k) { return rotacionMap[k]; });
    rotacion.forEach(function(r) { r.rotacion = r.stock_actual > 0 ? Math.round((r.unidades_vendidas / r.stock_actual) * 100) / 100 : 0; });
    rotacion.sort(function(a, b) { return b.unidades_vendidas - a.unidades_vendidas; });
    var stockMuerto = [];
    if (tss) { try { const [muertos] = await pool.query('SELECT p.id_producto, p.nombre, ' + colCat + ' AS categoria,' + ' p.stock, p.' + colVenta + ' AS precio, p.' + colCosto + ' AS costo,' + ' (p.stock * p.' + colCosto + ') AS valor_stock,' + ' MAX(ped.' + tss + ') AS ultima_venta,' + " CASE WHEN MAX(ped." + tss + ") IS NULL THEN 999999 ELSE DATEDIFF(NOW(), MAX(ped." + tss + ')) END AS dias_sin_venta' + ' FROM productos p' + ' LEFT JOIN detalle_pedido dp ON dp.id_producto = p.id_producto' + " LEFT JOIN pedidos ped ON dp.id_pedido = ped.id_pedido AND ped.estado = 'Pagado'" + joinCat + ' WHERE p.activo = 1 AND p.stock > 0' + ' GROUP BY p.id_producto, p.nombre, ' + colCat + ', p.stock, p.' + colVenta + ', p.' + colCosto + ' HAVING dias_sin_venta >= ?' + ' ORDER BY dias_sin_venta DESC', [dias]); stockMuerto = muertos.map(function(r) { return { id_producto: r.id_producto, nombre: r.nombre, categoria: (r.categoria || 'General').trim() || 'General', stock: Number(r.stock) || 0, precio: Number(r.precio) || 0, costo: Number(r.costo) || 0, valor_stock: Number(r.valor_stock) || 0, ultima_venta: r.ultima_venta, dias_sin_venta: r.dias_sin_venta === 999999 ? null : Number(r.dias_sin_venta) || 0 }; }); } catch (e) { stockMuerto = []; } }
    const [reponer] = await pool.query('SELECT p.id_producto, p.nombre, ' + colCat + ' AS categoria,' + ' p.stock, p.stock_minimo, p.' + colVenta + ' AS precio, p.' + colCosto + ' AS costo,' + ' GREATEST(p.stock_minimo - p.stock, 0) AS faltan,' + ' ROUND(GREATEST(p.stock_minimo - p.stock, 0) * p.' + colCosto + ', 2) AS costo_reposicion' + ' FROM productos p' + joinCat + ' WHERE p.activo = 1 AND p.stock < p.stock_minimo AND p.stock_minimo > 0' + ' ORDER BY costo_reposicion DESC');
    var reposicion = reponer.map(function(r) { return { id_producto: r.id_producto, nombre: r.nombre, categoria: (r.categoria || 'General').trim() || 'General', stock: Number(r.stock) || 0, stock_minimo: Number(r.stock_minimo) || 0, faltan: Number(r.faltan) || 0, costo: Number(r.costo) || 0, costo_reposicion: Number(r.costo_reposicion) || 0 }; });
    var valorInventarioCosto = Number(totales[0].valor_costo) || 0;
    var valorMermasMes = Number(mermasMes.valor_costo) || 0;
    return { kpis: { valor_inventario_venta: Number(totales[0].valor_venta) || 0, valor_inventario_costo: valorInventarioCosto, num_productos: Number(totales[0].num_productos) || 0, agotados: Number(totales[0].agotados) || 0, stock_bajo: Number(totales[0].stock_bajo) || 0, productos_reponer: Number(totales[0].productos_reponer) || 0, unidades_totales: Number(totales[0].unidades_totales) || 0, valor_mermas_mes: valorMermasMes, total_mermas_mes: Number(mermasMes.total_mermas) || 0, tasa_mermas: (valorInventarioCosto + valorMermasMes) > 0 ? Math.round((valorMermasMes / (valorInventarioCosto + valorMermasMes)) * 1000) / 10 : 0, costo_reposicion_total: reposicion.reduce(function(a, r) { return a + r.costo_reposicion; }, 0), faltan_total: reposicion.reduce(function(a, r) { return a + r.faltan; }, 0) }, top_vendedor: topVendedor ? { nombre: topVendedor.nombre, unidades: Number(topVendedor.unidades) || 0, ingresos: Number(topVendedor.ingresos) || 0 } : null, mejor_margen: mejorMargen ? { nombre: mejorMargen.nombre, precio: Number(mejorMargen.precio) || 0, costo: Number(mejorMargen.costo) || 0, margen_pct: Number(mejorMargen.margen_pct) || 0, ganancia: Number(mejorMargen.ganancia) || 0 } : null, mermas_mes: { valor_costo: Number(mermasMes.valor_costo) || 0, valor_venta: Number(mermasMes.valor_venta) || 0, total_mermas: Number(mermasMes.total_mermas) || 0 }, dias_analizados: dias, rotacion: rotacion, stock_muerto: stockMuerto, reposicion: reposicion };
}

async function reporteFamilias(filtros){
    const c = obtenerColumnasProductos();
    const usaIdCat = c.lista.indexOf('id_categoria') !== -1;
    const colCat = usaIdCat ? 'cat.nombre' : 'p.categoria';
    const joinCat = usaIdCat ? ' LEFT JOIN categorias cat ON p.id_categoria=cat.id_categoria' : '';
    const ped = await obtenerColumnasPedidos(pool);
    const colTs = ped.timestamp || ped.fecha || 'timestamp_pedido';
    const {where, params} = buildWhereFiltros(filtros||{}, colTs);
    const sql = `SELECT ${colCat} AS familia, COUNT(DISTINCT ped.id_pedido) AS ventas, COALESCE(SUM(dp.cantidad),0) AS unidades, COALESCE(SUM(dp.subtotal),0) AS ingresos, COALESCE(AVG(dp.subtotal),0) AS ticket FROM detalle_pedido dp INNER JOIN pedidos ped ON dp.id_pedido=ped.id_pedido INNER JOIN productos p ON dp.id_producto=p.id_producto ${joinCat} WHERE ${where} GROUP BY ${colCat} ORDER BY ingresos DESC`;
    const [rows]=await pool.query(sql, params);
    return rows.map(r=>({familia:r.familia||'General', ventas:Number(r.ventas), unidades:Number(r.unidades), ingresos:Number(r.ingresos), ticket:Number(r.ticket)}));
}
async function reporteDescuentos(filtros){
    const ped = await obtenerColumnasPedidos(pool);
    const colTs = ped.timestamp || ped.fecha || 'timestamp_pedido';
    let where = " ped.estado='Pagado' AND (ped.descuento>0 OR ped.es_cortesia=1)";
    const params=[];
    if(filtros.fecha_inicio){ where+=' AND ped.'+colTs+' >= ?'; params.push(filtros.fecha_inicio); }
    if(filtros.fecha_fin){ where+=' AND ped.'+colTs+' <= ?'; params.push(filtros.fecha_fin+' 23:59:59'); }
    if(filtros.id_jornada){ where+=' AND ped.id_jornada=?'; params.push(parseInt(filtros.id_jornada)); }
    if(filtros.id_mesero){ where+=' AND COALESCE(ped.id_mesero, ped.id_usuario)=?'; params.push(parseInt(filtros.id_mesero)); }
    if(filtros.id_cajero){ where+=' AND COALESCE(ped.id_cajero, ped.id_usuario)=?'; params.push(parseInt(filtros.id_cajero)); }
    const sql=`SELECT ped.id_pedido, ped.total, ped.descuento, ped.es_cortesia, ped.propina, ped.metodo_pago, ped.${colTs} AS fecha, u.nombre AS mesero, m.numero AS mesa FROM pedidos ped LEFT JOIN usuarios u ON ped.id_usuario=u.id_usuario LEFT JOIN mesas m ON ped.id_mesa=m.id_mesa WHERE ${where} ORDER BY ped.${colTs} DESC LIMIT 200`;
    const [rows]=await pool.query(sql, params);
    const totalDescuento = rows.reduce((a,r)=> a+Number(r.descuento||0),0);
    const totalCortesias = rows.filter(r=> r.es_cortesia==1).reduce((a,r)=> a+Number(r.total||0),0);
    return {detalle: rows.map(r=>({id_pedido:r.id_pedido, fecha:r.fecha, mesero:r.mesero||'--', mesa:r.mesa||'--', total:Number(r.total), descuento:Number(r.descuento), cortesia: r.es_cortesia==1, propina:Number(r.propina), metodo:r.metodo_pago})), totales:{totalDescuento, totalCortesias, count: rows.length}};
}
async function reporteRetiros(filtros){
    let where='1=1'; const params=[];
    if(filtros.fecha_inicio){ where+=' AND DATE(fecha) >= ?'; params.push(filtros.fecha_inicio); }
    if(filtros.fecha_fin){ where+=' AND DATE(fecha) <= ?'; params.push(filtros.fecha_fin); }
    if(filtros.id_jornada){ where+=' AND id_jornada=?'; params.push(parseInt(filtros.id_jornada)); }
    try{
        const [vaciados]=await pool.query(`SELECT v.id_vaciado AS id, v.monto, v.motivo, v.fecha, v.id_jornada, COALESCE(u.nombre,'Sistema') AS usuario FROM vaciados_efectivo v LEFT JOIN usuarios u ON v.id_usuario=u.id_usuario WHERE ${where} ORDER BY v.fecha DESC LIMIT 200`, params);
        let movWhere='m.tipo="Egreso"'; const mPar=[];
        if(filtros.fecha_inicio){ movWhere+=' AND DATE(m.fecha) >= ?'; mPar.push(filtros.fecha_inicio); }
        if(filtros.fecha_fin){ movWhere+=' AND DATE(m.fecha) <= ?'; mPar.push(filtros.fecha_fin); }
        if(filtros.id_jornada){ movWhere+=' AND m.id_jornada=?'; mPar.push(parseInt(filtros.id_jornada)); }
        const [movs]=await pool.query(`SELECT m.id_movimiento AS id, m.monto, m.categoria, m.concepto AS motivo, m.fecha, m.id_jornada, COALESCE(u.nombre,'') AS usuario FROM movimientos_caja m LEFT JOIN usuarios u ON m.id_usuario=u.id_usuario WHERE ${movWhere} ORDER BY m.fecha DESC LIMIT 200`, mPar);
        const totalVaciados = vaciados.reduce((a,r)=>a+Number(r.monto),0);
        const totalEgresos = movs.reduce((a,r)=>a+Number(r.monto),0);
        return {vaciados, movimientos: movs, totales:{totalVaciados, totalEgresos, count: vaciados.length+movs.length}};
    }catch(e){ return {vaciados:[], movimientos:[], totales:{totalVaciados:0,totalEgresos:0,count:0}}; }
}
async function reporteImpuestos(filtros){
    const c = obtenerColumnasProductos();
    const colVenta = c.venta || 'precio';
    const ped = await obtenerColumnasPedidos(pool);
    const colTs = ped.timestamp || ped.fecha || 'timestamp_pedido';
    const {where, params} = buildWhereFiltros(filtros||{}, colTs);
    const sql=`SELECT DATE(ped.${colTs}) AS fecha, COUNT(*) AS ventas, COALESCE(SUM(ped.total),0) AS bruto, COALESCE(SUM(CASE WHEN ped.metodo_pago='cortesia' THEN 0 ELSE ped.total END),0) AS base FROM pedidos ped WHERE ${where} GROUP BY DATE(ped.${colTs}) ORDER BY fecha DESC LIMIT 60`;
    const [rows]=await pool.query(sql, params);
    return rows.map(r=>{
        const bruto=Number(r.bruto);
        const iva = Math.round(bruto * 0.19 / 1.19);
        const ico = Math.round(bruto * 0.08 / 1.08);
        const base = bruto - iva;
        return {fecha:r.fecha, ventas:Number(r.ventas), bruto, base, iva, ico, neto: bruto};
    });
}
async function reportePropinas(filtros){
    const ped = await obtenerColumnasPedidos(pool);
    const colTs = ped.timestamp || ped.fecha || 'timestamp_pedido';
    let where=" ped.estado='Pagado'";
    const params=[];
    if(filtros.fecha_inicio){ where+=' AND ped.'+colTs+' >= ?'; params.push(filtros.fecha_inicio); }
    if(filtros.fecha_fin){ where+=' AND ped.'+colTs+' <= ?'; params.push(filtros.fecha_fin+' 23:59:59'); }
    if(filtros.id_jornada){ where+=' AND ped.id_jornada=?'; params.push(parseInt(filtros.id_jornada)); }
    if(filtros.id_mesero){ where+=' AND COALESCE(ped.id_mesero, ped.id_usuario)=?'; params.push(parseInt(filtros.id_mesero)); }
    if(filtros.id_cajero){ where+=' AND COALESCE(ped.id_cajero, ped.id_usuario)=?'; params.push(parseInt(filtros.id_cajero)); }
    const [rows]=await pool.query(`SELECT ${exprMeseroId('ped')} AS id_usuario, ${exprMeseroNombre('u2', 'u')} AS mesero, COUNT(*) AS ventas, COALESCE(SUM(ped.propina),0) AS propina_total, COALESCE(SUM(CASE WHEN LOWER(ped.metodo_pago)='efectivo' THEN ped.propina ELSE 0 END),0) AS efectivo, COALESCE(SUM(CASE WHEN LOWER(ped.metodo_pago)!='efectivo' THEN ped.propina ELSE 0 END),0) AS electronica FROM pedidos ped LEFT JOIN usuarios u ON ped.id_usuario=u.id_usuario LEFT JOIN usuarios u2 ON ped.id_mesero=u2.id_usuario WHERE ${where} GROUP BY ${exprMeseroId('ped')}, ${exprMeseroNombre('u2', 'u')} ORDER BY propina_total DESC`, params);
    const total = rows.reduce((a,r)=>a+Number(r.propina_total),0);
    const pozo = Math.round(total*0.3);
    return {detalle: rows.map(r=>({id_usuario:r.id_usuario, mesero:r.mesero, ventas:Number(r.ventas), propina_total:Number(r.propina_total), efectivo:Number(r.efectivo), electronica:Number(r.electronica), pozo: Math.round(Number(r.propina_total)*0.3)})), totales:{total, pozo, count: rows.length}};
}
async function reporteNocturna(filtros){
    const ped = await obtenerColumnasPedidos(pool);
    const colTs = ped.timestamp || ped.fecha || 'timestamp_pedido';
    let where=" ped.estado='Pagado'";
    const params=[];
    if(filtros.fecha_inicio){ where+=' AND DATE(DATE_SUB(ped.'+colTs+', INTERVAL 6 HOUR)) >= ?'; params.push(filtros.fecha_inicio); }
    if(filtros.fecha_fin){ where+=' AND DATE(DATE_SUB(ped.'+colTs+', INTERVAL 6 HOUR)) <= ?'; params.push(filtros.fecha_fin); }
    if(filtros.id_jornada){ where+=' AND ped.id_jornada=?'; params.push(parseInt(filtros.id_jornada)); }
    const sql=`SELECT DATE(DATE_SUB(ped.${colTs}, INTERVAL 6 HOUR)) AS jornada, COUNT(*) AS ventas, COALESCE(SUM(ped.total),0) AS ingresos, COALESCE(AVG(ped.total),0) AS ticket FROM pedidos ped WHERE ${where} GROUP BY jornada ORDER BY jornada DESC LIMIT 60`;
    const [rows]=await pool.query(sql, params);
    return rows.map(r=>({jornada:r.jornada, ventas:Number(r.ventas), ingresos:Number(r.ingresos), ticket:Math.round(Number(r.ticket))}));
}
async function reporteAuditoria(filtros){
    try{
        let where='1=1'; const par=[];
        if(filtros.fecha_inicio){ where+=' AND DATE(a.created_at) >= ?'; par.push(filtros.fecha_inicio); }
        if(filtros.fecha_fin){ where+=' AND DATE(a.created_at) <= ?'; par.push(filtros.fecha_fin); }
        if(filtros.id_mesero){ where+=' AND a.usuario_id=?'; par.push(parseInt(filtros.id_mesero)); }
        const [logs]=await pool.query(`SELECT a.*, COALESCE(u.nombre,'Sistema') AS usuario FROM audit_logs a LEFT JOIN usuarios u ON a.usuario_id=u.id_usuario WHERE ${where} ORDER BY a.created_at DESC LIMIT 200`, par);
        const byTipo={};
        logs.forEach(l=>{ byTipo[l.tipo_evento]=(byTipo[l.tipo_evento]||0)+1; });
        return {logs: logs.map(l=>({id:l.id, tipo:l.tipo_evento, usuario:l.usuario, descripcion:l.descripcion, motivo:l.motivo, mesa:l.mesa_id, ip:l.ip_address, fecha:l.created_at})), resumen: byTipo, total: logs.length};
    }catch(e){ return {logs:[], resumen:{}, total:0}; }
}
async function reporteCajon(filtros){
    try{
        let where='1=1'; const par=[];
        if(filtros.fecha_inicio){ where+=' AND DATE(a.fecha) >= ?'; par.push(filtros.fecha_inicio); }
        if(filtros.fecha_fin){ where+=' AND DATE(a.fecha) <= ?'; par.push(filtros.fecha_fin); }
        const [rows]=await pool.query(`SELECT a.*, COALESCE(u.nombre,'--') AS autoriza, COALESCE(u2.nombre,'--') AS registra FROM auditoria_incidencias a LEFT JOIN usuarios u ON a.id_usuario_autoriza=u.id_usuario LEFT JOIN usuarios u2 ON a.id_usuario_registra=u2.id_usuario WHERE ${where} AND a.tipo='apertura_sin_venta' ORDER BY a.fecha DESC LIMIT 100`, par);
        return rows.map(r=>({id:r.id_incidencia, fecha:r.fecha, autoriza:r.autoriza, registra:r.registra, descripcion:r.descripcion, monto:Number(r.monto)}));
    }catch(e){ return []; }
}
async function reporteHorario(filtros){
    try{
        let where='DATE(a.fecha)=CURDATE()'; const par=[];
        if(filtros.fecha_inicio && filtros.fecha_fin){ where='DATE(a.fecha) >= ? AND DATE(a.fecha) <= ?'; par.push(filtros.fecha_inicio, filtros.fecha_fin); }
        else if(filtros.fecha_inicio){ where='DATE(a.fecha)=?'; par.push(filtros.fecha_inicio); }
        const [rows]=await pool.query(`SELECT u.nombre, u.id_usuario, a.tipo, a.timestamp, a.fecha FROM asistencias a JOIN usuarios u ON a.id_usuario=u.id_usuario WHERE ${where} ORDER BY a.timestamp DESC LIMIT 200`, par);
        return rows;
    }catch(e){ return []; }
}
async function reporteContableFacturas(filtros){
    const ped = await obtenerColumnasPedidos(pool);
    const colTs = ped.timestamp || ped.fecha || 'timestamp_pedido';
    const {where, params}=buildWhereFiltros(filtros||{}, colTs);
    const [rows]=await pool.query(`SELECT ped.id_pedido, ped.total, ped.metodo_pago, ped.descuento, ped.propina, ped.es_cortesia, ped.${colTs} AS fecha, ped.estado, COALESCE(u.nombre,'--') AS usuario, COALESCE(u2.nombre,'--') AS mesero, COALESCE(u3.nombre,'--') AS cajero FROM pedidos ped LEFT JOIN usuarios u ON ped.id_usuario=u.id_usuario LEFT JOIN usuarios u2 ON ped.id_mesero=u2.id_usuario LEFT JOIN usuarios u3 ON ped.id_cajero=u3.id_usuario WHERE ${where} ORDER BY ped.${colTs} DESC LIMIT 200`, params);
    return rows.map(r=>({id_pedido:r.id_pedido, fecha:r.fecha, total:Number(r.total), metodo:r.metodo_pago, descuento:Number(r.descuento), propina:Number(r.propina), cortesia: r.es_cortesia==1, estado:r.estado, usuario:r.usuario, mesero:r.mesero, cajero:r.cajero}));
}
async function reporteContableGastos(filtros){
    let where='1=1'; const par=[];
    if(filtros.fecha_inicio){ where+=' AND DATE(fecha) >= ?'; par.push(filtros.fecha_inicio); }
    if(filtros.fecha_fin){ where+=' AND DATE(fecha) <= ?'; par.push(filtros.fecha_fin); }
    try{
        const [rows]=await pool.query(`SELECT categoria, COUNT(*) AS cantidad, COALESCE(SUM(monto),0) AS total FROM movimientos_caja WHERE tipo='Egreso' AND ${where} GROUP BY categoria ORDER BY total DESC`, par);
        const [det]=await pool.query(`SELECT m.*, COALESCE(u.nombre,'') AS usuario FROM movimientos_caja m LEFT JOIN usuarios u ON m.id_usuario=u.id_usuario WHERE m.tipo='Egreso' AND ${where} ORDER BY m.fecha DESC LIMIT 200`, par);
        return {porCategoria: rows.map(r=>({categoria:r.categoria, cantidad:Number(r.cantidad), total:Number(r.total)})), detalle: det.map(r=>({id:r.id_movimiento, fecha:r.fecha, categoria:r.categoria, concepto:r.concepto, monto:Number(r.monto), usuario:r.usuario}))};
    }catch(e){ return {porCategoria:[], detalle:[]}; }
}
async function reporteStock(filtros){
    try{
        const c = obtenerColumnasProductos();
        const colVenta = c.venta || 'precio';
        const colCosto = c.costo || 'precio_costo';
        const usaIdCat = c.lista.indexOf('id_categoria') !== -1;
        const colCat = usaIdCat ? 'cat.nombre' : 'p.categoria';
        const joinCat = usaIdCat ? ' LEFT JOIN categorias cat ON p.id_categoria=cat.id_categoria' : '';
        const catFilter = usaIdCat ? " AND UPPER(COALESCE(cat.nombre,'')) NOT LIKE '%TEST-BUG%'" : " AND UPPER(COALESCE(p.categoria,'')) NOT LIKE '%TEST-BUG%'";
        const [rows]=await pool.query(`SELECT p.id_producto, p.nombre, ${colCat} AS categoria, p.stock, p.stock_minimo, p.${colVenta} AS precio, p.${colCosto} AS costo, (p.stock*p.${colVenta}) AS valor_venta, (p.stock*p.${colCosto}) AS valor_costo FROM productos p ${joinCat} WHERE p.activo=1 AND UPPER(COALESCE(p.nombre,'')) NOT LIKE '%TEST-BUG%'${catFilter} ORDER BY p.stock ASC LIMIT 200`);
        const clean = rows.filter(r=> ((String(r.nombre||'')+' '+String(r.categoria||'')).toUpperCase().indexOf('TEST-BUG')===-1));
        const totalVenta = clean.reduce((a,r)=>a+Number(r.valor_venta),0);
        const totalCosto = clean.reduce((a,r)=>a+Number(r.valor_costo),0);
        return {detalle: clean.map(r=>({id_producto:r.id_producto, nombre:r.nombre, categoria:r.categoria||'General', stock:Number(r.stock), minimo:Number(r.stock_minimo), precio:Number(r.precio), costo:Number(r.costo), valor_venta:Number(r.valor_venta), valor_costo:Number(r.valor_costo)})), totales:{totalVenta, totalCosto, count: clean.length}};
    }catch(e){ return {detalle: [], totales:{totalVenta:0, totalCosto:0, count:0}}; }
}

module.exports = { topProductos, historicoIngresos, tiemposBarra, analisisInventario, reporteVentasGeneral, reportePersonalZonas, reporteTicketEmpleadoDetallado, reporteInventarioCostos, obtenerOpcionesFiltros, reporteFamilias, reporteDescuentos, reporteRetiros, reporteImpuestos, reportePropinas, reporteNocturna, reporteAuditoria, reporteCajon, reporteHorario, reporteContableFacturas, reporteContableGastos, reporteStock };
