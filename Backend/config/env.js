// =========================================================
// env.js
// Carga los .env y centraliza la lectura de variables de
// entorno: conexion MySQL, CORS, puerto y validaciones de
// arranque. Ningun otro archivo debe leer process.env.DB_* /
// MYSQL* directamente.
//
// ORDEN DE LECTURA DE LA CONEXION A MYSQL (el primero gana):
//   1) DATABASE_URL
//   2) MYSQL_URL
//   3) Variables sueltas: DB_HOST / DB_PORT / DB_USER /
//      DB_PASSWORD / DB_NAME   o   MYSQLHOST / MYSQLPORT /
//      MYSQLUSER / MYSQLPASSWORD / MYSQLDATABASE
//
// IMPORTANTE (Railway): el servicio MySQL NO crea DATABASE_URL.
// Expone MYSQL_URL (red interna), MYSQL_PUBLIC_URL (proxy
// publico, para scripts desde tu PC) y las variables sueltas
// MYSQLHOST, MYSQLPORT, MYSQLUSER, MYSQLPASSWORD, MYSQLDATABASE.
//
// Las claves NUNCA se imprimen en los logs.
// =========================================================
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

// Estamos corriendo dentro de Railway? (para distinguir la URL
// interna *.railway.internal, que solo resuelve alli).
const EN_RAILWAY = Boolean(
    process.env.RAILWAY_ENVIRONMENT ||
    process.env.RAILWAY_PROJECT_ID ||
    process.env.RAILWAY_SERVICE_ID
);

// Valor de ejemplo de .env.example; si sigue igual en produccion, no arranca.
const JWT_SECRET_EJEMPLO = 'cambia_esto_por_un_jwt_largo_64_chars_min';
const SESSION_SECRET_EJEMPLO = 'cambia_esto_por_un_hash_largo_64_chars_min';

function esProduccion() {
    return process.env.NODE_ENV === 'production';
}

// Termina el proceso con un mensaje en español. Nunca recibe claves.
function fallar(mensaje) {
    console.error('FATAL: ' + mensaje);
    process.exit(1);
}

// decodeURIComponent lanza URIError cuando el valor trae un "%" suelto
// (una clave con "%zz", por ejemplo). En ese caso devolvemos el texto
// crudo: es mejor intentar la conexion con la clave literal que fallar
// con "URL no valida" sin explicar nada.
function decodificarSeguro(valor) {
    const v = String(valor === undefined || valor === null ? '' : valor);
    try { return decodeURIComponent(v); } catch (e) { return v; }
}

// Referencia de Railway sin resolver: si el nombre del servicio no coincide
// (o la variable no existe), Railway deja el texto tal cual y MySQL recibe
// "${{MySQL.MYSQLPASSWORD}}" como clave -> Access denied for user 'root'.
const REFERENCIA_RAILWAY = /\$\{\{[^}]*\}\}/;

function esReferenciaSinResolver(valor) {
    return REFERENCIA_RAILWAY.test(String(valor || ''));
}

function primeraReferencia(valor) {
    const m = String(valor || '').match(REFERENCIA_RAILWAY);
    return m ? m[0] : '';
}

function parseUrlMySQL(url) {
    try {
        const u = new URL(url);
        if (!u.hostname) return null;
        return {
            host: u.hostname,
            port: u.port ? Number(u.port) : 3306,
            user: decodificarSeguro(u.username),
            password: decodificarSeguro(u.password),
            database: (u.pathname || '').replace(/^\//, '').split('?')[0]
        };
    } catch (e) {
        return null;
    }
}

// Una clave con "#" o "/" rompe el parseo de la URL (new URL lanza) y el
// mensaje "URL no valida" no explica que el problema es la clave. Aqui se
// detecta para decirlo explicitamente.
function urlRotaPorClaveEspecial(url) {
    const sinEsquema = String(url || '').replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '');
    const usuarioClave = sinEsquema.split('@')[0] || '';
    return /[#/?]/.test(usuarioClave) ? true : false;
}

function desdeUrl(etiqueta, url) {
    if (esReferenciaSinResolver(url)) {
        fallar(
            etiqueta + ' tiene una referencia de Railway SIN RESOLVER: ' + primeraReferencia(url) + '\n' +
            '  Railway la dejo como texto literal, asi que MySQL recibe esa cadena como clave y responde\n' +
            '  "Access denied for user \'root\' (using password: YES)".\n' +
            '  Revisa que el servicio MySQL se llame EXACTAMENTE como en la referencia (Mayusculas incluidas)\n' +
            '  y que la variable exista en ese servicio. Referencia correcta: ' + etiqueta + '=${{MySQL.MYSQL_URL}}'
        );
    }
    const p = parseUrlMySQL(url);
    if (!p || !p.database) {
        if (urlRotaPorClaveEspecial(url)) {
            fallar(
                etiqueta + ' no se pudo parsear porque la clave contiene "#", "/" o "?" sin codificar.\n' +
                '  Esos caracteres cortan la URL. Solucion: usa las variables sueltas en vez de la URL\n' +
                '  (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME) o codifica la clave\n' +
                '  ("#"=%23, "/"=%2F, "?"=%3F, "@"=%40, "%"=%25).'
            );
        }
        fallar(etiqueta + ' no es una URL MySQL valida (formato mysql://usuario:clave@host:puerto/base). Corrigela; la clave no se imprimira.');
    }
    return revisarConexion({ origen: etiqueta, url: url, host: p.host, port: p.port, user: p.user, password: p.password, database: p.database });
}

function desdeVariablesSueltas() {
    const host = process.env.DB_HOST || process.env.MYSQLHOST || '';
    if (!host) return null;
    return revisarConexion({
        origen: 'variables sueltas (DB_* / MYSQL*)',
        url: '',
        host: host,
        port: Number(process.env.DB_PORT || process.env.MYSQLPORT || 3306),
        user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
        password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
        database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'discoteca_db'
    });
}

// Validaciones finales de la conexion resuelta. Nunca imprime la clave:
// solo su longitud y si trae espacios o referencias sin resolver.
function revisarConexion(c) {
    const campos = { host: c.host, user: c.user, password: c.password, database: c.database };
    Object.keys(campos).forEach(function(k) {
        if (esReferenciaSinResolver(campos[k])) {
            const nombre = k === 'password' ? 'la clave' : k;
            fallar(
                'En la conexion resuelta ' + nombre + ' quedo como referencia de Railway SIN RESOLVER: ' +
                primeraReferencia(campos[k]) + '\n' +
                '  Railway no encontro ese servicio/variable y dejo el texto literal; MySQL lo rechaza con\n' +
                '  "Access denied for user \'root\' (using password: YES)". Corrige el nombre del servicio en la\n' +
                '  referencia (coinciden mayusculas) o pega el valor real.'
            );
        }
    });
    if (c.password && c.password !== c.password.trim()) {
        console.warn(
            '[BD] AVISO: la clave tiene espacios o saltos de linea al inicio/final ' +
            '(' + c.password.length + ' caracteres, ' + c.password.trim().length + ' sin ellos). ' +
            'Casi siempre es un copy/paste del panel: reescribe la variable sin espacios.'
        );
    }
    if (c.user && c.user !== c.user.trim()) {
        console.warn('[BD] AVISO: el usuario de BD tiene espacios al inicio/final.');
    }
    if (c.host && /\.railway\.internal$/i.test(c.host) && !EN_RAILWAY) {
        console.warn('[BD] AVISO: el host es interno de Railway (' + c.host + ') y este proceso NO corre en Railway.');
    }
    return c;
}

// Resumen seguro para logs: origen, host, puerto, usuario, base y largo de
// la clave. NUNCA incluye la clave.
function resumenConexion(c) {
    if (!c) return 'sin configurar';
    return 'origen=' + c.origen + ' host=' + c.host + ':' + c.port +
        ' usuario=' + c.user + ' base=' + c.database +
        ' clave=' + (c.password ? c.password.length + ' caracteres' : 'VACIA');
}

// Devuelve la conexion REAL resuelta o null si no hay ninguna configuracion.
function resolverConexionReal() {
    const url = String(process.env.DATABASE_URL || '').trim();
    if (url) return desdeUrl('DATABASE_URL', url);
    const mysqlUrl = String(process.env.MYSQL_URL || '').trim();
    if (mysqlUrl) return desdeUrl('MYSQL_URL', mysqlUrl);
    return desdeVariablesSueltas();
}

// Como resolverConexionReal, pero si no hay nada termina el proceso
// indicando en español que variable falta. (Usado por el pool REAL.)
function exigirConexionReal() {
    const c = resolverConexionReal();
    if (!c) {
        fallar(
            'Falta la configuracion de MySQL. Define una de estas opciones:\n' +
            '  1) DATABASE_URL = mysql://usuario:clave@host:puerto/base  (desde tu PC usa MYSQL_PUBLIC_URL del servicio MySQL de Railway)\n' +
            '  2) MYSQL_URL    = referencia ${{MySQL.MYSQL_URL}} del servicio MySQL en Railway\n' +
            '  3) DB_HOST + DB_PORT + DB_USER + DB_PASSWORD + DB_NAME  (o MYSQLHOST + MYSQLPORT + MYSQLUSER + MYSQLPASSWORD + MYSQLDATABASE)'
        );
    }
    return c;
}

function nombreBaseDatosReal() {
    const c = resolverConexionReal();
    if (c) return c.database;
    return process.env.DB_NAME || process.env.MYSQLDATABASE || 'discoteca_db';
}

function hostEsLocal(host) {
    return !host || host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

// La URL interna de Railway (*.railway.internal) solo resuelve dentro de
// Railway. Si un script corre fuera (tu PC) con esa URL, se detiene.
function verificarNoUrlInternaRailway() {
    const c = resolverConexionReal();
    const host = c ? String(c.host) : '';
    if (host && /\.railway\.internal$/i.test(host) && !EN_RAILWAY) {
        fallar('Usaste la URL interna. Desde tu PC usa MYSQL_PUBLIC_URL del servicio MySQL en Railway.');
    }
}

// CORS_ORIGINS: lista separada por comas; quita espacios y "/" final.
function origenesCorsPermitidos() {
    return String(process.env.CORS_ORIGINS || '')
        .split(',')
        .map(function(s){ return s.trim().replace(/\/+$/, ''); })
        .filter(Boolean);
}

// Valida CORS al arrancar: nunca "*", y en produccion no puede venir vacio.
function validarCorsAlArrancar() {
    const lista = origenesCorsPermitidos();
    if (lista.indexOf('*') !== -1) {
        fallar('CORS_ORIGINS no puede contener "*". Define origenes explicitos separados por coma (ej: https://club-master-git-main-esteban-90eb.vercel.app).');
    }
    if (esProduccion() && lista.length === 0) {
        fallar('Falta CORS_ORIGINS en produccion. Define la URL del frontend separada por comas, sin "/" final (ej: https://club-master-git-main-esteban-90eb.vercel.app).');
    }
    return lista;
}

// En produccion JWT_SECRET es obligatorio, >=32 chars y distinto del ejemplo.
function validarJwtAlArrancar() {
    if (!esProduccion()) return;
    const v = process.env.JWT_SECRET || '';
    if (!v) fallar('Falta JWT_SECRET en produccion (minimo 32 caracteres). Genera uno con: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    if (v.length < 32) fallar('JWT_SECRET debe tener al menos 32 caracteres en produccion.');
    if (v === JWT_SECRET_EJEMPLO) fallar('JWT_SECRET sigue con el valor de ejemplo de .env.example; genera uno nuevo.');
}

function validarSessionSecretAlArrancar() {
    if (!esProduccion()) return;
    const v = process.env.SESSION_SECRET || '';
    if (!v || v === SESSION_SECRET_EJEMPLO) fallar('Falta SESSION_SECRET en produccion (minimo 32 caracteres). Genera uno con: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    if (v.length < 32) fallar('SESSION_SECRET debe tener al menos 32 caracteres en produccion.');
}

// Secreto de la cookie de sesion.
// En produccion es obligatorio: validarSessionSecretAlArrancar() ya
// termina el proceso si falta, es corto o sigue con el valor de ejemplo,
// asi que aqui nunca se devuelve un valor de relleno.
// En desarrollo, si no hay SESSION_SECRET, se genera uno aleatorio SOLO
// para este proceso (evita el fallback fijo compartido, que permitiria
// falsificar cookies; reiniciar el servidor invalida las sesiones de
// desarrollo, sin impacto en datos).
function secretSesion() {
    const v = process.env.SESSION_SECRET || '';
    if (v) return v;
    if (esProduccion()) {
        fallar('Falta SESSION_SECRET en produccion (minimo 32 caracteres).');
    }
    return require('crypto').randomBytes(32).toString('hex');
}

// Puerto: process.env.PORT siempre manda. El valor por defecto (3000)
// aplica SOLO en desarrollo; en produccion PORT es obligatorio
// (Railway lo inyecta automaticamente si no lo fijas).
function puerto() {
    const crudo = process.env.PORT;
    if (crudo !== undefined && crudo !== '') {
        const n = Number(crudo);
        if (!Number.isInteger(n) || n <= 0 || n > 65535) {
            fallar('PORT debe ser un numero de puerto valido (1-65535). Valor recibido: ' + crudo);
        }
        return n;
    }
    if (esProduccion()) {
        fallar('Falta PORT en produccion. Railway inyecta PORT automaticamente; si lo desactivaste, define PORT=3000.');
    }
    return 3000;
}

// =========================================================
// Diagnostico de errores de conexion (nunca imprime claves).
// Devuelve lineas en español listas para console.error.
// =========================================================
function diagnosticarErrorConexion(err) {
    const lineas = [];
    const c = resolverConexionReal();
    const codigo = String((err && (err.code || err.errno)) || '');
    const mensaje = String((err && err.message) || err || '');

    lineas.push('--- Diagnostico de conexion a MySQL ---');
    lineas.push('Config usada : ' + resumenConexion(c));
    lineas.push('Codigo       : ' + (codigo || '(sin codigo)'));
    lineas.push('Mensaje      : ' + mensaje);
    if (c && /\.railway\.internal$/i.test(c.host) && !EN_RAILWAY) {
        lineas.push('Entorno      : fuera de Railway, pero el host es interno (*.railway.internal).');
    }

    if (codigo === 'ER_ACCESS_DENIED_ERROR' || codigo === '1045' || /Access denied for user/i.test(mensaje)) {
        // El mensaje de MySQL trae el host del CLIENTE entre comillas: en Railway
        // es la IPv6 privada del contenedor backend (fd12:...). Si la cuenta
        // root@'%' no existe, el servidor rechaza la conexion remota con este
        // MISMO error aunque la clave sea correcta.
        const mHostCliente = mensaje.match(/'([^']*)'@'([^']*)'/);
        const hostCliente = mHostCliente ? mHostCliente[2] : '';
        const remoto = hostCliente && !/^(localhost|127\.0\.0\.1|::1)$/.test(hostCliente);
        lineas.push('');
        lineas.push('DIAGNOSTICO: MySQL respondio. La red y el puerto estan bien;');
        lineas.push('lo que no coincide es el USUARIO o la CLAVE. Causas, en orden de frecuencia:');
        lineas.push('');
        if (remoto) {
            lineas.push('0) El mensaje dice @\'' + hostCliente + '\': ese es el CLIENTE (en Railway,');
            lineas.push('   la IPv6 privada del contenedor backend), no el servidor.');
            lineas.push('   MySQL distingue usuario@host: root@localhost y root@\'%\' son cuentas');
            lineas.push('   DISTINTAS. Si solo existe root@localhost, toda conexion remota se rechaza');
            lineas.push('   con este mismo error aunque la clave sea correcta.');
            lineas.push('   Compruebalo en el Shell del servicio MySQL, entrando en local:');
            lineas.push('     mysql -u root -p            (clave = MYSQL_ROOT_PASSWORD del panel)');
            lineas.push('     SELECT user, host, plugin FROM mysql.user;');
            lineas.push('   Si falta la fila "root | %", creala con la misma clave:');
            lineas.push("     CREATE USER IF NOT EXISTS 'root'@'%' IDENTIFIED BY '<misma clave>';");
            lineas.push("     GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;");
            lineas.push('     FLUSH PRIVILEGES;');
            lineas.push('');
        }
        lineas.push('1) Cambiaste MYSQL_ROOT_PASSWORD DESPUES de crear el servicio.');
        lineas.push('   MySQL solo aplica esa variable en la PRIMERA inicializacion del volumen:');
        lineas.push('   el servidor sigue teniendo la clave ANTIGUA mientras MYSQL_URL/MYSQLPASSWORD');
        lineas.push('   ya apuntan a la nueva. Es la causa #1 del "Access denied" en Railway.');
        lineas.push('   Arreglo A (conserva datos): en Railway -> servicio MySQL -> pestaña Shell/Deploy,');
        lineas.push('     entra con la clave ANTIGUA y ejecuta:');
        lineas.push("       ALTER USER 'root'@'%' IDENTIFIED BY 'TU_CLAVE_NUEVA';  FLUSH PRIVILEGES;");
        lineas.push('   Arreglo B (conserva datos): devuelve MYSQL_ROOT_PASSWORD al valor antiguo.');
        lineas.push('   Arreglo C (BORRA datos): Settings -> Delete Volume del MySQL y redespliega.');
        lineas.push('');
        lineas.push('2) La referencia de Railway no se resolvio y quedo el texto literal.');
        lineas.push('   En el servicio backend la variable debe ser EXACTAMENTE:');
        lineas.push('     DATABASE_URL=${{MySQL.MYSQL_URL}}');
        lineas.push('   Si tu servicio se llama distinto (mysql, db, MySQL-Prod), ajusta el nombre.');
        lineas.push('   En Deploy -> Variables, el valor ya resuelto debe empezar con mysql://');
        lineas.push('   y NO mostrar "${{" ni "}}".');
        lineas.push('');
        lineas.push('3) Clave copiada con espacios/salto de linea, o con caracteres especiales');
        lineas.push('   (# / ? @ %) que rompen la URL. Prueba con variables sueltas en el backend:');
        lineas.push('     DB_HOST=${{MySQL.MYSQLHOST}}       DB_PORT=${{MySQL.MYSQLPORT}}');
        lineas.push('     DB_USER=${{MySQL.MYSQLUSER}}       DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}');
        lineas.push('     DB_NAME=${{MySQL.MYSQLDATABASE}}');
        lineas.push('   (sin DATABASE_URL ni MYSQL_URL: esas ganan y anulan las sueltas).');
        lineas.push('');
        lineas.push('4) Hay DOS servicios MySQL en el proyecto y el backend apunta al otro.');
        lineas.push('');
        lineas.push('Verificacion rapida desde tu PC (usa la URL PUBLICA del servicio MySQL):');
        lineas.push('   PowerShell : $env:DATABASE_URL="<MYSQL_PUBLIC_URL>"; node Backend/scripts/diagnose-db.js');
        lineas.push('   Bash       : DATABASE_URL="<MYSQL_PUBLIC_URL>" node Backend/scripts/diagnose-db.js');
    } else if (codigo === 'ER_DBACCESS_DENIED_ERROR' || codigo === '1044') {
        lineas.push('');
        lineas.push('DIAGNOSTICO: usuario y clave correctos, pero sin permiso sobre esa base.');
        lineas.push('Revisa que la base del final de la URL exista en el servicio MySQL');
        lineas.push('(MYSQLDATABASE, por defecto "railway") y que el usuario sea el dueno.');
    } else if (codigo === 'ENOTFOUND' || codigo === 'EAI_AGAIN' || /getaddrinfo/i.test(mensaje)) {
        lineas.push('');
        lineas.push('DIAGNOSTICO: el host no resuelve (DNS).');
        lineas.push('- Si termina en .railway.internal, esa URL SOLO funciona dentro de Railway:');
        lineas.push('  desde tu PC usa MYSQL_PUBLIC_URL con Public Proxying activado.');
        lineas.push('- Dentro de Railway, confirma que ambos servicios esten en el MISMO proyecto/entorno.');
    } else if (codigo === 'ECONNREFUSED' || codigo === 'ETIMEDOUT' || codigo === 'ECONNRESET' ||
               codigo === 'PROTOCOL_CONNECTION_LOST' || codigo === 'PROTOCOL_SEQUENCE_TIMEOUT') {
        lineas.push('');
        lineas.push('DIAGNOSTICO: no hay respuesta de red del MySQL.');
        lineas.push('- Servicio MySQL caido o aun arrancando (miralo en Deploy logs).');
        lineas.push('- Puerto equivocado: el proxy publico de Railway NO usa 3306, usa el puerto de MYSQL_PUBLIC_URL.');
        lineas.push('- Public Proxying desactivado (solo necesario para conectar desde tu PC).');
    } else if (codigo === 'ER_NOT_SUPPORTED_AUTH_MODE' || /caching_sha2_password|auth plugin/i.test(mensaje)) {
        lineas.push('');
        lineas.push('DIAGNOSTICO: el plugin de autenticacion no coincide.');
        lineas.push("Crea/ajusta el usuario con mysql_native_password, o actualiza mysql2 (>=3.x ya lo soporta).");
    } else if (/SSL|certificate|self.signed|handshake/i.test(mensaje)) {
        lineas.push('');
        lineas.push('DIAGNOSTICO: fallo el handshake TLS.');
        lineas.push('- Prueba DB_SSL=false (el MySQL de Railway no exige SSL en red interna).');
        lineas.push('- Si el proveedor pide verificar el CA, pega el PEM en DB_SSL_CA.');
    }
    lineas.push('--------------------------------------');
    return lineas;
}

module.exports = {
    EN_RAILWAY,
    esProduccion,
    fallar,
    parseUrlMySQL,
    decodificarSeguro,
    esReferenciaSinResolver,
    resolverConexionReal,
    exigirConexionReal,
    nombreBaseDatosReal,
    resumenConexion,
    hostEsLocal,
    verificarNoUrlInternaRailway,
    diagnosticarErrorConexion,
    origenesCorsPermitidos,
    validarCorsAlArrancar,
    validarJwtAlArrancar,
    validarSessionSecretAlArrancar,
    secretSesion,
    puerto
};
