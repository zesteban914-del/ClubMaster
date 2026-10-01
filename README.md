# ClubMaster

POS + inventario + finanzas para discotecas/bares. Backend Node/Express, frontend HTML/CSS/JS estatico, MySQL.

## Arquitectura de despliegue

- **Frontend:** Vercel (solo estatico). El build (`scripts/vercel-build.js`) genera `Frontend/js/env-config.js` desde `VITE_API_URL`.
- **Backend:** Railway con **Root Directory = `Backend`** y **Start Command = `node server.js`** (usa `Backend/package.json`: `npm start` / `npm run migrate`). Escucha en `process.env.PORT` en `0.0.0.0` (Railway inyecta `PORT`; no lo definas). En desarrollo el default es 3000.
- **Base de datos:** el servicio **MySQL del mismo proyecto de Railway** (se llama `MySQL`).
- **`APP_URL`:** dominio publico del **backend** (Railway), sin `/` final. Lo usan los correos (link de recuperacion y link de cierre `/api/jornada/{id}/reporte`). No lo apuntes a Vercel: alli no hay `/api`.

## Conexion a MySQL (servicio MySQL de Railway)

Railway **NO crea `DATABASE_URL`**. El servicio MySQL expone:

| Variable | Uso |
| --- | --- |
| `MYSQL_URL` | red interna del proyecto (backend en Railway) |
| `MYSQL_PUBLIC_URL` | proxy publico (scripts desde tu PC: migrate, setup:fresh) |
| `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE` | la misma informacion en variables sueltas |

Orden de lectura del backend (centralizado en `Backend/config/env.js`; el primero gana):

1. `DATABASE_URL`
2. `MYSQL_URL`
3. Variables sueltas: `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`/`DB_NAME` **o** `MYSQLHOST`/`MYSQLPORT`/`MYSQLUSER`/`MYSQLPASSWORD`/`MYSQLDATABASE`

Si no hay ninguna, el servidor **no arranca** y avisa en español que variable falta. Las claves nunca se imprimen en los logs.

La URL interna (`*.railway.internal`) solo resuelve dentro de Railway: `npm run migrate` la rechaza si corre fuera y te pide usar `MYSQL_PUBLIC_URL`.

En el servicio **backend** de Railway, la referencia correcta es:

```
DATABASE_URL=${{MySQL.MYSQL_URL}}
```

### Si Railway rechaza la conexion

`Access denied for user 'root' (using password: YES)` significa que MySQL **si
respondio**: no es red ni SSL, es el usuario o la clave. Causas, en orden de
frecuencia (guia completa paso a paso en
[`docs/railway-acceso-denegado.md`](docs/railway-acceso-denegado.md)):

1. **Cambiaste `MYSQL_ROOT_PASSWORD` despues de crear el servicio.** MySQL solo
   la aplica en la primera inicializacion del volumen: el servidor conserva la
   clave antigua mientras `MYSQL_URL` ya muestra la nueva. Se arregla con
   `ALTER USER 'root'@'%' IDENTIFIED BY '...'; FLUSH PRIVILEGES;` desde el Shell
   del servicio MySQL (o devolviendo la variable al valor antiguo). **No la
   recuerdas?** Esta guardada en texto plano en Railway (servicio MySQL ->
   Variables -> `MYSQL_ROOT_PASSWORD`, o dentro de `MYSQL_URL`); y si esa ya no
   es la real, se reinicia sin perder datos con `mysqld --skip-grant-tables` como
   Custom Start Command temporal (procedimiento completo en la guia).
2. **La referencia `${{MySQL.MYSQL_URL}}` no se resolvio** (nombre del servicio
   distinto) y MySQL recibe el texto literal como clave. El valor resuelto en el
   backend debe empezar con `mysql://`.
3. **Clave con espacios o con `#` `/` `?` `@` `%`**, que rompen la URL. Usa
   variables sueltas (`DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`/`DB_NAME`
   referenciando a `MYSQLHOST`/`MYSQLPORT`/...) o codifica la clave.
4. **Dos servicios MySQL** en el proyecto y el backend apunta al otro.

`npm run migrate`, `npm run db:doctor` y el arranque del servidor imprimen que
configuracion gano (host, puerto, usuario, base y largo de la clave — nunca la
clave) mas el diagnostico segun el codigo de error.

> **No uses "Delete Volume" del MySQL para arreglar la clave.** Ademas de los
> datos de operacion (jornadas, caja, compras, kardex, cartera, usuarios), hay
> tablas que el codigo usa pero que `migrate.js` NO crea porque solo existen en
> la base viva: `mesas`, `productos`, `pedidos`, `detalle_pedido`,
> `mesa_transferencias`, `detalle_factura`, `factura_correcciones`. Sin un dump
> previo, Mesas/Comandero/Productos/Ventas no vuelven. Arregla la clave con
> `ALTER USER 'root'@'%' IDENTIFIED BY '...'` desde el Shell del servicio MySQL y
> respalda con `mysqldump` (pasos en la guia).

## Comandos

- `npm run db:doctor` — diagnostico de conexion: variables que trae el shell, fuente que gana, pool exacto, prueba real y tablas. Con `--migrate` ademas migra.
- `npm run migrate` — esquema idempotente (`CREATE TABLE IF NOT EXISTS` + `ALTER` guardados). Se puede repetir sin romper nada. Termina con codigo 0 si todo ok y 1 si falla, asi que sirve como **Pre-deploy Command** en Railway. Desde tu PC: `$env:DATABASE_URL = "<MYSQL_PUBLIC_URL>"; npm run migrate`.
- `npm run clean:dupes` — **debe correr antes de la primera migracion** si la base ya tiene `zonas` o `unidades_medida` con nombres repetidos: sin eso, el `ALTER TABLE ... ADD UNIQUE` de esos indices falla y `migrate` lo reporta como aviso (no aborta, pero el indice unico no se crea y los `INSERT IGNORE` de los seeds duplicarian filas).
- `npm run setup` — migrate + seed con usuarios demo (clave `1234`). **Solo local**: se niega si `NODE_ENV=production` o si el host no es `localhost`/`127.0.0.1`.
- `npm run setup:fresh` — provisionado limpio (borra tablas transaccionales). Exige `ADMIN_EMAIL` y `ADMIN_TEMP_PASSWORD` (min. 12 caracteres); crea solo ese admin hasheado (bcrypt, igual que el login), no lo duplica si ya existe y **no imprime la clave**.

## Salud y CORS

- `GET /health` -> `200 {"ok":true}` sin consultar la base de datos.
- `CORS_ORIGINS`: lista separada por comas, sin espacios ni `/` final. Nunca `*`; vacio en produccion impide arrancar. Ejemplo: `https://club-master-git-main-esteban-90eb.vercel.app`.

## Frontend (Vercel)

- `VITE_API_URL` (Production **y** Preview): URL publica del backend Railway, con `https://` y **sin** `/` final. `scripts/vercel-build.js` la normaliza igual (quita `/` finales) y la escribe en `Frontend/js/env-config.js` como `window.API_BASE`; `Frontend/js/config.js` la vuelve a normalizar antes de usarla en cada `fetch`.
- Si falta en produccion, el build falla con `Falta VITE_API_URL` y en consola del navegador aparece el mismo aviso (nunca cae en silencio a localhost ni a rutas relativas).
- Rutas limpias en `vercel.json` (`outputDirectory: Frontend`): `/app` -> `dashboard.html`, `/mesas`, `/comandero`, `/kds`, `/registrar`, `/reiniciar-contrasena`, `/login` -> `index.html`. Los `.html` siguen accesibles por su nombre.

## Correo (SMTP)

Nodemailer envia la recuperacion de contrasena y el reporte de cierre de caja.

- Variables canonicas (ver `Backend/.env.example`): `SMTP_HOST`, `SMTP_PORT` (587 por defecto), `SMTP_USER`, `SMTP_PASS`. `EMAIL_USER`/`EMAIL_PASS` siguen leidos como alias legacy (`SMTP_*` tiene prioridad).
- Destino del cierre: correo del admin en BD, con fallback a `ADMIN_EMAIL`.
- Si `SMTP_HOST` no esta configurado, no se envia: el enlace de recuperacion se imprime solo en los logs del servidor (modo desarrollo) y la respuesta al usuario es generica (no expone el enlace).
- Timeouts de conexion a 10 s: si el proveedor bloquea el puerto, la peticion falla rapido con `503` y mensaje claro en vez de colgarse.
- En Railway los puertos 587/465 pueden estar bloqueados sin plan Pro: en ese caso usa un relay SMTP con puerto 443/587 permitido o migrar a un API HTTPS (p. ej. Resend).

## Seguridad

- `.env*` esta en `.gitignore`; `.env.example` documenta todas las variables con valores falsos.
- En produccion el servidor exige `SESSION_SECRET` y `JWT_SECRET` (>=32 chars, distintos del ejemplo). No hay ningun valor de relleno: sin `SESSION_SECRET` el proceso termina al arrancar.
- Cookie de sesion `clubmaster.sid`: `httpOnly` siempre; en produccion `secure: true` + `sameSite: 'none'` (frontend Vercel y backend Railway en dominios distintos) y en desarrollo `secure: false` + `sameSite: 'lax'`. Se puede forzar con `COOKIE_SAMESITE`. `trust proxy` se activa solo en produccion y antes del middleware de sesion, para que la cookie `secure` se emita detras del proxy TLS de Railway.
