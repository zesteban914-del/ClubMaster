const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { pool } = require('../config/database');

async function tableExists(conn, name) {
  const [rows] = await conn.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [name]
  );
  return rows.length > 0;
}

async function safeDelete(conn, table, where = '') {
  if (!(await tableExists(conn, table))) {
    console.log(` - ${table}: no existe, omitida`);
    return 0;
  }
  const [res] = await conn.query(`DELETE FROM \`${table}\` ${where}`);
  console.log(` - ${table}: ${res.affectedRows} filas eliminadas`);
  return res.affectedRows;
}

async function resetAutoIncrement(conn, table) {
  if (!(await tableExists(conn, table))) return;
  try {
    await conn.query(`ALTER TABLE \`${table}\` AUTO_INCREMENT = 1`);
    console.log(`   -> AUTO_INCREMENT ${table} = 1`);
  } catch (e) {
    console.log(`   -> AUTO_INCREMENT ${table} aviso: ${e.message}`);
  }
}

async function clean() {
  const conn = await pool.getConnection();
  try {
    console.log('=== LIMPIEZA Y REINICIO DE DATOS DE PRUEBA ===');
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    console.log('FK checks desactivados');

    // 1. Ventas y Finanzas
    console.log('\n[1] Ventas y Finanzas');
    await safeDelete(conn, 'detalle_pedido');
    await safeDelete(conn, 'detalle_ventas');
    await safeDelete(conn, 'pedidos');
    await safeDelete(conn, 'ventas');
    await safeDelete(conn, 'facturas');
    await safeDelete(conn, 'cierres_caja');
    await safeDelete(conn, 'movimientos_caja');
    await safeDelete(conn, 'arqueos_detalle');
    await safeDelete(conn, 'arqueos');
    await safeDelete(conn, 'pagos_proveedores');

    // 2. Comandas y Operación
    console.log('\n[2] Comandas y Operación');
    await safeDelete(conn, 'detalle_comandas');
    await safeDelete(conn, 'comandas');
    await safeDelete(conn, 'mesas_atencion');
    await safeDelete(conn, 'speed_bar_ventas');
    // Reset mesas a Disponible
    if (await tableExists(conn, 'mesas')) {
      const [r] = await conn.query(`UPDATE mesas SET estado='Disponible', id_mesero=NULL, fecha_ocupacion=NULL, id_mesa_maestra=NULL`);
      console.log(` - mesas: ${r.affectedRows} restablecidas a Disponible`);
    }
    // Cierres: borrar jornadas de prueba pero no estructura
    await safeDelete(conn, 'jornadas');

    // 3. Cartera y Mermas
    console.log('\n[3] Cartera y Mermas');
    await safeDelete(conn, 'abonos_vales');
    await safeDelete(conn, 'historial_pagos_cartera');
    await safeDelete(conn, 'cuentas_por_cobrar');
    await safeDelete(conn, 'vales');
    await safeDelete(conn, 'mermas');

    // 4. Inventario y Compras
    console.log('\n[4] Inventario y Compras');
    await safeDelete(conn, 'detalle_compras');
    await safeDelete(conn, 'compras');
    // proveedores opcional: solo si contienen datos de prueba (no los de sistema). Por defecto se preservan proveedores reales, pero si se desea vaciar descomentar:
    // await safeDelete(conn, 'proveedores');
    console.log(' - proveedores: preservados (opcional, no borrados)');
    // Reset stock a 0 opcional para nueva batería? No se borra productos, solo stock
    if (await tableExists(conn, 'productos')) {
      await conn.query(`UPDATE productos SET stock=0`);
      console.log(' - productos: stock reseteado a 0');
    }

    // 5. Auditoria APPEND-ONLY: audit_logs y auditoria_incidencias NUNCA se borran desde la app.
    // Si se necesita purgar historico, hacerlo desde un proceso administrativo separado.
    console.log('\n[5] Auditoría (append-only, preservada)');
    console.log(' - audit_logs: preservada (append-only)');
    console.log(' - auditoria_incidencias: preservada (append-only)');
    await safeDelete(conn, 'password_reset_tokens');

    // 6. Otros temporales
    await safeDelete(conn, 'asistencias');
    await safeDelete(conn, 'vaciados_efectivo');

    // Preservar configuración y usuarios base
    console.log('\n[6] Preservando configuración y Super Admin');
    const [admins] = await conn.query(
      `SELECT id_usuario, correo FROM usuarios WHERE correo IN ('admin@clubmaster.com','admin@gmail.com') ORDER BY FIELD(correo,'admin@clubmaster.com','admin@gmail.com')`
    );
    let idPreservar = null;
    if (admins.length) {
      idPreservar = admins[0].id_usuario;
      console.log(` - Super Admin preservado: ${admins[0].correo} (id=${idPreservar})`);
      // Si existe admin@gmail.com además de admin@clubmaster.com, consolidar en admin@clubmaster.com
      if (admins.length > 1) {
        // asegurar admin@clubmaster.com existe
        const hasClubMaster = admins.some(a => a.correo === 'admin@clubmaster.com');
        if (!hasClubMaster) {
          await conn.query(`UPDATE usuarios SET correo='admin@clubmaster.com' WHERE id_usuario=?`, [idPreservar]);
          console.log(' - correo normalizado a admin@clubmaster.com');
        }
      }
      // borrar otros usuarios de prueba
      await conn.query(`DELETE FROM usuarios WHERE id_usuario != ?`, [idPreservar]);
      console.log(' - usuarios de prueba eliminados, solo queda Super Admin');
    } else {
      console.log(' ! ADVERTENCIA: no se encontró admin@clubmaster.com, creando uno temporal');
      const bcrypt = require('bcryptjs');
      const hash = await bcrypt.hash('1234', 10);
      const [res] = await conn.query(
        `INSERT INTO usuarios (nombre, correo, contrasena, id_rol, activo) VALUES ('Super Admin','admin@clubmaster.com',?,1,1)`,
        [hash]
      );
      idPreservar = res.insertId;
      await conn.query(`DELETE FROM usuarios WHERE id_usuario != ?`, [idPreservar]);
      console.log(` - Super Admin creado id=${idPreservar}`);
    }

    // Preservar tablas de configuración (no borrar)
    console.log(' - configuracion_general: preservada');
    console.log(' - configuracion_inventario: preservada');
    console.log(' - configuracion, parametros: preservadas');
    console.log(' - roles, permisos, metodos_pago, categorias, zonas: preservadas');

    // Restablecer AUTO_INCREMENT
    console.log('\n[7] Restableciendo AUTO_INCREMENT');
    const tablasReset = [
      'pedidos','detalle_pedido','ventas','detalle_ventas','facturas',
      'jornadas','cierres_caja','movimientos_caja','arqueos','arqueos_detalle',
      'comandas','detalle_comandas','cuentas_por_cobrar','vales','abonos_vales',
      'mermas','compras','detalle_compras'
    ];
    for (const t of tablasReset) await resetAutoIncrement(conn, t);

    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('\nFK checks reactivados');

    // Verificación post-limpieza
    console.log('\n=== VERIFICACIÓN POST-LIMPIEZA ===');
    const checks = [
      ['pedidos', 'SELECT COUNT(*) c FROM pedidos'],
      ['detalle_pedido', 'SELECT COUNT(*) c FROM detalle_pedido'],
      ['jornadas', 'SELECT COUNT(*) c FROM jornadas'],
      ['movimientos_caja', 'SELECT COUNT(*) c FROM movimientos_caja'],
      ['arqueos_detalle', 'SELECT COUNT(*) c FROM arqueos_detalle'],
      ['cuentas_por_cobrar', 'SELECT COUNT(*) c FROM cuentas_por_cobrar'],
      ['abonos_vales', 'SELECT COUNT(*) c FROM abonos_vales'],
      ['mermas', 'SELECT COUNT(*) c FROM mermas'],
      ['compras', 'SELECT COUNT(*) c FROM compras'],
      ['audit_logs', 'SELECT COUNT(*) c FROM audit_logs'],
      ['mesas Disponible', `SELECT COUNT(*) c FROM mesas WHERE estado='Disponible'`],
      ['mesas totales', `SELECT COUNT(*) c FROM mesas`],
      ['usuarios', `SELECT COUNT(*) c FROM usuarios`],
    ];
    let ok = true;
    for (const [label, sql] of checks) {
      try {
        const [rows] = await conn.query(sql);
        const c = rows[0].c;
        const icon = c === 0 || label.includes('mesas') || label.includes('usuarios') ? '✓' : (label.includes('usuarios') ? '✓' : '→');
        console.log(` ${icon} ${label}: ${c}`);
        if (label === 'usuarios' && c !== 1) ok = false;
      } catch (e) {
        console.log(` - ${label}: no verificable (${e.message})`);
      }
    }
    const [adminOk] = await conn.query(`SELECT id_usuario, nombre, correo, activo FROM usuarios WHERE correo='admin@clubmaster.com'`);
    if (adminOk.length && Number(adminOk[0].activo) === 1) {
      console.log(`\n✓ Login verificable: admin@clubmaster.com (id=${adminOk[0].id_usuario}) activo - sin errores de registros inexistentes`);
    } else {
      console.log('\n✗ ERROR: admin@clubmaster.com no disponible para login');
      ok = false;
    }
    // AUTO_INCREMENT verificación muestra 1
    for (const t of ['pedidos','jornadas','cuentas_por_cobrar']) {
      if (!(await tableExists(conn, t))) continue;
      try {
        const [ai] = await conn.query(`SELECT AUTO_INCREMENT FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?`, [t]);
        if (ai.length) console.log(`   AUTO_INCREMENT ${t} = ${ai[0].AUTO_INCREMENT}`);
      } catch {}
    }
    console.log('\n' + (ok ? '✓ Vaciado exitoso, contadores a 1 y login Administrador OK' : '⚠ Vaciado con advertencias, revisar'));
    console.log('=== LIMPIEZA COMPLETADA ===');
  } catch (e) {
    console.error('ERROR limpieza:', e.message);
    console.error(e.stack);
    try { await conn.query('SET FOREIGN_KEY_CHECKS = 1'); } catch {}
    process.exitCode = 1;
  } finally {
    conn.release();
    await pool.end();
  }
}

if (require.main === module) clean().then(() => process.exit(process.exitCode || 0));
module.exports = { clean };
