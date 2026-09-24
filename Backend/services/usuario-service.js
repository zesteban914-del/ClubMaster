const { pool } = require('../config/database');
const security = require('../middlewares/security');

async function obtenerUsuarios() {
    const [rows] = await pool.query(`
        SELECT u.*, r.nombre AS rol_nombre
        FROM usuarios u
        LEFT JOIN roles r ON u.id_rol = r.id_rol
        ORDER BY u.id_usuario ASC
    `);
    return rows;
}

async function crearUsuario(nombre, correo, contrasena, idRol) {
    const hash = await security.hashContrasena(contrasena);
    const [result] = await pool.query(
        'INSERT INTO usuarios (nombre, correo, contrasena, id_rol, activo) VALUES (?, ?, ?, ?, 1)',
        [nombre, correo, hash, idRol]
    );
    return { id_usuario: result.insertId };
}

async function actualizarUsuario(id, nombre, correo, idRol) {
    await pool.query(
        'UPDATE usuarios SET nombre = ?, correo = ?, id_rol = ? WHERE id_usuario = ?',
        [nombre, correo, idRol, id]
    );
}

async function actualizarContrasena(id, contrasena) {
    const hash = await security.hashContrasena(contrasena);
    await pool.query('UPDATE usuarios SET contrasena = ? WHERE id_usuario = ?', [hash, id]);
}

async function toggleUsuario(id, activo) {
    await pool.query('UPDATE usuarios SET activo = ? WHERE id_usuario = ?', [activo, id]);
}

async function obtenerRoles() {
    const [rows] = await pool.query('SELECT * FROM roles ORDER BY id_rol ASC');
    return rows;
}

async function crearRol(nombre, descripcion) {
    const [r] = await pool.query('INSERT INTO roles (nombre, descripcion) VALUES (?, ?)', [nombre, descripcion || '']);
    return { id_rol: r.insertId };
}
async function actualizarRol(id, nombre, descripcion) {
    const sets = []; const vals = [];
    if (nombre !== undefined) { sets.push('nombre = ?'); vals.push(nombre); }
    if (descripcion !== undefined) { sets.push('descripcion = ?'); vals.push(descripcion); }
    if (!sets.length) return;
    vals.push(id);
    await pool.query('UPDATE roles SET ' + sets.join(', ') + ' WHERE id_rol = ?', vals);
}
async function eliminarRol(id) {
    const [u] = await pool.query('SELECT COUNT(*) as c FROM usuarios WHERE id_rol = ?', [id]);
    if (u[0].c > 0) throw new Error('No se puede eliminar: hay usuarios con este rol');
    await pool.query('DELETE FROM rol_permisos WHERE id_rol = ?', [id]);
    await pool.query('DELETE FROM roles WHERE id_rol = ?', [id]);
}
async function obtenerPermisos() {
    const [rows] = await pool.query('SELECT * FROM permisos ORDER BY id_permiso ASC');
    return rows;
}
async function obtenerPermisosPorRol(idRol) {
    const [rows] = await pool.query('SELECT p.* FROM permisos p JOIN rol_permisos rp ON rp.id_permiso=p.id_permiso WHERE rp.id_rol=?', [idRol]);
    return rows;
}
async function guardarPermisosRol(idRol, idsPermisos) {
    await pool.query('DELETE FROM rol_permisos WHERE id_rol=?', [idRol]);
    for (const pid of (idsPermisos || [])) {
        await pool.query('INSERT INTO rol_permisos (id_rol, id_permiso) VALUES (?, ?)', [idRol, pid]);
    }
}

async function obtenerUsuarioPorCorreoConHash(correo) {
    const [rows] = await pool.query(
        `SELECT u.id_usuario, u.nombre, u.correo, u.contrasena, u.activo,
                u.id_rol, COALESCE(r.nombre, 'Sin rol') AS rol
         FROM usuarios u
         LEFT JOIN roles r ON u.id_rol = r.id_rol
         WHERE u.correo = ?`,
        [correo]
    );
    return rows[0] || null;
}

async function obtenerUsuarioPorCorreo(correo) {
    const [rows] = await pool.query(
        'SELECT id_usuario, nombre, correo, activo FROM usuarios WHERE correo = ?',
        [correo]
    );
    return rows[0] || null;
}

async function guardarTokenRecuperacion(idUsuario, tokenHash, expiraEn) {
    await pool.query(
        'UPDATE password_reset_tokens SET usado = 1 WHERE id_usuario = ?',
        [idUsuario]
    );
    await pool.query(
        'INSERT INTO password_reset_tokens (id_usuario, token_hash, expira_en) VALUES (?, ?, ?)',
        [idUsuario, tokenHash, expiraEn]
    );
}

async function buscarTokenRecuperacion(tokenHash) {
    const [rows] = await pool.query(
        `SELECT id, id_usuario, token_hash, expira_en
         FROM password_reset_tokens
         WHERE token_hash = ? AND usado = 0 AND expira_en > NOW()
         ORDER BY id DESC
         LIMIT 1`,
        [tokenHash]
    );
    return rows[0] || null;
}

async function marcarTokenUsado(idToken) {
    await pool.query(
        'UPDATE password_reset_tokens SET usado = 1 WHERE id = ?',
        [idToken]
    );
}

module.exports = {
    obtenerUsuarios,
    crearUsuario,
    actualizarUsuario,
    actualizarContrasena,
    toggleUsuario,
    obtenerRoles,
    crearRol,
    actualizarRol,
    eliminarRol,
    obtenerPermisos,
    obtenerPermisosPorRol,
    guardarPermisosRol,
    obtenerUsuarioPorCorreoConHash,
    obtenerUsuarioPorCorreo,
    guardarTokenRecuperacion,
    buscarTokenRecuperacion,
    marcarTokenUsado
};
