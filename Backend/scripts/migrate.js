const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { pool } = require('../config/database');

async function agregarColumna(connection, tabla, columna, definicion) {
    try {
        const [cols] = await connection.query(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
            [process.env.DB_NAME || 'discoteca_db', tabla, columna]
        );
        if (cols.length === 0) {
            await connection.query(`ALTER TABLE \`${tabla}\` ADD COLUMN ${definicion}`);
            console.log(`Columna ${columna} agregada a ${tabla}.`);
        }
    } catch (e) {
        console.log(`Aviso (columna ${columna} en ${tabla}): ${e.message}`);
    }
}

async function migrate() {
    const connection = await pool.getConnection();
    try {
        console.log('Iniciando migraciones...');

        // ============================================================
        // TABLAS BASE
        // ============================================================

        await connection.query(`
            CREATE TABLE IF NOT EXISTS jornadas (
                id_jornada INT AUTO_INCREMENT PRIMARY KEY,
                fecha_apertura DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                fecha_cierre DATETIME NULL,
                monto_inicial DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                total_efectivo_esperado DECIMAL(10,2) DEFAULT 0.00,
                total_efectivo_real DECIMAL(10,2) DEFAULT 0.00,
                diferencia DECIMAL(10,2) DEFAULT 0.00,
                estado ENUM('Abierta', 'Cerrada') DEFAULT 'Abierta',
                id_usuario INT
            )
        `);
        console.log('Tabla jornadas verificada/creada.');

        // ---- Columnas de auditoria en jornadas ----
        await agregarColumna(connection, 'jornadas', 'fecha', 'fecha DATETIME NULL DEFAULT CURRENT_TIMESTAMP');
        await agregarColumna(connection, 'jornadas', 'fecha_cierre', 'fecha_cierre DATETIME NULL');
        await agregarColumna(connection, 'jornadas', 'fecha_apertura', 'fecha_apertura DATETIME NULL DEFAULT CURRENT_TIMESTAMP');
        await agregarColumna(connection, 'jornadas', 'monto_inicial', 'monto_inicial DECIMAL(10,2) NOT NULL DEFAULT 0.00');
        await agregarColumna(connection, 'jornadas', 'total_efectivo_esperado', 'total_efectivo_esperado DECIMAL(10,2) DEFAULT 0.00');
        await agregarColumna(connection, 'jornadas', 'total_efectivo_real', 'total_efectivo_real DECIMAL(10,2) DEFAULT 0.00');
        await agregarColumna(connection, 'jornadas', 'diferencia', 'diferencia DECIMAL(10,2) DEFAULT 0.00');
        await agregarColumna(connection, 'jornadas', 'conteo_fisico', 'conteo_fisico DECIMAL(10,2) DEFAULT 0.00');
        await agregarColumna(connection, 'jornadas', 'id_usuario_cierre', 'id_usuario_cierre INT NULL');
        await agregarColumna(connection, 'jornadas', 'ventas_brutas', 'ventas_brutas DECIMAL(10,2) NOT NULL DEFAULT 0.00');
        await agregarColumna(connection, 'jornadas', 'descuentos', 'descuentos DECIMAL(10,2) NOT NULL DEFAULT 0.00');
        await agregarColumna(connection, 'jornadas', 'cortesias', 'cortesias DECIMAL(10,2) NOT NULL DEFAULT 0.00');
        await agregarColumna(connection, 'jornadas', 'ventas_netas', 'ventas_netas DECIMAL(10,2) NOT NULL DEFAULT 0.00');
        await agregarColumna(connection, 'jornadas', 'propina_efectivo', 'propina_efectivo DECIMAL(10,2) NOT NULL DEFAULT 0.00');
        await agregarColumna(connection, 'jornadas', 'propina_tarjeta', 'propina_tarjeta DECIMAL(10,2) NOT NULL DEFAULT 0.00');
        await agregarColumna(connection, 'jornadas', 'ingresos_extra', 'ingresos_extra DECIMAL(10,2) NOT NULL DEFAULT 0.00');
        await agregarColumna(connection, 'jornadas', 'gastos_efectivo', 'gastos_efectivo DECIMAL(10,2) NOT NULL DEFAULT 0.00');
        await agregarColumna(connection, 'jornadas', 'conteo_fisico', 'conteo_fisico DECIMAL(10,2) NOT NULL DEFAULT 0.00');
        await agregarColumna(connection, 'jornadas', 'incluir_propina_caja', 'incluir_propina_caja TINYINT(1) NOT NULL DEFAULT 1');
        await agregarColumna(connection, 'jornadas', 'arqueo_ciego', 'arqueo_ciego TINYINT(1) NOT NULL DEFAULT 0');
        await agregarColumna(connection, 'jornadas', 'barra_asignada', "barra_asignada VARCHAR(80) NULL DEFAULT 'Caja Principal'");

        // ---- UNIQUE anti-duplicados: zonas(nombre), unidades_medida(nombre) ----
        // Sin estos indices, los INSERT IGNORE de los seeds no ignoran nada y cada
        // corrida duplica filas. Si hay duplicados, el ALTER falla: correr primero
        // `npm run clean:dupes` (Backend/scripts/clean-duplicates.js).
        async function agregarIndiceUnico(tabla, indice, columnas) {
            try {
                const [ex] = await connection.query(
                    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.STATISTICS
                     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?`,
                    [process.env.DB_NAME || 'discoteca_db', tabla, indice]
                );
                if (ex[0].c === 0) {
                    await connection.query(`ALTER TABLE \`${tabla}\` ADD UNIQUE INDEX \`${indice}\` (${columnas})`);
                    console.log(`Indice UNIQUE ${indice} creado en ${tabla}.`);
                }
            } catch (e) {
                console.log(`Aviso (UNIQUE ${indice} en ${tabla} no aplicado — probablemente hay duplicados, corre 'npm run clean:dupes'): ${e.message}`);
            }
        }
        await agregarIndiceUnico('zonas', 'uq_zonas_nombre', '`nombre`');
        await agregarIndiceUnico('unidades_medida', 'uq_unidades_nombre', '`nombre`');

        // ---- Columnas de detalle de pago en pedidos ----
        await agregarColumna(connection, 'pedidos', 'sub_metodo_pago', 'sub_metodo_pago VARCHAR(50) NULL');
        await agregarColumna(connection, 'pedidos', 'referencia_pago', 'referencia_pago VARCHAR(100) NULL');
        await agregarColumna(connection, 'pedidos', 'descuento', 'descuento DECIMAL(10,2) NOT NULL DEFAULT 0.00');
        await agregarColumna(connection, 'pedidos', 'es_cortesia', 'es_cortesia TINYINT(1) NOT NULL DEFAULT 0');
        await agregarColumna(connection, 'pedidos', 'propina', 'propina DECIMAL(10,2) NOT NULL DEFAULT 0.00');

        // ---- Catalogo de metodos de pago ----
        await connection.query(`
            CREATE TABLE IF NOT EXISTS metodos_pago (
                id_metodo INT AUTO_INCREMENT PRIMARY KEY,
                codigo VARCHAR(40) NOT NULL UNIQUE,
                nombre VARCHAR(60) NOT NULL,
                categoria ENUM('Efectivo','Wallet','Tarjeta','Credito') NOT NULL DEFAULT 'Wallet',
                icono VARCHAR(30) DEFAULT 'bi-phone',
                color VARCHAR(20) DEFAULT '#3b82f6',
                activo TINYINT(1) NOT NULL DEFAULT 1
            )
        `);
        console.log('Tabla metodos_pago verificada/creada.');

        // ---- Movimientos de caja chica ----
        await connection.query(`
            CREATE TABLE IF NOT EXISTS movimientos_caja (
                id_movimiento INT AUTO_INCREMENT PRIMARY KEY,
                id_jornada INT NOT NULL,
                id_usuario INT NULL,
                tipo ENUM('Ingreso','Egreso') NOT NULL,
                categoria VARCHAR(60) NOT NULL,
                concepto VARCHAR(200) DEFAULT '',
                monto DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                numero_comprobante VARCHAR(60) DEFAULT '',
                justificacion VARCHAR(255) DEFAULT '',
                fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                KEY idx_mov_jornada (id_jornada)
            )
        `);
        console.log('Tabla movimientos_caja verificada/creada.');

        // ---- Desglose monetario del arqueo ----
        await connection.query(`
            CREATE TABLE IF NOT EXISTS arqueos_detalle (
                id_arqueo INT AUTO_INCREMENT PRIMARY KEY,
                id_jornada INT NOT NULL,
                denominacion DECIMAL(10,2) NOT NULL,
                tipo ENUM('Billete','Moneda') NOT NULL,
                cantidad INT NOT NULL DEFAULT 0,
                valor DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                KEY idx_arqueo_jornada (id_jornada)
            )
        `);
        console.log('Tabla arqueos_detalle verificada/creada.');

        // Agregar columna metodo_pago a pedidos si no existe
        const [cols] = await connection.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'metodo_pago'`,
            [process.env.DB_NAME || 'discoteca_db']
        );
        if (cols.length === 0) {
            await connection.query(`ALTER TABLE pedidos ADD COLUMN metodo_pago VARCHAR(30) NULL AFTER total`);
            console.log('Columna metodo_pago agregada a pedidos.');
        }

        // Crear tabla proveedores
        await connection.query(`
            CREATE TABLE IF NOT EXISTS proveedores (
                id_proveedor INT AUTO_INCREMENT PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL,
                contacto VARCHAR(100),
                telefono VARCHAR(30),
                correo VARCHAR(100),
                direccion VARCHAR(200),
                activo TINYINT(1) DEFAULT 1,
                fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Tabla proveedores verificada/creada.');

        // Crear tabla compras
        await connection.query(`
            CREATE TABLE IF NOT EXISTS compras (
                id_compra INT AUTO_INCREMENT PRIMARY KEY,
                id_proveedor INT NOT NULL,
                id_usuario INT,
                fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
                numero_factura VARCHAR(50),
                total DECIMAL(10,2) DEFAULT 0.00,
                observaciones TEXT,
                FOREIGN KEY (id_proveedor) REFERENCES proveedores(id_proveedor)
            )
        `);
        console.log('Tabla compras verificada/creada.');

        // Crear tabla detalle_compras
        await connection.query(`
            CREATE TABLE IF NOT EXISTS detalle_compras (
                id_detalle INT AUTO_INCREMENT PRIMARY KEY,
                id_compra INT NOT NULL,
                id_producto INT NOT NULL,
                cantidad INT NOT NULL DEFAULT 1,
                costo_unitario DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                FOREIGN KEY (id_compra) REFERENCES compras(id_compra),
                FOREIGN KEY (id_producto) REFERENCES productos(id_producto)
            )
        `);
        console.log('Tabla detalle_compras verificada/creada.');

        // ============================================================
        // MIGRACION GESTION COMERCIAL DE PROVEEDORES
        // ============================================================

        await agregarColumna(connection, 'proveedores', 'nit', "nit VARCHAR(30) NULL");
        await agregarColumna(connection, 'proveedores', 'razon_social', "razon_social VARCHAR(150) NULL");
        await agregarColumna(connection, 'proveedores', 'categoria', "categoria VARCHAR(60) DEFAULT 'General'");
        await agregarColumna(connection, 'proveedores', 'dias_credito', "dias_credito INT DEFAULT 0");
        await agregarColumna(connection, 'proveedores', 'limite_credito', "limite_credito DECIMAL(12,2) DEFAULT 0.00");
        await agregarColumna(connection, 'proveedores', 'banco', "banco VARCHAR(100) NULL");
        await agregarColumna(connection, 'proveedores', 'tipo_cuenta', "tipo_cuenta VARCHAR(30) NULL");
        await agregarColumna(connection, 'proveedores', 'numero_cuenta', "numero_cuenta VARCHAR(50) NULL");
        console.log('Columnas fiscales/comerciales agregadas a proveedores.');

        await agregarColumna(connection, 'compras', 'forma_pago', "forma_pago ENUM('Contado','Credito') DEFAULT 'Contado'");
        await agregarColumna(connection, 'compras', 'dias_credito', "dias_credito INT DEFAULT 0");
        await agregarColumna(connection, 'compras', 'fecha_vencimiento', "fecha_vencimiento DATE NULL");
        await agregarColumna(connection, 'compras', 'metodo_pago', "metodo_pago VARCHAR(60) NULL");
        await agregarColumna(connection, 'compras', 'estado', "estado ENUM('Pendiente','Parcial','Pagada','Anulada') DEFAULT 'Pendiente'");
        await agregarColumna(connection, 'compras', 'saldo_pendiente', "saldo_pendiente DECIMAL(12,2) DEFAULT 0.00");
        console.log('Columnas de trazabilidad agregadas a compras.');

        await agregarColumna(connection, 'compras', 'fecha_factura', "fecha_factura DATE NULL");
        await agregarColumna(connection, 'compras', 'soporte', "soporte LONGTEXT NULL");
        await agregarColumna(connection, 'compras', 'subtotal', "subtotal DECIMAL(12,2) DEFAULT 0.00");
        await agregarColumna(connection, 'compras', 'descuento', "descuento DECIMAL(12,2) DEFAULT 0.00");
        await agregarColumna(connection, 'compras', 'base_gravable', "base_gravable DECIMAL(12,2) DEFAULT 0.00");
        await agregarColumna(connection, 'compras', 'iva', "iva DECIMAL(12,2) DEFAULT 0.00");
        await agregarColumna(connection, 'compras', 'ico', "ico DECIMAL(12,2) DEFAULT 0.00");

        await agregarColumna(connection, 'detalle_compras', 'descuento', "descuento DECIMAL(12,2) DEFAULT 0.00");
        await agregarColumna(connection, 'detalle_compras', 'iva_pct', "iva_pct DECIMAL(5,2) DEFAULT 0.00");
        await agregarColumna(connection, 'detalle_compras', 'ico_pct', "ico_pct DECIMAL(5,2) DEFAULT 0.00");
        await agregarColumna(connection, 'detalle_compras', 'iva', "iva DECIMAL(12,2) DEFAULT 0.00");
        await agregarColumna(connection, 'detalle_compras', 'ico', "ico DECIMAL(12,2) DEFAULT 0.00");
        await agregarColumna(connection, 'detalle_compras', 'total_linea', "total_linea DECIMAL(12,2) DEFAULT 0.00");

        await agregarColumna(connection, 'productos', 'codigo_barras', "codigo_barras VARCHAR(60) NULL");
        console.log('Columnas fiscales de compras, impuestos por linea y codigo de barras verificadas.');

        // Backfill: compras previas sin pagar -> saldo = total
        await connection.query(`
            UPDATE compras
            SET saldo_pendiente = COALESCE(total, 0),
                fecha_vencimiento = COALESCE(fecha_vencimiento, DATE_ADD(DATE(fecha), INTERVAL dias_credito DAY))
            WHERE estado = 'Pendiente' AND (saldo_pendiente IS NULL OR saldo_pendiente = 0)
        `);

        // ---- Historial de pagos a proveedores ----
        await connection.query(`
            CREATE TABLE IF NOT EXISTS pagos_proveedores (
                id_pago INT AUTO_INCREMENT PRIMARY KEY,
                id_proveedor INT NOT NULL,
                id_compra INT NULL,
                id_usuario INT NULL,
                monto DECIMAL(12,2) NOT NULL DEFAULT 0.00,
                metodo_pago VARCHAR(60) DEFAULT '',
                referencia VARCHAR(100) DEFAULT '',
                observaciones VARCHAR(255) DEFAULT '',
                fecha_pago DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                KEY idx_pago_proveedor (id_proveedor),
                KEY idx_pago_compra (id_compra),
                CONSTRAINT fk_pago_prov FOREIGN KEY (id_proveedor) REFERENCES proveedores(id_proveedor),
                CONSTRAINT fk_pago_compra FOREIGN KEY (id_compra) REFERENCES compras(id_compra)
            )
        `);
        console.log('Tabla pagos_proveedores verificada/creada.');

        // ============================================================
        // MIGRACION DE PRODUCTOS (tolerante a fallos)
        // ============================================================

        async function agregarColumnaProducto(col, def) {
            try {
                const [cols] = await connection.query(
                    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
                     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'productos' AND COLUMN_NAME = ?`,
                    [process.env.DB_NAME || 'discoteca_db', col]
                );
                if (cols.length === 0) {
                    await connection.query(`ALTER TABLE productos ADD COLUMN ${def}`);
                    console.log(`Columna ${col} agregada a productos.`);
                }
            } catch (e) {
                console.log(`Aviso (columna ${col}): ${e.message}`);
            }
        }

        await agregarColumnaProducto('activo', `activo TINYINT(1) NOT NULL DEFAULT 1`);
        await agregarColumnaProducto('categoria', `categoria VARCHAR(100) DEFAULT 'General'`);
        await agregarColumnaProducto('stock', `stock INT DEFAULT 0`);
        await agregarColumnaProducto('stock_minimo', `stock_minimo INT DEFAULT 5`);
        await agregarColumnaProducto('unidad_medida', `unidad_medida VARCHAR(20) DEFAULT 'Unidad'`);
        await agregarColumnaProducto('factor_conversion', `factor_conversion DECIMAL(10,2) DEFAULT NULL`);
        await agregarColumnaProducto('precio', `precio DECIMAL(10,2) NOT NULL DEFAULT 0.00`);
        await agregarColumnaProducto('precio_costo', `precio_costo DECIMAL(10,2) DEFAULT 0.00`);
        await agregarColumnaProducto('descripcion', `descripcion TEXT NULL`);
        await agregarColumnaProducto('imagen', `imagen LONGTEXT NULL`);
        try { await connection.query('ALTER TABLE productos MODIFY COLUMN stock DECIMAL(12,2) NULL DEFAULT 0.00'); } catch (e) {}
        try { await connection.query('ALTER TABLE stock_bodegas MODIFY COLUMN stock DECIMAL(10,2) NOT NULL DEFAULT 0.00'); } catch (e) {}

        // Crear tabla categorias
        await connection.query(`
            CREATE TABLE IF NOT EXISTS categorias (
                id_categoria INT AUTO_INCREMENT PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL UNIQUE
            )
        `);
        console.log('Tabla categorias verificada/creada.');

        // Crear tabla usuarios
        await connection.query(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id_usuario INT AUTO_INCREMENT PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL,
                correo VARCHAR(100) UNIQUE,
                contrasena VARCHAR(100),
                id_rol INT,
                activo TINYINT(1) DEFAULT 1,
                fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Tabla usuarios verificada/creada.');

        // Crear tabla roles
        await connection.query(`
            CREATE TABLE IF NOT EXISTS roles (
                id_rol INT AUTO_INCREMENT PRIMARY KEY,
                nombre VARCHAR(50) NOT NULL
            )
        `);
        console.log('Tabla roles verificada/creada.');
        await agregarColumna(connection, 'roles', 'descripcion', "descripcion VARCHAR(200) DEFAULT ''");
        await connection.query(`
            CREATE TABLE IF NOT EXISTS permisos (
                id_permiso INT AUTO_INCREMENT PRIMARY KEY,
                codigo VARCHAR(60) NOT NULL UNIQUE,
                nombre VARCHAR(100) NOT NULL,
                descripcion VARCHAR(200) DEFAULT ''
            )
        `);
        console.log('Tabla permisos verificada/creada.');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS rol_permisos (
                id_rol INT NOT NULL,
                id_permiso INT NOT NULL,
                PRIMARY KEY (id_rol, id_permiso),
                FOREIGN KEY (id_rol) REFERENCES roles(id_rol) ON DELETE CASCADE,
                FOREIGN KEY (id_permiso) REFERENCES permisos(id_permiso) ON DELETE CASCADE
            )
        `);
        console.log('Tabla rol_permisos verificada/creada.');
        const permisosBase = [
            ['ver_reportes','Ver reportes','Acceso a reportes y analitica'],
            ['anular_pedidos','Anular pedidos','Puede anular pedidos y comandas'],
            ['aplicar_descuentos','Aplicar descuentos','Puede aplicar descuentos y cortesias'],
            ['cerrar_jornada','Cerrar jornada','Puede cerrar jornada y arqueo'],
            ['gestionar_inventario','Gestionar inventario','Alta/baja de productos y stock'],
            ['crear_usuarios','Crear usuarios','Crear y editar usuarios y roles'],
            ['ver_caja','Ver caja','Ver movimientos y caja'],
            ['gestionar_configuracion','Gestionar configuracion','Acceso a configuracion general'],
            ['registrar_mermas','Registrar mermas','Puede registrar mermas'],
            ['gestionar_proveedores','Gestionar proveedores','Compras y proveedores'],
            ['can_create_orders','Permitir tomar y enviar pedidos a cocina/barra','Habilita boton de comandas en Mesas si caja abierta'],
            ['can_access_inventory_analytics','Acceso a Análisis de Inventario','Ver modulo Analisis de Inventario'],
            ['can_cancel_orders','Cancelar pedidos','Permite cancelar comandas y anular items (sin PIN si tiene permiso)'],
            ['cobrar_cuentas','Cobrar cuentas','Permite cobrar y cerrar cuentas de mesas (solo Cajero/Admin)']
        ];
        for (const p of permisosBase) {
            await connection.query('INSERT IGNORE INTO permisos (codigo,nombre,descripcion) VALUES (?,?,?)', p);
        }
        console.log('Permisos base sembrados.');
        const [adminRoles] = await connection.query("SELECT id_rol FROM roles WHERE LOWER(nombre) IN ('administrador','admin') LIMIT 1");
        if (adminRoles.length) {
            const idAdmin = adminRoles[0].id_rol;
            const [allPerms] = await connection.query('SELECT id_permiso FROM permisos');
            for (const pr of allPerms) {
                await connection.query('INSERT IGNORE INTO rol_permisos (id_rol,id_permiso) VALUES (?,?)', [idAdmin, pr.id_permiso]);
            }
        }
        try{
            const [permPedido] = await connection.query("SELECT id_permiso FROM permisos WHERE codigo='can_create_orders' LIMIT 1");
            if(permPedido.length){
                const [meseroRoles] = await connection.query("SELECT id_rol FROM roles WHERE LOWER(nombre) LIKE '%mesero%' OR LOWER(nombre) LIKE '%mesera%'");
                for(const mr of meseroRoles){
                    await connection.query("INSERT IGNORE INTO rol_permisos (id_rol,id_permiso) VALUES (?,?)", [mr.id_rol, permPedido[0].id_permiso]);
                }
                console.log('Permiso can_create_orders otorgado a rol Mesero/Mesera (solo mesero puede hacer pedidos).');
            }
            const [permAnalisis] = await connection.query("SELECT id_permiso FROM permisos WHERE codigo='can_access_inventory_analytics' LIMIT 1");
            if(permAnalisis.length){
                const [meseroRolesA] = await connection.query("SELECT id_rol FROM roles WHERE LOWER(nombre) LIKE '%mesero%' OR LOWER(nombre) LIKE '%mesera%'");
                for(const mr of meseroRolesA){
                    await connection.query("DELETE FROM rol_permisos WHERE id_rol=? AND id_permiso=?", [mr.id_rol, permAnalisis[0].id_permiso]);
                }
                console.log('Permiso can_access_inventory_analytics desactivado por defecto para Mesero.');
            }
            const [permCancel] = await connection.query("SELECT id_permiso FROM permisos WHERE codigo='can_cancel_orders' LIMIT 1");
            if(permCancel.length){
                const [meseroRolesC] = await connection.query("SELECT id_rol FROM roles WHERE LOWER(nombre) LIKE '%mesero%' OR LOWER(nombre) LIKE '%mesera%'");
                for(const mr of meseroRolesC){
                    await connection.query("DELETE FROM rol_permisos WHERE id_rol=? AND id_permiso=?", [mr.id_rol, permCancel[0].id_permiso]);
                }
                console.log('Permiso can_cancel_orders desactivado por defecto para Mesero (requiere PIN maestro).');
            }
            const [cajeroRoles]=await connection.query("SELECT id_rol FROM roles WHERE LOWER(nombre) LIKE '%cajero%'");
            if(cajeroRoles.length){
                const permsCajero=['ver_caja','cerrar_jornada','ver_reportes','anular_pedidos','aplicar_descuentos','can_cancel_orders','cobrar_cuentas'];
                for(const cod of permsCajero){
                    const [pr]=await connection.query("SELECT id_permiso FROM permisos WHERE codigo=? LIMIT 1",[cod]);
                    if(pr.length) await connection.query("INSERT IGNORE INTO rol_permisos (id_rol,id_permiso) VALUES (?,?)",[cajeroRoles[0].id_rol, pr[0].id_permiso]);
                }
                console.log('Permisos por defecto otorgados a Cajero');
            }
            const [barRoles]=await connection.query("SELECT id_rol FROM roles WHERE LOWER(nombre) LIKE '%bartender%' OR LOWER(nombre) LIKE '%barman%' OR LOWER(nombre) LIKE '%barra%'");
            if(barRoles.length){
                const permsBar=['can_create_orders'];
                for(const cod of permsBar){
                    const [pr]=await connection.query("SELECT id_permiso FROM permisos WHERE codigo=? LIMIT 1",[cod]);
                    if(pr.length) await connection.query("INSERT IGNORE INTO rol_permisos (id_rol,id_permiso) VALUES (?,?)",[barRoles[0].id_rol, pr[0].id_permiso]);
                }
                const permsBarOff=['gestionar_inventario','registrar_mermas','ver_caja','cerrar_jornada','cobrar_cuentas','can_cancel_orders'];
                for(const cod of permsBarOff){
                    const [pr]=await connection.query("SELECT id_permiso FROM permisos WHERE codigo=? LIMIT 1",[cod]);
                    if(pr.length) await connection.query("DELETE FROM rol_permisos WHERE id_rol=? AND id_permiso=?",[barRoles[0].id_rol, pr[0].id_permiso]);
                }
                console.log('Rol Bartender alineado a Mesero (solo can_create_orders, zona Barra).');
            }
            const [gerenteRoles]=await connection.query("SELECT id_rol FROM roles WHERE LOWER(nombre) LIKE '%gerente%'");
            if(gerenteRoles.length){
                const permsGerente=['ver_reportes','anular_pedidos','aplicar_descuentos','cerrar_jornada','gestionar_inventario','ver_caja','registrar_mermas','gestionar_proveedores','can_create_orders','can_access_inventory_analytics','can_cancel_orders','cobrar_cuentas'];
                for(const cod of permsGerente){
                    const [pr]=await connection.query("SELECT id_permiso FROM permisos WHERE codigo=? LIMIT 1",[cod]);
                    if(pr.length) await connection.query("INSERT IGNORE INTO rol_permisos (id_rol,id_permiso) VALUES (?,?)",[gerenteRoles[0].id_rol, pr[0].id_permiso]);
                }
                console.log('Permisos por defecto otorgados a Gerente (12, sin crear_usuarios ni gestionar_configuracion)');
            }
            const [permCobrar]=await connection.query("SELECT id_permiso FROM permisos WHERE codigo='cobrar_cuentas' LIMIT 1");
            if(permCobrar.length){
                const [meseroRolesCobrar]=await connection.query("SELECT id_rol FROM roles WHERE LOWER(nombre) LIKE '%mesero%' OR LOWER(nombre) LIKE '%mesera%'");
                for(const mr of meseroRolesCobrar){
                    await connection.query("DELETE FROM rol_permisos WHERE id_rol=? AND id_permiso=?",[mr.id_rol, permCobrar[0].id_permiso]);
                }
                const [cajeroRolesCobrar]=await connection.query("SELECT id_rol FROM roles WHERE LOWER(nombre) LIKE '%cajero%'");
                for(const cr of cajeroRolesCobrar){
                    await connection.query("INSERT IGNORE INTO rol_permisos (id_rol,id_permiso) VALUES (?,?)",[cr.id_rol, permCobrar[0].id_permiso]);
                }
            }
        }catch(e){ console.log('Aviso permisos mesero:', e.message); }

        // Tabla tokens de recuperacion
        await connection.query(`
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id INT AUTO_INCREMENT PRIMARY KEY,
                id_usuario INT NOT NULL,
                token_hash VARCHAR(64) NOT NULL,
                expira_en DATETIME NOT NULL,
                usado TINYINT(1) DEFAULT 0,
                creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_reset_token (token_hash, usado)
            )
        `);
        console.log('Tabla password_reset_tokens verificada/creada.');

        // Crear tabla mermas
        await connection.query(`
            CREATE TABLE IF NOT EXISTS mermas (
                id_merma INT AUTO_INCREMENT PRIMARY KEY,
                id_producto INT NOT NULL,
                cantidad INT NOT NULL DEFAULT 1,
                motivo ENUM('Rotura','Derrame','Vencimiento','Cortesia') NOT NULL,
                fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
                id_usuario INT,
                FOREIGN KEY (id_producto) REFERENCES productos(id_producto)
            )
        `);
        console.log('Tabla mermas verificada/creada.');
        await agregarColumna(connection, 'mermas', 'observaciones', "observaciones VARCHAR(500) NULL");
        await agregarColumna(connection, 'mermas', 'costo_unitario', "costo_unitario DECIMAL(12,2) NOT NULL DEFAULT 0.00");
        await agregarColumna(connection, 'mermas', 'valor_perdida', "valor_perdida DECIMAL(12,2) NOT NULL DEFAULT 0.00");
        console.log('Columnas observaciones/costo/valor_perdida en mermas verificadas.');

        // Crear tabla cuentas_por_cobrar
        await connection.query(`
            CREATE TABLE IF NOT EXISTS cuentas_por_cobrar (
                id_vale INT AUTO_INCREMENT PRIMARY KEY,
                cliente_socio VARCHAR(150) NOT NULL,
                id_mesa INT NULL,
                total DECIMAL(10,2) NOT NULL,
                saldo_pendiente DECIMAL(10,2) NOT NULL,
                estado ENUM('Pendiente','Parcial','Liquidado') DEFAULT 'Pendiente',
                fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
                id_usuario_autoriza INT
            )
        `);
        console.log('Tabla cuentas_por_cobrar verificada/creada.');

        // ============================================================
        // MIGRACION: MODULO DE MESAS, ZONAS Y COMANDAS
        // ============================================================

        await connection.query(`
            CREATE TABLE IF NOT EXISTS zonas (
                id_zona INT AUTO_INCREMENT PRIMARY KEY,
                nombre VARCHAR(60) NOT NULL,
                descripcion VARCHAR(200) DEFAULT '',
                color VARCHAR(20) DEFAULT '#3b82f6',
                orden INT DEFAULT 0,
                activa TINYINT(1) NOT NULL DEFAULT 1
            )
        `);
        console.log('Tabla zonas verificada/creada.');

        await agregarColumna(connection, 'mesas', 'zona', "zona VARCHAR(60) DEFAULT 'VIP'");
        await agregarColumna(connection, 'mesas', 'nombre', "nombre VARCHAR(80) NULL");
        await agregarColumna(connection, 'mesas', 'activo', "activo TINYINT(1) NOT NULL DEFAULT 1");
        await agregarColumna(connection, 'mesas', 'id_mesero', "id_mesero INT NULL");
        await agregarColumna(connection, 'mesas', 'fecha_ocupacion', "fecha_ocupacion DATETIME NULL");
        await agregarColumna(connection, 'mesas', 'id_mesa_maestra', "id_mesa_maestra INT NULL");
        try {
            const [colNum] = await connection.query("SHOW COLUMNS FROM mesas LIKE 'numero'");
            if (colNum.length && !/varchar|char|text/i.test(String(colNum[0].Type || ''))) {
                await connection.query('ALTER TABLE mesas MODIFY COLUMN numero VARCHAR(20) NOT NULL');
                console.log('Columna mesas.numero migrada a VARCHAR(20).');
            }
        } catch (e) { console.log('Aviso (mesas.numero a VARCHAR): ' + e.message); }
        console.log('Columnas de zona/mesero/reserva agregadas a mesas.');

        await connection.query(`
            CREATE TABLE IF NOT EXISTS presentaciones (
                id_presentacion INT AUTO_INCREMENT PRIMARY KEY,
                nombre VARCHAR(40) NOT NULL,
                descripcion VARCHAR(120) DEFAULT '',
                factor DECIMAL(8,3) NOT NULL DEFAULT 1.000,
                activa TINYINT(1) NOT NULL DEFAULT 1
            )
        `);
        console.log('Tabla presentaciones verificada/creada.');

        await connection.query(`
            CREATE TABLE IF NOT EXISTS notas_preparacion (
                id_nota INT AUTO_INCREMENT PRIMARY KEY,
                texto VARCHAR(80) NOT NULL,
                activa TINYINT(1) NOT NULL DEFAULT 1
            )
        `);
        console.log('Tabla notas_preparacion verificada/creada.');

        await agregarColumna(connection, 'detalle_pedido', 'presentacion', "presentacion VARCHAR(40) DEFAULT 'Trago / Copa'");
        await agregarColumna(connection, 'detalle_pedido', 'id_nota_preparacion', "id_nota_preparacion INT NULL");
        console.log('Columnas de presentacion/nota agregadas a detalle_pedido.');

        // ============================================================
        // MIGRACION: CARTERA / CUENTAS POR COBRAR / VALES VIP Y MORA
        // ============================================================

        await connection.query(`
            CREATE TABLE IF NOT EXISTS clientes_socios (
                id_cliente INT AUTO_INCREMENT PRIMARY KEY,
                nombre VARCHAR(150) NOT NULL,
                telefono VARCHAR(30) DEFAULT '',
                documento VARCHAR(40) DEFAULT '',
                tipo_documento VARCHAR(20) DEFAULT 'CC',
                correo VARCHAR(100) DEFAULT '',
                limite_credito DECIMAL(12,2) NOT NULL DEFAULT 0.00,
                es_vip TINYINT(1) NOT NULL DEFAULT 1,
                activo TINYINT(1) NOT NULL DEFAULT 1,
                observaciones VARCHAR(255) DEFAULT '',
                fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Tabla clientes_socios verificada/creada.');

        await agregarColumna(connection, 'cuentas_por_cobrar', 'id_cliente_socio', "id_cliente_socio INT NULL");
        await agregarColumna(connection, 'cuentas_por_cobrar', 'fecha_vencimiento', "fecha_vencimiento DATE NULL");
        await agregarColumna(connection, 'cuentas_por_cobrar', 'tipo_mora', "tipo_mora ENUM('diario','mensual','fijo') NOT NULL DEFAULT 'diario'");
        await agregarColumna(connection, 'cuentas_por_cobrar', 'tasa_mora', "tasa_mora DECIMAL(8,3) NOT NULL DEFAULT 0.000");
        await agregarColumna(connection, 'cuentas_por_cobrar', 'mora_acumulada', "mora_acumulada DECIMAL(12,2) NOT NULL DEFAULT 0.00");
        await agregarColumna(connection, 'cuentas_por_cobrar', 'capital_pagado', "capital_pagado DECIMAL(12,2) NOT NULL DEFAULT 0.00");
        await agregarColumna(connection, 'cuentas_por_cobrar', 'mora_pagada', "mora_pagada DECIMAL(12,2) NOT NULL DEFAULT 0.00");
        await agregarColumna(connection, 'cuentas_por_cobrar', 'exonerada_mora', "exonerada_mora TINYINT(1) NOT NULL DEFAULT 0");
        await agregarColumna(connection, 'cuentas_por_cobrar', 'fecha_exencion', "fecha_exencion DATETIME NULL");
        await agregarColumna(connection, 'cuentas_por_cobrar', 'id_usuario_exencion', "id_usuario_exencion INT NULL");
        await agregarColumna(connection, 'cuentas_por_cobrar', 'referencia', "referencia VARCHAR(100) DEFAULT ''");
        console.log('Columnas de cobranza/mora agregadas a cuentas_por_cobrar.');

        // Backfill: vales antiguos
        await connection.query(`
            UPDATE cuentas_por_cobrar
            SET fecha_vencimiento = COALESCE(fecha_vencimiento, DATE(fecha)),
                capital_pagado = COALESCE(capital_pagado, total - saldo_pendiente),
                mora_pagada = COALESCE(mora_pagada, 0),
                mora_acumulada = COALESCE(mora_acumulada, 0)
            WHERE saldo_pendiente >= 0
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS abonos_vales (
                id_abono INT AUTO_INCREMENT PRIMARY KEY,
                id_vale INT NOT NULL,
                monto_abono DECIMAL(12,2) NOT NULL DEFAULT 0.00,
                monto_capital DECIMAL(12,2) NOT NULL DEFAULT 0.00,
                monto_mora DECIMAL(12,2) NOT NULL DEFAULT 0.00,
                metodo_pago VARCHAR(60) DEFAULT '',
                sub_metodo_pago VARCHAR(50) DEFAULT '',
                referencia VARCHAR(100) DEFAULT '',
                id_usuario INT NULL,
                id_jornada INT NULL,
                fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                KEY idx_abono_vale (id_vale),
                CONSTRAINT fk_abono_vale FOREIGN KEY (id_vale) REFERENCES cuentas_por_cobrar(id_vale)
            )
        `);
        console.log('Tabla abonos_vales verificada/creada.');

        // ---- Columna estado en pedidos y detalle_pedido ----
        await agregarColumna(connection, 'pedidos', 'estado', "estado VARCHAR(20) NOT NULL DEFAULT 'Pendiente'");
        await agregarColumna(connection, 'detalle_pedido', 'estado', "estado VARCHAR(20) NOT NULL DEFAULT 'Pendiente'");
        console.log('Columnas de estado agregadas a pedidos y detalle_pedido.');
        // ---- Idempotencia anti-duplicados: clave_cliente en pedidos ----
        await agregarColumna(connection, 'pedidos', 'clave_cliente', 'clave_cliente VARCHAR(64) NULL');
        try {
            const [exIdx] = await connection.query(
                `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'pedidos' AND INDEX_NAME = 'uq_pedidos_clave_cliente'`,
                [process.env.DB_NAME || 'discoteca_db']
            );
            if (exIdx[0].c === 0) {
                await connection.query(`ALTER TABLE pedidos ADD UNIQUE INDEX uq_pedidos_clave_cliente (clave_cliente)`);
                console.log('Indice unico uq_pedidos_clave_cliente creado.');
            }
        } catch (e) { console.log('Aviso indice clave_cliente: ' + e.message); }

        // Timestamps en pedidos
        const [tsCols] = await connection.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'timestamp_pedido'`,
            [process.env.DB_NAME || 'discoteca_db']
        );
        if (tsCols.length === 0) {
            await connection.query(`ALTER TABLE pedidos ADD COLUMN timestamp_pedido DATETIME NULL AFTER metodo_pago`);
            await connection.query(`ALTER TABLE pedidos ADD COLUMN timestamp_despacho DATETIME NULL AFTER timestamp_pedido`);
            console.log('Columnas de timestamp agregadas a pedidos.');
        }

        // Observaciones en detalle_pedido
        const [detCols] = await connection.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'detalle_pedido' AND COLUMN_NAME = 'observaciones'`,
            [process.env.DB_NAME || 'discoteca_db']
        );
        if (detCols.length === 0) {
            await connection.query(`ALTER TABLE detalle_pedido ADD COLUMN observaciones TEXT NULL AFTER subtotal`);
            console.log('Columna observaciones agregada a detalle_pedido.');
        }

        // ============================================================
        // MIGRACION: ANALISIS Y CONFIGURACION AVANZADA DE INVENTARIO
        // ============================================================

        await agregarColumnaProducto('iva_pct', "iva_pct DECIMAL(5,2) DEFAULT NULL");
        await agregarColumnaProducto('ico_pct', "ico_pct DECIMAL(5,2) DEFAULT NULL");

        await connection.query(`
            CREATE TABLE IF NOT EXISTS configuracion_inventario (
                clave VARCHAR(60) PRIMARY KEY,
                valor VARCHAR(255) NOT NULL DEFAULT '',
                descripcion VARCHAR(255) NOT NULL DEFAULT ''
            )
        `);
        console.log('Tabla configuracion_inventario verificada/creada.');

        await connection.query(`
            CREATE TABLE IF NOT EXISTS unidades_medida (
                id_unidad INT AUTO_INCREMENT PRIMARY KEY,
                nombre VARCHAR(40) NOT NULL,
                abreviacion VARCHAR(15) NOT NULL DEFAULT '',
                tipo VARCHAR(25) NOT NULL DEFAULT 'Unidad'
            )
        `);
        console.log('Tabla unidades_medida verificada/creada.');

        await connection.query(`
            CREATE TABLE IF NOT EXISTS conversiones (
                id_conversion INT AUTO_INCREMENT PRIMARY KEY,
                unidad_origen VARCHAR(40) NOT NULL,
                unidad_destino VARCHAR(40) NOT NULL,
                factor DECIMAL(12,4) NOT NULL DEFAULT 1.0000,
                UNIQUE KEY uq_conv (unidad_origen, unidad_destino)
            )
        `);
        console.log('Tabla conversiones verificada/creada.');

        // ============================================================
        // CONFIGURACION GENERAL DEL SISTEMA
        // ============================================================

        await connection.query(`
            CREATE TABLE IF NOT EXISTS configuracion_general (
                clave VARCHAR(80) NOT NULL PRIMARY KEY,
                valor VARCHAR(500) NOT NULL DEFAULT '',
                descripcion VARCHAR(255) NOT NULL DEFAULT ''
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log('Tabla configuracion_general verificada/creada.');

        const configGeneralDefault = [
            ['nombre_local', 'ClubMaster', 'Nombre del establecimiento'],
            ['nit_local', '', 'NIT del establecimiento'],
            ['direccion_local', '', 'Direccion del establecimiento'],
            ['telefono_local', '', 'Telefono de contacto'],
            ['logo_url', '', 'URL o ruta del logo del local'],
            ['pie_factura', 'Gracias por su compra', 'Mensaje al pie de factura'],
            ['propina_default', '10', 'Porcentaje de propina por defecto'],
            ['iva_global', '19', 'IVA % por defecto (parametrizable sin codigo)'],
            ['ico_global', '8', 'ICO / Impoconsumo % por defecto'],
            ['iva', '19', 'Alias IVA para compatibilidad frontend'],
            ['ico', '8', 'Alias ICO para compatibilidad frontend'],
            ['moneda_local', 'COP', 'Moneda local (COP, USD, EUR, MXN)'],
            ['zona_horaria', 'America/Bogota', 'Zona horaria del establecimiento'],
            ['formato_fecha', 'DD/MM/YYYY', 'Formato de fecha'],
            ['inactividad_mesa_minutos', '30', 'Minutos de inactividad antes de alertar mesa'],
            ['editar_comandas', '1', 'Permitir editar comandas (1=si, 0=no)'],
            ['metodo_nequi', '1', 'Nequi activo (1=si, 0=no)'],
            ['metodo_daviplata', '0', 'Daviplata activo (1=si, 0=no)'],
            ['metodo_tarjeta_debito', '1', 'Tarjeta debito activa (1=si, 0=no)'],
            ['metodo_tarjeta_credito', '1', 'Tarjeta credito activa (1=si, 0=no)'],
            ['metodo_vales', '1', 'Vales activos (1=si, 0=no)'],
            ['arqueo_ciego', '0', 'Arqueo ciego (1=si, 0=no)'],
            ['mermas_solo_admin', '0', 'Solo admin registra mermas (1=si, 0=no)'],
            ['mermas_pin_requerido', '0', 'Requiere PIN admin para mermas (1=si, 0=no)'],
            ['mermas_justificacion_cortesia', '1', 'Cortesia requiere justificacion (1=si, 0=no)']
        ];
        for (const cfg of configGeneralDefault) {
            await connection.query(
                'INSERT IGNORE INTO configuracion_general (clave, valor, descripcion) VALUES (?, ?, ?)',
                cfg
            );
        }
        console.log('Configuracion general por defecto verificada.');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                usuario_id INT NULL,
                autorizado_por_id INT NULL,
                tipo_evento ENUM('CANCELACION_PEDIDO','DESCUENTO_APLICADO','INGRESO_CAJA','RETIRO_CAJA','CAMBIO_PRECIO','LOGIN_FALLIDO','ANULACION_ITEM','VACIADO_CAJA','APERTURA_CAJA','CIERRE_CAJA','MERMAS','PIN_FALLIDO') NOT NULL,
                descripcion TEXT,
                motivo TEXT,
                ip_address VARCHAR(45) NULL,
                dispositivo VARCHAR(255) NULL,
                mesa_id VARCHAR(20) NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                KEY idx_audit_tipo (tipo_evento),
                KEY idx_audit_usuario (usuario_id),
                KEY idx_audit_fecha (created_at)
            )
        `);
        console.log('Tabla audit_logs verificada/creada.');
        try {
            const [cols] = await connection.query(`SHOW COLUMNS FROM audit_logs LIKE 'tipo_evento'`);
            if (cols.length && cols[0].Type && cols[0].Type.indexOf('DEVOLUCION') === -1) {
                await connection.query(`ALTER TABLE audit_logs MODIFY COLUMN tipo_evento ENUM('CANCELACION_PEDIDO','DESCUENTO_APLICADO','INGRESO_CAJA','RETIRO_CAJA','CAMBIO_PRECIO','LOGIN_FALLIDO','ANULACION_ITEM','VACIADO_CAJA','APERTURA_CAJA','CIERRE_CAJA','MERMAS','PIN_FALLIDO','REIMPRESION','VALE_CREADO','VALE_ABONADO','VALE_LIQUIDADO','VALE_EXONERADO','DEVOLUCION') NOT NULL`);
                console.log('ENUM audit_logs ampliado con DEVOLUCION.');
            }
        } catch (e) { console.log('Aviso ENUM audit_logs: ' + e.message); }

        // ============================================================
        // STOCK POR BODEGA / PUNTO DE VENTA (opcional)
        // ============================================================
        await connection.query(`
            CREATE TABLE IF NOT EXISTS bodegas (
                id_bodega INT AUTO_INCREMENT PRIMARY KEY,
                nombre VARCHAR(80) NOT NULL UNIQUE,
                descripcion VARCHAR(200) DEFAULT '',
                activa TINYINT(1) NOT NULL DEFAULT 1,
                orden INT DEFAULT 0
            )
        `);
        console.log('Tabla bodegas verificada/creada.');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS stock_bodegas (
                id_stock INT AUTO_INCREMENT PRIMARY KEY,
                id_producto INT NOT NULL,
                id_bodega INT NOT NULL,
                stock DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                stock_minimo DECIMAL(10,2) NOT NULL DEFAULT 5.00,
                UNIQUE KEY uq_prod_bodega (id_producto, id_bodega),
                KEY idx_stock_bodega (id_bodega),
                CONSTRAINT fk_stock_prod FOREIGN KEY (id_producto) REFERENCES productos(id_producto) ON DELETE CASCADE,
                CONSTRAINT fk_stock_bodega FOREIGN KEY (id_bodega) REFERENCES bodegas(id_bodega) ON DELETE CASCADE
            )
        `);
        console.log('Tabla stock_bodegas verificada/creada.');
        await agregarColumna(connection, 'stock_bodegas', 'stock_minimo', 'stock_minimo DECIMAL(10,2) NOT NULL DEFAULT 5.00');
        await agregarColumna(connection, 'productos', 'usa_stock_bodega', 'usa_stock_bodega TINYINT(1) NOT NULL DEFAULT 0');
        await agregarColumna(connection, 'detalle_pedido', 'id_bodega', 'id_bodega INT NULL');
        await agregarColumna(connection, 'detalle_compras', 'id_bodega', 'id_bodega INT NULL');
        await agregarColumna(connection, 'mermas', 'id_bodega', 'id_bodega INT NULL');
        for (const b of [['Bodega Central','Stock general / compras','1',0],['Barra Principal','Punto de venta barra principal','1',1],['Barra VIP','Punto de venta barra VIP','1',2]]) {
            await connection.query('INSERT IGNORE INTO bodegas (nombre, descripcion, activa, orden) VALUES (?,?,?,?)', b);
        }
        console.log('Bodegas por defecto sembradas (Bodega Central, Barra Principal, Barra VIP).');
        await connection.query(`
            INSERT IGNORE INTO configuracion_general (clave, valor, descripcion) VALUES
            ('usa_stock_bodega','0','1= stock por bodega activo, 0= stock unico global')
        `);
        console.log('Config stock por bodega verificada.');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS recetas (
                id_receta INT AUTO_INCREMENT PRIMARY KEY,
                producto_id INT NOT NULL,
                insumo_id INT NOT NULL,
                cantidad DECIMAL(12,4) NOT NULL DEFAULT 1.0000,
                factor_conversion DECIMAL(12,4) NOT NULL DEFAULT 1.0000,
                UNIQUE KEY uq_receta (producto_id, insumo_id),
                KEY idx_receta_prod (producto_id),
                KEY idx_receta_insumo (insumo_id),
                CONSTRAINT fk_receta_prod FOREIGN KEY (producto_id) REFERENCES productos(id_producto) ON DELETE CASCADE,
                CONSTRAINT fk_receta_insumo FOREIGN KEY (insumo_id) REFERENCES productos(id_producto) ON DELETE CASCADE
            )
        `);
        console.log('Tabla recetas (BOM cocteles) verificada/creada.');

        await connection.query(`
            CREATE TABLE IF NOT EXISTS turnos (
                id_turno INT AUTO_INCREMENT PRIMARY KEY,
                id_usuario INT NOT NULL,
                id_caja INT NOT NULL,
                fecha_hora_inicio DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                fecha_hora_fin DATETIME NULL,
                horas_trabajadas DECIMAL(6,2) NULL,
                estado ENUM('ABIERTO','CERRADO') NOT NULL DEFAULT 'ABIERTO',
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                KEY idx_turno_usuario (id_usuario),
                KEY idx_turno_caja (id_caja),
                KEY idx_turno_estado (estado),
                KEY idx_turno_inicio (fecha_hora_inicio),
                CONSTRAINT fk_turno_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
                CONSTRAINT fk_turno_caja FOREIGN KEY (id_caja) REFERENCES jornadas(id_jornada) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log('Tabla turnos verificada/creada.');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS turnos_empleados (
                id_turno INT AUTO_INCREMENT PRIMARY KEY,
                id_usuario INT NOT NULL,
                id_caja INT NOT NULL,
                fecha_hora_inicio DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                fecha_hora_fin DATETIME NULL,
                horas_trabajadas DECIMAL(6,2) NULL,
                estado ENUM('ABIERTO','CERRADO') NOT NULL DEFAULT 'ABIERTO',
                KEY idx_te_usuario (id_usuario),
                KEY idx_te_caja (id_caja),
                CONSTRAINT fk_te_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
                CONSTRAINT fk_te_caja FOREIGN KEY (id_caja) REFERENCES jornadas(id_jornada) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log('Tabla turnos_empleados (alias) verificada/creada.');
        for (const tbl of ['turnos','turnos_empleados']) {
            await agregarColumna(connection, tbl, 'id_usuario', 'id_usuario INT NOT NULL');
            await agregarColumna(connection, tbl, 'id_caja', 'id_caja INT NOT NULL');
            await agregarColumna(connection, tbl, 'fecha_hora_inicio', 'fecha_hora_inicio DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP');
            await agregarColumna(connection, tbl, 'fecha_hora_fin', 'fecha_hora_fin DATETIME NULL');
            await agregarColumna(connection, tbl, 'horas_trabajadas', 'horas_trabajadas DECIMAL(6,2) NULL');
            await agregarColumna(connection, tbl, 'estado', "estado ENUM('ABIERTO','CERRADO') NOT NULL DEFAULT 'ABIERTO'");
        }

        // ============================================================
        // MIGRACION: RELACION PRODUCTO <-> PROVEEDOR (muchos a muchos)
        // ============================================================
        await connection.query(`
            CREATE TABLE IF NOT EXISTS productos_proveedores (
                id_relacion INT AUTO_INCREMENT PRIMARY KEY,
                id_producto INT NOT NULL,
                id_proveedor INT NOT NULL,
                precio_compra DECIMAL(12,2) NOT NULL DEFAULT 0.00,
                referencia_proveedor VARCHAR(80) NULL,
                tiempo_entrega INT NULL,
                es_preferido TINYINT(1) NOT NULL DEFAULT 0,
                UNIQUE KEY uq_prod_prov (id_producto, id_proveedor),
                KEY idx_pp_proveedor (id_proveedor),
                KEY idx_pp_producto (id_producto),
                CONSTRAINT fk_pp_producto FOREIGN KEY (id_producto) REFERENCES productos(id_producto) ON DELETE CASCADE,
                CONSTRAINT fk_pp_proveedor FOREIGN KEY (id_proveedor) REFERENCES proveedores(id_proveedor) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log('Tabla productos_proveedores verificada/creada.');

        // ============================================================
        // MIGRACION: DEVOLUCIONES A PROVEEDORES
        // ============================================================
        await connection.query(`
            CREATE TABLE IF NOT EXISTS devoluciones (
                id_devolucion INT AUTO_INCREMENT PRIMARY KEY,
                numero_devolucion VARCHAR(20) NOT NULL UNIQUE,
                id_proveedor INT NOT NULL,
                id_usuario INT NULL,
                fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                motivo_general VARCHAR(255) DEFAULT '',
                estado ENUM('Pendiente','Aprobada','Completada','Rechazada') NOT NULL DEFAULT 'Pendiente',
                total_devuelto DECIMAL(12,2) NOT NULL DEFAULT 0.00,
                notas TEXT NULL,
                stock_descontado TINYINT(1) NOT NULL DEFAULT 0,
                id_jornada INT NULL,
                KEY idx_dev_proveedor (id_proveedor),
                KEY idx_dev_fecha (fecha),
                KEY idx_dev_estado (estado),
                CONSTRAINT fk_dev_proveedor FOREIGN KEY (id_proveedor) REFERENCES proveedores(id_proveedor)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log('Tabla devoluciones verificada/creada.');

        await connection.query(`
            CREATE TABLE IF NOT EXISTS detalle_devoluciones (
                id_detalle INT AUTO_INCREMENT PRIMARY KEY,
                id_devolucion INT NOT NULL,
                id_producto INT NOT NULL,
                cantidad DECIMAL(12,2) NOT NULL DEFAULT 0.00,
                costo_unitario DECIMAL(12,2) NOT NULL DEFAULT 0.00,
                motivo ENUM('Dañado','Vencido','Error de pedido','Otro') NOT NULL DEFAULT 'Otro',
                genera_nota_credito TINYINT(1) NOT NULL DEFAULT 0,
                subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
                KEY idx_ddev_devolucion (id_devolucion),
                KEY idx_ddev_producto (id_producto),
                CONSTRAINT fk_ddev_devolucion FOREIGN KEY (id_devolucion) REFERENCES devoluciones(id_devolucion) ON DELETE CASCADE,
                CONSTRAINT fk_ddev_producto FOREIGN KEY (id_producto) REFERENCES productos(id_producto)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log('Tabla detalle_devoluciones verificada/creada.');

        // ---- Historial / kardex de movimientos de inventario ----
        await connection.query(`
            CREATE TABLE IF NOT EXISTS kardex (
                id_kardex INT AUTO_INCREMENT PRIMARY KEY,
                id_producto INT NOT NULL,
                fecha_hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                tipo_movimiento VARCHAR(80) NOT NULL,
                cantidad DECIMAL(12,2) NOT NULL,
                costo_unitario DECIMAL(12,2) NOT NULL DEFAULT 0.00,
                saldo_cantidad DECIMAL(12,2) NOT NULL DEFAULT 0.00,
                costo_promedio DECIMAL(12,2) NOT NULL DEFAULT 0.00,
                referencia VARCHAR(150) NULL,
                KEY idx_kardex_producto (id_producto),
                CONSTRAINT fk_kardex_producto FOREIGN KEY (id_producto) REFERENCES productos(id_producto)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        try { await connection.query('ALTER TABLE kardex MODIFY COLUMN tipo_movimiento VARCHAR(80) NOT NULL'); } catch (e) {}
        try { await connection.query('ALTER TABLE kardex MODIFY COLUMN referencia VARCHAR(150) NULL'); } catch (e) {}
        console.log('Tabla kardex (historial de inventario) verificada/creada.');

        // ---- Permisos rol -> zonas para mesas (estructura vs operativa) ----
        // Matriz editable: cajero sin estructura, bartender solo Barra,
        // mesero todo excepto Barra, admin/gerente todo.
        await connection.query(`
            CREATE TABLE IF NOT EXISTS rol_zonas_permiso (
                id INT AUTO_INCREMENT PRIMARY KEY,
                rol_clave VARCHAR(40) NOT NULL,
                zona VARCHAR(80) NOT NULL,
                permite_estructura TINYINT(1) NOT NULL DEFAULT 0,
                permite_operativa TINYINT(1) NOT NULL DEFAULT 0,
                UNIQUE KEY uq_rol_zona (rol_clave, zona)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log('Tabla rol_zonas_permiso verificada/creada.');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS zona_bloqueos_log (
                id INT AUTO_INCREMENT PRIMARY KEY,
                fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                id_usuario INT NULL,
                usuario_nombre VARCHAR(120) NULL,
                rol VARCHAR(80) NULL,
                accion VARCHAR(80) NOT NULL,
                id_mesa VARCHAR(20) NULL,
                zona VARCHAR(80) NULL,
                ip VARCHAR(45) NULL,
                KEY idx_zb_fecha (fecha),
                KEY idx_zb_usuario (id_usuario)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log('Tabla zona_bloqueos_log verificada/creada.');
        try {
            const [nzc] = await connection.query('SELECT COUNT(*) AS c FROM rol_zonas_permiso');
            if (nzc[0].c === 0) {
                let zonasSeed = [];
                try {
                    const [zr] = await connection.query('SELECT nombre FROM zonas ORDER BY orden ASC, nombre ASC');
                    zonasSeed = zr.map(function (r) { return r.nombre; });
                } catch (e) {}
                if (!zonasSeed.length) zonasSeed = ['VIP', 'Pista Principal', 'Barra', 'Terraza'];
                const esBarraSeed = function (z) { return String(z).toLowerCase().indexOf('barra') !== -1; };
                for (const rol of ['administrador', 'gerente', 'cajero', 'bartender', 'mesero']) {
                    for (const z of zonasSeed) {
                        let est = 1, ope = 1;
                        if (rol === 'cajero') { est = 0; ope = 1; }
                        else if (rol === 'bartender') { est = esBarraSeed(z) ? 1 : 0; ope = esBarraSeed(z) ? 1 : 0; }
                        else if (rol === 'mesero') { est = esBarraSeed(z) ? 0 : 1; ope = esBarraSeed(z) ? 0 : 1; }
                        await connection.query(
                            'INSERT IGNORE INTO rol_zonas_permiso (rol_clave, zona, permite_estructura, permite_operativa) VALUES (?,?,?,?)',
                            [rol, z, est, ope]
                        );
                    }
                }
                console.log('Seed rol_zonas_permiso aplicado.');
            }
        } catch (e) { console.log('Aviso (seed rol_zonas_permiso): ' + e.message); }

        console.log('Migraciones completadas exitosamente.');
    } catch (error) {
        console.error('Error en migraciones:', error.message);
        throw error;
    } finally {
        connection.release();
    }
}

if (require.main === module) {
    migrate()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = { migrate };
