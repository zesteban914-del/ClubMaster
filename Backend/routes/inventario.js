const bcrypt = require('bcryptjs');
module.exports = function(app, db) {
    const audit = require('../services/audit-service');
    app.get('/api/inventario/analisis', async (req, res) => {
        try {
            const resultado = await db.analisisInventario(req.query.dias);
            res.json({ success: true, ...resultado });
        } catch (error) {
            console.error('Error en analisis de inventario:', error.message);
            res.status(500).json({ success: false, mensaje: 'Error en analisis de inventario: ' + error.message });
        }
    });

    app.get('/api/categorias', async (req, res) => {
        try { const categorias = await db.obtenerCategorias(); res.json({ success: true, categorias }); }
        catch (error) { res.status(500).json({ success: false, mensaje: 'Error al obtener categorias: ' + error.message }); }
    });
    app.post('/api/categorias', async (req, res) => {
        const { nombre } = req.body;
        if (!nombre || !String(nombre).trim()) return res.status(400).json({ success: false, mensaje: 'El nombre de la categoria es obligatorio' });
        try { const r = await db.crearCategoria(nombre); res.json({ success: true, mensaje: 'Categoria creada correctamente', idCategoria: r.id_categoria }); }
        catch (error) { res.status(500).json({ success: false, mensaje: 'Error al crear categoria: ' + error.message }); }
    });
    app.put('/api/categorias/:id', async (req, res) => {
        const { nombre } = req.body;
        if (!nombre || !String(nombre).trim()) return res.status(400).json({ success: false, mensaje: 'El nombre de la categoria es obligatorio' });
        try { await db.renombrarCategoria(req.params.id, nombre); res.json({ success: true, mensaje: 'Categoria actualizada correctamente' }); }
        catch (error) { res.status(500).json({ success: false, mensaje: 'Error al actualizar categoria: ' + error.message }); }
    });
    app.delete('/api/categorias/:id', async (req, res) => {
        try {
            const afectadas = await db.eliminarCategoria(req.params.id);
            if (afectadas === 0) return res.status(404).json({ success: false, mensaje: 'Categoria no encontrada' });
            res.json({ success: true, mensaje: 'Categoria eliminada. Sus productos fueron reasignados a General.' });
        } catch (error) { res.status(500).json({ success: false, mensaje: 'Error al eliminar categoria: ' + error.message }); }
    });

    app.get('/api/config-inventario', async (req, res) => {
        try { const config = await db.obtenerConfiguracionInventario(); res.json({ success: true, config }); }
        catch (error) { res.status(500).json({ success: false, mensaje: 'Error al obtener configuracion: ' + error.message }); }
    });
    app.post('/api/config-inventario', async (req, res) => {
        try { const r = await db.guardarConfiguracionInventario(req.body); res.json({ success: true, mensaje: 'Configuracion guardada correctamente', ...r }); }
        catch (error) { res.status(500).json({ success: false, mensaje: 'Error al guardar configuracion: ' + error.message }); }
    });
    app.get('/api/unidades-medida', async (req, res) => {
        try { const unidades = await db.obtenerUnidadesMedida(); res.json({ success: true, unidades }); }
        catch (error) { res.status(500).json({ success: false, mensaje: 'Error al obtener unidades: ' + error.message }); }
    });
    app.post('/api/unidades-medida', async (req, res) => {
        if (!req.body.nombre || !String(req.body.nombre).trim()) return res.status(400).json({ success: false, mensaje: 'El nombre de la unidad es obligatorio' });
        try {
            const [dup] = await db.pool.query('SELECT id_unidad FROM unidades_medida WHERE TRIM(nombre) = TRIM(?) LIMIT 1', [req.body.nombre]);
            if (dup.length) return res.status(400).json({ success: false, mensaje: 'Ya existe una unidad con ese nombre' });
            const r = await db.crearUnidadMedida(req.body); res.json({ success: true, mensaje: 'Unidad creada correctamente', idUnidad: r.id_unidad });
        }
        catch (error) {
            if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ success: false, mensaje: 'Ya existe una unidad con ese nombre' });
            res.status(500).json({ success: false, mensaje: 'Error al crear unidad: ' + error.message });
        }
    });
    app.put('/api/unidades-medida/:id', async (req, res) => {
        if (!req.body.nombre || !String(req.body.nombre).trim()) return res.status(400).json({ success: false, mensaje: 'El nombre de la unidad es obligatorio' });
        try { await db.actualizarUnidadMedida(req.params.id, req.body); res.json({ success: true, mensaje: 'Unidad actualizada correctamente' }); }
        catch (error) {
            if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ success: false, mensaje: 'Ya existe otra unidad con ese nombre' });
            res.status(500).json({ success: false, mensaje: 'Error al actualizar unidad: ' + error.message });
        }
    });
    app.delete('/api/unidades-medida/:id', async (req, res) => {
        try { await db.eliminarUnidadMedida(req.params.id); res.json({ success: true, mensaje: 'Unidad eliminada correctamente' }); }
        catch (error) { res.status(500).json({ success: false, mensaje: 'Error al eliminar unidad: ' + error.message }); }
    });
    app.get('/api/conversiones', async (req, res) => {
        try { const conversiones = await db.obtenerConversiones(); res.json({ success: true, conversiones }); }
        catch (error) { res.status(500).json({ success: false, mensaje: 'Error al obtener conversiones: ' + error.message }); }
    });
    app.post('/api/conversiones', async (req, res) => {
        try { const r = await db.guardarConversiones(req.body.conversiones); res.json({ success: true, mensaje: 'Conversiones guardadas correctamente', ...r }); }
        catch (error) { res.status(500).json({ success: false, mensaje: 'Error al guardar conversiones: ' + error.message }); }
    });
    app.post('/api/productos/precios-masivo', async (req, res) => {
        try { const r = await db.ajustarPreciosMasivo(req.body); res.json({ success: true, mensaje: 'Precios ajustados masivamente', ...r }); }
        catch (error) { res.status(500).json({ success: false, mensaje: 'Error al ajustar precios: ' + error.message }); }
    });
    app.post('/api/productos/aplicar-impuestos', async (req, res) => {
        const { iva, ico } = req.body;
        try { const r = await db.aplicarImpuestosGlobales(iva, ico); res.json({ success: true, mensaje: 'Impuestos por defecto aplicados a todos los productos activos', ...r }); }
        catch (error) { res.status(500).json({ success: false, mensaje: 'Error al aplicar impuestos: ' + error.message }); }
    });

    app.post('/api/mermas', async (req, res) => {
        let { id_producto, cantidad, motivo, id_usuario, observaciones, pin_admin, costo_unitario, area_origen } = req.body;
        if (!id_producto || !cantidad || !motivo) return res.status(400).json({ success: false, mensaje: 'Faltan datos: producto, cantidad y motivo son obligatorios' });
        const motivosValidos = ['Rotura','Derrame','Vencimiento','Cortesia','Consumo Interno'];
        const motivoNorm = motivo==='Consumo interno' ? 'Consumo Interno' : motivo;
        if (!motivosValidos.includes(motivoNorm)) return res.status(400).json({ success: false, mensaje: 'Motivo no valido. Opciones: ' + motivosValidos.join(', ') });
        motivo = motivoNorm;
        const obs = (observaciones||'').toString().trim();
        if ((motivo==='Cortesia' || motivo==='Consumo Interno') && !obs) return res.status(400).json({ success: false, mensaje: motivo+' requiere Observaciones / Justificacion' });
        if (motivo==='Vencimiento' && !obs) return res.status(400).json({ success: false, mensaje: 'Vencimiento requiere Observaciones' });
        try {
            const [cfgRows] = await db.pool.query(`SELECT clave, valor FROM configuracion_general WHERE clave IN ('mermas_solo_admin','mermas_pin_requerido')`);
            const cfg={}; cfgRows.forEach(function(r){ cfg[r.clave]=r.valor; });
            const soloAdmin = cfg.mermas_solo_admin==='1';
            const pinReq = cfg.mermas_pin_requerido==='1';
            let uid = id_usuario || (req.session && req.session.usuario ? req.session.usuario.id_usuario : null);
            if (soloAdmin || pinReq) {
                let rolNombre=''; let passHash=null;
                if(uid){
                    const [uRows]=await db.pool.query(`SELECT u.id_usuario, u.contrasena, COALESCE(r.nombre,'') AS rol FROM usuarios u LEFT JOIN roles r ON u.id_rol=r.id_rol WHERE u.id_usuario=?`,[uid]);
                    if(uRows.length){ rolNombre=(uRows[0].rol||'').toLowerCase(); passHash=uRows[0].contrasena; }
                }
                const isAdmin = ['admin','administrador'].includes(rolNombre);
                if(soloAdmin && !isAdmin) return res.status(403).json({ success:false, mensaje:'Solo admin puede registrar mermas (activado en configuracion)' });
                if(pinReq){
                    if(!pin_admin) return res.status(403).json({ success:false, mensaje:'Se requiere PIN de admin para registrar merma' });
                    let pinOk=false;
                    if(passHash && pin_admin){
                        try{ pinOk = await bcrypt.compare(String(pin_admin), passHash); }catch(e){ pinOk=false; }
                    }
                    if(!pinOk){
                        const [admins]=await db.pool.query(`SELECT u.contrasena FROM usuarios u LEFT JOIN roles r ON u.id_rol=r.id_rol WHERE LOWER(r.nombre) IN ('admin','administrador') AND u.activo=1 LIMIT 5`);
                        for(const a of admins){ try{ if(await bcrypt.compare(String(pin_admin), a.contrasena)){ pinOk=true; break; }}catch(e){} }
                    }
                    if(!pinOk) return res.status(403).json({ success:false, mensaje:'PIN de admin incorrecto' });
                }
            }
            const resultado = await db.crearMerma(id_producto, cantidad, motivo, uid, obs, costo_unitario, area_origen);
            await audit.auditFromReq(req, { usuario_id: uid, tipo_evento: 'MERMAS', descripcion: `Merma ${resultado.id_merma} producto ${id_producto} cant ${cantidad} motivo ${motivo} costo ${resultado.costo_unitario}`, motivo: obs || motivo, mesa_id: null });
            res.json({ success: true, mensaje: 'Merma registrada correctamente. Stock descontado. Perdida: $'+Number(resultado.valor_perdida).toLocaleString('es-CO'), idMerma: resultado.id_merma, valor_perdida: resultado.valor_perdida, costo_unitario: resultado.costo_unitario });
        } catch (error) {
            console.error('crearMerma', error.message);
            const code = error.message.includes('Stock insuficiente') ? 409 : 500;
            res.status(code).json({ success: false, mensaje: 'Error al registrar merma: ' + error.message });
        }
    });

    app.get('/api/mermas', async (req,res)=>{
        try{
            const {desde,hasta,motivo}=req.query;
            const data = await db.obtenerKPIsMermas({desde,hasta,motivo});
            res.json({ success:true, mermas: data.mermas, total_valor: data.total_valor, total_registros: data.total_registros, motivo_frecuente: data.motivo_frecuente });
        }catch(error){ res.status(500).json({success:false,mensaje:error.message}); }
    });
    app.get('/api/mermas/mes', async (req, res) => {
        try {
            const mermas = await db.obtenerMermasMes();
            const totalValor = mermas.reduce((acc, m) => acc + Number(m.valor_total || 0), 0);
            res.json({ success: true, mermas, total_valor_mes: totalValor });
        } catch (error) { res.status(500).json({ success: false, mensaje: 'Error al obtener mermas: ' + error.message }); }
    });
};
