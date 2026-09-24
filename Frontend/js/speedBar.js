// =========================================================
// CONTROLADOR: SPEED BAR - RENDIMIENTO DE BARRA
// =========================================================

function iniciarSpeedBar() {
    if(typeof verificarAcceso==='function'&&!verificarAcceso('gestionar_inventario')){if(typeof verificarAccesoRB==='function'&&!verificarAccesoRB('gestionar_inventario'))return;return;}
    if(typeof verificarAccesoRB==='function'&&!verificarAccesoRB('gestionar_inventario'))return;
    activarNav('navSpeedBar');
    var contenedor = document.getElementById('main-content');
    contenedor.innerHTML = '<div class="page-header">' +
        '<h2><i class="bi bi-lightning"></i>Speed Bar - Rendimiento</h2>' +
        '<button class="btn-refresh" onclick="iniciarSpeedBar()"><i class="bi bi-arrow-clockwise"></i> Actualizar</button>' +
        '</div>' +
        '<div id="contenedorAlertas"></div>' +

        '<div class="row g-4 mb-4">' +
        '<div class="col-md-3">' +
        '<div class="kpi-card" style="border-left:4px solid #3b82f6">' +
        '<div class="kpi-top"><div class="kpi-label">Promedio General</div><div class="kpi-icon" style="background:#eff6ff;color:#3b82f6"><i class="bi bi-stopwatch"></i></div></div>' +
        '<div class="kpi-value" id="kpiPromedioGeneral">-</div>' +
        '<div class="kpi-sub">minutos promedio de despacho</div>' +
        '</div></div>' +
        '<div class="col-md-3">' +
        '<div class="kpi-card" style="border-left:4px solid #10b981">' +
        '<div class="kpi-top"><div class="kpi-label">Despachos Hoy</div><div class="kpi-icon" style="background:#ecfdf5;color:#10b981"><i class="bi bi-check-circle"></i></div></div>' +
        '<div class="kpi-value" id="kpiDespachosHoy">0</div>' +
        '<div class="kpi-sub">pedidos completados</div>' +
        '</div></div>' +
        '<div class="col-md-3">' +
        '<div class="kpi-card" style="border-left:4px solid #ef4444">' +
        '<div class="kpi-top"><div class="kpi-label">Alertas (+8 min)</div><div class="kpi-icon" style="background:#fef2f2;color:#ef4444"><i class="bi bi-exclamation-diamond"></i></div></div>' +
        '<div class="kpi-value" id="kpiAlertas">0</div>' +
        '<div class="kpi-sub">comandas tardias</div>' +
        '</div></div>' +
        '<div class="col-md-3">' +
        '<div class="kpi-card" style="border-left:4px solid #f59e0b">' +
        '<div class="kpi-top"><div class="kpi-label">Mejor Bartender</div><div class="kpi-icon" style="background:#fffbeb;color:#f59e0b"><i class="bi bi-trophy"></i></div></div>' +
        '<div class="kpi-value" id="kpiMejorBartender" style="font-size:1rem">-</div>' +
        '<div class="kpi-sub">menor tiempo promedio</div>' +
        '</div></div>' +
        '</div>' +

        '<div class="row g-4 mb-4">' +
        '<div class="col-md-7">' +
        '<div class="card" style="border:1px solid #e2e8f0;border-radius:14px;overflow:hidden">' +
        '<div style="padding:16px 20px;background:#0f172a;color:#f8fafc;font-weight:700;font-size:0.9rem;display:flex;align-items:center;gap:8px"><i class="bi bi-person-badge"></i> Rendimiento por Bartender</div>' +
        '<div class="card-body p-0" style="background:#fff"><div id="contenedorBartenders" class="text-center py-4"><div class="spinner-border text-primary"></div></div></div>' +
        '</div></div>' +
        '<div class="col-md-5">' +
        '<div class="card" style="border:1px solid #e2e8f0;border-radius:14px;overflow:hidden">' +
        '<div style="padding:16px 20px;background:#0f172a;color:#f8fafc;font-weight:700;font-size:0.9rem;display:flex;align-items:center;gap:8px"><i class="bi bi-bell-fill"></i> Alertas de Tiempo</div>' +
        '<div class="card-body p-0" style="background:#fff"><div id="contenedorAlertasTiempo" class="text-center py-4"><div class="spinner-border text-primary"></div></div></div>' +
        '</div></div>' +
        '</div>' +

        '<div class="card" style="border:1px solid #e2e8f0;border-radius:14px;overflow:hidden">' +
        '<div style="padding:16px 20px;background:#0f172a;color:#f8fafc;font-weight:700;font-size:0.9rem;display:flex;align-items:center;gap:8px"><i class="bi bi-clock-history"></i> Historial de Despachos - Hoy</div>' +
        '<div class="card-body p-0" style="background:#fff"><div id="contenedorHistorialDespachos" class="text-center py-4"><div class="spinner-border text-primary"></div></div></div>' +
        '</div>';

    cargarTiemposBarra();
}

function cargarTiemposBarra() {
    fetch(API_BASE + '/api/reportes/tiempos-barra')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success) {
                document.getElementById('kpiPromedioGeneral').textContent = data.promedio_general + ' min';
                document.getElementById('kpiDespachosHoy').textContent = data.total_despachos;
                document.getElementById('kpiAlertas').textContent = data.alertas.length;

                var mejor = data.promedio_bartender.length > 0
                    ? data.promedio_bartender.reduce(function(a, b) { return a.promedio < b.promedio ? a : b; })
                    : null;
                document.getElementById('kpiMejorBartender').textContent = mejor ? mejor.nombre + ' (' + mejor.promedio + ' min)' : '-';

                renderizarBartenders(data.promedio_bartender);
                renderizarAlertasTiempo(data.alertas);
                renderizarHistorialDespachos(data.registros);
            } else {
                mostrarAlerta('danger', data.mensaje || 'Error al cargar datos');
            }
        })
        .catch(function() {
            mostrarAlerta('danger', 'No se pudo conectar con el servidor');
        });
}

function renderizarBartenders(bartenders) {
    var cont = document.getElementById('contenedorBartenders');
    if (!bartenders || bartenders.length === 0) {
        cont.innerHTML = '<div style="padding:24px;color:#94a3b8;text-align:center"><i class="bi bi-person-x" style="font-size:2rem;display:block;margin-bottom:8px"></i>No hay datos de bartender disponibles.</div>';
        return;
    }

    var sorted = bartenders.sort(function(a, b) { return a.promedio - b.promedio; });
    var maxPromedio = sorted[0].promedio;

    var html = '<div style="padding:16px">';
    sorted.forEach(function(b, i) {
        var pct = maxPromedio > 0 ? Math.round((b.promedio / maxPromedio) * 100) : 0;
        var color = b.promedio <= 5 ? '#10b981' : b.promedio <= 8 ? '#f59e0b' : '#ef4444';
        var gradColor = b.promedio <= 5 ? '#34d399' : b.promedio <= 8 ? '#fbbf24' : '#f87171';
        var medal = '';
        if (i === 0) medal = '<i class="bi bi-trophy-fill" style="color:#f59e0b;font-size:1.1rem"></i>';
        else if (i === 1) medal = '<i class="bi bi-award-fill" style="color:#94a3b8;font-size:1rem"></i>';

        html += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">' +
            '<div style="flex-shrink:0;width:28px;text-align:center">' + medal + '</div>' +
            '<div style="flex:1">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">' +
            '<span style="font-weight:700;color:#0f172a;font-size:0.9rem">' + escapeHTML(b.nombre) + '</span>' +
            '<div style="display:flex;align-items:center;gap:8px">' +
            '<span style="font-weight:700;color:' + color + ';font-size:0.9rem">' + b.promedio + ' min</span>' +
            '<span style="font-size:0.72rem;color:#94a3b8;background:#f1f5f9;padding:2px 8px;border-radius:6px">' + b.total_despachos + ' pedidos</span>' +
            '</div></div>' +
            '<div style="height:10px;background:#f1f5f9;border-radius:5px;overflow:hidden">' +
            '<div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,' + color + ',' + gradColor + ');border-radius:5px;transition:width 0.6s ease"></div></div>' +
            '</div></div>';
    });
    html += '</div>';
    cont.innerHTML = html;
}

function renderizarAlertasTiempo(alertas) {
    var cont = document.getElementById('contenedorAlertasTiempo');
    if (!alertas || alertas.length === 0) {
        cont.innerHTML = '<div style="padding:24px;color:#94a3b8;text-align:center"><i class="bi bi-shield-check" style="font-size:2rem;display:block;margin-bottom:8px;color:#10b981"></i>Sin alertas. Todos los tiempos dentro del limite.</div>';
        return;
    }

    var html = '<div style="padding:12px">';
    alertas.forEach(function(a) {
        var fecha = a.timestamp_pedido ? new Date(a.timestamp_pedido).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '-';
        html += '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;background:#fef2f2;border:1px solid #fecaca;margin-bottom:8px">' +
            '<div style="width:36px;height:36px;border-radius:10px;background:#fee2e2;display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
            '<i class="bi bi-exclamation-triangle" style="color:#ef4444"></i></div>' +
            '<div style="flex:1">' +
            '<div style="display:flex;justify-content:space-between;align-items:center">' +
            '<span style="font-weight:700;color:#0f172a;font-size:0.85rem">Mesa ' + (a.mesa_numero || '?') + '</span>' +
            '<span style="font-weight:800;color:#ef4444;font-size:0.9rem">' + a.tiempo_minutos + ' min</span>' +
            '</div>' +
            '<div style="font-size:0.72rem;color:#94a3b8;margin-top:2px">Pedido #' + a.id_pedido + ' - ' + fecha + (a.bartender ? ' - ' + a.bartender : '') + '</div>' +
            '</div></div>';
    });
    html += '</div>';
    cont.innerHTML = html;
}

function renderizarHistorialDespachos(registros) {
    var cont = document.getElementById('contenedorHistorialDespachos');
    if (!registros || registros.length === 0) {
        cont.innerHTML = '<div style="padding:24px;color:#94a3b8;text-align:center"><i class="bi bi-inbox" style="font-size:2rem;display:block;margin-bottom:8px"></i>No hay despachos registrados hoy.</div>';
        return;
    }

    var tabla = '<div class="table-responsive"><table class="table table-hover mb-0 align-middle" style="margin:0">' +
        '<thead style="background:#f8fafc"><tr>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem">Pedido</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem">Mesa</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem">Bartender</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem;text-align:center">Tiempo</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem">Estado</th></tr></thead><tbody>';

    registros.forEach(function(r) {
        var tiempo = r.tiempo_minutos !== null ? r.tiempo_minutos : '-';
        var tiempoColor = '#94a3b8';
        var tiempoBg = '#f1f5f9';
        if (r.tiempo_minutos !== null) {
            if (Number(r.tiempo_minutos) <= 5) { tiempoColor = '#15803d'; tiempoBg = '#dcfce7'; }
            else if (Number(r.tiempo_minutos) <= 8) { tiempoColor = '#92400e'; tiempoBg = '#fef3c7'; }
            else { tiempoColor = '#b91c1c'; tiempoBg = '#fee2e2'; }
        }
        var estadoBadge = r.estado === 'Pagado'
            ? '<span style="background:#dcfce7;color:#15803d;padding:3px 10px;border-radius:8px;font-size:0.75rem;font-weight:600">Despachado</span>'
            : '<span style="background:#fef3c7;color:#92400e;padding:3px 10px;border-radius:8px;font-size:0.75rem;font-weight:600">Pendiente</span>';

        var horaPedido = r.timestamp_pedido ? new Date(r.timestamp_pedido).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '-';

        tabla += '<tr style="border-color:#f1f5f9">' +
            '<td style="border-color:#f1f5f9;color:#0f172a;font-weight:700">#' + r.id_pedido + ' <span style="color:#94a3b8;font-weight:400;font-size:0.78rem">' + horaPedido + '</span></td>' +
            '<td style="border-color:#f1f5f9;color:#334155;font-weight:600">' + (r.mesa_numero || '-') + '</td>' +
            '<td style="border-color:#f1f5f9;color:#64748b">' + (r.bartender || 'Sin asignar') + '</td>' +
            '<td style="border-color:#f1f5f9;text-align:center"><span style="background:' + tiempoBg + ';color:' + tiempoColor + ';padding:3px 10px;border-radius:8px;font-size:0.8rem;font-weight:700">' + tiempo + ' min</span></td>' +
            '<td style="border-color:#f1f5f9">' + estadoBadge + '</td></tr>';
    });

    tabla += '</tbody></table></div>';
    cont.innerHTML = tabla;
}
