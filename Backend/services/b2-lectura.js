// Lectura SOLO LECTURA del bucket de Backblaze B2 (donde backup-service
// sube los respaldos diarios). Sirve a GET /api/backup/ultimo para mostrar
// en el panel el ultimo respaldo (nombre, fecha, tamano) sin dar a la app
// permiso de escritura: usa credenciales PROPIAS BACKUP_READ_S3_* que
// deben pertenecer a una application key de B2 restringida a permisos de
// lectura (ListBucket + ReadBucket). Si no existen, el endpoint responde
// configurado:false y no hace ninguna llamada.
// Implementa la firma AWS Signature V4 con node:crypto (sin SDK) para no
// agregar dependencias; funciona con cualquier endpoint S3 compatible.
const https = require('https');
const http = require('http');
const crypto = require('crypto');

const VACIO_SHA256 = crypto.createHash('sha256').update('').digest('hex');
const TTL_CACHE_MS = 5 * 60 * 1000;
const TIMEOUT_MS = 10000;
const RE_RESPALDO = /^clubmaster-(\d{4})-(\d{2})-(\d{2})-(\d{4})\.sql\.gz$/;

let cache = { en: 0, dato: null };

function regionDesdeEndpoint(endpoint) {
    const m = /s3\.([^.]+)\.backblazeb2\.com/.exec(endpoint || '');
    if (m) return m[1];
    return 'us-east-005';
}

function configuracionLectura() {
    const accessKey = String(process.env.BACKUP_READ_S3_ACCESS_KEY || '').trim();
    const secretKey = String(process.env.BACKUP_READ_S3_SECRET_KEY || '').trim();
    const endpoint = String(process.env.BACKUP_READ_S3_ENDPOINT || process.env.BACKUP_S3_ENDPOINT || '').trim().replace(/\/+$/, '');
    const bucket = String(process.env.BACKUP_READ_S3_BUCKET || process.env.BACKUP_S3_BUCKET || '').trim();
    const regionExplicita = String(process.env.BACKUP_READ_S3_REGION || process.env.BACKUP_S3_REGION || '').trim();
    const region = regionExplicita || regionDesdeEndpoint(endpoint);
    let prefix = String(process.env.BACKUP_PREFIX || '').trim();
    if (prefix && !prefix.endsWith('/')) prefix += '/';
    return {
        accessKey: accessKey,
        secretKey: secretKey,
        endpoint: endpoint,
        bucket: bucket,
        region: region,
        prefix: prefix,
        configurado: !!(accessKey && secretKey && endpoint && bucket)
    };
}

function hmac(key, data) { return crypto.createHmac('sha256', key).update(data, 'utf8').digest(); }

function firmarV4(cfg, path, queryOrdenada, fecha) {
    const amzDate = fecha.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const dia = amzDate.slice(0, 8);
    const host = cfg.endpoint.replace(/^https?:\/\//, '').split('/')[0];
    const canonicalQuery = queryOrdenada.map(function(par) {
        return encodeURIComponent(par[0]) + '=' + encodeURIComponent(par[1]);
    }).join('&');
    const canonicalRequest = [
        'GET',
        path,
        canonicalQuery,
        'host:' + host + '\n' + 'x-amz-content-sha256:' + VACIO_SHA256 + '\n' + 'x-amz-date:' + amzDate,
        'host;x-amz-content-sha256;x-amz-date',
        VACIO_SHA256
    ].join('\n');
    const scope = dia + '/' + cfg.region + '/s3/aws4_request';
    const stringToSign = [
        'AWS4-HMAC-SHA256',
        amzDate,
        scope,
        crypto.createHash('sha256').update(canonicalRequest).digest('hex')
    ].join('\n');
    const kFecha = hmac('AWS4' + cfg.secretKey, dia);
    const kRegion = hmac(kFecha, cfg.region);
    const kServicio = hmac(kRegion, 's3');
    const kFirma = hmac(kServicio, 'aws4_request');
    const firma = crypto.createHmac('sha256', kFirma).update(stringToSign, 'utf8').digest('hex');
    return {
        host: host,
        path: path + '?' + canonicalQuery,
        authorization: 'AWS4-HMAC-SHA256 Credential=' + cfg.accessKey + '/' + scope +
            ', SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=' + firma,
        amzDate: amzDate
    };
}

function pedir(url, firmado) {
    return new Promise(function(resolve, reject) {
        const u = new URL(url);
        const modulo = u.protocol === 'http:' ? http : https;
        const req = modulo.request({
            method: 'GET',
            hostname: u.hostname,
            port: u.port || (u.protocol === 'http:' ? 80 : 443),
            path: firmado.path,
            headers: {
                'host': firmado.host,
                'x-amz-content-sha256': VACIO_SHA256,
                'x-amz-date': firmado.amzDate,
                'authorization': firmado.authorization
            },
            timeout: TIMEOUT_MS
        }, function(res) {
            let cuerpo = '';
            res.on('data', function(c) { cuerpo += c; });
            res.on('end', function() { resolve({ status: res.statusCode, cuerpo: cuerpo.slice(0, 200000) }); });
        });
        req.on('timeout', function() { req.destroy(new Error('timeout consultando el bucket')); });
        req.on('error', function(e) { reject(e); });
        req.end();
    });
}

function decodificarXml(t) {
    return String(t || '')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&');
}

function interpretarRespuesta(cuerpo) {
    const errorMatch = /<Error>([\s\S]*?)<\/Error>/.exec(cuerpo);
    if (errorMatch) {
        const cod = /<Code>([\s\S]*?)<\/Code>/.exec(errorMatch[1]);
        const msg = /<Message>([\s\S]*?)<\/Message>/.exec(errorMatch[1]);
        const e = new Error('B2 devolvio ' + (cod ? decodificarXml(cod[1]) : 'error') + (msg ? ': ' + decodificarXml(msg[1]).slice(0, 200) : ''));
        e.codigoB2 = cod ? decodificarXml(cod[1]) : 'Error';
        throw e;
    }
    const objetos = [];
    const re = /<Contents>([\s\S]*?)<\/Contents>/g;
    let m;
    while ((m = re.exec(cuerpo)) !== null) {
        const bloque = m[1];
        const k = /<Key>([\s\S]*?)<\/Key>/.exec(bloque);
        const f = /<LastModified>([\s\S]*?)<\/LastModified>/.exec(bloque);
        const s = /<Size>([\s\S]*?)<\/Size>/.exec(bloque);
        if (!k) continue;
        objetos.push({
            clave: decodificarXml(k[1]),
            fecha: f ? decodificarXml(f[1]) : null,
            tamano: s ? Number(s[1]) || 0 : 0
        });
    }
    return objetos;
}

function elegirUltimo(objetos, prefix) {
    if (!objetos.length) return null;
    const candidatos = objetos.map(function(o) {
        const base = prefix && o.clave.indexOf(prefix) === 0 ? o.clave.slice(prefix.length) : o.clave.split('/').pop();
        const mm = RE_RESPALDO.exec(base);
        let fechaOrden = mm
            ? mm[1] + '-' + mm[2] + '-' + mm[3] + ' ' + mm[4].slice(0, 2) + ':' + mm[4].slice(2)
            : (o.fecha || '');
        return { base: base, clave: o.clave, fecha: o.fecha, tamano: o.tamano, orden: (o.fecha || fechaOrden || ''), coincide: !!mm };
    });
    // Preferir el patron de backup-service; si no, el .sql.gz mas reciente.
    const conPatron = candidatos.filter(function(c) { return c.coincide; });
    const lista = conPatron.length ? conPatron : candidatos.filter(function(c) { return /\.sql\.gz$/.test(c.base); });
    const elegido = (lista.length ? lista : candidatos).slice().sort(function(a, b) {
        return String(b.orden).localeCompare(String(a.orden));
    })[0];
    return elegido;
}

function tamanoLegible(bytes) {
    if (!bytes && bytes !== 0) return '';
    const unidades = ['B', 'KB', 'MB', 'GB'];
    let v = Number(bytes), i = 0;
    while (v >= 1024 && i < unidades.length - 1) { v = v / 1024; i++; }
    return (i === 0 ? v : v.toFixed(1)) + ' ' + unidades[i];
}

// Devuelve { configurado, ultimo: {nombre, fecha, tamano_bytes, tamano_legible} | null }
async function obtenerUltimoRespaldo() {
    const cfg = configuracionLectura();
    if (!cfg.configurado) {
        // Solo nombres de variables faltantes: nunca valores ni claves.
        const faltan = [];
        if (!cfg.accessKey) faltan.push('BACKUP_READ_S3_ACCESS_KEY');
        if (!cfg.secretKey) faltan.push('BACKUP_READ_S3_SECRET_KEY');
        if (!cfg.endpoint) faltan.push('BACKUP_READ_S3_ENDPOINT (o BACKUP_S3_ENDPOINT)');
        if (!cfg.bucket) faltan.push('BACKUP_READ_S3_BUCKET (o BACKUP_S3_BUCKET)');
        return { configurado: false, ultimo: null, motivo: 'Faltan variables: ' + faltan.join(', ') };
    }
    if (cache.en && (Date.now() - cache.en) < TTL_CACHE_MS && cache.dato) return cache.dato;
    const query = [['list-type', '2'], ['max-keys', '1000']];
    if (cfg.prefix) query.push(['prefix', cfg.prefix]);
    query.sort(function(a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; });
    const firmado = firmarV4(cfg, '/', query, new Date());
    const res = await pedir(cfg.endpoint + '/', firmado);
    if (res.status !== 200) {
        const e = new Error('ListObjectsV2 respondio HTTP ' + res.status);
        e.statusCode = 502;
        throw e;
    }
    const objetos = interpretarRespuesta(res.cuerpo);
    const elegido = elegirUltimo(objetos, cfg.prefix);
    const dato = {
        configurado: true,
        ultimo: elegido ? {
            nombre: elegido.base,
            fecha: elegido.fecha,
            tamano_bytes: elegido.tamano,
            tamano_legible: tamanoLegible(elegido.tamano)
        } : null
    };
    cache = { en: Date.now(), dato: dato };
    return dato;
}

module.exports = { obtenerUltimoRespaldo, configuracionLectura };
