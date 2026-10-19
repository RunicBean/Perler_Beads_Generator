const { randomBytes, createHash, scrypt: derive, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(derive);
const digest = value => createHash('sha256').update(value).digest('hex');
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const events = new Set(['page_view', 'marketplace_view', 'generate', 'export_png', 'export_pdf', 'export_usage', 'export_json']);
function createAccounts(store) {
  const admin = user => !!user && (process.env.ADMIN_USERNAMES || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean).includes(user.username);
  const token = req => (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('perler_session='))?.slice(15) || '';
  async function user(req) { const value = token(req); return /^[a-f0-9]{64}$/.test(value) ? await store.session(digest(value)) : null; }
  function cookie(req, res, value, age) { res.setHeader('Set-Cookie', `perler_session=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${req.socket?.encrypted || process.env.VERCEL || process.env.NODE_ENV === 'production' ? '; Secure' : ''}`); }
  function origin(req) { if (req.headers.origin) { let parsed; try { parsed = new URL(req.headers.origin); } catch { fail('来源无效。', 403); } if (parsed.host !== req.headers.host || !['https:', 'http:'].includes(parsed.protocol)) fail('不允许跨站请求。', 403); } }
  return { user, async route(req, res, url, body, json) {
    const path = url.pathname;
    if (!path.startsWith('/api/auth/') && !path.startsWith('/api/analytics')) return false;
    if (req.method === 'POST') origin(req);
    if (path === '/api/auth/me' && req.method === 'GET') { const u = await user(req); json(res, 200, { user: u ? { ...u, admin: admin(u) } : null }); }
    else if (['/api/auth/register', '/api/auth/login'].includes(path) && req.method === 'POST') {
      const data = await body(req);
      const username = typeof data.username === 'string' ? data.username.trim().toLowerCase() : '';
      if (!/^[a-z0-9_]{3,32}$/.test(username) || typeof data.password !== 'string' || data.password.length < 10 || data.password.length > 128) fail('账号需为 3–32 位字母、数字或下划线；密码需为 10–128 位。');
      // Database-backed limits apply across serverless instances; no raw address is stored.
      await store.event({ name: 'auth_attempt', visitor_id: digest(username), session_id: digest(username), source: '' });
      let u = await store.account(username);
      if (path.endsWith('/register')) {
        const salt = randomBytes(16).toString('hex');
        const hash = (await scrypt(data.password, salt, 64)).toString('hex');
        u = await store.register(username, `${salt}:${hash}`);
        if (!u) fail('账号已存在。', 409);
      } else {
        const [salt, hash] = (u?.password_hash || '00000000000000000000000000000000:' + '0'.repeat(128)).split(':');
        const actual = await scrypt(data.password, salt, 64);
        if (!u || !timingSafeEqual(actual, Buffer.from(hash, 'hex'))) fail('账号或密码错误。', 401);
      }
      const value = randomBytes(32).toString('hex'); await store.session(digest(value), u.id); cookie(req, res, value, 604800);
      json(res, 200, { user: { id: u.id, username: u.username, admin: admin(u) } });
    } else if (path === '/api/auth/logout' && req.method === 'POST') { if (token(req)) await store.logout(digest(token(req))); cookie(req, res, '', 0); json(res, 200, { ok: true }); }
    else if (path === '/api/analytics/events' && req.method === 'POST') {
      const data = await body(req);
      if (!events.has(data.name) || !/^[a-f0-9-]{36}$/.test(data.visitorId) || !/^[a-f0-9-]{36}$/.test(data.sessionId)) fail('统计事件无效。');
      let source = ''; try { source = new URL(data.source).hostname.slice(0, 200); } catch {}
      await store.event({ name: data.name, visitor_id: data.visitorId, session_id: data.sessionId, source }); json(res, 200, { ok: true });
    } else if (path === '/api/analytics' && req.method === 'GET') { if (!admin(await user(req))) fail('仅管理员可查看访问统计。', 403); const days = Number(url.searchParams.get('days') || 7); if (![7,30,90].includes(days)) fail('统计范围无效。'); json(res, 200, await store.stats(days)); }
    else json(res, 405, { error: '请求方法不支持。' });
    return true;
  } };
}
module.exports = { createAccounts };
