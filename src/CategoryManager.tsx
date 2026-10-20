import { api } from './Account';
import { t, useLocale, categoryLabel } from './i18n';
import type { MarketCategory } from './marketCategories';
const { useState } = React;
const emptyDraft = { name: '', nameEn: '', sortOrder: 100, active: true };
export default function CategoryManager({ categories, loading, onSaved }: { categories: MarketCategory[]; loading: boolean; onSaved: () => void }) {
  const [locale] = useLocale();
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  function reset() { setEditId(null); setDraft(emptyDraft); }
  async function save(id: string | null, changes: Partial<typeof emptyDraft>) {
    setBusy(true); setError(''); setNotice('');
    try { await api(`admin/categories${id ? '/' + id : ''}`, changes); reset(); setNotice(t('admin.saved', {}, locale)); onSaved(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <div className="category-manager">
    <h2>{t('adminCategory.title', {}, locale)}</h2><p>{t('adminCategory.hint', {}, locale)}</p>
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    <div className="admin-table-wrap"><table className="admin-table category-table"><thead><tr>
      <th>{t('adminCategory.name', {}, locale)}</th><th>{t('adminCategory.nameEn', {}, locale)}</th><th>{t('adminCategory.order', {}, locale)}</th><th>{t('adminCategory.state', {}, locale)}</th><th>{t('admin.actions', {}, locale)}</th>
    </tr></thead><tbody>{categories.map(category => <tr key={category.id}>
      <td><strong>{categoryLabel(category.name, locale, categories)}</strong>{locale === 'en' && category.nameEn && <p>{category.name}</p>}</td>
      <td>{category.nameEn || '—'}</td><td>{category.sortOrder}</td><td><span className={`admin-status ${category.active ? 'published' : 'hidden'}`}>{t(category.active ? 'adminCategory.active' : 'adminCategory.inactive', {}, locale)}</span></td>
      <td><div className="admin-actions"><button disabled={busy || loading} onClick={() => { setEditId(category.id); setDraft({ name: category.name, nameEn: category.nameEn, sortOrder: category.sortOrder, active: category.active }); setError(''); setNotice(''); document.getElementById('category-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}>{t('adminCategory.edit', {}, locale)}</button>
      <button disabled={busy || loading} onClick={() => void save(category.id, { active: !category.active })}>{t(category.active ? 'adminCategory.disable' : 'adminCategory.enable', {}, locale)}</button></div></td>
    </tr>)}</tbody></table></div>
    <form id="category-form" className="admin-edit" onSubmit={e => { e.preventDefault(); void save(editId, draft); }}>
      <h2>{t(editId ? 'adminCategory.edit' : 'adminCategory.add', {}, locale)}</h2>
      <label>{t('adminCategory.name', {}, locale)}<input required maxLength={20} value={draft.name} disabled={busy} onChange={e => setDraft({ ...draft, name: e.target.value })}/></label>
      <label>{t('adminCategory.nameEn', {}, locale)}<input maxLength={60} value={draft.nameEn} disabled={busy} onChange={e => setDraft({ ...draft, nameEn: e.target.value })}/></label>
      <label>{t('adminCategory.order', {}, locale)}<input required type="number" min={0} max={9999} step={1} value={draft.sortOrder} disabled={busy} onChange={e => setDraft({ ...draft, sortOrder: Number(e.target.value) })}/></label>
      <small>{t('adminCategory.orderHint', {}, locale)}</small>
      <div className="admin-actions"><button disabled={busy || loading} type="submit">{t(busy ? 'account.busy' : 'admin.save', {}, locale)}</button>{editId && <button type="button" disabled={busy} onClick={reset}>{t('marketUI.cancel', {}, locale)}</button>}</div>
    </form>
  </div>;
}
