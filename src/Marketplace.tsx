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
  return <canvas ref={ref} role="img" aria-label={`${project.name}图纸预览`} />;
}
export default function Marketplace({ current, onClose, onEdit, quickSubmit = false }: {current: BeadProject; onClose:()=>void; onEdit:(project:BeadProject)=>void; quickSubmit?:boolean}) {
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
          const response = await fetch(`./api/patterns?page=${page++}&limit=100`, { signal: controller.signal });
          if (!response.ok) {
            const failure = await response.json().catch(() => null);
            throw new Error(failure?.error || '无法连接图纸服务。');
          }
          const result = await response.json();
          items.push(...result.items.map((item: Listing) => ({ ...item, favorite: false })));
          total = result.total;
        } while (items.length < total);
        setListings([...items, ...localListings]); setConnected(true); setError('');
      } catch (e) {
        if (controller.signal.aborted) return;
        setConnected(false); setListings(localListings); setError(`${e instanceof Error ? e.message : '后端连接失败。'} 当前显示本地图纸，请检查服务配置后重试。`);
      } finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [reload, localListings]);
  useEffect(() => {
    const id = route.match(/^marketplace\/([a-f0-9-]{36})$/)?.[1];
    if (!connected || !id) return;
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch(`./api/patterns/${id}`, { signal: controller.signal });
        if (!response.ok) throw new Error(response.status === 404 ? '这份图纸不存在。' : '详情加载失败，请重试。');
        const result = await response.json();
        setListings(items => [{ ...result, favorite: false }, ...items.filter(item => item.id !== id)]);
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : '详情加载失败。'); }
    })();
    return () => controller.abort();
  }, [route, connected]);
  async function publish() {
    if (publishing) return;
    if (!stats(source).beads) { setError('图纸还是空的，先画一些拼豆再提交吧。'); return; }
    if (!title.trim()) { setError('请填写图纸名称。'); return; }
    setPublishing(true); setError('');
    try {
      const response = await fetch('./api/patterns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title.trim(), author, description, category, project: source }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '提交失败，请重试。');
      const item = { ...result, width: result.project.width, height: result.project.height, ...stats(result.project), favorite: false } as Listing;
      setListings(previous => [item, ...previous]); setSubmitting(false); window.location.assign(`/patterns/${item.id}`);
    } catch (e) { setError(e instanceof Error ? e.message : '提交失败，请重试。'); }
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
    catch { setError('无法保存收藏，请检查浏览器存储空间。'); }
  }
  async function usePattern(item: Listing, download: boolean) {
    setError('');
    try {
      const { user } = await api('auth/me');
      if (!user) throw new Error('请先在右上角登录，再载入或下载图纸。');
      const project = (item.demo || !/^[a-f0-9-]{36}$/.test(item.id)) && item.project ? normalizeProject(item.project) : normalizeProject((await api(`patterns/${item.id}/project`)).project);
      if (download) downloadProjectJson(project); else onEdit(normalizeProject(JSON.parse(JSON.stringify(project))));
    } catch (e) { setError((e as Error).message); }
  }
  function preview(item: Listing) { return item.project ? <Pattern project={item.project}/> : <img src={item.preview} alt={`${item.title}预览图`} />; }
  async function upload(file:File) {
    try {
      if (file.size > 5*1024*1024) throw new Error('图纸文件请控制在 5 MB 内。');
      const value = JSON.parse(await file.text());
      if (!Number.isInteger(value.width) || !Number.isInteger(value.height) || value.width < 1 || value.height < 1 || value.width > 180 || value.height > 180 || !Array.isArray(value.cells) || value.cells.length !== value.width*value.height || value.cells.some((c:unknown) => c !== null && (typeof c !== 'string' || !getColor(c)))) throw new Error('请选择有效的图纸 JSON（尺寸 1–180 格，使用 MARD 色号）。');
      if (value.layers !== undefined && (!Array.isArray(value.layers) || value.layers.length > 100 || value.layers.some((layer: any) => !layer || !Array.isArray(layer.cells) || layer.cells.length !== value.width * value.height || layer.cells.some((c: unknown) => c !== null && (typeof c !== 'string' || !getColor(c)))))) throw new Error('图层数据无效，请从编辑器重新导出 JSON。');
      const project = normalizeProject(value); setSource(project); setTitle(project.name); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : '无法读取图纸。'); }
  }
  return <section className="marketplace" onKeyDown={e => e.stopPropagation()}>
    <header className="market-header"><a href="#marketplace" className="market-brand">▦ 拼豆灵感集 <small>MARKETPLACE</small></a><nav><Account recordVisit={false} onLoginChange={setLoggedIn} /><button onClick={() => {setSubmitting(false); window.location.hash='marketplace';}}>发现图纸</button><button onClick={onClose}>返回编辑器</button><button className="market-primary" onClick={() => {setSubmitting(true); setError('');}}>＋ 提交图纸</button></nav></header>
    <div className="market-content"><p className="market-local">{loading ? '正在连接图纸服务…' : connected ? '社区图纸 · 提交后将公开保存在服务器，收藏保存在当前浏览器' : '离线浏览 · 当前显示本地图纸'}</p>{error && <p role="alert" className="market-error">{error} {!connected && <button onClick={() => setReload(x => x + 1)}>重试连接</button>}</p>}
    {submitting ? <div className="market-submit"><div><p className="market-eyebrow">SHARE YOUR PIXELS</p><h1>把灵感，变成下一份图纸。</h1><p>自动带入当前画布，填写几项信息即可收录。</p><div className="market-art"><Pattern project={source}/></div><p>{source.width} × {source.height} 格 · {stats(source).beads} 颗 · {stats(source).colors} 色</p><label className="market-upload">换一份 JSON 图纸<input type="file" accept=".json,application/json" onChange={e=>{const file=e.target.files?.[0]; if(file) void upload(file); e.target.value='';}}/></label></div>
    <form onSubmit={e=>{e.preventDefault(); void publish();}}>
    <label>图纸名称<input required maxLength={60} value={title} onChange={e=>setTitle(e.target.value)} placeholder="给作品起个名字"/></label><label>作者昵称<input maxLength={30} value={author} onChange={e=>setAuthor(e.target.value)} placeholder="你的昵称（可选）"/></label><label>图纸分类<select value={category} onChange={e=>setCategory(e.target.value)}>{categories.slice(1).map(c=><option key={c}>{c}</option>)}</select></label><label>创作说明<textarea maxLength={1000} rows={5} value={description} onChange={e=>setDescription(e.target.value)} placeholder="介绍灵感、用途，或制作时的小提示…"/></label><p>请仅收录你有权分享的图纸。提交后图纸将公开，服务器会保存独立副本。本地旧作品需主动提交才会上线。</p><div className="market-actions"><button type="button" onClick={()=>setSubmitting(false)}>取消</button><button className="market-primary" type="submit" disabled={publishing || !connected || loading}>{publishing ? '提交中…' : '公开提交图纸'}</button></div></form></div>
    : selected ? <><a href="#marketplace" className="market-back">← 全部图纸</a><div className="market-detail"><div className="market-art">{preview(selected)}</div><div><p className="market-eyebrow">{selected.category} {selected.demo && ' / 示例图纸'}</p><h1>{selected.title}</h1><p>by {selected.author} · {new Date(selected.createdAt).toLocaleDateString('zh-CN')}</p><div className="market-stats"><span><b>{selected.width} × {selected.height}</b>图纸尺寸</span><span><b>{selected.beads}</b>拼豆颗数</span><span><b>{selected.colors}</b>颜色数量</span></div><p className="market-description">{selected.description || '作者还没有添加创作说明。'}</p><div className="market-actions"><button className="market-primary" onClick={()=>void usePattern(selected, false)}>载入编辑器</button><button onClick={()=>favorite(selected)}>{selected.favorite?'♥ 已收藏':'♡ 收藏'}</button><button onClick={()=>void usePattern(selected, true)}>下载 JSON</button></div><p>载入后可继续修改，原画布可通过撤销恢复。</p>{!loggedIn ? <p>登录后可载入编辑器、查看配色用量及下载 JSON。</p> : <><h3>配色与用量 · MARD</h3>{usageProject ? <div className="market-colors">{[...colorUsage].sort((a,b) => b[1]-a[1]).map(([id,count]) => <span key={id}><i style={{background:getColor(id)?.hex}}/>{getColor(id)?.primaryCode}<b>{count} 颗</b></span>)}</div> : usageError ? <p role="alert">{usageError} <button onClick={() => setReload(value => value + 1)}>重试</button></p> : <p role="status">正在加载配色与用量…</p>}</>}</div></div></>
    : loading ? <div className="market-empty" role="status">正在加载图纸…</div> : route.startsWith('marketplace/') ? <div className="market-empty"><h2>找不到这份图纸</h2><p>图纸可能尚未公开或已被移除。</p><a href="#marketplace">返回图纸列表</a></div>
    : <><div className="market-hero"><div><p className="market-eyebrow">A LITTLE BEAD, A LOT OF IDEAS</p><h1>下一份心动，<br/>从一颗拼豆开始。</h1><p>发现喜欢的图案，收藏灵感，一键开始创作。</p><button className="market-primary" onClick={()=>setSubmitting(true)}>分享我的图纸 ↗</button></div><div className="market-hero-art"><Pattern project={heroProject}/><span>小小像素，无限可能 ✦</span></div></div>
    <div className="market-toolbar"><h2>发现图纸 <small>{visible.length} 份灵感</small></h2><input type="search" aria-label="搜索图纸" placeholder="搜索图纸、作者、灵感…" value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="排序" value={sort} onChange={e=>setSort(e.target.value)}><option value="new">最新提交</option><option value="small">颗数从少到多</option></select></div><div className="market-filters">{categories.map(c=><button key={c} className={filter===c?'active':''} onClick={()=>setFilter(c)}>{c}</button>)}<button className={favorites?'active':''} onClick={()=>setFavorites(!favorites)}>♡ 我的收藏</button></div>
    <div className="market-grid">{visible.map(item=><article className="market-card" key={item.id}><a href={item.demo ? `#marketplace/${item.id}` : `/patterns/${item.id}`} className="market-card-image">{preview(item)}<span>{item.demo?'示例':item.category}</span></a><div className="market-card-body"><div><a href={item.demo ? `#marketplace/${item.id}` : `/patterns/${item.id}`}><h3>{item.title}</h3></a><button aria-label={`${item.favorite?'取消收藏':'收藏'}${item.title}`} onClick={()=>favorite(item)}>{item.favorite?'♥':'♡'}</button></div><p>by {item.author}</p><footer>{item.width} × {item.height} 格 <span>{item.colors} 色 · {item.beads} 颗</span></footer></div></article>)}</div>{!visible.length && <div className="market-empty"><h2>还没有匹配的图纸</h2><p>试试其他关键词，或提交你的第一份灵感。</p><button onClick={()=>{setSearch('');setFilter('全部');setFavorites(false);}}>查看全部</button></div>}</>}
    </div>
  </section>;
}
