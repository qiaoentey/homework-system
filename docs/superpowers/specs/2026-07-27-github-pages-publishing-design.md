# GitHub Pages 免费发布设计

日期：2026-07-27

## 目标

把现有安亲班功课检查 PWA 发布到 GitHub Pages，让老师无需登录即可从手机打开固定网址：

`https://qiaoentey.github.io/homework-system/`

发布必须保持现有产品约束：

- 不向老师收费；
- 不要求老师登录；
- 学生照片与 OCR 结果只在当前装置处理；
- 不加入后端、分析追踪、广告或付费 AI；
- 1–3 年级十二份答案 PDF 与 1–6 年级数学检查保留在同一个网站；
- 首次下载 OCR 模型后继续支持离线使用。

## 第一性原理

手机能可靠使用这个网站，需要同时满足四件事：

1. 浏览器能从 GitHub Pages 的项目子路径加载应用与静态资源。
2. 刷新或重新打开功能页面时，静态主机不能把前端路由误判成不存在的文件。
3. Service Worker 的作用域、离线缓存、OCR 模型和 PDF 必须使用同一个部署基址。
4. 每次源码更新都必须经过测试和构建，成功后才替换线上版本。

因此，单纯把当前 `dist` 文件复制到 GitHub 不足以完成目标。

## 采用方案

### 仓库与网址

使用账号 `qiaoentey` 下现有的空白公开仓库：

`qiaoentey/homework-system`

使用项目型 GitHub Pages，固定部署基址为：

`/homework-system/`

不建立 `qiaoentey.github.io` 用户主页仓库，保留该唯一主页位置供未来其他用途。

### 路由

内部页面改用 hash 路由：

- 首页：`/homework-system/`
- 答案库：`/homework-system/#/answers`
- 数学检查：`/homework-system/#/scan`

hash 不会作为 HTTP 路径发送给 GitHub Pages，因此直接打开、刷新和分享功能页面时始终请求同一个真实 `index.html`，不依赖脆弱的 404 转址。

应用的逻辑路由类型仍维持 `/`、`/answers`、`/scan`，仅由一个小型路由边界负责在 URL hash 与逻辑路由之间转换。

### 静态资源

所有本地资源从 Vite 的部署基址产生 URL，不再假设网站位于域名根目录：

- 十二份答案 PDF；
- OCR worker、语言模型和 WASM 核心；
- manifest 与安装图标；
- JavaScript、CSS 和图片；
- Service Worker 注册与 OCR runtime cache 路由。

本机开发与测试默认基址仍为 `/`。GitHub Actions 构建时明确传入 `/homework-system/`，避免影响现有本机测试和未来迁移。

Web App Manifest 使用相对的 `start_url`、`scope` 和图标路径，使安装后的 PWA 保持在项目目录内。

### Service Worker 与离线

Service Worker 根据构建时基址识别：

- 应用 shell；
- OCR 资源目录；
- PDF 与其他预缓存资源。

hash 页面都由同一个应用 shell 提供，不需要为 `/scan` 或 `/answers` 建立服务器端文件。现有等待更新、老师确认、一次重载和旧 OCR 缓存清理逻辑保持不变。

### GitHub Actions

新增独立 Pages 工作流：

1. `main` 更新且应用或 Pages 配置改变时触发；
2. 锁定安装 `package-lock.json` 中的依赖；
3. 执行单元测试；
4. 使用 `/homework-system/` 基址建立生产版本；
5. 检查输出没有错误的根路径资源；
6. 上传 `dist` 为 Pages artifact；
7. 仅在前面步骤成功后部署到 `github-pages` 环境。

工作流使用 GitHub 官方 Pages actions，并声明最小权限：

- `contents: read`
- `pages: write`
- `id-token: write`

现有完整 CI 继续负责依赖审计与 Chromium/WebKit 浏览器测试。Pages 工作流不绕过这些发布前质量门槛。

## 测试设计

实施采用测试先行，并覆盖：

1. hash 与逻辑路由双向转换；
2. 部署基址下的 PDF、OCR、manifest 和图标 URL；
3. Service Worker 只匹配部署基址内的 OCR 资源；
4. 用 `/homework-system/` 构建后，HTML、manifest、Service Worker 和预缓存清单都不泄漏错误的根路径；
5. Playwright 从项目基址打开首页、答案库与数学检查；
6. 项目基址下完成真实 OCR worker、PDF、离线和 PWA 更新验证；
7. 本机根路径模式保持现有测试全部通过。

最终发布后再从公网验证：

- 首页返回成功；
- 十二份 PDF 可打开；
- OCR worker 与模型只从同一 GitHub Pages 域名读取；
- 手机尺寸下可进入两个主要功能；
- 页面没有把学生照片或 OCR 文字发往网络。

## 错误处理与回滚

- 构建、测试或 Pages 部署失败时，GitHub 保留上一版可用网站。
- GitHub Actions 日志用于定位依赖、基址或部署问题。
- 每次发布对应一个 Git commit；如线上版本异常，可重新部署最后一个已验证提交。
- 不把 GitHub token、照片、OCR 输出或其他敏感数据写入仓库和 Actions artifact。

## 公开范围与限制

公开仓库会让源码、答案索引 PDF、测试样本和离线 OCR 运行文件对所有人可见。学生实际作业照片不会进入仓库或 GitHub Pages。

GitHub Pages 是静态托管，不能运行服务器端 AI；本项目原本就是浏览器本机 OCR 与规则检查，因此不需要服务器。

实体 iPhone/Safari 与 Android/Chrome 的最终安装和更新检查仍是发布验收门槛，不能仅以桌面模拟器代替。
