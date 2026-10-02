// =========================================================
// email-service.js
// Envio de correos con adjuntos (reportes PDF/Excel).
//
// Soporta dos caminos, elegidos por variables de entorno:
//   1) Proveedor por API HTTP (Resend o Brevo) -> funciona aunque
//      Railway bloquee los puertos SMTP 587/465 (planes sin Pro).
//   2) SMTP con Nodemailer (Backend/config/mailer.js) como alternativa.
//
// Orden de seleccion (MAIL_PROVIDER puede forzar uno):
//   auto (defecto) -> resend -> brevo -> smtp
//
// Ningun secreto vive en el codigo: todo sale de process.env.
// =========================================================
const mailer = require('../config/mailer');

const LIMITE_MB_DEFECTO = 20;
const MAX_PARTES_DEFECTO = 4;

function mbLimite(){
    const n = Number(process.env.MAIL_REPORTES_MAX_MB);
    return (Number.isFinite(n) && n > 0 && n <= 40) ? n : LIMITE_MB_DEFECTO;
}

function remitente(){
    return String(
        process.env.RESEND_FROM ||
        process.env.BREVO_FROM ||
        process.env.MAIL_FROM ||
        process.env.SMTP_USER ||
        process.env.EMAIL_USER ||
        ''
    ).trim();
}

function nombreRemitente(){
    return String(process.env.MAIL_FROM_NAME || 'ClubMaster').trim() || 'ClubMaster';
}

function obtenerProveedor(){
    const forzado = String(process.env.MAIL_PROVIDER || '').toLowerCase().trim();
    const orden = (forzado && forzado !== 'auto') ? [forzado] : ['resend', 'brevo', 'smtp'];
    const desde = remitente();
    for (const p of orden) {
        if (p === 'resend' && process.env.RESEND_API_KEY && desde) return 'resend';
        if (p === 'brevo' && process.env.BREVO_API_KEY && desde) return 'brevo';
        if (p === 'smtp' && process.env.SMTP_HOST && (process.env.SMTP_USER || process.env.EMAIL_USER)) return 'smtp';
    }
    return null;
}

// Estado para el frontend: NUNCA expone claves, solo nombres de variables.
function estado(){
    const proveedor = obtenerProveedor();
    if (proveedor) {
        return { configurado: true, proveedor, detalle: 'Proveedor activo: ' + proveedor };
    }
    const forzado = String(process.env.MAIL_PROVIDER || '').toLowerCase().trim();
    if (forzado && forzado !== 'auto' && forzado !== 'resend' && forzado !== 'brevo' && forzado !== 'smtp') {
        return { configurado: false, proveedor: null, detalle: 'MAIL_PROVIDER tiene un valor desconocido ("' + forzado + '"). Use resend, brevo, smtp o auto.' };
    }
    const faltan = [];
    if (!process.env.RESEND_API_KEY) faltan.push('RESEND_API_KEY');
    if (!process.env.BREVO_API_KEY) faltan.push('BREVO_API_KEY');
    if (!process.env.SMTP_HOST) faltan.push('SMTP_HOST');
    if (!remitente()) faltan.push('RESEND_FROM (o MAIL_FROM / SMTP_USER)');
    return {
        configurado: false,
        proveedor: null,
        detalle: 'Faltan variables de correo: ' + faltan.join(', ')
    };
}

// ---------------------------------------------------------
// Validacion / saneo
// ---------------------------------------------------------
function validarCorreo(c) {
    const s = String(c == null ? '' : c).trim();
    if (!s) return 'vacío';
    if (s.length > 154) return 'el correo supera los 154 caracteres';
    if (s.indexOf('..') !== -1) return 'no puede contener dos puntos seguidos';
    if (/[\s<>"'\\]/.test(s)) return 'contiene caracteres no permitidos';
    const re = /^[^\s@,;<>]+@[^\s@,;<>]+\.[A-Za-z]{2,}$/;
    if (!re.test(s)) return 'formato inválido';
    const dominio = s.split('@')[1] || '';
    if (dominio.length < 3 || dominio.indexOf('.') === -1) return 'dominio inválido';
    return null;
}

// Acepta string ("a@b.com, c@d.com") o array (con o sin comas dentro).
function normalizarCorreos(entrada) {
    let crudo = [];
    if (Array.isArray(entrada)) {
        entrada.forEach(function (item) {
            String(item == null ? '' : item).split(/[,;]/).forEach(function (p) { crudo.push(p); });
        });
    } else {
        crudo = String(entrada == null ? '' : entrada).split(/[,;]/);
    }
    const correos = [];
    const errores = [];
    const vistos = {};
    crudo.forEach(function (p) {
        const s = String(p).trim();
        if (!s) return;
        const bajo = s.toLowerCase();
        if (vistos[bajo]) return;
        vistos[bajo] = true;
        const err = validarCorreo(s);
        if (err) errores.push('"' + s + '": ' + err);
        else correos.push(bajo);
    });
    if (errores.length) return { ok: false, correos: [], error: 'Correo(s) inválido(s) -> ' + errores.join('; ') };
    if (!correos.length) return { ok: false, correos: [], error: 'Debe indicar al menos un correo de destino' };
    if (correos.length > 5) return { ok: false, correos: [], error: 'Máximo 5 correos destino por envío (recibió ' + correos.length + ')' };
    return { ok: true, correos: correos, error: null };
}

// Cabeceras: nada de CR/LF ni caracteres de control (inyeccion de cabeceras).
function sanearAsunto(s) {
    let t = String(s == null ? '' : s);
    t = t.replace(/[\r\n\t]+/g, ' ');
    // eslint-disable-next-line no-control-regex
    t = t.replace(/[\u0000-\u001F\u007F]/g, '');
    t = t.replace(/\s{2,}/g, ' ').trim();
    if (t.length > 180) t = t.slice(0, 180).trim();
    return t;
}

function sanearTexto(s) {
    let t = String(s == null ? '' : s);
    t = t.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    // eslint-disable-next-line no-control-regex
    t = t.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
    if (t.length > 4000) t = t.slice(0, 4000);
    return t.trim();
}

function escaparHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Nombre de archivo seguro para adjunto (sin rutas ni caracteres raros).
function nombreArchivoSeguro(n) {
    let s = String(n == null ? '' : n).replace(/[\\/:*?"<>|\r\n\t]/g, '_').trim();
    if (!s) s = 'reporte.txt';
    if (s.length > 120) {
        const punto = s.lastIndexOf('.');
        const ext = punto > 0 ? s.slice(punto) : '';
        s = s.slice(0, 120 - ext.length) + ext;
    }
    return s;
}

function htmlCuerpo({ asunto, texto, adjuntos }) {
    const filas = (adjuntos || []).map(function (a, i) {
        return '<li style="padding:4px 0">' + escaparHtml(a.nombre) + ' <span style="color:#94a3b8">(' + Math.round(a.buffer.length / 1024) + ' KB)</span></li>';
    }).join('');
    const parrafos = String(texto == null ? '' : texto).split('\n').filter(Boolean)
        .map(function (p) { return '<p style="margin:0 0 10px">' + escaparHtml(p) + '</p>'; }).join('') ||
        '<p style="margin:0 0 10px">Adjuntamos los reportes solicitados.</p>';
    return '' +
        '<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">' +
        '<div style="background:#0f172a;color:#fff;padding:18px 20px">' +
        '<div style="font-size:17px;font-weight:800;letter-spacing:1px">CLUBMASTER</div>' +
        '<div style="font-size:11px;opacity:.8">' + escaparHtml(asunto) + '</div>' +
        '</div>' +
        '<div style="padding:20px;color:#334155;font-size:13px;line-height:1.5">' + parrafos +
        '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;margin-top:14px">' +
        '<div style="font-size:11px;font-weight:800;color:#475569;text-transform:uppercase;margin-bottom:6px">Adjuntos (' + (adjuntos || []).length + ')</div>' +
        '<ul style="margin:0;padding-left:18px">' + filas + '</ul>' +
        '</div>' +
        '<p style="color:#94a3b8;font-size:11px;margin-top:16px">Correo generado automáticamente por ClubMaster.</p>' +
        '</div></div>';
}

// ---------------------------------------------------------
// Envio por proveedor API HTTP
// ---------------------------------------------------------
async function fetchConTimeout(url, opciones, ms) {
    const ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    const temporizador = setTimeout(function () { if (ctrl) ctrl.abort(); }, ms || 30000);
    try {
        const opts = Object.assign({}, opciones);
        if (ctrl) opts.signal = ctrl.signal;
        return await fetch(url, opts);
    } finally {
        clearTimeout(temporizador);
    }
}

async function mensajeErrorProveedor(respuesta) {
    let cuerpo = '';
    try { cuerpo = await respuesta.text(); } catch (e) { cuerpo = ''; }
    let detalle = '';
    try {
        const j = JSON.parse(cuerpo);
        detalle = j.message || j.error || (j.errors && j.errors[0] && (j.errors[0].message || j.errors[0])) || '';
    } catch (e) { detalle = cuerpo.slice(0, 200); }
    return 'HTTP ' + respuesta.status + (detalle ? ': ' + String(detalle).slice(0, 240) : '');
}

async function enviarPorResend({ para, asunto, texto, html, adjuntos }) {
    const desde = remitente();
    const respuesta = await fetchConTimeout('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            from: desde,
            to: [para],
            subject: asunto,
            text: texto,
            html: html,
            attachments: (adjuntos || []).map(function (a) {
                return { filename: a.nombre, content: a.buffer.toString('base64') };
            })
        })
    }, 45000);
    if (!respuesta.ok) throw new Error(await mensajeErrorProveedor(respuesta));
    let datos = {};
    try { datos = await respuesta.json(); } catch (e) { datos = {}; }
    return { id: datos.id || null };
}

// Extrae solo "a@b.com" de formatos tipo "Nombre <a@b.com>" (Brevo lo exige asi).
function emailSolo(s) {
    const t = String(s || '').trim();
    const m = t.match(/<([^>]+)>/);
    return (m ? m[1] : t).trim();
}

async function enviarPorBrevo({ para, asunto, texto, html, adjuntos }) {
    const desde = emailSolo(remitente());
    const respuesta = await fetchConTimeout('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            'api-key': process.env.BREVO_API_KEY,
            'Content-Type': 'application/json',
            'accept': 'application/json'
        },
        body: JSON.stringify({
            sender: { email: desde, name: nombreRemitente() },
            to: [{ email: para }],
            subject: asunto,
            text: texto,
            html: html,
            attachment: (adjuntos || []).map(function (a) {
                return { name: a.nombre, content: a.buffer.toString('base64') };
            })
        })
    }, 45000);
    if (!respuesta.ok) throw new Error(await mensajeErrorProveedor(respuesta));
    let datos = {};
    try { datos = await respuesta.json(); } catch (e) { datos = {}; }
    return { id: (datos.messageId || datos.id) || null };
}

async function enviarPorSmtp({ para, asunto, texto, html, adjuntos }) {
    const r = await mailer.enviarCorreoAdjuntos(para, { asunto: asunto, texto: texto, html: html, adjuntos: adjuntos });
    if (!r) throw new Error('SMTP no disponible (falta SMTP_HOST/SMTP_USER)');
    return { id: null };
}

// ---------------------------------------------------------
// Lote de adjuntos: respeta ~20 MB por correo
// ---------------------------------------------------------
function agruparAdjuntos(adjuntos, limiteBytes) {
    const grupos = [];
    let actual = [];
    let bytes = 0;
    for (const a of adjuntos) {
        if (a.buffer.length > limiteBytes) {
            throw new Error('El archivo "' + a.nombre + '" pesa ' + Math.round(a.buffer.length / 1048576) +
                ' MB y supera el máximo de ' + mbLimite() + ' MB por correo. Reduzca el rango de fechas.');
        }
        if (actual.length && (bytes + a.buffer.length) > limiteBytes) {
            grupos.push(actual);
            actual = [];
            bytes = 0;
        }
        actual.push(a);
        bytes += a.buffer.length;
    }
    if (actual.length) grupos.push(actual);
    return grupos;
}

/**
 * Envia los reportes a cada correo destino.
 * Si el total supera MAIL_REPORTES_MAX_MB (20 por defecto) se divide
 * en varios correos (partes). Devuelve resultado DETALLADO por correo.
 */
async function enviarReportes({ correos, asunto, texto, adjuntos }) {
    const proveedor = obtenerProveedor();
    if (!proveedor) {
        const st = estado();
        const err = new Error('El envío por correo no está configurado. ' + st.detalle);
        err.noConfigurado = true;
        throw err;
    }
    if (!Array.isArray(correos) || !correos.length) throw new Error('Debe indicar al menos un correo de destino');
    if (!Array.isArray(adjuntos) || !adjuntos.length) throw new Error('No hay archivos adjuntos para enviar');

    const limiteBytes = mbLimite() * 1024 * 1024;
    const grupos = agruparAdjuntos(adjuntos, limiteBytes);
    const maxPartes = Number(process.env.MAIL_REPORTES_MAX_PARTES) || MAX_PARTES_DEFECTO;
    if (grupos.length > maxPartes) {
        throw new Error('Los adjuntos suman ' + Math.round(adjuntos.reduce(function (a, x) { return a + x.buffer.length; }, 0) / 1048576) +
            ' MB y requieren ' + grupos.length + ' correos (máximo ' + maxPartes + '). Seleccione menos reportes o un rango de fechas menor.');
    }

    const resultados = [];
    const listadoTotal = adjuntos.map(function (a) { return a.nombre; }).join(', ');
    for (const para of correos) {
        const fila = { correo: para, ok: false, partes: 0, error: null };
        for (let i = 0; i < grupos.length; i++) {
            const parte = grupos[i];
            const esParte = grupos.length > 1;
            const asuntoParte = esParte ? asunto + ' [' + (i + 1) + '/' + grupos.length + ']' : asunto;
            const textoParte = String(texto || '').trim() +
                (esParte ? '\n\nEsta es la parte ' + (i + 1) + ' de ' + grupos.length + ' del envío.' : '') +
                '\n\nAdjuntos: ' + parte.map(function (a) { return a.nombre; }).join(', ') +
                (esParte ? '\nAdjuntos de este correo: ' + parte.length + ' de ' + adjuntos.length + ' (' + listadoTotal + ')' : '') +
                '\n\n— ClubMaster';
            const htmlParte = htmlCuerpo({ asunto: asuntoParte, texto: textoParte, adjuntos: parte });
            try {
                if (proveedor === 'resend') await enviarPorResend({ para: para, asunto: asuntoParte, texto: textoParte, html: htmlParte, adjuntos: parte });
                else if (proveedor === 'brevo') await enviarPorBrevo({ para: para, asunto: asuntoParte, texto: textoParte, html: htmlParte, adjuntos: parte });
                else await enviarPorSmtp({ para: para, asunto: asuntoParte, texto: textoParte, html: htmlParte, adjuntos: parte });
                fila.partes++;
            } catch (e) {
                fila.error = 'No se pudo enviar a ' + para + ' (parte ' + (i + 1) + ' de ' + grupos.length + '): ' + e.message;
                break;
            }
        }
        fila.ok = (fila.partes === grupos.length);
        if (fila.ok) fila.error = null;
        resultados.push(fila);
    }

    const bytes = adjuntos.reduce(function (a, x) { return a + x.buffer.length; }, 0);
    return { proveedor: proveedor, partes: grupos.length, resultados: resultados, bytes: bytes, adjuntos: adjuntos.length };
}

module.exports = {
    estado,
    obtenerProveedor,
    remitente,
    validarCorreo,
    normalizarCorreos,
    sanearAsunto,
    sanearTexto,
    escaparHtml,
    nombreArchivoSeguro,
    htmlCuerpo,
    mbLimite,
    enviarReportes
};
