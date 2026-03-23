/* utils.js — Control de Horarios */

// ── TOAST ──────────────────────────────────────────────────────────
function showToast(msg, type = 'ok') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast ' + type;
  t.classList.add('show');
  clearTimeout(t._to);
  t._to = setTimeout(() => t.classList.remove('show'), 3000);
}

// ── FECHAS ──────────────────────────────────────────────────────────
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function fmtDate(s) {
  if (!s) return '—';
  const [y,m,d] = s.split('-');
  return `${d}/${m}/${y}`;
}

function fmtHora(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function fmtHs(hs) {
  if (hs === null || hs === undefined) return '—';
  const h = Math.floor(hs);
  const m = Math.round((hs - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// Lunes de la semana de una fecha dada
function getLunes(fechaStr, offsetWeeks = 0) {
  const d = new Date(fechaStr + 'T12:00:00');
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff + offsetWeeks * 7);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getSab(lunesStr) {
  const d = new Date(lunesStr + 'T12:00:00');
  d.setDate(d.getDate() + 6);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getDayKey(fechaStr) {
  const d = new Date(fechaStr + 'T12:00:00');
  if (isNaN(d)) return null;
  return ['domingo','lunes','martes','miercoles','jueves','viernes','sabado'][d.getDay()];
}

function labelSemana(lunesStr) {
  const sab = getSab(lunesStr);
  return `${fmtDate(lunesStr)} — ${fmtDate(sab)}`;
}

// ── CÁLCULOS DE HORAS ───────────────────────────────────────────────
function calcHs(e, s) {
  if (!e || !s) return null;
  const [eh,em] = e.split(':').map(Number);
  const [sh,sm] = s.split(':').map(Number);
  if (isNaN(eh)||isNaN(sh)) return null;
  let d = (sh*60+sm)-(eh*60+em);
  if (d < 0) d += 24*60;
  return d / 60;
}

function calcTard(planStr, realStr) {
  if (!planStr||!realStr) return null;
  const [ph,pm] = planStr.split(':').map(Number);
  const [rh,rm] = realStr.split(':').map(Number);
  if (isNaN(ph)||isNaN(rh)) return null;
  return (rh*60+rm)-(ph*60+pm);
}

function calcExtra(planSalStr, realSalStr) {
  if (!planSalStr||!realSalStr) return null;
  const [ph,pm] = planSalStr.split(':').map(Number);
  const [rh,rm] = realSalStr.split(':').map(Number);
  return (rh*60+rm)-(ph*60+pm);
}

// ── TARDANZA BADGE ──────────────────────────────────────────────────
const ARROW = '→';

function tardBadge(diff) {
  if (diff === null) return '<span class="badge badge-gray">—</span>';
  if (diff <= 0) return `<span class="badge badge-green">✓ Puntual</span>`;
  if (diff <= 5) return `<span class="badge badge-gold">+${diff}m</span>`;
  return `<span class="badge badge-red">+${diff}m tarde</span>`;
}

function tardInfoText(diff) {
  if (diff === null) return { text: '', color: 'transparent' };
  if (diff <= 0) return { text: `✓ Puntual ${diff < 0 ? '('+Math.abs(diff)+'m antes)' : ''}`, color: 'var(--color-success-text)' };
  if (diff <= 5) return { text: `⚠ ${diff}m de demora`, color: 'var(--color-warn-text)' };
  return { text: `⚠ ${diff} min tarde`, color: 'var(--color-danger-text)' };
}

// ── HORARIO PLANIFICADO ─────────────────────────────────────────────
async function getHorarioPlanificado(SB, nombre, fecha) {
  const lunes  = getLunes(fecha);
  const dayKey = getDayKey(fecha);
  if (!dayKey) return null;

  const { data, error } = await SB
    .from('horarios_semanales')
    .select('area, horarios')
    .eq('semana_desde', lunes);

  if (error || !data?.length) return null;

  for (const row of data) {
    const horarios = row.horarios;
    if (!Array.isArray(horarios) || !horarios.length) continue;
    const persona = horarios.find(h => h.nombre === nombre);
    if (!persona) continue;
    const diaData = persona[dayKey];
    if (!diaData) continue;
    const tipo = diaData.tipo || 'normal';
    if (tipo === 'flex')    return { entrada:null, salida:null, tipo:'flex' };
    if (tipo === 'guardia') return { entrada:null, salida:null, tipo:'guardia' };
    const entrada = diaData.e || '';
    const salida  = diaData.s  || '';
    if (!entrada && !salida) continue;
    return {
      entrada:  entrada ? entrada.slice(0,5) : null,
      salida:   salida  ? salida.slice(0,5)  : null,
      entrada2: diaData.e2 ? diaData.e2.slice(0,5) : null,
      salida2:  diaData.s2 ? diaData.s2.slice(0,5) : null,
      tipo: 'normal',
    };
  }
  return null;
}

// ── SELFIE ─────────────────────────────────────────────────────────
async function capturarSelfie() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:16px;';
    overlay.innerHTML = `
      <p style="color:#fff;font-weight:700;font-size:16px;text-align:center;">📷 Sacate una selfie para confirmar tu identidad</p>
      <video id="sv" autoplay playsinline style="border-radius:16px;width:100%;max-width:320px;aspect-ratio:1;object-fit:cover;border:2px solid var(--c1);"></video>
      <canvas id="sc" style="display:none;"></canvas>
      <div style="display:flex;gap:10px;">
        <button id="sb-cap" style="background:var(--c1,#F26513);border:none;color:#fff;padding:13px 28px;border-radius:999px;font-size:15px;font-weight:800;cursor:pointer;">📸 Capturar</button>
        <button id="sb-can" style="background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);color:rgba(255,255,255,.7);padding:12px 22px;border-radius:999px;font-size:14px;font-weight:700;cursor:pointer;">Omitir</button>
      </div>`;
    document.body.appendChild(overlay);
    const video  = overlay.querySelector('#sv');
    const canvas = overlay.querySelector('#sc');
    const btnCap = overlay.querySelector('#sb-cap');
    const btnCan = overlay.querySelector('#sb-can');
    let stream;

    navigator.mediaDevices.getUserMedia({ video:{ facingMode:'user' }, audio:false })
      .then(s => { stream = s; video.srcObject = s; })
      .catch(() => { document.body.removeChild(overlay); resolve(null); });

    btnCap.onclick = () => {
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video,0,0);
      const img = canvas.toDataURL('image/jpeg', 0.7);
      if (stream) stream.getTracks().forEach(t=>t.stop());
      document.body.removeChild(overlay);
      resolve(img);
    };
    btnCan.onclick = () => {
      if (stream) stream.getTracks().forEach(t=>t.stop());
      document.body.removeChild(overlay);
      resolve(null);
    };
  });
}

// ── PIN ────────────────────────────────────────────────────────────
function pinValido(pin) { return pin && pin.length === 4 && /^\d{4}$/.test(pin); }

