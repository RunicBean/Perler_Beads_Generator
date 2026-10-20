const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createSupabaseStore } = require('./supabase-store.cjs');

test('REST adapter uses server credentials, SQL pagination and maps created_at', async () => {
  const calls = [];
  const row = { id: 'abc', title: '图纸', created_at: '2026-10-18T00:00:00Z', project: {} };
  const store = createSupabaseStore({ url: 'https://example.supabase.co', key: 'sb_secret_test', fetchImpl: async (url, options) => {
    calls.push({ url, options });
    if (url.includes('/rpc/')) return new Response(JSON.stringify({ items: [row], total: 42 }));
    return new Response(JSON.stringify([row]));
  } });
  const result = await store.list({ page: 2, limit: 10, q: 'a,_%"', category: '其他' });
  assert.equal(result.total, 42);
  assert.equal(result.items[0].createdAt, row.created_at);
  assert.equal(result.items[0].created_at, undefined);
  assert.deepEqual(JSON.parse(calls[0].options.body), { search_query: 'a,_%"', filter_category: '其他', page_number: 2, page_size: 10 });
  assert.equal(calls[0].options.headers.apikey, 'sb_secret_test');
  assert.equal(calls[0].options.headers.Authorization, undefined);
  assert.equal((await store.get('abc')).id, row.id);
  assert.equal((await store.create({ ...row, created_at: undefined, createdAt: row.created_at })).createdAt, row.created_at);
  assert.equal(JSON.parse(calls[2].options.body).created_at, row.created_at);
  assert.equal(calls[2].options.headers.Prefer, 'return=representation');
  await store.health();
});
test('legacy JWT key, missing rows and private database error handling', async () => {
  const store = createSupabaseStore({ url: 'https://example.supabase.co', key: 'legacy-jwt', fetchImpl: async (_, options) => {
    assert.equal(options.headers.Authorization, 'Bearer legacy-jwt');
    return new Response('[]');
  } });
  assert.equal(await store.get('missing'), null);
  const broken = createSupabaseStore({ url: 'https://example.supabase.co', key: 'sb_secret_private', fetchImpl: async () => new Response('private database error', { status: 500 }) });
  await assert.rejects(broken.health(), error => error.status === 503 && !error.message.includes('private'));
  const missing = createSupabaseStore({ url: '', key: '', fetchImpl: () => { throw new Error('should not call'); } });
  await assert.rejects(missing.health(), error => error.status === 503);
  const unavailable = createSupabaseStore({ url: 'https://example.supabase.co', key: 'sb_secret_test', fetchImpl: async () => { throw new Error('network'); } });
  await assert.rejects(unavailable.health(), error => error.status === 503);
});

test('publishable key is rejected before making a database request', async () => {
  let called = false;
  const store = createSupabaseStore({ url: 'https://example.supabase.co', key: 'sb_publishable_example', fetchImpl: async () => { called = true; } });
  await assert.rejects(store.health(), error => error.status === 503 && error.message.includes('publishable'));
  assert.equal(called, false);
});

test('session creation requests JSON representation and database limits map to 429', async () => {
  const store = createSupabaseStore({ url: 'https://example.supabase.co', key: 'sb_secret_test', fetchImpl: async (_, options) => {
    assert.equal(options.headers.Prefer, 'return=representation');
    return new Response('[]');
  } });
  await store.session('a'.repeat(64), 'user');
  const limited = createSupabaseStore({ url: 'https://example.supabase.co', key: 'sb_secret_test', fetchImpl: async () => new Response(JSON.stringify({ code:'P0001', message:'Too many attempts' }), { status:400 }) });
  await assert.rejects(limited.event({}), e => e.status === 429);
});

test('complexity filters, private moderation visibility and updates map to database parameters', async () => {
  const calls = [];
  const store = createSupabaseStore({ url: 'https://example.supabase.co', key: 'sb_secret_test', fetchImpl: async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify(url.includes('/rpc/') ? { items: [], total: 0 } : [{ id: 'pattern', status: 'hidden', created_at: '2026-10-20' }]));
  } });
  await store.list({ page: 1, limit: 24, q: '', beads: 'small', colors: 'few', continuity: 'continuous', sort: 'continuous' });
  const filters = JSON.parse(calls[0].options.body);
  assert.equal(filters.bead_range, 'small'); assert.equal(filters.color_range, 'few'); assert.equal(filters.continuity_range, 'continuous');
  assert.equal(filters.sort_order, 'continuous'); assert.equal(filters.include_hidden, undefined);
  await store.list({ page: 1, limit: 24, q: '', includeHidden: true, status: 'hidden' });
  assert.equal(JSON.parse(calls[1].options.body).include_hidden, true); assert.equal(JSON.parse(calls[1].options.body).filter_status, 'hidden');
  await store.get('pattern'); assert.match(calls[2].url, /status=eq.published/);
  const updated = await store.update('pattern', { status: 'hidden' });
  assert.equal(updated.status, 'hidden'); assert.equal(calls[3].options.method, 'PATCH');
  assert.deepEqual(JSON.parse(calls[3].options.body), { status: 'hidden' });
});

test('category catalog maps names, order and active state, and handles duplicate names', async () => {
  const calls = [];
  const store = createSupabaseStore({ url: 'https://example.supabase.co', key: 'sb_secret_test', fetchImpl: async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify([{ id: 'category-id', name: '挂件', name_en: 'Charms', sort_order: 5, active: false }]));
  } });
  assert.deepEqual(await store.categories(), [{ id: 'category-id', name: '挂件', nameEn: 'Charms', sortOrder: 5, active: false }]);
  assert.match(calls[0].url, /order=sort_order.asc,name.asc/);
  await store.saveCategory(undefined, { name: '挂件', nameEn: 'Charms', sortOrder: 5 });
  assert.equal(calls[1].options.method, 'POST'); assert.deepEqual(JSON.parse(calls[1].options.body), { name: '挂件', name_en: 'Charms', sort_order: 5 });
  await store.saveCategory('category-id', { active: false });
  assert.equal(calls[2].options.method, 'PATCH'); assert.deepEqual(JSON.parse(calls[2].options.body), { active: false });
  const duplicate = createSupabaseStore({ url: 'https://example.supabase.co', key: 'sb_secret_test', fetchImpl: async () => new Response(JSON.stringify({ code: '23505' }), { status: 409 }) });
  await assert.rejects(duplicate.saveCategory(undefined, { name: 'duplicate' }), error => error.status === 409 && error.message === '分类名称已存在。');
});
