# Perler Beads Generator

Live demo: https://jett-wu.github.io/Perler_Beads_Generator/

一个强大的拼豆图纸编辑器，可以把图片转换成可打印的拼豆图纸，也可以像绘图软件一样手动编辑、分层创作、统计用量并导出高清图纸。

![Perler Beads Generator workspace](docs/realistic-workspace.png)

## 功能亮点

- **图片生成图纸**：按拼豆格区域采样图片，支持卡通 / 写实风格、色数上限、容差和背景处理。
- **MARD 色卡匹配**：内置 MARD 基础版 221 色与完整版 291 色，支持色号分组、最近使用和快速选色。
- **专业编辑工具**：画笔、橡皮、填充、消除、换色、吸管、移动、复制、粘贴、镜像、形状和文字工具。
- **文字 / 数字 / 符号插入**：支持横排、竖排、字号和间距调整，适合制作姓名、编号和装饰文字。
- **多图层工作流**：支持新建、隐藏、锁定、重命名、复制、拖拽排序、只看当前图层和按图层统计用量。
- **参考图临摹**：可上传参考图，调整透明度、位置和缩放，用于手动临摹或核对图案。
- **当前图层调整**：支持亮度、对比度、饱和度、色温、色相、反色、灰阶、黑白、颜色整理和色数上限。
- **实时 3D 预览**：模拟拼豆完成后的效果，支持放大查看，并跟随圆形 / 方形豆显示模式。
- **用量统计**：按颜色统计颗数，可设置每包数量，并估算每种颜色所需包数。
- **高清导出**：支持导出 PNG / PDF 图纸、Excel 用量清单和 JSON 编辑记录。
- **浏览器本地处理**：图片转换和编辑在浏览器中完成，不需要上传图片到服务器。

## 效果展示

### 写实风格

| 原图 | 工作台 | 导出图纸 |
| --- | --- | --- |
| <img src="docs/realistic-source.jpg" alt="写实风格原图" width="150"> | <img src="docs/realistic-workspace.png" alt="写实风格工作台" width="390"> | <img src="docs/realistic-pattern.png" alt="写实风格导出图纸" width="390"> |

### 卡通风格

| 原图 | 工作台 | 导出图纸 |
| --- | --- | --- |
| <img src="docs/cartoon-source.png" alt="卡通风格原图" width="150"> | <img src="docs/cartoon-workspace.png" alt="卡通风格工作台" width="390"> | <img src="docs/cartoon-pattern.png" alt="卡通风格导出图纸" width="390"> |

### 空白工作区

![Blank workspace](docs/blank-workspace.png)

## 本地运行

```bash
npm install
npm run dev
```

默认预览地址：

```text
http://127.0.0.1:5174/
```

## 构建

```bash
npm run build
```

构建产物会输出到：

```text
generated/dist/
```

## GitHub Pages 部署

项目已包含 GitHub Pages 自动部署工作流：

```text
.github/workflows/deploy.yml
```

部署方式：

1. 推送代码到 `main` 分支。
2. 打开 GitHub 仓库的 `Settings -> Pages`。
3. 将 `Build and deployment` 设置为 `GitHub Actions`。
4. 之后每次推送到 `main` 都会自动构建并部署到 GitHub Pages。

## 文件结构

```text
.github/workflows/
  deploy.yml              # GitHub Pages 自动构建和部署

docs/
  realistic-workspace.png # README 首图，写实风格工作台
  realistic-pattern.png   # 写实风格导出图纸
  realistic-source.jpg    # 写实风格原图
  cartoon-workspace.png   # 卡通风格工作台
  cartoon-pattern.png     # 卡通风格导出图纸
  cartoon-source.png      # 卡通风格原图
  blank-workspace.png     # 空白工作区预览

scripts/
  clean-dist.cjs          # 清理 generated/dist
  post-build.cjs          # 拷贝样式和 vendor 文件，修正构建产物引用
  write-html.cjs          # 写入 GitHub Pages 使用的静态 HTML
  dev-server.cjs          # 本地静态预览服务

src/
  App.tsx                 # 应用状态、布局、顶部栏、左右面板和主要交互
  WorkspaceCanvas.tsx     # 2D 画布、绘制工具、参考图、复制、移动和文字逻辑
  ThreePreview.tsx        # 3D 拼豆预览
  imageToBeads.ts         # 图片转拼豆图纸算法
  palette.ts              # MARD 色卡、色号分组和颜色匹配
  project.ts              # 项目数据、图层、自动保存和兼容导入
  exporters.ts            # PNG / PDF 图纸、Excel 用量和 JSON 编辑记录导出
  usage.ts                # 用量统计和无相邻拼豆检测
  types.ts                # 共享类型定义
  styles.css              # 全局样式
  main.tsx                # React 入口

generated/
  .gitkeep                # 保留目录；构建产物和本地缓存会被忽略

index.html                # 开发入口 HTML
package.json              # 项目脚本和依赖
tsconfig.json             # TypeScript 配置
tsconfig.build.json       # 构建输出配置
```

## 技术栈

- React
- TypeScript
- Three.js
- Canvas API

## 说明

- MARD 色卡用于颜色匹配和界面显示，实际拼豆颜色可能受批次、光线和屏幕显示影响。
- 图片生成图纸时，应用会按每个拼豆格对应的原图区域采样，而不是只读取单个像素。
- JSON 编辑记录用于恢复可编辑项目，不是通用图片格式。
- 应用以桌面端使用为主，并针对不同屏幕比例、分辨率和浏览器缩放做了响应式布局处理。

## 贡献者

感谢每一位让这个项目变得更好的人：

- [@RunicBean](https://github.com/RunicBean)：编辑器快捷键、独立操作工具栏、画布已用色号面板（[PR #1](https://github.com/Jett-Wu/Perler_Beads_Generator/pull/1)）

欢迎提交 Issue 或 Pull Request 一起改进。

---

# Perler Beads Generator

Live demo: https://jett-wu.github.io/Perler_Beads_Generator/

A powerful Perler bead pattern editor for turning images into printable bead charts, with manual editing, layers, reference tracing, usage counting, 3D preview, and high-resolution exports.

![Perler Beads Generator workspace](docs/realistic-workspace.png)

## Highlights

- **Image-to-pattern conversion** with bead-cell area sampling, cartoon / realistic styles, color limits, tolerance, and background handling.
- **MARD color matching** with built-in Basic 221-color and Complete 291-color palettes, color groups, recent colors, and fast selection.
- **Editing tools** including pencil, eraser, fill, clear, recolor, eyedropper, move, copy, paste, mirror, shapes, and text.
- **Text insertion** for letters, numbers, symbols, and Chinese characters, with horizontal / vertical layout, size, and spacing controls.
- **Layer workflow** with add, hide, lock, rename, duplicate, drag reorder, current-layer-only view, and per-layer usage counting.
- **Reference image tracing** with opacity, position, drag, and scale controls for manual tracing or visual checking.
- **Active-layer adjustments** for brightness, contrast, saturation, temperature, hue, invert, grayscale, black-white, color cleanup, and color limits.
- **Live 3D preview** with an enlarged viewer and round / square bead display modes.
- **Usage statistics** by color, custom beads-per-pack settings, and estimated packs.
- **High-resolution exports** for PNG / PDF patterns, Excel usage workbooks, and JSON edit records.
- **Local browser-side processing**. Images are processed in the browser and are not uploaded to a server.

## Gallery

### Realistic Style

| Source | Workspace | Exported Pattern |
| --- | --- | --- |
| <img src="docs/realistic-source.jpg" alt="Realistic source image" width="150"> | <img src="docs/realistic-workspace.png" alt="Realistic style workspace" width="390"> | <img src="docs/realistic-pattern.png" alt="Realistic exported pattern" width="390"> |

### Cartoon Style

| Source | Workspace | Exported Pattern |
| --- | --- | --- |
| <img src="docs/cartoon-source.png" alt="Cartoon source image" width="150"> | <img src="docs/cartoon-workspace.png" alt="Cartoon style workspace" width="390"> | <img src="docs/cartoon-pattern.png" alt="Cartoon exported pattern" width="390"> |

### Blank Workspace

![Blank workspace](docs/blank-workspace.png)

## Local Development

```bash
npm install
npm run dev
```

Default preview URL:

```text
http://127.0.0.1:5174/
```

## Build

```bash
npm run build
```

Build output:

```text
generated/dist/
```

## GitHub Pages Deployment

This project includes a GitHub Pages deployment workflow:

```text
.github/workflows/deploy.yml
```

Deployment steps:

1. Push to the `main` branch.
2. Open `Settings -> Pages` in the GitHub repository.
3. Set `Build and deployment` to `GitHub Actions`.
4. Every push to `main` will build and deploy the site automatically.

## Project Structure

```text
.github/workflows/
  deploy.yml              # GitHub Pages build and deployment workflow

docs/
  realistic-workspace.png # README hero image, realistic workspace
  realistic-pattern.png   # Realistic exported pattern
  realistic-source.jpg    # Realistic source image
  cartoon-workspace.png   # Cartoon workspace
  cartoon-pattern.png     # Cartoon exported pattern
  cartoon-source.png      # Cartoon source image
  blank-workspace.png     # Blank workspace preview

scripts/
  clean-dist.cjs          # Cleans generated/dist
  post-build.cjs          # Copies styles/vendor files and fixes built imports
  write-html.cjs          # Writes the static HTML used by GitHub Pages
  dev-server.cjs          # Local static preview server

src/
  App.tsx                 # App state, layout, panels, and main interactions
  WorkspaceCanvas.tsx     # 2D editor canvas, tools, reference image, copy/move/text logic
  ThreePreview.tsx        # 3D bead preview
  imageToBeads.ts         # Image-to-bead conversion algorithm
  palette.ts              # MARD palettes, groups, and color matching
  project.ts              # Project data, layers, autosave, and import compatibility
  exporters.ts            # PNG / PDF pattern, Excel usage, and JSON export
  usage.ts                # Usage summary and isolated bead detection
  types.ts                # Shared TypeScript types
  styles.css              # Global styles
  main.tsx                # React entry

generated/
  .gitkeep                # Keeps the folder; build output and local caches are ignored

index.html                # Development HTML entry
package.json              # Scripts and dependencies
tsconfig.json             # TypeScript config
tsconfig.build.json       # Build output config
```

## Stack

- React
- TypeScript
- Three.js
- Canvas API

## Notes

- MARD palette colors are used for matching and display. Real bead colors may vary by batch, lighting, and screen calibration.
- Image conversion samples the image area covered by each bead cell instead of reading only a single pixel.
- JSON edit records are for restoring editable projects, not for general image exchange.
- The app is desktop-first and includes responsive layout handling for different screen ratios, resolutions, and browser zoom levels.

## Contributors

Thanks to everyone who makes this project better:

- [@RunicBean](https://github.com/RunicBean): editor keyboard shortcuts, a separate action toolbar, and the on-canvas color usage panel ([PR #1](https://github.com/Jett-Wu/Perler_Beads_Generator/pull/1))

Issues and pull requests are welcome.

### 图纸集市与后端

编辑器第二行的「图纸集市」打开列表，「提交图纸」可公开提交当前画布，也可上传编辑器导出的 JSON。支持搜索、分类、排序、收藏、详情预览、MARD 用量、JSON 下载和载入编辑器。

需要 Node.js 20.12 或以上。`npm run dev` 构建并启动同源的前端与 API；`npm run build` 后可用 `npm start` 启动。默认地址为 `http://127.0.0.1:5174/`。

```bash
npm test
npm run build
cp .env.example .env
# 填写 .env 中的 Supabase URL 和服务端密钥后运行
HOST=0.0.0.0 PORT=5174 npm start
```

- `GET /api/health`：健康检查。
- `GET /api/patterns?page=1&limit=24&q=关键词&category=其他`：分页图纸列表，limit 为 1–100。
- `GET /api/patterns/:id`：图纸详情，不存在返回 404。
- `POST /api/patterns`：JSON 请求，包含 title、author（可选）、description（可选）、category、project。成功返回 201 和服务端生成的 ID/时间。

服务端校验名称、分类、尺寸、图层与 MARD 色号，并按可见图层重新合成格子。图纸信息与完整图纸 JSON 存入 Supabase PostgreSQL 的 `public.marketplace_patterns` 表。分页、搜索、分类和总数查询在数据库执行，不再读写本地数据目录。应用请求体上限仍为 5 MB；托管平台可能有更小的请求限制。

#### Supabase 配置

1. 创建 Supabase 项目，在 SQL Editor 执行 `supabase/migrations/202610180001_marketplace.sql`（新建表与查询函数，执行一次）。也可以用 Supabase CLI 的迁移流程应用此文件。
2. 在项目设置获取 Project URL，以及服务端 Secret key（`sb_secret_...`）。旧版 `service_role` key 也受支持。
3. 本地复制 `.env.example` 为 `.env`，填写 `SUPABASE_URL` 和 `SUPABASE_SECRET_KEY`。若使用旧版密钥，填写 `SUPABASE_SERVICE_ROLE_KEY`，并移除 `SUPABASE_SECRET_KEY` 占位值。
4. 启动服务，访问 `/api/health`，成功时返回 `{"status":"ok","database":"supabase"}`。未配置或数据库不可用时返回 503。

Secret/service_role key 仅由 Node API 使用，不要配置成任何前端公开变量。表启用 RLS，撤销 anon/authenticated 的访问权限；查询函数只授权 service_role 执行。数据库不会直接接收浏览器写入，浏览器仍通过经过校验的 `/api/patterns` 提交图纸。参考 [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys) 和 [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)。

旧版 `data/marketplace/*.json` 不会自动迁移或删除；已有图纸可以载入编辑器后重新提交。浏览器 localStorage 作品同样不会自动公开。

#### Vercel 部署

仓库的 `vercel.json` 已设置 `npm run build`、静态输出 `generated/dist`、API rewrite 和色卡文件打包；`api/index.js` 复用本地 Node API。无需启动长驻进程，也不需要可写磁盘。

1. 将仓库导入 Vercel，保留仓库中的构建配置。
2. 在 Vercel 项目的 Environment Variables 中设置 `SUPABASE_URL` 和 `SUPABASE_SECRET_KEY`（或旧版 `SUPABASE_SERVICE_ROLE_KEY`），按需应用到 Production/Preview。
3. 完成 Supabase 建表后部署；环境变量修改后需重新部署。
4. 检查 `/api/health`，再通过集市提交一份图纸，并在另一个浏览器打开其详情链接验证共享。

当前自动测试使用模拟的数据库响应，覆盖 Supabase 请求构造、API 校验、错误处理和 Vercel 解析后的请求体；没有凭据时不能验证真实 Supabase 项目的 schema、权限及线上连通性。

图纸通过 `/#marketplace/<id>` 分享，同一服务器的其他浏览器可以访问。收藏仍保存在各自浏览器。旧版 localStorage 图纸保留在列表中，不会自动公开，需手动提交后才能共享。连接失败时显示本地图纸和重试入口，禁止公开提交。

GitHub Pages 只提供静态托管，不能运行这个后端。共享版本可部署至 Vercel，或自行托管 Node 服务。当前 API 提交要求账号登录；暂不提供修改、删除或审核接口。

### 账号登录与访问统计

执行 `supabase/migrations/202610190001_accounts_analytics.sql` 后部署新版服务。顶部「登录 / 注册」支持账号密码注册、登录和退出；浏览及本地编辑可匿名使用，公开提交图纸要求登录，作者自动使用登录账号。账号不区分大小写，密码采用随机盐 scrypt 哈希；随机会话令牌通过 HttpOnly、SameSite Cookie 保存，有效期 7 天，数据库只保存令牌摘要。HTTPS 生产环境请设置 `NODE_ENV=production`（Vercel 自动启用 Secure Cookie）。

先注册并确认自己的账号，再把该账号写入服务端 `ADMIN_USERNAMES`，多个账号用逗号分隔，重新启动或部署后登录即可看到「访问统计」。不要预先授权尚未注册的账号名称。

统计支持最近 7 / 30 / 90 天，按北京时间自然日计算：访问量 PV、浏览器去重 UV、标签页会话数、新增账号、每日 PV/UV、来源域名，以及图片生成、集市浏览和各类导出次数。每次页面加载计一次 PV；刷新沿用标签页会话，关闭标签页后重新打开产生新会话。匿名浏览器标识保存在 localStorage，清除存储或使用不同浏览器会重新计数。来源仅记录域名，不保存完整 URL、原始 IP、图片或画布内容；客户端拦截或伪造上报可能影响统计精度。

账号尝试按账号在数据库内限制为每 15 分钟 10 次，统计事件按访客每分钟限制 60 次。遇到限流请稍后重试。生产运营仍应配置平台入口限流以控制恶意流量。会话过期后需重新登录；可定期删除过期 `app_sessions` 与不再需要的 `app_events`。当前不含密码找回和账号管理功能。

新增 API：`POST /api/auth/register`、`POST /api/auth/login`（username、password），`GET /api/auth/me`，`POST /api/auth/logout`，`POST /api/analytics/events`，`GET /api/analytics?days=7`（仅管理员）。所有新表开启 RLS，仅服务端 service_role 可访问。

集市公开列表与详情仅返回 PNG 预览和基本信息，不包含图纸格子或图层。预览采用连续色块，不显示圆形拼豆、色号或点状背景。载入及 JSON 下载通过 `GET /api/patterns/:id/project` 获取完整图纸，该接口要求有效登录会话；未登录可在集市右上角注册或登录。此调整无需新增数据库迁移。
