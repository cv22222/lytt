const el=id=>document.getElementById(id);
const api=window.JOURNAL_API.replace(/\/$/,'') || (['127.0.0.1','localhost'].includes(location.hostname)?location.origin:'');
let token='', editing=null;
async function call(path,method='GET',data){
  const r=await fetch(api+'/api/admin/'+path,{method,headers:{Authorization:'Bearer '+token,...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});
  if(!r.ok)throw Error(r.status===401?'管理密钥不正确。':'操作失败，请检查输入和后台连接。');
  return r.json();
}
function act(fn){return async event=>{event?.preventDefault();el('message').textContent='';try{await fn()}catch(e){el('message').textContent=e.message}}}
function edit(e={}){
  editing=e.id||null;
  for(const k of ['title','body','kind','published','date']) el(k).value=e[k]??({kind:'对话',published:0,date:new Date().toLocaleDateString('sv-SE')}[k]||'');
  el('editor').hidden=false;el('title').focus();
}
async function refresh(){
  const data=await call('journal');el('name').value=data.name;el('intro').value=data.intro;
  el('entries').replaceChildren();
  for(const e of data.entries){
    const row=document.createElement('div');row.className='row';row.textContent=(e.published?'已发布':'草稿')+' · '+e.title;
    for(const [label,fn] of [['编辑',()=>edit(e)],['删除',async()=>{if(confirm('确定删除《'+e.title+'》？')){await call('entries/'+e.id,'DELETE');el('editor').hidden=true;await refresh()}}]]){
      const b=document.createElement('button');b.textContent=label;b.onclick=act(fn);row.append(b);
    }el('entries').append(row);
  }
}
el('login').onsubmit=act(async()=>{if(!api)throw Error('请先在 config.js 配置后台地址，或使用随附的本机启动脚本。');token=el('key').value;await refresh();el('key').value='';el('login').hidden=true;el('panel').hidden=false});
el('logout').onclick=()=>location.reload();
el('new').onclick=()=>edit();
el('settings').onsubmit=act(async()=>{await call('settings','PUT',{name:el('name').value,intro:el('intro').value});el('message').textContent='站点设置已保存。'});
el('editor').onsubmit=act(async()=>{
  const data=Object.fromEntries(['title','body','kind','date','published'].map(k=>[k,el(k).value])); data.published=Number(data.published);
  await call('entries'+(editing?'/'+editing:''),editing?'PUT':'POST',data);el('editor').hidden=true;await refresh();el('message').textContent='记录已保存。';
});
el('logs').onclick=act(async()=>{
  const visits=await call('visits');el('rows').replaceChildren();
  for(const v of visits){const tr=document.createElement('tr');for(const value of [new Date(v.at).toLocaleString(),v.page,v.ip]){const td=document.createElement('td');td.textContent=value;tr.append(td)}el('rows').append(tr)}
  el('visits').hidden=false;el('visits').scrollIntoView();
});
