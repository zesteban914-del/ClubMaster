// =========================================================
// print-helper.js — Helper unificado de impresión ClubMaster
// Todos los reportes (y el resumen de cierre de caja) imprimen
// a través de ClubMasterPrint.imprimir(), que abre una ventana
// de impresión autocontenida con estilos propios:
//
//  - Fondo blanco, texto negro, tablas con bordes visibles.
//  - Tamaños A4/carta (formato 'a4') o térmica 80mm ('termico80').
//  - Saltos de página correctos (thead repetido, sin filas partidas).
//  - Espera a que el contenido esté listo antes de imprimir
//    (onload + pequeño retardo + document.fonts.ready si existe).
//
// Uso:
//   ClubMasterPrint.imprimir({ titulo, encabezadoHtml, cuerpoHtml,
//       formato: 'a4' | 'termico80', negocio: 'ClubMaster' });
//   ClubMasterPrint.imprimirElemento('#repLive', { titulo, ... });
//
// Sin dependencias. Estilo vanilla como el resto del frontend.
// =========================================================
(function(global) {
    'use strict';

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function estilosA4() {
        return '' +
            '@page{size:A4;margin:12mm}' +
            '*{box-sizing:border-box}' +
            'body{margin:0;padding:0;background:#fff;color:#000;' +
            'font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.45}' +
            '.cm-print{max-width:190mm;margin:0 auto;padding:0 2mm}' +
            '.cm-head{border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:10px}' +
            '.cm-head h1{margin:0;font-size:18px;letter-spacing:1px}' +
            '.cm-head .cm-sub{font-size:10px;color:#222}' +
            '.cm-meta{font-size:10px;margin:6px 0 10px;color:#111}' +
            'table{width:100%;border-collapse:collapse;margin:8px 0;font-size:10.5px}' +
            'thead{display:table-header-group}' +
            'tfoot{display:table-footer-group}' +
            'tr{page-break-inside:avoid}' +
            'th,td{border:1px solid #000;padding:5px 7px;text-align:left;' +
            'color:#000;background:#fff !important}' +
            'th{background:#eee !important;font-weight:800}' +
            'td.num,th.num{text-align:right}' +
            '.cm-total{font-weight:800;font-size:12px;border-top:2px solid #000;' +
            'padding-top:6px;margin-top:8px;display:flex;justify-content:space-between}' +
            '.cm-foot{margin-top:12px;border-top:1px dashed #000;padding-top:6px;' +
            'font-size:9px;color:#222;text-align:center}' +
            '.no-print{display:none !important}';
    }

    function estilosTermico80() {
        return '' +
            '@page{size:80mm auto;margin:0}' +
            '*{box-sizing:border-box}' +
            'body{margin:0 auto;padding:6px;background:#fff;color:#000;width:72mm;' +
            'font-family:monospace,monospace;font-size:11px;line-height:1.35}' +
            '.cm-print{width:100%}' +
            '.cm-head{text-align:center;border-bottom:2px solid #000;' +
            'padding-bottom:6px;margin-bottom:6px}' +
            '.cm-head h1{margin:0;font-size:14px;letter-spacing:1px}' +
            '.cm-head .cm-sub{font-size:9px}' +
            '.cm-meta{font-size:9px;margin:5px 0}' +
            'table{width:100%;border-collapse:collapse;margin:6px 0;font-size:10px}' +
            'th,td{border-bottom:1px dashed #000;padding:3px 2px;text-align:left}' +
            'th{border-bottom:2px solid #000;font-weight:800}' +
            'td.num,th.num{text-align:right}' +
            '.cm-total{font-weight:800;border-top:2px solid #000;margin-top:6px;' +
            'padding-top:4px;display:flex;justify-content:space-between}' +
            '.cm-foot{margin-top:8px;font-size:8px;text-align:center}' +
            '.no-print{display:none !important}';
    }

    function construirDoc(opts) {
        var titulo = opts.titulo || 'Reporte ClubMaster';
        var negocio = opts.negocio || 'ClubMaster';
        var subtitulo = opts.subtitulo || '';
        var meta = opts.metaHtml || '';
        var cuerpo = opts.cuerpoHtml || '<p>Sin contenido</p>';
        var pie = opts.pieHtml || 'Sistema ClubMaster — documento generado automáticamente';
        var css = (opts.formato === 'termico80') ? estilosTermico80() : estilosA4();
        var anchoVentana = (opts.formato === 'termico80') ? 360 : 900;

        return {
            titulo: titulo,
            anchoVentana: anchoVentana,
            html: '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">' +
                '<title>' + esc(titulo) + '</title>' +
                '<style>' + css + '</style></head><body>' +
                '<div class="cm-print">' +
                '<div class="cm-head"><h1>' + esc(negocio) + '</h1>' +
                (subtitulo ? '<div style="font-weight:800">' + esc(subtitulo) + '</div>' : '') +
                '<div class="cm-sub">' + esc(titulo) + ' — ' + esc(new Date().toLocaleString('es-CO')) + '</div></div>' +
                (meta ? '<div class="cm-meta">' + meta + '</div>' : '') +
                cuerpo +
                '<div class="cm-foot">' + esc(pie) + '</div>' +
                '</div>' +
                '<scr' + 'ipt>' +
                'window.onload=function(){' +
                'try{if(document.fonts&&document.fonts.ready){document.fonts.ready.then(function(){setTimeout(function(){window.focus();window.print();},350);});}' +
                'else{setTimeout(function(){window.focus();window.print();},450);}' +
                '}catch(e){setTimeout(function(){window.print();},450);}};' +
                '</scr' + 'ipt></body></html>'
        };
    }

    function imprimirVentana(doc) {
        var w = null;
        try {
            w = window.open('', '_blank', 'width=' + doc.anchoVentana + ',height=640');
        } catch (e) { w = null; }
        if (!w) {
            // Popup bloqueado: iframe oculto como respaldo.
            try {
                var iframe = document.createElement('iframe');
                iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
                iframe.title = doc.titulo;
                document.body.appendChild(iframe);
                var idoc = iframe.contentDocument || iframe.contentWindow.document;
                idoc.open();
                idoc.write(doc.html);
                idoc.close();
                setTimeout(function() {
                    try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch (e) {}
                    setTimeout(function() { try { iframe.remove(); } catch (e) {} }, 1500);
                }, 600);
                return true;
            } catch (e) { return false; }
        }
        try {
            w.document.open();
            w.document.write(doc.html);
            w.document.close();
            w.focus();
            return true;
        } catch (e) {
            try { w.close(); } catch (e2) {}
            return false;
        }
    }

    function sanearCuerpo(html) {
        // Quita botones de acción y spinners del contenido a imprimir,
        // pero conserva tablas, encabezados y totales con datos.
        var div = document.createElement('div');
        div.innerHTML = String(html || '');
        var sel = '.no-print,button,.btn,.rep-mfoot,.spinner-border,.alert-info';
        try {
            div.querySelectorAll(sel).forEach(function(el) { el.remove(); });
        } catch (e) {}
        // Abre los <details> colapsados para que su contenido salga impreso.
        try {
            div.querySelectorAll('details').forEach(function(d) { d.setAttribute('open', ''); });
        } catch (e) {}
        // Fuerza fondo claro/texto oscuro en línea para nodos con tema oscuro.
        try {
            div.querySelectorAll('*').forEach(function(el) {
                var bg = '';
                try { bg = (el.style && el.style.background) || ''; } catch (e2) {}
                if (/0f172a|1e293b|0b1220/i.test(bg + (el.getAttribute('style') || ''))) {
                    el.setAttribute('data-cm-dark', '1');
                }
            });
        } catch (e) {}
        var extra = '<style>[data-cm-dark]{background:#eee !important;color:#000 !important}' +
            '[data-cm-dark] *{color:#000 !important}</style>';
        return extra + div.innerHTML;
    }

    function imprimir(opts) {
        opts = opts || {};
        if (!opts.cuerpoHtml) return false;
        var doc = construirDoc({
            titulo: opts.titulo || 'Reporte',
            negocio: opts.negocio || 'ClubMaster',
            subtitulo: opts.subtitulo || '',
            metaHtml: opts.metaHtml || '',
            cuerpoHtml: sanearCuerpo(opts.cuerpoHtml),
            pieHtml: opts.pieHtml,
            formato: opts.formato === 'termico80' ? 'termico80' : 'a4'
        });
        return imprimirVentana(doc);
    }

    function imprimirElemento(selector, opts) {
        opts = opts || {};
        var el = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!el || !el.innerHTML || !el.innerHTML.trim()) {
            try {
                if (typeof repError === 'function') repError('Aún no hay contenido para imprimir: espere a que carguen los datos.');
                else if (typeof mostrarAlerta === 'function') mostrarAlerta('warning', 'Aún no hay contenido para imprimir: espere a que carguen los datos.');
                else alert('Aún no hay contenido para imprimir: espere a que carguen los datos.');
            } catch (e) {}
            return false;
        }
        if (/spinner-border/i.test(el.innerHTML)) {
            try {
                if (typeof repError === 'function') repError('Los datos aún están cargando. Intente imprimir de nuevo en unos segundos.');
                else alert('Los datos aún están cargando. Intente imprimir de nuevo en unos segundos.');
            } catch (e) {}
            return false;
        }
        return imprimir({
            titulo: opts.titulo || 'Reporte',
            negocio: opts.negocio,
            subtitulo: opts.subtitulo,
            metaHtml: opts.metaHtml,
            cuerpoHtml: el.innerHTML,
            formato: opts.formato,
            pieHtml: opts.pieHtml
        });
    }

    global.ClubMasterPrint = {
        imprimir: imprimir,
        imprimirElemento: imprimirElemento
    };
})(typeof window !== 'undefined' ? window : this);
