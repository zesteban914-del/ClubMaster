module.exports = function(app, db, authMiddleware) {
    const { requiereAutenticacion } = authMiddleware;
    const { soloAdmin } = require('../middlewares/authMiddleware');

    app.get('/api/usuarios', async (req, res) => {
        try {
            const usuarios = await db.obtenerUsuarios();
            res.json({ success: true, usuarios });
        } catch (error) {
            res.status(500).json({ success: false, mensaje: 'Error al obtener usuarios: ' + error.message });
        }
    });

    app.post('/api/usuarios', requiereAutenticacion, soloAdmin, async (req, res) => {
        const { nombre, correo, contrasena, id_rol } = req.body;
        if (!nombre || !correo || !contrasena || !id_rol) {
            return res.status(400).json({ success: false, mensaje: 'Todos los campos son obligatorios' });
        }
        try {
            const resultado = await db.crearUsuario(nombre, correo, contrasena, id_rol);
            res.json({ success: true, mensaje: 'Usuario creado correctamente', idUsuario: resultado.id_usuario });
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ success: false, mensaje: 'El correo ya esta registrado' });
            }
            res.status(500).json({ success: false, mensaje: 'Error al crear usuario: ' + error.message });
        }
    });

    app.put('/api/usuarios/:id', requiereAutenticacion, soloAdmin, async (req, res) => {
        const { id } = req.params;
        const { nombre, correo, id_rol, contrasena, activo } = req.body;
        try {
            await db.actualizarUsuario(id, nombre, correo, id_rol);
            if (contrasena) {
                await db.actualizarContrasena(id, contrasena);
            }
            if (activo !== undefined && activo !== null && activo !== '') {
                await db.toggleUsuario(id, Number(activo) ? 1 : 0);
            }
            res.json({ success: true, mensaje: 'Usuario actualizado correctamente' });
        } catch (error) {
            res.status(500).json({ success: false, mensaje: 'Error al actualizar usuario: ' + error.message });
        }
    });

    app.put('/api/usuarios/:id/estado', requiereAutenticacion, soloAdmin, async (req, res) => {
        const { id } = req.params;
        const { activo } = req.body;
        try {
            await db.toggleUsuario(id, activo);
            res.json({ success: true, mensaje: activo ? 'Usuario activado' : 'Usuario desactivado' });
        } catch (error) {
            res.status(500).json({ success: false, mensaje: 'Error al actualizar usuario: ' + error.message });
        }
    });

    app.get('/api/roles', async (req, res) => {
        try {
            const roles = await db.obtenerRoles();
            res.json({ success: true, roles });
        } catch (error) {
            res.status(500).json({ success: false, mensaje: 'Error al obtener roles: ' + error.message });
        }
    });

    app.post('/api/roles', requiereAutenticacion, soloAdmin, async (req, res) => {
        const { nombre, descripcion } = req.body;
        if (!nombre || !String(nombre).trim()) return res.status(400).json({ success: false, mensaje: 'Nombre obligatorio' });
        try {
            const r = await db.crearRol(String(nombre).trim(), descripcion);
            res.json({ success: true, mensaje: 'Rol creado', id_rol: r.id_rol });
        } catch (e) {
            if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ success: false, mensaje: 'El rol ya existe' });
            res.status(500).json({ success: false, mensaje: e.message });
        }
    });
    app.put('/api/roles/:id', requiereAutenticacion, soloAdmin, async (req, res) => {
        try {
            await db.actualizarRol(req.params.id, req.body.nombre, req.body.descripcion);
            res.json({ success: true, mensaje: 'Rol actualizado' });
        } catch (e) { res.status(500).json({ success: false, mensaje: e.message }); }
    });
    app.delete('/api/roles/:id', requiereAutenticacion, soloAdmin, async (req, res) => {
        try {
            await db.eliminarRol(req.params.id);
            res.json({ success: true, mensaje: 'Rol eliminado' });
        } catch (e) { res.status(400).json({ success: false, mensaje: e.message }); }
    });

    app.get('/api/permisos', async (req, res) => {
        try {
            const ensure = [
                ['ver_reportes','Ver reportes','Acceso a reportes y analitica'],
                ['anular_pedidos','Anular pedidos','Puede anular pedidos y comandas'],
                ['aplicar_descuentos','Aplicar descuentos','Puede aplicar descuentos y cortesias'],
                ['cerrar_jornada','Cerrar jornada','Puede cerrar jornada y arqueo'],
                ['gestionar_inventario','Gestionar inventario','Alta/baja de productos y stock'],
                ['crear_usuarios','Crear usuarios','Crear y editar usuarios y roles'],
                ['ver_caja','Ver caja','Ver movimientos y caja'],
                ['gestionar_configuracion','Gestionar configuracion','Acceso a configuracion general'],
                ['registrar_mermas','Registrar mermas','Puede registrar mermas'],
                ['gestionar_proveedores','Gestionar proveedores','Compras y proveedores'],
                ['can_create_orders','Permitir tomar y enviar pedidos a cocina/barra','Habilita boton de comandas en Mesas si caja abierta'],
                ['can_access_inventory_analytics','Acceso a Análisis de Inventario','Ver modulo Analisis de Inventario'],
                ['can_cancel_orders','Cancelar pedidos','Permite cancelar comandas y anular items (sin PIN si tiene permiso)']
            ];
            for(const p of ensure){ try{ await db.pool.query('INSERT IGNORE INTO permisos (codigo,nombre,descripcion) VALUES (?,?,?)', p); }catch(e){} }
            const permisos = await db.obtenerPermisos();
            res.json({ success: true, permisos });
        }
        catch (e) { res.status(500).json({ success: false, mensaje: e.message }); }
    });
    app.get('/api/roles/:id/permisos', async (req, res) => {
        try { const permisos = await db.obtenerPermisosPorRol(req.params.id); res.json({ success: true, permisos }); }
        catch (e) { res.status(500).json({ success: false, mensaje: e.message }); }
    });
    app.put('/api/roles/:id/permisos', async (req, res) => {
        try {
            const ids = Array.isArray(req.body.permisos) ? req.body.permisos : Array.isArray(req.body.ids) ? req.body.ids : [];
            await db.guardarPermisosRol(req.params.id, ids.map(Number).filter(Boolean));
            res.json({ success: true, mensaje: 'Permisos guardados' });
        } catch (e) { res.status(500).json({ success: false, mensaje: e.message }); }
    });
};
