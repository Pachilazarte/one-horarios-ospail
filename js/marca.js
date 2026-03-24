/**
 * MARCA.JS — OSPAIL / SOEAIL
 * Proyecto independiente — una sola empresa
 */
const EMPRESA_ID = "ospail";
const EMPRESA = {
  id:             "ospail",
  nombre:         "OSPAIL",
  nombreCompleto: "OSPAIL — SOEAIL",
  bodyClass:      "empresa-ospail",
  colores: { primario:"#F26513", secundario:"#F2935C", acento:"#F26513" },
  logos: {
    full:     "assets/logos/ospail/logo-full.png",
    blanco:   "assets/logos/ospail/logo-blanco.png",
    negro:    "assets/logos/ospail/logo-negro.png",
    cuadrado: "assets/logos/ospail/logo-cuadrado.png",
    favicon:  "assets/logos/ospail/logo-favicon.png",
  },
  supabase: {
    url: "https://igumfuavaocnkbhfbpfu.supabase.co",
    key: "sb_publishable_zZYr1dfEQxPX9hFnn076qA_9n4ACsOi",
  },
  admin: { user: "admin", pass: "ospail2026" },
};

const MARCA = {
  empresas: { ospail: EMPRESA },
  superAdmin: { user: "superadmin", pass: "SuperAdmin2026!" },
  // Las áreas y colores vienen de la BD — no se hardcodean acá
  areaColors: {},   // se llena con cargarColoresAreas()
  areasCache: [],   // lista de áreas activas desde BD
  dias:      ["lunes","martes","miercoles","jueves","viernes","sabado","domingo"],
  diasLabel: ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"],
  diasFull:  ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"],
};

function aplicarMarca(empresaId) {
  document.body.classList.remove("empresa-ospail","empresa-ospa");
  document.body.classList.add("empresa-ospail");
  let fav = document.querySelector("link[rel='icon']");
  if (!fav) { fav = document.createElement("link"); fav.rel = "icon"; document.head.appendChild(fav); }
  fav.href = EMPRESA.logos.favicon;
  sessionStorage.setItem("empresaActiva", EMPRESA_ID);
}

// ── Carga áreas y colores desde BD ──
// Llamar una vez al iniciar cada página, después de initSB()
async function cargarColoresAreas() {
  if (!SB) return;
  try {
    const { data } = await SB.from('areas').select('nombre,color').eq('activa', true).order('nombre');
    if (!data?.length) return;
    MARCA.areasCache = data.map(a => a.nombre);
    data.forEach(a => {
      if (a.nombre && a.color) {
        MARCA.areaColors[a.nombre.toUpperCase()] = a.color;
      }
    });
  } catch (e) {
    console.warn('No se pudieron cargar colores de áreas:', e);
  }
}

// ── Devuelve el color del área desde la caché ──
function areaColor(area) {
  if (!area) return "#6be1e3";
  const upper = area.toUpperCase();
  return MARCA.areaColors[upper] || MARCA.areaColors[Object.keys(MARCA.areaColors).find(k => upper.includes(k))||''] || "#6be1e3";
}