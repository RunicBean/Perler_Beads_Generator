const { createSupabaseStore } = require('./supabase-store.cjs');
const { publicListing } = require('./preview.cjs');
const { t, stripLocale, localePath, categoryLabel } = require('../shared/i18n/runtime.cjs');
const pages = { zh: require('../shared/i18n/pages.zh.json'), en: require('../shared/i18n/pages.en.json') };
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const site = () => new URL(process.env.SITE_URL || 'https://perler-beads-generator.ai-toolsets.com').origin;
const previewEnv = () => process.env.VERCEL_ENV === 'preview';
const guides = pages.zh.guides;
const links = [['/editor','site.editor'],['/marketplace','site.marketplace'],['/guides/image-to-perler','site.guide'],['/guides/mard-colors','site.colors']];
function page({ title, description, path='/', content, image='/examples/cartoon-pattern.png', schema, noindex=false, locale='zh' }) {
 const base = stripLocale(path), localized = localePath(base,locale), url = site()+localized;
 const m = (key,params) => t(key,params,locale);
 const language = locale === 'en' ? 'en' : 'zh-CN';
 const json = JSON.stringify(schema || { '@context':'https://schema.org', '@type':'WebPage', name:title, description, url, inLanguage:language }).replace(/</g,'\\u003c');
 const alternates = [['zh-CN','zh'],['en','en'],['x-default','zh']].map(([tag,l])=>`<link rel="alternate" hreflang="${tag}" href="${escape(site()+localePath(base,l))}">`).join('');
 return `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><meta name="description" content="${escape(description)}"><link rel="canonical" href="${escape(url)}">${alternates}<meta name="robots" content="${noindex || previewEnv() ? 'noindex,follow' : 'index,follow,max-image-preview:large'}"><meta property="og:type" content="website"><meta property="og:locale" content="${locale==='en'?'en_US':'zh_CN'}"><meta property="og:locale:alternate" content="${locale==='en'?'zh_CN':'en_US'}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${escape(url)}"><meta property="og:image" content="${escape(site()+image)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(title)}"><meta name="twitter:description" content="${escape(description)}"><meta name="twitter:image" content="${escape(site()+image)}"><link rel="icon" type="image/svg+xml" href="/logo.svg"><meta name="theme-color" content="#245F50"><link rel="stylesheet" href="/public.css"><script type="application/ld+json">${json}</script></head><body><header class="site-header"><a class="brand" href="${localePath('/',locale)}"><img class="brand-symbol" src="/logo.svg" alt="" width="38" height="38"><span>${m('site.name')}</span></a><nav>${links.map(([u,k])=>`<a href="${localePath(u,locale)}">${m(k)}</a>`).join('')}</nav><div class="site-language" aria-label="${m('common.language')}"><a href="${escape(localePath(base,'zh'))}" lang="zh-CN" hreflang="zh-CN" ${locale==='zh'?'aria-current="page"':''}>中</a><a href="${escape(localePath(base,'en'))}" lang="en" hreflang="en" ${locale==='en'?'aria-current="page"':''}>EN</a></div><div id="account-root"></div></header><main>${content}</main><footer><p>${m('site.footer')}</p><a href="${localePath('/about',locale)}">${m('site.about')}</a> · <a href="${localePath('/privacy',locale)}">${m('site.privacy')}</a></footer><script src="/i18n.js"></script><script src="/vendor/react.production.min.js"></script><script src="/vendor/react-dom.production.min.js"></script><script type="module" src="/src/public-client.js"></script></body></html>`;
}
// Only developer-authored HTML is localized here. User content is escaped at the call site.
function localizeLinks(html,locale) { return html.replace(/(<a\b[^>]*href=")\/(?!\/)([^"#]*)(")/g,(_,before,path,after)=>before+localePath('/'+path,locale)+after); }
function home(locale='zh') {
 const content=pages[locale].home;
 return page({...content,locale,path:'/',content:localizeLinks(content.content,locale),schema:{'@context':'https://schema.org','@type':'WebApplication',name:t('site.name',{},locale),url:site()+localePath('/',locale),applicationCategory:'DesignApplication',operatingSystem:'Web browser',inLanguage:locale==='en'?'en':'zh-CN',description:content.description}});
}
function guidePage(path,locale='zh') { const content=pages[locale].guides[path]; return page({...content,path,locale,content:localizeLinks(content.content,locale)}); }
function createPublicHandler({ store=createSupabaseStore() }={}) {
 return async (req,res,url) => {
  const locale=/^\/en(?:\/|$)/.test(url.pathname)?'en':'zh', p=stripLocale(url.pathname);
  const l=path=>localePath(path,locale), m=(key,params)=>t(key,params,locale);
  if (!['/','/robots.txt','/sitemap.xml','/marketplace'].includes(p) && !guides[p] && !/^\/patterns\/[a-f0-9-]{36}(\/preview.png)?$/.test(p)) return false;
  const send=(status,body,type='text/html; charset=utf-8',cache='public, max-age=0, s-maxage=60')=>{res.writeHead(status,{'Content-Type':type,'Content-Language':locale==='en'?'en':'zh-CN','Cache-Control':previewEnv()?'no-store':cache,'X-Content-Type-Options':'nosniff',...(previewEnv()?{'X-Robots-Tag':'noindex'}:{})});res.end(req.method==='HEAD'?undefined:body);};
  if (!['GET','HEAD'].includes(req.method)) {res.setHeader('Allow','GET, HEAD');send(405,'Method not allowed','text/plain');return true;}
  try {
   if(p==='/') send(200,home(locale));
   else if(guides[p]) send(200,guidePage(p,locale));
   else if(p==='/robots.txt') send(200,`User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${site()}/sitemap.xml\n`,'text/plain; charset=utf-8');
   else if(p==='/sitemap.xml') {
    const count=await store.list({page:1,limit:100,q:'',category:null});
    const requested=Number(url.searchParams.get('page'));
    if(url.searchParams.has('page')) {
     if(!Number.isInteger(requested)||requested<1||requested>Math.max(1,Math.ceil(count.total/100))) {send(404,'Not found','text/plain');return true;}
     const rows=requested===1?count:await store.list({page:requested,limit:100,q:'',category:null});
     const paths=[...(requested===1?['/','/marketplace',...Object.keys(guides)]:[]),...rows.items.map(i=>`/patterns/${i.id}`)];
     send(200,`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.flatMap(path=>['zh','en'].map(lang=>`<url><loc>${escape(site()+localePath(path,lang))}</loc></url>`)).join('')}</urlset>`,'application/xml; charset=utf-8');
    } else send(200,`<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${Array.from({length:Math.max(1,Math.ceil(count.total/100))},(_,i)=>`<sitemap><loc>${escape(site()+'/sitemap.xml?page='+(i+1))}</loc></sitemap>`).join('')}</sitemapindex>`,'application/xml; charset=utf-8');
   } else if(p==='/marketplace') {
    const number=Number(url.searchParams.get('page')||1),q=(url.searchParams.get('q')||'').slice(0,100),category=url.searchParams.get('category')||null;
    if(!Number.isInteger(number)||number<1) {send(404,'Not found','text/plain');return true;}
    const result=await store.list({page:number,limit:24,q,category});
    if(number>1&&!result.items.length) {send(404,'Not found','text/plain');return true;}
    const params=new URLSearchParams();if(q)params.set('q',q);if(category)params.set('category',category);
    const address=n=>{const a=new URLSearchParams(params);if(n>1)a.set('page',String(n));return l('/marketplace')+(a.size?'?'+a:'');};
    send(200,page({locale,title:m('market.title')+(number>1?m('market.pageTitle',{count:number}):'')+'｜'+m('site.name'),description:m('market.description'),path:address(number),noindex:!!(q||category),content:`<p class="eyebrow">${m('market.eyebrow')}</p><h1>${m('market.heading')}</h1><p>${m('market.intro')}</p><form class="search" action="${l('/marketplace')}"><input aria-label="${m('market.search')}" name="q" value="${escape(q)}" placeholder="${m('market.searchPlaceholder')}"><button>${m('market.searchButton')}</button></form><div class="cards">${result.items.map(item=>{const i=publicListing(item);return `<article><a href="${l('/patterns/'+i.id)}"><img src="/patterns/${i.id}/preview.png" alt="${escape(m('market.preview',{title:i.title}))}" width="${i.width}" height="${i.height}" loading="lazy"><h2>${escape(i.title)}</h2></a><p>by ${escape(i.author)}</p><p>${m('market.summary',i)}</p></article>`;}).join('')}</div>${!result.items.length?`<p>${m('market.empty')}</p>`:''}<nav class="pagination">${number>1?`<a href="${escape(address(number-1))}">${m('market.previous')}</a>`:''}<span>${m('market.page',{count:number})}</span>${number*24<result.total?`<a href="${escape(address(number+1))}">${m('market.next')}</a>`:''}</nav>`}));
   } else {
    const id=p.split('/')[2],item=await store.get(id);
    if(!item){send(404,page({locale,title:m('market.missingTitle'),description:m('market.missingDescription'),path:p,noindex:true,content:`<h1>${m('market.missingHeading')}</h1><a href="${l('/marketplace')}">${m('market.back')}</a>`}));return true;}
    const i=publicListing(item);
    if(p.endsWith('/preview.png'))send(200,Buffer.from(i.preview.split(',')[1],'base64'),'image/png','public, max-age=3600, s-maxage=86400');
    else send(200,page({locale,title:m('market.detailTitle',i),description:m('market.detailDescription',i),path:p,image:p+'/preview.png',schema:{'@context':'https://schema.org','@graph':[{'@type':'CreativeWork',name:i.title,description:i.description,url:site()+l(p),image:site()+p+'/preview.png',author:{'@type':'Person',name:i.author},dateCreated:i.createdAt},{'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:m('site.marketplace'),item:site()+l('/marketplace')},{'@type':'ListItem',position:2,name:i.title,item:site()+l(p)}]}]},content:`<a href="${l('/marketplace')}">← ${m('site.marketplace')}</a><section class="detail"><img src="${p}/preview.png" width="${i.width}" height="${i.height}" alt="${escape(m('market.preview',{title:i.title}))}"><div><p class="eyebrow">${escape(categoryLabel(i.category,locale))}</p><h1>${escape(i.title)}</h1><p>by ${escape(i.author)} · ${escape(new Intl.DateTimeFormat(locale==='en'?'en-US':'zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'short',day:'numeric'}).format(new Date(i.createdAt)))}</p><p>${m('market.summary',i)}</p><p class="description">${escape(i.description||m('market.noDescription'))}</p><div id="pattern-actions" data-id="${id}"><p>${m('common.loginRequired')}</p></div><noscript>${m('market.noscript')}</noscript></div></section>`}));
   }
  }catch(error){console.error('Public page failed:',error.status||'internal');send(503,page({locale,title:m('site.unavailable'),description:m('site.tryLater'),path:p,noindex:true,content:`<h1>${m('site.unavailable')}</h1><p>${m('site.tryLater')}</p>`}),'text/html; charset=utf-8','no-store');}
  return true;
 };
}
module.exports={createPublicHandler,page,home,guides,site,guidePage};
