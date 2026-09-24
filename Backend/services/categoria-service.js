const { pool } = require('../config/database');
const { mapearCategoria } = require('../helpers/db-helpers');
const { obtenerColumnasProductos } = require('../helpers/column-detection');

async function obtenerCategorias() {
    const c = obtenerColumnasProductos();
    const usaIdCat = c.lista.indexOf('id_categoria') !== -1;
    const sub = usaIdCat
        ? '(SELECT COUNT(*) FROM productos p WHERE p.id_categoria = cat.id_categoria AND p.activo = 1)'
        : '(SELECT COUNT(*) FROM productos p WHERE p.categoria = cat.nombre AND p.activo = 1)';
    const [rows] = await pool.query(
        'SELECT cat.*, ' + sub + ' AS num_productos FROM categorias cat ORDER BY cat.nombre ASC'
    );
    return rows;
}

async function crearCategoria(nombre) {
    const nom = (nombre || '').toString().trim();
    if (!nom) throw new Error('El nombre de la categoria es obligatorio');
    const [result] = await pool.query('INSERT INTO categorias (nombre) VALUES (?)', [nom]);
    return { id_categoria: result.insertId };
}

async function renombrarCategoria(id, nombre) {
    const nom = (nombre || '').toString().trim();
    if (!nom) throw new Error('El nombre de la categoria es obligatorio');
    await pool.query('UPDATE categorias SET nombre = ? WHERE id_categoria = ?', [nom, id]);
}

async function eliminarCategoria(id) {
    const c = obtenerColumnasProductos();
    const [cat] = await pool.query('SELECT nombre FROM categorias WHERE id_categoria = ?', [id]);
    if (cat.length === 0) return 0;
    const nombre = cat[0].nombre;
    if (nombre.trim().toLowerCase() === 'general') throw new Error('No se puede eliminar la categoria General');
    if (c.lista.indexOf('id_categoria') !== -1) {
        const idGeneral = await mapearCategoria(pool, 'General');
        await pool.query('UPDATE productos SET id_categoria = ? WHERE id_categoria = ?', [idGeneral, id]);
    } else {
        await pool.query("UPDATE productos SET categoria = 'General' WHERE categoria = ?", [nombre]);
    }
    const [result] = await pool.query('DELETE FROM categorias WHERE id_categoria = ?', [id]);
    return result.affectedRows;
}

module.exports = {
    obtenerCategorias,
    crearCategoria,
    renombrarCategoria,
    eliminarCategoria
};
