/* dashboard.js — Dashboard module */
const Dashboard = (() => {
  let _charts = {};

  const PERIODOS = {
    hoy: () => { const d=today(); return {desde:d, hasta:d}; },
    ayer: () => { const d=new Date(); d.setDate(d.getDate()-1); const s=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; return{desde:s,hasta:s}; },
    semana: () => { const l=getLunes(today()); return{desde:l, hasta:getSab(l)}; },
    semana_ant: () => { const l=getLunes(today(),-1); return{desde:l, hasta:getSab(l)}; },
    mes: () => { const d=new Date(); return{desde:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`, hasta:today()}; },
    mes_ant: () => { const d=new Date(); d.setMonth(d.getMonth()-1); const y=d.getFullYear(),m=d.getMonth()+1; const last=new Date(y,m,0).getDate(); return{desde:`${y}-${String(m).padStart(2,'0')}-01`, hasta:`${y}-${String(m).padStart(2,'0')}-${last}`}; },
    anio: () => { return{desde:`${new Date().getFullYear()}-01-01`, hasta:today()}; },
    dia_especifico: () => { const v=document.getElementById('dDiaEsp')?.value||today(); return{desde:v,hasta:v}; },
    todos: () => { return{desde:'2020-01-01', hasta:'2099-12-31'}; },
  };

  function _changeDPer() {
    const v = document.getElementById('dPer').value;
    const cDia = document.getElementById('dCDiaEsp');
    if (cDia) cDia.style.display = v==='dia_especifico' ? '' : 'none';
    load();
  }

  async function load() {
    const per   = document.getElementById('dPer')?.value || 'semana';
    const area  = document.getElementById('dArea')?.value || '';
    const range = PERIODOS[per] ? PERIODOS[per]() : PERIODOS.semana();

    // KPI placeholders
    ['kT','kP','kTd','kH','kPunt','kTarde','kExtra'].forEach(id => {
      const el = document.getElementById(id); if(el) el.textContent='…';
    });

    let q = SB.from('registros_asistencia')
      .select('*, empleados(nombre,apellido), areas(nombre)')
      .gte('fecha', range.desde)
      .lte('fecha', range.hasta);
    if (area) q = q.eq('areas.nombre', area);

    const { data, error } = await q.order('fecha');
    if (error) { showToast('Error al cargar dashboard','err'); return; }

    const rows = (data||[]).map(r => ({
      ...r,
      nombre: r.empleados ? `${r.empleados.apellido}, ${r.empleados.nombre}` : '—',
      area:   r.areas?.nombre || '—',
      hora_entrada: r.hora_entrada ? new Date(r.hora_entrada).toTimeString().slice(0,5) : null,
      hora_salida:  r.hora_salida  ? new Date(r.hora_salida).toTimeString().slice(0,5)  : null,
    }));

    _renderKPIs(rows);
    _renderCharts(rows);
    _renderTops(rows);
  }

  function _renderKPIs(rows) {
    const personas = new Set(rows.map(r=>r.nombre)).size;
    const conPlan  = rows.filter(r => r.turno && r.hora_entrada && !['Flex','Guardia'].includes(r.turno) && r.turno.includes(':'));
    const diffs    = conPlan.map(r => {
      const pe = r.turno.split('→')[0].trim();
      return pe.match(/^\d{2}:\d{2}$/) && r.hora_entrada ? calcTard(pe, r.hora_entrada.slice(0,5)) : null;
    }).filter(d=>d!==null);
    const puntual  = diffs.filter(d=>d<=0).length;
    const tarde    = diffs.filter(d=>d>0).length;
    const promTard = diffs.length ? Math.round(diffs.reduce((a,b)=>a+b,0)/diffs.length) : 0;
    const conHs    = rows.filter(r=>r.hora_entrada&&r.hora_salida);
    const promHs   = conHs.length ? conHs.reduce((acc,r)=>acc+(calcHs(r.hora_entrada,r.hora_salida)||0),0)/conHs.length : 0;

    const extras = rows.filter(r => {
      if (!r.turno||!r.hora_salida||['Flex','Guardia'].includes(r.turno)) return false;
      const ps = r.turno.split('→'); if(ps.length<2) return false;
      const planSal = ps[1].trim().slice(0,5);
      if (!planSal.match(/^\d{2}:\d{2}$/)) return false;
      const ex = calcExtra(planSal, r.hora_salida.slice(0,5));
      return ex && ex > 0;
    });

    const setKpi = (id, val, color) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = val;
      if (color) el.style.color = color;
    };

    setKpi('kT', rows.length);
    setKpi('kP', personas, '#a78bfa');
    const tdColor = promTard > 10 ? 'var(--color-danger-text)' : promTard > 0 ? 'var(--color-warn-text)' : 'var(--color-success-text)';
    setKpi('kTd', promTard > 0 ? `+${promTard}m` : (promTard < 0 ? `${promTard}m` : '✓'));
    setKpi('kH', fmtHs(promHs));
    setKpi('kPunt', puntual, 'var(--color-success-text)');
    setKpi('kTarde', tarde, tarde>0 ? 'var(--color-danger-text)' : 'rgba(198,201,215,.5)');
    setKpi('kExtra', new Set(extras.map(r=>r.nombre)).size, '#e4c76a');

    const sub = document.getElementById('kTdSub');
    if (sub) sub.textContent = diffs.length ? `de ${diffs.length} registros c/plan` : 'sin datos con plan';
    if (el=document.getElementById('kTd')) el.style.color = tdColor;
  }

  function _renderCharts(rows) {
    // Destruir charts anteriores
    Object.values(_charts).forEach(c => { try { c.destroy(); } catch {} });
    _charts = {};

    const areas = [...new Set(rows.map(r=>r.area).filter(Boolean))];
    const colors = areas.map(a => areaColor(a));

    // Chart: registros por área
    const ctxA = document.getElementById('chartArea');
    if (ctxA) {
      _charts.area = new Chart(ctxA, {
        type: 'bar',
        data: {
          labels: areas.map(a => a.split(' ')[0]),
          datasets: [{ data: areas.map(a=>rows.filter(r=>r.area===a).length), backgroundColor: colors.map(c=>c+'88'), borderColor: colors, borderWidth:1.5, borderRadius:6 }]
        },
        options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ x:{ticks:{color:'rgba(198,201,215,.6)',font:{size:10}}},y:{ticks:{color:'rgba(198,201,215,.6)',font:{size:10}},grid:{color:'rgba(198,201,215,.06)'}} } }
      });
    }

    // Chart: puntualidad por área
    const ctxP = document.getElementById('chartPunt');
    if (ctxP) {
      const pcts = areas.map(a => {
        const ar = rows.filter(r=>r.area===a&&r.turno&&r.hora_entrada&&!['Flex','Guardia'].includes(r.turno)&&r.turno.includes(':'));
        const ds = ar.map(r=>{ const pe=r.turno.split('→')[0].trim(); return pe.match(/^\d{2}:\d{2}$/) ? calcTard(pe,r.hora_entrada.slice(0,5)) : null; }).filter(d=>d!==null);
        return ds.length ? Math.round(ds.filter(d=>d<=0).length/ds.length*100) : 0;
      });
      _charts.punt = new Chart(ctxP, {
        type: 'doughnut',
        data: {
          labels: areas.map(a=>a.split(' ')[0]),
          datasets: [{ data: pcts, backgroundColor: colors.map(c=>c+'aa'), borderColor: colors, borderWidth:1.5 }]
        },
        options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'right',labels:{color:'rgba(198,201,215,.7)',font:{size:10},boxWidth:10}}} }
      });
    }

    // Chart: registros por día
    const ctxD = document.getElementById('chartDia');
    if (ctxD) {
      const byDay = {};
      rows.forEach(r=>{ byDay[r.fecha]=(byDay[r.fecha]||0)+1; });
      const dias = Object.keys(byDay).sort();
      const emp = MARCA.empresas[sessionStorage.getItem('empresaActiva')];
      const col = emp ? emp.colores.primario : '#F26513';
      _charts.dia = new Chart(ctxD, {
        type: 'line',
        data: {
          labels: dias.map(d=>fmtDate(d)),
          datasets: [{ data: dias.map(d=>byDay[d]), fill:true, borderColor: col, backgroundColor: col+'22', tension:.4, pointBackgroundColor: col, pointRadius:3 }]
        },
        options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ x:{ticks:{color:'rgba(198,201,215,.5)',font:{size:10}}},y:{ticks:{color:'rgba(198,201,215,.5)',font:{size:10}},grid:{color:'rgba(198,201,215,.06)'}} } }
      });
    }
  }

  function _renderTops(rows) {
    // Top tardanzas
    const tardMap = {};
    rows.filter(r=>r.turno&&r.hora_entrada&&!['Flex','Guardia'].includes(r.turno)&&r.turno.includes(':')).forEach(r=>{
      const pe = r.turno.split('→')[0].trim();
      if (!pe.match(/^\d{2}:\d{2}$/)) return;
      const d = calcTard(pe, r.hora_entrada.slice(0,5));
      if (d===null||d<=0) return;
      if (!tardMap[r.nombre]) tardMap[r.nombre]={nombre:r.nombre,area:r.area,total:0,v:0};
      tardMap[r.nombre].total+=d; tardMap[r.nombre].v++;
    });
    const topT = Object.values(tardMap).sort((a,b)=>b.total-a.total).slice(0,8);
    const tdEl = document.getElementById('topTard');
    if (tdEl) {
      if (!topT.length) { tdEl.innerHTML='<div style="color:rgba(198,201,215,.3);font-size:12px;padding:6px 0;">Sin tardanzas en el período 🎉</div>'; }
      else {
        const max = topT[0].total;
        tdEl.innerHTML = topT.map((p,i) => `
          <div style="margin-bottom:4px;">
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px;">
              <span style="font-weight:700;">${i+1}. ${p.nombre}</span>
              <span style="color:var(--color-danger-text);font-weight:800;">+${p.total}m</span>
            </div>
            <div style="height:5px;background:rgba(198,201,215,.1);border-radius:3px;">
              <div style="height:100%;width:${Math.round(p.total/max*100)}%;background:rgba(239,68,68,${i===0?.8:.5});border-radius:3px;"></div>
            </div>
            <div style="font-size:10px;color:rgba(198,201,215,.35);margin-top:1px;">${p.v} vez${p.v!==1?'ces':''} · ${p.area.split(' ')[0]}</div>
          </div>`).join('');
      }
    }

    // Top extras
    const extraMap = {};
    rows.filter(r=>r.turno&&r.hora_salida&&!['Flex','Guardia'].includes(r.turno)&&r.turno.includes('→')).forEach(r=>{
      const ps = r.turno.split('→'); if(ps.length<2) return;
      const planSal=ps[1].trim().slice(0,5); if(!planSal.match(/^\d{2}:\d{2}$/)) return;
      const ex = calcExtra(planSal, r.hora_salida.slice(0,5));
      if (!ex||ex<=0) return;
      if (!extraMap[r.nombre]) extraMap[r.nombre]={nombre:r.nombre,area:r.area,total:0,v:0};
      extraMap[r.nombre].total+=ex; extraMap[r.nombre].v++;
    });
    const topE = Object.values(extraMap).sort((a,b)=>b.total-a.total).slice(0,8);
    const exEl = document.getElementById('topExtra');
    if (exEl) {
      if (!topE.length) { exEl.innerHTML='<div style="color:rgba(198,201,215,.3);font-size:12px;padding:6px 0;">Sin horas extra detectadas</div>'; }
      else {
        const max = topE[0].total;
        exEl.innerHTML = topE.map((p,i) => `
          <div style="margin-bottom:4px;">
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px;">
              <span style="font-weight:700;">${i+1}. ${p.nombre}</span>
              <span style="color:#e4c76a;font-weight:800;">${fmtHs(p.total/60)}</span>
            </div>
            <div style="height:5px;background:rgba(198,201,215,.1);border-radius:3px;">
              <div style="height:100%;width:${Math.round(p.total/max*100)}%;background:rgba(228,199,106,${i===0?.8:.5});border-radius:3px;"></div>
            </div>
            <div style="font-size:10px;color:rgba(198,201,215,.35);margin-top:1px;">${p.v} jornada${p.v!==1?'s':''} · ${p.area.split(' ')[0]}</div>
          </div>`).join('');
      }
    }

    // Tabla por área
    const tbArea = document.getElementById('tbArea');
    if (tbArea) {
      const areas = [...new Set(rows.map(r=>r.area))];
      tbArea.innerHTML = areas.map(a => {
        const ar = rows.filter(r=>r.area===a);
        const con= ar.filter(r=>r.turno&&r.hora_entrada&&!['Flex','Guardia'].includes(r.turno)&&r.turno.includes(':'));
        const ds = con.map(r=>{ const pe=r.turno.split('→')[0].trim(); return pe.match(/^\d{2}:\d{2}$/) ? calcTard(pe,r.hora_entrada.slice(0,5)):null; }).filter(d=>d!==null);
        const prom=ds.length?Math.round(ds.reduce((x,y)=>x+y,0)/ds.length):null;
        const punt=ds.filter(d=>d<=0).length;
        const pct=ds.length?Math.round(punt/ds.length*100):null;
        const col=areaColor(a);
        return `<tr>
          <td><span style="color:${col};font-weight:800;font-size:11px;">${a.split(' ')[0]}</span></td>
          <td>${ar.length}</td>
          <td style="color:${prom>0?'var(--color-danger-text)':'var(--color-success-text)'};">${prom!==null?(prom>0?'+'+prom+'m':'✓ '+Math.abs(prom)+'m antes'):'—'}</td>
          <td style="color:var(--color-success-text);">${pct!==null?pct+'%':'—'}</td>
        </tr>`;
      }).join('');
    }
  }

  return { load, _changeDPer };
})();

