import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID,randomBytes,createHash,timingSafeEqual} from 'node:crypto';

const root=fileURLToPath(new URL('../',import.meta.url));
const host=process.env.HOST||'127.0.0.1', port=Number(process.env.PORT||8787);
const secret=process.env.ADMIN_KEY||randomBytes(32).toString('base64url');
if(secret.length<24)throw Error('ADMIN_KEY 至少 24 个字符');
const origin=process.env.SITE_ORIGIN||'http://'+host+':'+port;
const database=resolve(process.env.DB_PATH||resolve(root,'data/journal.sqlite'));
mkdirSync(dirname(database),{recursive:true});
const db=new DatabaseSync(database);
db.exec(`PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY,name TEXT,intro TEXT);
CREATE TABLE IF NOT EXISTS entries(id TEXT PRIMARY KEY,title TEXT,body TEXT,kind TEXT,date TEXT,published INTEGER);
CREATE TABLE IF NOT EXISTS visits(at TEXT,page TEXT,ip TEXT);`);
db.prepare('INSERT OR IGNORE INTO settings VALUES(1,?,?)').run('间记','存下聊过的话，和日子里正在发生的变化。');
const hash=v=>createHash('sha256').update(v).digest();
const credential=hash('Bearer '+secret);
function fail(status){throw Object.assign(Error(),{status})}
async function payload(req){
  let size=0,chunks=[];
  for await(const c of req){size+=c.length;if(size>300000)fail(413);chunks.push(c)}
  try{const d=JSON.parse(Buffer.concat(chunks));if(!d||Array.isArray(d)||typeof d!=='object')fail(400);return d}catch{fail(400)}
}
const valid=(v,n)=>typeof v==='string'&&v.trim().length>0&&v.length<=n;
function journal(admin){
  const settings=db.prepare('SELECT name,intro FROM settings WHERE id=1').get();
  const entries=db.prepare('SELECT * FROM entries '+(admin?'':'WHERE published=1 ')+'ORDER BY date DESC,rowid DESC').all();
  return {...settings,entries};
}
function visit(req,page){
  let ip=req.socket.remoteAddress;
  if(process.env.TRUST_LOCAL_PROXY==='1'&&['127.0.0.1','::1','::ffff:127.0.0.1'].includes(ip))ip=req.headers['x-real-ip']||ip;
  db.prepare('INSERT INTO visits VALUES(?,?,?)').run(new Date().toISOString(),page,ip);
}
const assets=new Set(['index.html','admin.html','app.js','admin.js','config.js','style.css','sample.json']);
const mime={'.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json'};
const server=http.createServer(async(req,res)=>{
  const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data))};
  try{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    const path=new URL(req.url,'http://localhost').pathname,method=req.method;
    if(req.headers.origin && req.headers.origin!==origin)fail(403);
    res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');
    if(method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Headers':'Authorization,Content-Type','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS'});return res.end()}
    if(path==='/api/journal'&&method==='GET'){visit(req,'首页');return send(200,journal(false))}
    if(path.startsWith('/api/view/')&&method==='POST'){
      const entry=db.prepare('SELECT title FROM entries WHERE id=? AND published=1').get(path.slice(10));if(!entry)fail(404);
      visit(req,entry.title);return send(200,{ok:true});
    }
    if(path.startsWith('/api/admin/')){
      if(!timingSafeEqual(hash(req.headers.authorization||''),credential))fail(401);
      const route=path.slice(11);
      if(route==='journal'&&method==='GET')return send(200,journal(true));
      if(route==='visits'&&method==='GET')return send(200,db.prepare('SELECT * FROM visits ORDER BY rowid DESC LIMIT 200').all());
      if(route==='settings'&&method==='PUT'){
        const d=await payload(req);if(!valid(d.name,80)||typeof d.intro!=='string'||d.intro.length>400)fail(400);
        db.prepare('UPDATE settings SET name=?,intro=? WHERE id=1').run(d.name,d.intro);return send(200,{ok:true});
      }
      const match=/^entries(?:\/([a-f0-9-]{36}))?$/.exec(route);
      if(!match)fail(404);
      const id=match[1];
      if(id&&!db.prepare('SELECT 1 FROM entries WHERE id=?').get(id))fail(404);
      if(method==='DELETE'&&id){db.prepare('DELETE FROM entries WHERE id=?').run(id);return send(200,{ok:true})}
      if((method==='POST'&&!id)||(method==='PUT'&&id)){
        const d=await payload(req);
        if(!valid(d.title,200)||!valid(d.body,60000)||!['对话','状况'].includes(d.kind)||!/^\d{4}-\d{2}-\d{2}$/.test(d.date)||![0,1].includes(d.published))fail(400);
        const uid=id||randomUUID();db.prepare('INSERT OR REPLACE INTO entries VALUES(?,?,?,?,?,?)').run(uid,d.title,d.body,d.kind,d.date,d.published);return send(200,{id:uid});
      }
    }
    const asset=path==='/'?'index.html':path.slice(1);
    if(method==='GET'&&assets.has(asset)){res.writeHead(200,{'Content-Type':mime[extname(asset)]+'; charset=utf-8'});return res.end(readFileSync(resolve(root,'docs',asset)))}
    fail(404);
  }catch(e){send(e.status||500,{error:e.status||500})}
});
server.listen(port,host,()=>{console.log('记录本已启动 http://'+host+':'+port);if(!process.env.ADMIN_KEY)console.log('本次管理密钥（仅用于本机）：'+secret)});

