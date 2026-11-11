const el = id => document.getElementById(id);
let entries = [], filter = '全部';
function draw(){
  const needle = el('search').value.trim().toLowerCase();
  const found = entries.filter(e => (filter === '全部' || filter === e.kind) && (e.title+' '+e.body).toLowerCase().includes(needle));
  el('list').replaceChildren();
  for(const e of found){
    const item=document.createElement('details'), heading=document.createElement('summary'), meta=document.createElement('div'), body=document.createElement('p');
    meta.className='meta'; meta.textContent=e.date+'　/　'+e.kind;
    heading.append(meta,document.createTextNode(e.title)); body.className='body'; body.textContent=e.body;
    item.append(heading,body); el('list').append(item);
    item.ontoggle=()=>{if(item.open) localJournal.visit(e.title)};
  }
  if(!found.length) el('list').textContent='没有符合条件的记录。';
}
el('filters').onclick=e=>{
  if(e.target.tagName!=='BUTTON')return;
  filter=e.target.textContent;
  for(const b of el('filters').querySelectorAll('button')) b.setAttribute('aria-pressed',String(b===e.target));
  draw();
};
el('search').oninput=draw;
el('notice').textContent='本地记录本 · 编辑和阅读记录仅保存在当前浏览器。';
async function load(){
  const data=await localJournal.read(); entries=data.entries.filter(e=>e.published).sort((a,b)=>b.date.localeCompare(a.date));
  el('brand').textContent=el('name').textContent=document.title=data.name;
  el('intro').textContent=data.intro; draw();
}
load().then(()=>localJournal.visit('首页')).catch(()=>el('message').textContent='无法读取记录，请检查浏览器存储设置后刷新。');
window.addEventListener('pageshow',e=>{if(e.persisted) load()});
window.addEventListener('storage',e=>{if(!e.key?.endsWith(':visits')) load()});
