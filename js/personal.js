/* personal.js — Módulo personal/empleados */
const Personal = (() => {
  let _data  = [];
  let _filtA = '';

  async function load() {
    const tbody = document.getElementById('tbP');
    if (tbody) tbody.innerHTML='<tr><td colspan="6" style="text-align:center;padding:30px;"><span class="sp"></span></td></tr>';
    const { data, error } = await SB.from('empleados').select('*, areas(nombre)').order('apellido');
    if (error) { showToast('Error al cargar personal','err'); return; }
    _data = data||[];
    document.getElementById('pCnt').textContent = `${_data.filter(p=>p.activo).length} activos · ${_data.length} total`;
    _render();
  }

  function _render() {
    const tbody = document.getElementById('tbP'); if (!tbody) return;
    const rows = _filtA ? _data.filter(p=>p.area_nombre===_filtA||p.areas?.nombre===_filtA) : _data;
    if (!rows.length) { tbody.innerHTML='<tr><td colspan="6" style="text-align:center;padding:40px;color:rgba(198,201,215,.28);">Sin personas registradas</td></tr>'; return; }
    tbody.innerHTML = rows.map((p,i) => {
      const col = areaColor(p.areas?.nombre||p.area_nombre||'');
      const est = p.activo
        ? '<span class="badge badge-green">Activo</span>'
        : '<span class="badge badge-red">Inactivo</span>';
      return `<tr>
        <td style="color:rgba(198,201,215,.4);">${i+1}</td>
        <td style="font-weight:700;">${p.apellido||''}, ${p.nombre||''}</td>
        <td style="color:rgba(198,201,215,.6);">${p.rol||'—'}</td>
        <td><span style="color:${col};font-weight:800;font-size:11px;">${(p.areas?.nombre||p.area_nombre||'—').split(' ')[0]}</span></td>
        <td>${est}</td>
        <td class="no-print"><div style="display:flex;gap:5px;">
          <button class="btn btn-ghost" style="font-size:11px;padding:4px 10px;" onclick="Personal.openEdit('${p.id}')">✏ Editar</button>
          <button class="btn btn-danger" style="font-size:11px;" onclick="Personal.toggleActivo('${p.id}',${p.activo})">${p.activo?'✕ Dar de baja':'↺ Activar'}</button>
        </div></td>
      </tr>`;
    }).join('');
  }

  function openNew() {
    document.getElementById('mpId').value='';
    document.getElementById('mpN').value='';
    document.getElementById('mpA').value='';
    document.getElementById('mpR').value='';
    document.getElementById('mpAp').value='';
    document.getElementById('mpPin').value='';
    document.getElementById('mpPin').type='password';
    const btnEye=document.getElementById('btnPinEye');if(btnEye)btnEye.textContent='👁';
    const pinAct=document.getElementById('mpPinActual');if(pinAct)pinAct.style.display='none';
    document.getElementById('mpAc').checked=true;
    document.getElementById('mPT').textContent='Agregar Persona';
    document.getElementById('mPers').style.display='';
    setTimeout(()=>document.getElementById('mpN').focus(),50);
  }

  function openEdit(id) {
    const p=_data.find(x=>x.id===id); if(!p) return;
    document.getElementById('mpId').value  = id;
    document.getElementById('mpN').value   = p.nombre||'';
    document.getElementById('mpAp').value  = p.apellido||'';
    document.getElementById('mpA').value   = p.areas?.nombre||p.area_nombre||'';
    document.getElementById('mpR').value   = p.rol||'';
    document.getElementById('mpPin').value = '';
    document.getElementById('mpPin').type  = 'password';
    const btnEye=document.getElementById('btnPinEye');if(btnEye)btnEye.textContent='👁';
    // Show current PIN hint
    const pinAct=document.getElementById('mpPinActual');
    const pinVal=document.getElementById('mpPinVal');
    if(pinAct&&pinVal){
      pinVal.textContent=p.pin||'(no disponible)';
      pinAct.style.display='block';
    }
    document.getElementById('mpAc').checked= p.activo!==false;
    document.getElementById('mPT').textContent='Editar Persona';
    document.getElementById('mPers').style.display='';
  }

  function closeModal() { document.getElementById('mPers').style.display='none'; }

  async function save() {
    const id      = document.getElementById('mpId').value;
    const nombre  = document.getElementById('mpN').value.trim();
    const apellido= document.getElementById('mpAp').value.trim();
    const areaNom = document.getElementById('mpA').value;
    const rol     = document.getElementById('mpR').value.trim();
    const pin     = document.getElementById('mpPin').value;
    const activo  = document.getElementById('mpAc').checked;
    if (!nombre||!apellido||!areaNom) { showToast('Nombre, apellido y área son obligatorios','err'); return; }
    if (!id && !pin) { showToast('El PIN es obligatorio para nuevas personas','err'); return; }
    if (pin && (pin.length!==4||!/^\d{4}$/.test(pin))) { showToast('El PIN debe tener exactamente 4 dígitos','err'); return; }

    // Obtener area_id
    const { data:areaData } = await SB.from('areas').select('id').eq('nombre',areaNom).maybeSingle();
    const area_id = areaData?.id||null;

    const payload = { nombre, apellido, rol:rol||null, area_id, activo };
    if (pin) payload.pin = pin;

    const btn = document.getElementById('btnSP'); btn.disabled=true; btn.textContent='⏳';
    let error;
    if (id) { ({error} = await SB.from('empleados').update(payload).eq('id',id)); }
    else    { ({error} = await SB.from('empleados').insert(payload)); }
    btn.disabled=false; btn.textContent='Guardar';
    if (error) { showToast('Error: '+error.message,'err'); return; }
    showToast(id?'✓ Persona actualizada':'✓ Persona creada');
    closeModal(); load();
  }

  async function toggleActivo(id, activo) {
    const {error} = await SB.from('empleados').update({activo:!activo}).eq('id',id);
    if (error) { showToast('Error','err'); return; }
    showToast(activo?'Persona dada de baja':'Persona activada');
    load();
  }

  function filtPA(area) {
    _filtA = area;
    document.querySelectorAll('[id^="pb-"]').forEach(b => b.classList.toggle('active', b.id==='pb-'+area));
    _render();
  }

  return { load, openNew, openEdit, closeModal, save, toggleActivo, filtPA };
})();

// Global para onclick en filtros de área
function filtPA(a) { Personal.filtPA(a); }

