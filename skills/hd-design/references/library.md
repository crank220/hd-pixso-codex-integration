# 内置 Ant Design Vue 资产目录

使用用户指定的 **Ant Design Vue (Community)** 文件：`cqyV7EPRujL6ptWDBKKlSQ`。封面声明 **4.2.3**；这是 UI kit 的版本声明，不能自动证明它与项目安装的每个 API 相符。源组件及主定义只读，不自动发布团队库。

## 覆盖与查找

`pixso_library()` 离线检索全部 **87 页、1013 个组件族、5007 个组件及变体**，含 Icon 页的独立组件。目录记录所有页面；Thumbnail、Overview、Color、Flex、Grid、Layout、Affix、ConfigProvider、App 等无主组件页面作为参考，分类分隔页保留记录但不算组件。

- `pixso_library({page:"Button"})` 找组件族；`page` 不需要原页面名中的缩进空格。
- `pixso_library({familyId:"144:5014",offset:0,limit:20})` 读取属性定义和分页变体。属性名、大小写和值以返回数据为准，不能把另一套 Ant Design 库的命名套过来。
- 全页索引不需要扫描整页快照；Form、DatePicker 等大页面应按具体组件族处理，避免超过快照上限。

目录随 ZIP 分发，包含真实 key、来源、原节点、属性与尺寸，不包含完整画布几何、业务设计稿或凭据；没有账号权限时不能把目录当作离线设计资产本体。

## 创建原生实例

先绑定用户允许修改的目标页面或子树，读最新 revision，然后：

```json
{
  "scopeToken": "已绑定的token",
  "expectedRevision": "最新revision",
  "operations": [{
    "op": "library-instance",
    "key": "primaryHover",
    "parentId": "授权范围内的容器ID",
    "familyId": "144:5014",
    "variants": {
      "Type": "primary", "State": "hover", "Size": "default",
      "Shape": "default", "Status": "default"
    },
    "componentProperties": {"Text#144:0": "确认"},
    "props": {"x": 24, "y": 24}
  }]
}
```

- 直接选择目录中真实变体再实例化；未给出的轴优先使用唯一默认组合，缺失或含糊时报错，不取列表第一项凑数。
- 原生文本、布尔覆盖使用 `componentProperties` 中实际完整属性名；图标换项暂不开放。读取属性定义后再填写，不把可见文本当属性ID。
- 纯设计任务不要求 Vue 项目目录。若已连接项目，传 `projectRoot`，优先处理项目封装；原有 `instance` 操作仍要求显式项目映射，不允许绕过。
- 同源文件核对 sourceNodeId 和 key 后创建实例。跨文件使用 `importComponentByKeyAsync`，只导入依赖，不改源组件。**仅已发布且账号有权访问的组件可以跨文件导入**。本次采集时组件页抽样均为 UNPUBLISHED；不要宣称真实跨文件已全部可用。
- 导入后校验 key、名称、变体，覆盖后读回文字/布尔属性，再验证实例类型、mainComponent key、范围和最新版本。导入或权限失败保留原错误，不重绘假组件、不切换其他文件代做、不自动重放。
- 原生导入可能缓存组件依赖；回滚验证针对授权目标的可见节点，不声称清除了编辑器内部依赖缓存。

设计状态（hover、focused、pressed）与代码 props 分开：悬停并非一个名为 hover 的 Vue 属性。状态稿不等于运行原型。库版本、主题同步与 API 能力核验仍遵循具体项目证据，接入目录不代表其全部完成。
