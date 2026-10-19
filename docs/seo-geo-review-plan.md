# SEO / GEO 评审与实施计划

评审日期：2026-10-20。范围：当前仓库源码、构建脚本、Node / Vercel 部署配置及官方搜索文档。正式域名已由用户确认为 `https://perler-beads-generator.ai-toolsets.com`。未取得 Search Console / Bing Webmaster Tools 数据；未实测线上响应、收录、排名、WAF 或 Core Web Vitals。以下为源码审计，不作为线上测量结果。

GEO 在本文中指提升生成式搜索理解、检索和引用公开页面的能力，不承诺排名或引用。

## 正式站点配置

- 正式域名：`https://perler-beads-generator.ai-toolsets.com`。
- 后续服务端配置使用 `SITE_URL=https://perler-beads-generator.ai-toolsets.com`。
- canonical、sitemap URL、Open Graph URL 与公开图片绝对地址统一使用此域名。
- Vercel 默认域名和 GitHub Pages 是否保留、是否有权限配置重定向，实施时检查；不把上游项目的 GitHub Pages 当作本站别名处理。
- 正式域名已确认，线上抓取与性能检查仍待实施。

## 已有基础

- 有明确的产品能力：图片转拼豆、MARD 匹配、分层编辑、PNG / PDF / Excel / JSON 导出。
- 图纸有标题、作者、分类、时间、尺寸、颗数、色数，适合形成独立公开详情页。
- 服务端已区分公开预览与登录后的完整项目，可在保留权限的同时改善抓取。
- 预览改为 PNG，具有 alt；仍需独立图片 URL、尺寸和缓存策略。

## 问题与建议

| 优先级 | 现状与源码证据 | 影响与修改建议 |
| --- | --- | --- |
| P0 | `src/Marketplace.tsx` 使用 `#marketplace` / `#marketplace/:id` | 不能可靠地作为独立内容 URL 被搜索发现；改为 `/marketplace`、`/patterns/:id`，使用真实 a 链接，详情输出可读 HTML。 |
| P0 | `scripts/write-html.cjs` 只输出空 `#root` | 内容依赖客户端执行 JS、请求 API；Google 可以渲染部分 JS 页面，但其他抓取器能力不同。首页和公开详情提供服务端或构建时 HTML。 |
| P1 | 标题只有英文品牌名，description 为泛化英文介绍；详情无独立 meta | 按页面生成中文 title、description、自引用 canonical；增加 Open Graph / Twitter 卡片。它们有助于描述与分享，不保证排名。 |
| P1 | 构建页 lang=zh，源入口 lang=en；语言依赖本地设置 | 优先完善中文；若正式支持英文内容，提供 `/en/` 独立页面及对应语言标记 / hreflang，不把所有页面统一 canonical 到中文首页。 |
| P1 | 无 robots.txt / sitemap.xml 生成逻辑 | 配置公开抓取规则、站点地图；缺失 robots 本身不等于禁止抓取。仅收录正式域名下有效公开页面；预发布环境 noindex。 |
| P1 | 编辑器正常界面缺少描述产品的主标题与介绍；README 信息不在站点中 | 添加用户可见的产品说明、教程、功能与限制。不能仅在 robots、隐藏文本或 JSON-LD 中堆内容。 |
| P1 | 产品名、README demo 与 Git remote 指向不同归属 | 确认运营主体、产品名、正式域名；统一站内 About、分享信息、README。上游致谢与当前产品身份分开表达。 |
| P1 | 三维模块静态导入，构建产物 three.core.js 约 1.4 MB、three.module.js 约 636 KB，未压缩磁盘大小 | 存在首屏加载成本；不是线上传输量或性能得分。公共页不加载编辑器，3D 按需加载；测量后优化。 |
| P1 | 列表循环请求全部分页，预览为 JSON 内嵌 base64 | 内容增长后传输量和渲染开销扩大。服务端筛选与分页、公开分页链接、固定 PNG URL、缓存与懒加载。 |
| P2 | 无结构化数据和完善帮助页 | 按真实可见内容增加 WebApplication、BreadcrumbList、作品 CreativeWork / ImageObject；不虚构评分、评论或收费信息，不承诺富结果。 |
| P2 | 统计只有来源域名与功能事件 | 增加公开 landing path、来源渠道、注册/载入/下载成功事件，以分析搜索到使用的转化；避免写入原始 IP、密码、画布或完整敏感 URL。 |

## 推荐架构

不要求迁移整个项目到新框架。优先保留 React 编辑器，抽离公开页面：

| 地址 | 页面职责 | 渲染 / 索引 |
| --- | --- | --- |
| `/` | 产品介绍、示例、简短使用步骤、FAQ、进入编辑器入口 | 静态 HTML，可索引 |
| `/editor` | 保留完整工作台 | React；不作为主要内容落地页，是否 noindex 在正式 URL 规划时决定 |
| `/marketplace` | 可分页图纸列表 | 服务端公开 HTML，可索引 |
| `/patterns/:id` | 图纸 PNG、标题、作者、介绍、尺寸、颗数、色数、登录 CTA | 服务端公开 HTML，可索引 |
| `/guides/image-to-perler` | 图片转拼豆教程与原创前后对比 | 静态 HTML，可索引 |
| `/guides/mard-colors` | MARD 色号使用、色数选择、匹配限制 | 静态 HTML，可索引 |
| `/about` / `/privacy` | 产品身份、联系入口、隐私及统计说明 | 静态 HTML，可索引 |
| `/api/patterns/:id/project` | 完整图纸数据 | 保持登录鉴权，增加 X-Robots-Tag: noindex |
| `/patterns/:id/preview.png` | 稳定公开预览 URL | image/png、明确缓存策略，无图层及色号标识 |

路由和服务器都需支持直接刷新 / 分享访问。图纸删除或不存在返回真正 404，数据库暂不可用返回 503，不能把错误页当 200 内容页。普通访客与搜索抓取器看到相同公开信息，不按 User-Agent 绕过登录。

新增首页会改变默认入口。正式实施时先保留草稿恢复能力、提供醒目进入编辑器入口，再测试旧书签与旧 hash 分享兼容。若优先要求维持首页直接进入工作台，可先给 `/` 加静态可读说明并建设 `/marketplace`，将独立介绍首页作为后续产品决定。

## GEO 内容建议

1. 用直接可核实的介绍说明产品是什么、适合谁、输入与输出格式、哪些功能需登录。
2. 发布具体问题的短答案，例如“图片怎么转成拼豆图纸”“导出 PDF 是否需要登录”“为什么屏幕颜色和实物不同”。答案与当前真实实现一致：本地编辑及导出与集市下载的登录规则需分别解释。
3. 增加原创示例：原图、生成参数、输出效果、尺寸与用量。取得图片使用授权，避免只有相同模板的薄作品页。
4. 标明作者、实质更新时间和方法限制；说明 MARD 色卡用于匹配，不暗示官方合作或色彩保证。
5. 公开事实写进正文与语义化 HTML。登录后的配色明细不写进公开 JSON-LD、页面源代码或 sitemap。
6. 检查 Googlebot、Bingbot、OAI-SearchBot 的 robots / CDN 访问。搜索抓取与训练抓取分别决策；GPTBot 放行不等于搜索引用资格。
7. `llms.txt` 仅作为后续可选实验，不作为第一阶段验收项，也不声称是 AI 搜索收录要求。

## 分阶段实施任务

### 阶段 0：确认目标与基线

- 正式域名已确认；继续确认主要目标语言、首页是否继续直接进入工作台、静态镜像是否保留。
- 设置 `SITE_URL` 作为绝对 canonical / sitemap / OG URL 来源；禁止以任意请求 Host 直接拼装。
- 检查线上 robots、响应状态、预览环境、JS 渲染、代表性作品与缓存。
- 留存首页 / 列表 / 详情的当前 HTML、移动端性能测量、已有收录情况。
- 涉及文件：部署环境、`vercel.json`、`scripts/write-html.cjs`、`.env.example`。
- 验收：有确定的正式站点和测量记录；没有域名则先完成通用模板，不填猜测网址。

### 阶段 1：建立可抓取页面（最高优先级）

- 抽取公共 HTML 模板和统一 SEO 元信息；首页提供可见产品说明及正常链接。
- 增加 `/marketplace` / `/patterns/:id`，复用现有 Supabase 数据层与公开预览转换，不暴露 project。
- Vercel function 与本地 Node 共用页面处理逻辑；静态页构建与动态页路由分别配置。
- 使用绝对静态资源路径或明确 base path，避免嵌套地址破坏 `./vendor` / `./api` 引用。
- 兼容旧 hash 分享：客户端映射到对应正式详情 URL；hash 不发给服务器，不能靠服务端 301 解析。
- 修正列表 / 作品真实 a 链接，保留编辑器跳转和登录交互。
- 涉及文件：`src/App.tsx`、`src/Marketplace.tsx`、`src/Account.tsx`、`src/main.tsx`、`server/marketplace.cjs`、新增公共页服务模块、`api/index.js`、`scripts/dev-server.cjs`、`scripts/write-html.cjs`、`vercel.json`。
- 验收：关闭 JS 仍可读标题/介绍/图片/作品链接；刷新详情正常；未知 ID 返回 404；匿名完整图纸仍 401；登录后载入、下载、配色用量正常。

### 阶段 2：索引与图片分享

- 每页唯一 title / description / canonical；首页标题建议“拼豆图纸生成器｜图片转拼豆、MARD 配色与图纸编辑”。
- 作品标题建议“作品名 - 尺寸拼豆图纸｜产品名”；说明自然包含公开尺寸、颗数、色数及登录下载条件。
- 提供独立预览 PNG、width/height、alt、列表懒加载；首屏主图不盲目懒加载。
- 建立站点地图，只含公开有效作品和内容页；数据增长后分页或分 sitemap。lastmod 使用实际内容更新，不每天刷新伪造。
- 添加 robots 与非内容 API 的 noindex；预发布 noindex，仍保留鉴权。
- 添加符合正文的结构化数据，验证 JSON 与 HTML 转义；作者内容必须转义以防 HTML / JSON-LD 注入。
- 验收：canonical 与 sitemap 域名一致，图片直接 200，结构化数据无语法错，权限数据无泄漏，预发布不参与索引。

### 阶段 3：内容与 GEO

- 完成 2 篇原创教程、首页简短 FAQ、About / Privacy。
- 教程与工具 / 图纸相互链接；只为有实际内容的分类提供可索引页面，搜索词、排序组合不批量生成索引页。
- 中文先上线；英文页面内容准备完整后再做独立 URL、lang、hreflang。
- robots / CDN 规则区分搜索爬虫与训练爬虫；llms.txt 作为可选实验。
- 验收：内容准确描述登录权限、图片本地处理、服务器公开存储范围；无不可证实宣传，无隐藏关键词内容。

### 阶段 4：性能与效果复盘

- 公共页不加载 Three.js；编辑器按需加载 3D；评估压缩、文件指纹、缓存和服务端分页。
- 线上测量 LCP / INP / CLS；目标 p75 LCP <= 2.5s、INP <= 200ms、CLS <= 0.1，以真实样本为准，样本不足时用实验室结果注明范围。
- 管理员统计增加 landing path、粗粒度来源分类，以及注册、载入、下载的成功转化；事件失败不影响编辑。
- 如已连接权限，接入 Search Console / Bing Webmaster Tools；未授权时提供 DNS 验证步骤，不自行更改 DNS。
- 上线后按周看索引、自然搜索曝光/点击、搜索及 AI 引荐访问、功能转化；4–8 周做初次复盘，收录与效果不作时间保证。
- AI 引荐访问不等于回答引用量；直接引用指标以平台可提供的数据为准，不把空 referrer 都算直接或 AI。

## 官方参考

- Google JavaScript SEO：推荐服务端 / 预渲染、独立可抓取 URL、真实状态码，避免以 hash 切换主要页面内容。
  https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics
- Google AI 搜索：仍适用 SEO 基础，内容需可索引且可展示摘要；没有额外 AI 专用文件或 schema 要求。
  https://developers.google.com/search/docs/appearance/ai-features
- OpenAI Crawlers：OAI-SearchBot 搜索抓取与 GPTBot 训练抓取分别控制。
  https://developers.openai.com/api/docs/bots
- Bing AI Performance：用于观察支持平台中的引用情况，与传统访问 / 点击统计不同。
  https://blogs.bing.com/webmaster/2026/2/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview/

## 推荐实施顺序

先做阶段 0–2，让公开内容有独立地址、可读 HTML 和正确索引信息；再做阶段 3 的教程与 GEO 内容；阶段 4 的基线在开始时采集，性能优化与效果复盘随后完成。本次只生成评审和计划，不改变网站行为，不部署。

## 实施进度（2026-10-20）

用户已配置 SITE_URL，接受首页为产品介绍、编辑器移到 `/editor`。本轮实现阶段 1–3 的核心代码：静态首页 / 两篇教程 / About / Privacy、共用公开页服务、真实分页与作品 URL、独立预览 PNG、meta / canonical / 分享信息 / 结构化数据、robots / 分页 sitemap、错误状态码与 Preview noindex、旧 hash 跳转、登录后的用量与载入下载、编辑器草稿及撤销保留、3D 按需加载。新增集市载入 / 下载成功事件使用现有统计表，无新迁移。

验证包括构建、服务端回归、HTML 转义及权限防泄漏测试、浏览器首页与编辑器检查。后续仍需：部署正式站；搜索平台验证与站点地图提交（用户稍后处理）；线上 CDN / 爬虫访问与 Core Web Vitals 基线及部署后复测；按周收录和 AI 引荐效果复盘。当前来源域名与新增成功事件可用于初步观察；landing path / 更细的渠道漏斗尚未增加，需独立设计统计迁移。未上线英文独立页面；未为不存在的运营联系信息编造内容；未修改 DNS 或上游站点。
