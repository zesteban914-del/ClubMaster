// =========================================================
// whatsapp-service.js
// Servicio multi-proveedor para envío de reportes por WhatsApp
// Proveedores: Twilio, UltraMsg, GreenAPI, Baileys stub, Mock
// =========================================================
const fs = require('fs');
const path = require('path');

const LOGS = [];
const MAX_LOGS = 200;

function enmascararTel(tel){
  if(!tel) return '***';
  const s=String(tel);
  if(s.length<=4) return '****';
  return s.slice(0,3)+'******'+s.slice(-4);
}
function _log(entry) {
  const rec = { id: Date.now() + Math.random().toString(36).slice(2,6), timestamp: new Date().toISOString(), ...entry };
  // enmascarar teléfono en log almacenado para auditoría (no exponer completo)
  if(rec.telefono) rec.telefonoMasked = enmascararTel(rec.telefono);
  LOGS.unshift(rec);
  if (LOGS.length > MAX_LOGS) LOGS.pop();
  console.log('[WhatsApp]', rec.status, enmascararTel(rec.telefono), rec.mensaje?.slice(0,120), rec.error || '');
  return rec;
}

function getConfig() {
  return {
    provider: (process.env.WHATSAPP_PROVIDER || 'mock').toLowerCase(), // mock|twilio|ultramsg|greenapi|baileys
    // Twilio
    twilioSid: process.env.TWILIO_ACCOUNT_SID || '',
    twilioToken: process.env.TWILIO_AUTH_TOKEN || '',
    twilioFrom: process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886', // sandbox
    // UltraMsg
    ultramsgInstance: process.env.ULTRAMSG_INSTANCE || '',
    ultramsgToken: process.env.ULTRAMSG_TOKEN || '',
    // GreenAPI
    greenInstance: process.env.GREENAPI_INSTANCE || '',
    greenToken: process.env.GREENAPI_TOKEN || '',
    // Admin / default number
    adminPhone: process.env.WHATSAPP_ADMIN_PHONE || process.env.ADMIN_WHATSAPP || '',
    defaultCountryCode: process.env.WHATSAPP_DEFAULT_CC || '57', // Colombia
  };
}

function normalizarTelefono(raw, defaultCC) {
  if (!raw) return null;
  let s = String(raw).trim().replace(/[\s\-\(\)]/g,'');
  s = s.replace(/^whatsapp:/i,'');
  if (!s) return null;
  // already +E164
  if (s.startsWith('+')) {
    const digits = s.replace(/\D/g,'');
    if (digits.length < 10 || digits.length > 15) return null;
    return '+' + digits;
  }
  let digits = s.replace(/\D/g,'');
  if (!digits) return null;
  if (digits.length < 10) return null;
  // if starts with 0, strip
  if (digits.startsWith('0')) digits = digits.replace(/^0+/, '');
  // if 10 digits colombia without code -> prepend default
  if (digits.length === 10 && defaultCC) {
    return '+' + defaultCC + digits;
  }
  // if 12 digits starting with 57 etc already includes code
  if (digits.length >= 11 && digits.length <= 15) {
    return '+' + digits;
  }
  return '+' + digits;
}

function validarTelefonoOrThrow(tel) {
  const cfg = getConfig();
  const norm = normalizarTelefono(tel, cfg.defaultCountryCode);
  if (!norm) throw new Error('Número de WhatsApp inválido. Use formato E.164 ej: +573001234567');
  if (!/^\+\d{10,15}$/.test(norm)) throw new Error('Número inválido. Debe tener 10-15 dígitos con código país (ej: +573001234567)');
  return norm;
}

// =========================================================
// Helpers de formato por proveedor
// =========================================================
function formatForProvider(telefonoE164, provider){
  // telefonoE164 = +573001234567
  const bare = telefonoE164.replace('+',''); // 573001234567
  switch(provider){
    case 'ultramsg':
      // UltraMsg espera número sin + y sin sufijo, ej: 573001234567
      return bare;
    case 'greenapi':
      // GreenAPI espera chatId con sufijo @c.us (o @g.us para grupos)
      return bare + '@c.us';
    case 'baileys':
    case 'wppconnect':
    case 'whatsapp-web.js':
      // whatsapp-web.js / Baileys usan @c.us para contactos y @s.whatsapp.net para algunos forks
      // Devolvemos con @c.us y también exponemos alternativa @s.whatsapp.net para compatibilidad
      return { cUs: bare + '@c.us', sWhatsappNet: bare + '@s.whatsapp.net', bare };
    case 'twilio':
      // Twilio usa whatsapp:+573001234567
      return 'whatsapp:' + telefonoE164;
    default:
      return telefonoE164;
  }
}

// Providers
async function enviarViaTwilio({ telefono, mensaje, fileBuffer, fileName, mimeType }) {
  const cfg = getConfig();
  if (!cfg.twilioSid || !cfg.twilioToken) throw new Error('Twilio no configurado: TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN faltantes');
  console.log('[WhatsApp][Twilio] Enviando a:', formatForProvider(telefono, 'twilio'), ' provider:', cfg.provider);
  // Twilio requiere URL pública para media. Como no tenemos URL pública, usamos mock si no hay WHATSAPP_MEDIA_BASE_URL
  const mediaUrl = process.env.WHATSAPP_MEDIA_BASE_URL; // ej https://tu-app.onrender.com/media
  if (!mediaUrl || !fileBuffer) {
    // fallback: enviar solo texto
    const url = `https://api.twilio.com/2010-04-01/Accounts/${cfg.twilioSid}/Messages.json`;
    const auth = Buffer.from(`${cfg.twilioSid}:${cfg.twilioToken}`).toString('base64');
    const params = new URLSearchParams();
    params.append('From', cfg.twilioFrom);
    params.append('To', formatForProvider(telefono, 'twilio'));
    params.append('Body', mensaje);
    const resp = await fetch(url, { method:'POST', headers:{ 'Authorization':'Basic '+auth, 'Content-Type':'application/x-www-form-urlencoded' }, body: params.toString() });
    const rawText = await resp.text();
    let data; try{ data = JSON.parse(rawText);}catch(e){ data = { raw: rawText };}
    // 1. MANEJO ESTRICTO: log crudo y validación de confirmación
    console.log('[WhatsApp][Twilio][RAW RESPONSE]', JSON.stringify({ status: resp.status, ok: resp.ok, headers: Object.fromEntries(resp.headers.entries()), data }, null, 2));
    if (!resp.ok) throw new Error(`Twilio error ${resp.status}: ${data.message || JSON.stringify(data)}`);
    // Validar confirmación: Twilio debe devolver sid y status queued/sent
    if(!data.sid) throw new Error(`Twilio sin SID en respuesta, no confirmado: ${JSON.stringify(data)}`);
    return { provider:'twilio', sid: data.sid, raw:data };
  } else {
    // Si hay media base URL, necesitaríamos subir archivo; simplificamos: enviar texto + advertencia
    throw new Error('Twilio con adjunto requiere WHATSAPP_MEDIA_BASE_URL público. Configure o use UltraMsg/GreenAPI para adjuntos directos.');
  }
}

async function enviarViaUltraMsg({ telefono, mensaje, fileBuffer, fileName, mimeType }) {
  const cfg = getConfig();
  if (!cfg.ultramsgInstance || !cfg.ultramsgToken) throw new Error('UltraMsg no configurado: ULTRAMSG_INSTANCE / ULTRAMSG_TOKEN faltantes');
  const toForUltra = formatForProvider(telefono, 'ultramsg');
  console.log('[WhatsApp][UltraMsg] Enviando a:', toForUltra, ' instance:', cfg.ultramsgInstance);
  const base = `https://api.ultramsg.com/${cfg.ultramsgInstance}`;
  // Si hay archivo => enviar documento
  if (fileBuffer && fileName) {
    const b64 = fileBuffer.toString('base64');
    const params = new URLSearchParams();
    params.append('token', cfg.ultramsgToken);
    params.append('to', toForUltra);
    params.append('filename', fileName);
    params.append('document', b64);
    params.append('caption', mensaje);
    const resp = await fetch(`${base}/messages/document`, { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body: params.toString() });
    const rawText = await resp.text();
    let data; try{ data = JSON.parse(rawText);}catch(e){ data = { raw: rawText };}
    console.log('[WhatsApp][UltraMsg][RAW RESPONSE]', JSON.stringify({ status: resp.status, ok: resp.ok, data }, null, 2));
    if (!resp.ok) throw new Error(`UltraMsg error ${resp.status}: ${JSON.stringify(data)}`);
    // Validación estricta: debe tener sent:true y id
    if (data.sent === 'false' || data.sent === false || data.sent === 0) throw new Error(`UltraMsg rechazo (sent=false): ${JSON.stringify(data)}`);
    if(data.error) throw new Error(`UltraMsg error en payload: ${JSON.stringify(data)}`);
    return { provider:'ultramsg', raw:data };
  } else {
    const params = new URLSearchParams();
    params.append('token', cfg.ultramsgToken);
    params.append('to', toForUltra);
    params.append('body', mensaje);
    const resp = await fetch(`${base}/messages/chat`, { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body: params.toString() });
    const rawText = await resp.text();
    let data; try{ data = JSON.parse(rawText);}catch(e){ data = { raw: rawText };}
    console.log('[WhatsApp][UltraMsg][RAW RESPONSE]', JSON.stringify({ status: resp.status, ok: resp.ok, data }, null, 2));
    if (!resp.ok) throw new Error(`UltraMsg error ${resp.status}: ${JSON.stringify(data)}`);
    if(data.sent === 'false' || data.sent === false) throw new Error(`UltraMsg rechazo: ${JSON.stringify(data)}`);
    return { provider:'ultramsg', raw:data };
  }
}

async function enviarViaGreenAPI({ telefono, mensaje, fileBuffer, fileName, mimeType }) {
  const cfg = getConfig();
  if (!cfg.greenInstance || !cfg.greenToken) throw new Error('GreenAPI no configurado: GREENAPI_INSTANCE / GREENAPI_TOKEN faltantes');
  const chatId = formatForProvider(telefono, 'greenapi'); // ya incluye @c.us
  console.log('[WhatsApp][GreenAPI] Enviando a chatId:', chatId, ' instance:', cfg.greenInstance);
  let lastRaw = null;
  // Primero enviar texto si existe
  if (mensaje) {
    const url1 = `https://api.green-api.com/waInstance${cfg.greenInstance}/sendMessage/${cfg.greenToken}`;
    const r1 = await fetch(url1, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ chatId, message: mensaje })});
    const raw1 = await r1.text();
    let d1; try{ d1 = JSON.parse(raw1);}catch(e){ d1 = {raw: raw1};}
    console.log('[WhatsApp][GreenAPI][RAW RESPONSE - sendMessage]', JSON.stringify({ status: r1.status, ok: r1.ok, data: d1 }, null, 2));
    if (!r1.ok) throw new Error(`GreenAPI sendMessage ${r1.status}: ${JSON.stringify(d1)}`);
    if(!d1.idMessage) console.warn('[WhatsApp][GreenAPI] Respuesta sin idMessage, posible fallo silencioso:', d1);
    lastRaw = d1;
  }
  if (fileBuffer && fileName) {
    // GreenAPI sendFileByUpload
    const url2 = `https://api.green-api.com/waInstance${cfg.greenInstance}/sendFileByUpload/${cfg.greenToken}`;
    const form = new FormData();
    form.append('chatId', chatId);
    form.append('file', new Blob([fileBuffer], { type: mimeType || 'application/octet-stream' }), fileName);
    form.append('caption', mensaje || '');
    const r2 = await fetch(url2, { method:'POST', body: form });
    const raw2 = await r2.text();
    let d2; try{ d2 = JSON.parse(raw2);}catch(e){ d2 = {raw: raw2};}
    console.log('[WhatsApp][GreenAPI][RAW RESPONSE - sendFileByUpload]', JSON.stringify({ status: r2.status, ok: r2.ok, data: d2 }, null, 2));
    if (!r2.ok) throw new Error(`GreenAPI sendFile ${r2.status}: ${JSON.stringify(d2)}`);
    if(!d2.idMessage) throw new Error(`GreenAPI sin idMessage en sendFile, no confirmado: ${JSON.stringify(d2)}`);
    return { provider:'greenapi', raw:d2 };
  }
  return { provider:'greenapi', raw: lastRaw || { ok:true } };
}

async function enviarViaBaileys({ telefono, mensaje, fileBuffer, fileName }) {
  const formatted = formatForProvider(telefono, 'baileys');
  console.log('[WhatsApp][Baileys][FORMATTED]', formatted);
  // Placeholder: Baileys/WppConnect requiere sesión persistente. Aquí solo log.
  console.log(`[Baileys stub] Para ${telefono} (${formatted.cUs} / ${formatted.sWhatsappNet}): ${mensaje.slice(0,100)}`);
  // Simular validación de sesión: si no hay archivo de sesión, avisar
  const sessionPath = path.join(__dirname, '..', '..', 'wa-session', 'creds.json');
  if(!fs.existsSync(sessionPath)){
    console.warn('[WhatsApp][Baileys][SESION] No se encontró sesión en', sessionPath, '- requiere escanear QR. Ver /api/whatsapp/status');
  }
  return { provider:'baileys', stub:true, info:'Baileys requiere worker persistente. Configure WHATSAPP_PROVIDER=baileys con servicio externo. Ver /api/whatsapp/status para estado QR.' , formatted };
}

async function enviarViaMock({ telefono, mensaje, fileBuffer, fileName }) {
  // Simula envío exitoso sin llamada externa. Útil para desarrollo/testing.
  // También verifica formato y sufijos para debugging
  const asCUs = formatForProvider(telefono, 'greenapi');
  const asBaileys = formatForProvider(telefono, 'baileys');
  console.log('[WhatsApp][Mock][FORMATO] E.164:', telefono, ' | @c.us:', asCUs, ' | baileys:', asBaileys);
  await new Promise(r=> setTimeout(r, 300));
  const dir = path.join(__dirname, '..', '..', 'logs');
  try {
    if (fileBuffer && fileName) {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive:true });
      const p = path.join(dir, `whatsapp-mock-${Date.now()}-${fileName}`);
      fs.writeFileSync(p, fileBuffer);
      console.log(`[Mock] Archivo guardado y verificado: ${p} | size: ${fileBuffer.length} bytes | exists: ${fs.existsSync(p)}`);
    }
  } catch(e){ console.error('[Mock] Error guardando archivo:', e.message); }
  const rawMock = { provider:'mock', mock:true, telefono, telefonoCUs: asCUs, telefonoBaileys: asBaileys, mensajePreview: mensaje.slice(0,200), fileName, timestamp: new Date().toISOString(), note: 'MOCK no envía a WhatsApp real - cambie WHATSAPP_PROVIDER a ultramsg/greenapi/twilio para envío real' };
  console.log('[WhatsApp][Mock][RAW RESPONSE]', JSON.stringify(rawMock, null, 2));
  return rawMock;
}

async function enviarWhatsApp({ telefono, mensaje, fileBuffer, fileName, mimeType, filePath }) {
  const cfg = getConfig();
  const to = validarTelefonoOrThrow(telefono);
  const provider = cfg.provider;
  // 4. MANEJO DE ADJUNTOS: verificar que el archivo existe y es accesible ANTES de enviar
  if(fileBuffer){
    console.log('[WhatsApp][ADJUNTO] Verificando antes de enviar:', { fileName, mimeType, size: fileBuffer.length, filePath: filePath || '(buffer en memoria)' });
    if(fileBuffer.length === 0) throw new Error('Adjunto vacío (0 bytes) - generación PDF/Excel falló');
    if(filePath){
      const exists = fs.existsSync(filePath);
      const stat = exists ? fs.statSync(filePath) : null;
      console.log('[WhatsApp][ADJUNTO VERIFICADO]', { filePath, exists, sizeOnDisk: stat?.size, readable: exists });
      if(!exists) throw new Error('Archivo no accesible en ruta: ' + filePath);
      if(stat.size === 0) throw new Error('Archivo en disco vacío: ' + filePath);
    }
  }
  const payload = { telefono: to, mensaje: mensaje || '', fileBuffer, fileName, mimeType, filePath };
  try {
    let result;
    if (provider === 'twilio') result = await enviarViaTwilio(payload);
    else if (provider === 'ultramsg') result = await enviarViaUltraMsg(payload);
    else if (provider === 'greenapi' || provider === 'green-api') result = await enviarViaGreenAPI(payload);
    else if (provider === 'baileys' || provider === 'wppconnect' || provider === 'whatsapp-web.js') result = await enviarViaBaileys(payload);
    else result = await enviarViaMock(payload);

    // 1. MANEJO ESTRICTO: no devolver success:true solo por intentar, validar confirmación del proveedor
    console.log('[WhatsApp][RAW RESULT]', JSON.stringify(result, null, 2));
    // Validación estricta por proveedor
    if(!result || !result.raw){
      // mock y baileys stub pueden no tener raw.idMessage, pero deben tener provider
      if(provider === 'mock' && result.mock) {
        // mock siempre es simulado, advertir que no es envío real
        console.warn('[WhatsApp][ADVERTENCIA] Provider mock NO envía a celular real. Configure WHATSAPP_PROVIDER a proveedor real.');
      } else if(result.stub){
        throw new Error('Baileys stub no es envío real - configure sesión persistente y verifique /api/whatsapp/status');
      } else {
        throw new Error('Respuesta del proveedor vacía o sin confirmación (raw missing)');
      }
    }
    // Para proveedores reales, exigir confirmación explícita ya validada en cada enviarVia*
    _log({ telefono: to, mensaje, fileName, filePath, provider: result.provider || provider, status:'enviado', result, raw: result.raw });
    return { success:true, telefono: to, provider: result.provider || provider, result, raw: result.raw };
  } catch (err) {
    console.error('[WhatsApp][ERROR RAW]', err.message);
    const entry = _log({ telefono: to, mensaje, fileName, filePath, provider, status:'error', error: err.message });
    throw err;
  }
}

function obtenerLogs(limit=50){
  return LOGS.slice(0, Math.min(limit, MAX_LOGS));
}

function getStatus(){
  const cfg = getConfig();
  const configured = (()=> {
    if (cfg.provider==='twilio') return !!(cfg.twilioSid && cfg.twilioToken);
    if (cfg.provider==='ultramsg') return !!(cfg.ultramsgInstance && cfg.ultramsgToken);
    if (cfg.provider==='greenapi') return !!(cfg.greenInstance && cfg.greenToken);
    if (cfg.provider==='baileys' || cfg.provider==='wppconnect' || cfg.provider==='whatsapp-web.js') {
      // verificar sesión en disco
      const sessPath = path.join(__dirname, '..', '..', 'wa-session', 'creds.json');
      return fs.existsSync(sessPath);
    }
    if (cfg.provider==='mock') return true;
    return false;
  })();
  return { provider: cfg.provider, configured, adminPhone: cfg.adminPhone || null, logsCount: LOGS.length };
}

// 3. VALIDACIÓN DE SESIÓN / CREDENCIALES - verificación en vivo contra API del proveedor
async function getStatusDetailed(){
  const cfg = getConfig();
  const base = getStatus();
  let session = { connected: false, needsQr: false, error: null, details: null };
  let credentials = { valid: base.configured, checkedAt: new Date().toISOString() };
  try {
    if(cfg.provider === 'ultramsg' && base.configured){
      // Intentar verificar instancia UltraMsg (requiere token válido)
      const url = `https://api.ultramsg.com/${cfg.ultramsgInstance}/instance/status?token=${cfg.ultramsgToken}`;
      const r = await fetch(url);
      const raw = await r.text();
      let data; try{ data = JSON.parse(raw);}catch(e){ data={raw};}
      console.log('[WhatsApp][Status][UltraMsg][RAW]', JSON.stringify({status:r.status, data}, null, 2));
      session.details = data;
      session.connected = r.ok && (data.status === 'authenticated' || data.instance?.status === 'authenticated' || data.connected === true);
      credentials.valid = r.ok && !data.error;
      if(!credentials.valid) session.error = data.error || data.message || 'Token/Instance UltraMsg inválido';
    } else if((cfg.provider === 'greenapi' || cfg.provider === 'green-api') && base.configured){
      const url = `https://api.green-api.com/waInstance${cfg.greenInstance}/getStateInstance/${cfg.greenToken}`;
      const r = await fetch(url);
      const raw = await r.text();
      let data; try{ data = JSON.parse(raw);}catch(e){ data={raw};}
      console.log('[WhatsApp][Status][GreenAPI][RAW]', JSON.stringify({status:r.status, data}, null, 2));
      session.details = data;
      // GreenAPI estados: authorized, notAuthorized, blocked
      if(data.stateInstance === 'authorized') session.connected = true;
      else if(data.stateInstance === 'notAuthorized' || data.stateInstance === 'blocked') { session.connected=false; session.needsQr=true; }
      credentials.valid = r.ok;
      if(!r.ok) session.error = data.message || JSON.stringify(data);
    } else if(cfg.provider === 'twilio' && base.configured){
      const url = `https://api.twilio.com/2010-04-01/Accounts/${cfg.twilioSid}.json`;
      const auth = Buffer.from(`${cfg.twilioSid}:${cfg.twilioToken}`).toString('base64');
      const r = await fetch(url, { headers:{ 'Authorization':'Basic '+auth }});
      const raw = await r.text();
      let data; try{ data = JSON.parse(raw);}catch(e){ data={raw};}
      console.log('[WhatsApp][Status][Twilio][RAW]', JSON.stringify({status:r.status, data}, null, 2));
      session.details = { status: data.status, friendlyName: data.friendly_name };
      session.connected = r.ok && data.status === 'active';
      credentials.valid = r.ok;
      if(!r.ok) session.error = data.message || JSON.stringify(data);
    } else if(cfg.provider === 'baileys' || cfg.provider === 'wppconnect' || cfg.provider === 'whatsapp-web.js'){
      const sessPath = path.join(__dirname, '..', '..', 'wa-session', 'creds.json');
      const qrPath = path.join(__dirname, '..', '..', 'wa-session', 'qr.png');
      session.connected = fs.existsSync(sessPath);
      session.needsQr = !session.connected;
      session.details = { sessionPath: sessPath, exists: session.connected, qrExists: fs.existsSync(qrPath) };
      if(session.needsQr) session.error = 'Sesión no encontrada - escanee QR. Genere QR y coloque en wa-session/';
      credentials.valid = session.connected;
    } else if(cfg.provider === 'mock'){
      session.connected = true;
      session.details = { note: 'MOCK siempre conectado pero NO envía a celular real. Use proveedor real para entrega.' };
      session.error = 'PROVIDER MOCK: los mensajes se marcan como success:true pero NO llegan al celular. Configure WHATSAPP_PROVIDER=ultramsg|greenapi|twilio';
    }
  } catch(e){
    console.error('[WhatsApp][Status] Error verificando credenciales:', e.message);
    session.error = e.message;
    credentials.valid = false;
  }
  return { ...base, session, credentials, timestamp: new Date().toISOString() };
}

module.exports = { enviarWhatsApp, validarTelefonoOrThrow, normalizarTelefono, formatForProvider, getConfig, getStatus, getStatusDetailed, obtenerLogs, _log };
