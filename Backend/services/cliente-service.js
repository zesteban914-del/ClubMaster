const { pool } = require('../config/database');
const { redondearDinero } = require('../helpers/db-helpers');

async function crearVale(clienteSocio, idMesa, total, idUsuario, datos) {
    datos = datos || {};
    let nombreFinal = clienteSocio;
    if (datos.id_cliente_socio) {
        const [cs] = await pool.query(
            'SELECT nombre FROM clientes_socios WHERE id_cliente = ?',
            [datos.id_cliente_socio]
        );
        if (cs.length > 0) nombreFinal = cs[0].nombre;
    }
    const fechaVenc = datos.fecha_vencimiento || null;
    const tipoMora = datos.tipo_mora || 'diario';
    const tasaMora = Number(datos.tasa_mora) >= 0 ? Number(datos.tasa_mora) : 0;
    // Cajero = idUsuario (req.user.id / sesión), Mesero = datos.id_mesero del <select>
    const idCajero = idUsuario || datos.id_cajero || datos.id_usuario_registra || null;
    const idMesero = datos.id_mesero || null;
    // Asegurar columnas id_mesero / id_cajero / id_usuario_registra en cuentas_por_cobrar
    try {
        const [c1] = await pool.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='cuentas_por_cobrar' AND COLUMN_NAME='id_mesero'");
        if (c1.length === 0) { try { await pool.query("ALTER TABLE cuentas_por_cobrar ADD COLUMN id_mesero INT NULL, ADD INDEX idx_cpc_mesero (id_mesero)"); } catch (e) {} }
        const [c2] = await pool.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='cuentas_por_cobrar' AND COLUMN_NAME='id_cajero'");
        if (c2.length === 0) { try { await pool.query("ALTER TABLE cuentas_por_cobrar ADD COLUMN id_cajero INT NULL"); } catch (e) {} }
        const [c3] = await pool.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='cuentas_por_cobrar' AND COLUMN_NAME='id_usuario_registra'");
        if (c3.length === 0) { try { await pool.query("ALTER TABLE cuentas_por_cobrar ADD COLUMN id_usuario_registra INT NULL"); } catch (e) {} }
    } catch (e) {}
    try {
        const [result] = await pool.query(
            `INSERT INTO cuentas_por_cobrar
                (cliente_socio, id_cliente_socio, id_mesa, total, saldo_pendiente, estado,
                 id_usuario_autoriza, id_cajero, id_usuario_registra, id_mesero, fecha_vencimiento, tipo_mora, tasa_mora, referencia)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [nombreFinal, datos.id_cliente_socio || null, idMesa || null, total, total, 'Pendiente',
             idCajero, idCajero, idCajero, idMesero, fechaVenc, tipoMora, tasaMora, datos.referencia || '']
        );
        return { id_vale: result.insertId };
    } catch (e) {
        if (e.code === 'ER_BAD_FIELD_ERROR') {
            try {
                const [result] = await pool.query(
                    `INSERT INTO cuentas_por_cobrar
                        (cliente_socio, id_cliente_socio, id_mesa, total, saldo_pendiente, estado,
                         id_usuario_autoriza, id_mesero, fecha_vencimiento, tipo_mora, tasa_mora, referencia)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [nombreFinal, datos.id_cliente_socio || null, idMesa || null, total, total, 'Pendiente',
                     idCajero, idMesero, fechaVenc, tipoMora, tasaMora, datos.referencia || '']
                );
                return { id_vale: result.insertId };
            } catch (e2) {
                if (e2.code === 'ER_BAD_FIELD_ERROR') {
                    const [result] = await pool.query(
                        `INSERT INTO cuentas_por_cobrar
                            (cliente_socio, id_cliente_socio, id_mesa, total, saldo_pendiente, estado,
                             id_usuario_autoriza, fecha_vencimiento, tipo_mora, tasa_mora, referencia)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [nombreFinal, datos.id_cliente_socio || null, idMesa || null, total, total, 'Pendiente',
                         idCajero, fechaVenc, tipoMora, tasaMora, datos.referencia || '']
                    );
                    return { id_vale: result.insertId };
                }
                throw e2;
            }
        }
        throw e;
    }
}

async function valesPendientes() {
    const [rows] = await pool.query(`
        SELECT v.*, v.total - v.capital_pagado AS capital_pendiente,
               u.nombre AS usuario_nombre
        FROM cuentas_por_cobrar v
        LEFT JOIN usuarios u ON v.id_usuario_autoriza = u.id_usuario
        WHERE v.saldo_pendiente > 0 OR (v.mora_acumulada > v.mora_pagada)
        ORDER BY COALESCE(v.fecha_vencimiento, v.fecha) ASC
    `);
    return rows;
}

async function obtenerClientesSocios() {
    const [rows] = await pool.query(`
        SELECT cs.*,
               (SELECT COALESCE(SUM(v.saldo_pendiente), 0)
                FROM cuentas_por_cobrar v
                WHERE v.id_cliente_socio = cs.id_cliente AND v.saldo_pendiente > 0) AS deuda_actual,
               (SELECT COUNT(*) FROM cuentas_por_cobrar v
                WHERE v.id_cliente_socio = cs.id_cliente AND v.saldo_pendiente > 0) AS vales_activos
        FROM clientes_socios cs
        ORDER BY cs.nombre ASC
    `);
    return rows;
}

async function crearClienteSocio(datos) {
    const [result] = await pool.query(
        `INSERT INTO clientes_socios
            (nombre, telefono, documento, tipo_documento, correo, limite_credito, es_vip, activo, observaciones)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [datos.nombre, datos.telefono || '', datos.documento || '', datos.tipo_documento || 'CC',
         datos.correo || '', Number(datos.limite_credito) || 0,
         (datos.es_vip === false || datos.es_vip === 0) ? 0 : 1, datos.observaciones || '']
    );
    return { id_cliente: result.insertId };
}

async function actualizarClienteSocio(id, datos) {
    await pool.query(
        `UPDATE clientes_socios
            SET nombre = ?, telefono = ?, documento = ?, tipo_documento = ?, correo = ?,
                limite_credito = ?, es_vip = ?, observaciones = ?
         WHERE id_cliente = ?`,
        [datos.nombre, datos.telefono || '', datos.documento || '', datos.tipo_documento || 'CC',
         datos.correo || '', Number(datos.limite_credito) || 0,
         (datos.es_vip === false || datos.es_vip === 0) ? 0 : 1, datos.observaciones || '', id]
    );
}

async function toggleClienteSocio(id, activo) {
    await pool.query('UPDATE clientes_socios SET activo = ? WHERE id_cliente = ?', [activo, id]);
}

async function resumenCartera() {
    const [vales] = await pool.query(`
        SELECT v.* FROM cuentas_por_cobrar v
        WHERE v.saldo_pendiente > 0 OR (v.mora_acumulada > v.mora_pagada)
    `);

    const enriquecidos = [];
    let totalPendiente = 0, totalMorosidad = 0;
    const hoy = new Date();

    for (const v of vales) {
        const moraCalc = await calcularMoraVale(v, hoy);
        const capital = Math.max(0, Number(v.saldo_pendiente));
        const mora = moraCalc.mora;
        const venc = v.fecha_vencimiento ? new Date(String(v.fecha_vencimiento).replace(/-/g, '/')) : null;
        const vencido = venc && venc < hoy;
        enriquecidos.push({
            id_vale: v.id_vale,
            cliente_socio: v.cliente_socio,
            id_cliente_socio: v.id_cliente_socio,
            id_mesa: v.id_mesa,
            total: Number(v.total),
            saldo_pendiente: capital,
            mora_pendiente: mora,
            total_pendiente_efectivo: redondearDinero(capital + mora),
            dias_mora: moraCalc.dias_mora,
            vencido: !!vencido,
            fecha_vencimiento: v.fecha_vencimiento,
            estado: v.estado,
            fecha: v.fecha,
            exonerada_mora: Number(v.exonerada_mora) === 1
        });
        totalPendiente += redondearDinero(capital + mora);
        if (vencido) totalMorosidad += redondearDinero(capital + mora);
    }

    const totalPendienteSolo = redondearDinero(
        enriquecidos.reduce(function(a, v) { return a + Number(v.saldo_pendiente); }, 0)
    );
    const totalMoraPendiente = redondearDinero(
        enriquecidos.reduce(function(a, v) { return a + Number(v.mora_pendiente); }, 0)
    );

    return {
        kpis: {
            total_pendiente: redondearDinero(totalPendiente),
            total_capital_pendiente: totalPendienteSolo,
            total_mora_pendiente: totalMoraPendiente,
            vales_activos: enriquecidos.length,
            vales_vencidos: enriquecidos.filter(function(v) { return v.vencido; }).length,
            socios_con_deuda: new Set(enriquecidos.map(function(v) { return v.cliente_socio; })).size
        },
        vales: enriquecidos
    };
}

async function crearCuentaDesdeMesa(idMesa, clienteSocio, total, idUsuario, datos) {
    return crearVale(clienteSocio, idMesa, total, idUsuario, datos);
}

async function liberarValeDeMesa(idMesa) {
    return true;
}

async function calcularMoraVale(vale, fechaHasta) {
    const hoy = fechaHasta ? new Date(fechaHasta) : new Date();
    const venc = vale.fecha_vencimiento ? new Date(String(vale.fecha_vencimiento).replace(/-/g, '/')) : null;
    if (!venc || venc > hoy) return { mora: 0, dias_mora: 0 };

    const diasMora = Math.floor((hoy - venc) / 86400000);
    if (diasMora <= 0) return { mora: 0, dias_mora: 0 };

    if (Number(vale.exonerada_mora) === 1) {
        return { mora: Number(vale.mora_acumulada || 0) - Number(vale.mora_pagada || 0), dias_mora: diasMora, exonerado: true };
    }

    const saldoCapital = Math.max(0, Number(vale.saldo_pendiente || 0));
    const tasa = Number(vale.tasa_mora || 0);
    let mora = 0;

    if (vale.tipo_mora === 'fijo') {
        mora = Math.max(0, Number(vale.mora_acumulada || 0));
        if (mora <= 0) mora = tasa;
    } else if (vale.tipo_mora === 'mensual') {
        const meses = diasMora / 30;
        mora = saldoCapital * (tasa / 100) * meses;
    } else {
        mora = saldoCapital * (tasa / 100) * diasMora;
    }

    const yaAcumulada = Math.max(0, Number(vale.mora_acumulada || 0) - Number(vale.mora_pagada || 0));
    mora = Math.max(mora, yaAcumulada);
    return { mora: redondearDinero(mora), dias_mora: diasMora };
}

async function abonarVale(idVale, monto, datos) {
    datos = datos || {};
    const conexion = await pool.getConnection();
    try {
        await conexion.beginTransaction();

        const [rows] = await conexion.query(
            'SELECT * FROM cuentas_por_cobrar WHERE id_vale = ?',
            [idVale]
        );
        if (rows.length === 0) throw new Error('Vale no encontrado');
        const vale = rows[0];
        if (vale.estado === 'Liquidado' && Number(vale.saldo_pendiente) <= 0) {
            throw new Error('El vale ' + idVale + ' ya esta liquidado');
        }

        const montoAbono = redondearDinero(monto);
        const totalPendiente = redondearDinero(Number(vale.saldo_pendiente) + Number(vale.mora_acumulada) - Number(vale.mora_pagada));
        if (montoAbono > totalPendiente) {
            throw new Error('El abono supera el total pendiente del vale ($' + totalPendiente.toFixed(2) + ')');
        }

        const moraCalc = await calcularMoraVale(vale, null);
        const moraPendiente = redondearDinero(moraCalc.mora);

        let montoMora = Math.min(moraPendiente, montoAbono);
        let montoCapital = redondearDinero(montoAbono - montoMora);

        const saldoAnterior = Number(vale.saldo_pendiente);
        const moraPagadaAnterior = Number(vale.mora_pagada || 0);

        const nuevoSaldo = Math.max(0, redondearDinero(saldoAnterior - montoCapital));
        const nuevaMoraPagada = redondearDinero(moraPagadaAnterior + montoMora);
        const nuevoEstado = (nuevoSaldo <= 0 && (Number(vale.mora_acumulada || 0) - nuevaMoraPagada) <= 0) ? 'Liquidado' : 'Parcial';

        await conexion.query(
            `UPDATE cuentas_por_cobrar
                SET saldo_pendiente = ?,
                    capital_pagado = COALESCE(capital_pagado, 0) + ?,
                    mora_pagada = ?,
                    estado = ?
             WHERE id_vale = ?`,
            [nuevoSaldo, montoCapital, nuevaMoraPagada, nuevoEstado, idVale]
        );

        await conexion.query(
            `INSERT INTO abonos_vales
                (id_vale, monto_abono, monto_capital, monto_mora, metodo_pago, sub_metodo_pago, referencia, id_usuario, id_jornada)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [idVale, montoAbono, montoCapital, montoMora,
             datos.metodo_pago || 'Efectivo', datos.sub_metodo_pago || null,
             datos.referencia || null, datos.id_usuario || null, datos.id_jornada || null]
        );

        await conexion.commit();
        return {
            saldo_anterior: saldoAnterior,
            saldo_nuevo: nuevoSaldo,
            monto_abono: montoAbono,
            monto_capital: montoCapital,
            monto_mora: montoMora,
            mora_pagada_total: nuevaMoraPagada,
            estado: nuevoEstado
        };
    } catch (error) {
        await conexion.rollback();
        throw error;
    } finally {
        conexion.release();
    }
}

async function liquidarVale(idVale, datos) {
    datos = datos || {};
    const conexion = await pool.getConnection();
    try {
        await conexion.beginTransaction();

        const [rows] = await conexion.query(
            'SELECT * FROM cuentas_por_cobrar WHERE id_vale = ?',
            [idVale]
        );
        if (rows.length === 0) throw new Error('Vale no encontrado');
        const vale = rows[0];

        const moraCalc = await calcularMoraVale(vale, null);
        const moraPendiente = redondearDinero(moraCalc.mora);
        const capitalPendiente = Math.max(0, Number(vale.saldo_pendiente));
        const total = redondearDinero(capitalPendiente + moraPendiente);

        const nuevaMoraPagada = redondearDinero(Number(vale.mora_pagada || 0) + moraPendiente);

        await conexion.query(
            `UPDATE cuentas_por_cobrar
                SET saldo_pendiente = 0,
                    capital_pagado = COALESCE(capital_pagado, 0) + ?,
                    mora_pagada = ?,
                    estado = 'Liquidado'
             WHERE id_vale = ?`,
            [capitalPendiente, nuevaMoraPagada, idVale]
        );

        await conexion.query(
            `INSERT INTO abonos_vales
                (id_vale, monto_abono, monto_capital, monto_mora, metodo_pago, sub_metodo_pago, referencia, id_usuario, id_jornada)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [idVale, total, capitalPendiente, moraPendiente,
             datos.metodo_pago || 'Efectivo', datos.sub_metodo_pago || null,
             datos.referencia || null, datos.id_usuario || null, datos.id_jornada || null]
        );

        await conexion.commit();
        return {
            id_vale: idVale,
            monto_total: total,
            monto_capital: capitalPendiente,
            monto_mora: moraPendiente,
            estado: 'Liquidado'
        };
    } catch (error) {
        await conexion.rollback();
        throw error;
    } finally {
        conexion.release();
    }
}

async function exonerarMoraVale(idVale, exonerar, idUsuario) {
    await pool.query(
        `UPDATE cuentas_por_cobrar
            SET exonerada_mora = ?, fecha_exencion = NOW(), id_usuario_exencion = ?
         WHERE id_vale = ?`,
        [exonerar ? 1 : 0, exonerar ? (idUsuario || null) : null, idVale]
    );
    return { exonerada_mora: exonerar };
}

async function registrarIngresoAbonoCaja(idJornada, idVale, montoCapital, montoMora, idUsuario, metodoPago) {
    const conceptoBase = 'Vale #' + idVale + ' (' + (metodoPago || 'Efectivo') + ')';
    if (montoCapital > 0) {
        await pool.query(
            `INSERT INTO movimientos_caja (id_jornada, id_usuario, tipo, categoria, concepto, monto, justificacion)
             VALUES (?, ?, 'Ingreso', 'Abono vales / Cartera', ?, ?, 'Capital devuelto')`,
            [idJornada, idUsuario || null, conceptoBase, montoCapital]
        );
    }
    if (montoMora > 0) {
        await pool.query(
            `INSERT INTO movimientos_caja (id_jornada, id_usuario, tipo, categoria, concepto, monto, justificacion)
             VALUES (?, ?, 'Ingreso', 'Mora / Intereses por mora', ?, ?, 'Intereses por mora')`,
            [idJornada, idUsuario || null, conceptoBase, montoMora]
        );
    }
}

async function obtenerAbonosVale(idVale) {
    const [rows] = await pool.query(`
        SELECT ab.*, u.nombre AS usuario_nombre
        FROM abonos_vales ab
        LEFT JOIN usuarios u ON ab.id_usuario = u.id_usuario
        WHERE ab.id_vale = ?
        ORDER BY ab.fecha DESC
    `, [idVale]);
    return rows;
}

module.exports = {
    crearVale,
    valesPendientes,
    obtenerClientesSocios,
    crearClienteSocio,
    actualizarClienteSocio,
    toggleClienteSocio,
    resumenCartera,
    crearCuentaDesdeMesa,
    liberarValeDeMesa,
    calcularMoraVale,
    abonarVale,
    liquidarVale,
    exonerarMoraVale,
    registrarIngresoAbonoCaja,
    obtenerAbonosVale
};
