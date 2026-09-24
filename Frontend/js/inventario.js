// =========================================================
// CONTROLADOR: INVENTARIO / GESTION DE PRODUCTOS
// =========================================================

var inventarioProductos = [];
var inventarioModal = null;
var productoEditandoId = null;
var imagenProductoBase64 = '';

// Categorias de licores disponibles para los productos
var CATEGORIAS_LICORES = [
    'Whisky', 'Ron', 'Aguardiente', 'Vodka', 'Tequila', 'Ginebra',
    'Vino', 'Champaña', 'Licores cremosos', 'Licores de frutas', 'Aperitivos',
    'Cervezas', 'Cócteles', 'Bebidas energizantes'
];

function iniciarInventario() {
    if(typeof verificarAcceso==='function'&&!verificarAcceso('gestionar_inventario')){if(typeof verificarAccesoRB==='function'&&!verificarAccesoRB('gestionar_inventario'))return;return;}
    if(typeof verificarAccesoRB==='function'&&!verificarAccesoRB('gestionar_inventario'))return;
    if (typeof activarNav === 'function') activarNav('navInventario');
    var contenedor = document.getElementById('main-content');
    contenedor.innerHTML =
        '<div class="page-header">' +
        '<h2><i class="bi bi-box-seam"></i>Inventario / Productos</h2>' +
        '<div class="page-header-right">' +
        '<button class="btn-inv-refresh" onclick="iniciarInventario()" title="Actualizar"><i class="bi bi-arrow-clockwise"></i> Actualizar</button>' +
        '<button class="btn-inv-nuevo" onclick="abrirModalProducto()"><i class="bi bi-plus-lg"></i> Nuevo Producto</button>' +
        '</div>' +
        '</div>' +
        '<div id="contenedorAlertas"></div>' +
        '<div class="inv-toolbar">' +
        '<div class="inv-search">' +
        '<i class="bi bi-search"></i>' +
        '<input type="text" id="invBuscador" placeholder="Buscar producto por nombre o categoria..." oninput="renderizarInventario()">' +
        '</div>' +
        '<div class="inv-filter-wrap">' +
        '<label class="inv-filter-label"><i class="bi bi-funnel"></i></label>' +
        '<select id="invFiltroCategoria" class="inv-select" onchange="renderizarInventario()"><option value="">Todas las categorias</option></select>' +
        '</div>' +
        '<button type="button" id="btnFiltroAgotados" class="inv-btn-agotados" onclick="toggleFiltroAgotados()" title="Mostrar solo productos agotados (stock = 0)" style="display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:9px;border:1px solid #e2e8f0;background:#fff;color:#64748b;font-weight:600;font-size:0.8rem;cursor:pointer;transition:all .15s"><i class="bi bi-exclamation-triangle"></i> Agotados</button>' +
        '<div class="inv-filter-wrap">' +
        '<label class="inv-filter-label"><i class="bi bi-eye"></i></label>' +
        '<select id="invFiltroEstado" class="inv-select" onchange="cargarProductosInventario()"><option value="activos">Activos</option><option value="inactivos">Inactivos</option><option value="todos">Todos</option></select>' +
        '</div>' +
        '</div>' +
        '<div class="inv-table-card">' +
        '<div id="contenedorTablaInventario" class="inv-loading"><div class="spinner-border text-primary" role="status"></div></div>' +
        '</div>';

    cargarCategoriasInventario();
    cargarProductosInventario();
}

// ---------------------------------------------------------
// CATEGORIAS (para el dropdown de filtro y del formulario)
// ---------------------------------------------------------
var filtroSoloAgotados = false;
function toggleFiltroAgotados() {
    filtroSoloAgotados = !filtroSoloAgotados;
    var btn = document.getElementById('btnFiltroAgotados');
    if (btn) {
        if (filtroSoloAgotados) {
            btn.style.background = '#fef2f2';
            btn.style.color = '#dc2626';
            btn.style.borderColor = '#fecaca';
        } else {
            btn.style.background = '#fff';
            btn.style.color = '#64748b';
            btn.style.borderColor = '#e2e8f0';
        }
    }
    renderizarInventario();
}
function cargarCategoriasInventario() {
    var unicas = ['General'].concat(CATEGORIAS_LICORES).slice();
    inventarioProductos.forEach(function(p) {
        var cat = (p.categoria || 'General').trim();
        if (cat && unicas.indexOf(cat) === -1) unicas.push(cat);
    });
    unicas.sort();

    var select = document.getElementById('invFiltroCategoria');
    if (select) {
        var previo = select.value;
        var html = '<option value="">Todas las categorias</option>';
        unicas.forEach(function(c) {
            var sel = (c === previo) ? ' selected' : '';
            html += '<option value="' + c.replace(/"/g, '&quot;') + '"' + sel + '>' + c + '</option>';
        });
        html += '<option value="__AGOTADOS__"' + (previo === '__AGOTADOS__' ? ' selected' : '') + '>Agotados</option>';
        select.innerHTML = html;
    }
}

// ---------------------------------------------------------
// CARGA DE PRODUCTOS
// ---------------------------------------------------------
function cargarProductosInventario() {
    var cont = document.getElementById('contenedorTablaInventario');
    if (cont) cont.innerHTML = '<div class="spinner-border text-primary" role="status"></div>';
    var estado = document.getElementById('invFiltroEstado') ? document.getElementById('invFiltroEstado').value : 'activos';
    fetch(API_BASE + '/api/productos/admin?estado=' + estado)
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success) {
                inventarioProductos = data.productos || [];
                cargarCategoriasInventario();
                renderizarInventario();
            } else {
                cont.innerHTML = '<div class="inv-error"><i class="bi bi-exclamation-triangle me-1"></i> ' + escapeHTML(data.mensaje || 'Error al cargar productos') + '</div>';
            }
        })
        .catch(function() {
            cont.innerHTML = '<div class="inv-error"><i class="bi bi-wifi-off me-1"></i> No se pudo conectar con el servidor</div>';
        });
}

// ---------------------------------------------------------
// RENDER TABLA PROFESIONAL
// ---------------------------------------------------------
function renderizarInventario() {
    var cont = document.getElementById('contenedorTablaInventario');
    if (!cont) return;

    var busqueda = (document.getElementById('invBuscador') ? document.getElementById('invBuscador').value : '').toLowerCase().trim();
    var catFiltro = document.getElementById('invFiltroCategoria') ? document.getElementById('invFiltroCategoria').value : '';

    var esFiltroAgotados = catFiltro === '__AGOTADOS__' || catFiltro === 'Agotados' || filtroSoloAgotados;
    var filtrados = (inventarioProductos || []).filter(function(p) {
        var coincideTexto = !busqueda ||
            (p.nombre || '').toLowerCase().indexOf(busqueda) !== -1 ||
            (p.categoria || '').toLowerCase().indexOf(busqueda) !== -1;
        var coincideCat;
        if (catFiltro === '__AGOTADOS__' || catFiltro === 'Agotados') {
            coincideCat = (Number(p.stock) || 0) <= 0;
        } else {
            coincideCat = !catFiltro || (p.categoria || '').toLowerCase() === catFiltro.toLowerCase();
        }
        var coincideAgotados = !filtroSoloAgotados || (Number(p.stock) || 0) <= 0;
        // Si se eligió "Agotados" del select, el filtro ya cubre stock; el toggle combinado permite filtrar categoría + stock
        if (catFiltro === '__AGOTADOS__' || catFiltro === 'Agotados') coincideAgotados = true;
        // Cuando el toggle está activo y además hay categoría seleccionada, combinar ambos filtros
        if (filtroSoloAgotados && catFiltro && catFiltro !== '__AGOTADOS__' && catFiltro !== 'Agotados') {
            coincideCat = (p.categoria || '').toLowerCase() === catFiltro.toLowerCase();
        }
        return coincideTexto && coincideCat && coincideAgotados;
    });

    if (filtrados.length === 0) {
        cont.innerHTML = '<div class="inv-empty"><i class="bi bi-inbox"></i><p>No hay productos ' + (busqueda || catFiltro ? 'que coincidan con la busqueda.' : 'registrados.') + '</p><p class="sub">Pulsa + Nuevo Producto para agregar el primero.</p></div>';
        return;
    }

    var filas = '';
    filtrados.forEach(function(p) {
        var nombre = escapeHTML(p.nombre || '');
        var categoria = escapeHTML(p.categoria || 'General');
        var stock = Number(p.stock) || 0;
        var stockMin = Number(p.stock_minimo) || 5;

        // Badge de stock
        var stockBadge = '';
        if (stock <= 0) {
            stockBadge = '<span class="stock-badge stock-agotado">Agotado' + (stock < 0 ? ' (' + stock + ')' : '') + '</span>';
        } else if (stock <= stockMin) {
            stockBadge = '<span class="stock-badge stock-bajo"><span class="pulse-dot"></span> Bajo (' + stock + ')</span>';
        } else {
            stockBadge = '<span class="stock-badge stock-ok">' + stock + '</span>';
        }

        // Miniatura
        var thumb = '<div class="inv-thumb"><i class="bi bi-box-seam"></i></div>';
        if (p.imagen && (/^data:image\//.test(p.imagen) || /^https?:\/\//.test(p.imagen))) {
            thumb = '<img class="inv-thumb-img" src="' + p.imagen.replace(/"/g, '') + '" alt="' + nombre + '">';
        }

        var esInactivo = Number(p.activo) === 0;
        var badgeEstado = esInactivo ? '<span class="stock-badge" style="background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0">Inactivo</span>' : '';
        var acciones = esInactivo
            ? '<button class="inv-btn-icon" title="Reactivar" style="background:#f0fdf4;color:#16a34a" onclick="reactivarProducto(' + p.id_producto + ')"><i class="bi bi-arrow-counterclockwise"></i></button>'
            : '<button class="inv-btn-icon" title="Ver ficha (proveedores / devoluciones)" style="background:#eff6ff;color:#2563eb" onclick="verFichaProducto(' + p.id_producto + ')"><i class="bi bi-eye"></i></button>'
              + '<button class="inv-btn-icon inv-btn-edit" title="Editar" onclick="abrirModalProducto(' + p.id_producto + ')"><i class="bi bi-pencil"></i></button>'
              + '<button class="inv-btn-icon inv-btn-del" title="Desactivar" onclick="eliminarProducto(' + p.id_producto + ')"><i class="bi bi-archive"></i></button>';
        var costoCpp = Number(p.precio_costo != null ? p.precio_costo : p.costo) || 0;
        var valorTotal = Math.max(0, stock) * costoCpp;
        filas += '<tr style="' + (esInactivo ? 'opacity:0.6;background:#f8fafc' : '') + '">' +
            '<td>' + thumb + '</td>' +
            '<td><div class="inv-nombre">' + escapeHTML(p.nombre || '') + '</div>' + badgeEstado + '</td>' +
            '<td><span class="inv-cat">' + categoria + '</span></td>' +
            '<td><span class="inv-precio">$' + Number(p.precio || 0).toLocaleString() + '</span></td>' +
            '<td><span class="inv-precio">$' + costoCpp.toLocaleString() + '</span></td>' +
            '<td>' + stockBadge + '</td>' +
            '<td><span class="inv-precio">$' + valorTotal.toLocaleString() + '</span></td>' +
            '<td><div class="inv-acciones">' + acciones + '</div></td>' +
            '</tr>';
    });

    cont.innerHTML =
        '<div class="table-responsive"><table class="inv-table">' +
        '<thead><tr>' +
        '<th>Producto</th>' +
        '<th>Nombre</th>' +
        '<th>Categoria</th>' +
        '<th>Precio</th>' +
        '<th>Costo (CPP)</th>' +
        '<th>Stock Actual</th>' +
        '<th>Valor Total</th>' +
        '<th class="text-center">Acciones</th>' +
        '</tr></thead><tbody>' + filas + '</tbody></table></div>' +
        '<div class="inv-count">' + filtrados.length + ' producto(s)</div>';
}

// ---------------------------------------------------------
// MODAL DE CREACION / EDICION DE PRODUCTO
// ---------------------------------------------------------
function abrirModalProducto(idProducto) {
    if (!document.getElementById('modalProducto')) {
        inyectarModalProducto();
    }
    resetModalProducto();
    cargarCategoriasEnSelect();

    if (idProducto) {
        // Modo edicion
        productoEditandoId = idProducto;
        document.getElementById('invModalTitulo').innerHTML = '<i class="bi bi-pencil-square"></i> Editar Producto';
        document.getElementById('btnGuardarProducto').innerHTML = '<i class="bi bi-check-lg"></i> Guardar Cambios';
        cargarProductoParaEdicion(idProducto);
    } else {
        // Modo creacion
        productoEditandoId = null;
        document.getElementById('invModalTitulo').innerHTML = '<i class="bi bi-plus-circle"></i> Crear Nuevo Producto';
        document.getElementById('btnGuardarProducto').innerHTML = '<i class="bi bi-check-lg"></i> Guardar Producto';
    }

    var modal = document.getElementById('modalProducto');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function cerrarModalProducto() {
    var modal = document.getElementById('modalProducto');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
    productoEditandoId = null;
}

function resetModalProducto() {
    var form = document.getElementById('formModalProducto');
    if (form) form.reset();
    document.getElementById('inputCategoriaModal').value = 'General';
    document.getElementById('inputStockMinModal').value = '5';
    imagenProductoBase64 = '';
    setVistaPrevia('');
    var drop = document.getElementById('zonaDropImagen');
    if (drop) drop.classList.remove('dragover');
}

function cargarProductoParaEdicion(idProducto) {
    var target = document.getElementById('inputNombreModal');
    if (target) target.disabled = true;
    fetch(API_BASE + '/api/productos/' + idProducto)
        .then(function(r) { return r.json(); })
        .then(function(data) {
            var target2 = document.getElementById('inputNombreModal');
            if (target2) target2.disabled = false;
            if (data.success) {
                var p = data.producto;
                document.getElementById('inputNombreModal').value = p.nombre || '';
                document.getElementById('inputCategoriaModal').value = p.categoria || 'General';
                document.getElementById('inputCodigoBarrasModal').value = p.codigo_barras || '';
                document.getElementById('inputPrecioVentaModal').value = p.precio || '';
                document.getElementById('inputPrecioCostoModal').value = p.precio_costo || '';
                document.getElementById('inputStockMinModal').value = p.stock_minimo || 5;
                document.getElementById('inputConversionModal').value = (p.factor_conversion && Number(p.factor_conversion) > 1) ? p.factor_conversion : '';
                document.getElementById('inputDescripcionModal').value = p.descripcion || '';
                imagenProductoBase64 = p.imagen || '';
                setVistaPrevia(imagenProductoBase64);
                cargarCategoriasEnSelect();
            } else {
                if (target2) target2.disabled = false;
                mostrarAlerta('danger', data.mensaje || 'Error al cargar el producto');
                cerrarModalProducto();
            }
        })
        .catch(function() {
            var target2 = document.getElementById('inputNombreModal');
            if (target2) target2.disabled = false;
            mostrarAlerta('danger', 'No se pudo conectar con el servidor');
            cerrarModalProducto();
        });
}

// Llena el select de categoria con las categorias de licores fijas
// + las categorias ya usadas en inventario, conservando el valor actual.
function cargarCategoriasEnSelect() {
    var select = document.getElementById('inputCategoriaModal');
    if (!select) return;
    var actual = select.value || '';
    var opciones = ['General'].concat(CATEGORIAS_LICORES);
    inventarioProductos.forEach(function(p) {
        var c = (p.categoria || '').trim();
        if (c && opciones.indexOf(c) === -1) opciones.push(c);
    });
    if (actual && opciones.indexOf(actual) === -1) opciones.unshift(actual);
    var html = '';
    opciones.forEach(function(c) {
        var val = c.replace(/"/g, '&quot;');
        var sel = (c === actual) ? ' selected' : '';
        html += '<option value="' + val + '"' + sel + '>' + c + '</option>';
    });
    select.innerHTML = html;
    if (!actual) select.value = 'General';
}

function inyectarModalProducto() {
    if (document.getElementById('modalProducto')) return;

    var cont = document.createElement('div');
    cont.id = 'contenedorModalProducto';
    cont.innerHTML =
        '<div id="modalProducto" class="inv-modal-overlay" style="display:none">' +
        '<div class="inv-modal-dialog">' +
        '<div class="inv-modal-content">' +
        '<div class="inv-modal-header">' +
        '<h5 class="inv-modal-title" id="invModalTitulo"><i class="bi bi-plus-circle"></i> Crear Nuevo Producto</h5>' +
        '<button type="button" class="inv-modal-close" onclick="cerrarModalProducto()" aria-label="Cerrar"><i class="bi bi-x-lg"></i></button>' +
        '</div>' +
        '<div class="inv-modal-body">' +
        '<form id="formModalProducto">' +
        '<div class="inv-form-grid">' +

        // Zona de imagen
        '<div class="inv-imagen-col">' +
        '<label class="inv-field-label">Imagen del producto</label>' +
        '<div class="inv-drop-zone" id="zonaDropImagen" onclick="document.getElementById(\'inputImagenModal\').click()">' +
        '<input type="file" id="inputImagenModal" accept="image/*" style="display:none" onchange="procesarArchivoImagen(this)">' +
        '<div class="inv-drop-inner" id="imagenPlaceholder">' +
        '<i class="bi bi-image"></i>' +
        '<p><strong>Arrastra tu imagen aqui</strong><br><span>o haz clic para seleccionar</span></p>' +
        '<small>JPG, PNG o WebP</small>' +
        '</div>' +
        '<img id="vistaPreviaImagen" alt="Vista previa" style="display:none">' +
        '<button type="button" class="inv-btn-remove-img" id="btnQuitarImagen" onclick="quitarImagen(event)" style="display:none"><i class="bi bi-x-lg"></i></button>' +
        '</div>' +
        '</div>' +

        // Formulario
        '<div class="inv-campos-col">' +
        '<div class="inv-field"><label class="inv-field-label" for="inputNombreModal">Nombre del producto *</label>' +
        '<input type="text" id="inputNombreModal" class="inv-input" placeholder="Ej: Botella de Vodka" required></div>' +

        '<div class="inv-field"><label class="inv-field-label" for="inputCategoriaModal">Categoria</label>' +
        '<select id="inputCategoriaModal" class="inv-select" onfocus="cargarCategoriasEnSelect()"></select></div>' +

        '<div class="inv-field"><label class="inv-field-label" for="inputCodigoBarrasModal">Codigo de Barras (opcional)</label>' +
        '<input type="text" id="inputCodigoBarrasModal" class="inv-input" placeholder="Codigo o EAN para escaner / busqueda rapida"></div>' +

        '<div class="row g-2">' +
        '<div class="col-6"><div class="inv-field"><label class="inv-field-label" for="inputPrecioVentaModal">Precio Venta ($) *</label>' +
        '<div class="inv-input-affix"><span>$</span><input type="number" id="inputPrecioVentaModal" class="inv-input" min="0" step="100" placeholder="0" required></div></div></div>' +
        '<div class="col-6"><div class="inv-field"><label class="inv-field-label" for="inputPrecioCostoModal">Precio Costo ($) <span style="font-weight:400;color:#64748b;font-size:0.7rem">(automático)</span></label>' +
        '<div class="inv-input-affix"><span>$</span><input type="number" id="inputPrecioCostoModal" class="inv-input" min="0" step="100" placeholder="0" readonly disabled title="El costo promedio se actualiza automáticamente al registrar facturas en el módulo de Compras" style="background:#f1f5f9;cursor:not-allowed;opacity:0.7"></div><small style="color:#0ea5e9;font-size:0.72rem;display:block;margin-top:4px"><i class="bi bi-info-circle me-1"></i>ℹ️ El costo promedio se actualiza automáticamente al registrar facturas en el módulo de Compras.</small></div></div>' +
        '</div>' +

        '<div class="inv-field"><label class="inv-field-label" for="inputStockMinModal">Stock Minimo (alerta) *</label>' +
        '<input type="number" id="inputStockMinModal" class="inv-input" min="0" value="5" required></div>' +
        '<small style="color:#64748b;font-size:0.75rem;display:block;margin-top:4px"><i class="bi bi-info-circle me-1"></i>El stock de este producto se incrementara automaticamente al registrar una compra en el modulo de Compras. Stock inicial: 0.</small>' +

        '<div class="inv-field"><label class="inv-field-label" for="inputConversionModal">Conversion Botella / Tragos (opcional)</label>' +
        '<input type="number" id="inputConversionModal" class="inv-input" min="0" step="0.5" placeholder="Ej: 16 tragos"></div>' +

        '<div class="inv-field"><label class="inv-field-label" for="inputDescripcionModal">Descripcion / Detalles (opcional)</label>' +
        '<textarea id="inputDescripcionModal" class="inv-input inv-textarea" rows="3" placeholder="Notas, presentacion, detalles..."></textarea></div>' +
        '</div>' +
        '</div>' +
        '</form>' +
        '</div>' +
        '<div class="inv-modal-footer">' +
        '<button type="button" class="inv-btn-cancelar" onclick="cerrarModalProducto()">Cancelar</button>' +
        '<button type="button" class="inv-btn-guardar" id="btnGuardarProducto" onclick="guardarProducto()"><i class="bi bi-check-lg"></i> Guardar Producto</button>' +
        '</div>' +
        '</div></div></div>';

    // Anclar el modal al BODY (no depende de Bootstrap para funcionar)
    document.body.appendChild(cont);

    // Cerrar al hacer clic fuera del contenido (en el overlay)
    var overlay = document.getElementById('modalProducto');
    overlay.addEventListener('mousedown', function(e) {
        if (e.target === overlay) cerrarModalProducto();
    });

    // Drag & drop
    var drop = document.getElementById('zonaDropImagen');
    ['dragenter', 'dragover'].forEach(function(ev) {
        drop.addEventListener(ev, function(e) { e.preventDefault(); drop.classList.add('dragover'); });
    });
    ['dragleave', 'drop'].forEach(function(ev) {
        drop.addEventListener(ev, function(e) { e.preventDefault(); drop.classList.remove('dragover'); });
    });
    drop.addEventListener('drop', function(e) {
        e.preventDefault();
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
            leerArchivoImagen(e.dataTransfer.files[0]);
        }
    });
}

function procesarArchivoImagen(input) {
    if (input.files && input.files[0]) {
        leerArchivoImagen(input.files[0]);
    }
}

function leerArchivoImagen(file) {
    if (!file.type || file.type.indexOf('image/') !== 0) {
        mostrarAlerta('warning', 'El archivo debe ser una imagen.');
        return;
    }
    var reader = new FileReader();
    reader.onload = function(e) {
        imagenProductoBase64 = e.target.result;
        setVistaPrevia(imagenProductoBase64);
    };
    reader.readAsDataURL(file);
}

function setVistaPrevia(src) {
    var img = document.getElementById('vistaPreviaImagen');
    var ph = document.getElementById('imagenPlaceholder');
    var btn = document.getElementById('btnQuitarImagen');
    if (!img || !ph) return;
    if (src) {
        img.src = src;
        img.style.display = 'block';
        ph.style.display = 'none';
        if (btn) btn.style.display = 'block';
    } else {
        img.style.display = 'none';
        img.removeAttribute('src');
        ph.style.display = '';
        if (btn) btn.style.display = 'none';
    }
}

function quitarImagen(e) {
    e.stopPropagation();
    imagenProductoBase64 = '';
    setVistaPrevia('');
    var input = document.getElementById('inputImagenModal');
    if (input) input.value = '';
}

// ---------------------------------------------------------
// GUARDAR PRODUCTO (crear o actualizar)
// ---------------------------------------------------------
function guardarProducto() {
    var nombre = document.getElementById('inputNombreModal').value.trim();
    var precio = document.getElementById('inputPrecioVentaModal').value;

    if (!nombre) { mostrarAlerta('warning', 'El nombre del producto es obligatorio.'); return; }
    if (precio === '' || precio == null) { mostrarAlerta('warning', 'El precio de venta es obligatorio.'); return; }

    var payload = {
        nombre: nombre,
        precio: Number(precio) || 0,
        categoria: document.getElementById('inputCategoriaModal').value.trim() || 'General',
        codigo_barras: (document.getElementById('inputCodigoBarrasModal').value || '').trim() || null,
        stock_minimo: Number(document.getElementById('inputStockMinModal').value) || 5,
        descripcion: document.getElementById('inputDescripcionModal').value.trim() || null,
        imagen: imagenProductoBase64 || null,
        factor_conversion: (function() {
            var v = Number(document.getElementById('inputConversionModal').value);
            return (!isNaN(v) && v > 1) ? v : null;
        })()
    };

    var btn = document.getElementById('btnGuardarProducto');
    btn.disabled = true;
    var original = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Guardando...';

    var esEdicion = !!productoEditandoId;
    var url = API_BASE + '/api/productos' + (esEdicion ? '/' + productoEditandoId : '');
    var metodo = esEdicion ? 'PUT' : 'POST';

    function enviarGuardado(codigoTotp) {
        if (codigoTotp) payload.totp_code = codigoTotp;
        return fetch(url, {
            method: metodo,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(function(r) { return r.json().then(function(d) { return { status: r.status, d: d }; }); });
    }
    enviarGuardado(null)
    .then(function(w) {
        if (w.d.success) {
            mostrarAlerta('success', esEdicion ? 'Producto "' + payload.nombre + '" actualizado correctamente.' : 'Producto "' + payload.nombre + '" creado correctamente.');
            cerrarModalProducto();
            cargarProductosInventario();
            return null;
        }
        if (w.status === 403 && w.d.needTotp) {
            var codigo = null;
            try { codigo = window.prompt('Verificación en dos pasos\n\n' + (w.d.mensaje || 'Ingresa tu codigo de autenticacion') + ':'); } catch (e) {}
            if (codigo && String(codigo).trim()) {
                return enviarGuardado(String(codigo).trim()).then(function(w2) {
                    if (w2.d.success) {
                        mostrarAlerta('success', 'Producto "' + payload.nombre + '" actualizado correctamente.');
                        cerrarModalProducto();
                        cargarProductosInventario();
                    } else {
                        mostrarAlerta('danger', w2.d.mensaje || 'Error al guardar el producto');
                    }
                });
            }
            mostrarAlerta('warning', 'Cambio de precio cancelado: se requiere el codigo de autenticacion.');
            return null;
        }
        mostrarAlerta('danger', w.d.mensaje || 'Error al guardar el producto');
        return null;
    })
    .catch(function() {
        mostrarAlerta('danger', 'No se pudo conectar con el servidor');
    })
    .finally(function() {
        btn.disabled = false;
        btn.innerHTML = original;
    });
}

// ---------------------------------------------------------
// ELIMINAR PRODUCTO
// ---------------------------------------------------------
function eliminarProducto(idProducto) {
    var producto = (inventarioProductos || []).find(function(p) { return p.id_producto === idProducto; });
    var nombre = producto ? (producto.nombre || 'este producto') : 'este producto';
    if (!confirm('¿Desactivar "' + nombre + '"? Se ocultara del catalogo activo pero se conservara el historial. Podras reactivarlo filtrando por Inactivos.')) {
        return;
    }
    fetch(API_BASE + '/api/productos/' + idProducto, { method: 'DELETE' })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success) {
                mostrarAlerta('warning', data.mensaje);
                cargarProductosInventario();
            } else {
                mostrarAlerta('danger', data.mensaje || 'Error al desactivar');
            }
        })
        .catch(function() {
            mostrarAlerta('danger', 'No se pudo conectar con el servidor');
        });
}
function reactivarProducto(idProducto){
    if(!confirm('¿Reactivar este producto? Volvera a aparecer en Compras y Punto de Venta.')) return;
    fetch(API_BASE + '/api/productos/' + idProducto + '/estado', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({activo:1}) })
        .then(function(r){return r.json();}).then(function(d){
            if(d.success){ mostrarAlerta('success', d.mensaje); cargarProductosInventario(); }
            else mostrarAlerta('danger', d.mensaje);
        }).catch(function(){ mostrarAlerta('danger','No se pudo conectar'); });
}

// =========================================================
// FICHA DEL PRODUCTO: proveedores / devoluciones
// =========================================================
var productoFichaId = null;
var productoFichaTab = 'proveedores';
var productoFichaDatos = null;
var proveedoresProductoTab = [];
var devolucionesProductoTab = [];

function verFichaProducto(id) {
    id = Number(id);
    if (typeof activarNav === 'function') activarNav('navInventario');
    productoFichaId = id;
    productoFichaTab = 'proveedores';
    productoFichaDatos = null;
    proveedoresProductoTab = [];
    devolucionesProductoTab = [];

    var contenedor = document.getElementById('main-content');
    contenedor.innerHTML =
        '<div class="page-header">' +
        '<h2><i class="bi bi-box-seam"></i><span id="fichaProductoTitulo">Ficha del Producto</span></h2>' +
        '<div class="page-header-right">' +
        '<button class="btn-refresh" onclick="verFichaProducto(' + id + ')"><i class="bi bi-arrow-clockwise"></i> Actualizar</button>' +
        '<button class="btn-custom-action btn-pedir" style="padding:8px 18px;width:auto" onclick="abrirModalProducto(' + id + ')"><i class="bi bi-pencil me-1"></i> Editar</button>' +
        '<button class="btn-custom-action" style="background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;width:auto;padding:8px 18px" onclick="abrirModalDevolucion({id_producto:' + id + '})"><i class="bi bi-arrow-return-left me-1"></i> Devolver producto</button>' +
        '<button class="btn-custom-action" style="background:#fff;color:#475569;border:1px solid #e2e8f0;width:auto;padding:8px 18px" onclick="iniciarInventario()"><i class="bi bi-arrow-left me-1"></i> Volver</button>' +
        '</div></div>' +
        '<div id="contenedorAlertas"></div>' +
        '<div class="row g-4 mb-4" id="fichaProductoKPIs"></div>' +
        '<div id="fichaProductoDetalle"></div>';
    limpiarBackdrops();

    var p = (inventarioProductos || []).find(function(x) { return Number(x.id_producto) === id; });
    if (p) {
        productoFichaDatos = p;
        renderFichaProducto(p);
        return;
    }
    fetch(API_BASE + '/api/productos/' + id)
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success) {
                productoFichaDatos = data.producto;
                renderFichaProducto(data.producto);
            } else {
                var det = document.getElementById('fichaProductoDetalle');
                if (det) det.innerHTML = '<div class="text-center py-5" style="color:#dc2626"><i class="bi bi-exclamation-triangle" style="font-size:2rem;display:block;margin-bottom:8px"></i>' + escapeHTML(data.mensaje || 'Error al cargar el producto') + '</div>';
            }
        })
        .catch(function() {
            var det = document.getElementById('fichaProductoDetalle');
            if (det) det.innerHTML = '<div class="text-center py-5" style="color:#dc2626"><i class="bi bi-wifi-off" style="font-size:2rem;display:block;margin-bottom:8px"></i>No se pudo conectar con el servidor</div>';
        });
}

function renderFichaProducto(p) {
    document.getElementById('fichaProductoTitulo').textContent = 'Ficha: ' + (p.nombre || 'Producto');
    var stock = Number(p.stock) || 0;
    var stockMin = Number(p.stock_minimo) || 5;
    var costoCpp = Number(p.precio_costo != null ? p.precio_costo : p.costo) || 0;
    var valorTotal = Math.max(0, stock) * costoCpp;
    var stockBadge = stock <= 0
        ? '<span style="background:#fee2e2;color:#b91c1c;padding:4px 12px;border-radius:8px;font-weight:700;font-size:0.8rem">Agotado</span>'
        : (stock <= stockMin
            ? '<span style="background:#fef3c7;color:#92400e;padding:4px 12px;border-radius:8px;font-weight:700;font-size:0.8rem">Bajo (' + stock + ')</span>'
            : '<span style="background:#dcfce7;color:#15803d;padding:4px 12px;border-radius:8px;font-weight:700;font-size:0.8rem">' + stock + '</span>');

    document.getElementById('fichaProductoKPIs').innerHTML =
        '<div class="col-md-3"><div class="kpi-card" style="border-left:4px solid #3b82f6"><div class="kpi-top"><div class="kpi-label">Stock Actual</div><div class="kpi-icon" style="background:#eff6ff;color:#3b82f6"><i class="bi bi-box"></i></div></div><div class="kpi-value">' + stockBadge + '</div><div class="kpi-sub">mínimo: ' + stockMin + '</div></div></div>' +
        '<div class="col-md-3"><div class="kpi-card" style="border-left:4px solid #10b981"><div class="kpi-top"><div class="kpi-label">Precio Venta</div><div class="kpi-icon" style="background:#ecfdf5;color:#10b981"><i class="bi bi-tag"></i></div></div><div class="kpi-value">' + fmtMoney(p.precio) + '</div><div class="kpi-sub">' + escapeHTML(p.categoria || 'General') + '</div></div></div>' +
        '<div class="col-md-3"><div class="kpi-card" style="border-left:4px solid #8b5cf6"><div class="kpi-top"><div class="kpi-label">Costo (CPP)</div><div class="kpi-icon" style="background:#f5f3ff;color:#8b5cf6"><i class="bi bi-calculator"></i></div></div><div class="kpi-value">' + fmtMoney(costoCpp) + '</div><div class="kpi-sub">costo promedio</div></div></div>' +
        '<div class="col-md-3"><div class="kpi-card" style="border-left:4px solid #f59e0b"><div class="kpi-top"><div class="kpi-label">Valor Total</div><div class="kpi-icon" style="background:#fffbeb;color:#f59e0b"><i class="bi bi-currency-dollar"></i></div></div><div class="kpi-value">' + fmtMoney(valorTotal) + '</div><div class="kpi-sub">stock &times; costo</div></div></div>';

    var tabs = '<div class="card" style="border:1px solid #e2e8f0;border-radius:14px;overflow:hidden">' +
        '<div style="padding:16px 20px;background:#0f172a;color:#f8fafc;font-weight:700;font-size:0.9rem;display:flex;align-items:center;gap:8px"><i class="bi bi-grid-1x2"></i> Detalle del Producto</div>' +
        '<div class="card-body" style="background:#fff;padding-top:16px">' +
        '<ul class="nav nav-pills mb-3" id="fichaProductoTabs" style="gap:6px">' +
        '<li class="nav-item"><a class="nav-link active" href="#" data-tab="proveedores" style="border-radius:9px;font-weight:600;font-size:0.85rem" onclick="mostrarTabProductoFicha(\'proveedores\', event)"><i class="bi bi-truck me-1"></i>Proveedores</a></li>' +
        '<li class="nav-item"><a class="nav-link" href="#" data-tab="devoluciones" style="border-radius:9px;font-weight:600;font-size:0.85rem;color:#475569" onclick="mostrarTabProductoFicha(\'devoluciones\', event)"><i class="bi bi-arrow-return-left me-1"></i>Devoluciones</a></li>' +
        '</ul>' +
        '<div id="fichaProductoTabContent"></div>' +
        '</div></div>';

    document.getElementById('fichaProductoDetalle').innerHTML = tabs;
    mostrarTabProductoFicha('proveedores');
}

function mostrarTabProductoFicha(tab, e) {
    if (e && e.preventDefault) e.preventDefault();
    productoFichaTab = tab;
    document.querySelectorAll('#fichaProductoTabs .nav-link').forEach(function(l) {
        if (l.getAttribute('data-tab') === tab) { l.classList.add('active'); l.style.color = '#fff'; }
        else { l.classList.remove('active'); l.style.color = '#475569'; }
    });
    var cont = document.getElementById('fichaProductoTabContent');
    if (!cont) return;
    if (tab === 'proveedores') {
        cont.innerHTML = '<div class="text-center py-5" style="color:#94a3b8"><div class="spinner-border spinner-border-sm me-2" role="status"></div>Cargando proveedores...</div>';
        cargarProveedoresTabProducto();
    } else {
        cont.innerHTML = '<div class="text-center py-5" style="color:#94a3b8"><div class="spinner-border spinner-border-sm me-2" role="status"></div>Cargando devoluciones...</div>';
        cargarDevolucionesTabProducto();
    }
}

function cargarProveedoresTabProducto() {
    var cont = document.getElementById('fichaProductoTabContent');
    if (!cont || !productoFichaId) return;
    fetch(API_BASE + '/api/productos/' + productoFichaId + '/proveedores')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            var cH = document.getElementById('fichaProductoTabContent');
            if (!cH) return;
            if (!data.success) {
                cH.innerHTML = '<div class="alert alert-danger">' + escapeHTML(data.mensaje || 'Error al cargar proveedores') + '</div>';
                return;
            }
            proveedoresProductoTab = data.proveedores || [];
            var pref = proveedoresProductoTab.filter(function(r) { return Number(r.es_preferido) === 1; });
            cH.innerHTML =
                '<div class="row g-3 mb-3">' +
                '<div class="col-md-4"><div class="kpi-card" style="border-left:4px solid #10b981"><div class="kpi-top"><div class="kpi-label">Proveedores</div><div class="kpi-icon" style="background:#ecfdf5;color:#10b981"><i class="bi bi-truck"></i></div></div><div class="kpi-value">' + proveedoresProductoTab.length + '</div><div class="kpi-sub">surten este producto</div></div></div>' +
                '<div class="col-md-4"><div class="kpi-card" style="border-left:4px solid #f59e0b"><div class="kpi-top"><div class="kpi-label">Proveedor Preferido</div><div class="kpi-icon" style="background:#fffbeb;color:#f59e0b"><i class="bi bi-star"></i></div></div><div class="kpi-value" style="font-size:1.05rem">' + (pref.length ? '1 marcado' : 'Ninguno') + '</div><div class="kpi-sub">precio compra de referencia</div></div></div>' +
                '</div>' +
                '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px">' +
                '<div style="font-weight:700;color:#0f172a"><i class="bi bi-truck me-2" style="color:#10b981"></i>Proveedores asociados / precios de compra</div>' +
                '<button class="btn-custom-action btn-pedir" style="padding:8px 16px;width:auto;font-size:0.82rem" onclick="abrirModalRelacionProductoProveedor({id_producto:' + productoFichaId + ',fijar_producto:true})"><i class="bi bi-plus-lg me-1"></i> Asociar proveedor</button>' +
                '</div>' +
                (proveedoresProductoTab.length ? tablaProveedoresProducto(proveedoresProductoTab) : '<div style="padding:30px;text-align:center;color:#94a3b8;border:1px dashed #e2e8f0;border-radius:12px"><i class="bi bi-truck" style="font-size:2rem;display:block;margin-bottom:8px"></i>Este producto aún no tiene proveedores asociados.</div>');
        })
        .catch(function() {
            var cH2 = document.getElementById('fichaProductoTabContent');
            if (cH2) cH2.innerHTML = '<div class="alert alert-danger">Error al cargar los proveedores.</div>';
        });
}

function tablaProveedoresProducto(provs) {
    var html = '<div class="table-responsive"><table class="table table-hover mb-0 align-middle" style="margin:0">' +
        '<thead style="background:#f8fafc"><tr>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem">Proveedor</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem;text-align:right">Precio Compra</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem">Referencia</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem;text-align:center">Tiempo</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem;text-align:center">Pref.</th>' +
        '<th class="text-center" style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem">Acciones</th>' +
        '</tr></thead><tbody>';
    provs.forEach(function(r) {
        var preferido = Number(r.es_preferido) === 1;
        html += '<tr style="border-color:#f1f5f9">' +
            '<td style="border-color:#f1f5f9"><div style="font-weight:700;color:#0f172a">' + escapeHTML(r.proveedor_nombre || 'Proveedor #' + r.id_proveedor) + '</div><div style="font-size:0.72rem;color:#94a3b8">' + escapeHTML(r.categoria || '') + '</div></td>' +
            '<td style="border-color:#f1f5f9;text-align:right;font-weight:700;color:#0f172a">' + fmtMoney(r.precio_compra) + '</td>' +
            '<td style="border-color:#f1f5f9;color:#64748b;font-size:0.82rem">' + escapeHTML(r.referencia_proveedor || '-') + '</td>' +
            '<td style="border-color:#f1f5f9;text-align:center">' + (r.tiempo_entrega != null ? r.tiempo_entrega + ' d' : '-') + '</td>' +
            '<td style="border-color:#f1f5f9;text-align:center">' + (preferido ? '<span style="color:#b45309;font-size:0.9rem"><i class="bi bi-star-fill"></i></span>' : '<span style="color:#cbd5e1"><i class="bi bi-star"></i></span>') + '</td>' +
            '<td class="text-center" style="border-color:#f1f5f9"><div style="display:inline-flex;gap:4px">' +
            '<button class="btn-custom-action" style="background:#eff6ff;color:#2563eb;padding:5px 9px;font-size:0.75rem;border:1px solid #bfdbfe" title="Ver proveedor" onclick="verFichaProveedor(' + r.id_proveedor + ')"><i class="bi bi-person-lines-fill"></i></button>' +
            '<button class="btn-custom-action" style="background:#fffbeb;color:#b45309;padding:5px 9px;font-size:0.75rem;border:1px solid #fde68a" title="Editar precio / relación" onclick="abrirModalRelacionProductoProveedor({id_relacion:' + r.id_relacion + '})"><i class="bi bi-pencil"></i></button>' +
            '<button class="btn-custom-action" style="background:#fef2f2;color:#dc2626;padding:5px 9px;font-size:0.75rem;border:1px solid #fecaca" title="Quitar relación" onclick="quitarRelacionProductoProveedor(' + r.id_relacion + ')"><i class="bi bi-x-lg"></i></button>' +
            '</div></td></tr>';
    });
    html += '</tbody></table></div>';
    return html;
}

function cargarDevolucionesTabProducto() {
    var cont = document.getElementById('fichaProductoTabContent');
    if (!cont || !productoFichaId) return;
    fetch(API_BASE + '/api/productos/' + productoFichaId + '/devoluciones')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            var cH = document.getElementById('fichaProductoTabContent');
            if (!cH) return;
            if (!data.success) {
                cH.innerHTML = '<div class="alert alert-danger">' + escapeHTML(data.mensaje || 'Error al cargar devoluciones') + '</div>';
                return;
            }
            devolucionesProductoTab = data.devoluciones || [];
            var total = devolucionesProductoTab.reduce(function(a, d) { return a + Number(d.total_devuelto || 0); }, 0);
            var totalCant = devolucionesProductoTab.reduce(function(a, d) { return a + Number(d.items_cantidad || 0); }, 0);
            var pend = devolucionesProductoTab.filter(function(d) { return d.estado === 'Pendiente'; });
            cH.innerHTML =
                '<div class="row g-3 mb-3">' +
                '<div class="col-md-4"><div class="kpi-card" style="border-left:4px solid #ef4444"><div class="kpi-top"><div class="kpi-label">Total Devuelto</div><div class="kpi-icon" style="background:#fef2f2;color:#ef4444"><i class="bi bi-arrow-return-left"></i></div></div><div class="kpi-value" style="color:#dc2626">' + devMoney(total) + '</div><div class="kpi-sub">' + devolucionesProductoTab.length + ' devolución(es)</div></div></div>' +
                '<div class="col-md-4"><div class="kpi-card" style="border-left:4px solid #3b82f6"><div class="kpi-top"><div class="kpi-label">Unidades Devueltas</div><div class="kpi-icon" style="background:#eff6ff;color:#3b82f6"><i class="bi bi-box-seam"></i></div></div><div class="kpi-value">' + totalCant + '</div><div class="kpi-sub">cantidad total</div></div></div>' +
                '<div class="col-md-4"><div class="kpi-card" style="border-left:4px solid #f59e0b"><div class="kpi-top"><div class="kpi-label">Pendientes</div><div class="kpi-icon" style="background:#fffbeb;color:#f59e0b"><i class="bi bi-hourglass-split"></i></div></div><div class="kpi-value" style="color:#d97706">' + pend.length + '</div><div class="kpi-sub">por aprobar</div></div></div>' +
                '</div>' +
                '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px">' +
                '<div style="font-weight:700;color:#0f172a"><i class="bi bi-arrow-return-left me-2" style="color:#dc2626"></i>Historial de devoluciones de este producto</div>' +
                '<button class="btn-custom-action btn-pedir" style="padding:8px 16px;width:auto;font-size:0.82rem" onclick="abrirModalDevolucion({id_producto:' + productoFichaId + '})"><i class="bi bi-plus-lg me-1"></i> Devolver producto</button>' +
                '</div>' +
                (devolucionesProductoTab.length ? tablaDevolucionesProducto(devolucionesProductoTab) : '<div style="padding:30px;text-align:center;color:#94a3b8;border:1px dashed #e2e8f0;border-radius:12px"><i class="bi bi-arrow-return-left" style="font-size:2rem;display:block;margin-bottom:8px"></i>Este producto no tiene devoluciones registradas.</div>');
        })
        .catch(function() {
            var cH2 = document.getElementById('fichaProductoTabContent');
            if (cH2) cH2.innerHTML = '<div class="alert alert-danger">Error al cargar las devoluciones.</div>';
        });
}

function tablaDevolucionesProducto(devs) {
    var html = '<div class="table-responsive"><table class="table table-hover mb-0 align-middle" style="margin:0">' +
        '<thead style="background:#f8fafc"><tr>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem">N. Devolución</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem">Fecha</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem">Proveedor</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem;text-align:center">Cant.</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem;text-align:right">Total</th>' +
        '<th style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem">Estado</th>' +
        '<th class="text-center" style="border-color:#e2e8f0;color:#475569;font-weight:600;font-size:0.82rem">Acciones</th>' +
        '</tr></thead><tbody>';
    devs.forEach(function(d) {
        html += '<tr style="border-color:#f1f5f9">' +
            '<td style="border-color:#f1f5f9;font-weight:700;color:#0f172a">' + devEsc(d.numero_devolucion) + '</td>' +
            '<td style="border-color:#f1f5f9"><div style="color:#334155;font-weight:600;font-size:0.83rem">' + devFecha(d.fecha) + '</div><div style="font-size:0.72rem;color:#94a3b8">' + devHora(d.fecha) + '</div></td>' +
            '<td style="border-color:#f1f5f9;font-weight:600;color:#0f172a">' + devEsc(d.proveedor_nombre || '-') + '</td>' +
            '<td style="border-color:#f1f5f9;text-align:center">' + (Number(d.items_cantidad) || 0) + '</td>' +
            '<td style="border-color:#f1f5f9;text-align:right;font-weight:700;color:#dc2626">' + devMoney(d.total_devuelto) + '</td>' +
            '<td style="border-color:#f1f5f9">' + badgeEstadoDevolucion(d.estado) + '</td>' +
            '<td class="text-center" style="border-color:#f1f5f9"><div style="display:inline-flex;gap:4px">' +
            '<button class="btn-custom-action" style="background:#eff6ff;color:#2563eb;padding:5px 10px;font-size:0.75rem;border:1px solid #bfdbfe" title="Ver detalle" onclick="verDetalleDevolucion(' + d.id_devolucion + ')"><i class="bi bi-eye"></i></button>' +
            '<button class="btn-custom-action" style="background:#0f172a;color:#f8fafc;padding:5px 10px;font-size:0.75rem;border:1px solid #0f172a" title="Cambiar estado" onclick="abrirModalCambiarEstadoDevolucion(' + d.id_devolucion + ')"><i class="bi bi-arrow-repeat"></i></button>' +
            '</div></td></tr>';
    });
    html += '</tbody></table></div>';
    return html;
}

function recargarProveedoresTabProducto() {
    try {
        if (productoFichaTab === 'proveedores') cargarProveedoresTabProducto();
    } catch (e) {}
}
function recargarDevolucionesTabProducto() {
    try {
        if (productoFichaTab === 'devoluciones') cargarDevolucionesTabProducto();
    } catch (e) {}
}
