// ClubMaster - Build step para Vercel (hosting estatico).
// Inyecta la URL del backend (Railway) en Frontend/js/env-config.js a partir de
// UNICAMENTE la variable VITE_API_URL. Es lo unico que puede leer el frontend
// vanilla (sin bundler) en tiempo de build.
//   Vercel -> Project Settings -> Environment Variables -> VITE_API_URL
//     Production y Preview: https://tu-backend.up.railway.app  (sin "/" final)
const fs = require('fs');
const path = require('path');

// Normalizacion: sin espacios ni "/" final.
const url = String(process.env.VITE_API_URL || '')
  .trim()
  .replace(/\/+$/, '');

if (!url) {
  if (process.env.VERCEL_ENV === 'production') {
    console.error('[vercel-build] Falta VITE_API_URL: define la URL publica del backend de Railway (https://... sin "/" final) en Vercel -> Settings -> Environment Variables (Production).');
    process.exit(1);
  }
  console.warn('[vercel-build] ADVERTENCIA: falta VITE_API_URL; el frontend no podra conectar con el backend.');
}

const contenido = [
  '// ARCHIVO GENERADO AUTOMATICAMENTE por scripts/vercel-build.js. No editar a mano.',
  '// VITE_API_URL (Vercel) apunta al backend desplegado en Railway.',
  'window.API_BASE = ' + JSON.stringify(url) + ';',
  'window.API_BASE_CFG = ' + JSON.stringify(url) + ';',
  ''
].join('\n');

const destino = path.join(__dirname, '..', 'Frontend', 'js', 'env-config.js');
fs.mkdirSync(path.dirname(destino), { recursive: true });
fs.writeFileSync(destino, contenido, 'utf8');
console.log('[vercel-build] env-config.js generado con API_BASE=' + (url || '(vacio)'));
