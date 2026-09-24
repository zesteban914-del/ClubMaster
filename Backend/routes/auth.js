module.exports = function(app, db, security, mailer, authMiddleware) {
    const { middlewareRateLimitLogin, registrarIntentoFallido, registrarIntentoExitoso } = authMiddleware;
    const { loginLimiter, recuperarLimiter, pinLimiter } = require('../middlewares/rateLimiter');
    const audit = require('../services/audit-service');
    async function handleLogin(req,res){
        const { correo, contrasena } = req.body;
        if (!correo || !contrasena) return res.status(400).json({ exito: false, mensaje: 'Correo y contrasena son obligatorios' });
        try {
            const usuario = await db.obtenerUsuarioPorCorreoConHash(correo);
            if (!usuario) {
                registrarIntentoFallido(req);
                await audit.auditFromReq(req,{tipo_evento:'LOGIN_FALLIDO', descripcion:`Login fallido correo inexistente: ${correo}`, motivo:'correo no existe'});
                return res.status(401).json({ exito: false, mensaje: 'Correo o contrasena incorrectos' });
            }
            let contrasenaValida = false;
            if (security.esHashBCrypt(usuario.contrasena)) contrasenaValida = await security.verificarContrasena(contrasena, usuario.contrasena);
            else { contrasenaValida = (contrasena === usuario.contrasena); if (contrasenaValida) await db.actualizarContrasena(usuario.id_usuario, contrasena); }
            if (!contrasenaValida) {
                registrarIntentoFallido(req);
                await audit.auditFromReq(req,{usuario_id: usuario.id_usuario, tipo_evento:'LOGIN_FALLIDO', descripcion:`Login fallido contraseña ${correo}`, motivo:'contrasena incorrecta'});
                return res.status(401).json({ exito: false, mensaje: 'Correo o contrasena incorrectos' });
            }
            if (usuario.activo !== 1) { registrarIntentoFallido(req); return res.status(403).json({ exito: false, mensaje: 'Usuario desactivado. Contacta al administrador.' }); }
            registrarIntentoExitoso(req);
            let permisosCodigos = [];
            try { const perms = await db.obtenerPermisosPorRol(usuario.id_rol); permisosCodigos = perms.map(function(p){return p.codigo;}); } catch(e) {}
            req.session.usuario = { id_usuario: usuario.id_usuario, nombre: usuario.nombre, correo: usuario.correo, id_rol: usuario.id_rol, rol: usuario.rol, permisos: permisosCodigos };
            res.json({ exito: true, mensaje: 'Inicio de sesion exitoso', usuario: { id_usuario: usuario.id_usuario, nombre: usuario.nombre, correo: usuario.correo, id_rol: usuario.id_rol, rol: usuario.rol, permisos: permisosCodigos } });
        } catch (error) { console.error('Error en el login:', error); res.status(500).json({ exito: false, mensaje: 'Error en el servidor' }); }
    }
    app.post('/login', loginLimiter, middlewareRateLimitLogin, handleLogin);
    app.post('/api/auth/login', loginLimiter, middlewareRateLimitLogin, handleLogin);
    app.post('/api/auth/pin-login', pinLimiter, async (req,res)=>{
        const { pin, id_usuario, correo } = req.body;
        const rawPin = String(pin||'').trim();
        if(!rawPin) return res.status(400).json({ success:false, exito:false, mensaje:'PIN requerido'});
        try{
            let usuario=null;
            if(id_usuario){ const [rows]=await db.pool.query('SELECT id_usuario, contrasena, nombre, correo, activo FROM usuarios WHERE id_usuario=?',[id_usuario]); if(rows.length) usuario=rows[0]; }
            else if(correo){ usuario=await db.obtenerUsuarioPorCorreoConHash(correo); }
            else {
                const [cfg]=await db.pool.query("SELECT valor FROM configuracion_general WHERE clave='pin_maestro' LIMIT 1");
                const maestro = cfg.length && cfg[0].valor ? String(cfg[0].valor) : '';
                if (!maestro) return res.status(503).json({success:false, mensaje:'PIN maestro no configurado. Configurelo en Configuracion.'});
                const ok = rawPin===maestro;
                if(!ok){ await audit.auditFromReq(req,{tipo_evento:'PIN_FALLIDO', descripcion:'PIN maestro fallido', motivo:'pin incorrecto'}); return res.status(401).json({success:false, mensaje:'PIN inválido'}); }
                return res.json({success:true, exito:true, mensaje:'PIN válido'});
            }
            if(!usuario){ await audit.auditFromReq(req,{tipo_evento:'PIN_FALLIDO', descripcion:`PIN fallido usuario ${id_usuario||correo}`, motivo:'usuario no encontrado'}); return res.status(401).json({success:false, mensaje:'PIN inválido'}); }
            if(usuario.activo !== undefined && Number(usuario.activo) !== 1){ await audit.auditFromReq(req,{usuario_id:usuario.id_usuario, tipo_evento:'PIN_FALLIDO', descripcion:`Fichaje bloqueado usuario inactivo ${usuario.id_usuario}`, motivo:'usuario inactivo'}); return res.status(403).json({success:false, mensaje:'Usuario inactivo. Contacta al administrador.'}); }
            let ok=false;
            if(security.esHashBCrypt(usuario.contrasena)) ok=await security.verificarContrasena(rawPin, usuario.contrasena);
            else ok=String(rawPin)===String(usuario.contrasena);
            if(!ok){ await audit.auditFromReq(req,{usuario_id:usuario.id_usuario, tipo_evento:'PIN_FALLIDO', descripcion:`PIN fallido usuario ${usuario.id_usuario}`, motivo:'pin incorrecto'}); return res.status(401).json({success:false, mensaje:'PIN inválido'}); }
            res.json({success:true, exito:true, mensaje:'PIN válido', usuario:{id_usuario:usuario.id_usuario, nombre:usuario.nombre}});
        }catch(e){ res.status(500).json({success:false,mensaje:e.message}); }
    });
    app.post('/logout', (req, res) => {
        if (req.session) req.session.destroy(() => { res.clearCookie('clubmaster.sid'); res.json({ exito: true, mensaje: 'Sesion cerrada' }); });
        else res.json({ exito: true, mensaje: 'Sesion cerrada' });
    });
    app.get('/api/sesion', async (req, res) => {
        if (req.session && req.session.usuario) {
            let u = req.session.usuario;
            if (!u.permisos) { try { const perms = await db.obtenerPermisosPorRol(u.id_rol); u.permisos = perms.map(function(p){return p.codigo;}); req.session.usuario.permisos = u.permisos; } catch(e) { u.permisos = []; } }
            return res.json({ autenticado: true, usuario: u });
        }
        return res.json({ autenticado: false });
    });
    app.post('/api/registro', async (req, res) => {
        const { nombre, correo, contrasena } = req.body;
        if (!nombre || !correo || !contrasena) return res.status(400).json({ exito: false, mensaje: 'Todos los campos son obligatorios' });
        if (contrasena.length < 6) return res.status(400).json({ exito: false, mensaje: 'La contrasena debe tener al menos 6 caracteres' });
        try {
            const ROL_PUBLICO_DEFECTO = 3;
            const resultado = await db.crearUsuario(nombre, correo, contrasena, ROL_PUBLICO_DEFECTO);
            res.json({ exito: true, mensaje: 'Cuenta creada correctamente', idUsuario: resultado.id_usuario });
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ exito: false, mensaje: 'El correo ya esta registrado' });
            console.error('Error al registrar usuario:', error);
            res.status(500).json({ exito: false, mensaje: 'Error al registrar usuario' });
        }
    });
    async function handlerRecuperar(req,res){
        const { correo } = req.body;
        if (!correo) return res.status(400).json({ exito: false, mensaje: 'El correo es obligatorio' });
        try {
            const usuario = await db.obtenerUsuarioPorCorreo(correo);
            if (!usuario) return res.json({ exito: true, mensaje: 'Si el correo esta registrado, recibiras un enlace para restablecer tu contrasena.' });
            const { token, tokenHash } = security.generarTokenRecuperacion();
            const expiraEn = security.expiracionToken();
            await db.guardarTokenRecuperacion(usuario.id_usuario, tokenHash, expiraEn);
            await mailer.enviarCorreoRecuperacion(usuario.correo, usuario.nombre, token);
            res.json({ exito: true, mensaje: 'Si el correo esta registrado, recibiras un enlace para restablecer tu contrasena.' });
        } catch (error) { console.error('Error en recuperar contrasena:', error); res.status(500).json({ exito: false, mensaje: 'Error en el servidor' }); }
    }
    app.post('/api/recuperar-contrasena', recuperarLimiter, handlerRecuperar);
    app.post('/api/auth/recuperar-password', recuperarLimiter, handlerRecuperar);
    app.post('/api/reiniciar-contrasena', async (req, res) => {
        const { token, nuevaContrasena } = req.body;
        if (!token || !nuevaContrasena) return res.status(400).json({ exito: false, mensaje: 'Token y nueva contrasena son obligatorios' });
        if (nuevaContrasena.length < 6) return res.status(400).json({ exito: false, mensaje: 'La contrasena debe tener al menos 6 caracteres' });
        try {
            const tokenHash = security.hashToken(token);
            const fila = await db.buscarTokenRecuperacion(tokenHash);
            if (!fila) return res.status(400).json({ exito: false, mensaje: 'El enlace es invalido o ya expiro. Solicita uno nuevo.' });
            await db.actualizarContrasena(fila.id_usuario, nuevaContrasena);
            await db.marcarTokenUsado(fila.id);
            res.json({ exito: true, mensaje: 'Contrasena actualizada correctamente. Ya puedes iniciar sesion.' });
        } catch (error) { console.error('Error al reiniciar contrasena:', error); res.status(500).json({ exito: false, mensaje: 'Error en el servidor' }); }
    });
};
