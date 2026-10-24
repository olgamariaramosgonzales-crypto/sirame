const $=(s,r=document)=>r.querySelector(s),app=$('#app');
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const S={get token(){return sessionStorage.token},get user(){return sessionStorage.user},get rol(){return sessionStorage.rol}};
const GES=['Coordinador','Director','Administración'];
const can={reg:r=>r==='Administración',ges:r=>GES.includes(r),usr:r=>['Director','Administración'].includes(r),del:r=>r==='Administración'};
const ESTADOS=['Bueno','Dañado','En mantenimiento'],ROLES=['Profesor','Coordinador','Director','Administración'],COL={Bueno:'ok','En mantenimiento':'gold','Dañado':'err'};
const IGUAL=a=>a.map(x=>[x,x]);
const ROLES_EDIT=['Profesor','Administración'],ROLES_FIJOS=['Director','Coordinador'];

// Patrones de validación (los mismos límites que valida el servidor)
const L='A-Za-zÁÉÍÓÚÜÑáéíóúüñ';
const PAT={
 nombre:`[${L}][${L} .'\\-]*`,
 cargo:`[${L}][${L} .,\\/\\-]*`,
 titulo:`[${L}0-9][${L}0-9 .,\\/\\-\\(\\)#+'"]*`,
 usuario:`[A-Za-z0-9._\\-]{4,20}`,
 clave:`(?=.*[A-Za-z])(?=.*\\d)\\S{8,64}`,
 num:`\\d{3}-\\d{3}-\\d{3,5}`
};
const F={
 nombre:{n:'nombre',l:'Nombre completo',req:1,min:3,max:60,pat:PAT.nombre,tt:'Solo letras y espacios (3 a 60 caracteres)'},
 cargo:{n:'cargo',l:'Cargo',req:1,min:3,max:40,pat:PAT.cargo,tt:'Solo letras y espacios (3 a 40 caracteres)'},
 correo:{n:'correo',l:'Correo electrónico',t:'email',req:1,max:80},
 usuario:{n:'usuario',l:'Usuario',req:1,min:4,max:20,pat:PAT.usuario,tt:'4 a 20 caracteres: letras, números, punto, guion o guion bajo (sin espacios)',h:'4 a 20 caracteres. Ej.: usuario123'},
 clave:{n:'clave',l:'Contraseña',t:'password',req:1,min:8,max:64,pat:PAT.clave,tt:'8 a 64 caracteres, con letras y números y sin espacios',h:'Mínimo 8 caracteres, con letras y números',ac:'new-password'}
};

// ---------- iconos (SVG en línea) ----------
const P={
 box:'<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>',
 plus:'<circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8v8"/>',
 edit:'<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
 refresh:'<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
 alert:'<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',
 alertc:'<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
 clip:'<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M12 11h4M12 16h4M8 11h.01M8 16h.01"/>',
 history:'<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>',
 swap:'<path d="M8 3 4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4"/>',
 list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
 wrench:'<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z"/>',
 trash:'<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/>',
 archive:'<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4"/>',
 chart:'<path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/>',
 users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
 pin:'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
 tag:'<path d="M12.59 2.59A2 2 0 0 0 11.17 2H4a2 2 0 0 0-2 2v7.17a2 2 0 0 0 .59 1.41l8.7 8.7a2 2 0 0 0 2.82 0l7.17-7.17a2 2 0 0 0 0-2.82z"/><path d="M7 7h.01"/>',
 ok:'<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>',
 check:'<path d="M20 6 9 17l-5-5"/>',
 arrowl:'<path d="m12 19-7-7 7-7M19 12H5"/>',
 home:'<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
 out:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
 chev:'<path d="m9 18 6-6-6-6"/>',
 monitor:'<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8M12 17v4"/>',
 image:'<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
 download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
 print:'<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/>',
 eye:'<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
 eyeoff:'<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><path d="m2 2 20 20"/>',
 pdf:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/>',
 sheet:'<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>'
};
const ico=(n,s=20)=>`<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;



// Clona una plantilla de index.html, pinta los iconos y gestiona las imágenes con respaldo
function mount(id){
  const f=document.importNode($('#'+id).content,true);
  $$('[data-ico]',f).forEach(e=>e.innerHTML=ico(e.dataset.ico,+e.dataset.s||20));
  $$('img[data-fb]',f).forEach(im=>{
    const fb=$$(im.dataset.fb,f);
    im.addEventListener('load',()=>fb.forEach(x=>x.remove()));
    im.addEventListener('error',()=>im.remove());
  });
  app.replaceChildren(f);
}

// Botón de ver/ocultar contraseña (funciona en login, registro y formularios)
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-eye]');if(!b)return;
  const i=b.parentElement.querySelector('input');if(!i)return;
  const ver=i.type==='password';
  i.type=ver?'text':'password';
  b.innerHTML=ico(ver?'eyeoff':'eye');
  b.setAttribute('aria-label',ver?'Ocultar contraseña':'Mostrar contraseña');
});

// Carrusel automático del login (omite las imágenes que no existan)
function carrusel(){
  const c=$('#car');if(!c)return;
  const dots=$('.car-dots',c);
  let sl=$$('.car-track img',c).map(im=>{const d=document.createElement('button');d.type='button';d.setAttribute('aria-label','Ver imagen');dots.append(d);return{im,d}});
  let i=0,t;
  const show=n=>{if(!sl.length)return;i=(n+sl.length)%sl.length;sl.forEach((x,k)=>{x.im.classList.toggle('on',k===i);x.d.classList.toggle('on',k===i)})};
  const play=()=>{clearInterval(t);t=setInterval(()=>{if(!c.isConnected)return clearInterval(t);show(i+1)},4000)};
  sl.forEach((x,k)=>{
    x.d.onclick=()=>{show(k);play()};
    x.im.onerror=()=>{x.im.remove();x.d.remove();sl=sl.filter(y=>y!==x);if(!sl.length)c.remove();else show(0)};
  });
  show(0);play();
}

// Selector segmentado (estado de incidencias) y colores por estado
const seg=(a,id,vals,act)=>`<div class="seg" role="group">${vals.map(v=>`<button class="${v===act?'on':''}" data-a="${a}" data-id="${id}" data-v="${esc(v)}" ${v===act?'disabled':''}>${v}</button>`).join('')}</div>`;
const COLI={Pendiente:'gold','En proceso':'info',Resuelta:'ok'};

// Exportar inventario a CSV (abre bien en Excel)
const csv=l=>{const h=['num_inventario','nombre','tipo','ubicacion','estado_conservacion'];
  const t=[h.join(','),...l.map(e=>h.map(k=>`"${String(e[k]??'').replace(/"/g,'""')}"`).join(','))].join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+t],{type:'text/csv'}));a.download='inventario.csv';a.click()};

// Estadística de estado de los equipos (dona + leyenda). Se usa en Inicio y en Reportes
const estadoChart=k=>{
  const d=[['Buenos',k.buenos,'var(--ok)'],['En mantenimiento',k.en_mantenimiento,'var(--gold)'],['Dañados',k.danados,'var(--err)']];
  const t=d.reduce((s,x)=>s+(x[1]||0),0);let a=0;
  const g=d.map(x=>{const p=t?(x[1]||0)/t*100:0,s=`${x[2]} ${a}% ${a+p}%`;a+=p;return s}).join(',');
  return `<section class="card"><h2>Estado de los equipos</h2><p class="sub">Distribución según el estado de conservación</p>
   <div class="est-w"><div class="donut" style="background:${t?`conic-gradient(${g})`:'var(--sf)'}"><div><b>${t}</b><small>equipos</small></div></div>
   <ul class="leg">${d.map(x=>{const n=x[1]||0;return `<li><i style="background:${x[2]}"></i><span>${x[0]}</span><b>${n}</b><em>${t?Math.round(n/t*100):0}%</em></li>`}).join('')}</ul></div></section>`};

// ---------- utilidades ----------
async function api(p,o={}){
  const h={};if(S.token)h.Authorization='Bearer '+S.token;
  if(o.body&&!(o.body instanceof FormData)){h['Content-Type']='application/json';o.body=JSON.stringify(o.body)}
  const r=await fetch(p,{...o,headers:h});
  if(r.status===401&&S.token){salir();throw Error('Tu sesión expiró')}
  const d=await r.json().catch(()=>({mensaje:'Respuesta no válida del servidor'}));
  if(d.status!=='ok')throw Error(d.mensaje||'Error');
  return d;
}
const cat=async p=>(await api('/'+p)).data.map(x=>[x.id,x.nombre]);
const eq=async()=>(await api('/equipos')).data;
const eqOpts=l=>l.map(e=>[e.num_inventario,`${e.num_inventario} — ${e.nombre}`]);
function toast(m,err){const t=document.createElement('div');t.className='toast'+(err?' err':'');t.textContent=m;document.body.append(t);setTimeout(()=>t.remove(),3200)}
function salir(){sessionStorage.clear();location.hash='#/login'}
const badge=(t,c='')=>`<span class="bd ${c}">${esc(t)}</span>`;
const item=(t,ls=[],b='',x='')=>`<article class="it"><div class="row"><b>${t}</b>${b}</div>${ls.map(l=>`<p>${l}</p>`).join('')}${x}</article>`;
const card=(t,s,i)=>`<section class="card"><h2>${t}</h2><p class="sub">${s}</p>${i}</section>`;
function shell(t,body,{home=1,back=1}={}){
  mount('t-shell');
  $('#st').textContent=t;
  $('#pgb').innerHTML=body;
  if(back)$('#bk').addEventListener('click',()=>history.back());else $('#bk').remove();
  if(!home)$('#hm').remove();
}
function field(f){
  const n=`name="${f.n}" ${f.req?'required':''}`;
  const mx=f.max||(f.t==='textarea'?255:0);
  const lim=`${f.min?`minlength="${f.min}"`:''} ${mx?`maxlength="${mx}"`:''} ${f.pat?`pattern="${esc(f.pat)}"`:''} ${f.tt?`title="${esc(f.tt)}"`:''}`;
  let i;
  if(f.t==='select')i=`<select ${n}><option value="">Selecciona...</option>${f.o.map(o=>`<option value="${esc(o[0])}">${esc(o[1])}</option>`).join('')}</select>`;
  else if(f.t==='textarea')i=`<textarea ${n} rows="3" ${lim}></textarea>`;
  else{i=`<input ${n} type="${f.t||'text'}" ${f.acc?`accept="${f.acc}"`:''} ${lim} autocomplete="${f.ac||(f.t==='password'?'current-password':'off')}">`;
   if(f.t==='password')i=`<div class="pw">${i}<button type="button" class="eye" data-eye aria-label="Mostrar contraseña">${ico('eye')}</button></div>`}
  return `<label class="fld"><span>${f.l}${f.req?' *':''}</span>${i}${f.h?`<small class="hf">${esc(f.h)}</small>`:''}</label>`;
}
function bindForm(sel,fn){
  const f=$(sel);
  f.addEventListener('submit',async e=>{e.preventDefault();const b=$('button[type=submit]',f);b.disabled=true;
    try{await fn(f,new FormData(f))}catch(x){toast(x.message,1)}b.disabled=false});
}
// Selector con buscador: mejora un <select> con muchas opciones (el select original sigue guardando el valor)
const norm=t=>String(t).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function buscable(sel){
  const wrap=document.createElement('div');wrap.className='cb';
  sel.before(wrap);wrap.append(sel);
  sel.classList.add('cb-native');sel.tabIndex=-1;sel.setAttribute('aria-hidden','true');
  wrap.insertAdjacentHTML('beforeend',`<button type="button" class="cb-btn" aria-haspopup="listbox" aria-expanded="false"><span class="cb-txt"></span>${ico('chev',16)}</button>
   <div class="cb-pop" hidden><input type="search" class="cb-q" placeholder="Buscar..." autocomplete="off" aria-label="Buscar"><ul class="cb-list" role="listbox"></ul></div>`);
  const btn=$('.cb-btn',wrap),pop=$('.cb-pop',wrap),q=$('.cb-q',wrap),ul=$('.cb-list',wrap),txt=$('.cb-txt',wrap);
  const opts=[...sel.options].filter(o=>o.value!=='');
  const d=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value');
  let vis=[],act=0;
  const refresh=()=>{const o=sel.selectedOptions[0],ok=!!o&&o.value!=='';txt.textContent=ok?o.text:'Selecciona...';btn.classList.toggle('ph',!ok)};
  // si otro código cambia sel.value, el texto visible se actualiza
  Object.defineProperty(sel,'value',{get(){return d.get.call(sel)},set(v){d.set.call(sel,v);refresh()}});
  const draw=()=>{
    const t=norm(q.value).split(/\s+/).filter(Boolean);
    vis=opts.filter(o=>{const x=norm(o.text);return t.every(w=>x.includes(w))});
    ul.innerHTML=vis.length?vis.map((o,i)=>`<li role="option" data-i="${i}"${o.value===sel.value?' class="sel"':''}>${esc(o.text)}</li>`).join(''):'<li class="none">Sin resultados</li>';
  };
  const mark=()=>{$$('li[data-i]',ul).forEach((li,i)=>li.classList.toggle('act',i===act));const a=$('li.act',ul);if(a&&a.scrollIntoView)a.scrollIntoView({block:'nearest'})};
  const close=()=>{wrap.classList.remove('open');pop.hidden=true;btn.setAttribute('aria-expanded','false')};
  const open=()=>{wrap.classList.add('open');pop.hidden=false;btn.setAttribute('aria-expanded','true');q.value='';draw();act=Math.max(0,vis.findIndex(o=>o.value===sel.value));mark();q.focus()};
  const pick=o=>{d.set.call(sel,o.value);refresh();close();sel.dispatchEvent(new Event('change',{bubbles:true}));btn.focus()};
  btn.onclick=()=>pop.hidden?open():close();
  q.oninput=()=>{act=0;draw();mark()};
  q.onkeydown=e=>{
    if(e.key==='ArrowDown'){e.preventDefault();act=Math.min(vis.length-1,act+1);mark()}
    else if(e.key==='ArrowUp'){e.preventDefault();act=Math.max(0,act-1);mark()}
    else if(e.key==='Enter'){e.preventDefault();if(vis[act])pick(vis[act])}
    else if(e.key==='Escape'){e.preventDefault();close();btn.focus()}
  };
  ul.onclick=e=>{const li=e.target.closest('li[data-i]');if(!li)return;e.preventDefault();pick(vis[+li.dataset.i])};
  const fuera=e=>{if(!wrap.isConnected)return document.removeEventListener('click',fuera);if(!wrap.contains(e.target))close()};
  document.addEventListener('click',fuera);
  if(sel.form)sel.form.addEventListener('reset',()=>setTimeout(refresh));
  refresh();
}

function formScreen(t,s,fs,btn,fn,cls=''){
  shell(t,card(t,s,`<form id="fm">${fs.map(field).join('')}<button class="btn ${cls}" type="submit">${btn}</button></form>`));
  $$('select',$('#fm')).forEach(x=>{if(x.options.length>6)buscable(x)});
  bindForm('#fm',fn);return $('#fm');
}
const enviar=(m,p,msg,body)=>async(f,d)=>{await api(p,{method:m,body:body?body(d):Object.fromEntries(d)});toast(msg);f.reset()};

// ---------- listas con búsqueda ----------
async function listScreen(o){
  shell(o.t,`${o.btn?`<a class="btn mb" href="${o.href}">${ico('plus',16)} ${o.btn.replace(/^\+\s*/,'')}</a>`:''}<input id="q" class="search" type="search" placeholder="Buscar...">${o.extra||''}<div id="ls" class="list"><p class="empty">Cargando...</p></div>`);
  let items=[];
  const draw=()=>{const t=$('#q').value.toLowerCase(),fe=$('#fe')?.value,fk=o.fk||'estado_conservacion';
    const r=items.filter(i=>JSON.stringify(i).toLowerCase().includes(t)&&(!fe||i[fk]===fe));
    $('#ls').innerHTML=r.length?r.map(o.card).join(''):'<p class="empty">No se encontraron resultados</p>'};
  const load=async()=>{try{items=(await api(o.path)).data;draw()}catch(e){$('#ls').innerHTML=`<p class="empty err">${esc(e.message)}</p>`}};
  $('#q').oninput=draw;if($('#fe'))$('#fe').onchange=draw;
  const manejar=async e=>{const b=e.target.closest('[data-a]');if(!b||!o.act)return;
    const sel=b.tagName==='SELECT';if(sel!==(e.type==='change'))return;
    try{await o.act(b.dataset.a,b.dataset.id,sel?b.value:b.dataset.v);await load()}catch(x){toast(x.message,1);await load()}};
  $('#ls').onclick=manejar;$('#ls').onchange=manejar;
  load();
}
const btn=(a,id,txt,v='',c='out')=>`<button class="btn sm ${c}" data-a="${a}" data-id="${id}" data-v="${esc(v)}">${txt}</button>`;

// ---------- rutas ----------
const R={};
R.login={pub:1,f(){
  mount('t-login');
  carrusel();
  bindForm('#fm',async(f,d)=>{const r=await api('/login',{method:'POST',body:{usuario:d.get('usuario').trim(),clave:d.get('clave').trim()}});
    sessionStorage.token=r.token;sessionStorage.user=r.usuario;sessionStorage.rol=r.rol;sessionStorage.sol=r.solicitud||'';location.hash='#/inicio'});
}};
R.registro={pub:1,f(){
  shell('Registrar usuario',card('Crear cuenta','Crea tu cuenta para acceder al sistema de inventario.',`<form id="fm">${[
    F.nombre,F.cargo,F.correo,
    F.usuario,
    {n:'rol_solicitado',l:'Rol',t:'select',o:[['Profesor','Profesor'],['Administración','Administrador (requiere aprobación)']],req:1},
    F.clave,{n:'confirmar',l:'Confirmar contraseña',t:'password',req:1,max:64,ac:'new-password'}].map(field).join('')}
    <p class="nota" id="nota" hidden>Tu cuenta se creará como <b>Profesor</b>. Un administrador revisará tu solicitud y, cuando la apruebe, tendrás acceso de administrador (deberás volver a iniciar sesión).</p>
    <button class="btn" type="submit">Registrar usuario</button></form>`),{home:0});
  const fm=$('#fm');fm.rol_solicitado.value='Profesor';
  fm.rol_solicitado.onchange=()=>{$('#nota').hidden=fm.rol_solicitado.value!=='Administración'};
  bindForm('#fm',async(f,d)=>{const v=Object.fromEntries(d);
    if(/\s/.test(v.usuario))throw Error('El usuario no debe tener espacios');
    if(v.clave!==v.confirmar)throw Error('Las contraseñas no coinciden');
    await api('/registro',{method:'POST',body:v});
    toast(v.rol_solicitado==='Administración'?'Cuenta creada como Profesor. Tu solicitud de administrador quedó pendiente':'Usuario registrado. Ya puedes iniciar sesión');
    location.hash='#/login'});
}};
const MODS=[
 ['Consultar inventario','Ver todos los equipos registrados','box','equipos'],
 ['Registrar nuevo equipo','Agregar un equipo nuevo al inventario','plus','registrar',can.reg],
 ['Modificar equipo','Editar datos de un equipo existente','edit','modificar',can.ges],
 ['Cambiar estado','Actualizar estado de conservación','refresh','estado',can.ges],
 ['Reportar incidencia','Falla, avería o equipo perdido','alert','incidencia-nueva'],
 ['Ver incidencias','Seguimiento de incidencias reportadas','clip','incidencias'],
 ['Traslados realizados','Historial de movimientos entre ubicaciones','history','traslados',can.ges],
 ['Registrar traslado','Registrar el traslado de un equipo','swap','traslado-nuevo',can.ges],
 ['Mantenimientos','Historial de mantenimientos realizados','list','mantenimientos',can.ges],
 ['Registrar mantenimiento','Enviar equipo a servicio técnico','wrench','mantenimiento-nuevo',can.ges],
 ['Registrar baja','Retirar un equipo del inventario','trash','baja-nueva',can.ges],
 ['Bajas realizadas','Equipos retirados del inventario','archive','bajas',can.ges],
 ['Reportes','Estadísticas del inventario','chart','reportes'],
 ['Usuarios registrados','Ver y administrar cuentas del sistema','users','usuarios',can.usr],
 ['Solicitudes de acceso','Aprobar solicitudes de administrador','ok','solicitudes',can.del],
 ['Ubicaciones','Gestionar ubicaciones del inventario','pin','ubicaciones',can.ges],
 ['Tipos de equipo','Gestionar categorías de equipos','tag','tipos',can.ges]];
R.inicio={async f(){
  const rol=S.rol;
  mount('t-inicio');
  $('#out').onclick=salir;
  $('#av').textContent=(S.user||'?')[0].toUpperCase();
  $('#who').textContent=S.user;
  $('#rol').textContent=rol+(sessionStorage.sol==='Pendiente'?' · Solicitud de administrador pendiente':'');
  $('#mods').innerHTML=MODS.filter(m=>!m[4]||m[4](rol)).map(m=>`<a class="mod" href="#/${m[3]}"><i>${ico(m[2])}</i><div><b>${m[0]}</b><small>${m[1]}</small></div><span>${ico('chev',18)}</span></a>`).join('');
  try{
    const k=(await api('/kpis')).data;
    if(!$('#est'))return; // el usuario ya cambió de pantalla
    $$('[data-k]').forEach(e=>e.textContent=k[e.dataset.k]??0);
    const pend=+k.solicitudes_pendientes||0,mb=$('a.mod[href="#/solicitudes"] b');
    if(mb&&pend)mb.insertAdjacentHTML('beforeend',` <span class="bd gold">${pend}</span>`);
    $('#est').innerHTML=estadoChart(k);
  }catch(e){toast(e.message,1)}
}};
R.equipos={f:()=>listScreen({t:'Consultar inventario',path:'/equipos',
  extra:`<select id="fe" class="search"><option value="">Todos los estados</option>${ESTADOS.map(e=>`<option>${e}</option>`).join('')}</select>`,
  card:e=>`<article class="it eq">${e.foto_url?`<img class="thumb" src="${esc(e.foto_url)}" alt="" loading="lazy">`:`<div class="thumb">${ico('monitor',26)}</div>`}<div><b>${esc(e.nombre)}</b>
   <p>Inventario: ${esc(e.num_inventario)}</p>${e.tipo?`<p>Tipo: ${esc(e.tipo)}</p>`:''}${e.ubicacion?`<p>Ubicación: ${esc(e.ubicacion)}</p>`:''}</div>${badge(e.estado_conservacion||'-',COL[e.estado_conservacion])}</article>`})};
R.registrar={ok:can.reg,async f(){
  const[t,u]=await Promise.all([cat('tipos-equipo'),cat('ubicaciones')]);
  formScreen('Registrar equipo','Agrega un nuevo equipo al inventario (formato 123-001-0001).',[
   {n:'num_inventario',l:'Número de inventario',req:1,min:9,max:13,pat:PAT.num,tt:'Formato: 123-001-0001',h:'Formato: 123-001-0001'},{n:'nombre',l:'Nombre del equipo',req:1,min:3,max:60,pat:PAT.titulo,tt:'3 a 60 caracteres: letras, números y signos básicos'},{n:'descripcion',l:'Descripción (opcional)',t:'textarea',max:255},
   {n:'tipo_id',l:'Tipo de equipo',t:'select',o:t,req:1},{n:'ubicacion_id',l:'Ubicación',t:'select',o:u,req:1},
   {n:'estado_conservacion',l:'Estado de conservación',t:'select',o:IGUAL(ESTADOS),req:1},{n:'foto',l:'Imagen del equipo (opcional)',t:'file',acc:'image/*'}],
   'REGISTRAR EQUIPO',async(f,d)=>{const fo=d.get('foto');
    if(fo&&fo.size>5242880)throw Error('La imagen no debe pesar más de 5 MB');
    if(fo&&!fo.size)d.delete('foto');
    await api('/equipos',{method:'POST',body:d});toast('Equipo registrado correctamente');f.reset()});
}};
R.modificar={ok:can.ges,async f(){
  const[l,t,u]=await Promise.all([eq(),cat('tipos-equipo'),cat('ubicaciones')]);
  const f=formScreen('Modificar equipo','Selecciona un equipo para editar sus datos.',[
   {n:'num',l:'Equipo',t:'select',o:eqOpts(l),req:1},{n:'nombre',l:'Nombre',req:1,min:3,max:60,pat:PAT.titulo,tt:'3 a 60 caracteres: letras, números y signos básicos'},{n:'descripcion',l:'Descripción',t:'textarea',max:255},
   {n:'tipo_id',l:'Tipo',t:'select',o:t,req:1},{n:'ubicacion_id',l:'Ubicación',t:'select',o:u,req:1}],'GUARDAR CAMBIOS',
   async(f,d)=>{await api('/equipos/'+encodeURIComponent(d.get('num')),{method:'PUT',body:Object.fromEntries(d)});toast('Equipo actualizado')});
  f.num.onchange=()=>{const e=l.find(x=>x.num_inventario===f.num.value);if(!e)return;
   f.nombre.value=e.nombre;f.descripcion.value=e.descripcion||'';
   f.tipo_id.value=(t.find(o=>o[1]===e.tipo)||[''])[0];f.ubicacion_id.value=(u.find(o=>o[1]===e.ubicacion)||[''])[0]};
}};
R.estado={ok:can.ges,async f(){
  const l=await eq();
  formScreen('Cambiar estado','Actualiza el estado de conservación de un equipo.',[
   {n:'num',l:'Equipo',t:'select',o:l.map(e=>[e.num_inventario,`${e.num_inventario} — ${e.nombre} (${e.estado_conservacion||'-'})`]),req:1},
   {n:'estado_conservacion',l:'Nuevo estado',t:'select',o:IGUAL(ESTADOS),req:1}],'GUARDAR ESTADO',
   async(f,d)=>{await api(`/equipos/${encodeURIComponent(d.get('num'))}/estado`,{method:'PUT',body:{estado_conservacion:d.get('estado_conservacion')}});toast('Estado actualizado')});
}};
R['incidencia-nueva']={async f(){
  const l=await eq();
  formScreen('Reportar incidencia','Registra fallas, averías o reportes de pérdida.',[
   {n:'num_inventario',l:'Equipo',t:'select',o:eqOpts(l),req:1},{n:'descripcion',l:'Descripción del problema',t:'textarea',req:1,min:5}],
   'ENVIAR REPORTE',enviar('POST','/incidencias','Incidencia reportada'));
}};
R.incidencias={f:()=>listScreen({t:'Incidencias',path:'/incidencias',btn:'+ Reportar incidencia',href:'#/incidencia-nueva',fk:'estado',
  extra:`<select id="fe" class="search"><option value="">Todos los estados</option>${['Pendiente','En proceso','Resuelta'].map(e=>`<option>${e}</option>`).join('')}</select>`,
  card:i=>item(`${esc(i.num_inventario)} — ${esc(i.equipo||'')}`,[esc(i.descripcion),`Por ${esc(i.usuario||'-')} · ${esc(i.fecha)}`],badge(i.estado,COLI[i.estado]),
   can.ges(S.rol)?seg('est',i.id,['Pendiente','En proceso','Resuelta'],i.estado):''),
  act:(a,id,v)=>api('/incidencias/'+id,{method:'PUT',body:{estado:v}}).then(()=>toast('Actualizado'))})};
R.traslados={ok:can.ges,f:()=>listScreen({t:'Traslados',path:'/traslados',btn:'+ Registrar traslado',href:'#/traslado-nuevo',
  card:i=>item(`${esc(i.num_inventario)} — ${esc(i.equipo||'')}`,[`${ico('pin',13)} ${esc(i.origen||'-')} → ${esc(i.destino||'-')}`,`Motivo: ${esc(i.motivo||'-')}`,`Por ${esc(i.usuario||'-')} · ${esc(i.fecha)}`])})};
R['traslado-nuevo']={ok:can.ges,async f(){
  const[l,u]=await Promise.all([eq(),cat('ubicaciones')]);
  const f=formScreen('Registrar traslado','Registra el movimiento de un equipo entre ubicaciones.',[
   {n:'num_inventario',l:'Equipo',t:'select',o:eqOpts(l),req:1},{n:'origen_id',l:'Ubicación de origen',t:'select',o:u,req:1},
   {n:'destino_id',l:'Ubicación de destino',t:'select',o:u,req:1},{n:'motivo',l:'Motivo del traslado',t:'textarea',req:1,min:5}],
   'REGISTRAR TRASLADO',async(f,d)=>{if(d.get('origen_id')===d.get('destino_id'))throw Error('El origen y el destino no pueden ser iguales');
    await enviar('POST','/traslados','Traslado registrado')(f,d)});
  f.num_inventario.onchange=()=>{const e=l.find(x=>x.num_inventario===f.num_inventario.value);f.origen_id.value=e?(u.find(o=>o[1]===e.ubicacion)||[''])[0]:''};
}};
R.mantenimientos={ok:can.ges,f:()=>listScreen({t:'Mantenimientos',path:'/mantenimientos',btn:'+ Registrar mantenimiento',href:'#/mantenimiento-nuevo',
  card:i=>{const c=!!i.fecha_salida;return item(`${esc(i.num_inventario)} — ${esc(i.equipo||'')}`,[`Motivo: ${esc(i.motivo||'-')}`,`Ingreso: ${esc(i.fecha_ingreso||'-')} · Salida: ${esc(i.fecha_salida||'—')}`],badge(c?'Cerrado':'Abierto',c?'ok':'gold'),c?'':btn('cerrar',i.id,ico('check',14)+' Cerrar mantenimiento'))},
  act:(a,id)=>api(`/mantenimientos/${id}/cerrar`,{method:'PUT'}).then(()=>toast('Mantenimiento cerrado'))})};
R['mantenimiento-nuevo']={ok:can.ges,async f(){
  const l=await eq();
  formScreen('Registrar mantenimiento','Envía un equipo a servicio técnico. El estado cambiará a "En mantenimiento".',[
   {n:'num_inventario',l:'Equipo',t:'select',o:eqOpts(l),req:1},{n:'motivo',l:'Motivo del mantenimiento',t:'textarea',req:1,min:5}],
   'REGISTRAR MANTENIMIENTO',enviar('POST','/mantenimientos','Mantenimiento registrado'));
}};
R['baja-nueva']={ok:can.ges,async f(){
  const l=await eq();
  formScreen('Registrar baja','Retira un equipo del inventario. Esta acción no se puede deshacer.',[
   {n:'num_inventario',l:'Equipo',t:'select',o:eqOpts(l),req:1},{n:'motivo',l:'Motivo de la baja',t:'textarea',req:1,min:5}],
   'REGISTRAR BAJA DEFINITIVA',async(f,d)=>{if(!confirm('¿Seguro? El equipo se eliminará del inventario.'))return;
    await enviar('POST','/bajas','Baja registrada')(f,d)},'err');
}};
R.bajas={ok:can.ges,f:()=>listScreen({t:'Bajas realizadas',path:'/bajas',
  card:i=>item(`${esc(i.num_inventario)} — ${esc(i.equipo||'(eliminado)')}`,[`Motivo: ${esc(i.motivo)}`,`Por ${esc(i.usuario||'-')} · ${esc(i.fecha)}`])})};
R.usuarios={ok:can.usr,f:()=>listScreen({t:'Usuarios registrados',path:'/usuarios',btn:'+ Nuevo usuario',href:'#/usuario-nuevo',
  card:u=>item(esc(u.nombre),[`${esc(u.usuario)} · ${esc(u.correo)}`,`Cargo: ${esc(u.cargo)}`],badge(u.rol),
    (()=>{const fijo=ROLES_FIJOS.includes(u.rol);return `<div class="acts">${fijo?`<span class="fix">${ico('check',13)} Rol fijo: no se puede cambiar</span>`:`<select class="rolsel" data-a="rol" data-id="${u.id}" aria-label="Cambiar rol">${ROLES_EDIT.map(r=>`<option${r===u.rol?' selected':''}>${r}</option>`).join('')}</select>`}${can.del(S.rol)&&!fijo?btn('del',u.id,ico('trash',14)+' Eliminar','','err'):''}</div>`})()),
  act:async(a,id,v)=>{
    if(a==='rol'){await api('/usuarios/'+id,{method:'PUT',body:{rol:v}});return toast('Rol actualizado')}
    if(!confirm('¿Seguro que deseas eliminar este usuario?'))return;await api('/usuarios/'+id,{method:'DELETE'});toast('Usuario eliminado')}})};
R['usuario-nuevo']={ok:can.usr,f:()=>formScreen('Crear usuario','Registra una cuenta con el rol que corresponda.',[
  F.nombre,F.cargo,{...F.correo,l:'Correo'},F.usuario,
  F.clave,{n:'rol',l:'Rol',t:'select',o:IGUAL(ROLES_EDIT),req:1}],'CREAR',enviar('POST','/usuarios','Usuario creado'))};
R.solicitudes={ok:can.del,async f(){
  await listScreen({t:'Solicitudes de acceso',path:'/solicitudes',
    extra:`<button class="btn sm" id="all" type="button">${ico('check',14)} Aprobar todas</button>`,
    card:s=>item(esc(s.nombre),[`${esc(s.usuario)} · ${esc(s.correo)}`,`Cargo: ${esc(s.cargo)}`,`Solicitado: ${esc(s.fecha)}`],badge('Profesor → Administración','gold'),
      `<div class="acts">${btn('ok',s.id,ico('check',14)+' Aprobar')}${btn('no',s.id,ico('trash',14)+' Rechazar','','err')}</div>`),
    act:async(a,id)=>{
      if(a==='ok'){await api(`/solicitudes/${id}/aprobar`,{method:'PUT'});return toast('Solicitud aprobada')}
      if(!confirm('¿Rechazar esta solicitud?'))return;
      await api(`/solicitudes/${id}/rechazar`,{method:'PUT'});toast('Solicitud rechazada')}});
  $('#all').onclick=async()=>{
    if(!confirm('¿Aprobar TODAS las solicitudes pendientes?'))return;
    try{const r=await api('/solicitudes/aprobar-todas',{method:'POST'});toast(r.mensaje);route()}catch(x){toast(x.message,1)}};
}};
function catScreen(t,p,ic){
  shell(t,`<form id="fm" class="inl"><input name="nombre" placeholder="Nombre nuevo" required minlength="3" maxlength="60"><button class="btn" type="submit">Agregar</button></form><div id="ls" class="list"></div>`);
  const L=async()=>{$('#ls').innerHTML=(await api('/'+p)).data.map(x=>item(`${ico(ic,16)} ${esc(x.nombre)}`,[],'',
    `<div class="acts">${btn('edit',x.id,ico('edit',14)+' Editar',x.nombre)}${btn('del',x.id,ico('trash',14)+' Eliminar','','err')}</div>`)).join('')};
  $('#ls').onclick=async e=>{const b=e.target.closest('[data-a]');if(!b)return;
    try{
      if(b.dataset.a==='edit'){const n=prompt('Nuevo nombre:',b.dataset.v);if(!n||!n.trim())return;
        await api(`/${p}/${b.dataset.id}`,{method:'PUT',body:{nombre:n.trim()}});toast('Registro actualizado')}
      else{if(!confirm('¿Eliminar este registro?'))return;await api(`/${p}/${b.dataset.id}`,{method:'DELETE'});toast('Registro eliminado')}
      await L()}catch(x){toast(x.message,1)}};
  bindForm('#fm',async(f,d)=>{await api('/'+p,{method:'POST',body:{nombre:d.get('nombre')}});f.reset();await L();toast('Registro creado')});
  L().catch(e=>toast(e.message,1));
}
R.ubicaciones={ok:can.ges,f:()=>catScreen('Ubicaciones','ubicaciones','pin')};
R.tipos={ok:can.ges,f:()=>catScreen('Tipos de equipo','tipos-equipo','tag')};
const REPS=[
 ['inventario','Inventario de equipos','Todos los equipos con su tipo, ubicación y estado','box',()=>1],
 ['incidencias','Incidencias','Fallas, averías y equipos perdidos reportados','alert',()=>1],
 ['traslados','Traslados realizados','Movimientos de equipos entre ubicaciones','history',can.ges],
 ['mantenimientos','Mantenimientos','Historial de equipos enviados a servicio técnico','wrench',can.ges],
 ['bajas','Bajas realizadas','Equipos retirados del inventario','archive',can.ges],
 ['usuarios','Usuarios del sistema','Cuentas y roles (sin contraseñas)','users',can.usr]];

async function descargar(tipo,fmt){
  const r=await fetch(`/reportes/${tipo}/${fmt}`,{headers:{Authorization:'Bearer '+S.token}});
  if(r.status===401){salir();throw Error('Tu sesión expiró')}
  if(!r.ok){const d=await r.json().catch(()=>({}));throw Error(d.mensaje||'No se pudo generar el reporte')}
  const a=document.createElement('a');
  a.href=URL.createObjectURL(await r.blob());
  a.download=`SIRAME_${tipo}_${new Date().toISOString().slice(0,10)}.${fmt==='pdf'?'pdf':'xlsx'}`;
  a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000);
}

R.reportes={async f(){
  shell('Reportes','<p class="empty">Cargando...</p>');
  const[k,l]=await Promise.all([api('/kpis').then(r=>r.data),eq()]);
  const bars=key=>{const m={};l.forEach(e=>{const v=e[key]||'Sin dato';m[v]=(m[v]||0)+1});const mx=Math.max(1,...Object.values(m));
    return Object.entries(m).map(([n,v])=>`<div class="br"><span>${esc(n)}</span><div><i style="width:${v/mx*100}%"></i></div><b>${v}</b></div>`).join('')||'<p class="empty">Sin datos</p>'};
  const exp=`<section class="card repx"><h2>Exportar reportes</h2><p class="sub">Descarga la información en PDF o Excel</p>
   <div class="rep-grid" id="rx">${REPS.filter(r=>r[4](S.rol)).map(r=>`
    <div class="rep"><i>${ico(r[3],22)}</i><div class="rep-t"><b>${r[1]}</b><small>${r[2]}</small></div>
     <div class="rep-b"><button class="btn sm pdf" data-rep="${r[0]}" data-f="pdf">${ico('pdf',15)} PDF</button>
     <button class="btn sm xls" data-rep="${r[0]}" data-f="excel">${ico('sheet',15)} Excel</button></div></div>`).join('')}</div></section>`;
  shell('Reportes',`${estadoChart(k)}
   <div style="height:12px"></div>${exp}
   <div style="height:12px"></div>${card('Equipos por tipo','Distribución del inventario',bars('tipo'))}
   <div style="height:12px"></div>${card('Equipos por ubicación','Dónde está cada equipo',bars('ubicacion'))}
   <div class="acts" style="margin-top:14px"><button class="btn out sm" onclick="print()">${ico('print',15)} Imprimir pantalla</button></div>`);
  $('#rx').onclick=async e=>{
    const b=e.target.closest('[data-rep]');if(!b||b.disabled)return;
    const t=b.innerHTML;b.disabled=true;b.textContent='Generando...';
    try{await descargar(b.dataset.rep,b.dataset.f);toast('Reporte descargado')}catch(x){toast(x.message,1)}
    b.disabled=false;b.innerHTML=t};
}};

// ---------- enrutador ----------
async function route(){
  const r=location.hash.slice(2)||'inicio',x=R[r]||R.inicio;
  if(!S.token&&!x.pub){location.hash='#/login';return}
  if(x.ok&&!x.ok(S.rol)){toast('No tienes permiso para esta sección',1);location.hash='#/inicio';return}
  try{await x.f()}catch(e){toast(e.message,1)}
  scrollTo(0,0);
}
addEventListener('hashchange',route);route();