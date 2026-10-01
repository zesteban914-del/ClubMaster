# Railway: "Access denied for user 'root' (using password: YES)"

Guia de diagnostico para el error mas comun al desplegar ClubMaster en Railway.
Sintoma tipico: el **Pre-deploy Command** (`npm run migrate`) falla, el deploy se
detiene y en los logs aparece:

```
Migraciones fallidas: Access denied for user 'root'@'...' (using password: YES)
```

## Que significa exactamente

MySQL **si respondio**: el host existe, el puerto esta abierto y el servicio esta
vivo. No es un problema de red, de DNS ni de SSL. Lo unico que no coincide es el
**usuario o la clave** con los que intenta entrar el backend.

Desde este commit el propio codigo te lo dice: `npm run migrate`,
`npm run db:doctor` y el arranque de `server.js` imprimen

- que configuracion gano (`DATABASE_URL` > `MYSQL_URL` > `DB_*`/`MYSQL*`),
- host, puerto, usuario, base y **largo** de la clave (la clave nunca se imprime),
- las causas probables segun el codigo de error.

## Causa 1 (la mas frecuente): cambiaste la clave despues de crear el MySQL

`MYSQL_ROOT_PASSWORD` solo se aplica en la **primera inicializacion del volumen**.
Si la editaste despues, el servidor MySQL sigue teniendo la clave **antigua**,
mientras `MYSQLPASSWORD` / `MYSQL_URL` / `MYSQL_PUBLIC_URL` ya muestran la nueva.
Resultado: credenciales validas en el panel, rechazadas por el servidor.

Comprobalo en Railway -> servicio **MySQL** -> pestana **Shell** (o Deploy logs ->
Shell):

```bash
mysql -u root -p            # prueba la clave NUEVA
mysql -u root -p            # prueba la clave ANTIGUA
```

Si entra con la antigua, elige uno de estos tres arreglos:

**A. Sincronizar la clave real (conserva los datos, recomendado).**
Dentro del Shell del MySQL, conectado con la clave ANTIGUA:

```sql
ALTER USER 'root'@'%' IDENTIFIED BY 'TU_CLAVE_NUEVA';
FLUSH PRIVILEGES;
SELECT user, host, plugin FROM mysql.user;   -- verifica que existe root@%
```

Despues, en el servicio **backend**: redeploy (las referencias ya apuntan a la
nueva, asi que no hay que tocar variables).

**B. Devolver la variable al valor antiguo (conserva los datos, cero SQL).**
En el servicio MySQL, pon `MYSQL_ROOT_PASSWORD` de vuelta a la clave con la que
si entra y redespliega el backend.

**C. Reiniciar el MySQL (BORRA TODOS LOS DATOS).**
Servicio MySQL -> Settings -> **Delete Volume** -> redespliega. Solo si la base
esta vacia o ya tienes respaldo. **Lee la seccion siguiente antes de hacerlo.**

## Que se borra exactamente con "Delete Volume"

`Delete Volume` elimina el **directorio de datos completo** del servicio MySQL:
todas las bases, todas las tablas, todas las filas, los usuarios MySQL (`root`
incluido) y sus claves. Railway vuelve a inicializar MySQL vacio aplicando el
`MYSQL_ROOT_PASSWORD` actual. No es "borrar filas": es formatear el servidor de
datos. Lo unico que sobrevive son las variables de entorno del servicio.

**No se toca:** el codigo en GitHub, las variables del servicio backend, el
dominio `*.up.railway.app` ni el frontend en Vercel.

**Vuelve solo al redesplegar** (el Pre-deploy Command es `npm run migrate`):

- 37 tablas del esquema + los seeds que trae `migrate.js`: `permisos`,
  `rol_permisos`, `rol_zonas_permiso`, `bodegas`, `configuracion_general`.
- `asistencias`, `auditoria_incidencias` y `vaciados_efectivo` las crea
  `Backend/routes/operativa.js` al arrancar.
- `facturas` la crea `Backend/routes/productos.js` bajo demanda.

**ADVERTENCIA: hay tablas que el codigo usa pero que `migrate.js` NO crea**,
porque solo existen en tu base viva (se crearon a mano en su momento):

| Tabla | Usos en el codigo |
| --- | --- |
| `pedidos` | 120 |
| `productos` | 117 |
| `mesas` | 66 |
| `detalle_pedido` | 52 |
| `detalle_factura` | 5 |
| `factura_correcciones` | 2 |
| `mesa_transferencias` | 1 |

Si borras el volumen, el backend arranca y `/health` responde `{"ok":true}`, pero
**Mesas, Comandero, Productos y Ventas se caen** con
`Table 'railway.mesas' doesn't exist`. Desde el repo **no hay forma de
reconstruirlas**: solo desde un dump de tu base actual.

**Catalogos que tampoco vuelven solos:** `migrate` crea vacias `roles`,
`usuarios`, `zonas`, `unidades_medida`, `categorias`, `metodos_pago`,
`presentaciones`, `conversiones`, `notas_preparacion`, `configuracion_inventario`
y `recetas`. Las llena `npm run seed` (usuarios demo con clave `1234`; **solo
local**, se niega en produccion) o `npm run setup:fresh` (un unico admin real,
exige `ADMIN_EMAIL` y `ADMIN_TEMP_PASSWORD` >=12 caracteres). Sin uno de los dos,
**nadie puede iniciar sesion**. Tambien se pierden para siempre: `jornadas`,
`movimientos_caja`, `arqueos_detalle`, `compras`, `kardex`, `stock_bodegas`,
`clientes_socios`, `cuentas_por_cobrar`, `abonos_vales`, `mermas`, `turnos`,
`audit_logs` y las sesiones activas.

**Los backups automaticos no te salvan:** `Backend/services/backup.js` escribe en
`backups/` **dentro del contenedor** (no en el volumen de MySQL) con retencion de
7 dias, y el filesystem del contenedor es efimero: se pierde en cada redeploy.

> Conclusión: para destrabar una clave **no necesitas `Delete Volume`**. Usa el
> arreglo A o el B, que conservan todo. Y haz el respaldo de abajo antes de tocar
> nada, pase lo que pase.

## Respaldo ahora mismo (2 minutos, desde tu PC)

Necesitas `MYSQL_PUBLIC_URL` del servicio MySQL (Public Proxying activado) y
`mysqldump` en el PATH. Separa host y puerto de esa URL
(`mysql://root:clave@HOST:PUERTO/railway`):

```powershell
# PowerShell: estructura + datos
mysqldump --host=<HOST> --port=<PUERTO> --user=root --password `
  --single-transaction --routines --triggers `
  railway > respaldo_$(Get-Date -Format yyyyMMdd).sql
```

```bash
# bash / zsh
mysqldump --host=<HOST> --port=<PUERTO> --user=root --password \
  --single-transaction --routines --triggers \
  railway > respaldo_$(date +%F).sql
```

Solo la estructura (sirve para incorporar `mesas`/`productos`/`pedidos` a
`migrate.js`, que es la deuda pendiente del repo):

```bash
mysqldump --no-data --host=<HOST> --port=<PUERTO> --user=root --password \
  railway > esquema.sql
```

Restaurar sobre un MySQL recien creado:

```bash
mysql --host=<HOST> --port=<PUERTO> --user=root --password railway < respaldo_2026-10-01.sql
```

Si `mysqldump` tambien te da `Access denied`, entra con la clave antigua desde el
Shell del servicio MySQL en Railway y saca el dump desde ahi, o aplica primero el
arreglo A y despues respalda.

## Causa 2: la referencia de Railway no se resolvio

Railway deja el texto literal cuando el **nombre del servicio** no coincide
(mayúsculas incluidas) o la variable no existe en ese servicio. MySQL recibe
entonces la cadena `${{MySQL.MYSQLPASSWORD}}` como clave y la rechaza.

En el servicio **backend** -> Settings -> Variables, la referencia correcta es:

```
DATABASE_URL=${{MySQL.MYSQL_URL}}
```

Como verificarlo: en la lista de variables del backend, el valor **resuelto**
debe empezar con `mysql://root:...`. Si ves `${{` o `}}`, el nombre del servicio
esta mal escrito (p. ej. tu servicio se llama `mysql`, `db` o `MySQL-Prod`).

> El codigo ya detecta esto y termina con un mensaje explicito en vez de dejar
> que MySQL responda `Access denied`.

## Causa 3: clave con espacios o caracteres especiales

Dos variantes:

1. **Copy/paste con espacio o salto de linea** al final. El backend avisa en los
   logs: `[BD] AVISO: la clave tiene espacios...`. Reescribe la variable a mano.
2. **Caracteres que rompen la URL** (`#`, `/`, `?`, `@`, `%`). En una URL MySQL
   esos caracteres cortan el parseo; `new URL()` falla o deja la clave truncada.

Para el caso 2 (o si quieres evitarte el problema de raiz), usa **variables
sueltas** en el servicio backend y borra `DATABASE_URL`/`MYSQL_URL` de alli
(recuerda el orden: la URL gana y anula las sueltas):

```
DB_HOST=${{MySQL.MYSQLHOST}}
DB_PORT=${{MySQL.MYSQLPORT}}
DB_USER=${{MySQL.MYSQLUSER}}
DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
DB_NAME=${{MySQL.MYSQLDATABASE}}
```

Si prefieres mantener la URL, codifica la clave: `#`=`%23`, `/`=`%2F`,
`?`=`%3F`, `@`=`%40`, `%`=`%25`.

## Causa 4: dos servicios MySQL en el mismo proyecto

El backend apunta a uno y tu editas las variables del otro. Revisa en la vista
del proyecto cuantos servicios MySQL hay y borra/reutiliza el correcto. Las
referencias `${{Nombre.VARIABLE}}` usan el **nombre visible** del servicio.

## Como verificar desde tu PC (sin tocar Railway)

El servicio MySQL expone `MYSQL_PUBLIC_URL` (proxy publico). Copiala y corre el
diagnostico:

```powershell
# PowerShell
$env:DATABASE_URL = "<pega aqui MYSQL_PUBLIC_URL>"
node Backend/scripts/diagnose-db.js            # solo prueba la conexion
node Backend/scripts/diagnose-db.js --migrate  # prueba + migra
```

```bash
# bash / zsh
DATABASE_URL="<pega aqui MYSQL_PUBLIC_URL>" node Backend/scripts/diagnose-db.js
```

Atajo equivalente: `npm run db:doctor`.

Si ahi entra bien pero en Railway falla, la diferencia esta en las variables del
servicio backend (causa 2 o 3) o en que la clave real del MySQL cambió (causa 1):
recuerda que el proxy publico y la red interna comparten credenciales.

> `MYSQL_PUBLIC_URL` requiere **Public Proxying** activado en el servicio MySQL
> (Settings -> Networking). El puerto publico NO es 3306.
> Si usas `MYSQL_URL` (`*.railway.internal`) desde tu PC, el script se detiene y
> te lo dice: esa URL solo resuelve dentro de Railway.

## Configuracion correcta del servicio backend en Railway

| Ajuste | Valor |
| --- | --- |
| Root Directory | `Backend` |
| Start Command | `node server.js` |
| Pre-deploy Command | `npm run migrate` |
| Variable de red publica | **Generate Domain** activado (te da `https://<servicio>.up.railway.app`) |

Variables minimas:

```
NODE_ENV=production
DATABASE_URL=${{MySQL.MYSQL_URL}}
APP_URL=https://<tu-backend>.up.railway.app          (sin "/" final)
CORS_ORIGINS=https://<tu-frontend>.vercel.app        (sin "/" final, nunca "*")
SESSION_SECRET=<32+ caracteres aleatorios>
JWT_SECRET=<32+ caracteres aleatorios, distinto del anterior>
```

Genera secretos con:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

No definas `PORT`: Railway lo inyecta. En produccion el servidor **no arranca**
si faltan `SESSION_SECRET`, `JWT_SECRET` o `CORS_ORIGINS` (mensajes FATAL en
español en los Deploy logs).

## Checklist antes de redesplegar

1. `mysql -u root -p` entra con la clave que muestra el panel (Causa 1).
2. En el backend, el valor resuelto de `DATABASE_URL` empieza con `mysql://` (Causa 2).
3. Ni el usuario ni la clave tienen espacios; la clave no trae `#` `/` `?` sin codificar (Causa 3).
4. Un solo servicio MySQL en el proyecto (Causa 4).
5. Desde tu PC, `node Backend/scripts/diagnose-db.js --migrate` termina en `MIGRACION OK`.
6. Redeploy del backend -> Deploy logs -> `migrate -> origen=... MySQL OK` y luego
   `Servidor iniciado en puerto ... env=production`.
7. `https://<tu-backend>.up.railway.app/health` responde `{"ok":true}`.
8. En Vercel, `VITE_API_URL` = la URL publica del backend, con `https://` y sin `/` final.

## Si nada de esto funciona

Ejecuta el diagnostico completo y pega su salida (no contiene claves):

```bash
npm run db:doctor
```

Muestra, en orden: variables que vienen del shell, que fuente gana, el pool exacto
que se le pasa a `mysql2` (incluido el bloque `ssl`), la prueba de conexion real y
el conteo de tablas. Con esas cuatro secciones se identifica cualquier causa.
