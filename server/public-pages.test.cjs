const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createPublicHandler,home }=require('./public-pages.cjs');
const id='12345678-1234-1234-1234-123456789012';
const project={width:2,height:2,cells:['mard-a1',null,null,null],layers:[{id:'private-layer',cells:['mard-a1',null,null,null]}]};
const item={id,title:'测试 <script>alert(1)</script>',author:'作者',description:'描述 </script><script>bad()</script>',category:'其他',createdAt:'2026-10-20T00:00:00Z',project};
async function call(handler,path,method='GET') {let status,body,headers;const response={setHeader(){},writeHead(s,h){status=s;headers=h;},end(b){body=b;}};await handler({method},response,new URL(path,'https://example.test'));return {status,body,headers};}
const testCategories = ['可爱动物','花草自然','像素游戏','生活小物','其他'].map((name,i) => ({ id: String(i), name, nameEn: name === '可爱动物' ? 'Cute animals' : name, sortOrder: i, active: true }));
const store={async categories(){return testCategories;},async list({page,limit}){return {items:page===1?[item]:[],total:1,page,limit};},async get(key){return key===id?item:null;}};
test('public home and tutorials contain meaningful HTML and canonical without JS',async()=>{
 const handler=createPublicHandler({store});
 for(const path of ['/','/guides/image-to-perler','/guides/mard-colors','/about','/privacy']){const r=await call(handler,path);assert.equal(r.status,200);assert.match(r.body,/<h1>/);assert.match(r.body,/rel="canonical" href="https:\/\/perler-beads-generator.ai-toolsets.com/);assert.doesNotMatch(r.body,/three\.module|src\/main\.js/);}
 assert.match(home(),/WebApplication/);
});
test('public details escape user text, omit private data and serve PNG separately',async()=>{
 const handler=createPublicHandler({store});
 const r=await call(handler,`/patterns/${id}`);assert.equal(r.status,200);assert.match(r.body,/&lt;script&gt;/);assert.doesNotMatch(r.body,/<script>alert|<script>bad|private-layer|mard-a1|password_hash/);
 assert.match(r.body,/CreativeWork/);assert.match(r.body,/BreadcrumbList/);
 const png=await call(handler,`/patterns/${id}/preview.png`);assert.equal(png.headers['Content-Type'],'image/png');assert.ok(Buffer.isBuffer(png.body));assert.equal(png.body.readUInt32BE(0),0x89504e47);
 assert.equal((await call(handler,'/patterns/00000000-0000-0000-0000-000000000000')).status,404);
});
test('pagination, sitemap and errors use appropriate status and index controls',async()=>{
 const handler=createPublicHandler({store});
 const list=await call(handler,'/marketplace');assert.match(list.body,new RegExp(`href="/patterns/${id}"`));assert.doesNotMatch(list.body,/data:image|private-layer/);
 assert.equal((await call(handler,'/marketplace?page=2')).status,404);
 assert.equal((await call(handler,'/marketplace?page=no')).status,404);
 assert.match((await call(handler,'/marketplace?q=test')).body,/noindex,follow/);
 assert.match((await call(handler,'/sitemap.xml')).body,/sitemapindex/);
 assert.match((await call(handler,'/sitemap.xml?page=1')).body,new RegExp(`/patterns/${id}`));
 assert.equal((await call(handler,'/sitemap.xml?page=0')).status,404);
 assert.match((await call(handler,'/robots.txt')).body,/Disallow: \/api\//);
 assert.equal((await call(handler,'/','POST')).status,405);
 assert.equal((await call(handler,'/','HEAD')).body,undefined);
 const broken=createPublicHandler({store:{async categories(){return testCategories;},async list(){throw new Error('secret database error');}}});const r=await call(broken,'/marketplace');assert.equal(r.status,503);assert.equal(r.headers['Cache-Control'],'no-store');assert.doesNotMatch(r.body,/secret database error/);
});
test('preview deployments are noindex and canonical origin does not trust request host',async()=>{
 const old=process.env.VERCEL_ENV;process.env.VERCEL_ENV='preview';
 try{const r=await call(createPublicHandler({store}),'/');assert.equal(r.headers['X-Robots-Tag'],'noindex');assert.equal(r.headers['Cache-Control'],'no-store');assert.doesNotMatch(r.body,/example.test/);assert.match(r.body,/noindex,follow/);}finally{if(old===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=old;}
});
test('Vercel public rewrite dispatches public page with the shared handler',async()=>{
 const {default:handler}=await import('../api/index.js');let status,body;await handler({method:'GET',headers:{host:'example.vercel.app'},url:'/api/index?__public_path=guides/image-to-perler'},{writeHead(s){status=s;},end(b){body=b;}});assert.equal(status,200);assert.match(body,/图片怎么转成拼豆图纸/);
});

test('public filters persist across pagination and admin shell is uncached and contains no private data', async () => {
 let options;
 const handler = createPublicHandler({ store: { async categories(){return testCategories;}, async list(value) { options = value; return { items: [item], total: 60 }; } } });
 const r = await call(handler, '/en/marketplace?beads=small&colors=few&continuity=continuous&sort=continuous&category=其他');
 assert.equal(r.status, 200); assert.equal(options.continuity, 'continuous'); assert.equal(options.sort, 'continuous');
 assert.match(r.body, /name="beads"/); assert.match(r.body, /name="colors"/); assert.match(r.body, /name="continuity"/);
 assert.match(r.body, /beads=small&amp;colors=few&amp;continuity=continuous&amp;sort=continuous&amp;page=2/);
 assert.match(r.body, /Color continuity/); assert.match(r.body, /noindex,follow/);
 assert.equal((await call(handler, '/marketplace?beads=bad')).status, 400);
 for (const path of ['/admin/patterns','/en/admin/patterns']) {
  const admin = await call(handler, path);
  assert.equal(admin.status, 200); assert.equal(admin.headers['Cache-Control'], 'no-store');
  assert.match(admin.body, /market-admin-root/); assert.match(admin.body, /noindex,follow/); assert.doesNotMatch(admin.body, /private-layer|mard-a1|测试/);
 }
});

test('moderated public content and previews are not served from a stale cache', async () => {
 const handler = createPublicHandler({ store });
 for (const path of ['/marketplace', `/patterns/${id}`, `/patterns/${id}/preview.png`]) {
  assert.equal((await call(handler, path)).headers['Cache-Control'], 'no-store');
 }
});

test('public category controls and details use the managed catalog and escape custom names', async () => {
 const category = { id: 'custom', name: '自定义 <分类>', nameEn: 'Custom <category>', active: false, sortOrder: 0 };
 const work = { ...item, category: category.name };
 const handler = createPublicHandler({ store: { async categories() { return [category]; }, async list() { return { items: [work], total: 1 }; }, async get() { return work; } } });
 const list = await call(handler, '/en/marketplace');
 assert.match(list.body, /Custom &lt;category&gt;/); assert.match(list.body, /value="自定义 &lt;分类&gt;"/);
 assert.doesNotMatch(list.body, /Cute animals/);
 const detail = await call(handler, `/en/patterns/${id}`); assert.match(detail.body, /Custom &lt;category&gt;/);
});
