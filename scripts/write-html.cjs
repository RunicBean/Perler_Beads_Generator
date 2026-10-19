const fs = require('fs');
const path = require('path');

const { site } = require('../server/public-pages.cjs');
const html = `<!doctype html>
<html lang="zh">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      name="description"
      content="A powerful Perler bead pattern editor for turning images into printable bead charts with MARD color matching, layers, 3D preview, and usage exports."
    />
    <title>拼豆图纸编辑器｜Perler Beads Generator</title>
    <meta name="robots" content="noindex,follow" />
    <link rel="canonical" href="${site()}/editor" />
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
    <script src="/vendor/react.production.min.js"></script>
    <script src="/vendor/react-dom.production.min.js"></script>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
`;

fs.writeFileSync(path.join(process.cwd(), 'generated', 'dist', 'editor.html'), html);

const { home, page, guides } = require('../server/public-pages.cjs');
const dist = path.join(process.cwd(), 'generated/dist');
fs.writeFileSync(path.join(dist, 'index.html'), home());
for (const [url, content] of Object.entries(guides)) {
 const dir = path.join(dist, url); fs.mkdirSync(dir, { recursive: true });
 fs.writeFileSync(path.join(dir, 'index.html'), page({ ...content, path: url }));
}
fs.copyFileSync(path.join(process.cwd(), 'src/public.css'), path.join(dist, 'public.css'));
fs.mkdirSync(path.join(dist, 'examples'), { recursive: true });
for (const name of ['cartoon-source.png','cartoon-pattern.png']) fs.copyFileSync(path.join(process.cwd(), 'docs', name), path.join(dist,'examples',name));
