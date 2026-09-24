const net = require('net');
const { pool } = require('../config/database');

const ESC = 0x1B;
const GS = 0x1D;
const CMD_CUT = Buffer.from([GS, 0x56, 0x42, 0x00]);
const CMD_DRAWER = Buffer.from([ESC, 0x70, 0x00, 0x19, 0xFA]);

function stripHtml(html){
  return html.replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim();
}

function buildEscPosBuffer(text, opts){
  const header = opts.isReprint ? '*** REIMPRESION / DUPLICADO ***\n' : '';
  const meta = opts.isReprint ? `Reimpreso: ${opts.fecha} por ${opts.usuario}\n` : '';
  const full = header + meta + text + '\n\n\n';
  const bufText = Buffer.from(full, 'latin1');
  const openDrawer = opts.abrirCajon ? CMD_DRAWER : Buffer.alloc(0);
  return Buffer.concat([bufText, CMD_CUT, openDrawer]);
}

async function getImpresoraConfig(area){
  try{
    const [rows]=await pool.query(`SELECT clave, valor FROM configuracion_general WHERE clave LIKE 'imp_%'`);
    const map={};
    rows.forEach(r=>map[r.clave]=r.valor);
    const primaria = map[`imp_${area}`] || map['imp_barra_principal'] || map['imp_predeterminada'] || '';
    const secundaria = map['imp_respaldo'] || map[`imp_${area}_respaldo`] || map['imp_secundaria'] || '';
    return {primaria, secundaria, map};
  }catch(e){ return {primaria:'', secundaria:''}; }
}

function parseIp(ipStr){
  if(!ipStr) return null;
  const m = ipStr.trim().match(/^(\d+\.\d+\.\d+\.\d+)(?::(\d+))?$/);
  if(!m) return null;
  return {host:m[1], port: parseInt(m[2]||'9100',10)};
}

function sendRawTcp(host, port, buffer, timeoutMs=3000){
  return new Promise((resolve, reject)=>{
    const socket = new net.Socket();
    let settled=false;
    const timer=setTimeout(()=>{ if(!settled){settled=true; socket.destroy(); reject(new Error('timeout'));} }, timeoutMs);
    socket.connect(port, host, ()=>{
      socket.write(buffer, (err)=>{
        if(err){ if(!settled){settled=true; clearTimeout(timer); socket.destroy(); reject(err);} return; }
        if(!settled){settled=true; clearTimeout(timer); socket.end(); resolve({host, port});}
      });
    });
    socket.on('error', (err)=>{ if(!settled){settled=true; clearTimeout(timer); reject(err);} });
    socket.on('timeout', ()=>{ if(!settled){settled=true; socket.destroy(); reject(new Error('timeout'));} });
  });
}

async function enviarImpresion({area='barra_principal', text, html, isReprint=false, usuario='', fecha='', abrirCajon=false, tipo='comanda'}){
  const escPos = buildEscPosBuffer(html?stripHtml(html):text, {isReprint, usuario, fecha, abrirCajon});
  const cfg = await getImpresoraConfig(area);
  const intentos=[];
  const primaria = parseIp(cfg.primaria);
  const secundaria = parseIp(cfg.secundaria);
  if(primaria){
    try{
      await sendRawTcp(primaria.host, primaria.port, escPos);
      return {success:true, impresora: cfg.primaria, intento:'primaria'};
    }catch(e){
      intentos.push({impresora:cfg.primaria, error:e.message});
    }
  } else {
    intentos.push({impresora:cfg.primaria||'(no configurada)', error:'IP primaria no configurada'});
  }
  if(secundaria){
    try{
      await sendRawTcp(secundaria.host, secundaria.port, escPos);
      return {success:true, impresora: cfg.secundaria, intento:'secundaria', fallback:true, intentosPrevios:intentos};
    }catch(e){
      intentos.push({impresora:cfg.secundaria, error:e.message});
      return {success:false, error:'Ambas impresoras fallaron', intentos, requiereIntervencion:true};
    }
  }
  return {success:false, error: intentos[0]?.error||'Sin impresora configurada', intentos, requiereIntervencion:true};
}

async function enviarConReintentoSecundario(opts){
  const result = await enviarImpresion(opts);
  return result;
}

module.exports={ enviarImpresion, enviarConReintentoSecundario, getImpresoraConfig, CMD_DRAWER, CMD_CUT, buildEscPosBuffer };
