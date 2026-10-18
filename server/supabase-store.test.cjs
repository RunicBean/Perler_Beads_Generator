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
