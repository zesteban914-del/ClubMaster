const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { pool } = require('../config/database');

async function getColumnList(conn, tabla) {
    const [cols] = await conn.query(`SHOW COLUMNS FROM \`${tabla}\``);
    return cols.map(c => c.Field);
}

async function seedVentas() {
    const conn = await pool.getConnection();
    try {
        console.log('=== SEED VENTAS PRUEBA ===');

        const colProd = await getColumnList(conn, 'productos');
        const colPed = await getColumnList(conn, 'pedidos');
        const colJor = await getColumnList(conn, 'jornadas');
        const colAudit = await getColumnList(conn, 'audit_logs').catch(() => []);
        const hasTimestampPedido = colPed.includes('timestamp_pedido');
        const hasFechaPedido = colPed.includes('fecha_pedido');
        const colTsPedido = hasTimestampPedido ? 'timestamp_pedido' : (hasFechaPedido ? 'fecha_pedido' : null);
        const hasTimestampDespacho = colPed.includes('timestamp_despacho');
        const hasDescuento = colPed.includes('descuento');
        const hasPropina = colPed.includes('propina');
        const hasEsCortesia = colPed.includes('es_cortesia');
        const hasMetodo = colPed.includes('metodo_pago');
        const hasSubMetodo = colPed.includes('sub_metodo_pago');

        let [usuarios] = await conn.query('SELECT id_usuario, nombre FROM usuarios WHERE activo=1 ORDER BY id_usuario LIMIT 10');
        if (usuarios.length === 0) {
            console.log('No hay usuarios, usando ids 1..3');
            usuarios = [{ id_usuario: 1, nombre: 'Admin' }, { id_usuario: 2, nombre: 'Carlos' }, { id_usuario: 3, nombre: 'Laura' }];
        }

        let [mesas] = await conn.query('SELECT id_mesa, numero, zona FROM mesas WHERE activo=1 ORDER BY id_mesa LIMIT 20');
        if (mesas.length === 0) {
            console.log('Creando mesas de prueba...');
            const zonas = ['VIP', 'Barra', 'Pista Principal', 'Terraza'];
            for (let i = 0; i < 8; i++) {
                await conn.query('INSERT INTO mesas (numero, capacidad, estado, zona, activo) VALUES (?, ?, ?, ?, 1)', [i + 1, 4, 'Disponible', zonas[i % zonas.length]]);
            }
            [mesas] = await conn.query('SELECT id_mesa, numero, zona FROM mesas WHERE activo=1 ORDER BY id_mesa LIMIT 20');
        }

        let [productos] = await conn.query('SELECT id_producto, nombre, precio, precio_costo, stock, stock_minimo, categoria FROM productos WHERE activo=1 ORDER BY id_producto LIMIT 30');
        if (productos.length < 5) {
            console.log('Creando productos de prueba...');
            const cats = ['Cervezas', 'Licores', 'Whisky', 'Vodka', 'Cócteles'];
            for (let i = productos.length; i < 8; i++) {
                const precio = 8000 + i * 3000;
                const costo = Math.round(precio * 0.4);
                const cat = cats[i % cats.length];
                try {
                    if (colProd.includes('precio')) await conn.query('INSERT INTO productos (nombre, precio, precio_costo, stock, stock_minimo, categoria, activo) VALUES (?, ?, ?, ?, ?, ?, 1)', ['Producto Test ' + (i + 1), precio, costo, 50, 5, cat]);
                    else await conn.query('INSERT INTO productos (nombre, precio_venta, precio_costo, stock, stock_minimo, categoria, activo) VALUES (?, ?, ?, ?, ?, ?, 1)', ['Producto Test ' + (i + 1), precio, costo, 50, 5, cat]);
                } catch (e) { console.log('Crear producto error', e.message); }
            }
            [productos] = await conn.query('SELECT id_producto, nombre, precio, precio_costo, stock, stock_minimo FROM productos WHERE activo=1 ORDER BY id_producto LIMIT 30');
        }

        const precioCol = colProd.includes('precio') ? 'precio' : (colProd.includes('precio_venta') ? 'precio_venta' : 'precio');
        for (let i = 0; i < Math.min(5, productos.length); i++) {
            const p = productos[i];
            await conn.query(`UPDATE productos SET stock = 2, stock_minimo = 10 WHERE id_producto = ?`, [p.id_producto]);
            console.log(`Producto bajo minimo: #${p.id_producto} ${p.nombre} -> stock 2 / minimo 10`);
        }
        [productos] = await conn.query(`SELECT id_producto, nombre, ${precioCol} AS precio, precio_costo, stock, stock_minimo FROM productos WHERE activo=1 ORDER BY id_producto LIMIT 30`);

        const metodoPago = ['Efectivo', 'Nequi', 'Daviplata', 'Debito', 'Credito'];
        const zonasBarras = [...new Set(mesas.map(m => m.zona || 'VIP'))];
        if (zonasBarras.length === 0) zonasBarras.push('VIP', 'Barra');

        console.log(`Usuarios: ${usuarios.length}, Mesas: ${mesas.length}, Productos: ${productos.length}, Zonas: ${zonasBarras.join(', ')}`);

        const jornadasIds = [];
        const now = new Date();
        for (let j = 0; j < 3; j++) {
            const diasAtras = 5 + j * 9;
            const fechaApertura = new Date(now); fechaApertura.setDate(now.getDate() - diasAtras); fechaApertura.setHours(18, 0, 0, 0);
            const fechaCierre = new Date(fechaApertura); fechaCierre.setHours(2, 0, 0, 0); fechaCierre.setDate(fechaCierre.getDate() + 1);
            const barra = zonasBarras[j % zonasBarras.length] || 'Caja Principal';
            const montoInicial = 150000 + j * 50000;
            const idUsuario = usuarios[j % usuarios.length].id_usuario;
            const colsJ = [];
            const valsJ = [];
            const phJ = [];
            function addJ(col, val) { if (colJor.includes(col)) { colsJ.push(col); valsJ.push(val); phJ.push('?'); } }
            addJ('fecha_apertura', fechaApertura);
            addJ('fecha_cierre', fechaCierre);
            if (colJor.includes('fecha')) addJ('fecha', fechaApertura);
            addJ('monto_inicial', montoInicial);
            addJ('estado', 'Cerrada');
            addJ('id_usuario', idUsuario);
            if (colJor.includes('barra_asignada')) addJ('barra_asignada', barra);
            if (colJor.includes('total_efectivo_esperado')) addJ('total_efectivo_esperado', 800000 + j * 120000);
            if (colJor.includes('total_efectivo_real')) addJ('total_efectivo_real', 795000 + j * 120000);
            if (colJor.includes('diferencia')) addJ('diferencia', -5000);
            if (colJor.includes('ventas_brutas')) addJ('ventas_brutas', 1200000);
            if (colJor.includes('ventas_netas')) addJ('ventas_netas', 1150000);
            if (colJor.includes('incluir_propina_caja')) addJ('incluir_propina_caja', 1);
            if (colJor.includes('arqueo_ciego')) addJ('arqueo_ciego', 0);
            if (colsJ.length === 0) throw new Error('No hay columnas válidas para jornadas');
            const [res] = await conn.query(`INSERT INTO jornadas (${colsJ.join(', ')}) VALUES (${phJ.join(', ')})`, valsJ);
            jornadasIds.push(res.insertId);
            console.log(`Jornada #${res.insertId} creada: ${fechaApertura.toISOString().substring(0, 10)} -> ${barra} (Cerrada)`);
        }

        let ventasCreadas = 0;
        const totalVentas = 18;
        for (let v = 0; v < totalVentas; v++) {
            const jornadaId = jornadasIds[v % jornadasIds.length];
            const usuario = usuarios[v % usuarios.length];
            const mesa = mesas[v % mesas.length];
            const metodo = metodoPago[v % metodoPago.length];
            const diasOffset = Math.floor(v / 3) * 2 + (v % 3);
            const fechaBase = new Date(now); fechaBase.setDate(now.getDate() - diasOffset); fechaBase.setHours(20 + (v % 4), (v * 7) % 60, 0, 0);
            const numItems = 2 + (v % 2);
            const detalles = [];
            let total = 0;
            for (let k = 0; k < numItems; k++) {
                const prod = productos[(v + k) % productos.length];
                const cantidad = 1 + (k + v) % 3;
                const precio = Number(prod.precio) || 15000;
                const subtotal = cantidad * precio;
                detalles.push({ prod, cantidad, precio, subtotal });
                total += subtotal;
            }
            const descuento = (v % 5 === 0) ? Math.round(total * 0.1) : 0;
            const propina = (v % 4 === 0) ? Math.round(total * 0.08) : 0;
            const esCortesia = (v % 9 === 0) ? 1 : 0;
            const colsP = []; const valsP = []; const phP = [];
            function addP(col, val) { if (colPed.includes(col)) { colsP.push(col); valsP.push(val); phP.push('?'); } }
            addP('id_mesa', mesa.id_mesa);
            addP('id_usuario', usuario.id_usuario);
            addP('id_jornada', jornadaId);
            addP('estado', 'Pagado');
            addP('total', total);
            if (hasMetodo) addP('metodo_pago', esCortesia ? 'Cortesia' : metodo);
            if (hasSubMetodo) addP('sub_metodo_pago', metodo === 'Nequi' ? 'Nequi' : '');
            if (colPed.includes('referencia_pago')) addP('referencia_pago', '');
            if (hasDescuento) addP('descuento', descuento);
            if (hasEsCortesia) addP('es_cortesia', esCortesia);
            if (hasPropina) addP('propina', propina);
            if (colTsPedido) addP(colTsPedido, fechaBase);
            if (hasTimestampDespacho) { const fd = new Date(fechaBase); fd.setMinutes(fd.getMinutes() + 15); addP('timestamp_despacho', fd); }
            if (colPed.includes('timestamp_despacho') && !hasTimestampDespacho) {}
            const [resPed] = await conn.query(`INSERT INTO pedidos (${colsP.join(', ')}) VALUES (${phP.join(', ')})`, valsP);
            const idPedido = resPed.insertId;
            for (const d of detalles) {
                const colsD = ['id_pedido', 'id_producto', 'cantidad', 'precio_unitario', 'subtotal'];
                const valsD = [idPedido, d.prod.id_producto, d.cantidad, d.precio, d.subtotal];
                if ((await getColumnList(conn, 'detalle_pedido')).includes('observaciones')) { colsD.push('observaciones'); valsD.push(''); }
                if ((await getColumnList(conn, 'detalle_pedido')).includes('estado')) { colsD.push('estado'); valsD.push('Pagado'); }
                const phD = colsD.map(() => '?').join(', ');
                await conn.query(`INSERT INTO detalle_pedido (${colsD.join(', ')}) VALUES (${phD})`, valsD);
            }
            ventasCreadas++;
            console.log(`Venta #${idPedido} Pagado ${fechaBase.toISOString().substring(0, 16)} Jornada #${jornadaId} Mesa ${mesa.numero}(${mesa.zona}) Mesero ${usuario.nombre} Metodo ${metodo} Total $${total.toLocaleString()}`);
        }

        let anuladasCreadas = 0;
        for (let a = 0; a < 3; a++) {
            const jornadaId = jornadasIds[a % jornadasIds.length];
            const usuario = usuarios[a % usuarios.length];
            const mesa = mesas[a % mesas.length];
            const fechaBase = new Date(now); fechaBase.setDate(now.getDate() - a); fechaBase.setHours(19, 30, 0, 0);
            const prod = productos[a % productos.length];
            const total = Number(prod.precio) * 2;
            const colsP = []; const valsP = []; const phP = [];
            function addP2(col, val) { if (colPed.includes(col)) { colsP.push(col); valsP.push(val); phP.push('?'); } }
            addP2('id_mesa', mesa.id_mesa);
            addP2('id_usuario', usuario.id_usuario);
            addP2('id_jornada', jornadaId);
            addP2('estado', 'Cancelado');
            addP2('total', total);
            if (hasMetodo) addP2('metodo_pago', 'Efectivo');
            if (hasDescuento) addP2('descuento', 0);
            if (hasPropina) addP2('propina', 0);
            if (hasEsCortesia) addP2('es_cortesia', 0);
            if (colTsPedido) addP2(colTsPedido, fechaBase);
            if (hasTimestampDespacho) addP2('timestamp_despacho', fechaBase);
            const [resPed] = await conn.query(`INSERT INTO pedidos (${colsP.join(', ')}) VALUES (${phP.join(', ')})`, valsP);
            const idPedido = resPed.insertId;
            const colsD = ['id_pedido', 'id_producto', 'cantidad', 'precio_unitario', 'subtotal'];
            const valsD = [idPedido, prod.id_producto, 2, Number(prod.precio), total];
            const colDet = await getColumnList(conn, 'detalle_pedido');
            if (colDet.includes('observaciones')) { colsD.push('observaciones'); valsD.push('Anulado por prueba'); }
            if (colDet.includes('estado')) { colsD.push('estado'); valsD.push('Cancelado'); }
            await conn.query(`INSERT INTO detalle_pedido (${colsD.join(', ')}) VALUES (${colsD.map(() => '?').join(', ')})`, valsD);
            if (colAudit.length > 0) {
                try {
                    const motivo = ['Error de digitación', 'Cliente se retiró', 'Producto no disponible'][a % 3];
                    await conn.query(`INSERT INTO audit_logs (usuario_id, tipo_evento, descripcion, motivo, mesa_id, ip_address, created_at) VALUES (?, 'CANCELACION_PEDIDO', ?, ?, ?, '127.0.0.1', ?)`, [usuario.id_usuario, `Anulación pedido #${idPedido} - ${motivo}`, motivo, String(mesa.numero), fechaBase]);
                } catch (e) { console.log('audit insert error', e.message); }
            }
            anuladasCreadas++;
            console.log(`Venta anulada #${idPedido} Cancelado ${fechaBase.toISOString().substring(0, 10)} Motivo prueba`);
        }

        if (colAudit.length > 0) {
            try {
                await conn.query(`INSERT INTO audit_logs (usuario_id, tipo_evento, descripcion, motivo, mesa_id, ip_address, created_at) VALUES (?, 'ANULACION_ITEM', 'Anulación item prueba', 'Error digitación', '5', '127.0.0.1', NOW())`);
            } catch (e) {}
        }

        const [cntVentas] = await conn.query(`SELECT COUNT(*) AS c FROM pedidos WHERE estado='Pagado'`);
        const [cntAnul] = await conn.query(`SELECT COUNT(*) AS c FROM pedidos WHERE estado IN ('Cancelado','Anulado','Anulada')`);
        const [cntJor] = await conn.query(`SELECT COUNT(*) AS c FROM jornadas WHERE estado='Cerrada'`);
        const [bajoMin] = await conn.query(`SELECT COUNT(*) AS c FROM productos WHERE stock <= stock_minimo AND stock_minimo > 0 AND activo=1`);
        console.log('=== RESUMEN SEED ===');
        console.log(`Ventas cerradas (Pagado): ${cntVentas[0].c}`);
        console.log(`Ventas anuladas: ${cntAnul[0].c}`);
        console.log(`Jornadas cerradas: ${cntJor[0].c}`);
        console.log(`Productos bajo minimo: ${bajoMin[0].c}`);
        console.log(`Ventas creadas en esta corrida: ${ventasCreadas} + ${anuladasCreadas} anuladas`);
        console.log(`Jornadas creadas: ${jornadasIds.length}`);
        console.log('Seed completado.');
    } catch (e) {
        console.error('Error seed-ventas:', e.message);
        console.error(e.stack);
        throw e;
    } finally {
        conn.release();
        await pool.end();
    }
}

if (require.main === module) {
    seedVentas().then(() => process.exit(0)).catch(() => process.exit(1));
}
module.exports = { seedVentas };
