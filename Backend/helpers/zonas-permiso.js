// =========================================================
// zonas-permiso.js
// Fuente de verdad (backend) para permisos por zona en mesas.
// Relacion rol -> zonas editable en tabla `rol_zonas_permiso`
// (no hardcodeada en el frontend). Si un rol no tiene zonas
// configuradas, se bloquea todo por defecto (nunca dejar pasar).
//
// Tipos de accion:
//  - 'estructura': crear mesa, editar (nombre/capacidad/zona),
//    cambiar zona, activar/desactivar (inhabilitar).
//  - 'operativa': atender/abrir mesa (crear pedido), ver cuenta/
//    estado, cancelar, unir/mover mesas.
//
// Matriz por defecto (se siembra en `rol_zonas_permiso`):
//  - administrador / gerente: todas las zonas, sin restriccion.
//  - cajero: estructura NINGUNA (solo opera/cobra), operativa todas.
//  - bartender (barra): estructura y operativa solo zona Barra.
//  - mesero: estructura y operativa todas EXCEPTO Barra.
// =========================================================
const { pool } = require('../config/database');

const TABLA_PERMISOS = 'rol_zonas_permiso';
const TABLA_BLOQUEOS = 'zona_bloqueos_log';

let _cache = null;
let _cacheTs = 0;
const CACHE_MS = 60 * 1000;

function normalizarZona(z) {
    return String(z == null ? '' : z).trim().toLowerCase();
}

function esZonaBarra(z) {
    return normalizarZona(z).indexOf('barra') !== -1;
}

// Clave canonica del rol a partir del usuario de sesion.
function claveRol(usuario) {
    const u = usuario || {};
    const idRol = Number(u.id_rol);
    const r = String(u.rol || u.nombre_rol || '').toLowerCase();
    if (idRol === 1 || r === 'administrador' || r === 'admin' || r.indexOf('admin') !== -1) return 'administrador';
    if (idRol === 9 || r.indexOf('gerente') !== -1 || r.indexOf('supervisor') !== -1) return 'gerente';
    if (r.indexOf('cajer') !== -1) return 'cajero';
    if (idRol === 7 || r.indexOf('bartender') !== -1 || r.indexOf('barman') !== -1 || (r.indexOf('barra') !== -1 && r.indexOf('embaraz') === -1)) return 'bartender';
    if (idRol === 3 || r.indexOf('meser') !== -1) return 'mesero';
    return 'desconocido';
}

function esAdminOGerente(usuario) {
    const c = claveRol(usuario);
    return c === 'administrador' || c === 'gerente';
}

// Matriz por defecto cuando la tabla aun no existe o no tiene filas.
function matrizDefecto(clave, zona) {
    const zb = esZonaBarra(zona);
    switch (clave) {
        case 'administrador':
        case 'gerente':
            return { estructura: true, operativa: true };
        case 'cajero':
            return { estructura: false, operativa: true };
        case 'bartender':
            return { estructura: zb, operativa: zb };
        case 'mesero':
            return { estructura: !zb, operativa: !zb };
        default:
            return { estructura: false, operativa: false };
    }
}

async function asegurarTablas() {
    await pool.query(
        'CREATE TABLE IF NOT EXISTS `' + TABLA_PERMISOS + '` (' +
        'id INT AUTO_INCREMENT PRIMARY KEY, ' +
        'rol_clave VARCHAR(40) NOT NULL, ' +
        'zona VARCHAR(80) NOT NULL, ' +
        'permite_estructura TINYINT(1) NOT NULL DEFAULT 0, ' +
        'permite_operativa TINYINT(1) NOT NULL DEFAULT 0, ' +
        'UNIQUE KEY uq_rol_zona (rol_clave, zona)' +
        ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
    );
    await pool.query(
        'CREATE TABLE IF NOT EXISTS `' + TABLA_BLOQUEOS + '` (' +
        'id INT AUTO_INCREMENT PRIMARY KEY, ' +
        'fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, ' +
        'id_usuario INT NULL, ' +
        'usuario_nombre VARCHAR(120) NULL, ' +
        'rol VARCHAR(80) NULL, ' +
        'accion VARCHAR(80) NOT NULL, ' +
        'id_mesa VARCHAR(20) NULL, ' +
        'zona VARCHAR(80) NULL, ' +
        'ip VARCHAR(45) NULL, ' +
        'KEY idx_zb_fecha (fecha), KEY idx_zb_usuario (id_usuario)' +
        ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
    );
}

async function zonasCatalogo() {
    try {
        const [rows] = await pool.query('SELECT nombre FROM zonas ORDER BY orden ASC, nombre ASC');
        return rows.map(function (r) { return r.nombre; });
    } catch (e) { return []; }
}

async function sembrarDefectos() {
    try {
        const [n] = await pool.query('SELECT COUNT(*) AS c FROM `' + TABLA_PERMISOS + '`');
        if (n[0].c > 0) return;
        const zonas = await zonasCatalogo();
        const lista = zonas.length ? zonas : ['VIP', 'Pista Principal', 'Barra', 'Terraza'];
        const roles = ['administrador', 'gerente', 'cajero', 'bartender', 'mesero'];
        for (const rol of roles) {
            for (const z of lista) {
                const m = matrizDefecto(rol, z);
                await pool.query(
                    'INSERT IGNORE INTO `' + TABLA_PERMISOS + '` (rol_clave, zona, permite_estructura, permite_operativa) VALUES (?,?,?,?)',
                    [rol, z, m.estructura ? 1 : 0, m.operativa ? 1 : 0]
                );
            }
        }
        console.log('[zonas-permiso] seed rol_zonas_permiso con matriz por defecto');
    } catch (e) {
        console.warn('[zonas-permiso] seed omitido:', e.message);
    }
}

async function cargarMapa() {
    const ahora = Date.now();
    if (_cache && (ahora - _cacheTs) < CACHE_MS) return _cache;
    try {
        await asegurarTablas();
        await sembrarDefectos();
        const [rows] = await pool.query('SELECT rol_clave, zona, permite_estructura, permite_operativa FROM `' + TABLA_PERMISOS + '`');
        _cache = rows;
        _cacheTs = ahora;
        return rows;
    } catch (e) {
        return null; // sin tabla: usar matriz por defecto en memoria
    }
}

function buscarEnMapa(mapa, clave, zona) {
    const zn = normalizarZona(zona);
    const hit = (mapa || []).find(function (r) {
        return String(r.rol_clave) === clave && normalizarZona(r.zona) === zn;
    });
    return hit || null;
}

// ¿Puede el usuario actuar (tipo) sobre la zona? Nunca dejar pasar por defecto.
async function puedeEnZona(usuario, zona, tipo) {
    const clave = claveRol(usuario);
    if (!zona || !normalizarZona(zona)) {
        // Mesa sin zona: solo admin/gerente pasan; el resto se bloquea con aviso.
        return esAdminOGerente(usuario);
    }
    const mapa = await cargarMapa();
    if (mapa) {
        const hit = buscarEnMapa(mapa, clave, zona);
        if (!hit) {
            // Rol sin zonas configuradas: bloquear todo por defecto.
            if (clave === 'administrador' || clave === 'gerente') return true;
            return false;
        }
        return tipo === 'estructura' ? Number(hit.permite_estructura) === 1 : Number(hit.permite_operativa) === 1;
    }
    const m = matrizDefecto(clave, zona);
    return tipo === 'estructura' ? m.estructura : m.operativa;
}

// Lista de zonas permitidas (nombres tal cual estan en catalogo/DB).
async function zonasPermitidas(usuario, tipo) {
    const clave = claveRol(usuario);
    if (clave === 'administrador' || clave === 'gerente') return 'todas';
    const mapa = await cargarMapa();
    const zonas = await zonasCatalogo();
    const base = zonas.length ? zonas : ['VIP', 'Pista Principal', 'Barra', 'Terraza'];
    if (!mapa) return base.filter(function (z) { return matrizDefecto(clave, z)[tipo === 'estructura' ? 'estructura' : 'operativa']; });
    return base.filter(function (z) {
        const hit = buscarEnMapa(mapa, clave, z);
        if (!hit) return false;
        return tipo === 'estructura' ? Number(hit.permite_estructura) === 1 : Number(hit.permite_operativa) === 1;
    });
}

async function zonaDeMesa(idMesa) {
    try {
        const [rows] = await pool.query(
            'SELECT zona FROM mesas WHERE id_mesa = ? OR numero = ? LIMIT 1',
            [Number(idMesa) || 0, String(idMesa)]
        );
        return rows.length ? (rows[0].zona || '') : null; // null = mesa no existe
    } catch (e) { return ''; }
}

function ipDeReq(req) {
    try {
        const f = String((req.headers && req.headers['x-forwarded-for']) || '').split(',')[0].trim();
        return f || req.ip || null;
    } catch (e) { return null; }
}

async function registrarBloqueo(req, datos) {
    const u = (req.session && req.session.usuario) || {};
    const linea = '[zona-bloqueada] usuario=' + (u.nombre || u.correo || u.id_usuario || '?') +
        ' rol=' + (u.rol || u.id_rol || '?') +
        ' accion=' + datos.accion + ' mesa=' + (datos.mesaId == null ? '-' : datos.mesaId) +
        ' zona=' + (datos.zona || '(sin zona)');
    console.warn(linea);
    try {
        await asegurarTablas();
        await pool.query(
            'INSERT INTO `' + TABLA_BLOQUEOS + '` (id_usuario, usuario_nombre, rol, accion, id_mesa, zona, ip) VALUES (?,?,?,?,?,?,?)',
            [u.id_usuario || u.id || null, u.nombre || null, u.rol || null, datos.accion, datos.mesaId == null ? null : String(datos.mesaId), datos.zona || null, ipDeReq(req)]
        );
    } catch (e) { /* el console.warn ya dejo constancia */ }
}

// Responde 403 con mensaje claro y deja constancia en el log.
async function negarPorZona(req, res, datos) {
    await registrarBloqueo(req, datos);
    const zonaTxt = datos.zona ? ' "' + datos.zona + '"' : ' de esta zona';
    return res.status(403).json({
        success: false,
        codigo: 'ZONA_NO_PERMITIDA',
        mensaje: 'No tienes permiso sobre la zona' + zonaTxt + '. Acción "' + datos.accion + '" bloqueada para tu rol.'
    });
}

// Rol de atencion requerido segun la zona (punto de cruce mesero/cajero).
function rolAtiendeRequerido(zona) {
    return esZonaBarra(zona) ? 'bartender' : 'mesero';
}

function esRolAtiendeValido(rolNombre, idRol, requerido) {
    const r = String(rolNombre || '').toLowerCase();
    if (requerido === 'bartender') {
        return Number(idRol) === 7 || r.indexOf('bartender') !== -1 || r.indexOf('barman') !== -1;
    }
    return Number(idRol) === 3 || r.indexOf('meser') !== -1;
}

module.exports = {
    normalizarZona,
    esZonaBarra,
    claveRol,
    esAdminOGerente,
    puedeEnZona,
    zonasPermitidas,
    zonaDeMesa,
    registrarBloqueo,
    negarPorZona,
    rolAtiendeRequerido,
    esRolAtiendeValido,
    asegurarTablas,
    sembrarDefectos
};
