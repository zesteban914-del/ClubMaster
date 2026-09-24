const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const { pool } = require('../config/database');
const { migrate } = require('./migrate');
const bcrypt = require('bcryptjs');

async function tableExists(conn, name) {
  const [rows] = await conn.query(`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`, [name]);
  return rows.length > 0;
}

async function setupFresh() {
  console.log('=================================================');
  console.log(' ClubMaster - setup:fresh (cliente nuevo SaaS/On-Premise)');
  console.log(` env=${process.env.NODE_ENV || 'development'} db=${process.env.DB_NAME || 'discoteca_db'}`);
  console.log('=================================================');

  if (process.env.NODE_ENV === 'production') {
    if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
      console.error('ERROR: SESSION_SECRET debe tener >=32 caracteres en produccion. Define en .env');
      process.exit(1);
    }
    if (!process.env.CORS_ORIGINS && !process.env.APP_URL) {
      console.warn('ADVERTENCIA: CORS_ORIGINS/APP_URL no definido en produccion - CORS rechazara todo');
    }
  }

  console.log('\n[1/4] Migrando estructura SQL (CREATE TABLE + ALTER + seed config_general)...');
  await migrate();
  console.log(' -> migrate OK');

  const conn = await pool.getConnection();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS=0');
    console.log('\n[2/4] Limpiando tablas transaccionales (preserva estructura)...');
    const transaccionales = [
      'detalle_pedido','detalle_ventas','pedidos','ventas','facturas','cierres_caja',
      'movimientos_caja','arqueos_detalle','arqueos','comandas','detalle_comandas',
      'mesas_atencion','speed_bar_ventas','cuentas_por_cobrar','vales','abonos_vales',
      'historial_pagos_cartera','mermas','detalle_compras','compras','pagos_proveedores',
      'jornadas','password_reset_tokens',
      'asistencias','vaciados_efectivo'
    ];
    for (const t of transaccionales) {
      if (await tableExists(conn, t)) {
        const [r] = await conn.query(`DELETE FROM \`${t}\``);
        console.log(`  - ${t}: ${r.affectedRows} filas eliminadas`);
      }
    }
    if (await tableExists(conn, 'mesas')) {
      const [r] = await conn.query(`UPDATE mesas SET estado='Disponible', id_mesero=NULL, fecha_ocupacion=NULL, id_mesa_maestra=NULL`);
      console.log(`  - mesas: ${r.affectedRows} restablecidas a Disponible`);
    }
    if (await tableExists(conn, 'productos')) {
      await conn.query(`UPDATE productos SET stock=0`);
      console.log('  - productos: stock reseteado a 0 (catalogo preservado)');
    }
    console.log('  - proveedores/clientes_socios/configuracion_*: PRESERVADOS (catalogo/config)');

    console.log('\n[3/4] Verificando configuraciones por defecto...');
    const [cfgRows] = await conn.query('SELECT clave, valor FROM configuracion_general');
    const cfg = {};
    cfgRows.forEach(r => cfg[r.clave] = r.valor);
    const clavesCriticas = ['nombre_local','nit_local','logo_url','pie_factura','propina_default','iva_global','ico_global'];
    clavesCriticas.forEach(k => {
      console.log(`  ${cfg[k] !== undefined ? '✓' : '·'} ${k} = ${cfg[k] !== undefined ? JSON.stringify(cfg[k]) : '(no definido - se creara por migrate)'}`);
    });
    console.log('  -> 100% parametrizable via PUT /api/configuracion sin tocar codigo');

    console.log('\n[4/4] Creando usuario Administrador inicial (contrasena temporal)...');
    const adminEmail = (process.env.ADMIN_EMAIL || process.env.SETUP_ADMIN_EMAIL || 'admin@clubmaster.com').trim().toLowerCase();
    const adminNombre = process.env.ADMIN_NAME || 'Administrador';
    const tempPass = process.env.ADMIN_TEMP_PASSWORD || process.env.SETUP_ADMIN_PASSWORD || 'ClubMaster2026*';
    const [roles] = await conn.query("SELECT id_rol FROM roles WHERE LOWER(nombre)='administrador' OR LOWER(nombre)='admin' LIMIT 1");
    let idRolAdmin = roles.length ? roles[0].id_rol : 1;
    if (!roles.length) {
      const [ins] = await conn.query("INSERT INTO roles (nombre, descripcion) VALUES ('Administrador','Acceso total')");
      idRolAdmin = ins.insertId;
      console.log(`  - rol Administrador creado id=${idRolAdmin}`);
    }
    const hash = await bcrypt.hash(tempPass, 10);
    const [exist] = await conn.query('SELECT id_usuario, correo FROM usuarios WHERE correo=? LIMIT 1', [adminEmail]);
    let idAdmin;
    if (exist.length) {
      await conn.query('UPDATE usuarios SET nombre=?, contrasena=?, id_rol=?, activo=1 WHERE id_usuario=?', [adminNombre, hash, idRolAdmin, exist[0].id_usuario]);
      idAdmin = exist[0].id_usuario;
      console.log(`  - usuario actualizado: ${adminEmail} id=${idAdmin}`);
    } else {
      const [ins] = await conn.query('INSERT INTO usuarios (nombre, correo, contrasena, id_rol, activo) VALUES (?,?,?,?,1)', [adminNombre, adminEmail, hash, idRolAdmin]);
      idAdmin = ins.insertId;
      console.log(`  - usuario creado: ${adminEmail} id=${idAdmin}`);
    }
    const [otros] = await conn.query('SELECT COUNT(*) c FROM usuarios WHERE id_usuario != ?', [idAdmin]);
    if (otros[0].c > 0) {
      console.log(`  - nota: se preservan ${otros[0].c} usuarios previos; para cliente 100% nuevo borra manualmente o usa cleanData`);
    }

    const tablasReset = ['pedidos','detalle_pedido','jornadas','movimientos_caja','arqueos_detalle','cuentas_por_cobrar','abonos_vales','mermas','compras','detalle_compras','password_reset_tokens'];
    for (const t of tablasReset) {
      if (await tableExists(conn, t)) {
        try { await conn.query(`ALTER TABLE \`${t}\` AUTO_INCREMENT = 1`); } catch (e) {}
      }
    }
    await conn.query('SET FOREIGN_KEY_CHECKS=1');

    console.log('\n=================================================');
    console.log(' setup:fresh COMPLETADO');
    console.log('=================================================');
    console.log(` DB: ${process.env.DB_NAME || 'discoteca_db'} @ ${process.env.DB_HOST || 'localhost'}`);
    console.log(` Admin: ${adminEmail}`);
    console.log(` Password temporal: ${tempPass}`);
    console.log('  -> Cambia la contrasena en el primer login (Perfil / Usuarios)');
    console.log(' Config: GET /api/configuracion  PUT /api/configuracion');
    console.log('   claves: nombre_local, nit_local, logo_url, pie_factura, propina_default, iva_global, ico_global');
    console.log(' CORS production: define CORS_ORIGINS="https://cliente.com,https://app.cliente.com" en .env');
    console.log('=================================================');
  } catch (e) {
    console.error('ERROR setup:fresh:', e.message);
    console.error(e.stack);
    try { await conn.query('SET FOREIGN_KEY_CHECKS=1'); } catch {}
    process.exitCode = 1;
  } finally {
    conn.release();
    await pool.end();
  }
}

if (require.main === module) setupFresh().then(() => process.exit(process.exitCode || 0));
module.exports = { setupFresh };
