const path = require('path');

module.exports = function(app) {
    // Raiz del backend: en desarrollo sirve el login (el backend sirve el
    // frontend estatico). Con callback de error: si el archivo no existe
    // en el despliegue (p. ej. Railway sin carpeta Frontend), responde un
    // JSON limpio en vez de caer en el manejador de errores con 500.
    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, '../../Frontend/index.html'), function(err) {
            if (err && !res.headersSent) {
                return res.status(200).json({ ok: true, servicio: 'ClubMaster API' });
            }
        });
    });

    app.get('/app', (req, res) => {
        res.sendFile(path.join(__dirname, '../../Frontend/dashboard.html'));
    });

    app.get('/mesas', (req, res) => {
        res.sendFile(path.join(__dirname, '../../Frontend/mesas.html'));
    });

    app.get('/comandero', (req, res) => {
        res.sendFile(path.join(__dirname, '../../Frontend/comandero.html'));
    });

    app.get('/registrar', (req, res) => {
        res.sendFile(path.join(__dirname, '../../Frontend/registrar.html'));
    });

    app.get('/reiniciar-contrasena', (req, res) => {
        res.sendFile(path.join(__dirname, '../../Frontend/reiniciar-contrasena.html'));
    });
};
