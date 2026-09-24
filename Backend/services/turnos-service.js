const { pool } = require('../config/database');

async function getCajaActiva() {
  const [rows] = await pool.query("SELECT * FROM jornadas WHERE estado='Abierta' ORDER BY id_jornada DESC LIMIT 1");
  return rows.length ? rows[0] : null;
}

async function abrirTurno(idUsuario) {
  const caja = await getCajaActiva();
  if (!caja) {
    const e = new Error('Imposible iniciar turno: La Caja Principal se encuentra cerrada.');
    e.status = 403;
    throw e;
  }
  const [exist] = await pool.query("SELECT id_turno FROM turnos WHERE id_usuario=? AND estado='ABIERTO' LIMIT 1", [idUsuario]);
  if (exist.length) {
    const e = new Error('El usuario ya tiene un turno ABIERTO.');
    e.status = 400;
    throw e;
  }
  const [res] = await pool.query(
    "INSERT INTO turnos (id_usuario, id_caja, fecha_hora_inicio, estado) VALUES (?, ?, NOW(), 'ABIERTO')",
    [idUsuario, caja.id_jornada]
  );
  try {
    await pool.query(
      "INSERT INTO turnos_empleados (id_usuario, id_caja, fecha_hora_inicio, estado) VALUES (?, ?, NOW(), 'ABIERTO')",
      [idUsuario, caja.id_jornada]
    );
  } catch (_) {}
  try {
    await pool.query("INSERT INTO asistencias (id_usuario,tipo,fecha,timestamp,id_jornada) VALUES (?,?,CURDATE(),NOW(),?)", [idUsuario, 'inicio_turno', caja.id_jornada]);
    await pool.query("UPDATE usuarios SET estado_actual='inicio_turno', ultimo_fichaje=NOW() WHERE id_usuario=?", [idUsuario]);
  } catch (_) {}
  return { id_turno: res.insertId, id_caja: caja.id_jornada, fecha_hora_inicio: new Date() };
}

async function cerrarTurno(idUsuario, idTurno) {
  let turno;
  if (idTurno) {
    const [rows] = await pool.query("SELECT * FROM turnos WHERE id_turno=? AND id_usuario=? LIMIT 1", [idTurno, idUsuario]);
    turno = rows[0];
  } else {
    const [rows] = await pool.query("SELECT * FROM turnos WHERE id_usuario=? AND estado='ABIERTO' ORDER BY id_turno DESC LIMIT 1", [idUsuario]);
    turno = rows[0];
  }
  if (!turno) {
    const e = new Error('No hay turno ABIERTO para este usuario.');
    e.status = 404;
    throw e;
  }
  if (turno.estado === 'CERRADO') {
    const e = new Error('El turno ya está CERRADO.');
    e.status = 400;
    throw e;
  }
  const [calc] = await pool.query(
    "SELECT TIMESTAMPDIFF(SECOND, fecha_hora_inicio, NOW())/3600 AS horas FROM turnos WHERE id_turno=?",
    [turno.id_turno]
  );
  const horas = calc.length ? Number(Number(calc[0].horas).toFixed(2)) : 0;
  const horasSafe = isFinite(horas) && horas >= 0 ? horas : 0;
  await pool.query(
    "UPDATE turnos SET fecha_hora_fin=NOW(), horas_trabajadas=?, estado='CERRADO' WHERE id_turno=?",
    [horasSafe, turno.id_turno]
  );
  try {
    await pool.query(
      "UPDATE turnos_empleados SET fecha_hora_fin=NOW(), horas_trabajadas=?, estado='CERRADO' WHERE id_usuario=? AND estado='ABIERTO' ORDER BY id_turno DESC LIMIT 1",
      [horasSafe, idUsuario]
    );
  } catch (_) {}
  const [upd] = await pool.query("SELECT * FROM turnos WHERE id_turno=?", [turno.id_turno]);
  try {
    await pool.query("INSERT INTO asistencias (id_usuario,tipo,fecha,timestamp,id_jornada) VALUES (?,?,CURDATE(),NOW(),?)", [idUsuario, 'salida', turno.id_caja]);
    await pool.query("UPDATE usuarios SET estado_actual='salida', ultimo_fichaje=NOW() WHERE id_usuario=?", [idUsuario]);
  } catch (_) {}
  return upd[0];
}

async function obtenerTurnoActivo(idUsuario) {
  const [rows] = await pool.query("SELECT * FROM turnos WHERE id_usuario=? AND estado='ABIERTO' LIMIT 1", [idUsuario]);
  return rows[0] || null;
}

async function listarTurnos(filtros) {
  filtros = filtros || {};
  const params = [];
  let where = '1=1';
  if (filtros.fecha_inicio) { where += ' AND DATE(t.fecha_hora_inicio) >= ?'; params.push(filtros.fecha_inicio); }
  if (filtros.fecha_fin) { where += ' AND DATE(t.fecha_hora_inicio) <= ?'; params.push(filtros.fecha_fin); }
  if (filtros.id_usuario) { where += ' AND t.id_usuario = ?'; params.push(Number(filtros.id_usuario)); }
  const sql = `
    SELECT t.id_turno, t.id_usuario, t.id_caja AS id_caja, j.barra_asignada,
           t.fecha_hora_inicio, t.fecha_hora_fin, t.horas_trabajadas, t.estado,
           u.nombre AS empleado, COALESCE(r.nombre,'') AS rol,
           DATE(t.fecha_hora_inicio) AS fecha,
           COALESCE(SUM(CASE WHEN ped.estado='Pagado' AND ped.id_usuario=t.id_usuario AND ped.timestamp_pedido BETWEEN t.fecha_hora_inicio AND COALESCE(t.fecha_hora_fin, NOW()) THEN ped.total ELSE 0 END),0) AS total_facturado,
           COALESCE(COUNT(DISTINCT CASE WHEN ped.estado='Pagado' AND ped.id_usuario=t.id_usuario AND ped.timestamp_pedido BETWEEN t.fecha_hora_inicio AND COALESCE(t.fecha_hora_fin, NOW()) THEN ped.id_pedido END),0) AS comandas_atendidas
    FROM turnos t
    JOIN usuarios u ON t.id_usuario=u.id_usuario
    LEFT JOIN roles r ON u.id_rol=r.id_rol
    LEFT JOIN jornadas j ON t.id_caja=j.id_jornada
    LEFT JOIN pedidos ped ON ped.id_usuario=t.id_usuario
    WHERE ${where}
    GROUP BY t.id_turno
    ORDER BY t.fecha_hora_inicio DESC
    LIMIT 500
  `;
  const [rows] = await pool.query(sql, params);
  return rows.map(function(row){
    let horas = row.horas_trabajadas;
    if (row.estado === 'ABIERTO' && row.fecha_hora_inicio) {
      const diffMs = Date.now() - new Date(row.fecha_hora_inicio).getTime();
      horas = Number((diffMs/3600000).toFixed(2));
    }
    return {
      id_turno: row.id_turno,
      id_usuario: row.id_usuario,
      id_caja: row.id_caja,
      barra_asignada: row.barra_asignada || 'Caja Principal',
      empleado: row.empleado,
      rol: row.rol,
      fecha: row.fecha,
      fecha_hora_inicio: row.fecha_hora_inicio,
      fecha_hora_fin: row.fecha_hora_fin,
      horas_trabajadas: horas != null ? Number(horas) : null,
      estado: row.estado,
      total_facturado: Number(row.total_facturado)||0,
      comandas_atendidas: Number(row.comandas_atendidas)||0
    };
  });
}

async function reporteHorasPorEmpleado(filtros) {
  return listarTurnos(filtros);
}

module.exports = { getCajaActiva, abrirTurno, cerrarTurno, obtenerTurnoActivo, listarTurnos, reporteHorasPorEmpleado };
