# 图层操作

全部操作送往 `pixso_patch`，同时传 `scopeToken` 和最新 `expectedRevision`。声明式数据不支持脚本。

```json
{
  "scopeToken": "由 pixso_begin 返回",
  "expectedRevision": "由 pixso_read 返回",
  "projectRoot": "包含已确认映射的项目绝对路径",
  "operations": [
    { "op": "update", "nodeId": "真实文字ID", "props": { "text": "前往会话" } },
    { "op": "clone", "key": "taskList", "sourceId": "已有表格的真实ID", "parentId": "目标容器ID", "props": { "name": "AI任务记录", "x": 40, "y": 120 } },
    { "op": "instance", "key": "button", "componentId": "已映射的真实组件ID", "semantic": "button", "parentId": "目标容器ID", "props": { "x": 160, "y": 24 } }
  ]
}
```

每个新节点有唯一 key；同批后续操作可以用 `$key` 引用它。每次调用间用返回的 `created` 中真实 ID，不跨批沿用 `$key`。

支持 insert 的 kind 为 frame、text、rectangle；支持 props 包括 name、text、x/y、width/height、visible、opacity、fill/stroke（六位HEX）、strokeWeight、cornerRadius、fontName（family/style）、fontSize、textAutoResize、textAlignHorizontal、layoutMode、paddingLeft/Right/Top/Bottom、itemSpacing、clipsContent。

自动布局会重新计算子节点位置或尺寸。先读取布局模式，优先调整容器布局属性；明确尺寸可能被 native 自动布局覆盖。写后实际值不匹配会判为失败并尝试恢复，不返回虚假成功。原有混合字体文字需保留样式；不支持的混合样式更新应改为新建单独文字层并隐藏旧层，且仅在需求允许时进行。

基础文字默认 Noto Sans SC，若公司规范指定其他字体，先在 Pixso 确认可用再指定 fontName。截图检查后再报告交付。

实例化必须提供 projectRoot 和 semantic，服务会核对配置中的设计文档名、组件ID与真实组件名；缺少映射时拒绝创建实例。已有组件主定义只读，避免通过组件联动修改目标页面以外的实例。混合字体范围参与快照比较，第一版不直接改写混合样式文字。
