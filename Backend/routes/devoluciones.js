module.exports = function(app, db) {
    const audit = require('../services/audit-service');
    const devService = require('../services/devolucion-service');

    // Deteccion de usuario (sesion o body)
    function usuarioId(req) {
        return (req.body && req.body.id_usuario)
            || (req.session && req.session.usuario && req.session.usuario.id_usuario)
            || null;
    }

    // Listar devoluciones (filtro por proveedor, fecha y estado)
    app.get('/api/devoluciones', async (req, res) => {
        try {
            const resultado = await devService.obtenerDevoluciones({
                id_proveedor: req.query.id_proveedor || null,
                id_producto: req.query.id_producto || null,
                desde: req.query.desde || null,
                hasta: req.query.hasta || null,
                estado: req.query.estado || null,
                limite: req.query.limite || 300
            });
            res.json({
                success: true,
                devoluciones: resultado.devoluciones,
                total_devuelto: resultado.total_devuelto,
                total_cantidad: resultado.total_cantidad
            });
        } catch (error) {
            res.status(500).json({ success: false, mensaje: 'Error al obtener devoluciones: ' + error.message });
        }
    });

    // Crear devolucion (descuenta stock si el estado es Aprobada/Completada)
    app.post('/api/devoluciones', async (req, res) => {
        const { id_proveedor, id_usuario, motivo_general, notas, detalles, estado, id_jornada, id_bodega } = req.body;
        if (!id_proveedor || !detalles || detalles.length === 0) {
            return res.status(400).json({ success: false, mensaje: 'Faltan datos: proveedor y al menos un producto son obligatorios' });
        }
        try {
            const resultado = await devService.crearDevolucion(
                id_proveedor, id_usuario || usuarioId(req), motivo_general, notas, detalles,
                { estado: estado, id_jornada: id_jornada, id_bodega: id_bodega }
            );
            const uid = id_usuario || usuarioId(req);
            await audit.auditFromReq(req, {
                usuario_id: uid,
                tipo_evento: 'DEVOLUCION',
                descripcion: 'Devolucion ' + resultado.numero_devolucion + ' proveedor #' + id_proveedor +
                    ' total $' + resultado.total_devuelto + (resultado.stock_aplicado ? ' (stock descontado)' : ''),
                motivo: (motivo_general || notas || '').toString(),
                mesa_id: null
            });
            res.json({
                success: true,
                mensaje: 'Devolución ' + resultado.numero_devolucion + ' registrada correctamente' +
                    (resultado.stock_aplicado ? '. Stock descontado del inventario.' : '. Pendiente de aprobación para descontar stock.'),
                idDevolucion: resultado.id_devolucion,
                numero: resultado.numero_devolucion,
                estado: resultado.estado,
                total_devuelto: resultado.total_devuelto,
                stock_aplicado: resultado.stock_aplicado
            });
        } catch (error) {
            console.error('crearDevolucion', error.message);
            const code = error.message.indexOf('Stock insuficiente') !== -1 ? 409 : 500;
            res.status(code).json({ success: false, mensaje: 'Error al registrar devolución: ' + error.message });
        }
    });

    // Detalle de una devolucion (encabezado + lineas)
    app.get('/api/devoluciones/:id', async (req, res) => {
        try {
            const detalle = await devService.obtenerDevolucionDetalle(req.params.id);
            if (!detalle) return res.status(404).json({ success: false, mensaje: 'Devolución no encontrada' });
            res.json({ success: true, devolucion: detalle });
        } catch (error) {
            res.status(500).json({ success: false, mensaje: 'Error al obtener devolución: ' + error.message });
        }
    });

    // Cambiar estado (Pendiente -> Aprobada/Completada descontara stock si no se habia hecho)
    app.put('/api/devoluciones/:id/estado', async (req, res) => {
        const { estado, id_usuario } = req.body;
        if (!estado) return res.status(400).json({ success: false, mensaje: 'El estado es obligatorio' });
        try {
            const resultado = await devService.cambiarEstadoDevolucion(req.params.id, estado, id_usuario || usuarioId(req));
            await audit.auditFromReq(req, {
                usuario_id: id_usuario || usuarioId(req),
                tipo_evento: 'DEVOLUCION',
                descripcion: 'Devolución #' + req.params.id + ' estado -> ' + resultado.estado +
                    (resultado.stock_ajustado ? ' (stock descontado)' : ''),
                motivo: 'cambio de estado devolución',
                mesa_id: null
            });
            res.json({
                success: true,
                mensaje: 'Estado de la devolución actualizado a ' + resultado.estado +
                    (resultado.stock_ajustado ? ' y stock descontado.' : '.'),
                estado: resultado.estado,
                stock_ajustado: resultado.stock_ajustado
            });
        } catch (error) {
            res.status(500).json({ success: false, mensaje: 'Error al cambiar estado: ' + error.message });
        }
    });

    // Proovedores que surten un producto
    app.get('/api/productos/:id/proveedores', async (req, res) => {
        try {
            const proveedores = await devService.obtenerProveedoresPorProducto(req.params.id);
            res.json({ success: true, proveedores });
        } catch (error) {
            res.status(500).json({ success: false, mensaje: 'Error al obtener proveedores del producto: ' + error.message });
        }
    });

    // Devoluciones de un producto
    app.get('/api/productos/:id/devoluciones', async (req, res) => {
        try {
            const devoluciones = await devService.obtenerDevolucionesPorProducto(req.params.id);
            res.json({ success: true, devoluciones });
        } catch (error) {
            res.status(500).json({ success: false, mensaje: 'Error al obtener devoluciones del producto: ' + error.message });
        }
    });
};