// Entrypoint serverless para Vercel (@vercel/node, full-stack).
// Importa el Express completo (Backend/server.js) y lo exporta como handler.
// server.js NO llama listen cuando es importado (require.main !== module).
const app = require('../Backend/server.js');

module.exports = app;