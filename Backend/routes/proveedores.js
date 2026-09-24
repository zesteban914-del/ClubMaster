module.exports = function(app, db) {
    app.get('/api/proveedores', async (req, res) => {
        try {
            const proveedores = await db.obtenerProveedores();
            res.json({ success: true, proveedores });
        } catch (error) {
            res.status(500).json({ success: false, mensaje: 'Error al obtener proveedores: ' + error.message });
        }
    });

    app.post('/api/proveedores', async (req, res) => {
        const datos = req.body;
        if (!datos.nombre) {
            return res.status(400).json({ success: false, mensaje: 'El nombre es obligatorio' });
        }
        try {
            const resultado = await db.crearProveedor(datos);
            res.json({ success: true, mensaje: 'Proveedor creado correctamente', idProveedor: resultado.id_proveedor });
        } catch (error) {
            res.status(500).json({ success: false, mensaje: 'Error al crear proveedor: ' + error.message });
        }
    });

    app.put('/api/proveedores/:id', async (req, res) => {
        const { id } = req.params;
        const datos = req.body;
        try {
            await db.actualizarProveedor(id, datos);
            res.json({ success: true, mensaje: 'Proveedor actualizado correctamente' });
        } catch (error) {
            res.status(500).json({ success: false, mensaje: 'Error al actualizar proveedor: ' + error.message });
        }
    });

    app.put('/api/proveedores/:id/estado', async (req, res) => {
        const { id } = req.params;
        const { activo } = req.body;
        try {
            await db.toggleProveedor(id, activo);
            res.json({ success: true, mensaje: activo ? 'Proveedor activado' : 'Proveedor desactivado' });
        } catch (error) {
            res.status(500).json({ success: false, mensaje: 'Error al actualizar proveedor: ' + error.message });
        }
    });

    app.get('/api/proveedores/:id/ficha', async (req, res) => {
        const { id } = req.params;
        try {
            const ficha = await db.obtenerFichaProveedor(id);
            if (!ficha) {
                return res.status(404).json({ success: false, mensaje: 'Proveedor no encontrado' });
            }
            res.json({ success: true, ...ficha });
        } catch (error) {
            res.status(500).json({ success: false, mensaje: 'Error al obtener ficha del proveedor: ' + error.message });
        }
    });

    app.post('/api/proveedores/:id/pagos', async (req, res) => {
        const { id } = req.params;
        const { id_compra, monto, metodo_pago, referencia, id_usuario, observaciones } = req.body;
        if (!monto || Number(monto) <= 0) {
            return res.status(400).json({ success: false, mensaje: 'El monto del pago debe ser mayor a 0' });
        }
        try {
            const resultado = await db.crearPagoProveedor(
                id, id_compra, Number(monto), metodo_pago, referencia, id_usuario, observaciones
            );
            res.json({ success: true, mensaje: 'Pago registrado correctamente', idPago: resultado.id_pago });
        } catch (error) {
            res.status(500).json({ success: false, mensaje: 'Error al registrar pago: ' + error.message });
        }
    });

    // ============ PRODUCTOS ASOCIADOS AL PROVEEDOR ============
    app.get('/api/proveedores/:id/productos', async (req, res) => {
        const { id } = req.params;
        try {
            const productos = await db.obtenerProductosPorProveedor(id);
            res.json({ success: true, productos });
        } catch (error) {
            res.status(500).json({ success: false, mensaje: 'Error al obtener productos del proveedor: ' + error.message });
        }
    });

    app.get('/api/proveedores/:id/productos/disponibles', async (req, res) => {
        const { id } = req.params;
        try {
            const productos = await db.obtenerProductosActivosDisponiblesParaAsociar(id);
            res.json({ success: true, productos });
        } catch (error) {
            res.status(500).json({ success: false, mensaje: 'Error al obtener productos disponibles: ' + error.message });
        }
    });

    app.post('/api/proveedores/:id/productos', async (req, res) => {
        const { id } = req.params;
        const { id_producto } = req.body;
        if (!id_producto) {
            return res.status(400).json({ success: false, mensaje: 'El producto es obligatorio' });
        }
        try {
            const resultado = await db.asociarProductoProveedor(id, id_producto, req.body);
            res.json({ success: true, mensaje: 'Producto asociado al proveedor correctamente', idRelacion: resultado.id_relacion });
        } catch (error) {
            res.status(500).json({ success: false, mensaje: 'Error al asociar producto: ' + error.message });
        }
    });

    app.put('/api/productos-proveedores/:id', async (req, res) => {
        const { id } = req.params;
        try {
            await db.actualizarRelacionProductoProveedor(id, req.body);
            res.json({ success: true, mensaje: 'Relación actualizada correctamente' });
        } catch (error) {
            res.status(500).json({ success: false, mensaje: 'Error al actualizar relación: ' + error.message });
        }
    });

    app.delete('/api/productos-proveedores/:id', async (req, res) => {
        const { id } = req.params;
        try {
            const afectadas = await db.eliminarRelacionProductoProveedor(id);
            if (afectadas === 0) return res.status(404).json({ success: false, mensaje: 'Relación no encontrada' });
            res.json({ success: true, mensaje: 'Producto quitado del proveedor correctamente' });
        } catch (error) {
            res.status(500).json({ success: false, mensaje: 'Error al quitar producto: ' + error.message });
        }
    });

    // ============ DEVOLUCIONES HECHAS AL PROVEEDOR ============
    app.get('/api/proveedores/:id/devoluciones', async (req, res) => {
        const { id } = req.params;
        try {
            const devoluciones = await db.obtenerDevolucionesPorProveedor(id);
            const total = devoluciones.reduce(function(a, d) { return a + Number(d.total_devuelto || 0); }, 0);
            res.json({ success: true, devoluciones, total_devuelto: total });
        } catch (error) {
            res.status(500).json({ success: false, mensaje: 'Error al obtener devoluciones del proveedor: ' + error.message });
        }
    });
};
