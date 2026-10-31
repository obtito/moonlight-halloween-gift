// Canvas labels and structured model-import errors share the page's locale.
export const extraMessages = {
  "ja": {
    "extra.world.canvasLabel": "月明かりの3Dステージ。ドラッグで視点を回転できます",
    "extra.world.cardMotto": "今日に、ちょっとした楽しみを",
    "extra.model.cancelled": "前のモデル読み込みをキャンセルしました。",
    "extra.model.compressed": "圧縮されたモデルです。テクスチャを埋め込んだ非圧縮のGLBに書き出してから読み込んでください。",
    "extra.model.loadFailed": "モデルを読み込めませんでした。元のモデルはそのまま残っています。",
    "extra.model.invalidParent": "モデルの配置先にはThree.jsのObject3Dが必要です。",
    "extra.model.closed": "モデルの配置先はすでに閉じられています。",
    "extra.model.noScene": "このファイルには表示できるシーンがありません。",
    "extra.model.noMesh": "このモデルには表示できる3Dメッシュがありません。",
    "extra.model.selectFile": "GLBモデルファイルを選んでください。",
    "extra.model.glbOnly": "ローカル読み込みはGLBのみ対応しています。glTF、テクスチャ、バイナリを1つのGLBにまとめて書き出してください。",
    "extra.model.urlRequired": "モデルのURLを指定してください。",
    "extra.model.unknownJoint": "この関節コントロールは見つかりません。",
    "extra.model.importFirst": "先にボーン付きのGLBモデルを読み込んでください。",
    "extra.model.missingBone": "選択したボーンが見つかりません。",
    "extra.model.boneInUse": "このボーンは別の関節に割り当てられています。元の割り当てを解除してください。"
  },
  "zh": {
    "extra.world.canvasLabel": "月下舞台，拖动可旋转视角",
    "extra.world.cardMotto": "愿今天有一点小惊喜",
    "extra.model.cancelled": "已取消较早的模型加载。",
    "extra.model.compressed": "此模型使用了压缩扩展，请先导出为未压缩、贴图内嵌的 GLB 后再导入。",
    "extra.model.loadFailed": "模型加载失败，原有模型已保留。",
    "extra.model.invalidParent": "模型预留位需要 Three.js Object3D 父节点。",
    "extra.model.closed": "模型预留位已关闭。",
    "extra.model.noScene": "文件中没有可显示的场景。",
    "extra.model.noMesh": "模型没有可显示的三维网格。",
    "extra.model.selectFile": "请选择一个 GLB 模型文件。",
    "extra.model.glbOnly": "本地导入仅支持 GLB。请将 glTF 及其贴图、二进制文件打包导出为一个 GLB 后再导入。",
    "extra.model.urlRequired": "请提供模型地址。",
    "extra.model.unknownJoint": "未知的关节控制项。",
    "extra.model.importFirst": "请先导入带骨骼的 GLB 模型。",
    "extra.model.missingBone": "所选骨骼不存在。",
    "extra.model.boneInUse": "该骨骼已用于另一个关节，请先取消原有对应关系。"
  }
};
