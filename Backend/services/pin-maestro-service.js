// PIN maestro (gerente): se guarda SIEMPRE como hash bcrypt y NUNCA
// vuelve al navegador. Verifica tanto hashes nuevos como PINs legados en
// texto plano; al verificar un legado correcto se re-hashea en el acto
// (migracion perezosa: los datos existentes pasan a hash sin dejar la
// aplicacion sin PIN). Para migrar todo de una vez usar
// `npm run migrate:pin` (Backend/scripts/migrate-pin-hash.js).
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');

const COSTO_BCRYPT = 10;
const RE_BCRYPT = /^\$2[aby]\$\d{2}\$/;

function esHash(valor) {
    return RE_BCRYPT.test(String(valor || ''));
}

async function obtenerPinMaestro() {
    try {
        const [rows] = await pool.query("SELECT valor FROM configuracion_general WHERE clave='pin_maestro' LIMIT 1");
        return rows.length ? String(rows[0].valor || '') : '';
    } catch (e) {
        return '';
    }
}

async function pinMaestroConfigurado() {
    const guardado = await obtenerPinMaestro();
    return !!guardado.trim();
}

async function hashPinMaestro(pin) {
    return bcrypt.hash(String(pin), COSTO_BCRYPT);
}

// Compara el PIN ingresado con el valor guardado (hash o texto plano).
// Si coincide con un valor legado en claro, lo re-hashea en el momento
// para que la siguiente verificacion ya sea contra el hash.
async function verificarPinMaestro(pinIngresado) {
    const guardado = await obtenerPinMaestro();
    if (!guardado) return false;
    const ingresado = String(pinIngresado == null ? '' : pinIngresado);
    if (!ingresado) return false;
    let ok = false;
    if (esHash(guardado)) {
        ok = await bcrypt.compare(ingresado, guardado);
    } else {
        ok = ingresado === guardado;
    }
    if (ok && !esHash(guardado)) {
        try {
            const hash = await hashPinMaestro(ingresado);
            await pool.query("UPDATE configuracion_general SET valor=? WHERE clave='pin_maestro'", [hash]);
        } catch (e) {
            // Si no se puede escribir, el PIN sigue funcionando en texto plano
            // hasta la proxima oportunidad; no se bloquea la operacion.
        }
    }
    return ok;
}

// true si el PIN propuesto es el mismo que el guardado (hash o legado).
async function coincideConPinGuardado(pin) {
    const guardado = await obtenerPinMaestro();
    if (!guardado) return false;
    const propuesto = String(pin == null ? '' : pin);
    if (esHash(guardado)) return bcrypt.compare(propuesto, guardado);
    return propuesto === guardado;
}

module.exports = {
    esHash,
    obtenerPinMaestro,
    pinMaestroConfigurado,
    hashPinMaestro,
    verificarPinMaestro,
    coincideConPinGuardado
};
