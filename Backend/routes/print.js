module.exports = function(app, db){
  const printService = require('../services/print-service');
  const audit = require('../services/audit-service');
  const { soloCajaOperativa } = require('../middlewares/authMiddleware');

  app.post('/api/print/comanda', async(req,res)=>{
    const {id_mesa, id_pedido, area, html, text, isReprint, abrirCajon, tipo} = req.body;
    const usuario = (req.session&&req.session.usuario&&req.session.usuario.nombre) || req.body.usuario || 'Sistema';
    const usuarioId = (req.session&&req.session.usuario&&req.session.usuario.id_usuario) || req.body.usuario_id || null;
    const fecha = new Date().toLocaleString('es-CO');
    const areaReal = area || 'barra_principal';
    if(isReprint){
      try{ await audit.auditFromReq(req,{usuario_id: usuarioId, tipo_evento:'REIMPRESION', descripcion:`Reimpresión ${tipo||'comanda'} Mesa ${id_mesa||''} Pedido ${id_pedido||''} -> ${areaReal}`, motivo:`Reimpreso por ${usuario} el ${fecha}`, mesa_id: id_mesa||id_pedido}); }catch(e){}
    }
    try{
      const result = await printService.enviarImpresion({
        area: areaReal,
        text: text||'',
        html: html||'',
        isReprint: !!isReprint,
        usuario,
        fecha,
        abrirCajon: !!abrirCajon,
        tipo: tipo||'comanda'
      });
      if(result.success){
        return res.json({success:true, impresora: result.impresora, intento: result.intento, fallback: !!result.fallback});
      } else {
        return res.status(502).json({success:false, mensaje: result.error, intentos: result.intentos, requiereIntervencion:true, secundariaDisponible: !!(await printService.getImpresoraConfig(areaReal)).secundaria});
      }
    }catch(e){
      return res.status(500).json({success:false, mensaje:e.message});
    }
  });

  app.post('/api/print/precuenta', async(req,res)=>{
    const {id_mesa, area, html, text, isReprint} = req.body;
    const usuario = (req.session&&req.session.usuario&&req.session.usuario.nombre) || req.body.usuario || 'Sistema';
    const usuarioId = (req.session&&req.session.usuario&&req.session.usuario.id_usuario) || req.body.usuario_id || null;
    const fecha = new Date().toLocaleString('es-CO');
    const areaReal = area || 'barra_principal';
    if(isReprint){
      try{ await audit.auditFromReq(req,{usuario_id: usuarioId, tipo_evento:'REIMPRESION', descripcion:`Reimpresión PRE-CUENTA Mesa ${id_mesa} -> ${areaReal}`, motivo:`Reimpreso por ${usuario} el ${fecha}`, mesa_id: id_mesa}); }catch(e){}
    }
    try{
      const result = await printService.enviarImpresion({
        area: areaReal,
        text, html,
        isReprint: !!isReprint,
        usuario, fecha,
        abrirCajon: false,
        tipo:'precuenta'
      });
      if(result.success) return res.json({success:true, impresora: result.impresora});
      return res.status(502).json({success:false, mensaje: result.error, intentos: result.intentos, requiereIntervencion:true});
    }catch(e){ return res.status(500).json({success:false, mensaje:e.message}); }
  });

  app.post('/api/print/reenviar-secundaria', async(req,res)=>{
    const {area, html, text, id_mesa, tipo} = req.body;
    const usuario = (req.session&&req.session.usuario&&req.session.usuario.nombre) || req.body.usuario || 'Sistema';
    const fecha = new Date().toLocaleString('es-CO');
    const areaReal = area || 'barra_principal';
    try{
      const cfg = await printService.getImpresoraConfig(areaReal);
      if(!cfg.secundaria) return res.status(400).json({success:false, mensaje:'No hay impresora secundaria configurada (imp_respaldo)'});
      const result = await printService.enviarImpresion({
        area: areaReal,
        text, html,
        isReprint: true,
        usuario, fecha,
        abrirCajon: false,
        tipo: tipo||'reenvio_secundaria'
      });
      // Forzar uso de secundaria si primaria falló, printService ya hace fallback, pero aquí forzamos secundaria directamente
      if(result.success) return res.json({success:true, impresora: cfg.secundaria, reenvio:true});
      return res.status(502).json({success:false, mensaje: result.error});
    }catch(e){ return res.status(500).json({success:false, mensaje:e.message}); }
  });

  app.post('/api/caja/abrir-cajon', soloCajaOperativa, async(req,res)=>{
    const {area} = req.body;
    const areaReal = area || 'caja';
    try{
      const net=require('net');
      const CMD_DRAWER=Buffer.from([0x1B,0x70,0x00,0x19,0xFA]);
      const cfg=await printService.getImpresoraConfig(areaReal);
      const ipStr=cfg.primaria || cfg.secundaria;
      if(!ipStr) return res.status(400).json({success:false, mensaje:'Impresora no configurada'});
      const m=ipStr.match(/^(\d+\.\d+\.\d+\.\d+)(?::(\d+))?$/);
      if(!m) return res.status(400).json({success:false, mensaje:'IP invalida'});
      const host=m[1], port=parseInt(m[2]||'9100',10);
      const s=new net.Socket();
      s.setTimeout(2000);
      s.connect(port, host, ()=>{ s.write(CMD_DRAWER, ()=>{ s.end(); res.json({success:true, mensaje:'Cajón abierto'}); }); });
      s.on('error', (e)=> res.status(502).json({success:false, mensaje:e.message}));
    }catch(e){ res.status(500).json({success:false, mensaje:e.message}); }
  });

  app.get('/api/print/config', async(req,res)=>{
    try{
      const cfg=await printService.getImpresoraConfig('barra_principal');
      res.json({success:true, config:cfg});
    }catch(e){ res.status(500).json({success:false, mensaje:e.message}); }
  });
};
