# 汐湾 · City Atlas

React + Three.js 的真实三维城市罗盘。山地、曲流、海岸、街区、桥梁和居民共享同一份世界数据；建筑来自实际 GLB 网格，不是平面贴图或临时拼接的方块房屋。

## 启动与验证

```sh
npm install
npm run dev -- --host 127.0.0.1
npm test
npm run lint
npm run build
```

浏览器端到端测试需要先运行开发服务器：

```sh
npx playwright install chromium
npm run test:e2e
```

开发服务器不在 5173 时，使用 `CITY_TEST_URL=http://127.0.0.1:5176 npm run test:e2e` 指定测试地址。

测试输出在本地 `artifacts/`（不提交）。`verification.json` 记录 WebGL 渲染器、绘制统计、GLB 请求、重复生成后的 GPU 资源数量和运行时错误。截图覆盖全景、建筑近景、旋转、夜晚、雨雪和移动端。macOS 测试使用 Metal 硬件加速，Linux CI 使用 SwiftShader 软件渲染。

## GitHub Pages

`.github/workflows/pages.yml` 在推送 `main` 或手动运行时自动发布。仓库的 Settings → Pages → Source 应选 **GitHub Actions**。工作流使用 Node 24，依次安装锁定依赖、lint、单元测试、生产构建、Chromium 冒烟测试，然后发布 `dist/`；不需要额外的部署密钥。

部署路径由 `actions/configure-pages` 自动读取，仓库站点 `/random-city/` 和自定义域名根目录都可使用。模型加载、Web Worker、主页链接、图标和 OG 图片均跟随部署路径；种子和实现版本继续使用查询参数，刷新无需服务器路由回退。实现遵循 [GitHub Pages 自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) 和 [Vite Pages 部署说明](https://vite.dev/guide/static-deploy.html#github-pages)。

本地验证与 Pages 相同的生产子路径：

```sh
VITE_SITE_URL=https://catsjuice.github.io/random-city/ npm run build
npm run test:pages
```

测试自动在 `127.0.0.1:4174/random-city/` 启动预览并在结束后关闭。也可设置 `CITY_PAGES_TEST_URL` 为线上完整地址来验证实际部署。检查包含两种实现、模型请求、画布像素、手机布局、版本刷新恢复、主页链接、OG 图片及图标。

`artifacts/random-layouts/comparison.png` 是六个不同种子通过真实生成按钮产生的画布俯视对比。纯数据回归另检查 100 个种子的水陆轮廓、海岸方向、山峰数量与位置、桥梁数量、路网规模和公园选址，防止退回“固定布局里随机摆放素材”。

## 操作

- 设置面板默认收起，可从右上角展开。
- 右上角的实现模型选择器在 **GPT-5.6 Astra**（当前三维实现）与 **GPT-5.5**（早期 Canvas 纯绘制版）之间切换。这里是两个本地实现版本的标签，不会调用或切换在线模型 API。地址栏 `model=gpt-5.5` 可直接打开旧版，默认是 `astra`。旧版为固定等距投影，建筑、道路和人车均由绘图指令生成，不加载图片素材；支持拖拽平移、滚轮和双指缩放，不支持三维旋转。以下三维视角和地图尺寸说明适用于 Astra。
- 左键拖动旋转，右键拖动平移，滚轮缩放；底部工具栏可切换左键为平移。
- 触屏单指旋转，双指平移或捏合缩放。
- 可以切换俯视地图、复位、自动环绕、导出画布截图。
- 地图种子决定布局；同一种子与密度可复现。密度修改后点击“生成城市”应用。
- 罗盘尺寸支持 120×120、180×180、240×240。修改后点击“生成城市”，扩大的是实际地形和街区范围，建筑、道路和人物保持原尺寸。种子与尺寸会保存在地址栏。
- 时间滑块控制昼夜；暂停停止时间、水面、摩天轮、人车、船只、灯塔扫光与天气粒子。天气变化的表面过渡仍会完成。系统开启减少动态效果时默认暂停，可手动继续。
- 山间步道从可达城区连接到观景平台，带台阶、护栏、矮灯和登山者。船只沿预计算水路巡航，带尾流和航行灯；狭窄水域不强行放入帆船。

## 实现结构

| 文件                    | 职责                                                                           |
| ----------------------- | ------------------------------------------------------------------------------ |
| `src/city/geography.js` | 参数化海岸、曲流、交汇河网、湖泊、岛屿、山峰以及统一水陆距离场                 |
| `src/city/world.js`     | 地理约束下的候选路网、连通骨架、按需跨水桥梁、街区与地标选址、人车路径         |
| `src/city/world.worker.js` | 在 Web Worker 内生成地形数据、街区和导航路径，支持取消旧任务                |
| `src/city/routes.js`    | 基于 PathFinding.js 的陆地与水域寻路、山路规划和船只闭合巡航路线              |
| `src/city/lighting.js`  | 批量灯芯光晕、随车前后灯、路面光斑和静态局部照明场                          |
| `src/city/landscape.js` | 根据水陆距离场裁剪连续地形、实体底座、任意岸线、滨水步道、动态水面             |
| `src/city/streets.js`   | 道路、路口、坡道、拱桥、高架、斑马线、护栏、路灯与信号灯                       |
| `src/city/assets.js`    | GLB 加载缓存、原始调色纹理采样、顶点颜色、窗光与积雪材质                       |
| `src/city/renderer.js`  | Three.js 生命周期、OrbitControls、静态合批、自然物实例、车辆和行人、昼夜与天气 |
| `src/city/details.js`   | 公园喷泉、长椅、灯塔、码头、帆船和摩天轮                                       |
| `src/city/geometry.js`  | 静态几何合并、连续路径带状网格                                                 |
| `src/App.jsx`           | React 控制界面、加载与错误状态                                                 |
| `src/implementations.js` | 两个实现入口的按需加载与版本标签                                               |
| `src/legacy/canvas-renderer.js` | 早期 Canvas 绘制版的生命周期、拖拽缩放、模拟时钟与界面适配                  |
| `src/cityEngine.js`     | 原样保留的等距城市生成与纯 Canvas 绘制引擎                                     |

建筑先通过地块和路网约束，再按源模型的实际包围盒缩放。建筑及院落细节合并为静态网格；同类树木和车辆使用实例绘制。桥属于路网的一条边，桥面、护栏和人车都调用相同的高程函数。重新生成时释放旧场景 GPU 资源，并复用已加载的源模型。

夜景不是单纯降低环境光：道路、桥梁、公园、码头和山路灯具都有批量光晕，静态照明场同时照亮道路和附近立面；车头灯与尾灯跟随车辆姿态。灯塔使用可见灯室、旋转光束以及真实 SpotLight 水面照明。为了控制开销，不给每根灯柱单独创建点光源或阴影贴图。最大地图的移动汽车上限为 120 辆、街道居民为 180 人，山路登山者另计。

`tests/life.spec.mjs` 验证夜间画布像素、船只与登山者移动/暂停、灯塔旋转、尺寸切换与 URL 保存、重复生成的 GPU 资源数量、桌面帧时间和移动端。截图和实测帧时间位于 `artifacts/living-city/`，性能结果只代表运行测试的设备。纯数据测试检查航线避开陆地、码头及整座桥梁范围，循环连续且不瞬移；目前未模拟船只互相避让或穿桥通航。

地理先于城市生成。种子选择地理条件组合并确定连续参数：海岸可以位于任意方向或不存在，河流可以穿越全图或交汇，湖泊与岛屿有不同数量和形状，山峰可位于不同象限或完全不存在。它们不是预制地图。道路避开水域和山体，以连通骨架加可选环路形成街区；跨水连接可斜向架桥，桥梁数量由可行路径决定。公园、摩天轮、灯塔和码头从可用地块或岸线选址，不要求每张地图都出现所有地标。

原始 PNG 调色板并没有贴到地板上：加载 GLB 时读取其 UV，在模型自带的调色纹理中采样为顶点颜色。这些模型使用色带贴图而非照片纹理，转换可保留原始颜色分区，同时统一批次与天气材质。窗光按源调色区域和竖直玻璃面的几何条件生成遮罩。

## 素材与范围

模型来自 Kenney，CC0；各包许可保存在 `public/models/*/License.txt`：

- [City Kit Suburban 2.0](https://kenney.nl/assets/city-kit-suburban)
- [City Kit Commercial 2.1](https://kenney.nl/assets/city-kit-commercial)
- [Car Kit](https://kenney.nl/assets/car-kit)
- [Nature Kit](https://kenney.nl/assets/nature-kit)

此前的 `src/townscape3d.js`、`src/cityEngine.js` 和 `public/assets/` 保留。GPT-5.5 现在加载的是 `cityEngine.js`，不再是后来使用插画精灵的 `townscape3d.js`；图片版兼容层 `src/legacy/renderer.js` 仅保留存档，不参与当前入口。旧版没有的密度、地图尺寸、俯视和旋转控件不显示。适配层提供模拟暂停、时间流速、天气切换和截图导出，绘图逻辑不变；运行时最多重绘 30 帧/秒，暂停时仅在交互或设置变化后重绘。切换时清理画布、动画循环和监听器；退出 Astra 时释放其 WebGL 资源。

两个存档文件均保持原内容：`cityEngine.js` 的 SHA-256 为 `a27e2de8c86e59328108a38caab3de4f7901eca3bb640c0f7654615ff90a48a4`，`townscape3d.js` 为 `0bb30f515a0c7984de42926a0c49702e8e5604f10a51aaf3cf96990d3a006a68`。这恢复的是工作区保留下来的早期绘制版，而非凭空重建一个旧版外观。

## 分享图片

分享封面为 `public/og-image.png`（1737×905），使用内置图像生成工具、以实际城市截图为参考生成。生成提示词和来源见 `docs/og-image.md`。`index.html` 已包含 Open Graph 和 Twitter large-image 元数据。

开发服务器自动使用本地 origin 拼出图片绝对地址。部署时设置 `VITE_SITE_URL` 为正式站点完整 URL（含子路径）再构建；`VITE_BASE_PATH` 可单独覆盖资源路径。未设置站点 URL 时保留相对于站点根目录的图片路径，不猜测正式域名。Pages 工作流自动填充这两个变量；示例见 `.env.example`。

`tests/implementations.spec.mjs` 检查默认收起、来回切换、两个原文件校验和、Canvas 2D 上下文、禁用图片与模型请求后的旧版运行、持续动画与暂停、天气和截图导出、触屏平移缩放、返回 Astra 后的资源数量、手机布局、版本刷新恢复及 OG 图像尺寸。

当前是有道路交通和时间天气的低多边形城市展示，不是完整交通规划仿真。普通道路仍以变化的正交街区为基础，桥梁可以斜向连接；尚未实现任意曲线街道。没有实现 Townscaper 的不规则网格、邻接驱动网格变形或私有构件规则，也没有宣称达到参考插画的手绘材质和细节密度。

验收要求见 `docs/rebuild-requirements.md`。
