// Iniciales para avatar a partir de un nombre completo (ej. "Santiago Vargas" -> "SV").
// El modelo de usuario no guarda foto de perfil — este es el reemplazo consistente en
// toda la UI, nunca una imagen de stock.
function iniciales(nombre) {
  if (!nombre) return '?';
  const partes = nombre.trim().split(/\s+/);
  const primera = partes[0]?.[0] || '';
  const segunda = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (primera + segunda).toUpperCase();
}

export default iniciales;
