const { pool } = require('../config/database');

const NUMERO_MESA_REGEX = /^[A-Za-z0-9\s\-]+$/;

function validarNumeroMesa(numero) {
    const s = String(numero == null ? '' : numero).trim();
    if (!s) throw new Error('El numero de la mesa es obligatorio');
    if (s.length > 20) throw new Error('El numero de la mesa no puede superar 20 caracteres');
    if (!NUMERO_MESA_REGEX.test(s)) throw new Error('Numero de mesa inválido: solo letras, números, espacios y guiones (Ej: 1, Mesa 12, VIP 3, A-5)');
    return s;
}

async function asegurarColumnasMesas() {
    try {
        const [colNum] = await pool.query("SHOW COLUMNS FROM mesas LIKE 'numero'");
        if (colNum.length && !/varchar|char|text/i.test(String(colNum[0].Type || ''))) {
            try { await pool.query('ALTER TABLE mesas MODIFY COLUMN numero VARCHAR(20) NOT NULL'); } catch (e) {}
        }
    } catch (e) {}
}

async function obtenerMesas(includeInactivas) {
    await asegurarColumnasMesas();
    const where = includeInactivas ? '' : 'WHERE m.activo = 1';
    const [rows] = await pool.query(
        `SELECT m.*, COALESCE(u.nombre, '') AS mesero_nombre
         FROM mesas m
         LEFT JOIN usuarios u ON m.id_mesero = u.id_usuario
         ${where}
         ORDER BY LENGTH(m.numero), m.numero ASC`
    );
    return rows;
}

async function obtenerZonas() {
    const [rows] = await pool.query('SELECT * FROM zonas ORDER BY orden ASC, nombre ASC');
    return rows;
}

async function crearZona(nombre, descripcion, color) {
    const [result] = await pool.query(
        'INSERT INTO zonas (nombre, descripcion, color) VALUES (?, ?, ?)',
        [nombre, descripcion || '', color || '#3b82f6']
    );
    return { id_zona: result.insertId };
}

async function crearMesa(datos) {
    await asegurarColumnasMesas();
    const numero = validarNumeroMesa(datos.numero);
    const [result] = await pool.query(
        `INSERT INTO mesas (numero, nombre, capacidad, estado, zona, id_mesero, id_mesa_maestra)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [numero, datos.nombre || '', Number(datos.capacidad) || 1,
         datos.estado || 'Disponible', datos.zona || 'VIP',
         datos.id_mesero || null, datos.id_mesa_maestra || null]
    );
    return { id_mesa: result.insertId };
}

async function actualizarMesa(id, datos) {
    await asegurarColumnasMesas();
    const sets = [];
    const valores = [];
    if (datos.numero !== undefined) { sets.push('numero = ?'); valores.push(validarNumeroMesa(datos.numero)); }
    if (datos.nombre !== undefined) { sets.push('nombre = ?'); valores.push(datos.nombre || ''); }
    if (datos.capacidad !== undefined) { sets.push('capacidad = ?'); valores.push(Number(datos.capacidad) || 1); }
    if (datos.estado !== undefined) {
        const est = String(datos.estado);
        if (['Disponible', 'Ocupada'].indexOf(est) === -1) throw new Error('Estado inválido: solo Disponible u Ocupada');
        sets.push('estado = ?'); valores.push(est);
    }
    if (datos.zona !== undefined) { sets.push('zona = ?'); valores.push(datos.zona); }
    if (datos.id_mesero !== undefined) { sets.push('id_mesero = ?'); valores.push(datos.id_mesero || null); }
    if (sets.length === 0) throw new Error('No hay campos que actualizar');
    valores.push(id);
    await pool.query('UPDATE mesas SET ' + sets.join(', ') + ' WHERE id_mesa = ?', valores);
}

async function toggleMesa(id, activo) {
    await pool.query('UPDATE mesas SET activo = ? WHERE id_mesa = ?', [activo ? 1 : 0, id]);
}

async function cambiarMesaEstado(id, estado) {
    await pool.query('UPDATE mesas SET estado = ? WHERE id_mesa = ?', [estado, id]);
}

async function unirMesas(idMesaOrigen, idMesaDestino) {
    const conexion = await pool.getConnection();
    try {
        await conexion.beginTransaction();
        const [mesaDestino] = await conexion.query(
            "SELECT estado FROM mesas WHERE id_mesa = ?", [idMesaDestino]
        );
        if (mesaDestino.length === 0) throw new Error('Mesa destino no encontrada');
        const [pedidos] = await conexion.query(
            "SELECT id_pedido FROM pedidos WHERE id_mesa = ? AND estado = 'Pendiente'",
            [idMesaOrigen]
        );
        if (pedidos.length > 0) {
            await conexion.query(
                'UPDATE pedidos SET id_mesa = ? WHERE id_mesa = ? AND estado = ?',
                [idMesaDestino, idMesaOrigen, 'Pendiente']
            );
        }
        if (mesaDestino[0].estado !== 'Ocupada') {
            await conexion.query("UPDATE mesas SET estado = 'Ocupada' WHERE id_mesa = ?", [idMesaDestino]);
        }
        await conexion.query("UPDATE mesas SET estado = 'Disponible' WHERE id_mesa = ?", [idMesaOrigen]);
        await conexion.commit();
        return { pedidos_transferidos: pedidos.length };
    } catch (error) {
        await conexion.rollback();
        throw error;
    } finally {
        conexion.release();
    }
}

async function estadoMesaOcupada(idMesa) {
    const estados = await estadosMesasOcupadas([idMesa]);
    return estados.length ? estados[0] : null;
}

async function estadosMesasOcupadas(ids) {
    const list = (Array.isArray(ids) ? ids : [ids]).map(Number).filter(Boolean);
    if (!list.length) return [];
    const ph = list.map(function() { return '?'; }).join(',');
    const [mesas] = await pool.query(
        `SELECT m.id_mesa, m.numero, m.nombre, m.zona, m.estado, m.id_mesero, m.fecha_ocupacion,
                COALESCE(u.nombre, '') AS mesero_nombre
         FROM mesas m
         LEFT JOIN usuarios u ON m.id_mesero = u.id_usuario
         WHERE m.id_mesa IN (${ph})`, list
    );
    if (!mesas.length) return [];
    const [consumos] = await pool.query(
        `SELECT p.id_mesa,
                COALESCE(SUM(dp.cantidad * dp.precio_unitario), 0) AS total,
                COUNT(DISTINCT p.id_pedido) AS num_pedidos,
                MIN(p.timestamp_pedido) AS primer_pedido
         FROM pedidos p
         JOIN detalle_pedido dp ON p.id_pedido = dp.id_pedido
         WHERE p.id_mesa IN (${ph}) AND p.estado = 'Pendiente'
         GROUP BY p.id_mesa`, list
    );
    const consMap = new Map(consumos.map(function(c) { return [Number(c.id_mesa), c]; }));
    return mesas.map(function(m) {
        const c = consMap.get(Number(m.id_mesa));
        const desde = m.fecha_ocupacion || (c && c.primer_pedido) || null;
        let minutos = 0;
        if (desde) {
            minutos = Math.max(0, Math.floor((Date.now() - new Date(String(desde).replace(/-/g, '/'))) / 60000));
        }
        return {
            id_mesa: m.id_mesa,
            numero: m.numero,
            nombre: m.nombre,
            zona: m.zona || 'VIP',
            estado: m.estado,
            id_mesero: m.id_mesero,
            mesero_nombre: m.mesero_nombre || '',
            total_consumido: Number(c ? c.total : 0),
            num_pedidos: Number(c ? c.num_pedidos : 0),
            minutos_transcurridos: minutos,
            fecha_ocupacion: desde
        };
    });
}

async function obtenerMesasActivas() {
    await asegurarColumnasMesas();
    const [rows] = await pool.query(
        "SELECT m.id_mesa, m.numero, m.nombre, m.zona, m.estado, m.id_mesero, m.fecha_ocupacion, COALESCE(u.nombre,'') AS mesero_nombre, " +
        "(SELECT COALESCE(SUM(dp.cantidad * dp.precio_unitario),0) FROM pedidos p JOIN detalle_pedido dp ON p.id_pedido=dp.id_pedido WHERE p.id_mesa=m.id_mesa AND p.estado='Pendiente') AS total_pendiente, " +
        "(SELECT COUNT(*) FROM pedidos p WHERE p.id_mesa=m.id_mesa AND p.estado='Pendiente') AS num_pedidos " +
        "FROM mesas m LEFT JOIN usuarios u ON m.id_mesero=u.id_usuario " +
        "WHERE m.activo=1 AND EXISTS (SELECT 1 FROM pedidos p2 WHERE p2.id_mesa=m.id_mesa AND p2.estado='Pendiente') " +
        "ORDER BY LENGTH(m.numero), m.numero ASC"
    );
    return rows;
}

async function obtenerPresentaciones() {
    const [rows] = await pool.query('SELECT * FROM presentaciones WHERE activa = 1 ORDER BY id_presentacion ASC');
    return rows;
}

async function obtenerNotasPreparacion() {
    const [rows] = await pool.query('SELECT * FROM notas_preparacion WHERE activa = 1 ORDER BY id_nota ASC');
    return rows;
}

async function transferirMesa(idMesa, idMeseroNuevo, motivo, idUsuarioEjecuta, idJornada) {
    if (!idMesa || !idMeseroNuevo) throw new Error('Mesa y mesero destino obligatorios');
    const motivoNorm = String(motivo||'').trim().substring(0,255) || 'Transferencia';
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [mesaRows]=await conn.query("SELECT id_mesa, id_mesero, estado FROM mesas WHERE id_mesa=? FOR UPDATE", [idMesa]);
        if (!mesaRows.length) throw new Error('Mesa no encontrada');
        const meseroAnterior = mesaRows[0].id_mesero;
        if (Number(meseroAnterior)===Number(idMeseroNuevo)) { await conn.rollback(); return { yaTitular:true, id_mesero_anterior: meseroAnterior }; }
        // validar mesero nuevo activo rol mesero
        const [chk]=await conn.query("SELECT id_usuario FROM usuarios u LEFT JOIN roles r ON u.id_rol=r.id_rol WHERE u.id_usuario=? AND u.activo=1 AND (LOWER(r.nombre) LIKE '%meser%' OR u.id_rol=3) LIMIT 1", [idMeseroNuevo]);
        if (!chk.length) throw new Error('Mesero destino no existe o no tiene rol mesero');
        // actualizar mesa titular
        await conn.query("UPDATE mesas SET id_mesero=? WHERE id_mesa=?", [idMeseroNuevo, idMesa]);
        // actualizar pedidos pendientes al nuevo titular (titular unico)
        await conn.query("UPDATE pedidos SET id_mesero=? WHERE id_mesa=? AND estado='Pendiente'", [idMeseroNuevo, idMesa]);
        // historial
        await conn.query("CREATE TABLE IF NOT EXISTS mesa_transferencias (id_transferencia INT AUTO_INCREMENT PRIMARY KEY, id_mesa INT NOT NULL, id_mesero_anterior INT NULL, id_mesero_nuevo INT NOT NULL, id_usuario_ejecuta INT NULL, motivo VARCHAR(255) NOT NULL DEFAULT '', fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, id_jornada INT NULL, KEY idx_mesa_trans_mesa (id_mesa)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        await conn.query("INSERT INTO mesa_transferencias (id_mesa, id_mesero_anterior, id_mesero_nuevo, id_usuario_ejecuta, motivo, id_jornada) VALUES (?,?,?,?,?,?)", [idMesa, meseroAnterior, idMeseroNuevo, idUsuarioEjecuta||null, motivoNorm, idJornada||null]);
        // auditoria
        try {
            const audit=require('./audit-service');
            // no bloquear con audit
        } catch(e){}
        await conn.commit();
        return { id_mesa: idMesa, id_mesero_anterior: meseroAnterior, id_mesero_nuevo: idMeseroNuevo };
    } catch(e){ try{await conn.rollback();}catch(_){}; throw e; } finally { conn.release(); }
}

module.exports = {
    obtenerMesas,
    obtenerZonas,
    crearZona,
    crearMesa,
    actualizarMesa,
    toggleMesa,
    cambiarMesaEstado,
    unirMesas,
    estadoMesaOcupada,
    estadosMesasOcupadas,
    obtenerMesasActivas,
    obtenerPresentaciones,
    obtenerNotasPreparacion,
    validarNumeroMesa,
    NUMERO_MESA_REGEX,
    transferirMesa
};
