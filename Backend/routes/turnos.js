module.exports = function(app, db) {
  const turnosSvc = require('../services/turnos-service');
  const audit = require('../services/audit-service');
  const { bloquearAdmin } = require('../middlewares/authMiddleware');

  app.post('/api/turnos/abrir', bloquearAdmin, async (req, res) => {
    const { id_usuario, id_caja } = req.body;
    if (!id_usuario) return res.status(400).json({ success: false, mensaje: 'id_usuario obligatorio' });
    try {
      const r = await turnosSvc.abrirTurno(Number(id_usuario), id_caja ? Number(id_caja) : null);
      await audit.auditFromReq(req, { usuario_id: id_usuario, tipo_evento: 'APERTURA_CAJA', descripcion: `Apertura turno #${r.id_turno} usuario ${id_usuario} caja ${r.id_caja}`, motivo: 'abrir turno' });
      res.json({ success: true, mensaje: 'Turno ABIERTO', turno: r });
    } catch (e) {
      const code = e.status || 500;
      if (code === 403 || code === 400) return res.status(code).json({ success: false, mensaje: e.message });
      console.error('turnos/abrir', e.message);
      res.status(500).json({ success: false, mensaje: e.message });
    }
  });

  app.post('/api/turnos/cerrar', bloquearAdmin, async (req, res) => {
    const { id_usuario, id_turno } = req.body;
    if (!id_usuario) return res.status(400).json({ success: false, mensaje: 'id_usuario obligatorio' });
    try {
      const turno = await turnosSvc.cerrarTurno(Number(id_usuario), id_turno ? Number(id_turno) : null);
      await audit.auditFromReq(req, { usuario_id: id_usuario, tipo_evento: 'CIERRE_CAJA', descripcion: `Cierre turno #${turno.id_turno} horas ${turno.horas_trabajadas}`, motivo: 'cerrar turno' });
      res.json({ success: true, mensaje: `Turno CERRADO - ${turno.horas_trabajadas} horas`, turno });
    } catch (e) {
      const code = e.status || 500;
      if (code === 400 || code === 404) return res.status(code).json({ success: false, mensaje: e.message });
      console.error('turnos/cerrar', e.message);
      res.status(500).json({ success: false, mensaje: e.message });
    }
  });

  app.get('/api/turnos/activo/:id_usuario', async (req, res) => {
    try {
      const t = await turnosSvc.obtenerTurnoActivo(Number(req.params.id_usuario));
      res.json({ success: true, turno: t || null });
    } catch (e) { res.status(500).json({ success: false, mensaje: e.message }); }
  });

  app.get('/api/turnos', async (req, res) => {
    try {
      const filtros = {};
      if (req.query.fecha_inicio) filtros.fecha_inicio = req.query.fecha_inicio;
      if (req.query.fecha_fin) filtros.fecha_fin = req.query.fecha_fin;
      if (req.query.id_usuario) filtros.id_usuario = req.query.id_usuario;
      const lista = await turnosSvc.listarTurnos(filtros);
      res.json({ success: true, turnos: lista });
    } catch (e) { res.status(500).json({ success: false, mensaje: e.message }); }
  });

  app.get('/api/reportes/turnos', async (req, res) => {
    try {
      const filtros = {};
      if (req.query.fecha_inicio) filtros.fecha_inicio = req.query.fecha_inicio;
      if (req.query.fecha_fin) filtros.fecha_fin = req.query.fecha_fin;
      if (req.query.id_usuario) filtros.id_usuario = req.query.id_usuario;
      if (req.query.desde) filtros.fecha_inicio = req.query.desde;
      if (req.query.hasta) filtros.fecha_fin = req.query.hasta;
      const lista = await turnosSvc.reporteHorasPorEmpleado(filtros);
      res.json({ success: true, filtros, reporte: lista, total: lista.length });
    } catch (e) {
      console.error('reportes/turnos', e.message);
      res.status(500).json({ success: false, mensaje: e.message });
    }
  });

  app.get('/api/caja/estado', async (req, res) => {
    try {
      const caja = await turnosSvc.getCajaActiva();
      res.json({ success: true, caja_abierta: !!caja, caja: caja || null });
    } catch (e) { res.status(500).json({ success: false, mensaje: e.message }); }
  });
};
