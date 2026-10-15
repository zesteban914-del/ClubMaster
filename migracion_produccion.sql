-- =========================================================
-- migracion_produccion.sql — ClubMaster
-- Ejecutar UNA sola vez en la base de datos de PRODUCCION.
--
-- Qué hace: repara el error
--   "Column 'id_devolucion' cannot be null"
-- agregando AUTO_INCREMENT a las llaves primarias de
-- devoluciones, detalle_devoluciones y kardex.
--
-- Seguro: NO borra ni modifica datos, solo cambia la
-- definición de 3 columnas. Si se ejecuta dos veces, la
-- segunda no hace nada (es idempotente).
--
-- Cómo ejecutarlo (elige UNA opción):
--   A) Desde tu PC (PowerShell), con la URL pública de Railway:
--      $env:DATABASE_URL = "<valor de MYSQL_PUBLIC_URL>"
--      node Backend/scripts/migrate.js   (hace lo mismo y más)
--   B) Pegando este archivo en el Query/Console SQL de Railway
--      apuntando a la base de producción.
-- =========================================================

ALTER TABLE devoluciones
    MODIFY COLUMN id_devolucion INT NOT NULL AUTO_INCREMENT;

ALTER TABLE detalle_devoluciones
    MODIFY COLUMN id_detalle INT NOT NULL AUTO_INCREMENT;

ALTER TABLE kardex
    MODIFY COLUMN id_kardex INT NOT NULL AUTO_INCREMENT;

-- Verificación (debe mostrar "auto_increment" en EXTRA):
-- SHOW COLUMNS FROM devoluciones LIKE 'id_devolucion';
-- SHOW COLUMNS FROM detalle_devoluciones LIKE 'id_detalle';
-- SHOW COLUMNS FROM kardex LIKE 'id_kardex';
