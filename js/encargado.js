/* encargado.js — Panel de encargado con grilla rápida de horarios */

let encSesion    = null;
let encSemActual = '';
let encSemViendo = '';
let encAllData   = [];
let encEditArea  = null;
let encEditRows  = [];
let encEditId    = null;
let encAreasAsig = [];

const DIAS_ENC   = ['lunes','martes','miercoles','jueves','viernes','sabado','domingo'];
const DIA_C_ENC  = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

function getSabEnc(l) {
  const d = new Date(l+'T12:00:00'); d.setDate(d.getDate()+6);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function getLunesEnc(f, off=0) {
  const d = new Date(f+'T12:00:00');
  const dow = d.getDay(), diff = dow===0 ? -6 : 1-dow;
  d.setDate(d.getDate()+diff+off*7);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function fmtDE(s) { if(!s) return ''; const[y,m,d]=s.split('-'); return `${d}/${m}`; }

// ── LOGIN ──────────────────────────────────────────────────────────
async function doLogin() {
  const u   = (document.getElementById('loginU').value||'').trim().toUpperCase();
  const p   = (document.getElementById('loginP').value||'');
  const err = document.getElementById('loginErr');
  const btn = document.getElementById('btnLogin');
  err.style.display = 'none';
  if (!u||!p) { err.textContent='Completá usuario y contraseña'; err.style.display=''; return; }

  btn.disabled = true; btn.textContent = '⏳ Verificando...';

  const { data, error } = await SB.from('encargados')
    .select('*').eq('usuario', u).eq('activo', true).maybeSingle();

  btn.disabled = false; btn.textContent = 'Ingresar →';

  if (error || !data) { err.textContent='Usuario no encontrado o inactivo'; err.style.display=''; return; }
  if (data.password !== p && data.password_hash !== p) { err.textContent='Contraseña incorrecta'; err.style.display=''; return; }

  encSesion = { ...data, empresaId: 'ospail' };
  Auth.setLider(encSesion);
  iniciarApp();
}

// ── APP INIT ──────────────────────────────────────────────────────
async function iniciarApp() {
  aplicarMarca(); initSB('ospail');
  const emp = MARCA.empresas['ospail'];

  document.getElementById('vLogin').style.display = 'none';
  document.getElementById('vLogin').classList.remove('show');
  document.getElementById('vApp').style.display = 'block';
  document.getElementById('hdrActions').style.display = 'flex';
  document.getElementById('hdrMark').style.backgroundImage = `url('${emp.logos.favicon}')`;
  document.getElementById('hdrNombre').innerHTML = `${emp.nombre} <span class="brand-gc">Horarios</span>`;
  document.getElementById('badgeEnc').textContent = `👤 ${encSesion.nombre}`;
  document.getElementById('footLogo').src = emp.logos.blanco;
  document.getElementById('footNombre').textContent = emp.nombreCompleto;
  document.getElementById('fav').href = emp.logos.favicon;
  document.getElementById('fechaAsiEnc').textContent =
    new Date().toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

  encAreasAsig = (encSesion.areas||[]).map(a => a.toUpperCase());
  encSemActual = getLunesEnc(today(), 0);
  encSemViendo = encSemActual;

  const sel = document.getElementById('selAreaAsi');
  encAreasAsig.forEach(a => {
    const o = document.createElement('option'); o.value=a; o.textContent=a; sel.appendChild(o);
  });

  await HorariosEnc.load();
  switchETab('hor');
}

function logoutEnc() { Auth.logoutLider(); window.location.href = 'encargado.html'; }

// ── TABS ──────────────────────────────────────────────────────────
function switchETab(t) {
  ['hor','asi','emp'].forEach(x => {
    document.getElementById('etab-'+x).style.display = x===t ? '' : 'none';
    document.getElementById('et-'+x).classList.toggle('active', x===t);
  });
  document.getElementById('btnEncCSV').style.display = t==='hor' ? '' : 'none';
  if (t==='asi') cargarAsistenciaEnc();
  if (t==='emp') cargarEmpleadosEnc();
}

/* ══════════════════════════════════════════════
   HORARIOS — GRILLA RÁPIDA
   ══════════════════════════════════════════════ */
const HorariosEnc = {

  async load() {
    const desde = encSemViendo, hasta = getSabEnc(desde);
    const semD  = new Date(desde+'T12:00:00'), semH = new Date(hasta+'T12:00:00');
    const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    const label = `${semD.getDate()} al ${semH.getDate()} de ${meses[semH.getMonth()]} ${semH.getFullYear()}`;
    document.getElementById('encWeekPill').textContent = `📅 ${label}`;
    document.getElementById('encSemLabel').textContent = `Semana del ${fmtDate(desde)} al ${fmtDate(hasta)}`;

    const { data } = await SB.from('horarios_semanales').select('*')
      .eq('semana_desde', desde)
      .in('area', encAreasAsig.length ? encAreasAsig : ['__none__']);
    encAllData = data || [];
    this._renderIndicador();
    this._renderGrid();
  },

  movSem(dir) { encSemViendo = getLunesEnc(encSemViendo, dir); this.load(); },

  _renderIndicador() {
    const wrap = document.getElementById('encAreaIndicador'); if (!wrap) return;
    const byArea = {}; encAllData.forEach(r => byArea[r.area] = r);
    wrap.innerHTML = encAreasAsig.map(a => {
      const ok = !!byArea[a];
      return `<span onclick="HorariosEnc.openArea('${a}')"
        style="cursor:pointer;padding:4px 14px;border-radius:999px;font-size:11px;font-weight:800;white-space:nowrap;
          background:${ok?'rgba(34,197,94,.12)':'rgba(239,68,68,.1)'};
          border:1px solid ${ok?'rgba(34,197,94,.3)':'rgba(239,68,68,.3)'};
          color:${ok?'var(--color-success-text)':'var(--color-danger-text)'};">
        ${ok?'✓':'⚠'} ${a.split(' ')[0]}
      </span>`;
    }).join('');
  },

  _renderGrid() {
    const grid = document.getElementById('encAreaGrid'); if (!grid) return;
    const byArea = {}; encAllData.forEach(r => byArea[r.area] = r);
    grid.innerHTML = encAreasAsig.map(area => {
      const row = byArea[area], col = areaColor(area);
      const personas = row ? this._flat([row]) : [];
      const totalHs  = personas.reduce((a,p) => a+this._hs(p), 0);
      const badge = row
        ? `<span class="badge badge-green" style="font-size:10px;">✓ ${personas.length} · ${fmtHs(totalHs)}</span>`
        : `<span class="badge badge-red"   style="font-size:10px;">⚠ Sin cargar</span>`;

      const persHtml = personas.slice(0,4).map(p => {
        const hs = this._hs(p);
        const primerFijo = DIAS_ENC.map(d=>p[d]).find(d=>d.tipo==='normal'&&d.e);
        const hayFlex = DIAS_ENC.some(d=>p[d].tipo==='flex');
        const hayGuardia = DIAS_ENC.some(d=>p[d].tipo==='guardia');
        let badge2 = '';
        if (hayFlex)    badge2 += `<span style="font-size:9px;color:#a78bfa;margin-left:3px;">Flex</span>`;
        if (hayGuardia) badge2 += `<span style="font-size:9px;color:#e4c76a;margin-left:3px;">Guardia</span>`;
        const horStr = primerFijo
          ? `<span style="font-size:10px;color:rgba(198,201,215,.4);margin-left:4px;">${primerFijo.e}${primerFijo.s?' → '+primerFijo.s:''}</span>`
          : '';
        return `<div style="display:flex;align-items:center;justify-content:space-between;padding:3px 0;border-bottom:1px solid rgba(198,201,215,.05);">
          <div><span style="font-size:12px;font-weight:700;">${p.nombre}</span>${horStr}${badge2}</div>
          <span style="font-size:11px;color:var(--c1);font-weight:700;flex-shrink:0;margin-left:6px;">${hs>0?fmtHs(hs):'—'}</span>
        </div>`;
      }).join('');

      return `<div class="area-card" onclick="HorariosEnc.openArea('${area}')">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px;gap:8px;">
          <div>
            <div style="font-size:13px;font-weight:800;color:${col};">${area}</div>
            ${row?`<div style="font-size:11px;color:rgba(198,201,215,.4);margin-top:1px;">${personas.length} personas · ${fmtHs(totalHs)}</div>`:''}
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;">
            ${badge}
            <span style="font-size:9px;color:rgba(198,201,215,.28);">${row?'Editar →':'Cargar →'}</span>
          </div>
        </div>
        <div style="border-top:1px solid rgba(198,201,215,.07);padding-top:8px;min-height:40px;">
          ${row ? (persHtml+(personas.length>4?`<div style="font-size:11px;color:rgba(198,201,215,.35);">+${personas.length-4} más...</div>`:''))
                : '<div style="font-size:12px;color:rgba(198,201,215,.25);">Sin horarios cargados</div>'}
        </div>
      </div>`;
    }).join('');
  },

  // ── Helpers datos ──
  _flat(data) {
    const out = [];
    data.forEach(row => {
      (row.horarios||[]).forEach(h => {
        const p = { area:row.area, nombre:h.nombre, rol:h.rol||'' };
        DIAS_ENC.forEach(d => {
          p[d] = { e:h[d]?.e||'', s:h[d]?.s||'', e2:h[d]?.e2||'', s2:h[d]?.s2||'', tipo:h[d]?.tipo||'normal' };
        });
        out.push(p);
      });
    });
    return out;
  },

  _hs(p) {
    let t = 0;
    DIAS_ENC.forEach(d => {
      const di = p[d]||{};
      if (di.tipo==='guardia') { t+=1; return; }
      if (di.tipo==='flex'||di.tipo==='libre') return;
      const h1=calcHs(di.e,di.s), h2=calcHs(di.e2,di.s2);
      if(h1)t+=h1; if(h2)t+=h2;
    });
    return t;
  },

  _nh(raw) {
    if (!raw||!raw.trim()) return '';
    let s = raw.trim().replace(/[.,]/,':');
    let h, m;
    if (s.includes(':')) [h,m]=s.split(':');
    else if (s.length<=2) { h=s; m='0'; }
    else { h=s.slice(0,s.length-2); m=s.slice(-2); }
    h=parseInt(h,10); m=parseInt(m,10);
    if (isNaN(h)||isNaN(m)||h<0||h>23||m<0||m>59) return '';
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  },

  // ── Abrir modal ──
  async openArea(area) {
    encEditArea = area; encEditId = null; encEditRows = [];
    const existing = encAllData.find(r => r.area===area);
    encEditId = existing?.id || null;

    const { data:areaData } = await SB.from('areas').select('id').eq('nombre',area).maybeSingle();
    const areaId = areaData?.id;
    const { data:personal } = areaId
      ? await SB.from('empleados').select('nombre,apellido,rol').eq('area_id',areaId).eq('activo',true).order('apellido')
      : { data:[] };
    if (!personal?.length) { showToast('Sin personal activo en esta área','err'); return; }

    const savedMap = {};
    (existing?.horarios||[]).forEach(h => savedMap[h.nombre]=h);

    encEditRows = personal.map(p => {
      const nombre = `${p.apellido}, ${p.nombre}`;
      const sv = savedMap[nombre];
      const r = { nombre, rol:p.rol||'' };
      DIAS_ENC.forEach(d => {
        r[d] = { e:sv?.[d]?.e||'', s:sv?.[d]?.s||'', e2:sv?.[d]?.e2||'', s2:sv?.[d]?.s2||'', tipo:sv?.[d]?.tipo||'normal' };
      });
      return r;
    });

    const { data:antRow } = await SB.from('horarios_semanales').select('*')
      .eq('area',area).eq('semana_desde',getLunesEnc(encSemViendo,-1)).maybeSingle();

    const col = areaColor(area);
    document.getElementById('encMhAreaTitle').innerHTML = `<span style="color:${col};">${area}</span>`;
    document.getElementById('encMhSemLabel').textContent = `${fmtDE(encSemViendo)} al ${fmtDE(getSabEnc(encSemViendo))}`;
    document.getElementById('encMhAreaObs').value = existing?.observaciones||'';
    const btnAnt = document.getElementById('encBtnCopiarAnt');
    if (btnAnt) {
      const hay = antRow?.horarios?.length>0;
      btnAnt.style.display = hay?'':'none';
      btnAnt._antData = hay ? antRow.horarios : null;
    }

    this._renderTabla();
    document.getElementById('mHsemEnc').style.display='';
  },

  // ── GRILLA RÁPIDA ──
  _renderTabla() {
    const thead = document.getElementById('encHsHead');
    const tbody = document.getElementById('encHsBody');
    if (!thead||!tbody) return;

    const fArr = Array.from({length:7}, (_,i) => {
      const d = new Date(encSemViendo+'T12:00:00'); d.setDate(d.getDate()+i);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    });

    thead.innerHTML = `
      <th class="col-nombre">Persona</th>
      ${DIAS_ENC.map((d,i) => `<th>${DIA_C_ENC[i]}<br><span style="font-size:9px;opacity:.5;">${fmtDE(fArr[i])}</span></th>`).join('')}
      <th style="min-width:50px;text-align:right;padding-right:8px;">Hs</th>`;

    tbody.innerHTML = encEditRows.map((r, ri) => {
      const dias = DIAS_ENC.map((d) => {
        const di   = r[d] || {};
        const tipo = di.tipo || 'normal';
        const hasD = tipo!=='normal' || (di.e||di.s);
        const hcCls = tipo==='flex' ? 'hc tipo-flex'
          : tipo==='guardia' ? 'hc tipo-guardia'
          : tipo==='libre'   ? 'hc tipo-libre'
          : hasD ? 'hc tipo-normal has-data' : 'hc tipo-normal';

        let body = '';
        if (tipo==='flex') {
          body = `<div style="font-size:10px;color:#a78bfa;font-weight:800;padding:6px 0;">🔄 Flex</div>`;
        } else if (tipo==='guardia') {
          body = `<div style="font-size:10px;color:#e4c76a;font-weight:800;padding:6px 0;">🛡 1h</div>`;
        } else if (tipo==='libre') {
          body = `<div style="font-size:10px;color:var(--color-danger-text);font-weight:800;padding:6px 0;">🚫 Libre</div>`;
        } else {
          const show2 = di.show2 || di.e2 || di.s2;
          body = `
            <input class="hi ${di.e?'v':''}" type="text" maxlength="5" placeholder="09:00"
              value="${di.e}" data-ri="${ri}" data-d="${d}" data-k="e"
              onblur="HorariosEnc._onBlur(this)" oninput="HorariosEnc._onInput(this)"
              onkeydown="HorariosEnc._onKey(event,this)"/>
            <span class="hi-sep">→</span>
            <input class="hi ${di.s?'v':''}" type="text" maxlength="5" placeholder="17:00"
              value="${di.s}" data-ri="${ri}" data-d="${d}" data-k="s"
              onblur="HorariosEnc._onBlur(this)" oninput="HorariosEnc._onInput(this)"
              onkeydown="HorariosEnc._onKey(event,this)"/>
            ${show2 ? `
            <span class="hi-sep" style="color:#e4c76a;font-size:10px;">✂</span>
            <input class="hi gold ${di.e2?'v':''}" type="text" maxlength="5" placeholder="—"
              value="${di.e2}" data-ri="${ri}" data-d="${d}" data-k="e2"
              onblur="HorariosEnc._onBlur(this)" oninput="HorariosEnc._onInput(this)"
              onkeydown="HorariosEnc._onKey(event,this)"/>
            <span class="hi-sep">→</span>
            <input class="hi gold ${di.s2?'v':''}" type="text" maxlength="5" placeholder="—"
              value="${di.s2}" data-ri="${ri}" data-d="${d}" data-k="s2"
              onblur="HorariosEnc._onBlur(this)" oninput="HorariosEnc._onInput(this)"
              onkeydown="HorariosEnc._onKey(event,this)"/>` : `
            <button onclick="event.stopPropagation();event.preventDefault();encAdd2do(this)" data-ri="${ri}" data-d="${d}"
              style="font-size:9px;background:none;border:1px dashed rgba(228,199,106,.35);color:rgba(228,199,106,.55);cursor:pointer;padding:2px 6px;border-radius:4px;font-family:var(--font-title);margin-top:2px;"
              title="Agregar 2° turno">✂ 2°</button>`}`;
        }

        return `<td>
          <div class="${hcCls}">
            <div class="tipo-mini">
              <button class="tm ${tipo==='normal'?'on-fijo':''}"    onclick="event.stopPropagation();HorariosEnc._setTipo(${ri},'${d}','normal')"   title="Fijo">🕐</button>
              <button class="tm ${tipo==='flex'?'on-flex':''}"      onclick="event.stopPropagation();HorariosEnc._setTipo(${ri},'${d}','flex')"     title="Flex">🔄</button>
              <button class="tm ${tipo==='guardia'?'on-guardia':''}" onclick="event.stopPropagation();HorariosEnc._setTipo(${ri},'${d}','guardia')"  title="Guardia">🛡</button>
              <button class="tm ${tipo==='libre'?'on-libre':''}"    onclick="event.stopPropagation();HorariosEnc._setTipo(${ri},'${d}','libre')"    title="Libre">🚫</button>
            </div>
            ${body}
          </div>
        </td>`;
      }).join('');

      const tot = this._hs(r);
      return `<tr>
        <td class="col-nombre">
          <div style="font-weight:700;font-size:12px;">${r.nombre}</div>
          ${r.rol?`<div style="font-size:10px;color:rgba(198,201,215,.4);">${r.rol}</div>`:''}
        </td>
        ${dias}
        <td class="hs-tot" id="enc-tot-${ri}">${tot>0?fmtHs(tot):'—'}</td>
      </tr>`;
    }).join('');


  },

  _onInput(inp) { inp.classList.toggle('v', !!inp.value.trim()); },

  _onBlur(inp) {
    const ri=+inp.dataset.ri, d=inp.dataset.d, k=inp.dataset.k;
    const val = this._nh(inp.value);
    inp.value = val;
    inp.classList.toggle('v', !!val);
    if (!encEditRows[ri][d]) encEditRows[ri][d] = {e:'',s:'',e2:'',s2:'',tipo:'normal'};
    encEditRows[ri][d][k] = val;
    this._updTot(ri);
  },

  _onKey(ev, inp) {
    if (ev.key==='Enter'||ev.key==='Tab') {
      if (ev.key==='Enter') ev.preventDefault();
      const all = [...document.querySelectorAll('#encHsBody input.hi')];
      const idx = all.indexOf(inp);
      if (idx>=0 && idx<all.length-1) { all[idx+1].focus(); all[idx+1].select(); }
    }
  },

  _setTipo(ri, d, tipo) {
    if (!encEditRows[ri][d]) encEditRows[ri][d]={e:'',s:'',e2:'',s2:'',tipo:'normal'};
    encEditRows[ri][d].tipo = tipo;
    if (tipo!=='normal') {
      encEditRows[ri][d].e=''; encEditRows[ri][d].s='';
      encEditRows[ri][d].e2=''; encEditRows[ri][d].s2='';
    }
    this._renderTabla();
    this._updTot(ri);
  },

  _add2do(ri, d) {
    if (!encEditRows[ri][d]) encEditRows[ri][d]={e:'',s:'',e2:'',s2:'',tipo:'normal'};
    encEditRows[ri][d].show2 = true;
    this._renderTabla();
    setTimeout(() => {
      const all = [...document.querySelectorAll('#encHsBody input.hi.gold[data-d="'+d+'"]')];
      if (all.length) { all[0].focus(); all[0].select(); }
    }, 50);
  },

  _updTot(ri) {
    const el = document.getElementById(`enc-tot-${ri}`); if(!el) return;
    const tot = this._hs(encEditRows[ri]);
    el.textContent = tot>0 ? fmtHs(tot) : '—';
  },

  copiarAnt() {
    const btn = document.getElementById('encBtnCopiarAnt');
    if (!btn?._antData) return;
    const m = {};
    btn._antData.forEach(h => m[h.nombre]=h);
    let c = 0;
    encEditRows.forEach(r => {
      const a = m[r.nombre]; if(!a) return;
      DIAS_ENC.forEach(d => {
        r[d] = { e:a[d]?.e||'', s:a[d]?.s||'', e2:a[d]?.e2||'', s2:a[d]?.s2||'', tipo:a[d]?.tipo||'normal' };
      });
      c++;
    });
    this._renderTabla();
    showToast(`✓ ${c} horario(s) copiados`);
  },

  async saveArea() {
    const btn = document.getElementById('encBtnSave');
    btn.disabled=true; btn.textContent='⏳ Guardando...';

    const horarios = encEditRows.map(r => {
      const obj = { nombre:r.nombre, rol:r.rol };
      DIAS_ENC.forEach(d => { obj[d] = { ...r[d] }; });
      return obj;
    });

    const payload = {
      semana_desde:  encSemViendo,
      semana_hasta:  getSabEnc(encSemViendo),
      area:          encEditArea,
      observaciones: document.getElementById('encMhAreaObs').value.trim()||null,
      horarios,
    };

    let error;
    if (encEditId) {
      ({error} = await SB.from('horarios_semanales').update(payload).eq('id',encEditId));
    } else {
      const res = await SB.from('horarios_semanales').insert(payload).select('id').maybeSingle();
      error = res.error;
      if (!error && res.data?.id) encEditId = res.data.id;
    }

    btn.disabled=false; btn.textContent='✓ Guardar horarios';
    if (error) { showToast('Error: '+error.message,'err'); return; }
    showToast(`✓ Horarios de ${encEditArea} guardados`);
    this.closeModal();
    this.load();
  },

  closeModal() {
    document.getElementById('mHsemEnc').style.display='none';
    encEditArea=null; encEditRows=[]; encEditId=null;
  },

  exportCSV() {
    const out = [];
    encAllData.forEach(row => {
      (row.horarios||[]).forEach(h => {
        const p = [`"${row.area}"`,`"${h.nombre}"`,`"${h.rol||''}"`];
        DIAS_ENC.forEach(d => {
          p.push(`"${h[d]?.tipo||'normal'}"`,`"${h[d]?.e||''}"`,`"${h[d]?.s||''}"`);
        });
        out.push(p.join(','));
      });
    });
    if (!out.length) { showToast('Sin datos','err'); return; }
    const cols = ['Área','Nombre','Rol',...DIAS_ENC.flatMap(d=>[`${d}_tipo`,`${d}_E`,`${d}_S`])];
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\uFEFF'+[cols.join(','),...out].join('\n')],{type:'text/csv;charset=utf-8;'}));
    a.download = `horarios_${encSemViendo}.csv`;
    a.click();
  },
};

// ── ASISTENCIA ────────────────────────────────────────────────────
async function cargarAsistenciaEnc() {
  const areaFiltro = document.getElementById('selAreaAsi').value;
  const hoy = today();
  const tbody = document.getElementById('tbAsiEnc');
  tbody.innerHTML='<tr><td colspan="6" style="text-align:center;padding:20px;"><span class="sp"></span></td></tr>';

  let q = SB.from('registros_asistencia')
    .select('*, empleados(nombre,apellido), areas(nombre)').eq('fecha',hoy);
  if (areaFiltro) q = q.eq('areas.nombre', areaFiltro);
  else if (encAreasAsig.length) q = q.in('areas.nombre', encAreasAsig);

  const { data } = await q.order('hora_entrada');
  if (!data?.length) {
    tbody.innerHTML='<tr><td colspan="6" style="text-align:center;padding:30px;color:rgba(198,201,215,.3);">Sin registros hoy</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(r => {
    const nombre  = r.empleados ? `${r.empleados.apellido}, ${r.empleados.nombre}` : '—';
    const area    = r.areas?.nombre||'—';
    const entrada = r.hora_entrada ? new Date(r.hora_entrada).toTimeString().slice(0,5) : '—';
    const salida  = r.hora_salida  ? new Date(r.hora_salida).toTimeString().slice(0,5)  : '<span style="color:#e4c76a;">En curso</span>';
    const dur     = r.hora_entrada&&r.hora_salida
      ? fmtHs(calcHs(new Date(r.hora_entrada).toTimeString().slice(0,5), new Date(r.hora_salida).toTimeString().slice(0,5)))
      : '—';
    const est = r.estado==='presente'
      ? '<span class="badge badge-green">Presente</span>'
      : `<span class="badge badge-gray">${r.estado||'—'}</span>`;
    return `<tr>
      <td style="font-weight:700;">${nombre}</td>
      <td style="color:${areaColor(area)};font-weight:800;font-size:11px;">${area}</td>
      <td style="font-family:monospace;font-weight:700;">${entrada}</td>
      <td style="font-family:monospace;">${salida}</td>
      <td>${est}</td>
      <td style="color:rgba(198,201,215,.6);">${dur}</td>
    </tr>`;
  }).join('');
}

// ── EMPLEADOS ─────────────────────────────────────────────────────
async function cargarEmpleadosEnc() {
  const lista = document.getElementById('listaEmpEnc');
  lista.innerHTML='<div style="text-align:center;padding:30px;"><span class="sp"></span></div>';
  let ids=[];
  if (encAreasAsig.length) {
    const{data}=await SB.from('areas').select('id').in('nombre',encAreasAsig);
    ids=(data||[]).map(a=>a.id);
  }
  if (!ids.length) { lista.innerHTML='<p style="color:rgba(198,201,215,.3);padding:20px;">Sin empleados asignados</p>'; return; }
  const{data}=await SB.from('empleados').select('*, areas(nombre)').in('area_id',ids).eq('activo',true).order('apellido');
  if (!data?.length) { lista.innerHTML='<p style="color:rgba(198,201,215,.3);padding:20px;">Sin empleados activos en tus áreas</p>'; return; }
  lista.innerHTML = data.map(e => {
    const col  = areaColor(e.areas?.nombre||'');
    const init = `${e.nombre?.[0]||''}${e.apellido?.[0]||''}`.toUpperCase();
    return `<div class="stat-card" style="border-radius:14px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:44px;height:44px;border-radius:50%;border:2px solid ${col};background:${col}18;
          display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800;color:${col};flex-shrink:0;">
          ${init}
        </div>
        <div>
          <div style="font-weight:800;font-size:14px;">${e.apellido}, ${e.nombre}</div>
          <div style="font-size:11px;color:rgba(198,201,215,.45);">
            ${e.rol||'—'} · <span style="color:${col};">${e.areas?.nombre||'—'}</span>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── GLOBAL WRAPPER para onclick en HTML ──────────────────────────
function encAdd2do(btn) {
  const ri = +btn.dataset.ri;
  const d  = btn.dataset.d;
  HorariosEnc._add2do(ri, d);
}

// ── INIT ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  aplicarMarca(); initSB('ospail');
  const ses = Auth.getLider();
  if (ses) {
    encSesion = ses;
    iniciarApp();
  } else {
    document.getElementById('vLogin').style.display = 'flex';
    document.getElementById('vLogin').classList.add('show');
    setTimeout(() => { const el=document.getElementById('loginU'); if(el) el.focus(); }, 100);
  }
});