module.exports = function(app, db){
  const audit = require('../services/audit-service');
  app.get('/api/audit-logs', async (req,res)=>{
    const u = req.session && req.session.usuario;
    if(!u || (Number(u.id_rol)!==1 && String(u.rol).toLowerCase()!=='administrador' && String(u.rol).toLowerCase()!=='admin')){
      return res.status(403).json({success:false,mensaje:'Solo Administrador'});
    }
    try{
      const { tipo_evento, tipo, usuario_id, mesa_id, fecha_inicio, fecha_fin, limite, offset } = req.query;
      const tipoF = tipo_evento || tipo || null;
      const result = await audit.listarAudit({tipo: tipoF, usuario_id: usuario_id||null, mesa_id: mesa_id||null, fecha_inicio: fecha_inicio||null, fecha_fin: fecha_fin||null, limit: limite||100, offset: offset||0});
      res.json({success:true, ...result});
    }catch(e){ res.status(500).json({success:false,mensaje:e.message}); }
  });
  app.get('/api/audit-logs/opciones', async(req,res)=>{
    const u = req.session && req.session.usuario;
    if(!u || (Number(u.id_rol)!==1 && String(u.rol).toLowerCase()!=='administrador' && String(u.rol).toLowerCase()!=='admin')){
      return res.status(403).json({success:false,mensaje:'Solo Administrador'});
    }
    try{
      const [tipos]=await db.pool.query("SELECT DISTINCT tipo_evento FROM audit_logs ORDER BY tipo_evento");
      const [usuarios]=await db.pool.query("SELECT id_usuario, nombre FROM usuarios WHERE activo=1 ORDER BY nombre");
      res.json({success:true, tipos: tipos.map(r=>r.tipo_evento), usuarios});
    }catch(e){ res.status(500).json({success:false,mensaje:e.message});}
  });
};
