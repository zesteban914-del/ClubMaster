# backup-service — Respaldos automáticos ClubMaster (MySQL 9 → Backblaze B2)

Servicio independiente que se ejecuta **una sola vez y termina**.
Hace `mysqldump` → `gzip` → sube a Backblaze B2 (API S3) → verifica →
aplica retención → sale con código 0 (éxito) o distinto de 0 (fallo).

No modifica el backend de ClubMaster ni su Dockerfile.

---

## 1. Cómo funciona

1. Lee credenciales MySQL y B2 **solo de variables de entorno** (nada hardcodeado).
2. `mysqldump --single-transaction --routines --triggers --events --set-gtid-purged=OFF --hex-blob` (compatible MySQL 9, imagen base `mysql:9`).
3. Comprime con `gzip` → `/tmp/clubmaster-AAAA-MM-DD-HHMM.sql.gz` (fecha/hora **UTC**).
4. **Antes de subir** verifica: archivo no vacío, tamaño ≥ `MIN_DUMP_BYTES` (default 10 KB), gzip válido y **volcado completo**: pie `-- Dump completed`, ≥1 `CREATE TABLE` y ≥1 `INSERT INTO`. Si falta algo, aborta con error y no sube nada.
5. Sube a `s3://<bucket>/<prefijo>clubmaster-AAAA-MM-DD-HHMM.sql.gz`.
6. **Después de subir** hace `HeadObject` y confirma que el objeto existe y que el tamaño remoto == tamaño local. Si no coincide, falla.
7. **Retención**: conserva las últimas **7 diarias** + **4 semanales** (la más reciente de cada semana ISO fuera de la ventana diaria) y **borra las demás**. Cada borrado se verifica con `HeadObject` (debe dar 404 después del delete).
8. Limpia el temporal y termina. Nunca imprime contraseñas ni claves en los logs.

> **Nota B2 "Keep only the last version":** con esa configuración, `DeleteObject`
> elimina la única versión y **libera el espacio de inmediato**. El script lo
> confirma: después de cada `delete_object` exige que `head_object` devuelva
> 404/`NoSuchKey`. Si el objeto siguiera existiendo, el proceso falla con un
> mensaje claro para que revise el lifecycle/versionado del bucket.

---

## 2. Variables de entorno necesarias

| Variable | Obligatoria | Ejemplo |
|---|---|---|
| `MYSQLHOST` | Sí | `mysql.railway.internal` (red interna Railway) |
| `MYSQLPORT` | No (default `3306`) | `3306` |
| `MYSQLUSER` | Sí | `root` |
| `MYSQLPASSWORD` | Sí | (la de su MySQL de producción) |
| `MYSQLDATABASE` | Sí | `railway` |
| `BACKUP_S3_ENDPOINT` | Sí | `https://s3.us-west-004.backblazeb2.com` |
| `BACKUP_S3_BUCKET` | Sí | `clubmaster-backups` |
| `BACKUP_S3_ACCESS_KEY` | Sí | keyID de B2 |
| `BACKUP_S3_SECRET_KEY` | Sí | applicationKey de B2 |
| `BACKUP_S3_REGION` | No (se deriva del endpoint) | `us-west-004` |
| `BACKUP_PREFIX` | No (default raíz) | `clubmaster/` |
| `MIN_DUMP_BYTES` | No (default `10240`) | `10240` |
| `RETENTION_DAILY` | No (default `7`) | `7` |
| `RETENTION_WEEKLY` | No (default `4`) | `4` |

En Railway, la forma más fácil es **referenciar** las variables del servicio
MySQL (`${{MySQL.MYSQLHOST}}`, `${{MySQL.MYSQLPORT}}`, `${{MySQL.MYSQLUSER}}`,
`${{MySQL.MYSQLPASSWORD}}`, `${{MySQL.MYSQLDATABASE}}`) en vez de copiar valores.
Las `BACKUP_S3_*` se pegan como variables propias del servicio de backups.
Jamás las ponga en el código ni en un `.env` commiteado.

---

## 3. Despliegue en Railway (servicio aparte + Cron)

1. En su proyecto Railway → **New → Service → GitHub Repo** (mismo repo de ClubMaster).
2. En ese nuevo servicio → **Settings → Source → Root Directory**:

   ```
   backup-service
   ```

   Esto hace que Railway construya **solo** `backup-service/Dockerfile` y no toque el backend.
3. **Variables** del servicio → agregue las 9 variables de la tabla
   (referencie las `MYSQL*` del plugin MySQL y pegue las `BACKUP_S3_*` de B2).
4. **Settings → Deploy → Cron Schedule** (el contenedor corre una vez y termina):

   ```
   0 8 * * *
   ```

   Eso es **08:00 UTC todos los días**.

### ¿Por qué `0 8 * * *`?

Railway programa en **UTC** y usted está en Colombia (**UTC-5**, sin horario de verano):

- 3:00 a.m. Colombia = 3:00 + 5 h = **8:00 a.m. UTC** del mismo día.
- Cron `0 8 * * *` = minuto 0, hora 8, todos los días.

Si algún día quiere las 4:00 a.m. Colombia, use `0 9 * * *`.

5. Haga un **redeploy manual** para probar: revise los **Logs** del servicio.
   Debe ver `respaldo COMPLETADO: clubmaster-...sql.gz` y código de salida 0.
   Luego verifique el archivo en su bucket B2.

---

## 4. Restauración (probar en una base NUEVA)

Archivos: `restore.sh` + `.env.example`.

Desde su PC (Git Bash / WSL / Linux / macOS):

```bash
cd backup-service
cp .env.example .env.restore   # complete los valores reales (este archivo NO se sube al repo)
chmod +x restore.sh

# 1) Ver copias disponibles en B2:
./restore.sh --listar

# 2) Restaurar la más reciente en una base de PRUEBA:
./restore.sh --ultima

# 3) O restaurar una copia puntual:
./restore.sh clubmaster-2026-10-16-0800.sql.gz
```

Necesita instalado: `aws` CLI v2, `gzip` y cliente `mysql`:

```bash
pip install awscli
```

El script le pide las variables `RESTORE_MYSQLHOST/PORT/USER/PASSWORD/DATABASE`
(su MySQL **destino de prueba**, idealmente una base nueva y vacía en Railway),
descarga el `.sql.gz` de B2, valida el gzip, le muestra las primeras tablas,
pide confirmación escrita (`SI`), crea la base si no existe e importa con
`gunzip | mysql`. Al final cuenta las tablas restauradas.

> Restaure **siempre** primero en una base de prueba y apunte su app a ella
> antes de tocar producción.

### Restauración manual (sin el script)

```bash
# Descargar (reemplace valores; la región sale de su endpoint B2):
export AWS_ACCESS_KEY_ID="<keyID>" AWS_SECRET_ACCESS_KEY="<applicationKey>"
aws s3 cp --endpoint-url https://s3.us-west-004.backblazeb2.com \
  s3://SU-BUCKET/clubmaster-AAAA-MM-DD-HHMM.sql.gz ./copia.sql.gz

# Verificar y restaurar en base nueva:
gzip -t ./copia.sql.gz
export MYSQL_PWD="<clave-destino>"
mysql -h <host-destino> -P 3306 -u <usuario> -e "CREATE DATABASE IF NOT EXISTS \`clubmaster_restore_prueba\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
gunzip -c ./copia.sql.gz | mysql -h <host-destino> -P 3306 -u <usuario> clubmaster_restore_prueba
```

---

## 5. Archivos del servicio

```
backup-service/
├── Dockerfile        # FROM mysql:9 + Python 3.11/boto3, CMD de una sola ejecución
├── backup.py         # dump → gzip → validación (tamaño + completitud) → subida → verificación → retención
├── requirements.txt  # boto3 (API S3 de B2)
├── restore.sh        # descarga desde B2 y restaura en base nueva (pruebas)
├── .env.example      # PLANTILLA con valores falsos (lo real va en Railway, no en git)
├── .dockerignore     # impide empaquetar .env y dumps en la imagen
└── README.md         # este documento
```

No hay ningún `.env` real ni credenciales en el repo.
El `.gitignore` de la raíz ya excluye `.env`, `*.sql.gz` y `backups/`.
