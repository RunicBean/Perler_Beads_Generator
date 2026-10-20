const fs = require('fs');
const path = require('path');

const { site, home, guides, guidePage } = require('../server/public-pages.cjs');
const { t, localePath, messages } = require('../shared/i18n/runtime.cjs');
function editorHtml(locale) { return `<!doctype html>
<html lang="${locale === 'en' ? 'en' : 'zh-CN'}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      name="description"
      content="${t('editor.description', {}, locale)}"
    />
    <title>${t('editor.title', {}, locale)}</title>
    <meta name="robots" content="noindex,follow" />
    <link rel="canonical" href="${site()}${localePath('/editor',locale)}" />
    <link rel="icon" type="image/svg+xml" href="/logo.svg" />
    <meta name="theme-color" content="#245F50" />
    <link rel="stylesheet" href="/styles.css" />
    <script type="importmap">
      {
        "imports": {
          "three": "/vendor/three.module.js"
        }
      }
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script src="/i18n.js"></script>
    <script src="/vendor/react.production.min.js"></script>
    <script src="/vendor/react-dom.production.min.js"></script>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
`; }

const dist = path.join(process.cwd(), 'generated/dist');
fs.mkdirSync(path.join(dist, 'en'), { recursive: true });
fs.writeFileSync(path.join(dist, 'editor.html'), editorHtml('zh'));
fs.writeFileSync(path.join(dist, 'en/editor.html'), editorHtml('en'));
for (const locale of ['zh','en']) {
 const homeFile = locale === 'en' ? 'en/index.html' : 'index.html';
 fs.writeFileSync(path.join(dist, homeFile), home(locale));
 for (const url of Object.keys(guides)) {
  const dir = path.join(dist, localePath(url, locale)); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), guidePage(url, locale));
 }
}
fs.writeFileSync(path.join(dist, 'i18n.js'), 'globalThis.PERLER_MESSAGES = ' + JSON.stringify(messages).replace(/</g, '\\u003c') + ';');
fs.copyFileSync(path.join(process.cwd(), 'src/public.css'), path.join(dist, 'public.css'));
fs.mkdirSync(path.join(dist, 'examples'), { recursive: true });
for (const name of ['cartoon-source.png','cartoon-pattern.png']) fs.copyFileSync(path.join(process.cwd(), 'docs', name), path.join(dist,'examples',name));

fs.copyFileSync(path.join(process.cwd(), 'src/assets/logo.svg'), path.join(dist, 'logo.svg'));
