/* registros.js — Módulo registros */
const Registros = (() => {
  let allRegs = [];

  const RANGOS = {
    hoy:         () => { const d=today(); return{desde:d,hasta:d}; },
    ayer:        () => { const d=new Date(); d.setDate(d.getDate()-1); const s=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; return{desde:s,hasta:s}; },
    semana:      () => { const l=getLunes(today()); return{desde:l,hasta:getSab(l)}; },
    semana_ant:  () => { const l=getLunes(today(),-1); return{desde:l,hasta:getSab(l)}; },
    mes:         () => { const d=new Date(); return{desde:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`,hasta:today()}; },
    mes_ant:     () => { const d=new Date(); d.setMonth(d.getMonth()-1); const y=d.getFullYear(),m=d.getMonth()+1,last=new Date(y,m,0).getDate(); return{desde:`${y}-${String(m).padStart(2,'0')}-01`,hasta:`${y}-${String(m).padStart(2,'0')}-${last}`}; },
    anio:        () => { return{desde:`${new Date().getFullYear()}-01-01`,hasta:today()}; },
    dia_especifico: () => { const v=document.getElementById('fDiaEsp')?.value||today(); return{desde:v,hasta:v}; },
    custom:      () => { return{desde:document.getElementById('fDes')?.value||today(),hasta:document.getElementById('fHas')?.value||today()}; },
    todos:       () => { return{desde:'2020-01-01',hasta:'2099-12-31'}; },
  };

  function changePer() {
    const v = document.getElementById('fPer').value;
    document.getElementById('fCDiaEsp').style.display = v==='dia_especifico'?'':'none';
    document.getElementById('fCDes').style.display    = v==='custom'?'':'none';
    document.getElementById('fCHas').style.display    = v==='custom'?'':'none';
    load();
  }

  async function load() {
    const per  = document.getElementById('fPer')?.value || 'mes';
    const area = document.getElementById('fArea')?.value || '';
    const range = RANGOS[per] ? RANGOS[per]() : RANGOS.mes();
    const tbody = document.getElementById('tbR');
    if (tbody) tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;padding:30px;color:rgba(198,201,215,.28);"><span class="sp"></span></td></tr>';

    let q = SB.from('registros_asistencia')
      .select('*, empleados(nombre,apellido,rol), areas(nombre)')
      .gte('fecha', range.desde)
      .lte('fecha', range.hasta)
      .order('fecha', {ascending:false});
    if (area) q = q.eq('areas.nombre', area);

    const { data, error } = await q;
    if (error) { showToast('Error al cargar registros','err'); return; }

    allRegs = (data||[]).map(r => ({
      ...r,
      nombre:       r.empleados ? `${r.empleados.apellido}, ${r.empleados.nombre}` : '—',
      rol:          r.empleados?.rol || '',
      area:         r.areas?.nombre || '—',
      hora_entrada: r.hora_entrada ? new Date(r.hora_entrada).toTimeString().slice(0,5) : null,
      hora_salida:  r.hora_salida  ? new Date(r.hora_salida).toTimeString().slice(0,5)  : null,
    }));
    render();
  }

  function render() {
    const busq = (document.getElementById('fBusq')?.value||'').toLowerCase();
    const rows = allRegs.filter(r => !busq || r.nombre.toLowerCase().includes(busq) || (r.rol||'').toLowerCase().includes(busq));
    const tbody = document.getElementById('tbR');
    if (!tbody) return;
    if (!rows.length) { tbody.innerHTML='<tr><td colspan="12" style="text-align:center;padding:40px;color:rgba(198,201,215,.28);">Sin registros</td></tr>'; return; }

    tbody.innerHTML = rows.map((r,i) => {
      const hs = calcHs(r.hora_entrada, r.hora_salida);
      const turno = r.turno||'';
      const esFlex=turno==='Flex', esGuardia=turno==='Guardia';
      let diff=null;
      if(!esFlex&&!esGuardia&&turno.includes(':')&&r.hora_entrada){
        const pe=turno.split('→')[0].trim();
        if(pe.match(/^\d{2}:\d{2}$/)) diff=calcTard(pe,r.hora_entrada);
      }
      const col = areaColor(r.area);
      let tardCell;
      if (esFlex)    tardCell='<span class="badge badge-purple">🔄 Flex</span>';
      else if (esGuardia) tardCell='<span class="badge badge-gold">🛡 Guardia</span>';
      else           tardCell=tardBadge(diff);

      return `<tr>
        <td style="color:rgba(198,201,215,.3);font-size:11px;">${i+1}</td>
        <td><span style="color:${col};font-weight:800;font-size:11px;">${r.area.split(' ')[0]}</span></td>
        <td style="font-weight:700;">${r.nombre}</td>
        <td class="hide-mobile" style="color:rgba(198,201,215,.58);font-size:12px;">${r.rol||'—'}</td>
        <td style="white-space:nowrap;">${fmtDate(r.fecha)}</td>
        <td class="hide-mobile" style="font-size:12px;color:rgba(198,201,215,.6);">${turno||'—'}</td>
        <td style="font-weight:700;">${r.hora_entrada||'—'}</td>
        <td style="color:rgba(198,201,215,.62);">${r.hora_salida||'—'}</td>
        <td><span class="badge badge-c1">${hs!==null?fmtHs(hs):'—'}</span></td>
        <td>${tardCell}</td>
        <td class="hide-mobile" style="color:rgba(198,201,215,.42);font-size:12px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.observaciones||'—'}</td>
        <td class="no-print"><div style="display:flex;gap:4px;">
          <button class="btn btn-ghost" style="padding:4px 8px;font-size:11px;" onclick="Registros.openEdit('${r.id}')">✏</button>
          <button class="btn btn-danger" onclick="Registros.del('${r.id}')">✕</button>
        </div></td>
      </tr>`;
    }).join('');
  }

  async function _cargarNombresModal(area, nombreActual='') {
    const sel = document.getElementById('erN'); if(!sel) return;
    sel.innerHTML = '<option value="">Cargando...</option>';
    const { data } = await SB.from('empleados').select('nombre,apellido').eq('activo',true).order('apellido');
    sel.innerHTML = '<option value="">Seleccionar...</option>';
    (data||[]).forEach(p => {
      const o=document.createElement('option');
      o.value=`${p.apellido}, ${p.nombre}`;
      o.textContent=`${p.apellido}, ${p.nombre}`;
      if (o.value===nombreActual) o.selected=true;
      sel.appendChild(o);
    });
  }

  function openEdit(id) {
    const r=allRegs.find(x=>x.id===id); if(!r) return;
    document.getElementById('erId').value  = id;
    document.getElementById('erA').value   = r.area||'';
    document.getElementById('erF').value   = r.fecha||'';
    document.getElementById('erT').value   = r.turno||'';
    document.getElementById('erE').value   = r.hora_entrada||'';
    document.getElementById('erS').value   = r.hora_salida||'';
    document.getElementById('erO').value   = (r.observaciones||'').replace(/\s*\|\s*2° turno:.*$/,'').trim();
    const match=(r.observaciones||'').match(/2° turno:\s*(\d{2}:\d{2})(?:\s*→\s*(\d{2}:\d{2}))?/);
    document.getElementById('erE2').value  = match?.[1]||'';
    document.getElementById('erS2').value  = match?.[2]||'';
    document.getElementById('mReg').style.display = '';
    _cargarNombresModal(r.area||'', r.nombre||'');
  }

  function closeModal() { document.getElementById('mReg').style.display='none'; }

  function _onAreaChange(area) { _cargarNombresModal(area,''); }

  async function save() {
    const id    = document.getElementById('erId').value;
    const area  = document.getElementById('erA').value;
    const nombre= document.getElementById('erN').value;
    const fecha = document.getElementById('erF').value;
    const t     = document.getElementById('erT').value;
    const e     = document.getElementById('erE').value;
    const s     = document.getElementById('erS').value;
    const e2    = document.getElementById('erE2').value;
    const s2    = document.getElementById('erS2').value;
    const o     = document.getElementById('erO').value.replace(/\s*\|\s*2° turno:.*$/,'').trim();
    if(!area||!nombre||!fecha){showToast('Área, nombre y fecha son obligatorios','err');return;}
    let obsFinal = o||null;
    if(e2){const t2str=e2+(s2?' → '+s2:'');obsFinal=(o?o+' | ':'')+' 2° turno: '+t2str;}
    const { error } = await SB.from('registros_asistencia').update({
      area, nombre, fecha,
      turno:t||null,
      hora_entrada: e ? new Date(`${fecha}T${e}:00`).toISOString() : null,
      hora_salida:  s ? new Date(`${fecha}T${s}:00`).toISOString() : null,
      observaciones: obsFinal,
    }).eq('id', id);
    if (error) { showToast('Error','err'); return; }
    showToast('✓ Actualizado'); closeModal(); load();
  }

  async function del(id) {
    if(!confirm('¿Eliminar este registro?')) return;
    const{error}=await SB.from('registros_asistencia').delete().eq('id',id);
    if(error){showToast('Error','err');return;}
    showToast('✓ Eliminado'); load();
  }

  function exportCSV() {
    if(!allRegs.length){showToast('Sin datos','err');return;}
    const cols=['Área','Nombre','Rol','Fecha','Horario planificado','Hora Entrada','Hora Salida','Hs Trabajadas','Min Tardanza','Puntual','Observaciones'];
    const lines=[cols.join(',')];
    allRegs.forEach(r=>{
      const hs=calcHs(r.hora_entrada,r.hora_salida);
      const turno=r.turno||'';
      const esFlex=turno==='Flex',esGuardia=turno==='Guardia';
      let diff=null;
      if(!esFlex&&!esGuardia&&turno.includes(':')&&r.hora_entrada){const pe=turno.split('→')[0].trim();if(pe.match(/^\d{2}:\d{2}$/))diff=calcTard(pe,r.hora_entrada);}
      const puntual=esFlex||esGuardia?'N/A':(diff!==null?(diff<=0?'SÍ':'NO'):'');
      lines.push([`"${r.area}"`,`"${r.nombre}"`,`"${r.rol||''}"`,`"${r.fecha}"`,`"${turno}"`,`"${r.hora_entrada||''}"`,`"${r.hora_salida||''}"`,hs!==null?hs.toFixed(2):'',diff!==null?diff:'',puntual,`"${(r.observaciones||'').replace(/"/g,"'")}"`].join(','));
    });
    const blob=new Blob(['\uFEFF'+lines.join('\n')],{type:'text/csv;charset=utf-8;'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
    a.download=`registros_${today()}.csv`; a.click();
  }

  return { load, render, openEdit, closeModal, save, del, exportCSV, changePer, _onAreaChange };
})();

