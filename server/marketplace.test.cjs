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
const testCategories = ['可爱动物','花草自然','像素游戏','生活小物','其他'].map((name,i) => ({ id: String(i), name, nameEn: name === '可爱动物' ? 'Cute animals' : name, sortOrder: i, active: true }));
const authToken = 'a'.repeat(64);
const project = { width: 2, height: 2, cells: ['mard-a1', null, null, null], layers: [{ id: 'base', name: 'Pattern', visible: true, cells: ['mard-a1', null, null, null] }] };
const input = { title: '测试图纸', category: '其他', project };
test('publish, query and detail use the shared store and preserve canonical project', async () => {
  const rows = new Map();
  const store = {
    async categories() { return testCategories; }, async session() { return { id: 'user', username: '测试用户' }; },
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
    async categories() { return testCategories; }, async session() { return { id: 'user', username: '测试用户' }; },
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
  const handler = createMarketplaceHandler({ store: { async categories() { return testCategories; }, async session() { return { id: 'user', username: '测试用户' }; }, async create(item) { saved = item; return item; } } });
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

test('public endpoints expose flat PNG previews, full projects require a valid session', async () => {
  const id = '12345678-1234-1234-1234-123456789012';
  const item = { ...input, id, project };
  const store = {
    async list() { return { items: [item], total: 1 }; },
    async get() { return item; },
    async categories() { return testCategories; }, async session() { return { id: 'user', username: 'tester' }; },
  };
  const handler = createMarketplaceHandler({ store });
  for (const route of ['/api/patterns', `/api/patterns/${id}`]) {
    const response = await call(handler, 'GET', route, undefined, { cookie: '' });
    assert.equal(response.status, 200);
    const listing = response.data.items?.[0] || response.data;
    assert.equal(listing.project, undefined);
    assert.equal(listing.width, 2);
    assert.match(listing.preview, /^data:image\/png;base64,/);
    const png = Buffer.from(listing.preview.split(',')[1], 'base64');
    const { inflateSync } = require('node:zlib');
    let offset = 8, pixels;
    while (offset < png.length) { const length = png.readUInt32BE(offset); if (png.toString('ascii', offset+4,offset+8) === 'IDAT') pixels = inflateSync(png.subarray(offset+8,offset+8+length)); offset += length+12; }
    assert.equal(pixels.length, 18);
    assert.equal(pixels[4], 255); // Solid pixel with no bead-shaped gaps.
    assert.equal(pixels[8], 0); // Empty cell remains transparent.
  }
  assert.equal((await call(handler, 'GET', `/api/patterns/${id}/project`, undefined, { cookie: '' })).status, 401);
  const authenticated = await call(handler, 'GET', `/api/patterns/${id}/project`);
  assert.equal(authenticated.status, 200);
  assert.deepEqual(authenticated.data.project, project);
});

test('admin moderation requires configured admin, validates metadata and enforces origin', async () => {
  const previous = process.env.ADMIN_USERNAMES;
  process.env.ADMIN_USERNAMES = 'curator';
  const id = '12345678-1234-1234-1234-123456789012';
  const item = { ...input, author: 'artist', id, status: 'published', createdAt: new Date().toISOString() };
  const writes = [];
  let username = 'ordinary', listOptions;
  const store = {
    async categories() { return testCategories; }, async session() { return { id: 'user', username }; },
    async list(options) { listOptions = options; return { items: [item], total: 1 }; },
    async update(key, changes) { writes.push(changes); if (key !== id) return null; Object.assign(item, changes); return item; },
    async get(key) { return key === id && item.status === 'published' ? item : null; },
  };
  const handler = createMarketplaceHandler({ store });
  try {
    assert.equal((await call(handler, 'GET', '/api/admin/patterns')).status, 403);
    assert.equal((await call(handler, 'POST', `/api/admin/patterns/${id}`, { status: 'hidden' })).status, 403);
    assert.equal((await call(handler, 'GET', '/api/admin/patterns', undefined, { cookie: '' })).status, 403);
    assert.equal(writes.length, 0);
    username = 'curator';
    const list = await call(handler, 'GET', '/api/admin/patterns?status=hidden&q=test&page=2');
    assert.equal(list.status, 200); assert.equal(listOptions.includeHidden, true); assert.equal(listOptions.status, 'hidden');
    assert.equal(list.data.items[0].project, undefined);
    assert.equal((await call(handler, 'GET', '/api/admin/patterns?page=0')).status, 400);
    assert.equal((await call(handler, 'GET', '/api/admin/patterns?status=deleted')).status, 400);
    assert.equal((await call(handler, 'POST', `/api/admin/patterns/${id}`, { status: 'hidden' }, { origin: 'https://evil.test' })).status, 403);
    for (const invalid of [{ title: '' }, { title: 'x'.repeat(61) }, { description: 'x'.repeat(1001) }, { category: 'invalid' }, { status: 'deleted' }, { project: {} }, null]) {
      assert.equal((await call(handler, 'POST', `/api/admin/patterns/${id}`, invalid)).status, 400);
    }
    assert.equal(writes.length, 0);
    assert.equal((await call(handler, 'POST', `/api/admin/patterns/${id}`, { title: 'Edited', category: '像素游戏', status: 'hidden', author: 'forged' })).status, 200);
    assert.equal(item.author, 'artist'); assert.equal(item.title, 'Edited');
    assert.equal((await call(handler, 'GET', `/api/patterns/${id}`)).status, 404);
    assert.equal((await call(handler, 'GET', `/api/patterns/${id}/project`)).status, 404);
    assert.equal((await call(handler, 'POST', `/api/admin/patterns/${id}`, { status: 'published' })).status, 200);
    assert.equal((await call(handler, 'GET', `/api/patterns/${id}`)).status, 200);
    assert.equal((await call(handler, 'POST', '/api/admin/patterns/00000000-0000-0000-0000-000000000000', { status: 'hidden' })).status, 404);
  } finally { if (previous === undefined) delete process.env.ADMIN_USERNAMES; else process.env.ADMIN_USERNAMES = previous; }
});

test('public filter parameters are validated and forwarded without admin overrides', async () => {
  let options;
  const handler = createMarketplaceHandler({ store: { async list(value) { options = value; return { items: [], total: 0 }; } } });
  const result = await call(handler, 'GET', '/api/patterns?beads=medium&colors=few&continuity=continuous&sort=continuous&status=all&include_hidden=true');
  assert.equal(result.status, 200);
  assert.deepEqual(options, { page: 1, limit: 24, q: '', category: null, beads: 'medium', colors: 'few', continuity: 'continuous', sort: 'continuous' });
  for (const query of ['beads=0', 'colors=unknown', 'continuity=101', 'sort=bad']) assert.equal((await call(handler, 'GET', `/api/patterns?${query}`)).status, 400);
});

test('administrators manage dynamic categories and disabled categories reject new submissions', async () => {
  const previous = process.env.ADMIN_USERNAMES;
  process.env.ADMIN_USERNAMES = 'curator';
  const id = '12345678-1234-1234-1234-123456789012';
  const catalog = [{ id, name: '自定义分类', nameEn: 'Custom', sortOrder: 10, active: true }];
  const rows = [];
  let username = 'ordinary';
  const store = {
    async categories() { return catalog; },
    async session() { return { id: 'user', username }; },
    async create(item) { rows.push(item); return item; },
    async saveCategory(key, changes) {
      const item = key ? catalog.find(category => category.id === key) : { id: '00000000-0000-0000-0000-000000000001', nameEn: '', sortOrder: 100, active: true };
      if (!item) return null;
      if (catalog.some(category => category.id !== item.id && category.name === changes.name)) throw Object.assign(new Error('分类名称已存在。'), { status: 409 });
      if (changes.name && changes.name !== item.name) rows.forEach(row => { if (row.category === item.name) row.category = changes.name; });
      Object.assign(item, changes); if (!key) catalog.push(item); return item;
    },
  };
  const handler = createMarketplaceHandler({ store });
  try {
    assert.equal((await call(handler, 'GET', '/api/categories', undefined, { cookie: '' })).data.items[0].name, '自定义分类');
    assert.equal((await call(handler, 'POST', '/api/patterns', { ...input, category: '自定义分类' })).status, 201);
    assert.equal((await call(handler, 'POST', `/api/admin/categories/${id}`, { active: false })).status, 403);
    assert.equal((await call(handler, 'GET', '/api/admin/categories')).status, 403);
    username = 'curator';
    assert.equal((await call(handler, 'GET', '/api/admin/categories')).status, 200);
    assert.equal((await call(handler, 'POST', `/api/admin/categories/${id}`, { active: false }, { origin: 'https://evil.test' })).status, 403);
    assert.equal(catalog[0].active, true);
    for (const invalid of [{ name: '' }, { name: '全部' }, { name: 'x'.repeat(21) }, { nameEn: 'x'.repeat(61) }, { active: 'false' }, { sortOrder: -1 }, { sortOrder: 10000 }, { sortOrder: 1.5 }, {}, null]) {
      assert.equal((await call(handler, 'POST', `/api/admin/categories/${id}`, invalid)).status, 400);
    }
    assert.equal((await call(handler, 'POST', `/api/admin/categories/${id}`, { name: '改名后的分类', nameEn: 'Renamed', sortOrder: 5 })).status, 200);
    assert.equal(rows[0].category, '改名后的分类');
    assert.equal((await call(handler, 'POST', `/api/admin/categories/${id}`, { active: false })).status, 200);
    assert.equal((await call(handler, 'POST', '/api/patterns', { ...input, category: '改名后的分类' })).status, 400);
    assert.equal(rows.length, 1);
    assert.equal((await call(handler, 'GET', '/api/categories')).data.items[0].active, false);
    assert.equal((await call(handler, 'POST', `/api/admin/categories/${id}`, { active: true })).status, 200);
    assert.equal((await call(handler, 'POST', '/api/patterns', { ...input, category: '改名后的分类' })).status, 201);
    assert.equal((await call(handler, 'POST', '/api/admin/categories', { name: '新分类', nameEn: 'New', sortOrder: 0 })).status, 201);
    const duplicate = await call(handler, 'POST', '/api/admin/categories', { name: '改名后的分类' }, { 'accept-language': 'en' });
    assert.equal(duplicate.status, 409); assert.match(duplicate.data.error, /already exists/);
    assert.equal((await call(handler, 'POST', '/api/admin/categories', { name: '' })).status, 400);
    assert.equal((await call(handler, 'POST', '/api/admin/categories/00000000-0000-0000-0000-000000000000', { name: 'missing' })).status, 404);
  } finally { if (previous === undefined) delete process.env.ADMIN_USERNAMES; else process.env.ADMIN_USERNAMES = previous; }
});
