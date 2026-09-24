// =========================================================
// security.js
// Utilidades de seguridad: BCrypt, sesiones, rate limiting
// y tokens temporales para recuperacion de contrasena.
// =========================================================
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const COSTO_BCRYPT = 10;
const DURACION_TOKEN_MINUTOS = 15; // expiracion del token de recuperacion

// ------------------------------------------------------------------
// Hash de contrasena
// ------------------------------------------------------------------
async function hashContrasena(textoPlano) {
    return bcrypt.hash(textoPlano, COSTO_BCRYPT);
}

// Verifica una contrasena contra un hash BCrypt.
// Devuelve true si coincide.
async function verificarContrasena(textoPlano, hash) {
    try {
        return await bcrypt.compare(textoPlano, hash);
    } catch (e) {
        return false;
    }
}

// Indica si un valor almacenado parece ser un hash BCrypt ($2a$/$2b$/$2y$...).
// Usado para distinguir contraseñas aun en texto plano (migracion) de las ya encriptadas.
function esHashBCrypt(valor) {
    return typeof valor === 'string' && /^\$2[aby]\$/.test(valor);
}

// ------------------------------------------------------------------
// Tokens temporales
// ------------------------------------------------------------------
// Genera un token aleatorio seguro junto con su hash para almacenar en BD.
// Devuelve { token (para enviar al usuario), tokenHash (para guardar) }.
function generarTokenRecuperacion() {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    return { token, tokenHash };
}

// Hash de un token para compararlo contra la BD sin almacenarlo en claro.
function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

// Fecha UTC de expiracion de un token (suma los minutos de duracion).
function expiracionToken() {
    const ahora = new Date();
    ahora.setMinutes(ahora.getMinutes() + DURACION_TOKEN_MINUTOS);
    return ahora;
}

module.exports = {
    DURACION_TOKEN_MINUTOS,
    hashContrasena,
    verificarContrasena,
    esHashBCrypt,
    generarTokenRecuperacion,
    hashToken,
    expiracionToken
};
