const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Readable}=require('node:stream');
const {t,localePath,stripLocale,categoryLabel}=require('../shared/i18n/runtime.cjs');
const {requestLocale,localizeError}=require('./localize-errors.cjs');
const {createPublicHandler,home}=require('./public-pages.cjs');
const {createMarketplaceHandler}=require('./marketplace.cjs');
const id='12345678-1234-1234-1234-123456789012';
const item={id,title:'用户作品 <script>',author:'原作者',description:'保留中文描述',category:'可爱动物',createdAt:'2026-10-20T00:00:00Z',project:{width:1,height:1,cells:['mard-a1']}};
const store={async list(){return{items:[item],total:1};},async get(){return item;}};
async function call(handler,path,method='GET',payload,language='en-US'){
 const req=Readable.from(payload===undefined?[]:[Buffer.from(JSON.stringify(payload))]);Object.assign(req,{method,headers:{host:'localhost','content-type':'application/json','accept-language':language}});
 let status,body,headers={};const res={setHeader(k,v){headers[k]=v;},writeHead(s,h){status=s;headers={...headers,...h};},end(b){body=b;}};
 await handler(req,res,new URL(path,'http://localhost'));return{status,body,headers};
}
test('catalog keys, placeholders and public page coverage are consistent',()=>require('../scripts/check-i18n.cjs').check());
test('locale routing is idempotent and never prefixes images or API accidentally',()=>{
 assert.equal(localePath('/','en'),'/en');assert.equal(localePath('/en','zh'),'/');
 assert.equal(localePath('/en/marketplace?page=2','en'),'/en/marketplace?page=2');
 assert.equal(localePath('/en/patterns/'+id,'zh'),'/patterns/'+id);
 assert.equal(stripLocale('/english'),'/english');assert.equal(categoryLabel('可爱动物','en'),'Cute animals');
});
test('translations support fallback, named interpolation, and singular/plural',()=>{
 assert.equal(t('common.beadCount',{count:1},'en'),'1 bead');assert.equal(t('common.beadCount',{count:2},'en'),'2 beads');
 assert.equal(t('common.beadCount',{count:1},'zh'),'1 颗');assert.equal(t('missing.key',{},'en'),'missing.key');
 assert.equal(t('account.login',{},'fr'),'登录');assert.equal(t('marketUI.patternCount',{count:1},'en'),'1 pattern');
});
test('server language negotiation honors supported languages and quality values',()=>{
 assert.equal(requestLocale('zh-CN;q=0.5,en-US;q=0.9'),'en');assert.equal(requestLocale('en;q=0,zh;q=1'),'zh');assert.equal(requestLocale('fr-FR,en;q=0.8'),'en');
 assert.equal(localizeError({error:'账号或密码错误。'},'en').code,'error.invalidCredentials');
 assert.equal(localizeError({error:'文本长度须不超过 60 字。'},'en').error,'Text must not exceed 60 characters.');
});
test('public English HTML has self canonical, reciprocal alternates and translated links',async()=>{
 for(const path of ['/en','/en/guides/image-to-perler','/en/guides/mard-colors','/en/about','/en/privacy','/en/marketplace','/en/patterns/'+id]){
  const r=await call(createPublicHandler({store}),path);assert.equal(r.status,200,path);assert.match(r.body,/<html lang="en">/);assert.equal(r.headers['Content-Language'],'en');
  assert.ok(r.body.includes(`rel="canonical" href="https://perler-beads-generator.ai-toolsets.com${path}"`));
  assert.match(r.body,/hreflang="zh-CN"/);assert.match(r.body,/hreflang="en"/);assert.match(r.body,/hreflang="x-default"/);assert.match(r.body,/href="\/en\/editor"/);
 }
 assert.match(home('en'),/Your pictures/);assert.match(home('zh'),/图片变图纸/);
 const detail=await call(createPublicHandler({store}),'/en/patterns/'+id);assert.match(detail.body,/用户作品 &lt;script&gt;/);assert.match(detail.body,/保留中文描述/);assert.match(detail.body,/Cute animals/);assert.doesNotMatch(detail.body,/mard-a1/);
 const map=await call(createPublicHandler({store}),'/sitemap.xml?page=1');assert.ok(map.body.includes('/en/patterns/'+id));
});
test('English errors preserve authentication and validation status codes',async()=>{
 const handler=createMarketplaceHandler({store:{}});
 for(const [path,method,data,expected] of [['/api/auth/register','POST',{username:'x',password:'short'},400],['/api/patterns/'+id+'/project','GET',undefined,401],['/api/analytics','GET',undefined,403]]){
  const result=await call(handler,path,method,data);assert.equal(result.status,expected);const value=JSON.parse(result.body);assert.match(value.code,/^error\./);assert.doesNotMatch(value.error,/[\u4e00-\u9fff]/);
 }
 const zh=await call(handler,'/api/auth/register','POST',{},'zh-CN');assert.match(JSON.parse(zh.body).error,/账号/);
});
test('English Vercel rewrite retains public locale',async()=>{
 const {default:handler}=await import('../api/index.js');let status,body;
 await handler({method:'GET',url:'/api/index?__public_path=en/guides/image-to-perler',headers:{host:'preview.vercel.app'}},{writeHead(s){status=s;},end(b){body=b;}});
 assert.equal(status,200);assert.match(body,/<html lang="en">/);assert.match(body,/How to turn an image/);
});
