// =========================================================
// MODULO: GESTION DE FACTURAS / COMPROBANTES
// Panel unico que organiza todas las transacciones del
// sistema por categoria: Mesas/POS, Compras/Proveedores,
// Cuentas por Cobrar / Vales.
// =========================================================

(function() {
    var FACT = {
        tabActual: 'mesas',
        busqueda: '',
        fechaInicio: '',
        fechaFin: '',
        filtroEstado: '',
        filtroMesero: '',
        filtroCajero: '',
        facturasMesas: [],
        facturasCompras: [],
        facturasVales: [],
        cargando: false
    };

    function fN(v) { var n = Number(v); return isFinite(n) ? n : 0; }
    function fM(v) { return '$' + Math.round(fN(v)).toLocaleString('es-CO'); }
    function fFecha(v) {
        if (!v) return '--';
        var d = new Date(String(v).replace(/-/g, '/'));
        if (isNaN(d.getTime())) d = new Date(v);
        return isNaN(d.getTime()) ? String(v) : d.toLocaleString('es-CO');
    }
    function fFechaCorta(v) {
        if (!v) return '--';
        var d = new Date(String(v).replace(/-/g, '/'));
        if (isNaN(d.getTime())) d = new Date(v);
        if (isNaN(d.getTime())) return String(v);
        return d.toLocaleDateString('es-CO');
    }
    function esc(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // =========================================================
    // CSS DEL MODULO
    // =========================================================
    function inyectarCSS() {
        if (document.getElementById('cssModuloFacturacion')) return;
        var s = document.createElement('style');
        s.id = 'cssModuloFacturacion';
        s.textContent = [
            '.fac-wrap{color:#334155}',
            '.fac-header{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:18px}',
            '.fac-title{font-size:1.35rem;font-weight:800;color:#0f172a;display:flex;align-items:center;gap:10px}',
            '.fac-title i{color:#3b82f6}',
            '.fac-sub{color:#64748b;font-size:.8rem;font-weight:500;margin-top:2px}',
            '.fac-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;background:#f1f5f9;padding:6px;border-radius:12px;border:1px solid #e2e8f0}',
            '.fac-tab{border:none;background:transparent;color:#64748b;padding:9px 16px;border-radius:9px;font-weight:600;font-size:.82rem;cursor:pointer;display:flex;align-items:center;gap:7px;font-family:inherit;transition:all .15s ease}',
            '.fac-tab:hover{color:#334155;background:#e2e8f0}',
            '.fac-tab.active{background:linear-gradient(135deg,#2563eb,#3b82f6);color:#fff;box-shadow:0 3px 10px rgba(37,99,235,.3)}',
            '.fac-toolbar{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;align-items:flex-end}',
            '.fac-field{display:flex;flex-direction:column;gap:4px}',
            '.fac-field label{font-size:.7rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.04em}',
            '.fac-input{background:#fff;border:1px solid #e2e8f0;color:#334155;border-radius:10px;padding:9px 12px;font-size:.85rem;font-family:inherit;transition:all .15s ease}',
            '.fac-input:focus{outline:none;border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.12)}',
            '.fac-input::placeholder{color:#94a3b8}',
            '.fac-btn{border:none;border-radius:10px;padding:9px 16px;font-weight:600;font-size:.82rem;cursor:pointer;display:inline-flex;align-items:center;gap:7px;font-family:inherit;transition:all .18s ease;color:#fff;background:#3b82f6}',
            '.fac-btn:hover{background:#2563eb;transform:translateY(-1px)}',
            '.fac-btn:disabled{opacity:.55;cursor:not-allowed;transform:none}',
            '.fac-btn-ghost{background:transparent;border:1px solid #e2e8f0;color:#64748b}',
            '.fac-btn-ghost:hover{background:#f1f5f9;color:#334155}',
            '.fac-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden}',
            '.fac-card-head{padding:13px 18px;background:#0f172a;color:#f8fafc;font-weight:700;font-size:.85rem;display:flex;align-items:center;gap:8px;border-bottom:1px solid #1e293b}',
            '.fac-card-head i{color:#60a5fa}',
            '.fac-table{width:100%;border-collapse:collapse}',
            '.fac-table th{background:#f8fafc;color:#64748b;text-align:left;font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:10px 14px;border-bottom:1px solid #e2e8f0}',
            '.fac-table td{padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:.85rem;color:#334155;vertical-align:middle}',
            '.fac-table tbody tr:hover td{background:#f8fafc}',
            '.fac-table .right{text-align:right}',
            '.fac-table .center{text-align:center}',
            '.fac-table tfoot td{background:#f8fafc;font-weight:800;color:#0f172a;font-size:.9rem}',
            '.fac-scroll{overflow-x:auto}',
            '.fac-badge{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-size:.72rem;font-weight:700}',
            '.fac-badge-green{background:#dcfce7;color:#166534}',
            '.fac-badge-red{background:#fee2e2;color:#991b1b}',
            '.fac-badge-amber{background:#fef3c7;color:#92400e}',
            '.fac-badge-blue{background:#dbeafe;color:#1e40af}',
            '.fac-badge-purple{background:#ede9fe;color:#6b21a8}',
            '.fac-badge-gray{background:#f1f5f9;color:#64748b}',
            '.fac-empty{padding:40px;text-align:center;color:#94a3b8}',
            '.fac-empty i{font-size:2.5rem;display:block;margin-bottom:10px;color:#cbd5e1}',
            '.fac-kpi-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-bottom:16px}',
            '.fac-kpi{background:#fff;border:1px solid #e2e8f0;border-radius:13px;padding:14px 16px;position:relative;overflow:hidden}',
            '.fac-kpi::before{content:"";position:absolute;top:0;left:0;right:0;height:3px}',
            '.fac-kpi.k-blue::before{background:linear-gradient(90deg,#3b82f6,#60a5fa)}',
            '.fac-kpi.k-green::before{background:linear-gradient(90deg,#10b981,#34d399)}',
            '.fac-kpi.k-amber::before{background:linear-gradient(90deg,#f59e0b,#fbbf24)}',
            '.fac-kpi.k-purple::before{background:linear-gradient(90deg,#8b5cf6,#a78bfa)}',
            '.fac-kpi-label{font-size:.68rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em}',
            '.fac-kpi-val{font-size:1.3rem;font-weight:800;color:#0f172a;margin-top:6px;letter-spacing:-0.02em}',
            '.fac-kpi-sub{font-size:.7rem;color:#94a3b8;margin-top:3px}',
            '.fac-detalle-header{padding:16px 20px;background:#0f172a;color:#f8fafc;border-radius:12px;margin-bottom:14px}',
            '.fac-detalle-row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f1f5f9;font-size:.85rem}',
            '.fac-detalle-row:last-child{border-bottom:none}',
            '.fac-detalle-label{color:#64748b}',
            '.fac-detalle-val{font-weight:600;color:#0f172a}',
            '.fac-detalle-section{font-size:.72rem;font-weight:700;color:#3b82f6;text-transform:uppercase;letter-spacing:.04em;margin:14px 0 8px;padding-bottom:4px;border-bottom:1px solid #e2e8f0}'
        ].join('');
        document.head.appendChild(s);
    }

    // =========================================================
    // ENTRY POINT
    // =========================================================
    window.iniciarFacturacion = function() {
        if(typeof verificarAcceso==='function'&&!verificarAcceso('ver_caja')){if(typeof verificarAccesoRB==='function'&&!verificarAccesoRB('ver_caja'))return;return;}
        if(typeof verificarAccesoRB==='function'&&!verificarAccesoRB('ver_caja'))return;
        inyectarCSS();
        if (typeof activarNav === 'function') activarNav('navFacturacion');
        FACT.tabActual = 'mesas';
        FACT.busqueda = '';
        FACT.fechaInicio = '';
        FACT.fechaFin = '';
        FACT.filtroEstado = '';

        var cont = document.getElementById('main-content');
        cont.innerHTML = construirHTMLPrincipal();
        cambiarTabFact('mesas');
    };

    function construirHTMLPrincipal() {
        var hoy = new Date().toISOString().split('T')[0];
        return '<div class="fac-wrap">' +
            '<div class="fac-header">' +
            '<div><div class="fac-title"><i class="bi bi-receipt-cutoff"></i>Gestion de Facturas / Comprobantes</div>' +
            '<div class="fac-sub">Todas las transacciones del sistema organizadas por categoria</div></div>' +
            '<button class="fac-btn fac-btn-ghost" data-action="fac-refresh"><i class="bi bi-arrow-clockwise"></i> Actualizar</button>' +
            '</div>' +
            '<div id="contenedorAlertasFac"></div>' +
            '<div class="fac-tabs" id="facTabs">' +
            '<button class="fac-tab active" data-action="fac-tab" data-tab="mesas" id="facTabMesas"><i class="bi bi-grid-3x3-gap"></i> Mesas / POS <span class="fac-badge fac-badge-blue" id="facCountMesas">0</span></button>' +
            '<button class="fac-tab" data-action="fac-tab" data-tab="compras" id="facTabCompras"><i class="bi bi-bag-check"></i> Compras / Proveedores <span class="fac-badge fac-badge-amber" id="facCountCompras">0</span></button>' +
            '<button class="fac-tab" data-action="fac-tab" data-tab="vales" id="facTabVales"><i class="bi bi-wallet2"></i> Cuentas por Cobrar <span class="fac-badge fac-badge-purple" id="facCountVales">0</span></button>' +
            '</div>' +
            '<div id="facToolbar"></div>' +
            '<div id="facContenido">' +
            '<div class="fac-card"><div class="fac-empty"><div class="spinner-border text-primary"></div><p style="margin-top:10px">Cargando datos...</p></div></div>' +
            '</div>' +
            '</div>';
    }

    // =========================================================
    // CAMBIO DE TAB
    // =========================================================
    window.cambiarTabFact = function(tab) {
        FACT.tabActual = tab;
        FACT.busqueda = '';
        FACT.fechaInicio = '';
        FACT.fechaFin = '';
        FACT.filtroEstado = '';
        FACT.filtroMesero = '';
        FACT.filtroCajero = '';

        document.querySelectorAll('.fac-tab').forEach(function(t) { t.classList.remove('active'); });
        var tabEl = document.getElementById('facTab' + tab.charAt(0).toUpperCase() + tab.slice(1));
        if (tabEl) tabEl.classList.add('active');

        renderToolbar();
        cargarDatosTab();
    };

    // =========================================================
    // TOOLBAR (buscador + filtros)
    // =========================================================
    function renderToolbar() {
        var cont = document.getElementById('facToolbar');
        if (!cont) return;

        var opcionesEstadoMesas = '<option value="">Todos los metodos</option>' +
            '<option value="Efectivo">Efectivo</option><option value="Nequi">Nequi</option>' +
            '<option value="Daviplata">Daviplata</option><option value="Debito">Tarjeta Debito</option>' +
            '<option value="Credito">Tarjeta Credito</option><option value="Cortesia">Cortesia</option>' +
            '<option value="Vale">Vale</option>';

        var opcionesEstadoCompras = '<option value="">Todos los estados</option>' +
            '<option value="Pagada">Pagada</option><option value="Pendiente">Pendiente</option>' +
            '<option value="Parcial">Parcial</option><option value="Anulada">Anulada</option>';

        var opcionesEstadoVales = '<option value="">Todos los estados</option>' +
            '<option value="Pendiente">Pendiente</option><option value="Parcial">Parcial</option>' +
            '<option value="Liquidado">Liquidado</option>';

        var filtroExtra = '';
        if (FACT.tabActual === 'mesas') {
            filtroExtra = '<div class="fac-field"><label>Metodo de Pago</label>' +
                '<select class="fac-input" id="facFiltroEstado" data-change="fac-filtro-estado">' + opcionesEstadoMesas + '</select></div>' +
                '<div class="fac-field"><label>Mesero (Atendió)</label>' +
                '<select class="fac-input" id="facFiltroMesero" data-change="fac-filtro-mesero"><option value="">Todos</option></select></div>' +
                '<div class="fac-field"><label>Cajero (Cobró)</label>' +
                '<select class="fac-input" id="facFiltroCajero" data-change="fac-filtro-cajero"><option value="">Todos</option></select></div>';
        } else if (FACT.tabActual === 'compras') {
            filtroExtra = '<div class="fac-field"><label>Estado</label>' +
                '<select class="fac-input" id="facFiltroEstado" data-change="fac-filtro-estado">' + opcionesEstadoCompras + '</select></div>';
        } else {
            filtroExtra = '<div class="fac-field"><label>Estado</label>' +
                '<select class="fac-input" id="facFiltroEstado" data-change="fac-filtro-estado">' + opcionesEstadoVales + '</select></div>';
        }

        cont.innerHTML = '<div class="fac-toolbar">' +
            '<div class="fac-field" style="flex:1;min-width:200px"><label>Busqueda</label>' +
            '<input type="text" class="fac-input" id="facBuscador" placeholder="Buscar por numero, nombre, referencia..." data-input="fac-busqueda" style="width:100%"></div>' +
            '<div class="fac-field"><label>Fecha Inicio</label>' +
            '<input type="date" class="fac-input" id="facFechaInicio" data-change="fac-fecha"></div>' +
            '<div class="fac-field"><label>Fecha Fin</label>' +
            '<input type="date" class="fac-input" id="facFechaFin" data-change="fac-fecha"></div>' +
            filtroExtra +
            '<div class="fac-field"><label>&nbsp;</label>' +
            '<button class="fac-btn fac-btn-ghost" data-action="fac-limpiar"><i class="bi bi-x-lg"></i> Limpiar</button></div>' +
            '</div>';
        
        // Cargar opciones de meseros y cajeros para los filtros
        if (FACT.tabActual === 'mesas') {
            cargarOpcionesFiltrosMesas();
        }
    }

    window.facOnBusqueda = function(val) {
        FACT.busqueda = val;
        cargarDatosTab();
    };

    window.facOnFechaChange = function() {
        var fi = document.getElementById('facFechaInicio');
        var ff = document.getElementById('facFechaFin');
        FACT.fechaInicio = fi ? fi.value : '';
        FACT.fechaFin = ff ? ff.value : '';
        cargarDatosTab();
    };

    window.facFiltrarEstado = function(val) {
        FACT.filtroEstado = val;
        cargarDatosTab();
    };

    window.facFiltrarMesero = function(val) {
        FACT.filtroMesero = val;
        cargarDatosTab();
    };

    window.facFiltrarCajero = function(val) {
        FACT.filtroCajero = val;
        cargarDatosTab();
    };

    window.facLimpiarFiltros = function() {
        FACT.busqueda = '';
        FACT.fechaInicio = '';
        FACT.fechaFin = '';
        FACT.filtroEstado = '';
        FACT.filtroMesero = '';
        FACT.filtroCajero = '';
        var b = document.getElementById('facBuscador'); if (b) b.value = '';
        var fi = document.getElementById('facFechaInicio'); if (fi) fi.value = '';
        var ff = document.getElementById('facFechaFin'); if (ff) ff.value = '';
        var fe = document.getElementById('facFiltroEstado'); if (fe) fe.value = '';
        var fm = document.getElementById('facFiltroMesero'); if (fm) fm.value = '';
        var fc = document.getElementById('facFiltroCajero'); if (fc) fc.value = '';
        cargarDatosTab();
    };

    // =========================================================
    // CARGA DE DATOS
    // =========================================================
    function cargarDatosTab() {
        var cont = document.getElementById('facContenido');
        if (!cont) return;
        cont.innerHTML = '<div class="fac-card"><div class="fac-empty"><div class="spinner-border text-primary"></div><p style="margin-top:10px">Cargando...</p></div></div>';

        switch (FACT.tabActual) {
            case 'mesas': cargarFacturasMesas(); break;
            case 'compras': cargarFacturasCompras(); break;
            case 'vales': cargarFacturasVales(); break;
        }
    }

    // =========================================================
    // TAB: MESAS / POS
    // =========================================================
    function cargarFacturasMesas() {
        var params = new URLSearchParams();
        if (FACT.busqueda) params.set('busqueda', FACT.busqueda);
        if (FACT.fechaInicio) params.set('fecha_inicio', FACT.fechaInicio + ' 00:00:00');
        if (FACT.fechaFin) params.set('fecha_fin', FACT.fechaFin + ' 23:59:59');
        if (FACT.filtroEstado) params.set('metodo_pago', FACT.filtroEstado);
        if (FACT.filtroMesero) params.set('id_mesero', FACT.filtroMesero);
        if (FACT.filtroCajero) params.set('id_cajero', FACT.filtroCajero);

        fetch(API_BASE + '/api/facturas/mesas?' + params.toString())
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (data.success) {
                    FACT.facturasMesas = data.facturas || [];
                    renderKPIsMesas();
                    renderTablaMesas();
                    var el = document.getElementById('facCountMesas');
                    if (el) el.textContent = FACT.facturasMesas.length;
                } else {
                    mostrarErrorFac(data.mensaje || 'Error al cargar facturas');
                }
            })
            .catch(function() { mostrarErrorFac('No se pudo conectar con el servidor'); });
    }

    function renderKPIsMesas() {
        var f = FACT.facturasMesas;
        var total = 0, descuentos = 0, propinas = 0, efectivo = 0;
        f.forEach(function(x) {
            total += fN(x.total);
            descuentos += fN(x.descuento);
            propinas += fN(x.propina);
            if (String(x.metodo_pago).toLowerCase() === 'efectivo') efectivo += fN(x.total);
        });
        var kpiHtml = '<div class="fac-kpi-grid">' +
            kpiFac('k-blue', 'bi-receipt', 'Total Facturas', String(f.length), 'ventas cerradas') +
            kpiFac('k-green', 'bi-currency-dollar', 'Ventas Totales', fM(total), 'ingresos por facturacion') +
            kpiFac('k-amber', 'bi-tag', 'Descuentos', fM(descuentos), 'descuentos aplicados') +
            kpiFac('k-purple', 'bi-cash', 'Efectivo', fM(efectivo), 'pagos en efectivo') +
            '</div>';
        var cont = document.getElementById('facContenido');
        if (cont) cont.innerHTML = kpiHtml + '<div class="fac-card" id="facCardTabla"><div class="fac-card-head"><i class="bi bi-table"></i> Listado de Facturas - Mesas / POS</div><div class="fac-scroll" id="facTablaContainer"></div></div>';
    }

    function renderTablaMesas() {
        var cont = document.getElementById('facTablaContainer');
        if (!cont) return;
        var f = FACT.facturasMesas;
        if (f.length === 0) {
            cont.innerHTML = '<div class="fac-empty"><i class="bi bi-inbox"></i><p>No se encontraron facturas de mesas</p></div>';
            return;
        }
        var html = '<table class="fac-table"><thead><tr>' +
            '<th>Factura</th><th>Mesa</th><th>Fecha / Hora</th><th>Mesero (Atendió)</th><th>Cajero (Cobró)</th><th>Metodo Pago</th><th>Descuento</th><th>Propina</th><th class="right">Total</th><th class="center">Acciones</th>' +
            '</tr></thead><tbody>';
        f.forEach(function(row) {
            var numFac = 'F-' + String(Number(row.id_pedido) || 0).padStart(6, '0');
            var metodo = esc(row.metodo_pago || '');
            if (row.sub_metodo_pago) metodo += ' <span style="color:#94a3b8;font-size:.72rem">(' + esc(row.sub_metodo_pago) + ')</span>';
            var meseroNombre = esc(row.mesero_nombre || row.usuario_nombre || '--');
            var cajeroNombre = esc(row.cajero_nombre || '--');
            html += '<tr>' +
                '<td><span style="font-weight:700;color:#3b82f6;font-size:.82rem;cursor:pointer" data-action="fac-ver-mesa" data-id="' + (Number(row.id_pedido) || 0) + '">' + esc(numFac) + '</span></td>' +
                '<td><strong>' + esc(row.mesa_numero || '--') + '</strong> <span style="color:#94a3b8;font-size:.72rem">' + esc(row.mesa_zona || '') + '</span></td>' +
                '<td style="color:#64748b;font-size:.8rem">' + esc(fFecha(row.timestamp_despacho)) + '</td>' +
                '<td>' + meseroNombre + '</td>' +
                '<td>' + cajeroNombre + '</td>' +
                '<td>' + metodo + '</td>' +
                '<td style="color:#f59e0b">' + fM(row.descuento) + '</td>' +
                '<td style="color:#8b5cf6">' + fM(row.propina) + '</td>' +
                '<td class="right" style="font-weight:800;color:#0f172a">' + fM(row.total) + '</td>' +
                '<td class="center">' +
                '<button class="fac-btn fac-btn-ghost" style="padding:4px 10px;font-size:.72rem" data-action="fac-ver-mesa" data-id="' + (Number(row.id_pedido) || 0) + '" title="Ver detalle"><i class="bi bi-eye"></i></button> ' +
                '<button class="fac-btn fac-btn-ghost" style="padding:4px 10px;font-size:.72rem" data-action="fac-imprimir-mesa" data-id="' + (Number(row.id_pedido) || 0) + '" title="Imprimir"><i class="bi bi-printer"></i></button> ' +
                '<button class="fac-btn fac-btn-ghost" style="padding:4px 10px;font-size:.72rem" data-action="fac-descargar-mesa" data-id="' + (Number(row.id_pedido) || 0) + '" title="Descargar"><i class="bi bi-download"></i></button>' +
                '</td></tr>';
        });
        html += '</tbody><tfoot><tr>' +
            '<td colspan="6" class="right" style="color:#64748b;font-size:.82rem">' + f.length + ' factura(s)</td>' +
            '<td>' + fM(f.reduce(function(a, x) { return a + fN(x.descuento); }, 0)) + '</td>' +
            '<td>' + fM(f.reduce(function(a, x) { return a + fN(x.propina); }, 0)) + '</td>' +
            '<td class="right">' + fM(f.reduce(function(a, x) { return a + fN(x.total); }, 0)) + '</td>' +
            '<td></td></tr></tfoot></table>';
        cont.innerHTML = html;
    }

    // Cargar opciones para filtros de Mesero y Cajero
    function cargarOpcionesFiltrosMesas() {
        fetch(API_BASE + '/api/usuarios')
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (!data.success) return;
                var usuarios = data.usuarios || [];
                var meseros = usuarios.filter(function(u) {
                    var rol = (u.rol_nombre || u.rol || '').toString().toLowerCase();
                    return rol.indexOf('mesero') !== -1 || rol.indexOf('mesera') !== -1;
                });
                var cajeros = usuarios.filter(function(u) {
                    var rol = (u.rol_nombre || u.rol || '').toString().toLowerCase();
                    return rol.indexOf('cajer') !== -1 || rol.indexOf('admin') !== -1 || Number(u.id_rol) === 1;
                });
                // Si no hay roles específicos, usar todos los usuarios
                if (meseros.length === 0) meseros = usuarios;
                if (cajeros.length === 0) cajeros = usuarios;

                var selMesero = document.getElementById('facFiltroMesero');
                var selCajero = document.getElementById('facFiltroCajero');
                if (selMesero) {
                    var opts = '<option value="">Todos</option>';
                    meseros.forEach(function(u) {
                        opts += '<option value="' + u.id_usuario + '">' + esc(u.nombre) + '</option>';
                    });
                    selMesero.innerHTML = opts;
                    if (FACT.filtroMesero) selMesero.value = FACT.filtroMesero;
                }
                if (selCajero) {
                    var opts = '<option value="">Todos</option>';
                    cajeros.forEach(function(u) {
                        opts += '<option value="' + u.id_usuario + '">' + esc(u.nombre) + '</option>';
                    });
                    selCajero.innerHTML = opts;
                    if (FACT.filtroCajero) selCajero.value = FACT.filtroCajero;
                }
            })
            .catch(function() {});
    }

    window.facVerDetalleMesa = function(id) {
        fetch(API_BASE + '/api/facturas/mesas/' + id)
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (data.success && data.factura) {
                    mostrarModalDetalleMesa(data.factura);
                } else {
                    mostrarErrorFac('No se pudo cargar el detalle');
                }
            })
            .catch(function() { mostrarErrorFac('Error de conexion'); });
    };

    function mostrarModalDetalleMesa(f) {
        var numFac = 'F-' + String(Number(f.id_pedido) || 0).padStart(6, '0');
        var subtotalBruto = 0;
        var itemsHtml = '';
        (f.detalles || []).forEach(function(d) {
            var sub = fN(d.subtotal) || (fN(d.cantidad) * fN(d.precio_unitario));
            subtotalBruto += sub;
            itemsHtml += '<div class="fac-detalle-row">' +
                '<div><strong>' + esc(d.producto_nombre || 'Producto') + '</strong>' +
                '<br><span style="color:#94a3b8;font-size:.78rem">' + Number(d.cantidad) + ' x $' + fN(d.precio_unitario).toLocaleString() +
                (d.presentacion ? ' (' + esc(d.presentacion) + ')' : '') + '</span>' +
                (d.observaciones ? '<br><span style="color:#64748b;font-size:.72rem;font-style:italic">' + esc(d.observaciones) + '</span>' : '') +
                '</div>' +
                '<span class="fac-detalle-val">' + fM(sub) + '</span></div>';
        });

        var html = '<div style="padding:20px;max-width:550px">' +
            '<div class="fac-detalle-header">' +
            '<div style="font-size:1rem;font-weight:800">' + esc(numFac) + '</div>' +
            '<div style="font-size:.82rem;opacity:.8;margin-top:4px">Mesa ' + esc(f.mesa_numero || '--') + (f.mesa_zona ? ' (' + esc(f.mesa_zona) + ')' : '') + '</div>' +
            '<div style="font-size:.78rem;opacity:.7;margin-top:2px">' + esc(fFecha(f.timestamp_despacho)) + '</div>' +
            '</div>';

        html += '<div class="fac-detalle-section">Detalle de Consumo</div>' + itemsHtml;

        html += '<div class="fac-detalle-section">Resumen</div>';
        html += '<div class="fac-detalle-row"><span class="fac-detalle-label">Subtotal:</span><span class="fac-detalle-val">' + fM(subtotalBruto) + '</span></div>';
        if (fN(f.descuento) > 0) html += '<div class="fac-detalle-row"><span class="fac-detalle-label">Descuento:</span><span style="color:#f59e0b;font-weight:700">-' + fM(f.descuento) + '</span></div>';
        if (fN(f.propina) > 0) html += '<div class="fac-detalle-row"><span class="fac-detalle-label">Propina:</span><span style="color:#8b5cf6;font-weight:700">+' + fM(f.propina) + '</span></div>';
        html += '<div class="fac-detalle-row" style="border-top:2px solid #0f172a;padding-top:10px;margin-top:6px"><span style="font-weight:800;font-size:1rem">TOTAL:</span><span style="font-weight:800;font-size:1.1rem;color:#0f172a">' + fM(f.total) + '</span></div>';

        html += '<div class="fac-detalle-section">Pago</div>';
        html += '<div class="fac-detalle-row"><span class="fac-detalle-label">Metodo:</span><span class="fac-detalle-val">' + esc(f.metodo_pago || '') + (f.sub_metodo_pago ? ' - ' + esc(f.sub_metodo_pago) : '') + '</span></div>';
        if (f.referencia_pago) html += '<div class="fac-detalle-row"><span class="fac-detalle-label">Referencia:</span><span class="fac-detalle-val">' + esc(f.referencia_pago) + '</span></div>';
        html += '<div class="fac-detalle-row"><span class="fac-detalle-label">Mesero (Atendió):</span><span class="fac-detalle-val">' + esc(f.mesero_nombre || f.usuario_nombre || '--') + ' <small style=\"color:#94a3b8\">#' + esc(f.id_mesero || '--') + '</small></span></div>';
        html += '<div class="fac-detalle-row"><span class="fac-detalle-label">Cajero (Cobró):</span><span class="fac-detalle-val">' + esc(f.cajero_nombre || '--') + ' <small style=\"color:#94a3b8\">#' + esc(f.id_cajero || '--') + '</small></span></div>';
        html += '<div class="fac-detalle-row"><span class="fac-detalle-label">Jornada:</span><span class="fac-detalle-val">#' + esc(f.id_jornada || '--') + '</span></div>';

        if (f.es_cortesia) html += '<div style="margin-top:10px"><span class="fac-badge fac-badge-amber"><i class="bi bi-gift"></i> Cortesia</span></div>';

        // Auditoría: botón solo admin + historial
        var facIsAdmin = (function(){ try{ var u=JSON.parse(localStorage.getItem('usuario')||'{}'); return Number(u.id_rol)===1 || String(u.rol||'').toLowerCase().indexOf('admin')!==-1; }catch(e){ return false; } })();
        var adminBtn = facIsAdmin ? '<button class="fac-btn" style="background:#f59e0b" data-action="fac-editar-atrib" data-id="'+ (Number(f.id_factura||f.id_pedido)||0) +'"><i class="bi bi-pencil-square"></i> Editar mesero / cajero</button>' : '';
        html += '<div id=\"facCorreccionesHist-'+ (Number(f.id_factura||f.id_pedido)||0) +'\" style=\"margin-top:14px\"><div style=\"font-size:.72rem;color:#94a3b8\"><i class=\"bi bi-hourglass-split\"></i> Cargando historial de correcciones...</div></div>';

        html += '<div style="display:flex;gap:8px;margin-top:18px;justify-content:flex-end;flex-wrap:wrap">' + adminBtn +
            '<button class="fac-btn" style="background:#334155" data-action="fac-imprimir-mesa" data-id="' + (Number(f.id_pedido) || 0) + '"><i class="bi bi-printer"></i> Imprimir</button>' +
            '<button class="fac-btn" style="background:#10b981" data-action="fac-descargar-mesa" data-id="' + (Number(f.id_pedido) || 0) + '"><i class="bi bi-download"></i> Descargar</button>' +
            '<button class="fac-btn fac-btn-ghost" style="color:#334155" data-action="fac-cerrar-modal">Cerrar</button>' +
            '</div></div>';

        mostrarModalFac('Detalle Factura ' + numFac, html);
    }

    window.facImprimirMesa = function(id) {
        fetch(API_BASE + '/api/facturas/mesas/' + id)
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (!data.success || !data.factura) return;
                var f = data.factura;
                var numFac = 'F-' + String(Number(f.id_pedido) || 0).padStart(6, '0');
                var lineas = [];
                lineas.push('<div style="text-align:center;font-size:16px;font-weight:800;letter-spacing:1px">CLUBMASTER</div>');
                lineas.push('<div style="text-align:center;font-size:10px;margin-top:2px">FACTURA DE VENTA</div>');
                lineas.push('<div style="text-align:center;font-size:10px;font-weight:700">' + esc(numFac) + '</div>');
                lineas.push('<hr style="border-top:1px dashed #000">');
                lineas.push('<div style="font-size:10px">Mesa: ' + esc(f.mesa_numero || '--') + (f.mesa_zona ? ' (' + esc(f.mesa_zona) + ')' : '') + '</div>');
                lineas.push('<div style="font-size:10px">Fecha: ' + esc(fFecha(f.timestamp_despacho)) + '</div>');
                lineas.push('<div style="font-size:10px">Atendió: ' + esc(f.mesero_nombre || f.usuario_nombre || '--') + '</div>');
                lineas.push('<div style="font-size:10px">Cobró: ' + esc(f.cajero_nombre || '--') + '</div>');
                lineas.push('<hr style="border-top:1px dashed #000">');
                (f.detalles || []).forEach(function(d) {
                    var sub = fN(d.subtotal) || (fN(d.cantidad) * fN(d.precio_unitario));
                    lineas.push('<div style="display:flex;justify-content:space-between;font-size:10px"><span>' + Number(d.cantidad) + 'x ' + esc(d.producto_nombre || '') + '</span><span>$' + sub.toLocaleString() + '</span></div>');
                });
                lineas.push('<hr style="border-top:1px dashed #000">');
                if (fN(f.descuento) > 0) lineas.push('<div style="display:flex;justify-content:space-between;font-size:10px"><span>Descuento:</span><span>-$' + fN(f.descuento).toLocaleString() + '</span></div>');
                if (fN(f.propina) > 0) lineas.push('<div style="display:flex;justify-content:space-between;font-size:10px"><span>Propina:</span><span>+$' + fN(f.propina).toLocaleString() + '</span></div>');
                lineas.push('<div style="display:flex;justify-content:space-between;font-size:13px;font-weight:800;border-top:1px solid #000;padding-top:4px;margin-top:4px"><span>TOTAL:</span><span>$' + fN(f.total).toLocaleString() + '</span></div>');
                lineas.push('<hr style="border-top:1px dashed #000">');
                lineas.push('<div style="font-size:10px">Metodo: ' + esc(f.metodo_pago || '') + (f.sub_metodo_pago ? ' - ' + esc(f.sub_metodo_pago) : '') + '</div>');
                if (f.referencia_pago) lineas.push('<div style="font-size:10px">Ref: ' + esc(f.referencia_pago) + '</div>');
                lineas.push('<div style="text-align:center;font-size:9px;margin-top:10px">Gracias por su visita</div>');

                var w = window.open('', '_blank', 'width=360,height=600');
                w.document.write('<html><head><title>' + numFac + '</title><style>body{font-family:monospace;font-size:11px;width:300px;margin:0 auto;padding:8px}hr{border-top:1px dashed #000}</style></head><body>' + lineas.join('') + '<script>window.onload=function(){setTimeout(function(){window.print();},300);}<\/script></body></html>');
                w.document.close();
            });
    };

    window.facDescargarMesa = function(id) {
        fetch(API_BASE + '/api/facturas/mesas/' + id)
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (!data.success || !data.factura) return;
                var f = data.factura;
                var numFac = 'F-' + String(Number(f.id_pedido) || 0).padStart(6, '0');
                var txt = 'CLUBMASTER - FACTURA DE VENTA\n' + numFac + '\n' +
                    'Mesa: ' + (f.mesa_numero || '--') + '\n' +
                    'Fecha: ' + fFecha(f.timestamp_despacho) + '\n' +
                    'Atendió: ' + (f.mesero_nombre || f.usuario_nombre || '--') + '\n' +
                    'Cobró: ' + (f.cajero_nombre || '--') + '\n' +
                    '-----------------------------------\n';
                (f.detalles || []).forEach(function(d) {
                    var sub = fN(d.subtotal) || (fN(d.cantidad) * fN(d.precio_unitario));
                    txt += d.cantidad + 'x ' + (d.producto_nombre || '') + '  $' + sub.toLocaleString() + '\n';
                });
                txt += '-----------------------------------\n';
                if (fN(f.descuento) > 0) txt += 'Descuento: -$' + fN(f.descuento).toLocaleString() + '\n';
                if (fN(f.propina) > 0) txt += 'Propina: +$' + fN(f.propina).toLocaleString() + '\n';
                txt += 'TOTAL: $' + fN(f.total).toLocaleString() + '\n';
                txt += '-----------------------------------\n';
                txt += 'Metodo: ' + (f.metodo_pago || '') + '\n';
                if (f.referencia_pago) txt += 'Ref: ' + f.referencia_pago + '\n';
                txt += '\nGracias por su visita\n';
                var blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
                var a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = numFac + '.txt';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            });
    };

    // =========================================================
    // TAB: COMPRAS / PROVEEDORES
    // =========================================================
    function cargarFacturasCompras() {
        var params = new URLSearchParams();
        if (FACT.busqueda) params.set('busqueda', FACT.busqueda);
        if (FACT.fechaInicio) params.set('fecha_inicio', FACT.fechaInicio + ' 00:00:00');
        if (FACT.fechaFin) params.set('fecha_fin', FACT.fechaFin + ' 23:59:59');
        if (FACT.filtroEstado) params.set('estado', FACT.filtroEstado);

        fetch(API_BASE + '/api/facturas/compras?' + params.toString())
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (data.success) {
                    FACT.facturasCompras = data.facturas || [];
                    renderKPIsCompras();
                    renderTablaCompras();
                    var el = document.getElementById('facCountCompras');
                    if (el) el.textContent = FACT.facturasCompras.length;
                } else {
                    mostrarErrorFac(data.mensaje || 'Error al cargar compras');
                }
            })
            .catch(function() { mostrarErrorFac('No se pudo conectar con el servidor'); });
    }

    function renderKPIsCompras() {
        var f = FACT.facturasCompras;
        var total = 0, pagadas = 0, pendientes = 0, iva = 0;
        f.forEach(function(x) {
            total += fN(x.total);
            iva += fN(x.iva);
            if (x.estado === 'Pagada') pagadas++;
            else if (x.estado === 'Pendiente' || x.estado === 'Parcial') pendientes += fN(x.saldo_pendiente);
        });
        var cont = document.getElementById('facContenido');
        if (!cont) return;
        cont.innerHTML = '<div class="fac-kpi-grid">' +
            kpiFac('k-blue', 'bi-bag-check', 'Total Compras', String(f.length), 'registros de compra') +
            kpiFac('k-green', 'bi-check-circle', 'Pagadas', String(f.filter(function(x) { return x.estado === 'Pagada'; }).length), 'completadas') +
            kpiFac('k-amber', 'bi-clock', 'Pendientes', fM(pendientes), 'saldo por pagar') +
            kpiFac('k-purple', 'bi-percent', 'IVA Total', fM(iva), 'impuestos pagados') +
            '</div>' +
            '<div class="fac-card"><div class="fac-card-head"><i class="bi bi-table"></i> Listado de Compras / Proveedores</div><div class="fac-scroll" id="facTablaContainer"></div></div>';
        renderTablaCompras();
    }

    function renderTablaCompras() {
        var cont = document.getElementById('facTablaContainer');
        if (!cont) return;
        var f = FACT.facturasCompras;
        if (f.length === 0) {
            cont.innerHTML = '<div class="fac-empty"><i class="bi bi-inbox"></i><p>No se encontraron compras registradas</p></div>';
            return;
        }
        var html = '<table class="fac-table"><thead><tr>' +
            '<th>Compra</th><th>Nro. Factura Prov.</th><th>Proveedor</th><th>Fecha</th><th>Estado</th><th>Metodo Pago</th><th>IVA</th><th class="right">Total</th><th class="center">Acciones</th>' +
            '</tr></thead><tbody>';
        f.forEach(function(row) {
            var numCompra = 'C-' + String(Number(row.id_compra) || 0).padStart(5, '0');
            var estadoBadge = row.estado === 'Pagada' ? 'fac-badge-green' :
                (row.estado === 'Pendiente' ? 'fac-badge-red' :
                (row.estado === 'Parcial' ? 'fac-badge-amber' : 'fac-badge-gray'));
            html += '<tr>' +
                '<td><span style="font-weight:700;color:#3b82f6;font-size:.82rem;cursor:pointer" data-action="fac-ver-compra" data-id="' + (Number(row.id_compra) || 0) + '">' + esc(numCompra) + '</span></td>' +
                '<td>' + esc(row.numero_factura || '--') + '</td>' +
                '<td><strong>' + esc(row.proveedor_nombre || '--') + '</strong>' +
                (row.proveedor_nit ? '<br><span style="color:#94a3b8;font-size:.72rem">NIT: ' + esc(row.proveedor_nit) + '</span>' : '') + '</td>' +
                '<td style="color:#64748b;font-size:.8rem">' + esc(fFechaCorta(row.fecha)) + '</td>' +
                '<td><span class="fac-badge ' + estadoBadge + '">' + esc(row.estado || '') + '</span></td>' +
                '<td>' + esc(row.metodo_pago || row.forma_pago || '--') + '</td>' +
                '<td>' + fM(row.iva) + '</td>' +
                '<td class="right" style="font-weight:800;color:#0f172a">' + fM(row.total) + '</td>' +
                '<td class="center">' +
                '<button class="fac-btn fac-btn-ghost" style="padding:4px 10px;font-size:.72rem" data-action="fac-ver-compra" data-id="' + (Number(row.id_compra) || 0) + '" title="Ver detalle"><i class="bi bi-eye"></i></button>' +
                '</td></tr>';
        });
        html += '</tbody><tfoot><tr>' +
            '<td colspan="6" class="right" style="color:#64748b;font-size:.82rem">' + f.length + ' compra(s)</td>' +
            '<td>' + fM(f.reduce(function(a, x) { return a + fN(x.iva); }, 0)) + '</td>' +
            '<td class="right">' + fM(f.reduce(function(a, x) { return a + fN(x.total); }, 0)) + '</td>' +
            '<td></td></tr></tfoot></table>';
        cont.innerHTML = html;
    }

    window.facVerDetalleCompra = function(id) {
        fetch(API_BASE + '/api/facturas/compras/' + id)
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (data.success && data.factura) {
                    mostrarModalDetalleCompra(data.factura);
                } else {
                    mostrarErrorFac('No se pudo cargar el detalle');
                }
            })
            .catch(function() { mostrarErrorFac('Error de conexion'); });
    };

    function mostrarModalDetalleCompra(f) {
        var numCompra = 'C-' + String(Number(f.id_compra) || 0).padStart(5, '0');
        var itemsHtml = '';
        (f.detalles || []).forEach(function(d) {
            itemsHtml += '<div class="fac-detalle-row">' +
                '<div><strong>' + esc(d.producto_nombre || 'Producto') + '</strong>' +
                '<br><span style="color:#94a3b8;font-size:.78rem">' + Number(d.cantidad) + ' x $' + fN(d.costo_unitario).toLocaleString() + '</span>' +
                (d.descuento > 0 ? '<br><span style="color:#f59e0b;font-size:.72rem">Desc: -$' + fN(d.descuento).toLocaleString() + '</span>' : '') +
                '</div>' +
                '<span class="fac-detalle-val">' + fM(d.total_linea) + '</span></div>';
        });

        var pagosHtml = '';
        (f.pagos || []).forEach(function(p) {
            pagosHtml += '<div class="fac-detalle-row">' +
                '<div><span>' + esc(p.metodo_pago || '--') + '</span>' +
                (p.referencia ? '<br><span style="color:#94a3b8;font-size:.72rem">Ref: ' + esc(p.referencia) + '</span>' : '') +
                '<br><span style="color:#64748b;font-size:.7rem">' + esc(fFecha(p.fecha_pago)) + '</span></div>' +
                '<span class="fac-detalle-val" style="color:#10b981">' + fM(p.monto) + '</span></div>';
        });

        var estadoBadge = f.estado === 'Pagada' ? 'fac-badge-green' :
            (f.estado === 'Pendiente' ? 'fac-badge-red' :
            (f.estado === 'Parcial' ? 'fac-badge-amber' : 'fac-badge-gray'));

        var html = '<div style="padding:20px;max-width:600px">' +
            '<div class="fac-detalle-header">' +
            '<div style="display:flex;justify-content:space-between;align-items:center">' +
            '<div><div style="font-size:1rem;font-weight:800">' + esc(numCompra) + '</div>' +
            '<div style="font-size:.82rem;opacity:.8;margin-top:4px">' + esc(f.numero_factura || 'S/N') + '</div></div>' +
            '<span class="fac-badge ' + estadoBadge + '" style="font-size:.8rem;padding:5px 14px">' + esc(f.estado || '') + '</span>' +
            '</div></div>';

        html += '<div class="fac-detalle-section">Proveedor</div>';
        html += '<div class="fac-detalle-row"><span class="fac-detalle-label">Nombre:</span><span class="fac-detalle-val">' + esc(f.proveedor_nombre || '--') + '</span></div>';
        if (f.proveedor_nit) html += '<div class="fac-detalle-row"><span class="fac-detalle-label">NIT:</span><span class="fac-detalle-val">' + esc(f.proveedor_nit) + '</span></div>';
        if (f.proveedor_direccion) html += '<div class="fac-detalle-row"><span class="fac-detalle-label">Direccion:</span><span class="fac-detalle-val">' + esc(f.proveedor_direccion) + '</span></div>';
        if (f.proveedor_telefono) html += '<div class="fac-detalle-row"><span class="fac-detalle-label">Telefono:</span><span class="fac-detalle-val">' + esc(f.proveedor_telefono) + '</span></div>';

        html += '<div class="fac-detalle-section">Productos Comprados</div>' + itemsHtml;

        html += '<div class="fac-detalle-section">Resumen Financiero</div>';
        html += '<div class="fac-detalle-row"><span class="fac-detalle-label">Subtotal:</span><span class="fac-detalle-val">' + fM(f.subtotal) + '</span></div>';
        if (fN(f.descuento) > 0) html += '<div class="fac-detalle-row"><span class="fac-detalle-label">Descuento:</span><span style="color:#f59e0b;font-weight:700">-' + fM(f.descuento) + '</span></div>';
        html += '<div class="fac-detalle-row"><span class="fac-detalle-label">Base Gravable:</span><span class="fac-detalle-val">' + fM(f.base_gravable) + '</span></div>';
        if (fN(f.iva) > 0) html += '<div class="fac-detalle-row"><span class="fac-detalle-label">IVA:</span><span class="fac-detalle-val">' + fM(f.iva) + '</span></div>';
        if (fN(f.ico) > 0) html += '<div class="fac-detalle-row"><span class="fac-detalle-label">ICO:</span><span class="fac-detalle-val">' + fM(f.ico) + '</span></div>';
        html += '<div class="fac-detalle-row" style="border-top:2px solid #0f172a;padding-top:10px;margin-top:6px"><span style="font-weight:800;font-size:1rem">TOTAL:</span><span style="font-weight:800;font-size:1.1rem;color:#0f172a">' + fM(f.total) + '</span></div>';
        if (fN(f.saldo_pendiente) > 0) html += '<div class="fac-detalle-row"><span class="fac-detalle-label">Saldo Pendiente:</span><span style="color:#dc2626;font-weight:700">' + fM(f.saldo_pendiente) + '</span></div>';

        if (pagosHtml) {
            html += '<div class="fac-detalle-section">Pagos Realizados (' + (f.pagos || []).length + ')</div>' + pagosHtml;
        }

        html += '<div class="fac-detalle-section">Informacion General</div>';
        html += '<div class="fac-detalle-row"><span class="fac-detalle-label">Fecha Compra:</span><span class="fac-detalle-val">' + esc(fFecha(f.fecha)) + '</span></div>';
        html += '<div class="fac-detalle-row"><span class="fac-detalle-label">Forma de Pago:</span><span class="fac-detalle-val">' + esc(f.forma_pago || '--') + '</span></div>';
        html += '<div class="fac-detalle-row"><span class="fac-detalle-label">Metodo:</span><span class="fac-detalle-val">' + esc(f.metodo_pago || '--') + '</span></div>';
        html += '<div class="fac-detalle-row"><span class="fac-detalle-label">Responsable:</span><span class="fac-detalle-val">' + esc(f.usuario_nombre || '--') + '</span></div>';
        if (f.observaciones) html += '<div class="fac-detalle-row"><span class="fac-detalle-label">Observaciones:</span><span class="fac-detalle-val">' + esc(f.observaciones) + '</span></div>';

        html += '<div style="display:flex;gap:8px;margin-top:18px;justify-content:flex-end">' +
            '<button class="fac-btn fac-btn-ghost" style="color:#334155" data-action="fac-cerrar-modal">Cerrar</button>' +
            '</div></div>';

        mostrarModalFac('Detalle Compra ' + numCompra, html);
    }

    // =========================================================
    // TAB: CUENTAS POR COBRAR / VALES
    // =========================================================
    function cargarFacturasVales() {
        var params = new URLSearchParams();
        if (FACT.busqueda) params.set('busqueda', FACT.busqueda);
        if (FACT.fechaInicio) params.set('fecha_inicio', FACT.fechaInicio + ' 00:00:00');
        if (FACT.fechaFin) params.set('fecha_fin', FACT.fechaFin + ' 23:59:59');
        if (FACT.filtroEstado) params.set('estado', FACT.filtroEstado);

        fetch(API_BASE + '/api/facturas/vales?' + params.toString())
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (data.success) {
                    FACT.facturasVales = data.facturas || [];
                    renderKPIsVales();
                    renderTablaVales();
                    var el = document.getElementById('facCountVales');
                    if (el) el.textContent = FACT.facturasVales.length;
                } else {
                    mostrarErrorFac(data.mensaje || 'Error al cargar vales');
                }
            })
            .catch(function() { mostrarErrorFac('No se pudo conectar con el servidor'); });
    }

    function renderKPIsVales() {
        var f = FACT.facturasVales;
        var total = 0, pendiente = 0, pagado = 0, mora = 0;
        f.forEach(function(x) {
            total += fN(x.total);
            pendiente += fN(x.saldo_pendiente);
            pagado += fN(x.capital_pagado);
            mora += fN(x.mora_acumulada);
        });
        var cont = document.getElementById('facContenido');
        if (!cont) return;
        cont.innerHTML = '<div class="fac-kpi-grid">' +
            kpiFac('k-purple', 'bi-wallet2', 'Total Vales', String(f.length), 'cuentas por cobrar') +
            kpiFac('k-green', 'bi-check-circle', 'Pagados', fM(pagado), 'capital recuperado') +
            kpiFac('k-amber', 'bi-clock-history', 'Pendientes', fM(pendiente), 'saldo por cobrar') +
            kpiFac('k-blue', 'bi-exclamation-triangle', 'Mora', fM(mora), 'intereses acumulados') +
            '</div>' +
            '<div class="fac-card"><div class="fac-card-head"><i class="bi bi-table"></i> Listado de Cuentas por Cobrar / Vales</div><div class="fac-scroll" id="facTablaContainer"></div></div>';
        renderTablaVales();
    }

    function renderTablaVales() {
        var cont = document.getElementById('facTablaContainer');
        if (!cont) return;
        var f = FACT.facturasVales;
        if (f.length === 0) {
            cont.innerHTML = '<div class="fac-empty"><i class="bi bi-inbox"></i><p>No se encontraron cuentas por cobrar</p></div>';
            return;
        }
        var html = '<table class="fac-table"><thead><tr>' +
            '<th>Vale</th><th>Cliente / Socio</th><th>Fecha</th><th>Vencimiento</th><th>Estado</th><th>Pagado</th><th>Pendiente</th><th class="right">Total</th><th class="center">Acciones</th>' +
            '</tr></thead><tbody>';
        f.forEach(function(row) {
            var numVale = 'V-' + String(Number(row.id_vale) || 0).padStart(5, '0');
            var estadoBadge = row.estado === 'Liquidado' ? 'fac-badge-green' :
                (row.estado === 'Pendiente' ? 'fac-badge-red' : 'fac-badge-amber');
            var vencido = row.fecha_vencimiento && new Date(row.fecha_vencimiento) < new Date() && row.estado !== 'Liquidado';
            html += '<tr' + (vencido ? ' style="background:#fef2f2"' : '') + '>' +
                '<td><span style="font-weight:700;color:#8b5cf6;font-size:.82rem;cursor:pointer" data-action="fac-ver-vale" data-id="' + (Number(row.id_vale) || 0) + '">' + esc(numVale) + '</span></td>' +
                '<td><strong>' + esc(row.cliente_socio || '--') + '</strong>' +
                (row.mesa_numero ? '<br><span style="color:#94a3b8;font-size:.72rem">Mesa ' + esc(row.mesa_numero) + '</span>' : '') + '</td>' +
                '<td style="color:#64748b;font-size:.8rem">' + esc(fFechaCorta(row.fecha)) + '</td>' +
                '<td style="font-size:.8rem;' + (vencido ? 'color:#dc2626;font-weight:700' : 'color:#64748b') + '">' + esc(fFechaCorta(row.fecha_vencimiento)) + (vencido ? ' <i class="bi bi-exclamation-triangle"></i>' : '') + '</td>' +
                '<td><span class="fac-badge ' + estadoBadge + '">' + esc(row.estado || '') + '</span></td>' +
                '<td style="color:#10b981">' + fM(row.capital_pagado) + '</td>' +
                '<td style="color:#f59e0b">' + fM(row.saldo_pendiente) + '</td>' +
                '<td class="right" style="font-weight:800;color:#0f172a">' + fM(row.total) + '</td>' +
                '<td class="center">' +
                '<button class="fac-btn fac-btn-ghost" style="padding:4px 10px;font-size:.72rem" data-action="fac-ver-vale" data-id="' + (Number(row.id_vale) || 0) + '" title="Ver detalle"><i class="bi bi-eye"></i></button>' +
                '</td></tr>';
        });
        html += '</tbody><tfoot><tr>' +
            '<td colspan="5" class="right" style="color:#64748b;font-size:.82rem">' + f.length + ' vale(s)</td>' +
            '<td>' + fM(f.reduce(function(a, x) { return a + fN(x.capital_pagado); }, 0)) + '</td>' +
            '<td>' + fM(f.reduce(function(a, x) { return a + fN(x.saldo_pendiente); }, 0)) + '</td>' +
            '<td class="right">' + fM(f.reduce(function(a, x) { return a + fN(x.total); }, 0)) + '</td>' +
            '<td></td></tr></tfoot></table>';
        cont.innerHTML = html;
    }

    window.facVerDetalleVale = function(id) {
        fetch(API_BASE + '/api/facturas/vales/' + id)
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (data.success && data.factura) {
                    mostrarModalDetalleVale(data.factura);
                } else {
                    mostrarErrorFac('No se pudo cargar el detalle');
                }
            })
            .catch(function() { mostrarErrorFac('Error de conexion'); });
    };

    function mostrarModalDetalleVale(f) {
        var numVale = 'V-' + String(Number(f.id_vale) || 0).padStart(5, '0');
        var estadoBadge = f.estado === 'Liquidado' ? 'fac-badge-green' :
            (f.estado === 'Pendiente' ? 'fac-badge-red' : 'fac-badge-amber');

        var abonosHtml = '';
        (f.abonos || []).forEach(function(a) {
            abonosHtml += '<div class="fac-detalle-row">' +
                '<div><span>' + esc(a.metodo_pago || '--') + '</span>' +
                (a.sub_metodo_pago ? ' - ' + esc(a.sub_metodo_pago) : '') +
                (a.referencia ? '<br><span style="color:#94a3b8;font-size:.72rem">Ref: ' + esc(a.referencia) + '</span>' : '') +
                '<br><span style="color:#64748b;font-size:.7rem">' + esc(fFecha(a.fecha)) + (a.usuario_nombre ? ' - ' + esc(a.usuario_nombre) : '') + '</span></div>' +
                '<div style="text-align:right">' +
                '<div style="font-weight:700;color:#10b981">' + fM(a.monto_abono) + '</div>' +
                '<div style="font-size:.72rem;color:#94a3b8">Capital: ' + fM(a.monto_capital) + (fN(a.monto_mora) > 0 ? ' | Mora: ' + fM(a.monto_mora) : '') + '</div>' +
                '</div></div>';
        });

        var html = '<div style="padding:20px;max-width:550px">' +
            '<div class="fac-detalle-header">' +
            '<div style="display:flex;justify-content:space-between;align-items:center">' +
            '<div><div style="font-size:1rem;font-weight:800">' + esc(numVale) + '</div>' +
            '<div style="font-size:.82rem;opacity:.8;margin-top:4px">' + esc(f.cliente_socio || 'Sin cliente') + '</div>' +
            '<div style="font-size:.78rem;opacity:.7;margin-top:2px">' + esc(fFecha(f.fecha)) + '</div></div>' +
            '<span class="fac-badge ' + estadoBadge + '" style="font-size:.8rem;padding:5px 14px">' + esc(f.estado || '') + '</span>' +
            '</div></div>';

        html += '<div class="fac-detalle-section">Cliente</div>';
        html += '<div class="fac-detalle-row"><span class="fac-detalle-label">Nombre:</span><span class="fac-detalle-val">' + esc(f.cliente_socio || '--') + '</span></div>';
        if (f.cliente_documento) html += '<div class="fac-detalle-row"><span class="fac-detalle-label">Documento:</span><span class="fac-detalle-val">' + esc(f.cliente_documento) + '</span></div>';
        if (f.cliente_telefono) html += '<div class="fac-detalle-row"><span class="fac-detalle-label">Telefono:</span><span class="fac-detalle-val">' + esc(f.cliente_telefono) + '</span></div>';
        if (f.mesa_numero) html += '<div class="fac-detalle-row"><span class="fac-detalle-label">Mesa:</span><span class="fac-detalle-val">' + esc(f.mesa_numero) + '</span></div>';

        html += '<div class="fac-detalle-section">Resumen Financiero</div>';
        html += '<div class="fac-detalle-row"><span class="fac-detalle-label">Total Vale:</span><span class="fac-detalle-val" style="font-size:1.05rem;font-weight:800">' + fM(f.total) + '</span></div>';
        html += '<div class="fac-detalle-row"><span class="fac-detalle-label">Capital Pagado:</span><span style="color:#10b981;font-weight:700">' + fM(f.capital_pagado) + '</span></div>';
        html += '<div class="fac-detalle-row"><span class="fac-detalle-label">Saldo Pendiente:</span><span style="color:#f59e0b;font-weight:700">' + fM(f.saldo_pendiente) + '</span></div>';
        if (fN(f.mora_acumulada) > 0) {
            html += '<div class="fac-detalle-row"><span class="fac-detalle-label">Mora Acumulada:</span><span style="color:#dc2626;font-weight:700">' + fM(f.mora_acumulada) + '</span></div>';
            html += '<div class="fac-detalle-row"><span class="fac-detalle-label">Mora Pagada:</span><span style="color:#10b981">' + fM(f.mora_pagada) + '</span></div>';
        }
        if (f.tipo_mora && fN(f.tasa_mora) > 0) {
            html += '<div class="fac-detalle-row"><span class="fac-detalle-label">Tipo Mora:</span><span class="fac-detalle-val">' + esc(f.tipo_mora) + ' (' + fN(f.tasa_mora) + '%)</span></div>';
        }
        if (f.exonerada_mora) html += '<div style="margin-top:6px"><span class="fac-badge fac-badge-green"><i class="bi bi-shield-check"></i> Mora exonerada</span></div>';

        if (abonosHtml) {
            html += '<div class="fac-detalle-section">Historial de Pagos (' + (f.abonos || []).length + ')</div>' + abonosHtml;
        } else {
            html += '<div class="fac-detalle-section">Historial de Pagos</div>';
            html += '<div style="padding:14px;text-align:center;color:#94a3b8;font-size:.82rem">Sin abonos registrados</div>';
        }

        html += '<div class="fac-detalle-section">Informacion General</div>';
        html += '<div class="fac-detalle-row"><span class="fac-detalle-label">Autoriza:</span><span class="fac-detalle-val">' + esc(f.usuario_nombre || '--') + '</span></div>';
        if (f.fecha_vencimiento) html += '<div class="fac-detalle-row"><span class="fac-detalle-label">Vencimiento:</span><span class="fac-detalle-val">' + esc(fFechaCorta(f.fecha_vencimiento)) + '</span></div>';
        if (f.referencia) html += '<div class="fac-detalle-row"><span class="fac-detalle-label">Referencia:</span><span class="fac-detalle-val">' + esc(f.referencia) + '</span></div>';

        html += '<div style="display:flex;gap:8px;margin-top:18px;justify-content:flex-end">' +
            '<button class="fac-btn fac-btn-ghost" style="color:#334155" data-action="fac-cerrar-modal">Cerrar</button>' +
            '</div></div>';

        mostrarModalFac('Detalle Vale ' + numVale, html);
    }

    // =========================================================
    // UTILIDADES DE UI
    // =========================================================
    function kpiFac(cls, icon, label, val, sub) {
        return '<div class="fac-kpi ' + cls + '">' +
            '<div class="fac-kpi-label">' + label + ' <i class="bi ' + icon + '"></i></div>' +
            '<div class="fac-kpi-val">' + val + '</div>' +
            '<div class="fac-kpi-sub">' + sub + '</div></div>';
    }

    function mostrarModalFac(titulo, contenidoHtml) {
        var existing = document.getElementById('modalFacDetalle');
        if (existing) existing.remove();

        var d = document.createElement('div');
        d.className = 'modal fade';
        d.id = 'modalFacDetalle';
        d.tabIndex = '-1';
        d.innerHTML = '<div class="modal-dialog modal-lg modal-dialog-scrollable"><div class="modal-content" style="border-radius:14px;border:1px solid #e2e8f0">' +
            '<div class="modal-header" style="background:#0f172a;color:#f8fafc;border-bottom:1px solid #1e293b">' +
            '<h5 class="modal-title" style="font-weight:700;font-size:.95rem"><i class="bi bi-file-earmark-text" style="color:#60a5fa;margin-right:8px"></i>' + esc(titulo) + '</h5>' +
            '<button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div>' +
            '<div class="modal-body" style="background:#fff;max-height:70vh;overflow-y:auto;padding:0">' + contenidoHtml + '</div>' +
            '<div class="modal-footer" style="border-top:1px solid #e2e8f0;background:#f8fafc">' +
            '<button type="button" class="btn btn-sm" style="background:#0f172a;color:#f8fafc;border:none;border-radius:8px;font-weight:700;padding:8px 20px" data-bs-dismiss="modal">Cerrar</button>' +
            '</div></div></div>';
        document.body.appendChild(d);
        var modal = new bootstrap.Modal(d);
        modal.show();
        d.addEventListener('hidden.bs.modal', function() { d.remove(); });
    }

    window.facCerrarModal = function() {
        var el = document.getElementById('modalFacDetalle');
        if (el) {
            var inst = bootstrap.Modal.getInstance(el);
            if (inst) inst.hide();
        }
    };

    function mostrarErrorFac(msg) {
        var c = document.getElementById('contenedorAlertasFac');
        if (!c) return;
        c.innerHTML = '<div class="alert alert-danger alert-dismissible fade show" style="border-radius:10px;font-size:.85rem">' + esc(msg) + '<button type="button" class="btn-close" data-bs-dismiss="alert"></button></div>';
        setTimeout(function() { if (c) c.innerHTML = ''; }, 4000);
    }

    // === Corrección mesero/cajero (admin) ===
    window.facAbrirEditarAtribucion = function(idFactura) {
        var u = JSON.parse(localStorage.getItem('usuario')||'{}');
        var isAdmin = Number(u.id_rol)===1 || String(u.rol||'').toLowerCase().indexOf('admin')!==-1;
        if (!isAdmin) { mostrarErrorFac('Solo administrador puede corregir'); return; }
        fetch(API_BASE + '/api/facturas/mesas/' + idFactura).then(function(r){return r.json()}).then(function(d){
            if (!d.success) { mostrarErrorFac(d.mensaje||'No se pudo cargar factura'); return; }
            var f = d.factura;
            // cargar lista usuarios
            Promise.all([
                fetch(API_BASE + '/api/usuarios').then(function(r){return r.json()}),
                fetch(API_BASE + '/api/facturas/mesas/'+idFactura+'/correcciones').then(function(r){return r.json()}).catch(function(){return {correcciones:[]}})
            ]).then(function(res){
                var usuarios = (res[0].usuarios||[]);
                var meseros = usuarios.filter(function(x){ var rr=String(x.rol_nombre||x.rol||'').toLowerCase(); return rr.indexOf('mesero')!==-1||Number(x.id_rol)===3; });
                var cajeros = usuarios; // cualquier activo puede cobrar
                var meseroOpts = '<option value="">-- Sin cambiar --</option>' + meseros.map(function(m){ return '<option value="'+ m.id_usuario +'"'+ (Number(m.id_usuario)===Number(f.id_mesero)?' selected':'') +'>'+ esc(m.nombre) +'</option>'; }).join('');
                var cajeroOpts = '<option value="">-- Sin cambiar --</option>' + cajeros.map(function(m){ return '<option value="'+ m.id_usuario +'">'+ esc(m.nombre) +'</option>'; }).join('');
                var hist = (res[1].correcciones||[]);
                var histHtml = hist.length ? hist.map(function(c){ return '<div style=\"padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:6px;background:#f8fafc;font-size:.78rem\"><div style=\"font-weight:700;color:#0f172a\">'+ esc(c.usuario_corrige_nombre||'--') +' <span style=\"font-weight:400;color:#64748b\">'+ esc(fFecha(c.fecha)) +'</span></div><div>Mesero: '+ esc(c.mesero_anterior_nombre||'NULL') +' → <b>'+ esc(c.mesero_nuevo_nombre||'NULL') +'</b> | Cajero: '+ esc(c.cajero_anterior_nombre||'NULL') +' → <b>'+ esc(c.cajero_nuevo_nombre||'NULL') +'</b></div><div style=\"color:#475569;margin-top:2px\">Motivo: '+ esc(c.motivo) +'</div></div>'; }).join('') : '<div style=\"color:#94a3b8;font-size:.78rem\">Sin correcciones previas</div>';
                var bodyInner = '<div style=\"padding:16px\">' +
                    '<div style=\"background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:10px;margin-bottom:12px;font-size:.82rem\"><div>Factura: <b>'+ esc(f.numero_factura||('F-'+String(f.id_factura).padStart(6,'0'))) +'</b> | Mesa '+ esc(f.mesa_numero||'--') +' | Total '+ fM(f.total) +'</div><div style=\"margin-top:6px\">Actual → Mesero: <b>'+ esc(f.mesero_nombre||'--') +'</b> ('+ esc(f.id_mesero||'NULL') +') | Cajero: <b>'+ esc(f.cajero_nombre||'--') +'</b></div></div>' +
                    '<div style=\"display:grid;grid-template-columns:1fr 1fr;gap:10px\">' +
                    '<div><label style=\"font-size:.70rem;font-weight:700;color:#475569;text-transform:uppercase\">Nuevo Mesero *</label><select id=\"facEditMesero\" class=\"fac-input\" style=\"width:100%\">'+ meseroOpts +'</select><small style=\"font-size:.68rem;color:#64748b\">Dejar vacío para no cambiar</small></div>' +
                    '<div><label style=\"font-size:.70rem;font-weight:700;color:#475569;text-transform:uppercase\">Nuevo Cajero</label><select id=\"facEditCajero\" class=\"fac-input\" style=\"width:100%\">'+ cajeroOpts +'</select></div>' +
                    '</div>' +
                    '<div style=\"margin-top:10px\"><label style=\"font-size:.70rem;font-weight:700;color:#475569;text-transform:uppercase\">Motivo obligatorio *</label><textarea id=\"facEditMotivo\" class=\"fac-input\" rows=\"3\" placeholder=\"Ej: Se digitó mesero incorrecto, la cuenta fue atendida por Juan Esteban\" style=\"width:100%\"></textarea></div>' +
                    '<div style=\"margin-top:14px\"><div style=\"font-size:.72rem;font-weight:700;color:#334155;text-transform:uppercase;margin-bottom:6px\">Historial de correcciones</div>'+ histHtml +'</div>' +
                    '<div style=\"display:flex;gap:8px;justify-content:flex-end;margin-top:16px\"><button class=\"fac-btn fac-btn-ghost\" data-action=\"fac-cerrar-modal\">Cancelar</button><button class=\"fac-btn\" style=\"background:#f59e0b\" onclick=\"facGuardarCorreccion('+ Number(f.id_factura) +')\">Guardar corrección</button></div>' +
                    '</div>';
                mostrarModalFac('Corregir Mesero / Cajero — '+ esc(f.numero_factura||('F-'+String(f.id_factura).padStart(6,'0'))), bodyInner);
            });
        });
    };
    window.facGuardarCorreccion = function(idFactura){
        var mesEl = document.getElementById('facEditMesero');
        var cajEl = document.getElementById('facEditCajero');
        var motEl = document.getElementById('facEditMotivo');
        var motivo = motEl ? String(motEl.value||'').trim() : '';
        if (!motivo || motivo.length < 5) { mostrarErrorFac('Motivo obligatorio (mín 5 caracteres)'); return; }
        var body = { motivo: motivo };
        if (mesEl && mesEl.value) body.id_mesero = Number(mesEl.value);
        if (cajEl && cajEl.value) body.id_cajero = Number(cajEl.value);
        if (!body.id_mesero && !body.id_cajero) { mostrarErrorFac('Seleccione al menos nuevo mesero o cajero'); return; }
        fetch(API_BASE + '/api/facturas/mesas/' + idFactura + '/atribucion', { method: 'PUT', headers: { 'Content-Type':'application/json' }, credentials:'include', body: JSON.stringify(body) })
            .then(function(r){ return r.json().then(function(d){ return {ok:r.ok,d:d}; }); })
            .then(function(w){
                if (w.ok && w.d.success) {
                    facCerrarModal();
                    mostrarErrorFac(w.d.mensaje||'Corregido');
                    // recargar listado y detalle
                    if (typeof cargarFacturasMesas==='function') { /* refrescar */ window.facVerDetalleMesa(idFactura); }
                    // reload tabla
                    setTimeout(function(){ if(typeof window.iniciarFacturacion==='function') window.iniciarFacturacion(); }, 400);
                } else mostrarErrorFac(w.d.mensaje||'Error');
            }).catch(function(){ mostrarErrorFac('Error de conexión'); });
    };
    // Auto-cargar historial al abrir detalle
    var _origMostrarModalDetalleMesa = window.facVerDetalleMesa;
    // hook despues de renderizar modal: cargar correcciones en el placeholder
    var _origMostrarModalFac = mostrarModalFac;
    mostrarModalFac = function(titulo, contenidoHtml){
        _origMostrarModalFac(titulo, contenidoHtml);
        // si es detalle factura, cargar correcciones
        setTimeout(function(){
            var m = titulo.match(/F-\d+/) || titulo.match(/Detalle Factura/);
            if (m) {
                // buscar id en DOM
                var btn = document.querySelector('[data-action="fac-editar-atrib"]');
                var id = btn ? btn.getAttribute('data-id') : null;
                // alternativa: buscar placeholder
                var ph = document.querySelector('[id^="facCorreccionesHist-"]');
                if (ph) {
                    var idHist = ph.id.replace('facCorreccionesHist-','');
                    fetch(API_BASE + '/api/facturas/mesas/' + idHist + '/correcciones').then(function(r){return r.json()}).then(function(d){
                        if (!d.success) { ph.innerHTML=''; return; }
                        if (!d.correcciones.length) { ph.innerHTML='<div style=\"font-size:.72rem;color:#94a3b8;padding:8px;background:#f8fafc;border-radius:8px\"><i class=\"bi bi-check-circle\"></i> Sin correcciones previas — auditoría vacía</div>'; return; }
                        ph.innerHTML = '<div style=\"font-size:.72rem;font-weight:700;color:#334155;margin-bottom:6px\">Historial auditoría ('+ d.correcciones.length +')</div>' + d.correcciones.map(function(c){ return '<div style=\"padding:6px 8px;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:4px;background:#f8fafc;font-size:.72rem\"><b>'+ esc(c.usuario_corrige_nombre||'--') +'</b> <span style=\"color:#64748b\">'+ esc(fFecha(c.fecha)) +'</span><br>Mesero '+ esc(c.mesero_anterior_nombre||'NULL') +' → '+ esc(c.mesero_nuevo_nombre||'NULL') +' | Cajero '+ esc(c.cajero_anterior_nombre||'NULL') +' → '+ esc(c.cajero_nuevo_nombre||'NULL') +'<br><span style=\"color:#475569\">Motivo: '+ esc(c.motivo) +'</span></div>'; }).join('');
                    }).catch(function(){ ph.innerHTML=''; });
                }
            }
        }, 120);
    };

    if (typeof delegateAction !== 'undefined') delegateAction(document, { 'fac-refresh': function() { window.iniciarFacturacion(); }, 'fac-tab': function(el) { window.cambiarTabFact(String(el.getAttribute('data-tab'))); }, 'fac-limpiar': function() { window.facLimpiarFiltros(); }, 'fac-ver-mesa': function(el) { window.facVerDetalleMesa(Number(el.getAttribute('data-id'))); }, 'fac-imprimir-mesa': function(el) { window.facImprimirMesa(Number(el.getAttribute('data-id'))); }, 'fac-descargar-mesa': function(el) { window.facDescargarMesa(Number(el.getAttribute('data-id'))); }, 'fac-ver-compra': function(el) { window.facVerDetalleCompra(Number(el.getAttribute('data-id'))); }, 'fac-ver-vale': function(el) { window.facVerDetalleVale(Number(el.getAttribute('data-id'))); }, 'fac-cerrar-modal': function() { window.facCerrarModal(); }, 'fac-editar-atrib': function(el){ window.facAbrirEditarAtribucion(Number(el.getAttribute('data-id'))); } });
    if (typeof document !== 'undefined') {
        document.addEventListener('change', function(e) {
            var el = e.target && e.target.closest ? e.target.closest('[data-change]') : null;
            if (!el || !document.contains(el)) return;
            var a = el.getAttribute('data-change');
            if (a === 'fac-filtro-estado') { FACT.filtroEstado = el.value; cargarDatosTab(); }
            else if (a === 'fac-fecha') { window.facOnFechaChange(); }
        });
        document.addEventListener('input', function(e) {
            var el = e.target && e.target.closest ? e.target.closest('[data-input]') : null;
            if (!el || !document.contains(el)) return;
            if (el.getAttribute('data-input') === 'fac-busqueda') { FACT.busqueda = el.value; cargarDatosTab(); }
        });
    }
})();
