const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { createMarketplaceHandler } = require('./marketplace.cjs');

// Call the real HTTP handler with streamed requests; no listening port is required.
async function call(handler, method, route, data, headers = {}) {
  const request = Readable.from(data === undefined ? [] : [Buffer.from(typeof data === 'string' ? data : JSON.stringify(data))]);
  request.method = method;
  request.headers = { host: 'localhost', 'content-type': 'application/json', cookie: `perler_session=${'a'.repeat(64)}`, ...headers };
  let status, result;
  const response = { setHeader() {}, writeHead(code) { status = code; }, end(body) { result = JSON.parse(body); } };
  await handler(request, response, new URL(route, 'http://localhost'));
  return { status, data: result };
}
const authToken = 'a'.repeat(64);
const project = { width: 2, height: 2, cells: ['mard-a1', null, null, null], layers: [{ id: 'base', name: 'Pattern', visible: true, cells: ['mard-a1', null, null, null] }] };
const input = { title: '测试图纸', category: '其他', project };
test('publish, query and detail use the shared store and preserve canonical project', async () => {
  const rows = new Map();
  const store = {
    async session() { return { id: 'user', username: '测试用户' }; },
    async health() {},
    async create(item) { rows.set(item.id, item); return item; },
    async get(id) { return rows.get(id) || null; },
    async list({ page, limit, q, category }) { const items = [...rows.values()].filter(item => (!category || item.category === category) && `${item.title} ${item.author} ${item.description}`.toLowerCase().includes(q)); return { items: items.slice((page-1)*limit, page*limit), total: items.length, page, limit }; },
  };
  try {
    let handler = createMarketplaceHandler({ store });
    const created = await call(handler, 'POST', '/api/patterns', input);
    assert.equal(created.status, 201);
    assert.equal(created.data.author, '测试用户');
    assert.deepEqual(created.data.project.cells, project.cells);
    handler = createMarketplaceHandler({ store });
    const list = await call(handler, 'GET', '/api/patterns?q=测试&limit=1');
    assert.equal(list.data.total, 1);
    assert.equal(list.data.items[0].id, created.data.id);
    assert.equal((await call(handler, 'GET', `/api/patterns/${created.data.id}`)).data.title, input.title);
    assert.equal((await call(handler, 'GET', '/api/patterns?q=absent')).data.total, 0);
    assert.equal((await call(handler, 'GET', '/api/patterns?page=0')).status, 400);
    assert.equal((await call(handler, 'GET', '/api/patterns/00000000-0000-0000-0000-000000000000')).status, 404);
    assert.equal((await call(handler, 'DELETE', '/api/patterns')).status, 405);
  } finally { rows.clear(); }
});
test('invalid input and cross-origin requests cannot write records', async () => {
  const rows = new Map();
  const store = {
    async session() { return { id: 'user', username: '测试用户' }; },
    async health() {},
    async create(item) { rows.set(item.id, item); return item; },
    async get(id) { return rows.get(id) || null; },
    async list({ page, limit, q, category }) { const items = [...rows.values()].filter(item => (!category || item.category === category) && `${item.title} ${item.author} ${item.description}`.toLowerCase().includes(q)); return { items: items.slice((page-1)*limit, page*limit), total: items.length, page, limit }; },
  };
  try {
    const handler = createMarketplaceHandler({ store });
    for (const payload of [{ ...input, title: '' }, { ...input, category: 'invalid' }, { ...input, project: { ...project, width: 181 } }, { ...input, project: { ...project, cells: ['invalid',null,null,null] } }, { ...input, project: { ...project, layers: [{...project.layers[0], cells: Array(4).fill(null)}] } }]) {
      assert.equal((await call(handler, 'POST', '/api/patterns', payload)).status, 400);
    }
    assert.equal((await call(handler, 'POST', '/api/patterns', '{')).status, 400);
    assert.equal((await call(handler, 'POST', '/api/patterns', input, { origin: 'https://other.test' })).status, 403);
    assert.equal((await call(handler, 'POST', '/api/patterns', input, { 'content-type': 'text/plain' })).status, 415);
    assert.equal((await call(handler, 'POST', '/api/patterns', ' '.repeat(5*1024*1024+1))).status, 413);
    assert.equal(rows.size, 0);
  } finally { rows.clear(); }
});

test('missing database configuration and database failures return 503', async () => {
  const store = { async health() { throw Object.assign(new Error('数据库连接失败，请稍后重试。'), { status: 503 }); } };
  const response = await call(createMarketplaceHandler({ store }), 'GET', '/api/health');
  assert.equal(response.status, 503);
});
test('Vercel parsed request bodies use the same validation', async () => {
  let saved;
  const handler = createMarketplaceHandler({ store: { async session() { return { id: 'user', username: '测试用户' }; }, async create(item) { saved = item; return item; } } });
  const request = { method: 'POST', headers: { host: 'localhost', 'content-type': 'application/json', cookie: `perler_session=${authToken}` }, body: input };
  const response = { writeHead(status) { this.status = status; }, end() {} };
  await handler(request, response, new URL('http://localhost/api/patterns'));
  assert.equal(response.status, 201);
  assert.equal(saved.title, input.title);
});

test('Vercel rewrite dispatches collection requests through the shared API', async () => {
  const { default: handler } = await import('../api/index.js');
  const request = { method: 'DELETE', headers: { host: 'example.vercel.app' }, url: '/api/index?__marketplace_path=patterns' };
  let status, payload;
  const response = { setHeader() {}, writeHead(value) { status = value; }, end(value) { payload = JSON.parse(value); } };
  await handler(request, response);
  assert.equal(status, 405);
  assert.match(payload.error, /请求方法/);
});
