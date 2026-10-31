此目录默认不包含角色模型，舞台位置已预留。

要固定展示自己的模型：
1. 把贴图内嵌、未压缩的单文件 GLB 放到这里，命名为 kid.glb。
2. 在 src/gift-config.js 中设置 model.url 为 '/models/kid.glb'。
3. 如需固定骨骼对应，在 model.boneMapping 中填写界面显示的骨骼名。
4. 重新运行 npm run build，再发布构建结果。

编舞室中的本地 GLB 选择仅用于当前页面预览，不会上传、持久保存或自动提供给其他访问者。
静态模型能展示和整体转向；关节动作需要带骨骼的模型和适合的旋转轴。
当前未配置 Draco、Meshopt 或 KTX2 解码器；请优先导出未压缩 GLB。

更多运行、编舞和 JSON 备份说明见项目根目录 README.md。
