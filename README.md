# 北斗拼装台 · 独立网页

从 `Alumos/chinacore-learning-sheet` 的 `site/beidou/` 提取的独立项目。打开网站根路径 `/` 就是北斗拼装台，保留九组件拼装、导航与救援演示、音效、全屏、任务指南及本机进度保存。

项目是 HTML、CSS、原生 JavaScript 和 Canvas 2D 构成的静态网页，没有 npm 依赖、构建步骤、后端或数据库。所有运行素材都在 `site/assets/`，运行不需要访问中国芯、高小铁或第三方 CDN。

## 本地预览

在本项目目录执行：

```bash
python3 -m http.server 18083 --bind 127.0.0.1 --directory site
```

浏览器打开 <http://localhost:18083/>。原子钟实验任务已移除。音效默认开启，首次操作时由浏览器启用音频。

## 后续修改的位置

| 文件 | 职责 |
| --- | --- |
| `site/index.html` | 页面结构、标题、指南、来源说明与备案链接 |
| `site/style.css` | 页面样式、布局、移动端适配 |
| `site/game.js` | 页面交互、拖放与点击安装、音效、素材加载、本机保存、动画调度 |
| `site/engine.js` | 九个组件定义、轨道参数、拼装规则、运行状态与救援进度 |
| `site/scene.js` | 系统场景、轨道、信号链路与救援动画的 Canvas 绘制 |
| `site/clock-model.js` | 原子钟模型历史源码，当前页面不加载 |
| `site/clock-scene.js` | 原子钟场景历史源码，当前页面不加载 |
| `site/assets/` | 组件 SVG、地球图片、素材文件映射 |

脚本按 `index.html` 中的顺序加载，通过 `window.BeidouEngine`、`window.BeidouScene` 协作。更换组件图片时可编辑 `assets/asset-map.js` 中的 `window.BEIDOU_ASSET_FILES`，键对应 `engine.js` 中组件的 `file` 字段。

## 独立部署

**静态网站：** 将 `site/` 内的所有文件上传到网站根目录，入口为 `index.html`，保留素材相对目录结构即可。也可以放在一个子目录中部署。

**Docker / 1Panel：** 上传整个项目，在项目目录执行：

```bash
docker compose -f compose.build.yaml up -d --build
```

容器服务名为 `beidou`，宿主机端口为 **18082**，可修改 Compose 中的端口。1Panel 中将独立域名反向代理到宿主机的 `18082` 端口并配置 HTTPS。如果代理也在容器中，需要使用能够访问宿主机的地址。健康检查地址为 `/healthz`。

上述命令直接从源码构建，不使用原学习单的镜像标签，也不需要 `CLASSROOM_URL`、`SEARCH_URL` 或 `config.js`。修改源码后重新运行上述构建命令即可更新容器。

### 使用 GitHub Actions 发布的镜像

推送 `main` 后，GitHub Actions 会先检查静态资源，再构建 `linux/amd64` 镜像并发布到 GHCR：

```text
ghcr.io/alumos/beidou-assembly-lab:latest
```

VPS 上可以直接使用项目中的 `compose.yaml`：

```bash
docker compose up -d
```

它默认将容器的 80 端口映射为外部 `18082` 端口。部署后先确认 `http://127.0.0.1:18082/healthz` 返回 `ok`，再把域名反向代理到该端口。镜像更新时再次执行 `docker compose pull && docker compose up -d`。

## 提取说明与数据

原项目的 `site/index.html`、`app.js`、`styles.css`、`config.js` 构成三站学习单，北斗原来通过 iframe 加载 `/beidou/`；另外两站分别指向 `https://fxh.alumos.cn/`、`https://chinacore.alumos.cn/join`。

本项目将原 `site/beidou/` 的运行文件完整复制为独立的 `site/`。提取后已针对课堂拼装调整为浅色大地图布局，加入地图内操作栏、拖放结果提示、安装脉冲、地球自转和更醒目的流动箭头；原子钟实验任务已移除。外层学习单导航、学习记录表单和 Markdown 下载功能不属于本项目。原聚合仓库保留在同级 `chinacore-learning-sheet/` 目录中。

拼装进度使用浏览器 `localStorage`，键为 `beidou-assembly-game-v2`。更换域名或端口后是新的浏览器存储来源，旧网站进度不会自动迁移；同一来源下的原 `/beidou/` 与新 `/` 会共用该键。清理浏览器数据会清除进度。

素材来源、科学依据和教学模拟边界保留在网页的“教学与素材来源”中。页面保留原备案链接；正式部署时在 `site/index.html` 中按对应域名的实际备案信息修改。

## 源码检查

需要 Python 3 和 Node.js，在项目目录执行：

```bash
python3 scripts/check-assets.py
```

检查所有 JavaScript 语法、HTML 本地文件引用，以及运行时加载的组件和地球素材。


## 课堂界面与浏览器兼容

- 页头压缩为一行，地图为主操作区；导航启动、暂停、提示和重新拼装集中在地图面板内。
- 放错时显示地图内文字提示和红色标记；正确安装有绿色反馈与组件脉冲。当一条链路的两端都已安装，信号箭头立即开始流动。
- 地球使用本地 `earth-texture.jpg` 和 Canvas 2D 生成旋转球面，每秒更新最多 12 次。投影与光照预计算，不依赖 WebGL；若像素读取失败则回退到静态地球。
- 顶部“动画开 / 关”可以暂停或开启动态演示。默认尊重系统的减少动态效果设置，学生可手动开启以观察信号传输。
- 使用普通路径代替 `Canvas.roundRect()`，去掉可选链、空值合并、逻辑赋值、对象展开语法及 `Object.fromEntries()`、`structuredClone()` 依赖；Canvas 透明颜色使用 `rgba()`。
- 没有 Pointer Events 时使用鼠标 / Touch Events；没有 ResizeObserver 时监听窗口并检查画布尺寸；没有原生 dialog 时使用自定义遮罩、关闭和焦点管理。
- CSS 使用固定 / vh 高度和 Grid 间距，不依赖 `aspect-ratio`、`dvh`、`clamp()` 或 Flex gap。仍要求支持 ES2017、Canvas 2D、CSS Grid 的浏览器，不支持 IE。

本机验证覆盖 Chrome 的桌面和触屏操作，以及主动移除上述新 API 后的兼容分支。该模拟检查不能代替实际旧版本浏览器或学校设备的验证。

可选的浏览器回归检查需要安装 Playwright，另需本机 Chrome 和已启动的预览服务：

```bash
node scripts/browser-smoke.cjs
```

可通过 `BEIDOU_CHROME_PATH` 指定 Chrome 路径，通过 `BEIDOU_TEST_URL` 指定预览地址。检查实际鼠标 / 触屏拖放、错误反馈、地图占比、动画像素变化、进度恢复与旧 API 降级；截图保存在忽略提交的 `artifacts/` 中。
