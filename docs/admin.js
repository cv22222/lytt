const el=id=>document.getElementById(id);
let editing=null;
function act(fn){return async event=>{event?.preventDefault();el('message').textContent='';try{await fn()}catch(e){el('message').textContent=e.message}}}
function edit(e={}){
  editing=e.id||null;
  for(const k of ['title','body','kind','published','date']) el(k).value=e[k]??({kind:'对话',published:0,date:new Date().toLocaleDateString('sv-SE')}[k]||'');
  el('editor').hidden=false;el('title').focus();
}
async function refresh(){
  const data=await localJournal.read();el('name').value=data.name;el('intro').value=data.intro;
  el('entries').replaceChildren();
  for(const e of data.entries){
    const row=document.createElement('div');row.className='row';row.textContent=(e.published?'首页显示':'草稿')+' · '+e.title;
    for(const [label,fn] of [['编辑',()=>edit(e)],['删除',async()=>{if(confirm('确定删除《'+e.title+'》？')){await localJournal.change(j=>{j.entries=j.entries.filter(item=>item.id!==e.id)});el('editor').hidden=true;await refresh()}}]]){
      const b=document.createElement('button');b.textContent=label;b.onclick=act(fn);row.append(b);
    }el('entries').append(row);
  }
}
act(async()=>{await refresh();el('panel').hidden=false})();
el('new').onclick=()=>edit();
el('settings').onsubmit=act(async()=>{await localJournal.change(j=>{j.name=el('name').value;j.intro=el('intro').value});el('message').textContent='站点设置已保存。'});
el('editor').onsubmit=act(async()=>{
  const data=Object.fromEntries(['title','body','kind','date','published'].map(k=>[k,el(k).value])); data.published=Number(data.published);
  await localJournal.change(j=>{if(editing){const entry=j.entries.find(e=>e.id===editing);if(!entry)throw Error('记录已删除，请刷新。');Object.assign(entry,data)}else{j.entries.unshift({...data,id:crypto.randomUUID()})}});el('editor').hidden=true;await refresh();el('message').textContent='记录已保存。';
});
el('logs').onclick=act(async()=>{
  const visits=localJournal.visits();el('rows').replaceChildren();
  for(const v of visits){const tr=document.createElement('tr');for(const value of [new Date(v.at).toLocaleString(),v.page]){const td=document.createElement('td');td.textContent=value;tr.append(td)}el('rows').append(tr)}
  el('visits').hidden=false;el('visits').scrollIntoView();
});

