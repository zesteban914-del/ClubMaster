module.exports = function(app, db) {
    app.get('/api/compras', async (req, res) => {
        try {
            const compras = await db.obtenerCompras();
            res.json({ success: true, compras });
        } catch (error) {
            res.status(500).json({ success: false, mensaje: 'Error al obtener compras: ' + error.message });
        }
    });

    app.post('/api/compras', async (req, res) => {
        const { id_proveedor, id_usuario, numero_factura, total, observaciones, detalles,
                forma_pago, dias_credito, fecha_vencimiento, metodo_pago, fecha_factura,
                soporte, iva_pct, ico_pct, confirmar_costo_mayor_pv } = req.body;
        if (!id_proveedor || !detalles || detalles.length === 0) {
            return res.status(400).json({ success: false, mensaje: 'Faltan datos obligatorios para la compra' });
        }
        if (!metodo_pago) {
            return res.status(400).json({ success: false, mensaje: 'Seleccione el metodo de pago de la compra' });
        }
        const costoInvalido = detalles.some(function(d) { return Number(d.costo_unitario) <= 0; });
        if (costoInvalido) {
            return res.status(400).json({ success: false, mensaje: 'El costo unitario de cada producto debe ser mayor a $0' });
        }
        // VALIDACIÓN BACKEND RECOMENDADA: costo vs precio_venta (4)
        // Si costo > precio y no hay nuevo_precio_venta que corrija, emitir advertencia/bloqueo
        try {
            const ids = detalles.map(function(d){ return Number(d.id_producto); }).filter(function(n){ return n>0; });
            if (ids.length) {
                // obtener precios actuales de productos (usa SELECT * para compatibilidad columnas)
                const placeholders = ids.map(function(){ return '?'; }).join(',');
                const [prods] = await db.pool.query('SELECT * FROM productos WHERE id_producto IN (' + placeholders + ')', ids);
                const mapPv = {};
                prods.forEach(function(p){
                    var pv = p.precio_venta;
                    if (pv == null) pv = p.precio;
                    if (pv == null) pv = p.precioVenta;
                    mapPv[Number(p.id_producto)] = { pv: Number(pv)||0, nombre: p.nombre || ('#' + p.id_producto) };
                });
                var advertencias = [];
                var bloqueantes = [];
                detalles.forEach(function(d){
                    var info = mapPv[Number(d.id_producto)];
                    if (!info) return;
                    var pv = info.pv;
                    var costo = Number(d.costo_unitario)||0;
                    var nuevoPv = d.nuevo_precio_venta != null ? Number(d.nuevo_precio_venta) : null;
                    if (pv > 0 && costo > pv) {
                        if (nuevoPv != null && nuevoPv > costo) {
                            advertencias.push(info.nombre + ': costo $'+costo+' > PV actual $'+pv+' — se actualizará a $'+nuevoPv);
                        } else {
                            var msg = info.nombre + ': costo $'+costo+' > precio venta $'+pv;
                            advertencias.push(msg);
                            if (!confirmar_costo_mayor_pv) bloqueantes.push(msg);
                        }
                    }
                    // validar nuevo PV si viene: debe ser > costo si se proporciona
                    if (nuevoPv != null && nuevoPv <= 0) {
                        bloqueantes.push(info.nombre + ': nuevo precio de venta debe ser > 0');
                    }
                });
                if (bloqueantes.length && !confirmar_costo_mayor_pv) {
                    return res.status(400).json({ success: false, mensaje: '⚠️ Hay productos cuyo costo supera el precio de venta: ' + bloqueantes.join(' | ') + '. Corrige el costo o indica un Nuevo Precio de Venta mayor al costo, o confirma que deseas guardar de todas formas.', advertencias: advertencias, bloqueantes: bloqueantes });
                }
                // guardar advertencias para adjuntar en respuesta exitosa
                req._advertenciasCompra = advertencias;
            }
        } catch (eVal) {
            console.warn('[compras] validación costo>pv omitida por error:', eVal.message);
        }
        try {
            const configInventario = await db.obtenerConfiguracionInventario();
            const ivaDef = (iva_pct === undefined || iva_pct === null || iva_pct === '')
                ? (Number(configInventario['iva_global']) || 0) : iva_pct;
            const icoDef = (ico_pct === undefined || ico_pct === null || ico_pct === '')
                ? (Number(configInventario['ico_global']) || 0) : ico_pct;

            const resultado = await db.crearCompra(id_proveedor, id_usuario || 1, numero_factura, total, observaciones, detalles, {
                forma_pago: forma_pago, dias_credito: dias_credito, fecha_vencimiento: fecha_vencimiento,
                metodo_pago: metodo_pago, fecha_factura: fecha_factura, soporte: soporte,
                iva_pct: ivaDef, ico_pct: icoDef
            });
            var detallesMsg = 'Compra #' + resultado.id_compra + ' registrada. Stock y costo medio actualizados.';
            if (resultado.caja_egreso) detallesMsg += ' Egreso registrado en Caja.';
            else if (resultado.forma_pago === 'Credito') detallesMsg += ' Cuenta por pagar generada ($' + Number(resultado.saldo_pendiente).toFixed(2) + ').';
            if (resultado.precios_actualizados && resultado.precios_actualizados.length) detallesMsg += ' Precios actualizados: ' + resultado.precios_actualizados.map(function(x){return x.nombre+' $'+x.nuevo_precio}).join(', ') + '.';
            if (req._advertenciasCompra && req._advertenciasCompra.length) detallesMsg += ' Advertencias: ' + req._advertenciasCompra.join(' | ');
            res.json({ success: true, mensaje: detallesMsg, idCompra: resultado.id_compra, advertencias: req._advertenciasCompra || [], ...resultado });
        } catch (error) {
            console.error('Error al registrar compra:', error.message);
            res.status(500).json({ success: false, mensaje: 'Error al registrar compra: ' + error.message });
        }
    });

    app.get('/api/compras/:id/detalle', async (req, res) => {
        const { id } = req.params;
        try {
            const detalles = await db.obtenerDetalleCompra(id);
            res.json({ success: true, detalles });
        } catch (error) {
            res.status(500).json({ success: false, mensaje: 'Error al obtener detalle: ' + error.message });
        }
    });
};
