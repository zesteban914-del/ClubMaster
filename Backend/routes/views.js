const path = require('path');

module.exports = function(app) {
    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, '../../Frontend/login.html'));
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
