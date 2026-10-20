import type catalog from '../shared/i18n/messages.json';
export type Locale = 'zh' | 'en';
export type MessageKey = keyof typeof catalog.zh;
type Parameters = Record<string, string | number>;
declare global { var PERLER_MESSAGES: typeof catalog; }
const preferenceKey = 'perler-beads-generator:language';
export const stripLocale = (path: string) => path === '/en' || path === '/en/' ? '/' : path.startsWith('/en/') ? path.slice(3) : path;
export const localePath = (path: string, locale: Locale = getLocale()) => { const base = stripLocale(path); return locale === 'en' ? '/en' + (base === '/' ? '' : base) : base; };
export function getLocale(): Locale { return document.documentElement.lang.startsWith('en') || /^\/en(?:\/|$)/.test(location.pathname) ? 'en' : 'zh'; }
export function t(key: MessageKey, params: Parameters = {}, locale: Locale = getLocale()): string {
 const pluralKey = (typeof params.count === 'number' ? key + '.' + new Intl.PluralRules(locale).select(params.count) : key) as MessageKey;
 const template = globalThis.PERLER_MESSAGES?.[locale]?.[pluralKey] ?? globalThis.PERLER_MESSAGES?.[locale]?.[key] ?? globalThis.PERLER_MESSAGES?.zh[key] ?? key;
 return template.replace(/\{(\w+)\}/g, (all, name: string) => params[name] === undefined ? all : String(params[name]));
}
export function setLocale(locale: Locale) {
 try { localStorage.setItem(preferenceKey, locale); } catch { /* A disabled storage area does not prevent translation. */ }
 document.documentElement.lang = locale === 'en' ? 'en' : 'zh-CN';
 if (stripLocale(location.pathname) === '/editor') {
  history.replaceState(null, '', localePath('/editor', locale) + location.search + location.hash);
  document.title = t('editor.title', {}, locale);
  const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (canonical) { const url = new URL(canonical.href); url.pathname = localePath('/editor', locale); canonical.href = url.href; }
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('editor.description', {}, locale));
 }
 window.dispatchEvent(new Event('perler:language'));
}
export function useLocale(): [Locale, (locale: Locale) => void] {
 const [locale, update] = React.useState<Locale>(getLocale);
 React.useEffect(() => { const sync = () => update(getLocale()); window.addEventListener('perler:language', sync); return () => window.removeEventListener('perler:language', sync); }, []);
 return [locale, setLocale];
}
export function formatNumber(count: number, locale: Locale = getLocale()) { return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'zh-CN').format(count); }
export function formatDate(value: string, locale: Locale = getLocale()) { return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value)); }
const categoryKeys: Record<string, MessageKey> = {'全部':'category.all','可爱动物':'category.animals','花草自然':'category.nature','像素游戏':'category.games','生活小物':'category.everyday','其他':'category.other'};
export function categoryLabel(value: string, locale: Locale = getLocale(), categories?: Array<{ name: string; nameEn: string }>) { const category = categories?.find(item => item.name === value); if (category) return locale === 'en' && category.nameEn ? category.nameEn : category.name; return categoryKeys[value] ? t(categoryKeys[value], {}, locale) : value; }
