const { pool } = require('../config/database');

module.exports = function(app, db) {

    // =========================================================
    // CONFIGURACION GENERAL DEL SISTEMA
    // =========================================================

    app.get('/api/configuracion', async (req, res) => {
        try {
            const config = await db.obtenerConfiguracionGeneral();
            res.json({ success: true, config });
        } catch (error) {
            console.error('Error al obtener configuracion general:', error.message);
            res.status(500).json({ success: false, mensaje: 'Error al obtener configuracion: ' + error.message });
        }
    });

    app.put('/api/configuracion', async (req, res) => {
        try {
            const r = await db.guardarConfiguracionGeneral(req.body);
            res.json({ success: true, mensaje: 'Configuracion guardada correctamente', ...r });
        } catch (error) {
            console.error('Error al guardar configuracion general:', error.message);
            const code = error.statusCode || 500;
            res.status(code).json({ success: false, mensaje: error.message });
        }
    });

    app.get('/api/configuracion/pin-estado', async (req, res) => {
        try {
            const [rows] = await pool.query("SELECT valor FROM configuracion_general WHERE clave='pin_maestro' LIMIT 1");
            const configurado = !!(rows.length && String(rows[0].valor || '').trim());
            res.json({ success: true, configurado: configurado });
        } catch (error) {
            res.status(500).json({ success: false, mensaje: error.message });
        }
    });

    // =========================================================
    // ZONAS (CRUD completo)
    // =========================================================

    app.get('/api/zonas', async (req, res) => {
        try {
            const zonas = await db.obtenerZonas();
            res.json({ success: true, zonas });
        } catch (error) {
            console.error('Error al obtener zonas:', error.message);
            res.status(500).json({ success: false, mensaje: 'Error al obtener zonas: ' + error.message });
        }
    });

    app.post('/api/zonas', async (req, res) => {
        const { nombre, descripcion, color } = req.body;
        if (!nombre) return res.status(400).json({ success: false, mensaje: 'El nombre de la zona es obligatorio' });
        try {
            const [dup] = await pool.query('SELECT id_zona FROM zonas WHERE TRIM(nombre) = TRIM(?) LIMIT 1', [nombre]);
            if (dup.length) return res.status(400).json({ success: false, mensaje: 'Ya existe una zona con ese nombre' });
            const r = await db.crearZona(nombre.trim(), descripcion, color);
            res.json({ success: true, mensaje: 'Zona creada correctamente', idZona: r.id_zona });
        } catch (error) {
            console.error('Error al crear zona:', error.message);
            if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ success: false, mensaje: 'Ya existe una zona con ese nombre' });
            res.status(500).json({ success: false, mensaje: 'Error al crear zona: ' + error.message });
        }
    });

    app.put('/api/zonas/:id', async (req, res) => {
        const { nombre, descripcion, color, orden } = req.body;
        try {
            const sets = [];
            const valores = [];
            if (nombre !== undefined) { sets.push('nombre = ?'); valores.push(nombre); }
            if (descripcion !== undefined) { sets.push('descripcion = ?'); valores.push(descripcion); }
            if (color !== undefined) { sets.push('color = ?'); valores.push(color); }
            if (orden !== undefined) { sets.push('orden = ?'); valores.push(Number(orden) || 0); }
            if (sets.length === 0) return res.status(400).json({ success: false, mensaje: 'No hay campos que actualizar' });
            valores.push(req.params.id);
            await pool.query('UPDATE zonas SET ' + sets.join(', ') + ' WHERE id_zona = ?', valores);
            res.json({ success: true, mensaje: 'Zona actualizada correctamente' });
        } catch (error) {
            console.error('Error al actualizar zona:', error.message);
            if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ success: false, mensaje: 'Ya existe otra zona con ese nombre' });
            res.status(500).json({ success: false, mensaje: 'Error al actualizar zona: ' + error.message });
        }
    });

    app.delete('/api/zonas/:id', async (req, res) => {
        try {
            await pool.query('DELETE FROM zonas WHERE id_zona = ?', [req.params.id]);
            res.json({ success: true, mensaje: 'Zona eliminada correctamente' });
        } catch (error) {
            console.error('Error al eliminar zona:', error.message);
            res.status(500).json({ success: false, mensaje: 'Error al eliminar zona: ' + error.message });
        }
    });

    // =========================================================
    // NOTAS DE PREPARACION (CRUD)
    // =========================================================

    app.get('/api/notas-preparacion', async (req, res) => {
        try {
            const [rows] = await pool.query('SELECT * FROM notas_preparacion ORDER BY id_nota ASC');
            res.json({ success: true, notas: rows });
        } catch (error) {
            console.error('Error al obtener notas de preparacion:', error.message);
            res.status(500).json({ success: false, mensaje: 'Error al obtener notas: ' + error.message });
        }
    });

    app.post('/api/notas-preparacion', async (req, res) => {
        const { texto } = req.body;
        if (!texto || !String(texto).trim()) {
            return res.status(400).json({ success: false, mensaje: 'El texto de la nota es obligatorio' });
        }
        try {
            const [result] = await pool.query(
                'INSERT INTO notas_preparacion (texto, activa) VALUES (?, 1)',
                [String(texto).trim()]
            );
            res.json({ success: true, mensaje: 'Nota creada correctamente', idNota: result.insertId });
        } catch (error) {
            console.error('Error al crear nota:', error.message);
            res.status(500).json({ success: false, mensaje: 'Error al crear nota: ' + error.message });
        }
    });

    app.put('/api/notas-preparacion/:id', async (req, res) => {
        const { texto, activa } = req.body;
        try {
            const sets = [];
            const valores = [];
            if (texto !== undefined) { sets.push('texto = ?'); valores.push(String(texto).trim()); }
            if (activa !== undefined) { sets.push('activa = ?'); valores.push(activa ? 1 : 0); }
            if (sets.length === 0) return res.status(400).json({ success: false, mensaje: 'No hay campos que actualizar' });
            valores.push(req.params.id);
            await pool.query('UPDATE notas_preparacion SET ' + sets.join(', ') + ' WHERE id_nota = ?', valores);
            res.json({ success: true, mensaje: 'Nota actualizada correctamente' });
        } catch (error) {
            console.error('Error al actualizar nota:', error.message);
            res.status(500).json({ success: false, mensaje: 'Error al actualizar nota: ' + error.message });
        }
    });

    app.delete('/api/notas-preparacion/:id', async (req, res) => {
        try {
            await pool.query('DELETE FROM notas_preparacion WHERE id_nota = ?', [req.params.id]);
            res.json({ success: true, mensaje: 'Nota eliminada correctamente' });
        } catch (error) {
            console.error('Error al eliminar nota:', error.message);
            res.status(500).json({ success: false, mensaje: 'Error al eliminar nota: ' + error.message });
        }
    });
};
