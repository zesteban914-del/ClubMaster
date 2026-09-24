// =========================================================
// report-generator.js
// Genera PDF (pdfkit) y Excel (exceljs) para reportes de jornada
// =========================================================

let PDFDocument;
let ExcelJS;
try { PDFDocument = require('pdfkit'); } catch(e){ PDFDocument = null; }
try { ExcelJS = require('exceljs'); } catch(e){ ExcelJS = null; }

function fmtCOP(n){ return '$' + Number(n||0).toLocaleString('es-CO'); }
function fmt(n){ return Number(n||0).toLocaleString('es-CO'); }

function getTituloReporte(cat, id){
  const map = {
    folio_familias: 'Ventas x Familias / Categorías',
    folio_descuentos: 'Descuentos y Cortesías',
    folio_nocturna: 'Ventas Jornada Nocturna (06:00)',
    folio_retiros: 'Retiros Parciales / Vaciados',
    folio_impuestos: 'Ventas Totales x Día - Impuestos',
    folio_propinas: 'Relación de Propinas',
    folio_pago: 'Ventas x Forma de Pago',
    folio_zonas: 'Ventas x Zonas',
    ticket_minimos: 'Productos Bajo Mínimos',
    ticket_resumido: 'Ventas Formato Ticket Resumido',
    ticket_empleado: 'Ventas x Empleado Detallado',
    ticket_barra: 'Ventas Detallado x Barra',
    ticket_anuladas: 'Ventas Eliminadas / Anuladas',
    ticket_cierres: 'Cierres de Caja',
    aud_descuentos: 'Auditoría Descuentos',
    aud_cajon: 'Trazabilidad Cajón sin Venta',
    aud_eliminadas: 'Ventas Eliminadas / Modificadas',
    aud_turnos: 'Turnos y Horas Trabajadas',
    aud_horario: 'Control Horario',
    aud_empleado: 'Resumen Ventas x Empleado',
    cont_facturas: 'Resumen Contable Facturas',
    cont_impuestos: 'Impuestos Repercutidos',
    cont_gastos: 'Gastos Operativos Caja Chica',
    cont_stock: 'Valoración Stock',
  };
  return map[id] || `${cat} - ${id}`;
}

function resumenTextoReporte(reportData, cat, id, filtros){
  const d = reportData.data || reportData;
  let lines = [];
  lines.push(`Reporte: ${getTituloReporte(cat,id)}`);
  lines.push(`Fecha: ${new Date().toLocaleString('es-CO')}`);
  if (filtros.fecha_inicio || filtros.fecha_fin) lines.push(`Rango: ${filtros.fecha_inicio||'...'} a ${filtros.fecha_fin||'...'}`);
  if (filtros.id_jornada) lines.push(`Jornada: #${filtros.id_jornada}`);
  if (filtros.id_mesero) lines.push(`Empleado ID: ${filtros.id_mesero}`);
  // KPIs rápidos
  if (d.kpis) lines.push(`Ingresos: ${fmtCOP(d.kpis.ingresos)} | Ventas: ${d.kpis.num_ventas} | Ticket: ${fmtCOP(d.kpis.ticket_promedio)}`);
  if (d.totalesGenerales) lines.push(`Tot ventas: ${d.totalesGenerales.ventas} | Total: ${fmtCOP(d.totalesGenerales.total)} | Propinas: ${fmtCOP(d.totalesGenerales.propinas)}`);
  if (d.totales) lines.push(`Totales: ${JSON.stringify(d.totales).slice(0,120)}`);
  return lines.join(' | ');
}

function mensajeWhatsApp({ cat, id, filtros, formato }) {
  const fecha = new Date().toLocaleString('es-CO', { dateStyle:'full', timeStyle:'short' });
  const titulo = getTituloReporte(cat,id);
  const rango = (filtros.fecha_inicio && filtros.fecha_fin) ? `${filtros.fecha_inicio} al ${filtros.fecha_fin}` : (filtros.fecha_inicio||filtros.fecha_fin||'últimos 30 días');
  const extra = filtros.id_jornada ? ` | Jornada #${filtros.id_jornada}` : '';
  return `Hola, adjuntamos el *reporte de ${titulo}* correspondiente al turno/jornada del *${rango}*${extra}.\nFormato: ${formato.toUpperCase()}.\nGenerado: ${fecha}\n— ClubMaster`;
}

// ---------------- PDF ----------------
async function generarPDF({ cat, id, filtros, reportData }) {
  if (!PDFDocument) throw new Error('pdfkit no instalado. Ejecute: npm install pdfkit');
  const titulo = getTituloReporte(cat, id);
  const doc = new PDFDocument({ size:'A4', margin: 36, info:{ Title: titulo, Author:'ClubMaster' } });
  const chunks = [];
  doc.on('data', c=> chunks.push(c));
  const endPromise = new Promise(res=> doc.on('end', ()=> res(Buffer.concat(chunks))));

  // Header
  doc.rect(0,0, doc.page.width, 70).fill('#0f172a');
  doc.fillColor('#fbbf24').fontSize(16).font('Helvetica-Bold').text('CLUBMASTER', 36, 22);
  doc.fillColor('#fff').fontSize(8).font('Helvetica').text('Centro de Control  •  Inteligencia de Negocios', 36, 42);
  doc.fillColor('#94a3b8').fontSize(7).text(`Generado: ${new Date().toLocaleString('es-CO')}  •  Filtros: ${JSON.stringify(filtros)}`, 36, 54, { width: doc.page.width-72, align:'right' });

  doc.moveDown(2);
  doc.fillColor('#0f172a').fontSize(14).font('Helvetica-Bold').text(titulo, { align:'center' });
  doc.moveDown(0.3);
  doc.fillColor('#475569').fontSize(7).font('Helvetica').text(`${cat.toUpperCase()} • ${id}  •  Rango: ${filtros.fecha_inicio||'--'} a ${filtros.fecha_fin||'--'}${filtros.id_jornada? '  •  Jornada #'+filtros.id_jornada:''}${filtros.id_mesero? '  •  Mesero #'+filtros.id_mesero:''}`, { align:'center' });
  doc.moveDown(0.8);
  // linea
  doc.moveTo(36, doc.y).lineTo(doc.page.width-36, doc.y).strokeColor('#e2e8f0').stroke();
  doc.moveDown(0.6);

  const d = reportData.data || reportData;

  function section(title){
    doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text(title, { underline:false });
    doc.moveDown(0.2);
  }
  function table(headers, rows, colWidths){
    const startY = doc.y;
    const tableX = 36;
    const availW = doc.page.width - 72;
    const widths = colWidths || headers.map(()=> availW/headers.length);
    // header row
    let x = tableX;
    const h = 18;
    doc.rect(tableX, doc.y, availW, h).fill('#0f172a');
    doc.fillColor('#fff').fontSize(6.5).font('Helvetica-Bold');
    headers.forEach((hh,i)=>{
      doc.text(String(hh), x+4, doc.y+6, { width: widths[i]-8, align: i===0? 'left':'right' });
      x += widths[i];
    });
    doc.moveDown(1.2);
    // rows
    doc.font('Helvetica').fontSize(6.5).fillColor('#0f172a');
    rows.forEach((row, idx)=>{
      const rowH = 14;
      if (doc.y + rowH > doc.page.height - 50) { doc.addPage(); }
      if (idx%2===0) doc.rect(tableX, doc.y, availW, rowH).fill('#f8fafc');
      else doc.rect(tableX, doc.y, availW, rowH).fill('#fff');
      // need to reset y for text
      const yText = doc.y + 4.5;
      let cx = tableX;
      doc.fillColor('#0f172a');
      row.forEach((cell,i)=>{
        const align = i===0 ? 'left' : 'right';
        doc.text(String(cell==null?'--':cell), cx+4, yText, { width: widths[i]-8, align });
        cx += widths[i];
      });
      doc.moveDown(0.9);
      // move y to next line (approx)
      // doc.y already advanced by text; ensure
    });
    doc.moveDown(0.4);
  }

  try {
    // Render según tipo de reporte
    if (id==='folio_pago' && d.desglose) {
      section('Desglose por Método de Pago');
      table(['Método','Cantidad','Total','%'], d.desglose.map(r=>[r.metodo, r.cantidad, fmtCOP(r.total), r.pct+'%']), [180, 80, 120, 70]);
    } else if (id==='folio_familias' && d.familias) {
      section('Ventas por Familia');
      table(['Familia','Ventas','Unidades','Ingresos'], d.familias.map(r=>[r.familia, r.ventas, r.unidades, fmtCOP(r.ingresos)]));
    } else if ((id==='folio_impuestos' || id==='cont_impuestos') && d.impuestos) {
      section('Impuestos (Impoconsumo 8% / IVA 19%)');
      table(['Fecha','Ventas','Bruto','Base','IVA','ICO'], d.impuestos.slice(0,40).map(r=>[r.fecha, r.ventas, fmtCOP(r.bruto), fmtCOP(r.base), fmtCOP(r.iva), fmtCOP(r.ico)]));
    } else if (id==='ticket_empleado' && d.detallePorMesero) {
      section(`Ventas por Empleado — Totales generales: ${d.totalesGenerales.ventas} ventas / ${fmtCOP(d.totalesGenerales.total)}`);
      // tabla resumen meseros
      if (d.meseros) table(['Mesero','Ventas','Total','Propinas','Ticket'], d.meseros.slice(0,30).map(r=>[r.nombre, r.ventas, fmtCOP(r.total), fmtCOP(r.propinas), fmtCOP(r.ticket_promedio)]));
      // detalle por mesero (solo primeras 2 páginas)
      let count=0;
      for (const m of d.detallePorMesero.slice(0,5)){
        if (count++>0 && doc.y > doc.page.height-120) doc.addPage();
        section(`• ${m.nombre} — ${m.ventas} ventas | ${fmtCOP(m.total)} | Propinas ${fmtCOP(m.propinas)}`);
        if (m.transacciones && m.transacciones.length){
          table(['Mesa','Hora','Factura','Prod','Total'], m.transacciones.slice(0,15).map(t=>[
            t.mesa||t.mesa_nombre||'--',
            String(t.fecha||'').replace('T',' ').substring(11,16),
            '#'+t.id_pedido,
            t.productos.length,
            fmtCOP(t.total)
          ]));
        }
        if (m.consolidadoProductos && m.consolidadoProductos.length){
          table(['Producto','Cant','Subtotal'], m.consolidadoProductos.slice(0,15).map(p=>[p.nombre, p.cantidad_total, fmtCOP(p.subtotal_total)]));
        }
      }
    } else if (id==='ticket_cierres' && d.cierres) {
      section('Cierres de Caja');
      table(['Jornada','Estado','Inicial','Esperado','Real','Dif'], d.cierres.slice(0,30).map(r=>['#'+r.id_jornada+' '+(String(r.fecha_apertura||'').substring(0,16)), r.estado, fmtCOP(r.monto_inicial), fmtCOP(r.total_efectivo_esperado), fmtCOP(r.total_efectivo_real), fmtCOP(r.diferencia)]));
    } else if (id==='cont_stock' && d.stock){
      const det = (d.stock.detalle||[]).slice(0,80);
      section(`Valoración Stock — ${det.length} items | Venta ${fmtCOP(d.stock.totales?.totalVenta||0)} | Costo ${fmtCOP(d.stock.totales?.totalCosto||0)}`);
      table(['Producto','Categoria','Stock','Valor venta','Valor costo'], det.map(r=>[r.nombre, r.categoria, r.stock, fmtCOP(r.valor_venta), fmtCOP(r.valor_costo)]));
    } else if (id==='folio_propinas' && d.detalle){
      section('Propinas por Mesero');
      table(['Mesero','Ventas','Propina total','Efectivo','Electrónica'], d.detalle.map(r=>[r.mesero, r.ventas, fmtCOP(r.propina_total), fmtCOP(r.efectivo), fmtCOP(r.electronica)]));
    } else if (d.kpis) {
      section('KPIs Generales');
      table(['Ingresos','Ventas','Ticket prom','Propinas','Utilidad'], [[fmtCOP(d.kpis.ingresos), d.kpis.num_ventas, fmtCOP(d.kpis.ticket_promedio), fmtCOP(d.kpis.propinas), fmtCOP(d.kpis.utilidad||0)]]);
      if (d.desglose_metodos) {
        section('Desglose Métodos');
        table(['Método','Cant','Total','%'], d.desglose_metodos.map(r=>[r.metodo, r.cantidad, fmtCOP(r.total), r.pct+'%']));
      }
    } else {
      section('Datos del reporte');
      const preview = JSON.stringify(d, null, 2).slice(0, 6000);
      doc.font('Helvetica').fontSize(6).fillColor('#334155').text(preview, { width: doc.page.width-72 });
    }
  } catch(e){
    doc.fillColor('#dc2626').fontSize(8).text('Error render reporte: '+e.message);
  }

  // Footer
  const footerY = doc.page.height - 30;
  doc.fontSize(6).fillColor('#94a3b8').text(`ClubMaster • Reporte ${cat}/${id} • Página ${doc.bufferedPageRange().count || 1} • Confidencial`, 36, footerY, { align:'center', width: doc.page.width-72 });

  doc.end();
  const buffer = await endPromise;
  return { buffer, mimeType:'application/pdf', fileName:`ClubMaster_${id}_${(filtros.fecha_inicio||'inicio')}_${(filtros.fecha_fin||'fin')}.pdf` };
}

// ---------------- Excel ----------------
async function generarExcel({ cat, id, filtros, reportData }) {
  if (!ExcelJS) throw new Error('exceljs no instalado. Ejecute: npm install exceljs');
  const titulo = getTituloReporte(cat, id);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ClubMaster';
  wb.created = new Date();
  const ws = wb.addWorksheet(titulo.slice(0,31), { properties:{ tabColor:{argb:'FF0F172A'} } });

  // estilos
  const headerFill = { type:'pattern', pattern:'solid', fgColor:{argb:'FF0F172A'} };
  const headerFont = { color:{argb:'FFFFFFFF'}, bold:true, size:9 };
  const moneyFmt = '"$"#,##0';

  ws.addRow(['CLUBMASTER — ' + titulo]).font = { bold:true, size:14, color:{argb:'FF0F172A'} };
  ws.addRow([`Generado: ${new Date().toLocaleString('es-CO')} | Filtros: ${JSON.stringify(filtros)}`]).font = { size:8, color:{argb:'FF64748B'} };
  ws.addRow([`Categoria: ${cat} | Reporte: ${id} | Rango: ${filtros.fecha_inicio||'--'} a ${filtros.fecha_fin||'--'}`]).font = { size:8, color:{argb:'FF64748B'} };
  ws.addRow([]);
  ws.addRow([titulo]).font = { bold:true, size:11, color:{argb:'FF0F172A'} };
  ws.addRow([]);

  const d = reportData.data || reportData;

  function addTable(headers, rows, widths) {
    const hr = ws.addRow(headers);
    hr.eachCell(c=> { c.fill=headerFill; c.font=headerFont; c.alignment={ vertical:'middle', horizontal:'center', wrapText:true }; c.border={ bottom:{style:'thin', color:{argb:'FFE2E8F0'}}}; });
    hr.height = 16;
    rows.forEach(r=>{
      const row = ws.addRow(r);
      row.eachCell((c, idx)=>{
        c.font={ size:8 };
        c.alignment={ vertical:'middle', horizontal: idx===1? 'left':'right' };
        // money cols heuristic
        const h = String(headers[idx-1]||'').toLowerCase();
        if (h.includes('total')||h.includes('ingreso')||h.includes('venta')||h.includes('costo')||h.includes('propina')||h.includes('ticket')||h.includes('valor')) {
          if (typeof r[idx-1]==='number') c.numFmt = moneyFmt;
        }
      });
      row.height = 13;
    });
    ws.addRow([]);
    if (widths) widths.forEach((w,i)=> { ws.getColumn(i+1).width = Math.max(ws.getColumn(i+1).width||10, w); });
  }

  // widen defaults
  ws.columns.forEach(c=> c.width = 16);
  ws.getColumn(1).width = 28;

  if (id==='folio_pago' && d.desglose) {
    addTable(['Método','Cantidad','Total','%'], d.desglose.map(r=>[r.metodo, Number(r.cantidad), Number(r.total), Number(r.pct)]), [28,12,16,10]);
  } else if (id==='folio_familias' && d.familias) {
    addTable(['Familia','Ventas','Unidades','Ingresos'], d.familias.map(r=>[r.familia, Number(r.ventas), Number(r.unidades), Number(r.ingresos)]));
  } else if ((id==='folio_impuestos' || id==='cont_impuestos') && d.impuestos) {
    addTable(['Fecha','Ventas','Bruto','Base','IVA','ICO'], d.impuestos.map(r=>[String(r.fecha).substring(0,10), Number(r.ventas), Number(r.bruto), Number(r.base), Number(r.iva), Number(r.ico)]));
  } else if (id==='ticket_empleado' && d.meseros) {
    addTable(['Mesero','Ventas','Total','Propinas','Ticket prom'], d.meseros.map(r=>[r.nombre, Number(r.ventas), Number(r.total), Number(r.propinas), Number(r.ticket_promedio)]));
    // hojas extra por mesero
    let count=0;
    for (const m of (d.detallePorMesero||[]).slice(0,10)){
      if (m.transacciones && m.transacciones.length){
        const ws2 = wb.addWorksheet((m.nombre||'Mesero').slice(0,28).replace(/[:\\/?*\[\]]/g,'') + (count++?' '+count:''));
        ws2.addRow([`Detalle — ${m.nombre} — ${m.ventas} ventas | ${fmtCOP(m.total)}`]).font={bold:true, size:10, color:{argb:'FF0F172A'}};
        ws2.addRow([`Rango ${filtros.fecha_inicio||'--'} a ${filtros.fecha_fin||'--'}`]).font={size:8, color:{argb:'FF64748B'}};
        ws2.addRow([]);
        const hr = ws2.addRow(['Mesa','Fecha','Pedido','Método','Productos','Total','Propina']);
        hr.eachCell(c=>{c.fill=headerFill; c.font=headerFont;});
        m.transacciones.slice(0,300).forEach(t=>{
          ws2.addRow([t.mesa||t.mesa_nombre||'--', String(t.fecha||'').replace('T',' ').substring(0,19), t.id_pedido, t.metodo_pago||'--', t.productos.length, Number(t.total), Number(t.propina)]);
        });
        ws2.columns.forEach(c=> c.width=14); ws2.getColumn(1).width=18;
      }
    }
  } else if (id==='ticket_cierres' && d.cierres) {
    addTable(['Jornada','Fecha apertura','Estado','Inicial','Esperado','Real','Diferencia'], d.cierres.map(r=>[r.id_jornada, String(r.fecha_apertura||'').substring(0,19), r.estado, Number(r.monto_inicial), Number(r.total_efectivo_esperado), Number(r.total_efectivo_real), Number(r.diferencia)]));
  } else if (id==='cont_stock' && d.stock){
    const det=(d.stock.detalle||[]);
    addTable(['Producto','Categoría','Stock','Mín','Precio','Costo','Valor venta','Valor costo'], det.map(r=>[r.nombre, r.categoria, Number(r.stock), Number(r.minimo), Number(r.precio), Number(r.costo), Number(r.valor_venta), Number(r.valor_costo)]));
  } else if (d.kpis){
    addTable(['Ingresos','Nº ventas','Ticket prom','Propinas','Utilidad'], [[Number(d.kpis.ingresos), Number(d.kpis.num_ventas), Number(d.kpis.ticket_promedio), Number(d.kpis.propinas), Number(d.kpis.utilidad||0)]]);
    if (d.desglose_metodos) addTable(['Método','Cantidad','Total','%'], d.desglose_metodos.map(r=>[r.metodo, Number(r.cantidad), Number(r.total), Number(r.pct)]));
  } else {
    // fallback: volcar JSON
    ws.addRow(['Datos (JSON)']).font={bold:true};
    const preview = JSON.stringify(d, null, 2).split('\n').slice(0,500);
    preview.forEach(l=> ws.addRow([l]));
  }

  // bordes y autofilter
  ws.views = [{ state:'frozen', ySplit:7 }];

  const buffer = await wb.xlsx.writeBuffer();
  return { buffer: Buffer.from(buffer), mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', fileName:`ClubMaster_${id}_${(filtros.fecha_inicio||'inicio')}_${(filtros.fecha_fin||'fin')}.xlsx` };
}

module.exports = { generarPDF, generarExcel, getTituloReporte, mensajeWhatsApp, resumenTextoReporte };
