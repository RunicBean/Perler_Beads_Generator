const { useState, useEffect } = React;
type User = { id: string; username: string; admin: boolean };
export async function api(path: string, data?: unknown) {
  const response = await fetch(`/api/${path}`, { credentials: 'same-origin', ...(data === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '请求失败，请稍后重试。');
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
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => { onLoginChange?.(!!user); }, [user, onLoginChange]);
  const [open, setOpen] = useState(false);
  const [register, setRegister] = useState(false);
  const [username, setUsername] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false); const [days, setDays] = useState(7); const [stats, setStats] = useState<any>(null);
  useEffect(() => { void api('auth/me').then(r => setUser(r.user)).catch(() => {}); if (recordVisit) track('page_view'); const change = () => { if (recordVisit && location.hash.startsWith('#marketplace')) track('marketplace_view'); }; change(); window.addEventListener('hashchange', change); return () => window.removeEventListener('hashchange', change); }, []);
  useEffect(() => { if (!statsOpen) return; let active = true; setStats(null); setError(''); void api(`analytics?days=${days}`).then(r => { if (active) setStats(r); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [statsOpen, days]);
  async function submit(e: React.FormEvent) { e.preventDefault(); setBusy(true); setError(''); try { const r = await api(`auth/${register ? 'register' : 'login'}`, { username, password }); setUser(r.user); setPassword(''); setOpen(false); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  return <div className="account-controls">
    {user ? <><span>{user.username}</span>{user.admin && <button onClick={() => { setOpen(false); setStatsOpen(true); }}>访问统计</button>}<button disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await api('auth/logout', {}); setUser(null); setStatsOpen(false); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>退出</button></> : <button onClick={() => { setError(''); setOpen(true); }}>登录 / 注册</button>}
    {!open && !statsOpen && error && <span role="alert">{error}</span>}
    {(open || statsOpen) && <div className="account-backdrop"><section className="account-dialog" role="dialog" aria-modal="true" aria-label={statsOpen ? '访问统计' : '账号登录'} onKeyDown={e => { if (e.key === 'Escape') { setOpen(false); setStatsOpen(false); } }}>
      <button className="account-close" aria-label="关闭" onClick={() => { setOpen(false); setStatsOpen(false); setPassword(''); }}>×</button>
      {statsOpen ? <><h2>访问统计</h2><p>北京时间 · 仅管理员可见</p><select aria-label="统计时间范围" value={days} onChange={e => setDays(Number(e.target.value))}>{[7,30,90].map(d => <option key={d} value={d}>最近 {d} 天</option>)}</select>
        {stats ? <><div className="stats-cards">{[['访问量 PV',stats.pv],['独立访客 UV',stats.uv],['访问会话',stats.sessions],['新增账号',stats.registrations]].map(([label,value]) => <div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div>
        <h3>每日访问趋势</h3><div className="stats-scroll"><table><thead><tr><th>日期</th><th>PV</th><th>UV</th></tr></thead><tbody>{stats.daily.map((r: any) => <tr key={r.day}><td>{r.day}</td><td>{r.pv}</td><td>{r.uv}</td></tr>)}</tbody></table></div>
        <h3>功能使用</h3>{stats.features.length ? stats.features.map((r: any) => <p key={r.name}>{({marketplace_view:'浏览集市',generate:'图片生成',export_png:'导出 PNG',export_pdf:'导出 PDF',export_usage:'导出用量',export_json:'导出编辑记录',marketplace_load:'集市载入',marketplace_download:'集市下载'} as Record<string,string>)[r.name] || r.name}：{r.count}</p>) : <p>暂无使用记录</p>}
        <h3>访问来源</h3>{stats.sources.map((r: any) => <p key={r.source}>{r.source}：{r.count}</p>)}<small>UV 按浏览器标识去重；会话按标签页统计。数据来自客户端上报，可能受拦截或清除存储影响。</small></> : !error && <p>加载中…</p>}</> : <form onSubmit={submit}><h2>{register ? '创建账号' : '欢迎回来'}</h2><label>账号<input autoFocus required minLength={3} maxLength={32} pattern="[A-Za-z0-9_]+" autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} /></label><small>3–32 位字母、数字或下划线</small><label>密码<input type="password" required minLength={10} maxLength={128} autoComplete={register ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} /></label><small>10–128 位字符</small><button type="submit" disabled={busy}>{busy ? '处理中…' : register ? '注册并登录' : '登录'}</button><button type="button" disabled={busy} onClick={() => { setRegister(!register); setError(''); }}>{register ? '已有账号，去登录' : '没有账号，去注册'}</button></form>}
      {error && <p role="alert">{error}</p>}
    </section></div>}
  </div>;
}
