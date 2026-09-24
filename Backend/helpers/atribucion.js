// helper atribucion: unica fuente de verdad para mesero vs cajero
// Mesero (responsable de la mesa/venta): quien abre o atiende la mesa (titular de cuenta), a el se le atribuyen ventas, descuentos, propinas y comisiones.
// Cajero (quien cobra): usuario que registra el pago, para caja/arqueo/cierre/auditoria, nunca reemplaza al mesero en ventas.

function esRolMesero(rol) {
  const r = String(rol || '').toLowerCase();
  return r.indexOf('mesero') !== -1 || r.indexOf('mesera') !== -1;
}
function esRolCajero(rol) {
  const r = String(rol || '').toLowerCase();
  return r.indexOf('cajer') !== -1;
}
function esAdmin(rol, id_rol) {
  if (Number(id_rol) === 1) return true;
  const r = String(rol || '').toLowerCase();
  return r === 'administrador' || r === 'admin' || r.indexOf('admin') !== -1;
}
function esSupervisor(rol, id_rol) {
  const r = String(rol || '').toLowerCase();
  return r.indexOf('gerente') !== -1 || r.indexOf('supervisor') !== -1 || Number(id_rol) === 9;
}
function puedeTransferir(rol, id_rol) {
  return esAdmin(rol, id_rol) || esSupervisor(rol, id_rol);
}

// Expresiones SQL unicas para agrupar
function exprMeseroId(tablaAlias) {
  // tablaAlias = 'ped' o 'f' etc; asume columna id_mesero nullable, fallback a id_usuario
  return `COALESCE(${tablaAlias}.id_mesero, ${tablaAlias}.id_usuario)`;
}
function exprCajeroId(tablaAlias) {
  return `COALESCE(${tablaAlias}.id_cajero, ${tablaAlias}.id_usuario)`;
}
function exprMeseroNombre(joinAliasMesero, joinAliasUsuario) {
  // joinAliasMesero = u2, joinAliasUsuario = u
  if (joinAliasMesero) return `COALESCE(${joinAliasMesero}.nombre, ${joinAliasUsuario}.nombre, 'Sin mesero registrado')`;
  return `COALESCE(${joinAliasUsuario}.nombre, 'Sin mesero registrado')`;
}
function exprCajeroNombre(joinAliasCajero, joinAliasUsuario) {
  if (joinAliasCajero) return `COALESCE(${joinAliasCajero}.nombre, ${joinAliasUsuario}.nombre, '--')`;
  return `COALESCE(${joinAliasUsuario}.nombre, '--')`;
}

// Para config futura de reparto de propinas
const MODO_REPARTO_PROPINA = {
  TITULAR: 'titular', // 100% al mesero titular (actual)
  BOLSA_COMUN: 'bolsa_comun' // equitativa por turno (futuro)
};

function extensionRepartoPropina(modo) {
  // punto unico de extension, no implementar logica ahora
  if (!modo || modo === MODO_REPARTO_PROPINA.TITULAR) return { modo: MODO_REPARTO_PROPINA.TITULAR };
  if (modo === MODO_REPARTO_PROPINA.BOLSA_COMUN) return { modo: MODO_REPARTO_PROPINA.BOLSA_COMUN };
  return { modo: MODO_REPARTO_PROPINA.TITULAR };
}

module.exports = {
  esRolMesero,
  esRolCajero,
  esAdmin,
  esSupervisor,
  puedeTransferir,
  exprMeseroId,
  exprCajeroId,
  exprMeseroNombre,
  exprCajeroNombre,
  MODO_REPARTO_PROPINA,
  extensionRepartoPropina
};
