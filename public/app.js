const $=s=>document.querySelector(s);
const subjList=()=>[...new Set(items.map(i=>i.subject).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
let admin=false,items=[],q='',sub='All',typ='all',editId=null;
const esc=t=>String(t||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
async function api(u,o={}){const r=await fetch(u,{credentials:'same-origin',...o});let d={};try{d=await r.json()}catch(e){}if(!r.ok)throw Object.assign(new Error(d.error||'Something went wrong'),{status:r.status});return d}
const isAdmin=()=>admin;
function applyAdmin(){$('#adminBar').hidden=!admin;$('#fab').hidden=!admin;$('#alink').hidden=admin;render()}
async function load(){try{items=await api('/api/items');render()}catch(e){}}
async function adminLogin(){$('#a-go').disabled=true;try{await api('/api/admin-login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:$('#apw').value})});admin=true;$('#adm').close();applyAdmin()}catch(e){$('#aerr').textContent=e.message}$('#a-go').disabled=false}
function render(){
  const n=items.filter(i=>i.kind==='note').length;
  $('#stats').innerHTML=`<span class="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm backdrop-blur">📄 ${n} notes</span><span class="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm backdrop-blur">🎬 ${items.length-n} Kuppi videos</span>`;
  const used=subjList();if(sub!=='All'&&!used.includes(sub))sub='All';
  $('#subs').innerHTML=['All',...used].map(s=>`<button class="chip ${s===sub?'on':''}" data-s="${esc(s)}">${esc(s)}</button>`).join('');
  $('#tabs').innerHTML=[['all','Everything'],['note','Lecture notes'],['kuppi','Kuppi videos']].map(([v,l])=>`<button class="chip ${v===typ?'on':''}" data-t="${v}">${l}</button>`).join('');
  const list=items.filter(i=>(sub==='All'||i.subject===sub)&&(typ==='all'||i.kind===typ)&&(i.title+' '+(i.description||'')+' '+i.subject).toLowerCase().includes(q.toLowerCase()));
  $('#app').innerHTML=list.length?list.map(card).join(''):`<div class="col-span-full py-16 text-center text-mut"><b class="block text-5xl">📚</b>${items.length?'Nothing matches your search.':(isAdmin()?'Tap “Add material” to upload your first note or video.':'Materials are coming soon. Check back shortly!')}</div>`;
}
function card(i){
  const k=i.kind==='kuppi',f=`/api/items/${i.id}/file`,vid=i.has_file&&/^video\//.test(i.mime||'');
  const act=vid?`<button class="btn" data-play="${i.id}">▶ Watch</button>`:i.has_file?`<a class="link" href="${f}?dl=1">Download</a> <a class="btn" href="${f}" target="_blank" rel="noopener">Open</a>`:`<a class="btn" href="${esc(i.url)}" target="_blank" rel="noopener">${k?'▶ Watch':'Open'}</a>`;
  const adm=isAdmin()?`<button class="link" data-edit="${i.id}">Edit</button> <button class="link" data-del="${i.id}">Delete</button> `:'';
  const bg=k?'from-blue-700 via-sky-500 to-cyan-400':'from-indigo-700 via-violet-700 to-fuchsia-600';
  return `<article class="flex flex-col gap-2 rounded-[20px] bg-gradient-to-br ${bg} p-5 shadow-xl shadow-black/40 transition hover:-translate-y-1">
    <div class="flex items-center justify-between gap-2"><span class="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold">${k?'🎬 Kuppi':'📄 Notes'}</span><span class="text-xs text-white/75">${esc(i.subject)}</span></div>
    <h3 class="my-0.5 text-xl font-bold leading-snug">${esc(i.title)}</h3>
    <p class="flex-1 text-sm text-white/80">${esc(i.description)}</p>
    <div class="mt-2 flex items-center justify-between gap-2"><span class="text-xs text-white/70">${new Date(i.created).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</span><span class="flex items-center gap-2.5">${adm}${act}</span></div></article>`;
}
function openForm(i){
  editId=i?i.id:null;$('#dh').textContent=i?'Edit material':'Add material';
  $('#f-title').value=i?i.title:'';$('#f-sub').value=i?i.subject:'';$('#sl').innerHTML=subjList().map(s=>`<option value="${esc(s)}">`).join('');$('#f-kind').value=i?i.kind:'note';$('#f-desc').value=i?(i.description||''):'';
  $('#f-link').value=i&&!i.has_file?i.url:'';$('#f-file').value='';
  $('#fl').textContent=i?(i.has_file?'Current file: '+(i.file_name||'uploaded file')+'. Choose a new file to replace it (optional)':'Upload a file instead of the link (optional)'):'Upload a file (PDF, slides or video, up to 15 MB)';
  $('#msg').textContent='';$('#f-save').disabled=false;$('#add').showModal();
}
async function saveForm(){
  const m=$('#msg'),file=$('#f-file').files[0];
  if(!$('#f-title').value.trim()){m.textContent='Please enter a title.';return}
  if(!$('#f-sub').value.trim()){m.textContent='Please type a subject name.';return}
  if(file&&file.size>15*1024*1024){m.textContent='That file is over 15 MB. Use a link instead.';return}
  const fd=new FormData();fd.append('title',$('#f-title').value);fd.append('subject',$('#f-sub').value.trim());fd.append('kind',$('#f-kind').value);fd.append('desc',$('#f-desc').value);fd.append('link',$('#f-link').value);if(file)fd.append('file',file);
  m.textContent='Saving…';$('#f-save').disabled=true;
  try{await api(editId?'/api/items/'+editId:'/api/items',{method:editId?'PUT':'POST',body:fd});$('#add').close();await load()}
  catch(e){m.textContent=e.message;$('#f-save').disabled=false}
}
document.addEventListener('click',async e=>{
  const t=e.target.closest('[data-s],[data-t],[data-play],[data-edit],[data-del]');if(!t)return;const d=t.dataset;
  if(d.s){sub=d.s;render()}else if(d.t){typ=d.t;render()}
  else if(d.play){$('#vbox').innerHTML=`<video controls autoplay src="/api/items/${+d.play}/file"></video>`;$('#vid').showModal()}
  else if(d.edit){openForm(items.find(x=>x.id==d.edit))}
  else if(d.del&&confirm('Delete this item for everyone?')){try{await api('/api/items/'+d.del,{method:'DELETE'});await load()}catch(err){alert(err.message)}}
});
$('#q').oninput=e=>{q=e.target.value;render()};
$('#alink').onclick=()=>{$('#apw').value='';$('#aerr').textContent='';$('#adm').showModal();$('#apw').focus()};
$('#a-cancel').onclick=()=>$('#adm').close();$('#a-go').onclick=adminLogin;
$('#apw').addEventListener('keydown',e=>{if(e.key==='Enter')adminLogin()});
$('#out').onclick=async()=>{try{await api('/api/logout',{method:'POST'})}catch(e){}admin=false;applyAdmin()};
$('#fab').onclick=()=>openForm(null);$('#f-save').onclick=saveForm;$('#f-cancel').onclick=()=>$('#add').close();
$('#v-close').onclick=()=>$('#vid').close();$('#vid').addEventListener('close',()=>{$('#vbox').innerHTML=''});
(async()=>{try{admin=(await api('/api/me')).admin}catch(e){}applyAdmin();await load()})();
