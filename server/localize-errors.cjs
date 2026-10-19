const { t } = require('../shared/i18n/runtime.cjs');
const keys = require('../shared/i18n/error-keys.json');
function requestLocale(header = '') {
 const languages = String(header).split(',').map((entry,index) => {
  const [tag,...options]=entry.trim().split(';');
  const quality=options.find(x=>x.trim().startsWith('q='));
  return {tag:tag.toLowerCase(),quality:quality?Number(quality.trim().slice(2)):1,index};
 }).filter(x=>Number.isFinite(x.quality)&&x.quality>0&&/^(en|zh)(-|$)/.test(x.tag)).sort((a,b)=>b.quality-a.quality||a.index-b.index);
 return languages[0]?.tag.startsWith('en')?'en':'zh';
}
function localizeError(data, header) {
 if(!data || typeof data.error !== 'string') return data;
 const locale=requestLocale(header), length=data.error.match(/^文本长度须不超过 (\d+) 字。$/);
 const code=keys[data.error] || (length?'error.textLength':'error.serviceUnavailable');
 return {...data, code, error:t(code,length?{max:length[1]}:{},locale)};
}
module.exports={requestLocale,localizeError};
