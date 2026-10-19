import { t, useLocale, localePath, categoryLabel, formatDate } from './i18n';
import Account, { api } from './Account';
import { createProject, normalizeProject } from './project';
import { completePalette, getColor } from './palette';
import { downloadProjectJson } from './exporters';
import type { BeadProject } from './types';

const { useState, useEffect } = React;
const favoritesKey = 'perler:marketplace:favorites';
const storageKey = 'perler:marketplace:v1';
type Listing = { id: string; title: string; author: string; description: string; category: string; createdAt: string; project?: BeadProject; width: number; height: number; beads: number; colors: number; preview?: string; favorite: boolean; demo?: boolean };
const categories = ['全部', '可爱动物', '花草自然', '像素游戏', '生活小物', '其他'];
function samples(): Listing[] {
  const shapes = [
    ['草莓小挂件', '花草自然', ['..gg.gg..','...ggg...','..rrrrr..','.rrrrrrr.','.ryrrryr.','..rryrr..','...rrr...','....r....']],
    ['像素小猫', '可爱动物', ['.oo...oo.','.ooo.ooo.','.ooooooo.','.okoo oko.'.replace(/ /g,''),'.ooooooo.','..opppo..','...ooo...']],
    ['花开好心情', '花草自然', ['...ppp...','..ppppp..','.ppyyypp.','.ppyyypp.','..ppppp..','...pgp...','....g.gg.','..ggggg..','....g....']],
  ];
  const colors: Record<string,string> = { r: '#ed4554', g: '#579b66', y: '#f7cd55', o: '#e8a464', k: '#333333', p: '#ee99be' };
  return shapes.map(([title, category, rows], i) => {
    const pattern = rows as string[];
    const project = createProject(16, 16, title as string);
    pattern.forEach((row,y) => [...row].forEach((c,x) => {
      if (colors[c]) {
        const color = completePalette.reduce((a,b) => distance(a.hex,colors[c]) < distance(b.hex,colors[c]) ? a : b);
        project.layers[0].cells[(y+3)*16+x+3] = color.id;
      }
    }));
    project.cells = [...project.layers[0].cells];
    return { id: `demo-${i}`, title: title as string, category: category as string, author: '拼豆灵感室', description: '从一个小图案开始，享受亲手拼出像素世界的快乐。示例图纸，可自由载入编辑。', createdAt: '2026-10-18T00:00:00Z', width: project.width, height: project.height, ...stats(project), project, favorite: false, demo: true };
  });
}
function distance(a:string,b:string) { return [1,3,5].reduce((sum,i) => sum + (parseInt(a.slice(i,i+2),16)-parseInt(b.slice(i,i+2),16))**2,0); }
function readListings(): Listing[] {
  try { const raw = localStorage.getItem(storageKey); const parsed = raw ? JSON.parse(raw) : null; return Array.isArray(parsed) ? parsed.filter(x => x && typeof x.id === 'string' && x.project && Array.isArray(x.project.cells)).map(x => ({ ...x, width: x.project.width, height: x.project.height, ...stats(x.project) })) : samples(); } catch { return samples(); }
}
function stats(project: BeadProject) { const cells = project.cells.filter(Boolean); return { beads: cells.length, colors: new Set(cells).size }; }
function Pattern({ project }: {project: BeadProject}) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    canvas.width = project.width * 12; canvas.height = project.height * 12;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    project.cells.forEach((id,i) => { if (!id) return; ctx.fillStyle = getColor(id)?.hex ?? '#555'; ctx.fillRect((i%project.width)*12, Math.floor(i/project.width)*12,12,12); });
  }, [project]);
  return <canvas ref={ref} role="img" aria-label={t('market.preview', { title: project.name })} />;
}
export default function Marketplace({ current, onClose, onEdit, quickSubmit = false }: {current: BeadProject; onClose:()=>void; onEdit:(project:BeadProject)=>void; quickSubmit?:boolean}) {
  const [locale] = useLocale();
  const [loggedIn, setLoggedIn] = useState(false);
  const [detailProject, setDetailProject] = useState<{ id: string; project: BeadProject } | null>(null);
  const [usageError, setUsageError] = useState('');
  const [heroProject] = useState(() => samples()[0].project!);
  const [localListings] = useState(readListings);
  const [listings,setListings] = useState<Listing[]>([]);
  const [connected,setConnected] = useState(false);
  const [loading,setLoading] = useState(true);
  const [publishing,setPublishing] = useState(false);
  const [reload,setReload] = useState(0);
  const [favoriteIds,setFavoriteIds] = useState<string[]>(() => {
    try { const ids = JSON.parse(localStorage.getItem(favoritesKey) || '[]'); return Array.isArray(ids) ? ids.filter(id => typeof id === 'string') : []; } catch { return []; }
  });
  const [route,setRoute] = useState(() => window.location.hash.slice(1));
  const [submitting,setSubmitting] = useState(quickSubmit);
  const [source,setSource] = useState(current);
  const [title,setTitle] = useState(current.name === 'Untitled Pattern' ? '' : current.name);
  const [author,setAuthor] = useState('');
  const [description,setDescription] = useState('');
  const [category,setCategory] = useState('其他');
  const [filter,setFilter] = useState('全部');
  const [search,setSearch] = useState('');
  const [favorites,setFavorites] = useState(false);
  const [sort,setSort] = useState('new');
  const [error,setError] = useState('');
  useEffect(() => { const change = () => setRoute(window.location.hash.slice(1)); window.addEventListener('hashchange',change); return () => window.removeEventListener('hashchange',change); },[]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    (async () => {
      try {
        const items: Listing[] = [];
        let page = 1;
        let total = 0;
        do {
          const response = await fetch(`/api/patterns?page=${page++}&limit=100`, { signal: controller.signal, headers: { 'Accept-Language': document.documentElement.lang } });
          if (!response.ok) {
            const failure = await response.json().catch(() => null);
            throw new Error(failure?.error || t('marketUI.connection'));
          }
          const result = await response.json();
          items.push(...result.items.map((item: Listing) => ({ ...item, favorite: false })));
          total = result.total;
        } while (items.length < total);
        setListings([...items, ...localListings]); setConnected(true); setError('');
      } catch (e) {
        if (controller.signal.aborted) return;
        setConnected(false); setListings(localListings); setError(`${e instanceof Error ? e.message : t('marketUI.backend')} ${t('marketUI.localFallback')}`);
      } finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [reload, localListings, locale]);
  useEffect(() => {
    const id = route.match(/^marketplace\/([a-f0-9-]{36})$/)?.[1];
    if (!connected || !id) return;
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch(`/api/patterns/${id}`, { signal: controller.signal, headers: { 'Accept-Language': document.documentElement.lang } });
        if (!response.ok) throw new Error(response.status === 404 ? t('marketUI.missing') : t('marketUI.detailFailed'));
        const result = await response.json();
        setListings(items => [{ ...result, favorite: false }, ...items.filter(item => item.id !== id)]);
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : t('marketUI.detailError')); }
    })();
    return () => controller.abort();
  }, [route, connected, locale]);
  async function publish() {
    if (publishing) return;
    if (!stats(source).beads) { setError(t('marketUI.emptyPattern')); return; }
    if (!title.trim()) { setError(t('marketUI.titleRequired')); return; }
    setPublishing(true); setError('');
    try {
      const response = await fetch('/api/patterns', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept-Language': document.documentElement.lang }, body: JSON.stringify({ title: title.trim(), author, description, category, project: source }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || t('marketUI.publishError'));
      const item = { ...result, width: result.project.width, height: result.project.height, ...stats(result.project), favorite: false } as Listing;
      setListings(previous => [item, ...previous]); setSubmitting(false); window.location.assign(localePath(`/patterns/${item.id}`, locale));
    } catch (e) { setError(e instanceof Error ? e.message : t('marketUI.publishError')); }
    finally { setPublishing(false); }
  }
  const decorated = listings.map(item => ({ ...item, favorite: favoriteIds.includes(item.id) }));
  const selected = decorated.find(x => route === `marketplace/${x.id}`);
  useEffect(() => {
    setDetailProject(null); setUsageError('');
    if (!loggedIn || !selected) return;
    let active = true;
    if ((selected.demo || !/^[a-f0-9-]{36}$/.test(selected.id)) && selected.project) {
      setDetailProject({ id: selected.id, project: normalizeProject(selected.project) });
      return;
    }
    void api(`patterns/${selected.id}/project`).then(result => {
      if (active) setDetailProject({ id: selected.id, project: normalizeProject(result.project) });
    }).catch(e => { if (active) setUsageError((e as Error).message); });
    return () => { active = false; };
  }, [loggedIn, selected?.id, reload]);
  const usageProject = loggedIn && detailProject?.id === selected?.id ? detailProject?.project : undefined;
  const colorUsage = new Map<string, number>();
  usageProject?.cells.forEach(id => { if (id) colorUsage.set(id, (colorUsage.get(id) || 0) + 1); });
  const visible = decorated.filter(x => (filter === '全部' || x.category === filter) && (!favorites || x.favorite) && `${x.title} ${x.author} ${x.description}`.toLowerCase().includes(search.toLowerCase())).sort((a,b) => sort === 'small' ? a.beads-b.beads : b.createdAt.localeCompare(a.createdAt));
  function favorite(item:Listing) {
    const next = favoriteIds.includes(item.id) ? favoriteIds.filter(id => id !== item.id) : [...favoriteIds, item.id];
    try { localStorage.setItem(favoritesKey,JSON.stringify(next)); setFavoriteIds(next); }
    catch { setError(t('marketUI.favoriteError')); }
  }
  async function usePattern(item: Listing, download: boolean) {
    setError('');
    try {
      const { user } = await api('auth/me');
      if (!user) throw new Error(t('marketUI.loginRequired'));
      const project = (item.demo || !/^[a-f0-9-]{36}$/.test(item.id)) && item.project ? normalizeProject(item.project) : normalizeProject((await api(`patterns/${item.id}/project`)).project);
      if (download) downloadProjectJson(project); else onEdit(normalizeProject(JSON.parse(JSON.stringify(project))));
    } catch (e) { setError((e as Error).message); }
  }
  function preview(item: Listing) { return item.project ? <Pattern project={item.project}/> : <img src={item.preview} alt={t('market.preview', { title: item.title })} />; }
  async function upload(file:File) {
    try {
      if (file.size > 5*1024*1024) throw new Error(t('marketUI.fileSize'));
      const value = JSON.parse(await file.text());
      if (!Number.isInteger(value.width) || !Number.isInteger(value.height) || value.width < 1 || value.height < 1 || value.width > 180 || value.height > 180 || !Array.isArray(value.cells) || value.cells.length !== value.width*value.height || value.cells.some((c:unknown) => c !== null && (typeof c !== 'string' || !getColor(c)))) throw new Error(t('marketUI.invalidFile'));
      if (value.layers !== undefined && (!Array.isArray(value.layers) || value.layers.length > 100 || value.layers.some((layer: any) => !layer || !Array.isArray(layer.cells) || layer.cells.length !== value.width * value.height || layer.cells.some((c: unknown) => c !== null && (typeof c !== 'string' || !getColor(c)))))) throw new Error(t('marketUI.invalidLayers'));
      const project = normalizeProject(value); setSource(project); setTitle(project.name); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : t('marketUI.readError')); }
  }
  return <section className="marketplace" onKeyDown={e => e.stopPropagation()}>
    <header className="market-header"><a href="#marketplace" className="market-brand">▦ {t('marketUI.brand')} <small>MARKETPLACE</small></a><nav><Account recordVisit={false} onLoginChange={setLoggedIn} /><button onClick={() => {setSubmitting(false); window.location.hash='marketplace';}}>{t('marketUI.browse')}</button><button onClick={onClose}>{t('marketUI.backEditor')}</button><button className="market-primary" onClick={() => {setSubmitting(true); setError('');}}>{t('marketUI.submit')}</button></nav></header>
    <div className="market-content"><p className="market-local">{loading ? t('marketUI.connecting') : connected ? t('marketUI.connected') : t('marketUI.offline')}</p>{error && <p role="alert" className="market-error">{error} {!connected && <button onClick={() => setReload(x => x + 1)}>{t('marketUI.reconnect')}</button>}</p>}
    {submitting ? <div className="market-submit"><div><p className="market-eyebrow">SHARE YOUR PIXELS</p><h1>{t('marketUI.shareHeading')}</h1><p>{t('marketUI.shareIntro')}</p><div className="market-art"><Pattern project={source}/></div><p>{t('market.summary', { width: source.width, height: source.height, ...stats(source) }, locale)}</p><label className="market-upload">{t('marketUI.replaceFile')}<input type="file" accept=".json,application/json" onChange={e=>{const file=e.target.files?.[0]; if(file) void upload(file); e.target.value='';}}/></label></div>
    <form onSubmit={e=>{e.preventDefault(); void publish();}}>
    <label>{t('marketUI.patternTitle')}<input required maxLength={60} value={title} onChange={e=>setTitle(e.target.value)} placeholder={t('marketUI.patternPlaceholder')}/></label><label>{t('marketUI.author')}<input maxLength={30} value={author} onChange={e=>setAuthor(e.target.value)} placeholder={t('marketUI.authorPlaceholder')}/></label><label>{t('marketUI.category')}<select value={category} onChange={e=>setCategory(e.target.value)}>{categories.slice(1).map(c=><option key={c} value={c}>{categoryLabel(c, locale)}</option>)}</select></label><label>{t('marketUI.description')}<textarea maxLength={1000} rows={5} value={description} onChange={e=>setDescription(e.target.value)} placeholder={t('marketUI.descriptionPlaceholder')}/></label><p>{t('marketUI.permission')}</p><div className="market-actions"><button type="button" onClick={()=>setSubmitting(false)}>{t('marketUI.cancel')}</button><button className="market-primary" type="submit" disabled={publishing || !connected || loading}>{publishing ? t('marketUI.publishing') : t('marketUI.publish')}</button></div></form></div>
    : selected ? <><a href="#marketplace" className="market-back">{t('marketUI.all')}</a><div className="market-detail"><div className="market-art">{preview(selected)}</div><div><p className="market-eyebrow">{categoryLabel(selected.category, locale)} {selected.demo && t('marketUI.demoSuffix')}</p><h1>{selected.title}</h1><p>by {selected.author} · {formatDate(selected.createdAt, locale)}</p><div className="market-stats"><span><b>{selected.width} × {selected.height}</b>{t('marketUI.dimensions')}</span><span><b>{selected.beads}</b>{t('marketUI.beads')}</span><span><b>{selected.colors}</b>{t('marketUI.colors')}</span></div><p className="market-description">{selected.description || t('marketUI.noDescription')}</p><div className="market-actions"><button className="market-primary" onClick={()=>void usePattern(selected, false)}>{t('common.load')}</button><button onClick={()=>favorite(selected)}>{selected.favorite?t('marketUI.favorited'):t('marketUI.favorite')}</button><button onClick={()=>void usePattern(selected, true)}>{t('common.download')}</button></div><p>{t('marketUI.undoHint')}</p>{!loggedIn ? <p>{t('common.loginRequired')}</p> : <><h3>{t('common.colorUsage')}</h3>{usageProject ? <div className="market-colors">{[...colorUsage].sort((a,b) => b[1]-a[1]).map(([id,count]) => <span key={id}><i style={{background:getColor(id)?.hex}}/>{getColor(id)?.primaryCode}<b>{t('common.beadCount', { count }, locale)}</b></span>)}</div> : usageError ? <p role="alert">{usageError} <button onClick={() => setReload(value => value + 1)}>{t('common.retry')}</button></p> : <p role="status">{t('marketUI.loadingColors')}</p>}</>}</div></div></>
    : loading ? <div className="market-empty" role="status">{t('marketUI.loadingPatterns')}</div> : route.startsWith('marketplace/') ? <div className="market-empty"><h2>{t('marketUI.missingHeading')}</h2><p>{t('marketUI.missingHint')}</p><a href="#marketplace">{t('marketUI.backList')}</a></div>
    : <><div className="market-hero"><div><p className="market-eyebrow">A LITTLE BEAD, A LOT OF IDEAS</p><h1>{t('marketUI.heroLineOne')}<br/>{t('marketUI.heroLineTwo')}</h1><p>{t('marketUI.heroIntro')}</p><button className="market-primary" onClick={()=>setSubmitting(true)}>{t('marketUI.share')}</button></div><div className="market-hero-art"><Pattern project={heroProject}/><span>{t('marketUI.heroTagline')}</span></div></div>
    <div className="market-toolbar"><h2>{t('marketUI.browse')} <small>{t('marketUI.patternCount', { count: visible.length }, locale)}</small></h2><input type="search" aria-label={t('market.search')} placeholder={t('marketUI.searchPlaceholder')} value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label={t('marketUI.sort')} value={sort} onChange={e=>setSort(e.target.value)}><option value="new">{t('marketUI.newest')}</option><option value="small">{t('marketUI.smallest')}</option></select></div><div className="market-filters">{categories.map(c=><button key={c} className={filter===c?'active':''} onClick={()=>setFilter(c)}>{categoryLabel(c, locale)}</button>)}<button className={favorites?'active':''} onClick={()=>setFavorites(!favorites)}>{t('marketUI.favorites')}</button></div>
    <div className="market-grid">{visible.map(item=><article className="market-card" key={item.id}><a href={item.demo ? `#marketplace/${item.id}` : localePath(`/patterns/${item.id}`, locale)} className="market-card-image">{preview(item)}<span>{item.demo?t('marketUI.demo'):categoryLabel(item.category, locale)}</span></a><div className="market-card-body"><div><a href={item.demo ? `#marketplace/${item.id}` : localePath(`/patterns/${item.id}`, locale)}><h3>{item.title}</h3></a><button aria-label={`${item.favorite?t('marketUI.removeFavorite'):t('marketUI.saveFavorite')}${item.title}`} onClick={()=>favorite(item)}>{item.favorite?'♥':'♡'}</button></div><p>by {item.author}</p><footer>{t('market.summary', { width: item.width, height: item.height, beads: item.beads, colors: item.colors }, locale)}</footer></div></article>)}</div>{!visible.length && <div className="market-empty"><h2>{t('marketUI.noMatches')}</h2><p>{t('marketUI.trySearch')}</p><button onClick={()=>{setSearch('');setFilter('全部');setFavorites(false);}}>{t('marketUI.viewAll')}</button></div>}</>}
    </div>
  </section>;
}
