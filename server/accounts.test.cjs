const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { createMarketplaceHandler } = require('./marketplace.cjs');
function setup() {
 const accounts = new Map(), sessions = new Map(), events = [];
 const store = {
 async account(name) { return accounts.get(name); },
 async register(username, password_hash) { if (accounts.has(username)) return; const u = { id: username, username, password_hash }; accounts.set(username,u); return u; },
 async session(hash,id) { if (id) { sessions.set(hash,id); return; } const u = accounts.get(sessions.get(hash)); return u ? { id:u.id,username:u.username } : null; },
 async logout(hash) { sessions.delete(hash); }, async event(e) { events.push(e); }, async stats() { return { pv:1 }; }
 };
 const handler = createMarketplaceHandler({store});
 async function call(method,path,data,cookie='',origin) {
 const req=Readable.from(data === undefined ? [] : [Buffer.from(JSON.stringify(data))]); Object.assign(req,{method,headers:{host:'localhost','content-type':'application/json',cookie,...(origin ? {origin}: {})}});
 let status, result, headers={}; const res={setHeader(k,v){headers[k]=v;},writeHead(s){status=s;},end(b){result=JSON.parse(b);}};
 await handler(req,res,new URL(path,'http://localhost')); return {status,result,headers};
 }
 return {call,accounts,sessions,events};
}
test('password hashes, opaque sessions, login, duplicate registration and logout',async()=>{
 const {call,accounts,sessions}=setup();
 const data={username:'tester',password:'a secure password'};
 assert.equal((await call('POST','/api/auth/register',{...data,password:'short'})).status,400);
 const registered=await call('POST','/api/auth/register',data); assert.equal(registered.status,200);
 assert.equal(registered.result.user.password_hash,undefined); assert.ok(!accounts.get('tester').password_hash.includes(data.password));
 const cookie=registered.headers['Set-Cookie'].split(';')[0]; assert.match(registered.headers['Set-Cookie'],/HttpOnly; SameSite=Lax/);
 assert.equal((await call('GET','/api/auth/me',undefined,cookie)).result.user.username,'tester');
 assert.equal((await call('POST','/api/auth/register',data)).status,409);
 assert.equal((await call('POST','/api/auth/login',{...data,password:'incorrect password'})).status,401);
 assert.equal((await call('POST','/api/auth/login',data)).status,200);
 assert.equal((await call('POST','/api/auth/logout',{},cookie)).status,200);
 assert.equal((await call('GET','/api/auth/me',undefined,cookie)).result.user,null);
 assert.equal(sessions.size,1);
});
test('anonymous publish and statistics denied; event validation and origin checked',async()=>{
 const {call,events}=setup();
 assert.equal((await call('POST','/api/patterns',{})).status,401);
 assert.equal((await call('GET','/api/analytics')).status,403);
 assert.equal((await call('POST','/api/auth/login',{},'', 'https://evil.test')).status,403);
 assert.equal((await call('POST','/api/analytics/events',{name:'arbitrary'})).status,400);
 const id='12345678-1234-1234-1234-123456789012';
 assert.equal((await call('POST','/api/analytics/events',{name:'page_view',visitorId:id,sessionId:id,source:'https://example.com/private?q=secret'})).status,200);
 assert.equal(events[0].source,'example.com');
});
test('only configured administrator receives statistics',async()=>{
 const old=process.env.ADMIN_USERNAMES; process.env.ADMIN_USERNAMES='owner';
 try { const {call}=setup(); const r=await call('POST','/api/auth/register',{username:'owner',password:'long password 123'}); const cookie=r.headers['Set-Cookie'].split(';')[0];
 assert.equal(r.result.user.admin,true); assert.equal((await call('GET','/api/analytics?days=7',undefined,cookie)).result.pv,1);
 assert.equal((await call('GET','/api/analytics?days=2',undefined,cookie)).status,400);
 } finally { if(old===undefined) delete process.env.ADMIN_USERNAMES; else process.env.ADMIN_USERNAMES=old; }
});
