const messages = require('./messages.json');
const locales = ['zh', 'en'];
function normalizeLocale(value) { return /^en(?:-|$)/i.test(value || '') ? 'en' : 'zh'; }
function stripLocale(path) { return path === '/en' || path === '/en/' ? '/' : path.startsWith('/en/') ? path.slice(3) : path; }
function localePath(path, locale) { const base = stripLocale(path); return locale === 'en' ? '/en' + (base === '/' ? '' : base) : base; }
function t(key, params = {}, locale = 'zh') {
 const language = normalizeLocale(locale);
 const pluralKey = typeof params.count === 'number' ? key + '.' + new Intl.PluralRules(language).select(params.count) : key;
 const template = messages[language]?.[pluralKey] ?? messages[language]?.[key] ?? messages.zh[key] ?? key;
 return template.replace(/\{(\w+)\}/g, (all, name) => params[name] === undefined ? all : String(params[name]));
}
const categoryKeys = { '全部':'all','可爱动物':'animals','花草自然':'nature','像素游戏':'games','生活小物':'everyday','其他':'other' };
function categoryLabel(value, locale) { return categoryKeys[value] ? t('category.'+categoryKeys[value], {}, locale) : value; }
module.exports = { messages, locales, normalizeLocale, stripLocale, localePath, t, categoryLabel };
