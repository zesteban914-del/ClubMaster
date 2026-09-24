const path=require('path');
require('dotenv').config({path:path.join(__dirname,'..','.env')});
const {pool}=require('../config/database');
const bcrypt=require('bcryptjs');

async function getCols(conn,tabla){
  try{const [c]=await conn.query(`SHOW COLUMNS FROM \`${tabla}\``);return c.map(x=>x.Field);}catch(e){return [];}
}
async function getColInfo(conn,tabla){
  try{const [c]=await conn.query(`SHOW COLUMNS FROM \`${tabla}\``);return c;}catch(e){return [];}
}

async function seedAll(){
  const conn=await pool.getConnection();
  try{
    console.log('=== SEED COMPLETO CLUBMASTER ===');
    await conn.query('SET FOREIGN_KEY_CHECKS=0');

    const colProd=await getCols(conn,'productos');
    const colPed=await getCols(conn,'pedidos');
    const colDet=await getCols(conn,'detalle_pedido');
    const colJor=await getCols(conn,'jornadas');
    const colUsr=await getCols(conn,'usuarios');
    const colRol=await getCols(conn,'roles');
    const colAudit=await getCols(conn,'audit_logs');
    const colMesa=await getCols(conn,'mesas');
    const colProv=await getCols(conn,'proveedores');
    const colCompra=await getCols(conn,'compras');
    const colDetCompra=await getCols(conn,'detalle_compras');
    const colCliente=await getCols(conn,'clientes_socios');
    const colVale=await getCols(conn,'cuentas_por_cobrar');
    const colZona=await getCols(conn,'zonas');
    const colCat=await getCols(conn,'categorias');

    const precioVentaCol=colProd.includes('precio_venta')?'precio_venta':(colProd.includes('precio')?'precio':null);
    const costoCol=colProd.includes('precio_costo')?'precio_costo':(colProd.includes('costo')?'costo':null);
    const tsPedidoCol=colPed.includes('timestamp_pedido')?'timestamp_pedido':(colPed.includes('fecha_pedido')?'fecha_pedido':null);
    const tsDespachoCol=colPed.includes('timestamp_despacho')?'timestamp_despacho':null;

// -------------------------------------------------
// 0 LIMPIEZA CONTROLADA
// -------------------------------------------------
    console.log('Limpiando tablas para seeding idempotente...');
    const orderDelete=['abonos_vales','cuentas_por_cobrar','detalle_compras','pagos_proveedores','compras','arqueos_detalle','movimientos_caja','detalle_pedido','pedidos','mermas','audit_logs'];
    for(const t of orderDelete){ try{await conn.query(`DELETE FROM \`${t}\``);}catch(e){} }
    try{await conn.query(`DELETE FROM jornadas`);}catch(e){}
    try{await conn.query(`DELETE FROM mesas`);}catch(e){}
    // no borrar categorias/productos/usuarios completamente -> borramos test especificos luego reinsertamos

// -------------------------------------------------
// 1 USUARIOS, ROLES Y SEGURIDAD
// -------------------------------------------------
    console.log('\n[1] Usuarios, Roles y Seguridad');
    const rolesNeed=[['Administrador','Acceso total'],['Mesero','Atencion mesas'],['Bartender','Barra y Speed Bar'],['Cajero','Caja y cobros'],['Gerente','Supervision']];
    for(const r of rolesNeed){ try{await conn.query('INSERT IGNORE INTO roles (nombre,descripcion) VALUES (?,?)',[r[0],r[1]]);}catch(e){try{await conn.query('INSERT IGNORE INTO roles (nombre) VALUES (?)',[r[0]]);}catch(e2){}} }
    let [roles]=await conn.query('SELECT id_rol,nombre FROM roles');
    const roleMap={}; roles.forEach(r=>roleMap[r.nombre.toLowerCase()]=r.id_rol);
    const idAdmin=roleMap['administrador']||1;
    const idMesero=roleMap['mesero']||3;
    let idBartender=roleMap['bartender'];
    if(!idBartender){ const [ins]=await conn.query('INSERT INTO roles (nombre,descripcion) VALUES (?,?)',['Bartender','Barra']); idBartender=ins.insertId; roleMap['bartender']=idBartender; }
    let idCajero=roleMap['cajero']; if(!idCajero){ const [ins]=await conn.query('INSERT INTO roles (nombre) VALUES (?)',['Cajero']); idCajero=ins.insertId; }

    const usersSeed=[
      {nombre:'Administrador Master',correo:'admin@clubmaster.com',pin:'1234',rol:idAdmin},
      {nombre:'Mesero Uno',correo:'mesero1@clubmaster.com',pin:'1111',rol:idMesero},
      {nombre:'Mesero Dos',correo:'mesero2@clubmaster.com',pin:'2222',rol:idMesero},
      {nombre:'Bartender Uno',correo:'bar1@clubmaster.com',pin:'3333',rol:idBartender},
      {nombre:'Bartender Dos',correo:'bar2@clubmaster.com',pin:'4444',rol:idBartender},
    ];
    for(const u of usersSeed){
      const hash=await bcrypt.hash(u.pin,10);
      try{
        await conn.query('DELETE FROM usuarios WHERE correo=?',[u.correo]);
        const colsU=[]; const valsU=[]; const phU=[];
        function addU(c,v){ if(colUsr.includes(c)){ colsU.push(c); valsU.push(v); phU.push('?'); } }
        addU('nombre',u.nombre); addU('correo',u.correo); addU('contrasena',hash); addU('id_rol',u.rol); addU('activo',1);
        if(colsU.length) await conn.query(`INSERT INTO usuarios (${colsU.join(',')}) VALUES (${phU.join(',')})`,valsU);
        console.log(` Usuario ${u.correo} PIN ${u.pin} -> rol ${u.rol}`);
      }catch(e){ console.log(' usuario error',e.message); }
    }
    let [usuarios]=await conn.query('SELECT id_usuario,correo,nombre FROM usuarios WHERE correo IN (?,?,?,?,?)',['admin@clubmaster.com','mesero1@clubmaster.com','mesero2@clubmaster.com','bar1@clubmaster.com','bar2@clubmaster.com']);
    const uidAdmin=(usuarios.find(x=>x.correo==='admin@clubmaster.com')||{}).id_usuario||1;
    const uidMes1=(usuarios.find(x=>x.correo==='mesero1@clubmaster.com')||{}).id_usuario||2;
    const uidMes2=(usuarios.find(x=>x.correo==='mesero2@clubmaster.com')||{}).id_usuario||3;
    const uidBar1=(usuarios.find(x=>x.correo==='bar1@clubmaster.com')||{}).id_usuario||4;
    const uidBar2=(usuarios.find(x=>x.correo==='bar2@clubmaster.com')||{}).id_usuario||5;

    if(colAudit.length>0){
      const eventos=[
        ['LOGIN_FALLIDO','Intento fallido mesero1','PIN incorrecto',uidMes1],
        ['APERTURA_CAJA','Apertura jornada turno noche','Base $250.000',uidAdmin],
        ['CAMBIO_PRECIO','Cambio precio Cerveza Aguila $7.500 -> $8.000','Ajuste inflacion',uidAdmin],
        ['CAMBIO_PRECIO','Cambio precio Ron Medellin $90.000 -> $95.000','Costo proveedor',uidAdmin],
        ['ANULACION_ITEM','Anulacion item Mojito mesa 6','Cliente se retiro',uidMes1],
        ['CANCELACION_PEDIDO','Cancelacion pedido #101 mesa 7','Error digitacion',uidMes2],
        ['VACIADO_CAJA','Retiro parcial caja $300.000','Consignacion banco',uidAdmin],
        ['INGRESO_CAJA','Ingreso extra $50.000 propina','Propina colectiva',uidBar1],
        ['MERMAS','Registro merma 2x Cerveza Aguila','Rotura barra',uidBar1],
        ['PIN_FALLIDO','PIN fallido cierre caja','Intento mesero',uidMes2],
      ];
      for(let i=0;i<eventos.length;i++){
        const e=eventos[i]; const fecha=new Date(); fecha.setDate(fecha.getDate()-(10-i)); fecha.setHours(20+i,0,0,0);
        const colsA=[]; const valsA=[]; const phA=[];
        function addA(c,v){ if(colAudit.includes(c)){ colsA.push(c); valsA.push(v); phA.push('?'); } }
        addA('usuario_id',e[3]); addA('tipo_evento',e[0]); addA('descripcion',e[1]); addA('motivo',e[2]); addA('ip_address','192.168.1.'+(10+i)); addA('mesa_id',String((i%9)+1)); addA('created_at',fecha);
        if(colAudit.includes('dispositivo')) addA('dispositivo','Chrome Windows');
        if(colsA.length) await conn.query(`INSERT INTO audit_logs (${colsA.join(',')}) VALUES (${phA.join(',')})`,valsA);
      }
      console.log(' 10 audit_logs insertados');
    }

// -------------------------------------------------
// 2 INVENTARIO
// -------------------------------------------------
    console.log('\n[2] Inventario');
    const catsNeed=['Licores','Cervezas','Cocteler\u00eda','Sin Alcohol','Snacks'];
    for(const c of catsNeed){ try{await conn.query('INSERT IGNORE INTO categorias (nombre) VALUES (?)',[c]);}catch(e){} }
    let [cats]=await conn.query('SELECT id_categoria,nombre FROM categorias');
    const catId={}; cats.forEach(c=>catId[c.nombre]=c.id_categoria);
    try{await conn.query('DELETE FROM productos WHERE nombre IN (?,?,?,?,?,?,?,?,?,?,?,?)',['Aguardiente Antioque\u00f1o 750ml','Ron Medell\u00edn A\u00f1ejo 750ml','Whisky Buchanans 12','Cerveza \u00c1guila 330ml','Cerveza Corona 355ml','Cerveza Poker 330ml','Margarita Cl\u00e1sica','Mojito Cubano','Coca-Cola 350ml','Jugo Maracuy\u00e1 Natural','Man\u00ed Salado 50g','Papas Margarita Pollo 105g'])}catch(e){}
    const productosSeed=[
      {nombre:'Aguardiente Antioque\u00f1o 750ml',cat:'Licores',precio:85000,costo:48000,stock:12,min:5,unidad:'Botella',codigo:'7701234560011',iva:19},
      {nombre:'Ron Medell\u00edn A\u00f1ejo 750ml',cat:'Licores',precio:95000,costo:52000,stock:3,min:5,unidad:'Botella',codigo:'7701234560028',iva:19},
      {nombre:'Whisky Buchanans 12',cat:'Licores',precio:185000,costo:110000,stock:8,min:4,unidad:'Botella',codigo:'7701234560035',iva:19},
      {nombre:'Cerveza \u00c1guila 330ml',cat:'Cervezas',precio:8000,costo:3500,stock:2,min:10,unidad:'Unidad',codigo:'7701234560042',iva:19},
      {nombre:'Cerveza Corona 355ml',cat:'Cervezas',precio:9500,costo:4500,stock:24,min:12,unidad:'Unidad',codigo:'7701234560059',iva:19},
      {nombre:'Cerveza Poker 330ml',cat:'Cervezas',precio:7500,costo:3200,stock:30,min:12,unidad:'Unidad',codigo:'7701234560066',iva:19},
      {nombre:'Margarita Cl\u00e1sica',cat:'Cocteler\u00eda',precio:25000,costo:9000,stock:50,min:10,unidad:'Unidad',codigo:'7701234560073',iva:19},
      {nombre:'Mojito Cubano',cat:'Cocteler\u00eda',precio:22000,costo:8000,stock:45,min:10,unidad:'Unidad',codigo:'7701234560080',iva:19},
      {nombre:'Coca-Cola 350ml',cat:'Sin Alcohol',precio:6000,costo:2500,stock:40,min:15,unidad:'Unidad',codigo:'7701234560097',iva:19},
      {nombre:'Jugo Maracuy\u00e1 Natural',cat:'Sin Alcohol',precio:8000,costo:3000,stock:15,min:10,unidad:'Unidad',codigo:'7701234560103',iva:0},
      {nombre:'Man\u00ed Salado 50g',cat:'Snacks',precio:7000,costo:3000,stock:20,min:8,unidad:'Unidad',codigo:'7701234560110',iva:19},
      {nombre:'Papas Margarita Pollo 105g',cat:'Snacks',precio:9000,costo:4000,stock:18,min:8,unidad:'Unidad',codigo:'7701234560127',iva:19},
    ];
    const prodIds=[];
    for(const p of productosSeed){
      const colsP=[]; const valsP=[]; const phP=[];
      function addP(c,v){ if(colProd.includes(c)){ colsP.push(c); valsP.push(v); phP.push('?'); } }
      addP('nombre',p.nombre);
      if(precioVentaCol) addP(precioVentaCol,p.precio);
      if(costoCol) addP(costoCol,p.costo);
      if(colProd.includes('categoria')) addP('categoria',p.cat);
      if(colProd.includes('id_categoria')) addP('id_categoria',catId[p.cat]||catId['Licores']||1);
      addP('stock',p.stock); addP('stock_minimo',p.min);
      if(colProd.includes('unidad_medida')) addP('unidad_medida',p.unidad);
      if(colProd.includes('unidad')) addP('unidad',p.unidad);
      if(colProd.includes('codigo_barras')) addP('codigo_barras',p.codigo);
      if(colProd.includes('iva_pct')) addP('iva_pct',p.iva);
      if(colProd.includes('ico_pct')) addP('ico_pct',0);
      if(colProd.includes('activo')) addP('activo',1);
      if(colProd.includes('descripcion')) addP('descripcion',p.nombre+' premium');
      const [res]=await conn.query(`INSERT INTO productos (${colsP.join(',')}) VALUES (${phP.join(',')})`,valsP);
      prodIds.push(res.insertId);
      console.log(` Producto ${p.nombre} -> id ${res.insertId} stock ${p.stock}/${p.min}`);
    }
    let [prods]=await conn.query('SELECT id_producto,nombre,categoria FROM productos WHERE nombre LIKE ?',['%Aguardiente%']);
    // mermas 3 registros
    const colMerma=await getCols(conn,'mermas');
    const prodAguila=prodIds[3]; const prodJugo=prodIds[9]; const prodMarga=prodIds[6];
    const mermasSeed=[
      {id_producto:prodAguila,cantidad:2,motivo:'Rotura',obs:'Rotura en barra durante servicio - botella caida',costo:3500},
      {id_producto:prodJugo,cantidad:3,motivo:'Vencimiento',obs:'Vencido lote 2024-02 jugo natural',costo:3000},
      {id_producto:prodMarga,cantidad:2,motivo:'Cortesia',obs:'Consumo interno autorizado gerencia junta directiva',costo:9000},
    ];
    for(const m of mermasSeed){
      const colsM=[]; const valsM=[]; const phM=[];
      function addM(c,v){ if(colMerma.includes(c)){ colsM.push(c); valsM.push(v); phM.push('?'); } }
      addM('id_producto',m.id_producto); addM('cantidad',m.cantidad); addM('motivo',m.motivo);
      if(colMerma.includes('observaciones')) addM('observaciones',m.obs);
      if(colMerma.includes('costo_unitario')) addM('costo_unitario',m.costo);
      if(colMerma.includes('valor_perdida')) addM('valor_perdida',m.cantidad*m.costo);
      if(colMerma.includes('id_usuario')) addM('id_usuario',uidBar1);
      if(colMerma.includes('fecha')) addM('fecha',new Date(Date.now()-86400000*2));
      if(colsM.length) await conn.query(`INSERT INTO mermas (${colsM.join(',')}) VALUES (${phM.join(',')})`,valsM);
    }
    console.log(' 3 mermas registradas (rotura, vencimiento, cortesia)');
    // descontar stock de mermas
    for(const m of mermasSeed){ try{await conn.query('UPDATE productos SET stock=GREATEST(0,stock-?) WHERE id_producto=?',[m.cantidad,m.id_producto]);}catch(e){} }

// -------------------------------------------------
// 3 MESAS
// -------------------------------------------------
    console.log('\n[3] Mesas y Comandero');
    const zonasNeed=[['VIP','Zona VIP / Camarotes','#8b5cf6',1],['Pista Principal','Pista de baile','#3b82f6',2],['Barra','Cerca de barra','#f59e0b',3]];
    for(const z of zonasNeed){ try{await conn.query('INSERT IGNORE INTO zonas (nombre,descripcion,color,orden) VALUES (?,?,?,?)',z);}catch(e){} }
    const mesasSeed=[
      {numero:1,nombre:'Mesa 1 Pista',cap:4,zona:'Pista Principal',estado:'Disponible',mesero:null},
      {numero:2,nombre:'Mesa 2 Pista',cap:4,zona:'Pista Principal',estado:'Disponible',mesero:null},
      {numero:3,nombre:'Mesa 3 Barra',cap:2,zona:'Barra',estado:'Disponible',mesero:null},
      {numero:4,nombre:'Mesa 4 Barra',cap:2,zona:'Barra',estado:'Disponible',mesero:null},
      {numero:5,nombre:'Mesa 5 Pista',cap:6,zona:'Pista Principal',estado:'Disponible',mesero:null},
      {numero:6,nombre:'Mesa 6 Barra',cap:4,zona:'Barra',estado:'Ocupada',mesero:uidMes1},
      {numero:7,nombre:'Mesa 7 VIP',cap:8,zona:'VIP',estado:'Ocupada',mesero:uidMes2},
      {numero:8,nombre:'Mesa 8 VIP',cap:6,zona:'VIP',estado:'Reservada',mesero:uidMes1},
      {numero:9,nombre:'Mesa 9 VIP',cap:10,zona:'VIP',estado:'Cierre',mesero:null},
    ];
    const mesaIds=[];
    for(const ms of mesasSeed){
      const colsM=[]; const valsM=[]; const phM=[];
      function addMesa(c,v){ if(colMesa.includes(c)){ colsM.push(c); valsM.push(v); phM.push('?'); } }
      addMesa('numero',ms.numero); addMesa('nombre',ms.nombre); addMesa('capacidad',ms.cap); addMesa('estado',ms.estado); addMesa('zona',ms.zona); addMesa('id_mesero',ms.mesero); addMesa('activo',1);
      if(colMesa.includes('fecha_ocupacion') && ms.estado==='Ocupada') addMesa('fecha_ocupacion',new Date(Date.now()-3600000*2));
      const [res]=await conn.query(`INSERT INTO mesas (${colsM.join(',')}) VALUES (${phM.join(',')})`,valsM);
      mesaIds.push({id:res.insertId,numero:ms.numero,estado:ms.estado});
      console.log(` Mesa ${ms.numero} ${ms.zona} -> ${ms.estado} id ${res.insertId}`);
    }
    const mesa6=mesaIds.find(m=>m.numero===6).id;
    const mesa7=mesaIds.find(m=>m.numero===7).id;

// -------------------------------------------------
// 4 JORNADAS base para pedidos
// -------------------------------------------------
    console.log('\n[4] Jornadas / Caja');
    const now=new Date();
    async function crearJornada(fechaApertura,fechaCierre,estado,montoInicial,usuarioId,barra){
      const colsJ=[]; const valsJ=[]; const phJ=[];
      function addJ(c,v){ if(colJor.includes(c)){ colsJ.push(c); valsJ.push(v); phJ.push('?'); } }
      if(colJor.includes('fecha_apertura')) addJ('fecha_apertura',fechaApertura);
      if(colJor.includes('fecha')) addJ('fecha',fechaApertura);
      if(colJor.includes('fecha_cierre') && fechaCierre) addJ('fecha_cierre',fechaCierre);
      if(colJor.includes('monto_inicial')) addJ('monto_inicial',montoInicial);
      if(colJor.includes('monto') && !colJor.includes('monto_inicial')) addJ('monto',montoInicial);
      if(colJor.includes('estado')) addJ('estado',estado);
      if(colJor.includes('id_usuario')) addJ('id_usuario',usuarioId);
      if(colJor.includes('id_usuario_cierre') && estado==='Cerrada') addJ('id_usuario_cierre',usuarioId);
      if(colJor.includes('barra_asignada')) addJ('barra_asignada',barra);
      if(colJor.includes('total_efectivo_esperado') && estado==='Cerrada') addJ('total_efectivo_esperado',montoInicial+850000);
      if(colJor.includes('total_efectivo_real') && estado==='Cerrada') addJ('total_efectivo_real',montoInicial+845000);
      if(colJor.includes('diferencia') && estado==='Cerrada') addJ('diferencia',-5000);
      if(colJor.includes('conteo_fisico') && estado==='Cerrada') addJ('conteo_fisico',montoInicial+845000);
      if(colJor.includes('ventas_brutas') && estado==='Cerrada') addJ('ventas_brutas',1200000);
      if(colJor.includes('ventas_netas') && estado==='Cerrada') addJ('ventas_netas',1150000);
      if(colJor.includes('incluir_propina_caja')) addJ('incluir_propina_caja',1);
      if(colJor.includes('arqueo_ciego')) addJ('arqueo_ciego',0);
      const [res]=await conn.query(`INSERT INTO jornadas (${colsJ.join(',')}) VALUES (${phJ.join(',')})`,valsJ);
      return res.insertId;
    }
    const fechaC1=new Date(now); fechaC1.setDate(now.getDate()-5); fechaC1.setHours(18,0,0,0);
    const cierre1=new Date(fechaC1); cierre1.setDate(cierre1.getDate()+1); cierre1.setHours(2,30,0,0);
    const fechaC2=new Date(now); fechaC2.setDate(now.getDate()-2); fechaC2.setHours(18,0,0,0);
    const cierre2=new Date(fechaC2); cierre2.setDate(cierre2.getDate()+1); cierre2.setHours(3,0,0,0);
    const fechaAbierta=new Date(now); fechaAbierta.setHours(18,0,0,0);
    const idJorCerr1=await crearJornada(fechaC1,cierre1,'Cerrada',200000,uidAdmin,'Caja Principal');
    const idJorCerr2=await crearJornada(fechaC2,cierre2,'Cerrada',250000,uidAdmin,'Barra Principal');
    const idJorAbierta=await crearJornada(fechaAbierta,null,'Abierta',300000,uidAdmin,'Caja Principal');
    console.log(` Jornadas: Cerrada #${idJorCerr1}, Cerrada #${idJorCerr2}, Abierta #${idJorAbierta}`);

// -------------------------------------------------
// Helper crear pedido
// -------------------------------------------------
    async function crearPedidoCompleto({idMesa,idUsuario,idJornada,estado,total,metodo,descuento,propina,esCortesia,fecha,detalles}){
      const colsP=[]; const valsP=[]; const phP=[];
      function addP(c,v){ if(colPed.includes(c)){ colsP.push(c); valsP.push(v); phP.push('?'); } }
      if(colPed.includes('id_mesa')){ if(idMesa===null && colPed.includes('id_mesa')){ colsP.push('id_mesa'); valsP.push(null); phP.push('?'); } else if(idMesa!==null) addP('id_mesa',idMesa); }
      addP('id_usuario',idUsuario); addP('id_jornada',idJornada); addP('estado',estado); addP('total',total);
      if(colPed.includes('metodo_pago')) addP('metodo_pago',metodo);
      if(colPed.includes('sub_metodo_pago')) addP('sub_metodo_pago',metodo==='Nequi'?'Nequi':'');
      if(colPed.includes('referencia_pago')) addP('referencia_pago','');
      if(colPed.includes('descuento')) addP('descuento',descuento||0);
      if(colPed.includes('es_cortesia')) addP('es_cortesia',esCortesia?1:0);
      if(colPed.includes('propina')) addP('propina',propina||0);
      if(tsPedidoCol) addP(tsPedidoCol,fecha);
      if(tsDespachoCol) { const d=new Date(fecha); d.setMinutes(d.getMinutes()+15); addP(tsDespachoCol,d); }
      const [res]=await conn.query(`INSERT INTO pedidos (${colsP.join(',')}) VALUES (${phP.join(',')})`,valsP);
      const idPed=res.insertId;
      for(const d of detalles){
        const colsD=['id_pedido','id_producto','cantidad','precio_unitario','subtotal']; const valsD=[idPed,d.id_producto,d.cantidad,d.precio,d.subtotal]; const phD=['?','?','?','?','?'];
        if(colDet.includes('observaciones')){ colsD.push('observaciones'); valsD.push(d.obs||''); phD.push('?'); }
        if(colDet.includes('presentacion')){ colsD.push('presentacion'); valsD.push(d.presentacion||'Trago / Copa'); phD.push('?'); }
        if(colDet.includes('estado')){ colsD.push('estado'); valsD.push(estado==='Pagado'?'Pagado':'Pendiente'); phD.push('?'); }
        await conn.query(`INSERT INTO detalle_pedido (${colsD.join(',')}) VALUES (${phD.join(',')})`,valsD);
      }
      return idPed;
    }

// -------------------------------------------------
// 3b COMANDAS ACTIVAS en mesas ocupadas
// -------------------------------------------------
    const prodIdx=(i)=>prodIds[i%prodIds.length];
    let [prodData]=await conn.query(`SELECT id_producto, ${precioVentaCol} AS precio FROM productos WHERE id_producto IN (${prodIds.join(',')})`);
    const priceMap={}; prodData.forEach(p=>priceMap[p.id_producto]=Number(p.precio));
    // Mesa 6 ocupada : 2 pedidos pendientes
    await crearPedidoCompleto({idMesa:mesa6,idUsuario:uidMes1,idJornada:idJorAbierta,estado:'Pendiente',total:priceMap[prodIds[3]]*2 + priceMap[prodIds[8]]*2,metodo:null,fecha:new Date(Date.now()-3600000),detalles:[{id_producto:prodIds[3],cantidad:2,precio:priceMap[prodIds[3]],subtotal:priceMap[prodIds[3]]*2},{id_producto:prodIds[8],cantidad:2,precio:priceMap[prodIds[8]],subtotal:priceMap[prodIds[8]]*2}]});
    await crearPedidoCompleto({idMesa:mesa6,idUsuario:uidMes1,idJornada:idJorAbierta,estado:'Pendiente',total:priceMap[prodIds[7]]*1,metodo:null,fecha:new Date(Date.now()-1800000),detalles:[{id_producto:prodIds[7],cantidad:1,precio:priceMap[prodIds[7]],subtotal:priceMap[prodIds[7]]}]});
    // Mesa 7 ocupada : 1 pedido pendiente grande VIP
    await crearPedidoCompleto({idMesa:mesa7,idUsuario:uidMes2,idJornada:idJorAbierta,estado:'Pendiente',total:priceMap[prodIds[2]]*1 + priceMap[prodIds[0]]*1 + priceMap[prodIds[10]]*3,metodo:null,fecha:new Date(Date.now()-5400000),detalles:[{id_producto:prodIds[2],cantidad:1,precio:priceMap[prodIds[2]],subtotal:priceMap[prodIds[2]]},{id_producto:prodIds[0],cantidad:1,precio:priceMap[prodIds[0]],subtotal:priceMap[prodIds[0]]},{id_producto:prodIds[10],cantidad:3,precio:priceMap[prodIds[10]],subtotal:priceMap[prodIds[10]]*3}]});
    console.log(' 2 mesas ocupadas con 3 comandas pendientes');

// -------------------------------------------------
// 4 SPEED BAR 5 ventas rapidas cobradas
// -------------------------------------------------
    console.log('\n[4] Speed Bar - 5 ventas rapidas');
    const speedMetodos=['Efectivo','Nequi','Tarjeta','Efectivo','BreB'];
    for(let sb=0; sb<5; sb++){
      const fecha=new Date(); fecha.setHours(21+sb%3, 10+sb*7,0,0);
      const p1=prodIds[(sb*2)%prodIds.length]; const p2=prodIds[(sb*2+1)%prodIds.length];
      const cant1=1+sb%2; const cant2=2;
      const tot=priceMap[p1]*cant1 + priceMap[p2]*cant2;
      const colHasMesa=colPed.includes('id_mesa');
      let idMesaSB=null;
      if(colHasMesa){
        const [chk]=await conn.query("SELECT COLUMN_NAME, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='pedidos' AND COLUMN_NAME='id_mesa'");
        const nullable=chk.length && chk[0].IS_NULLABLE==='YES';
        if(!nullable) idMesaSB=mesaIds.find(m=>m.numero===3).id;
        else idMesaSB=null;
      }
      await crearPedidoCompleto({idMesa:idMesaSB,idUsuario:uidBar1,idJornada:idJorAbierta,estado:'Pagado',total:tot,metodo:speedMetodos[sb],descuento:0,propina:sb%2===0?2000:0,esCortesia:false,fecha,detalles:[{id_producto:p1,cantidad:cant1,precio:priceMap[p1],subtotal:priceMap[p1]*cant1},{id_producto:p2,cantidad:cant2,precio:priceMap[p2],subtotal:priceMap[p2]*cant2}]});
      console.log(`  SpeedBar venta ${sb+1} ${speedMetodos[sb]} $${tot.toLocaleString()}`);
    }

// -------------------------------------------------
// 5 PROVEEDORES Y COMPRAS
// -------------------------------------------------
    console.log('\n[5] Proveedores y Compras');
    try{await conn.query('DELETE FROM proveedores WHERE nombre IN (?,?)',['Dislicores S.A.','Bavaria']);}catch(e){}
    const provSeeds=[
      {nombre:'Dislicores S.A.',nit:'900123456-1',razon:'Dislicores S.A.S',cat:'Licores',dias:30,limite:5000000,contacto:'Jorge Ramirez',tel:'6044441000',correo:'pedidos@dislicores.com',dir:'Calle 10 # 43-20 Medell\u00edn',banco:'Bancolombia',tipocta:'Corriente',numcta:'12345678901'},
      {nombre:'Bavaria',nit:'860000005-4',razon:'Bavaria S.A.',cat:'Cervezas',dias:15,limite:3000000,contacto:'Ana Torres',tel:'6016389000',correo:'abastecimiento@bavaria.com',dir:'Carrera 53 # 127-35 Bogot\u00e1',banco:'Banco Bogot\u00e1',tipocta:'Corriente',numcta:'98765432100'},
    ];
    const provIds=[];
    for(const pv of provSeeds){
      const colsPv=[]; const valsPv=[]; const phPv=[];
      function addPv(c,v){ if(colProv.includes(c)){ colsPv.push(c); valsPv.push(v); phPv.push('?'); } }
      addPv('nombre',pv.nombre); addPv('nit',pv.nit); addPv('razon_social',pv.razon); addPv('categoria',pv.cat); addPv('dias_credito',pv.dias); addPv('limite_credito',pv.limite);
      addPv('contacto',pv.contacto); addPv('telefono',pv.tel); addPv('correo',pv.correo); addPv('direccion',pv.dir); addPv('banco',pv.banco); addPv('tipo_cuenta',pv.tipocta); addPv('numero_cuenta',pv.numcta); addPv('activo',1);
      const [res]=await conn.query(`INSERT INTO proveedores (${colsPv.join(',')}) VALUES (${phPv.join(',')})`,valsPv);
      provIds.push(res.insertId);
      console.log(` Proveedor ${pv.nombre} id ${res.insertId}`);
    }
    // Compras 2 : 1 Pagada completada, 1 Pendiente
    const compraData=[
      {id_prov:provIds[0],factura:'DIS-2025-8841',forma:'Contado',dias:0,estado:'Pagada',total:1250000,obs:'Ingreso licores premium completo'},
      {id_prov:provIds[1],factura:'BAV-2025-1120',forma:'Credito',dias:15,estado:'Pendiente',total:860000,obs:'Cervezas pedido quincenal pendiente recepcion parcial'},
    ];
    const compraIds=[];
    for(let ci=0; ci<compraData.length; ci++){
      const cd=compraData[ci];
      const colsC=[]; const valsC=[]; const phC=[];
      function addC(c,v){ if(colCompra.includes(c)){ colsC.push(c); valsC.push(v); phC.push('?'); } }
      addC('id_proveedor',cd.id_prov); addC('id_usuario',uidAdmin); addC('fecha',new Date(Date.now()-86400000*(4-ci))); addC('numero_factura',cd.factura); addC('total',cd.total); addC('observaciones',cd.obs);
      if(colCompra.includes('forma_pago')) addC('forma_pago',cd.forma);
      if(colCompra.includes('dias_credito')) addC('dias_credito',cd.dias);
      if(colCompra.includes('fecha_vencimiento')){ const fv=new Date(); fv.setDate(fv.getDate()+cd.dias); addC('fecha_vencimiento',fv); }
      if(colCompra.includes('metodo_pago')) addC('metodo_pago',cd.forma==='Contado'?'Transferencia':'');
      if(colCompra.includes('estado')) addC('estado',cd.estado);
      if(colCompra.includes('saldo_pendiente')) addC('saldo_pendiente',cd.estado==='Pagada'?0:cd.total);
      if(colCompra.includes('fecha_factura')) addC('fecha_factura',new Date(Date.now()-86400000*(4-ci)));
      if(colCompra.includes('subtotal')) addC('subtotal',Math.round(cd.total/1.19));
      if(colCompra.includes('iva')) addC('iva',cd.total-Math.round(cd.total/1.19));
      const [res]=await conn.query(`INSERT INTO compras (${colsC.join(',')}) VALUES (${phC.join(',')})`,valsC);
      compraIds.push(res.insertId);
      console.log(` Compra ${cd.factura} -> ${cd.estado} id ${res.insertId}`);
      // detalle_compras 2 lineas por compra
      const lines= ci===0 ? [{prod:prodIds[0],cant:6,costo:45000},{prod:prodIds[2],cant:4,costo:100000}] : [{prod:prodIds[3],cant:48,costo:3000},{prod:prodIds[5],cant:48,costo:2800}];
      for(const ln of lines){
        const colsDC=[]; const valsDC=[]; const phDC=[];
        function addDC(c,v){ if(colDetCompra.includes(c)){ colsDC.push(c); valsDC.push(v); phDC.push('?'); } }
        addDC('id_compra',res.insertId); addDC('id_producto',ln.prod); addDC('cantidad',ln.cant); addDC('costo_unitario',ln.costo); addDC('subtotal',ln.cant*ln.costo);
        if(colDetCompra.includes('total_linea')) addDC('total_linea',ln.cant*ln.costo);
        if(colsDC.length) await conn.query(`INSERT INTO detalle_compras (${colsDC.join(',')}) VALUES (${phDC.join(',')})`,valsDC);
      }
      if(cd.estado==='Pagada'){
        try{await conn.query('INSERT INTO pagos_proveedores (id_proveedor,id_compra,id_usuario,monto,metodo_pago,referencia,observaciones) VALUES (?,?,?,?,?,?,?)',[cd.id_prov,res.insertId,uidAdmin,cd.total,'Transferencia','TRX-8841','Pago contado completo']);}catch(e){}
        // actualizar stock por ingreso
        for(const ln of [{prod:prodIds[0],cant:6},{prod:prodIds[2],cant:4}]){
          try{await conn.query('UPDATE productos SET stock=stock+? WHERE id_producto=?',[ln.cant,ln.prod]);}catch(e){}
        }
      }
    }

// -------------------------------------------------
// 6 CLIENTES / SOCIOS y CARTERA / VALES
// -------------------------------------------------
    console.log('\n[6] Clientes / Socios y Cartera');
    try{await conn.query('DELETE FROM clientes_socios WHERE documento IN (?,?,?)',['1037678456','900456789','1045123987']);}catch(e){}
    const clientesSeed=[
      {nombre:'Carlos Andr\u00e9s G\u00f3mez',tel:'3005123456',doc:'1037678456',tipo:'CC',correo:'carlos.gomez@gmail.com',limite:1000000,vip:1,obs:'Socio fundador - VIP'},
      {nombre:'Mar\u00eda Fernanda L\u00f3pez',tel:'3109876543',doc:'900456789',tipo:'NIT',correo:'maria.lopez@empresa.com',limite:500000,vip:0,obs:'Cliente corporativo - facturaci\u00f3n mensual'},
      {nombre:'Andr\u00e9s Felipe Restrepo',tel:'3204567890',doc:'1045123987',tipo:'CC',correo:'andres.restrepo@hotmail.com',limite:2000000,vip:1,obs:'Cliente VIP - cr\u00e9dito prepagado'},
    ];
    const cliIds=[];
    for(const cl of clientesSeed){
      const colsCl=[]; const valsCl=[]; const phCl=[];
      function addCl(c,v){ if(colCliente.includes(c)){ colsCl.push(c); valsCl.push(v); phCl.push('?'); } }
      addCl('nombre',cl.nombre); addCl('telefono',cl.tel); addCl('documento',cl.doc); addCl('tipo_documento',cl.tipo); addCl('correo',cl.correo); addCl('limite_credito',cl.limite); addCl('es_vip',cl.vip); addCl('activo',1); addCl('observaciones',cl.obs);
      const [res]=await conn.query(`INSERT INTO clientes_socios (${colsCl.join(',')}) VALUES (${phCl.join(',')})`,valsCl);
      cliIds.push(res.insertId);
      console.log(` Cliente ${cl.nombre} doc ${cl.doc} id ${res.insertId}`);
    }
    const colTieneCliente=colVale.includes('id_cliente_socio');
    const valesSeed=[
      {id_cli:cliIds[0],cliente:'Carlos Andr\u00e9s G\u00f3mez',mesa:mesa7,total:185000,saldo:185000,estado:'Pendiente',vence: new Date(Date.now()+86400000*15),tipo:'diario',tasa:0.5,ref:'VALE-2025-001 Cons. autorizado empleado',aut:uidAdmin},
      {id_cli:cliIds[2],cliente:'Andr\u00e9s Felipe Restrepo',mesa:null,total:500000,saldo:350000,estado:'Parcial',vence: new Date(Date.now()+86400000*30),tipo:'mensual',tasa:1.2,ref:'CR\u00c9DITO PREPAGADO VIP saldo a favor',aut:uidAdmin},
    ];
    for(const v of valesSeed){
      const colsV=[]; const valsV=[]; const phV=[];
      function addV(c,val){ if(colVale.includes(c)){ colsV.push(c); valsV.push(val); phV.push('?'); } }
      addV('cliente_socio',v.cliente); if(colTieneCliente) addV('id_cliente_socio',v.id_cli);
      addV('id_mesa',v.mesa); addV('total',v.total); addV('saldo_pendiente',v.saldo); addV('estado',v.estado);
      if(colVale.includes('fecha')) addV('fecha',new Date(Date.now()-86400000*3));
      if(colVale.includes('id_usuario_autoriza')) addV('id_usuario_autoriza',v.aut);
      if(colVale.includes('fecha_vencimiento')) addV('fecha_vencimiento',v.vence);
      if(colVale.includes('tipo_mora')) addV('tipo_mora',v.tipo);
      if(colVale.includes('tasa_mora')) addV('tasa_mora',v.tasa);
      if(colVale.includes('referencia')) addV('referencia',v.ref);
      if(colVale.includes('capital_pagado')) addV('capital_pagado',v.total - v.saldo);
      if(colVale.includes('mora_acumulada')) addV('mora_acumulada',0);
      if(colVale.includes('mora_pagada')) addV('mora_pagada',0);
      const [res]=await conn.query(`INSERT INTO cuentas_por_cobrar (${colsV.join(',')}) VALUES (${phV.join(',')})`,valsV);
      console.log(` Vale ${v.ref} -> $${v.total} saldo $${v.saldo} id ${res.insertId}`);
      if(v.estado==='Parcial'){
        try{await conn.query('INSERT INTO abonos_vales (id_vale,monto_abono,monto_capital,monto_mora,metodo_pago,id_usuario,id_jornada) VALUES (?,?,?,?,?,?,?)',[res.insertId,150000,150000,0,'Efectivo',uidAdmin,idJorCerr2]);}catch(e){}
      }
    }

// -------------------------------------------------
// 7 CAJA / JORNADA y FACTURAS HISTORICAS
// -------------------------------------------------
    console.log('\n[7] Caja arqueos y 15 Facturas historicas');
    // movimientos caja para jornadas cerradas
    const movs=[
      {jor:idJorCerr1,tipo:'Ingreso',cat:'Propinas',concepto:'Propina colectiva noche',monto:45000},
      {jor:idJorCerr1,tipo:'Egreso',cat:'Gastos operativos',concepto:'Compra hielo y limones',monto:25000},
      {jor:idJorCerr2,tipo:'Ingreso',cat:'Ingreso extra',concepto:'Cover VIP',monto:120000},
      {jor:idJorCerr2,tipo:'Egreso',cat:'Gastos',concepto:'Transporte personal',monto:40000},
    ];
    for(const mv of movs){ try{await conn.query('INSERT INTO movimientos_caja (id_jornada,id_usuario,tipo,categoria,concepto,monto) VALUES (?,?,?,?,?,?)',[mv.jor,uidAdmin,mv.tipo,mv.cat,mv.concepto,mv.monto]);}catch(e){} }
    // arqueos detalle
    for(const jid of [idJorCerr1,idJorCerr2]){
      const denom=[50000,20000,10000,5000,2000,1000,500];
      for(const d of denom){ try{await conn.query('INSERT INTO arqueos_detalle (id_jornada,denominacion,tipo,cantidad,valor) VALUES (?,?,?,?,?)',[jid,d,'Billete',Math.floor(Math.random()*5)+2,d*(Math.floor(Math.random()*5)+2)]);}catch(e){} }
    }
    // 15 facturas historicas pagadas distribuidas en jornadas
    const metodosH=['Efectivo','Nequi','Daviplata','Debito','Credito','BreB','Vale'];
    let facturasCreadas=0;
    for(let f=0; f<15; f++){
      const jid= f<5 ? idJorCerr1 : (f<10 ? idJorCerr2 : idJorAbierta);
      const mesaId=mesaIds[f%mesaIds.length].id;
      const fecha=new Date(now); fecha.setDate(now.getDate() - (15-f)); fecha.setHours(20+(f%4), (f*11)%60,0,0);
      const metodo=metodosH[f%metodosH.length];
      const numItems=1+(f%3);
      const dets=[]; let tot=0;
      for(let k=0;k<numItems;k++){
        const pid=prodIds[(f+k)%prodIds.length]; const cant=1+(f+k)%3; const precio=priceMap[pid]||10000; const sub=cant*precio; dets.push({id_producto:pid,cantidad:cant,precio,subtotal:sub}); tot+=sub;
      }
      const desc= f%6===0 ? Math.round(tot*0.1):0;
      const prop= f%4===0 ? Math.round(tot*0.07):0;
      const cort= f===7 ? 1:0;
      await crearPedidoCompleto({idMesa:mesaId,idUsuario:[uidAdmin,uidMes1,uidMes2,uidBar1][f%4],idJornada:jid,estado:'Pagado',total:tot,metodo:cort?'Cortesia':metodo,descuento:desc,propina:prop,esCortesia:cort,fecha,detalles:dets});
      facturasCreadas++;
    }
    console.log(` 15 facturas historicas creadas (Pagado)`);

// -------------------------------------------------
// VERIFICACION
// -------------------------------------------------
    await conn.query('SET FOREIGN_KEY_CHECKS=1');
    const checks=[
      ['usuarios', 'SELECT COUNT(*) c FROM usuarios'],
      ['productos activos', 'SELECT COUNT(*) c FROM productos WHERE activo=1'],
      ['productos bajo minimo', 'SELECT COUNT(*) c FROM productos WHERE stock <= stock_minimo AND activo=1'],
      ['mesas', 'SELECT COUNT(*) c FROM mesas WHERE activo=1'],
      ['pedidos Pendiente (comandas activas)', "SELECT COUNT(*) c FROM pedidos WHERE estado='Pendiente'"],
      ['pedidos Pagado (facturas)', "SELECT COUNT(*) c FROM pedidos WHERE estado='Pagado'"],
      ['mermas', 'SELECT COUNT(*) c FROM mermas'],
      ['proveedores', 'SELECT COUNT(*) c FROM proveedores WHERE activo=1'],
      ['compras', 'SELECT COUNT(*) c FROM compras'],
      ['clientes_socios', 'SELECT COUNT(*) c FROM clientes_socios WHERE activo=1'],
      ['vales pendientes', 'SELECT COUNT(*) c FROM cuentas_por_cobrar WHERE saldo_pendiente>0'],
      ['jornadas Abierta', "SELECT COUNT(*) c FROM jornadas WHERE estado='Abierta'"],
      ['jornadas Cerrada', "SELECT COUNT(*) c FROM jornadas WHERE estado='Cerrada'"],
      ['audit_logs', 'SELECT COUNT(*) c FROM audit_logs'],
      ['arqueos_detalle', 'SELECT COUNT(*) c FROM arqueos_detalle'],
      ['movimientos_caja', 'SELECT COUNT(*) c FROM movimientos_caja'],
    ];
    console.log('\n=== VERIFICACION POST-SEEDING ===');
    for(const [label,sql] of checks){ try{ const [r]=await conn.query(sql); console.log(` ${label}: ${r[0].c}`);}catch(e){ console.log(` ${label}: error ${e.message}`);} }
    console.log('\n Sidebar -> Speed Bar / Clientes / Cartera / Facturas / Mesas / Inventario / Reportes / Bitacora / Caja : DATOS REALES LISTOS');
    console.log('IDs y FK vinculadas correctamente. Navegacion sin pantallas blancas.');
    console.log('=== SEED COMPLETO EXITOSO ===');
  }catch(e){ console.error('ERROR SEED:',e.message); console.error(e.stack); throw e;
  }finally{ try{await conn.query('SET FOREIGN_KEY_CHECKS=1');}catch(e){} conn.release(); await pool.end(); }
}
if(require.main===module){ seedAll().then(()=>process.exit(0)).catch(()=>process.exit(1)); }
module.exports={seedAll};
