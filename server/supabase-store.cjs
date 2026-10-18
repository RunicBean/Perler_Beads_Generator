// Server-only Supabase REST client. No database credential is sent to the browser.
function createSupabaseStore({ url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY, fetchImpl = fetch } = {}) {
  function config() {
    if (!url || !key) throw Object.assign(new Error('请配置服务端 SUPABASE_URL 和 SUPABASE_SECRET_KEY。'), { status: 503 });
    if (key.startsWith('sb_publishable_')) throw Object.assign(new Error('SUPABASE_SECRET_KEY 填入了 publishable 公钥，请改用 sb_secret_ 服务端密钥或 service_role 密钥。'), { status: 503 });
    let base;
    try { base = new URL(url); } catch { throw Object.assign(new Error('SUPABASE_URL 格式无效，请填写项目 HTTPS 地址。'), { status: 503 }); }
    if (base.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(base.hostname)) throw Object.assign(new Error('Supabase 地址须使用 HTTPS。'), { status: 503 });
    return base.origin;
  }
  async function request(endpoint, options = {}) {
    const headers = { apikey: key, 'Content-Type': 'application/json', ...options.headers };
    // Legacy service_role keys are JWTs; new sb_secret keys belong only in apikey.
    if (key && !key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
    let response;
    try { response = await fetchImpl(`${config()}/rest/v1/${endpoint}`, { ...options, headers, signal: AbortSignal.timeout(15000) }); }
    catch (error) { if (error.status) throw error; throw Object.assign(new Error('数据库连接失败，请稍后重试。'), { status: 503 }); }
    if (!response.ok) throw Object.assign(new Error('数据库请求失败，请检查 Supabase 配置和建表 SQL。'), { status: 503 });
    return response.json();
  }
  function listing(row) { const { created_at, ...rest } = row; return { ...rest, createdAt: created_at }; }
  return {
    async health() { await request('marketplace_patterns?select=id&limit=0'); },
    async list({ page, limit, q, category }) {
      const result = await request('rpc/list_marketplace_patterns', { method: 'POST', body: JSON.stringify({ search_query: q, filter_category: category || null, page_number: page, page_size: limit }) });
      return { items: result.items.map(listing), total: result.total, page, limit };
    },
    async get(id) { const rows = await request(`marketplace_patterns?id=eq.${encodeURIComponent(id)}&select=*&limit=1`); return rows[0] ? listing(rows[0]) : null; },
    async create(item) {
      const { createdAt, ...rest } = item;
      const rows = await request('marketplace_patterns', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ ...rest, created_at: createdAt }) });
      if (!rows[0]) throw Object.assign(new Error('数据库未返回保存结果。'), { status: 503 });
      return listing(rows[0]);
    },
  };
}
module.exports = { createSupabaseStore };
