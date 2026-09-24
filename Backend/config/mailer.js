// =========================================================
// mailer.js
// Envio de correos mediante Nodemailer (SMTP).
// Configuracion leida de variables de entorno (.env).
// =========================================================
const nodemailer = require('nodemailer');

// Crea el transporter una sola vez usando variables de entorno.
let transporter = null;

function obtenerTransporter() {
    if (transporter) return transporter;

    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER || process.env.EMAIL_USER;
    const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

    if (!host || !user) {
        return null;
    }

    transporter = nodemailer.createTransport({
        host: host,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: {
            user: user,
            pass: pass
        }
    });

    return transporter;
}

function formatearCOP(n){ return '$'+Number(n||0).toLocaleString('es-CO'); }
function escHtmlMail(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

async function enviarReporteCierre(destinatario, reporte){
    const t = obtenerTransporter();
    if(!t){
        console.log('=== REPORTE CIERRE (SMTP no configurado) ===');
        console.log('Para:', destinatario);
        console.log('Jornada:', reporte?.jornada?.id_jornada, 'Diferencia:', reporte?.resumen?.diferencia);
        console.log('==========================================');
        return { mode:'consola', skipped:true };
    }
    const j = reporte.jornada||{};
    const r = reporte.resumen||{};
    const asunto = `Cierre Caja #${j.id_jornada||''} - ${j.barra_asignada||'Caja Principal'} - ${new Date().toLocaleDateString('es-CO')}`;
    const diff = Number(r.diferencia||0);
    const diffColor = diff===0 ? '#10B981' : diff>0 ? '#3B82F6' : '#EF4444';
    const diffLabel = diff===0 ? 'CUADRE PERFECTO' : diff>0 ? 'SOBRANTE' : 'FALTANTE';
    const ventasBrutas = formatearCOP(r.ventas_brutas);
    const desgloseHtml = (r.desglose||[]).map(row=>`<tr><td style="padding:6px 8px;border-bottom:1px solid #eee">${escHtmlMail(row.metodo_pago)}${row.sub_metodo?' - '+escHtmlMail(row.sub_metodo):''}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${Number(row.cantidad||0)}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${formatearCOP(row.subtotal)}</td></tr>`).join('') || '<tr><td colspan="3" style="padding:12px;text-align:center;color:#888">Sin ventas registradas</td></tr>';
    const html = `
        <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
            <div style="background:#0F172A;color:#fff;padding:20px;text-align:center">
                <div style="font-size:18px;font-weight:800;letter-spacing:1px">CLUBMASTER</div>
                <div style="font-size:11px;opacity:.8">REPORTE Z - CIERRE DE JORNADA</div>
                <div style="margin-top:8px;font-size:12px">Jornada #${j.id_jornada||''} | ${j.barra_asignada||'Caja Principal'} | ${j.fecha_apertura||''} → ${j.fecha_cierre||''}</div>
            </div>
            <div style="padding:20px">
                <div style="display:flex;gap:12px;margin-bottom:16px">
                    <div style="flex:1;background:#F8FAFC;border:1px solid #e2e8f0;border-radius:8px;padding:12px;text-align:center"><div style="font-size:11px;color:#64748B">VENTAS BRUTAS</div><div style="font-size:16px;font-weight:800">${ventasBrutas}</div></div>
                    <div style="flex:1;background:#FEF2F2;border:1px solid #fecaca;border-radius:8px;padding:12px;text-align:center"><div style="font-size:11px;color:#991B1B">DESCUENTOS</div><div style="font-size:16px;font-weight:800;color:#DC2626">- ${formatearCOP(r.descuentos)}</div></div>
                    <div style="flex:1;background:#F0FDF4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;text-align:center"><div style="font-size:11px;color:#166534">VENTAS NETAS</div><div style="font-size:16px;font-weight:800;color:#059669">${formatearCOP(r.ventas_netas)}</div></div>
                </div>
                <div style="margin-bottom:16px">
                    <div style="font-weight:700;font-size:12px;margin-bottom:6px">DESGLOSE POR MÉTODO DE PAGO</div>
                    <table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#F1F5F9"><th style="padding:6px 8px;text-align:left">Método</th><th style="padding:6px 8px;text-align:right">#</th><th style="padding:6px 8px;text-align:right">Subtotal</th></tr></thead><tbody>${desgloseHtml}</tbody></table>
                </div>
                <div style="background:#0F172A;color:#fff;border-radius:8px;padding:14px;margin-bottom:16px">
                    <div style="display:flex;justify-content:space-between;font-size:12px"><span>Base Inicial</span><span>${formatearCOP(j.monto_inicial)}</span></div>
                    <div style="display:flex;justify-content:space-between;font-size:12px"><span>Ventas Efectivo</span><span>${formatearCOP(r.ventas_brutas)}</span></div>
                    <div style="display:flex;justify-content:space-between;font-size:12px"><span>Propina Efectivo</span><span>${formatearCOP(r.propina_efectivo)}</span></div>
                    <div style="display:flex;justify-content:space-between;font-size:12px"><span>Gastos Caja Chica</span><span style="color:#F87171">- ${formatearCOP(r.gastos_efectivo)}</span></div>
                    <div style="border-top:1px solid #334155;margin:8px 0"></div>
                    <div style="display:flex;justify-content:space-between;font-weight:800"><span>ESPERADO EN CAJA</span><span>${formatearCOP(r.esperado)}</span></div>
                    <div style="display:flex;justify-content:space-between"><span>CONTEO FÍSICO</span><span>${formatearCOP(r.total_en_caja)}</span></div>
                    <div style="display:flex;justify-content:space-between;font-weight:800;color:${diffColor}"><span>DIFERENCIA [${diffLabel}]</span><span>${(diff>0?'+':'')+formatearCOP(diff)}</span></div>
                </div>
                <div style="font-size:11px;color:#64748B;display:flex;justify-content:space-between"><span>Apertura: ${j.usuario_apertura||'--'}</span><span>Cierre: ${j.usuario_cierre||'--'}</span></div>
                <div style="margin-top:16px;text-align:center"><a href="${process.env.APP_URL||'http://localhost:3000'}/api/jornada/${j.id_jornada}/reporte" style="background:#F59E0B;color:#1a1a2e;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:700;font-size:12px">Ver reporte completo</a></div>
                <div style="margin-top:12px;font-size:10px;color:#94A3B8;text-align:center">Backup automático generado al cierre en /backups/cierre-${j.id_jornada||''}-*.sql</div>
            </div>
        </div>`;
    const text = `Cierre #${j.id_jornada} ${j.barra_asignada} - Ventas brutas ${ventasBrutas} - Netas ${formatearCOP(r.ventas_netas)} - Esperado ${formatearCOP(r.esperado)} - Conteo ${formatearCOP(r.total_en_caja)} - Diferencia ${formatearCOP(diff)} [${diffLabel}]`;
    const fromUser = process.env.SMTP_USER || process.env.EMAIL_USER;
    await t.sendMail({ from:`"ClubMaster" <${fromUser}>`, to: destinatario, subject: asunto, text, html });
    return { mode:'smtp' };
}

// Envia un correo con el enlace de restablecimiento de contrasena.
// Si SMTP no esta configurado, imprime el enlace en consola.
async function enviarCorreoRecuperacion(correoDestino, nombre, token) {
    const base = process.env.APP_URL || 'http://localhost:3000';
    const enlace = `${base}/reiniciar-contrasena?token=${token}`;

    const asunto = 'Restablecer contraseña — ClubMaster';
    const text = `Hola ${nombre},\n\nRecibiste este correo porque solicitaste restablecer tu contraseña.\nEnlace directo (válido 15 min): ${enlace}\n\nSi no solicitaste este cambio, ignora este correo.`;
    const html = `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;border:1px solid #eee;border-radius:12px;padding:24px">
            <h2 style="color:#b45309">ClubMaster</h2>
            <p>Hola, ${nombre}.</p>
            <p>Recibiste este correo porque solicitaste restablecer tu contraseña.</p>
            <p>Enlace directo a la vista de reinicio (válido <strong>15 minutos</strong>):</p>
            <p style="word-break:break-all;background:#f8fafc;padding:12px;border-radius:8px;border:1px solid #e2e8f0"><a href="${enlace}">${enlace}</a></p>
            <p style="text-align:center;margin:24px 0">
                <a href="${enlace}" style="background:#f59e0b;color:#1a1a2e;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">
                    Restablecer contraseña
                </a>
            </p>
            <p style="color:#888;font-size:12px">Si no solicitaste este cambio, ignora este correo.</p>
        </div>
    `;

    const t = obtenerTransporter();

    // Sin SMTP configurado -> modo desarrollo: solo log en servidor, nunca exponer en respuesta.
    if (!t) {
        console.log('=== RECUPERACION DE CONTRASENA (SMTP no configurado - solo log servidor) ===');
        console.log('Para:', correoDestino, '| Nombre:', nombre);
        console.log('Enlace (valido 15 min):', enlace);
        console.log('=================================================================');
        return { mode: 'consola' };
    }

    const fromUser = process.env.SMTP_USER || process.env.EMAIL_USER;
    await t.sendMail({
        from: `"ClubMaster" <${fromUser}>`,
        to: correoDestino,
        subject: asunto,
        text: text,
        html: html
    });

    return { mode: 'smtp' };
}

module.exports = { enviarCorreoRecuperacion, enviarReporteCierre };
