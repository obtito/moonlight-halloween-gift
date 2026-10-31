# 月下邀约

[打开万圣节网站](https://obtito.github.io/moonlight-halloween-gift/)

Three.js＋Vite 万圣节礼物网站，包含月下舞台、邀请与祝福卡、星尘、烟花演出和南瓜彩蛋。当前礼物版本不展示角色、占位卡牌或等待模型的提示，编舞入口已收起；模型导入和关键帧工具保留在源码中供以后使用。

## 本地运行

建议使用 Node.js 22.12 或更高版本。在项目目录依次运行：

```sh
npm install
npm run dev
```

打开终端显示的本地地址。验证和构建：

```sh
npm test
npm run build
npm run preview
```

构建结果在 `dist/`，可交给支持静态文件的网站托管服务。请通过开发服务器或预览服务器访问，不要直接双击 `index.html`。

## 修改礼物文字

编辑 `src/gift-config.js` 的 `locales.ja`、`locales.zh`，分别设置日文和中文礼物内容：

- `recipient`：收信人的称呼。
- `invitationRecipient`：预告函上的称呼，日文默认「友だちへ」。
- `title`：首屏标题，`\n` 表示换行。
- `letter`：祝福内容，数组中的空字符串表示分段。
- `model.url`：角色模型地址；空字符串表示保留空舞台。
- `model.boneMapping`：为已知模型设置固定骨骼对应关系。

配置中的文字按普通文本显示。页面首次访问默认日文；右上角可切换「日本語 / 中文」，祝福信中也有语言按钮。选择保存在当前浏览器，切换不会刷新页面或重置模型、编舞、关节角度和过场进度。手机进入舞台后，语言按钮移至右下角。旧版本保存的英文偏好会回退为日文。

其他文案分别位于 `src/locales-static.js`、`src/locales-dynamic.js` 和 `src/locales-extra.js`，三份字典都包含 `ja / zh`。静态文本使用 `data-i18n` 标记，动态消息通过 `src/i18n.js` 更新，模型导入错误与 3D 卡牌文字也会随语言切换。`public/credits.html` 使用独立的双语文案，并共享语言偏好。

## 放入自己的 GLB 模型

把单文件模型放到 `public/models/kid.glb`，然后在配置里填写：

```js
model: {
  url: '/models/kid.glb',
  boneMapping: {},
},
```

模型会自动居中、落地，并按 3.4 个舞台单位的高度缩放。推荐内嵌贴图、未压缩的 GLB；当前未配置 Draco、Meshopt 或 KTX2 解码器。本地上传不支持带外部贴图和二进制文件的 `.gltf`。

也可以打开右上角「编舞室」，点击「选择 GLB 模型」进行临时预览。文件只在当前浏览器页面中读取，不会上传、保存或随分享链接提供给别人；刷新后需要重新选择。要让收礼人看到模型，应把 GLB 放进项目并重新构建、发布。

## 关节与编舞

静态模型可以旋转观看和整体转向；手臂、头部和腿部的动作需要带骨骼的角色模型。项目会尝试识别常见骨骼名，也可以在「骨骼与关节对应」中手动选择，每根骨骼只对应一个控制项。

| 配置键 | 控制项 |
| --- | --- |
| `body` | 身体转向，未指定骨骼时整体转向 |
| `head` | 头部侧倾 |
| `la` / `ra` | 左臂 / 右臂 |
| `le` / `re` | 左肘 / 右肘 |
| `ll` / `rl` | 左腿 / 右腿 |

手动映射只处理骨骼对应，不会自动修正任意模型的本地旋转轴，也不是完整的舞蹈重定向系统。若动作方向不合适，应在建模软件中统一骨架方向，或适配 `src/model-slot.js` 的关节轴约定。

编排步骤：

1. 选择一个关键帧，拖动 8 个关节滑块；修改会写回选中的帧。
2. 点击「添加关键帧」复制当前姿势，继续编辑；也可以用「致意」「展臂」「舞步」「站姿」作为起点。
3. 设置相邻姿势间的「每段时长」、播放速度与是否循环。循环模式包含末帧返回首帧的过渡。
4. 播放、暂停或拖动时间线预览；「停止」回到开头。至少两个关键帧才能播放，最多保留 200 帧。
5. 「保存到本机」写入当前浏览器的本地存储；「导出 JSON」可备份和迁移，「导入」可恢复。兼容旧原型的 version 1 JSON，省略的速度和循环设置分别默认为 1 和开启。

本机保存只保存动作，不包含模型文件和手动骨骼映射。需要固定映射时，把界面中显示的骨骼名写入 `gift-config.js` 的 `model.boneMapping`。不同网站地址之间的本地存储互不共享，迁移时使用 JSON 文件。

## 舞台与访问

- 拆信转场结束后，自动播放约 18 秒的万圣节烟花：烟花从舞台升空，在金、粉、蓝、紫、青绿和橙色火花中绽放，再拖尾落下。尾声的最后一枚烟花在约 11.5 秒时炸开，火花同时向外飞成两行英文「HAPPY HALLOWEEN」的形状，随后受重力拖尾散落，18 秒后烟花散去并停留在舞台。字形烟花与舞台共用场景及相机，手机使用较少粒子。烟花、灯光和进度共用现有 Three.js 场景、相机与动画循环；可以直接揭晓，也可以按 Escape 回到舞台。「再放一次烟花」可重播。页面隐藏时暂停，回来后继续；系统减少动态效果时直接显示舞台。
- 烟花结束后停留在舞台，不再自动弹出结尾卡片。朋友间的节日祝福仍可从页面按钮手动打开，落款为 cyt；烟花和花瓣登场均可重播，日本语和中文切换不会重置进度。
- 7 个南瓜分别触发：掉糖果、轻跳、灯笼发光、摇摆、粉色星星、月光光环、紫色小烟花。直接点击对应南瓜即可触发，均不弹卡片；「南瓜的小秘密」按钮可依次体验全部效果，提供键盘和手机入口。互动共用现有时钟，重播登场或烟花时自动复位；减少动态效果时以静态光效替代跳跃和摇摆。
- 本版本为静音烟花，不播放爆炸声、升空声或背景音乐。
- 首屏只显示居中的横向日文「予告状」，舞台和页面文字先隐藏。点击位置会成为消散起点，卡片由此向外化作微卷、带细小缺口的象牙白与淡粉花瓣。随后远处舞台显露，镜头沿固定视线平顺推进，约 6.4 秒后停在主舞台并显示页面文字。没有切换机位、绕场、倾斜或镜头变焦。开场由现有动画循环推进，可以跳过或重播；减少动态效果时直接亮灯。键盘触发和重播时从卡片中心散开。
- 导航中的「一封给你的信」可直接打开祝福；动画中进入编舞室会结束开场，恢复舞台操作。重复点击不会叠加动画，GLB 加载与访客开场分别控制。
- 角色、舞台、粒子共用一个 Three.js 场景、相机、渲染器和动画循环；编舞只更新角色姿势。
- 万圣节布景包含七只沿独立弧线飞行的蝙蝠、五支有蜡泪和暖色火焰的蜡烛、一座带小蜘蛛的银色蛛网架、舞台外缘的薄雾，以及两只小幽灵。两只幽灵在舞台侧后方轻轻漂浮，具有编织布纹、垂坠褶皱、卷边下摆与带厚度的眼口开孔，布料下摆随之起伏。`src/bats.js`、`src/halloween-atmosphere.js`、`src/halloween-candles.js`、`src/halloween-companions.js` 使用现有场景与动画循环；蝙蝠具有细长立体身体、弯曲翼膜、回程收翼和随轨迹倾侧的姿态；减少动态效果时冻结角色与氛围动效。角色中央位置保持空出。
- 「保存舞台图片」导出 3D 画布的 PNG，不包含页面文字、编舞面板或祝福弹窗。
- 开启系统的「减少动态效果」后，舞台使用更克制的动效。
- GitHub Pages 网站面向外部访客开放，不需要登录 ChatGPT。

## 代码与效果来源

网站标志使用 DaniDF1995 的 [Kaito Kid signature](https://commons.wikimedia.org/wiki/File:Kaito_Kid_signature.svg)，采用 [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) 许可。文件位于 `public/branding/kaito-kid.svg`，增加了自适应 viewBox，通过 CSS 蒙版呈银白色；公开署名见 `public/credits.html`。

编舞状态逻辑沿用并修正用户已有原型。邀请函、舞台和当前光效为本项目实现。之前讨论的 GitHub 光效项目是视觉和实现思路参考，未克隆其代码，也未把它们全部安装为依赖。

花瓣过场参考 [Sakura Realm 的实例化花瓣](https://github.com/Leonxlnx/sakura-realm/blob/main/src/tree/petals.js) 的翻转与飘动思路；镜头参考 [camera-controls](https://github.com/yomotsu/camera-controls) 的平滑推进与目标点控制，两者均为 MIT 项目。本项目保留现有 OrbitControls，自行实现花瓣材质和定时镜头，不额外安装这两套项目。`src/cinematic-camera.js` 可调整推进距离与时长，`src/entrance-particles.js` 可调整花瓣轮廓、数量和飘动。

南瓜使用本项目生成的瓜皮颜色、凹凸、粗糙度和瓜梗纹理，文件在 `public/textures/pumpkin/`。程序会共享贴图，并在两套颜色纹理间交替，以减少重复感。若需重新生成这些素材，可在已安装 NumPy 和 Pillow 的 Python 环境中运行 `python3 scripts/generate-pumpkin-textures.py`；网站运行和构建不需要 Python。

月亮使用 NASA's Scientific Visualization Studio 的 [CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/)：2K LROC 月面颜色贴图与 1K LOLA 地形高度贴图，原图保存在 `public/textures/moon/`，详细来源见该目录的 `SOURCES.txt`。`src/moon.js` 将其映射到球体，加入轻微地形凹凸、月壤散射、固定太阳方向和薄雾融合；不受舞台粉色灯光影响。月相为美术设定，并非实时天文月相。署名同时保留在网站素材页。

本项目直接依赖 [Three.js](https://github.com/mrdoob/three.js) 和 [Vite](https://github.com/vitejs/vite)，两者均为 MIT 许可；分发时保留依赖许可。另行加入的模型、动作、贴图和音乐需遵循各自的使用条件。

后续效果参考：[发光溶解](https://github.com/JatinChopra/emissive-dissolve-effect)、[按钮粒子](https://github.com/codrops/ParticleEffectsButtons)、[三维光轨](https://github.com/Alchemist0823/three.quarks)、[粒子形态变化](https://github.com/MisterPrada/morph-particles)。

文字形状烟花的视觉流程参考 [GrandFireworks](https://github.com/travisjmac/grand-fireworks-js) 与 [Cyber Fireworks](https://github.com/athenazhang-junzi/cyberfirework)；本项目使用自有 Three.js 粒子与共享时钟实现。

## GitHub Pages 发布

仓库的 Settings → Pages → Source 设为 GitHub Actions。推送到 main 后，工作流会依次安装依赖、运行测试、构建并发布 dist/。

访问地址：https://obtito.github.io/moonlight-halloween-gift/ 。Vite base 已设为 /moonlight-halloween-gift/，月面贴图、南瓜纹理、Logo 和素材署名链接均沿用该子路径。
