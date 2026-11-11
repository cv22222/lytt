const api = window.JOURNAL_API.replace(/\/$/, '') || (['localhost','127.0.0.1'].includes(location.hostname) ? location.origin : '');
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
    item.ontoggle=()=>{if(item.open && api) fetch(api+'/api/view/'+encodeURIComponent(e.id),{method:'POST'}).catch(()=>{})};
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
el('notice').textContent=api?'访问说明 · 加载记录本及展开记录时，后台会保存访问时间、所读条目和 IP，供站主管理。':'示例记录本 · 当前仅展示示例内容，未连接统计后台。';
(async()=>{
  const r=await fetch(api?api+'/api/journal':'sample.json'); if(!r.ok)throw Error();
  const data=await r.json(); entries=data.entries; el('brand').textContent=el('name').textContent=document.title=data.name; el('intro').textContent=data.intro;draw();
})().catch(()=>el('message').textContent='记录加载失败，请检查网络或后台地址后刷新。');
