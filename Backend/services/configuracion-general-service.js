const { pool } = require('../config/database');

async function obtenerConfiguracionGeneral() {
    const [rows] = await pool.query('SELECT clave, valor, descripcion FROM configuracion_general');
    const config = {};
    rows.forEach(function(r) { config[r.clave] = r.valor; });
    return config;
}

const PIN_DEBILES = ['1234', '0000'];
function validarPinMaestro(nuevo, actualEnDB) {
    const v = String(nuevo == null ? '' : nuevo).trim();
    if (!/^\d{4,6}$/.test(v)) { const e = new Error('El PIN debe tener 4 a 6 digitos numericos'); e.statusCode = 400; throw e; }
    if (PIN_DEBILES.indexOf(v) !== -1) { const e = new Error('PIN no permitido por seguridad (1234/0000). Elija otro'); e.statusCode = 400; throw e; }
    if (actualEnDB != null && String(actualEnDB) === v) { const e = new Error('El nuevo PIN no puede ser igual al anterior'); e.statusCode = 400; throw e; }
    return v;
}

async function guardarConfiguracionGeneral(datos) {
    if (!datos || typeof datos !== 'object') return { guardadas: 0 };
    const claves = Object.keys(datos).filter(function (k) { return k !== 'pin_actual_verificacion'; });
    if (Object.prototype.hasOwnProperty.call(datos, 'pin_maestro')) {
        const [rows] = await pool.query("SELECT valor FROM configuracion_general WHERE clave='pin_maestro' LIMIT 1");
        const actualEnDB = rows.length ? String(rows[0].valor || '') : '';
        const nuevoValidado = validarPinMaestro(datos.pin_maestro, actualEnDB || null);
        if (actualEnDB) {
            const verif = String(datos.pin_actual_verificacion == null ? '' : datos.pin_actual_verificacion).trim();
            if (!verif || verif !== actualEnDB) { const e = new Error('PIN actual incorrecto'); e.statusCode = 403; throw e; }
        }
        await pool.query(
            'INSERT INTO configuracion_general (clave, valor, descripcion) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)',
            ['pin_maestro', nuevoValidado, 'PIN maestro gerente (4-6 digitos)']
        );
    }
    let guardadas = Object.prototype.hasOwnProperty.call(datos, 'pin_maestro') ? 1 : 0;
    for (var i = 0; i < claves.length; i++) {
        const clave = claves[i];
        if (clave === 'pin_maestro') continue;
        const valor = String(datos[clave] == null ? '' : datos[clave]);
        await pool.query(
            'INSERT INTO configuracion_general (clave, valor) VALUES (?, ?)' +
            ' ON DUPLICATE KEY UPDATE valor = VALUES(valor)',
            [clave, valor]
        );
        guardadas++;
    }
    return { guardadas: guardadas };
}

module.exports = {
    obtenerConfiguracionGeneral,
    guardarConfiguracionGeneral
};
