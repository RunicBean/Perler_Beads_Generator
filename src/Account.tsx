import { t, useLocale, formatNumber } from './i18n';
const { useState, useEffect } = React;
type User = { id: string; username: string; admin: boolean };
export async function api(path: string, data?: unknown) {
  const response = await fetch(`/api/${path}`, { credentials: 'same-origin', headers: { 'Accept-Language': document.documentElement.lang }, ...(data === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept-Language': document.documentElement.lang }, body: JSON.stringify(data) }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || t('common.error'));
  return result;
}
export function track(name: string) {
  try {
    let visitorId = localStorage.getItem('perler:visitor');
    if (!visitorId) { visitorId = crypto.randomUUID(); localStorage.setItem('perler:visitor', visitorId); }
    let sessionId = sessionStorage.getItem('perler:session');
    if (!sessionId) { sessionId = crypto.randomUUID(); sessionStorage.setItem('perler:session', sessionId); }
    void api('analytics/events', { name, visitorId, sessionId, source: document.referrer }).catch(() => {});
  } catch { /* Statistics must never interrupt editing. */ }
}
export default function Account({ recordVisit = true, onLoginChange }: { recordVisit?: boolean; onLoginChange?: (loggedIn: boolean) => void }) {
  const [locale] = useLocale();
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => { onLoginChange?.(!!user); }, [user, onLoginChange]);
  const [open, setOpen] = useState(false);
  const [register, setRegister] = useState(false);
  const [username, setUsername] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { setError(''); }, [locale]);
  const [statsOpen, setStatsOpen] = useState(false); const [days, setDays] = useState(7); const [stats, setStats] = useState<any>(null);
  useEffect(() => { void api('auth/me').then(r => setUser(r.user)).catch(() => {}); if (recordVisit) track('page_view'); const change = () => { if (recordVisit && location.hash.startsWith('#marketplace')) track('marketplace_view'); }; change(); window.addEventListener('hashchange', change); return () => window.removeEventListener('hashchange', change); }, []);
  useEffect(() => { if (!statsOpen) return; let active = true; setStats(null); setError(''); void api(`analytics?days=${days}`).then(r => { if (active) setStats(r); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [statsOpen, days, locale]);
  async function submit(e: React.FormEvent) { e.preventDefault(); setBusy(true); setError(''); try { const r = await api(`auth/${register ? 'register' : 'login'}`, { username, password }); setUser(r.user); setPassword(''); setOpen(false); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  return <div className="account-controls">
    {user ? <><span>{user.username}</span>{user.admin && <button onClick={() => { setOpen(false); setStatsOpen(true); }}>{t('account.statistics', {}, locale)}</button>}<button disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await api('auth/logout', {}); setUser(null); setStatsOpen(false); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>{t('account.logout', {}, locale)}</button></> : <button onClick={() => { setError(''); setOpen(true); }}>{t('account.signInRegister', {}, locale)}</button>}
    {!open && !statsOpen && error && <span role="alert">{error}</span>}
    {(open || statsOpen) && <div className="account-backdrop"><section className="account-dialog" role="dialog" aria-modal="true" aria-label={statsOpen ? t('account.statistics', {}, locale) : t('account.signInLabel', {}, locale)} onKeyDown={e => { if (e.key === 'Escape') { setOpen(false); setStatsOpen(false); } }}>
      <button className="account-close" aria-label={t('common.close', {}, locale)} onClick={() => { setOpen(false); setStatsOpen(false); setPassword(''); }}>×</button>
      {statsOpen ? <><h2>{t('account.statistics', {}, locale)}</h2><p>{t('account.timezone', {}, locale)}</p><select aria-label={t('account.range', {}, locale)} value={days} onChange={e => setDays(Number(e.target.value))}>{[7,30,90].map(d => <option key={d} value={d}>{t('account.days', { count: d }, locale)}</option>)}</select>
        {stats ? <><div className="stats-cards">{[[t('account.pv', {}, locale),stats.pv],[t('account.uv', {}, locale),stats.uv],[t('account.sessions', {}, locale),stats.sessions],[t('account.registrations', {}, locale),stats.registrations]].map(([label,value]) => <div key={label}><small>{label}</small><strong>{formatNumber(Number(value), locale)}</strong></div>)}</div>
        <h3>{t('account.daily', {}, locale)}</h3><div className="stats-scroll"><table><thead><tr><th>{t('account.date', {}, locale)}</th><th>PV</th><th>UV</th></tr></thead><tbody>{stats.daily.map((r: any) => <tr key={r.day}><td>{r.day}</td><td>{r.pv}</td><td>{r.uv}</td></tr>)}</tbody></table></div>
        <h3>{t('account.features', {}, locale)}</h3>{stats.features.length ? stats.features.map((r: any) => <p key={r.name}>{t(('feature.' + r.name) as import('./i18n').MessageKey, {}, locale)}: {formatNumber(r.count, locale)}</p>) : <p>{t('account.noEvents', {}, locale)}</p>}
        <h3>{t('account.sources', {}, locale)}</h3>{stats.sources.map((r: any) => <p key={r.source}>{r.source === '直接访问' ? t('account.direct', {}, locale) : r.source}: {formatNumber(r.count, locale)}</p>)}<small>{t('account.disclaimer', {}, locale)}</small></> : !error && <p>{t('common.loading', {}, locale)}</p>}</> : <form onSubmit={submit}><h2>{register ? t('account.create', {}, locale) : t('account.welcome', {}, locale)}</h2><label>{t('account.username', {}, locale)}<input autoFocus required minLength={3} maxLength={32} pattern="[A-Za-z0-9_]+" autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} /></label><small>{t('account.usernameHint', {}, locale)}</small><label>{t('account.password', {}, locale)}<input type="password" required minLength={10} maxLength={128} autoComplete={register ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} /></label><small>{t('account.passwordHint', {}, locale)}</small><button type="submit" disabled={busy}>{busy ? t('account.busy', {}, locale) : register ? t('account.register', {}, locale) : t('account.login', {}, locale)}</button><button type="button" disabled={busy} onClick={() => { setRegister(!register); setError(''); }}>{register ? t('account.haveAccount', {}, locale) : t('account.noAccount', {}, locale)}</button></form>}
      {error && <p role="alert">{error}</p>}
    </section></div>}
  </div>;
}
