'use strict';
const $ = id => document.getElementById(id);
const encoder = new TextEncoder(), decoder = new TextDecoder();
const prefix = 'journal.v1:' + new URL('.',location.href).pathname;
const vault = prefix + ':night';
let material, vaultKey, notebook, snapshot, editing, busy = false;
const names = {writing:'手记',mood:'我的状态',meaning:'关于 LYTT',share:'分享与收信'};
const say = text => { $('msg').textContent = text; };
function base64(bytes) {
  let text='';
  for(let i=0;i<bytes.length;i+=16384) text+=String.fromCharCode(...bytes.subarray(i,i+16384));
  return btoa(text);
}
const bytes = text => Uint8Array.from(atob(text), c=>c.charCodeAt(0));
const random = n => crypto.getRandomValues(new Uint8Array(n));
async function derive(secret,salt){
  return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:310000},secret,{name:'AES-GCM',length:256},true,['encrypt','decrypt']);
}
async function seal(data,key,salt){
  const iv=random(12);
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,encoder.encode(JSON.stringify(data)));
  return {v:1,salt:base64(salt),iv:base64(iv),cipher:base64(new Uint8Array(encrypted))};
}
async function openPacket(packet,key){
  if(packet.v!==1)throw Error('文件版本无法读取。');
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(packet.iv)},key,bytes(packet.cipher));
  return JSON.parse(decoder.decode(plain));
}
function action(fn){return async ev=>{
  ev?.preventDefault();if(busy)return;busy=true;say('');
  try{await fn()}catch(e){say(e.name==='QuotaExceededError'?'浏览器空间已满，这次修改没有保存。':e.message||'操作失败，请重试。')}finally{busy=false}
}}
async function save(next){
  const write=async()=>{
    if(localStorage.getItem(vault)!==snapshot)throw Error('另一个标签页已修改手记。请刷新后再编辑。');
    const salt=snapshot?bytes(JSON.parse(snapshot).salt):random(16);
    if(!vaultKey)vaultKey=await derive(material,salt);
    const raw=JSON.stringify(await seal(next,vaultKey,salt));
    localStorage.setItem(vault,raw);snapshot=raw;notebook=next;
  };
  if(navigator.locks)await navigator.locks.request(vault,write);else await write();
}
$('unlock').onsubmit=action(async()=>{
  const secret=await crypto.subtle.importKey('raw',encoder.encode($('pass').value),'PBKDF2',false,['deriveKey']);
  const check=await derive(secret,encoder.encode('lytt-night-gate-v1'));
  const digest=await crypto.subtle.digest('SHA-256',await crypto.subtle.exportKey('raw',check));
  if(base64(new Uint8Array(digest))!=='OKaYdeW6UwgP46iN0Py8G2Hk5UqD59hKJYZmJPmTTDk=')throw Error('答案不对，再想想。');
  material=secret;snapshot=localStorage.getItem(vault);
  if(snapshot){
    const packet=JSON.parse(snapshot);vaultKey=await derive(secret,bytes(packet.salt));notebook=await openPacket(packet,vaultKey);
  }else{
    vaultKey=null;
    const old=JSON.parse(localStorage.getItem(prefix)||'{}');
    await save({entries:(old.entries||[]).map(e=>({...e,kind:e.kind||'手记'})),states:{},story:'',previousName:old.name,previousIntro:old.intro,previousVisits:JSON.parse(localStorage.getItem(prefix+':visits')||'[]')});
  }
  localStorage.removeItem(prefix);localStorage.removeItem(prefix+':visits');
  $('pass').value='';$('gate').hidden=true;$('inside').hidden=false;$('lock').hidden=false;
  $('story').value=notebook.story;render();show('writing');if(location.hash.startsWith('#letter=')){show('share');await readLetter(JSON.parse(decoder.decode(bytes(decodeURIComponent(location.hash.slice(8))))));}
});
$('lock').onclick=()=>location.reload();
function show(id){for(const k of Object.keys(names)){ $(k).hidden=k!==id; $('tab-'+k).setAttribute('aria-current',String(k===id)); }say('')}
for(const [id,label] of Object.entries(names)){const b=document.createElement('button');b.id='tab-'+id;b.textContent=label;b.onclick=()=>show(id);$('tabs').append(b)}
function element(tag,text){const n=document.createElement(tag);n.textContent=text;return n}
function card(e){
  const a=document.createElement('article');a.append(element('small',e.date+'　·　'+e.kind),element('h3',e.title),element('p',e.body));a.lastChild.className='body';
  if(typeof e.image==='string'&&/^data:image\/(jpeg|png|webp);base64,/.test(e.image)){const i=new Image();i.className='photo';i.alt='手记配图';i.src=e.image;a.append(i)}
  return a;
}
function choice(id,title){const l=document.createElement('label'),c=document.createElement('input');c.type='checkbox';c.value=id;l.append(c,document.createTextNode(' '+title));$('choices').append(l)}
function render(){
  $('pages').replaceChildren();$('choices').replaceChildren();$('history').replaceChildren();
  for(const e of notebook.entries){
    const a=card(e),b=element('button','编辑'),d=element('button','删除');b.onclick=()=>{
      editing=e.id;if(!Array.from($('kind').options).some(o=>o.value===e.kind))$('kind').add(new Option(e.kind,e.kind));
      $('kind').value=e.kind;$('body').value=e.body;$('title').value=e.title;$('photo').value='';$('cancel').hidden=false;$('title').focus()
    };d.onclick=action(async()=>{if(confirm('删除这篇手记？')){await save({...notebook,entries:notebook.entries.filter(r=>r.id!==e.id)});if(editing===e.id)reset();render()}});a.append(b,d);$('pages').append(a);choice(e.id,e.title);
  }
  if(!notebook.entries.length)$('pages').textContent='第一篇手记可以从今天的一件小事开始。';
  if(notebook.story)choice('_story','LYTT 背后的故事');
  for(const [date,s] of Object.entries(notebook.states).sort((a,b)=>b[0].localeCompare(a[0]))){$('history').append(element('article',[date,s.feeling,'睡眠：'+s.sleep,'饮酒：'+s.drink].join('　·　')))}
}
function reset(){editing=null;$('compose').reset();$('cancel').hidden=true}
$('cancel').onclick=reset;
async function picture(file){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>20*1024*1024)throw Error('请选择 20 MB 以内的 JPG、PNG 或 WebP 图片。');
  const bitmap=await createImageBitmap(file);const zoom=Math.min(1,900/Math.max(bitmap.width,bitmap.height));
  const c=document.createElement('canvas');c.width=Math.max(1,Math.round(bitmap.width*zoom));c.height=Math.max(1,Math.round(bitmap.height*zoom));c.getContext('2d').drawImage(bitmap,0,0,c.width,c.height);bitmap.close();return c.toDataURL('image/jpeg',0.7);
}
const today=()=>new Date().toLocaleDateString('sv-SE');
$('compose').onsubmit=action(async()=>{
  const old=notebook.entries.find(e=>e.id===editing),file=$('photo').files[0],body=$('body').value.trim(),title=$('title').value.trim();
  if(!body&&!title&&!file&&!old?.image)throw Error('先写一点文字，或选一张图片。');
  const e={id:old?.id||crypto.randomUUID(),date:old?.date||today(),kind:$('kind').value,title:title||body.slice(0,22)||'一张照片',body,image:file?await picture(file):old?.image||''};
  await save({...notebook,entries:old?notebook.entries.map(r=>r.id===e.id?e:r):[e,...notebook.entries]});reset();render();say('这一页已加密保存。');
});
$('day').value=today();
function stateFields(){for(const k of ['feeling','sleep','drink'])$(k).value=notebook.states[$('day').value]?.[k]||$(k).options[0].value}
$('day').onchange=stateFields;$('tab-mood').onclick=()=>{show('mood');stateFields()};
$('stateForm').onsubmit=action(async()=>{const s=Object.fromEntries(['feeling','sleep','drink'].map(k=>[k,$(k).value]));await save({...notebook,states:{...notebook.states,[$('day').value]:s}});render();say('这一天的状态已保存。')});
$('saveStory').onclick=action(async()=>{await save({...notebook,story:$('story').value});render();say('故事已保存。')});
async function packageLetter(){
  const ids=new Set(Array.from($('choices').querySelectorAll(':checked'),c=>c.value));if(!ids.size)throw Error('先勾选想分享的内容。');
  const salt=random(16),key=await derive(material,salt),data={type:'letter',entries:notebook.entries.filter(e=>ids.has(e.id)),story:ids.has('_story')?notebook.story:''};
  return seal(data,key,salt);
}
$('linkLetter').onclick=action(async()=>{const packet=await packageLetter();const url=new URL('.',location.href);url.hash='letter='+encodeURIComponent(base64(encoder.encode(JSON.stringify(packet))));if(url.href.length>7000)throw Error('这几页太长，或包含图片。请点「下载选中的页」分享文件。');await navigator.clipboard.writeText(url.href);say('加密链接已复制。对方打开链接并回答问题后，就能读到选中的页。')});
$('export').onclick=action(async()=>{const packet=await packageLetter(),url=URL.createObjectURL(new Blob([JSON.stringify(packet)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='夜航来信.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);say('已生成加密来信。将文件与网址一起给收件人即可。');
});
$('receive').onchange=action(async()=>{
  $('received').replaceChildren();const file=$('receive').files[0];if(!file)return;
  try{await readLetter(JSON.parse(await file.text()));}catch{throw Error('无法打开来信，请确认选择的是这里导出的加密文件。')} });
async function readLetter(packet){const letter=await openPacket(packet,await derive(material,bytes(packet.salt)));
    if(letter.type!=='letter'||!Array.isArray(letter.entries))throw Error();
    if(letter.story)$('received').append(element('h3','关于 LYTT'),element('p',letter.story));
    for(const e of letter.entries)$('received').append(card(e));say('来信已打开。');
}

$('findPage').oninput=()=>{const term=$('findPage').value.trim();for(const a of $('pages').children)a.hidden=!a.textContent.includes(term)};
$('backup').onclick=action(async()=>{
  const url=URL.createObjectURL(new Blob([snapshot],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='我的整本手记-'+today()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
});
$('restore').onchange=action(async()=>{
  const file=$('restore').files[0];if(!file)return;
  const packet=JSON.parse(await file.text());const restored=await openPacket(packet,await derive(material,bytes(packet.salt)));
  if(!Array.isArray(restored.entries)||!restored.states||typeof restored.story!=='string')throw Error('请选择整本备份。');
  if(confirm('用这份备份替换此浏览器中的全部手记和状态？')){await save(restored);location.reload()}
});
