const path = require('path');
const fs = require('fs');

module.exports = function(app, db, security, mailer, authMiddleware) {
    // Register all route files
    const routeFiles = [
        { file: 'views.js', args: [app] },
        { file: 'auth.js', args: [app, db, security, mailer, authMiddleware] },
        { file: 'mesas.js', args: [app, db] },
        { file: 'productos.js', args: [app, db] },
        { file: 'jornadas.js', args: [app, db] },
        { file: 'proveedores.js', args: [app, db] },
        { file: 'compras.js', args: [app, db] },
        { file: 'usuarios.js', args: [app, db, authMiddleware] },
        { file: 'reportes.js', args: [app, db] },
        { file: 'inventario.js', args: [app, db] },
        { file: 'cartera.js', args: [app, db] },
        { file: 'facturacion.js', args: [app, db] },
        { file: 'configuracion-general.js', args: [app, db] },
        { file: 'operativa.js', args: [app, db] },
        { file: 'turnos.js', args: [app, db] },
        { file: 'audit.js', args: [app, db] },
        { file: 'backup.js', args: [app, db] },
        { file: 'print.js', args: [app, db] },
        { file: 'bodegas.js', args: [app, db] },
        { file: 'demo.js', args: [app, db] },
        { file: 'kds.js', args: [app, db] },
        { file: 'finanzas.js', args: [app, db] },
        { file: '2fa.js', args: [app, db] },
        { file: 'recetas.js', args: [app, db] },
        { file: 'devoluciones.js', args: [app, db] },
        { file: 'whatsapp.js', args: [app, db] }
    ];

    for (const route of routeFiles) {
        const routePath = path.join(__dirname, route.file);
        if (fs.existsSync(routePath)) {
            const routeHandler = require(routePath);
            routeHandler(...route.args);
        }
    }
};
