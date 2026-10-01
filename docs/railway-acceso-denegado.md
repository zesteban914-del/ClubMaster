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

## Camino rapido: 3 clics, sin saber ni tocar la clave

Casi todos los `Access denied` de ClubMaster en Railway se resuelven dejando que
**Railway inyecte la clave por ti**, en vez de escribirla a mano. No necesitas
saberla.

1. Servicio **backend** -> pestana **Variables** -> borra TODO lo de base de datos
   que este escrito a mano: `DATABASE_URL`, `MYSQL_URL`, `DB_HOST`, `DB_PORT`,
   `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `MYSQLHOST`, `MYSQLPASSWORD`,
   `MYSQLDATABASE`. (Recuerda: `DATABASE_URL` gana y anula las sueltas; dejar dos
   fuentes a medias es lo que produce el 1045.)
2. **+ New Variable** -> nombre `DATABASE_URL` -> en el valor escribe `${{` y
   Railway autocompleta: elige servicio **MySQL** -> variable **MYSQL_URL**. Queda
   `DATABASE_URL=${{MySQL.MYSQL_URL}}`. Railway la resuelve con el host, el puerto
   y la clave reales del servicio.
3. **Redeploy**. En Deploy logs debes ver:
   ```
   migrate -> origen=DATABASE_URL host=<...>.railway.internal:3306 usuario=root base=railway clave=NN caracteres
   ...
   Migraciones completadas exitosamente.
   ```

Si el nombre de tu servicio MySQL no es exactamente `MySQL`, el autocompletado te
muestra el nombre correcto: usa ese (las referencias distinguen mayusculas).

**Si despues de esto sigue el Access denied**, entonces la clave que guarda el
servidor no es la del panel (volumen inicializado con otra). Antes del
procedimiento largo, dos intentos de 10 segundos:

- Abre el **Shell** del servicio MySQL y prueba `mysql -u root` y `mysql` (sin
  `-p`). En algunas imagenes el root local entra por socket sin clave; si entra,
  ejecuta ahi mismo el `ALTER USER` del Paso 2 y listo.
- Mira la clave en el panel: servicio MySQL -> Variables -> `MYSQL_ROOT_PASSWORD`
  (icono del ojo). No hay que recordarla, esta guardada en texto plano.

Recien si ambos fallan, sigue con **"No recuerdo la clave de root"** (Paso 2).

## El error muestra una IP: `'root'@'fd12:...'` (la cuenta no acepta ese host)

Ejemplo real de los Deploy logs de Railway:

```
Migraciones fallidas: Access denied for user 'root'@'fd12:9e0f:2ee6:1:d000:102:3632:62a' (using password: YES)
```

Lo que dice ese mensaje:

- **MySQL respondio**: el host interno y el puerto son correctos y el servicio
  esta vivo. No es red, no es DNS, no es SSL.
- `fd12:...` es la **IPv6 privada del contenedor backend** dentro del proyecto.
  Es el host del **CLIENTE**, no del servidor: confirma que la conexion va por la
  red interna de Railway.
- `using password: YES`: se envio una clave y fue rechazada... **o la cuenta no
  existe para ese host**, que es lo siguiente.

MySQL identifica las cuentas como `usuario@host`. `'root'@'localhost'` y
`'root'@'%'` son **cuentas distintas**, cada una con su clave y sus permisos. La
imagen oficial de MySQL solo crea `root@'%'` cuando arranca con
`MYSQL_ROOT_HOST=%`, y **solo en la primera inicializacion del volumen**: agregar
esa variable despues no crea la cuenta. Si en tu MySQL unicamente existe
`root@localhost`, toda conexion desde el backend se rechaza con este MISMO error
**aunque la clave sea correcta**.

### Arreglo (2 minutos, sin perder datos y sin tocar el Start Command)

1. Servicio **MySQL** -> Variables -> revela `MYSQL_ROOT_PASSWORD` (icono del ojo).
2. Servicio **MySQL** -> **Shell** -> entra en local (usa la cuenta
   `root@localhost`, que si existe):
   ```bash
   mysql -u root -p        # pega la clave del paso 1
   ```
3. Mira que cuentas hay:
   ```sql
   SELECT user, host, plugin FROM mysql.user;
   ```
4. Si **no** aparece una fila `root | %`, creala con la misma clave:
   ```sql
   CREATE USER IF NOT EXISTS 'root'@'%' IDENTIFIED BY '<la clave del paso 1>';
   GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;
   FLUSH PRIVILEGES;
   SELECT user, host, plugin FROM mysql.user;   -- ahora debe aparecer root | %
   ```
   Que la clave no tenga `'` `"` `\` `#` `/` `?` `@` `%` ni espacios (Causa 3).
5. **Redeploy** del backend -> Deploy logs -> `Migraciones completadas exitosamente.`

Si en el paso 2 esa clave no te deja entrar **ni en local**, la clave real del
servidor es otra (volumen inicializado con un valor anterior): ve a
["No recuerdo la clave de root"](#no-recuerdo-la-clave-de-root), Paso 2.

> Mejora pendiente: `root@'%'` expone el superusuario a toda la red privada del
> proyecto. Para produccion conviene un usuario dedicado (`clubmaster@'%'` con
> permisos solo sobre la base de la app). Hoy la prioridad es que el deploy pase.

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

## No recuerdo la clave de root

No hace falta recordarla: **Railway la guarda en texto plano en las variables del
servicio** y puedes revelarla. Y si la que muestra el panel ya no es la real
(volumen inicializado con otra), se puede reiniciar **sin perder datos**.

### Paso 1: leela en el panel

- Servicio **MySQL** -> pestana **Variables** -> `MYSQL_ROOT_PASSWORD` (icono del
  ojo para revelarla). Tambien la llevan dentro `MYSQLPASSWORD`, `MYSQL_URL` y
  `MYSQL_PUBLIC_URL`, con esta forma: `mysql://root:<AQUI_VA_LA_CLAVE>@host:puerto/railway`.
- Servicio **backend** -> **Variables** -> `DATABASE_URL`: el valor resuelto es la
  cadena que de verdad se le envia a MySQL, clave incluida.

Compara ambos valores:

| Lo que ves | Significa | Ir a |
| --- | --- | --- |
| Coinciden y aun asi falla | el servidor conserva una clave anterior (volumen viejo) | Paso 2 |
| `DATABASE_URL` muestra `${{...}}` u otro valor | la referencia no se resolvio | Causa 2 |
| La clave tiene espacios o `#` `/` `?` `@` `%` | se rompe al armar la URL | Causa 3 |

Dos ayudas extra:

- `npm run db:doctor` imprime el **largo** de la clave (nunca la clave) y el
  origen que gana. Si ese largo no coincide con el de la variable del panel, el
  backend esta leyendo otra cosa. En Railway, el Pre-deploy Command imprime la
  misma linea: `migrate -> origen=DATABASE_URL host=... clave=NN caracteres`.
- En los **Deploy logs del PRIMER despliegue** del servicio MySQL, la imagen
  oficial imprime `GENERATED ROOT PASSWORD: ...` cuando genero la clave al azar.
  Railway conserva el historial de despliegues: buscalo alli.

### Paso 2: reiniciarla sin saberla y sin perder datos

En MySQL 8, `--skip-grant-tables` **tambien activa `skip_networking`** (no acepta
conexiones remotas), asi que el SQL se ejecuta desde el **Shell del propio
contenedor** del servicio MySQL.

1. Servicio MySQL -> Settings -> Deploy -> **Custom Start Command**, temporalmente:
   ```
   mysqld --skip-grant-tables
   ```
   Guarda y **Redeploy**.
2. Abre el **Shell** del servicio MySQL y entra sin clave:
   ```bash
   mysql -u root
   ```
3. Ejecuta (`FLUSH PRIVILEGES` primero: sin eso `ALTER USER` esta deshabilitado
   en modo skip-grant-tables):
   ```sql
   FLUSH PRIVILEGES;
   ALTER USER 'root'@'%' IDENTIFIED BY 'NuevaClaveLarga123';
   ALTER USER 'root'@'localhost' IDENTIFIED BY 'NuevaClaveLarga123';
   FLUSH PRIVILEGES;
   SELECT user, host, plugin FROM mysql.user;
   ```
   Si `'root'@'%'` no existe:
   ```sql
   CREATE USER 'root'@'%' IDENTIFIED BY 'NuevaClaveLarga123';
   GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;
   FLUSH PRIVILEGES;
   ```
   Elige una clave **sin** `#` `/` `?` `@` `%` `'` `"` ni espacios: te ahorra la
   Causa 3 de una vez. `'root'@'%'` es la que importa: el backend conecta desde
   otro contenedor, no desde localhost.
4. **Quita** el Custom Start Command (dejalo como estaba) -> **Redeploy**.
5. En el servicio MySQL, deja `MYSQL_ROOT_PASSWORD` con la clave nueva. Esa
   variable **ya no cambia la clave del servidor** (solo se uso en la primera
   inicializacion del volumen), pero es de la que salen `MYSQL_URL`,
   `MYSQLPASSWORD` y `MYSQL_PUBLIC_URL`: si no coincide, el backend vuelve a
   fallar con Access denied.
6. Verifica desde tu PC y redespliega el backend:
   ```powershell
   $env:DATABASE_URL = "<MYSQL_PUBLIC_URL con la clave nueva>"
   npm run db:doctor          # debe terminar en CONEXION OK
   ```

**Variante `--init-file`** (metodo de la documentacion oficial; mantiene la red
activa, no deja el servidor abierto sin autenticacion):

1. Desde el Shell del MySQL, escribe el archivo **dentro del volumen** (persiste
   entre despliegues; el resto del contenedor no):
   ```bash
   printf "ALTER USER 'root'@'%%' IDENTIFIED BY 'NuevaClaveLarga123';\nFLUSH PRIVILEGES;\n" \
     > /var/lib/mysql/reset-password.sql
   ```
2. Custom Start Command: `mysqld --init-file=/var/lib/mysql/reset-password.sql`
   -> Redeploy. El servidor ejecuta ese archivo al arrancar, con privilegios de
   root y sin pedir clave.
3. Quita el Custom Start Command, borra el archivo
   (`rm /var/lib/mysql/reset-password.sql`) y redespliega. Sigue los pasos 5 y 6.

### Ultimo recurso: rescatar los datos sin conocer la clave

Solo si el servicio no te deja cambiar el Start Command ni abrir Shell. **No uses
Delete Volume**: perderias `mesas`, `productos`, `pedidos` y `detalle_pedido`,
que `migrate.js` no crea (ver seccion siguiente). Desde el Shell del MySQL, con
el servidor corriendo, se puede volcar una **copia** del datadir:

```bash
cp -a /var/lib/mysql /tmp/copia
mysqld --datadir=/tmp/copia --socket=/tmp/copia.sock --skip-grant-tables &
mysql --socket=/tmp/copia.sock -u root -e "FLUSH PRIVILEGES; SELECT user,host FROM mysql.user;"
mysqldump --socket=/tmp/copia.sock -u root --single-transaction --routines --triggers \
  railway > /tmp/respaldo.sql
```

Y de ahi, o lo restauras en un servicio MySQL nuevo (misma red privada del
proyecto) o le cambias la clave a la copia y la usas como base definitiva:

```bash
mysql --socket=/tmp/copia.sock -u root \
  -e "FLUSH PRIVILEGES; ALTER USER 'root'@'%' IDENTIFIED BY 'NuevaClaveLarga123'; FLUSH PRIVILEGES;"
```

Avisos: es una copia **en caliente**, puede quedar inconsistente; si `mysqld` no
arranca sobre ella, reintenta con `--innodb-force-recovery=1` (sube de a uno,
solo lectura) y vuelca. El filesystem del contenedor es efimero: saca
`/tmp/respaldo.sql` de ahi en la misma sesion.

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
