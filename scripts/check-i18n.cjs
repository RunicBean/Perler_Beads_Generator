const assert = require('node:assert/strict');
const { messages } = require('../shared/i18n/runtime.cjs');
const zh = require('../shared/i18n/pages.zh.json'), en = require('../shared/i18n/pages.en.json');
const placeholders = value => [...new Set([...value.matchAll(/\{(\w+)\}/g)].map(m=>m[1]))].sort();
function check() {
 assert.deepEqual(Object.keys(messages.zh).sort(),Object.keys(messages.en).sort(),'Translation keys differ');
 for(const key of Object.keys(messages.zh)) {
  for(const locale of ['zh','en']) assert.ok(typeof messages[locale][key]==='string' && messages[locale][key].trim(),`Empty translation: ${locale}.${key}`);
  assert.deepEqual(placeholders(messages.zh[key]),placeholders(messages.en[key]),`Interpolation parameters differ: ${key}`);
 }
 assert.deepEqual(Object.keys(zh.guides).sort(),Object.keys(en.guides).sort(),'Public page coverage differs');
 for(const locale of [zh,en]) for(const page of [locale.home,...Object.values(locale.guides)]) for(const key of ['title','description','content']) assert.ok(page[key]?.trim(),`Missing public page ${key}`);
}
if(require.main===module) {check();console.log('i18n catalogs validated');}
module.exports={check};
