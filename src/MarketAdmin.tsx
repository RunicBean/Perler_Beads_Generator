import CategoryManager from './CategoryManager';
import type { MarketCategory } from './marketCategories';
import { api } from './Account';
import { t, useLocale, categoryLabel, formatDate } from './i18n';
const { useEffect, useState } = React;
type Item = { id: string; title: string; author: string; description: string; category: string; status: 'published' | 'hidden'; beads: number; colors: number; continuity: number; preview: string; createdAt: string };
export default function MarketAdmin({ loggedIn }: { loggedIn: boolean }) {
  const [locale] = useLocale();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<'overview' | 'patterns' | 'categories'>('overview');
  const [categories, setCategories] = useState<MarketCategory[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [counts, setCounts] = useState({ all: 0, published: 0, hidden: 0 });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [edit, setEdit] = useState<Item | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);
  const [authReload, setAuthReload] = useState(0);
  useEffect(() => {
    let active = true;
    setAllowed(null); setItems([]); setEdit(null); setError('');
    void api('auth/me').then(r => { if (active) setAllowed(!!r.user?.admin); }).catch(e => { if (active) { setAllowed(false); setError(e.message); } });
    return () => { active = false; };
  }, [loggedIn, locale, authReload]);
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    setLoading(true); setError('');
    const params = new URLSearchParams({ page: String(page), limit: '24', q: search, status });
    void Promise.all([
      api(`admin/patterns?${params}`),
      ...['all','published','hidden'].map(state => api(`admin/patterns?limit=1&status=${state}`)),
      api('admin/categories'),
    ]).then(([result, all, published, hidden, catalog]) => {
      if (!active) return;
      if (page > 1 && !result.items.length) { setPage(page - 1); return; }
      setCategories(catalog.items);
      setItems(result.items); setTotal(result.total);
      setCounts({ all: all.total, published: published.total, hidden: hidden.total });
    }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [allowed, page, search, status, reload, locale]);
  useEffect(() => { if (edit) document.querySelector('.admin-edit')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, [edit?.id]);
  async function save(item: Item, changes: Partial<Item>) {
    setBusy(true); setError(''); setNotice('');
    try { await api(`admin/patterns/${item.id}`, changes); setEdit(null); setNotice(t('admin.saved', {}, locale)); setReload(value => value + 1); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <section className="market-admin">
    <h1>{t('admin.title', {}, locale)}</h1>
    {error && <p className="market-error" role="alert">{error} <button onClick={() => allowed ? setReload(value => value + 1) : setAuthReload(value => value + 1)}>{t('common.retry', {}, locale)}</button></p>}
    {allowed === null ? <p role="status">{t('common.loading', {}, locale)}</p> : !allowed ? <p>{t('admin.restricted', {}, locale)}</p> : <>
      <nav className="admin-tabs" aria-label={t('admin.title', {}, locale)}>{(['overview','patterns','categories'] as const).map(key => <button key={key} aria-pressed={tab === key} onClick={() => { setTab(key); setEdit(null); }}>{t(`admin.${key}`, {}, locale)}</button>)}</nav>
      {notice && <p role="status">{notice}</p>}
      {tab === 'categories' ? <CategoryManager categories={categories} loading={loading} onSaved={() => { setEdit(null); setReload(value => value + 1); }}/> : tab === 'overview' ? <><div className="admin-counts">{(['all','published','hidden'] as const).map(key => <button key={key} onClick={() => { setStatus(key); setSearch(''); setQuery(''); setPage(1); setTab('patterns'); }}><span>{t(`admin.${key}`, {}, locale)}</span><strong>{loading ? '…' : counts[key]}</strong></button>)}</div><p>{t('admin.hint', {}, locale)}</p></> : <>
        <form className="admin-search" onSubmit={e => { e.preventDefault(); setSearch(query); setPage(1); setEdit(null); }}>
          <input aria-label={t('market.search', {}, locale)} type="search" maxLength={100} placeholder={t('marketUI.searchPlaceholder', {}, locale)} value={query} onChange={e => setQuery(e.target.value)}/>
          <select aria-label={t('admin.status', {}, locale)} value={status} onChange={e => { setStatus(e.target.value); setPage(1); setEdit(null); }}>{(['all','published','hidden'] as const).map(key => <option key={key} value={key}>{t(`admin.${key}`, {}, locale)}</option>)}</select>
          <button>{t('market.searchButton', {}, locale)}</button>
        </form>
        <p>{t('marketUI.patternCount', { count: total }, locale)}</p>
        {loading ? <p role="status">{t('common.loading', {}, locale)}</p> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr>{['work','status','metrics','actions'].map(key => <th key={key}>{t(`admin.${key}` as import('./i18n').MessageKey, {}, locale)}</th>)}</tr></thead><tbody>{items.map(item => <tr key={item.id}>
          <td><div className="admin-work"><img src={item.preview} alt="" width={72} height={72}/><div><strong>{item.title}</strong><p>{item.author} · {categoryLabel(item.category, locale, categories)}</p><small>{formatDate(item.createdAt, locale)}</small></div></div></td>
          <td><span className={`admin-status ${item.status}`}>{t(`admin.${item.status}`, {}, locale)}</span></td>
          <td>{t('admin.metricsSummary', { beads: item.beads, colors: item.colors }, locale)}<p>{t('marketFilter.score', { count: item.continuity }, locale)}</p></td>
          <td><div className="admin-actions"><button disabled={busy} onClick={() => { setEdit(item); setNotice(''); }}>{t('admin.edit', {}, locale)}</button><button disabled={busy} onClick={() => void save(item, { status: item.status === 'published' ? 'hidden' : 'published' })}>{t(item.status === 'published' ? 'admin.hide' : 'admin.restore', {}, locale)}</button></div></td>
        </tr>)}</tbody></table>{!items.length && <p>{t('marketUI.noMatches', {}, locale)}</p>}</div>}
        <nav className="pagination"><button disabled={page <= 1 || loading} onClick={() => { setPage(page - 1); setEdit(null); }}>{t('market.previous', {}, locale)}</button><span>{t('market.page', { count: page }, locale)}</span><button disabled={page * 24 >= total || loading} onClick={() => { setPage(page + 1); setEdit(null); }}>{t('market.next', {}, locale)}</button></nav>
        {edit && <form className="admin-edit" onSubmit={e => { e.preventDefault(); void save(edit, { title: edit.title, description: edit.description, category: edit.category }); }}>
          <h2>{t('admin.edit', {}, locale)}</h2>
          <label>{t('marketUI.patternTitle', {}, locale)}<input required maxLength={60} value={edit.title} onChange={e => setEdit({ ...edit, title: e.target.value })}/></label>
          <label>{t('marketUI.category', {}, locale)}<select value={edit.category} onChange={e => setEdit({ ...edit, category: e.target.value })}>{categories.map(category => <option key={category.id} value={category.name}>{categoryLabel(category.name, locale, categories)}{!category.active ? ' · ' + t('adminCategory.inactive', {}, locale) : ''}</option>)}</select></label>
          <label>{t('marketUI.description', {}, locale)}<textarea rows={5} maxLength={1000} value={edit.description} onChange={e => setEdit({ ...edit, description: e.target.value })}/></label>
          <div className="admin-actions"><button disabled={busy} type="submit">{t(busy ? 'account.busy' : 'admin.save', {}, locale)}</button><button disabled={busy} type="button" onClick={() => setEdit(null)}>{t('marketUI.cancel', {}, locale)}</button></div>
        </form>}
      </>}
    </>}
  </section>;
}
