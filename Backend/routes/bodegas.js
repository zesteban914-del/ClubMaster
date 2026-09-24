module.exports = function(app, db){
  const bodegaService = require('../services/bodega-service');
  app.get('/api/bodegas', async (req,res)=>{
    try{ const bodegas = await bodegaService.obtenerBodegas(); res.json({success:true,bodegas}); }catch(e){ res.status(500).json({success:false,mensaje:e.message}); }
  });
  app.get('/api/bodegas/stock', async (req,res)=>{
    try{ const stock = await bodegaService.obtenerStockBodegas(req.query.id_bodega||null); res.json({success:true,stock}); }catch(e){ res.status(500).json({success:false,mensaje:e.message}); }
  });
  app.post('/api/bodegas/asignar', async (req,res)=>{
    const {id_producto,id_bodega,stock,stock_minimo}=req.body;
    if(!id_producto||!id_bodega) return res.status(400).json({success:false,mensaje:'id_producto e id_bodega requeridos'});
    try{ await bodegaService.asignarStockBodega(id_producto,id_bodega,Number(stock)||0,stock_minimo); res.json({success:true,mensaje:'Stock por bodega asignado'});}catch(e){ res.status(500).json({success:false,mensaje:e.message}); }
  });
  app.post('/api/bodegas/mover', async (req,res)=>{
    const {id_producto,de_bodega,a_bodega,cantidad}=req.body;
    if(!id_producto||!de_bodega||!a_bodega||!cantidad) return res.status(400).json({success:false,mensaje:'Datos incompletos'});
    try{ const r=await bodegaService.moverStock(id_producto,de_bodega,a_bodega,Number(cantidad)); res.json({success:true,...r}); }catch(e){ res.status(500).json({success:false,mensaje:e.message}); }
  });
  app.get('/api/config/usa-stock-bodega', async (req,res)=>{
    try{ const [r]=await db.pool.query("SELECT valor FROM configuracion_general WHERE clave='usa_stock_bodega' LIMIT 1"); res.json({success:true,usa:r.length?r[0].valor==='1':false}); }catch(e){ res.status(500).json({success:false,mensaje:e.message}); }
  });
  app.put('/api/config/usa-stock-bodega', async (req,res)=>{
    const {usa}=req.body;
    try{ await db.pool.query("INSERT INTO configuracion_general (clave,valor,descripcion) VALUES ('usa_stock_bodega',?,'1= stock por bodega') ON DUPLICATE KEY UPDATE valor=VALUES(valor)",[usa?'1':'0']); res.json({success:true,mensaje: usa?'Stock por bodega ACTIVADO':'Stock por bodega DESACTIVADO - vuelve a stock único global'}); }catch(e){ res.status(500).json({success:false,mensaje:e.message}); }
  });
};
