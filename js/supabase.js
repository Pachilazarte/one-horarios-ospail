/* supabase.js — cliente dinámico según empresa activa */
let SB = null;

function initSB(empresaId) {
  const emp = MARCA.empresas[empresaId];
  if (!emp) { console.error('Empresa no encontrada:', empresaId); return null; }
  SB = supabase.createClient(emp.supabase.url, emp.supabase.key);
  return SB;
}

