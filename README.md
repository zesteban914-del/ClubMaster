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

## Comandos

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
- Toda ruta `/api` exige sesion **tambien en GET** (antes solo se exigia en POST/PUT/DELETE). Unicas excepciones GET: `/api/sesion` (sonda de sesion propia; sin sesion devuelve `{autenticado:false}`) y `/api/2fa/status` (booleano del flujo de ingreso). El resto de pre-login (`/api/auth/login`, `/api/auth/pin-login`, `/api/registro`, recuperacion y reinicio de contrasena) sigue publico por metodo, igual que `GET /health` y `GET /api/health` (registrados antes del middleware, solo responden `{"ok":true}`). Consecuencia: el enlace "Ver reporte completo" del correo de cierre (`GET /api/jornada/{id}/reporte`) ahora requiere tener sesion abierta; antes cualquier persona con el id de la jornada podia leer las ventas.
- El PIN maestro nunca vuelve al navegador: `GET /api/configuracion` solo expone `pin_maestro_configurado` (booleano) y en la base de datos se guarda como hash bcrypt. Migracion idempotente de PINs legados en texto plano: `npm run migrate:pin` (ademas, cada verificacion correcta de un PIN legado lo re-hashea en el acto).

## Respaldos

- El respaldo de produccion es **exclusivamente** el servicio externo `backup-service/` (contenedor con MySQL 9: mysqldump -> gzip -> Backblaze B2, cron 0 8 * * * UTC, retencion 7 diarias + 4 semanales; ver `backup-service/README.md`). La restauracion se hace solo con `backup-service/restore.sh` (pide confirmacion `SI` y exige la base de datos destino vacia).
- Los respaldos INTERNOS del backend (mysqldump local a `Backend/backups/`, volcado `.enc` diario y backup de cierre de jornada) estan **apagados por defecto, tambien en produccion**. Solo se encienden en desarrollo y de forma explicita con `BACKUP_INTERNO=true`.
- `GET /api/backup/ultimo` (solo administrador) devuelve nombre, fecha y tamano del ultimo respaldo del bucket de Backblaze para el panel de configuracion. Usa credenciales **de solo lectura** (`BACKUP_READ_S3_ACCESS_KEY`, `BACKUP_READ_S3_SECRET_KEY`, `BACKUP_READ_S3_ENDPOINT`, `BACKUP_READ_S3_BUCKET`, opcional `BACKUP_READ_S3_REGION`) de una application key de B2 con permisos ListBucket + ReadBucket: nunca reutiliza ni registra la clave de escritura. Sin esas variables responde `configurado:false` y no hace ninguna llamada.
