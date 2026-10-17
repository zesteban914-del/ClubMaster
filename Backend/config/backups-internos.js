// Backups INTERNOS (mysqldump local en Backend/backups/, volcado .enc
// diario y backup de cierre de jornada): estan APAGADOS por defecto,
// tambien en produccion. En produccion el unico respaldo valido es el
// servicio externo `backup-service` (mysqldump en MySQL 9 -> Backblaze
// B2, ver backup-service/README.md). En desarrollo solo se encienden
// de forma explicita con BACKUP_INTERNO=true.
function respaldosInternosActivos() {
    const explicito = String(process.env.BACKUP_INTERNO || '').trim().toLowerCase() === 'true';
    const esDesarrollo = process.env.NODE_ENV !== 'production';
    return explicito && esDesarrollo;
}

module.exports = { respaldosInternosActivos };
