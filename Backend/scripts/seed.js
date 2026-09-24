const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { pool } = require('../config/database');

async function seed() {
    const connection = await pool.getConnection();
    try {
        console.log('Iniciando seed de datos iniciales...');

        // ---- Catalogo de metodos de pago ----
        var metodosBase = [
            ['Efectivo', 'Efectivo', 'Efectivo', 'bi-cash', '#10b981'],
            ['Nequi', 'Nequi', 'Wallet', 'bi-phone', '#3b82f6'],
            ['Daviplata', 'Daviplata', 'Wallet', 'bi-phone', '#0e7490'],
            ['BreB', 'Bre-B / QR', 'Wallet', 'bi-qr-code-scan', '#7c3aed'],
            ['Debito', 'Tarjeta Debito', 'Tarjeta', 'bi-credit-card', '#8b5cf6'],
            ['Credito', 'Tarjeta Credito', 'Tarjeta', 'bi-credit-card-2-front', '#a855f7'],
            ['Vale', 'Vale / Credito de la casa', 'Credito', 'bi-wallet2', '#f59e0b'],
            ['Cortesia', 'Cortesia / Obsequio', 'Credito', 'bi-gift', '#ec4899']
        ];
        for (var i = 0; i < metodosBase.length; i++) {
            var mp = metodosBase[i];
            await connection.query(
                'INSERT IGNORE INTO metodos_pago (codigo, nombre, categoria, icono, color) VALUES (?, ?, ?, ?, ?)',
                mp
            );
        }
        console.log('Metodos de pago sembrados.');

        // ---- Categorias de licores ----
        var categoriasBase = ['General', 'Whisky', 'Ron', 'Aguardiente', 'Vodka', 'Tequila', 'Ginebra',
            'Vino', 'Champaña', 'Licores cremosos', 'Licores de frutas', 'Aperitivos',
            'Cervezas', 'Cócteles', 'Bebidas energizantes'];
        for (var i = 0; i < categoriasBase.length; i++) {
            await connection.query(
                'INSERT IGNORE INTO categorias (nombre) VALUES (?)',
                [categoriasBase[i]]
            );
        }
        console.log('Categorias sembradas.');

        // ---- Zonas ----
        await connection.query(
            "INSERT IGNORE INTO zonas (nombre, descripcion, color, orden) VALUES (?, ?, ?, ?)",
            ['VIP', 'Zona VIP / Camarotes', '#8b5cf6', 1]
        );
        await connection.query(
            "INSERT IGNORE INTO zonas (nombre, descripcion, color, orden) VALUES (?, ?, ?, ?)",
            ['Pista Principal', 'Pista de baile / Salon central', '#3b82f6', 2]
        );
        await connection.query(
            "INSERT IGNORE INTO zonas (nombre, descripcion, color, orden) VALUES (?, ?, ?, ?)",
            ['Barra', 'Cerca de la barra', '#f59e0b', 3]
        );
        await connection.query(
            "INSERT IGNORE INTO zonas (nombre, descripcion, color, orden) VALUES (?, ?, ?, ?)",
            ['Terraza', 'Terraza exterior', '#10b981', 4]
        );
        console.log('Zonas sembradas.');

        // ---- Presentaciones ----
        await connection.query("INSERT IGNORE INTO presentaciones (nombre, descripcion, factor) VALUES (?, ?, ?)", ['Botella', 'Botella completa', 1.000]);
        await connection.query("INSERT IGNORE INTO presentaciones (nombre, descripcion, factor) VALUES (?, ?, ?)", ['Trago / Copa', 'Porcion individual', 0.125]);
        console.log('Presentaciones sembradas.');

        // ---- Notas de preparacion ----
        var notasBase = ['Sin hielo', 'Mucho hielo', 'Sin limon', 'Con limon', 'Bien servido', 'Poco licuado', 'En vaso alto', 'En vaso corto', 'Separado'];
        for (var ni = 0; ni < notasBase.length; ni++) {
            await connection.query("INSERT IGNORE INTO notas_preparacion (texto) VALUES (?)", [notasBase[ni]]);
        }
        console.log('Notas de preparacion sembradas.');

        // ---- Configuracion de inventario ----
        var segConfigBase = [
            ['iva_global', '19', 'IVA porcentual por defecto aplicado en compras'],
            ['ico_global', '0', 'ICO porcentual por defecto aplicado en compras'],
            ['analisis_dias_muertos', '30', 'Dias sin venta para considerar un producto como stock muerto'],
            ['requiere_admin_ajuste_precios', '1', 'Restringir el ajuste masivo de precios a administradores'],
            ['requiere_admin_config', '1', 'Restringir la configuracion avanzada a administradores'],
            ['requiere_admin_mermas', '1', 'Restringir el registro de mermas a administradores']
        ];
        for (var cfgBase = 0; cfgBase < segConfigBase.length; cfgBase++) {
            var cfgK = segConfigBase[cfgBase];
            await connection.query(
                'INSERT IGNORE INTO configuracion_inventario (clave, valor, descripcion) VALUES (?, ?, ?)',
                cfgK
            );
        }
        console.log('Configuracion de inventario sembrada.');

        // ---- Unidades de medida ----
        var unidadesBase = [
            ['Unidad', 'Und', 'Unidad'],
            ['Botella', 'Bot', 'Unidad'],
            ['Trago / Copa', 'Trg', 'Unidad'],
            ['Caja', 'Cj', 'Unidad'],
            ['Mililitro', 'ml', 'Volumen'],
            ['Litro', 'L', 'Volumen'],
            ['Gramo', 'g', 'Peso'],
            ['Kilogramo', 'kg', 'Peso']
        ];
        for (var ub = 0; ub < unidadesBase.length; ub++) {
            await connection.query(
                'INSERT IGNORE INTO unidades_medida (nombre, abreviacion, tipo) VALUES (?, ?, ?)',
                unidadesBase[ub]
            );
        }
        console.log('Unidades de medida sembradas.');

        // ---- Conversiones ----
        var conversionesBase = [
            ['Botella', 'Trago / Copa', 16],
            ['Botella', 'Mililitro', 750],
            ['Caja', 'Botella', 12],
            ['Litro', 'Mililitro', 1000],
            ['Kilogramo', 'Gramo', 1000]
        ];
        for (var cb = 0; cb < conversionesBase.length; cb++) {
            await connection.query(
                'INSERT IGNORE INTO conversiones (unidad_origen, unidad_destino, factor) VALUES (?, ?, ?)',
                conversionesBase[cb]
            );
        }
        console.log('Conversiones sembradas.');

        // ---- Roles ----
        await connection.query(`
            INSERT INTO roles (id_rol, nombre) VALUES
            (1, 'Administrador'),
            (2, 'Gerente'),
            (3, 'Mesero'),
            (4, 'Cajero')
            ON DUPLICATE KEY UPDATE nombre = nombre
        `);
        console.log('Roles sembrados.');

        // ---- Usuarios demo ----
        const bcrypt = require('bcryptjs');
        const hash = await bcrypt.hash('1234', 10);
        await connection.query(`
            INSERT INTO usuarios (nombre, correo, contrasena, id_rol, activo) VALUES
            ('Administrador', 'admin@gmail.com', ?, 1, 1),
            ('Carlos Perez', 'carlos@gmail.com', ?, 3, 1),
            ('Laura Gomez', 'laura@gmail.com', ?, 3, 1),
            ('Juan Rodriguez', 'juan@gmail.com', ?, 2, 1),
            ('Pedro Martinez', 'pedro@gmail.com', ?, 4, 1)
            ON DUPLICATE KEY UPDATE nombre = nombre
        `, [hash, hash, hash, hash, hash]);
        console.log('Usuarios demo sembrados.');

        console.log('Seed completado exitosamente.');
    } catch (error) {
        console.error('Error en seed:', error.message);
        throw error;
    } finally {
        connection.release();
    }
}

if (require.main === module) {
    seed()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = { seed };
