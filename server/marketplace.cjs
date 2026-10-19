const { createAccounts } = require('./accounts.cjs');
const fs = require('node:fs');
const path = require('node:path');
const { createSupabaseStore } = require('./supabase-store.cjs');
const { randomUUID } = require('node:crypto');
const paletteSource = fs.readFileSync(path.join(__dirname, '../src/palette.ts'), 'utf8');
const colorIds = new Set([...paletteSource.matchAll(/^([A-Z]+\d+),#[\dA-Fa-f]{6}$/gm)].map(m => `mard-${m[1].toLowerCase()}`));
const categories = ['可爱动物', '花草自然', '像素游戏', '生活小物', '其他'];
function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }
function text(value, max, fallback = '') {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || value.trim().length > max) fail(`文本长度须不超过 ${max} 字。`);
  return value.trim();
}
function validate(input) {
  if (!input || typeof input !== 'object') fail('请求数据无效。');
  const title = text(input.title, 60);
  if (!title) fail('请填写图纸名称。');
  const category = text(input.category, 20, '其他');
  if (!categories.includes(category)) fail('图纸分类无效。');
  const p = input.project;
  if (!p || !Number.isInteger(p.width) || !Number.isInteger(p.height) || p.width < 1 || p.height < 1 || p.width > 180 || p.height > 180) fail('图纸尺寸须为 1–180 格。');
  function cells(value) {
    if (!Array.isArray(value) || value.length !== p.width * p.height || value.some(c => c !== null && !colorIds.has(c))) fail('图纸格子或 MARD 色号无效。');
    return value;
  }
  cells(p.cells);
  if (!Array.isArray(p.layers) || !p.layers.length || p.layers.length > 100) fail('图层数量须为 1–100。');
  const ids = new Set();
  const layers = p.layers.map(layer => {
    if (!layer || typeof layer !== 'object') fail('图层数据无效。');
    const id = text(layer.id, 100);
    if (!id || ids.has(id)) fail('图层 ID 为空或重复。');
    ids.add(id);
    return { id, name: text(layer.name, 100, '图层'), customName: !!layer.customName, visible: layer.visible !== false, locked: !!layer.locked, includeInUsage: layer.includeInUsage !== false, opacity: typeof layer.opacity === 'number' && Number.isFinite(layer.opacity) ? Math.max(0, Math.min(1, layer.opacity)) : 1, cells: cells(layer.cells) };
  });
  const composed = Array(p.width * p.height).fill(null);
  for (const layer of layers) if (layer.visible) layer.cells.forEach((c, i) => { if (c) composed[i] = c; });
  if (!composed.some(Boolean)) fail('不能提交空图纸。');
  const now = new Date().toISOString();
  const project = { version: '1.0.0', name: title, width: p.width, height: p.height, activeBrand: 'MARD', paletteVersion: 'mard-291-v1', cells: composed, layers, activeLayerId: ids.has(p.activeLayerId) ? p.activeLayerId : layers[0].id, createdAt: now, updatedAt: now };
  // The editor fills its display and board defaults when loading this canonical project.
  return { title, author: text(input.author, 30) || '匿名创作者', description: text(input.description, 1000), category, project };
}
function json(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(JSON.stringify(data));
}
async function body(request) {
  if (!request.headers['content-type']?.startsWith('application/json')) fail('请使用 application/json。', 415);
  if (request.body !== undefined) {
    const raw = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
    if (Buffer.byteLength(raw) > 5 * 1024 * 1024) fail('提交内容不能超过 5 MB。', 413);
    try { return JSON.parse(raw); } catch { fail('JSON 格式无效。'); }
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of request) { size += chunk.length; if (size > 5 * 1024 * 1024) fail('提交内容不能超过 5 MB。', 413); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail('JSON 格式无效。'); }
}
function createMarketplaceHandler({ store = createSupabaseStore() } = {}) {
  const accounts = createAccounts(store);
  return async (request, response, url) => {
    if (!url.pathname.startsWith('/api/')) return false;
    try {
      if (await accounts.route(request, response, url, body, json)) return true;
      if (url.pathname === '/api/health' && request.method === 'GET') { await store.health(); json(response, 200, { status: 'ok', database: 'supabase' }); return true; }
      const collection = url.pathname === '/api/patterns';
      const match = url.pathname.match(/^\/api\/patterns\/([a-f0-9-]{36})$/);
      if (!collection && !match) { json(response, 404, { error: '接口不存在。' }); return true; }
      if (request.method === 'GET' && collection) {
        const page = Number(url.searchParams.get('page') || 1);
        const limit = Number(url.searchParams.get('limit') || 24);
        if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) fail('分页参数无效。');
        const q = (url.searchParams.get('q') || '').toLowerCase();
        const category = url.searchParams.get('category');
        json(response, 200, await store.list({ page, limit, q, category }));
      } else if (request.method === 'GET' && match) {
        const item = await store.get(match[1]);
        if (!item) fail('图纸不存在。', 404);
        json(response, 200, item);
      } else if (request.method === 'POST' && collection) {
        if (request.headers.origin) {
          let origin;
          try { origin = new URL(request.headers.origin); } catch { fail('来源无效。', 403); }
          if (!['http:', 'https:'].includes(origin.protocol) || origin.host !== request.headers.host) fail('不允许跨站提交。', 403);
        }
        const user = await accounts.user(request);
        if (!user) fail('请先登录后再提交图纸。', 401);
        const item = { ...validate({ ...await body(request), author: user.username }), id: randomUUID(), createdAt: new Date().toISOString() };
        json(response, 201, await store.create(item));
      } else { response.setHeader('Allow', collection ? 'GET, POST' : 'GET'); json(response, 405, { error: '请求方法不支持。' }); }
    } catch (error) { if (!error.status) console.error(error); if (!response.destroyed) json(response, error.status || 500, { error: error.status ? error.message : '服务暂时不可用，请稍后重试。' }); }
    return true;
  };
}
module.exports = { createMarketplaceHandler };
